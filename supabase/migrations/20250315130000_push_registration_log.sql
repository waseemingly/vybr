-- Optional: log getExpoPushTokenAsync (or store) failures so you can see them in Supabase without device logs.
CREATE TABLE IF NOT EXISTS public.push_registration_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  error_message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_registration_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own push registration log" ON public.push_registration_log;
CREATE POLICY "Users can insert own push registration log"
  ON public.push_registration_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own push registration log" ON public.push_registration_log;
CREATE POLICY "Users can view own push registration log"
  ON public.push_registration_log FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.push_registration_log IS 'Failures from getExpoPushTokenAsync or storePushToken; query in Supabase to debug without device logs.';
