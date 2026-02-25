-- Multi-device E2E: backup encrypted private key so same account on different devices can decrypt.
-- Backup is encrypted with a per-user key stored in the row (account-bound; RLS restricts to owner).
-- Only the authenticated user can read/update their row.

ALTER TABLE public.user_public_keys
  ADD COLUMN IF NOT EXISTS encrypted_private_key text,
  ADD COLUMN IF NOT EXISTS backup_key text;

COMMENT ON COLUMN public.user_public_keys.encrypted_private_key IS 'AES-GCM encrypted backup of E2E private key (base64), decrypt with backup_key';
COMMENT ON COLUMN public.user_public_keys.backup_key IS 'Key used to encrypt encrypted_private_key (base64); same account on any device can restore key';
