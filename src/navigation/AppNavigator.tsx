import React from 'react';
import { View, ActivityIndicator, StyleSheet } from "react-native";
// No NavigationContainer here, should be in App.tsx or root file
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useOrganizerMode } from "@/hooks/useOrganizerMode";
import { useAuth } from "@/hooks/useAuth";
import { APP_CONSTANTS } from "@/config/constants";

// Import screens (Assuming paths are correct)
import MatchesScreen from "@/screens/MatchesScreen";
import ChatsScreen from "@/screens/ChatsScreen";
import SearchScreen from "@/screens/SearchScreen";
import EventsScreen from "@/screens/EventsScreen";
import ProfileScreen from "../screens/ProfileScreen"; // Music Lover Profile
import CreateEventScreen from "@/screens/CreateEventScreen";
import NotFoundScreen from "@/screens/NotFoundScreen";
import OrganizerPostsScreen from "@/screens/organizer/OrganizerPostsScreen";
import OrganizerProfileScreen from "@/screens/organizer/OrganizerProfileScreen"; // Organizer Profile
import EventDetailScreen from "@/screens/organizer/EventDetailScreen";

// Import auth screens
import LandingScreen from "../screens/auth/LandingScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import MusicLoverSignUpFlow from "../screens/auth/MusicLoverSignUpFlow";
import OrganizerSignUpFlow from "../screens/auth/OrganizerSignUpFlow";

// Create navigators
const RootStack = createNativeStackNavigator();
const AuthStackNav = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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
// *** CLEANED UP STRUCTURE ***
const UserTabs = (props) => {
  const initialRouteName = props.route?.params?.initialRouteName || "Matches";
  
  return (
    <Tab.Navigator
      initialRouteName={initialRouteName}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Feather.glyphMap = "help-circle"; // Default
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
      {/* Ensure NO other elements like spaces or comments are direct children here */}
    </Tab.Navigator>
  );
};

// Tab navigator for organizer mode
// *** CLEANED UP STRUCTURE ***
const OrganizerTabs = (props) => {
  const initialRouteName = props.route?.params?.initialRouteName || "Posts";
  
  return (
    <Tab.Navigator
      initialRouteName={initialRouteName}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Feather.glyphMap = "help-circle"; // Default
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
      {/* Ensure NO other elements like spaces or comments are direct children here */}
    </Tab.Navigator>
  );
};

// --- Main Navigator Logic ---
const AppNavigator = () => {
  const { isOrganizerMode } = useOrganizerMode();
  const { session, loading } = useAuth();

  console.log(
    "[AppNavigator] State:",
    loading ? "Loading" : session ? `Authenticated (${session.userType})` : "Not Authenticated",
    `Organizer Mode: ${isOrganizerMode}`
  );

  const isProfileComplete = session && (
    (session.userType === 'music_lover' && session.musicLoverProfile !== null) ||
    (session.userType === 'organizer' && session.organizerProfile !== null)
  );

  console.log(`[AppNavigator] Profile Complete: ${isProfileComplete}`);


  if (loading) {
    console.log("[AppNavigator] Rendering Loading Screen");
    return <LoadingScreen />;
  }

  // Root stack manages Auth vs Main App vs Onboarding
  return (
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          // Stack for Authentication screens
          <RootStack.Screen name="Auth" component={AuthScreens} />
        ) : !isProfileComplete ? (
           // Authenticated BUT Profile Incomplete: Route to the correct signup flow
           <RootStack.Screen
             name={session.userType === 'music_lover' ? "MusicLoverSignUpFlow" : "OrganizerSignUpFlow"}
             component={session.userType === 'music_lover' ? MusicLoverSignUpFlow : OrganizerSignUpFlow}
             // Add options to prevent navigating back from onboarding if needed
             // options={{ gestureEnabled: false }}
           />
        ) : (
          // Authenticated AND Profile Complete: Show Main App Stack
          <RootStack.Screen name="MainApp">
            {() => (
              <MainStack.Navigator screenOptions={{ headerShown: false }}>
                {isOrganizerMode ? (
                   // Organizer Screens - Start with profile first
                  <>
                    <MainStack.Screen name="OrganizerTabs" component={OrganizerTabs} initialParams={{ initialRouteName: "OrganizerProfile" }} />
                    <MainStack.Screen name="EventDetail" component={EventDetailScreen} />
                  </>
                ) : (
                   // Music Lover Screens - Start with profile first
                  <>
                    <MainStack.Screen name="UserTabs" component={UserTabs} initialParams={{ initialRouteName: "Profile" }} />
                    <MainStack.Screen name="CreateEvent" component={CreateEventScreen} />
                  </>
                )}
                <MainStack.Screen name="NotFoundMain" component={NotFoundScreen} options={{ title: 'Oops!'}}/>
              </MainStack.Navigator>
            )}
          </RootStack.Screen>
        )}
        {/* Global Fallback NotFound screen (Optional, place last in RootStack) */}
         {/* This catches any navigation state not handled above */}
         {/* <RootStack.Screen name="NotFoundGlobal" component={NotFoundScreen} options={{ title: 'Oops!'}}/> */}
      </RootStack.Navigator>
  );
};

// Styles (Keep existing)
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