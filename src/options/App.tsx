import { useCallback, useEffect, useState } from 'react';
import { send } from '../lib/messages';
import type { Settings, VaultStatus } from '../lib/types';
import { Logo, Toast, useToast } from '../ui/components';
import { LockIcon } from '../ui/icons';
import { ImportExport } from './ImportExport';
import { NeverSaveList } from './NeverSaveList';
import { SecuritySettings } from './SecuritySettings';
import { SetupWizard } from './SetupWizard';

export function App() {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [toast, showToast] = useToast();

  const reload = useCallback(async () => {
    setStatus(await send('getStatus'));
    setSettings(await send('getSettings'));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = async (changes: Partial<Settings>) => {
    setSettings(await send('updateSettings', changes));
    showToast('設定已更新');
  };

  if (!status || !settings) return null;
  if (!status.initialized) return <SetupWizard onDone={reload} />;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8 flex items-center gap-3">
        <Logo />
        <div className="flex-1">
          <h1 className="text-xl font-bold">Password Saver 設定</h1>
          <p className="text-sm text-slate-500">所有資料皆以 AES-256-GCM 加密，僅儲存在此裝置。</p>
        </div>
        {!status.locked && (
          <button
            className="btn-secondary"
            onClick={async () => {
              setStatus(await send('lock'));
              showToast('保險庫已鎖定');
            }}
          >
            <LockIcon />
            立即鎖定
          </button>
        )}
      </header>

      <div className="space-y-6">
        <SecuritySettings settings={settings} onChange={save} />
        <NeverSaveList settings={settings} onChange={save} />
        <ImportExport status={status} onStatusChange={reload} toast={showToast} />
      </div>
      <Toast message={toast} />
    </div>
  );
}
