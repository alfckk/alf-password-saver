import type { PendingSave } from '../lib/types';

/**
 * Captured-but-unsaved logins live in chrome.storage.session so the save prompt survives
 * the page navigation that usually follows a login submit, and service worker restarts.
 * Session storage is in-memory only and hidden from content scripts by default.
 */
const PENDING_PREFIX = 'pending:';
const PARTIAL_PREFIX = 'partial:';
const PENDING_TTL_MS = 3 * 60 * 1000;
const PARTIAL_TTL_MS = 10 * 60 * 1000;

interface PartialLogin {
  domain: string;
  username: string;
  createdAt: number;
}

export async function getPending(tabId: number): Promise<PendingSave | null> {
  const k = PENDING_PREFIX + tabId;
  const { [k]: pending } = await chrome.storage.session.get(k);
  if (!pending) return null;
  if (Date.now() - (pending as PendingSave).createdAt > PENDING_TTL_MS) {
    await chrome.storage.session.remove(k);
    return null;
  }
  return pending as PendingSave;
}

export async function setPending(pending: PendingSave): Promise<void> {
  await chrome.storage.session.set({ [PENDING_PREFIX + pending.tabId]: pending });
}

export async function clearPending(tabId: number): Promise<void> {
  await chrome.storage.session.remove([PENDING_PREFIX + tabId, PARTIAL_PREFIX + tabId]);
}

export async function allPending(): Promise<PendingSave[]> {
  const all = await chrome.storage.session.get(null);
  return Object.entries(all)
    .filter(([k]) => k.startsWith(PENDING_PREFIX))
    .map(([, v]) => v as PendingSave);
}

/** Remembers the username from step one of a multi-step (identifier-first) login. */
export async function setPartialUsername(tabId: number, domain: string, username: string): Promise<void> {
  const partial: PartialLogin = { domain, username, createdAt: Date.now() };
  await chrome.storage.session.set({ [PARTIAL_PREFIX + tabId]: partial });
}

export async function takePartialUsername(tabId: number, domain: string): Promise<string | null> {
  const k = PARTIAL_PREFIX + tabId;
  const { [k]: partial } = await chrome.storage.session.get(k);
  if (!partial) return null;
  const p = partial as PartialLogin;
  if (p.domain !== domain || Date.now() - p.createdAt > PARTIAL_TTL_MS) return null;
  return p.username;
}
