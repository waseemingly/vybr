-- 1. Allow group members to UPDATE group_keys rows for their group (required for upsert when row exists).
-- Without this, upsert fails with "new row violates row-level security policy" when updating existing rows.
DROP POLICY IF EXISTS "Group members can update group key rows for their group" ON public.group_keys;
CREATE POLICY "Group members can update group key rows for their group"
  ON public.group_keys FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_chat_participants gcp
      WHERE gcp.group_id = group_keys.group_id AND gcp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_chat_participants gcp
      WHERE gcp.group_id = group_keys.group_id AND gcp.user_id = auth.uid()
    )
  );

-- 2. RPC so clients can check "does this group already have a key?" without seeing other users' rows (RLS).
-- Used to avoid creating a second group key when another member already created one.
CREATE OR REPLACE FUNCTION public.e2e_group_has_any_key(gid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_keys WHERE group_id = gid LIMIT 1);
$$;
