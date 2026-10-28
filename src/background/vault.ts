import {
  PBKDF2_ITERATIONS,
  checkVerifier,
  createVerifier,
  decryptJson,
  deriveKey,
  encryptJson,
  exportKey,
  generateSalt,
  importKey,
} from '../lib/crypto';
import type { Credential, CredentialInput, VaultRecord, VaultStatus } from '../lib/types';
import { canFillOn, domainOf, parseSite } from '../lib/url';

const VAULT_KEY = 'vault';
const SESSION_KEY = 'vaultKey';

let key: CryptoKey | null = null;
let items: Credential[] | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

async function readRecord(): Promise<VaultRecord | undefined> {
  const { [VAULT_KEY]: record } = await chrome.storage.local.get(VAULT_KEY);
  return record as VaultRecord | undefined;
}

/** Rehydrates the in-memory vault after the service worker was suspended. */
async function restore(): Promise<boolean> {
  if (key && items) return true;
  const { [SESSION_KEY]: raw } = await chrome.storage.session.get(SESSION_KEY);
  const record = await readRecord();
  if (!raw || !record) return false;
  try {
    key = await importKey(raw as string);
    items = await decryptJson<Credential[]>(key, record.vault);
    return true;
  } catch {
    await lock();
    return false;
  }
}

async function open(newKey: CryptoKey, vault: Credential[]): Promise<void> {
  key = newKey;
  items = vault;
  await chrome.storage.session.set({ [SESSION_KEY]: await exportKey(newKey) });
}

export async function getStatus(): Promise<VaultStatus> {
  const initialized = (await readRecord()) !== undefined;
  return { initialized, locked: !(initialized && (await restore())) };
}

export async function setup(masterPassword: string): Promise<void> {
  if (await readRecord()) throw new Error('保險庫已存在');
  if (masterPassword.length < 8) throw new Error('主密碼至少需要 8 個字元');
  const salt = generateSalt();
  const newKey = await deriveKey(masterPassword, salt, PBKDF2_ITERATIONS);
  const record: VaultRecord = {
    version: 1,
    salt,
    iterations: PBKDF2_ITERATIONS,
    verifier: await createVerifier(newKey),
    vault: await encryptJson(newKey, []),
  };
  await chrome.storage.local.set({ [VAULT_KEY]: record });
  await open(newKey, []);
}

async function deriveFromRecord(masterPassword: string): Promise<{ key: CryptoKey; record: VaultRecord }> {
  const record = await readRecord();
  if (!record) throw new Error('尚未建立保險庫');
  const derived = await deriveKey(masterPassword, record.salt, record.iterations);
  if (!(await checkVerifier(derived, record.verifier))) throw new Error('主密碼錯誤');
  return { key: derived, record };
}

export async function unlock(masterPassword: string): Promise<void> {
  const { key: derived, record } = await deriveFromRecord(masterPassword);
  await open(derived, await decryptJson<Credential[]>(derived, record.vault));
}

export async function verifyMaster(masterPassword: string): Promise<void> {
  await deriveFromRecord(masterPassword);
}

export async function lock(): Promise<void> {
  key = null;
  items = null;
  await chrome.storage.session.remove(SESSION_KEY);
}

export async function isUnlocked(): Promise<boolean> {
  return restore();
}

async function requireItems(): Promise<Credential[]> {
  if (!(await restore()) || !items) throw new Error('保險庫已鎖定');
  return items;
}

/** Serializes read-modify-write cycles so concurrent messages can't drop each other's changes. */
function mutate<T>(fn: (current: Credential[]) => { next: Credential[]; result: T }): Promise<T> {
  const run = writeQueue.then(async () => {
    const current = await requireItems();
    const { next, result } = fn(current);
    const record = await readRecord();
    if (!record || !key) throw new Error('保險庫已鎖定');
    record.vault = await encryptJson(key, next);
    await chrome.storage.local.set({ [VAULT_KEY]: record });
    items = next;
    return result;
  });
  writeQueue = run.catch(() => undefined);
  return run;
}

function buildCredential(input: CredentialInput): Credential {
  const site = parseSite(input.origin);
  if (!site) throw new Error('網址無效');
  if (!input.password) throw new Error('密碼不可為空');
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    origin: site.origin,
    hostname: site.hostname,
    username: input.username.trim(),
    password: input.password,
    name: input.name?.trim() || site.hostname,
    notes: input.notes ?? '',
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
  };
}

function applyChanges(cred: Credential, changes: Partial<CredentialInput>): Credential {
  const next = { ...cred, updatedAt: Date.now() };
  if (changes.origin !== undefined) {
    const site = parseSite(changes.origin);
    if (!site) throw new Error('網址無效');
    next.origin = site.origin;
    next.hostname = site.hostname;
  }
  if (changes.username !== undefined) next.username = changes.username.trim();
  if (changes.password !== undefined) {
    if (!changes.password) throw new Error('密碼不可為空');
    next.password = changes.password;
  }
  if (changes.name !== undefined) next.name = changes.name.trim() || next.hostname;
  if (changes.notes !== undefined) next.notes = changes.notes;
  return next;
}

export async function list(): Promise<Credential[]> {
  return [...(await requireItems())].sort((a, b) => a.name.localeCompare(b.name));
}

export async function get(id: string): Promise<Credential | undefined> {
  return (await requireItems()).find((c) => c.id === id);
}

export async function matchesFor(pageUrl: string): Promise<Credential[]> {
  return (await requireItems())
    .filter((c) => canFillOn(c.origin, pageUrl))
    .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));
}

export async function findByLogin(pageUrl: string, username: string): Promise<Credential | undefined> {
  const domain = domainOf(pageUrl);
  return (await requireItems()).find(
    (c) => domainOf(c.origin) === domain && c.username === username.trim(),
  );
}

export function create(input: CredentialInput): Promise<Credential> {
  const cred = buildCredential(input);
  return mutate((cur) => ({ next: [...cur, cred], result: cred }));
}

export function update(id: string, changes: Partial<CredentialInput>): Promise<Credential> {
  return mutate((cur) => {
    const idx = cur.findIndex((c) => c.id === id);
    if (idx < 0) throw new Error('找不到此項目');
    const updated = applyChanges(cur[idx], changes);
    const next = [...cur];
    next[idx] = updated;
    return { next, result: updated };
  });
}

export function remove(id: string): Promise<void> {
  return mutate((cur) => ({ next: cur.filter((c) => c.id !== id), result: undefined }));
}

export function markUsed(id: string): Promise<void> {
  return mutate((cur) => ({
    next: cur.map((c) => (c.id === id ? { ...c, lastUsedAt: Date.now() } : c)),
    result: undefined,
  }));
}

export function importMany(
  inputs: CredentialInput[],
): Promise<{ added: number; updated: number; skipped: number }> {
  return mutate((cur) => {
    const next = [...cur];
    let added = 0;
    let updated = 0;
    let skipped = 0;
    for (const input of inputs) {
      let cred: Credential;
      try {
        cred = buildCredential(input);
      } catch {
        skipped++;
        continue;
      }
      const domain = domainOf(cred.origin);
      const idx = next.findIndex((c) => domainOf(c.origin) === domain && c.username === cred.username);
      if (idx < 0) {
        next.push(cred);
        added++;
      } else if (next[idx].password !== cred.password) {
        next[idx] = { ...next[idx], password: cred.password, updatedAt: Date.now() };
        updated++;
      } else {
        skipped++;
      }
    }
    return { next, result: { added, updated, skipped } };
  });
}
