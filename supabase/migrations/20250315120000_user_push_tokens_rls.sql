-- Fix push token registration: table already exists with id, user_id, push_token, platform, created_at, updated_at.
-- Ensure upsert works and RLS allows the app to write.

-- 1) Upsert requires a unique constraint on (user_id, platform)
DO $$
BEGIN
  ALTER TABLE public.user_push_tokens
    ADD CONSTRAINT user_push_tokens_user_id_platform_key UNIQUE (user_id, platform);
EXCEPTION
  WHEN duplicate_object THEN NULL; -- constraint already exists
END $$;

-- 2) RLS: allow authenticated users to manage only their own row
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users can view own push tokens"
  ON public.user_push_tokens FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users can insert own push tokens"
  ON public.user_push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users can update own push tokens"
  ON public.user_push_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users can delete own push tokens"
  ON public.user_push_tokens FOR DELETE
  USING (auth.uid() = user_id);
