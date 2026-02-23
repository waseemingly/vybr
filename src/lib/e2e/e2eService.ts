/**
 * E2E service: ensure keys, encrypt/decrypt message content for 1:1 and group.
 * Existing users/groups get keys on first use.
 */
import { supabase } from '@/lib/supabase';
import * as crypto from './crypto';
import * as keyStorage from './keyStorage';

export const CONTENT_FORMAT_PLAIN = 'plain';
export const CONTENT_FORMAT_E2E = 'e2e';

export type E2EContextIndividual = { type: 'individual'; userId: string; peerId: string };
export type E2EContextGroup = { type: 'group'; userId: string; groupId: string };
export type E2EContext = E2EContextIndividual | E2EContextGroup;

/** Check if this user's public key is in the DB (so others can encrypt to you). */
export async function isKeyRegistered(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_public_keys')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return data != null;
}

export async function ensureUserKeyPair(userId: string): Promise<boolean> {
  try {
    let stored = await keyStorage.getStoredKeyPair(userId);
    if (!stored) {
      keyStorage.clearKeyCache();
      const pair = await crypto.generateKeyPairAsync();
      await keyStorage.setStoredKeyPair(userId, pair.privateKeyBase64, pair.publicKeyBase64);
      stored = { privateKeyBase64: pair.privateKeyBase64, publicKeyBase64: pair.publicKeyBase64 };
      console.log('[E2E] Generated new key pair for user');
    }
    const { data: existing } = await supabase
      .from('user_public_keys')
      .select('user_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    const payload = { public_key: stored.publicKeyBase64, updated_at: new Date().toISOString() };
    if (existing) {
      const { error } = await supabase.from('user_public_keys').update(payload).eq('user_id', userId);
      if (error) {
        console.warn('[E2E] Failed to update public key:', error.message);
        return false;
      }
    } else {
      let { error } = await supabase.from('user_public_keys').insert({ user_id: userId, ...payload });
      if (error && (error.message.includes('key_fingerprint') || error.message.includes('null value'))) {
        (payload as any).key_fingerprint = 'primary';
        const res = await supabase.from('user_public_keys').insert({ user_id: userId, ...payload });
        error = res.error;
      }
      if (error) {
        console.warn('[E2E] Failed to insert public key:', error.message);
        return false;
      }
    }
    return true;
  } catch (e) {
    console.warn('[E2E] ensureUserKeyPair error:', e);
    return false;
  }
}

export async function getOrCreateConversationKey(userId: string, peerId: string): Promise<Uint8Array | null> {
  const cacheKey = keyStorage.conversationCacheKey(userId, peerId);
  const cached = keyStorage.getCachedKey(cacheKey);
  if (cached) return cached;

  const stored = await keyStorage.getStoredKeyPair(userId);
  if (!stored) {
    console.warn('[E2E SEND] STEP 1 FAILED: No local key for sender — cannot encrypt. Logged in as this user on this device?');
    return null;
  }
  console.warn('[E2E SEND] STEP 1 OK: Sender has local key');

  const { data: peerKeyRow, error: peerKeyError } = await supabase
    .from('user_public_keys')
    .select('public_key')
    .eq('user_id', peerId)
    .limit(1)
    .maybeSingle();

  if (peerKeyError) {
    console.warn('[E2E SEND] STEP 2 FAILED: Fetch peer key —', peerKeyError.message);
    return null;
  }
  if (!peerKeyRow?.public_key) {
    console.warn('[E2E SEND] STEP 2 FAILED: Peer has no key in DB — they need to open the app once.');
    return null;
  }
  console.warn('[E2E SEND] STEP 2 OK: Peer public key found');

  try {
    const key = await crypto.deriveSharedAesKeyAsync(stored.privateKeyBase64, peerKeyRow.public_key);
    keyStorage.setCachedKey(cacheKey, key);
    console.warn('[E2E SEND] STEP 3 OK: Derived shared key');
    return key;
  } catch (e) {
    console.warn('[E2E SEND] STEP 3 FAILED: derive error', e);
    return null;
  }
}

export async function getOrCreateGroupKey(userId: string, groupId: string): Promise<Uint8Array | null> {
  const cacheKey = keyStorage.groupCacheKey(groupId);
  const cached = keyStorage.getCachedKey(cacheKey);
  if (cached) return cached;

  const { data: myKeyRow } = await supabase
    .from('group_keys')
    .select('encrypted_key')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (myKeyRow?.encrypted_key) {
    const stored = await keyStorage.getStoredKeyPair(userId);
    if (!stored) return null;
    try {
      const key = await decryptGroupKeyFromString(myKeyRow.encrypted_key, stored.privateKeyBase64);
      if (key) {
        keyStorage.setCachedKey(cacheKey, key);
        return key;
      }
    } catch (e) {
      console.warn('[E2E] Failed to decrypt group key:', e);
    }
    return null;
  }

  const { data: participants } = await supabase
    .from('group_chat_participants')
    .select('user_id')
    .eq('group_id', groupId);

  if (!participants?.length) return null;

  const groupKey = crypto.generateSymmetricKey();
  const stored = await keyStorage.getStoredKeyPair(userId);
  if (!stored) return null;

  for (const p of participants) {
    const memberId = p.user_id;
    const memberPublicKeyBase64 = memberId === userId ? stored.publicKeyBase64 : (await supabase.from('user_public_keys').select('public_key').eq('user_id', memberId).limit(1).maybeSingle()).data?.public_key;
    if (!memberPublicKeyBase64) continue;
    const encryptedKey = await encryptGroupKeyForMember(groupKey, memberPublicKeyBase64);
    const { error } = await supabase.from('group_keys').upsert(
      { group_id: groupId, user_id: memberId, encrypted_key: encryptedKey },
      { onConflict: 'group_id,user_id' }
    );
    if (error) console.warn('[E2E] Failed to store group key for', memberId, error.message);
  }

  keyStorage.setCachedKey(cacheKey, groupKey);
  return groupKey;
}

async function encryptGroupKeyForMember(groupKey: Uint8Array, memberPublicKeyBase64: string): Promise<string> {
  const ephemeral = await crypto.generateKeyPairAsync();
  const shared = await crypto.deriveSharedAesKeyAsync(ephemeral.privateKeyBase64, memberPublicKeyBase64);
  const encrypted = await crypto.encryptWithKeyAsync(crypto.bytesToBase64(groupKey), shared);
  return ephemeral.publicKeyBase64 + '.' + encrypted;
}

async function decryptGroupKeyFromString(encryptedPayload: string, ourPrivateKeyBase64: string): Promise<Uint8Array | null> {
  const dot = encryptedPayload.indexOf('.');
  if (dot === -1) return null;
  const ephemeralPublicKeyBase64 = encryptedPayload.slice(0, dot);
  const cipherB64 = encryptedPayload.slice(dot + 1);
  const shared = await crypto.deriveSharedAesKeyAsync(ourPrivateKeyBase64, ephemeralPublicKeyBase64);
  const keyB64 = await crypto.decryptWithKeyAsync(cipherB64, shared);
  return crypto.base64ToBytes(keyB64);
}

/** Encrypt message content. Returns ciphertext + contentFormat or null to send plain. */
export async function encryptMessageContent(
  plaintext: string,
  context: E2EContext
): Promise<{ ciphertext: string; contentFormat: string } | null> {
  try {
    let key: Uint8Array | null = null;
    if (context.type === 'individual') {
      key = await getOrCreateConversationKey(context.userId, context.peerId);
    } else {
      key = await getOrCreateGroupKey(context.userId, context.groupId);
    }
    if (!key) {
      console.warn('[E2E SEND] No shared key — sending as PLAIN. See STEP 1/2/3 FAILED above.');
      return null;
    }
    const ciphertext = await crypto.encryptWithKeyAsync(plaintext, key);
    console.warn('[E2E SEND] Message encrypted successfully — storing as e2e');
    return { ciphertext, contentFormat: CONTENT_FORMAT_E2E };
  } catch (e) {
    console.warn('[E2E SEND] encryptMessageContent error:', e);
    return null;
  }
}

/** Decrypt message content for display. */
export async function decryptMessageContent(
  content: string,
  contentFormat: string | null | undefined,
  context: E2EContext
): Promise<string> {
  if (contentFormat !== CONTENT_FORMAT_E2E) return content;
  try {
    let key: Uint8Array | null = null;
    if (context.type === 'individual') {
      key = await getOrCreateConversationKey(context.userId, context.peerId);
    } else {
      key = await getOrCreateGroupKey(context.userId, context.groupId);
    }
    if (!key) {
      console.warn('[E2E RECV] No shared key — cannot decrypt (userId=', context.type === 'individual' ? context.userId : '', 'peerId=', context.type === 'individual' ? context.peerId : '', ')');
      return '[Encrypted]';
    }
    const decrypted = await crypto.decryptWithKeyAsync(content, key);
    return decrypted;
  } catch (e) {
    console.warn('[E2E RECV] Decrypt failed:', e);
    return '[Encrypted]';
  }
}

export function clearE2ECache(): void {
  keyStorage.clearKeyCache();
}
