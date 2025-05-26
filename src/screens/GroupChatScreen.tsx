import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View, StyleSheet, ActivityIndicator, Text, TouchableOpacity,
    Platform, TextInput, SectionList, KeyboardAvoidingView, Keyboard,
    Modal, Alert, Image // Keep Image from react-native
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import ImageViewer from 'react-native-image-zoom-viewer';

// --- Adjust Paths ---
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { RootStackParamList } from "@/navigation/AppNavigator"; // Adjust path
import { APP_CONSTANTS } from '@/config/constants';    
import { v4 as uuidv4 } from 'uuid';           // Adjust path
// --- End Adjust Paths ---

// Import necessary items from EventsScreen or a shared location
import {
    EventDetailModal,
    type MappedEvent,
    type OrganizerInfo,
    // formatEventDateTime, // Using local version for now
    // SupabasePublicEvent, // Not directly needed if fetching specific event fields
} from '@/screens/EventsScreen'; // Adjust path if moved

// Helper to format timestamps safely
const formatTime = (date: Date | string | number): string => {
    try {
        const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
        if (!dateObj || isNaN(dateObj.getTime())) return '--:--';
        return dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch (e) { console.warn("Fmt err:", date, e); return '--:--'; }
};

// Simplified formatEventDateTime for modal
const formatEventDateTimeForModal = (isoString: string | null): { date: string; time: string } => {
    if (!isoString) return { date: "N/A", time: "N/A" };
    try {
        const d = new Date(isoString);
        const datePart = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' });
        const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
        return { date: datePart, time: timePart };
    } catch (e) { return { date: "Invalid Date", time: "" }; }
};

// --- Type Definitions ---
type GroupChatScreenRouteProp = RouteProp<RootStackParamList & {
    GroupChatScreen: {
        groupId: string;
        groupName?: string | null;
        groupImage?: string | null;
        sharedEventData?: {
            eventId: string;
            eventTitle: string;
            eventDate: string;
            eventVenue: string;
            eventImage: string;
            isSharing: boolean;
        }
    }
}, 'GroupChatScreen'>;
type GroupChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GroupChatScreen'>;
interface DbGroupMessage { id: string; created_at: string; sender_id: string; group_id: string; content: string | null; image_url: string | null; is_system_message: boolean; 
}
interface ChatMessage { _id: string; text: string; createdAt: Date; user: { _id: string; name?: string; avatar?: string; }; image?: string | null; isSystemMessage: boolean;
    sharedEvent?: {
        eventId: string;
        eventTitle: string;
        eventDate: string;
        eventVenue: string;
        eventImage: string;
    } | null;
}
interface UserProfileInfo { user_id: string; first_name: string | null; last_name: string | null; profile_picture: string | null; }
interface DbGroupChat { id: string; group_name: string; group_image: string | null; can_members_add_others?: boolean; can_members_edit_info?: boolean; }

// --- Constants and Cache ---
const userProfileCache: Record<string, { name?: string; avatar?: string }> = {};
const DEFAULT_PROFILE_PIC = APP_CONSTANTS?.DEFAULT_PROFILE_PIC || 'https://via.placeholder.com/40';
const DEFAULT_GROUP_PIC = 'https://placehold.co/40x40/e2e8f0/64748b?text=G';
const DEFAULT_EVENT_IMAGE_CHAT = "https://via.placeholder.com/800x450/D1D5DB/1F2937?text=Event";
const DEFAULT_ORGANIZER_LOGO_CHAT = "https://via.placeholder.com/150/BFDBFE/1E40AF?text=Logo";
const DEFAULT_ORGANIZER_NAME_CHAT = "Event Organizer";

// --- GroupMessageBubble Component ---
interface GroupMessageBubbleProps { 
    message: ChatMessage; 
    currentUserId: string | undefined;
    onImagePress: (imageUri: string) => void;
    onEventPress?: (eventId: string) => void;
}
const GroupMessageBubble: React.FC<GroupMessageBubbleProps> = React.memo(({ message, currentUserId, onImagePress, onEventPress }) => {
    const isCurrentUser = message.user._id === currentUserId;
    const senderName = message.user.name;
    const [imageError, setImageError] = useState(false);

    // Handle event press 
    const handleEventPress = () => {
        if (message.sharedEvent?.eventId && onEventPress) {
            // Log impression
            try {
                supabase.from('event_impressions').insert({
                    event_id: message.sharedEvent.eventId,
                    user_id: currentUserId || null,
                    source: 'group_chat'
                }).then(() => {
                    console.log(`Logged impression for event ${message.sharedEvent?.eventId} from group chat`);
                });
            } catch (err) {
                console.error("Failed to log impression:", err);
            }
            
            onEventPress(message.sharedEvent.eventId);
        }
    };

    // System Message
    if (message.isSystemMessage) {
        return ( <View style={styles.systemMessageContainer}><Text style={styles.systemMessageText}>{message.text}</Text></View> );
    }

    // Shared Event Message
    if (message.sharedEvent) {
        return (
            <View style={[styles.messageRow, isCurrentUser ? styles.messageRowSent : styles.messageRowReceived]}>
                <View style={styles.messageContentContainer}>
                    {!isCurrentUser && senderName && senderName !== 'User' && (
                        <Text style={styles.senderName}>{senderName}</Text>
                    )}
                    <View style={[
                        styles.messageBubble, 
                        styles.sharedEventMessageBubble,
                        isCurrentUser ? styles.messageBubbleSentText : styles.messageBubbleReceivedText
                    ]}>
                        <Text style={[
                            styles.messageText, 
                            isCurrentUser ? styles.messageTextSent : styles.messageTextReceived
                        ]}>
                            {message.text}
                        </Text>
                        
                        <TouchableOpacity 
                            style={styles.sharedEventPreview}
                            onPress={handleEventPress}
                            activeOpacity={0.7}
                        >
                            <Image 
                                source={{ uri: message.sharedEvent.eventImage || DEFAULT_EVENT_IMAGE_CHAT }}
                                style={styles.sharedEventPreviewImage}
                                resizeMode="cover"
                                onError={() => setImageError(true)}
                            />
                            {imageError && (
                                <View style={styles.imageErrorOverlay}>
                                    <Feather name="image" size={20} color="#FFFFFF" />
                                </View>
                            )}
                            <View style={styles.sharedEventPreviewContent}>
                                <Text style={styles.sharedEventPreviewTitle} numberOfLines={1}>
                                    {message.sharedEvent.eventTitle}
                                </Text>
                                <Text style={styles.sharedEventPreviewDetails} numberOfLines={1}>
                                    {message.sharedEvent.eventDate}
                                </Text>
                                <Text style={styles.sharedEventPreviewDetails} numberOfLines={1}>
                                    {message.sharedEvent.eventVenue}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                    <Text style={[styles.timeText, styles.timeTextBelowBubble, isCurrentUser ? styles.timeTextSent : styles.timeTextReceived]}>
                        {formatTime(message.createdAt)}
                    </Text>
                </View>
            </View>
        );
    }

    // Image Message
    if (message.image) {
        return (
            <View style={[styles.messageRow, isCurrentUser ? styles.messageRowSent : styles.messageRowReceived]}>
                <View style={styles.messageContentContainer}>
                    {!isCurrentUser && senderName && senderName !== 'User' && ( <Text style={styles.senderName}>{senderName}</Text> )}
                    <TouchableOpacity 
                        style={[ styles.messageBubble, styles.imageBubble, isCurrentUser ? styles.messageBubbleSentImage : styles.messageBubbleReceivedImage ]} 
                        activeOpacity={0.8} 
                        onPress={() => onImagePress(message.image!)}
                    >
                        <Image
                            source={{ uri: message.image }}
                            style={styles.chatImage}
                            resizeMode="cover"
                            onError={() => setImageError(true)}
                        />
                        {imageError && (
                            <View style={styles.imageErrorOverlay}>
                                <Feather name="image" size={24} color="#FFFFFF" />
                                <Text style={styles.imageErrorText}>Failed to load image</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <Text style={[styles.timeText, styles.timeTextBelowBubble, isCurrentUser ? styles.timeTextSent : styles.timeTextReceived]}>
                        {formatTime(message.createdAt)}
                    </Text>
                </View>
            </View>
        );
    }

    // Text Message
    if (message.text) {
        return (
            <View style={[ styles.messageRow, isCurrentUser ? styles.messageRowSent : styles.messageRowReceived ]}>
                <View style={styles.messageContentContainer}>
                     {!isCurrentUser && senderName && senderName !== 'User' && ( <Text style={styles.senderName}>{senderName}</Text> )}
                    <View style={[ styles.messageBubble, isCurrentUser ? styles.messageBubbleSentText : styles.messageBubbleReceivedText ]}>
                         <Text style={[styles.messageText, isCurrentUser ? styles.messageTextSent : styles.messageTextReceived]}>{message.text}</Text>
                         <Text style={[styles.timeText, styles.timeTextInsideBubble, isCurrentUser ? styles.timeTextInsideSentBubble : styles.timeTextInsideReceivedBubble]}>
                            {formatTime(message.createdAt)}
                         </Text>
                    </View>
                </View>
            </View>
        );
    }

    return null; // Fallback
});


// --- GroupChatScreen Component ---
const GroupChatScreen: React.FC = () => {
    const route = useRoute<GroupChatScreenRouteProp>();
    const navigation = useNavigation<GroupChatScreenNavigationProp>();
    const { session } = useAuth();
    const currentUserId = session?.user?.id;
    const { groupId, sharedEventData: initialSharedEventData } = route.params;

    const [currentGroupName, setCurrentGroupName] = useState(route.params.groupName ?? 'Group Chat');
    const [currentGroupImage, setCurrentGroupImage] = useState(route.params.groupImage);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [sendError, setSendError] = useState<string | null>(null);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingName, setEditingName] = useState('');
    const [isUpdatingName, setIsUpdatingName] = useState(false);
    const flatListRef = useRef<SectionList<ChatMessage>>(null);
    const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
    const [canMembersAddOthers, setCanMembersAddOthers] = useState(false);
    const [canMembersEditInfo, setCanMembersEditInfo] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [imageViewerVisible, setImageViewerVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [sharedEventMessage, setSharedEventMessage] = useState<string | null>(null);

    // --- State for Event Detail Modal ---
    const [selectedEventDataForModal, setSelectedEventDataForModal] = useState<MappedEvent | null>(null);
    const [eventModalVisible, setEventModalVisible] = useState(false);
    const [loadingEventDetails, setLoadingEventDetails] = useState(false);
    // --- End State for Event Detail Modal ---

    // Memoized sections
    const sections = useMemo(() => { const groups: Record<string, ChatMessage[]> = {}; messages.forEach(msg => { const dateKey = msg.createdAt.toDateString(); if (!groups[dateKey]) groups[dateKey] = []; groups[dateKey].push(msg); }); const sortedKeys = Object.keys(groups).sort((a,b) => new Date(a).getTime() - new Date(b).getTime()); const today = new Date(); today.setHours(0,0,0,0); const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1); const oneWeekAgo = new Date(today); oneWeekAgo.setDate(today.getDate() - 7); return sortedKeys.map(dateKey => { const date = new Date(dateKey); date.setHours(0,0,0,0); let title = 'Older'; if (date.getTime() === today.getTime()) title = 'Today'; else if (date.getTime() === yesterday.getTime()) title = 'Yesterday'; else if (date > oneWeekAgo) title = date.toLocaleDateString(undefined, { weekday:'long' }); else title = date.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' }); return { title, data: groups[dateKey] }; }); }, [messages]);

    // Map DB Message to UI
    const mapDbMessageToChatMessage = useCallback((dbMessage: DbGroupMessage, profilesMap: Map<string, UserProfileInfo>): ChatMessage => { let senderName = 'User'; let senderAvatar: string | undefined = undefined; if (dbMessage.sender_id) { const pfc = userProfileCache[dbMessage.sender_id]; if (pfc) { senderName = pfc.name || 'User'; senderAvatar = pfc.avatar; } else { const pfm = profilesMap.get(dbMessage.sender_id); if (pfm) { senderName = `${pfm.first_name||''} ${pfm.last_name||''}`.trim()||'User'; senderAvatar = pfm.profile_picture||undefined; if (!dbMessage.is_system_message) userProfileCache[dbMessage.sender_id]={name: senderName, avatar: senderAvatar}; } } } if (currentUserId && !userProfileCache[currentUserId]) userProfileCache[currentUserId] = { name: 'You', avatar: undefined }; 
        
        let sharedEventInfo: ChatMessage['sharedEvent'] = null;
        const rawContent = dbMessage.content ?? '';
        let displayText = rawContent;

        if (rawContent.startsWith('SHARED_EVENT:')) {
            try {
                const parts = rawContent.split(':');
                if (parts.length >= 3) {
                    const eventId = parts[1];
                    const detailsString = parts.slice(2).join(':');

                    let eventName = detailsString;
                    let eventDate = 'N/A';
                    let eventVenue = 'N/A';

                    const onSeparator = ' on ';
                    const atSeparator = ' at ';

                    const atIndex = detailsString.lastIndexOf(atSeparator);
                    if (atIndex !== -1) {
                        eventVenue = detailsString.substring(atIndex + atSeparator.length);
                        eventName = detailsString.substring(0, atIndex); 
                    }

                    const onIndex = eventName.lastIndexOf(onSeparator);
                    if (onIndex !== -1) {
                        eventDate = eventName.substring(onIndex + onSeparator.length);
                        eventName = eventName.substring(0, onIndex);
                    }
                    
                    sharedEventInfo = {
                        eventId: eventId,
                        eventTitle: eventName.trim(),
                        eventDate: eventDate.trim(),
                        eventVenue: eventVenue.trim(),
                        eventImage: DEFAULT_EVENT_IMAGE_CHAT,
                    };
                    displayText = `Shared an event: ${sharedEventInfo.eventTitle}`; 
                } else {
                     console.warn("SHARED_EVENT string has too few parts:", rawContent);
                }
            } catch (e) {
                console.error("Failed to parse shared event content:", rawContent, e);
            }
        }
        
        return { 
            _id: dbMessage.id, 
            text: displayText, // Use potentially modified display text
            createdAt: new Date(dbMessage.created_at), 
            user: { _id: dbMessage.sender_id || 'system', name: dbMessage.sender_id === currentUserId ? 'You' : senderName, avatar: dbMessage.sender_id === currentUserId ? undefined : senderAvatar, }, 
            image: dbMessage.image_url, 
            isSystemMessage: dbMessage.is_system_message, 
            sharedEvent: sharedEventInfo // Attach parsed shared event data
        }; 
    }, [currentUserId]);

    // Fetch Initial Data
    const fetchInitialData = useCallback(async () => { if (!currentUserId || !groupId) { setLoadError("Auth/Group ID missing."); setLoading(false); return; } setLoading(true); setLoadError(null); setIsCurrentUserAdmin(false); setCanMembersAddOthers(false); setCanMembersEditInfo(false); try { const { data: groupInfoData, error: groupInfoError } = await supabase.rpc('get_group_info', { group_id_input: groupId }); if (groupInfoError) throw groupInfoError; if (!groupInfoData?.group_details || !groupInfoData?.participants) throw new Error("Incomplete group data."); const groupDetails = groupInfoData.group_details; const participantsRaw: { user_id: string, is_admin: boolean }[] = groupInfoData.participants; const currentUserParticipant = participantsRaw.find(p => p.user_id === currentUserId); setIsCurrentUserAdmin(currentUserParticipant?.is_admin ?? false); setCanMembersAddOthers(groupDetails.can_members_add_others ?? false); setCanMembersEditInfo(groupDetails.can_members_edit_info ?? false); setCurrentGroupName(groupDetails.group_name); setCurrentGroupImage(groupDetails.group_image ?? null); const { data: messagesData, error: messagesError } = await supabase.from('group_chat_messages').select('id, created_at, sender_id, group_id, content, image_url, is_system_message').eq('group_id', groupId).order('created_at', { ascending: true }); if (messagesError) throw messagesError; if (!messagesData || messagesData.length === 0) { setMessages([]); } else { const senderIds = Array.from(new Set(messagesData.filter(msg => !msg.is_system_message && msg.sender_id).map(msg => msg.sender_id))); const profilesMap = new Map<string, UserProfileInfo>(); if (senderIds.length > 0) { const idsToFetch = senderIds.filter(id => !userProfileCache[id]); if (idsToFetch.length > 0) { const { data: profilesData, error: profilesError } = await supabase.from('music_lover_profiles').select('user_id, first_name, last_name, profile_picture').in('user_id', idsToFetch); if (profilesError) { console.error("Err fetch profiles:", profilesError); } else if (profilesData) { profilesData.forEach((p: UserProfileInfo) => { profilesMap.set(p.user_id, p); const n = `${p.first_name||''} ${p.last_name||''}`.trim()||'User'; const a = p.profile_picture||undefined; userProfileCache[p.user_id] = { name: n, avatar: a }; }); } } senderIds.forEach(id => { if (userProfileCache[id] && !profilesMap.has(id)) { profilesMap.set(id, { user_id: id, first_name: userProfileCache[id].name?.split(' ')[0]||null, last_name: userProfileCache[id].name?.split(' ')[1]||null, profile_picture: userProfileCache[id].avatar||null }); } }); } if (currentUserId && !userProfileCache[currentUserId]) userProfileCache[currentUserId] = { name: 'You' }; const mappedMessages = messagesData.map(dbMsg => mapDbMessageToChatMessage(dbMsg as DbGroupMessage, profilesMap)); setMessages(mappedMessages); } } catch (err: any) { console.error("Error fetching initial data:", err); if (err.message?.includes("User is not a member")) { Alert.alert("Access Denied", "Not member.", [{ text: "OK", onPress: () => navigation.goBack() }]); setLoadError("Not a member."); } else { setLoadError(`Load fail: ${err.message || 'Unknown'}`); } setMessages([]); setIsCurrentUserAdmin(false); setCanMembersAddOthers(false); setCanMembersEditInfo(false); } finally { setLoading(false); } }, [currentUserId, groupId, navigation, mapDbMessageToChatMessage]);

    // Send Text Message
    const sendTextMessage = useCallback(async (text: string) => { 
        if (!currentUserId || !groupId || !text.trim() || isUploading) return; 
        
        const trimmedText = text.trim(); 
        const tempId = `temp_txt_${Date.now()}`; // Differentiate temp ID for text messages
        const currentUserProfile = userProfileCache[currentUserId] || { name: 'You' }; 
        const optimisticMessage: ChatMessage = { 
            _id: tempId, 
            text: trimmedText, 
            createdAt: new Date(), 
            user: { 
                _id: currentUserId, 
                name: currentUserProfile.name, 
                avatar: currentUserProfile.avatar 
            }, 
            image: null, 
            isSystemMessage: false 
        }; 
        
        setMessages(previousMessages => [...previousMessages, optimisticMessage]); 
        setInputText(''); 
        setSendError(null); 
        Keyboard.dismiss(); 
        
        try { 
            // Prepare the message data with metadata if needed
            let insertData: any = {
                sender_id: currentUserId, 
                group_id: groupId, 
                content: trimmedText, 
                image_url: null, 
                is_system_message: false
            };
            
            // If there's a shared event, add it as metadata
            if (sharedEventMessage) {
                insertData.metadata = { 
                    shared_event: JSON.parse(sharedEventMessage)
                };
                // Clear the shared event message state after sending
                setSharedEventMessage(null);
            }
            
            const { data: insertedData, error: insertError } = await supabase
                .from('group_chat_messages')
                .insert(insertData)
                .select('id, created_at') // Select all fields to ensure optimistic update can use them
                .single(); 
            
            if (insertError) throw insertError; 
            
            if (!insertedData) throw new Error("Text send no confirmation."); 
            
            setMessages(prevMessages => prevMessages.map(msg => 
                msg._id === tempId ? { 
                    ...optimisticMessage, 
                    _id: insertedData.id, 
                    createdAt: new Date(insertedData.created_at) 
                } : msg
            )); 
            
            if (sendError) setSendError(null); 
            
        } catch (err: any) { 
            console.error("Error sending text:", err); 
            setSendError(`Send fail: ${err.message}`); 
            setMessages(prevMessages => prevMessages.filter(msg => msg._id !== tempId)); 
            setInputText(trimmedText); 
        } 
    }, [currentUserId, groupId, sendError, isUploading]); // Removed sharedEventMessage from dependencies
    
    const shareEventToGroupViaRpc = useCallback(async (eventDataToShare: typeof initialSharedEventData) => {
        if (!currentUserId || !groupId || !eventDataToShare || isUploading) return;
        const { eventId } = eventDataToShare;

        setInputText(''); 
        setSharedEventMessage(null); // Clear composer state
        setSendError(null);
        Keyboard.dismiss();

        try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('share_event_to_group', {
                p_event_id: eventId,
                p_group_id: groupId
            });
            if (rpcError) throw rpcError;
            if (!rpcData || !rpcData.success) {
                throw new Error('Failed to share event to group via RPC or received invalid response.');
            }
            console.log('[GroupChatScreen] Event shared to group via RPC, message_id:', rpcData.message_id);
            // Real-time subscription will handle adding the new message to UI
        } catch (err: any) {
            console.error("Error sharing event to group:", err);
            setSendError(`Event share fail: ${err.message}`);
        }
    }, [currentUserId, groupId, isUploading]);

    const handleSendPress = () => { 
        if (sharedEventMessage && initialSharedEventData?.eventId) {
            shareEventToGroupViaRpc(initialSharedEventData);
        } else if (inputText.trim()) {
            sendTextMessage(inputText); 
        }
    };

    //Pick and Send Image
    const pickAndSendImage = async () => {
        if (!currentUserId || !groupId || isUploading) {
            console.log('[pickAndSendImage] Aborted: Missing userId/groupId or already uploading.');
            return;
        }

        console.log('[pickAndSendImage] Requesting media library permissions...');
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
            Alert.alert('Permission Required', 'Gallery access is needed to send images.');
            console.log('[pickAndSendImage] Permission denied.');
            return;
        }
        console.log('[pickAndSendImage] Permission granted.');

        let result: ImagePicker.ImagePickerResult;
        try {
            console.log('[pickAndSendImage] Launching image library...');
            result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
                allowsEditing: true,
                base64: Platform.OS === 'web', // Request base64 on web
            });
        } catch (pickerError: any) {
            console.error('[pickAndSendImage] ImagePicker launch failed:', pickerError);
            Alert.alert('Image Picker Error', `Failed to open gallery: ${pickerError.message}`);
            return;
        }

        if (result.canceled) {
            console.log('[pickAndSendImage] User cancelled image selection.');
            return;
        }

        if (!result.assets || result.assets.length === 0 || !result.assets[0].uri) {
            console.error('[pickAndSendImage] No valid asset/URI found in picker result:', result);
            Alert.alert('Error', 'Could not get the selected image. Please try again.');
            return;
        }

        const selectedAsset = result.assets[0];
        const imageUri = selectedAsset.uri;

        setIsUploading(true);
        setSendError(null);
        console.log(`[pickAndSendImage] Processing asset. URI: ${imageUri}`);

        let tempId: string | null = null;
        try {
            // Create a temporary message to show in the UI
            tempId = `temp_${Date.now()}_img`;
            const currentUserProfile = userProfileCache[currentUserId] || { name: 'You' };
            const optimisticMessage: ChatMessage = {
                _id: tempId,
                text: '',
                createdAt: new Date(),
                user: {
                    _id: currentUserId,
                    name: currentUserProfile.name,
                    avatar: currentUserProfile.avatar
                },
                image: imageUri,
                isSystemMessage: false
            };

            setMessages(prev => [...prev, optimisticMessage]);

            let fileData: string;
            if (Platform.OS === 'web') {
                // On web, we already have base64 data
                if (!selectedAsset.base64) {
                    throw new Error('No base64 data available for web upload');
                }
                fileData = selectedAsset.base64;
            } else {
                // On mobile, read the file using FileSystem
                const fileInfo = await FileSystem.getInfoAsync(imageUri);
                if (!fileInfo.exists) {
                    throw new Error('Selected file does not exist');
                }

                fileData = await FileSystem.readAsStringAsync(imageUri, {
                    encoding: FileSystem.EncodingType.Base64
                });
            }

            if (!fileData) {
                throw new Error('Failed to read file data');
            }

            const fileName = `${currentUserId}-${Date.now()}.jpg`;
            const filePath = `${groupId}/${currentUserId}/${fileName}`;

            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('group-chat-images')
                .upload(filePath, decode(fileData), {
                    contentType: 'image/jpeg',
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                console.error('[Supabase Upload Error]:', uploadError);
                throw new Error(`Upload failed: ${uploadError.message}`);
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('group-chat-images')
                .getPublicUrl(uploadData.path);

            if (!urlData?.publicUrl) {
                throw new Error('Failed to get public URL for uploaded image');
            }

            // Insert message record
            const { data: insertedData, error: insertError } = await supabase
                .from('group_chat_messages')
                .insert({
                    sender_id: currentUserId,
                    group_id: groupId,
                    content: null,
                    image_url: urlData.publicUrl,
                    is_system_message: false
                })
                .select('id, created_at')
                .single();

            if (insertError) {
                // Clean up storage if DB insert fails
                await supabase.storage.from('group-chat-images').remove([filePath]);
                throw insertError;
            }

            // Update the message with the final data
            setMessages(prev => prev.map(msg => 
                msg._id === tempId 
                    ? { 
                        ...optimisticMessage, 
                        _id: insertedData.id,
                        image: urlData.publicUrl,
                        createdAt: new Date(insertedData.created_at)
                    } 
                    : msg
            ));

        } catch (error: any) {
            console.error('[pickAndSendImage] Error:', error);
            setSendError(`Failed to send image: ${error.message}`);
            if (tempId) {
                setMessages(prev => prev.filter(msg => msg._id !== tempId));
            }
        } finally {
            setIsUploading(false);
        }
    };

    //real time subscriptions
    useEffect(() => { if (!groupId || !currentUserId) return; const messageChannel = supabase.channel(`group_chat_messages_${groupId}`).on<DbGroupMessage>( 'postgres_changes',{ event: 'INSERT', schema: 'public', table: 'group_chat_messages', filter: `group_id=eq.${groupId}` }, async (payload) => { const newMessageDb = payload.new; 
        
        const rtProfilesMap = new Map<string, UserProfileInfo>(); 
        if (newMessageDb.sender_id && !newMessageDb.is_system_message && !userProfileCache[newMessageDb.sender_id]) { 
            try { 
                const { data: p } = await supabase.from('music_lover_profiles').select('user_id, first_name, last_name, profile_picture').eq('user_id', newMessageDb.sender_id).maybeSingle(); 
                if (p) { 
                    rtProfilesMap.set(p.user_id, p); 
                    const n = `${p.first_name||''} ${p.last_name||''}`.trim()||'User'; 
                    const a = p.profile_picture||undefined; 
                    userProfileCache[p.user_id]={name:n,avatar:a}; 
                } 
            } catch (err) { 
                console.error(`RT Profile Fetch Err ${newMessageDb.sender_id}`, err); 
            } 
        } 
        const receivedMessage = mapDbMessageToChatMessage(newMessageDb, rtProfilesMap); 

        if (newMessageDb.sender_id === currentUserId) {
            // Message from the current user, likely an optimistic update confirmation
            setMessages(prevMessages =>
                prevMessages.map(msg => {
                    // If it's a text message confirmation
                    if (msg._id.startsWith('temp_txt_') && msg.text === receivedMessage.text && !msg.sharedEvent) {
                        return receivedMessage;
                    }
                    // If it's a shared event confirmation
                    if (msg._id.startsWith('temp_shared_') && msg.sharedEvent?.eventId === receivedMessage.sharedEvent?.eventId) {
                        return receivedMessage;
                    }
                    // If it's an image upload confirmation (this part was not explicitly requested to change but good to keep in mind)
                    // if (msg._id.startsWith('temp_img_') && msg.image === optimisticImageUriPlaceholder && receivedMessage.image) {
                    //    return receivedMessage;
                    // }
                    return msg;
                })
            );
        } else {
            // Message from another user, or a system message
            setMessages(prev => prev.some(msg => msg._id === receivedMessage._id) ? prev : [...prev, receivedMessage]); 
        }
       
    }).subscribe(); const infoChannel = supabase.channel(`group_info_${groupId}`).on<DbGroupChat>('postgres_changes',{ event: 'UPDATE', schema: 'public', table: 'group_chats', filter: `id=eq.${groupId}` },(payload) => { const d=payload.new; if(d.group_name!==currentGroupName){setCurrentGroupName(d.group_name);} if(d.group_image!==currentGroupImage){setCurrentGroupImage(d.group_image);} if(d.can_members_add_others!==undefined){setCanMembersAddOthers(d.can_members_add_others);} if(d.can_members_edit_info!==undefined){setCanMembersEditInfo(d.can_members_edit_info);} }).on<any>('postgres_changes',{ event: 'DELETE', schema: 'public', table: 'group_chats', filter: `id=eq.${groupId}` },(payload) => { Alert.alert("Group Deleted", "This group no longer exists.", [{ text: "OK", onPress: () => navigation.popToTop() }]); }).subscribe(); return () => { supabase.removeChannel(messageChannel); supabase.removeChannel(infoChannel); }; }, [groupId, currentUserId, mapDbMessageToChatMessage, navigation, currentGroupName, currentGroupImage, canMembersAddOthers, canMembersEditInfo]);

    // Navigation and Header
    const navigateToGroupInfo = () => { if (!groupId || !currentGroupName) return; navigation.navigate('GroupInfoScreen', { groupId, groupName: currentGroupName ?? 'Group', groupImage: currentGroupImage ?? null }); };
    useEffect(() => { const canAdd = isCurrentUserAdmin || canMembersAddOthers; const canEdit = isCurrentUserAdmin || canMembersEditInfo; const headerColor = APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'; const disabledColor = APP_CONSTANTS?.COLORS?.DISABLED || '#D1D5DB'; navigation.setOptions({ headerTitleAlign: 'center', headerTitle: () => ( <TouchableOpacity style={styles.headerTitleContainer} onPress={navigateToGroupInfo} activeOpacity={0.8}><Image source={{uri:currentGroupImage??DEFAULT_GROUP_PIC}} style={styles.headerGroupImage}/><Text style={styles.headerTitleText} numberOfLines={1}>{currentGroupName}</Text></TouchableOpacity>), headerRight: () => ( <View style={styles.headerButtons}><TouchableOpacity onPress={()=>{if(canAdd)navigation.navigate('AddGroupMembersScreen',{groupId,groupName:currentGroupName});else Alert.alert("Denied","Admin only");}} style={styles.headerButton} disabled={!canAdd}><Feather name="user-plus" size={22} color={canAdd?headerColor:disabledColor}/></TouchableOpacity><TouchableOpacity onPress={()=>{if(canEdit){setEditingName(currentGroupName??'');setIsEditModalVisible(true);}else Alert.alert("Denied","Admin only");}} style={styles.headerButton} disabled={!canEdit}><Feather name="edit-2" size={22} color={canEdit?headerColor:disabledColor}/></TouchableOpacity></View>), headerBackTitleVisible: false, headerShown: true }); }, [navigation, currentGroupName, currentGroupImage, groupId, isCurrentUserAdmin, canMembersAddOthers, canMembersEditInfo]);

    // Modal and Actions
    const handleUpdateName = async () => { const n=editingName.trim();if(!n||n===currentGroupName||isUpdatingName||!groupId){setIsEditModalVisible(false);return;}setIsUpdatingName(true); try{const{error}=await supabase.rpc('rename_group_chat',{group_id_input:groupId,new_group_name:n});if(error)throw error;setIsEditModalVisible(false);}catch(e:any){Alert.alert("Error",`Update fail: ${e.message}`);}finally{setIsUpdatingName(false);}};

    // Effects
    useFocusEffect( useCallback(() => { fetchInitialData(); return () => {}; }, [fetchInitialData]) );

    // Handle shared event data
    useEffect(() => {
        if (initialSharedEventData && initialSharedEventData.isSharing) {
            const { eventTitle, eventDate, eventVenue } = initialSharedEventData;
            setInputText(`Check out this event: ${eventTitle} on ${eventDate} at ${eventVenue}`);
            setSharedEventMessage(JSON.stringify(initialSharedEventData));
        }
    }, [initialSharedEventData]);

    const handleImagePress = (imageUri: string) => {
        // Find all image messages
        const imageMessages = messages.filter(msg => msg.image);
        const index = imageMessages.findIndex(msg => msg.image === imageUri);
        if (index !== -1) {
            setSelectedImageIndex(index);
            setSelectedImage(imageUri);
            setImageViewerVisible(true);
        }
    };

    // Add handler for image index change
    const handleImageIndexChange = (index: number) => {
        const imageMessages = messages.filter(msg => msg.image);
        const selectedImage = imageMessages[index]?.image;
        if (selectedImage) {
            setSelectedImageIndex(index);
            setSelectedImage(selectedImage);
        }
    };

    // Custom event share message component
    const renderEventSharePreview = () => {
        if (!sharedEventMessage || !initialSharedEventData) return null;
        
        return (
            <View style={styles.sharedEventContainer}>
                <View style={styles.sharedEventContent}>
                    <Image 
                        source={{ uri: initialSharedEventData.eventImage || DEFAULT_EVENT_IMAGE_CHAT }} 
                        style={styles.sharedEventImage} 
                        resizeMode="cover"
                    />
                    <View style={styles.sharedEventInfo}>
                        <Text style={styles.sharedEventTitle} numberOfLines={1}>
                            {initialSharedEventData.eventTitle}
                        </Text>
                        <Text style={styles.sharedEventDetails} numberOfLines={1}>
                            {initialSharedEventData.eventDate}
                        </Text>
                        <Text style={styles.sharedEventDetails} numberOfLines={1}>
                            {initialSharedEventData.eventVenue}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity 
                    style={styles.sharedEventCloseButton}
                    onPress={() => {
                        setSharedEventMessage(null);
                        // Keep text if user has modified it
                        if (inputText === `Check out this event: ${initialSharedEventData.eventTitle} on ${initialSharedEventData.eventDate} at ${initialSharedEventData.eventVenue}`) {
                            setInputText('');
                        }
                    }}
                >
                    <Feather name="x" size={18} color="#9CA3AF" />
                </TouchableOpacity>
            </View>
        );
    };

    // --- Fetch and Prepare Event for Modal ---
    const fetchAndPrepareEventForModal = useCallback(async (eventId: string) => {
        if (!eventId) return;
        setLoadingEventDetails(true);
        try {
            const { data: eventData, error: eventError } = await supabase
                .from('events') // Ensure this table name is correct
                .select('id, title, description, event_datetime, location_text, poster_urls, tags_genres, tags_artists, tags_songs, organizer_id, event_type, booking_type, ticket_price, pass_fee_to_user, max_tickets, max_reservations, country, city')
                .eq('id', eventId)
                .single();
            if (eventError || !eventData) { 
                throw eventError || new Error('Event not found in group chat fetch'); 
            }

            let organizerDetails: OrganizerInfo = { 
                userId: eventData.organizer_id || '-', 
                name: DEFAULT_ORGANIZER_NAME_CHAT, 
                image: DEFAULT_ORGANIZER_LOGO_CHAT 
            };
            
            if (eventData.organizer_id) {
                try {
                    const { data: orgData } = await supabase
                        .from('organizer_profiles')
                        .select('user_id, company_name, logo')
                        .eq('user_id', eventData.organizer_id)
                        .single();
                    
                    if (orgData) { 
                        organizerDetails = { 
                            userId: orgData.user_id, 
                            name: orgData.company_name || DEFAULT_ORGANIZER_NAME_CHAT, 
                            image: orgData.logo || DEFAULT_ORGANIZER_LOGO_CHAT 
                        }; 
                    }
                } catch (orgError) {
                    console.warn("Could not fetch organizer details:", orgError);
                    // Continue with default organizer details
                }
            }
            
            const { date, time } = formatEventDateTimeForModal(eventData.event_datetime);
            const mappedEventData: MappedEvent = {
                id: eventData.id, 
                title: eventData.title, 
                images: eventData.poster_urls?.length ? eventData.poster_urls : [DEFAULT_EVENT_IMAGE_CHAT],
                date, 
                time, 
                venue: eventData.location_text ?? 'N/A', 
                country: eventData.country, 
                city: eventData.city,
                genres: eventData.tags_genres ?? [], 
                artists: eventData.tags_artists ?? [], 
                songs: eventData.tags_songs ?? [],
                description: eventData.description ?? 'No description.', 
                booking_type: eventData.booking_type as any, 
                ticket_price: eventData.ticket_price,
                pass_fee_to_user: eventData.pass_fee_to_user ?? true, 
                max_tickets: eventData.max_tickets, 
                max_reservations: eventData.max_reservations,
                organizer: organizerDetails, 
                isViewable: false, 
                event_datetime_iso: eventData.event_datetime,
            };
            setSelectedEventDataForModal(mappedEventData);
            setEventModalVisible(true);
        } catch (err: any) { 
            console.error("[GroupChatScreen] Error fetching event for modal:", err);
            Alert.alert(
                "Event Details Unavailable", 
                "Could not load event details. The event may have been removed or you may not have permission to view it.",
                [{ text: "OK" }]
            ); 
            setSelectedEventDataForModal(null); 
            setEventModalVisible(false);
        } finally { 
            setLoadingEventDetails(false); 
        }
    }, [supabase]); // Add supabase

    // --- Modified handler for event press from message bubble ---
    const handleEventPressFromBubble = useCallback((eventId: string) => {
        fetchAndPrepareEventForModal(eventId);
    }, [fetchAndPrepareEventForModal]);

    // --- Render Logic ---
    if (loading && messages.length === 0) { return <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} /></View>; }
    if (loadError && messages.length === 0) { const displayError = loadError.includes('permission') || loadError.includes('session') ? "Permission/session issue." : loadError; return <View style={styles.centered}><Text style={styles.errorText}>{displayError}</Text></View>; }
    if (!currentUserId || !groupId) { return <View style={styles.centered}><Text style={styles.errorText}>Missing User/Group Info.</Text></View>; }

    const safeAreaEdges: Edge[] = Platform.OS === 'ios' ? ['bottom'] : [];

    return (
        <SafeAreaView style={styles.safeArea} edges={safeAreaEdges}>
            <KeyboardAvoidingView style={styles.keyboardAvoidingContainer} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0} >
                {sendError && ( <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{sendError}</Text><TouchableOpacity onPress={() => setSendError(null)} style={styles.errorBannerClose}><Feather name="x" size={16} color="#B91C1C" /></TouchableOpacity></View> )}

                <SectionList
                    ref={flatListRef}
                    sections={sections}
                    style={styles.messageList}
                    contentContainerStyle={styles.messageListContent}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <GroupMessageBubble
                            message={item}
                            currentUserId={currentUserId}
                            onImagePress={handleImagePress}
                            onEventPress={handleEventPressFromBubble}
                        />
                    )}
                    renderSectionHeader={({ section: { title } }) => (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionHeaderText}>{title}</Text>
                        </View>
                    )}
                    onContentSizeChange={() => {
                        if (flatListRef.current && sections.length > 0 && messages.length > 0) {
                            // Use timeout to scroll after render is complete
                            setTimeout(() => {
                                if (flatListRef.current) {
                                    const sectionListRef = flatListRef.current as any;
                                    sectionListRef._wrapperListRef._listRef.scrollToEnd({ animated: false });
                                }
                            }, 50);
                        }
                    }}
                    onLayout={() => {
                        if (flatListRef.current && sections.length > 0 && messages.length > 0) {
                            // Use timeout to scroll after render is complete
                            setTimeout(() => {
                                if (flatListRef.current) {
                                    const sectionListRef = flatListRef.current as any;
                                    sectionListRef._wrapperListRef._listRef.scrollToEnd({ animated: false });
                                }
                            }, 50);
                        }
                    }}
                    onScrollToIndexFailed={(info) => {
                        console.warn('Failed to scroll to index:', info);
                        // Use timeout to scroll after render is complete
                        setTimeout(() => {
                            if (flatListRef.current) {
                                const sectionListRef = flatListRef.current as any;
                                sectionListRef._wrapperListRef._listRef.scrollToEnd({ animated: false });
                            }
                        }, 100);
                    }}
                    stickySectionHeadersEnabled
                />

                {/* Shared Event Preview */}
                {renderEventSharePreview()}

                {/* Input Toolbar */}
                <View style={styles.inputToolbar}>
                    <TouchableOpacity style={styles.attachButton} onPress={pickAndSendImage} disabled={isUploading} >
                         {isUploading ? <ActivityIndicator size="small" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} /> : <Feather name="paperclip" size={22} color="#52525b" /> }
                    </TouchableOpacity>
                    <TextInput style={styles.textInput} value={inputText} onChangeText={setInputText} placeholder="Type a message..." placeholderTextColor="#9CA3AF" multiline />
                    <TouchableOpacity 
                        style={[styles.sendButton, ((!inputText.trim() && !sharedEventMessage) || isUploading) && styles.sendButtonDisabled]}
                        onPress={handleSendPress} 
                        disabled={(!inputText.trim() && !sharedEventMessage) || isUploading}
                    >
                        <Feather name="send" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Edit Group Name Modal */}
             <Modal visible={isEditModalVisible} transparent={true} animationType="fade" onRequestClose={() => setIsEditModalVisible(false)}>
                 <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setIsEditModalVisible(false)} />
                 <View style={styles.modalContent}><Text style={styles.modalTitle}>Edit Group Name</Text><TextInput style={styles.modalInput} value={editingName} onChangeText={setEditingName} placeholder="Enter new group name" maxLength={50} autoFocus={true} returnKeyType="done" onSubmitEditing={handleUpdateName} /><View style={styles.modalActions}><TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => setIsEditModalVisible(false)} disabled={isUpdatingName}><Text style={styles.modalButtonTextCancel}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[ styles.modalButton, styles.modalButtonSave, (isUpdatingName || !editingName.trim() || editingName.trim() === currentGroupName) && styles.modalButtonDisabled ]} onPress={handleUpdateName} disabled={isUpdatingName || !editingName.trim() || editingName.trim() === currentGroupName}>{isUpdatingName ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.modalButtonTextSave}>Save</Text>}</TouchableOpacity></View></View>
             </Modal>

            {/* Image Viewer */}
            {imageViewerVisible && selectedImage && (
                <ImageViewer
                    imageUrls={messages.filter(msg => msg.image).map(msg => ({ url: msg.image! }))}
                    index={selectedImageIndex}
                    onClick={() => setImageViewerVisible(false)}
                    onSwipeDown={() => setImageViewerVisible(false)}
                    enableSwipeDown={true}
                    enableImageZoom={true}
                    onChange={(index) => {
                        if (typeof index === 'number') {
                            setSelectedImageIndex(index);
                        }
                    }}
                />
            )}

            {/* --- Event Detail Modal --- */}
            {selectedEventDataForModal && (
                <EventDetailModal
                    event={selectedEventDataForModal}
                    visible={eventModalVisible}
                    onClose={() => {
                        setEventModalVisible(false);
                        setSelectedEventDataForModal(null);
                    }}
                    navigation={navigation as any} // Cast if necessary
                />
            )}
            {/* Loading indicator for event details */}
            {loadingEventDetails && (
                <Modal transparent={true} visible={true} onRequestClose={() => {}}>
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} />
                        <Text style={styles.loadingOverlayText}>Loading Event...</Text>
                    </View>
                </Modal>
            )}
        </SafeAreaView>
    );
};


// --- Styles ---
const styles = StyleSheet.create({
    // Base container styles
    safeArea: { flex: 1, backgroundColor: '#FFFFFF', },
    keyboardAvoidingContainer: { flex: 1, },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F9FAFB', },
    centeredEmptyList: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50, minHeight: 200, },
    
    // Error and banner styles
    errorText: { color: '#DC2626', fontSize: 16, textAlign: 'center', },
    errorBanner: { backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingVertical: 8, paddingHorizontal: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(239, 68, 68, 0.2)', },
    errorBannerText: { color: '#B91C1C', fontSize: 13, flexShrink: 1, marginRight: 10, },
    errorBannerClose: { padding: 4, },
    noMessagesText: { color: '#6B7280', fontSize: 14, textAlign: 'center', },
    
    // Message list and containers
    messageList: { flex: 1, paddingHorizontal: 10, backgroundColor: '#F9FAFB', },
    messageListContent: { paddingVertical: 10, flexGrow: 1, justifyContent: 'flex-end', },
    messageRow: { flexDirection: 'row', marginVertical: 4, alignItems: 'flex-end', },
    messageRowSent: { justifyContent: 'flex-end', marginLeft: '20%', },
    messageRowReceived: { justifyContent: 'flex-start', marginRight: '20%', },
    messageContentContainer: { maxWidth: '100%', },
    
    // Message bubbles
    messageBubble: { borderRadius: 18, minWidth: 30, marginBottom: 2, },
    messageBubbleSentText: { backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', borderBottomRightRadius: 4, alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'flex-end', flexWrap:'wrap', },
    messageBubbleReceivedText: { backgroundColor: '#E5E7EB', borderBottomLeftRadius: 4, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'flex-end', flexWrap:'wrap', },
    
    // Image messages
    imageBubble: { borderRadius: 15, overflow: 'hidden', padding: 0, backgroundColor: '#E5E7EB', alignSelf: 'flex-start', maxWidth: 210, maxHeight: 210, borderWidth: 1, borderColor: '#d1d5db', },
    messageBubbleSentImage: { alignSelf: 'flex-end', backgroundColor: 'transparent', borderBottomRightRadius: 4, },
    messageBubbleReceivedImage: { alignSelf: 'flex-start', backgroundColor: 'transparent', borderBottomLeftRadius: 4, },
    chatImage: { width: 200, height: 200, borderRadius: 14, },
    
    // Text styles
    messageText: { fontSize: 15, lineHeight: 21, flexShrink: 1, },
    messageTextSent: { color: '#FFFFFF', },
    messageTextReceived: { color: '#1F2937', },
    senderName: { fontSize: 11, color: '#6B7280', marginBottom: 3, marginLeft: 5, alignSelf: 'flex-start', },
    
    // System messages
    systemMessageContainer: { alignSelf: 'center', backgroundColor: 'rgba(107, 114, 128, 0.1)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginVertical: 8, maxWidth: '80%', },
    systemMessageText: { fontSize: 11, color: '#4B5563', textAlign: 'center', fontStyle: 'italic', },
    
    // Time indicators
    timeText: { fontSize: 10, },
    timeTextInsideBubble: { marginLeft: 8, alignSelf: 'flex-end', lineHeight: 15, },
    timeTextInsideSentBubble: { color: 'rgba(255, 255, 255, 0.7)' },
    timeTextInsideReceivedBubble: { color: '#6B7280'},
    timeTextBelowBubble: { marginTop: 2, paddingHorizontal: 5, color: '#9CA3AF', },
    timeTextSent: { alignSelf: 'flex-end', marginRight: 5 },
    timeTextReceived: { alignSelf: 'flex-start', marginLeft: 0 },
    
    // Section headers
    sectionHeader: {
        alignSelf: 'center',
        marginVertical: 10,
        backgroundColor: '#FFFFFF',
    },
    sectionHeaderText: { fontSize: 11, fontWeight: '500', color: '#6B7280', backgroundColor: 'rgba(229, 231, 235, 0.7)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden'},
    
    // Input area
    inputToolbar: { flexDirection: 'row', alignItems: 'flex-end', paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF', paddingBottom: Platform.OS === 'ios' ? 5 : 8, },
    attachButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 5, marginBottom: Platform.OS === 'ios' ? 0 : 1, },
    textInput: { flex: 1, minHeight: 40, maxHeight: 120, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 15, marginRight: 10, color: '#1F2937', textAlignVertical: 'center', },
    sendButton: { backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: Platform.OS === 'ios' ? 0 : 1, },
    sendButtonDisabled: { backgroundColor: '#9CA3AF', },
    
    // Header
    headerTitleContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: Platform.OS === 'ios' ? -10 : 0, },
    headerGroupImage: { width: 32, height: 32, borderRadius: 16, marginRight: 8, backgroundColor: '#E5E7EB', },
    headerTitleText: { fontSize: 17, fontWeight: '600', color: '#1F2937', },
    headerButtons: { flexDirection: 'row', marginRight: Platform.OS === 'ios' ? 5 : 10, },
    headerButton: { paddingHorizontal: 6, paddingVertical: 5, },
    
    // Edit modal
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', },
    modalContent: { position: 'absolute', top: '30%', left: '10%', right: '10%', backgroundColor: 'white', borderRadius: 12, padding: 25, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, width: '80%', minHeight: 200, },
    modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 20, textAlign: 'center', color: '#1F2937', },
    modalInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, marginBottom: 25, },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', },
    modalButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center', minWidth: 90, },
    modalButtonCancel: { backgroundColor: '#E5E7EB', },
    modalButtonSave: { backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', },
    modalButtonDisabled: { backgroundColor: '#A5B4FC', },
    modalButtonTextCancel: { color: '#4B5563', fontWeight: '500', },
    modalButtonTextSave: { color: 'white', fontWeight: '600', },
    
    // Image viewer
    imageViewerContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageViewerCloseButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 20,
        right: 20,
        zIndex: 1,
        padding: 10,
    },
    fullScreenImage: {
        width: '100%',
        height: '100%',
    },
    imageViewerControls: {
        position: 'absolute',
        bottom: 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 20,
    },
    imageViewerButton: {
        padding: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 25,
    },
    imageViewerButtonDisabled: {
        opacity: 0.5,
    },
    
    // Event sharing composer
    sharedEventContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
    },
    sharedEventContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    sharedEventImage: {
        width: 40,
        height: 40,
        borderRadius: 8,
        marginRight: 10,
    },
    sharedEventInfo: {
        flex: 1,
    },
    sharedEventTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
    },
    sharedEventDetails: {
        fontSize: 12,
        color: '#6B7280',
    },
    sharedEventCloseButton: {
        padding: 5,
    },
    
    // Enhanced shared event styles
    sharedEventMessageBubble: {
        padding: 12,
        maxWidth: 280,
    },
    sharedEventPreview: {
        marginTop: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    sharedEventPreviewImage: {
        width: '100%', 
        height: 130,
        backgroundColor: '#F3F4F6',
    },
    sharedEventPreviewContent: {
        padding: 10,
    },
    sharedEventPreviewTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 4,
    },
    sharedEventPreviewDetails: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 2,
    },
    
    // Error states
    imageErrorOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageErrorText: {
        color: '#FFFFFF',
        fontSize: 12,
        marginTop: 4,
    },
    
    // Loading overlay
    loadingOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    loadingOverlayText: {
        marginTop: 10,
        color: 'white',
        fontSize: 16,
    },
});



export default GroupChatScreen;