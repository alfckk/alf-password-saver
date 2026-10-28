import type { EncryptedBlob } from './types';

export const PBKDF2_ITERATIONS = 600_000;
const VERIFIER_PLAINTEXT = 'password-saver:verifier:v1';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function generateSalt(): string {
  return toBase64(randomBytes(16));
}

export async function deriveKey(
  masterPassword: string,
  saltB64: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromBase64(saltB64), iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    // Extractable so the raw key can be parked in chrome.storage.session across service worker restarts.
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function exportKey(key: CryptoKey): Promise<string> {
  return toBase64(new Uint8Array(await crypto.subtle.exportKey('raw', key)));
}

export async function importKey(rawB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromBase64(rawB64), { name: 'AES-GCM' }, true, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encrypt(key: CryptoKey, plaintext: string): Promise<EncryptedBlob> {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}

export async function decrypt(key: CryptoKey, blob: EncryptedBlob): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(blob.iv) },
    key,
    fromBase64(blob.ciphertext),
  );
  return decoder.decode(plaintext);
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<EncryptedBlob> {
  return encrypt(key, JSON.stringify(value));
}

export async function decryptJson<T>(key: CryptoKey, blob: EncryptedBlob): Promise<T> {
  return JSON.parse(await decrypt(key, blob)) as T;
}

export function createVerifier(key: CryptoKey): Promise<EncryptedBlob> {
  return encrypt(key, VERIFIER_PLAINTEXT);
}

export async function checkVerifier(key: CryptoKey, verifier: EncryptedBlob): Promise<boolean> {
  try {
    return (await decrypt(key, verifier)) === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}
