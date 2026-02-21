import { RootStackParamList } from '../navigation/AppNavigator'; // Adjust path if needed
import { Platform } from 'react-native';

// Root-level route names that parseDeepLink can return. Defined here to avoid
// importing AppNavigator (which would create a circular dependency: AppNavigator
// -> useAuth -> navigationUtils -> AppNavigator), which causes "Maximum call stack
// size exceeded" on mobile web where the call stack is smaller.
export type DeepLinkRootRouteName =
  | 'Auth'
  | 'PaymentRequired'
  | 'MainApp'
  | 'OrganizerSignUpFlow'
  | 'MusicLoverSignUpFlow'
  | 'CreateGroupChatScreen'
  | 'GroupInfoScreen'
  | 'AddGroupMembersScreen'
  | 'GroupChatScreen'
  | 'IndividualChatScreen'
  | 'OtherUserProfileScreen';

// Helper function to detect if device is a mobile phone (not tablet/desktop)
const isMobilePhone = (): boolean => {
  if (typeof window === 'undefined' || Platform.OS !== 'web') {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  
  // Check for tablets - these should use desktop layout
  const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(userAgent) ||
    (window.navigator.maxTouchPoints && window.navigator.maxTouchPoints > 2 && /MacIntel/.test(window.navigator.platform));
  
  // If it's a tablet, return false (use desktop layout)
  if (isTablet) {
    return false;
  }

  // Check for actual mobile phones
  const isPhone = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  
  // Also check screen size for phones (smaller than typical tablet)
  // Phones are typically < 768px, tablets are usually >= 768px
  const isSmallScreen = window.innerWidth < 768;
  
  return isPhone && isSmallScreen;
};

/**
 * Parses a deep link URL string and returns a route name and params object
 * for React Navigation.
 * 
 * @param url The deep link URL to parse.
 * @returns An object with `routeName` and `params` or null if invalid.
 */
export const parseDeepLink = (url: string): { routeName: DeepLinkRootRouteName; params: any } | null => {
  if (!url) return null;

  try {
    // Example deep link formats:
    // vybr://chat/123-abc
    // https://vybr.app/event/456-def
    // /matches

    // Normalize URL by removing protocol and host if present
    const path = url.replace(/^(vybr:\/\/|https:\/\/vybr\.app)/, '');

    const parts = path.split('/').filter(Boolean);
    const route = parts[0];
    const rest = parts.slice(1);

    if (!route) {
        // Handle cases like a direct link to '/'
        return null;
    }

    switch (route) {
      // Auth & Landing
      case '':
      case 'home':
        // Root path - handled by auth state
        return null;
      
      case 'login':
        if (rest[0] === 'organizer') {
          return {
            routeName: 'Auth',
            params: { screen: 'OrganizerLogin' },
          };
        }
        return {
          routeName: 'Auth',
          params: { screen: 'MusicLoverLogin' },
        };
      
      case 'signup':
        if (rest[0] === 'organizer') {
          return {
            routeName: 'OrganizerSignUpFlow',
            params: {},
          };
        }
        return {
          routeName: 'MusicLoverSignUpFlow',
          params: {},
        };
      
      case 'premium':
        return {
          routeName: 'MainApp',
          params: { screen: 'PremiumSignupScreen' },
        };
      
      // Payment
      case 'payment':
        if (rest[0] === 'success') {
          return {
            routeName: 'MainApp',
            params: { screen: 'PaymentSuccessScreen' },
          };
        } else if (rest[0] === 'confirm') {
          return {
            routeName: 'MainApp',
            params: { screen: 'PaymentConfirmationScreen' },
          };
        } else if (rest[0] === 'required') {
          return {
            routeName: 'PaymentRequired',
            params: { screen: 'RequiredPaymentScreen' },
          };
        }
        break;
      
      // Main User Tabs
      case 'discover':
      case 'matches':
        return {
          routeName: 'MainApp',
          params: { screen: 'UserTabs', params: { screen: 'Matches' } },
        };
      
      case 'chats':
        return {
          routeName: 'MainApp',
          params: { screen: 'UserTabs', params: { screen: 'Chats' } },
        };
      
      case 'search':
        return {
          routeName: 'MainApp',
          params: { screen: 'UserTabs', params: { screen: 'Search' } },
        };
      
      case 'events':
        if (rest[0] === 'create') {
          return {
            routeName: 'MainApp',
            params: { screen: 'CreateEventScreen' },
          };
        } else if (rest[0] === 'attended') {
          return {
            routeName: 'MainApp',
            params: { screen: 'AttendedEventsScreen' },
          };
        } else if (rest[0] === 'upcoming') {
          return {
            routeName: 'MainApp',
            params: { screen: 'UpcomingEventsListScreen' },
          };
        } else if (rest[0] === 'past') {
          return {
            routeName: 'MainApp',
            params: { screen: 'PastEventsListScreen' },
          };
        } else if (rest[0]) {
          // Event detail or sub-routes
          if (rest[1] === 'edit') {
            return {
              routeName: 'MainApp',
              params: {
                screen: 'EditEvent',
                params: { eventId: rest[0] },
              },
            };
          } else if (rest[1] === 'bookings') {
            return {
              routeName: 'MainApp',
              params: {
                screen: 'ViewBookings',
                params: { eventId: rest[0] },
              },
            };
          } else if (rest[1] === 'share') {
            return {
              routeName: 'MainApp',
              params: {
                screen: 'ShareEventScreen',
                params: { eventId: rest[0] },
              },
            };
          } else {
            // Event detail
            return {
              routeName: 'MainApp',
              params: {
                screen: 'EventDetail',
                params: { eventId: rest[0] },
              },
            };
          }
        } else {
          return {
            routeName: 'MainApp',
            params: { screen: 'UserTabs', params: { screen: 'Events' } },
          };
        }
      
      case 'profile':
        if (rest[0] === 'edit') {
          return {
            routeName: 'MainApp',
            params: { screen: 'EditUserProfileScreen' },
          };
        } else if (rest[0] === 'music') {
          if (rest[1] === 'link') {
            return {
              routeName: 'MainApp',
              params: { screen: 'LinkMusicServicesScreen' },
            };
          }
          return {
            routeName: 'MainApp',
            params: { screen: 'UpdateMusicFavoritesScreen' },
          };
        } else {
          return {
            routeName: 'MainApp',
            params: { screen: 'UserTabs', params: { screen: 'Profile' } },
          };
        }
      
      // Settings
      case 'settings':
        if (rest[0] === 'subscription') {
          return {
            routeName: 'MainApp',
            params: { screen: 'UserManageSubscriptionScreen' },
          };
        } else if (rest[0] === 'plan') {
          return {
            routeName: 'MainApp',
            params: { screen: 'ManagePlan' },
          };
        } else if (rest[0] === 'muted') {
          return {
            routeName: 'MainApp',
            params: { screen: 'UserMutedListScreen' },
          };
        } else if (rest[0] === 'blocked') {
          return {
            routeName: 'MainApp',
            params: { screen: 'UserBlockedListScreen' },
          };
        } else if (rest[0] === 'billing') {
          return {
            routeName: 'MainApp',
            params: { screen: 'UserBillingHistoryScreen' },
          };
        } else {
          return {
            routeName: 'MainApp',
            params: { screen: 'UserSettingsScreen' },
          };
        }
      
      // Friends & Organizers
      case 'friends':
        return {
          routeName: 'MainApp',
          params: { screen: 'FriendsListScreen' },
        };
      
      case 'organizers':
        return {
          routeName: 'MainApp',
          params: { screen: 'OrganizerListScreen' },
        };
      
      // Upgrade
      case 'upgrade':
        return {
          routeName: 'MainApp',
          params: { screen: 'UpgradeScreen' },
        };
      
      // Bookings
      case 'bookings':
        if (rest[0] && rest[1] === 'confirm') {
          return {
            routeName: 'MainApp',
            params: {
              screen: 'BookingConfirmation',
              params: { bookingId: rest[0] },
            },
          };
        } else {
          return {
            routeName: 'MainApp',
            params: { screen: 'MyBookingsScreen' },
          };
        }
      
      // Organizer Routes
      case 'organizer':
        if (rest[0] === 'create') {
          return {
            routeName: 'MainApp',
            params: { screen: 'OrganizerTabs', params: { screen: 'Create' } },
          };
        } else if (rest[0] === 'profile') {
          if (rest[1] === 'edit') {
            return {
              routeName: 'MainApp',
              params: { screen: 'EditOrganizerProfileScreen' },
            };
          } else {
            return {
              routeName: 'MainApp',
              params: { screen: 'OrganizerTabs', params: { screen: 'OrganizerProfile' } },
            };
          }
        } else if (rest[0] === 'settings') {
          if (rest[1] === 'plan') {
            return {
              routeName: 'MainApp',
              params: { screen: 'ManagePlanScreen' },
            };
          } else if (rest[1] === 'billing') {
            return {
              routeName: 'MainApp',
              params: { screen: 'OrgBillingHistoryScreen' },
            };
          } else {
            return {
              routeName: 'MainApp',
              params: { screen: 'OrganizerSettingsScreen' },
            };
          }
        } else if (rest[0] === 'availability') {
          return {
            routeName: 'MainApp',
            params: { screen: 'SetAvailabilityScreen' },
          };
        } else if (rest[0] === 'analytics') {
          return {
            routeName: 'MainApp',
            params: { screen: 'OverallAnalyticsScreen' },
          };
        } else if (rest[0] === 'followers' || rest[0] === 'attendees') {
          return {
            routeName: 'MainApp',
            params: { screen: 'UserListScreen' },
          };
        } else if (rest[0] === 'reservations') {
          return {
            routeName: 'MainApp',
            params: { screen: 'OrganizerReservationsScreen' },
          };
        } else if (rest[0] && !rest[1]) {
          // View organizer profile by ID (only if no sub-route)
          return {
            routeName: 'MainApp',
            params: {
              screen: 'ViewOrganizerProfileScreen',
              params: { organizerUserId: rest[0] },
            },
          };
        } else {
          // Default organizer dashboard
          return {
            routeName: 'MainApp',
            params: { screen: 'OrganizerTabs', params: { screen: 'Posts' } },
          };
        }
      
      // Chat Routes
      case 'chat':
        if (rest[0] === 'group') {
          if (rest[1] === 'create') {
            return {
              routeName: 'CreateGroupChatScreen',
              params: {},
            };
          } else if (rest[1]) {
            if (rest[2] === 'info') {
              return {
                routeName: 'GroupInfoScreen',
                params: { groupId: rest[1] },
              };
            } else if (rest[2] === 'add') {
              return {
                routeName: 'AddGroupMembersScreen',
                params: { groupId: rest[1] },
              };
            } else {
              return {
                routeName: 'GroupChatScreen',
                params: { groupId: rest[1] },
              };
            }
          }
        } else if (rest[0]) {
          // Individual chat
          // Check if we're on desktop web (not mobile phone browser)
          // Tablets (iPad Pro, etc.) and desktops use desktop layout
          const isDesktopWeb = Platform.OS === 'web' && typeof window !== 'undefined' && !isMobilePhone();
          
          if (isDesktopWeb) {
            // Desktop web: navigate to Chats screen with selected chat (side-by-side)
            return {
              routeName: 'MainApp',
              params: {
                screen: 'UserTabs',
                params: {
                  screen: 'Chats',
                  params: { selectedChatId: rest[0], chatType: 'individual' },
                },
              },
            };
          } else {
            // Mobile browsers and native mobile: navigate directly to chat screen (full screen)
            return {
              routeName: 'IndividualChatScreen',
              params: { matchUserId: rest[0] },
            };
          }
        }
        break;
      
      // User Profile by ID
      case 'user':
        if (rest[0]) {
          return {
            routeName: 'OtherUserProfileScreen',
            params: { userId: rest[0] },
          };
        }
        break;
      
      // Legacy support for old paths
      case 'match':
      case 'matches':
        return {
          routeName: 'MainApp',
          params: { screen: 'UserTabs', params: { screen: 'Matches' } },
        };
      
      case 'event':
        if (rest[0]) {
          return {
            routeName: 'MainApp',
            params: {
              screen: 'EventDetail',
              params: { eventId: rest[0] },
            },
          };
        }
        break;
      
      // 404
      case '404':
        return {
          routeName: 'MainApp',
          params: { screen: 'NotFoundMain' },
        };
      
      default:
        if (isRouteInParamList(route)) {
          return { routeName: route as DeepLinkRootRouteName, params: rest[0] ? { id: rest[0] } : {} };
        }
        console.warn(`[parseDeepLink] Unknown route: ${route}`);
        return null;
    }
    return null;

  } catch (error) {
    console.error('[parseDeepLink] Error parsing URL:', error);
    return null;
  }
};


// A helper to check if a route name is valid for the default deep-link case.
function isRouteInParamList(routeName: string): routeName is DeepLinkRootRouteName {
    const validRoutes: DeepLinkRootRouteName[] = [
        "Auth",
        "PaymentRequired",
        "MainApp",
        "IndividualChatScreen",
        "GroupChatScreen",
        "OtherUserProfileScreen",
        "CreateGroupChatScreen",
        "GroupInfoScreen",
        "AddGroupMembersScreen",
        "OrganizerSignUpFlow",
        "MusicLoverSignUpFlow",
    ];
    return validRoutes.includes(routeName as DeepLinkRootRouteName);
} 