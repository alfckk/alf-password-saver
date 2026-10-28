import type {
  Credential,
  CredentialInput,
  CredentialSummary,
  PendingSaveView,
  Settings,
  VaultStatus,
} from './types';

/** Request name -> [payload, response]. */
export interface MessageMap {
  getStatus: [void, VaultStatus];
  setup: [{ masterPassword: string }, VaultStatus];
  unlock: [{ masterPassword: string }, VaultStatus];
  lock: [void, VaultStatus];

  // Extension pages only.
  list: [void, Credential[]];
  create: [CredentialInput, Credential];
  update: [{ id: string; changes: Partial<CredentialInput> }, Credential];
  remove: [{ id: string }, void];
  importCsv: [{ text: string }, { added: number; updated: number; skipped: number }];
  exportCsv: [{ masterPassword: string }, { csv: string }];
  getSettings: [void, Settings];
  updateSettings: [Partial<Settings>, Settings];
  setAutoFill: [{ url: string; enabled: boolean }, Settings];
  fillInActiveTab: [{ id: string }, void];
  openPopup: [void, void];

  // Content scripts. Page origin is always taken from the sender, never from the payload.
  getMatches: [void, { status: VaultStatus; matches: CredentialSummary[] }];
  fill: [{ id: string }, { username: string; password: string }];
  getAutoFill: [void, { username: string; password: string } | null];
  captureUsername: [{ username: string }, void];
  captureLogin: [{ username: string; password: string }, void];
  getPendingSave: [void, PendingSaveView | null];
  resolvePendingSave: [{ action: 'save' | 'never' | 'dismiss'; username?: string; autoFill?: boolean }, void];
}

export type MessageType = keyof MessageMap;

export type Request<K extends MessageType = MessageType> = K extends MessageType
  ? { type: K; payload: MessageMap[K][0] }
  : never;

export type Response<K extends MessageType> =
  | { ok: true; data: MessageMap[K][1] }
  | { ok: false; error: string };

export async function send<K extends MessageType>(
  type: K,
  ...payload: MessageMap[K][0] extends void ? [] : [MessageMap[K][0]]
): Promise<MessageMap[K][1]> {
  const res = (await chrome.runtime.sendMessage({ type, payload: payload[0] })) as Response<K> | undefined;
  if (!res) throw new Error('擴充功能沒有回應');
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

/** Messages pushed from the service worker to content scripts. */
export type TabMessage =
  | { type: 'pendingSaveChanged' }
  | { type: 'vaultStatusChanged' }
  | { type: 'autoFillChanged' }
  | { type: 'fillCredential'; username: string; password: string };
