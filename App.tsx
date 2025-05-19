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

// IMPORT from custom wrapper
import { StripeProvider } from './src/lib/stripe'; 

import { OrganizerModeProvider } from "./src/hooks/useOrganizerMode";
import { AuthProvider } from "./src/hooks/useAuth";
import AppNavigator from "./src/navigation/AppNavigator";

// React Navigation
import type { NavigationContainerRef } from '@react-navigation/native';

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
      <StripeProvider 
        publishableKey={STRIPE_PUBLISHABLE_KEY} // This will be ignored by the web mock due to its type
        // merchantIdentifier="merchant.com.your.app.id"
        // urlScheme="yourappcustomscheme"
      >
        <OrganizerModeProvider>
          <AuthProvider navigationRef={navigationRef as React.RefObject<NavigationContainerRef<any>>}>
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