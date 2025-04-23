import React from "react"; // No need for useState here anymore
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform, // Import platform
} from "react-native";
import { Feather } from "@expo/vector-icons";

// Import the necessary types
import type { ChatListItem } from "@/screens/ChatsScreen"; // Adjust path if needed
import ChatCard from "./ChatCard"; // Import your updated ChatCard

// Define the props this component now accepts
interface ChatsTabsProps {
  individualChatList: ChatListItem[]; // Filtered list for individual tab
  groupChatList: any[]; // Placeholder for filtered group list (replace 'any' later)
  activeTab: "individual" | "groups"; // Receive active tab from parent
  setActiveTab: (tab: "individual" | "groups") => void; // Allow parent to change tab
  isLoading: boolean; // Loading state from parent (for initial load)
  isRefreshing?: boolean; // Refreshing state from parent
  onRefresh?: () => void; // Refresh handler from parent
  onChatOpen: (chatItem: ChatListItem) => void; // Callback for opening individual chat
  onProfileOpen: (chatItem: ChatListItem) => void; // Callback for opening profile
  // Add callbacks for group chat items later
}

const ChatsTabs: React.FC<ChatsTabsProps> = ({
  individualChatList,
  groupChatList, // Receive group list (currently empty)
  activeTab,
  setActiveTab,
  isLoading, // Use parent's loading state
  isRefreshing = false,
  onRefresh,
  onChatOpen,
  onProfileOpen,
}) => {

  // --- Renders the Individual Chat List ---
  const renderIndividualList = () => {
    // Show loader only if THIS tab is active AND parent is loading initially
    if (isLoading && activeTab === 'individual' && !isRefreshing) {
       return ( <View style={styles.centered}><ActivityIndicator size="small" color="#6B7280" /></View> );
    }
    // Show empty state only if THIS tab is active, not loading, and list is empty
    if (!isLoading && activeTab === 'individual' && individualChatList.length === 0) {
       return (
        <View style={styles.centered}>
            <Feather name="message-square" size={30} color="#D1D5DB" style={{ marginBottom: 10 }} />
            <Text style={styles.emptyText}>No matching conversations found.</Text>
        </View>
      );
    }
    // Render the FlatList for the individual tab
    return (
        <FlatList
            data={individualChatList} // Use the filtered list passed in props
            keyExtractor={(item) => item.partner_user_id}
            renderItem={({ item }) => (
              <ChatCard
                chatItem={item}
                onChatOpen={onChatOpen}
                onProfileOpen={onProfileOpen}
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            // Use RefreshControl passed from parent
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
              ) : undefined
            }
        />
    );
  };

  // --- Renders the Groups Placeholder/List ---
   const renderGroupsList = () => {
       // Show loader only if THIS tab is active AND parent is loading initially (adjust if groups have separate loading)
       if (isLoading && activeTab === 'groups' && !isRefreshing) {
           return ( <View style={styles.centered}><ActivityIndicator size="small" color="#6B7280" /></View> );
       }
       // Show empty/placeholder state if THIS tab is active, not loading, and list is empty
       if (!isLoading && activeTab === 'groups' && groupChatList.length === 0) {
           return (
               <View style={styles.centered}>
                   <Feather name="users" size={30} color="#D1D5DB" style={{ marginBottom: 10 }} />
                   <Text style={styles.emptyText}>No matching groups found.</Text>
                   <Text style={styles.emptySubText}>Group chats are coming soon!</Text>
               </View>
           );
       }
       // Render the FlatList for groups when data is available
       return (
           <FlatList
               data={groupChatList} // Use the filtered group list
               keyExtractor={(item) => item.id} // Use appropriate key for groups
               renderItem={({ item }) => (
                   // Replace with GroupChatCard component when created
                   <View style={styles.placeholderItem}><Text>Group: {item.name}</Text></View>
               )}
               showsVerticalScrollIndicator={false}
               contentContainerStyle={styles.listContent}
               refreshControl={ onRefresh ? (<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />) : undefined }
           />
       );
   };


  return (
    <View style={styles.container}>
      {/* Tab Navigation Buttons */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[ styles.tabButton, activeTab === "individual" && styles.activeTabButton ]}
          onPress={() => setActiveTab("individual")} // Use the setter from props
          activeOpacity={0.7}
        >
          <Feather name="message-circle" size={16} color={activeTab === "individual" ? "#3B82F6" : "#6B7280"} style={styles.tabIcon}/>
          <Text style={[ styles.tabText, activeTab === "individual" && styles.activeTabText, ]}> Individual </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[ styles.tabButton, activeTab === "groups" && styles.activeTabButton ]}
          onPress={() => setActiveTab("groups")} // Use the setter from props
          activeOpacity={0.7}
        >
          <Feather name="users" size={16} color={activeTab === "groups" ? "#3B82F6" : "#6B7280"} style={styles.tabIcon} />
          <Text style={[ styles.tabText, activeTab === "groups" && styles.activeTabText, ]} > Groups </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content Area - Render the correct list based on activeTab */}
      <View style={styles.tabContent}>
        {activeTab === 'individual' ? renderIndividualList() : renderGroupsList()}
      </View>
    </View>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, },
    tabsContainer: { flexDirection: "row", backgroundColor: "rgba(59, 130, 246, 0.1)", borderRadius: 8, padding: 4, marginBottom: 16, }, // Increased bottom margin
    tabButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 6, },
    activeTabButton: { backgroundColor: "white", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, },
    tabIcon: { marginRight: 6, },
    tabText: { fontSize: 14, color: "#6B7280", },
    activeTabText: { color: "#3B82F6", fontWeight: "500", },
    tabContent: { flex: 1, },
    listContent: { paddingTop: 4, paddingBottom: 16, },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, minHeight: 200, },
    emptyText: { fontSize: 16, color: '#6B7280', marginTop: 8, textAlign: 'center', },
    emptySubText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 4,}, // Added for group placeholder
    placeholderItem: { padding: 15, backgroundColor: '#eee', marginVertical: 5, borderRadius: 5 } // Placeholder for group items
});

export default ChatsTabs;