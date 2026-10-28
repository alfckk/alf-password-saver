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
  autoLockMinutes: number;
  neverSaveDomains: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  autoLockMinutes: 15,
  neverSaveDomains: [],
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
}

export interface VaultStatus {
  initialized: boolean;
  locked: boolean;
}
