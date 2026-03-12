/**
 * E2E crypto: Web Crypto API on web, @noble libraries on React Native (Hermes lacks crypto.subtle).
 * Both paths produce identical cryptographic outputs (ECDH P-256, HKDF-SHA256, AES-256-GCM)
 * so messages encrypted on one platform decrypt correctly on any other.
 */
import { Platform } from 'react-native';
import { p256 } from '@noble/curves/nist.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { gcm } from '@noble/ciphers/aes.js';

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const AES_KEY_LENGTH = 32;
const E2E_KEY_SALT = new TextEncoder().encode('vybr-e2e-v1');
const E2E_KEY_INFO = new Uint8Array(0);

const isWeb = Platform.OS === 'web';

// ─── P-256 DER format constants for SPKI ↔ raw and PKCS8 ↔ raw conversion ──

const SPKI_HDR = new Uint8Array([
  0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
  0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
]); // 26 bytes: SEQUENCE { SEQUENCE { OID ecPublicKey, OID secp256r1 }, BIT STRING header }

const PKCS8_PRE = new Uint8Array([
  0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
  0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01,
  0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20,
]); // 36 bytes: everything before the 32-byte private key scalar

const PKCS8_MID = new Uint8Array([0xa1, 0x44, 0x03, 0x42, 0x00]); // 5 bytes: between private key and public key

function spkiToRaw(spki: Uint8Array): Uint8Array {
  return spki.slice(SPKI_HDR.length);
}

function rawToSpki(rawPub65: Uint8Array): Uint8Array {
  const r = new Uint8Array(SPKI_HDR.length + rawPub65.length);
  r.set(SPKI_HDR);
  r.set(rawPub65, SPKI_HDR.length);
  return r;
}

function pkcs8ToRawPriv(pkcs8: Uint8Array): Uint8Array {
  // Fast path: standard 138-byte Web Crypto P-256 PKCS8 (with embedded public key)
  if (pkcs8.length === 138) return pkcs8.slice(36, 68);
  // Fallback: scan for the EC private key pattern (INTEGER 1, OCTET STRING 32)
  for (let i = 0; i <= pkcs8.length - 37; i++) {
    if (pkcs8[i] === 0x02 && pkcs8[i + 1] === 0x01 && pkcs8[i + 2] === 0x01 &&
        pkcs8[i + 3] === 0x04 && pkcs8[i + 4] === 0x20) {
      return pkcs8.slice(i + 5, i + 37);
    }
  }
  throw new Error('E2E: cannot extract private key from PKCS8');
}

function rawToPkcs8(rawPriv32: Uint8Array, rawPub65: Uint8Array): Uint8Array {
  const r = new Uint8Array(138);
  r.set(PKCS8_PRE);
  r.set(rawPriv32, 36);
  r.set(PKCS8_MID, 68);
  r.set(rawPub65, 73);
  return r;
}

// ─── Shared utilities ────────────────────────────────────────────────────────

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

// ─── AES-256-GCM encrypt / decrypt ──────────────────────────────────────────

export async function encryptWithKeyAsync(plaintext: string, key: SymmetricKey): Promise<string> {
  const iv = randomBytes(IV_LENGTH);
  const plainBytes = new TextEncoder().encode(plaintext);
  let ct: Uint8Array;
  if (isWeb) {
    const subtle = getSubtle();
    const ck = await subtle.importKey('raw', new Uint8Array(key), { name: 'AES-GCM' }, false, ['encrypt']);
    ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: new Uint8Array(iv), tagLength: 128 }, ck, plainBytes));
  } else {
    ct = gcm(new Uint8Array(key), iv).encrypt(plainBytes);
  }
  const combined = new Uint8Array(IV_LENGTH + ct.length);
  combined.set(iv, 0);
  combined.set(ct, IV_LENGTH);
  return bytesToBase64(combined);
}

export async function decryptWithKeyAsync(payloadBase64: string, key: SymmetricKey): Promise<string> {
  const plainBytes = await decryptBytesWithKeyAsync(payloadBase64, key);
  return new TextDecoder().decode(plainBytes);
}

export async function encryptBytesWithKeyAsync(plainBytes: Uint8Array, key: SymmetricKey): Promise<string> {
  const iv = randomBytes(IV_LENGTH);
  let ct: Uint8Array;
  if (isWeb) {
    const subtle = getSubtle();
    const ck = await subtle.importKey('raw', new Uint8Array(key), { name: 'AES-GCM' }, false, ['encrypt']);
    ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: new Uint8Array(iv), tagLength: 128 }, ck, plainBytes as BufferSource));
  } else {
    ct = gcm(new Uint8Array(key), iv).encrypt(plainBytes);
  }
  const combined = new Uint8Array(IV_LENGTH + ct.length);
  combined.set(iv, 0);
  combined.set(ct, IV_LENGTH);
  return bytesToBase64(combined);
}

export async function decryptBytesWithKeyAsync(payloadBase64: string, key: SymmetricKey): Promise<Uint8Array> {
  if (typeof payloadBase64 !== 'string' || !payloadBase64.length) {
    throw new Error('E2E: decrypt payload must be a non-empty string');
  }
  const combined = base64ToBytes(payloadBase64);
  const minLength = IV_LENGTH + AUTH_TAG_LENGTH;
  if (combined.length < minLength) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[E2E crypto] Invalid ciphertext length: base64Len=', payloadBase64.length, 'decodedLen=', combined.length, 'min=', minLength);
    }
    throw new Error('E2E: invalid ciphertext length');
  }
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  if (isWeb) {
    const subtle = getSubtle();
    const ck = await subtle.importKey('raw', new Uint8Array(key), { name: 'AES-GCM' }, false, ['decrypt']);
    return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv), tagLength: 128 }, ck, ciphertext));
  }
  return gcm(new Uint8Array(key), iv).decrypt(ciphertext);
}

// ─── ECDH P-256 Key Pair Generation ─────────────────────────────────────────

export async function generateKeyPairAsync(): Promise<{ privateKeyBase64: string; publicKeyBase64: string }> {
  if (isWeb) {
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
  const rawPriv = p256.utils.randomPrivateKey();
  const rawPub = p256.getPublicKey(rawPriv, false); // uncompressed 65 bytes (04 || x || y)
  return {
    privateKeyBase64: bytesToBase64(rawToPkcs8(rawPriv, rawPub)),
    publicKeyBase64: bytesToBase64(rawToSpki(rawPub)),
  };
}

// ─── ECDH + HKDF shared AES key derivation ──────────────────────────────────

export async function deriveSharedAesKeyAsync(
  ourPrivateKeyBase64: string,
  theirPublicKeyBase64: string
): Promise<SymmetricKey> {
  if (isWeb) {
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
      true,
      ['encrypt', 'decrypt']
    );
    const raw = await subtle.exportKey('raw', aesKey);
    return new Uint8Array(raw);
  }

  // Native: ECDH via @noble/curves, HKDF via @noble/hashes
  const rawPriv = pkcs8ToRawPriv(base64ToBytes(ourPrivateKeyBase64));
  const rawPub = spkiToRaw(base64ToBytes(theirPublicKeyBase64));
  // getSharedSecret returns compressed point (33 bytes: prefix + x); x-coordinate matches Web Crypto deriveBits output
  const sharedPoint = p256.getSharedSecret(rawPriv, rawPub);
  const sharedX = sharedPoint.slice(1, 33);
  return hkdf(sha256, sharedX, E2E_KEY_SALT, E2E_KEY_INFO, AES_KEY_LENGTH);
}

// ─── Legacy sync API stubs ──────────────────────────────────────────────────

export function generateKeyPair(): { privateKey: Uint8Array; publicKey: Uint8Array } {
  throw new Error('E2E: use generateKeyPairAsync()');
}

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

// ─── Base64 encoding / decoding ─────────────────────────────────────────────

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return typeof btoa !== 'undefined' ? btoa(binary) : (global as any).Buffer?.from(bytes).toString('base64') ?? '';
}

/** Normalize base64 for decoding: fix common corruption (+→space), strip whitespace, URL-safe to standard, padding. */
function normalizeBase64(base64: string): string {
  let s = base64.replace(/ /g, '+');
  s = s.replace(/\s/g, '');
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  s = s.replace(/[^A-Za-z0-9+/=]/g, '');
  const remainder = s.length % 4;
  if (remainder) s += '='.repeat(4 - remainder);
  return s;
}

export function base64ToBytes(base64: string): Uint8Array {
  const normalized = normalizeBase64(base64);
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(normalized, 'base64'));
  const binary = typeof atob !== 'undefined' ? atob(normalized) : (global as any).Buffer?.from(normalized, 'base64').toString('binary') ?? '';
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
