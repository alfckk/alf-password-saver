import { KeyIcon, LockIcon } from './icons';

interface Props {
  rect: DOMRect;
  locked: boolean;
  onClick: () => void;
}

const SIZE = 24;

export function FieldIcon({ rect, locked, onClick }: Props) {
  const top = rect.top + (rect.height - SIZE) / 2;
  const left = rect.right - SIZE - 6;
  return (
    <button
      className={`field-icon${locked ? ' locked' : ''}`}
      style={{ top, left }}
      // Keep focus on the page field so the dropdown doesn't close on blur.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={locked ? 'Password Saver（已鎖定）' : 'Password Saver'}
      aria-label="開啟密碼選單"
    >
      {locked ? <LockIcon /> : <KeyIcon />}
    </button>
  );
}
