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

// Add other date/time utility functions here as needed 