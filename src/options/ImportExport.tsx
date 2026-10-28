import { useRef, useState, type FormEvent } from 'react';
import { send } from '../lib/messages';
import type { VaultStatus } from '../lib/types';
import { PasswordInput, errorMessage } from '../ui/components';
import { WarnIcon } from '../ui/icons';
import { UnlockForm } from '../ui/UnlockForm';

interface Props {
  status: VaultStatus;
  onStatusChange: () => void;
  toast: (msg: string) => void;
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ImportExport({ status, onStatusChange, toast }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState('');
  const [importError, setImportError] = useState('');
  const [exportPassword, setExportPassword] = useState('');
  const [exportError, setExportError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setImportError('');
    setImportResult('');
    try {
      const { added, updated, skipped } = await send('importCsv', { text: await file.text() });
      setImportResult(`已新增 ${added} 筆、更新 ${updated} 筆、略過 ${skipped} 筆。`);
      toast('匯入完成');
    } catch (err) {
      setImportError(errorMessage(err));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onExport(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setExportError('');
    try {
      const { csv } = await send('exportCsv', { masterPassword: exportPassword });
      const date = new Date().toISOString().slice(0, 10);
      download(`password-saver-${date}.csv`, csv);
      setExportPassword('');
      onStatusChange();
    } catch (err) {
      setExportError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="card p-6">
        <h2 className="text-base font-bold">匯入密碼</h2>
        <p className="mt-1 text-xs text-slate-500">
          支援 Chrome / Google 密碼管理工具匯出的 CSV（name, url, username, password, note），也相容 Bitwarden 等常見格式。
          同網站同帳號的項目會以新密碼更新。
        </p>
        <div className="mt-4">
          {status.locked ? (
            <div className="max-w-sm">
              <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">請先解鎖保險庫再匯入。</p>
              <UnlockForm compact onUnlocked={onStatusChange} />
            </div>
          ) : (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
                選擇 CSV 檔案…
              </button>
            </>
          )}
          {importResult && <p className="mt-3 text-sm text-emerald-600">{importResult}</p>}
          {importError && <p className="mt-3 text-sm text-red-600">{importError}</p>}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-base font-bold">匯出密碼</h2>
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          <WarnIcon className="h-4 w-4 flex-none" />
          <p>
            匯出的 CSV 檔案是<strong>未加密的明文</strong>，任何能存取該檔案的人都能看到你的密碼。使用完畢請立即刪除。
          </p>
        </div>
        <form onSubmit={onExport} className="mt-4 flex max-w-sm flex-col gap-2">
          <label className="label" htmlFor="export-pw">輸入主密碼以確認</label>
          <PasswordInput id="export-pw" value={exportPassword} onChange={(e) => setExportPassword(e.target.value)} />
          {exportError && <p className="text-xs text-red-600">{exportError}</p>}
          <button className="btn-primary self-start" disabled={!exportPassword || busy}>
            {busy ? '匯出中…' : '匯出 CSV'}
          </button>
        </form>
      </section>
    </>
  );
}
