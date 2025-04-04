import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
// Import NavigationContainer and the ref creator
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { OrganizerModeProvider } from "./src/hooks/useOrganizerMode"; // Adjust path if needed
import { AuthProvider } from "./src/hooks/useAuth"; // Adjust path if needed
import AppNavigator from "./src/navigation/AppNavigator"; // Adjust path if needed

const queryClient = new QueryClient();

// Define your Root Stack Param List (optional but recommended for type safety)
// Replace 'any' with your actual screen names and params if defined
// export type RootStackParamList = {
//   Auth: undefined;
//   MainApp: undefined; // Or specific params if needed
//   MusicLoverSignUpFlow: undefined;
//   OrganizerSignUpFlow: undefined;
//   NotFoundGlobal: undefined;
//   // ... other root stack screens
// };

// Create the navigation container ref outside the component
// Pass the RootStackParamList if defined, otherwise use <any>
export const navigationRef = createNavigationContainerRef<any>();

export default function App() {
  return (
    // QueryClientProvider should wrap everything that uses React Query
    <QueryClientProvider client={queryClient}>
      {/* OrganizerModeProvider wraps AuthProvider */}
      <OrganizerModeProvider>
        {/* AuthProvider wraps SafeAreaProvider and Navigation */}
        {/* Pass navigationRef to AuthProvider */}
        <AuthProvider navigationRef={navigationRef}>
          {/* Single SafeAreaProvider wrapping Navigation */}
          <SafeAreaProvider>
            {/* NavigationContainer uses the ref */}
            <NavigationContainer ref={navigationRef}>
              <AppNavigator />
              {/* StatusBar can be inside or outside Nav Container */}
              <StatusBar style="auto" />
            </NavigationContainer>
          </SafeAreaProvider>
        </AuthProvider>
      </OrganizerModeProvider>
    </QueryClientProvider>
  );
}