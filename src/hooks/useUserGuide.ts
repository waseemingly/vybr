import { useCallback, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { TourStep, TourUserType } from '@/config/tourConfig';
import { getTourSteps } from '@/config/tourConfig';

type UseUserGuideResult = {
  userType: TourUserType | null;
  steps: TourStep[];
  active: boolean;
  stepIndex: number;
  step: TourStep | null;
  start: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  complete: () => void;
  replay: () => void;
};

export function useUserGuide(): UseUserGuideResult {
  const { session, musicLoverProfile, organizerProfile, refreshSessionData } = useAuth();
  const [overrideActive, setOverrideActive] = useState<boolean | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const userType: TourUserType | null = useMemo(() => {
    const t =
      session?.userType ||
      (session?.user as any)?.user_metadata?.user_type ||
      (session?.user as any)?.user_metadata?.userType ||
      (session?.user as any)?.app_metadata?.user_type ||
      (session?.user as any)?.app_metadata?.userType;
    if (t === 'organizer' || t === 'music_lover') return t;
    return null;
  }, [session]);

  const hasCompletedTour = useMemo(() => {
    if (!session) return true;
    if (userType === 'organizer') return organizerProfile?.hasCompletedTour ?? true;
    if (userType === 'music_lover') return musicLoverProfile?.hasCompletedTour ?? true;
    return true;
  }, [session, userType, organizerProfile, musicLoverProfile]);

  const steps = useMemo(() => {
    if (!userType) return [];
    return getTourSteps(userType);
  }, [userType]);

  const active = useMemo(() => {
    if (!session) return false;
    if (!userType) return false;
    if (!steps.length) return false;
    if (overrideActive !== null) return overrideActive;
    return hasCompletedTour === false;
  }, [session, userType, steps.length, overrideActive, hasCompletedTour]);

  const step: TourStep | null = useMemo(() => {
    if (!active) return null;
    return steps[stepIndex] ?? null;
  }, [active, steps, stepIndex]);

  const setHasCompletedTour = useCallback(
    async (completed: boolean) => {
      if (!session?.user?.id || !userType) return;
      const table = userType === 'organizer' ? 'organizer_profiles' : 'music_lover_profiles';
      await supabase.from(table).update({ has_completed_tour: completed }).eq('user_id', session.user.id);
      // Refresh auth/profile state so the flag stays in sync across sessions/devices.
      await refreshSessionData();
    },
    [session?.user?.id, userType, refreshSessionData]
  );

  const start = useCallback(() => {
    setStepIndex(0);
    setOverrideActive(true);
  }, []);

  const complete = useCallback(async () => {
    setOverrideActive(false);
    await setHasCompletedTour(true);
  }, [setHasCompletedTour]);

  const skip = useCallback(async () => {
    await complete();
  }, [complete]);

  const next = useCallback(() => {
    setStepIndex((i) => {
      const nextIndex = i + 1;
      if (nextIndex >= steps.length) {
        // Fire-and-forget; UI immediately hides via override.
        void complete();
        return i;
      }
      return nextIndex;
    });
  }, [steps.length, complete]);

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const replay = useCallback(async () => {
    if (!session || !userType) return;
    await setHasCompletedTour(false);
    setStepIndex(0);
    setOverrideActive(true);
  }, [session, userType, setHasCompletedTour]);

  return {
    userType,
    steps,
    active,
    stepIndex,
    step,
    start,
    next,
    prev,
    skip,
    complete,
    replay,
  };
}


