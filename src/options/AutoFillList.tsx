import { useState, type FormEvent } from 'react';
import type { Settings } from '../lib/types';
import { parseSite } from '../lib/url';
import { TrashIcon } from '../ui/icons';

export function AutoFillList({ settings, onChange }: { settings: Settings; onChange: (s: Partial<Settings>) => void }) {
  const domains = settings.autoFillDomains;
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  function add(e: FormEvent) {
    e.preventDefault();
    const site = parseSite(input.trim());
    if (!input.trim() || !site) {
      setError('網址無效');
      return;
    }
    setError('');
    setInput('');
    if (!domains.includes(site.domain)) onChange({ autoFillDomains: [...domains, site.domain] });
  }

  return (
    <section className="card p-6">
      <h2 className="text-base font-bold">自動預填的網站</h2>
      <p className="mt-1 text-xs text-slate-500">
        開啟這些網站的登入頁時，會自動填入最近一次在該網站使用的帳號與密碼（欄位已有內容時不會覆寫）。也可以在 Popup 的「目前網站」區塊開啟。
      </p>
      <form onSubmit={add} className="mt-4 flex max-w-md gap-2">
        <input
          className="input"
          placeholder="例如 github.com"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="btn-secondary flex-none" disabled={!input.trim()}>
          新增
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {domains.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">目前沒有任何網站。</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-700">
          {domains.map((d) => (
            <li key={d} className="flex items-center justify-between py-2">
              <span className="text-sm">{d}</span>
              <button
                className="icon-btn hover:text-red-600"
                title="移除"
                onClick={() => onChange({ autoFillDomains: domains.filter((x) => x !== d) })}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
