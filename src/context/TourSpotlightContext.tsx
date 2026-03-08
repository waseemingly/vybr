import React, { createContext, useCallback, useContext, useState } from 'react';
import type { SpotlightRect } from '@/components/TourOverlay';

type TourSpotlightContextValue = {
  /** Current tour step id (set by UserGuideTour). Used by ChatsScreen/ChatsTabs to sync UI and report rects. */
  currentStepId: string | null;
  setCurrentStepId: (id: string | null) => void;
  /** Rect reported by a screen (e.g. ChatsTabs) for the current step. UserGuideTour uses this for the spotlight. */
  reportedSpotlightRect: SpotlightRect | null;
  reportSpotlightRect: (rect: SpotlightRect | null) => void;
};

const TourSpotlightContext = createContext<TourSpotlightContextValue | null>(null);

export function TourSpotlightProvider({ children }: { children: React.ReactNode }) {
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [reportedSpotlightRect, setReportedSpotlightRect] = useState<SpotlightRect | null>(null);

  const reportSpotlightRect = useCallback((rect: SpotlightRect | null) => {
    setReportedSpotlightRect(rect);
  }, []);

  const value: TourSpotlightContextValue = {
    currentStepId,
    setCurrentStepId,
    reportedSpotlightRect,
    reportSpotlightRect,
  };

  return (
    <TourSpotlightContext.Provider value={value}>
      {children}
    </TourSpotlightContext.Provider>
  );
}

export function useTourSpotlight(): TourSpotlightContextValue | null {
  return useContext(TourSpotlightContext);
}
