-- Add can_members_edit_info to group_chats if missing (e.g. table was created before this column)
ALTER TABLE public.group_chats
ADD COLUMN IF NOT EXISTS can_members_edit_info boolean NOT NULL DEFAULT false;

-- Add updated_at if missing (some group_chats updates use it)
ALTER TABLE public.group_chats
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- RPC: allow group admins to set "allow members to edit info"
CREATE OR REPLACE FUNCTION public.set_group_edit_permission(
  group_id_input uuid,
  allow_members_to_edit boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only admins of the group can change this setting
  IF NOT EXISTS (
    SELECT 1 FROM public.group_chat_participants
    WHERE group_id = group_id_input
      AND user_id = current_user_id
      AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Only group admins can change edit permission';
  END IF;

  UPDATE public.group_chats
  SET can_members_edit_info = allow_members_to_edit,
      updated_at = now()
  WHERE id = group_id_input;
END;
$$;

-- Grant execute to authenticated users (function itself checks admin)
GRANT EXECUTE ON FUNCTION public.set_group_edit_permission(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_group_edit_permission(uuid, boolean) TO service_role;
