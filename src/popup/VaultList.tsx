import { useMemo, useState } from 'react';
import { send } from '../lib/messages';
import type { Credential } from '../lib/types';
import { canFillOn, parseSite } from '../lib/url';
import { Favicon, errorMessage } from '../ui/components';
import { CopyIcon, FillIcon, GearIcon, KeyIcon, LockIcon, PlusIcon, SearchIcon, UserIcon } from '../ui/icons';

interface Props {
  items: Credential[];
  tabUrl: string;
  onOpen: (id: string) => void;
  onAdd: () => void;
  onLock: () => void;
  toast: (msg: string) => void;
}

function matchesQuery(c: Credential, q: string): boolean {
  return [c.name, c.hostname, c.username, c.notes].some((f) => f.toLowerCase().includes(q));
}

export function VaultList({ items, tabUrl, onOpen, onAdd, onLock, toast }: Props) {
  const [query, setQuery] = useState('');
  const site = parseSite(tabUrl);

  const { forSite, others } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? items.filter((c) => matchesQuery(c, q)) : items;
    const forSite = site ? filtered.filter((c) => canFillOn(c.origin, tabUrl)) : [];
    const siteIds = new Set(forSite.map((c) => c.id));
    return { forSite, others: filtered.filter((c) => !siteIds.has(c.id)) };
  }, [items, query, tabUrl, site]);

  async function copy(text: string, what: string) {
    await navigator.clipboard.writeText(text);
    toast(`已複製${what}`);
  }

  async function fill(id: string) {
    try {
      await send('fillInActiveTab', { id });
      window.close();
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  const Row = ({ c, fillable }: { c: Credential; fillable: boolean }) => (
    <li className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
      <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onOpen(c.id)}>
        <Favicon url={c.origin} name={c.name} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{c.name}</div>
          <div className="truncate text-xs text-slate-500">{c.username || '（無使用者名稱）'}</div>
        </div>
      </button>
      <div className="flex flex-none items-center opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        {fillable && (
          <button className="icon-btn text-brand-600" title="填入此網站" onClick={() => fill(c.id)}>
            <FillIcon />
          </button>
        )}
        {c.username && (
          <button className="icon-btn" title="複製使用者名稱" onClick={() => copy(c.username, '使用者名稱')}>
            <UserIcon />
          </button>
        )}
        <button className="icon-btn" title="複製密碼" onClick={() => copy(c.password, '密碼')}>
          <CopyIcon />
        </button>
      </div>
    </li>
  );

  return (
    <>
      <header className="flex items-center gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            className="input pl-9"
            placeholder="搜尋密碼"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button className="icon-btn" title="新增密碼" onClick={onAdd}>
          <PlusIcon />
        </button>
        <button className="icon-btn" title="設定" onClick={() => chrome.runtime.openOptionsPage()}>
          <GearIcon />
        </button>
        <button className="icon-btn" title="鎖定" onClick={onLock}>
          <LockIcon />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {site && !query && (
          <section className="mb-2">
            <h2 className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              目前網站 · {site.hostname}
            </h2>
            {forSite.length === 0 ? (
              <p className="px-2 py-2 text-xs text-slate-500">此網站尚未儲存密碼。</p>
            ) : (
              <ul>
                {forSite.map((c) => (
                  <Row key={c.id} c={c} fillable />
                ))}
              </ul>
            )}
          </section>
        )}

        <section>
          <h2 className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {query ? `搜尋結果（${forSite.length + others.length}）` : `所有密碼（${items.length}）`}
          </h2>
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-slate-800">
                <KeyIcon className="h-6 w-6" />
              </div>
              <p className="text-sm text-slate-500">尚未儲存任何密碼。登入網站時會自動提示儲存，或從設定匯入 CSV。</p>
            </div>
          ) : (
            <ul>
              {(query ? [...forSite, ...others] : others).map((c) => (
                <Row key={c.id} c={c} fillable={forSite.includes(c)} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
