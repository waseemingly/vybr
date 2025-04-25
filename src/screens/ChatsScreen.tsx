// import React, { useState, useEffect, useCallback, useMemo } from 'react';
// import {
//     View,
//     Text,
//     StyleSheet,
//     TouchableOpacity,
//     ActivityIndicator,
//     TextInput, // *** IMPORTED ***
//     Platform,
//     Keyboard, // Import Keyboard
//     // FlatList and RefreshControl are no longer directly used here
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { Feather } from '@expo/vector-icons';
// import { useNavigation, useFocusEffect } from '@react-navigation/native';
// import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// // --- Adjust Imports ---
// import { supabase } from '@/lib/supabase';
// import { useAuth } from '@/hooks/useAuth';
// import type { RootStackParamList } from "@/navigation/AppNavigator";
// import { APP_CONSTANTS } from '@/config/constants';
// import ChatsTabs from '@/components/ChatsTabs'; // Import the updated ChatsTabs
// // ChatCard is imported inside ChatsTabs now
// // --- End Adjustments ---

// type ChatsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChatsScreen'>;

// export interface ChatListItem {
//     partner_user_id: string;
//     last_message_content: string | null;
//     last_message_created_at: string;
//     partner_first_name: string | null;
//     partner_last_name: string | null;
//     partner_profile_picture: string | null;
// }

// const formatTimestamp = (timestamp: string | null): string => { /* ... timestamp logic ... */
//     if (!timestamp) return '';
//     try { const date = new Date(timestamp); const now = new Date(); const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60); if (diffHours < 24 && date.getDate() === now.getDate()) { return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }); } else if (diffHours < 48 && date.getDate() === now.getDate() - 1) { return 'Yesterday'; } else { return date.toLocaleDateString([], { month: 'short', day: 'numeric' }); } } catch (e) { console.error("Error formatting timestamp:", e); return ''; }
// };

// const ChatsScreen = () => {
//     const navigation = useNavigation<ChatsScreenNavigationProp>();
//     const { session } = useAuth();

//     const [chatList, setChatList] = useState<ChatListItem[]>([]); // Holds the full list from DB
//     const [isLoading, setIsLoading] = useState(true);
//     const [isRefreshing, setIsRefreshing] = useState(false);
//     const [error, setError] = useState<string | null>(null);
//     const [selectedProfileChat, setSelectedProfileChat] = useState<ChatListItem | null>(null);
//     const [showProfileSheet, setShowProfileSheet] = useState<boolean>(false);

//     // *** NEW State for Search and Active Tab ***
//     const [searchQuery, setSearchQuery] = useState('');
//     const [activeTab, setActiveTab] = useState<'individual' | 'groups'>('individual');
//     // *** END NEW State ***

//     // fetchChatList logic remains the same
//     const fetchChatList = useCallback(async () => { /* ... same fetch logic ... */
//         if (!isRefreshing) setIsLoading(true);
//         setError(null);
//         console.log("Fetching chat list...");
//         try {
//             const { data, error: rpcError } = await supabase.rpc('get_chat_list');
//             if (rpcError) throw rpcError;
//             setChatList(data ? (data as ChatListItem[]) : []);
//             if(data) console.log(`Fetched ${data.length} chats.`);
//             else console.log("No chat data returned.");
//         } catch (err: any) {
//             console.error("Error fetching chat list RPC:", err);
//             setError("Failed to load your chats.");
//             setChatList([]);
//         } finally {
//             setIsLoading(false);
//             setIsRefreshing(false);
//         }
//     }, [isRefreshing]);

//     // useFocusEffect remains the same
//     useFocusEffect( useCallback(() => { fetchChatList(); }, [fetchChatList]) );
//     // onRefresh logic remains the same
//     const onRefresh = useCallback(() => { setIsRefreshing(true); }, []);
//     // useEffect for refresh remains the same
//     useEffect(() => { if (isRefreshing) { fetchChatList(); } }, [isRefreshing, fetchChatList]);
//     // handleChatOpen logic remains the same
//     const handleChatOpen = (selectedChatItem: ChatListItem) => { /* ... same navigation logic ... */
//         if (!selectedChatItem?.partner_user_id) return;
//         const partnerName = `${selectedChatItem.partner_first_name || ''} ${selectedChatItem.partner_last_name || ''}`.trim() || 'Chat User';
//         navigation.navigate('IndividualChatScreen', { matchUserId: selectedChatItem.partner_user_id, matchName: partnerName, matchProfilePicture: selectedChatItem.partner_profile_picture });
//      };
//     // handleProfileOpen logic remains the same
//     const handleProfileOpen = (chatItem: ChatListItem) => { /* ... same profile sheet logic ... */
//         setSelectedProfileChat(chatItem);
//         setShowProfileSheet(true);
//      };


//     // *** Filter Logic (Applied before passing to ChatsTabs) ***
//     const filteredIndividualList = useMemo(() => {
//         if (!searchQuery) return chatList;
//         const lowerCaseQuery = searchQuery.toLowerCase();
//         return chatList.filter(item => {
//             const partnerName = `${item.partner_first_name || ''} ${item.partner_last_name || ''}`.trim().toLowerCase();
//             // Optional: filter by last message content too
//             // const messageContent = item.last_message_content?.toLowerCase() || '';
//             return partnerName.includes(lowerCaseQuery); // || messageContent.includes(lowerCaseQuery);
//         });
//     }, [chatList, searchQuery]);

//     // Placeholder for filtered group list
//     const filteredGroupList = useMemo(() => {
//         const groups: any[] = []; // Replace with actual group data later
//         if (!searchQuery) return groups;
//         // Add filtering logic for groups here
//         // return groups.filter(group => group.name.toLowerCase().includes(searchQuery.toLowerCase()));
//         return groups; // Return empty for now
//     }, [searchQuery]); // Add group data dependency later
//     // *** END Filter Logic ***


//     // *** Handler to set active tab AND clear search ***
//     const handleSetTab = useCallback((tab: 'individual' | 'groups') => {
//         if (tab !== activeTab) { // Only clear if tab actually changes
//              setSearchQuery(''); // Clear search query
//              Keyboard.dismiss(); // Dismiss keyboard
//         }
//         setActiveTab(tab);
//     }, [activeTab]); // Depend on activeTab to know if it changed


//     // --- Render Logic ---

//     // Initial Loading State
//     if (isLoading && chatList.length === 0) { /* ... loading JSX ... */
//         return (<SafeAreaView style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} /><Text style={styles.loadingText}>Loading Chats...</Text></SafeAreaView>);
//     }

//     // Error State
//     if (error) { /* ... error JSX ... */
//         return (<SafeAreaView style={styles.centered}><Feather name="alert-circle" size={40} color="#EF4444" style={{ marginBottom: 15 }}/><Text style={styles.errorText}>Oops! Couldn't load chats.</Text><Text style={styles.errorSubText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={fetchChatList}><Feather name="refresh-cw" size={16} color="#FFF" /><Text style={styles.retryButtonText}>Try Again</Text></TouchableOpacity></SafeAreaView>);
//     }

//     // Render Main Content
//     return (
//         <SafeAreaView style={styles.container} edges={['top']}>
//             {/* Header */}
//             <View style={styles.header}>
//                 {/* ... Header title/subtitle/button ... */}
//                  <View style={styles.headerTitleRow}>
//                     <View style={styles.titleContainer}>
//                         <Feather name="message-square" size={22} color="#60A5FA" style={styles.headerIcon} />
//                         <Text style={styles.title}>Chats</Text>
//                     </View>
//                  </View>
//                  <View style={styles.headerSubRow}>
//                     <Text style={styles.subtitle}>Your recent conversations</Text>
//                     <TouchableOpacity style={styles.createGroupButton} activeOpacity={0.7} onPress={() => alert('Create Group Tapped')}>
//                         <Feather name="user-plus" size={18} color="#3B82F6" />
//                     </TouchableOpacity>
//                  </View>
//             </View>

//             {/* Search Input Area */}
//             <View style={styles.searchContainer}>
//                  <View style={styles.searchInputWrapper}>
//                     <Feather name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
//                     <TextInput
//                         style={styles.searchInput}
//                         placeholder={activeTab === 'individual' ? "Search individual chats..." : "Search groups..."}
//                         placeholderTextColor="#9CA3AF"
//                         value={searchQuery}
//                         onChangeText={setSearchQuery}
//                         returnKeyType="search"
//                         autoCapitalize="none"
//                         autoCorrect={false}
//                     />
//                     {searchQuery.length > 0 && (
//                         <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
//                             <Feather name="x-circle" size={18} color="#9CA3AF" />
//                         </TouchableOpacity>
//                     )}
//                  </View>
//             </View>

//             {/* Chat List Content Area (Now contains ChatsTabs) */}
//             <View style={styles.content}>
//                 <ChatsTabs
//                     // Pass the *filtered* list based on the active tab
//                     individualChatList={activeTab === 'individual' ? filteredIndividualList : []}
//                     groupChatList={activeTab === 'groups' ? filteredGroupList : []}
//                     // Pass tab state and handler
//                     activeTab={activeTab}
//                     setActiveTab={handleSetTab} // Use the handler that clears search
//                     // Pass loading/refresh state/handlers
//                     isLoading={isLoading}
//                     isRefreshing={isRefreshing}
//                     onRefresh={onRefresh}
//                     // Pass action handlers
//                     onChatOpen={handleChatOpen}
//                     onProfileOpen={handleProfileOpen}
//                 />
//             </View>

//             {/* Profile Sheet */}
//             {/* {selectedProfileChat && ( ... Adapt ChatProfileSheet ... )} */}
//         </SafeAreaView>
//     );
// };

// // --- Styles ---
// const styles = StyleSheet.create({
//     container: { flex: 1, backgroundColor: '#F9FAFB', },
//     centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
//     loadingText: { marginTop: 10, fontSize: 16, color: '#6B7280', },
//     errorText: { marginTop: 15, fontSize: 18, fontWeight: '600', color: '#DC2626', textAlign: 'center', },
//     errorSubText: { marginTop: 8, fontSize: 14, color: '#4B5563', textAlign: 'center', maxWidth: '90%', },
//     retryButton: { flexDirection: 'row', alignItems: 'center', marginTop: 25, backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, },
//     retryButtonText: { color: 'white', fontWeight: '600', fontSize: 15, marginLeft: 8, },

//     header: { paddingTop: Platform.OS === 'android' ? 20 : 16, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', },
//     headerTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, },
//     titleContainer: { flexDirection: 'row', alignItems: 'center', },
//     headerIcon: { marginRight: 8, },
//     title: { fontSize: 22, fontWeight: 'bold', color: '#3B82F6', },
//     headerSubRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, },
//     subtitle: { fontSize: 14, color: '#6B7280', },
//     createGroupButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(59, 130, 246, 0.1)', alignItems: 'center', justifyContent: 'center', },

//     // *** Search Styles ***
//     searchContainer: {
//         paddingHorizontal: 16,
//         paddingTop: 12, // Add some space above search
//         paddingBottom:12, // Reduce space below search, before tabs
//         backgroundColor: 'white', // Match header background
//         borderBottomWidth: 1,
//         borderBottomColor: '#E5E7EB',
//     },
//     searchInputWrapper: {
//         flexDirection: 'row',
//         alignItems: 'center',
//         backgroundColor: '#F3F4F6', // Light grey background
//         borderRadius: 10,
//         paddingHorizontal: 10,
//         height: 40,
//     },
//     searchIcon: {
//         marginRight: 8,
//     },
//     searchInput: {
//         flex: 1,
//         fontSize: 15,
//         color: '#1F2937',
//         paddingVertical: 8, // Adjust vertical padding if needed
//     },
//     clearButton: {
//         padding: 4, // Make tap area slightly larger
//         marginLeft: 4,
//     },
//     // *** End Search Styles ***

//     content: { // Main content area below search/header
//         flex: 1,
//         paddingHorizontal: 16,
//         paddingTop: 8, // Remove top padding as search/tabs handle it
//     },
//     // listContent style removed as it's handled inside ChatsTabs now
// });

// export default ChatsScreen;

// src/screens/ChatsScreen.tsx

// src/screens/ChatsScreen.tsx

import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Platform,
    Keyboard,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons'; // Ensure Feather is imported
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// --- Adjust Imports ---
import type { RootStackParamList } from "@/navigation/AppNavigator"; // Adjust path
import { APP_CONSTANTS } from '@/config/constants'; // Adjust path
import ChatsTabs, { ChatItem } from '@/components/ChatsTabs'; // Import updated ChatsTabs and ChatItem type (adjust path)
// --- End Adjustments ---

type ChatsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChatsScreen'>;

const ChatsScreen = () => {
    const navigation = useNavigation<ChatsScreenNavigationProp>();

    // State managed by this screen: Search Query and Active Tab
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'individual' | 'groups'>('individual');

    // --- Handlers ---

    // Navigate to the correct chat screen based on item type
    const handleChatOpen = useCallback((selectedChatItem: ChatItem) => {
        Keyboard.dismiss(); // Dismiss keyboard on navigation
        if (selectedChatItem.type === 'individual') {
            const itemData = selectedChatItem.data;
            const partnerName = `${itemData.partner_first_name || ''} ${itemData.partner_last_name || ''}`.trim() || 'Chat';
            console.log(`Navigating to Individual Chat: ${itemData.partner_user_id}`);
            navigation.navigate('IndividualChatScreen', {
                matchUserId: itemData.partner_user_id,
                matchName: partnerName,
                matchProfilePicture: itemData.partner_profile_picture
            });
        } else { // type === 'group'
            const itemData = selectedChatItem.data;
            console.log(`Navigating to Group Chat: ${itemData.group_id}`);
            navigation.navigate('GroupChatScreen', {
                groupId: itemData.group_id,
                groupName: itemData.group_name,
                groupImage: itemData.group_image
            });
        }
    }, [navigation]);

    // Placeholder/Example handler for opening a profile (individual only)
    const handleProfileOpen = useCallback((chatItem: ChatItem) => {
         if (chatItem.type === 'individual') {
              console.log("Request to open profile for:", chatItem.data.partner_user_id);
              Alert.alert(`Open Profile (Example)`, `Would open profile for ${chatItem.data.partner_first_name || 'User'}`);
              // Example navigation:
              // navigation.navigate('OtherUserProfileScreen', { userId: chatItem.data.partner_user_id });
         }
     }, [navigation]); // Add navigation dependency

    // Handler to set active tab AND clear search when tab changes
    const handleSetTab = useCallback((tab: 'individual' | 'groups') => {
        if (tab !== activeTab) { // Prevent unnecessary state updates/clearing
            console.log(`Switching tab to: ${tab}`);
            setSearchQuery(''); // Clear search when switching tabs
            Keyboard.dismiss();
        }
        setActiveTab(tab);
    }, [activeTab]); // Depend on activeTab

    // Handler for Create Group Button Tap
    const handleCreateGroupTap = () => {
         console.log("Navigating to Create Group Screen");
         navigation.navigate('CreateGroupChatScreen');
    };


    // --- Render Logic ---
    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Custom Header Area */}
            <View style={styles.header}>
                 <View style={styles.headerTitleRow}>
                    {/* Title */}
                    <View style={styles.titleContainer}>
                        <Feather name="message-square" size={24} color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} style={styles.headerIcon} />
                        <Text style={styles.title}>Chats</Text>
                    </View>
                    {/* Create Group Button - ICON CHANGED HERE */}
                    <TouchableOpacity style={styles.createGroupButton} activeOpacity={0.7} onPress={handleCreateGroupTap}>
                         <Feather name="user-plus" size={20} color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} />
                         {/* Adjusted size slightly for user-plus */}
                    </TouchableOpacity>
                 </View>
            </View>

            {/* Search Input Area */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputWrapper}>
                    <Feather name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={activeTab === 'individual' ? "Search chats..." : "Search groups..."}
                        placeholderTextColor="#9CA3AF"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        returnKeyType="search"
                        autoCapitalize="none"
                        autoCorrect={false}
                        clearButtonMode="while-editing" // iOS clear button
                    />
                    {/* Android clear button */}
                    {searchQuery.length > 0 && Platform.OS === 'android' && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                            <Feather name="x-circle" size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Chat List Content Area -> Renders ChatsTabs */}
            <View style={styles.content}>
                <ChatsTabs
                    // Pass state and handlers down
                    activeTab={activeTab}
                    setActiveTab={handleSetTab}
                    onChatOpen={handleChatOpen}
                    onProfileOpen={handleProfileOpen}
                    searchQuery={searchQuery}
                />
            </View>
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        paddingTop: Platform.OS === 'android' ? 15 : 10,
        paddingBottom: 12,
        paddingHorizontal: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIcon: {
        marginRight: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    createGroupButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.2)',
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
    },
    searchInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 42,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#1F2937',
        paddingVertical: 8,
    },
    clearButton: {
        padding: 4,
        marginLeft: 4,
    },
    content: {
        flex: 1,
        paddingHorizontal: Platform.OS === 'web' ? 0 : 16,
        paddingTop: 0,
    },
    // Keep loading/error styles if they were used elsewhere or needed as fallbacks
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    loadingText: { marginTop: 10, fontSize: 16, color: '#6B7280' },
    errorText: { marginTop: 15, fontSize: 18, fontWeight: '600', color: '#DC2626', textAlign: 'center' },
    errorSubText: { marginTop: 8, fontSize: 14, color: '#4B5563', textAlign: 'center', maxWidth: '90%' },
    retryButton: { flexDirection: 'row', alignItems: 'center', marginTop: 25, backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8 },
    retryButtonText: { color: 'white', fontWeight: '600', fontSize: 15, marginLeft: 8 },
});

export default ChatsScreen;