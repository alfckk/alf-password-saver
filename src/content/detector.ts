const TEXT_TYPES = new Set(['text', 'email', 'tel', '']);
const USERNAME_HINT = /user|login|email|e-mail|mail|account|identifier|phone|mobile|帳號|账号|帳戶|使用者|用戶|用户|信箱|郵件|手機/i;
const EXCLUDE_HINT = /search|captcha|otp|code|coupon|promo|zip|postal|address|驗證碼|搜尋/i;

export interface LoginGroup {
  scope: HTMLFormElement | Document;
  username: HTMLInputElement | null;
  password: HTMLInputElement | null;
}

export function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const style = getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.05;
}

function isUsable(input: HTMLInputElement): boolean {
  return !input.disabled && !input.readOnly && isVisible(input);
}

function hintText(input: HTMLInputElement): string {
  return [
    input.name,
    input.id,
    input.placeholder,
    input.getAttribute('aria-label'),
    input.autocomplete,
    input.labels?.[0]?.textContent,
  ]
    .filter(Boolean)
    .join(' ');
}

export function isPasswordField(el: unknown): el is HTMLInputElement {
  return el instanceof HTMLInputElement && el.type === 'password' && isUsable(el);
}

export function isUsernameCandidate(el: unknown): el is HTMLInputElement {
  if (!(el instanceof HTMLInputElement) || !TEXT_TYPES.has(el.type) || !isUsable(el)) return false;
  const ac = el.autocomplete.toLowerCase();
  if (ac.includes('username') || ac.includes('email')) return true;
  if (ac.includes('one-time-code')) return false;
  const hint = hintText(el);
  if (EXCLUDE_HINT.test(hint)) return false;
  return el.type === 'email' || USERNAME_HINT.test(hint);
}

function scopeOf(el: HTMLInputElement): HTMLFormElement | Document {
  return el.form ?? el.ownerDocument;
}

function inputsIn(scope: HTMLFormElement | Document): HTMLInputElement[] {
  return Array.from(scope.querySelectorAll('input'));
}

function precedes(a: Node, b: Node): boolean {
  return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

export function passwordFieldsIn(scope: HTMLFormElement | Document): HTMLInputElement[] {
  return inputsIn(scope).filter(isPasswordField);
}

export function findUsernameFor(password: HTMLInputElement): HTMLInputElement | null {
  const before = inputsIn(scopeOf(password)).filter(
    (i) => precedes(i, password) && TEXT_TYPES.has(i.type) && isUsable(i),
  );
  return (
    before.find((i) => /username|email/i.test(i.autocomplete)) ??
    [...before].reverse().find(isUsernameCandidate) ??
    // Fall back to the closest plain text input right before the password field.
    before[before.length - 1] ??
    null
  );
}

/** Identifier-first login step: a username field with no password field next to it. */
export function findStandaloneUsername(scope: HTMLFormElement | Document): HTMLInputElement | null {
  if (passwordFieldsIn(scope).length > 0) return null;
  return inputsIn(scope).find(isUsernameCandidate) ?? null;
}

export function groupFor(field: HTMLInputElement): LoginGroup | null {
  const scope = scopeOf(field);
  const passwords = passwordFieldsIn(scope);
  if (passwords.length > 0) {
    const password = field.type === 'password' ? field : passwords[0];
    return { scope, password, username: findUsernameFor(passwords[0]) };
  }
  if (isUsernameCandidate(field)) return { scope, username: field, password: null };
  return null;
}

export function isLoginField(el: unknown): el is HTMLInputElement {
  if (isPasswordField(el)) return true;
  if (!(el instanceof HTMLInputElement) || !TEXT_TYPES.has(el.type) || !isUsable(el)) return false;
  const passwords = passwordFieldsIn(scopeOf(el));
  if (passwords.length > 0) return findUsernameFor(passwords[0]) === el;
  return isUsernameCandidate(el);
}

export function hasLoginFields(doc: Document = document): boolean {
  return passwordFieldsIn(doc).length > 0 || inputsIn(doc).some(isUsernameCandidate);
}

/**
 * Picks the password the user actually means to keep:
 * login form -> the only field; signup (pw + confirm) -> the first; change form (current, new, confirm) -> the new one.
 */
export function pickSubmittedPassword(fields: HTMLInputElement[]): HTMLInputElement | null {
  const filled = fields.filter((f) => f.value);
  if (filled.length === 0) return null;
  const explicitNew = filled.find((f) => f.autocomplete === 'new-password');
  if (explicitNew) return explicitNew;
  if (filled.length === 1) return filled[0];
  if (filled.length === 2) return filled[0].value === filled[1].value ? filled[0] : filled[1];
  return filled[1];
}
