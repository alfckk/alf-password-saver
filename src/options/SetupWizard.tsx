import { useState, type FormEvent } from 'react';
import { send } from '../lib/messages';
import { estimateStrength } from '../lib/strength';
import { Logo, PasswordInput, StrengthMeter, errorMessage } from '../ui/components';
import { WarnIcon } from '../ui/icons';

export function SetupWizard({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const tooShort = password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const weak = estimateStrength(password).score < 2;
  const canSubmit = !tooShort && confirm === password && acknowledged && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      await send('setup', { masterPassword: password });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Logo size="lg" />
        <h1 className="text-2xl font-bold">建立你的主密碼</h1>
        <p className="text-sm text-slate-500">
          主密碼用來加密所有已儲存的密碼。資料只存在這台電腦上，不會上傳到任何伺服器。
        </p>
      </div>

      <form onSubmit={submit} className="card space-y-4 p-6 shadow-sm">
        <div>
          <label className="label" htmlFor="mp">主密碼</label>
          <PasswordInput id="mp" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <StrengthMeter password={password} />
          {password && tooShort && <p className="mt-1 text-xs text-red-600">至少需要 8 個字元</p>}
          {password && !tooShort && weak && (
            <p className="mt-1 text-xs text-amber-600">建議使用更長、混合大小寫、數字與符號的密碼或通關片語。</p>
          )}
        </div>
        <div>
          <label className="label" htmlFor="mp2">再次輸入主密碼</label>
          <PasswordInput id="mp2" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          {mismatch && <p className="mt-1 text-xs text-red-600">兩次輸入的密碼不一致</p>}
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          <WarnIcon className="mt-0.5 h-4 w-4 flex-none" />
          <span className="flex-1">
            我了解<strong>忘記主密碼將無法復原</strong>任何已儲存的密碼，因為沒有人（包括開發者）能解密這些資料。
          </span>
          <input type="checkbox" className="mt-1" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full py-2.5" disabled={!canSubmit}>
          {busy ? '建立中…' : '建立保險庫'}
        </button>
      </form>
    </div>
  );
}
