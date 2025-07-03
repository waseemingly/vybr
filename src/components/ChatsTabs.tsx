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
    Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

// --- Adjust Imports ---
import ChatCard from './ChatCard';
// Import type for individual chat items (can be defined here or imported)
export interface IndividualChatListItem {
    partner_user_id: string;
    last_message_content: string | null;
    last_message_created_at: string;
    last_message_sender_id?: string;
    last_message_sender_name?: string;
    partner_first_name: string | null;
    partner_last_name: string | null;
    partner_profile_picture: string | null;
    current_user_sent_any_message: boolean;
    partner_sent_any_message: boolean;
    partner_profile_id?: string;
    unread_count?: number; // Updated to unread_count for consistency
    isPinned?: boolean;
}
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { APP_CONSTANTS } from '@/config/constants';
import type { IndividualSubTab } from '@/screens/ChatsScreen';
// --- End Adjustments ---

// Define structure for Group Chat List Item (from RPC get_group_chat_list)
export interface GroupChatListItem {
    group_id: string;
    group_name: string | null;
    group_image: string | null;
    last_message_content: string | null;
    last_message_created_at: string | null;
    last_message_sender_id?: string;
    last_message_sender_name?: string;
    current_user_sent_any_message?: boolean;
    member_count?: number;
    other_members_preview?: { user_id: string; name: string }[];
    unread_count?: number; // Updated to unread_count for consistency
    isPinned?: boolean;
}

// Combined Chat Item Type passed to FlatList and handlers
export type ChatItem =
    | { type: 'individual'; data: IndividualChatListItem }
    | { type: 'group'; data: GroupChatListItem };

// Props expected by this component
interface ChatsTabsProps {
    activeTab: 'individual' | 'groups';
    setActiveTab: (tab: 'individual' | 'groups') => void;
    individualSubTab?: IndividualSubTab;
    setIndividualSubTab?: (subTab: IndividualSubTab) => void;
    onChatOpen: (item: ChatItem) => void;
    onProfileOpen?: (item: ChatItem) => void;
    searchQuery?: string;
}

// Helper function to format timestamps
const formatTimestamp = (timestamp: string | null): string => {
    if (!timestamp) return '';
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMinutes < 1) return 'now';
        if (diffMinutes < 60) return `${diffMinutes}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
};

// Function to format shared event messages for chat list preview
const formatLastMessageForPreview = (
    messageContent: string | null, 
    senderId: string | undefined, 
    currentUserId: string | undefined, 
    senderName: string | undefined,
    isGroupChat: boolean = false
): string => {
    if (!messageContent) return '';
    
    if (messageContent.startsWith('SHARED_EVENT:')) {
        if (senderId === currentUserId) {
            return 'You shared an event';
        } else {
            if (senderName) {
                return `${senderName} shared an event`;
            } else {
                return 'Someone shared an event';
            }
        }
    }
    
    return messageContent;
};

// Function to delete individual chat
const deleteIndividualChat = async (partnerId: string, currentUserId: string): Promise<boolean> => {
    try {
        // Delete all messages between the two users
        const { error } = await supabase.rpc('delete_individual_chat', {
            partner_user_id: partnerId,
            current_user_id: currentUserId
        });
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting individual chat:', error);
        return false;
    }
};

// Function to delete/leave group chat
const deleteGroupChat = async (groupId: string, currentUserId: string): Promise<boolean> => {
    try {
        // Remove user from group
        const { error } = await supabase.rpc('leave_group_chat', {
            group_id_input: groupId,
            user_id_input: currentUserId
        });
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error leaving group chat:', error);
        return false;
    }
};

const ChatsTabs: React.FC<ChatsTabsProps> = ({
    activeTab,
    setActiveTab,
    individualSubTab,
    setIndividualSubTab,
    onChatOpen,
    onProfileOpen,
    searchQuery = '',
}) => {
    const { session } = useAuth();
    const [individualList, setIndividualList] = useState<IndividualChatListItem[]>([]);
    const [groupList, setGroupList] = useState<GroupChatListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch data function (fetches both lists with unread counts)
    const fetchData = useCallback(async (refreshing = false) => {
        if (!session?.user?.id) {
            setError("Not logged in."); 
            setIsLoading(false); 
            setIsRefreshing(false); 
            return;
        }
        
        if (!refreshing) setIsLoading(true);
        else setIsRefreshing(true);
        
        setError(null);
        console.log("ChatsTabs: Fetching data with unread counts...");

        try {
            const [individualResult, groupResult] = await Promise.all([
                supabase.rpc('get_chat_list_with_unread'),
                supabase.rpc('get_group_chat_list_with_unread')
            ]);

            if (individualResult.error) throw new Error(`Individual chats: ${individualResult.error.message}`);
            setIndividualList(individualResult.data || []);

            if (groupResult.error) throw new Error(`Group chats: ${groupResult.error.message}`);
            setGroupList(groupResult.data || []);

            console.log(`ChatsTabs: Fetched ${individualResult.data?.length ?? 0} individual, ${groupResult.data?.length ?? 0} group.`);

        } catch (err: any) {
            console.error("ChatsTabs: Error fetching chat lists:", err);
            setError("Failed to load chats.");
            setIndividualList([]); 
            setGroupList([]);
        } finally {
            setIsLoading(false); 
            setIsRefreshing(false);
        }
    }, [session?.user?.id]);

    // Fetch on mount and when session changes
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Real-time subscriptions for new messages and updates
    const lastRealtimeFetch = React.useRef<number>(0);
    const throttledFetchData = useCallback(() => {
        const now = Date.now();
        // Only fetch if more than 1 second has passed since last realtime fetch
        if (now - lastRealtimeFetch.current > 1000) {
            console.log("Real-time update triggered, refreshing data");
            lastRealtimeFetch.current = now;
            fetchData();
        } else {
            console.log("Real-time update triggered, but throttling fetch (too recent)");
        }
    }, [fetchData]);

    useEffect(() => {
        if (!session?.user?.id) return;

        console.log("ChatsTabs: Setting up real-time subscriptions");

        // Subscribe to individual message updates
        const individualMessageChannel = supabase
            .channel('individual_messages_updates')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `receiver_id=eq.${session.user.id}`
                },
                () => {
                    console.log("New individual message received");
                    throttledFetchData();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `sender_id=eq.${session.user.id}`
                },
                () => {
                    console.log("New individual message sent");
                    throttledFetchData();
                }
            )
            .subscribe();

        // Subscribe to group message updates
        const groupMessageChannel = supabase
            .channel('group_messages_updates')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'group_chat_messages'
                },
                (payload) => {
                    console.log("New group message received");
                    throttledFetchData();
                }
            )
            .subscribe();

        // Subscribe to group membership changes
        const groupMembershipChannel = supabase
            .channel('group_membership_updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'group_chat_members',
                    filter: `user_id=eq.${session.user.id}`
                },
                () => {
                    console.log("Group membership changed");
                    throttledFetchData();
                }
            )
            .subscribe();

        return () => {
            console.log("ChatsTabs: Cleaning up real-time subscriptions");
            supabase.removeChannel(individualMessageChannel);
            supabase.removeChannel(groupMessageChannel);
            supabase.removeChannel(groupMembershipChannel);
        };
    }, [session?.user?.id, throttledFetchData]);

    // Fetch data when the screen comes into focus (with throttling)
    const lastFocusTime = React.useRef<number>(0);
    useFocusEffect(
        useCallback(() => {
            const now = Date.now();
            // Only fetch if more than 2 seconds have passed since last focus fetch
            if (now - lastFocusTime.current > 2000) {
                console.log("ChatsTabs: Screen focused, fetching data.");
                lastFocusTime.current = now;
                fetchData();
            } else {
                console.log("ChatsTabs: Screen focused, but throttling fetch (too recent).");
            }
        }, [])
    );

    // Handle pull-to-refresh
    const onRefresh = useCallback(() => {
        fetchData(true);
    }, [fetchData]);

    // Handle long press to delete chat
    const handleChatLongPress = useCallback((chatItem: ChatItem) => {
        const isIndividual = chatItem.type === 'individual';
        const chatName = isIndividual 
            ? `${(chatItem.data as IndividualChatListItem).partner_first_name || ''} ${(chatItem.data as IndividualChatListItem).partner_last_name || ''}`.trim() || 'User'
            : (chatItem.data as GroupChatListItem).group_name || 'Group';

        Alert.alert(
            `Delete ${isIndividual ? 'Chat' : 'Group'}`,
            isIndividual 
                ? `Are you sure you want to delete your conversation with ${chatName}? This action cannot be undone.`
                : `Are you sure you want to leave ${chatName}? You can be re-added by other members.`,
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: isIndividual ? 'Delete' : 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        const success = isIndividual
                            ? await deleteIndividualChat(
                                (chatItem.data as IndividualChatListItem).partner_user_id,
                                session?.user?.id || ''
                            )
                            : await deleteGroupChat(
                                (chatItem.data as GroupChatListItem).group_id,
                                session?.user?.id || ''
                            );

                        if (success) {
                            // Remove from local state
                            if (isIndividual) {
                                setIndividualList(prev => prev.filter(
                                    item => item.partner_user_id !== (chatItem.data as IndividualChatListItem).partner_user_id
                                ));
                            } else {
                                setGroupList(prev => prev.filter(
                                    item => item.group_id !== (chatItem.data as GroupChatListItem).group_id
                                ));
                            }
                        } else {
                            Alert.alert(
                                'Error',
                                `Failed to ${isIndividual ? 'delete chat' : 'leave group'}. Please try again.`
                            );
                        }
                    },
                },
            ]
        );
    }, [session?.user?.id]);

    // Function to mark all messages as seen for a specific chat
    const markChatMessagesAsSeen = useCallback(async (chatItem: ChatItem) => {
        if (!session?.user?.id) return;

        const currentUserId = session.user.id; // Store in a variable to avoid repeated null checks

        try {
            if (chatItem.type === 'individual') {
                const partnerId = (chatItem.data as IndividualChatListItem).partner_user_id;
                console.log(`ChatsTabs: Marking individual messages as seen from partner ${partnerId}`);
                
                // Use a simpler approach - get all messages from partner and mark them as seen
                const { data: allMessages, error: fetchError } = await supabase
                    .from('messages')
                    .select('id')
                    .eq('sender_id', partnerId)
                    .eq('receiver_id', currentUserId);

                if (fetchError) {
                    console.error('Error fetching messages from partner:', fetchError);
                    return;
                }

                if (!allMessages || allMessages.length === 0) {
                    console.log(`ChatsTabs: No messages found from partner ${partnerId}`);
                    return;
                }

                // Try to mark messages as seen using the database function
                for (const message of allMessages) {
                    try {
                        const { error } = await supabase.rpc('mark_message_seen', { 
                            message_id_input: message.id 
                        });
                        if (error) {
                            console.warn(`Error marking message ${message.id} as seen:`, error.message);
                        }
                    } catch (e) {
                        console.warn(`Exception marking message ${message.id} as seen:`, e);
                    }
                }

                console.log(`ChatsTabs: Marked ${allMessages.length} individual messages as seen`);
            } else {
                // Group chat
                const groupId = (chatItem.data as GroupChatListItem).group_id;
                console.log(`ChatsTabs: Marking group messages as seen for group ${groupId}`);
                
                // Get all messages from this group (excluding own messages)
                const { data: allGroupMessages, error: fetchError } = await supabase
                    .from('group_chat_messages')
                    .select('id')
                    .eq('group_id', groupId)
                    .neq('sender_id', currentUserId);

                if (fetchError) {
                    console.error('Error fetching group messages:', fetchError);
                    return;
                }

                if (!allGroupMessages || allGroupMessages.length === 0) {
                    console.log(`ChatsTabs: No messages found in group ${groupId}`);
                    return;
                }

                // Try to mark group messages as seen using the database function
                for (const message of allGroupMessages) {
                    try {
                        const { error } = await supabase.rpc('mark_group_message_seen', { 
                            message_id_input: message.id,
                            user_id_input: currentUserId
                        });
                        if (error) {
                            console.warn(`Error marking group message ${message.id} as seen:`, error.message);
                        }
                    } catch (e) {
                        console.warn(`Exception marking group message ${message.id} as seen:`, e);
                    }
                }

                console.log(`ChatsTabs: Marked ${allGroupMessages.length} group messages as seen`);
            }
        } catch (error) {
            console.error('Error in markChatMessagesAsSeen:', error);
        }
    }, [session?.user?.id]);

    // Enhanced onChatOpen handler that marks messages as seen
    const handleChatOpen = useCallback(async (chatItem: ChatItem) => {
        // Mark messages as seen when opening the chat
        await markChatMessagesAsSeen(chatItem);
        
        // Call the original onChatOpen handler
        onChatOpen(chatItem);
        
        // Refresh the data after a short delay to show updated unread counts
        setTimeout(() => {
            console.log("ChatsTabs: Refreshing data after opening chat");
            fetchData();
        }, 1500);
    }, [markChatMessagesAsSeen, onChatOpen, fetchData]);

    // Filter data based on search query and active tab
    const filteredListData = useMemo((): ChatItem[] => {
        const lowerCaseQuery = searchQuery.toLowerCase();

        if (activeTab === 'individual') {
            const filtered = individualList.filter(item => {
                const name = `${item.partner_first_name || ''} ${item.partner_last_name || ''}`.trim().toLowerCase();
                return name.includes(lowerCaseQuery);
            });
            return filtered.map(item => ({ type: 'individual', data: item }));
        } else {
            const filtered = groupList.filter(item => {
                const name = item.group_name?.toLowerCase() || '';
                return name.includes(lowerCaseQuery);
            });
            return filtered.map(item => ({ type: 'group', data: item }));
        }
    }, [activeTab, individualList, groupList, searchQuery]);

    // Debug function to check unread counts manually
    const debugUnreadCounts = useCallback(async () => {
        if (!session?.user?.id) return;
        
        try {
            console.log("=== DEBUG: Checking unread counts ===");
            
            // Test individual chat unread counts
            const { data: individualData, error: individualError } = await supabase.rpc('get_chat_list_with_unread');
            if (individualError) {
                console.error("DEBUG: Error calling get_chat_list_with_unread:", individualError);
            } else {
                console.log("DEBUG: Individual chats with unread:", individualData);
            }
            
            // Test group chat unread counts  
            const { data: groupData, error: groupError } = await supabase.rpc('get_group_chat_list_with_unread');
            if (groupError) {
                console.error("DEBUG: Error calling get_group_chat_list_with_unread:", groupError);
            } else {
                console.log("DEBUG: Group chats with unread:", groupData);
            }
            
            // Check message_status table directly
            const { data: statusData, error: statusError } = await supabase
                .from('message_status')
                .select('*')
                .limit(10);
            if (statusError) {
                console.error("DEBUG: Error checking message_status:", statusError);
            } else {
                console.log("DEBUG: Sample message_status entries:", statusData);
            }
            
            // Check group_message_status table directly
            const { data: groupStatusData, error: groupStatusError } = await supabase
                .from('group_message_status')
                .select('*')
                .eq('user_id', session.user.id)
                .limit(10);
            if (groupStatusError) {
                console.error("DEBUG: Error checking group_message_status:", groupStatusError);
            } else {
                console.log("DEBUG: Sample group_message_status entries:", groupStatusData);
            }
            
            console.log("=== END DEBUG ===");
        } catch (error) {
            console.error("DEBUG: Exception during debug check:", error);
        }
    }, [session?.user?.id]);

    // Add debug button (temporary - remove in production)
    useEffect(() => {
        if (__DEV__) {
            // Expose debug function globally for testing
            (global as any).debugUnreadCounts = debugUnreadCounts;
        }
    }, [debugUnreadCounts]);

    // --- Renders the Individual Chat List ---
    const renderIndividualList = () => {
        const individualChats: IndividualChatListItem[] = filteredListData
            .filter(item => item.type === 'individual')
            .map(item => item.data as IndividualChatListItem);

        let listToShow: IndividualChatListItem[] = [];
        if (individualSubTab === 'pending') {
            listToShow = individualChats.filter(data => {
                return (data.current_user_sent_any_message && !data.partner_sent_any_message) || 
                       (!data.current_user_sent_any_message && data.partner_sent_any_message);
            });
        } else {
            listToShow = individualChats.filter(data => {
                return data.current_user_sent_any_message && data.partner_sent_any_message;
            });
        }

        if (isLoading && activeTab === 'individual' && !isRefreshing && listToShow.length === 0) {
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
                data={listToShow}
                keyExtractor={(item) => item.partner_user_id}
                renderItem={({ item }) => (
                    <ChatCard
                        id={item.partner_user_id}
                        name={`${item.partner_first_name || ''} ${item.partner_last_name || ''}`.trim() || 'User'}
                        image={item.partner_profile_picture}
                        lastMessage={formatLastMessageForPreview(item.last_message_content, item.last_message_sender_id, session?.user?.id, item.last_message_sender_name, false)}
                        time={formatTimestamp(item.last_message_created_at)}
                        unread={item.unread_count || 0}
                        isPinned={item.isPinned || false}
                        type='individual'
                        onChatOpen={() => handleChatOpen({ type: 'individual', data: item })}
                        onProfileOpen={(onProfileOpen) ? () => onProfileOpen({ type: 'individual', data: item }) : undefined}
                        onLongPress={() => handleChatLongPress({ type: 'individual', data: item })}
                    />
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
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
                removeClippedSubviews={Platform.OS === 'android'}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={11}
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
                        lastMessage={formatLastMessageForPreview(
                            item.last_message_content, 
                            item.last_message_sender_id, 
                            session?.user?.id, 
                            item.last_message_sender_name,
                            true
                        )}
                        time={formatTimestamp(item.last_message_created_at)}
                        unread={item.unread_count || 0}
                        isPinned={item.isPinned || false}
                        type='group'
                        membersPreview={
                            item.other_members_preview && item.other_members_preview.length > 0 
                                ? item.other_members_preview.map(member => member.name).join(', ')
                                : undefined
                        }
                        onChatOpen={() => handleChatOpen({ type: 'group', data: item })}
                        onLongPress={() => handleChatLongPress({ type: 'group', data: item })}
                    />
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
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
    tabsContainer: { flexDirection: 'row', backgroundColor: 'rgba(59, 130, 246, 0.05)', borderRadius: 10, padding: 4, marginBottom: 8, },
    tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, },
    activeTabButton: { backgroundColor: "white", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, },
    tabIcon: { marginRight: 6, },
    tabText: { fontSize: 14, color: "#6B7280", fontWeight: '500' },
    activeTabText: { color: APP_CONSTANTS.COLORS.PRIMARY, fontWeight: "600", },
    subTabsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 12,
        paddingHorizontal: 16,
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
    listContent: { paddingTop: 4, paddingBottom: 16, },
});

export default ChatsTabs;