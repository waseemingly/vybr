import { RootStackParamList } from '../navigation/AppNavigator'; // Adjust path if needed

/**
 * Parses a deep link URL string and returns a route name and params object
 * for React Navigation.
 * 
 * @param url The deep link URL to parse.
 * @returns An object with `routeName` and `params` or null if invalid.
 */
export const parseDeepLink = (url: string): { routeName: keyof RootStackParamList; params: any } | null => {
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
      case 'chat':
      case 'individual-chat':
        if (rest[0]) {
          return {
            routeName: 'IndividualChatScreen',
            params: { matchUserId: rest[0] },
          };
        }
        break;
      
      case 'group-chat':
        if (rest[0]) {
            return {
                routeName: 'GroupChatScreen',
                params: { groupId: rest[0] },
            };
        }
        break;

      case 'bookings':
        if (rest[0]) {
          return {
            routeName: 'MainApp',
            params: {
              screen: 'ViewBookings',
              params: { eventId: rest[0] },
            },
          };
        }
        break;

      case 'event':
      case 'events':
        if (rest[0]) {
            // This could navigate to a specific event detail screen
            // Assuming you have an 'EventDetail' screen that takes an eventId
            return {
                routeName: 'MainApp', 
                params: { 
                    screen: 'EventDetail', // Navigate to the screen within MainAppStack
                    params: { eventId: rest[0] } 
                }
            };
        } else {
            // Navigates to the main Events tab
            return {
                routeName: 'MainApp',
                params: { screen: 'UserTabs', params: { screen: 'Events' } },
            };
        }
        break;
        
      case 'match':
      case 'matches':
        return {
          routeName: 'MainApp',
          params: { screen: 'UserTabs', params: { screen: 'Matches' } },
        };
      
      case 'profile':
        if (rest[0]) {
            // Navigates to another user's profile
            return {
                routeName: 'OtherUserProfileScreen',
                params: { userId: rest[0] },
            };
        } else {
            // Navigates to the current user's profile
            return {
                routeName: 'MainApp',
                params: { screen: 'UserTabs', params: { screen: 'Profile' } },
            };
        }
        break;
      
      // Add more cases for your other routes here...
      // e.g., 'settings', 'search', etc.

      default:
        if (isRouteInParamList(route)) {
            return { routeName: route as keyof RootStackParamList, params: rest[0] ? { id: rest[0] } : {} };
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


// A helper to check if a route name is valid, though not exhaustive for nested navigators
// This is a placeholder/example. A real implementation might need a flattened list of all valid routes.
function isRouteInParamList(routeName: string): routeName is keyof RootStackParamList {
    const validRoutes: Array<keyof RootStackParamList> = [
        "Auth", 
        "PaymentRequired", 
        "MainApp",
        "IndividualChatScreen",
        "GroupChatScreen",
        "OtherUserProfileScreen",
        "EventsScreen",
        // Add other root-level screens here
    ];
    return validRoutes.includes(routeName as keyof RootStackParamList);
} 