export const formatEventDateTime = (isoString: string | null): { date: string; time: string } => {
    if (!isoString) return { date: "N/A", time: "N/A" };
    try {
      const d = new Date(isoString);
      // Use consistent formatting if needed, or keep platform default
      const datePart = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' });
      const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
      return { date: datePart, time: timePart };
    } catch (e) {
      console.warn(`[formatEventDateTime] Error parsing date: ${isoString}`, e);
      return { date: "Invalid Date", time: "" };
    }
};

/**
 * Safely converts a date value to ISO string format
 * Handles null, undefined, invalid dates, and various date formats
 */
export const safeToISOString = (date: Date | string | number | null | undefined): string => {
    if (date === null || date === undefined) {
        return new Date().toISOString(); // Return current date as fallback
    }
    
    try {
        const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
        
        // Check if the date is valid
        if (!dateObj || isNaN(dateObj.getTime())) {
            console.warn('[safeToISOString] Invalid date provided:', date);
            return new Date().toISOString(); // Return current date as fallback
        }
        
        return dateObj.toISOString();
    } catch (error) {
        console.warn('[safeToISOString] Error converting date to ISO string:', date, error);
        return new Date().toISOString(); // Return current date as fallback
    }
};

// Add other date/time utility functions here as needed 