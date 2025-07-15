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
                        <ActivityIndicator size="small" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} />
                        <Text style={styles.loadingText}>Loading chat...</Text>
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderLeftWidth: 1,
        borderLeftColor: '#E5E7EB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    backButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    headerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
    },
    loadingText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#6B7280',
    },
    messagesContainer: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    messagesScroll: {
        flex: 1,
    },
    messagesContent: {
        padding: 16,
        flexGrow: 1,
        justifyContent: 'center',
    },
    placeholderMessage: {
        alignItems: 'center',
        padding: 32,
    },
    placeholderText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#374151',
        textAlign: 'center',
        marginBottom: 8,
    },
    placeholderSubtext: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
    },
    inputContainer: {
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        minHeight: 44,
    },
    textInput: {
        flex: 1,
        fontSize: 15,
        color: '#1F2937',
        maxHeight: 100,
        paddingVertical: 4,
    },
    sendButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    sendButtonActive: {
        backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6',
    },
    sendButtonInactive: {
        backgroundColor: '#E5E7EB',
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

export default ChatPanel; 