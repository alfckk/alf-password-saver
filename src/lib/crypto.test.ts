import { describe, expect, it } from 'vitest';
import {
  checkVerifier,
  createVerifier,
  decryptJson,
  deriveKey,
  encryptJson,
  exportKey,
  generateSalt,
  importKey,
} from './crypto';

const FAST = 1_000;

describe('crypto', () => {
  it('round-trips JSON with a derived key', async () => {
    const key = await deriveKey('correct horse', generateSalt(), FAST);
    const blob = await encryptJson(key, { a: 1, b: ['x'] });
    expect(await decryptJson(key, blob)).toEqual({ a: 1, b: ['x'] });
  });

  it('uses a fresh IV for every encryption', async () => {
    const key = await deriveKey('pw', generateSalt(), FAST);
    const a = await encryptJson(key, 'same');
    const b = await encryptJson(key, 'same');
    expect(a.iv).not.toEqual(b.iv);
    expect(a.ciphertext).not.toEqual(b.ciphertext);
  });

  it('rejects the wrong master password via the verifier', async () => {
    const salt = generateSalt();
    const good = await deriveKey('right', salt, FAST);
    const bad = await deriveKey('wrong', salt, FAST);
    const verifier = await createVerifier(good);
    expect(await checkVerifier(good, verifier)).toBe(true);
    expect(await checkVerifier(bad, verifier)).toBe(false);
  });

  it('survives raw export and import', async () => {
    const key = await deriveKey('pw', generateSalt(), FAST);
    const blob = await encryptJson(key, 'secret');
    const restored = await importKey(await exportKey(key));
    expect(await decryptJson(restored, blob)).toBe('secret');
  });
});
