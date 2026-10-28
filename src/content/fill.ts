import { findStandaloneUsername, groupFor, passwordFieldsIn, type LoginGroup } from './detector';

/** Uses the native setter so framework-controlled inputs (React, Vue) register the change. */
export function setNativeValue(input: HTMLInputElement, value: string, focus = true): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (focus) input.focus();
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function findGroup(anchor: HTMLInputElement | null): LoginGroup | null {
  const group = anchor ? groupFor(anchor) : null;
  if (group) return group;
  const [firstPassword] = passwordFieldsIn(document);
  if (firstPassword) return groupFor(firstPassword);
  const standalone = findStandaloneUsername(document);
  return standalone ? { scope: document, username: standalone, password: null } : null;
}

export function fillCredential(
  username: string,
  password: string,
  anchor: HTMLInputElement | null,
): boolean {
  const group = findGroup(anchor);
  if (!group) return false;

  if (group.username && username) setNativeValue(group.username, username);
  if (group.password) setNativeValue(group.password, password);
  (group.password ?? group.username)?.focus();
  return true;
}

/** Fills the page's login form without moving focus, and never overwrites what the user typed. */
export function prefillCredential(username: string, password: string): boolean {
  const group = findGroup(null);
  if (!group || group.username?.value || group.password?.value) return false;
  if (group.username && username) setNativeValue(group.username, username, false);
  if (group.password) setNativeValue(group.password, password, false);
  return true;
}
