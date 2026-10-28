import { findStandaloneUsername, groupFor, passwordFieldsIn } from './detector';

/** Uses the native setter so framework-controlled inputs (React, Vue) register the change. */
export function setNativeValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  input.focus();
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

export function fillCredential(
  username: string,
  password: string,
  anchor: HTMLInputElement | null,
): boolean {
  let group = anchor ? groupFor(anchor) : null;
  if (!group) {
    const [firstPassword] = passwordFieldsIn(document);
    group = firstPassword ? groupFor(firstPassword) : null;
  }
  if (!group) {
    const standalone = findStandaloneUsername(document);
    group = standalone ? { scope: document, username: standalone, password: null } : null;
  }
  if (!group) return false;

  if (group.username && username) setNativeValue(group.username, username);
  if (group.password) setNativeValue(group.password, password);
  (group.password ?? group.username)?.focus();
  return true;
}
