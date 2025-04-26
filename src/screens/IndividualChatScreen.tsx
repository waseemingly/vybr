// screens/IndividualChatScreen.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View, StyleSheet, ActivityIndicator, Text, TouchableOpacity,
    Platform, TextInput, SectionList, KeyboardAvoidingView, Keyboard,
    Image
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { RootStackParamList } from "@/navigation/AppNavigator";
import { APP_CONSTANTS } from '@/config/constants';

// Types and MessageBubble component
type IndividualChatScreenRouteProp = RouteProp<RootStackParamList, 'IndividualChatScreen'>;
type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;
interface DbMessage { id: string; created_at: string; sender_id: string; receiver_id: string; content: string; }
interface ChatMessage { _id: string; text: string; createdAt: Date; user: { _id: string; }; }
interface MessageBubbleProps { message: ChatMessage; currentUserId: string | undefined; }

// Add DEFAULT_PROFILE_PIC constant
const DEFAULT_PROFILE_PIC = APP_CONSTANTS.DEFAULT_PROFILE_PIC;

// Helper to format timestamps
const formatTime = (date: Date) => date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ message, currentUserId }) => {
    const isCurrentUser = message.user._id === currentUserId;
    return (
        <View style={[ styles.messageRow, isCurrentUser ? styles.messageRowSent : styles.messageRowReceived ]}>
            <View style={[ styles.messageBubble, isCurrentUser ? styles.messageBubbleSent : styles.messageBubbleReceived ]}>
                <Text style={isCurrentUser ? styles.messageTextSent : styles.messageTextReceived}>
                    {message.text}
                </Text>
                <Text style={styles.timeText}>
                    {formatTime(message.createdAt)}
                </Text>
            </View>
        </View>
    );
});


const IndividualChatScreen: React.FC = () => {
    const route = useRoute<IndividualChatScreenRouteProp>();
    const navigation = useNavigation<RootNavigationProp>();
    const { session } = useAuth();

    const { matchUserId } = route.params;
    // Use state for name to allow potential updates (though less likely needed here now)
    const [dynamicMatchName, setDynamicMatchName] = useState(route.params.matchName || 'Chat');

    // Add an effect to update name when route params change
    useEffect(() => {
        if (route.params.matchName) {
            setDynamicMatchName(route.params.matchName);
            console.log(`[IndividualChatScreen] Updated match name: ${route.params.matchName}`);
        }
    }, [route.params.matchName]);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMatchMuted, setIsMatchMuted] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false); // Covers block in either direction
    const [isChatMutuallyInitiated, setIsChatMutuallyInitiated] = useState(false); // <<< NEW STATE

    const currentUserId = session?.user?.id;
    const flatListRef = useRef<SectionList<any>>(null);

    const mapDbMessageToChatMessage = useCallback((dbMessage: DbMessage): ChatMessage => ({
         _id: dbMessage.id, text: dbMessage.content, createdAt: new Date(dbMessage.created_at), user: { _id: dbMessage.sender_id, },
    }), []);

    // --- Helper to add match user to chatted list in AsyncStorage --- // <<< NEW FUNCTION
    const markChatAsInitiatedInStorage = useCallback(async (userIdToMark: string) => {
        if (!currentUserId) return;
        const storageKey = `@ChattedUserIds_${currentUserId}`;
        try {
            const existingJson = await AsyncStorage.getItem(storageKey);
            const existingIds = existingJson ? JSON.parse(existingJson) : [];
            const idSet = new Set<string>(existingIds);

            if (!idSet.has(userIdToMark)) {
                idSet.add(userIdToMark);
                const newJson = JSON.stringify(Array.from(idSet));
                await AsyncStorage.setItem(storageKey, newJson);
                console.log(`[ChatScreen] Marked ${userIdToMark} as chatted in AsyncStorage.`);
            } else {
                // console.log(`[ChatScreen] ${userIdToMark} already marked as chatted.`);
            }
        } catch (e) {
            console.error("[ChatScreen] Failed to update chatted IDs in storage:", e);
        }
    }, [currentUserId]);

    // --- Fetch Mute and Block Status ---
    const fetchInteractionStatus = useCallback(async () => {
         if (!currentUserId || !matchUserId) return;
         console.log(`[ChatScreen] Fetching interaction status for ${matchUserId}`);
         try {
             // Check if current user muted the match user
             const { count: muteCount, error: muteError } = await supabase
                 .from('mutes')
                 .select('*', { count: 'exact', head: true }) // Use count directly
                 .eq('muter_id', currentUserId)
                 .eq('muted_id', matchUserId);

             if (muteError) throw muteError;
             const mutedResult = (muteCount ?? 0) > 0;
             setIsMatchMuted(mutedResult);
             console.log(`[ChatScreen] Fetched Mute Status: ${mutedResult}`);

             // Check if either user blocked the other
             const { data: blockData, error: blockError } = await supabase
                 .from('blocks')
                 .select('blocker_id') // Select only needed field
                 .or(`and(blocker_id.eq.${currentUserId},blocked_id.eq.${matchUserId}),and(blocker_id.eq.${matchUserId},blocked_id.eq.${currentUserId})`)
                 .limit(1); // Only need to know if *any* block exists

             if (blockError) throw blockError;
             const blockedResult = blockData && blockData.length > 0;
             setIsBlocked(blockedResult);
             console.log(`[ChatScreen] Fetched Block Status: ${blockedResult}`);

             // If blocked, clear messages and set error state for UI
             if (blockedResult) {
                 setMessages([]);
                 setError("You cannot chat with this user.");
                 setLoading(false); // Stop loading if blocked
             } else if (error === "You cannot chat with this user.") {
                 // Clear block-related error if unblocked
                 setError(null);
             }


         } catch (err: any) {
             console.error("[ChatScreen] Error fetching mute/block status:", err);
             setError(prev => prev || "Could not load chat status."); // Show error
         }
    }, [currentUserId, matchUserId, error]); // Added error to dependency to potentially clear it

    // --- Check Mutual Initiation --- // <<< NEW FUNCTION
    const checkMutualInitiation = useCallback((currentMessages: ChatMessage[]) => {
        if (!currentUserId || !matchUserId) {
            setIsChatMutuallyInitiated(false);
            return false;
        }
        const currentUserSent = currentMessages.some(msg => msg.user._id === currentUserId);
        const matchUserSent = currentMessages.some(msg => msg.user._id === matchUserId);
        const mutuallyInitiated = currentUserSent && matchUserSent;
        setIsChatMutuallyInitiated(mutuallyInitiated);
        console.log(`[ChatScreen] Mutual initiation check: UserSent=${currentUserSent}, MatchSent=${matchUserSent}, Result=${mutuallyInitiated}`);
        return mutuallyInitiated;
    }, [currentUserId, matchUserId]);

    // --- Fetch Messages ---
    const fetchMessages = useCallback(async () => {
        if (!currentUserId || !matchUserId || isBlocked) { // Added block check
             if (!isBlocked && currentUserId) setLoading(true); // Only set loading if not blocked
             return; // Don't fetch if blocked or not logged in
         }
        console.log(`[ChatScreen] Fetching messages for ${matchUserId}`);
        setLoading(true); // Set loading true only when actually fetching
        setError(null); // Clear previous errors before fetching
        try {
            const { data, error: fetchError } = await supabase
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${matchUserId}),and(sender_id.eq.${matchUserId},receiver_id.eq.${currentUserId})`)
                .order('created_at', { ascending: true });

            if (fetchError) throw fetchError;
            if (data) {
                const fetchedChatMessages = data.map(mapDbMessageToChatMessage);
                setMessages(fetchedChatMessages);
                checkMutualInitiation(fetchedChatMessages); // <<< Check initiation after fetch
                console.log(`[ChatScreen] Fetched ${data.length} messages.`);
            } else {
                setMessages([]);
                setIsChatMutuallyInitiated(false); // <<< Reset if no messages
                 console.log(`[ChatScreen] No messages found.`);
            }
        } catch (err: any) {
            console.error("[ChatScreen] Error fetching messages:", err);
            setError("Could not load messages.");
            setMessages([]); // Clear messages on error
            setIsChatMutuallyInitiated(false); // <<< Reset on error
        } finally {
            setLoading(false);
        }
    }, [currentUserId, matchUserId, isBlocked, mapDbMessageToChatMessage, checkMutualInitiation]); // isBlocked & checkMutualInitiation crucial

    // --- Send Message ---
    const sendMessage = useCallback(async (text: string) => {
         if (!currentUserId || !matchUserId || !text.trim() || isBlocked) { return; }

         // Check if current user has sent a message before in this session
         const currentUserHasSentBefore = messages.some(msg => msg.user._id === currentUserId);

         const tempId = `temp_${Date.now()}`;
         const newMessage: ChatMessage = { _id: tempId, text: text.trim(), createdAt: new Date(), user: { _id: currentUserId } };

         setMessages(previousMessages => [...previousMessages, newMessage]);
         setInputText('');
         // Optimistically check initiation after adding temp message
         setMessages(prev => { checkMutualInitiation(prev); return prev; });
         Keyboard.dismiss();

         // If this is the first message from the current user, mark the chat in storage
         if (!currentUserHasSentBefore) {
             console.log("[ChatScreen] First message by current user. Marking chat in storage.");
             markChatAsInitiatedInStorage(matchUserId);
         }

         const { error: insertError } = await supabase.from('messages').insert({ sender_id: currentUserId, receiver_id: matchUserId, content: newMessage.text });
         if (insertError) { console.error("Error sending message:", insertError); setError("Failed to send message."); setMessages(prevMessages => prevMessages.filter(msg => msg._id !== tempId)); setInputText(newMessage.text); checkMutualInitiation(messages.filter(msg => msg._id !== tempId)); /* Recheck on failure */ }
         else { console.log("Message insert successful."); setError(null); } // Clear error on success
    }, [currentUserId, matchUserId, isBlocked, checkMutualInitiation, markChatAsInitiatedInStorage, messages]); // <<< Added dependencies
    const handleSendPress = () => { sendMessage(inputText); };

    // --- Effects ---

    // Set Header Title and fetch status ON FOCUS
    useFocusEffect(
        useCallback(() => {
            console.log(`[ChatScreen] Focus effect running for user: ${matchUserId}`);
            // Update the name from route params in case it changed somehow
            const currentName = route.params.matchName || 'Chat';
            setDynamicMatchName(currentName);
            const profilePicUri = route.params.matchProfilePicture; // Get profile picture URI

            // Fetch the latest mute/block status
             fetchInteractionStatus(); // This now also handles setting block error messages

            // Update navigation options based on the LATEST fetched status and name
             navigation.setOptions({
                 headerShown: true,
                 headerTitleAlign: 'center',
                 headerBackTitleVisible: false,
                 headerLeft: () => (
                     <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: Platform.OS === 'ios' ? 10 : 0, padding: 5 }}>
                         <Feather name="chevron-left" size={26} color={APP_CONSTANTS.COLORS.PRIMARY} />
                     </TouchableOpacity>
                 ),
                 // Render header title component dynamically
                 headerTitle: () => {
                    // Get the current state values directly during render
                    const isCurrentlyBlocked = isBlocked;
                    const isCurrentlyMuted = isMatchMuted;
                    const title = isCurrentlyBlocked ? "User Unavailable" : (dynamicMatchName || 'Chat');
                    const isMutuallyInitiated = isChatMutuallyInitiated; // <<< Get current state value
                    const canNavigateToProfile = !isCurrentlyBlocked && isMutuallyInitiated; // <<< Recalculate here

                    return (
                        <TouchableOpacity
                            onPress={() => navigation.navigate('OtherUserProfileScreen', { userId: matchUserId })}
                            style={styles.headerTitleContainer}
                            disabled={!canNavigateToProfile} // <<< Disable based on recalculation
                        >
                           {/* Add Profile Picture Here */}
                           <Image
                                source={{ uri: profilePicUri ?? DEFAULT_PROFILE_PIC }}
                                style={styles.headerProfileImage}
                            />
                            <Text style={[styles.headerTitleText, isCurrentlyBlocked && styles.blockedText]} numberOfLines={1}>
                                {title}
                            </Text>
                            {isCurrentlyMuted && !isCurrentlyBlocked && (
                                <Feather name="volume-x" size={16} color="#FF8C00" style={styles.muteIcon} />
                            )}
                        </TouchableOpacity>
                    );
                 },
                 headerRight: () => (isBlocked ? <View style={{width: 30}} /> : undefined), // Hide options maybe?
                 headerStyle: { backgroundColor: 'white' },
             });

        }, [navigation, matchUserId, route.params.matchName, route.params.matchProfilePicture, fetchInteractionStatus, isBlocked, isMatchMuted, isChatMutuallyInitiated]) // Add profile pic URI to dependencies
    );

    // Fetch initial messages AFTER checking block status
    useEffect(() => {
        if (!isBlocked && currentUserId && matchUserId) {
            fetchMessages();
        } else if (isBlocked) {
            setMessages([]); // Ensure messages are cleared if blocked
        }
    }, [fetchMessages, isBlocked, currentUserId, matchUserId]); // Run when block status or IDs change


    // Real-time Subscription Setup
    useEffect(() => {
        if (!currentUserId || !matchUserId || isBlocked) {
            // If blocked, ensure no subscription exists
            return () => { supabase.channel(`chat_${[currentUserId, matchUserId].sort().join('_')}`).unsubscribe(); };
        }

        console.log(`[ChatScreen] Subscribing to channel for ${matchUserId}`);
        const channel = supabase
            .channel(`chat_${[currentUserId, matchUserId].sort().join('_')}`)
            .on<DbMessage>(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages',
                  filter: `or(and(sender_id.eq.${currentUserId},receiver_id.eq.${matchUserId}),and(sender_id.eq.${matchUserId},receiver_id.eq.${currentUserId}))` },
                (payload) => {
                    if (isBlocked) return; // Double check block status on receive
                    console.log('[ChatScreen] New message received via subscription:', payload.new);
                    const receivedMessage = mapDbMessageToChatMessage(payload.new as DbMessage);
                     // Add message ONLY if it's from the OTHER user
                    if (receivedMessage.user._id === matchUserId) {
                         setMessages(prevMessages => {
                            if (prevMessages.some(msg => msg._id === receivedMessage._id)) return prevMessages;
                            return [...prevMessages, receivedMessage];
                         });
                    } else if (receivedMessage.user._id === currentUserId) {
                        // If message is from current user (sent from another device), replace temp message
                        setMessages(prevMessages =>
                            prevMessages.map(msg =>
                                msg._id.startsWith('temp_') && msg.text === receivedMessage.text
                                ? receivedMessage // Replace temp with real
                                : msg
                            )
                         );
                    }
                }
            )
            .subscribe((status, err) => {
                 if (status === 'SUBSCRIBED') console.log('[ChatScreen] Realtime channel subscribed');
                 if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { console.error(`[ChatScreen] Realtime error: ${status}`, err); setError('Realtime connection issue.'); }

                 // Check initiation when message is added via subscription
                 setMessages(prev => { checkMutualInitiation(prev); return prev; });
            });

        // Cleanup subscription
        return () => {
            console.log(`[ChatScreen] Unsubscribing from channel for ${matchUserId}`);
            supabase.removeChannel(channel);
        };
    }, [currentUserId, matchUserId, mapDbMessageToChatMessage, isBlocked, checkMutualInitiation]); // isBlocked & checkMutualInitiation crucial

    // Group messages by date for section headers
    const sections = useMemo(() => {
        const groups: Record<string, ChatMessage[]> = {};
        messages.forEach(msg => {
            const dateKey = new Date(msg.createdAt).toDateString();
            (groups[dateKey] = groups[dateKey] || []).push(msg);
        });
        const sortedKeys = Object.keys(groups).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        const today = new Date(), yesterday = new Date(today.getTime() - 86400000);
        return sortedKeys.map(dateKey => {
            const date = new Date(dateKey);
            let title = date.toDateString() === today.toDateString() ? 'Today'
                : date.toDateString() === yesterday.toDateString() ? 'Yesterday'
                : (today.getTime() - date.getTime() <= 7 * 86400000) ? date.toLocaleDateString(undefined, { weekday: 'long' })
                : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            return { title, data: groups[dateKey] };
        });
    }, [messages]);

    // --- Render Logic ---
    if (loading && messages.length === 0 && !isBlocked) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} /></View>;
    }
    if (!currentUserId) {
        return <View style={styles.centered}><Text style={styles.errorText}>Authentication error.</Text></View>;
    }
     // Use the error state set by fetchInteractionStatus or fetchMessages
     if (isBlocked) {
         return (
             <SafeAreaView style={styles.safeArea} edges={['bottom']}>
                 <View style={styles.centered}>
                     <Feather name="slash" size={60} color={APP_CONSTANTS.COLORS.DISABLED} />
                     <Text style={styles.errorText}>Chat Unavailable</Text>
                     <Text style={styles.infoText}>{error || "You cannot exchange messages with this user."}</Text>
                 </View>
             </SafeAreaView>
         );
     }
    // Show fetch error only if not blocked and messages are empty
    if (error && messages.length === 0 && !isBlocked) {
        return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
    }

    const safeAreaEdges: Edge[] = ['bottom'];

    return (
        <SafeAreaView style={styles.safeArea} edges={safeAreaEdges}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoidingContainer}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            >
                {/* Non-blocking send error banner */}
                {error && error !== "Could not load messages." && error !== "You cannot chat with this user." && (
                    <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{error}</Text></View>
                )}

                <SectionList
                    ref={flatListRef}
                    sections={sections}
                    style={styles.messageList}
                    contentContainerStyle={styles.messageListContent}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => <MessageBubble message={item} currentUserId={currentUserId} />}
                    renderSectionHeader={({ section: { title } }) => (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionHeaderText}>{title}</Text>
                        </View>
                    )}
                    onContentSizeChange={() => {
                        if (flatListRef.current && sections.length) {
                            const lastSectionIndex = sections.length - 1;
                            const lastItemIndex = sections[lastSectionIndex].data.length - 1;
                            flatListRef.current.scrollToLocation({
                                sectionIndex: lastSectionIndex,
                                itemIndex: lastItemIndex,
                                animated: false,
                                viewPosition: 1
                            });
                        }
                    }}
                    onLayout={() => {
                        if (flatListRef.current && sections.length) {
                            const lastSectionIndex = sections.length - 1;
                            const lastItemIndex = sections[lastSectionIndex].data.length - 1;
                            flatListRef.current.scrollToLocation({
                                sectionIndex: lastSectionIndex,
                                itemIndex: lastItemIndex,
                                animated: false,
                                viewPosition: 1
                            });
                        }
                    }}
                    stickySectionHeadersEnabled
                />

                <View style={styles.inputToolbar}>
                    <TextInput
                        style={styles.textInput}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Type a message..."
                        placeholderTextColor="#9CA3AF"
                        multiline
                        editable={!isBlocked}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, (!inputText.trim() || isBlocked) && styles.sendButtonDisabled]}
                        onPress={handleSendPress}
                        disabled={!inputText.trim() || isBlocked}
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
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
    errorText: { color: '#DC2626', fontSize: 16, textAlign: 'center', marginTop: 10 },
    infoText: { color: '#6B7280', fontSize: 14, textAlign: 'center', marginTop: 8 },
    errorBanner: { backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingVertical: 8, paddingHorizontal: 15, },
    errorBannerText: { color: '#B91C1C', fontSize: 13, textAlign: 'center', },
    noMessagesText: { color: '#6B7280', fontSize: 14, marginTop: 30 },
    messageList: { flex: 1, paddingHorizontal: 10, },
    messageListContent: { paddingVertical: 10, flexGrow: 1, justifyContent: 'flex-end' },
    messageRow: { flexDirection: 'row', marginVertical: 5, },
    messageRowSent: { justifyContent: 'flex-end', },
    messageRowReceived: { justifyContent: 'flex-start', },
    messageBubble: { maxWidth: '75%', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, },
    messageBubbleSent: { backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', borderBottomRightRadius: 4, },
    messageBubbleReceived: { backgroundColor: '#E5E7EB', borderBottomLeftRadius: 4, },
    messageTextSent: { color: '#FFFFFF', fontSize: 15, },
    messageTextReceived: { color: '#1F2937', fontSize: 15, },
    inputToolbar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF', },
    textInput: { flex: 1, minHeight: 40, maxHeight: 120, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 15, marginRight: 10, color: '#1F2937', },
    sendButton: { backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', },
    sendButtonDisabled: { backgroundColor: '#9CA3AF', },
    headerTitleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexShrink: 1 },
    headerProfileImage: {
        width: 30,
        height: 30,
        borderRadius: 15,
        marginRight: 8,
        backgroundColor: '#E5E7EB',
    },
    headerTitleText: { fontSize: 17, fontWeight: '600', color: '#000000', textAlign: 'center', },
    muteIcon: { marginLeft: 6, },
    blockedText: { color: '#6B7280', fontStyle: 'italic', },
    timeText: {
        fontSize: 11,
        color: '#9CA3AF',
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    sectionHeader: {
        alignItems: 'center',
        marginVertical: 10,
    },
    sectionHeaderText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
});

export default IndividualChatScreen;