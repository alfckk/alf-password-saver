import { useState, type FormEvent } from 'react';
import { send } from '../lib/messages';
import { PasswordInput, errorMessage } from './components';

export function UnlockForm({ onUnlocked, compact = false }: { onUnlocked: () => void; compact?: boolean }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      await send('unlock', { masterPassword: password });
      setPassword('');
      onUnlocked();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
      <PasswordInput
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="輸入主密碼"
        aria-label="主密碼"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={busy || !password}>
        {busy ? '解鎖中…' : '解鎖'}
      </button>
    </form>
  );
}
