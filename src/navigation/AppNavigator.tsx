import React from 'react';
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainerRef } from '@react-navigation/native'; // Keep if used
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useOrganizerMode } from "@/hooks/useOrganizerMode"; // Adjust path if needed
import { useAuth } from "@/hooks/useAuth"; // Adjust path if needed
import { APP_CONSTANTS } from "@/config/constants"; // Adjust path if needed

// Import screens (Ensure paths are correct)
import MatchesScreen from "@/screens/MatchesScreen";
import ChatsScreen from "@/screens/ChatsScreen";
import SearchScreen from "@/screens/SearchScreen";
import EventsScreen from "@/screens/EventsScreen";
import ProfileScreen from "@/screens/ProfileScreen"; // Assuming this is User Profile
import CreateEventScreen from "@/screens/CreateEventScreen";
import NotFoundScreen from "@/screens/NotFoundScreen";
import OrganizerPostsScreen from "@/screens/organizer/OrganizerPostsScreen";
import OrganizerProfileScreen from "@/screens/organizer/OrganizerProfileScreen";
import EventDetailScreen from "@/screens/organizer/EventDetailScreen";
import EditEventScreen from "@/screens/EditEventScreen";
import BookingConfirmationScreen from "@/screens/BookingConfirmationScreen"; // IMPORTED

// Import auth screens
import LandingScreen from "@/screens/auth/LandingScreen"; // Adjust path if needed
import LoginScreen from "@/screens/auth/LoginScreen"; // Adjust path if needed
import MusicLoverSignUpFlow from "@/screens/auth/MusicLoverSignUpFlow"; // Adjust path if needed
import OrganizerSignUpFlow from "@/screens/auth/OrganizerSignUpFlow"; // Adjust path if needed

// --- Define Param Lists ---
type RootStackParamList = {
    Auth: undefined;
    MusicLoverSignUpFlow: undefined;
    OrganizerSignUpFlow: undefined;
    MainApp: undefined; // Nested navigator
    NotFoundGlobal?: undefined;
};

type MainStackParamList = {
    UserTabs: { screen?: keyof UserTabParamList }; // Nested navigator with optional initial screen
    OrganizerTabs: { screen?: keyof OrganizerTabParamList }; // Nested navigator with optional initial screen
    EventDetail: { eventId: string };
    EditEvent: { eventId: string };
    BookingConfirmation: { // Added confirmation screen params
        eventId: string;
        eventTitle: string;
        quantity: number;
        pricePerItemDisplay: string;
        totalPriceDisplay: string;
        bookingType: 'TICKETED' | 'RESERVATION';
        rawPricePerItem: number | null;
        rawTotalPrice: number | null;
        rawFeePaid: number | null;
        maxTickets: number | null;
        maxReservations: number | null;
    };
    NotFoundMain: undefined;
    // Add other screens like ViewBookings, UserEventDetail if needed
};

type UserTabParamList = {
    Matches: undefined;
    Chats: undefined;
    Search: undefined;
    Events: undefined;
    Profile: undefined;
};

type OrganizerTabParamList = {
    Posts: undefined;
    Create: undefined;
    OrganizerProfile: undefined;
};

// Create navigators
const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStackNav = createNativeStackNavigator(); // Keep simple
const MainStack = createNativeStackNavigator<MainStackParamList>();
const Tab = createBottomTabNavigator(); // Keep simple

// Loading Component
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
  </View>
);

// Auth navigator stack
const AuthScreens = () => {
  return (
    <AuthStackNav.Navigator screenOptions={{ headerShown: false }}>
      <AuthStackNav.Screen name="Landing" component={LandingScreen} />
      <AuthStackNav.Screen name="MusicLoverLogin">
        {(props) => <LoginScreen {...props} userType="music_lover" />}
      </AuthStackNav.Screen>
      <AuthStackNav.Screen name="OrganizerLogin">
        {(props) => <LoginScreen {...props} userType="organizer" />}
      </AuthStackNav.Screen>
      <AuthStackNav.Screen name="MusicLoverSignUpFlow" component={MusicLoverSignUpFlow} />
      <AuthStackNav.Screen name="OrganizerSignUpFlow" component={OrganizerSignUpFlow} />
    </AuthStackNav.Navigator>
  );
};

// Tab navigator for user mode
const UserTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Feather.glyphMap = "help-circle";
          if (route.name === "Matches") iconName = "heart";
          else if (route.name === "Chats") iconName = "message-square";
          else if (route.name === "Search") iconName = "search";
          else if (route.name === "Events") iconName = "calendar";
          else if (route.name === "Profile") iconName = "user";
          return <Feather name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: APP_CONSTANTS.COLORS.PRIMARY,
        tabBarInactiveTintColor: APP_CONSTANTS.COLORS.DISABLED,
        tabBarStyle: styles.tabBarStyle,
        headerShown: false,
        tabBarShowLabel: true,
      })}
    >
      <Tab.Screen name="Matches" component={MatchesScreen} />
      <Tab.Screen name="Chats" component={ChatsScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Events" component={EventsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

// Tab navigator for organizer mode
const OrganizerTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Feather.glyphMap = "help-circle";
          if (route.name === "Posts") iconName = "layout";
          else if (route.name === "Create") iconName = "plus-circle";
          else if (route.name === "OrganizerProfile") iconName = "briefcase";
          return <Feather name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: APP_CONSTANTS.COLORS.PRIMARY,
        tabBarInactiveTintColor: APP_CONSTANTS.COLORS.DISABLED,
        tabBarStyle: styles.tabBarStyle,
        headerShown: false,
        tabBarShowLabel: true,
      })}
    >
      <Tab.Screen name="Posts" component={OrganizerPostsScreen} options={{ title: "Events" }} />
      <Tab.Screen name="Create" component={CreateEventScreen} options={{ title: "Create" }} />
      <Tab.Screen name="OrganizerProfile" component={OrganizerProfileScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
};

// --- Main Navigator Logic ---
const AppNavigator = () => {
  const { isOrganizerMode } = useOrganizerMode();
  const { session, loading } = useAuth();

  console.log("[AppNavigator] State:", loading ? "Loading" : session ? `Auth (${session.userType})` : "No Auth", `Org Mode: ${isOrganizerMode}`);
  const isProfileComplete = session && ( (session.userType === 'music_lover' && session.musicLoverProfile) || (session.userType === 'organizer' && session.organizerProfile) );
  console.log(`[AppNavigator] Profile Complete: ${isProfileComplete}`);

  if (loading) { return <LoadingScreen />; }

  return (
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <RootStack.Screen name="Auth" component={AuthScreens} />
        ) : !isProfileComplete ? (
           <RootStack.Screen
             name={session.userType === 'music_lover' ? "MusicLoverSignUpFlow" : "OrganizerSignUpFlow"}
             component={session.userType === 'music_lover' ? MusicLoverSignUpFlow : OrganizerSignUpFlow}
             options={{ gestureEnabled: false }} // Prevent swipe back during onboarding
           />
        ) : (
          <RootStack.Screen name="MainApp">
            {() => (
              <MainStack.Navigator screenOptions={{ headerShown: false }}>
                 {isOrganizerMode ? (
                  // Organizer Flow
                  <>
                    <MainStack.Screen name="OrganizerTabs" component={OrganizerTabs} initialParams={{ screen: "Posts" }} />
                    <MainStack.Screen name="EventDetail" component={EventDetailScreen} />
                    <MainStack.Screen name="EditEvent" component={EditEventScreen} />
                  </>
                 ) : (
                  // Music Lover Flow
                  <>
                    <MainStack.Screen name="UserTabs" component={UserTabs} initialParams={{ screen: "Events" }}/>
                  </>
                 )}
                {/* Screens accessible by both modes are placed outside the conditional */}
                <MainStack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />

                {/* Fallback for Main App */}
                <MainStack.Screen name="NotFoundMain" component={NotFoundScreen} options={{ title: 'Oops!'}}/>
              </MainStack.Navigator>
            )}
          </RootStack.Screen>
        )}
        {/* Optional Global Fallback */}
        {/* <RootStack.Screen name="NotFoundGlobal" component={NotFoundScreen} options={{ title: 'Oops!'}}/> */}
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
    paddingBottom: 8,
    paddingTop: 5,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: APP_CONSTANTS.COLORS.BORDER,
  },
});

export default AppNavigator;