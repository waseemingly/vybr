import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
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
        
        console.log('🔍 ChatsScreen: handleChatOpen called with:', {
            type: selectedChatItem.type,
            data: selectedChatItem.data,
            platform: Platform.OS
        });
        
        if (Platform.OS === 'web') {
            // On web, use the chat panel instead of navigation
            console.log('🔍 ChatsScreen: Using web chat panel');
            setSelectedChat(selectedChatItem);
        } else {
            // On mobile, use normal navigation
            console.log('🔍 ChatsScreen: Using mobile navigation');
            if (selectedChatItem.type === 'individual') {
                const itemData = selectedChatItem.data as IndividualChatListItem; // Cast to ensure type safety with new fields
                const partnerName = `${itemData.partner_first_name || ''} ${itemData.partner_last_name || ''}`.trim() || 'Chat';
                console.log(`🔍 ChatsScreen: Navigating to Individual Chat: ${itemData.partner_user_id}`);
                console.log(`🔍 ChatsScreen: Navigation params:`, {
                    matchUserId: itemData.partner_user_id,
                    matchName: partnerName,
                    matchProfilePicture: itemData.partner_profile_picture
                });
                
                try {
                    navigation.navigate('IndividualChatScreen', {
                        matchUserId: itemData.partner_user_id,
                        matchName: partnerName,
                        matchProfilePicture: itemData.partner_profile_picture
                    });
                    console.log('🔍 ChatsScreen: Navigation to IndividualChatScreen completed');
                } catch (error) {
                    console.error('🔍 ChatsScreen: Error navigating to IndividualChatScreen:', error);
                }
            } else { // type === 'group'
                const itemData = selectedChatItem.data;
                console.log(`🔍 ChatsScreen: Navigating to Group Chat: ${itemData.group_id}`);
                console.log(`🔍 ChatsScreen: Navigation params:`, {
                    groupId: itemData.group_id,
                    groupName: itemData.group_name,
                    groupImage: itemData.group_image
                });
                
                try {
                    navigation.navigate('GroupChatScreen', {
                        groupId: itemData.group_id,
                        groupName: itemData.group_name,
                        groupImage: itemData.group_image
                    });
                    console.log('🔍 ChatsScreen: Navigation to GroupChatScreen completed');
                } catch (error) {
                    console.error('🔍 ChatsScreen: Error navigating to GroupChatScreen:', error);
                }
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

import { chatsScreenStyles as styles } from '@/styles/chatstyles';

export default ChatsScreen;