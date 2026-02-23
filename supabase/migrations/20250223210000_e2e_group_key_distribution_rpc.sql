-- Group key distribution: SECURITY DEFINER RPCs so a group member can insert/update
-- group_keys rows for any participant (bypasses RLS that may block cross-user inserts).

-- 1. Upsert one group key row for a target member. Caller must be in the group; target must be in the group.
CREATE OR REPLACE FUNCTION public.e2e_upsert_group_key_row(
  gid uuid,
  target_user_id uuid,
  encrypted_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF gid IS NULL OR target_user_id IS NULL OR encrypted_key IS NULL OR trim(encrypted_key) = '' THEN
    RAISE EXCEPTION 'e2e_upsert_group_key_row: gid, target_user_id and encrypted_key are required';
  END IF;
  -- Caller must be a member of the group
  IF NOT EXISTS (SELECT 1 FROM group_chat_participants WHERE group_id = gid AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'e2e_upsert_group_key_row: caller is not a member of the group';
  END IF;
  -- Target must be a member of the group
  IF NOT EXISTS (SELECT 1 FROM group_chat_participants WHERE group_id = gid AND user_id = target_user_id) THEN
    RAISE EXCEPTION 'e2e_upsert_group_key_row: target user is not a member of the group';
  END IF;
  INSERT INTO public.group_keys (group_id, user_id, encrypted_key)
  VALUES (gid, target_user_id, encrypted_key)
  ON CONFLICT (group_id, user_id)
  DO UPDATE SET encrypted_key = EXCLUDED.encrypted_key;
END;
$$;

-- 2. Return user_ids of participants who do not yet have a group_keys row for this group.
-- Used so a member who has the key can "top up" distribution to new or previously failed recipients.
CREATE OR REPLACE FUNCTION public.e2e_group_missing_key_user_ids(gid uuid)
RETURNS setof uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT gcp.user_id
  FROM public.group_chat_participants gcp
  WHERE gcp.group_id = gid
    AND NOT EXISTS (
      SELECT 1 FROM public.group_keys gk
      WHERE gk.group_id = gid AND gk.user_id = gcp.user_id
    );
$$;

COMMENT ON FUNCTION public.e2e_upsert_group_key_row(uuid, uuid, text) IS 'E2E: Insert or update a group key row for a member. Caller and target must be group participants.';
COMMENT ON FUNCTION public.e2e_group_missing_key_user_ids(uuid) IS 'E2E: Returns participant user_ids who do not yet have a group key row.';
