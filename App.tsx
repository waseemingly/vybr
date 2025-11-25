import '@azure/core-asynciterator-polyfill';
import './src/utils/EventTargetPolyfill';
import * as Linking from 'expo-linking';


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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Text } from 'react-native';

// Platform detection that works for both web and mobile
const getPlatform = () => {
  if (typeof window !== 'undefined') {
    return 'web';
  }
  return 'mobile';
};

const platform = getPlatform();

// IMPORT from custom wrapper based on platform
import CustomStripeProviderWeb from './src/components/StripeProvider.web';
import CustomStripeProviderNative from './src/components/StripeProvider.native';

const CustomStripeProvider = platform === 'web' 
  ? CustomStripeProviderWeb 
  : CustomStripeProviderNative;

import { OrganizerModeProvider } from "./src/hooks/useOrganizerMode";
import { AuthProvider } from "./src/hooks/useAuth";
import AppNavigator from "./src/navigation/AppNavigator";
import { RealtimeProvider } from '@/context/RealtimeContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { PowerSyncProvider } from '@/context/PowerSyncContext';
import WebNotificationContainer from '@/components/WebNotificationContainer';
import { Toaster } from '@/components/ui/sonner';


// React Navigation
import type { NavigationContainerRef } from '@react-navigation/native';

const queryClient = new QueryClient();
export const navigationRef = createNavigationContainerRef<any>(); // Or your RootStackParamList

// --- DEFINE YOUR STRIPE PUBLISHABLE KEY ---
// IMPORTANT: Replace with your ACTUAL Stripe Publishable Key
// It's best to load this from an environment variable (e.g., using react-native-dotenv)
const STRIPE_PUBLISHABLE_KEY = "pk_test_51RDGZpDHMm6OC3yQwI460w1bESyWDQoSdNLBU9TOhciyc7NlbJ5upgCTJsP6OAuYt8cUeywcbkwQGCBI7VDCMNuz00qld2OSdN"; // <<<<<< REPLACE THIS

if (!STRIPE_PUBLISHABLE_KEY) {
  // In a real app, you might want to show an error UI or prevent the app from loading
}

// Configure deep linking for all platforms
const linking = {
  prefixes: [
    Linking.createURL('/'),
    'vybr://',
    'https://vybr.app',
    'https://fqfgueshwuhpckszyrsj.supabase.co/auth/v1/callback',
    // Add ngrok URL for Apple Music HTTPS requirement
    'https://unmodern-sleeveless-ahmad.ngrok-free.dev'
  ],
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
      // Handle OAuth callbacks
      AuthCallback: 'auth/callback',
      SpotifyCallback: 'spotify-auth-callback',
    },
  },
};

export default function App() {
  const [isReady, setIsReady] = React.useState(false);
  const [initialState, setInitialState] = React.useState();

  // Force document title to stay as "Vybr Web"
  React.useEffect(() => {
    if (platform === 'web' && typeof document !== 'undefined') {
      // Set initial title
      document.title = 'Vybr Web';
      
      // Watch for title changes and force it back to "Vybr Web"
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && document.title !== 'Vybr Web') {
            document.title = 'Vybr Web';
          }
        });
      });
      
      // Observe the document head for title changes
      observer.observe(document.head, {
        childList: true,
        subtree: true
      });
      
      // Also set up an interval to check and correct the title
      const interval = setInterval(() => {
        if (document.title !== 'Vybr Web') {
          document.title = 'Vybr Web';
        }
      }, 100);
      
      return () => {
        observer.disconnect();
        clearInterval(interval);
      };
    }
  }, []);

  React.useEffect(() => {
    const restoreState = async () => {
      try {
        // Only restore state on web platform
        if (platform === 'web' && typeof localStorage !== 'undefined') {
          const savedStateString = localStorage.getItem('NAVIGATION_STATE_V1');
          const state = savedStateString ? JSON.parse(savedStateString) : undefined;

          if (state !== undefined) {
            setInitialState(state);
          }
        }
      } finally {
        setIsReady(true);
      }
    };

    if (!isReady) {
      restoreState();
    }
  }, [isReady]);

  // Handle OAuth deep link callbacks
  React.useEffect(() => {
    const handleDeepLink = (url: string) => {
      // Parse URL to extract parameters
      new URL(url);

      // The Supabase auth handler will process this automatically
      // No additional navigation needed - let the AuthProvider handle it
    };

    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    // Handle the initial URL if the app was opened from a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => subscription?.remove();
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <PowerSyncProvider>
          <CustomStripeProvider
            publishableKey={STRIPE_PUBLISHABLE_KEY}
          >
            <OrganizerModeProvider>
              <AuthProvider navigationRef={navigationRef as React.RefObject<NavigationContainerRef<any>>}>
                <RealtimeProvider>
                  <NotificationProvider>
                    <SafeAreaProvider>
                      <NavigationContainer 
                        ref={navigationRef}
                        linking={linking}
                        initialState={initialState}
                        onStateChange={(state) => {
                          // Save navigation state to localStorage on web
                          if (platform === 'web' && typeof localStorage !== 'undefined') {
                            localStorage.setItem('NAVIGATION_STATE_V1', JSON.stringify(state));
                          }
                        }}
                      >
                        <AppNavigator />
                        <StatusBar style="auto" />
                        <WebNotificationContainer />
                      </NavigationContainer>
                      <Toaster />
                      
                    </SafeAreaProvider>
                  </NotificationProvider>
                </RealtimeProvider>
              </AuthProvider>
            </OrganizerModeProvider>
          </CustomStripeProvider>
        </PowerSyncProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}