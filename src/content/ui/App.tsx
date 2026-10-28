import { useCallback, useEffect, useRef, useState } from 'react';
import { send, type TabMessage } from '../../lib/messages';
import type { CredentialSummary, PendingSaveView, VaultStatus } from '../../lib/types';
import { hasLoginFields, isLoginField } from '../detector';
import { fillCredential, prefillCredential } from '../fill';
import { FieldIcon } from './FieldIcon';
import { FillDropdown } from './FillDropdown';
import { SavePrompt } from './SavePrompt';

interface Props {
  isTop: boolean;
}

export function App({ isTop }: Props) {
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const [field, setField] = useState<HTMLInputElement | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [matches, setMatches] = useState<CredentialSummary[]>([]);
  const [pending, setPending] = useState<PendingSaveView | null>(null);

  const activate = useCallback((input: HTMLInputElement | null) => {
    fieldRef.current = input;
    setField(input);
    setRect(input?.getBoundingClientRect() ?? null);
    if (!input) setOpen(false);
  }, []);

  const refreshMatches = useCallback(async () => {
    try {
      const res = await send('getMatches');
      setStatus(res.status);
      setMatches(res.matches);
      return res;
    } catch {
      return null;
    }
  }, []);

  const refreshPending = useCallback(async () => {
    if (!isTop) return;
    try {
      setPending(await send('getPendingSave'));
    } catch {
      setPending(null);
    }
  }, [isTop]);

  const tryPrefill = useCallback(async () => {
    if (!hasLoginFields()) return;
    try {
      const creds = await send('getAutoFill');
      if (creds) prefillCredential(creds.username, creds.password);
    } catch {
      // Extension reloaded or service worker unavailable.
    }
  }, []);

  useEffect(() => {
    void refreshPending();
    if (hasLoginFields()) {
      void refreshMatches();
      void tryPrefill();
    }
  }, [refreshMatches, refreshPending, tryPrefill]);

  useEffect(() => {
    const onFocusIn = async (e: FocusEvent) => {
      const target = e.composedPath()[0];
      if (!isLoginField(target)) return;
      activate(target);
      const res = await refreshMatches();
      if (res && !res.status.locked && res.matches.length > 0 && !target.value && fieldRef.current === target) {
        setOpen(true);
      }
    };
    const onFocusOut = () => {
      setTimeout(() => {
        const current = fieldRef.current;
        if (current && current.getRootNode() instanceof Document && document.activeElement !== current) {
          activate(null);
        }
      }, 120);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onInput = (e: Event) => {
      if (e.isTrusted && e.composedPath()[0] === fieldRef.current) setOpen(false);
    };
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('input', onInput, true);
    return () => {
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('input', onInput, true);
    };
  }, [activate, refreshMatches]);

  useEffect(() => {
    if (!field) return;
    const update = () => {
      if (!field.isConnected) activate(null);
      else setRect(field.getBoundingClientRect());
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    const timer = window.setInterval(update, 400);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      window.clearInterval(timer);
    };
  }, [field, activate]);

  // SPA login screens appear long after document_idle.
  useEffect(() => {
    let timer = 0;
    let seen = hasLoginFields();
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const now = hasLoginFields();
        if (now && !seen) {
          void refreshMatches();
          void tryPrefill();
        }
        seen = now;
      }, 400);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [refreshMatches, tryPrefill]);

  useEffect(() => {
    const listener = (message: TabMessage) => {
      if (message.type === 'pendingSaveChanged') void refreshPending();
      else if (message.type === 'vaultStatusChanged') {
        void refreshMatches();
        void tryPrefill();
      } else if (message.type === 'autoFillChanged') void tryPrefill();
      else if (message.type === 'fillCredential' && isTop) {
        fillCredential(message.username, message.password, fieldRef.current);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [isTop, refreshMatches, refreshPending, tryPrefill]);

  async function pick(id: string) {
    try {
      const creds = await send('fill', { id });
      fillCredential(creds.username, creds.password, fieldRef.current);
    } finally {
      setOpen(false);
    }
  }

  async function resolve(action: 'save' | 'never' | 'dismiss', username?: string, autoFill?: boolean) {
    await send('resolvePendingSave', { action, username, autoFill });
    setPending(null);
    if (action === 'save') void refreshMatches();
  }

  const locked = status?.locked ?? true;
  const inView = rect && rect.bottom > 0 && rect.top < window.innerHeight;

  return (
    <div className="layer">
      {field && rect && inView && (
        <FieldIcon rect={rect} locked={locked} onClick={() => setOpen((o) => !o)} />
      )}
      {field && rect && inView && open && (
        <FillDropdown
          rect={rect}
          locked={locked}
          matches={matches}
          onPick={pick}
          onOpenVault={() => {
            setOpen(false);
            void send('openPopup');
          }}
        />
      )}
      {pending && (
        <SavePrompt
          pending={pending}
          onSave={(username, autoFill) => resolve('save', username, autoFill)}
          onNever={() => void resolve('never')}
          onDismiss={() => void resolve('dismiss')}
          onUnlock={() => void send('openPopup')}
        />
      )}
    </div>
  );
}
