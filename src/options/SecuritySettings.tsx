import type { Settings } from '../lib/types';
import { WarnIcon } from '../ui/icons';

const AUTOLOCK_OPTIONS = [1, 5, 15, 30, 60, 240, 0];

function autoLockLabel(m: number): string {
  if (m === 0) return '永不';
  return m < 60 ? `${m} 分鐘` : `${m / 60} 小時`;
}

export function SecuritySettings({ settings, onChange }: { settings: Settings; onChange: (s: Partial<Settings>) => void }) {
  const never = settings.autoLockMinutes === 0;
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
              {autoLockLabel(m)}
            </option>
          ))}
        </select>
      </div>
      {never && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          <WarnIcon className="h-4 w-4 flex-none" />
          <p>保險庫會一直保持解鎖，直到你手動鎖定或關閉瀏覽器。任何能使用這台電腦的人都能看到你的密碼。</p>
        </div>
      )}
    </section>
  );
}
