// navigation/AppNavigator.tsx
import React from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useOrganizerMode } from "@/hooks/useOrganizerMode";
import { useAuth } from "@/hooks/useAuth";
import { APP_CONSTANTS } from "@/config/constants";

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
export type RootStackParamList = {
    Auth: undefined;
    MusicLoverSignUpFlow: undefined;
    OrganizerSignUpFlow: undefined;
    MainApp: { screen?: keyof MainStackParamList, params?: { screen?: keyof UserTabParamList | keyof OrganizerTabParamList, params?: any } };
    IndividualChatScreen: {
      matchUserId: string;
      matchName: string;
      matchProfilePicture?: string | null;
    };
    OtherUserProfileScreen: { userId: string };
    NotFoundGlobal?: undefined;
};

export type MainStackParamList = {
    UserTabs: { screen?: keyof UserTabParamList, params?: any };
    OrganizerTabs: { screen?: keyof OrganizerTabParamList, params?: any };
    EventDetail: { eventId: string };
    EditEvent: { eventId: string };
    BookingConfirmation: { eventId: string; eventTitle: string; quantity: number; pricePerItemDisplay: string; totalPriceDisplay: string; bookingType: 'TICKETED' | 'RESERVATION'; rawPricePerItem: number | null; rawTotalPrice: number | null; rawFeePaid: number | null; maxTickets: number | null; maxReservations: number | null; };
    UserSettingsScreen: undefined;
    OrganizerSettingsScreen: undefined;
    EditUserProfileScreen: undefined;
    UserManageSubscriptionScreen: undefined;
    UserMutedListScreen: undefined;
    UserBlockedListScreen: undefined;
    FriendsListScreen: undefined;
    UpgradeScreen: undefined;
    EditOrganizerProfileScreen: undefined;
    OrgManagePlanScreen: undefined;
    OrgBillingHistoryScreen: undefined;
    NotFoundMain: undefined;
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
const MainAppStack = () => {
  const { isOrganizerMode } = useOrganizerMode();
  return (
    <MainStack.Navigator screenOptions={{ headerShown: true }} >
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
                 <MainStack.Screen name="UserSettingsScreen" component={UserSettingsScreen} options={{ title: 'Settings' }} />
                 <MainStack.Screen name="EditUserProfileScreen" component={EditUserProfileScreen} options={{ title: 'Edit Profile' }} />
                 <MainStack.Screen name="UserManageSubscriptionScreen" component={UserManageSubscriptionScreen} options={{ title: 'Subscription' }} />
                 <MainStack.Screen name="UserMutedListScreen" component={UserMutedListScreen} options={{ title: 'Muted Users' }} />
                 <MainStack.Screen name="UserBlockedListScreen" component={UserBlockedListScreen} options={{ title: 'Blocked Users' }} />
                 <MainStack.Screen name="FriendsListScreen" component={FriendsListScreen} options={{ title: 'Friends' }} />
                 <MainStack.Screen name="UpgradeScreen" component={UpgradeScreen} options={{ title: 'Go Premium' }} />
             </>
        )}
        {/* Screens accessible by both modes */}
        <MainStack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} options={{ title: 'Booking Confirmed' }} />
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
          <RootStack.Screen name="Auth" component={AuthScreens} />
        ) : !isProfileComplete ? (
           <RootStack.Screen
             name={session.userType === 'music_lover' ? "MusicLoverSignUpFlow" : "OrganizerSignUpFlow"}
             component={session.userType === 'music_lover' ? MusicLoverSignUpFlow : OrganizerSignUpFlow}
             options={{ gestureEnabled: false }}
           />
        ) : (
          <>
            <RootStack.Screen name="MainApp" component={MainAppStack} />
            <RootStack.Screen
              name="IndividualChatScreen"
              component={IndividualChatScreen}
              options={{ headerShown: false }} // Header managed internally
            />
            <RootStack.Screen
              name="OtherUserProfileScreen"
              component={OtherUserProfileScreen}
              options={{ headerShown: false }} // Header managed internally
            />
          </>
        )}
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