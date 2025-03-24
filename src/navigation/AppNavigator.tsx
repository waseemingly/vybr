import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useOrganizerMode } from "@/hooks/useOrganizerMode";

// Import screens
import MatchesScreen from "@/screens/MatchesScreen";
import ChatsScreen from "@/screens/ChatsScreen";
import SearchScreen from "@/screens/SearchScreen";
import EventsScreen from "@/screens/EventsScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import CreateEventScreen from "@/screens/CreateEventScreen";
import NotFoundScreen from "@/screens/NotFoundScreen";
import OrganizerPostsScreen from "@/screens/organizer/OrganizerPostsScreen";
import OrganizerProfileScreen from "@/screens/organizer/OrganizerProfileScreen";
import EventDetailScreen from "@/screens/organizer/EventDetailScreen";

// Create stack navigators
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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
        tabBarActiveTintColor: "#3B82F6", // vybr-blue
        tabBarInactiveTintColor: "gray",
        tabBarStyle: {
          height: 60,
          paddingBottom: 5,
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
        tabBarActiveTintColor: "#3B82F6", // vybr-blue
        tabBarInactiveTintColor: "gray",
        tabBarStyle: {
          height: 60,
          paddingBottom: 5,
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
          tabBarItemStyle: { backgroundColor: "#60A5FA" }, // vybr-midBlue
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

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isOrganizerMode ? (
        <>
          <Stack.Screen name="OrganizerTabs" component={OrganizerTabs} />
          <Stack.Screen name="EventDetail" component={EventDetailScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="UserTabs" component={UserTabs} />
          <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
        </>
      )}
      <Stack.Screen name="NotFound" component={NotFoundScreen} />
    </Stack.Navigator>
  );
};

export default AppNavigator;
