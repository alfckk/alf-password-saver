import { getDomain } from 'tldts';

export interface SiteInfo {
  origin: string;
  hostname: string;
  /** Registrable domain (eTLD+1), or the bare hostname for IPs / localhost. */
  domain: string;
  secure: boolean;
}

export function parseSite(rawUrl: string): SiteInfo | null {
  let url: URL;
  try {
    url = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const hostname = url.hostname.toLowerCase();
  return {
    origin: url.origin,
    hostname,
    domain: getDomain(hostname) ?? hostname,
    secure: url.protocol === 'https:',
  };
}

export function domainOf(rawUrl: string): string | null {
  return parseSite(rawUrl)?.domain ?? null;
}

export function sameSite(a: string, b: string): boolean {
  const da = domainOf(a);
  return da !== null && da === domainOf(b);
}

/** Credentials saved on https must never be offered to an http page of the same site. */
export function canFillOn(credentialOrigin: string, pageUrl: string): boolean {
  const cred = parseSite(credentialOrigin);
  const page = parseSite(pageUrl);
  if (!cred || !page) return false;
  if (cred.domain !== page.domain) return false;
  return page.secure || !cred.secure;
}

export function faviconUrl(pageUrl: string, size = 32): string {
  if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) return '';
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', String(size));
  return url.toString();
}
