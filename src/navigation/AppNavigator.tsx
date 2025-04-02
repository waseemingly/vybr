import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
// REMOVE THIS IMPORT: import { NavigationContainer } from "@react-navigation/native";
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
// Removed SignUpScreen/OrganizerSignUpScreen imports if flows are used directly
import MusicLoverSignUpFlow from "../screens/auth/MusicLoverSignUpFlow";
import OrganizerSignUpFlow from "../screens/auth/OrganizerSignUpFlow";

// Create stack navigators
const RootStack = createNativeStackNavigator();
const AuthStackNav = createNativeStackNavigator(); // Renamed for clarity
const MainStack = createNativeStackNavigator(); // For screens outside tabs but within authenticated app
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
      {/* Direct navigation to Flows from Landing/Login */}
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
          let iconName: keyof typeof Feather.glyphMap = "help-circle"; // Default icon

          if (route.name === "Matches") iconName = "heart";
          else if (route.name === "Chats") iconName = "message-square";
          else if (route.name === "Search") iconName = "search";
          else if (route.name === "Events") iconName = "calendar";
          else if (route.name === "Profile") iconName = "user"; // Music Lover Profile

          return <Feather name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: APP_CONSTANTS.COLORS.PRIMARY,
        tabBarInactiveTintColor: APP_CONSTANTS.COLORS.DISABLED,
        tabBarStyle: styles.tabBarStyle,
        headerShown: false,
        tabBarShowLabel: true, // Ensure labels are shown
      })}
    >
      <Tab.Screen name="Matches" component={MatchesScreen} />
      <Tab.Screen name="Chats" component={ChatsScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Events" component={EventsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} /> {/* Music Lover Profile */}
    </Tab.Navigator>
  );
};

// Tab navigator for organizer mode
const OrganizerTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Feather.glyphMap = "help-circle"; // Default icon

          if (route.name === "Posts") iconName = "layout";
          else if (route.name === "Create") iconName = "plus-circle"; // Changed icon
          else if (route.name === "OrganizerProfile") iconName = "briefcase"; // Changed icon

          return <Feather name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: APP_CONSTANTS.COLORS.PRIMARY,
        tabBarInactiveTintColor: APP_CONSTANTS.COLORS.DISABLED,
        tabBarStyle: styles.tabBarStyle,
        headerShown: false,
        tabBarShowLabel: true, // Ensure labels are shown
      })}
    >
      <Tab.Screen name="Posts" component={OrganizerPostsScreen} options={{ title: "Events" }} /> {/* Changed Title */}
      <Tab.Screen name="Create" component={CreateEventScreen} options={{ title: "Create" }} />
      <Tab.Screen name="OrganizerProfile" component={OrganizerProfileScreen} options={{ title: "Profile" }} /> {/* Organizer Profile */}
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

  // Determine if the profile corresponding to the user type is loaded
  const isProfileComplete = session && (
    (session.userType === 'music_lover' && session.musicLoverProfile !== null) ||
    (session.userType === 'organizer' && session.organizerProfile !== null)
  );

  console.log(`[AppNavigator] Profile Complete: ${isProfileComplete}`);


  if (loading) {
    console.log("[AppNavigator] Rendering Loading Screen");
    return <LoadingScreen />;
  }

  // *** REMOVED NavigationContainer FROM HERE ***
  return (
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          // Not Authenticated: Show Auth screens
          <RootStack.Screen name="Auth" component={AuthScreens} />
        ) : !isProfileComplete ? (
           // Authenticated BUT Profile Incomplete: Show the correct Onboarding/Signup Flow
           <RootStack.Screen
             name={session.userType === 'music_lover' ? "MusicLoverSignUpFlow" : "OrganizerSignUpFlow"}
             component={session.userType === 'music_lover' ? MusicLoverSignUpFlow : OrganizerSignUpFlow}
           />
        ) : (
          // Authenticated AND Profile Complete: Show Main App (Tabs + other screens)
          <RootStack.Screen name="MainApp">
            {() => (
              <MainStack.Navigator screenOptions={{ headerShown: false }}>
                {isOrganizerMode ? (
                   // Organizer Main Screens
                  <>
                    <MainStack.Screen name="OrganizerTabs" component={OrganizerTabs} />
                    <MainStack.Screen name="EventDetail" component={EventDetailScreen} />
                    {/* Add other Organizer stack screens here if needed */}
                  </>
                ) : (
                   // Music Lover Main Screens
                  <>
                    <MainStack.Screen name="UserTabs" component={UserTabs} />
                    {/* Add other User stack screens here if needed */}
                    {/* Example: <MainStack.Screen name="EventDetailUser" component={UserEventDetailScreen} /> */}
                    <MainStack.Screen name="CreateEvent" component={CreateEventScreen} />
                  </>
                )}
                 <MainStack.Screen name="NotFound" component={NotFoundScreen} />
              </MainStack.Navigator>
            )}
          </RootStack.Screen>
        )}
        {/* Fallback NotFound screen at the root level (optional) */}
         {/* Removed the !loading check as it's handled above */}
         {/* Also, this NotFound check seems redundant with the logic above */}
         {/* {!session && <RootStack.Screen name="NotFoundGlobal" component={NotFoundScreen} />} */}
         {/* If you need a global 404, place it *last* in the RootStack */}
         <RootStack.Screen name="NotFoundGlobal" component={NotFoundScreen} />
      </RootStack.Navigator>
  );
  // *** REMOVED NavigationContainer FROM HERE ***
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: '#FFFFFF', // Or your app's background color
  },
  tabBarStyle: {
    height: 65, // Adjusted height
    paddingBottom: 8, // Padding for labels/icons
    paddingTop: 5,
    backgroundColor: 'white',
    borderTopWidth: 1, // Added border width
    borderTopColor: APP_CONSTANTS.COLORS.BORDER,
    // Removed position: 'absolute' unless specifically needed for overlay style
    // position: 'absolute',
    // left: 0,
    // right: 0,
    // bottom: 0,
  },
});

export default AppNavigator;