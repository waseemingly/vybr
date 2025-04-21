// src/screens/IndividualChatScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Platform } from 'react-native';
import { GiftedChat, IMessage, Send } from 'react-native-gifted-chat';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons'; // Ensure installed

// --- Adjust these imports based on YOUR project structure ---
import { supabase } from '@/lib/supabase';         // Your Supabase client
import { useAuth } from '@/hooks/useAuth';         // Your Auth hook
import type { RootStackParamList } from "@/navigation/AppNavigator"; 
import { APP_CONSTANTS } from '@/config/constants';  // Optional: For colors etc.
// --- End Adjustments ---

// Define the specific route prop type for this screen
type IndividualChatScreenRouteProp = RouteProp<RootStackParamList, 'IndividualChatScreen'>;
// Define the specific navigation prop type for this screen
type IndividualChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'IndividualChatScreen'>;

// Define structure of a message coming from Supabase DB
interface DbMessage {
    id: string;
    created_at: string;
    sender_id: string;
    receiver_id: string;
    content: string;
}

const IndividualChatScreen = () => {
    const route = useRoute<IndividualChatScreenRouteProp>();
    const navigation = useNavigation<IndividualChatScreenNavigationProp>();
    const { session } = useAuth(); // Get current user session

    const { matchUserId, matchName, matchProfilePicture } = route.params; // Get params passed from navigation

    const [messages, setMessages] = useState<IMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const currentUserId = session?.user?.id;

    // --- Map Database Message to Gifted Chat Format ---
    const mapDbMessageToGiftedMessage = (dbMessage: DbMessage): IMessage => ({
        _id: dbMessage.id,
        text: dbMessage.content,
        createdAt: new Date(dbMessage.created_at),
        user: {
            _id: dbMessage.sender_id,
            // Optionally add name/avatar if you store/fetch them per message
            // name: dbMessage.sender_id === currentUserId ? session?.user?.email : matchName, // Example
            // avatar: dbMessage.sender_id === currentUserId ? session?.user?.profilePicture : matchProfilePicture, // Example
        },
    });

    // --- Fetch Initial Messages ---
    const fetchMessages = useCallback(async () => {
        if (!currentUserId) {
            setError("User not authenticated.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('messages')
                .select('*')
                .or(`sender_id.eq.${currentUserId},receiver_id.eq.${matchUserId},sender_id.eq.${matchUserId},receiver_id.eq.${currentUserId}`)
                .order('created_at', { ascending: false }); // Fetch newest first

            if (fetchError) throw fetchError;

            if (data) {
                const giftedMessages = data.map(mapDbMessageToGiftedMessage);
                setMessages(giftedMessages);
            }
        } catch (err: any) {
            console.error("Error fetching messages:", err);
            setError("Could not load messages.");
        } finally {
            setLoading(false);
        }
    }, [currentUserId, matchUserId]);

    // --- Handle Sending New Messages ---
    const onSend = useCallback(async (newMessages: IMessage[] = []) => {
        if (!currentUserId) {
            console.error("Cannot send message: user not authenticated.");
            return;
        }
        const messageToSend = newMessages[0];
        if (!messageToSend) return;

        // Optimistically update the UI
        setMessages(previousMessages =>
            GiftedChat.append(previousMessages, newMessages)
        );

        // Insert into Supabase
        const { error: insertError } = await supabase
            .from('messages')
            .insert({
                sender_id: currentUserId,
                receiver_id: matchUserId,
                content: messageToSend.text,
            });

        if (insertError) {
            console.error("Error sending message:", insertError);
            // Optionally: remove the optimistic message or show an error indicator
            setError("Failed to send message.");
            // Revert optimistic update (simple example)
            setMessages(prevMessages => prevMessages.filter(msg => msg._id !== messageToSend._id));
        } else {
             console.log("Message sent successfully");
             setError(null); // Clear previous errors on success
        }
    }, [currentUserId, matchUserId]);

    // --- Real-time Subscription Setup ---
    useEffect(() => {
        if (!currentUserId) return;

        // Fetch initial messages when component mounts or user changes
        fetchMessages();

        // Set up subscription
        const channel = supabase
            .channel(`chat_${[currentUserId, matchUserId].sort().join('_')}`) // Unique channel name per chat pair
            .on<DbMessage>(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    // Filter for messages involving this chat pair
                    filter: `or(and(sender_id=eq.${currentUserId},receiver_id=eq.${matchUserId}),and(sender_id=eq.${matchUserId},receiver_id=eq.${currentUserId}))`,
                },
                (payload) => {
                    console.log('New message received!', payload.new);
                    const newMessage = mapDbMessageToGiftedMessage(payload.new as DbMessage);
                    // Avoid adding duplicates if the sender is the current user (already handled by onSend optimistic update)
                    if (newMessage.user._id !== currentUserId) {
                        setMessages(previousMessages =>
                            GiftedChat.append(previousMessages, [newMessage])
                        );
                    }
                }
            )
            .subscribe((status, err) => {
                 if (status === 'SUBSCRIBED') {
                     console.log('Realtime channel subscribed for chat');
                 }
                 if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                     console.error(`Realtime error: ${status}`, err);
                     setError('Realtime connection issue. Try refreshing.');
                 }
            });

        // Cleanup function to remove subscription on unmount
        return () => {
            console.log('Unsubscribing from chat channel');
            supabase.removeChannel(channel);
        };
    }, [currentUserId, matchUserId, fetchMessages]); // Dependencies for useEffect

    // --- Set Header Title ---
    useEffect(() => {
        navigation.setOptions({
            title: matchName || 'Chat', // Set header title to match name
            // Add back button explicitly if needed (usually handled by stack navigator)
            // headerLeft: () => (
            //     <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 10 }}>
            //         <Feather name="chevron-left" size={24} color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} />
            //     </TouchableOpacity>
            // ),
        });
    }, [navigation, matchName]);

    // --- Custom Send Button ---
    const renderSend = (props: Send['props']) => (
        <Send {...props} containerStyle={styles.sendContainer}>
            <Feather name="send" size={24} color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} />
        </Send>
    );

    // --- Render Logic ---
    if (loading && messages.length === 0) { // Show loading only on initial load
        return <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} /></View>;
    }

    if (!currentUserId) {
         return <View style={styles.centered}><Text style={styles.errorText}>Authentication error. Please restart.</Text></View>;
    }

    if (error && messages.length === 0) { // Show error prominently if no messages loaded
         return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
    }

    return (
        <View style={styles.container}>
            {/* Display non-blocking error */}
            {error && messages.length > 0 && (
                <View style={styles.errorBanner}>
                     <Text style={styles.errorBannerText}>{error}</Text>
                </View>
            )}
            <GiftedChat
                messages={messages}
                onSend={onSend}
                user={{
                    _id: currentUserId, // Current logged-in user's ID
                }}
                renderSend={renderSend}
                scrollToBottom
                scrollToBottomComponent={() => (
                    <Feather name="chevron-down" size={24} color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} />
                )}
                isLoadingEarlier={loading} // Show spinner when loading older messages (if implemented)
                messagesContainerStyle={styles.messagesContainer}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB', // Light background for chat area
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
         backgroundColor: '#F9FAFB',
    },
    errorText: {
        color: '#DC2626',
        fontSize: 16,
        textAlign: 'center',
        padding: 20,
    },
     errorBanner: {
         backgroundColor: 'rgba(239, 68, 68, 0.1)', // Light red background
         paddingVertical: 8,
         paddingHorizontal: 15,
         borderBottomWidth: 1,
         borderBottomColor: 'rgba(239, 68, 68, 0.2)',
    },
     errorBannerText: {
         color: '#B91C1C', // Darker red text
         fontSize: 13,
         textAlign: 'center',
    },
    sendContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingRight: 15,
        paddingLeft: 10,
        height: '100%', // Make sure it fills the input bar height
    },
    messagesContainer: {
        paddingBottom: Platform.OS === 'android' ? 10 : 0, // Adjust padding if needed
    },
});

export default IndividualChatScreen;