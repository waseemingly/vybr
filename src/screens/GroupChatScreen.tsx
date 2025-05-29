import React, { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import {
    View, StyleSheet, ActivityIndicator, Text, TouchableOpacity,
    Platform, TextInput, SectionList, KeyboardAvoidingView, Keyboard,
    Modal, Alert, Image, ScrollView, Dimensions,
    RefreshControl, FlatList, StatusBar // Add FlatList and StatusBar
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
interface DbGroupMessage { 
    id: string; 
    created_at: string; 
    sender_id: string; 
    group_id: string; 
    content: string | null; 
    image_url: string | null; 
    is_system_message: boolean; 
    original_content?: string | null;
    is_edited?: boolean;
    edited_at?: string | null;
    is_deleted?: boolean;
    deleted_at?: string | null;
    reply_to_message_id?: string | null;
}
interface ChatMessage { 
    _id: string; 
    text: string; 
    createdAt: Date; 
    user: { _id: string; name?: string; avatar?: string; }; 
    image?: string | null; 
    isSystemMessage: boolean;
    sharedEvent?: {
        eventId: string;
        eventTitle: string;
        eventDate: string;
        eventVenue: string;
        eventImage: string;
    } | null;
    originalContent?: string | null;
    isEdited?: boolean;
    editedAt?: Date | null;
    isDeleted?: boolean;
    deletedAt?: Date | null;
    replyToMessageId?: string | null;
    replyToMessagePreview?: {
        text?: string | null;
        senderName?: string | null;
        image?: string | null;
    } | null;
}
interface UserProfileInfo { user_id: string; first_name: string | null; last_name: string | null; profile_picture: string | null; }
interface DbGroupChat { id: string; group_name: string; group_image: string | null; can_members_add_others?: boolean; can_members_edit_info?: boolean; }

// --- Constants and Cache ---
const userProfileCache: Record<string, { name?: string; avatar?: string }> = {};
const DEFAULT_PROFILE_PIC = APP_CONSTANTS?.DEFAULT_PROFILE_PIC || 'https://placehold.co/40x40/E0E0E0/757575?text=U'; // Changed to placehold.co
const DEFAULT_GROUP_PIC = 'https://placehold.co/40x40/e2e8f0/64748b?text=G';
const DEFAULT_EVENT_IMAGE_CHAT = "https://placehold.co/800x450/D1D5DB/1F2937?text=Event"; // Changed to placehold.co
const DEFAULT_ORGANIZER_LOGO_CHAT = "https://placehold.co/150/BFDBFE/1E40AF?text=Logo"; // Changed to placehold.co
const DEFAULT_ORGANIZER_NAME_CHAT = "Event Organizer";

// --- GroupMessageBubble Component ---
interface GroupMessageBubbleProps { 
    message: ChatMessage; 
    currentUserId: string | undefined;
    onImagePress: (imageUri: string) => void;
    onEventPress?: (eventId: string) => void;
    onMessageLongPress: (message: ChatMessage) => void;
    getRepliedMessagePreview: (messageId: string) => ChatMessage['replyToMessagePreview'] | null;
}
const GroupMessageBubble: React.FC<GroupMessageBubbleProps> = React.memo(({ 
    message, 
    currentUserId, 
    onImagePress, 
    onEventPress, 
    onMessageLongPress,
    getRepliedMessagePreview
}) => {
    const isCurrentUser = message.user._id === currentUserId;
    const senderName = message.user.name;
    const [imageError, setImageError] = useState(false);
    const [hasLoggedImpression, setHasLoggedImpression] = useState(false);

    // Log impression for shared events when message bubble comes into view
    useEffect(() => {
        if (message.sharedEvent?.eventId && !hasLoggedImpression) {
            const logEventImpression = async () => {
                try {
                    console.log(`[IMPRESSION] Logging impression for shared event: ${message.sharedEvent?.eventId} from group chat`);
                    const { error } = await supabase.from('event_impressions').insert({
                        event_id: message.sharedEvent?.eventId,
                        user_id: currentUserId || null,
                        source: 'group_chat',
                        viewed_at: new Date().toISOString()
                    });
                    
                    if (error) {
                        console.warn(`[IMPRESSION] Failed for shared event ${message.sharedEvent?.eventId}:`, error.message);
                    } else {
                        console.log(`[IMPRESSION] Successfully logged for shared event ${message.sharedEvent?.eventId} by user ${currentUserId || 'anonymous'}`);
                        setHasLoggedImpression(true);
                    }
                } catch (err) {
                    console.error("[IMPRESSION] Failed to log impression:", err);
                }
            };
            
            logEventImpression();
        }
    }, [message.sharedEvent?.eventId, currentUserId, hasLoggedImpression]);

    // Handle event press 
    const handleEventPress = () => {
        if (message.sharedEvent?.eventId && onEventPress) {
            onEventPress(message.sharedEvent.eventId);
        }
    };

    // System Message
    if (message.isSystemMessage) {
        return ( <View style={styles.systemMessageContainer}><Text style={styles.systemMessageText}>{message.text}</Text></View> );
    }

    // Deleted Message
    if (message.isDeleted) {
        return (
            <View style={[styles.messageRow, isCurrentUser ? styles.messageRowSent : styles.messageRowReceived]}>
                 <View style={styles.messageContentContainer}>
                    {!isCurrentUser && senderName && senderName !== 'User' && (
                        <Text style={styles.senderName}>{senderName}</Text>
                    )}
                    <View style={[styles.messageBubble, styles.deletedMessageBubble, isCurrentUser ? styles.messageBubbleSentText : styles.messageBubbleReceivedText]}>
                        <Feather name="slash" size={14} color={isCurrentUser ? "rgba(255,255,255,0.7)" : "#9CA3AF"} style={{marginRight: 5}}/>
                        <Text style={[styles.deletedMessageText, isCurrentUser ? styles.messageTextSent : styles.messageTextReceived]}>
                            This message was deleted
                        </Text>
                    </View>
                    <Text style={[styles.timeText, styles.timeTextBelowBubble, isCurrentUser ? styles.timeTextSent : styles.timeTextReceived]}>
                        {formatTime(message.createdAt)}
                    </Text>
                </View>
            </View>
        );
    }

    const repliedMessagePreview = message.replyToMessageId ? getRepliedMessagePreview(message.replyToMessageId) : null;

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
                        {message.isEdited && <Text style={[styles.editedIndicator, isCurrentUser ? styles.editedIndicatorSent : styles.editedIndicatorReceived]}>(edited)</Text>}
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
            <TouchableOpacity 
                style={[styles.messageRowTouchable, isCurrentUser ? styles.messageRowSent : styles.messageRowReceived]} 
                onLongPress={() => onMessageLongPress(message)}
                delayLongPress={200}
                activeOpacity={0.8}
            >
                <View style={styles.messageContentContainer}>
                    {!isCurrentUser && senderName && senderName !== 'User' && ( <Text style={styles.senderName}>{senderName}</Text> )}
                    
                    {/* Reply Preview for Image */} 
                    {repliedMessagePreview && (
                        <View style={[styles.replyPreviewContainer, isCurrentUser ? styles.replyPreviewSent : styles.replyPreviewReceived]}>
                            <View style={styles.replyPreviewBorder} />
                            <View style={styles.replyPreviewContent}>
                                <Text style={styles.replyPreviewSenderName}>{repliedMessagePreview.senderName || 'User'}</Text>
                                {repliedMessagePreview.image ? (
                                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                        <Feather name="image" size={12} color="#6B7280" style={{marginRight: 4}}/>
                                        <Text style={styles.replyPreviewText}>Image</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.replyPreviewText} numberOfLines={1}>{repliedMessagePreview.text}</Text>
                                )}
                            </View>
                        </View>
                    )}

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
                        {message.isEdited && <Text style={[styles.editedIndicator, isCurrentUser ? styles.editedIndicatorSent : styles.editedIndicatorReceived]}>(edited)</Text>}
                    </TouchableOpacity>
                    <Text style={[styles.timeText, styles.timeTextBelowBubble, isCurrentUser ? styles.timeTextSent : styles.timeTextReceived]}>
                        {formatTime(message.createdAt)}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }

    // Text Message
    if (message.text) {
        return (
            <TouchableOpacity 
                style={[styles.messageRowTouchable, isCurrentUser ? styles.messageRowSent : styles.messageRowReceived]} 
                onLongPress={() => onMessageLongPress(message)}
                delayLongPress={200}
                activeOpacity={0.8}
            >
                <View style={styles.messageContentContainer}>
                     {!isCurrentUser && senderName && senderName !== 'User' && ( <Text style={styles.senderName}>{senderName}</Text> )}
                    
                    {/* Reply Preview for Text */} 
                    {repliedMessagePreview && (
                        <View style={[styles.replyPreviewContainer, isCurrentUser ? styles.replyPreviewSent : styles.replyPreviewReceived]}>
                            <View style={styles.replyPreviewBorder} />
                            <View style={styles.replyPreviewContent}>
                                <Text style={styles.replyPreviewSenderName}>{repliedMessagePreview.senderName || 'User'}</Text>
                                {repliedMessagePreview.image ? (
                                     <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                        <Feather name="image" size={12} color="#6B7280" style={{marginRight: 4}}/>
                                        <Text style={styles.replyPreviewText} numberOfLines={1}>{repliedMessagePreview.text}</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.replyPreviewText} numberOfLines={1}>{repliedMessagePreview.text}</Text>
                                )}
                            </View>
                        </View>
                    )}

                    <View style={[ styles.messageBubble, isCurrentUser ? styles.messageBubbleSentText : styles.messageBubbleReceivedText ]}>
                         <Text style={[styles.messageText, isCurrentUser ? styles.messageTextSent : styles.messageTextReceived]}>{message.text}</Text>
                         <View style={styles.timeAndEditContainer}>
                            {message.isEdited && <Text style={[styles.editedIndicator, isCurrentUser ? styles.editedIndicatorSent : styles.editedIndicatorReceived]}>(edited)</Text>}
                            <Text style={[styles.timeText, styles.timeTextInsideBubble, isCurrentUser ? styles.timeTextInsideSentBubble : styles.timeTextInsideReceivedBubble]}>
                                {formatTime(message.createdAt)}
                            </Text>
                         </View>
                    </View>
                </View>
            </TouchableOpacity>
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

    // --- State for New Chat Features ---
    const [selectedMessageForAction, setSelectedMessageForAction] = useState<ChatMessage | null>(null);
    const [messageActionModalVisible, setMessageActionModalVisible] = useState(false);
    const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
    const [editText, setEditText] = useState("");
    const [replyingToMessage, setReplyingToMessage] = useState<ChatMessage | null>(null);
    const [messageInfoVisible, setMessageInfoVisible] = useState(false);
    const [messageInfoData, setMessageInfoData] = useState<any>(null);
    const [loadingMessageInfo, setLoadingMessageInfo] = useState(false);
    // --- End State for New Chat Features ---

    // --- State for Event Detail Modal ---
    const [selectedEventDataForModal, setSelectedEventDataForModal] = useState<MappedEvent | null>(null);
    const [eventModalVisible, setEventModalVisible] = useState(false);
    const [loadingEventDetails, setLoadingEventDetails] = useState(false);
    // --- End State for Event Detail Modal ---

    // --- Event Press Handler (similar to IndividualChatScreen) ---
    const handleEventPressInternal = async (eventId: string) => {
        if (!eventId) return;
        console.log("[GroupChatScreen] Event preview pressed, Event ID:", eventId);
        setLoadingEventDetails(true);
        setSelectedEventDataForModal(null); 
        try {
            const { data: eventData, error: eventError } = await supabase
                .from('events_public_data') // Ensure this table name is correct
                .select(`
                    event_id,
                    event_name,
                    event_date,
                    venue_name,
                    event_poster_url,
                    MusicLoverProfile:event_organizer_id ( user_id, first_name, last_name, profile_picture ),
                    event_description,
                    ticket_link,
                    genre_tags,
                    mood_tags,
                    artist_lineup_names
                `)
                .eq('event_id', eventId)
                .single();

            if (eventError) throw eventError;
            if (!eventData) throw new Error("Event not found");
            
            const organizerProfileSource = eventData.MusicLoverProfile as any; // Cast for raw property access
            const mappedEvent: MappedEvent = {
                id: eventData.event_id,
                title: eventData.event_name || "Event Title",
                date: formatEventDateTimeForModal(eventData.event_date).date, // Correctly map date part
                time: formatEventDateTimeForModal(eventData.event_date).time, // Add time part
                venue: eventData.venue_name || "Venue N/A",
                images: eventData.event_poster_url ? [eventData.event_poster_url] : [DEFAULT_EVENT_IMAGE_CHAT],
                organizer: {
                    userId: organizerProfileSource?.user_id || "N/A",
                    name: `${organizerProfileSource?.first_name || ''} ${organizerProfileSource?.last_name || ''}`.trim() || DEFAULT_ORGANIZER_NAME_CHAT,
                    image: organizerProfileSource?.profile_picture || DEFAULT_ORGANIZER_LOGO_CHAT,
                },
                description: eventData.event_description || "No description available.",
                // --- Fields that ARE in MappedEvent from EventsScreen --- 
                event_datetime_iso: eventData.event_date || new Date().toISOString(), // Make sure to pass this
                // For simplicity, assuming these are not strictly needed for chat preview, 
                // but if they are, they should be mapped from eventData.genre_tags etc.
                genres: eventData.genre_tags || [],
                artists: eventData.artist_lineup_names || [],
                songs: [], // Assuming songs are not part of events_public_data, adjust if they are
                booking_type: null, // Add default or map if available in eventData
                ticket_price: null, // Add default or map if available in eventData
                pass_fee_to_user: false, // Add default or map if available in eventData
                max_tickets: null, // Add default or map if available in eventData
                max_reservations: null, // Add default or map if available in eventData
                // country and city are optional in MappedEvent, can be added if available in eventData
            };
            setSelectedEventDataForModal(mappedEvent);
            setEventModalVisible(true);
        } catch (err: any) {
            console.error("Error fetching event details for group chat:", err);
            Alert.alert("Error", "Could not load event details.");
        } finally {
            setLoadingEventDetails(false);
        }
    };
    // --- End Event Press Handler ---

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
            sharedEvent: sharedEventInfo, // Attach parsed shared event data
            originalContent: dbMessage.original_content,
            isEdited: dbMessage.is_edited,
            editedAt: dbMessage.edited_at ? new Date(dbMessage.edited_at) : null,
            isDeleted: dbMessage.is_deleted,
            deletedAt: dbMessage.deleted_at ? new Date(dbMessage.deleted_at) : null,
            replyToMessageId: dbMessage.reply_to_message_id,
        }; 
    }, [currentUserId]);

    // Fetch Initial Data
    const fetchInitialData = useCallback(async () => { if (!currentUserId || !groupId) { setLoadError("Auth/Group ID missing."); setLoading(false); return; } setLoading(true); setLoadError(null); setIsCurrentUserAdmin(false); setCanMembersAddOthers(false); setCanMembersEditInfo(false); try { const { data: groupInfoData, error: groupInfoError } = await supabase.rpc('get_group_info', { group_id_input: groupId }); if (groupInfoError) throw groupInfoError; if (!groupInfoData?.group_details || !groupInfoData?.participants) throw new Error("Incomplete group data."); const groupDetails = groupInfoData.group_details; const participantsRaw: { user_id: string, is_admin: boolean }[] = groupInfoData.participants; const currentUserParticipant = participantsRaw.find(p => p.user_id === currentUserId); setIsCurrentUserAdmin(currentUserParticipant?.is_admin ?? false); setCanMembersAddOthers(groupDetails.can_members_add_others ?? false); setCanMembersEditInfo(groupDetails.can_members_edit_info ?? false); setCurrentGroupName(groupDetails.group_name); setCurrentGroupImage(groupDetails.group_image ?? null); const { data: messagesData, error: messagesError } = await supabase.from('group_chat_messages').select('id, created_at, sender_id, group_id, content, image_url, is_system_message, original_content, is_edited, edited_at, is_deleted, deleted_at, reply_to_message_id').eq('group_id', groupId).order('created_at', { ascending: true }); if (messagesError) throw messagesError; if (!messagesData || messagesData.length === 0) { setMessages([]); } else { const visibleMessages = messagesData.filter(msg => !msg.is_system_message && msg.sender_id); const senderIds = Array.from(new Set(visibleMessages.filter(msg => msg.sender_id).map(msg => msg.sender_id))); const profilesMap = new Map<string, UserProfileInfo>(); if (senderIds.length > 0) { const idsToFetch = senderIds.filter(id => !userProfileCache[id]); if (idsToFetch.length > 0) { const { data: profilesData, error: profilesError } = await supabase.from('music_lover_profiles').select('user_id, first_name, last_name, profile_picture').in('user_id', idsToFetch); if (profilesError) { console.error("Err fetch profiles:", profilesError); } else if (profilesData) { profilesData.forEach((p: UserProfileInfo) => { profilesMap.set(p.user_id, p); const n = `${p.first_name||''} ${p.last_name||''}`.trim()||'User'; const a = p.profile_picture||undefined; userProfileCache[p.user_id] = { name: n, avatar: a }; }); } } senderIds.forEach(id => { if (userProfileCache[id] && !profilesMap.has(id)) { profilesMap.set(id, { user_id: id, first_name: userProfileCache[id].name?.split(' ')[0]||null, last_name: userProfileCache[id].name?.split(' ')[1]||null, profile_picture: userProfileCache[id].avatar||null }); } }); } if (currentUserId && !userProfileCache[currentUserId]) userProfileCache[currentUserId] = { name: 'You' }; const mappedMessages = visibleMessages.map(dbMsg => mapDbMessageToChatMessage(dbMsg as DbGroupMessage, profilesMap)); setMessages(mappedMessages); } } catch (err: any) { console.error("Error fetching initial data:", err); if (err.message?.includes("User is not a member")) { Alert.alert("Access Denied", "Not member.", [{ text: "OK", onPress: () => navigation.goBack() }]); setLoadError("Not a member."); } else { setLoadError(`Load fail: ${err.message || 'Unknown'}`); } setMessages([]); setIsCurrentUserAdmin(false); setCanMembersAddOthers(false); setCanMembersEditInfo(false); } finally { setLoading(false); } }, [currentUserId, groupId, navigation, mapDbMessageToChatMessage]);

    // Send Text Message
    const sendTextMessage = useCallback(async (text: string) => { 
        if (!currentUserId || !groupId || !text.trim() || isUploading) return; 
        
        const trimmedText = text.trim(); 
        const tempId = `temp_txt_${Date.now()}`; // Differentiate temp ID for text messages
        const currentUserProfile = userProfileCache[currentUserId] || { name: 'You' }; 
        
        let replyingToMessagePreview: ChatMessage['replyToMessagePreview'] = null;
        if (replyingToMessage) {
            replyingToMessagePreview = {
                text: replyingToMessage.image ? '[Image]' : replyingToMessage.text,
                senderName: replyingToMessage.user.name,
                image: replyingToMessage.image
            };
        }

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
            isSystemMessage: false,
            replyToMessageId: replyingToMessage?._id || null,
            replyToMessagePreview: replyingToMessagePreview,
        }; 
        
        setMessages(previousMessages => [...previousMessages, optimisticMessage]); 
        setInputText(''); 
        setSendError(null); 
        Keyboard.dismiss(); 
        const replyToId = replyingToMessage?._id;
        setReplyingToMessage(null);
        
        try { 
            // Prepare the message data with metadata if needed
            let insertData: any = {
                sender_id: currentUserId, 
                group_id: groupId, 
                content: trimmedText, 
                image_url: null, 
                is_system_message: false,
                reply_to_message_id: replyToId || null,
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
    }, [currentUserId, groupId, sendError, isUploading, replyingToMessage, userProfileCache]);
    
    const shareEventToGroupViaRpc = useCallback(async (eventDataToShare: typeof initialSharedEventData) => {
        if (!currentUserId || !groupId || !eventDataToShare || isUploading) return;
        const { eventId } = eventDataToShare;

        // Optimistic message construction
        const tempId = `temp_shared_${Date.now()}`;
        const currentUserProfile = userProfileCache[currentUserId] || { name: 'You' };
        const eventMessageText = `Shared an event: ${eventDataToShare.eventTitle}`;

        let replyingToMessagePreview: ChatMessage['replyToMessagePreview'] = null;
        if (replyingToMessage) {
            replyingToMessagePreview = {
                text: replyingToMessage.image ? '[Image]' : replyingToMessage.text,
                senderName: replyingToMessage.user.name,
                image: replyingToMessage.image
            };
        }

        const optimisticMessage: ChatMessage = {
            _id: tempId,
            text: eventMessageText,
            createdAt: new Date(),
            user: {
                _id: currentUserId,
                name: currentUserProfile.name,
                avatar: currentUserProfile.avatar
            },
            image: null,
            isSystemMessage: false,
            sharedEvent: {
                eventId: eventDataToShare.eventId,
                eventTitle: eventDataToShare.eventTitle,
                eventDate: eventDataToShare.eventDate,
                eventVenue: eventDataToShare.eventVenue,
                eventImage: eventDataToShare.eventImage || DEFAULT_EVENT_IMAGE_CHAT,
            },
            replyToMessageId: replyingToMessage?._id || null,
            replyToMessagePreview: replyingToMessagePreview,
        };

        setMessages(prevMessages => [...prevMessages, optimisticMessage]);
        setInputText(''); 
        setSharedEventMessage(null);
        setSendError(null);
        Keyboard.dismiss();
        const replyToId = replyingToMessage?._id;
        setReplyingToMessage(null);

        try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('share_event_to_group', {
                p_event_id: eventId,
                p_group_id: groupId,
                p_reply_to_message_id: replyToId || null
            });
            if (rpcError) throw rpcError;
            if (!rpcData || !rpcData.success || !rpcData.message_id) {
                throw new Error('Failed to share event to group via RPC or received invalid response.');
            }
            console.log('[GroupChatScreen] Event shared to group via RPC, message_id:', rpcData.message_id);
            setMessages(prevMessages => prevMessages.map(msg => 
                msg._id === tempId ? { 
                    ...optimisticMessage, 
                    _id: rpcData.message_id
                } : msg
            ));
        } catch (err: any) {
            console.error("Error sharing event to group:", err);
            setSendError(`Event share fail: ${err.message}`);
            setMessages(prevMessages => prevMessages.filter(msg => msg._id !== tempId));
        }
    }, [currentUserId, groupId, isUploading, replyingToMessage, userProfileCache]);

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

            let replyingToMessagePreview: ChatMessage['replyToMessagePreview'] = null;
            if (replyingToMessage) {
                replyingToMessagePreview = {
                    text: replyingToMessage.image ? '[Image]' : replyingToMessage.text,
                    senderName: replyingToMessage.user.name,
                    image: replyingToMessage.image
                };
            }

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
                isSystemMessage: false,
                replyToMessageId: replyingToMessage?._id || null,
                replyToMessagePreview: replyingToMessagePreview,
            };

            setMessages(prev => [...prev, optimisticMessage]);
            const replyToId = replyingToMessage?._id;
            setReplyingToMessage(null);

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
                    is_system_message: false,
                    reply_to_message_id: replyToId || null,
                })
                .select('id, created_at, image_url')
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
    useEffect(() => { if (!groupId || !currentUserId) return; const messageChannel = supabase.channel(`group_chat_messages_${groupId}`).on<DbGroupMessage>( 'postgres_changes',{ event: 'INSERT', schema: 'public', table: 'group_chat_messages', filter: `group_id=eq.${groupId}` }, async (payload) => { const newMessageDb = payload.new as DbGroupMessage; 
        
        // Check if message is hidden for current user
        const { data: hiddenCheck, error: hiddenError } = await supabase
            .from('user_hidden_messages')
            .select('message_id')
            .eq('user_id', currentUserId)
            .eq('message_id', newMessageDb.id)
            .maybeSingle();

        if (hiddenError) {
            console.error("Error checking if RT message is hidden:", hiddenError);
        }
        if (hiddenCheck) { // If message is hidden for this user, don't add or update it
            console.log(`RT message ${newMessageDb.id} is hidden for user, skipping.`);
            return;
        }

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
                console.error(`RT Profile Fetch Err for updated message ${newMessageDb.sender_id}`, err); 
            } 
        }
        const receivedMessage = mapDbMessageToChatMessage(newMessageDb, rtProfilesMap);

        if (newMessageDb.sender_id === currentUserId) {
            // Message from the current user, likely an optimistic update confirmation
            setMessages(prevMessages =>
                prevMessages.map(msg => {
                    // If it's a text message confirmation
                    if (msg._id.startsWith('temp_txt_') && msg.text === receivedMessage.text && !msg.sharedEvent && msg.replyToMessageId === receivedMessage.replyToMessageId) {
                        return receivedMessage;
                    }
                    // If it's a shared event confirmation
                    if (msg._id.startsWith('temp_shared_') && msg.sharedEvent?.eventId === receivedMessage.sharedEvent?.eventId && msg.replyToMessageId === receivedMessage.replyToMessageId) {
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
            // Make the callback async to handle await for fetchMessageById
            (async () => {
                // Check if message already exists to prevent duplicates from optimistic + RT updates
                if (messages.some(msg => msg._id === receivedMessage._id)) return;

                let finalReceivedMessage = { ...receivedMessage };
                // Add replyToMessagePreview for the new message from another user
                if (finalReceivedMessage.replyToMessageId) {
                    const repliedMsg = messages.find(m => m._id === finalReceivedMessage.replyToMessageId) || (await fetchMessageById(finalReceivedMessage.replyToMessageId));
                    if (repliedMsg) {
                        finalReceivedMessage.replyToMessagePreview = {
                            text: repliedMsg.image ? (repliedMsg.text || '[Image]') : repliedMsg.text,
                            senderName: repliedMsg.user.name,
                            image: repliedMsg.image
                        };
                    }
                }
                setMessages(prev => [...prev, finalReceivedMessage]);
            })();
        }
       
    }).on<DbGroupMessage>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'group_chat_messages', filter: `group_id=eq.${groupId}` },
        async (payload) => {
            const updatedMessageDb = payload.new as DbGroupMessage;
            const oldMessageDb = payload.old as DbGroupMessage;

            // Check if message is hidden for current user
            const { data: hiddenCheck, error: hiddenError } = await supabase
                .from('user_hidden_messages')
                .select('message_id')
                .eq('user_id', currentUserId)
                .eq('message_id', updatedMessageDb.id)
                .maybeSingle();

            if (hiddenError) {
                console.error("Error checking if RT updated message is hidden:", hiddenError);
            }
            if (hiddenCheck && !updatedMessageDb.is_deleted) { // If hidden and not a delete event, ignore
                console.log(`RT updated message ${updatedMessageDb.id} is hidden, skipping unless it's a delete confirmation.`);
                 // If it was a delete for everyone, we might want to show it as deleted
                if (updatedMessageDb.is_deleted) {
                     setMessages(prev => prev.map(msg => 
                        msg._id === updatedMessageDb.id 
                        ? { ...msg, 
                            text: 'This message was deleted', 
                            isDeleted: true, 
                            deletedAt: updatedMessageDb.deleted_at ? new Date(updatedMessageDb.deleted_at) : new Date(),
                            image: null, // Clear image for deleted messages
                            sharedEvent: null // Clear shared event for deleted messages
                          }
                        : msg
                    ));
                }
                return;
            }

            const rtProfilesMap = new Map<string, UserProfileInfo>();
            if (updatedMessageDb.sender_id && !updatedMessageDb.is_system_message && !userProfileCache[updatedMessageDb.sender_id]) {
                 try { 
                    const { data: p } = await supabase.from('music_lover_profiles').select('user_id, first_name, last_name, profile_picture').eq('user_id', updatedMessageDb.sender_id).maybeSingle(); 
                    if (p) { 
                        rtProfilesMap.set(p.user_id, p); 
                        const n = `${p.first_name||''} ${p.last_name||''}`.trim()||'User'; 
                        const a = p.profile_picture||undefined; 
                        userProfileCache[p.user_id]={name:n,avatar:a}; 
                    } 
                } catch (err) { 
                    console.error(`RT Profile Fetch Err for updated message ${updatedMessageDb.sender_id}`, err); 
                } 
            }
            const updatedMessageUi = mapDbMessageToChatMessage(updatedMessageDb, rtProfilesMap);

            // Add replyToMessagePreview for the updated message
            if (updatedMessageUi.replyToMessageId) {
                const repliedMsg = messages.find(m => m._id === updatedMessageUi.replyToMessageId) || (await fetchMessageById(updatedMessageUi.replyToMessageId));
                if (repliedMsg) {
                    updatedMessageUi.replyToMessagePreview = {
                        text: repliedMsg.image ? '[Image]' : repliedMsg.text,
                        senderName: repliedMsg.user.name,
                        image: repliedMsg.image
                    };
                }
            }

            setMessages(prev => prev.map(msg => 
                msg._id === updatedMessageUi._id ? updatedMessageUi : msg
            ));

            // If this update was an edit initiated by the current user, close the edit modal
            if (editingMessage && editingMessage._id === updatedMessageUi._id && updatedMessageUi.isEdited && currentUserId === updatedMessageUi.user._id) {
                setEditingMessage(null);
                setEditText("");
            }
        }
    )
    .subscribe(); 
    const infoChannel = supabase.channel(`group_info_${groupId}`).on<DbGroupChat>('postgres_changes',{ event: 'UPDATE', schema: 'public', table: 'group_chats', filter: `id=eq.${groupId}` },(payload) => { const d=payload.new; if(d.group_name!==currentGroupName){setCurrentGroupName(d.group_name);} if(d.group_image!==currentGroupImage){setCurrentGroupImage(d.group_image);} if(d.can_members_add_others!==undefined){setCanMembersAddOthers(d.can_members_add_others);} if(d.can_members_edit_info!==undefined){setCanMembersEditInfo(d.can_members_edit_info);} }).on<any>('postgres_changes',{ event: 'DELETE', schema: 'public', table: 'group_chats', filter: `id=eq.${groupId}` },(payload) => { Alert.alert("Group Deleted", "This group no longer exists.", [{ text: "OK", onPress: () => navigation.popToTop() }]); }).subscribe(); return () => { supabase.removeChannel(messageChannel); supabase.removeChannel(infoChannel); }; }, [groupId, currentUserId, mapDbMessageToChatMessage, navigation, currentGroupName, currentGroupImage, canMembersAddOthers, canMembersEditInfo, editingMessage, messages]);

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
            // setInputText logic is now handled by renderEventSharePreview's close button or send action
            setSharedEventMessage(JSON.stringify(initialSharedEventData));
            // Clear the sharing flag from route params to prevent re-triggering
            navigation.setParams({ sharedEventData: { ...initialSharedEventData, isSharing: false } });
        }
    }, [initialSharedEventData, navigation]);

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

    // --- New Chat Feature Handlers ---
    const handleMessageLongPress = (message: ChatMessage) => {
        if (message.isSystemMessage || message.isDeleted) return;
        setSelectedMessageForAction(message);
        setMessageActionModalVisible(true);
    };

    const handleReply = () => {
        if (!selectedMessageForAction) return;
        setReplyingToMessage(selectedMessageForAction);
        setMessageActionModalVisible(false);
        setSelectedMessageForAction(null);
        // Optionally focus text input: inputRef.current?.focus();
    };

    const handleEdit = () => {
        if (!selectedMessageForAction || selectedMessageForAction.user._id !== currentUserId || selectedMessageForAction.image) return; // Cannot edit images or others' messages
        setEditingMessage(selectedMessageForAction);
        setEditText(selectedMessageForAction.text);
        setMessageActionModalVisible(false);
        setSelectedMessageForAction(null);
    };

    const saveEditMessage = async () => {
        if (!editingMessage || !editText.trim() || editText.trim() === editingMessage.text) {
            setEditingMessage(null);
            setEditText("");
            return;
        }
        try {
            const { error } = await supabase.rpc('edit_group_message', {
                message_id_input: editingMessage._id,
                new_content: editText.trim(),
            });
            if (error) throw error;
            // Optimistic update handled by subscription, or can be done here too
            setMessages(prev => prev.map(msg => 
                msg._id === editingMessage._id 
                ? { ...msg, text: editText.trim(), isEdited: true, editedAt: new Date() } 
                : msg
            ));
            setEditingMessage(null);
            setEditText("");
        } catch (err: any) {
            Alert.alert("Error", `Failed to edit message: ${err.message}`);
        }
    };

    const handleDeleteForMe = async () => {
        if (!selectedMessageForAction) return;
        try {
            const { error } = await supabase.rpc('hide_message_from_my_view', {
                p_message_id: selectedMessageForAction._id,
            });
            if (error) throw error;
            setMessages(prev => prev.filter(msg => msg._id !== selectedMessageForAction!._id));
            setMessageActionModalVisible(false);
            setSelectedMessageForAction(null);
        } catch (err: any) {
            Alert.alert("Error", `Failed to delete message for you: ${err.message}`);
        }
    };

    const handleDeleteForEveryone = async () => {
        if (!selectedMessageForAction) return;

        const isSender = selectedMessageForAction.user._id === currentUserId;
        
        if (!isSender && !isCurrentUserAdmin) {
            Alert.alert("Permission Denied", "You can only delete your own messages for everyone, or an admin can delete any message.");
            setMessageActionModalVisible(false);
            setSelectedMessageForAction(null);
            return;
        }

        try {
            const { error } = await supabase.rpc('delete_group_chat_message', { // Corrected RPC name
                message_id_input: selectedMessageForAction._id,
            });
            if (error) throw error;
            // Optimistic update is to mark as deleted. Subscription will confirm.
            setMessages(prev => prev.map(msg => 
                msg._id === selectedMessageForAction._id 
                ? { ...msg, 
                    text: 'This message was deleted', 
                    isDeleted: true, 
                    deletedAt: new Date(),
                    image: null, // Clear image for deleted messages
                    sharedEvent: null // Clear shared event for deleted messages
                  }
                : msg
            ));
            setMessageActionModalVisible(false);
            setSelectedMessageForAction(null);
        } catch (err: any) {
            Alert.alert("Error", `Failed to delete message: ${err.message}`);
        }
    };

    const handleShowMessageInfo = async () => {
        if (!selectedMessageForAction) return;
        setMessageActionModalVisible(false);
        setLoadingMessageInfo(true);
        setMessageInfoVisible(true);
        try {
            const { data, error } = await supabase.rpc('get_group_message_status', {
                message_id_input: selectedMessageForAction._id
            });
            if (error) throw error;
            setMessageInfoData(data);
        } catch (err: any) {
            Alert.alert("Error", `Failed to get message info: ${err.message}`);
            setMessageInfoVisible(false); // Close if error
        } finally {
            setLoadingMessageInfo(false);
            setSelectedMessageForAction(null); // Clear selection after action
        }
    };

    // Helper to get replied message for preview
    const getRepliedMessagePreview = (messageId: string): ChatMessage['replyToMessagePreview'] | null => {
        const repliedMsg = messages.find(msg => msg._id === messageId);
        if (repliedMsg) {
            return {
                text: repliedMsg.image ? '[Image]' : repliedMsg.text,
                senderName: repliedMsg.user.name,
                image: repliedMsg.image // Pass image for potential preview in reply
            };
        }
        return null;
    };

    // Helper to fetch a single message by ID (e.g., for reply previews if not in current `messages` state)
    const fetchMessageById = async (messageId: string): Promise<ChatMessage | null> => {
        try {
            const { data: dbMessage, error } = await supabase
                .from('group_chat_messages')
                .select('id, created_at, sender_id, group_id, content, image_url, is_system_message, original_content, is_edited, edited_at, is_deleted, deleted_at, reply_to_message_id')
                .eq('id', messageId)
                .single();
            if (error || !dbMessage) throw error || new Error('Message not found');

            const profilesMap = new Map<string, UserProfileInfo>();
            if (dbMessage.sender_id && !dbMessage.is_system_message && !userProfileCache[dbMessage.sender_id]) {
                const { data: p } = await supabase.from('music_lover_profiles').select('user_id, first_name, last_name, profile_picture').eq('user_id', dbMessage.sender_id).maybeSingle();
                if (p) {
                    profilesMap.set(p.user_id, p);
                    const n = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'User';
                    const a = p.profile_picture || undefined;
                    userProfileCache[p.user_id] = { name: n, avatar: a };
                }
            }
            return mapDbMessageToChatMessage(dbMessage as DbGroupMessage, profilesMap);
        } catch (err) {
            console.error("Failed to fetch message by ID for reply preview:", err);
            return null;
        }
    };

    // Custom event share preview component
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
                            onEventPress={handleEventPressInternal} // Pass the new internal handler
                            onMessageLongPress={handleMessageLongPress}
                            getRepliedMessagePreview={getRepliedMessagePreview}
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

                {/* Replying To Preview */} 
                {replyingToMessage && (
                    <View style={styles.replyingToContainer}>
                        <View style={styles.replyingToContent}>
                            <Text style={styles.replyingToTitle} numberOfLines={1}>Replying to {replyingToMessage.user.name || 'User'}</Text>
                            {replyingToMessage.image ? (
                                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                    <Feather name="image" size={14} color="#4B5563" style={{marginRight: 5}}/>
                                    <Text style={styles.replyingToText} numberOfLines={1}>Image</Text>
                                </View>
                            ) : (
                                <Text style={styles.replyingToText} numberOfLines={1}>{replyingToMessage.text}</Text>
                            )}
                        </View>
                        <TouchableOpacity onPress={() => setReplyingToMessage(null)} style={styles.replyingToCloseButton}>
                            <Feather name="x" size={18} color="#6B7280" />
                        </TouchableOpacity>
                    </View>
                )}

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

            {/* Message Action Modal */}
            <Modal
                visible={messageActionModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => {
                    setMessageActionModalVisible(false);
                    setSelectedMessageForAction(null);
                }}
            >
                <TouchableOpacity 
                    style={styles.modalBackdrop} 
                    activeOpacity={1} 
                    onPress={() => {
                        setMessageActionModalVisible(false);
                        setSelectedMessageForAction(null);
                    }} 
                />
                <View style={styles.actionModalContent}>
                    {selectedMessageForAction && (
                        <>
                            <TouchableOpacity style={styles.actionModalButton} onPress={handleReply}>
                                <Feather name="corner-up-left" size={20} color="#3B82F6" style={styles.actionModalIcon}/>
                                <Text style={styles.actionModalButtonText}>Reply</Text>
                            </TouchableOpacity>

                            {selectedMessageForAction.user._id === currentUserId && !selectedMessageForAction.image && !selectedMessageForAction.sharedEvent && (
                                <TouchableOpacity style={styles.actionModalButton} onPress={handleEdit}>
                                    <Feather name="edit-2" size={20} color="#3B82F6" style={styles.actionModalIcon}/>
                                    <Text style={styles.actionModalButtonText}>Edit</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity style={styles.actionModalButton} onPress={handleShowMessageInfo}>
                                <Feather name="info" size={20} color="#3B82F6" style={styles.actionModalIcon}/>
                                <Text style={styles.actionModalButtonText}>Info</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionModalButton} onPress={handleDeleteForMe}>
                                <Feather name="trash" size={20} color="#EF4444" style={styles.actionModalIcon}/>
                                <Text style={[styles.actionModalButtonText, {color: '#EF4444'}]}>Delete for Me</Text>
                            </TouchableOpacity>

                            {(selectedMessageForAction.user._id === currentUserId || isCurrentUserAdmin) && (
                                <TouchableOpacity style={styles.actionModalButton} onPress={handleDeleteForEveryone}>
                                    <Feather name="trash-2" size={20} color="#EF4444" style={styles.actionModalIcon}/>
                                    <Text style={[styles.actionModalButtonText, {color: '#EF4444'}]}>Delete for Everyone</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>
            </Modal>

            {/* Editing Message Modal (Could be an inline input field too) */}
            {editingMessage && (
                <Modal
                    visible={true} // Controlled by editingMessage state
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => {
                        setEditingMessage(null);
                        setEditText("");
                    }}
                >
                    <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => {setEditingMessage(null); setEditText("");}}/>
                    <View style={styles.modalContent}> 
                        <Text style={styles.modalTitle}>Edit Message</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={editText}
                            onChangeText={setEditText}
                            placeholder="Enter new message"
                            multiline
                            autoFocus
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity 
                                style={[styles.modalButton, styles.modalButtonCancel]} 
                                onPress={() => {
                                    setEditingMessage(null); 
                                    setEditText("");
                                }}
                            >
                                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalButton, styles.modalButtonSave, (!editText.trim() || editText.trim() === editingMessage.text) && styles.modalButtonDisabled]} 
                                onPress={saveEditMessage} 
                                disabled={!editText.trim() || editText.trim() === editingMessage.text}
                            >
                                <Text style={styles.modalButtonTextSave}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Message Info Modal */}
            <Modal
                visible={messageInfoVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setMessageInfoVisible(false)}
            >
                <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setMessageInfoVisible(false)} />
                <View style={styles.messageInfoModalContent}>
                    <Text style={styles.messageInfoTitle}>Message Info</Text>
                    {loadingMessageInfo ? (
                        <ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} />
                    ) : messageInfoData ? (
                        <ScrollView>
                            <Text style={styles.messageInfoSectionTitle}>Sent at: {messageInfoData.message_id ? formatTime(new Date(messages.find(m=>m._id === messageInfoData.message_id)?.createdAt || Date.now())) : 'N/A'}</Text>
                             {/* Add more details based on messageInfoData structure from get_group_message_status */}
                            <Text style={styles.messageInfoSectionTitle}>Delivered: {messageInfoData.delivered_count} / {messageInfoData.total_members}</Text>
                            <Text style={styles.messageInfoSectionTitle}>Seen by: {messageInfoData.seen_count} / {messageInfoData.total_members}</Text>
                            {messageInfoData.members && messageInfoData.members.map((member: any, index: number) => (
                                <View key={member.user_id || index} style={styles.messageInfoMemberRow}>
                                    <Image source={{uri: member.profile_picture || DEFAULT_PROFILE_PIC}} style={styles.messageInfoMemberImage} />
                                    <View style={styles.messageInfoMemberInfo}>
                                        <Text style={styles.messageInfoMemberName}>{member.first_name || 'User'} {member.last_name || ''}</Text>
                                        {member.is_seen && member.seen_at && <Text style={styles.messageInfoStatusText}>Seen: {formatTime(new Date(member.seen_at))}</Text>}
                                        {!member.is_seen && member.is_delivered && member.delivered_at && <Text style={styles.messageInfoStatusText}>Delivered: {formatTime(new Date(member.delivered_at))}</Text>}
                                        {!member.is_seen && !member.is_delivered && <Text style={styles.messageInfoStatusText}>Sent</Text>}
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    ) : (
                        <Text>No information available.</Text>
                    )}
                    <TouchableOpacity style={styles.messageInfoCloseButton} onPress={() => setMessageInfoVisible(false)}>
                        <Text style={styles.messageInfoCloseButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
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
    messageRowTouchable: {
        flexDirection: 'row',
        marginVertical: 4,
        alignItems: 'flex-end',
    },
    timeAndEditContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
        alignSelf: 'flex-end',
    },
    editedIndicator: {
        fontSize: 10,
        fontStyle: 'italic',
        marginRight: 4,
    },
    editedIndicatorSent: {
        color: 'rgba(255, 255, 255, 0.7)',
    },
    editedIndicatorReceived: {
        color: '#6B7280',
    },
    deletedMessageBubble: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E5E7EB',
        opacity: 0.8,
    },
    deletedMessageText: {
        fontSize: 14,
        fontStyle: 'italic',
        color: '#6B7280',
    },
    replyPreviewContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.03)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        marginBottom: -2,
        maxWidth: '90%',
    },
    replyPreviewSent: {
        alignSelf: 'flex-end',
        borderLeftColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6',
        borderLeftWidth: 3,
    },
    replyPreviewReceived: {
        alignSelf: 'flex-start',
        borderLeftColor: '#A0AEC0',
        borderLeftWidth: 3,
    },
    replyPreviewBorder: {
    },
    replyPreviewContent: {
        marginLeft: 6,
        flexShrink: 1,
    },
    replyPreviewSenderName: {
        fontSize: 11,
        fontWeight: '600',
        color: '#4B5563',
    },
    replyPreviewText: {
        fontSize: 12,
        color: '#6B7280',
    },
    replyingToContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#E9E9EB',
        borderTopWidth: 1,
        borderTopColor: '#DCDCDC',
    },
    replyingToContent: {
        flex: 1,
    },
    replyingToTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333333',
    },
    replyingToText: {
        fontSize: 13,
        color: '#555555',
    },
    replyingToCloseButton: {
        padding: 5,
    },
    actionModalContent: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 30 : 15,
        left: 15,
        right: 15,
        backgroundColor: 'white',
        borderRadius: 12,
        paddingVertical: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    actionModalButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    actionModalIcon: {
        marginRight: 15,
    },
    actionModalButtonText: {
        fontSize: 16,
        color: '#1F2937',
    },
    messageInfoModalContent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '60%',
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
        elevation: 10,
    },
    messageInfoTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 15,
        color: '#1F2937',
    },
    messageInfoSectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
        marginTop: 10,
        marginBottom: 5,
    },
    messageInfoMemberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    messageInfoMemberImage: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 12,
    },
    messageInfoMemberInfo: {
        flex: 1,
    },
    messageInfoMemberName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1F2937',
    },
    messageInfoStatusText: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    messageInfoCloseButton: {
        marginTop: 20,
        paddingVertical: 12,
        backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6',
        borderRadius: 8,
        alignItems: 'center',
    },
    messageInfoCloseButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});



export default GroupChatScreen;