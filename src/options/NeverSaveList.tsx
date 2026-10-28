import type { Settings } from '../lib/types';
import { TrashIcon } from '../ui/icons';

export function NeverSaveList({ settings, onChange }: { settings: Settings; onChange: (s: Partial<Settings>) => void }) {
  const domains = settings.neverSaveDomains;
  return (
    <section className="card p-6">
      <h2 className="text-base font-bold">永不儲存的網站</h2>
      <p className="mt-1 text-xs text-slate-500">在這些網站登入時不會詢問是否儲存密碼。</p>
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
                onClick={() => onChange({ neverSaveDomains: domains.filter((x) => x !== d) })}
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
