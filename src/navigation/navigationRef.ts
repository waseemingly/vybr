import { createNavigationContainerRef } from "@react-navigation/native";

// Export navigation ref to avoid circular dependencies
// This ref can be used throughout the app without importing App.tsx
export const navigationRef = createNavigationContainerRef<any>();

