import * as React from "react";
import { Dimensions, Platform } from "react-native";

// Helper function to detect if device is a mobile phone (not tablet/desktop) — web only
const isMobilePhone = (): boolean => {
  if (typeof window === 'undefined' || !window.navigator) {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();

  // Check for tablets - these should use desktop layout
  const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(userAgent) ||
    (window.navigator.maxTouchPoints && window.navigator.maxTouchPoints > 2 && /MacIntel/.test(window.navigator.platform));

  // If it's a tablet, return false (use desktop layout)
  if (isTablet) {
    return false;
  }

  // Check for actual mobile phones
  const isPhone = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

  // Also check screen size for phones (smaller than typical tablet)
  const isSmallScreen = typeof window.innerWidth === 'number' && window.innerWidth < 768;

  return isPhone && isSmallScreen;
};

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    // On native (iOS/Android), use Dimensions only — no window
    if (Platform.OS !== 'web') {
      const { width } = Dimensions.get('window');
      setIsMobile(width < MOBILE_BREAKPOINT);
      const sub = Dimensions.addEventListener('change', ({ window: w }) => {
        setIsMobile(w.width < MOBILE_BREAKPOINT);
      });
      return () => sub.remove();
    }

    // Web only: use window and resize listener
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      setIsMobile(false);
      return;
    }

    const checkMobile = () => setIsMobile(isMobilePhone());
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return !!isMobile;
}
