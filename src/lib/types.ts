export interface Credential {
  id: string;
  origin: string;
  hostname: string;
  username: string;
  password: string;
  name: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
}

export type CredentialInput = Pick<Credential, 'origin' | 'username' | 'password'> &
  Partial<Pick<Credential, 'name' | 'notes'>>;

/** What content scripts are allowed to see before the user picks an entry. */
export interface CredentialSummary {
  id: string;
  name: string;
  username: string;
  hostname: string;
}

export interface EncryptedBlob {
  iv: string;
  ciphertext: string;
}

export interface VaultRecord {
  version: 1;
  salt: string;
  iterations: number;
  verifier: EncryptedBlob;
  vault: EncryptedBlob;
}

export interface Settings {
  /** 0 = never lock automatically (the vault still locks when the browser closes). */
  autoLockMinutes: number;
  neverSaveDomains: string[];
  /** Sites where the most recently used login is filled in as soon as the form appears. */
  autoFillDomains: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  autoLockMinutes: 15,
  neverSaveDomains: [],
  autoFillDomains: [],
};

export interface PendingSave {
  tabId: number;
  origin: string;
  hostname: string;
  username: string;
  password: string;
  createdAt: number;
  /** Resolved once the vault is unlocked; null while locked. */
  kind: 'new' | 'update' | null;
  existingId: string | null;
}

/** Pending save as exposed to the content script (no password). */
export interface PendingSaveView {
  hostname: string;
  username: string;
  kind: 'new' | 'update' | null;
  insecure: boolean;
  autoFill: boolean;
}

export interface VaultStatus {
  initialized: boolean;
  locked: boolean;
}
