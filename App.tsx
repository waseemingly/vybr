import '@azure/core-asynciterator-polyfill';
import './src/utils/EventTargetPolyfill';
import 'react-native-get-random-values'; // required for E2E crypto (e.g. @noble/ciphers) on React Native
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
import { Platform } from 'react-native';
import { safeLocalStorage } from './src/utils/safeStorage';

// Conditionally import and use SplashScreen only on native platforms
type SplashScreenType = {
  preventAutoHideAsync: () => Promise<void>;
  hideAsync: () => Promise<void>;
} | null;

let SplashScreen: SplashScreenType = null;
if (Platform.OS !== 'web') {
  try {
    SplashScreen = require('expo-splash-screen') as SplashScreenType;
    // Keep the native splash screen visible until we decide the app is ready.
    // This prevents a blank/white flash between the iOS launch screen and first React render.
    if (SplashScreen) {
      SplashScreen.preventAutoHideAsync().catch(() => {
        // no-op: it's fine if it's already been called
      });
    }
  } catch (e) {
    console.warn('expo-splash-screen not available:', e);
  }
}

// Platform detection: React Native defines `window`, so rely on Platform.OS
const platform = Platform.OS === 'web' ? 'web' : 'mobile';

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
import { navigationRef } from './src/navigation/navigationRef';

const queryClient = new QueryClient();

// --- Stripe Publishable Key ---
// Prefer build-time configuration; fall back to the existing test key for local/dev.
const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  process.env.STRIPE_PUBLISHABLE_KEY ||
  "pk_test_51RDGZpDHMm6OC3yQwI460w1bESyWDQoSdNLBU9TOhciyc7NlbJ5upgCTJsP6OAuYt8cUeywcbkwQGCBI7VDCMNuz00qld2OSdN";

if (!STRIPE_PUBLISHABLE_KEY) {
  console.error("[App] Missing Stripe publishable key. Set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY for production builds.");
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
      // Auth Stack
      Auth: {
        screens: {
          Landing: '/',
          MusicLoverLogin: 'login',
          OrganizerLogin: 'login/organizer',
        },
      },
      // Payment Required Stack
      PaymentRequired: {
        screens: {
          RequiredPaymentScreen: 'payment/required',
        },
      },
      // Main App Stack
      MainApp: {
        screens: {
          // User Tabs
          UserTabs: {
            screens: {
              Matches: 'discover',
              Chats: 'chats',
              Search: 'search',
              Events: 'events',
              Profile: 'profile',
            },
          },
          // Organizer Tabs
          OrganizerTabs: {
            screens: {
              Posts: 'organizer',
              Create: 'organizer/create',
              OrganizerProfile: 'organizer/profile',
            },
          },
          // User Settings & Profile Screens
          UserSettingsScreen: 'settings',
          EditUserProfileScreen: 'profile/edit',
          UserManageSubscriptionScreen: 'settings/subscription',
          ManagePlan: 'settings/plan',
          UserMutedListScreen: 'settings/muted',
          UserBlockedListScreen: 'settings/blocked',
          FriendsListScreen: 'friends',
          OrganizerListScreen: 'organizers',
          UpgradeScreen: 'upgrade',
          AttendedEventsScreen: 'events/attended',
          UserBillingHistoryScreen: 'settings/billing',
          UpdateMusicFavoritesScreen: 'profile/music',
          LinkMusicServicesScreen: 'profile/music/link',
          MyBookingsScreen: 'bookings',
          PremiumSignupScreen: 'premium',
          PaymentConfirmationScreen: 'payment/confirm',
          PaymentSuccessScreen: 'payment/success',
          // Organizer Settings & Profile Screens
          OrganizerSettingsScreen: 'organizer/settings',
          EditOrganizerProfileScreen: 'organizer/profile/edit',
          ManagePlanScreen: 'organizer/settings/plan',
          OrgBillingHistoryScreen: 'organizer/settings/billing',
          SetAvailabilityScreen: 'organizer/availability',
          OverallAnalyticsScreen: 'organizer/analytics',
          UserListScreen: 'organizer/followers',
          OrganizerReservationsScreen: 'organizer/reservations',
          // Event Screens
          CreateEventScreen: 'events/create',
          EventDetail: {
            path: 'events/:eventId',
            parse: {
              eventId: (eventId: string) => eventId,
            },
          },
          EditEvent: {
            path: 'events/:eventId/edit',
            parse: {
              eventId: (eventId: string) => eventId,
            },
          },
          ViewBookings: {
            path: 'events/:eventId/bookings',
            parse: {
              eventId: (eventId: string) => eventId,
            },
          },
          ShareEventScreen: {
            path: 'events/:eventId/share',
            parse: {
              eventId: (eventId: string) => eventId,
            },
          },
          UpcomingEventsListScreen: 'events/upcoming',
          PastEventsListScreen: 'events/past',
          BookingConfirmation: {
            path: 'bookings/:bookingId/confirm',
            parse: {
              bookingId: (bookingId: string) => bookingId,
            },
          },
          // Profile Screens
          ViewOrganizerProfileScreen: {
            path: 'organizer/:organizerUserId',
            parse: {
              organizerUserId: (organizerUserId: string) => organizerUserId,
            },
          },
          // Not Found
          NotFoundMain: '404',
        },
      },
      // Root Stack Screens (outside MainApp)
      IndividualChatScreen: {
        path: 'chat/:userId',
        parse: {
          matchUserId: (userId: string) => userId,
        },
      },
      OtherUserProfileScreen: {
        path: 'user/:userId',
        parse: {
          userId: (userId: string) => userId,
        },
      },
      CreateGroupChatScreen: 'chat/group/create',
      GroupChatScreen: {
        path: 'chat/group/:groupId',
        parse: {
          groupId: (groupId: string) => groupId,
        },
      },
      GroupInfoScreen: {
        path: 'chat/group/:groupId/info',
        parse: {
          groupId: (groupId: string) => groupId,
        },
      },
      AddGroupMembersScreen: {
        path: 'chat/group/:groupId/add',
        parse: {
          groupId: (groupId: string) => groupId,
        },
      },
      MusicLoverSignUpFlow: 'signup',
      OrganizerSignUpFlow: 'signup/organizer',
      // Handle OAuth callbacks
      AuthCallback: 'auth/callback',
      SpotifyCallback: 'spotify-auth-callback',
    },
  },
};

// Navigation state persistence keys
const NAVIGATION_STATE_KEY = 'NAVIGATION_STATE_V2'; // Bumped version to avoid stale state issues
const NAVIGATION_USER_ID_KEY = 'NAVIGATION_USER_ID';

export default function App() {
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    if (platform !== 'web' && isReady && SplashScreen) {
      SplashScreen.hideAsync().catch(() => {
        // no-op
      });
    }
  }, [isReady]);

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
        console.log('[App] Starting initialization...');
        // For web platform, navigation state restoration is handled in AppNavigator
        // after auth loads to ensure we have the correct user context.
        // We only set isReady here to allow the app to render.
        // 
        // Note: We don't use initialState on NavigationContainer for web because
        // the auth state needs to load first to validate the user before restoring.
        // AppNavigator handles the actual state restoration after auth loads.
        
        if (platform === 'web') {
          // Clean up old V1 navigation state if it exists
          // Use safe localStorage wrapper to handle iOS Safari private mode
          const oldState = safeLocalStorage.getItem('NAVIGATION_STATE_V1');
          if (oldState) {
            console.log('[App] Cleaning up old NAVIGATION_STATE_V1');
            safeLocalStorage.removeItem('NAVIGATION_STATE_V1');
          }
        }
        console.log('[App] Initialization complete, setting isReady to true');
      } catch (error) {
        console.error('[App] Error during initialization:', error);
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
    // Show a loading indicator instead of blank screen
    if (platform === 'web') {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          width: '100vw',
          backgroundColor: '#000',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              border: '4px solid rgba(255,255,255,0.3)',
              borderTop: '4px solid #fff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }}></div>
            <p>Loading Vybr...</p>
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      );
    }
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <PowerSyncProvider>
          <CustomStripeProvider
            publishableKey={STRIPE_PUBLISHABLE_KEY}
            urlScheme="vybr"
          >
            <OrganizerModeProvider>
              <AuthProvider navigationRef={navigationRef as React.RefObject<NavigationContainerRef<any>>}>
                <RealtimeProvider>
                  <NotificationProvider>
                    <SafeAreaProvider>
                      <NavigationContainer 
                        ref={navigationRef}
                        linking={linking}
                        onStateChange={(state) => {
                          // Save navigation state to storage
                          if (state) {
                            try {
                              // Get current user ID
                              const currentUserId = (window as any)?.__VYBR_CURRENT_USER_ID__;
                              
                              if (platform === 'web') {
                                // Use safe localStorage wrapper to handle iOS Safari private mode
                                safeLocalStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state));
                                if (currentUserId) {
                                  safeLocalStorage.setItem(NAVIGATION_USER_ID_KEY, currentUserId);
                                }
                              } else {
                                // For mobile, use AsyncStorage
                                import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
                                  AsyncStorage.setItem('@vybr_navigation_state', JSON.stringify(state));
                                  if (currentUserId) {
                                    AsyncStorage.setItem('@vybr_navigation_user_id', currentUserId);
                                  }
                                });
                              }
                            } catch (error) {
                              console.warn('[App] Failed to save navigation state:', error);
                            }
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