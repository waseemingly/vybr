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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Text } from 'react-native';

// IMPORT from custom wrapper based on platform
import CustomStripeProviderWeb from './src/components/StripeProvider.web';
import CustomStripeProviderNative from './src/components/StripeProvider.native';

const CustomStripeProvider = Platform.OS === 'web' 
  ? CustomStripeProviderWeb 
  : CustomStripeProviderNative;

import { OrganizerModeProvider } from "./src/hooks/useOrganizerMode";
import { AuthProvider } from "./src/hooks/useAuth";
import AppNavigator from "./src/navigation/AppNavigator";
import { RealtimeProvider } from '@/context/RealtimeContext';
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
  console.error("!!!! CRITICAL ERROR: Stripe Publishable Key is not set. Payments will fail. !!!!");
  // In a real app, you might want to show an error UI or prevent the app from loading
}

// Configure deep linking for all platforms
const linking = {
  prefixes: [
    Linking.createURL('/'),
    'vybr://',
    'https://vybr.app',
    'https://fqfgueshwuhpckszyrsj.supabase.co/auth/v1/callback'
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

  React.useEffect(() => {
    const restoreState = async () => {
      try {
        // Only restore state on web platform
        if (Platform.OS === 'web') {
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
      console.log('[App] 🔗 Deep link received:', url);
      
      // Parse URL to extract parameters
      const parsedUrl = new URL(url);
      const params = new URLSearchParams(parsedUrl.search);
      
      console.log('[App] 🔍 URL breakdown:', {
        origin: parsedUrl.origin,
        pathname: parsedUrl.pathname,
        search: parsedUrl.search,
        hash: parsedUrl.hash,
        params: Object.fromEntries(params)
      });
      
      // Handle OAuth callback URLs
      if (url.includes('auth/callback') || url.includes('error=')) {
        console.log('[App] ✅ OAuth callback detected:', url);
        
        // Check for specific OAuth parameters
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const error = params.get('error');
        const errorDescription = params.get('error_description');
        
        console.log('[App] 📊 OAuth parameters:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          error: error,
          errorDescription: errorDescription,
          type: params.get('type'),
          provider: params.get('provider')
        });
        
        if (error) {
          console.error('[App] ❌ OAuth error:', error, errorDescription);
        } else if (accessToken) {
          console.log('[App] ✅ OAuth success - tokens received');
        }
        
        // The Supabase auth handler will process this automatically
        // No additional navigation needed - let the AuthProvider handle it
      } else if (url.includes('MusicLoverSignUpFlow')) {
        console.log('[App] 📱 Music lover signup flow deep link detected');
      } else {
        console.log('[App] 🔍 Other deep link:', url);
      }
    };

    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    // Handle the initial URL if the app was opened from a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('[App] 🚀 Initial URL detected:', url);
        handleDeepLink(url);
      } else {
        console.log('[App] 🚀 No initial URL detected');
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
        <CustomStripeProvider
          publishableKey={STRIPE_PUBLISHABLE_KEY}
        >
          <OrganizerModeProvider>
            <AuthProvider navigationRef={navigationRef as React.RefObject<NavigationContainerRef<any>>}>
              <RealtimeProvider>
                <SafeAreaProvider>
                  <NavigationContainer 
                    ref={navigationRef}
                    linking={linking}
                    initialState={initialState}
                    onStateChange={(state) => {
                      // Save navigation state to localStorage on web
                      if (Platform.OS === 'web') {
                        localStorage.setItem('NAVIGATION_STATE_V1', JSON.stringify(state));
                      }
                    }}
                  >
                    <AppNavigator />
                    <StatusBar style="auto" />
                  </NavigationContainer>
                  <Toaster />
                </SafeAreaProvider>
              </RealtimeProvider>
            </AuthProvider>
          </OrganizerModeProvider>
        </CustomStripeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}