/**
 * E2E crypto using only Web Crypto API (no @noble deps).
 * Works on web; on React Native requires crypto.subtle polyfill.
 */
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const AES_KEY_LENGTH = 32;
const E2E_KEY_SALT = new TextEncoder().encode('vybr-e2e-v1');
const E2E_KEY_INFO = new Uint8Array(0);

function getCrypto(): Crypto {
  const c = globalThis.crypto ?? (global as any).crypto;
  if (!c?.getRandomValues) throw new Error('E2E: crypto.getRandomValues not available');
  return c;
}

function getSubtle(): SubtleCrypto {
  const subtle = getCrypto().subtle ?? (getCrypto() as any).webkitSubtle;
  if (!subtle) throw new Error('E2E: crypto.subtle not available');
  return subtle;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  getCrypto().getRandomValues(bytes);
  return bytes;
}

export type SymmetricKey = Uint8Array;

export function generateSymmetricKey(): SymmetricKey {
  return randomBytes(AES_KEY_LENGTH);
}

export async function encryptWithKeyAsync(plaintext: string, key: SymmetricKey): Promise<string> {
  const iv = randomBytes(IV_LENGTH);
  const plainBytes = new TextEncoder().encode(plaintext);
  const subtle = getSubtle();
  const keyCopy = new Uint8Array(key);
  const cryptoKey = await subtle.importKey('raw', keyCopy, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv), tagLength: 128 },
    cryptoKey,
    plainBytes
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return bytesToBase64(combined);
}

export async function decryptWithKeyAsync(payloadBase64: string, key: SymmetricKey): Promise<string> {
  const combined = base64ToBytes(payloadBase64);
  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('E2E: invalid ciphertext length');
  }
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const subtle = getSubtle();
  const keyCopy = new Uint8Array(key);
  const cryptoKey = await subtle.importKey('raw', keyCopy, { name: 'AES-GCM' }, false, ['decrypt']);
  const plainBytes = await subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv), tagLength: 128 },
    cryptoKey,
    ciphertext
  );
  return new TextDecoder().decode(plainBytes);
}

/** Generate ECDH P-256 key pair; returns base64(pkcs8) and base64(spki) for storage/upload. */
export async function generateKeyPairAsync(): Promise<{ privateKeyBase64: string; publicKeyBase64: string }> {
  const subtle = getSubtle();
  const pair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits', 'deriveKey']
  );
  const privateBytes = await subtle.exportKey('pkcs8', pair.privateKey);
  const publicBytes = await subtle.exportKey('spki', pair.publicKey);
  return {
    privateKeyBase64: bytesToBase64(new Uint8Array(privateBytes)),
    publicKeyBase64: bytesToBase64(new Uint8Array(publicBytes)),
  };
}

/** Derive 32-byte AES key from ECDH shared secret + HKDF. Uses stored base64 keys (pkcs8 + spki). */
export async function deriveSharedAesKeyAsync(
  ourPrivateKeyBase64: string,
  theirPublicKeyBase64: string
): Promise<SymmetricKey> {
  const subtle = getSubtle();
  const ourPrivateBytes = new Uint8Array(base64ToBytes(ourPrivateKeyBase64));
  const theirPublicBytes = new Uint8Array(base64ToBytes(theirPublicKeyBase64));

  const ourPrivate = await subtle.importKey(
    'pkcs8',
    ourPrivateBytes as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits', 'deriveKey']
  );
  const theirPublic = await subtle.importKey(
    'spki',
    theirPublicBytes as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedSecret = await subtle.deriveBits(
    { name: 'ECDH', public: theirPublic },
    ourPrivate,
    256
  );

  const ikmKey = await subtle.importKey(
    'raw',
    sharedSecret,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );
  const aesKey = await subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: E2E_KEY_SALT,
      info: E2E_KEY_INFO,
    },
    ikmKey,
    { name: 'AES-GCM', length: 256 },
    true, // extractable so we can export to Uint8Array for encrypt/decrypt
    ['encrypt', 'decrypt']
  );
  const raw = await subtle.exportKey('raw', aesKey);
  return new Uint8Array(raw);
}

/** Legacy sync API: not supported with Web Crypto. Use generateKeyPairAsync. */
export function generateKeyPair(): { privateKey: Uint8Array; publicKey: Uint8Array } {
  throw new Error('E2E: use generateKeyPairAsync()');
}

/** Legacy sync API: not supported. Use deriveSharedAesKeyAsync. */
export function deriveSharedAesKey(_our: Uint8Array, _their: Uint8Array): SymmetricKey {
  throw new Error('E2E: use deriveSharedAesKeyAsync()');
}

export function publicKeyToBase64(publicKey: Uint8Array): string {
  return bytesToBase64(publicKey);
}
export function base64ToPublicKey(base64: string): Uint8Array {
  return base64ToBytes(base64);
}
export function privateKeyToBase64(privateKey: Uint8Array): string {
  return bytesToBase64(privateKey);
}
export function base64ToPrivateKey(base64: string): Uint8Array {
  return base64ToBytes(base64);
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return typeof btoa !== 'undefined' ? btoa(binary) : (global as any).Buffer?.from(bytes).toString('base64') ?? '';
}

export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(base64, 'base64'));
  const binary = typeof atob !== 'undefined' ? atob(base64) : (global as any).Buffer?.from(base64, 'base64').toString('binary') ?? '';
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
