import type { CredentialSummary } from '../../lib/types';
import { KeyIcon, LockIcon } from './icons';

interface Props {
  rect: DOMRect;
  locked: boolean;
  matches: CredentialSummary[];
  onPick: (id: string) => void;
  onOpenVault: () => void;
}

const GAP = 6;
const EST_HEIGHT = 260;

export function FillDropdown({ rect, locked, matches, onPick, onOpenVault }: Props) {
  const below = window.innerHeight - rect.bottom > EST_HEIGHT || rect.top < EST_HEIGHT;
  const style: React.CSSProperties = {
    left: Math.max(8, Math.min(rect.left, window.innerWidth - 300)),
    width: Math.max(280, Math.min(rect.width, 380)),
    ...(below ? { top: rect.bottom + GAP } : { bottom: window.innerHeight - rect.top + GAP }),
  };

  return (
    <div className="dropdown" style={style} onMouseDown={(e) => e.preventDefault()} role="listbox">
      <div className="dropdown-header">
        {locked ? <LockIcon size={12} /> : <KeyIcon size={12} />}
        Password Saver
      </div>

      {locked ? (
        <div className="empty">保險庫已鎖定，解鎖後即可填入已儲存的密碼。</div>
      ) : matches.length === 0 ? (
        <div className="empty">此網站沒有已儲存的密碼。</div>
      ) : (
        <div className="dropdown-list">
          {matches.map((m) => (
            <button key={m.id} className="item" role="option" onClick={() => onPick(m.id)}>
              <div className="avatar" style={{ fontWeight: 700, color: 'var(--ps-brand)' }}>
                {(m.name || m.hostname).charAt(0).toUpperCase()}
              </div>
              <div className="item-text">
                <span className="item-title">{m.username || '（無使用者名稱）'}</span>
                <span className="item-sub">{m.name || m.hostname}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="dropdown-footer">
        <button className="footer-btn" onClick={onOpenVault}>
          {locked ? '解鎖保險庫' : '管理密碼…'}
        </button>
      </div>
    </div>
  );
}
