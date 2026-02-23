-- Idempotent fix for "policy already exists" when re-running 20250223180000.
-- DROP then CREATE so this and the previous migration can be run safely in any order.
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
