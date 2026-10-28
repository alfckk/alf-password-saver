import { Logo } from '../ui/components';
import { UnlockForm } from '../ui/UnlockForm';

export function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  return (
    <div className="flex h-[480px] flex-col justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo size="lg" />
        <div>
          <h1 className="text-lg font-bold">保險庫已鎖定</h1>
          <p className="mt-1 text-sm text-slate-500">輸入主密碼以存取已儲存的密碼</p>
        </div>
      </div>
      <UnlockForm onUnlocked={onUnlocked} />
    </div>
  );
}
