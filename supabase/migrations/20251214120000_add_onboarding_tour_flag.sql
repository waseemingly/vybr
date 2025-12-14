-- Add a persisted flag to control the new-user onboarding tour

ALTER TABLE IF EXISTS public.music_lover_profiles
ADD COLUMN IF NOT EXISTS has_completed_tour boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.organizer_profiles
ADD COLUMN IF NOT EXISTS has_completed_tour boolean NOT NULL DEFAULT false;

-- Backfill: do not show the tour to existing users by default.
UPDATE public.music_lover_profiles SET has_completed_tour = true WHERE has_completed_tour = false;
UPDATE public.organizer_profiles SET has_completed_tour = true WHERE has_completed_tour = false;


