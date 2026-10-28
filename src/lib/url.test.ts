import { describe, expect, it } from 'vitest';
import { canFillOn, parseSite, sameSite } from './url';

describe('url', () => {
  it('extracts the registrable domain', () => {
    expect(parseSite('https://login.example.co.uk/path')?.domain).toBe('example.co.uk');
    expect(parseSite('example.com')?.origin).toBe('https://example.com');
  });

  it('falls back to hostname for localhost and IPs', () => {
    expect(parseSite('http://localhost:5500/a')?.domain).toBe('localhost');
    expect(parseSite('http://192.168.1.10/')?.domain).toBe('192.168.1.10');
  });

  it('rejects non-web schemes', () => {
    expect(parseSite('chrome://settings')).toBeNull();
    expect(parseSite('javascript:alert(1)')).toBeNull();
  });

  it('matches subdomains of the same site', () => {
    expect(sameSite('https://login.example.com', 'https://www.example.com/x')).toBe(true);
    expect(sameSite('https://example.com', 'https://example.org')).toBe(false);
    expect(sameSite('https://evil-example.com', 'https://example.com')).toBe(false);
  });

  it('never offers https credentials on http pages', () => {
    expect(canFillOn('https://example.com', 'http://example.com/login')).toBe(false);
    expect(canFillOn('http://example.com', 'https://example.com/login')).toBe(true);
    expect(canFillOn('https://a.example.com', 'https://b.example.com')).toBe(true);
  });
});
