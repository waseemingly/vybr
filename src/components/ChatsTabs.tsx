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

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { useRealtime } from '@/context/RealtimeContext';
import NetInfo from '@react-native-community/netinfo';

// --- Adjust Imports ---
import ChatCard from './ChatCard';
// Import type for individual chat items (can be defined here or imported)
export interface IndividualChatListItem {
    partner_user_id: string;
    last_message_content: string | null;
    last_message_content_format?: 'plain' | 'e2e';
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
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { APP_CONSTANTS } from '@/config/constants';
import type { IndividualSubTab } from '@/screens/ChatsScreen';

// NEW: Import new modular services (parallel implementation)
import { useMessageFetching } from '@/hooks/message/useMessageFetching';
import { useMessageSending } from '@/hooks/message/useMessageSending';
import { MessageStatusService } from '@/services/message/MessageStatusService';
import { decryptMessageContent } from '@/lib/e2e/e2eService';

// PowerSync imports for mobile
import { useIndividualChatListWithUnread, useGroupChatListWithUnread } from '@/lib/powersync/chatFunctions';
//import { useIndividualChatList, useGroupChatList } from '@/lib/powersync/chatFunctions';
import { usePowerSync } from '@/context/PowerSyncContext';
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
    selectedChatId?: string; // New prop for notification navigation
    selectedChatType?: 'individual' | 'group'; // New prop for notification navigation
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

// Heuristic: content that looks like E2E ciphertext (base64) when RPC doesn't return content_format
const looksLikeE2eCiphertext = (content: string | null): boolean =>
    !!content && content.length >= 20 && /^[A-Za-z0-9+/]+=*$/.test(content) && !content.startsWith('SHARED_EVENT:');

// Wrapper that decrypts E2E last message for chat list preview (same logic as IndividualChatScreen)
const IndividualChatRow: React.FC<{
    item: IndividualChatListItem;
    currentUserId: string | undefined;
    onChatOpen: () => void;
    onProfileOpen?: () => void;
    onLongPress: () => void;
}> = ({ item, currentUserId, onChatOpen, onProfileOpen, onLongPress }) => {
    const [displayPreview, setDisplayPreview] = useState<string | null>(item.last_message_content);
    const isE2e = item.last_message_content && (
        item.last_message_content_format === 'e2e' || looksLikeE2eCiphertext(item.last_message_content)
    );

    useEffect(() => {
        if (!isE2e || !currentUserId || !item.partner_user_id) {
            setDisplayPreview(item.last_message_content);
            return;
        }
        let cancelled = false;
        decryptMessageContent(
            item.last_message_content!,
            'e2e',
            { type: 'individual', userId: currentUserId, peerId: item.partner_user_id }
        ).then((decrypted) => {
            if (!cancelled) setDisplayPreview(decrypted);
        });
        return () => { cancelled = true; };
    }, [item.last_message_content, item.last_message_content_format, item.partner_user_id, currentUserId, isE2e]);

    return (
        <ChatCard
            id={item.partner_user_id}
            name={`${item.partner_first_name || ''} ${item.partner_last_name || ''}`.trim() || 'User'}
            image={item.partner_profile_picture}
            lastMessage={formatLastMessageForPreview(displayPreview ?? null, item.last_message_sender_id, currentUserId, item.last_message_sender_name, false)}
            time={formatTimestamp(item.last_message_created_at)}
            unread={item.unread_count || 0}
            isPinned={item.isPinned || false}
            type="individual"
            onChatOpen={onChatOpen}
            onProfileOpen={onProfileOpen}
            onLongPress={onLongPress}
        />
    );
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
    selectedChatId,
    selectedChatType,
}) => {
    const { session } = useAuth();
    const { subscribeToEvent, unsubscribeFromEvent } = useRealtime();
    const { refreshUnreadCount } = useUnreadCount(); // Use the hook instead of fetching separately
    
    // PowerSync context for mobile detection
    const { isMobile, isPowerSyncAvailable, isOffline } = usePowerSync();
    
    // State for Supabase (web) fallback
    const [individualList, setIndividualList] = useState<IndividualChatListItem[]>([]);
    const [groupList, setGroupList] = useState<GroupChatListItem[]>([]);
    /** Realtime overrides for group name/image so chat list updates when a group is renamed without refresh */
    const [groupChatUpdates, setGroupChatUpdates] = useState<Record<string, { group_name?: string | null; group_image?: string | null }>>({});
    /** Realtime: group IDs deleted so we remove them from the list (works for PowerSync path too) */
    const [deletedGroupIds, setDeletedGroupIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [useNewServices] = useState(false);
    const [isNetworkConnected, setIsNetworkConnected] = useState(true);

    // Use ref to store the latest fetchData function
    const fetchDataRef = useRef<((refreshing?: boolean) => Promise<void>) | undefined>(undefined);

    // PowerSync hooks for mobile
    const individualChatResult = useIndividualChatListWithUnread(session?.user?.id || '');
    const groupChatResult = useGroupChatListWithUnread(session?.user?.id || '');

    // Network state listener
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            const isConnected = state.isConnected && state.isInternetReachable;
            setIsNetworkConnected(isConnected);
            console.log(`ChatsTabs: Network state changed - Connected: ${isConnected}`);
        });

        return () => unsubscribe();
    }, []);

    // Debug PowerSync data availability
    useEffect(() => {
        if (isMobile && isPowerSyncAvailable) {
            console.log('🔍 PowerSync Debug - Data Availability:', {
                individualChats: individualChatResult.chats.length,
                groupChats: groupChatResult.chats.length,
                individualLoading: individualChatResult.loading,
                groupLoading: groupChatResult.loading,
                individualError: individualChatResult.error,
                groupError: groupChatResult.error,
                isOffline: isOffline,
                isNetworkConnected: isNetworkConnected
            });
        }
    }, [isMobile, isPowerSyncAvailable, individualChatResult.chats.length, groupChatResult.chats.length, individualChatResult.loading, groupChatResult.loading, isOffline, isNetworkConnected]);

    // Fetch data function (fetches chat lists WITHOUT unread counts - those come from useUnreadCount)
    const fetchData = useCallback(async (refreshing = false) => {
        if (!session?.user?.id) {
            setError("Not logged in."); 
            setIsLoading(false); 
            setIsRefreshing(false); 
            return;
        }
        
        // Check if we're offline or PowerSync has data - skip Supabase call
        console.log(`ChatsTabs: Network check - isNetworkConnected: ${isNetworkConnected}, isOffline: ${isOffline}, PowerSync available: ${isPowerSyncAvailable}`);
        
        // First check: Are we offline?
        if (!isNetworkConnected || isOffline) {
            console.log("ChatsTabs: No network connection or offline - skipping Supabase call");
            console.log("ChatsTabs: Using PowerSync data for offline mode");
            setIsLoading(false);
            setIsRefreshing(false);
            return;
        }
        
        // Second check: If PowerSync is available and has data, skip Supabase call for chat lists
        if (isMobile && isPowerSyncAvailable) {
            const hasIndividualData = individualChatResult.chats.length > 0;
            const hasGroupData = groupChatResult.chats.length > 0;
            
            if (hasIndividualData || hasGroupData) {
                console.log("ChatsTabs: PowerSync has chat data available, skipping Supabase call");
                setIsLoading(false);
                setIsRefreshing(false);
                return;
            }
        }
        
        // For mobile without PowerSync, use Supabase
        if (isMobile && !isPowerSyncAvailable) {
            console.log(`ChatsTabs: PowerSync disabled - using Supabase only`);
        }
        
        // For web, use Supabase
        if (!refreshing) setIsLoading(true);
        else setIsRefreshing(true);
        
        setError(null);
        console.log("ChatsTabs: Fetching chat lists from Supabase...");

        try {
            // Fetch chat lists WITHOUT unread counts to avoid duplicate calls
            const [individualResult, groupResult] = await Promise.all([
                supabase.rpc('get_chat_list_with_unread'), // Changed to get_chat_list without unread
                supabase.rpc('get_group_chat_list_with_unread') // Changed to get_group_chat_list without unread
            ]);

            if (individualResult.error) throw new Error(`Individual chats: ${individualResult.error.message}`);
            setIndividualList(individualResult.data || []);

            if (groupResult.error) throw new Error(`Group chats: ${groupResult.error.message}`);
            setGroupList(groupResult.data || []);
            setDeletedGroupIds(new Set()); // clear realtime-deleted set; server list is source of truth

            console.log(`ChatsTabs: Fetched ${individualResult.data?.length ?? 0} individual, ${groupResult.data?.length ?? 0} group.`);

        } catch (err: any) {
            console.error("ChatsTabs: Error fetching chat lists:", err);
            
            // Check if this is a network error and we have PowerSync data
            const errorMessage = err.message || '';
            const isNetworkError = errorMessage.includes('Network request failed') || 
                                  errorMessage.includes('Network request timed out') ||
                                  errorMessage.includes('fetch') ||
                                  errorMessage.includes('timeout');
            
            if (isNetworkError && isMobile && isPowerSyncAvailable) {
                console.log("ChatsTabs: Network error detected, but PowerSync is available - using cached data");
                // Don't set error, just use PowerSync data
                setError(null);
            } else {
                setError("Failed to load chats.");
                setIndividualList([]); 
                setGroupList([]);
            }
        } finally {
            setIsLoading(false); 
            setIsRefreshing(false);
        }
    }, [session?.user?.id, isMobile, isPowerSyncAvailable, isOffline, isNetworkConnected]);

    // Update the ref with the latest fetchData function
    useEffect(() => {
        fetchDataRef.current = fetchData;
    }, [fetchData]);

    // Fetch on mount and when session changes
    useEffect(() => {
        if (useNewServices) {
            // NEW: Use new chat list fetching service
            console.log('[NEW] Using new ChatsTabs fetching service');
            // For now, still use the old fetchData but log that we're using new services
            fetchData();
        } else {
            // OLD: Use existing chat list fetching
            console.log('[OLD] Using existing ChatsTabs fetching service');
            fetchData();
        }
    }, [session?.user?.id, useNewServices]); // Removed fetchData from dependencies

    // Get the appropriate data based on platform
    const getIndividualList = useMemo(() => {
        if (isMobile && isPowerSyncAvailable) {
            console.log('🔍 PowerSync Debug - Individual Chat Result:', {
                chats: individualChatResult.chats,
                loading: individualChatResult.loading,
                error: individualChatResult.error,
                chatCount: individualChatResult.chats.length,
                isOffline: isOffline
            });
            
            // Use PowerSync data if available
            if (individualChatResult.chats.length > 0) {
                console.log(`🔍 PowerSync: Using ${individualChatResult.chats.length} individual chats from PowerSync`);
                return individualChatResult.chats.map(chat => chat.data as IndividualChatListItem);
            }
            
            // If PowerSync is still loading, show loading state
            if (individualChatResult.loading) {
                console.log('🔍 PowerSync: Still loading individual chats from PowerSync');
                return individualList; // Keep existing data while loading
            }
            
            // If PowerSync has no data and not loading, fallback to Supabase
            console.log('🔍 PowerSync: No individual chats found, using Supabase fallback');
            return individualList;
        }
        // Fallback to Supabase data if PowerSync is not available
        console.log('🔍 PowerSync: Using Supabase fallback for individual chats');
        return individualList;
    }, [isMobile, isPowerSyncAvailable, individualChatResult.chats, individualList, isOffline]);

    const getGroupList = useMemo(() => {
        let baseList: GroupChatListItem[];
        if (isMobile && isPowerSyncAvailable) {
            console.log('🔍 PowerSync Debug - Group Chat Result:', {
                chats: groupChatResult.chats,
                loading: groupChatResult.loading,
                error: groupChatResult.error,
                chatCount: groupChatResult.chats.length,
                isOffline: isOffline
            });
            
            // Use PowerSync data if available
            if (groupChatResult.chats.length > 0) {
                console.log(`🔍 PowerSync: Using ${groupChatResult.chats.length} group chats from PowerSync`);
                baseList = groupChatResult.chats.map(chat => chat.data as GroupChatListItem);
            } else if (groupChatResult.loading) {
                console.log('🔍 PowerSync: Still loading group chats from PowerSync');
                baseList = groupList;
            } else {
                console.log('🔍 PowerSync: No group chats found, using Supabase fallback');
                baseList = groupList;
            }
        } else {
            console.log('🔍 PowerSync: Using Supabase fallback for group chats');
            baseList = groupList;
        }
        // Filter out groups deleted in realtime (so list updates without refresh for both Supabase and PowerSync)
        const withoutDeleted = baseList.filter(item => !deletedGroupIds.has(item.group_id));
        // Apply realtime overrides so renamed/updated groups (name or image) update in the list without refresh
        return withoutDeleted.map(item => {
            const overrides = groupChatUpdates[item.group_id];
            if (!overrides) return item;
            return {
                ...item,
                group_name: overrides.group_name !== undefined ? overrides.group_name : item.group_name,
                group_image: overrides.group_image !== undefined ? overrides.group_image : item.group_image,
            };
        });
    }, [isMobile, isPowerSyncAvailable, groupChatResult.chats, groupList, isOffline, groupChatUpdates, deletedGroupIds]);

    const getIsLoading = useMemo(() => {
        if (isMobile && isPowerSyncAvailable) {
            // For mobile with PowerSync, show loading only if both individual and group chats are loading
            return individualChatResult.loading || groupChatResult.loading;
        }
        return isLoading;
    }, [isMobile, isPowerSyncAvailable, individualChatResult.loading, groupChatResult.loading, isLoading]);

    const getError = useMemo(() => {
        if (isMobile && isPowerSyncAvailable) {
            // In offline mode, don't show network-related errors
            if (isOffline && (individualChatResult.error || groupChatResult.error)) {
                const error = individualChatResult.error || groupChatResult.error;
                if (error && (error.includes('network') || error.includes('fetch') || error.includes('timeout'))) {
                    console.log('🔍 PowerSync: Suppressing network error in offline mode');
                    return null;
                }
            }
            return individualChatResult.error || groupChatResult.error;
        }
        // If PowerSync is not available on mobile, show Supabase error
        if (isMobile && !isPowerSyncAvailable) {
            return error;
        }
        return error;
    }, [isMobile, isPowerSyncAvailable, individualChatResult.error, groupChatResult.error, error, isOffline]);

    // Enhanced real-time useEffect for smooth updates
    useEffect(() => {
        if (!session?.user?.id) return;

        // --- Handler for new individual messages ---
        const handleNewIndividualMessage = async (payload: any) => {
            if (!session?.user) return; // Guard clause
            const newMessage = payload.new as {
                id: string; sender_id: string; receiver_id: string; content: string; content_format?: 'plain' | 'e2e'; created_at: string;
            };

            // Only process messages sent to the current user
            if (newMessage.receiver_id !== session.user.id) return;
            
            const partnerId = newMessage.sender_id;
            let previewContent = newMessage.content;
            if (newMessage.content_format === 'e2e' && newMessage.content) {
                previewContent = await decryptMessageContent(
                    newMessage.content,
                    'e2e',
                    { type: 'individual', userId: session.user.id, peerId: partnerId }
                );
            }
            
            setIndividualList(currentList => {
                const chatIndex = currentList.findIndex(c => c.partner_user_id === partnerId);

                // If chat doesn't exist yet, it's a new conversation.
                // Fetch the full list to get all profile details for the new chat.
                if (chatIndex === -1) {
                    console.log('ChatsTabs: New conversation detected, fetching full list.');
                    // Use setTimeout to avoid calling fetchData during render
                    setTimeout(() => {
                        fetchDataRef.current?.();
                        refreshUnreadCount();
                    }, 0);
                    return currentList; 
                }

                // If chat exists, update it smoothly
                console.log('ChatsTabs: Updating existing individual chat smoothly.');
                const existingChat = { ...currentList[chatIndex] };

                existingChat.last_message_content = previewContent;
                existingChat.last_message_content_format = newMessage.content_format ?? 'plain';
                existingChat.last_message_created_at = newMessage.created_at;
                existingChat.last_message_sender_id = newMessage.sender_id;
                //existingChat.unread_count = (existingChat.unread_count || 0) + 1;
                
                // Remove the old item and prepend the updated one to move it to the top
                const updatedList = [existingChat, ...currentList.filter(c => c.partner_user_id !== partnerId)];
                setTimeout(() => {
                    fetchDataRef.current?.();
                    refreshUnreadCount();
                }, 100);
                return updatedList;
            });
        };
        
        // --- Handler for individual message seen status updates ---
        const handleIndividualMessageSeen = (payload: any) => {
            if (!session?.user) return; // Guard clause
            
            const statusUpdate = payload.new;
            if (!statusUpdate || !statusUpdate.message_id || !statusUpdate.is_seen) return;
            
            console.log('ChatsTabs: Individual message seen status update received:', statusUpdate);
            
            // Update the unread count for the specific chat
            setIndividualList(currentList => {
                return currentList.map(chat => {
                    // For now, we'll refresh the data to ensure accuracy
                    // In a more optimized implementation, you'd need to track which messages belong to which chats
                    return chat;
                });
            });
            
            // Refresh unread count from the hook instead of fetching data
            setTimeout(() => refreshUnreadCount(), 100);
        };
        
        // --- Handler for group message seen status updates ---
        const handleGroupMessageSeen = (payload: any) => {
            if (!session?.user) return; // Guard clause
            
            const statusUpdate = payload.new;
            if (!statusUpdate || !statusUpdate.message_id || !statusUpdate.is_seen) return;
            
            console.log('ChatsTabs: Group message seen status update received:', statusUpdate);
            
            // Update the unread count for the specific group chat
            setGroupList(currentList => {
                return currentList.map(chat => {
                    // For now, we'll refresh the data to ensure accuracy
                    // In a more optimized implementation, you'd need to track which messages belong to which chats
                    return chat;
                });
            });
            
            // Refresh unread count from the hook instead of fetching data
            setTimeout(() => refreshUnreadCount(), 100);
        };
        
        // --- Handler for new group messages ---
        const handleNewGroupMessage = (payload: any) => {
            if (!session?.user) return; // Guard clause
            const newMessage = payload.new as {
                id: string; group_id: string; sender_id: string; content: string; created_at: string;
            };
            
            // Ignore messages sent by the current user
            if (newMessage.sender_id === session.user.id) return;

            setGroupList(currentList => {
                const chatIndex = currentList.findIndex(c => c.group_id === newMessage.group_id);

                // If user was just added to group, fetch list to get details
                if (chatIndex === -1) {
                    console.log('ChatsTabs: New group chat detected, fetching full list.');
                    // Use setTimeout to avoid calling fetchData during render
                    setTimeout(() => {
                        fetchDataRef.current?.();
                        refreshUnreadCount();
                    }, 0);
                    return currentList;
                }

                // If group chat exists, update it smoothly
                console.log('ChatsTabs: Updating existing group chat smoothly.');
                const existingChat = { ...currentList[chatIndex] };
                
                existingChat.last_message_content = newMessage.content;
                existingChat.last_message_created_at = newMessage.created_at;
                existingChat.last_message_sender_id = newMessage.sender_id;
                //existingChat.unread_count = (existingChat.unread_count || 0) + 1;
                // Note: The sender's name is not in the real-time payload.
                // The name preview will update on the next full refresh.
                
                const updatedList = [existingChat, ...currentList.filter(c => c.group_id !== newMessage.group_id)];
                setTimeout(() => {
                    fetchDataRef.current?.();
                    refreshUnreadCount();
                }, 100);
                return updatedList;
            });
        };

        const handleNewGroupAdded = (payload: any) => {
            console.log('ChatsTabs: Current user was added to a group, refreshing chat list.', payload);
            // Use setTimeout to avoid calling fetchData during render
            setTimeout(() => {
                fetchDataRef.current?.();
                refreshUnreadCount();
            }, 0);
        };

        // For status updates (e.g., "seen"), refresh unread count from the hook
        const handleStatusUpdate = (payload: any) => {
            console.log('ChatsTabs: Status update received, refreshing unread count.', payload);
            
            // For individual message status updates, we can optimize by updating the specific chat
            if (payload.new && payload.new.message_id) {
                const messageId = payload.new.message_id;
                const isSeen = payload.new.is_seen;
                
                // Find the chat that contains this message and update its unread count
                setIndividualList(currentList => {
                    return currentList.map(chat => {
                        // This is a simplified approach - in a real implementation,
                        // you'd need to track which messages belong to which chats
                        // For now, we'll refresh the data to ensure accuracy
                        return chat;
                    });
                });
            }
            
            // Refresh unread count from the hook instead of fetching data
            setTimeout(() => refreshUnreadCount(), 0);
        };

        // Subscribe to events
        subscribeToEvent('new_message_notification', handleNewIndividualMessage);
        subscribeToEvent('new_group_message_notification', handleNewGroupMessage);
        subscribeToEvent('message_status_updated', handleStatusUpdate);
        subscribeToEvent('group_message_status_updated', handleStatusUpdate);
        subscribeToEvent('new_group_added_notification', handleNewGroupAdded);
        subscribeToEvent('message_status_updated', handleIndividualMessageSeen);
        subscribeToEvent('group_message_status_updated', handleGroupMessageSeen);

        return () => {
            // Unsubscribe on cleanup
            unsubscribeFromEvent('new_message_notification', handleNewIndividualMessage);
            unsubscribeFromEvent('new_group_message_notification', handleNewGroupMessage);
            unsubscribeFromEvent('message_status_updated', handleStatusUpdate);
            unsubscribeFromEvent('group_message_status_updated', handleStatusUpdate);
            unsubscribeFromEvent('new_group_added_notification', handleNewGroupAdded);
            unsubscribeFromEvent('message_status_updated', handleIndividualMessageSeen);
            unsubscribeFromEvent('group_message_status_updated', handleGroupMessageSeen);
        };
    }, [subscribeToEvent, unsubscribeFromEvent, session?.user?.id]);

    // Realtime: update chat list when a group's name/image changes or when a group is deleted
    useEffect(() => {
        const channel = supabase
            .channel('chats_tabs_group_chats_updates')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'group_chats' },
                (payload: { new: Record<string, unknown> }) => {
                    const id = payload.new?.id as string | undefined;
                    if (!id) return;
                    const group_name = payload.new?.group_name as string | null | undefined;
                    const group_image = payload.new?.group_image as string | null | undefined;
                    setGroupChatUpdates(prev => ({
                        ...prev,
                        [id]: {
                            group_name: group_name !== undefined ? group_name : prev[id]?.group_name,
                            group_image: group_image !== undefined ? group_image : prev[id]?.group_image,
                        },
                    }));
                    setGroupList(prev =>
                        prev.map(item =>
                            item.group_id === id
                                ? {
                                      ...item,
                                      group_name: group_name !== undefined ? group_name : item.group_name,
                                      group_image: group_image !== undefined ? group_image : item.group_image,
                                  }
                                : item
                        )
                    );
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'group_chats' },
                (payload: { old: Record<string, unknown> }) => {
                    const id = payload.old?.id as string | undefined;
                    if (!id) return;
                    setGroupChatUpdates(prev => {
                        const next = { ...prev };
                        delete next[id];
                        return next;
                    });
                    setDeletedGroupIds(prev => new Set(prev).add(id));
                    setGroupList(prev => prev.filter(item => item.group_id !== id));
                }
            )
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') console.log('ChatsTabs: Subscribed to group_chats updates and deletes');
                if (err) console.error('ChatsTabs: group_chats subscription error:', err);
            });
        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Fetch data when the screen comes into focus (this is still useful)
    useFocusEffect(
        useCallback(() => {
            const now = Date.now();
            // ...
            fetchData();
            // ...
        }, [session?.user?.id]) // Remove fetchData from dependency array
    );

    // Handle pull-to-refresh
    const onRefresh = useCallback(() => {
        fetchData(true);
    }, []);

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

    // Enhanced function to mark all messages as seen for a specific chat with better error handling
    const markChatMessagesAsSeen = useCallback(async (chatItem: ChatItem) => {
        if (!session?.user?.id) return;

        const currentUserId = session.user.id;
        const startTime = Date.now();

        try {
            if (chatItem.type === 'individual') {
                const partnerId = (chatItem.data as IndividualChatListItem).partner_user_id;
                console.log(`ChatsTabs: Marking individual messages as seen from partner ${partnerId}`);
                
                // For PowerSync, we'll skip the message marking for now since it's handled by the chat screen
                // The chat screen will handle marking messages as seen when it opens
                console.log(`ChatsTabs: Skipping message marking for PowerSync - will be handled by chat screen`);
                
            } else {
                // Group chat
                const groupId = (chatItem.data as GroupChatListItem).group_id;
                console.log(`ChatsTabs: Marking group messages as seen for group ${groupId}`);
                
                // For PowerSync, we'll skip the message marking for now since it's handled by the chat screen
                // The chat screen will handle marking messages as seen when it opens
                console.log(`ChatsTabs: Skipping group message marking for PowerSync - will be handled by chat screen`);
            }
        } catch (error) {
            console.error('Error in markChatMessagesAsSeen:', error);
        } finally {
            const endTime = Date.now();
            console.log(`ChatsTabs: Message marking completed in ${endTime - startTime}ms`);
        }
    }, [session?.user?.id]);

    // Enhanced onChatOpen handler that marks messages as seen
    const handleChatOpen = useCallback(async (chatItem: ChatItem) => {
        console.log('🔍 ChatsTabs: handleChatOpen called with:', {
            type: chatItem.type,
            data: chatItem.data,
            isMobile,
            isPowerSyncAvailable
        });
        
        try {
            console.log('🔍 ChatsTabs: About to mark messages as seen...');
            // Mark messages as seen when opening the chat
            await markChatMessagesAsSeen(chatItem);
            console.log('🔍 ChatsTabs: Messages marked as seen successfully');
            
            // Call the original onChatOpen handler
            console.log('🔍 ChatsTabs: About to call onChatOpen handler...');
            console.log('🔍 ChatsTabs: onChatOpen function exists:', !!onChatOpen);
            onChatOpen(chatItem);
            console.log('🔍 ChatsTabs: onChatOpen handler completed');
            
            // Refresh the data after a short delay to show updated unread counts
            setTimeout(() => {
                console.log("ChatsTabs: Refreshing data after opening chat");
                fetchData();
            }, 1500);
        } catch (error) {
            console.error('🔍 ChatsTabs: Error in handleChatOpen:', error);
        }
    }, [markChatMessagesAsSeen, onChatOpen, isMobile, isPowerSyncAvailable]);

    // Filter data based on search query and active tab
    const filteredListData = useMemo((): ChatItem[] => {
        const lowerCaseQuery = searchQuery.toLowerCase();

        if (activeTab === 'individual') {
            const filtered = getIndividualList.filter(item => {
                const name = `${item.partner_first_name || ''} ${item.partner_last_name || ''}`.trim().toLowerCase();
                return name.includes(lowerCaseQuery);
            });
            return filtered.map(item => ({ type: 'individual', data: item }));
        } else {
            const filtered = getGroupList.filter(item => {
                const name = item.group_name?.toLowerCase() || '';
                return name.includes(lowerCaseQuery);
            });
            return filtered.map(item => ({ type: 'group', data: item }));
        }
    }, [activeTab, getIndividualList, getGroupList, searchQuery]);

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

    // Auto-select chat when notification navigation occurs (web only)
    useEffect(() => {
        if (Platform.OS === 'web' && selectedChatId && selectedChatType && filteredListData.length > 0) {
            console.log('[ChatsTabs] Auto-selecting chat from notification:', { selectedChatId, selectedChatType });
            
            // Find the chat in the filtered list
            const targetChat = filteredListData.find(chat => {
                if (selectedChatType === 'individual' && chat.type === 'individual') {
                    return chat.data.partner_user_id === selectedChatId;
                } else if (selectedChatType === 'group' && chat.type === 'group') {
                    return chat.data.group_id === selectedChatId;
                }
                return false;
            });
            
            if (targetChat) {
                console.log('[ChatsTabs] Found target chat, auto-selecting:', targetChat);
                onChatOpen(targetChat);
            } else {
                console.log('[ChatsTabs] Target chat not found in list, may need to switch tabs');
                // If the chat is not in the current tab, switch to the correct tab
                if (selectedChatType === 'individual' && activeTab !== 'individual') {
                    setActiveTab('individual');
                } else if (selectedChatType === 'group' && activeTab !== 'groups') {
                    setActiveTab('groups');
                }
            }
        }
    }, [selectedChatId, selectedChatType, filteredListData, onChatOpen, activeTab, setActiveTab]);

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

        // Only show loading for web platform, not for mobile with PowerSync
        if (getIsLoading && activeTab === 'individual' && !isRefreshing && listToShow.length === 0 && !isMobile) {
            return ( <View style={styles.centered}><ActivityIndicator size="small" color="#6B7280" /></View> );
        }
        
        if (!getIsLoading && activeTab === 'individual' && listToShow.length === 0) {
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
                    <IndividualChatRow
                        item={item}
                        currentUserId={session?.user?.id}
                        onChatOpen={() => handleChatOpen({ type: 'individual', data: item })}
                        onProfileOpen={(onProfileOpen) ? () => onProfileOpen({ type: 'individual', data: item }) : undefined}
                        onLongPress={() => handleChatLongPress({ type: 'individual', data: item })}
                    />
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.listContent,
                    Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth < 768 && { paddingBottom: (styles.listContent.paddingBottom || 0) + 20 }
                ]}
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

        // Only show loading for web platform, not for mobile with PowerSync
        if (getIsLoading && activeTab === 'groups' && !isRefreshing && groupChats.length === 0 && !isMobile) {
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
                contentContainerStyle={[
                    styles.listContent,
                    Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth < 768 && { paddingBottom: (styles.listContent.paddingBottom || 0) + 20 }
                ]}
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
                {getError ? (
                     <View style={styles.centered}>
                        <Text style={styles.errorText}>{getError}</Text>
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

import { chatsTabsStyles as styles } from '@/styles/chatstyles';

export default ChatsTabs;