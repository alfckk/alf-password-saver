import { useEffect, useState } from 'react';
import { send } from '../lib/messages';
import type { Credential } from '../lib/types';
import { parseSite } from '../lib/url';
import { Favicon, errorMessage } from '../ui/components';
import { BackIcon, CopyIcon, EditIcon, ExternalIcon, EyeIcon, EyeOffIcon, TrashIcon, WarnIcon } from '../ui/icons';

interface Props {
  credential: Credential;
  onBack: () => void;
  onEdit: () => void;
  onDeleted: () => void;
  toast: (msg: string) => void;
}

const formatDate = (ts: number) =>
  new Date(ts).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' });

export function CredentialDetail({ credential: c, onBack, onEdit, onDeleted, toast }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [autoFillDomains, setAutoFillDomains] = useState<string[] | null>(null);
  const domain = parseSite(c.origin)?.domain;
  const autoFill = !!domain && !!autoFillDomains?.includes(domain);

  useEffect(() => {
    send('getSettings').then((s) => setAutoFillDomains(s.autoFillDomains), () => undefined);
  }, []);

  async function toggleAutoFill(enabled: boolean) {
    if (!domain || !autoFillDomains) return;
    const previous = autoFillDomains;
    setAutoFillDomains(enabled ? [...previous, domain] : previous.filter((d) => d !== domain));
    try {
      setAutoFillDomains((await send('setAutoFill', { url: c.origin, enabled })).autoFillDomains);
      toast(enabled ? '已開啟此網站的自動預填' : '已關閉此網站的自動預填');
    } catch (err) {
      setAutoFillDomains(previous);
      toast(errorMessage(err));
    }
  }

  async function copy(text: string, what: string) {
    await navigator.clipboard.writeText(text);
    toast(`已複製${what}`);
  }

  async function remove() {
    try {
      await send('remove', { id: c.id });
      onDeleted();
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  const Field = ({ label, value, mono, action }: { label: string; value: string; mono?: boolean; action?: React.ReactNode }) => (
    <div className="flex items-center gap-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="label mb-0.5">{label}</div>
        <div className={`truncate text-sm ${mono ? 'font-mono tracking-wide' : ''}`}>{value || '—'}</div>
      </div>
      {action}
    </div>
  );

  return (
    <>
      <header className="flex items-center gap-1 border-b border-slate-200 p-2 dark:border-slate-800">
        <button className="icon-btn" onClick={onBack} aria-label="返回">
          <BackIcon />
        </button>
        <div className="flex-1" />
        <button className="icon-btn" onClick={onEdit} title="編輯">
          <EditIcon />
        </button>
        <button className="icon-btn hover:text-red-600" onClick={() => setConfirming(true)} title="刪除">
          <TrashIcon />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 flex items-center gap-3">
          <Favicon url={c.origin} name={c.name} />
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold">{c.name}</h1>
            <a
              href={c.origin}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 truncate text-xs text-brand-600 hover:underline"
            >
              {c.hostname}
              <ExternalIcon className="h-3 w-3" />
            </a>
          </div>
        </div>

        {c.origin.startsWith('http:') && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            <WarnIcon className="h-4 w-4 flex-none" />
            此網站使用未加密的 HTTP 連線。
          </div>
        )}

        <div className="card divide-y divide-slate-200 dark:divide-slate-700">
          <Field
            label="使用者名稱"
            value={c.username}
            action={
              c.username && (
                <button className="icon-btn" onClick={() => copy(c.username, '使用者名稱')} title="複製">
                  <CopyIcon />
                </button>
              )
            }
          />
          <Field
            label="密碼"
            value={revealed ? c.password : '•'.repeat(Math.min(c.password.length, 16))}
            mono
            action={
              <>
                <button className="icon-btn" onClick={() => setRevealed((r) => !r)} title={revealed ? '隱藏' : '顯示'}>
                  {revealed ? <EyeOffIcon /> : <EyeIcon />}
                </button>
                <button className="icon-btn" onClick={() => copy(c.password, '密碼')} title="複製">
                  <CopyIcon />
                </button>
              </>
            }
          />
        </div>

        {domain && autoFillDomains && (
          <label className="card mt-3 flex cursor-pointer items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">在此網站自動預填</div>
              <div className="text-xs text-slate-500">開啟 {domain} 的登入頁時，自動填入最近使用的帳號</div>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4 flex-none accent-brand-500"
              checked={autoFill}
              onChange={(e) => toggleAutoFill(e.target.checked)}
            />
          </label>
        )}

        {c.notes && (
          <div className="card mt-3 px-4 py-3">
            <div className="label">備註</div>
            <p className="whitespace-pre-wrap break-words text-sm">{c.notes}</p>
          </div>
        )}

        <dl className="mt-4 space-y-1 px-1 text-xs text-slate-500">
          <div>建立時間：{formatDate(c.createdAt)}</div>
          <div>最後修改：{formatDate(c.updatedAt)}</div>
          {c.lastUsedAt && <div>最後使用：{formatDate(c.lastUsedAt)}</div>}
        </dl>
      </div>

      {confirming && (
        <div className="absolute inset-0 z-40 flex items-end bg-black/30 p-3" onClick={() => setConfirming(false)}>
          <div className="card w-full p-4 shadow-xl dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold">刪除此密碼？</h2>
            <p className="mt-1 text-sm text-slate-500">
              「{c.name}」的 {c.username || '帳號'} 將被永久刪除，無法復原。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setConfirming(false)}>
                取消
              </button>
              <button className="btn-danger" onClick={remove}>
                刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
