// import React from 'react';
// import { View, ActivityIndicator, StyleSheet } from "react-native";
// import { NavigationContainerRef } from '@react-navigation/native'; // Keep if used
// import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
// import { createNativeStackNavigator } from "@react-navigation/native-stack";
// import { Feather } from "@expo/vector-icons";
// import { useOrganizerMode } from "@/hooks/useOrganizerMode"; // Adjust path if needed
// import { useAuth } from "@/hooks/useAuth"; // Adjust path if needed
// import { APP_CONSTANTS } from "@/config/constants"; // Adjust path if needed

// // Import screens (Ensure paths are correct)
// import MatchesScreen from "@/screens/MatchesScreen";
// import ChatsScreen from "@/screens/ChatsScreen";
// import SearchScreen from "@/screens/SearchScreen";
// import EventsScreen from "@/screens/EventsScreen";
// import ProfileScreen from "@/screens/ProfileScreen"; // Assuming this is User Profile
// import CreateEventScreen from "@/screens/CreateEventScreen";
// import NotFoundScreen from "@/screens/NotFoundScreen";
// import OrganizerPostsScreen from "@/screens/organizer/OrganizerPostsScreen";
// import OrganizerProfileScreen from "@/screens/organizer/OrganizerProfileScreen";
// import EventDetailScreen from "@/screens/organizer/EventDetailScreen";
// import EditEventScreen from "@/screens/EditEventScreen";
// import BookingConfirmationScreen from "@/screens/BookingConfirmationScreen"; // IMPORTED
// import UserSettingsScreen from "@/screens/UserSettingsScreen"; // Added for settings
// import OrganizerSettingsScreen from "@/screens/organizer/OrganizerSettingsScreen"; // Added for settings
// // Import new user settings screens
// import EditUserProfileScreen from '@/screens/EditUserProfileScreen';
// import UserManageSubscriptionScreen from '@/screens/UserManageSubscriptionScreen';
// import UserMutedListScreen from '@/screens/UserMutedListScreen';
// import UserBlockedListScreen from '@/screens/UserBlockedListScreen';
// import UpgradeScreen from '@/screens/UpgradeScreen';

// // Import new organizer settings screens
// import EditOrganizerProfileScreen from '@/screens/organizer/EditOrganizerProfileScreen';
// import OrgManagePlanScreen from '@/screens/organizer/OrgManagePlanScreen';
// import OrgBillingHistoryScreen from '@/screens/organizer/OrgBillingHistoryScreen';

// // Import auth screens
// import LandingScreen from "@/screens/auth/LandingScreen"; // Adjust path if needed
// import LoginScreen from "@/screens/auth/LoginScreen"; // Adjust path if needed
// import MusicLoverSignUpFlow from "@/screens/auth/MusicLoverSignUpFlow"; // Adjust path if needed
// import OrganizerSignUpFlow from "@/screens/auth/OrganizerSignUpFlow"; // Adjust path if needed
// import IndividualChatScreen from '@/screens/IndividualChatScreen';
// // --- Define Param Lists ---
// export type RootStackParamList = {
//     Auth: undefined;
//     MusicLoverSignUpFlow: undefined;
//     OrganizerSignUpFlow: undefined;
//     MainApp: undefined; // Nested navigator
//     NotFoundGlobal?: undefined;
//     IndividualChatScreen: { // <-- ADD THIS
//       matchUserId: string; // The user ID of the person you are chatting with
//       matchName: string;   // The name of the person for the header
//       matchProfilePicture?: string | null; // Optional profile pic URL
//   };
// };

// type MainStackParamList = {
//     UserTabs: { screen?: keyof UserTabParamList }; // Nested navigator with optional initial screen
//     OrganizerTabs: { screen?: keyof OrganizerTabParamList }; // Nested navigator with optional initial screen
//     EventDetail: { eventId: string };
//     EditEvent: { eventId: string };
//     BookingConfirmation: { // Added confirmation screen params
//         eventId: string;
//         eventTitle: string;
//         quantity: number;
//         pricePerItemDisplay: string;
//         totalPriceDisplay: string;
//         bookingType: 'TICKETED' | 'RESERVATION';
//         rawPricePerItem: number | null;
//         rawTotalPrice: number | null;
//         rawFeePaid: number | null;
//         maxTickets: number | null;
//         maxReservations: number | null;
//     };
//     UserSettingsScreen: undefined; // Added for user settings
//     OrganizerSettingsScreen: undefined; // Added for organizer settings
//     // Add new screens related to user settings
//     EditUserProfileScreen: undefined;
//     UserManageSubscriptionScreen: undefined;
//     UserMutedListScreen: undefined;
//     UserBlockedListScreen: undefined;
//     UpgradeScreen: undefined;
//     // Add new organizer screens
//     EditOrganizerProfileScreen: undefined;
//     OrgManagePlanScreen: undefined;
//     OrgBillingHistoryScreen: undefined;
//     NotFoundMain: undefined;
//     // Add other screens like ViewBookings, UserEventDetail if needed
// };

// type UserTabParamList = {
//     Matches: undefined;
//     Chats: undefined;
//     Search: undefined;
//     Events: undefined;
//     Profile: undefined;
// };

// type OrganizerTabParamList = {
//     Posts: undefined;
//     Create: undefined;
//     OrganizerProfile: undefined;
// };

// // Create navigators
// const RootStack = createNativeStackNavigator<RootStackParamList>();
// const AuthStackNav = createNativeStackNavigator(); // Keep simple
// const MainStack = createNativeStackNavigator<MainStackParamList>();
// const Tab = createBottomTabNavigator(); // Keep simple

// // Loading Component
// const LoadingScreen = () => (
//   <View style={styles.loadingContainer}>
//     <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
//   </View>
// );

// // Auth navigator stack
// const AuthScreens = () => {
//   return (
//     <AuthStackNav.Navigator screenOptions={{ headerShown: false }}>
//       <AuthStackNav.Screen name="Landing" component={LandingScreen} />
//       <AuthStackNav.Screen name="MusicLoverLogin">
//         {(props) => <LoginScreen {...props} userType="music_lover" />}
//       </AuthStackNav.Screen>
//       <AuthStackNav.Screen name="OrganizerLogin">
//         {(props) => <LoginScreen {...props} userType="organizer" />}
//       </AuthStackNav.Screen>
//       <AuthStackNav.Screen name="MusicLoverSignUpFlow" component={MusicLoverSignUpFlow} />
//       <AuthStackNav.Screen name="OrganizerSignUpFlow" component={OrganizerSignUpFlow} />
//     </AuthStackNav.Navigator>
//   );
// };

// // Tab navigator for user mode
// const UserTabs = () => {
//   return (
//     <Tab.Navigator
//       screenOptions={({ route }) => ({
//         tabBarIcon: ({ focused, color, size }) => {
//           let iconName: keyof typeof Feather.glyphMap = "help-circle";
//           if (route.name === "Matches") iconName = "heart";
//           else if (route.name === "Chats") iconName = "message-square";
//           else if (route.name === "Search") iconName = "search";
//           else if (route.name === "Events") iconName = "calendar";
//           else if (route.name === "Profile") iconName = "user";
//           return <Feather name={iconName} size={size} color={color} />;
//         },
//         tabBarActiveTintColor: APP_CONSTANTS.COLORS.PRIMARY,
//         tabBarInactiveTintColor: APP_CONSTANTS.COLORS.DISABLED,
//         tabBarStyle: styles.tabBarStyle,
//         headerShown: false,
//         tabBarShowLabel: true,
//       })}
//     >
//       <Tab.Screen name="Matches" component={MatchesScreen} />
//       <Tab.Screen name="Chats" component={ChatsScreen} />
//       <Tab.Screen name="Search" component={SearchScreen} />
//       <Tab.Screen name="Events" component={EventsScreen} />
//       <Tab.Screen name="Profile" component={ProfileScreen} />
//     </Tab.Navigator>
//   );
// };

// // Tab navigator for organizer mode
// const OrganizerTabs = () => {
//   return (
//     <Tab.Navigator
//       screenOptions={({ route }) => ({
//         tabBarIcon: ({ focused, color, size }) => {
//           let iconName: keyof typeof Feather.glyphMap = "help-circle";
//           if (route.name === "Posts") iconName = "layout";
//           else if (route.name === "Create") iconName = "plus-circle";
//           else if (route.name === "OrganizerProfile") iconName = "briefcase";
//           return <Feather name={iconName} size={size} color={color} />;
//         },
//         tabBarActiveTintColor: APP_CONSTANTS.COLORS.PRIMARY,
//         tabBarInactiveTintColor: APP_CONSTANTS.COLORS.DISABLED,
//         tabBarStyle: styles.tabBarStyle,
//         headerShown: false,
//         tabBarShowLabel: true,
//       })}
//     >
//       <Tab.Screen name="Posts" component={OrganizerPostsScreen} options={{ title: "Events" }} />
//       <Tab.Screen name="Create" component={CreateEventScreen} options={{ title: "Create" }} />
//       <Tab.Screen name="OrganizerProfile" component={OrganizerProfileScreen} options={{ title: "Profile" }} />
//     </Tab.Navigator>
//   );
// };

// // --- Main Navigator Logic ---
// const AppNavigator = () => {
//   const { isOrganizerMode } = useOrganizerMode();
//   const { session, loading } = useAuth();

//   console.log("[AppNavigator] State:", loading ? "Loading" : session ? `Auth (${session.userType})` : "No Auth", `Org Mode: ${isOrganizerMode}`);
//   const isProfileComplete = session && ( (session.userType === 'music_lover' && session.musicLoverProfile) || (session.userType === 'organizer' && session.organizerProfile) );
//   console.log(`[AppNavigator] Profile Complete: ${isProfileComplete}`);

//   if (loading) { return <LoadingScreen />; }

//   return (
//       <RootStack.Navigator screenOptions={{ headerShown: false }}>
//         {!session ? (
//           <RootStack.Screen name="Auth" component={AuthScreens} />
//         ) : !isProfileComplete ? (
//            <RootStack.Screen
//              name={session.userType === 'music_lover' ? "MusicLoverSignUpFlow" : "OrganizerSignUpFlow"}
//              component={session.userType === 'music_lover' ? MusicLoverSignUpFlow : OrganizerSignUpFlow}
//              options={{ gestureEnabled: false }} // Prevent swipe back during onboarding
//            />
//         ) : (
//           <RootStack.Screen name="MainApp">
//             {() => (
              
//               <MainStack.Navigator screenOptions={{ headerShown: false }}>
//                  {isOrganizerMode ? (
//                   // Organizer Flow
//                   <>
//                     <MainStack.Screen name="OrganizerTabs" component={OrganizerTabs} initialParams={{ screen: "OrganizerProfile" }} />
//                     <MainStack.Screen name="EventDetail" component={EventDetailScreen} />
//                     <MainStack.Screen name="EditEvent" component={EditEventScreen} />
//                     <MainStack.Screen name="OrganizerSettingsScreen" component={OrganizerSettingsScreen} />
//                     <MainStack.Screen name="EditOrganizerProfileScreen" component={EditOrganizerProfileScreen} />
//                     <MainStack.Screen name="OrgManagePlanScreen" component={OrgManagePlanScreen} />
//                     <MainStack.Screen name="OrgBillingHistoryScreen" component={OrgBillingHistoryScreen} />
//                   </>
//                  ) : (
//                   // Music Lover Flow
//                   <>
//                     <MainStack.Screen name="UserTabs" component={UserTabs} initialParams={{ screen: "Profile" }}/>
//                     <MainStack.Screen name="UserSettingsScreen" component={UserSettingsScreen} />
//                     <MainStack.Screen name="EditUserProfileScreen" component={EditUserProfileScreen} />
//                     <MainStack.Screen name="UserManageSubscriptionScreen" component={UserManageSubscriptionScreen} />
//                     <MainStack.Screen name="UserMutedListScreen" component={UserMutedListScreen} />
//                     <MainStack.Screen name="UserBlockedListScreen" component={UserBlockedListScreen} />
//                     <MainStack.Screen name="UpgradeScreen" component={UpgradeScreen} />
                    
//                   </>
//                  )}
//                 {/* Screens accessible by both modes are placed outside the conditional */}
//                 <MainStack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />

//                 {/* Fallback for Main App */}
//                 <MainStack.Screen name="NotFoundMain" component={NotFoundScreen} options={{ title: 'Oops!'}}/>
//               </MainStack.Navigator>
//             )}
//           </RootStack.Screen>
//         )}
//         {/* Optional Global Fallback */}
//         {/* <RootStack.Screen name="NotFoundGlobal" component={NotFoundScreen} options={{ title: 'Oops!'}}/> */}
//       </RootStack.Navigator>
//   );
// };

// // Styles
// const styles = StyleSheet.create({
//   loadingContainer: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//     backgroundColor: '#FFFFFF',
//   },
//   tabBarStyle: {
//     height: 65,
//     paddingBottom: 8,
//     paddingTop: 5,
//     backgroundColor: 'white',
//     borderTopWidth: 1,
//     borderTopColor: APP_CONSTANTS.COLORS.BORDER,
//   },
// });

// export default AppNavigator;


// src/navigation/AppNavigator.tsx
// src/navigation/AppNavigator.tsx (Adjust path as needed)

import React from 'react';
// Added Platform for styles
import { View, ActivityIndicator, StyleSheet, Platform } from "react-native";
// NO NavigationContainer import needed here - it should be in App.tsx
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useOrganizerMode } from "@/hooks/useOrganizerMode"; // Adjust path
import { useAuth } from "@/hooks/useAuth"; // Adjust path
import { APP_CONSTANTS } from "@/config/constants"; // Adjust path

// --- Import ALL your screens ---
// Adjust paths as needed
import MatchesScreen from "@/screens/MatchesScreen";
import ChatsScreen from "@/screens/ChatsScreen";
import SearchScreen from "@/screens/SearchScreen";
import EventsScreen from "@/screens/EventsScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import CreateEventScreen from "@/screens/CreateEventScreen";
import NotFoundScreen from "@/screens/NotFoundScreen";
import EditEventScreen from "@/screens/EditEventScreen";
import BookingConfirmationScreen from "@/screens/BookingConfirmationScreen";
import UserSettingsScreen from "@/screens/UserSettingsScreen";
import UpgradeScreen from '@/screens/UpgradeScreen';
import IndividualChatScreen from '@/screens/IndividualChatScreen'; // *** IMPORTED ***

// User Settings Screens
import EditUserProfileScreen from '@/screens/EditUserProfileScreen';
import UserManageSubscriptionScreen from '@/screens/UserManageSubscriptionScreen';
import UserMutedListScreen from '@/screens/UserMutedListScreen';
import UserBlockedListScreen from '@/screens/UserBlockedListScreen';

// Organizer Screens
import OrganizerPostsScreen from "@/screens/organizer/OrganizerPostsScreen";
import OrganizerProfileScreen from "@/screens/organizer/OrganizerProfileScreen";
import EventDetailScreen from "@/screens/organizer/EventDetailScreen";
import OrganizerSettingsScreen from "@/screens/organizer/OrganizerSettingsScreen";
import EditOrganizerProfileScreen from '@/screens/organizer/EditOrganizerProfileScreen';
import OrgManagePlanScreen from '@/screens/organizer/OrgManagePlanScreen';
import OrgBillingHistoryScreen from '@/screens/organizer/OrgBillingHistoryScreen';

// Auth Screens
import LandingScreen from "@/screens/auth/LandingScreen";
import LoginScreen from "@/screens/auth/LoginScreen";
import MusicLoverSignUpFlow from "@/screens/auth/MusicLoverSignUpFlow";
import OrganizerSignUpFlow from "@/screens/auth/OrganizerSignUpFlow";

// --- Define Param Lists ---
// Top Level Navigator (Handles Auth vs Main App flow)
export type RootStackParamList = {
    Auth: undefined;
    MusicLoverSignUpFlow: undefined;
    OrganizerSignUpFlow: undefined;
    MainApp: undefined; // Nested navigator entry point
    IndividualChatScreen: { // <-- DEFINED HERE
      matchUserId: string;
      matchName: string;
      matchProfilePicture?: string | null;
    };
    NotFoundGlobal?: undefined; // Optional: A global not found screen
};

// Navigator inside 'MainApp' (Handles core app structure like Tabs + other full screens)
type MainStackParamList = {
    UserTabs: { screen?: keyof UserTabParamList };
    OrganizerTabs: { screen?: keyof OrganizerTabParamList };
    EventDetail: { eventId: string };
    EditEvent: { eventId: string };
    BookingConfirmation: {
        eventId: string; eventTitle: string; quantity: number; pricePerItemDisplay: string; totalPriceDisplay: string; bookingType: 'TICKETED' | 'RESERVATION'; rawPricePerItem: number | null; rawTotalPrice: number | null; rawFeePaid: number | null; maxTickets: number | null; maxReservations: number | null;
     };
    UserSettingsScreen: undefined;
    OrganizerSettingsScreen: undefined;
    EditUserProfileScreen: undefined;
    UserManageSubscriptionScreen: undefined;
    UserMutedListScreen: undefined;
    UserBlockedListScreen: undefined;
    UpgradeScreen: undefined;
    EditOrganizerProfileScreen: undefined;
    OrgManagePlanScreen: undefined;
    OrgBillingHistoryScreen: undefined;
    NotFoundMain: undefined;
};

// Screens within the User Bottom Tab Navigator
type UserTabParamList = {
    Matches: undefined;
    Chats: undefined; // This is the list screen
    Search: undefined;
    Events: undefined;
    Profile: undefined;
};

// Screens within the Organizer Bottom Tab Navigator
type OrganizerTabParamList = {
    Posts: undefined;
    Create: undefined;
    OrganizerProfile: undefined;
};

// --- Create Navigators ---
const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStackNav = createNativeStackNavigator();
const MainStack = createNativeStackNavigator<MainStackParamList>();
const UserTabNav = createBottomTabNavigator<UserTabParamList>();
const OrganizerTabNav = createBottomTabNavigator<OrganizerTabParamList>();

// --- Reusable Components ---
const LoadingScreen = () => ( <View style={styles.loadingContainer}><ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} /></View> );
const AuthScreens = () => ( <AuthStackNav.Navigator screenOptions={{ headerShown: false }}><AuthStackNav.Screen name="Landing" component={LandingScreen} /><AuthStackNav.Screen name="MusicLoverLogin">{(props) => <LoginScreen {...props} userType="music_lover" />}</AuthStackNav.Screen><AuthStackNav.Screen name="OrganizerLogin">{(props) => <LoginScreen {...props} userType="organizer" />}</AuthStackNav.Screen></AuthStackNav.Navigator> );
const UserTabs = () => ( <UserTabNav.Navigator screenOptions={({ route }) => ({ tabBarIcon: ({ focused, color, size }) => { let iconName: keyof typeof Feather.glyphMap = "help-circle"; if (route.name === "Matches") iconName = "heart"; else if (route.name === "Chats") iconName = "message-square"; else if (route.name === "Search") iconName = "search"; else if (route.name === "Events") iconName = "calendar"; else if (route.name === "Profile") iconName = "user"; return <Feather name={iconName} size={size} color={color} />; }, tabBarActiveTintColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', tabBarInactiveTintColor: APP_CONSTANTS?.COLORS?.DISABLED || '#9CA3AF', tabBarStyle: styles.tabBarStyle, headerShown: false, tabBarShowLabel: true, })}><UserTabNav.Screen name="Matches" component={MatchesScreen} /><UserTabNav.Screen name="Chats" component={ChatsScreen} /><UserTabNav.Screen name="Search" component={SearchScreen} /><UserTabNav.Screen name="Events" component={EventsScreen} /><UserTabNav.Screen name="Profile" component={ProfileScreen} /></UserTabNav.Navigator> );
const OrganizerTabs = () => ( <OrganizerTabNav.Navigator screenOptions={({ route }) => ({ tabBarIcon: ({ focused, color, size }) => { let iconName: keyof typeof Feather.glyphMap = "help-circle"; if (route.name === "Posts") iconName = "layout"; else if (route.name === "Create") iconName = "plus-circle"; else if (route.name === "OrganizerProfile") iconName = "briefcase"; return <Feather name={iconName} size={size} color={color} />; }, tabBarActiveTintColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', tabBarInactiveTintColor: APP_CONSTANTS?.COLORS?.DISABLED || '#9CA3AF', tabBarStyle: styles.tabBarStyle, headerShown: false, tabBarShowLabel: true, })}><OrganizerTabNav.Screen name="Posts" component={OrganizerPostsScreen} options={{ title: "Events" }} /><OrganizerTabNav.Screen name="Create" component={CreateEventScreen} options={{ title: "Create" }} /><OrganizerTabNav.Screen name="OrganizerProfile" component={OrganizerProfileScreen} options={{ title: "Profile" }} /></OrganizerTabNav.Navigator> );

// --- Main App Stack Component ---
// This component renders the MainStack navigator and its screens
// It's used as the component for the 'MainApp' screen in RootStack
const MainAppStack = () => {
  const { isOrganizerMode } = useOrganizerMode();
  return (
    <MainStack.Navigator
        // Default options for screens *within* MainAppStack
        screenOptions={{ headerShown: true }}
    >
        {isOrganizerMode ? (
            <>
                <MainStack.Screen name="OrganizerTabs" component={OrganizerTabs} options={{ headerShown: false }} />
                <MainStack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event Details' }}/>
                <MainStack.Screen name="EditEvent" component={EditEventScreen} options={{ title: 'Edit Event' }}/>
                <MainStack.Screen name="OrganizerSettingsScreen" component={OrganizerSettingsScreen} options={{ title: 'Settings' }}/>
                <MainStack.Screen name="EditOrganizerProfileScreen" component={EditOrganizerProfileScreen} options={{ title: 'Edit Profile' }}/>
                <MainStack.Screen name="OrgManagePlanScreen" component={OrgManagePlanScreen} options={{ title: 'Manage Plan' }}/>
                <MainStack.Screen name="OrgBillingHistoryScreen" component={OrgBillingHistoryScreen} options={{ title: 'Billing History' }}/>
            </>
        ) : (
            <>
                <MainStack.Screen name="UserTabs" component={UserTabs} options={{ headerShown: false }}/>
                <MainStack.Screen name="UserSettingsScreen" component={UserSettingsScreen} options={{ title: 'Settings' }}/>
                <MainStack.Screen name="EditUserProfileScreen" component={EditUserProfileScreen} options={{ title: 'Edit Profile' }}/>
                <MainStack.Screen name="UserManageSubscriptionScreen" component={UserManageSubscriptionScreen} options={{ title: 'Subscription' }}/>
                <MainStack.Screen name="UserMutedListScreen" component={UserMutedListScreen} options={{ title: 'Muted Users' }}/>
                <MainStack.Screen name="UserBlockedListScreen" component={UserBlockedListScreen} options={{ title: 'Blocked Users' }}/>
                <MainStack.Screen name="UpgradeScreen" component={UpgradeScreen} options={{ title: 'Go Premium' }}/>
            </>
        )}
        {/* Screens accessible by both modes */}
        <MainStack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} options={{ title: 'Booking Confirmed' }} />
        <MainStack.Screen name="NotFoundMain" component={NotFoundScreen} options={{ title: 'Oops!' }}/>
    </MainStack.Navigator>
  );
}

// --- Root Navigator Logic ---
// This component returns the RootStack.Navigator
// It should be WRAPPED by <NavigationContainer> in your App.tsx
const AppNavigator = () => {
  const { session, loading, musicLoverProfile, organizerProfile } = useAuth();

  const isProfileComplete = session && (
      (session.userType === 'music_lover' && musicLoverProfile) ||
      (session.userType === 'organizer' && organizerProfile)
  );

  console.log("[AppNavigator] State:", loading ? "Loading" : session ? `Auth (${session.userType})` : "No Auth");
  if(session) { console.log(`[AppNavigator] Profile Complete Check: ${isProfileComplete}`); }

  if (loading) {
    return <LoadingScreen />;
  }

  // *** RETURN THE NAVIGATOR DIRECTLY - DO NOT WRAP IN NavigationContainer HERE ***
  return (
      <RootStack.Navigator
        // Root stack usually doesn't show its own header
        screenOptions={{ headerShown: false }}
      >
        {!session ? (
          // 1. Not Logged In
          <RootStack.Screen name="Auth" component={AuthScreens} />
        ) : !isProfileComplete ? (
          // 2. Logged In, Profile Incomplete
           <RootStack.Screen
             name={session.userType === 'music_lover' ? "MusicLoverSignUpFlow" : "OrganizerSignUpFlow"}
             component={session.userType === 'music_lover' ? MusicLoverSignUpFlow : OrganizerSignUpFlow}
             options={{ gestureEnabled: false }}
           />
        ) : (
          // 3. Logged In AND Profile Complete
          // Use React Fragment <> to include both screens under this condition
          <>
            {/* Screen definition for the main app flow */}
            <RootStack.Screen
              name="MainApp"
              component={MainAppStack} // Component defined above
            />
            {/* ***** CORRECTED: REGISTER THE INDIVIDUAL CHAT SCREEN HERE ***** */}
            <RootStack.Screen
              name="IndividualChatScreen" // <<< Name must match navigate() call
              component={IndividualChatScreen} // <<< Component to render
              options={{
                  headerShown: true, // <<< Show the header (back button, title)
                  headerBackTitleVisible: false,
                  // Title is set dynamically in IndividualChatScreen
              }}
            />
            {/* ***** END OF CORRECTION ***** */}
          </>
        )}
        {/* Optional Global Fallback Screen */}
        {/* <RootStack.Screen name="NotFoundGlobal" component={NotFoundScreen} options={{ title: 'Oops!', headerShown: true }}/> */}
      </RootStack.Navigator>
  );
};

// Styles
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: '#FFFFFF',
  },
  tabBarStyle: {
    height: 65,
    paddingBottom: Platform.OS === 'android' ? 5 : 8, // Adjust padding
    paddingTop: 5,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: APP_CONSTANTS?.COLORS?.BORDER || '#E5E7EB', // Fallback color
  },
});

export default AppNavigator; // Export the component