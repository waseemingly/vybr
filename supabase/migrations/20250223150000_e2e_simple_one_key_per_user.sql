-- Ensure E2E uses one key per user (no key_fingerprint, no message_recipient_keys).
-- Safe to run: drops multi-device tables/columns if present.

DROP TABLE IF EXISTS public.message_recipient_keys;

-- Revert user_public_keys to single key per user if key_fingerprint was added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_public_keys' AND column_name = 'key_fingerprint'
  ) THEN
    ALTER TABLE public.user_public_keys DROP CONSTRAINT IF EXISTS user_public_keys_pkey;
    DELETE FROM public.user_public_keys a
    USING public.user_public_keys b
    WHERE a.user_id = b.user_id AND a.created_at > b.created_at;
    ALTER TABLE public.user_public_keys DROP COLUMN key_fingerprint;
    ALTER TABLE public.user_public_keys ADD PRIMARY KEY (user_id);
  END IF;
END $$;
