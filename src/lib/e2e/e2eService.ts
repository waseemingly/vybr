/**
 * E2E service: ensure keys, encrypt/decrypt message content for 1:1 and group.
 * Existing users/groups get keys on first use.
 *
 * Multi-device: A backup of the E2E private key (encrypted with a per-user key in the DB)
 * is stored so the same account on different devices can restore the key and decrypt
 * all messages. First device to use E2E uploads the backup; new devices restore from it.
 */
import { supabase } from '@/lib/supabase';
import * as crypto from './crypto';
import * as keyStorage from './keyStorage';

export const CONTENT_FORMAT_PLAIN = 'plain';
export const CONTENT_FORMAT_E2E = 'e2e';

/** Sentinel returned by decryptMessageContent when decryption fails or content is corrupted. UI should show "Unable to decrypt" instead of this value. */
export const E2E_UNDECRYPTABLE = '[Encrypted]';

export type E2EContextIndividual = { type: 'individual'; userId: string; peerId: string };
export type E2EContextGroup = { type: 'group'; userId: string; groupId: string };
/** Profile picture / avatar: only the owning user can decrypt (key derived from own key pair). */
export type E2EContextProfile = { type: 'profile'; userId: string };
/** Event images: key is stored per-event (e.g. in event row). */
export type E2EContextEvent = { type: 'event'; eventImageKeyBase64: string };
export type E2EContext =
  | E2EContextIndividual
  | E2EContextGroup
  | E2EContextProfile
  | E2EContextEvent;

/** Check if this user's public key is in the DB (so others can encrypt to you). */
export async function isKeyRegistered(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_public_keys')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return data != null;
}

const BACKUP_PAYLOAD_KEYS = ['privateKeyBase64', 'publicKeyBase64'] as const;

function tryRestoreFromBackup(
  encryptedPrivateKey: string,
  backupKeyB64: string
): Promise<{ privateKeyBase64: string; publicKeyBase64: string } | null> {
  return (async () => {
    const backupKeyBytes = crypto.base64ToBytes(backupKeyB64);
    const payloadStr = await crypto.decryptWithKeyAsync(encryptedPrivateKey.trim(), backupKeyBytes);
    const payload = JSON.parse(payloadStr) as Record<string, string>;
    if (BACKUP_PAYLOAD_KEYS.every((k) => payload[k])) {
      return { privateKeyBase64: payload.privateKeyBase64, publicKeyBase64: payload.publicKeyBase64 };
    }
    return null;
  })();
}

export async function ensureUserKeyPair(userId: string): Promise<boolean> {
  try {
    let stored = await keyStorage.getStoredKeyPair(userId);

    // Fetch row once for both "sync from server" and "upload backup" decisions.
    const { data: row } = await supabase
      .from('user_public_keys')
      .select('user_id, public_key, encrypted_private_key, backup_key')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    // If we have a local key but the server has a different public key and a backup, sync to server (another device is canonical).
    if (stored && row?.public_key?.trim() && row.public_key !== stored.publicKeyBase64 && row.encrypted_private_key?.trim() && row.backup_key?.trim()) {
      try {
        const restored = await tryRestoreFromBackup(row.encrypted_private_key, row.backup_key);
        if (restored) {
          keyStorage.clearKeyCache();
          await keyStorage.setStoredKeyPair(userId, restored.privateKeyBase64, restored.publicKeyBase64);
          stored = restored;
          if (__DEV__) console.log('[E2E] Synced to canonical key from server (multi-device)');
        }
      } catch (e) {
        if (__DEV__) console.warn('[E2E] Sync from server backup failed:', e);
      }
    }

    if (!stored) {
      keyStorage.clearKeyCache();
      if (row?.encrypted_private_key?.trim() && row?.backup_key?.trim()) {
        try {
          const restored = await tryRestoreFromBackup(row.encrypted_private_key, row.backup_key);
          if (restored) {
            await keyStorage.setStoredKeyPair(userId, restored.privateKeyBase64, restored.publicKeyBase64);
            stored = restored;
            if (__DEV__) console.log('[E2E] Restored key pair from backup (multi-device)');
          }
        } catch (e) {
          if (__DEV__) console.warn('[E2E] Restore from backup failed:', e);
        }
      }
      if (!stored) {
        const pair = await crypto.generateKeyPairAsync();
        await keyStorage.setStoredKeyPair(userId, pair.privateKeyBase64, pair.publicKeyBase64);
        stored = { privateKeyBase64: pair.privateKeyBase64, publicKeyBase64: pair.publicKeyBase64 };
        console.log('[E2E] Generated new key pair for user');
      }
    }

    const existing = row;
    const payload: Record<string, unknown> = { public_key: stored.publicKeyBase64, updated_at: new Date().toISOString() };
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
      if (error && (error.message.includes('duplicate key') || error.message.includes('unique constraint') || error.message.includes('user_public_keys_pkey'))) {
        const { error: updateErr } = await supabase.from('user_public_keys').update(payload).eq('user_id', userId);
        if (updateErr) {
          console.warn('[E2E] Failed to update public key after duplicate:', updateErr.message);
          return false;
        }
      } else if (error) {
        console.warn('[E2E] Failed to insert public key:', error.message);
        return false;
      }
    }

    // Upload encrypted key backup so other devices can restore. Also overwrite when our key differs (we become canonical).
    const hasBackup = !!existing?.encrypted_private_key?.trim();
    const serverKeyDiffers = existing?.public_key?.trim() && existing.public_key !== stored.publicKeyBase64;
    if (!hasBackup || serverKeyDiffers) {
      const backupKey = crypto.generateSymmetricKey();
      const backupPayload = JSON.stringify({
        privateKeyBase64: stored.privateKeyBase64,
        publicKeyBase64: stored.publicKeyBase64,
      });
      const encryptedBackup = await crypto.encryptWithKeyAsync(backupPayload, backupKey);
      const { error: backupErr } = await supabase
        .from('user_public_keys')
        .update({
          encrypted_private_key: encryptedBackup,
          backup_key: crypto.bytesToBase64(backupKey),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
      if (backupErr) {
        console.warn('[E2E] Failed to upload key backup:', backupErr.message);
      } else if (__DEV__) {
        console.log('[E2E] Key backup uploaded for multi-device');
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
        void topUpGroupKeyDistribution(groupId, key, userId);
        return key;
      }
    } catch (e) {
      console.warn('[E2E] Failed to decrypt group key:', e);
    }
    return null;
  }

  // We don't have our key row. Only the first member to send should create and distribute the group key.
  // If we create a new key here we'd overwrite the real key and decrypt would fail (wrong key).
  const { data: participants } = await supabase
    .from('group_chat_participants')
    .select('user_id')
    .eq('group_id', groupId);

  if (!participants?.length) return null;

  // Only create if no key exists yet (RLS hides other users' rows, so we need an RPC)
  const { data: groupHasKey } = await supabase.rpc('e2e_group_has_any_key', { gid: groupId }).maybeSingle();
  if (groupHasKey === true) {
    console.warn('[E2E] Group key exists but no row for this user — wait for key distribution');
    return null;
  }

  const groupKey = crypto.generateSymmetricKey();
  const stored = await keyStorage.getStoredKeyPair(userId);
  if (!stored) return null;

  for (const p of participants) {
    const memberId = p.user_id;
    const memberPublicKeyBase64 = memberId === userId ? stored.publicKeyBase64 : (await supabase.from('user_public_keys').select('public_key').eq('user_id', memberId).limit(1).maybeSingle()).data?.public_key;
    if (!memberPublicKeyBase64) continue;
    const encryptedKey = await encryptGroupKeyForMember(groupKey, memberPublicKeyBase64);
    const { error } = await supabase.rpc('e2e_upsert_group_key_row', {
      gid: groupId,
      target_user_id: memberId,
      encrypted_key: encryptedKey,
    });
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

/** Background: distribute group key to participants who don't have a row yet (e.g. new members or failed initial distribution). */
async function topUpGroupKeyDistribution(groupId: string, groupKey: Uint8Array, userId: string): Promise<void> {
  try {
    const { data: rawMissing, error: listError } = await supabase.rpc('e2e_group_missing_key_user_ids', { gid: groupId });
    if (listError || !rawMissing?.length) return;
    const missingIds = (Array.isArray(rawMissing) ? rawMissing : []).map((m: unknown) =>
      typeof m === 'string' ? m : (m as { user_id?: string })?.user_id
    ).filter((id): id is string => typeof id === 'string');
    if (!missingIds.length) return;
    const stored = await keyStorage.getStoredKeyPair(userId);
    if (!stored) return;
    for (const memberId of missingIds) {
      if (memberId === userId) continue;
      const { data: keyRow } = await supabase.from('user_public_keys').select('public_key').eq('user_id', memberId).limit(1).maybeSingle();
      if (!keyRow?.public_key) continue;
      const encryptedKey = await encryptGroupKeyForMember(groupKey, keyRow.public_key);
      const { error } = await supabase.rpc('e2e_upsert_group_key_row', { gid: groupId, target_user_id: memberId, encrypted_key: encryptedKey });
      if (error) console.warn('[E2E] Top-up store group key for', memberId, error.message);
    }
  } catch (e) {
    console.warn('[E2E] topUpGroupKeyDistribution error:', e);
  }
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
    } else if (context.type === 'group') {
      key = await getOrCreateGroupKey(context.userId, context.groupId);
    }
    if (!key) {
      const msg = context.type === 'group'
        ? 'E2E: No group key for this user — wait for key distribution or ensure you are a participant.'
        : 'E2E: No shared key with peer — ensure peer has registered their key.';
      console.warn('[E2E SEND]', msg);
      throw new Error(msg);
    }
    const ciphertext = await crypto.encryptWithKeyAsync(plaintext, key);
    console.warn('[E2E SEND] Message encrypted successfully — storing as e2e');
    return { ciphertext, contentFormat: CONTENT_FORMAT_E2E };
  } catch (e) {
    console.warn('[E2E SEND] encryptMessageContent error:', e);
    throw e;
  }
}

/** Decrypt message content for display. */
export async function decryptMessageContent(
  content: string,
  contentFormat: string | null | undefined,
  context: E2EContext
): Promise<string> {
  if (contentFormat !== CONTENT_FORMAT_E2E) return content;
  if (typeof content !== 'string' || !content.trim()) {
    if (__DEV__) console.warn('[E2E RECV] Content is not a non-empty string, skipping decrypt');
    return E2E_UNDECRYPTABLE;
  }
  const contentTrimmed = content.trim();
  // Image messages store placeholder '[Image]' with content_format e2e; do not attempt to decrypt.
  if (contentTrimmed === '[Image]') return contentTrimmed;
  try {
    let key: Uint8Array | null = null;
    // Use 1:1 key only for individual; group messages must use group key (never getOrCreateConversationKey).
    if (context.type === 'individual') {
      key = await getOrCreateConversationKey(context.userId, context.peerId);
    } else if (context.type === 'group') {
      key = await getOrCreateGroupKey(context.userId, context.groupId);
    } else {
      console.warn('[E2E RECV] Unknown context type:', (context as E2EContext).type);
      return E2E_UNDECRYPTABLE;
    }
    if (!key) {
      console.warn('[E2E RECV] No shared key — cannot decrypt (userId=', context.type === 'individual' ? context.userId : '', 'peerId=', context.type === 'individual' ? context.peerId : '', ')');
      return E2E_UNDECRYPTABLE;
    }
    const decrypted = await crypto.decryptWithKeyAsync(contentTrimmed, key);
    return decrypted;
  } catch (e: any) {
    const ctxInfo = context.type === 'individual'
      ? `individual userId=${context.userId} peerId=${context.peerId}`
      : context.type === 'group'
        ? `group userId=${context.userId} groupId=${context.groupId}`
        : String(context.type);
    const isInvalidBase64 =
      (e?.name === 'InvalidCharacterError') ||
      (typeof e?.message === 'string' && e.message.includes('not correctly encoded'));
    if (isInvalidBase64) {
      // Corrupted or encrypted content that isn't valid base64; don't show raw ciphertext.
      if (__DEV__) console.warn('[E2E RECV] Content not valid base64 — context:', ctxInfo);
      return E2E_UNDECRYPTABLE;
    }
    const isOperationError = e?.name === 'OperationError';
    if (isOperationError && __DEV__) {
      const keyId = context.type === 'individual'
        ? keyStorage.conversationCacheKey(context.userId, context.peerId)
        : context.type === 'group'
          ? keyStorage.groupCacheKey(context.groupId)
          : 'n/a';
      console.warn('[E2E RECV] Decrypt OperationError (wrong key or corrupted). keyId:', keyId, '— context:', ctxInfo);
    } else {
      console.warn('[E2E RECV] Decrypt failed:', e, '— context:', ctxInfo);
    }
    return E2E_UNDECRYPTABLE;
  }
}

export function clearE2ECache(): void {
  keyStorage.clearKeyCache();
}

/** Get key for profile picture encryption (derived from user's own key pair; only this user can decrypt). */
export async function getOrCreateProfilePictureKey(userId: string): Promise<Uint8Array | null> {
  const cacheKey = keyStorage.profileCacheKey(userId);
  const cached = keyStorage.getCachedKey(cacheKey);
  if (cached) return cached;
  const stored = await keyStorage.getStoredKeyPair(userId);
  if (!stored) return null;
  try {
    const key = await crypto.deriveSharedAesKeyAsync(stored.privateKeyBase64, stored.publicKeyBase64);
    keyStorage.setCachedKey(cacheKey, key);
    return key;
  } catch (e) {
    console.warn('[E2E] getOrCreateProfilePictureKey error:', e);
    return null;
  }
}

/** Encrypt image bytes for storage. Context determines which key is used. */
export async function encryptImageBytes(
  imageBytes: Uint8Array,
  context: E2EContext
): Promise<string> {
  let key: Uint8Array | null = null;
  if (context.type === 'individual') {
    key = await getOrCreateConversationKey(context.userId, context.peerId);
  } else if (context.type === 'group') {
    key = await getOrCreateGroupKey(context.userId, context.groupId);
  } else if (context.type === 'profile') {
    key = await getOrCreateProfilePictureKey(context.userId);
  } else if (context.type === 'event') {
    key = crypto.base64ToBytes(context.eventImageKeyBase64);
  }
  if (!key) {
    throw new Error('E2E: No key available for image encryption');
  }
  return crypto.encryptBytesWithKeyAsync(imageBytes, key);
}

/** Decrypt image payload (base64) to raw bytes. */
export async function decryptImageBytes(
  encryptedBase64: string,
  context: E2EContext
): Promise<Uint8Array> {
  let key: Uint8Array | null = null;
  if (context.type === 'individual') {
    key = await getOrCreateConversationKey(context.userId, context.peerId);
  } else if (context.type === 'group') {
    key = await getOrCreateGroupKey(context.userId, context.groupId);
  } else if (context.type === 'profile') {
    key = await getOrCreateProfilePictureKey(context.userId);
  } else if (context.type === 'event') {
    key = crypto.base64ToBytes(context.eventImageKeyBase64);
  }
  if (!key) {
    throw new Error('E2E: No key available for image decryption');
  }
  return crypto.decryptBytesWithKeyAsync(encryptedBase64, key);
}

/** Parse Supabase storage URL into bucket + path for authenticated download (works with private buckets). */
function parseSupabaseStorageUrl(url: string): { bucket: string; path: string } | null {
  try {
    const match = url.match(/\/storage\/v1\/object\/(?:public|authenticated)\/([^/]+)\/(.+)$/);
    if (!match) return null;
    const [, bucket, pathRaw] = match;
    if (!bucket || !pathRaw) return null;
    const path = decodeURIComponent(pathRaw.split('?')[0]);
    return { bucket, path };
  } catch {
    return null;
  }
}

/** Fetch image blob from URL. Uses Supabase authenticated download when URL is our storage (so private buckets work). */
export async function fetchImageBlob(imageUrl: string): Promise<Blob | null> {
  const parsed = parseSupabaseStorageUrl(imageUrl);
  if (parsed) {
    const { data, error } = await supabase.storage.from(parsed.bucket).download(parsed.path);
    if (error) {
      console.warn('[E2E] Storage download failed:', error.message);
      return null;
    }
    return data;
  }
  const res = await fetch(imageUrl);
  if (!res.ok) return null;
  return res.blob();
}

/** Resolve a Supabase storage image URL to a displayable URI (data URL). Use for private buckets so viewing works. */
export async function getAuthenticatedStorageImageUri(imageUrl: string | null | undefined): Promise<string | null> {
  if (!imageUrl?.trim()) return null;
  const blob = await fetchImageBlob(imageUrl);
  if (!blob) return imageUrl;
  try {
    const buf = await blob.arrayBuffer();
    const b64 = crypto.bytesToBase64(new Uint8Array(buf));
    const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
    return `data:${mime};base64,${b64}`;
  } catch {
    return imageUrl;
  }
}

/** Resolve chat image URL to a displayable URI. For our Supabase storage URLs always uses authenticated download (private buckets). If E2E, decrypts and returns data URI; otherwise returns data URI of blob or original URL. */
export async function getDecryptedImageUri(
  imageUrl: string,
  contentFormat: string | null | undefined,
  context: E2EContext | null
): Promise<string | null> {
  const isOurStorage = parseSupabaseStorageUrl(imageUrl) != null;
  try {
    if (isOurStorage) {
      const blob = await fetchImageBlob(imageUrl);
      if (!blob) return null;
      const buf = await blob.arrayBuffer();
      const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
      if (contentFormat === CONTENT_FORMAT_E2E && context) {
        const encryptedB64 = crypto.bytesToBase64(new Uint8Array(buf));
        const decrypted = await decryptImageBytes(encryptedB64, context);
        const b64 = crypto.bytesToBase64(decrypted);
        return `data:${mime};base64,${b64}`;
      }
      const b64 = crypto.bytesToBase64(new Uint8Array(buf));
      return `data:${mime};base64,${b64}`;
    }
    if (contentFormat === CONTENT_FORMAT_E2E && context) {
      const blob = await fetchImageBlob(imageUrl);
      if (!blob) return null;
      const buf = await blob.arrayBuffer();
      const encryptedB64 = crypto.bytesToBase64(new Uint8Array(buf));
      const decrypted = await decryptImageBytes(encryptedB64, context);
      const b64 = crypto.bytesToBase64(decrypted);
      const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
      return `data:${mime};base64,${b64}`;
    }
    return imageUrl;
  } catch (e) {
    console.warn('[E2E] getDecryptedImageUri failed:', e);
    return null;
  }
}
