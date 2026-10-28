import { useEffect, useState, type FormEvent } from 'react';
import { send } from '../lib/messages';
import type { Credential } from '../lib/types';
import { parseSite } from '../lib/url';
import { PasswordInput, errorMessage } from '../ui/components';
import { BackIcon } from '../ui/icons';

interface Props {
  credential?: Credential;
  defaultUrl: string;
  onCancel: () => void;
  onSaved: (c: Credential) => void;
}

export function CredentialForm({ credential, defaultUrl, onCancel, onSaved }: Props) {
  const defaultOrigin = parseSite(defaultUrl)?.origin ?? '';
  const [form, setForm] = useState({
    name: credential?.name ?? '',
    origin: credential?.origin ?? defaultOrigin,
    username: credential?.username ?? '',
    password: credential?.password ?? '',
    notes: credential?.notes ?? '',
  });
  const [autoFillDomains, setAutoFillDomains] = useState<string[] | null>(null);
  const [autoFill, setAutoFill] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const site = parseSite(form.origin);
  const siteAutoFill = !!site && !!autoFillDomains?.includes(site.domain);
  const autoFillChecked = autoFill ?? siteAutoFill;

  useEffect(() => {
    send('getSettings').then((s) => setAutoFillDomains(s.autoFillDomains), () => undefined);
  }, []);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const saved = credential
        ? await send('update', { id: credential.id, changes: form })
        : await send('create', form);
      if (autoFillDomains && autoFillChecked !== siteAutoFill) {
        await send('setAutoFill', { url: saved.origin, enabled: autoFillChecked });
      }
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex h-full flex-col">
      <header className="flex items-center gap-1 border-b border-slate-200 p-2 dark:border-slate-800">
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="返回">
          <BackIcon />
        </button>
        <h1 className="text-sm font-bold">{credential ? '編輯密碼' : '新增密碼'}</h1>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <div>
          <label className="label" htmlFor="f-origin">網址</label>
          <input id="f-origin" className="input" value={form.origin} onChange={set('origin')} placeholder="https://example.com" required />
        </div>
        <div>
          <label className="label" htmlFor="f-name">名稱</label>
          <input id="f-name" className="input" value={form.name} onChange={set('name')} placeholder="預設為網站主機名稱" />
        </div>
        <div>
          <label className="label" htmlFor="f-username">使用者名稱</label>
          <input id="f-username" className="input" value={form.username} onChange={set('username')} autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="f-password">密碼</label>
          <PasswordInput id="f-password" value={form.password} onChange={set('password')} autoComplete="new-password" required />
        </div>
        {autoFillDomains && (
          <label
            className="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
            title="開啟登入頁時自動填入此網站最近使用的帳號"
          >
            <input
              type="checkbox"
              className="accent-brand-500"
              checked={autoFillChecked}
              disabled={!site}
              onChange={(e) => setAutoFill(e.target.checked)}
            />
            在此網站開啟自動預填{site ? `（${site.domain}）` : ''}
          </label>
        )}
        <div>
          <label className="label" htmlFor="f-notes">備註</label>
          <textarea id="f-notes" className="input min-h-[72px] resize-y" value={form.notes} onChange={set('notes')} />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <footer className="flex justify-end gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          取消
        </button>
        <button className="btn-primary" disabled={busy}>
          儲存
        </button>
      </footer>
    </form>
  );
}
