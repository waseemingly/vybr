/**
 * E2E key storage: one key pair per user per device (SecureStore / AsyncStorage).
 * Same user on multiple devices = multiple keys; multiple users on same device = keys keyed by userId.
 *
 * iOS: SecureStore can fail for some devices/builds (Keychain edge cases). If writes fail, we fall back
 * to AsyncStorage so ensureUserKeyPair can still persist keys locally and upload public_key to Supabase.
 */
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

function keyForUser(userId: string, suffix: 'private' | 'public'): string {
  return `vybr_e2e_${suffix}_${userId}`;
}

/** AsyncStorage mirror when SecureStore is unavailable (native only). */
function fallbackKey(secureKey: string): string {
  return `e2e_fb_${secureKey}`;
}

export async function getStoredKeyPair(userId: string): Promise<{ privateKeyBase64: string; publicKeyBase64: string } | null> {
  try {
    const privateKey = await secureGet(keyForUser(userId, 'private'));
    const publicKey = await secureGet(keyForUser(userId, 'public'));
    if (privateKey && publicKey) return { privateKeyBase64: privateKey, publicKeyBase64: publicKey };
    return null;
  } catch {
    return null;
  }
}

export async function setStoredKeyPair(userId: string, privateKeyBase64: string, publicKeyBase64: string): Promise<void> {
  const pk = keyForUser(userId, 'private');
  const pubk = keyForUser(userId, 'public');
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(pk, privateKeyBase64);
    await AsyncStorage.setItem(pubk, publicKeyBase64);
    return;
  }
  try {
    await SecureStore.setItemAsync(pk, privateKeyBase64);
    await SecureStore.setItemAsync(pubk, publicKeyBase64);
    await AsyncStorage.removeItem(fallbackKey(pk));
    await AsyncStorage.removeItem(fallbackKey(pubk));
  } catch (e) {
    console.warn('[E2E keyStorage] SecureStore setStoredKeyPair failed, using AsyncStorage fallback:', e);
    await AsyncStorage.setItem(fallbackKey(pk), privateKeyBase64);
    await AsyncStorage.setItem(fallbackKey(pubk), publicKeyBase64);
  }
}

export async function clearStoredKeyPair(userId: string): Promise<void> {
  await secureDelete(keyForUser(userId, 'private'));
  await secureDelete(keyForUser(userId, 'public'));
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }
  try {
    const v = await SecureStore.getItemAsync(key);
    if (v != null) return v;
  } catch {
    /* fall through to fallback */
  }
  return AsyncStorage.getItem(fallbackKey(key));
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* ignore */
  }
  await AsyncStorage.removeItem(fallbackKey(key));
}

/** In-memory cache for derived keys (conversation key for 1:1, group key for group). Key: "conv:userId:peerId" or "group:groupId" */
const keyCache = new Map<string, Uint8Array>();

export function getCachedKey(cacheKey: string): Uint8Array | undefined {
  return keyCache.get(cacheKey);
}

export function setCachedKey(cacheKey: string, key: Uint8Array): void {
  keyCache.set(cacheKey, key);
}

export function clearKeyCache(): void {
  keyCache.clear();
}

export function conversationCacheKey(userId: string, peerId: string): string {
  const a = userId < peerId ? userId : peerId;
  const b = userId < peerId ? peerId : userId;
  return `conv:${a}:${b}`;
}

export function groupCacheKey(groupId: string): string {
  return `group:${groupId}`;
}

export function profileCacheKey(userId: string): string {
  return `profile:${userId}`;
}
