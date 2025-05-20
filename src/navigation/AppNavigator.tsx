// navigation/AppNavigator.tsx
import React from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useOrganizerMode } from "@/hooks/useOrganizerMode";
import { useAuth } from "@/hooks/useAuth";
import { APP_CONSTANTS } from "@/config/constants";
import { NavigationContainer, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

// --- Import ALL your screens ---
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
import IndividualChatScreen from '@/screens/IndividualChatScreen';
import OtherUserProfileScreen from '@/screens/OtherUserProfileScreen';
import FriendsListScreen from '@/screens/FriendsListScreen';

// User Settings Screens
import EditUserProfileScreen from '@/screens/EditUserProfileScreen';
import UserManageSubscriptionScreen from '@/screens/UserManageSubscriptionScreen';
import UserMutedListScreen from '@/screens/UserMutedListScreen';
import UserBlockedListScreen from '@/screens/UserBlockedListScreen';
import OrganizerListScreen from '@/screens/OrganizerListScreen';
import UserBillingHistoryScreen from '@/screens/UserBillingHistoryScreen';
import UpdateMusicFavoritesScreen from '@/screens/UpdateMusicFavoritesScreen';

// Organizer Screens
import OrganizerPostsScreen from "@/screens/organizer/OrganizerPostsScreen";
import OrganizerProfileScreen from "@/screens/organizer/OrganizerProfileScreen";
import EventDetailScreen from "@/screens/organizer/EventDetailScreen";
import OrganizerSettingsScreen from "@/screens/organizer/OrganizerSettingsScreen";
import EditOrganizerProfileScreen from '@/screens/organizer/EditOrganizerProfileScreen';
import OrgManagePlanScreen from '@/screens/organizer/OrgManagePlanScreen';
import OrgBillingHistoryScreen from '@/screens/organizer/OrgBillingHistoryScreen';
import UserListScreen from '@/screens/UserListScreen';
import UpcomingEventsListScreen from '@/screens/UpcomingEventsListScreen';
import PastEventsListScreen from '@/screens/PastEventsListScreen';

// Attended Events Screen (New)
import AttendedEventsScreen from '@/screens/AttendedEventsScreen'; // <-- IMPORT NEW SCREEN

// Auth Screens
import LandingScreen from "@/screens/auth/LandingScreen";
import LoginScreen from "@/screens/auth/LoginScreen";
import MusicLoverSignUpFlow from "@/screens/auth/MusicLoverSignUpFlow";
import OrganizerSignUpFlow from "@/screens/auth/OrganizerSignUpFlow";
import SignUpScreen from '@/screens/auth/SignUpScreen';
// import ForgotPasswordScreen from '@/screens/auth/ForgotPasswordScreen';
import PremiumSignupScreen from '@/screens/auth/PremiumSignupScreen';
import PaymentSuccessScreen from '@/screens/auth/PaymentSuccessScreen';
import PaymentConfirmationScreen from '@/screens/auth/PaymentConfirmationScreen';

// Group Chat Screens
import CreateGroupChatScreen from '@/screens/CreateGroupChatScreen';
import GroupChatScreen from '@/screens/GroupChatScreen';
import GroupInfoScreen from '@/screens/GroupInfoScreen';       // <-- IMPORT GroupInfoScreen
import AddGroupMembersScreen from '@/screens/AddGroupMembersScreen';

// View Organizer Profile Screen (Now in Main Stack)
import ViewOrganizerProfileScreen from '@/screens/ViewOrganizerProfileScreen';

// Organizer - View Bookings Screen
import ViewBookingsScreen from '@/screens/organizer/ViewBookingsScreen'; // <-- IMPORT NEW SCREEN

// Link Music Services Screen (Commented out due to linter error)
import LinkMusicServicesScreen from '@/screens/LinkMusicServicesScreen'; // <-- IMPORT NEW SCREEN

// Overall Analytics Screen
import OverallAnalyticsScreen from '@/screens/organizer/OverallAnalyticsScreen';

// --- Define Param Lists ---

export type AuthStackParamList = {
  LoginScreen: undefined;
  SignUpScreen: undefined;
  MusicLoverSignUpFlow: undefined;
  OrganizerSignUpFlow: undefined;
  ForgotPasswordScreen: undefined;
  PremiumSignupScreen: { userEmail: string; userId: string };
  PaymentSuccessScreen: undefined;
  PaymentConfirmationScreen: undefined;
};

export type MainStackParamList = {
  PaymentConfirmationScreen: undefined;
  PremiumSignupScreen: { userEmail: string; userId: string };
  PaymentSuccessScreen: undefined;
  LoadingScreen: undefined; // Could be used while checking auth state
  UserTabs: { screen?: keyof UserTabParamList, params?: any }; // Entry point for User tabs
  OrganizerTabs: { screen?: keyof OrganizerTabParamList, params?: any }; // Entry point for Organizer tabs
  
  // User Specific Screens (outside tabs)
  UserSettingsScreen: undefined;
  EditUserProfileScreen: undefined; // Simplified from EditProfileScreen with userType
  UserManageSubscriptionScreen: undefined;
  UserMutedListScreen: undefined;
  UserBlockedListScreen: undefined;
  FriendsListScreen: undefined;
  OrganizerListScreen: undefined; // For users following organizers
  UpgradeScreen: undefined;
  AttendedEventsScreen: undefined;
  UserBillingHistoryScreen: undefined;
  UpdateMusicFavoritesScreen: undefined;
  LinkMusicServicesScreen: { autoLinkSpotify?: boolean } | undefined;

  // Organizer Specific Screens (outside tabs)
  EventDetail: { eventId: string }; // Corrected from EventDetailScreen, eventId to string
  EditEvent: { eventId: string };   // Corrected from EditEventScreen, eventId to string
  ViewBookings: { eventId: string; eventTitle: string }; // <<< ADDED ViewBookings
  OrganizerSettingsScreen: undefined;
  EditOrganizerProfileScreen: undefined; // Simplified
  OrgManagePlanScreen: undefined;
  OrgBillingHistoryScreen: undefined;
  UserListScreen: undefined; // For organizers viewing followers/attendees
  PromoteEvent: { eventId: string }; // Added based on EventDetailScreen's OrganizerStackParamList
  OverallAnalyticsScreen: undefined; // <-- ADDED OverallAnalyticsScreen for organizers

  // Common Screens (accessible by both, or general purpose)
  OtherUserProfileScreen: { userId: string };
  CreateEventScreen: undefined; // Already present, seems common or org specific
  BookingConfirmation: { eventId?: string, bookingId?: string }; // Added params
  UpcomingEventsListScreen: { userId?: string, organizerId?: string }; // Added optional params
  PastEventsListScreen: { userId?: string, organizerId?: string }; // Added optional params
  ViewOrganizerProfileScreen: { organizerId: string }; // Added params
  
  VenueProfileScreen: { venueId:string }; // Assuming venueId might be string too
  VenueDetailScreen: { venueId: string }; // Assuming venueId might be string too
  IndividualChatScreen: { matchUserId: string, matchName: string }; // Already present
  NotificationsScreen: undefined; // Already present

  NotFoundMain: undefined; // Fallback for MainStack
};

export type UserTabParamList = {
    Matches: undefined;
    Chats: undefined;
    Search: undefined;
    Events: undefined;
    Profile: undefined;
};

export type OrganizerTabParamList = {
    Posts: undefined;
    Create: undefined;
    OrganizerProfile: undefined;
};

// Combined Root Param List (Includes Auth, Main, and standalone screens)
export type RootStackParamList = {
  Auth: undefined; // Represents the AuthScreens navigator
  MainApp: { screen?: keyof MainStackParamList, params?: { screen?: keyof UserTabParamList | keyof OrganizerTabParamList, params?: any } }; // Represents the MainAppStack navigator
  IndividualChatScreen: {
    matchUserId: string;
    matchName: string;
    matchProfilePicture?: string | null;
    commonTags?: string[]; // <-- This was already there
    topArtists?: string[]; // <-- ADD THIS
    topTracks?: string[]; // <-- ADD THIS
    topGenres?: string[]; // <-- ADD THIS
    topMoods?: string[]; // <-- ADD THIS
    isFirstInteractionFromMatches?: boolean;
  };
  OtherUserProfileScreen: {
    userId: string;
    fromChat?: boolean;
    chatImages?: string[];
  };

  // *** Group Chat Screens in Root Stack ***
  CreateGroupChatScreen: undefined;
  GroupChatScreen: {
      groupId: string;
      groupName?: string | null; // Pass initial name, might update
      groupImage?: string | null; // Pass initial image, might update
  };
   GroupInfoScreen: { // Screen for viewing/managing group details
       groupId: string;
       groupName: string; // Required from GroupChatScreen
       groupImage: string | null; // Required from GroupChatScreen
   };
  AddGroupMembersScreen: {
       groupId: string;
       groupName?: string | null;
  };
  // *** END Group Chat Screens ***

  // ViewOrganizerProfileScreen REMOVED from RootStack
  ChatsScreen: undefined;

  NotFoundGlobal?: undefined;
  // Include signup flows here for direct navigation if needed during incomplete profile state
  MusicLoverSignUpFlow: undefined;
  OrganizerSignUpFlow: undefined;
};

// --- Create Navigators ---
const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStackNav = createNativeStackNavigator(); // No param list needed if simple
const MainStack = createNativeStackNavigator<MainStackParamList>();
const UserTabNav = createBottomTabNavigator<UserTabParamList>();
const OrganizerTabNav = createBottomTabNavigator<OrganizerTabParamList>();

// --- Reusable Components ---
const LoadingScreen = () => ( <View style={styles.loadingContainer}><ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} /></View> );
const AuthScreens = () => ( 
  <AuthStackNav.Navigator screenOptions={{ headerShown: false }}>
    <AuthStackNav.Screen name="Landing" component={LandingScreen} />
    <AuthStackNav.Screen name="MusicLoverLogin">{(props) => <LoginScreen {...props} userType="music_lover" />}</AuthStackNav.Screen>
    <AuthStackNav.Screen name="OrganizerLogin">{(props) => <LoginScreen {...props} userType="organizer" />}</AuthStackNav.Screen>
    <AuthStackNav.Screen name="MusicLoverSignUpFlow" component={MusicLoverSignUpFlow} />
    <AuthStackNav.Screen name="OrganizerSignUpFlow" component={OrganizerSignUpFlow} />
    <AuthStackNav.Screen name="PremiumSignupScreen" component={PremiumSignupScreen} />
    <AuthStackNav.Screen name="PaymentSuccessScreen" component={PaymentSuccessScreen} />
    <AuthStackNav.Screen name="PaymentConfirmationScreen" component={PaymentConfirmationScreen} />
  </AuthStackNav.Navigator> 
);
const UserTabs = () => ( <UserTabNav.Navigator screenOptions={({ route }) => ({ tabBarIcon: ({ focused, color, size }) => { let iconName: keyof typeof Feather.glyphMap = "help-circle"; if (route.name === "Matches") iconName = "heart"; else if (route.name === "Chats") iconName = "message-square"; else if (route.name === "Search") iconName = "search"; else if (route.name === "Events") iconName = "calendar"; else if (route.name === "Profile") iconName = "user"; return <Feather name={iconName} size={size} color={color} />; }, tabBarActiveTintColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', tabBarInactiveTintColor: APP_CONSTANTS?.COLORS?.DISABLED || '#9CA3AF', tabBarStyle: styles.tabBarStyle, headerShown: false, tabBarShowLabel: true, })}><UserTabNav.Screen name="Matches" component={MatchesScreen} /><UserTabNav.Screen name="Chats" component={ChatsScreen} /><UserTabNav.Screen name="Search" component={SearchScreen} /><UserTabNav.Screen name="Events" component={EventsScreen} /><UserTabNav.Screen name="Profile" component={ProfileScreen} /></UserTabNav.Navigator> );
const OrganizerTabs = () => ( <OrganizerTabNav.Navigator screenOptions={({ route }) => ({ tabBarIcon: ({ focused, color, size }) => { let iconName: keyof typeof Feather.glyphMap = "help-circle"; if (route.name === "Posts") iconName = "layout"; else if (route.name === "Create") iconName = "plus-circle"; else if (route.name === "OrganizerProfile") iconName = "briefcase"; return <Feather name={iconName} size={size} color={color} />; }, tabBarActiveTintColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', tabBarInactiveTintColor: APP_CONSTANTS?.COLORS?.DISABLED || '#9CA3AF', tabBarStyle: styles.tabBarStyle, headerShown: false, tabBarShowLabel: true, })}><OrganizerTabNav.Screen name="Posts" component={OrganizerPostsScreen} options={{ title: "Events" }} /><OrganizerTabNav.Screen name="Create" component={CreateEventScreen} options={{ title: "Create" }} /><OrganizerTabNav.Screen name="OrganizerProfile" component={OrganizerProfileScreen} options={{ title: "Profile" }} /></OrganizerTabNav.Navigator> );

// --- Main App Stack Component ---
const MainAppStack = () => {
  const { isOrganizerMode } = useOrganizerMode();
  return (
    <MainStack.Navigator screenOptions={{ headerShown: true }} >
        {isOrganizerMode ? (
             <>
                 <MainStack.Screen name="OrganizerTabs" component={OrganizerTabs} options={{ headerShown: false }} />
                 <MainStack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event Details' }}/>
                 <MainStack.Screen name="EditEvent" component={EditEventScreen} options={{ title: 'Edit Event' }}/>
                 <MainStack.Screen name="ViewBookings" component={ViewBookingsScreen} options={{ title: 'Event Bookings' }}/>
                 <MainStack.Screen name="OrganizerSettingsScreen" component={OrganizerSettingsScreen} options={{ title: 'Settings' }}/>
                 <MainStack.Screen name="EditOrganizerProfileScreen" component={EditOrganizerProfileScreen} options={{ title: 'Edit Profile' }}/>
                 <MainStack.Screen name="OrgManagePlanScreen" component={OrgManagePlanScreen} options={{ title: 'Manage Plan' }}/>
                 <MainStack.Screen name="OrgBillingHistoryScreen" component={OrgBillingHistoryScreen} options={{ title: 'Billing History' }}/>
                 <MainStack.Screen name="UserListScreen" component={UserListScreen} options={{ title: 'Followers' }}/>
                 <MainStack.Screen name="OverallAnalyticsScreen" component={OverallAnalyticsScreen} options={{ title: 'Overall Analytics' }}/>
    
             </>
        ) : (
             <>
                 <MainStack.Screen name="UserTabs" component={UserTabs} options={{ headerShown: false }}/>
                 <MainStack.Screen name="UserSettingsScreen" component={UserSettingsScreen} options={{ title: 'Settings' }} />
                 <MainStack.Screen name="EditUserProfileScreen" component={EditUserProfileScreen} options={{ title: 'Edit Profile' }} />
                 <MainStack.Screen name="UserManageSubscriptionScreen" component={UserManageSubscriptionScreen} options={{ title: 'Subscription' }} />
                 <MainStack.Screen name="UserMutedListScreen" component={UserMutedListScreen} options={{ title: 'Muted Users' }} />
                 <MainStack.Screen name="UserBlockedListScreen" component={UserBlockedListScreen} options={{ title: 'Blocked Users' }} />
                 <MainStack.Screen name="FriendsListScreen" component={FriendsListScreen} options={{ title: 'Friends' }} />
                 <MainStack.Screen name="OrganizerListScreen" component={OrganizerListScreen} options={{ title: 'Following' }}/>
                 <MainStack.Screen name="UpgradeScreen" component={UpgradeScreen} options={{ title: 'Go Premium' }} />
                 <MainStack.Screen name="AttendedEventsScreen" component={AttendedEventsScreen} options={{ title: 'Attended Events' }} />
                 <MainStack.Screen name="UserBillingHistoryScreen" component={UserBillingHistoryScreen} options={{ title: 'Billing History' }} />
                 <MainStack.Screen name="UpdateMusicFavoritesScreen" component={UpdateMusicFavoritesScreen} options={{ title: 'Music Favorites' }} />
                 <MainStack.Screen name="LinkMusicServicesScreen" component={LinkMusicServicesScreen} options={{ title: 'Link Music Services' }} />
                 <MainStack.Screen name="PremiumSignupScreen" component={PremiumSignupScreen} options={{ title: 'Payment' }} />
                 <MainStack.Screen name="PaymentConfirmationScreen" component={PaymentConfirmationScreen} options={{ title: 'Payment Confirmation' }} />
             </>
        )}
        {/* Screens accessible by both modes */}
        <MainStack.Screen name="CreateEventScreen" component={CreateEventScreen} options={{title: "Create Event"}} />
        <MainStack.Screen name="OtherUserProfileScreen" component={OtherUserProfileScreen} options={{title: "Profile"}} />
        <MainStack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} options={{ title: 'Booking Confirmed' }} />
        <MainStack.Screen name="UpcomingEventsListScreen" component={UpcomingEventsListScreen} />
        <MainStack.Screen name="PastEventsListScreen" component={PastEventsListScreen} />
        {/* *** ViewOrganizerProfileScreen now registered in Main Stack *** */}
        <MainStack.Screen name="ViewOrganizerProfileScreen" component={ViewOrganizerProfileScreen} />
        {/* *** END Move *** */}
        <MainStack.Screen name="NotFoundMain" component={NotFoundScreen} options={{ title: 'Oops!' }} />
    </MainStack.Navigator>
  );
}

// --- Root Navigator Logic ---
const AppNavigator = () => {
  const { session, loading, musicLoverProfile, organizerProfile } = useAuth();
  const isProfileComplete = session && ( (session.userType === 'music_lover' && musicLoverProfile) || (session.userType === 'organizer' && organizerProfile) );

  console.log("[AppNavigator] State:", loading ? "Loading" : session ? `Auth (${session.userType})` : "No Auth", `Profile Complete: ${isProfileComplete ?? 'N/A'}`);

  if (loading) { return <LoadingScreen />; }

  return (
      <RootStack.Navigator screenOptions={{ headerShown: false }} >
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
          <>
            {/* Main App entry point (renders MainAppStack) */}
            <RootStack.Screen name="MainApp" component={MainAppStack} />

            {/* Screens pushed on top of MainApp */}
            <RootStack.Screen
              name="IndividualChatScreen"
              component={IndividualChatScreen}
              options={{ headerShown: true, headerBackTitleVisible: false }} // Show header
            />
            <RootStack.Screen
              name="OtherUserProfileScreen"
              component={OtherUserProfileScreen}
              options={{ headerShown: true, headerBackTitleVisible: false }} // Show header
            />

            {/* *** REGISTER NEW GROUP CHAT SCREENS HERE *** */}
            <RootStack.Screen
                name="CreateGroupChatScreen"
                component={CreateGroupChatScreen}
                options={{ headerShown: true, title: 'New Group', headerBackTitleVisible: false }}
            />
            <RootStack.Screen
                name="GroupChatScreen"
                component={GroupChatScreen}
                options={{ headerShown: true, headerBackTitleVisible: false }} // Title set dynamically inside screen
            />
             <RootStack.Screen
                name="GroupInfoScreen"
                component={GroupInfoScreen}
                options={{ headerShown: true, title: 'Group Info', headerBackTitleVisible: false }} // Title can also be set dynamically
            />
            <RootStack.Screen
                name="AddGroupMembersScreen"
                component={AddGroupMembersScreen}
                options={{ headerShown: true, title: 'Add Members', headerBackTitleVisible: false }}
            />
            {/* *** END REGISTRATION *** */}

            {/* ViewOrganizerProfileScreen REMOVED from here */}

          </>
        )}
        {/* Optional Global Fallback */}
        {/* <RootStack.Screen name="NotFoundGlobal" component={NotFoundScreen} options={{ title: 'Oops!'}}/> */}
      </RootStack.Navigator>
  );
  };

// --- Styles ---
const styles = StyleSheet.create({
   loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#FFFFFF', },
   tabBarStyle: { height: Platform.OS === 'ios' ? 85 : 65, // Adjust height for iOS notch area
       paddingBottom: Platform.OS === 'ios' ? 30 : 8, // More padding for iOS bottom
       paddingTop: 5, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: APP_CONSTANTS?.COLORS?.BORDER || '#E5E7EB',
    },
});

export default AppNavigator;