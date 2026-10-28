import type { Settings } from '../lib/types';

const AUTOLOCK_OPTIONS = [1, 5, 15, 30, 60, 240];

export function SecuritySettings({ settings, onChange }: { settings: Settings; onChange: (s: Partial<Settings>) => void }) {
  return (
    <section className="card p-6">
      <h2 className="text-base font-bold">安全性</h2>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium">自動鎖定</div>
          <p className="text-xs text-slate-500">閒置一段時間後自動鎖定保險庫，關閉瀏覽器時也會鎖定。</p>
        </div>
        <select
          className="input w-auto"
          value={settings.autoLockMinutes}
          onChange={(e) => onChange({ autoLockMinutes: Number(e.target.value) })}
        >
          {AUTOLOCK_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m < 60 ? `${m} 分鐘` : `${m / 60} 小時`}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
