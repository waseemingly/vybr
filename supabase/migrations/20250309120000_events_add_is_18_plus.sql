-- Add age restriction flag for events (18+ only)
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS is_18_plus boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.is_18_plus IS 'When true, event is for attendees 18 and above only.';
