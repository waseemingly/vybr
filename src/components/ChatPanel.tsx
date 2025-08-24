import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    Platform,
    TouchableOpacity,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

// Import types
import type { ChatItem, IndividualChatListItem } from '@/components/ChatsTabs';
import { APP_CONSTANTS } from '@/config/constants';
import VybrLoadingAnimation from '@/components/VybrLoadingAnimation';

interface ChatPanelProps {
    selectedChat: ChatItem | null;
    onCloseChat: () => void;
    onOpenProfile?: (chatItem: ChatItem) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
    selectedChat,
    onCloseChat,
    onOpenProfile,
}) => {
    const [messageText, setMessageText] = useState('');
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

    // Handle sending message
    const handleSendMessage = useCallback(() => {
        if (!messageText.trim() || !selectedChat) return;
        
        console.log('Sending message:', messageText, 'to chat:', selectedChat);
        // TODO: Implement actual message sending
        setMessageText('');
    }, [messageText, selectedChat]);

    // Handle back navigation
    const handleBack = useCallback(() => {
        onCloseChat();
    }, [onCloseChat]);

    // Render loading state
    if (isLoading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.headerContent}>
                        <VybrLoadingAnimation size={60} duration={2000} />
                    </View>
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

    // Get chat info
    const getChatInfo = () => {
        if (selectedChat.type === 'individual') {
            const itemData = selectedChat.data as IndividualChatListItem;
            return {
                name: `${itemData.partner_first_name || ''} ${itemData.partner_last_name || ''}`.trim() || 'Chat',
                image: itemData.partner_profile_picture,
                type: 'individual'
            };
        } else {
            const itemData = selectedChat.data;
            return {
                name: itemData.group_name || 'Group Chat',
                image: itemData.group_image,
                type: 'group'
            };
        }
    };

    const chatInfo = getChatInfo();

    return (
        <View style={styles.container}>
            {/* Custom Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBack}
                    activeOpacity={0.7}
                >
                    <Feather name="arrow-left" size={20} color="#374151" />
                </TouchableOpacity>
                
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>{chatInfo.name}</Text>
                </View>
            </View>

            {/* Chat Messages Area */}
            <View style={styles.messagesContainer}>
                <ScrollView 
                    style={styles.messagesScroll}
                    contentContainerStyle={styles.messagesContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Placeholder for messages */}
                    <View style={styles.placeholderMessage}>
                        <Text style={styles.placeholderText}>
                            Chat interface coming soon...
                        </Text>
                        <Text style={styles.placeholderSubtext}>
                            This will show the actual conversation with {chatInfo.name}
                        </Text>
                    </View>
                </ScrollView>
            </View>

            {/* Message Input Area */}
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.inputContainer}
            >
                <View style={styles.inputWrapper}>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Type a message..."
                        placeholderTextColor="#9CA3AF"
                        value={messageText}
                        onChangeText={setMessageText}
                        multiline
                        maxLength={1000}
                    />
                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            messageText.trim() ? styles.sendButtonActive : styles.sendButtonInactive
                        ]}
                        onPress={handleSendMessage}
                        disabled={!messageText.trim()}
                        activeOpacity={0.7}
                    >
                        <Feather 
                            name="send" 
                            size={18} 
                            color={messageText.trim() ? '#FFFFFF' : '#9CA3AF'} 
                        />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
};

import { chatPanelStyles as styles } from '@/styles/chatstyles';

export default ChatPanel; 