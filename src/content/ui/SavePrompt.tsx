import { useEffect, useState } from 'react';
import type { PendingSaveView } from '../../lib/types';
import { CloseIcon, KeyIcon, LockIcon } from './icons';

interface Props {
  pending: PendingSaveView;
  onSave: (username: string, autoFill?: boolean) => Promise<void>;
  onNever: () => void;
  onDismiss: () => void;
  onUnlock: () => void;
}

export function SavePrompt({ pending, onSave, onNever, onDismiss, onUnlock }: Props) {
  const [username, setUsername] = useState(pending.username);
  const [autoFill, setAutoFill] = useState(pending.autoFill);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setUsername(pending.username), [pending.username]);
  useEffect(() => setAutoFill(pending.autoFill), [pending.autoFill]);

  const locked = pending.kind === null;
  const isUpdate = pending.kind === 'update';

  async function save() {
    setBusy(true);
    setError('');
    try {
      await onSave(username, isUpdate ? undefined : autoFill);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="prompt" role="dialog" aria-label="儲存密碼">
      <div className="prompt-head">
        <div className="avatar" style={{ color: 'var(--ps-brand)' }}>
          {locked ? <LockIcon size={16} /> : <KeyIcon size={16} />}
        </div>
        <div>
          <div className="prompt-title">{isUpdate ? '要更新密碼嗎？' : '要儲存密碼嗎？'}</div>
          <div className="prompt-host">{pending.hostname}</div>
        </div>
        <button className="close" onClick={onDismiss} aria-label="關閉">
          <CloseIcon />
        </button>
      </div>

      {pending.insecure && <div className="warn">此網站未使用 HTTPS 加密連線，密碼可能被攔截。</div>}

      {locked ? (
        <>
          <div className="empty" style={{ padding: '0 0 12px' }}>
            保險庫目前已鎖定，請先解鎖才能儲存此密碼。
          </div>
          <div className="actions">
            <button className="btn btn-ghost" onClick={onDismiss}>
              稍後
            </button>
            <button className="btn btn-primary" onClick={onUnlock}>
              解鎖並儲存
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label htmlFor="ps-username">使用者名稱</label>
            <input
              id="ps-username"
              value={username}
              readOnly={isUpdate}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="（無使用者名稱）"
            />
          </div>
          <div className="field">
            <label>密碼</label>
            <div className="masked">••••••••••</div>
          </div>
          {!isUpdate && (
            <label className="check">
              <input type="checkbox" checked={autoFill} onChange={(e) => setAutoFill(e.target.checked)} />
              在此網站開啟自動預填
            </label>
          )}
          {error && <div className="error">{error}</div>}
          <div className="actions">
            {!isUpdate && (
              <button className="btn btn-ghost" onClick={onNever}>
                永不在此網站儲存
              </button>
            )}
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {isUpdate ? '更新' : '儲存'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
