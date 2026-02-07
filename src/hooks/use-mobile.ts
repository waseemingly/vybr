import { useEffect, useState } from "react";
import { Dimensions, Platform } from "react-native";

// Helper function to detect if device is a mobile phone (not tablet/desktop)
const isMobilePhone = (): boolean => {
  if (typeof window === 'undefined' || Platform.OS !== 'web') {
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
const MOBILE_BREAKPOINT = 768; // Only for phones, not tablets

export const useIsMobile = () => {
  const [width, setWidth] = useState(Dimensions.get("window").width);
  const [isMobile, setIsMobile] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return isMobilePhone();
    }
    // For native platforms, use width-based detection
    return width < MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    const handleResize = () => {
      const newWidth = Dimensions.get("window").width;
      setWidth(newWidth);
      
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Use device detection for web
        setIsMobile(isMobilePhone());
      } else {
        // Use width-based for native
        setIsMobile(newWidth < MOBILE_BREAKPOINT);
      }
    };

    // Set up event listener for dimension changes
    const subscription = Dimensions.addEventListener("change", handleResize);

    // Initial check
    handleResize();

    // Clean up
    return () => subscription.remove();
  }, []);

  return isMobile;
};

// Hook to detect if we're on a mobile browser (web platform with small screen)
// Only returns true for actual mobile phones, not tablets or desktops
export const useIsMobileBrowser = () => {
  const [isMobileBrowser, setIsMobileBrowser] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setIsMobileBrowser(false);
      return;
    }

    // Check if we're on web and it's an actual mobile phone
    const checkMobileBrowser = () => {
      if (typeof window !== 'undefined') {
        // Use device detection instead of just screen width
        setIsMobileBrowser(isMobilePhone());
      }
    };

    // Initial check
    checkMobileBrowser();

    // Listen for resize events (though device type won't change, screen size might)
    window.addEventListener('resize', checkMobileBrowser);

    return () => {
      window.removeEventListener('resize', checkMobileBrowser);
    };
  }, []);

  return isMobileBrowser;
};
