// import React from "react"; // No need for useState here anymore
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   FlatList,
//   ActivityIndicator,
//   RefreshControl,
//   Platform, // Import platform
// } from "react-native";
// import { Feather } from "@expo/vector-icons";

// // Import the necessary types
// import type { ChatListItem } from "@/screens/ChatsScreen"; // Adjust path if needed
// import ChatCard from "./ChatCard"; // Import your updated ChatCard

// // Define the props this component now accepts
// interface ChatsTabsProps {
//   individualChatList: ChatListItem[]; // Filtered list for individual tab
//   groupChatList: any[]; // Placeholder for filtered group list (replace 'any' later)
//   activeTab: "individual" | "groups"; // Receive active tab from parent
//   setActiveTab: (tab: "individual" | "groups") => void; // Allow parent to change tab
//   isLoading: boolean; // Loading state from parent (for initial load)
//   isRefreshing?: boolean; // Refreshing state from parent
//   onRefresh?: () => void; // Refresh handler from parent
//   onChatOpen: (chatItem: ChatListItem) => void; // Callback for opening individual chat
//   onProfileOpen: (chatItem: ChatListItem) => void; // Callback for opening profile
//   // Add callbacks for group chat items later
// }

// const ChatsTabs: React.FC<ChatsTabsProps> = ({
//   individualChatList,
//   groupChatList, // Receive group list (currently empty)
//   activeTab,
//   setActiveTab,
//   isLoading, // Use parent's loading state
//   isRefreshing = false,
//   onRefresh,
//   onChatOpen,
//   onProfileOpen,
// }) => {

//   // --- Renders the Individual Chat List ---
//   const renderIndividualList = () => {
//     // Show loader only if THIS tab is active AND parent is loading initially
//     if (isLoading && activeTab === 'individual' && !isRefreshing) {
//        return ( <View style={styles.centered}><ActivityIndicator size="small" color="#6B7280" /></View> );
//     }
//     // Show empty state only if THIS tab is active, not loading, and list is empty
//     if (!isLoading && activeTab === 'individual' && individualChatList.length === 0) {
//        return (
//         <View style={styles.centered}>
//             <Feather name="message-square" size={30} color="#D1D5DB" style={{ marginBottom: 10 }} />
//             <Text style={styles.emptyText}>No matching conversations found.</Text>
//         </View>
//       );
//     }
//     // Render the FlatList for the individual tab
//     return (
//         <FlatList
//             data={individualChatList} // Use the filtered list passed in props
//             keyExtractor={(item) => item.partner_user_id}
//             renderItem={({ item }) => (
//               <ChatCard
//                 chatItem={item}
//                 onChatOpen={onChatOpen}
//                 onProfileOpen={onProfileOpen}
//               />
//             )}
//             showsVerticalScrollIndicator={false}
//             contentContainerStyle={styles.listContent}
//             // Use RefreshControl passed from parent
//             refreshControl={
//               onRefresh ? (
//                 <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
//               ) : undefined
//             }
//         />
//     );
//   };

//   // --- Renders the Groups Placeholder/List ---
//    const renderGroupsList = () => {
//        // Show loader only if THIS tab is active AND parent is loading initially (adjust if groups have separate loading)
//        if (isLoading && activeTab === 'groups' && !isRefreshing) {
//            return ( <View style={styles.centered}><ActivityIndicator size="small" color="#6B7280" /></View> );
//        }
//        // Show empty/placeholder state if THIS tab is active, not loading, and list is empty
//        if (!isLoading && activeTab === 'groups' && groupChatList.length === 0) {
//            return (
//                <View style={styles.centered}>
//                    <Feather name="users" size={30} color="#D1D5DB" style={{ marginBottom: 10 }} />
//                    <Text style={styles.emptyText}>No matching groups found.</Text>
//                    <Text style={styles.emptySubText}>Group chats are coming soon!</Text>
//                </View>
//            );
//        }
//        // Render the FlatList for groups when data is available
//        return (
//            <FlatList
//                data={groupChatList} // Use the filtered group list
//                keyExtractor={(item) => item.id} // Use appropriate key for groups
//                renderItem={({ item }) => (
//                    // Replace with GroupChatCard component when created
//                    <View style={styles.placeholderItem}><Text>Group: {item.name}</Text></View>
//                )}
//                showsVerticalScrollIndicator={false}
//                contentContainerStyle={styles.listContent}
//                refreshControl={ onRefresh ? (<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />) : undefined }
//            />
//        );
//    };


//   return (
//     <View style={styles.container}>
//       {/* Tab Navigation Buttons */}
//       <View style={styles.tabsContainer}>
//         <TouchableOpacity
//           style={[ styles.tabButton, activeTab === "individual" && styles.activeTabButton ]}
//           onPress={() => setActiveTab("individual")} // Use the setter from props
//           activeOpacity={0.7}
//         >
//           <Feather name="message-circle" size={16} color={activeTab === "individual" ? "#3B82F6" : "#6B7280"} style={styles.tabIcon}/>
//           <Text style={[ styles.tabText, activeTab === "individual" && styles.activeTabText, ]}> Individual </Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={[ styles.tabButton, activeTab === "groups" && styles.activeTabButton ]}
//           onPress={() => setActiveTab("groups")} // Use the setter from props
//           activeOpacity={0.7}
//         >
//           <Feather name="users" size={16} color={activeTab === "groups" ? "#3B82F6" : "#6B7280"} style={styles.tabIcon} />
//           <Text style={[ styles.tabText, activeTab === "groups" && styles.activeTabText, ]} > Groups </Text>
//         </TouchableOpacity>
//       </View>

//       {/* Tab Content Area - Render the correct list based on activeTab */}
//       <View style={styles.tabContent}>
//         {activeTab === 'individual' ? renderIndividualList() : renderGroupsList()}
//       </View>
//     </View>
//   );
// };

// // --- Styles ---
// const styles = StyleSheet.create({
//     container: { flex: 1, },
//     tabsContainer: { flexDirection: "row", backgroundColor: "rgba(59, 130, 246, 0.1)", borderRadius: 8, padding: 4, marginBottom: 16, }, // Increased bottom margin
//     tabButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 6, },
//     activeTabButton: { backgroundColor: "white", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, },
//     tabIcon: { marginRight: 6, },
//     tabText: { fontSize: 14, color: "#6B7280", },
//     activeTabText: { color: "#3B82F6", fontWeight: "500", },
//     tabContent: { flex: 1, },
//     listContent: { paddingTop: 4, paddingBottom: 16, },
//     centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, minHeight: 200, },
//     emptyText: { fontSize: 16, color: '#6B7280', marginTop: 8, textAlign: 'center', },
//     emptySubText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 4,}, // Added for group placeholder
//     placeholderItem: { padding: 15, backgroundColor: '#eee', marginVertical: 5, borderRadius: 5 } // Placeholder for group items
// });

// export default ChatsTabs;

// src/components/ChatsTabs.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native'; // Import useFocusEffect

// --- Adjust Imports ---
import ChatCard from './ChatCard'; // Assuming ChatCard is in the same directory
// Import type for individual chat items (can be defined here or imported)
export interface IndividualChatListItem {
    partner_user_id: string;
    last_message_content: string | null;
    last_message_created_at: string;
    partner_first_name: string | null;
    partner_last_name: string | null;
    partner_profile_picture: string | null;
    current_user_sent_any_message: boolean; // New field
    partner_sent_any_message: boolean; // New field
    partner_profile_id?: string; // Optional
    unread?: number; // Optional unread count
    isPinned?: boolean; // Optional pinned status
}
import { supabase } from '@/lib/supabase'; // Adjust path
import { useAuth } from '@/hooks/useAuth'; // Adjust path
import { APP_CONSTANTS } from '@/config/constants'; // Adjust path
import type { IndividualSubTab } from '@/screens/ChatsScreen'; // Import the type
// --- End Adjustments ---

// Define structure for Group Chat List Item (from RPC get_group_chat_list)
export interface GroupChatListItem {
    group_id: string;
    group_name: string | null;
    group_image: string | null;
    last_message_content: string | null;
    last_message_created_at: string | null;
    member_count?: number;
    other_members_preview?: { user_id: string; name: string }[];
    unread?: number; // Placeholder
    isPinned?: boolean; // Placeholder
}

// Combined Chat Item Type passed to FlatList and handlers
export type ChatItem =
    | { type: 'individual'; data: IndividualChatListItem }
    | { type: 'group'; data: GroupChatListItem };

// Props expected by this component
interface ChatsTabsProps {
    activeTab: 'individual' | 'groups';
    setActiveTab: (tab: 'individual' | 'groups') => void;
    individualSubTab?: IndividualSubTab; // Add new prop
    setIndividualSubTab?: (subTab: IndividualSubTab) => void; // Add new prop
    onChatOpen: (item: ChatItem) => void; // Handler to navigate to chat
    onProfileOpen?: (item: ChatItem) => void; // Optional handler to open profile
    searchQuery?: string; // Receive search query from parent
}

// Helper function to format timestamps
const formatTimestamp = (timestamp: string | null): string => {
    if (!timestamp) return '';
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffSeconds = (now.getTime() - date.getTime()) / 1000;
        const diffHours = diffSeconds / 3600;
        const diffDays = diffHours / 24;

        if (diffHours < 24 && date.getDate() === now.getDate()) { // Today
            return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        } else if (diffDays < 7) { // Within last week
             return date.toLocaleDateString([], { weekday: 'short' });
        } else { // Older than a week
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    } catch (e) { console.error("Error formatting timestamp:", e); return ''; }
};

const ChatsTabs: React.FC<ChatsTabsProps> = ({
    activeTab,
    setActiveTab,
    individualSubTab, // Destructure new prop
    setIndividualSubTab, // Destructure new prop
    onChatOpen,
    onProfileOpen,
    searchQuery = '', // Default to empty string
}) => {
    const { session } = useAuth();
    const [individualList, setIndividualList] = useState<IndividualChatListItem[]>([]);
    const [groupList, setGroupList] = useState<GroupChatListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch data function (fetches both lists)
    const fetchData = useCallback(async (refreshing = false) => {
        if (!session?.user?.id) {
            setError("Not logged in."); setIsLoading(false); setIsRefreshing(false); return;
        }
        if (!refreshing && !isLoading) setIsLoading(true); // Set loading true only if not already loading and not a refresh
        else if (refreshing) setIsRefreshing(true); // Set refreshing if it is a refresh call
        
        setError(null);
        console.log("ChatsTabs: Fetching data...");

        try {
            const [individualResult, groupResult] = await Promise.all([
                supabase.rpc('get_chat_list'),
                supabase.rpc('get_group_chat_list')
            ]);

            if (individualResult.error) throw new Error(`Individual chats: ${individualResult.error.message}`);
            setIndividualList(individualResult.data || []);

            if (groupResult.error) throw new Error(`Group chats: ${groupResult.error.message}`);
            setGroupList(groupResult.data || []);

            console.log(`ChatsTabs: Fetched ${individualResult.data?.length ?? 0} individual, ${groupResult.data?.length ?? 0} group.`);

        } catch (err: any) {
            console.error("ChatsTabs: Error fetching chat lists:", err);
            setError("Failed to load chats.");
            setIndividualList([]); setGroupList([]);
        } finally {
            setIsLoading(false); setIsRefreshing(false);
        }
    }, [session?.user?.id, isLoading]); // Added isLoading to dependencies of fetchData

    // Fetch on mount and when session changes (initial load)
    useEffect(() => {
        // Only fetch if not already loading to prevent redundant calls from focus + mount
        if (!isLoading) {
            fetchData();
        }
    }, [session?.user?.id]); // Keep session dependency for initial load on auth change

    // Fetch data when the screen comes into focus
    useFocusEffect(
        useCallback(() => {
            console.log("ChatsTabs: Screen focused, fetching data.");
            // Call fetchData directly. It will handle its own loading/refreshing state.
            fetchData(); 
            // No cleanup needed for this fetchData call
        }, [fetchData]) // fetchData is memoized
    );

    // Handle pull-to-refresh
    const onRefresh = useCallback(() => {
        fetchData(true); // Pass true to indicate it's a refresh
    }, [fetchData]);

    // Filter data based on search query and active tab
    const filteredListData = useMemo((): ChatItem[] => {
        const lowerCaseQuery = searchQuery.toLowerCase();

        if (activeTab === 'individual') {
            const filtered = individualList.filter(item => {
                const name = `${item.partner_first_name || ''} ${item.partner_last_name || ''}`.trim().toLowerCase();
                // Optional: filter by message content
                // const message = item.last_message_content?.toLowerCase() || '';
                return name.includes(lowerCaseQuery); // || message.includes(lowerCaseQuery);
            });
            return filtered.map(item => ({ type: 'individual', data: item }));
        } else { // activeTab === 'groups'
            const filtered = groupList.filter(item => {
                const name = item.group_name?.toLowerCase() || '';
                // Optional: filter by message content or member names
                return name.includes(lowerCaseQuery);
            });
            return filtered.map(item => ({ type: 'group', data: item }));
        }
    }, [activeTab, individualList, groupList, searchQuery]); // Depend on search query

    // --- Renders the Individual Chat List ---
    const renderIndividualList = () => {
        // First, get only individual chats from the main filtered list
        const individualChats: IndividualChatListItem[] = filteredListData
            .filter(item => item.type === 'individual')
            .map(item => item.data as IndividualChatListItem);

        // Determine which list to show based on individualSubTab
        let listToShow: IndividualChatListItem[] = [];
        if (individualSubTab === 'pending') {
            listToShow = individualChats.filter(data => {
                // Show in pending if: Current user sent AND partner hasn't OR partner sent AND current user hasn't
                return (data.current_user_sent_any_message && !data.partner_sent_any_message) || 
                       (!data.current_user_sent_any_message && data.partner_sent_any_message);
            });
        } else { // 'chats' subTab
            listToShow = individualChats.filter(data => {
                // Show in chats if: Both have sent messages
                return data.current_user_sent_any_message && data.partner_sent_any_message;
            });
        }

        if (isLoading && activeTab === 'individual' && !isRefreshing && listToShow.length === 0) { // Check listToShow.length here too
            return ( <View style={styles.centered}><ActivityIndicator size="small" color="#6B7280" /></View> );
        }
        if (!isLoading && activeTab === 'individual' && listToShow.length === 0) {
            const emptyMessage = individualSubTab === 'pending' 
                ? (searchQuery ? "No pending chats match your search." : "No pending chats right now.")
                : (searchQuery ? "No active chats match your search." : "No active chats yet.");
            return (
                <View style={styles.centered}>
                    <Feather name="message-square" size={30} color="#D1D5DB" style={{ marginBottom: 10 }} />
                    <Text style={styles.emptyText}>{emptyMessage}</Text>
                </View>
            );
        }

        return (
            <FlatList
                data={listToShow} // Use the sub-tab filtered list of IndividualChatListItem
                keyExtractor={(item) => item.partner_user_id}
                renderItem={({ item }) => (
                    <ChatCard
                        id={item.partner_user_id}
                        name={`${item.partner_first_name || ''} ${item.partner_last_name || ''}`.trim() || 'User'}
                        image={item.partner_profile_picture}
                        lastMessage={item.last_message_content || ''}
                        time={formatTimestamp(item.last_message_created_at)}
                        unread={item.unread || 0}
                        isPinned={item.isPinned || false}
                        type='individual' // Explicitly set type for ChatCard if it needs it
                        onChatOpen={() => onChatOpen({ type: 'individual', data: item })}
                        onProfileOpen={(onProfileOpen) ? () => onProfileOpen({ type: 'individual', data: item }) : undefined}
                    />
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={ // This might be redundant now due to the check above, but can be a fallback
                    <View style={styles.centered}>
                        <Text style={styles.emptyText}>
                            {searchQuery ? 'No results found.' : (individualSubTab === 'pending' ? "No pending chats." : "No active chats.")}
                        </Text>
                    </View>
                 }
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        tintColor={APP_CONSTANTS.COLORS.PRIMARY}
                    />
                }
                // Optimization: Remove items that are not visible
                removeClippedSubviews={Platform.OS === 'android'} // Can cause issues on iOS sometimes
                initialNumToRender={10} // Render initial batch
                maxToRenderPerBatch={10} // Render next batch size
                windowSize={11} // Render items in viewport + buffer
            />
        );
    };

    // --- Renders the Group Chat List (Placeholder or Actual) ---
    const renderGroupList = () => {
        const groupChats: GroupChatListItem[] = filteredListData
            .filter(item => item.type === 'group')
            .map(item => item.data as GroupChatListItem);

        if (isLoading && activeTab === 'groups' && !isRefreshing && groupChats.length === 0) {
            return ( <View style={styles.centered}><ActivityIndicator size="small" color="#6B7280" /></View> );
        }

        if (!isLoading && activeTab === 'groups' && groupChats.length === 0) {
            const emptyMessage = searchQuery 
                ? "No groups match your search."
                : "No group chats yet. Start one!";
            return (
                <View style={styles.centered}>
                    <Feather name="users" size={30} color="#D1D5DB" style={{ marginBottom: 10 }} />
                    <Text style={styles.emptyText}>{emptyMessage}</Text>
                </View>
            );
        }

        return (
            <FlatList
                data={groupChats}
                keyExtractor={(item) => item.group_id}
                renderItem={({ item }) => (
                    <ChatCard
                        id={item.group_id}
                        name={item.group_name || `Group (${item.member_count || '...'})`}
                        image={item.group_image}
                        lastMessage={item.last_message_content || 'Group created'}
                        time={formatTimestamp(item.last_message_created_at)}
                        unread={item.unread || 0}
                        isPinned={item.isPinned || false}
                        membersPreview={item.other_members_preview?.map(m => m.name.split(' ')[0]).join(', ')}
                        type='group'
                        onChatOpen={() => onChatOpen({ type: 'group', data: item })}
                        // No profile open for groups, or define specific group info screen
                    />
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={ // Fallback, though covered above
                    <View style={styles.centered}>
                        <Text style={styles.emptyText}>
                            {searchQuery ? 'No results found.' : 'No group chats yet.'}
                        </Text>
                    </View>
                }
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        tintColor={APP_CONSTANTS.COLORS.PRIMARY}
                    />
                }
                removeClippedSubviews={Platform.OS === 'android'}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={11}
            />
        );
    };

    // --- Render Component ---
    return (
        <View style={styles.container}>
            {/* Tab Navigation Buttons */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[ styles.tabButton, activeTab === "individual" && styles.activeTabButton ]}
                    onPress={() => setActiveTab("individual")} 
                    activeOpacity={0.7}
                >
                    <Feather name="message-circle" size={16} color={activeTab === "individual" ? APP_CONSTANTS.COLORS.PRIMARY : "#6B7280"} style={styles.tabIcon}/>
                    <Text style={[ styles.tabText, activeTab === "individual" && styles.activeTabText, ]}> Individual </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[ styles.tabButton, activeTab === "groups" && styles.activeTabButton ]}
                    onPress={() => setActiveTab("groups")} 
                    activeOpacity={0.7}
                >
                    <Feather name="users" size={16} color={activeTab === "groups" ? APP_CONSTANTS.COLORS.PRIMARY : "#6B7280"} style={styles.tabIcon} />
                    <Text style={[ styles.tabText, activeTab === "groups" && styles.activeTabText, ]} > Groups </Text>
                </TouchableOpacity>
            </View>

            {/* Individual Sub-Tabs (shown only if activeTab is 'individual') */}
            {activeTab === 'individual' && setIndividualSubTab && (
                <View style={styles.subTabsContainer}>
                    <TouchableOpacity
                        style={[styles.subTabButton, individualSubTab === 'chats' && styles.activeSubTabButton]}
                        onPress={() => setIndividualSubTab('chats')}
                    >
                        <Text style={[styles.subTabText, individualSubTab === 'chats' && styles.activeSubTabText]}>Chats</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.subTabButton, individualSubTab === 'pending' && styles.activeSubTabButton]}
                        onPress={() => setIndividualSubTab('pending')}
                    >
                        <Text style={[styles.subTabText, individualSubTab === 'pending' && styles.activeSubTabText]}>Pending</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Tab Content Area - Render the correct list based on activeTab */}
            <View style={styles.tabContent}>
                {isLoading ? (
                    <View style={styles.centered}><ActivityIndicator color={APP_CONSTANTS.COLORS.PRIMARY} /></View>
                ) : error ? (
                     <View style={styles.centered}>
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={() => fetchData()}>
                           <Feather name="refresh-cw" size={14} color="#FFF" />
                           <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    activeTab === 'individual' ? renderIndividualList() : renderGroupList()
                )}
            </View>
        </View>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
    errorText: { color: '#DC2626', textAlign: 'center', marginBottom: 15 },
    retryButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingVertical: 8, paddingHorizontal: 15, borderRadius: 6, },
    retryButtonText: { color: 'white', fontWeight: '500', fontSize: 14, marginLeft: 6, },
    emptyText: { textAlign: 'center', color: '#6B7280', marginTop: 40, fontSize: 15, },
    tabsContainer: { flexDirection: 'row', backgroundColor: 'rgba(59, 130, 246, 0.05)', borderRadius: 10, padding: 4, marginBottom: 8, }, // Adjusted margin
    tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, },
    activeTabButton: { backgroundColor: "white", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, },
    tabIcon: { marginRight: 6, },
    tabText: { fontSize: 14, color: "#6B7280", fontWeight: '500' },
    activeTabText: { color: APP_CONSTANTS.COLORS.PRIMARY, fontWeight: "600", },
    // Sub-tab styles
    subTabsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 12, // Space before the list
        paddingHorizontal: 16, // Match overall screen padding if needed
    },
    subTabButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    activeSubTabButton: {
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT || '#E0E7FF',
        borderColor: APP_CONSTANTS.COLORS.PRIMARY || '#A5B4FC',
    },
    subTabText: {
        fontSize: 13,
        fontWeight: '500',
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY || '#4B5563',
    },
    activeSubTabText: {
        color: APP_CONSTANTS.COLORS.PRIMARY_DARK || APP_CONSTANTS.COLORS.PRIMARY || '#3730A3',
        fontWeight: '600',
    },
    tabContent: { flex: 1, },
    listContent: { paddingTop: 4, paddingBottom: 16, }, // Adjust padding as needed
});

export default ChatsTabs;