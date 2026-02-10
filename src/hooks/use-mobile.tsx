import * as React from "react"

// Helper function to detect if device is a mobile phone (not tablet/desktop)
const isMobilePhone = (): boolean => {
  if (typeof window === 'undefined') {
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
  // Phones are typically < 768px, tablets are usually >= 768px
  const isSmallScreen = window.innerWidth < 768;
  
  return isPhone && isSmallScreen;
};

// Breakpoint for mobile/tablet vs desktop
// Only actual mobile phones use mobile layout
// Tablets (iPad, etc.) and desktops always use desktop layout
const MOBILE_BREAKPOINT = 768 // Only for phones, not tablets

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // Only run on web platform
    if (typeof window === 'undefined') {
      setIsMobile(false);
      return;
    }

    // Use device detection instead of just screen width
    const checkMobile = () => {
      setIsMobile(isMobilePhone());
    };

    // Initial check
    checkMobile();

    // Listen for resize (though device type won't change)
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [])

  return !!isMobile
}
