-- E2E encryption support for messages
-- 1. Add content_format to messages and group_chat_messages (plain = legacy, e2e = encrypted)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS content_format text DEFAULT 'plain' CHECK (content_format IN ('plain', 'e2e'));

ALTER TABLE public.group_chat_messages
  ADD COLUMN IF NOT EXISTS content_format text DEFAULT 'plain' CHECK (content_format IN ('plain', 'e2e'));

-- 2. User public keys for ECDH (existing and new users get key on first use)
CREATE TABLE IF NOT EXISTS public.user_public_keys (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_public_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all public keys (needed for E2E)"
  ON public.user_public_keys FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert/update own public key"
  ON public.user_public_keys FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Group keys: encrypted copy per member (server only stores ciphertext)
CREATE TABLE IF NOT EXISTS public.group_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_keys_group_id ON public.group_keys(group_id);
CREATE INDEX IF NOT EXISTS idx_group_keys_user_id ON public.group_keys(user_id);

ALTER TABLE public.group_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own group key rows"
  ON public.group_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Any group member can insert key rows (e.g. creator distributes encrypted key to each member)
CREATE POLICY "Group members can insert group key rows for their group"
  ON public.group_keys FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_chat_participants gcp
      WHERE gcp.group_id = group_keys.group_id AND gcp.user_id = auth.uid()
    )
  );

-- 4. Backfill: set content_format to 'plain' for existing rows (default already does this for new rows)
UPDATE public.messages SET content_format = 'plain' WHERE content_format IS NULL;
UPDATE public.group_chat_messages SET content_format = 'plain' WHERE content_format IS NULL;

COMMENT ON COLUMN public.messages.content_format IS 'plain = legacy unencrypted, e2e = end-to-end encrypted content';
COMMENT ON COLUMN public.group_chat_messages.content_format IS 'plain = legacy unencrypted, e2e = end-to-end encrypted content';
