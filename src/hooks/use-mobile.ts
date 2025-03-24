import { useEffect, useState } from "react";
import { Dimensions } from "react-native";

export const useIsMobile = () => {
  const [width, setWidth] = useState(Dimensions.get("window").width);
  const [isMobile, setIsMobile] = useState(width < 768);

  useEffect(() => {
    const handleResize = () => {
      const newWidth = Dimensions.get("window").width;
      setWidth(newWidth);
      setIsMobile(newWidth < 768);
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
