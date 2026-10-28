import { send } from '../lib/messages';
import {
  findStandaloneUsername,
  findUsernameFor,
  isLoginField,
  passwordFieldsIn,
  pickSubmittedPassword,
} from './detector';

const SUBMIT_TEXT = /log\s*in|sign\s*in|sign\s*up|register|continue|next|submit|登入|登錄|登录|註冊|注册|下一步|繼續|继续|確定|送出/i;
const DEDUPE_MS = 1500;

let lastSignature = '';
let lastSentAt = 0;

function shouldSend(signature: string): boolean {
  const now = Date.now();
  if (signature === lastSignature && now - lastSentAt < DEDUPE_MS) return false;
  lastSignature = signature;
  lastSentAt = now;
  return true;
}

function captureFrom(scope: HTMLFormElement | Document): void {
  const password = pickSubmittedPassword(passwordFieldsIn(scope));
  if (password) {
    const fields = passwordFieldsIn(scope);
    const username = findUsernameFor(fields[0])?.value ?? '';
    if (shouldSend(`login:${username}:${password.value}`)) {
      void send('captureLogin', { username, password: password.value }).catch(() => undefined);
    }
    return;
  }
  const standalone = findStandaloneUsername(scope);
  if (standalone?.value && shouldSend(`user:${standalone.value}`)) {
    void send('captureUsername', { username: standalone.value }).catch(() => undefined);
  }
}

function scopeForElement(el: Element): HTMLFormElement | Document {
  return (el as HTMLButtonElement).form ?? el.closest('form') ?? document;
}

function looksLikeSubmit(el: Element): boolean {
  if (el instanceof HTMLButtonElement) return el.type === 'submit' || SUBMIT_TEXT.test(el.textContent ?? '');
  if (el instanceof HTMLInputElement) return el.type === 'submit' || SUBMIT_TEXT.test(el.value);
  return SUBMIT_TEXT.test(el.textContent ?? '') || SUBMIT_TEXT.test(el.getAttribute('aria-label') ?? '');
}

/**
 * Listens in the capture phase so values are read before page handlers clear the form
 * or navigate away. Covers native submits, JS-driven buttons and Enter-to-submit.
 */
export function installCapture(isOwnUi: (e: Event) => boolean): void {
  document.addEventListener(
    'submit',
    (e) => {
      if (e.target instanceof HTMLFormElement) captureFrom(e.target);
    },
    true,
  );

  document.addEventListener(
    'click',
    (e) => {
      if (isOwnUi(e)) return;
      const target = (e.composedPath()[0] as Element | undefined) ?? (e.target as Element);
      const button = target?.closest?.('button, input[type=submit], input[type=button], [role=button], a');
      if (!button || !looksLikeSubmit(button)) return;
      const scope = scopeForElement(button);
      if (passwordFieldsIn(scope).length > 0 || findStandaloneUsername(scope)) captureFrom(scope);
    },
    true,
  );

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Enter' || !isLoginField(e.target)) return;
      captureFrom(e.target.form ?? document);
    },
    true,
  );
}
