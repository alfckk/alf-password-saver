import { credentialsToCsv, parseCredentialCsv } from '../lib/csv';
import type { MessageMap, MessageType, Request, Response, TabMessage } from '../lib/messages';
import type { CredentialSummary, PendingSave, PendingSaveView, Settings } from '../lib/types';
import { canFillOn, parseSite } from '../lib/url';
import * as pending from './pending';
import { getSettings, updateSettings } from './settings';
import * as vault from './vault';

const AUTOLOCK_ALARM = 'autolock';

type Sender = chrome.runtime.MessageSender;
type Handler<K extends MessageType> = (
  payload: MessageMap[K][0],
  sender: Sender,
) => Promise<MessageMap[K][1]>;

function isExtensionPage(sender: Sender): boolean {
  return sender.id === chrome.runtime.id && !!sender.url?.startsWith(chrome.runtime.getURL(''));
}

function pageOf(sender: Sender): { url: string; tabId: number } {
  if (!sender.url || sender.tab?.id === undefined) throw new Error('無法辨識來源頁面');
  return { url: sender.url, tabId: sender.tab.id };
}

async function resetAutoLock(): Promise<void> {
  const { autoLockMinutes } = await getSettings();
  if (autoLockMinutes === 0) await chrome.alarms.clear(AUTOLOCK_ALARM);
  else await chrome.alarms.create(AUTOLOCK_ALARM, { delayInMinutes: autoLockMinutes });
}

async function notifyTab(tabId: number, message: TabMessage): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // Tab has no content script (chrome:// pages, closed tab, etc.).
  }
}

async function broadcast(message: TabMessage): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((t) => (t.id !== undefined ? notifyTab(t.id, message) : undefined)));
}

async function resolveKind(p: PendingSave): Promise<PendingSave | null> {
  if (!(await vault.isUnlocked())) return { ...p, kind: null, existingId: null };
  const existing = await vault.findByLogin(p.origin, p.username);
  if (!existing) return { ...p, kind: 'new', existingId: null };
  if (existing.password === p.password) {
    await vault.markUsed(existing.id);
    return null;
  }
  return { ...p, kind: 'update', existingId: existing.id };
}

async function refreshAllPending(): Promise<void> {
  for (const p of await pending.allPending()) {
    const resolved = await resolveKind(p);
    if (resolved) await pending.setPending(resolved);
    else await pending.clearPending(p.tabId);
    await notifyTab(p.tabId, { type: 'pendingSaveChanged' });
  }
}

async function setAutoFill(domain: string, enabled: boolean): Promise<Settings> {
  const { autoFillDomains } = await getSettings();
  if (autoFillDomains.includes(domain) === enabled) return getSettings();
  const next = await updateSettings({
    autoFillDomains: enabled ? [...autoFillDomains, domain] : autoFillDomains.filter((d) => d !== domain),
  });
  await broadcast({ type: 'autoFillChanged' });
  return next;
}

async function onLockChanged(): Promise<void> {
  await refreshAllPending();
  await broadcast({ type: 'vaultStatusChanged' });
}

const extensionOnly = new Set<MessageType>([
  'list',
  'create',
  'update',
  'remove',
  'importCsv',
  'exportCsv',
  'getSettings',
  'updateSettings',
  'setAutoFill',
  'fillInActiveTab',
]);

const handlers: { [K in MessageType]: Handler<K> } = {
  getStatus: () => vault.getStatus(),

  async setup({ masterPassword }) {
    await vault.setup(masterPassword);
    await resetAutoLock();
    return vault.getStatus();
  },

  async unlock({ masterPassword }) {
    await vault.unlock(masterPassword);
    await resetAutoLock();
    await onLockChanged();
    return vault.getStatus();
  },

  async lock() {
    await vault.lock();
    await chrome.alarms.clear(AUTOLOCK_ALARM);
    await onLockChanged();
    return vault.getStatus();
  },

  list: () => vault.list(),
  create: (input) => vault.create(input),
  update: ({ id, changes }) => vault.update(id, changes),
  remove: ({ id }) => vault.remove(id),

  async importCsv({ text }) {
    const rows = parseCredentialCsv(text);
    return vault.importMany(
      rows.map((r) => ({ origin: r.url, username: r.username, password: r.password, name: r.name, notes: r.note })),
    );
  },

  async exportCsv({ masterPassword }) {
    if (await vault.isUnlocked()) {
      await vault.verifyMaster(masterPassword);
    } else {
      await vault.unlock(masterPassword);
      await onLockChanged();
    }
    return { csv: credentialsToCsv(await vault.list()) };
  },

  getSettings: () => getSettings(),

  async updateSettings(changes) {
    const next = await updateSettings(changes);
    if (changes.autoLockMinutes !== undefined && (await vault.isUnlocked())) await resetAutoLock();
    if (changes.autoFillDomains !== undefined) await broadcast({ type: 'autoFillChanged' });
    return next;
  },

  async setAutoFill({ url, enabled }) {
    const site = parseSite(url);
    if (!site) throw new Error('網址無效');
    return setAutoFill(site.domain, enabled);
  },

  async fillInActiveTab({ id }) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const cred = await vault.get(id);
    if (!tab?.id || !tab.url || !cred) throw new Error('找不到可填入的分頁');
    if (!canFillOn(cred.origin, tab.url)) throw new Error('此帳號不屬於目前網站');
    await chrome.tabs.sendMessage(
      tab.id,
      { type: 'fillCredential', username: cred.username, password: cred.password } satisfies TabMessage,
      { frameId: 0 },
    );
    await vault.markUsed(id);
  },

  async openPopup() {
    try {
      await chrome.action.openPopup();
    } catch {
      await chrome.windows.create({
        url: chrome.runtime.getURL('src/popup/index.html'),
        type: 'popup',
        width: 380,
        height: 600,
      });
    }
  },

  async getMatches(_, sender) {
    const { url } = pageOf(sender);
    const status = await vault.getStatus();
    if (status.locked) return { status, matches: [] };
    const matches: CredentialSummary[] = (await vault.matchesFor(url)).map((c) => ({
      id: c.id,
      name: c.name,
      username: c.username,
      hostname: c.hostname,
    }));
    return { status, matches };
  },

  async fill({ id }, sender) {
    const { url } = pageOf(sender);
    const cred = await vault.get(id);
    if (!cred || !canFillOn(cred.origin, url)) throw new Error('此帳號不屬於目前網站');
    await vault.markUsed(id);
    return { username: cred.username, password: cred.password };
  },

  async getAutoFill(_, sender) {
    const { url } = pageOf(sender);
    const site = parseSite(url);
    const { autoFillDomains } = await getSettings();
    if (!site || !autoFillDomains.includes(site.domain) || !(await vault.isUnlocked())) return null;
    const [latest] = await vault.matchesFor(url);
    if (!latest) return null;
    return { username: latest.username, password: latest.password };
  },

  async captureUsername({ username }, sender) {
    const { url, tabId } = pageOf(sender);
    const site = parseSite(url);
    if (site && username.trim()) await pending.setPartialUsername(tabId, site.domain, username.trim());
  },

  async captureLogin({ username, password }, sender) {
    const { url, tabId } = pageOf(sender);
    const site = parseSite(url);
    if (!site || !password) return;
    const { neverSaveDomains } = await getSettings();
    if (neverSaveDomains.includes(site.domain)) return;

    const resolvedUsername = username.trim() || (await pending.takePartialUsername(tabId, site.domain)) || '';
    const resolved = await resolveKind({
      tabId,
      origin: site.origin,
      hostname: site.hostname,
      username: resolvedUsername,
      password,
      createdAt: Date.now(),
      kind: null,
      existingId: null,
    });
    if (!resolved) return;
    await pending.setPending(resolved);
    await notifyTab(tabId, { type: 'pendingSaveChanged' });
  },

  async getPendingSave(_, sender) {
    const { tabId } = pageOf(sender);
    const p = await pending.getPending(tabId);
    if (!p) return null;
    const { autoFillDomains } = await getSettings();
    const domain = parseSite(p.origin)?.domain;
    const view: PendingSaveView = {
      hostname: p.hostname,
      username: p.username,
      kind: p.kind,
      insecure: !p.origin.startsWith('https:'),
      autoFill: !!domain && autoFillDomains.includes(domain),
    };
    return view;
  },

  async resolvePendingSave({ action, username, autoFill }, sender) {
    const { tabId } = pageOf(sender);
    const p = await pending.getPending(tabId);
    if (!p) return;
    if (action === 'never') {
      const settings = await getSettings();
      const site = parseSite(p.origin);
      if (site) await updateSettings({ neverSaveDomains: [...settings.neverSaveDomains, site.domain] });
    } else if (action === 'save') {
      const finalUsername = username ?? p.username;
      const existing = await vault.findByLogin(p.origin, finalUsername);
      const saved = existing
        ? await vault.update(existing.id, { password: p.password })
        : await vault.create({ origin: p.origin, username: finalUsername, password: p.password });
      await vault.markUsed(saved.id);
      const site = parseSite(p.origin);
      if (site && autoFill !== undefined) await setAutoFill(site.domain, autoFill);
    }
    await pending.clearPending(tabId);
  },
};

chrome.runtime.onMessage.addListener((message: Request, sender, sendResponse) => {
  const handler = handlers[message?.type] as Handler<MessageType> | undefined;
  if (!handler || sender.id !== chrome.runtime.id) return false;
  if (extensionOnly.has(message.type) && !isExtensionPage(sender)) {
    sendResponse({ ok: false, error: '不允許的請求' } satisfies Response<MessageType>);
    return false;
  }

  (async () => {
    const data = await handler(message.payload as never, sender);
    if (message.type !== 'lock' && message.type !== 'getStatus' && (await vault.isUnlocked())) {
      await resetAutoLock();
    }
    return data;
  })()
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err: unknown) =>
      sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
    );
  return true;
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== AUTOLOCK_ALARM) return;
  await vault.lock();
  await onLockChanged();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void pending.clearPending(tabId);
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) void chrome.runtime.openOptionsPage();
});
