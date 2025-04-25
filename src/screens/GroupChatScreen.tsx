// src/screens/GroupChatScreen.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, StyleSheet, ActivityIndicator, Text, TouchableOpacity,
    Platform, TextInput, FlatList, KeyboardAvoidingView, Keyboard,
    Modal, Alert, Image // Added Image for potential avatars
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

// --- Adjust Imports ---
import { supabase } from '@/lib/supabase';         // Adjust path
import { useAuth } from '@/hooks/useAuth';         // Adjust path
import type { RootStackParamList } from "@/navigation/AppNavigator"; // Adjust path
import { APP_CONSTANTS } from '@/config/constants';  // Adjust path
// --- End Adjustments ---

type GroupChatScreenRouteProp = RouteProp<RootStackParamList, 'GroupChatScreen'>;
type GroupChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GroupChatScreen'>;

// Define structure of a message coming from Supabase DB for groups
interface DbGroupMessage {
    id: string;
    created_at: string;
    sender_id: string;
    group_id: string;
    content: string;
    // Joined sender profile info
    sender_profile: {
        first_name: string | null;
        last_name: string | null;
        profile_picture: string | null;
    } | null;
}

// Define the structure for messages used by the FlatList
interface ChatMessage {
    _id: string; // Unique message ID
    text: string;
    createdAt: Date;
    user: { // Information about the sender
        _id: string; // Sender's user ID
        name?: string; // Sender's display name (optional)
        avatar?: string; // Sender's avatar URL (optional)
    };
}

// Cache for user profiles (sender info) to avoid refetching constantly
const userProfileCache: Record<string, { name?: string; avatar?: string }> = {};

const DEFAULT_PROFILE_PIC = 'https://via.placeholder.com/150/CCCCCC/808080?text=User'; // Fallback Avatar

// --- Reusable Message Bubble Component for Groups ---
interface GroupMessageBubbleProps {
    message: ChatMessage;
    currentUserId: string | undefined;
}
const GroupMessageBubble: React.FC<GroupMessageBubbleProps> = React.memo(({ message, currentUserId }) => {
    const isCurrentUser = message.user._id === currentUserId;
    const senderName = message.user.name; // Get sender name from message object

    return (
        <View style={[ styles.messageRow, isCurrentUser ? styles.messageRowSent : styles.messageRowReceived ]}>
             {/* Optionally show avatar for received messages */}
             {/* {!isCurrentUser && message.user.avatar && (
                 <Image source={{ uri: message.user.avatar }} style={styles.avatar} />
             )} */}
            <View style={styles.messageContentContainer}>
                 {/* Show sender name above bubble if not current user */}
                 {!isCurrentUser && senderName && (
                     <Text style={styles.senderName}>{senderName}</Text>
                 )}
                <View style={[ styles.messageBubble, isCurrentUser ? styles.messageBubbleSent : styles.messageBubbleReceived ]}>
                    <Text style={isCurrentUser ? styles.messageTextSent : styles.messageTextReceived}>
                        {message.text}
                    </Text>
                     {/* Optional: Add timestamp inside bubble */}
                     {/* <Text style={isCurrentUser ? styles.timestampSent : styles.timestampReceived}>
                         {message.createdAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                     </Text> */}
                </View>
            </View>
        </View>
    );
});


const GroupChatScreen: React.FC = () => {
    const route = useRoute<GroupChatScreenRouteProp>();
    const navigation = useNavigation<GroupChatScreenNavigationProp>();
    const { session } = useAuth();
    const currentUserId = session?.user?.id;

    const { groupId } = route.params;
    const [currentGroupName, setCurrentGroupName] = useState(route.params.groupName);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // State for Editing Name Modal
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingName, setEditingName] = useState(currentGroupName || '');
    const [isUpdatingName, setIsUpdatingName] = useState(false);

    const flatListRef = useRef<FlatList>(null);

    // --- Map DB Message to Frontend ChatMessage ---
    const mapDbMessageToChatMessage = useCallback((dbMessage: DbGroupMessage): ChatMessage => {
        // Cache sender info if not already present
        if (dbMessage.sender_id && !userProfileCache[dbMessage.sender_id]) {
            userProfileCache[dbMessage.sender_id] = {
                name: `${dbMessage.sender_profile?.first_name || ''} ${dbMessage.sender_profile?.last_name || ''}`.trim() || 'User',
                avatar: dbMessage.sender_profile?.profile_picture || undefined,
            };
        }
         // Pre-cache current user if needed
         if (currentUserId && !userProfileCache[currentUserId]) {
              userProfileCache[currentUserId] = { _id: currentUserId, name: 'You' };
         }

        return {
            _id: dbMessage.id,
            text: dbMessage.content,
            createdAt: new Date(dbMessage.created_at),
            user: { // Populate user object fully
                _id: dbMessage.sender_id,
                name: userProfileCache[dbMessage.sender_id]?.name || 'Unknown',
                avatar: userProfileCache[dbMessage.sender_id]?.avatar,
            },
        };
    }, [currentUserId]); // Depend on currentUserId

    // --- Fetch Initial Messages ---
    const fetchMessages = useCallback(async () => {
        if (!currentUserId || !groupId) {
            setError("User or Group ID missing."); setLoading(false); return;
        }
        console.log(`[GroupChatScreen] Fetching messages for group: ${groupId}`);
        setLoading(true); setError(null);
        // Ensure current user is cached for mapping
        userProfileCache[currentUserId] = { _id: currentUserId, name: 'You' };

        try {
            // Fetch messages with sender profile joined
            const { data, error: fetchError } = await supabase
                .from('group_chat_messages')
                .select(`*, sender_profile:music_lover_profiles!sender_id (first_name, last_name, profile_picture)`)
                .eq('group_id', groupId)
                .order('created_at', { ascending: true }); // Fetch oldest first for FlatList

            if (fetchError) throw fetchError;

            if (data) {
                console.log(`[GroupChatScreen] Fetched ${data.length} messages.`);
                // Ensure profiles are cached before mapping
                (data as DbGroupMessage[]).forEach(dbMsg => {
                     if (dbMsg.sender_id && !userProfileCache[dbMsg.sender_id]) {
                          userProfileCache[dbMsg.sender_id] = {
                              name: `${dbMsg.sender_profile?.first_name || ''} ${dbMsg.sender_profile?.last_name || ''}`.trim() || 'User',
                              avatar: dbMsg.sender_profile?.profile_picture || undefined,
                          };
                     }
                 });
                setMessages((data as DbGroupMessage[]).map(mapDbMessageToChatMessage));
            } else {
                setMessages([]);
                 console.log(`[GroupChatScreen] No messages found.`);
            }
        } catch (err: any) {
            console.error("[GroupChatScreen] Error fetching messages:", err);
            setError("Could not load messages.");
            setMessages([]);
        } finally {
            setLoading(false);
        }
    }, [currentUserId, groupId, mapDbMessageToChatMessage]); // Add mapDbMessageToChatMessage


    // --- Send Message ---
    const sendMessage = useCallback(async (text: string) => {
         if (!currentUserId || !groupId || !text.trim()) { return; }

         const trimmedText = text.trim();
         const tempId = `temp_${Date.now()}_${Math.random()}`; // More unique temp ID

         // Create the message object for UI update
         const newMessage: ChatMessage = {
             _id: tempId,
             text: trimmedText,
             createdAt: new Date(),
             user: {
                 _id: currentUserId,
                 name: userProfileCache[currentUserId]?.name || 'You', // Use cached name
                 avatar: userProfileCache[currentUserId]?.avatar, // Use cached avatar
              }
         };

         // Optimistic UI update
         setMessages(previousMessages => [...previousMessages, newMessage]);
         setInputText(''); // Clear input AFTER getting text
         Keyboard.dismiss();

         console.log(`[GroupChatScreen] Sending message to group ${groupId}: "${trimmedText}"`);

         // Insert into Supabase
         const { error: insertError } = await supabase
            .from('group_chat_messages')
            .insert({
                sender_id: currentUserId,
                group_id: groupId,
                content: trimmedText, // Send trimmed text
            });

         if (insertError) {
             console.error("Error sending group message:", insertError);
             setError("Failed to send message.");
             // Revert optimistic update on error
             setMessages(prevMessages => prevMessages.filter(msg => msg._id !== tempId));
             setInputText(trimmedText); // Put text back in input on failure
             setTimeout(() => setError(null), 3000); // Clear error after delay
         } else {
             console.log("Group message insert successful.");
             if(error) setError(null); // Clear previous error on success
         }
    }, [currentUserId, groupId, error]); // Added error dependency

    const handleSendPress = () => { sendMessage(inputText); };


    // --- Real-time Subscription for Messages ---
     useEffect(() => {
        if (!groupId || !currentUserId) return;

        fetchMessages(); // Fetch initial messages

        console.log(`[GroupChatScreen] Subscribing to messages for group ${groupId}`);
        const messageChannel = supabase
            .channel(`group_chat_messages_${groupId}`)
            .on<DbGroupMessage>(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'group_chat_messages', filter: `group_id=eq.${groupId}` },
                async (payload) => {
                    console.log('[GroupChatScreen] RT: New group message!', payload.new);
                    const newMessageDb = payload.new as DbGroupMessage;

                     // Skip if message is from current user (already handled optimistically)
                     if (newMessageDb.sender_id === currentUserId) {
                         // Optional: Replace temp message if needed (more complex state mgmt)
                         console.log("[GroupChatScreen] RT: Ignoring self-sent message.");
                         return;
                     }

                     // Ensure sender profile is available (fetch if needed for new users joining)
                     if (newMessageDb.sender_id && !userProfileCache[newMessageDb.sender_id]) {
                          console.log(`[GroupChatScreen] RT: Fetching profile for sender ${newMessageDb.sender_id}`);
                          const { data: profileData } = await supabase
                               .from('music_lover_profiles') // Adjust table name if needed
                               .select('first_name, last_name, profile_picture')
                               .eq('user_id', newMessageDb.sender_id)
                               .single();
                          newMessageDb.sender_profile = profileData || null;
                     } else if (newMessageDb.sender_id) {
                         // Attach cached profile if needed by map function
                         const cachedUser = userProfileCache[newMessageDb.sender_id];
                          newMessageDb.sender_profile = { first_name: cachedUser.name?.split(' ')[0] || null, last_name: cachedUser.name?.split(' ').slice(1).join(' ') || null, profile_picture: typeof cachedUser.avatar === 'string' ? cachedUser.avatar : null };
                     }

                    const giftedMessage = mapDbMessageToChatMessage(newMessageDb);

                    // Add the new message to the state
                    setMessages(previousMessages => {
                        // Prevent adding duplicates if subscription fires multiple times rapidly
                        if (previousMessages.some(msg => msg._id === giftedMessage._id)) {
                            return previousMessages;
                        }
                        return [...previousMessages, giftedMessage];
                    });
                }
            )
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') console.log(`[GroupChatScreen] Realtime subscribed for group messages: ${groupId}`);
                if (err) console.error(`[GroupChatScreen] Realtime messages error (Group ${groupId}):`, err);
            });

        // Cleanup function
        return () => {
            console.log(`[GroupChatScreen] Unsubscribing from group messages: ${groupId}`);
            supabase.removeChannel(messageChannel);
        };
    }, [groupId, currentUserId, fetchMessages, mapDbMessageToChatMessage]); // Dependencies


    // --- Real-time Subscription for Group Info (Name/Image) ---
     useEffect(() => {
        if (!groupId) return;
        console.log(`[GroupChatScreen] Subscribing to info for group ${groupId}`);
         const infoChannel = supabase
            .channel(`group_info_${groupId}`)
            .on<any>( // Use any for flexibility with table structure
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'group_chats', filter: `id=eq.${groupId}` },
                (payload) => {
                    console.log('[GroupChatScreen] RT: Group info updated:', payload.new);
                    const newName = payload.new.group_name;
                    if (newName !== currentGroupName) {
                        console.log(`[GroupChatScreen] RT: Updating group name from "${currentGroupName}" to "${newName}"`);
                        setCurrentGroupName(newName);
                        // Header update is handled by the separate effect below
                    }
                    // Handle image updates if necessary
                }
            )
             .subscribe((status, err) => {
                 if (status === 'SUBSCRIBED') console.log(`[GroupChatScreen] Realtime subscribed for group info: ${groupId}`);
                 if (err) console.error(`[GroupChatScreen] Realtime info error (Group ${groupId}):`, err);
             });

         // Cleanup
         return () => {
             console.log(`[GroupChatScreen] Unsubscribing from group info: ${groupId}`);
             supabase.removeChannel(infoChannel);
         };
     // Only depend on groupId for setting up subscription
     }, [groupId]);


    // --- Effect to Update Header Options ---
    useEffect(() => {
        navigation.setOptions({
            title: currentGroupName || 'Group Chat', // Use state
            headerRight: () => (
                <View style={styles.headerButtons}>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('AddGroupMembersScreen', { groupId, groupName: currentGroupName })}
                        style={styles.headerButton}
                        hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                        >
                         <Feather name="user-plus" size={22} color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} />
                    </TouchableOpacity>
                     <TouchableOpacity
                        onPress={() => { setEditingName(currentGroupName || ''); setIsEditModalVisible(true); }}
                        style={styles.headerButton}
                        hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                     >
                         <Feather name="edit-2" size={22} color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} />
                    </TouchableOpacity>
                </View>
            ),
        });
    // Update header ONLY when navigation, currentGroupName, or groupId changes
    }, [navigation, currentGroupName, groupId]);


     // --- Handle Saving Edited Name ---
     const handleUpdateName = async () => {
         const newName = editingName.trim();
         if (newName === currentGroupName || isUpdatingName || !groupId) {
             setIsEditModalVisible(false); return;
         }

         setIsUpdatingName(true);
         try {
             console.log(`[GroupChatScreen] Calling RPC rename_group_name for ${groupId}`);
             const { error: rpcError } = await supabase.rpc('rename_group_name', {
                 group_id_input: groupId,
                 new_group_name: newName || null
             });
             if (rpcError) throw rpcError;
             // Don't set local state here - let the real-time subscription handle it
             setIsEditModalVisible(false);
             console.log("[GroupChatScreen] Group name update requested via RPC.");

         } catch (err: any) {
              console.error("[GroupChatScreen] Error updating group name RPC:", err);
              Alert.alert("Error", `Could not update group name: ${err.message}`);
         } finally {
              setIsUpdatingName(false);
         }
     };

    // --- Render Logic ---
    if (loading && messages.length === 0) {
         return <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} /></View>;
    }
    if (error && messages.length === 0) {
         return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
    }
    if (!currentUserId || !groupId) {
         return <View style={styles.centered}><Text style={styles.errorText}>Missing User or Group Info.</Text></View>;
    }

    const safeAreaEdges: Edge[] = ['bottom'];

    return (
        <SafeAreaView style={styles.safeArea} edges={safeAreaEdges}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoidingContainer}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                // Adjust offset if you have a tab bar or other fixed elements below
                keyboardVerticalOffset={Platform.OS === "ios" ? (APP_CONSTANTS?.HEADER_HEIGHT || 60) : 0} // Example offset
            >
                {/* Non-blocking send error banner */}
                {error && error !== "Could not load chat." && ( // Only show send errors
                    <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{error}</Text></View>
                )}

                <FlatList
                    ref={flatListRef}
                    style={styles.messageList}
                    contentContainerStyle={styles.messageListContent}
                    data={messages} // Use state directly
                    keyExtractor={(item) => item._id} // Use message ID
                    renderItem={({ item }) => <GroupMessageBubble message={item} currentUserId={currentUserId} />}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })} // Animate scroll on size change
                    onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })} // Scroll on initial layout
                    ListEmptyComponent={
                        !loading ? <View style={styles.centered}><Text style={styles.noMessagesText}>Be the first to chat!</Text></View> : null
                    }
                    // inverted // Uncomment if you prefer newest messages at the bottom (requires reversing data array)
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
                        // editable={!isBlocked} // Add block check later if needed
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, (!inputText.trim()) && styles.sendButtonDisabled]} // Disable based on text
                        onPress={handleSendPress}
                        disabled={!inputText.trim()} // Disable based on text
                    >
                        <Feather name="send" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

             {/* Edit Name Modal */}
            <Modal visible={isEditModalVisible} transparent={true} animationType="fade" onRequestClose={() => setIsEditModalVisible(false)}>
                 <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setIsEditModalVisible(false)} />
                 <View style={styles.modalContent}>
                     <Text style={styles.modalTitle}>Edit Group Name</Text>
                     <TextInput style={styles.modalInput} value={editingName} onChangeText={setEditingName} placeholder="Enter new group name" maxLength={50} autoFocus={true}/>
                     <View style={styles.modalActions}>
                         <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => setIsEditModalVisible(false)} disabled={isUpdatingName}><Text style={styles.modalButtonTextCancel}>Cancel</Text></TouchableOpacity>
                         <TouchableOpacity style={[styles.modalButton, styles.modalButtonSave, isUpdatingName && styles.modalButtonDisabled]} onPress={handleUpdateName} disabled={isUpdatingName}>
                             {isUpdatingName ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.modalButtonTextSave}>Save</Text>}
                         </TouchableOpacity>
                     </View>
                 </View>
            </Modal>

        </SafeAreaView>
    );
};

// --- Styles --- (Combine styles from IndividualChatScreen and Group-specific ones)
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFFFFF', },
    keyboardAvoidingContainer: { flex: 1, },
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F9FAFB'},
    errorText: { color: '#DC2626', fontSize: 16, textAlign: 'center', },
    errorBanner: { backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingVertical: 8, paddingHorizontal: 15, },
    errorBannerText: { color: '#B91C1C', fontSize: 13, textAlign: 'center'},
    noMessagesText: { color: '#6B7280', fontSize: 14, marginTop: 30 },
    messageList: { flex: 1, paddingHorizontal: 10, },
    messageListContent: { paddingVertical: 10, flexGrow: 1, justifyContent: 'flex-end' }, // justifyContent:'flex-end' helps start list at bottom before filling
    // Bubble Styles
    messageRow: { flexDirection: 'row', marginVertical: 2, alignItems: 'flex-end', }, // Align items to bottom
    messageRowSent: { justifyContent: 'flex-end', },
    messageRowReceived: { justifyContent: 'flex-start', },
    messageContentContainer: { maxWidth: '75%', }, // Container for bubble + name
    messageBubble: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, },
    messageBubbleSent: { backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', borderBottomRightRadius: 4, },
    messageBubbleReceived: { backgroundColor: '#E5E7EB', borderBottomLeftRadius: 4, },
    messageTextSent: { color: '#FFFFFF', fontSize: 15, },
    messageTextReceived: { color: '#1F2937', fontSize: 15, },
    senderName: { fontSize: 11, color: '#6B7280', marginBottom: 3, marginLeft: 5, // Above received bubble
        // Align with the start of the bubble, adjust based on avatar presence/size
    },
    // Avatar style (optional)
    // avatar: { width: 30, height: 30, borderRadius: 15, marginRight: 6, marginBottom: 0 /* Adjust alignment */ },
    // Input Toolbar Styles
    inputToolbar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF', },
    textInput: { flex: 1, minHeight: 40, maxHeight: 120, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 15, marginRight: 10, color: '#1F2937', },
    sendButton: { backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', },
    sendButtonDisabled: { backgroundColor: '#9CA3AF', },
    // Header Styles
    headerButtons: { flexDirection: 'row', marginRight: Platform.OS === 'ios' ? 5 : 15, },
    headerButton: { paddingHorizontal: 8, paddingVertical: 5 }, // Make buttons easier to tap
    // Modal Styles
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    modalContent: { position: 'absolute', bottom: '35%', left: '5%', right: '5%', backgroundColor: 'white', borderRadius: 12, padding: 25, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, },
    modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 20, textAlign: 'center', color: '#1F2937', },
    modalInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, marginBottom: 25, },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', },
    modalButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center', minWidth: 90, },
    modalButtonCancel: { backgroundColor: '#E5E7EB', },
    modalButtonSave: { backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', },
    modalButtonDisabled: { backgroundColor: '#9CA3AF', },
    modalButtonTextCancel: { color: '#4B5563', fontWeight: '500', },
    modalButtonTextSave: { color: 'white', fontWeight: '600', },
});


export default GroupChatScreen;