// // src/screens/IndividualChatScreen.tsx

// import React, { useState, useEffect, useCallback } from 'react';
// import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Platform } from 'react-native';
// import { GiftedChat, IMessage, Send } from 'react-native-gifted-chat';
// import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
// import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// import { Feather } from '@expo/vector-icons'; // Ensure installed

// // --- Adjust these imports based on YOUR project structure ---
// import { supabase } from '@/lib/supabase';         // Your Supabase client
// import { useAuth } from '@/hooks/useAuth';         // Your Auth hook
// import type { RootStackParamList } from "@/navigation/AppNavigator"; 
// import { APP_CONSTANTS } from '@/config/constants';  // Optional: For colors etc.
// // --- End Adjustments ---

// // Define the specific route prop type for this screen
// type IndividualChatScreenRouteProp = RouteProp<RootStackParamList, 'IndividualChatScreen'>;
// // Define the specific navigation prop type for this screen
// type IndividualChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'IndividualChatScreen'>;

// // Define structure of a message coming from Supabase DB
// interface DbMessage {
//     id: string;
//     created_at: string;
//     sender_id: string;
//     receiver_id: string;
//     content: string;
// }

// const IndividualChatScreen = () => {
//     const route = useRoute<IndividualChatScreenRouteProp>();
//     const navigation = useNavigation<IndividualChatScreenNavigationProp>();
//     const { session } = useAuth(); // Get current user session

//     const { matchUserId, matchName, matchProfilePicture } = route.params; // Get params passed from navigation

//     const [messages, setMessages] = useState<IMessage[]>([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState<string | null>(null);

//     const currentUserId = session?.user?.id;

//     // --- Map Database Message to Gifted Chat Format ---
//     const mapDbMessageToGiftedMessage = (dbMessage: DbMessage): IMessage => ({
//         _id: dbMessage.id,
//         text: dbMessage.content,
//         createdAt: new Date(dbMessage.created_at),
//         user: {
//             _id: dbMessage.sender_id,
//             // Optionally add name/avatar if you store/fetch them per message
//             // name: dbMessage.sender_id === currentUserId ? session?.user?.email : matchName, // Example
//             // avatar: dbMessage.sender_id === currentUserId ? session?.user?.profilePicture : matchProfilePicture, // Example
//         },
//     });

//     // --- Fetch Initial Messages ---
//     const fetchMessages = useCallback(async () => {
//         if (!currentUserId) {
//             setError("User not authenticated.");
//             setLoading(false);
//             return;
//         }
//         setLoading(true);
//         setError(null);
//         try {
//             const { data, error: fetchError } = await supabase
//                 .from('messages')
//                 .select('*')
//                 .or(`sender_id.eq.${currentUserId},receiver_id.eq.${matchUserId},sender_id.eq.${matchUserId},receiver_id.eq.${currentUserId}`)
//                 .order('created_at', { ascending: false }); // Fetch newest first

//             if (fetchError) throw fetchError;

//             if (data) {
//                 const giftedMessages = data.map(mapDbMessageToGiftedMessage);
//                 setMessages(giftedMessages);
//             }
//         } catch (err: any) {
//             console.error("Error fetching messages:", err);
//             setError("Could not load messages.");
//         } finally {
//             setLoading(false);
//         }
//     }, [currentUserId, matchUserId]);

//     // --- Handle Sending New Messages ---
//     const onSend = useCallback(async (newMessages: IMessage[] = []) => {
//         if (!currentUserId) {
//             console.error("Cannot send message: user not authenticated.");
//             return;
//         }
//         const messageToSend = newMessages[0];
//         if (!messageToSend) return;

//         // Optimistically update the UI
//         setMessages(previousMessages =>
//             GiftedChat.append(previousMessages, newMessages)
//         );

//         // Insert into Supabase
//         const { error: insertError } = await supabase
//             .from('messages')
//             .insert({
//                 sender_id: currentUserId,
//                 receiver_id: matchUserId,
//                 content: messageToSend.text,
//             });

//         if (insertError) {
//             console.error("Error sending message:", insertError);
//             // Optionally: remove the optimistic message or show an error indicator
//             setError("Failed to send message.");
//             // Revert optimistic update (simple example)
//             setMessages(prevMessages => prevMessages.filter(msg => msg._id !== messageToSend._id));
//         } else {
//              console.log("Message sent successfully");
//              setError(null); // Clear previous errors on success
//         }
//     }, [currentUserId, matchUserId]);

//     // --- Real-time Subscription Setup ---
//     useEffect(() => {
//         if (!currentUserId) return;

//         // Fetch initial messages when component mounts or user changes
//         fetchMessages();

//         // Set up subscription
//         const channel = supabase
//             .channel(`chat_${[currentUserId, matchUserId].sort().join('_')}`) // Unique channel name per chat pair
//             .on<DbMessage>(
//                 'postgres_changes',
//                 {
//                     event: 'INSERT',
//                     schema: 'public',
//                     table: 'messages',
//                     // Filter for messages involving this chat pair
//                     filter: `or(and(sender_id=eq.${currentUserId},receiver_id=eq.${matchUserId}),and(sender_id=eq.${matchUserId},receiver_id=eq.${currentUserId}))`,
//                 },
//                 (payload) => {
//                     console.log('New message received!', payload.new);
//                     const newMessage = mapDbMessageToGiftedMessage(payload.new as DbMessage);
//                     // Avoid adding duplicates if the sender is the current user (already handled by onSend optimistic update)
//                     if (newMessage.user._id !== currentUserId) {
//                         setMessages(previousMessages =>
//                             GiftedChat.append(previousMessages, [newMessage])
//                         );
//                     }
//                 }
//             )
//             .subscribe((status, err) => {
//                  if (status === 'SUBSCRIBED') {
//                      console.log('Realtime channel subscribed for chat');
//                  }
//                  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
//                      console.error(`Realtime error: ${status}`, err);
//                      setError('Realtime connection issue. Try refreshing.');
//                  }
//             });

//         // Cleanup function to remove subscription on unmount
//         return () => {
//             console.log('Unsubscribing from chat channel');
//             supabase.removeChannel(channel);
//         };
//     }, [currentUserId, matchUserId, fetchMessages]); // Dependencies for useEffect

//     // --- Set Header Title ---
//     useEffect(() => {
//         navigation.setOptions({
//             title: matchName || 'Chat', // Set header title to match name
//             // Add back button explicitly if needed (usually handled by stack navigator)
//             // headerLeft: () => (
//             //     <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 10 }}>
//             //         <Feather name="chevron-left" size={24} color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} />
//             //     </TouchableOpacity>
//             // ),
//         });
//     }, [navigation, matchName]);

//     // --- Custom Send Button ---
//     const renderSend = (props: Send['props']) => (
//         <Send {...props} containerStyle={styles.sendContainer}>
//             <Feather name="send" size={24} color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} />
//         </Send>
//     );

//     // --- Render Logic ---
//     if (loading && messages.length === 0) { // Show loading only on initial load
//         return <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} /></View>;
//     }

//     if (!currentUserId) {
//          return <View style={styles.centered}><Text style={styles.errorText}>Authentication error. Please restart.</Text></View>;
//     }

//     if (error && messages.length === 0) { // Show error prominently if no messages loaded
//          return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
//     }

//     return (
//         <View style={styles.container}>
//             {/* Display non-blocking error */}
//             {error && messages.length > 0 && (
//                 <View style={styles.errorBanner}>
//                      <Text style={styles.errorBannerText}>{error}</Text>
//                 </View>
//             )}
//             <GiftedChat
//                 messages={messages}
//                 onSend={onSend}
//                 user={{
//                     _id: currentUserId, // Current logged-in user's ID
//                 }}
//                 renderSend={renderSend}
//                 scrollToBottom
//                 scrollToBottomComponent={() => (
//                     <Feather name="chevron-down" size={24} color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} />
//                 )}
//                 isLoadingEarlier={loading} // Show spinner when loading older messages (if implemented)
//                 messagesContainerStyle={styles.messagesContainer}
//             />
//         </View>
//     );
// };

// const styles = StyleSheet.create({
//     container: {
//         flex: 1,
//         backgroundColor: '#F9FAFB', // Light background for chat area
//     },
//     centered: {
//         flex: 1,
//         justifyContent: 'center',
//         alignItems: 'center',
//          backgroundColor: '#F9FAFB',
//     },
//     errorText: {
//         color: '#DC2626',
//         fontSize: 16,
//         textAlign: 'center',
//         padding: 20,
//     },
//      errorBanner: {
//          backgroundColor: 'rgba(239, 68, 68, 0.1)', // Light red background
//          paddingVertical: 8,
//          paddingHorizontal: 15,
//          borderBottomWidth: 1,
//          borderBottomColor: 'rgba(239, 68, 68, 0.2)',
//     },
//      errorBannerText: {
//          color: '#B91C1C', // Darker red text
//          fontSize: 13,
//          textAlign: 'center',
//     },
//     sendContainer: {
//         justifyContent: 'center',
//         alignItems: 'center',
//         paddingRight: 15,
//         paddingLeft: 10,
//         height: '100%', // Make sure it fills the input bar height
//     },
//     messagesContainer: {
//         paddingBottom: Platform.OS === 'android' ? 10 : 0, // Adjust padding if needed
//     },
// });

// export default IndividualChatScreen;

// src/screens/IndividualChatScreen.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    StyleSheet,
    ActivityIndicator,
    Text,
    TouchableOpacity,
    Platform,
    TextInput, // <-- Import TextInput
    FlatList, // <-- Import FlatList
    KeyboardAvoidingView, // <-- Import KeyboardAvoidingView
    SafeAreaView, // <-- Import SafeAreaView
    Keyboard, // <-- Import Keyboard
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

// --- Adjust these imports based on YOUR project structure ---
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { RootStackParamList } from "@/navigation/AppNavigator"; // Make sure path is correct
import { APP_CONSTANTS } from '@/config/constants';
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

// Define a simplified structure for messages in our state/FlatList
// (Similar to GiftedChat's IMessage but simplified)
interface ChatMessage {
    _id: string;
    text: string;
    createdAt: Date;
    user: { // Keep user object for identifying sender
        _id: string;
    };
}

// --- NEW: Message Bubble Component ---
interface MessageBubbleProps {
    message: ChatMessage;
    currentUserId: string | undefined;
}
const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ message, currentUserId }) => {
    const isCurrentUser = message.user._id === currentUserId;

    return (
        <View style={[
            styles.messageRow,
            isCurrentUser ? styles.messageRowSent : styles.messageRowReceived
        ]}>
            <View style={[
                styles.messageBubble,
                isCurrentUser ? styles.messageBubbleSent : styles.messageBubbleReceived
            ]}>
                <Text style={isCurrentUser ? styles.messageTextSent : styles.messageTextReceived}>
                    {message.text}
                </Text>
                {/* Optional: Add timestamp below */}
                {/* <Text style={isCurrentUser ? styles.timestampSent : styles.timestampReceived}>
                    {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text> */}
            </View>
        </View>
    );
});
// --- End Message Bubble Component ---


const IndividualChatScreen = () => {
    const route = useRoute<IndividualChatScreenRouteProp>();
    const navigation = useNavigation<IndividualChatScreenNavigationProp>();
    const { session } = useAuth();

    const { matchUserId, matchName } = route.params; // Removed matchProfilePicture as it wasn't used

    // State for messages (using our simplified ChatMessage type)
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    // State for the text input
    const [inputText, setInputText] = useState(''); // <-- NEW state for input
    // Keep loading/error states
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const currentUserId = session?.user?.id;
    const flatListRef = useRef<FlatList>(null); // Ref for scrolling FlatList

    // --- Map Database Message to our ChatMessage Format ---
    const mapDbMessageToChatMessage = (dbMessage: DbMessage): ChatMessage => ({
        _id: dbMessage.id,
        text: dbMessage.content,
        createdAt: new Date(dbMessage.created_at),
        user: {
            _id: dbMessage.sender_id,
        },
    });

    // --- Fetch Initial Messages (Logic remains similar) ---
    const fetchMessages = useCallback(async () => {
        if (!currentUserId) { /* ... handle error ... */ return; }
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('messages')
                .select('*')
                // *** Simpler OR condition for fetching ***
                .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${matchUserId}),and(sender_id.eq.${matchUserId},receiver_id.eq.${currentUserId})`)
                .order('created_at', { ascending: true }); // *** Fetch OLDEST first for FlatList ***

            if (fetchError) throw fetchError;

            if (data) {
                // Map to our internal format
                const chatMessages = data.map(mapDbMessageToChatMessage);
                setMessages(chatMessages);
            }
        } catch (err: any) { /* ... handle error ... */ console.error("Error fetching messages:", err); setError("Could not load messages."); }
        finally { setLoading(false); }
    }, [currentUserId, matchUserId]);

    // --- Handle Sending New Messages ---
    // This function now takes the text directly
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

        // Insert into Supabase
        const { error: insertError } = await supabase
            .from('messages')
            .insert({
                sender_id: currentUserId,
                receiver_id: matchUserId,
                content: newMessage.text,
            })
            .select('id') // Select the actual ID generated by DB
            .single(); // Expect only one row back


        if (insertError || !insertError?.id) { // Check if insert failed or didn't return ID
            console.error("Error sending message:", insertError);
            setError("Failed to send message.");
            // Revert optimistic update: remove the temporary message
            setMessages(prevMessages => prevMessages.filter(msg => msg._id !== tempId));
            setInputText(newMessage.text); // Optionally restore input text
        } else {
            console.log("Message sent successfully, DB ID:", insertError.id);
             // Optional: Update the temporary message with the real ID from the DB
             setMessages(prevMessages => prevMessages.map(msg =>
                msg._id === tempId ? { ...msg, _id: insertError.id! } : msg
             ));
            setError(null);
        }
    }, [currentUserId, matchUserId]);

    // Function called when the send button is pressed
    const handleSendPress = () => {
        sendMessage(inputText);
    };


    // --- Real-time Subscription Setup (Logic mostly the same) ---
    useEffect(() => {
        if (!currentUserId) return;
        fetchMessages(); // Fetch initial messages

        const channel = supabase
            .channel(`chat_${[currentUserId, matchUserId].sort().join('_')}`)
            .on<DbMessage>(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages',
                  // Filter remains the same
                  filter: `or(and(sender_id.eq.${currentUserId},receiver_id.eq.${matchUserId}),and(sender_id.eq.${matchUserId},receiver_id=eq.${currentUserId}))`
                },
                (payload) => {
                    console.log('New message received via subscription!', payload.new);
                    const receivedMessage = mapDbMessageToChatMessage(payload.new as DbMessage);
                    // Only add if it's from the *other* user (to avoid duplicates from optimistic update)
                    if (receivedMessage.user._id === matchUserId) {
                        // Use functional update to ensure we have the latest state
                         setMessages(prevMessages => {
                            // Prevent adding duplicate if somehow received after optimistic update
                            if (prevMessages.some(msg => msg._id === receivedMessage._id)) {
                                return prevMessages;
                            }
                            return [...prevMessages, receivedMessage];
                         });
                    }
                }
            )
            .subscribe((status, err) => { /* ... handle status/errors ... */
                 if (status === 'SUBSCRIBED') console.log('Realtime channel subscribed for chat');
                 if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { console.error(`Realtime error: ${status}`, err); setError('Realtime connection issue.'); }
            });

        return () => { /* ... unsubscribe ... */ supabase.removeChannel(channel); };
    }, [currentUserId, matchUserId, fetchMessages]);

    // --- Set Header Title (Logic remains the same) ---
    useEffect(() => {
        navigation.setOptions({ title: matchName || 'Chat' });
    }, [navigation, matchName]);


    // --- Render Logic ---
    if (loading && messages.length === 0) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} /></View>;
    }
    if (!currentUserId) {
        return <View style={styles.centered}><Text style={styles.errorText}>Authentication error.</Text></View>;
    }
     if (error && messages.length === 0) {
         return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
     }

    return (
        // Use SafeAreaView for notch/status bar areas
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
            {/* KeyboardAvoidingView is crucial */}
            <KeyboardAvoidingView
                style={styles.keyboardAvoidingContainer}
                behavior={Platform.OS === "ios" ? "padding" : undefined} // Use "padding" for iOS, Android handles it often differently (or use "height")
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0} // Adjust as needed, depends on header height etc.
            >
                {/* Display non-blocking error */}
                {error && messages.length > 0 && ( <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{error}</Text></View> )}

                {/* Message List */}
                <FlatList
                    ref={flatListRef}
                    style={styles.messageList}
                    contentContainerStyle={styles.messageListContent}
                    data={messages}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => <MessageBubble message={item} currentUserId={currentUserId} />}
                    // Automatically scroll to bottom when content size changes (new message)
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })} // Also scroll on initial layout
                    ListEmptyComponent={ // Show message if no messages yet
                        <View style={styles.centered}>
                            <Text style={styles.noMessagesText}>Start the conversation!</Text>
                        </View>
                    }
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
                        disabled={!inputText.trim()} // Disable button if input is empty/whitespace
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
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF', // White background for the safe area
    },
    keyboardAvoidingContainer: {
        flex: 1,
    },
    container: { // Keep this if needed for other wrappers, but KAV is now main flex container
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: { color: '#DC2626', fontSize: 16, textAlign: 'center', },
    errorBanner: { backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingVertical: 8, paddingHorizontal: 15, },
    errorBannerText: { color: '#B91C1C', fontSize: 13, textAlign: 'center', },
    noMessagesText: { color: '#6B7280', fontSize: 14, marginTop: 30 },

    // Message List Styles
    messageList: {
        flex: 1, // Takes up available space above input
        paddingHorizontal: 10,
    },
    messageListContent: {
        paddingVertical: 10, // Padding top and bottom of the list itself
    },

    // Message Bubble Styles
    messageRow: {
        flexDirection: 'row',
        marginVertical: 5,
    },
    messageRowSent: {
        justifyContent: 'flex-end', // Push sent messages to the right
    },
    messageRowReceived: {
        justifyContent: 'flex-start', // Keep received messages to the left
    },
    messageBubble: {
        maxWidth: '75%', // Max width of a bubble
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 18,
    },
    messageBubbleSent: {
        backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6',
        borderBottomRightRadius: 4, // Give it the typical chat bubble shape
    },
    messageBubbleReceived: {
        backgroundColor: '#E5E7EB', // Grey for received
        borderBottomLeftRadius: 4,
    },
    messageTextSent: {
        color: '#FFFFFF',
        fontSize: 15,
    },
    messageTextReceived: {
        color: '#1F2937',
        fontSize: 15,
    },
    // Optional Timestamp Styles
    timestampSent: { fontSize: 10, color: 'rgba(255, 255, 255, 0.7)', alignSelf: 'flex-end', marginTop: 2, },
    timestampReceived: { fontSize: 10, color: '#6B7280', alignSelf: 'flex-start', marginTop: 2, },


    // Input Toolbar Styles
    inputToolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        backgroundColor: '#FFFFFF', // White background for input area
    },
    textInput: {
        flex: 1,
        minHeight: 40, // Minimum height
        maxHeight: 120, // Maximum height for multiline
        backgroundColor: '#F3F4F6', // Light grey background for input
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        fontSize: 15,
        marginRight: 10,
        color: '#1F2937', // Dark text for input
    },
    sendButton: {
        backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6',
        width: 40,
        height: 40,
        borderRadius: 20, // Make it circular
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#9CA3AF', // Grey out button when disabled
    },
});

export default IndividualChatScreen;