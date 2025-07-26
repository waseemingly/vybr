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
import ChatsTabs, { ChatItem, IndividualChatListItem } from '@/components/ChatsTabs'; // Import updated ChatsTabs and ChatItem type (adjust path)
import ChatPanelWrapper from '@/components/ChatPanelWrapper'; // Import the new ChatPanelWrapper component
// --- End Adjustments ---

type ChatsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChatsScreen'>;

// New type for individual sub-tabs
export type IndividualSubTab = 'chats' | 'pending';

const ChatsScreen = () => {
    const navigation = useNavigation<ChatsScreenNavigationProp>();

    // State managed by this screen: Search Query and Active Tab
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'individual' | 'groups'>('individual');
    // New state for individual sub-tab
    const [individualSubTab, setIndividualSubTab] = useState<IndividualSubTab>('chats');
    
    // New state for web chat panel
    const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);

    // --- Handlers ---

    // Navigate to the correct chat screen based on item type
    const handleChatOpen = useCallback((selectedChatItem: ChatItem) => {
        Keyboard.dismiss(); // Dismiss keyboard on navigation
        
        if (Platform.OS === 'web') {
            // On web, use the chat panel instead of navigation
            setSelectedChat(selectedChatItem);
        } else {
            // On mobile, use normal navigation
            if (selectedChatItem.type === 'individual') {
                const itemData = selectedChatItem.data as IndividualChatListItem; // Cast to ensure type safety with new fields
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
        }
    }, [navigation]);

    // Handle closing chat panel (web only)
    const handleCloseChat = useCallback(() => {
        setSelectedChat(null);
    }, []);

    // Handle forwarding to a specific chat (web only)
    const handleForwardToChat = useCallback((chatItem: ChatItem) => {
        setSelectedChat(chatItem);
    }, []);

    // Placeholder/Example handler for opening a profile (individual only)
    const handleProfileOpen = useCallback((chatItem: ChatItem) => {
         if (chatItem.type === 'individual') {
              const itemData = chatItem.data as IndividualChatListItem;
              console.log("Request to open profile for:", itemData.partner_user_id);
              Alert.alert(`Open Profile (Example)`, `Would open profile for ${itemData.partner_first_name || 'User'}`);
              // Example navigation:
              // navigation.navigate('OtherUserProfileScreen', { userId: itemData.partner_user_id });
         }
     }, []);

    // Handler to set active tab AND clear search when tab changes
    const handleSetTab = useCallback((tab: 'individual' | 'groups') => {
        if (tab !== activeTab) {
            console.log(`Switching tab to: ${tab}`);
            setSearchQuery(''); // Clear search when switching tabs
            Keyboard.dismiss();
            if (tab === 'groups') {
                // Optionally reset individual sub-tab when switching to groups
                // setIndividualSubTab('chats'); 
            }
        }
        setActiveTab(tab);
    }, [activeTab]);

    // Handler for individual sub-tab change
    const handleSetIndividualSubTab = useCallback((subTab: IndividualSubTab) => {
        if (subTab !== individualSubTab) {
            console.log(`Switching individual sub-tab to: ${subTab}`);
            setIndividualSubTab(subTab);
        }
    }, [individualSubTab]);

    // Handler for Create Group Button Tap
    const handleCreateGroupTap = () => {
         console.log("Navigating to Create Group Screen");
         navigation.navigate('CreateGroupChatScreen');
    };

    // --- Render Logic ---
    
    // On web, render 3-panel layout
    if (Platform.OS === 'web') {
        return (
            <SafeAreaView style={styles.webContainer} edges={['top']}>
                {/* Left Panel: Chat List */}
                <View style={styles.webLeftPanel}>
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
                            {/* Clear button for web */}
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                                    <Feather name="x-circle" size={18} color="#9CA3AF" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Chat List Content Area -> Renders ChatsTabs */}
                    <View style={styles.webChatListContent}>
                        <ChatsTabs
                            // Pass state and handlers down
                            activeTab={activeTab}
                            setActiveTab={handleSetTab}
                            individualSubTab={individualSubTab}
                            setIndividualSubTab={handleSetIndividualSubTab}
                            onChatOpen={handleChatOpen}
                            onProfileOpen={handleProfileOpen}
                            searchQuery={searchQuery}
                        />
                    </View>
                </View>

                {/* Right Panel: Chat Panel */}
                <View style={styles.webRightPanel}>
                    <ChatPanelWrapper
                        selectedChat={selectedChat}
                        onCloseChat={handleCloseChat}
                        onOpenProfile={handleProfileOpen}
                        onForwardToChat={handleForwardToChat}
                    />
                </View>
            </SafeAreaView>
        );
    }

    // On mobile, render original single-panel layout
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
                    individualSubTab={individualSubTab}
                    setIndividualSubTab={handleSetIndividualSubTab}
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
    // Web-specific styles for 3-panel layout
    webContainer: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#F9FAFB',
    },
    webLeftPanel: {
        width: 400,
        backgroundColor: '#FFFFFF',
        borderRightWidth: 1,
        borderRightColor: '#E5E7EB',
        flexDirection: 'column',
    },
    webRightPanel: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    webChatListContent: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 0,
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