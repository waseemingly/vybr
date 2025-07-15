import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    Platform,
    TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import the chat screens
import IndividualChatScreen from '@/screens/IndividualChatScreen';
import GroupChatScreen from '@/screens/GroupChatScreen';
import OtherUserProfileScreen from '@/screens/OtherUserProfileScreen';
import GroupInfoScreen from '@/screens/GroupInfoScreen';
import AddGroupMembersScreen from '@/screens/AddGroupMembersScreen';

// Import types
import type { ChatItem, IndividualChatListItem } from '@/components/ChatsTabs';
import { APP_CONSTANTS } from '@/config/constants';

interface ChatPanelWrapperProps {
    selectedChat: ChatItem | null;
    onCloseChat: () => void;
    onOpenProfile?: (chatItem: ChatItem) => void;
}

// Define the stack navigator types
type ChatPanelStackParamList = {
    IndividualChat: {
        matchUserId: string;
        matchName: string;
        matchProfilePicture?: string | null;
        onCloseChat?: () => void; // Add onCloseChat to params
    };
    GroupChat: {
        groupId: string;
        groupName?: string | null;
        groupImage?: string | null;
        onCloseChat?: () => void; // Add onCloseChat to params
    };
    OtherUserProfile: {
        userId: string;
        fromChat?: boolean;
        chatImages?: string[];
    };
    GroupInfo: {
        groupId: string;
        groupName: string;
        groupImage: string | null;
        onCloseChat?: () => void; // Add onCloseChat for web chat panel
    };
    AddGroupMembers: {
        groupId: string;
        groupName?: string | null;
        cameFromGroupInfo?: boolean; // Track if we came from GroupInfoScreen
    };
};

const Stack = createNativeStackNavigator<ChatPanelStackParamList>();

// Wrapper components to pass onCloseChat to the screens
const IndividualChatWrapper: React.FC = (props: any) => {
    return <IndividualChatScreen {...props} />;
};

const GroupChatWrapper: React.FC = (props: any) => {
    return <GroupChatScreen {...props} />;
};

const ChatPanelWrapper: React.FC<ChatPanelWrapperProps> = ({
    selectedChat,
    onCloseChat,
    onOpenProfile,
}) => {
    const [isLoading, setIsLoading] = useState(false);

    // Handle chat selection
    useEffect(() => {
        if (!selectedChat) {
            return;
        }

        setIsLoading(true);
        // Simulate loading delay for smooth transition
        setTimeout(() => setIsLoading(false), 100);
    }, [selectedChat]);

    // Get initial route name and params
    const getInitialRoute = () => {
        if (!selectedChat) return null;

        if (selectedChat.type === 'individual') {
            const itemData = selectedChat.data as IndividualChatListItem;
            const partnerName = `${itemData.partner_first_name || ''} ${itemData.partner_last_name || ''}`.trim() || 'Chat';
            return {
                name: 'IndividualChat' as const,
                params: {
                    matchUserId: itemData.partner_user_id,
                    matchName: partnerName,
                    matchProfilePicture: itemData.partner_profile_picture,
                    onCloseChat: onCloseChat // Pass the onCloseChat function
                }
            };
        } else {
            const itemData = selectedChat.data;
            return {
                name: 'GroupChat' as const,
                params: {
                    groupId: itemData.group_id,
                    groupName: itemData.group_name,
                    groupImage: itemData.group_image,
                    onCloseChat: onCloseChat // Pass the onCloseChat function
                }
            };
        }
    };

    // Render loading state
    if (isLoading) {
        return (
            <View style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} />
                    <Text style={styles.loadingText}>Loading chat...</Text>
                </View>
            </View>
        );
    }

    // Render empty state
    if (!selectedChat) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyState}>
                    <Feather name="message-square" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyStateTitle}>Select a chat to start messaging</Text>
                    <Text style={styles.emptyStateSubtitle}>
                        Choose a conversation from the list to begin chatting
                    </Text>
                </View>
            </View>
        );
    }

    const initialRoute = getInitialRoute();

    return (
        <View style={styles.container}>
            {/* Navigation Container for Chat Screens - No custom header */}
            <NavigationContainer independent={true}>
                <Stack.Navigator
                    initialRouteName={initialRoute?.name}
                    screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: '#FFFFFF' }
                    }}
                >
                    <Stack.Screen 
                        name="IndividualChat" 
                        component={IndividualChatWrapper}
                        initialParams={initialRoute?.name === 'IndividualChat' ? initialRoute.params : undefined}
                    />
                    <Stack.Screen 
                        name="GroupChat" 
                        component={GroupChatWrapper}
                        initialParams={initialRoute?.name === 'GroupChat' ? initialRoute.params : undefined}
                    />
                    <Stack.Screen 
                        name="OtherUserProfile" 
                        component={OtherUserProfileScreen}
                    />
                    <Stack.Screen 
                        name="GroupInfo" 
                        component={GroupInfoScreen}
                    />
                    <Stack.Screen 
                        name="AddGroupMembers" 
                        component={AddGroupMembersScreen}
                    />
                </Stack.Navigator>
            </NavigationContainer>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderLeftWidth: 1,
        borderLeftColor: '#E5E7EB',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginTop: 16,
        textAlign: 'center',
    },
    emptyStateSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 20,
    },
});

export default ChatPanelWrapper; 