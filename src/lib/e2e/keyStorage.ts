/**
 * E2E key storage: one key pair per user per device (SecureStore / AsyncStorage).
 * Same user on multiple devices = multiple keys; multiple users on same device = keys keyed by userId.
 */
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

function keyForUser(userId: string, suffix: 'private' | 'public'): string {
  return `vybr_e2e_${suffix}_${userId}`;
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
  await secureSet(keyForUser(userId, 'private'), privateKeyBase64);
  await secureSet(keyForUser(userId, 'public'), publicKeyBase64);
}

export async function clearStoredKeyPair(userId: string): Promise<void> {
  await secureDelete(keyForUser(userId, 'private'));
  await secureDelete(keyForUser(userId, 'public'));
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
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
