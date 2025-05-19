// // Import EventTarget polyfill
// import './src/utils/EventTargetPolyfill';

// // Set up EventTarget for Hermes
// if (typeof global.EventTarget === 'undefined') {
//   const { EventTarget, Event } = require('event-target-shim');
//   global.EventTarget = EventTarget;
//   global.Event = Event;
// }

// import React from "react";
// import { StatusBar } from "expo-status-bar";
// import { SafeAreaProvider } from "react-native-safe-area-context";
// // Import NavigationContainer and the ref creator
// import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
// import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// import { OrganizerModeProvider } from "./src/hooks/useOrganizerMode"; // Adjust path if needed
// import { AuthProvider } from "./src/hooks/useAuth"; // Adjust path if needed
// import AppNavigator from "./src/navigation/AppNavigator"; // Adjust path if needed

// const queryClient = new QueryClient();

// // Define your Root Stack Param List (optional but recommended for type safety)
// // Replace 'any' with your actual screen names and params if defined
// // export type RootStackParamList = {
// //   Auth: undefined;
// //   MainApp: undefined; // Or specific params if needed
// //   MusicLoverSignUpFlow: undefined;
// //   OrganizerSignUpFlow: undefined;
// //   NotFoundGlobal: undefined;
// //   // ... other root stack screens
// // };

// // Create the navigation container ref outside the component
// // Pass the RootStackParamList if defined, otherwise use <any>
// export const navigationRef = createNavigationContainerRef<any>();

// export default function App() {
//   return (
//     // QueryClientProvider should wrap everything that uses React Query
//     <QueryClientProvider client={queryClient}>
//       {/* OrganizerModeProvider wraps AuthProvider */}
//       <OrganizerModeProvider>
//         {/* AuthProvider wraps SafeAreaProvider and Navigation */}
//         {/* Pass navigationRef to AuthProvider */}
//         <AuthProvider navigationRef={navigationRef}>
//           {/* Single SafeAreaProvider wrapping Navigation */}
//           <SafeAreaProvider>
//             {/* NavigationContainer uses the ref */}
//             <NavigationContainer ref={navigationRef}>
//               <AppNavigator />
//               {/* StatusBar can be inside or outside Nav Container */}
//               <StatusBar style="auto" />
//             </NavigationContainer>
//           </SafeAreaProvider>
//         </AuthProvider>
//       </OrganizerModeProvider>
//     </QueryClientProvider>
//   );
// }


import './src/utils/EventTargetPolyfill';

// Set up EventTarget for Hermes
if (typeof global.EventTarget === 'undefined') {
  const { EventTarget, Event } = require('event-target-shim');
  global.EventTarget = EventTarget;
  global.Event = Event;
}

import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// --- Import StripeProvider ---
import { StripeProvider } from '@stripe/stripe-react-native'; // <<<<<< IMPORT THIS

import { OrganizerModeProvider } from "./src/hooks/useOrganizerMode";
import { AuthProvider } from "./src/hooks/useAuth";
import AppNavigator from "./src/navigation/AppNavigator";

const queryClient = new QueryClient();
export const navigationRef = createNavigationContainerRef<any>(); // Or your RootStackParamList

// --- DEFINE YOUR STRIPE PUBLISHABLE KEY ---
// IMPORTANT: Replace with your ACTUAL Stripe Publishable Key
// It's best to load this from an environment variable (e.g., using react-native-dotenv)
const STRIPE_PUBLISHABLE_KEY = "pk_test_51RDGZpDHMm6OC3yQwI460w1bESyWDQoSdNLBU9TOhciyc7NlbJ5upgCTJsP6OAuYt8cUeywcbkwQGCBI7VDCMNuz00qld2OSdN"; // <<<<<< REPLACE THIS

if (!STRIPE_PUBLISHABLE_KEY) {
  console.error("!!!! CRITICAL ERROR: Stripe Publishable Key is not set. Payments will fail. !!!!");
  // In a real app, you might want to show an error UI or prevent the app from loading
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* --- StripeProvider should wrap everything that might use Stripe --- */}
      {/* It can go inside or outside AuthProvider depending on your needs, */}
      {/* but generally, if auth state might affect payment flows, having AuthProvider */}
      {/* inside or as a sibling that Stripe-dependent components can access is fine. */}
      {/* Placing it here, outside AuthProvider, is a common and safe choice. */}
      <StripeProvider
        publishableKey={STRIPE_PUBLISHABLE_KEY}
        // merchantIdentifier="merchant.com.your.app.id" // Optional: for Apple Pay
        // urlScheme="yourappcustomscheme" // Optional: for URL scheme based payment methods (e.g. some EU methods)
      >
        <OrganizerModeProvider>
          <AuthProvider navigationRef={navigationRef}>
            <SafeAreaProvider>
              <NavigationContainer ref={navigationRef}>
                <AppNavigator />
                <StatusBar style="auto" />
              </NavigationContainer>
            </SafeAreaProvider>
          </AuthProvider>
        </OrganizerModeProvider>
      </StripeProvider>
    </QueryClientProvider>
  );
}