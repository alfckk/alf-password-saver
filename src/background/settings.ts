import { DEFAULT_SETTINGS, type Settings } from '../lib/types';

const SETTINGS_KEY = 'settings';

export async function getSettings(): Promise<Settings> {
  const { [SETTINGS_KEY]: stored } = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored as Partial<Settings> | undefined) };
}

function normalizeDomains(domains: string[]): string[] {
  return [...new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean))].sort();
}

export async function updateSettings(changes: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...changes };
  const minutes = Math.round(next.autoLockMinutes);
  next.autoLockMinutes = minutes <= 0 ? 0 : Math.min(24 * 60, minutes);
  next.neverSaveDomains = normalizeDomains(next.neverSaveDomains);
  next.autoFillDomains = normalizeDomains(next.autoFillDomains);
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}
