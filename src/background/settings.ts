import { DEFAULT_SETTINGS, type Settings } from '../lib/types';

const SETTINGS_KEY = 'settings';

export async function getSettings(): Promise<Settings> {
  const { [SETTINGS_KEY]: stored } = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored as Partial<Settings> | undefined) };
}

export async function updateSettings(changes: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...changes };
  next.autoLockMinutes = Math.max(1, Math.min(24 * 60, Math.round(next.autoLockMinutes)));
  next.neverSaveDomains = [...new Set(next.neverSaveDomains.map((d) => d.toLowerCase()))].sort();
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}
