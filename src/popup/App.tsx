import { useCallback, useEffect, useState } from 'react';
import { send } from '../lib/messages';
import type { Credential, VaultStatus } from '../lib/types';
import { Logo, Toast, useToast } from '../ui/components';
import { CredentialDetail } from './CredentialDetail';
import { CredentialForm } from './CredentialForm';
import { LockScreen } from './LockScreen';
import { VaultList } from './VaultList';

type View = { name: 'list' } | { name: 'detail'; id: string } | { name: 'edit'; id: string | null };

export function App() {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [items, setItems] = useState<Credential[]>([]);
  const [tabUrl, setTabUrl] = useState('');
  const [view, setView] = useState<View>({ name: 'list' });
  const [toast, showToast] = useToast();

  const reload = useCallback(async () => {
    const s = await send('getStatus');
    setStatus(s);
    if (s.initialized && !s.locked) setItems(await send('list'));
  }, []);

  useEffect(() => {
    void reload();
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => setTabUrl(tab?.url ?? ''));
  }, [reload]);

  if (!status) return <div className="h-[480px]" />;

  if (!status.initialized) {
    return (
      <div className="flex h-[480px] flex-col items-center justify-center gap-4 p-8 text-center">
        <Logo size="lg" />
        <div>
          <h1 className="text-lg font-bold">歡迎使用 Password Saver</h1>
          <p className="mt-1 text-sm text-slate-500">先建立主密碼，所有密碼都會在本機加密儲存。</p>
        </div>
        <button className="btn-primary w-full" onClick={() => chrome.runtime.openOptionsPage()}>
          開始設定
        </button>
      </div>
    );
  }

  if (status.locked) return <LockScreen onUnlocked={reload} />;

  const current = view.name !== 'list' ? items.find((c) => c.id === view.id) : undefined;

  return (
    <div className="relative flex h-[540px] flex-col">
      {view.name === 'list' && (
        <VaultList
          items={items}
          tabUrl={tabUrl}
          onOpen={(id) => setView({ name: 'detail', id })}
          onAdd={() => setView({ name: 'edit', id: null })}
          onLock={async () => {
            await send('lock');
            await reload();
          }}
          toast={showToast}
        />
      )}
      {view.name === 'detail' && current && (
        <CredentialDetail
          credential={current}
          onBack={() => setView({ name: 'list' })}
          onEdit={() => setView({ name: 'edit', id: current.id })}
          onDeleted={async () => {
            await reload();
            setView({ name: 'list' });
            showToast('已刪除');
          }}
          toast={showToast}
        />
      )}
      {view.name === 'edit' && (
        <CredentialForm
          credential={view.id ? current : undefined}
          defaultUrl={tabUrl}
          onCancel={() => setView(view.id ? { name: 'detail', id: view.id } : { name: 'list' })}
          onSaved={async (saved) => {
            await reload();
            setView({ name: 'detail', id: saved.id });
            showToast('已儲存');
          }}
        />
      )}
      <Toast message={toast} />
    </div>
  );
}
