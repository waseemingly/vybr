import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useOrganizerMode } from "@/hooks/useOrganizerMode";
import { useAuth } from "@/hooks/useAuth";
import { APP_CONSTANTS } from "@/config/constants";

// Import screens
import MatchesScreen from "@/screens/MatchesScreen";
import ChatsScreen from "@/screens/ChatsScreen";
import SearchScreen from "@/screens/SearchScreen";
import EventsScreen from "@/screens/EventsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import CreateEventScreen from "@/screens/CreateEventScreen";
import NotFoundScreen from "@/screens/NotFoundScreen";
import OrganizerPostsScreen from "@/screens/organizer/OrganizerPostsScreen";
import OrganizerProfileScreen from "@/screens/organizer/OrganizerProfileScreen";
import EventDetailScreen from "@/screens/organizer/EventDetailScreen";

// Import auth screens
import LandingScreen from "../screens/auth/LandingScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import SignUpScreen from "../screens/auth/SignUpScreen";
import OrganizerSignUpScreen from "../screens/auth/OrganizerSignUpScreen";
import MusicLoverSignUpFlow from "../screens/auth/MusicLoverSignUpFlow";
import OrganizerSignUpFlow from "../screens/auth/OrganizerSignUpFlow";

// Create stack navigators
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();

// Auth navigator
const AuthNavigator = () => {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Landing" component={LandingScreen} />
      <AuthStack.Screen 
        name="MusicLoverLogin" 
        options={{ headerShown: false }}
      >
        {props => <LoginScreen {...props} userType="music_lover" />}
      </AuthStack.Screen>
      <AuthStack.Screen 
        name="OrganizerLogin" 
        options={{ headerShown: false }}
      >
        {props => <LoginScreen {...props} userType="organizer" />}
      </AuthStack.Screen>
      <AuthStack.Screen name="MusicLoverSignUp" component={SignUpScreen} />
      <AuthStack.Screen name="OrganizerSignUp" component={OrganizerSignUpScreen} />
      <AuthStack.Screen name="MusicLoverSignUpFlow" component={MusicLoverSignUpFlow} />
      <AuthStack.Screen name="OrganizerSignUpFlow" component={OrganizerSignUpFlow} />
    </AuthStack.Navigator>
  );
};

// Tab navigator for user mode
const UserTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === "Matches") {
            return <Feather name="heart" size={size} color={color} />;
          } else if (route.name === "Chats") {
            return <Feather name="message-square" size={size} color={color} />;
          } else if (route.name === "Search") {
            return <Feather name="search" size={size} color={color} />;
          } else if (route.name === "Events") {
            return <Feather name="calendar" size={size} color={color} />;
          } else if (route.name === "Profile") {
            return <Feather name="user" size={size} color={color} />;
          }
        },
        tabBarActiveTintColor: APP_CONSTANTS.COLORS.PRIMARY,
        tabBarInactiveTintColor: APP_CONSTANTS.COLORS.DISABLED,
        tabBarStyle: {
          height: 60,
          paddingBottom: 5,
          backgroundColor: 'white',
          borderTopColor: APP_CONSTANTS.COLORS.BORDER,
        },
        headerShown: false,
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
          if (route.name === "Posts") {
            return <Feather name="layout" size={size} color={color} />;
          } else if (route.name === "Create") {
            return <Feather name="plus" size={size} color={color} />;
          } else if (route.name === "OrganizerProfile") {
            return <Feather name="user" size={size} color={color} />;
          }
        },
        tabBarActiveTintColor: APP_CONSTANTS.COLORS.PRIMARY,
        tabBarInactiveTintColor: APP_CONSTANTS.COLORS.DISABLED,
        tabBarStyle: {
          height: 60,
          paddingBottom: 5,
          backgroundColor: 'white',
          borderTopColor: APP_CONSTANTS.COLORS.BORDER,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Posts"
        component={OrganizerPostsScreen}
        options={{ title: "Posts" }}
      />
      <Tab.Screen
        name="Create"
        component={CreateEventScreen}
        options={{
          title: "Create",
          tabBarLabelStyle: { fontWeight: "bold" },
          tabBarItemStyle: { backgroundColor: APP_CONSTANTS.COLORS.SECONDARY },
        }}
      />
      <Tab.Screen
        name="OrganizerProfile"
        component={OrganizerProfileScreen}
        options={{ title: "Profile" }}
      />
    </Tab.Navigator>
  );
};

// Main navigator
const AppNavigator = () => {
  const { isOrganizerMode } = useOrganizerMode();
  const { session, loading } = useAuth();

  // Add logging to diagnose session state issues
  console.log('[AppNavigator] Current auth state:', 
    loading ? 'Loading' : (session ? `Authenticated as ${session.userType}` : 'Not authenticated'));
  
  if (session) {
    console.log('[AppNavigator] User ID:', session.user?.id);
    console.log('[AppNavigator] User type:', session.userType);
    console.log('[AppNavigator] Organizer mode:', isOrganizerMode);
  }

  // If still loading auth state, render nothing or a loading screen
  if (loading) {
    console.log('[AppNavigator] Auth state is loading, showing loading screen');
    return null; // You can replace this with a splash/loading screen
  }

  // Log which screens we're rendering
  if (session) {
    console.log('[AppNavigator] Rendering authenticated screens');
  } else {
    console.log('[AppNavigator] Rendering authentication screens');
  }
  
  // In React Native mobile app, we prioritize signup screens for authenticated users
  // This prevents redirection to the main app during multi-step signup process
  
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {session ? (
        // User is logged in, show main app screens 
        // But also allow access to signup flow screens for completing registration
        <>
          {/* First allow signup flow screens to be accessible during the multi-step process
              This ensures they take priority if the user is in the middle of signup */}
          <Stack.Screen name="MusicLoverSignUpFlow" component={MusicLoverSignUpFlow} />
          <Stack.Screen name="OrganizerSignUpFlow" component={OrganizerSignUpFlow} />
        
          {/* Then add main app screens */}
          {isOrganizerMode ? (
            // Organizer mode screens
            <>
              <Stack.Screen name="OrganizerTabs" component={OrganizerTabs} />
              <Stack.Screen name="EventDetail" component={EventDetailScreen} />
            </>
          ) : (
            // Music lover mode screens
            <>
              <Stack.Screen name="UserTabs" component={UserTabs} />
              <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
            </>
          )}
        </>
      ) : (
        // User is not logged in, show authentication screens
        <>
          <Stack.Screen name="Auth" component={AuthNavigator} />
          {/* Also enable direct navigation to signup flows even when not authenticated */}
          <Stack.Screen name="MusicLoverSignUpFlow" component={MusicLoverSignUpFlow} />
          <Stack.Screen name="OrganizerSignUpFlow" component={OrganizerSignUpFlow} />
        </>
      )}
      <Stack.Screen name="NotFound" component={NotFoundScreen} />
    </Stack.Navigator>
  );
};

export default AppNavigator;
