import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { estimateStrength } from '../lib/strength';
import { faviconUrl } from '../lib/url';
import { EyeIcon, EyeOffIcon, KeyIcon } from './icons';

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-14 w-14 rounded-2xl' : 'h-8 w-8 rounded-lg';
  const icon = size === 'lg' ? 'h-7 w-7' : 'h-4 w-4';
  return (
    <div className={`${box} flex items-center justify-center bg-brand-500 text-white shadow-sm`}>
      <KeyIcon className={icon} />
    </div>
  );
}

export function Favicon({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const src = faviconUrl(url, 32);
  return (
    <div className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-sm font-bold text-brand-600 dark:bg-slate-800 dark:text-brand-100">
      {src && !failed ? (
        <img src={src} alt="" className="h-5 w-5" onError={() => setFailed(true)} />
      ) : (
        (name || '?').charAt(0).toUpperCase()
      )}
    </div>
  );
}

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`input pr-10 ${props.className ?? ''}`} />
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-y-0 right-1 my-auto icon-btn"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? '隱藏密碼' : '顯示密碼'}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

const STRENGTH_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-emerald-500'];

export function StrengthMeter({ password }: { password: string }) {
  const { score, label } = estimateStrength(password);
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${password && i <= score ? STRENGTH_COLORS[score] : 'bg-slate-200 dark:bg-slate-700'}`}
          />
        ))}
      </div>
      {password && <p className="mt-1 text-xs text-slate-500">強度：{label}</p>}
    </div>
  );
}

export function useToast(): [string, (msg: string) => void] {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(''), 1600);
    return () => clearTimeout(t);
  }, [msg]);
  return [msg, setMsg];
}

export function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center">
      <div className="rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-lg dark:bg-white dark:text-slate-900">
        {message}
      </div>
    </div>
  );
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
