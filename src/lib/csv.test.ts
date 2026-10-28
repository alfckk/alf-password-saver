import { describe, expect, it } from 'vitest';
import { credentialsToCsv, parseCredentialCsv, parseCsvRecords } from './csv';
import type { Credential } from './types';

describe('csv', () => {
  it('parses quoted fields, escaped quotes and embedded newlines', () => {
    const text = 'a,b,c\r\n"x,1","say ""hi""","line1\nline2"\n';
    expect(parseCsvRecords(text)).toEqual([
      ['a', 'b', 'c'],
      ['x,1', 'say "hi"', 'line1\nline2'],
    ]);
  });

  it('reads the Chrome password export format', () => {
    const text =
      '\uFEFFname,url,username,password,note\nexample.com,https://example.com/,alice,p@ss,\n';
    expect(parseCredentialCsv(text)).toEqual([
      { name: 'example.com', url: 'https://example.com/', username: 'alice', password: 'p@ss', note: '' },
    ]);
  });

  it('accepts Bitwarden-style column names in any order', () => {
    const text = 'login_password,login_uri,login_username,name\nsecret,https://a.com,bob,A\n';
    expect(parseCredentialCsv(text)[0]).toMatchObject({
      url: 'https://a.com',
      username: 'bob',
      password: 'secret',
      name: 'A',
    });
  });

  it('throws when required columns are missing', () => {
    expect(() => parseCredentialCsv('foo,bar\n1,2\n')).toThrow();
  });

  it('round-trips export to import', () => {
    const cred: Credential = {
      id: '1',
      origin: 'https://example.com',
      hostname: 'example.com',
      username: 'a,b',
      password: 'p"q',
      name: 'Example',
      notes: 'multi\nline',
      createdAt: 0,
      updatedAt: 0,
      lastUsedAt: null,
    };
    const [row] = parseCredentialCsv(credentialsToCsv([cred]));
    expect(row).toEqual({
      name: 'Example',
      url: 'https://example.com',
      username: 'a,b',
      password: 'p"q',
      note: 'multi\nline',
    });
  });
});
