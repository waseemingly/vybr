// navigation/AppNavigator.tsx
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform, Text, TouchableOpacity } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useOrganizerMode } from "@/hooks/useOrganizerMode";
import { useAuth } from "@/hooks/useAuth";
import { APP_CONSTANTS } from "@/config/constants";
import { NavigationContainer, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation, NavigationProp, useNavigationState, useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { useUnreadCount } from '@/hooks/useUnreadCount';

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
import ShareEventScreen from '@/screens/ShareEventScreen';

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
import ManagePlanScreen from '@/screens/organizer/ManagePlanScreen';
import OrgBillingHistoryScreen from '@/screens/organizer/OrgBillingHistoryScreen';
import UserListScreen from '@/screens/UserListScreen';
import UpcomingEventsListScreen from '@/screens/UpcomingEventsListScreen';
import PastEventsListScreen from '@/screens/PastEventsListScreen';
import OrganizerReservationsScreen from '@/screens/OrganizerReservationsScreen';

// NEW: Add SetAvailabilityScreen
import SetAvailabilityScreen from '@/screens/organizer/SetAvailabilityScreen';

// Attended Events Screen (New)
import AttendedEventsScreen from '@/screens/AttendedEventsScreen'; // <-- IMPORT NEW SCREEN

// Auth Screens
import LandingScreen from "@/screens/auth/LandingScreen";
import LoginScreen from "@/screens/auth/LoginScreen";
import SignUpScreen from '@/screens/auth/SignUpScreen';
import MusicLoverSignUpFlow from '@/screens/auth/MusicLoverSignUpFlow';
import OrganizerSignUpFlow from "@/screens/auth/OrganizerSignUpFlow";
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

// Required Payment Screen
import RequiredPaymentScreen from '@/screens/payment/RequiredPaymentScreen';

// My Bookings Screen
import MyBookingsScreen from '@/screens/MyBookingsScreen';

// NEW: PaymentRequiredStack - Acts as a mandatory gateway
export type PaymentRequiredStackParamList = {
  RequiredPaymentScreen: undefined;
};

// --- Define Param Lists ---

export type AuthStackParamList = {
  LoginScreen: undefined;
  SignUpScreen: undefined;
  MusicLoverSignUpFlow: undefined;
  OrganizerSignUpFlow: undefined;
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
  ManagePlan: undefined;
  UserMutedListScreen: undefined;
  UserBlockedListScreen: undefined;
  FriendsListScreen: undefined;
  OrganizerListScreen: undefined; // For users following organizers
  UpgradeScreen: undefined;
  AttendedEventsScreen: undefined;
  UserBillingHistoryScreen: undefined;
  UpdateMusicFavoritesScreen: undefined;
  LinkMusicServicesScreen: { autoLinkSpotify?: boolean } | undefined;
  MyBookingsScreen: undefined;

  // Organizer Specific Screens (outside tabs)
  EventDetail: { eventId: string };   // Corrected from EditEventScreen, eventId to string
  EditEvent: { eventId: string };   // Corrected from EditEventScreen, eventId to string
  ViewBookings: { eventId: string; eventTitle: string }; // <<< ADDED ViewBookings
  OrganizerSettingsScreen: undefined;
  SetAvailabilityScreen: undefined; // <-- ADDED
  EditOrganizerProfileScreen: undefined; // Simplified
  ManagePlanScreen: undefined;
  OrgBillingHistoryScreen: undefined;
  UserListScreen: undefined; // For organizers viewing followers/attendees
  PromoteEvent: { eventId: string }; // Added based on EventDetailScreen's OrganizerStackParamList
  OverallAnalyticsScreen: undefined; // <-- ADDED OverallAnalyticsScreen for organizers
  OrganizerReservationsScreen: undefined; // <-- ADDED

  // Common Screens (accessible by both, or general purpose)
  OtherUserProfileScreen: { userId: string };
  CreateEventScreen: undefined; // Already present, seems common or org specific
  BookingConfirmation: { eventId?: string, bookingId?: string }; // Added params
  UpcomingEventsListScreen: { userId?: string, organizerId?: string }; // Added optional params
  PastEventsListScreen: { userId?: string, organizerId?: string }; // Added optional params
  ViewOrganizerProfileScreen: { organizerUserId: string }; // Fixed param name to match the screen
  ShareEventScreen: {
    eventId: string;
    eventTitle: string;
    eventDate: string;
    eventVenue: string;
    eventImage?: string;
  };
  
  VenueProfileScreen: { venueId:string }; // Assuming venueId might be string too
  VenueDetailScreen: { venueId: string }; // Assuming venueId might be string too
  IndividualChatScreen: { matchUserId: string, matchName: string }; // Already present
  NotificationsScreen: undefined; // Already present

  NotFoundMain: undefined; // Fallback for MainStack

  // New for Required Payment Screen
  RequiredPaymentScreen: undefined;
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

// Combined Root Param List (Includes Auth, PaymentRequired, Main, and standalone screens)
export type RootStackParamList = {
  Auth: undefined; // Represents the AuthScreens navigator
  PaymentRequired: undefined; // NEW: Represents the PaymentRequiredStack navigator
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
    // Parameters for navigating from Event screens to Chat to pre-fill sharing
    sharedEventData?: {
      eventId: string;
      eventTitle: string;
      eventDate: string;
      eventVenue: string;
      eventImage: string;
      isSharing: boolean; 
    };
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
      // Parameters for navigating from Event screens to Chat to pre-fill sharing
      sharedEventData?: { 
        eventId: string;
        eventTitle: string;
        eventDate: string;
        eventVenue: string;
        eventImage: string;
        isSharing: boolean;
      };
  };
   GroupInfoScreen: { // Screen for viewing/managing group details
       groupId: string;
       groupName: string; // Required from GroupChatScreen
       groupImage: string | null; // Required from GroupChatScreen
   };
  AddGroupMembersScreen: {
       groupId: string;
       groupName?: string | null;
       cameFromGroupInfo?: boolean;
  };
  // *** END Group Chat Screens ***

  // ViewOrganizerProfileScreen REMOVED from RootStack
  ChatsScreen: undefined; // This screen is part of UserTabs

  // Define params for EventsScreen, as it can be navigated to with these specific params
  EventsScreen: {
    openEventId?: string;
    initialScreenTab?: 'forYou' | 'allEvents'; // Or your specific tab keys
  };

  NotFoundGlobal?: undefined;
  // Include signup flows here for direct navigation if needed during incomplete profile state
  MusicLoverSignUpFlow: undefined;
  OrganizerSignUpFlow: undefined;
};

// --- Create Navigators ---
const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStackNav = createNativeStackNavigator(); // No param list needed if simple
const PaymentRequiredStackNav = createNativeStackNavigator<PaymentRequiredStackParamList>(); // NEW
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

// NEW: PaymentRequiredStack - Acts as a mandatory gateway
const PaymentRequiredStack = () => (
  <PaymentRequiredStackNav.Navigator 
    screenOptions={{ 
      headerShown: false,
      gestureEnabled: false, // Prevent any gesture navigation
    }}
  >
    <PaymentRequiredStackNav.Screen 
      name="RequiredPaymentScreen" 
      component={RequiredPaymentScreen}
      options={{
        gestureEnabled: false, // Double ensure no gesture navigation
        headerShown: false,
      }}
    />
  </PaymentRequiredStackNav.Navigator>
);

// NEW: Web-specific vertical tab layout components
const WebVerticalTabsUser = () => {
  const navigation = useNavigation();
  const { unreadCount } = useUnreadCount();
  
  // Get current navigation state to determine active tab
  const currentRouteName = useNavigationState(state => {
    // Correctly find the deepest route name
    let route: any = state?.routes[state.index];
    while (route?.state) {
      route = route.state.routes[route.state.index];
    }
    return route?.name;
  });

  // Tab configuration for users
  const userTabs = [
    { name: 'Matches', icon: 'heart', label: 'Discover Vybs' },
    { name: 'Events', icon: 'calendar', label: 'Events' },
    { name: 'Chats', icon: 'message-square', label: 'Chats' },
    { name: 'Search', icon: 'search', label: 'Search' },
    { name: 'Profile', icon: 'user', label: 'Profile' },
  ];

  // Determine the active tab based on current route
  const getActiveTab = () => {
    if (userTabs.some(tab => tab.name === currentRouteName)) {
      return currentRouteName;
    }
    return null; // Don't fallback to a default tab
  };

  const activeTab = getActiveTab();

  const handleTabPress = (tabName: string) => {
    console.log(`[WebVerticalTabsUser] Tab pressed: ${tabName}`);
    
    try {
      // CRITICAL: Use reset for global navigation from any screen
      const userTabs = ['Matches', 'Events', 'Chats', 'Search', 'Profile'];
      const resetAction = {
        index: 0,
        routes: [
          {
            name: 'MainApp',
            state: {
              index: 0,
              routes: [
                {
                  name: 'UserTabs',
                  state: {
                    index: userTabs.indexOf(tabName),
                    routes: userTabs.map(tab => ({ name: tab })),
                  },
                },
              ],
            },
          },
        ],
      };
      
      (navigation as any).reset(resetAction);
    } catch (error) {
      console.warn('[WebVerticalTabsUser] Reset navigation failed, trying fallback:', error);
      // Fallback navigation
      try {
        (navigation as any).navigate('UserTabs', { screen: tabName });
      } catch (fallbackError) {
        console.error('[WebVerticalTabsUser] All navigation failed:', fallbackError);
      }
    }
  };

  const handleSettingsPress = () => {
    try {
      (navigation as any).navigate('UserSettingsScreen');
    } catch (error) {
      console.warn('[WebVerticalTabsUser] Settings navigation error:', error);
    }
  };

  return (
    <View style={styles.webContainer}>
      {/* Vertical Sidebar */}
      <View style={styles.webSidebar}>
        <View style={styles.webSidebarHeader}>
          <View style={styles.webLogo}>
            <Text style={styles.webLogoText}>vybr</Text>
            <Text style={styles.webLogoBadge}>WEB</Text>
          </View>
        </View>
        
        <View style={styles.webTabList}>
          {userTabs.map((tab) => {
            const isActive = activeTab === tab.name;
            const iconName = tab.icon as keyof typeof Feather.glyphMap;
            
            return (
              <TouchableOpacity
                key={tab.name}
                style={[
                  styles.webTabButton,
                  isActive ? styles.webTabButtonActive : styles.webTabButtonInactive
                ]}
                onPress={() => handleTabPress(tab.name)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', position: 'relative' }}>
                  <Feather 
                    name={iconName} 
                    size={22} 
                    color={isActive ? '#1E40AF' : '#64748B'} 
                  />
                  {/* Unread count badge for chat tab */}
                  {tab.name === 'Chats' && unreadCount > 0 && (
                    <View style={{
                      position: 'absolute',
                      top: -8,
                      right: -8,
                      backgroundColor: '#EF4444',
                      borderRadius: 10,
                      minWidth: 20,
                      height: 20,
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingHorizontal: 4,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.2,
                      shadowRadius: 2,
                      elevation: 2,
                    }}>
                      <Text style={{
                        color: 'white',
                        fontSize: 11,
                        fontWeight: '600',
                        textAlign: 'center',
                      }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[
                  styles.webTabLabel,
                  isActive ? styles.webTabLabelActive : styles.webTabLabelInactive
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        
        {/* Settings at bottom */}
        <View style={styles.webSidebarFooter}>
          <TouchableOpacity
            style={styles.webSettingsButton}
            onPress={handleSettingsPress}
          >
            <Feather name="settings" size={22} color="#64748B" />
            <Text style={styles.webSettingsLabel}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area - Use actual tab navigator */}
      <View style={styles.webContent}>
        <UserTabNav.Navigator
          screenOptions={({ route }) => ({
            tabBarStyle: { display: 'none' }, // Hide the bottom tab bar on web
            headerShown: false,
          })}
        >
          <UserTabNav.Screen name="Matches" component={MatchesScreen} />
          <UserTabNav.Screen name="Chats" component={ChatsScreen} />
          <UserTabNav.Screen name="Search" component={SearchScreen} />
          <UserTabNav.Screen name="Events" component={EventsScreen} />
          <UserTabNav.Screen name="Profile" component={ProfileScreen} />
        </UserTabNav.Navigator>
      </View>
    </View>
  );
};

const WebVerticalTabsOrganizer = () => {
  const navigation = useNavigation();
  
  // Get current navigation state to determine active tab
  const currentRouteName = useNavigationState(state => {
    // Correctly find the deepest route name
    let route: any = state?.routes[state.index];
    while (route?.state) {
      route = route.state.routes[route.state.index];
    }
    return route?.name;
  });

  // Tab configuration for organizers
  const organizerTabs = [
    { name: 'Posts', icon: 'layout', label: 'Events' },
    { name: 'Create', icon: 'plus-circle', label: 'Create' },
    { name: 'OrganizerProfile', icon: 'briefcase', label: 'Profile' },
  ];

  // Determine the active tab based on current route
  const getActiveTab = () => {
    if (organizerTabs.some(tab => tab.name === currentRouteName)) {
      return currentRouteName;
    }
    return null; // Don't fallback to a default tab
  };

  const activeTab = getActiveTab();

  console.log('[WebVerticalTabsOrganizer] Current route:', currentRouteName, 'Active tab:', activeTab);

  const handleTabPress = (tabName: string) => {
    console.log(`[WebVerticalTabsOrganizer] Tab pressed: ${tabName}`);
    
    try {
      // CRITICAL: Use reset for global navigation from any screen
      const organizerTabs = ['Posts', 'Create', 'OrganizerProfile'];
      const resetAction = {
        index: 0,
        routes: [
          {
            name: 'MainApp',
            state: {
              index: 0,
              routes: [
                {
                  name: 'OrganizerTabs',
                  state: {
                    index: organizerTabs.indexOf(tabName),
                    routes: organizerTabs.map(tab => ({ name: tab })),
                  },
                },
              ],
            },
          },
        ],
      };
      
      (navigation as any).reset(resetAction);
    } catch (error) {
      console.warn('[WebVerticalTabsOrganizer] Reset navigation failed, trying fallback:', error);
      // Fallback navigation
      try {
        (navigation as any).navigate('OrganizerTabs', { screen: tabName });
      } catch (fallbackError) {
        console.error('[WebVerticalTabsOrganizer] All navigation failed:', fallbackError);
      }
    }
  };

  const handleSettingsPress = () => {
    try {
      (navigation as any).navigate('OrganizerSettingsScreen');
    } catch (error) {
      console.warn('[WebVerticalTabsOrganizer] Settings navigation error:', error);
    }
  };

  return (
    <View style={styles.webContainer}>
      {/* Vertical Sidebar */}
      <View style={styles.webSidebar}>
        <View style={styles.webSidebarHeader}>
          <View style={styles.webLogo}>
            <Text style={styles.webLogoText}>vybr</Text>
            <Text style={styles.webLogoBadge}>WEB</Text>
          </View>
        </View>
        
        <View style={styles.webTabList}>
          {organizerTabs.map((tab) => {
            const isActive = activeTab === tab.name;
            const iconName = tab.icon as keyof typeof Feather.glyphMap;
            
            return (
              <TouchableOpacity
                key={tab.name}
                style={[
                  styles.webTabButton,
                  isActive ? styles.webTabButtonActive : styles.webTabButtonInactive
                ]}
                onPress={() => handleTabPress(tab.name)}
              >
                <Feather 
                  name={iconName} 
                  size={22} 
                  color={isActive ? '#1E40AF' : '#64748B'} 
                />
                <Text style={[
                  styles.webTabLabel,
                  isActive ? styles.webTabLabelActive : styles.webTabLabelInactive
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        
        {/* Settings at bottom */}
        <View style={styles.webSidebarFooter}>
          <TouchableOpacity
            style={styles.webSettingsButton}
            onPress={handleSettingsPress}
          >
            <Feather name="settings" size={22} color="#64748B" />
            <Text style={styles.webSettingsLabel}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area - Use actual tab navigator */}
      <View style={styles.webContent}>
        <OrganizerTabNav.Navigator
          screenOptions={({ route }) => ({
            tabBarStyle: { display: 'none' }, // Hide the bottom tab bar on web
            headerShown: false,
          })}
        >
          <OrganizerTabNav.Screen name="Posts" component={OrganizerPostsScreen} options={{ title: "Events" }} />
          <OrganizerTabNav.Screen name="Create" component={CreateEventScreen} options={{ title: "Create" }} />
          <OrganizerTabNav.Screen name="OrganizerProfile" component={OrganizerProfileScreen} options={{ title: "Profile" }} />
        </OrganizerTabNav.Navigator>
      </View>
    </View>
  );
};

// ORIGINAL: Mobile bottom tab components (unchanged for mobile compatibility)
const MobileUserTabs = () => {
  const { unreadCount } = useUnreadCount();
  
  return (
    <UserTabNav.Navigator screenOptions={({ route }) => ({ 
      tabBarIcon: ({ focused, color, size }) => { 
        let iconName: keyof typeof Feather.glyphMap = "help-circle"; 
        if (route.name === "Matches") iconName = "heart"; 
        else if (route.name === "Chats") iconName = "message-square"; 
        else if (route.name === "Search") iconName = "search"; 
        else if (route.name === "Events") iconName = "calendar"; 
        else if (route.name === "Profile") iconName = "user"; 
        
        return (
          <View style={{ position: 'relative' }}>
            <Feather name={iconName} size={size} color={color} />
            {/* Unread count badge for chat tab */}
            {route.name === 'Chats' && unreadCount > 0 && (
              <View style={{
                position: 'absolute',
                top: -8,
                right: -8,
                backgroundColor: '#EF4444',
                borderRadius: 10,
                minWidth: 20,
                height: 20,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 4,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
                elevation: 2,
              }}>
                <Text style={{
                  color: 'white',
                  fontSize: 11,
                  fontWeight: '600',
                  textAlign: 'center',
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        );
      }, 
      tabBarActiveTintColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', 
      tabBarInactiveTintColor: APP_CONSTANTS?.COLORS?.DISABLED || '#9CA3AF', 
      tabBarStyle: styles.tabBarStyle, 
      headerShown: false, 
      tabBarShowLabel: true, 
    })}>
      <UserTabNav.Screen name="Matches" component={MatchesScreen} />
      <UserTabNav.Screen name="Chats" component={ChatsScreen} />
      <UserTabNav.Screen name="Search" component={SearchScreen} />
      <UserTabNav.Screen name="Events" component={EventsScreen} />
      <UserTabNav.Screen name="Profile" component={ProfileScreen} />
    </UserTabNav.Navigator> 
  );
};

const MobileOrganizerTabs = () => ( 
  <OrganizerTabNav.Navigator screenOptions={({ route }) => ({ 
    tabBarIcon: ({ focused, color, size }) => { 
      let iconName: keyof typeof Feather.glyphMap = "help-circle"; 
      if (route.name === "Posts") iconName = "layout"; 
      else if (route.name === "Create") iconName = "plus-circle"; 
      else if (route.name === "OrganizerProfile") iconName = "briefcase"; 
      return <Feather name={iconName} size={size} color={color} />; 
    }, 
    tabBarActiveTintColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', 
    tabBarInactiveTintColor: APP_CONSTANTS?.COLORS?.DISABLED || '#9CA3AF', 
    tabBarStyle: styles.tabBarStyle, 
    headerShown: false, 
    tabBarShowLabel: true, 
  })}>
    <OrganizerTabNav.Screen name="Posts" component={OrganizerPostsScreen} options={{ title: "Events" }} />
    <OrganizerTabNav.Screen name="Create" component={CreateEventScreen} options={{ title: "Create" }} />
    <OrganizerTabNav.Screen name="OrganizerProfile" component={OrganizerProfileScreen} options={{ title: "Profile" }} />
  </OrganizerTabNav.Navigator> 
);

// NEW: Web Layout Wrapper - provides sidebar for all screens on web
const WebLayoutWrapper = ({ children, isOrganizerMode = false }: { children: React.ReactNode, isOrganizerMode?: boolean }) => {
  const navigation = useNavigation();
  const { unreadCount } = useUnreadCount();
  
  // Get current navigation state to determine active tab
  const currentRouteName = useNavigationState(state => {
    // Correctly find the deepest route name
    let route: any = state?.routes[state.index];
    while (route?.state) {
      route = route.state.routes[route.state.index];
    }
    return route?.name;
  });

  // Tab configurations
  const userTabs = [
    { name: 'Matches', icon: 'heart', label: 'Discover Vybs' },
    { name: 'Events', icon: 'calendar', label: 'Events' },
    { name: 'Chats', icon: 'message-square', label: 'Chats' },
    { name: 'Search', icon: 'search', label: 'Search' },
    { name: 'Profile', icon: 'user', label: 'Profile' },
  ];

  const organizerTabs = [
    { name: 'Posts', icon: 'layout', label: 'Events' },
    { name: 'Create', icon: 'plus-circle', label: 'Create' },
    { name: 'OrganizerProfile', icon: 'briefcase', label: 'Profile' },
  ];

  const tabs = isOrganizerMode ? organizerTabs : userTabs;

  // Determine the active tab based on current route
  const getActiveTab = () => {
    if (tabs.some(tab => tab.name === currentRouteName)) {
      return currentRouteName;
    }
    return null; // Return null if no tab is active
  };

  const activeTab = getActiveTab();

  console.log('[WebLayoutWrapper] Current route:', currentRouteName, 'Active tab:', activeTab, 'isOrganizerMode:', isOrganizerMode);

  const handleTabPress = (tabName: string) => {
    console.log(`[WebLayoutWrapper] Tab pressed: ${tabName} (isOrganizerMode: ${isOrganizerMode})`);
    
    try {
      // CRITICAL: Use reset to ensure clean navigation state
      // This prevents stacking and ensures instant navigation from any screen
      const resetAction = {
        index: 0,
        routes: [
          {
            name: 'MainApp',
            state: {
              index: 0,
              routes: [
                {
                  name: isOrganizerMode ? 'OrganizerTabs' : 'UserTabs',
                  state: {
                    index: tabs.findIndex(tab => tab.name === tabName) || 0,
                    routes: tabs.map(tab => ({ name: tab.name })),
                  },
                },
              ],
            },
          },
        ],
      };
      
      (navigation as any).reset(resetAction);
    } catch (error) {
      console.warn(`[WebLayoutWrapper] Reset navigation failed, trying direct navigate:`, error);
      // Fallback: Direct navigation
      try {
        if (isOrganizerMode) {
          (navigation as any).navigate('OrganizerTabs', { screen: tabName });
        } else {
          (navigation as any).navigate('UserTabs', { screen: tabName });
        }
      } catch (fallbackError) {
        console.error(`[WebLayoutWrapper] All navigation attempts failed:`, fallbackError);
        // Last resort: navigate to root and then tab
        (navigation as any).navigate('MainApp');
        setTimeout(() => {
          if (isOrganizerMode) {
            (navigation as any).navigate('OrganizerTabs', { screen: tabName });
          } else {
            (navigation as any).navigate('UserTabs', { screen: tabName });
          }
        }, 100);
      }
    }
  };

  const handleSettingsPress = () => {
    console.log(`[WebLayoutWrapper] Settings pressed (isOrganizerMode: ${isOrganizerMode})`);
    try {
      if (isOrganizerMode) {
        (navigation as any).navigate('OrganizerSettingsScreen');
      } else {
        (navigation as any).navigate('UserSettingsScreen');
      }
    } catch (error) {
      console.error(`[WebLayoutWrapper] Settings navigation failed:`, error);
    }
  };

  return (
    <View style={styles.webContainer}>
      {/* Vertical Sidebar */}
      <View style={styles.webSidebar}>
        <View style={styles.webSidebarHeader}>
          <View style={styles.webLogo}>
            <Text style={styles.webLogoText}>vybr</Text>
            <Text style={styles.webLogoBadge}>WEB</Text>
          </View>
        </View>
        
        <View style={styles.webTabList}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.name;
            const iconName = tab.icon as keyof typeof Feather.glyphMap;
            
            return (
              <TouchableOpacity
                key={tab.name}
                style={[
                  styles.webTabButton,
                  isActive ? styles.webTabButtonActive : styles.webTabButtonInactive
                ]}
                onPress={() => handleTabPress(tab.name)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', position: 'relative' }}>
                  <Feather 
                    name={iconName} 
                    size={22} 
                    color={isActive ? '#1E40AF' : '#64748B'} 
                  />
                  {/* Unread count badge for chat tab (only for users) */}
                  {!isOrganizerMode && tab.name === 'Chats' && unreadCount > 0 && (
                    <View style={{
                      position: 'absolute',
                      top: -8,
                      right: -8,
                      backgroundColor: '#EF4444',
                      borderRadius: 10,
                      minWidth: 20,
                      height: 20,
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingHorizontal: 4,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.2,
                      shadowRadius: 2,
                      elevation: 2,
                    }}>
                      <Text style={{
                        color: 'white',
                        fontSize: 11,
                        fontWeight: '600',
                        textAlign: 'center',
                      }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[
                  styles.webTabLabel,
                  isActive ? styles.webTabLabelActive : styles.webTabLabelInactive
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        
        {/* Settings at bottom */}
        <View style={styles.webSidebarFooter}>
          <TouchableOpacity
            style={styles.webSettingsButton}
            onPress={handleSettingsPress}
          >
            <Feather name="settings" size={22} color="#64748B" />
            <Text style={styles.webSettingsLabel}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.webContent}>
        {children}
      </View>
    </View>
  );
};

// Platform-aware tab components
const UserTabs = () => {
  if (Platform.OS === 'web') {
    return <WebVerticalTabsUser />;
  }
  return <MobileUserTabs />;
};

const OrganizerTabs = () => {
  if (Platform.OS === 'web') {
    return <WebVerticalTabsOrganizer />;
  }
  return <MobileOrganizerTabs />;
};

// --- Enhanced Payment Requirement Logic with Real Payment Method Validation ---
const usePaymentRequirementCheck = () => {
  const { session, loading, musicLoverProfile, organizerProfile, isSetupInProgress } = useAuth();
  const [hasActualPaymentMethods, setHasActualPaymentMethods] = useState<boolean | null>(null);
  const [paymentCheckLoading, setPaymentCheckLoading] = useState<boolean>(false);

  const userId = session?.user?.id;
  let userType = session?.userType ||
    (session?.user as any)?.user_metadata?.user_type ||
    (session?.user as any)?.user_metadata?.userType ||
    (session?.user as any)?.app_metadata?.user_type ||
    (session?.user as any)?.app_metadata?.userType;

  // Fallback 1: Check profile data for userType
  if (!userType && musicLoverProfile) {
    userType = 'music_lover';
  }
  if (!userType && organizerProfile) {
    userType = 'organizer';
  }
  
  // Fallback 2: Check URL path (for signup flows) - only on web
  if (!userType && typeof window !== 'undefined' && Platform.OS === 'web') {
    const currentPath = window.location.pathname;
    if (currentPath.includes('MusicLover')) {
      userType = 'music_lover';
    } else if (currentPath.includes('Organizer')) {
      userType = 'organizer';
    }
  }
  
  // Fallback 3: Default to music_lover if still undefined (most common case)
  if (!userType && session) {
    userType = 'music_lover';
    console.log("[AppNavigator] ⚠️ UserType was undefined, defaulting to music_lover");
  }
  
  const isOrganizer = userType === 'organizer';
  const isPremiumUser = musicLoverProfile?.isPremium ?? false;
  
  // Profile completion check
  const isProfileComplete = session && ( 
    (session.userType === 'music_lover' && musicLoverProfile) || 
    (session.userType === 'organizer' && organizerProfile) 
  );
  
  // Payment requirement logic
  const isPaymentMethodRequired = isOrganizer || (userType === 'music_lover' && isPremiumUser);
  
  // Enhanced Stripe customer ID check - check both possible fields for safety
  const currentStripeCustomerId = isOrganizer 
    ? (organizerProfile as any)?.stripe_customer_id 
    : (musicLoverProfile as any)?.stripe_customer_id;
    
  // ENHANCED: Check for actual payment methods when customer ID exists
  useEffect(() => {
    const checkActualPaymentMethods = async () => {
      if (!currentStripeCustomerId || !isPaymentMethodRequired || !isProfileComplete) {
        setHasActualPaymentMethods(null);
        return;
      }

      console.log("[AppNavigator] Checking actual payment methods for customer:", currentStripeCustomerId);
      setPaymentCheckLoading(true);
      
      try {
        const { data, error } = await supabase.functions.invoke('list-organizer-payment-methods', {
          body: JSON.stringify({
            customerId: currentStripeCustomerId
          })
        });

        if (error) {
          console.error("[AppNavigator] Error checking payment methods:", error);
          setHasActualPaymentMethods(false);
          return;
        }

        const hasPaymentMethods = data?.paymentMethods && data.paymentMethods.length > 0;
        console.log("[AppNavigator] Payment methods check result:", {
          count: data?.paymentMethods?.length || 0,
          hasPaymentMethods
        });
        
        setHasActualPaymentMethods(hasPaymentMethods);
      } catch (error) {
        console.error("[AppNavigator] Exception checking payment methods:", error);
        setHasActualPaymentMethods(false);
      } finally {
        setPaymentCheckLoading(false);
      }
    };

    checkActualPaymentMethods();
  }, [currentStripeCustomerId, isPaymentMethodRequired, isProfileComplete]);
    
  // CORRECTED: Valid payment method means both customer ID exists AND actual payment methods exist
  const hasValidPaymentMethod = Boolean(
    currentStripeCustomerId && 
    currentStripeCustomerId.trim() !== '' && 
    hasActualPaymentMethods === true
  );
  
  // CRITICAL: Payment is required if user needs it AND doesn't have ACTUAL payment methods
  const requiresPaymentScreen = isPaymentMethodRequired && isProfileComplete && !hasValidPaymentMethod;
  
  // CRITICAL: Include setup loading state to prevent navigation bouncing
  const overallLoading = loading || isSetupInProgress || (isPaymentMethodRequired && isProfileComplete && paymentCheckLoading);

  // Enhanced debugging with timestamp for monitoring changes
  console.log("[AppNavigator] ========================= " + new Date().toISOString());
  console.log("[AppNavigator] Auth State:", loading ? "Loading" : session ? `Authenticated (${session.userType})` : "No Authentication");
  console.log("[AppNavigator] Setup In Progress:", isSetupInProgress);
  console.log("[AppNavigator] User ID:", userId);
  console.log("[AppNavigator] Profile Complete:", isProfileComplete);
  console.log("[AppNavigator] Is Organizer:", isOrganizer);
  console.log("[AppNavigator] Is Premium User:", isPremiumUser);
  console.log("[AppNavigator] Payment Required:", isPaymentMethodRequired);
  console.log("[AppNavigator] Stripe Customer ID:", currentStripeCustomerId ? `${currentStripeCustomerId.substring(0, 10)}...` : 'None');
  console.log("[AppNavigator] Payment Check Loading:", paymentCheckLoading);
  console.log("[AppNavigator] Has Actual Payment Methods:", hasActualPaymentMethods);
  console.log("[AppNavigator] Has Valid Payment Method:", hasValidPaymentMethod);
  console.log("[AppNavigator] REQUIRES PAYMENT SCREEN:", requiresPaymentScreen);
  console.log("[AppNavigator] 🔄 OVERALL LOADING:", overallLoading);
  console.log("[AppNavigator] =========================");

  return {
    loading: overallLoading,
    session,
    isProfileComplete,
    requiresPaymentScreen,
    userType,
    isOrganizer,
    isPremiumUser,
    isPaymentMethodRequired,
    hasValidPaymentMethod,
    currentStripeCustomerId,
    hasActualPaymentMethods,
  };
};

// Helper function to wrap screen components with sidebar on web
const wrapScreenForWeb = (ScreenComponent: React.ComponentType<any>, isOrganizerMode: boolean) => {
  return (props: any) => {
    if (Platform.OS === 'web') {
      return (
        <WebLayoutWrapper isOrganizerMode={isOrganizerMode}>
          <ScreenComponent {...props} />
        </WebLayoutWrapper>
      );
    }
    return <ScreenComponent {...props} />;
  };
};

// --- Main App Stack Component (NO PaymentGuard here anymore) ---
const MainAppStack = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { isOrganizerMode } = useOrganizerMode();
  const { session, loading, musicLoverProfile } = useAuth();
  const [initialRouteName, setInitialRouteName] = useState<keyof MainStackParamList | null>(null);

  return (
      <MainStack.Navigator screenOptions={{ headerShown: false, contentStyle: styles.cardStyle }} >
          {isOrganizerMode ? (
               <>
                   <MainStack.Screen name="OrganizerTabs" component={OrganizerTabs} options={{ headerShown: false }} />
                   <MainStack.Screen name="EventDetail" component={wrapScreenForWeb(EventDetailScreen, true)} options={{ title: 'Event Details' }}/>
                   <MainStack.Screen name="EditEvent" component={wrapScreenForWeb(EditEventScreen, true)} options={{ title: 'Edit Event' }}/>
                   <MainStack.Screen name="ViewBookings" component={wrapScreenForWeb(ViewBookingsScreen, true)} options={{ title: 'Event Bookings' }}/>
                   <MainStack.Screen name="OrganizerSettingsScreen" component={wrapScreenForWeb(OrganizerSettingsScreen, true)} options={{ title: 'Settings' }}/>
                   <MainStack.Screen name="SetAvailabilityScreen" component={wrapScreenForWeb(SetAvailabilityScreen, true)} options={{ title: 'Set Availability' }}/>
                   <MainStack.Screen name="EditOrganizerProfileScreen" component={wrapScreenForWeb(EditOrganizerProfileScreen, true)} options={{ title: 'Edit Profile' }}/>
                   <MainStack.Screen name="ManagePlanScreen" component={wrapScreenForWeb(ManagePlanScreen, true)} options={{ title: 'Manage Plan' }}/>
                   <MainStack.Screen name="OrgBillingHistoryScreen" component={wrapScreenForWeb(OrgBillingHistoryScreen, true)} options={{ title: 'Billing History' }}/>
                   <MainStack.Screen name="UserListScreen" component={wrapScreenForWeb(UserListScreen, true)} options={{ title: 'Followers' }}/>
                   <MainStack.Screen name="OverallAnalyticsScreen" component={wrapScreenForWeb(OverallAnalyticsScreen, true)} options={{ title: 'Overall Analytics' }}/>
                   <MainStack.Screen name="ShareEventScreen" component={wrapScreenForWeb(ShareEventScreen, true)} options={{ title: 'Share Event' }}/>
                   <MainStack.Screen name="OrganizerReservationsScreen" component={wrapScreenForWeb(OrganizerReservationsScreen, true)} options={{ title: 'Organizer Reservations' }}/>
               </>
          ) : (
               <>
                   <MainStack.Screen name="UserTabs" component={UserTabs} options={{ headerShown: false }}/>
                   <MainStack.Screen name="UserSettingsScreen" component={wrapScreenForWeb(UserSettingsScreen, false)} options={{ title: 'Settings' }} />
                   <MainStack.Screen name="EditUserProfileScreen" component={wrapScreenForWeb(EditUserProfileScreen, false)} options={{ title: 'Edit Profile' }} />
                   <MainStack.Screen name="UserManageSubscriptionScreen" component={wrapScreenForWeb(UserManageSubscriptionScreen, false)} options={{ title: 'Subscription' }} />
                   <MainStack.Screen name="ManagePlan" component={wrapScreenForWeb(ManagePlanScreen, false)} options={{ title: 'Manage Plan' }} />
                   <MainStack.Screen name="UserMutedListScreen" component={wrapScreenForWeb(UserMutedListScreen, false)} options={{ title: 'Muted Users' }} />
                   <MainStack.Screen name="UserBlockedListScreen" component={wrapScreenForWeb(UserBlockedListScreen, false)} options={{ title: 'Blocked Users' }} />
                   <MainStack.Screen name="FriendsListScreen" component={wrapScreenForWeb(FriendsListScreen, false)} options={{ title: 'Friends' }} />
                   <MainStack.Screen name="OrganizerListScreen" component={wrapScreenForWeb(OrganizerListScreen, false)} options={{ title: 'Following' }}/>
                   <MainStack.Screen name="UpgradeScreen" component={wrapScreenForWeb(UpgradeScreen, false)} options={{ title: 'Go Premium' }} />
                   <MainStack.Screen name="AttendedEventsScreen" component={wrapScreenForWeb(AttendedEventsScreen, false)} options={{ title: 'Attended Events' }} />
                   <MainStack.Screen name="UserBillingHistoryScreen" component={wrapScreenForWeb(UserBillingHistoryScreen, false)} options={{ title: 'Billing History' }} />
                   <MainStack.Screen name="UpdateMusicFavoritesScreen" component={wrapScreenForWeb(UpdateMusicFavoritesScreen, false)} options={{ title: 'Music Favorites' }} />
                   <MainStack.Screen name="LinkMusicServicesScreen" component={wrapScreenForWeb(LinkMusicServicesScreen, false)} options={{ title: 'Link Music Services' }} />
                   <MainStack.Screen name="MyBookingsScreen" component={wrapScreenForWeb(MyBookingsScreen, false)} />
                   <MainStack.Screen name="PremiumSignupScreen" component={wrapScreenForWeb(PremiumSignupScreen, false)} options={{ title: 'Payment' }} />
                   <MainStack.Screen name="PaymentConfirmationScreen" component={wrapScreenForWeb(PaymentConfirmationScreen, false)} options={{ title: 'Payment Confirmation' }} />
                   <MainStack.Screen name="PaymentSuccessScreen" component={wrapScreenForWeb(PaymentSuccessScreen, false)} />
                   <MainStack.Screen name="ShareEventScreen" component={wrapScreenForWeb(ShareEventScreen, false)} options={{ title: 'Share Event' }}/>
               </>
          )}
          {/* Screens accessible by both modes */}
          <MainStack.Screen name="CreateEventScreen" component={wrapScreenForWeb(CreateEventScreen, isOrganizerMode)} options={{title: "Create Event"}} />
          <MainStack.Screen name="OtherUserProfileScreen" component={wrapScreenForWeb(OtherUserProfileScreen, isOrganizerMode)} options={{title: "Profile"}} />
          <MainStack.Screen name="BookingConfirmation" component={wrapScreenForWeb(BookingConfirmationScreen, isOrganizerMode)} options={{ title: 'Booking Confirmed' }} />
          <MainStack.Screen name="UpcomingEventsListScreen" component={wrapScreenForWeb(UpcomingEventsListScreen, isOrganizerMode)} />
          <MainStack.Screen name="PastEventsListScreen" component={wrapScreenForWeb(PastEventsListScreen, isOrganizerMode)} />
          {/* *** ViewOrganizerProfileScreen now registered in Main Stack *** */}
          <MainStack.Screen name="ViewOrganizerProfileScreen" component={wrapScreenForWeb(ViewOrganizerProfileScreen, isOrganizerMode)} />
          {/* *** END Move *** */}
          <MainStack.Screen name="NotFoundMain" component={wrapScreenForWeb(NotFoundScreen, isOrganizerMode)} options={{ title: 'Oops!' }} />
      </MainStack.Navigator>
  );
}

// --- Root Navigator Logic with Enhanced Payment Protection ---
const AppNavigator = () => {
  const {
    loading,
    session,
    isProfileComplete,
    requiresPaymentScreen,
    userType,
    currentStripeCustomerId,
  } = usePaymentRequirementCheck();

  // Monitor payment method changes and force re-evaluation
  useEffect(() => {
    console.log("[AppNavigator] Payment method change detected, stripe_customer_id:", currentStripeCustomerId ? `${currentStripeCustomerId.substring(0, 10)}...` : 'None');
    // This effect will trigger re-renders when payment method changes
  }, [currentStripeCustomerId]);

  if (loading) { 
    console.log("[AppNavigator] Showing loading screen...");
    return <LoadingScreen />; 
  }

  return (
      <RootStack.Navigator screenOptions={{ headerShown: false }} >
        {!session ? (
          // 1. Not Logged In - Show Auth
          <RootStack.Screen name="Auth" component={AuthScreens} />
        ) : !isProfileComplete ? (
          // 2. Logged In, Profile Incomplete - Complete Signup
          <RootStack.Screen
            name={userType === 'music_lover' ? "MusicLoverSignUpFlow" : "OrganizerSignUpFlow"}
            component={userType === 'music_lover' ? MusicLoverSignUpFlow : OrganizerSignUpFlow}
            options={{ gestureEnabled: false }}
          />
        ) : requiresPaymentScreen ? (
          // 3. 🚨 CRITICAL: Payment Required - Show PaymentRequiredStack (BULLETPROOF MIDDLEMAN)
          <RootStack.Screen 
            name="PaymentRequired" 
            component={PaymentRequiredStack}
            options={{ 
              gestureEnabled: false, // Prevent any swipe navigation
              headerShown: false,
            }}
          />
        ) : (
          // 4. Fully Authenticated and Payment Complete - Show Main App
          <>
            {/* Main App entry point (renders MainAppStack) */}
            <RootStack.Screen name="MainApp" component={MainAppStack} />

            {/* Screens pushed on top of MainApp */}
            <RootStack.Screen
              name="IndividualChatScreen"
              component={IndividualChatScreen}
              options={{ headerShown: false, headerBackTitleVisible: false }} // Custom header
            />
            <RootStack.Screen
              name="OtherUserProfileScreen"
              component={OtherUserProfileScreen}
              options={{ headerShown: false, headerBackTitleVisible: false }} // Custom header
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
                options={{ headerShown: false, headerBackTitleVisible: false }} // Custom header
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
    cardStyle: {
        backgroundColor: '#FFFFFF',
    },
    // NEW: Web-specific styles for vertical tab layout
    webContainer: {
        flexDirection: 'row',
        flex: 1,
        backgroundColor: '#FFFFFF',
        height: '100%',
    },
    webSidebar: {
        width: 300,
        backgroundColor: '#FAFBFC',
        borderRightWidth: 1,
        borderRightColor: '#E2E8F0',
        flexDirection: 'column',
        paddingVertical: 32,
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    webSidebarHeader: {
        marginBottom: 40,
        alignItems: 'center',
        paddingBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    webLogo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    webLogoText: {
        fontSize: 32,
        fontWeight: '700',
        color: '#3B82F6',
        fontFamily: Platform.OS === 'web' ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' : 'System',
    },
    webLogoBadge: {
        fontSize: 9,
        fontWeight: '700',
        color: '#64748B',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginLeft: 12,
        fontFamily: Platform.OS === 'web' ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' : 'System',
    },
    webTabList: {
        flex: 1,
        paddingVertical: 12,
    },
    webTabButton: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderRadius: 12,
        marginBottom: 6,
    },
    webTabButtonActive: {
        backgroundColor: '#EEF2FF',
        borderWidth: 1,
        borderColor: '#C7D2FE',
        shadowColor: '#3730A3',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 2,
    },
    webTabButtonInactive: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    webTabLabel: {
        marginLeft: 16,
        fontWeight: '600',
        fontSize: 15,
        fontFamily: Platform.OS === 'web' ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' : 'System',
    },
    webTabLabelActive: {
        color: '#1E40AF',
        fontWeight: '600',
    },
    webTabLabelInactive: {
        color: '#64748B',
        fontWeight: '500',
    },
    webSettingsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: 'transparent',
    },
    webSettingsLabel: {
        marginLeft: 12,
        fontSize: 14,
        fontWeight: '500',
        color: '#64748B',
        fontFamily: Platform.OS === 'web' ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' : 'System',
    },
    webSidebarFooter: {
        marginTop: 32,
        paddingTop: 24,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    webContent: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
    },
});

export default AppNavigator;