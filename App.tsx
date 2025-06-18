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
import { Platform } from 'react-native';
//import { Linking } from 'react-native';
import * as Linking from 'expo-linking';
// IMPORT from custom wrapper
import CustomStripeProvider from './src/components/StripeProvider';

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

// Configure deep linking for web
const linking = {
  prefixes: [Linking.createURL('/')],
  config: {
    screens: {
      MainApp: {
        screens: {
          PaymentConfirmationScreen: 'payment-confirmation',
          PremiumSignupScreen: 'premium-signup',
          PaymentSuccessScreen: 'payment-success',
          OrganizerTabs: {
            screens: {
              Posts: 'organizer/dashboard',
            }
          }
        },
      },
    },
  },
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CustomStripeProvider
        publishableKey={STRIPE_PUBLISHABLE_KEY}
      >
        <OrganizerModeProvider>
          <AuthProvider navigationRef={navigationRef as React.RefObject<NavigationContainerRef<any>>}>
            <SafeAreaProvider>
              <NavigationContainer 
                ref={navigationRef}
                linking={Platform.OS === 'web' ? linking : undefined}
              >
                <AppNavigator />
                <StatusBar style="auto" />
              </NavigationContainer>
            </SafeAreaProvider>
          </AuthProvider>
        </OrganizerModeProvider>
      </CustomStripeProvider>
    </QueryClientProvider>
  );
}