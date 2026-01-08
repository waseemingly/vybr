import { useCallback, useMemo, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { TourStep, TourUserType } from '@/config/tourConfig';
import { getTourSteps } from '@/config/tourConfig';

function readHasCompletedTour(profile: unknown): boolean | undefined {
  if (!profile || typeof profile !== 'object') return undefined;
  const p = profile as Record<string, unknown>;
  const camel = p.hasCompletedTour;
  if (typeof camel === 'boolean') return camel;
  const snake = p.has_completed_tour;
  if (typeof snake === 'boolean') return snake;
  return undefined;
}

type UseUserGuideOptions = {
  /**
   * When true, the tour will NOT auto-start from `hasCompletedTour === false`.
   * Manual starts (via `start()` / `replay()`) still work because they set `overrideActive`.
   */
  suppressAuto?: boolean;
};

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

export function useUserGuide(options?: UseUserGuideOptions): UseUserGuideResult {
  const { session, musicLoverProfile, organizerProfile, refreshSessionData } = useAuth();
  const [overrideActive, setOverrideActive] = useState<boolean | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const suppressAuto = options?.suppressAuto ?? false;
  // Track completion state to prevent tour from restarting on web before profile refreshes
  // Using state instead of ref so it triggers re-renders and memo recalculations
  const [hasCompletedInSession, setHasCompletedInSession] = useState<boolean>(false);

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
    if (userType === 'organizer') {
      const profileValue = readHasCompletedTour(organizerProfile);
      // If we've completed the tour in this session, trust that over the profile value
      // This prevents the tour from restarting on web before the profile refreshes
      if (hasCompletedInSession) return true;
      return profileValue ?? true;
    }
    if (userType === 'music_lover') {
      const profileValue = readHasCompletedTour(musicLoverProfile);
      if (hasCompletedInSession) return true;
      return profileValue ?? true;
    }
    return true;
  }, [session, userType, organizerProfile, musicLoverProfile, hasCompletedInSession]);

  // Reset completion state when session changes (user logs out/switches)
  useEffect(() => {
    if (!session) {
      setHasCompletedInSession(false);
    }
  }, [session]);

  // Sync completion state with profile value (after refresh confirms completion)
  useEffect(() => {
    if (userType === 'organizer' && organizerProfile) {
      const profileCompleted = readHasCompletedTour(organizerProfile);
      if (profileCompleted === true) {
        setHasCompletedInSession(true);
      } else if (profileCompleted === false && !hasCompletedInSession) {
        // Only reset if explicitly false and we haven't completed in this session
        // This allows the state to persist during the refresh window after completion
        setHasCompletedInSession(false);
      }
    } else if (userType === 'music_lover' && musicLoverProfile) {
      const profileCompleted = readHasCompletedTour(musicLoverProfile);
      if (profileCompleted === true) {
        setHasCompletedInSession(true);
      } else if (profileCompleted === false && !hasCompletedInSession) {
        setHasCompletedInSession(false);
      }
    }
  }, [userType, organizerProfile, musicLoverProfile, hasCompletedInSession]);

  const steps = useMemo(() => {
    if (!userType) return [];
    return getTourSteps(userType);
  }, [userType]);

  const active = useMemo(() => {
    if (!session) return false;
    if (!userType) return false;
    if (!steps.length) return false;
    if (overrideActive !== null) return overrideActive;
    if (suppressAuto) return false;
    return hasCompletedTour === false;
  }, [session, userType, steps.length, overrideActive, hasCompletedTour, suppressAuto]);

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
    // Mark as completed in session immediately to prevent restart on web
    setHasCompletedInSession(true);
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
    // Reset completion state when replaying
    setHasCompletedInSession(false);
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


