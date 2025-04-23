import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    StyleSheet,
    ActivityIndicator,
    Text,
    TouchableOpacity,
    Platform,
    TextInput,
    FlatList,
    KeyboardAvoidingView,
    SafeAreaView,
    Keyboard,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

// --- Adjust these imports based on YOUR project structure ---
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { RootStackParamList } from "@/navigation/AppNavigator"; // Adjust path if needed
import { APP_CONSTANTS } from '@/config/constants'; // Adjust path if needed
// --- End Adjustments ---

// Keep Route and Navigation props
type IndividualChatScreenRouteProp = RouteProp<RootStackParamList, 'IndividualChatScreen'>;
type IndividualChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'IndividualChatScreen'>;

// Keep DB message structure
interface DbMessage {
    id: string;
    created_at: string;
    sender_id: string;
    receiver_id: string;
    content: string;
}

// Keep simplified ChatMessage interface
interface ChatMessage {
    _id: string;
    text: string;
    createdAt: Date;
    user: {
        _id: string;
    };
}

// Keep MessageBubble component
interface MessageBubbleProps {
    message: ChatMessage;
    currentUserId: string | undefined;
}
const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ message, currentUserId }) => {
    const isCurrentUser = message.user._id === currentUserId;
    return (
        <View style={[ styles.messageRow, isCurrentUser ? styles.messageRowSent : styles.messageRowReceived ]}>
            <View style={[ styles.messageBubble, isCurrentUser ? styles.messageBubbleSent : styles.messageBubbleReceived ]}>
                <Text style={isCurrentUser ? styles.messageTextSent : styles.messageTextReceived}>
                    {message.text}
                </Text>
            </View>
        </View>
    );
});

// --- Main Component ---
const IndividualChatScreen = () => {
    const route = useRoute<IndividualChatScreenRouteProp>();
    const navigation = useNavigation<IndividualChatScreenNavigationProp>();
    const { session } = useAuth();

    const { matchUserId, matchName } = route.params;

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const currentUserId = session?.user?.id;
    const flatListRef = useRef<FlatList>(null);

    // Map DB message to ChatMessage format
    const mapDbMessageToChatMessage = (dbMessage: DbMessage): ChatMessage => ({
        _id: dbMessage.id,
        text: dbMessage.content,
        createdAt: new Date(dbMessage.created_at),
        user: { _id: dbMessage.sender_id, },
    });

    // Fetch initial messages
    const fetchMessages = useCallback(async () => {
        if (!currentUserId) { setError("User not authenticated."); setLoading(false); return; }
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${matchUserId}),and(sender_id.eq.${matchUserId},receiver_id.eq.${currentUserId})`)
                .order('created_at', { ascending: true });

            if (fetchError) throw fetchError;
            if (data) { setMessages(data.map(mapDbMessageToChatMessage)); }
        } catch (err: any) { console.error("Error fetching messages:", err); setError("Could not load messages."); }
        finally { setLoading(false); }
    }, [currentUserId, matchUserId]);

    // --- Handle Sending New Messages (Method 1 Implementation) ---
    const sendMessage = useCallback(async (text: string) => {
        if (!currentUserId || !text.trim()) {
            return; // Don't send empty messages or if not logged in
        }

        const tempId = `temp_${Date.now()}`; // Temporary ID for optimistic update
        const newMessage: ChatMessage = {
            _id: tempId,
            text: text.trim(),
            createdAt: new Date(),
            user: { _id: currentUserId },
        };

        // Optimistically update the UI
        setMessages(previousMessages => [...previousMessages, newMessage]); // Append new message
        setInputText(''); // Clear the input field
        Keyboard.dismiss(); // Dismiss keyboard after sending

        // Insert into Supabase - No .select() needed
        const { error: insertError } = await supabase
            .from('messages')
            .insert({
                sender_id: currentUserId,
                receiver_id: matchUserId,
                content: newMessage.text,
            });
            // REMOVED .select().single()

        // *** CORRECTED SUCCESS/ERROR CHECK ***
        if (insertError) { // Only check if an error object exists
            console.error("Error sending message:", insertError);
            setError("Failed to send message.");
            // Revert optimistic update on error
            setMessages(prevMessages => prevMessages.filter(msg => msg._id !== tempId));
            setInputText(newMessage.text); // Optionally restore input text
        } else {
            // Success! Message was inserted into DB.
            console.log("Message insert successful (optimistic UI applied).");
            // The message with the temp ID is already shown.
            // Real-time listener OR next fetch will get the version with the real DB ID.
            setError(null); // Clear any previous errors
        }
    }, [currentUserId, matchUserId]);
    // --- End Handle Sending New Messages ---

    // Handler for the send button press
    const handleSendPress = () => {
        sendMessage(inputText);
    };

    // Real-time Subscription Setup
    useEffect(() => {
        if (!currentUserId) return;
        fetchMessages(); // Fetch initial messages

        const channel = supabase
            .channel(`chat_${[currentUserId, matchUserId].sort().join('_')}`)
            .on<DbMessage>(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages',
                  filter: `or(and(sender_id.eq.${currentUserId},receiver_id.eq.${matchUserId}),and(sender_id.eq.${matchUserId},receiver_id.eq.${currentUserId}))` },
                (payload) => {
                    console.log('New message received via subscription!', payload.new);
                    const receivedMessage = mapDbMessageToChatMessage(payload.new as DbMessage);
                    // Add message ONLY if it's from the OTHER user
                    if (receivedMessage.user._id === matchUserId) {
                         setMessages(prevMessages => {
                            // Optional: Prevent adding duplicate if already present
                            if (prevMessages.some(msg => msg._id === receivedMessage._id)) {
                                return prevMessages;
                            }
                            return [...prevMessages, receivedMessage];
                         });
                    }
                }
            )
            .subscribe((status, err) => {
                 if (status === 'SUBSCRIBED') console.log('Realtime channel subscribed');
                 if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { console.error(`Realtime error: ${status}`, err); setError('Realtime connection issue.'); }
            });

        // Cleanup subscription
        return () => { console.log('Unsubscribing'); supabase.removeChannel(channel); };
    }, [currentUserId, matchUserId, fetchMessages]);

    // Set Header Title
    useEffect(() => {
        navigation.setOptions({ title: matchName || 'Chat' });
    }, [navigation, matchName]);

    // --- Render Logic ---
    if (loading && messages.length === 0) { /* ... loading ... */ return <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} /></View>; }
    if (!currentUserId) { /* ... auth error ... */ return <View style={styles.centered}><Text style={styles.errorText}>Authentication error.</Text></View>; }
    if (error && messages.length === 0) { /* ... fetch error ... */ return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>; }

    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoidingContainer}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0} // Adjust offset as needed
            >
                {/* Non-blocking send error banner */}
                {error && messages.length > 0 && ( <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{error}</Text></View> )}

                {/* Message List */}
                <FlatList
                    ref={flatListRef}
                    style={styles.messageList}
                    contentContainerStyle={styles.messageListContent}
                    data={messages}
                    keyExtractor={(item) => item._id} // Use message ID as key
                    renderItem={({ item }) => <MessageBubble message={item} currentUserId={currentUserId} />}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
                    ListEmptyComponent={ <View style={styles.centered}><Text style={styles.noMessagesText}>Start the conversation!</Text></View> }
                />

                {/* Input Toolbar */}
                <View style={styles.inputToolbar}>
                    <TextInput
                        style={styles.textInput}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Type a message..."
                        placeholderTextColor="#9CA3AF"
                        multiline
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                        onPress={handleSendPress}
                        disabled={!inputText.trim()}
                    >
                        <Feather name="send" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFFFFF', },
    keyboardAvoidingContainer: { flex: 1, },
    container: { flex: 1, backgroundColor: '#F9FAFB', },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
    errorText: { color: '#DC2626', fontSize: 16, textAlign: 'center', },
    errorBanner: { backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingVertical: 8, paddingHorizontal: 15, },
    errorBannerText: { color: '#B91C1C', fontSize: 13, textAlign: 'center', },
    noMessagesText: { color: '#6B7280', fontSize: 14, marginTop: 30 },
    messageList: { flex: 1, paddingHorizontal: 10, },
    messageListContent: { paddingVertical: 10, },
    messageRow: { flexDirection: 'row', marginVertical: 5, },
    messageRowSent: { justifyContent: 'flex-end', },
    messageRowReceived: { justifyContent: 'flex-start', },
    messageBubble: { maxWidth: '75%', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, },
    messageBubbleSent: { backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', borderBottomRightRadius: 4, },
    messageBubbleReceived: { backgroundColor: '#E5E7EB', borderBottomLeftRadius: 4, },
    messageTextSent: { color: '#FFFFFF', fontSize: 15, },
    messageTextReceived: { color: '#1F2937', fontSize: 15, },
    inputToolbar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF', },
    textInput: { flex: 1, minHeight: 40, maxHeight: 120, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, fontSize: 15, marginRight: 10, color: '#1F2937', },
    sendButton: { backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', },
    sendButtonDisabled: { backgroundColor: '#9CA3AF', },
});

export default IndividualChatScreen;