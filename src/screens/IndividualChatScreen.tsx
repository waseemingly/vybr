// screens/IndividualChatScreen.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import {
    View, StyleSheet, ActivityIndicator, Text, TouchableOpacity,
    Platform, TextInput, SectionList, KeyboardAvoidingView, Keyboard,
    Image, Alert, Modal, ScrollView
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import ImageViewer from 'react-native-image-zoom-viewer';
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { RootStackParamList } from "@/navigation/AppNavigator";
import { APP_CONSTANTS } from '@/config/constants';
import {
    EventDetailModal,
    type MappedEvent,
    type OrganizerInfo,
} from '@/screens/EventsScreen';

// Types and MessageBubble component
type IndividualChatScreenRouteProp = RouteProp<RootStackParamList & {
  IndividualChatScreen: {
    matchUserId: string;
    matchName: string;
    matchProfilePicture?: string | null;
    commonTags?: string[];
    topArtists?: string[];
    topTracks?: string[];
    topGenres?: string[];
    topMoods?: string[];
    isFirstInteractionFromMatches?: boolean;
    sharedEventData?: {
      eventId: string;
      eventTitle: string;
      eventDate: string;
      eventVenue: string;
      eventImage: string;
      isSharing: boolean;
    }
  }
}, 'IndividualChatScreen'>;
type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;
interface DbMessage { 
    id: string; 
    created_at: string; 
    sender_id: string; 
    receiver_id: string; 
    content: string; 
    image_url?: string | null; 
    metadata?: { 
        shared_event?: {
            eventId: string;
            eventTitle: string;
            eventDate: string;
            eventVenue: string;
            eventImage: string;
        }
    } | null;
    original_content?: string | null;
    is_edited?: boolean;
    edited_at?: string | null;
    is_deleted?: boolean;
    deleted_at?: string | null;
    reply_to_message_id?: string | null;
    is_delivered?: boolean;
    delivered_at?: string | null;
    is_seen?: boolean;
    seen_at?: string | null;
}
interface ChatMessage { 
    _id: string; 
    text: string; 
    createdAt: Date; 
    user: { _id: string; }; 
    image?: string | null; 
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
    isDelivered?: boolean;
    deliveredAt?: Date | null;
    isSeen?: boolean;
    seenAt?: Date | null;
}
interface MessageBubbleProps { 
    message: ChatMessage; 
    currentUserId: string | undefined; 
    onImagePress: (imageUrl: string) => void;
    onEventPress?: (eventId: string) => void;
    onMessageLongPress: (message: ChatMessage) => void;
    getRepliedMessagePreview: (messageId: string) => ChatMessage['replyToMessagePreview'] | null;
}

// Add DEFAULT_PROFILE_PIC constant
const DEFAULT_PROFILE_PIC = APP_CONSTANTS.DEFAULT_PROFILE_PIC;
const DEFAULT_EVENT_IMAGE_CHAT = "https://via.placeholder.com/800x450/D1D5DB/1F2937?text=Event"; // Direct placeholder
const DEFAULT_ORGANIZER_LOGO_CHAT = "https://via.placeholder.com/150/BFDBFE/1E40AF?text=Logo"; // Direct placeholder
const DEFAULT_ORGANIZER_NAME_CHAT = "Event Organizer";

// Helper to format timestamps
const formatTime = (date: Date) => date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

// Simplified formatEventDateTime for modal (if EventsScreen's one is not directly usable)
const formatEventDateTimeForModal = (isoString: string | null): { date: string; time: string } => {
    if (!isoString) return { date: "N/A", time: "N/A" };
    try {
        const d = new Date(isoString);
        const datePart = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' });
        const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
        return { date: datePart, time: timePart };
    } catch (e) { return { date: "Invalid Date", time: "" }; }
};

const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ 
    message, 
    currentUserId, 
    onImagePress, 
    onEventPress,
    onMessageLongPress,
    getRepliedMessagePreview
}) => {
    const isCurrentUser = message.user._id === currentUserId;
    const [imageError, setImageError] = useState(false);
    const navigation = useNavigation<RootNavigationProp>();

    // Handle event press 
    const handleEventPress = () => {
        if (message.sharedEvent?.eventId && onEventPress) {
            // Log impression
            try {
                supabase.from('event_impressions').insert({
                    event_id: message.sharedEvent?.eventId,
                    user_id: currentUserId || null,
                    source: 'chat'
                }).then(() => {
                    console.log(`Logged impression for event ${message.sharedEvent?.eventId} from chat`);
                });
            } catch (error) {
                console.error("Failed to log impression:", error);
            }
            
            onEventPress(message.sharedEvent.eventId);
        }
    };

    // Deleted Message
    if (message.isDeleted) {
        return (
            <View style={[styles.messageRow, isCurrentUser ? styles.messageRowSent : styles.messageRowReceived]}>
                <View style={styles.messageContentContainer}>
                    <View style={[styles.messageBubble, styles.deletedMessageBubble, isCurrentUser ? styles.messageBubbleSent : styles.messageBubbleReceived]}>
                        <Feather name="slash" size={14} color={isCurrentUser ? "rgba(255,255,255,0.7)" : "#9CA3AF"} style={{marginRight: 5}}/>
                        <Text style={[styles.deletedMessageText, isCurrentUser ? styles.messageTextSent : styles.messageTextReceived]}>
                            This message was deleted
                        </Text>
                    </View>
                    <Text style={[styles.timeText, styles.timeTextBelowBubble, isCurrentUser ? styles.timeTextSent : styles.timeTextReceived]}>
                        {formatTime(message.createdAt)}
                        {isCurrentUser && message.isSeen && <Feather name="check-circle" size={12} color="#34D399" style={{ marginLeft: 4 }} />} 
                        {isCurrentUser && message.isDelivered && !message.isSeen && <Feather name="check" size={12} color="#A0AEC0" style={{ marginLeft: 4 }} />} 
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
                    <View style={[
                        styles.messageBubble, 
                        styles.sharedEventMessageBubble,
                        isCurrentUser ? styles.messageBubbleSent : styles.messageBubbleReceived
                    ]}>
                        <Text style={[
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
                        {message.isEdited && <Text style={styles.editedIndicator}>(edited)</Text>}
                    </View>
                    <Text style={[styles.timeText, styles.timeTextBelowBubble, isCurrentUser ? styles.timeTextSent : styles.timeTextReceived]}>
                        {formatTime(message.createdAt)}
                        {isCurrentUser && message.isSeen && <Feather name="check-circle" size={12} color="#34D399" style={{ marginLeft: 4 }} />} 
                        {isCurrentUser && message.isDelivered && !message.isSeen && <Feather name="check" size={12} color="#A0AEC0" style={{ marginLeft: 4 }} />} 
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
                        onPress={() => onImagePress(message.image!)}
                        style={[styles.messageBubble, styles.imageBubble, isCurrentUser ? styles.messageBubbleSentImage : styles.messageBubbleReceivedImage]}
                    >
                        <Image
                            source={{ uri: message.image }}
                            style={styles.chatImage}
                            onError={() => setImageError(true)}
                        />
                        {imageError && (
                            <View style={styles.imageErrorOverlay}>
                                <Feather name="image" size={24} color="#FFFFFF" />
                                <Text style={styles.imageErrorText}>Failed to load image</Text>
                            </View>
                        )}
                        {message.isEdited && <Text style={[styles.editedIndicator, styles.editedIndicatorImage]}>(edited)</Text>}
                    </TouchableOpacity>
                    <Text style={[styles.timeText, styles.timeTextBelowBubble, isCurrentUser ? styles.timeTextSent : styles.timeTextReceived]}>
                        {formatTime(message.createdAt)}
                        {isCurrentUser && message.isSeen && <Feather name="check-circle" size={12} color="#34D399" style={{ marginLeft: 4 }} />} 
                        {isCurrentUser && message.isDelivered && !message.isSeen && <Feather name="check" size={12} color="#A0AEC0" style={{ marginLeft: 4 }} />} 
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }

    // Regular Text Message
    return (
        <TouchableOpacity 
            style={[styles.messageRowTouchable, isCurrentUser ? styles.messageRowSent : styles.messageRowReceived]}
            onLongPress={() => onMessageLongPress(message)}
            delayLongPress={200}
            activeOpacity={0.8}
        >
            <View style={styles.messageContentContainer}>
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
                <View style={[styles.messageBubble, isCurrentUser ? styles.messageBubbleSent : styles.messageBubbleReceived]}>
                    <Text style={isCurrentUser ? styles.messageTextSent : styles.messageTextReceived}>
                        {message.text}
                    </Text>
                    {message.isEdited && <Text style={[styles.editedIndicator, isCurrentUser ? styles.editedIndicatorSent : styles.editedIndicatorReceived]}>(edited)</Text>}
                </View>
                <Text style={[styles.timeText, styles.timeTextBelowBubble, isCurrentUser ? styles.timeTextSent : styles.timeTextReceived]}>
                    {formatTime(message.createdAt)}
                    {isCurrentUser && message.isSeen && <Feather name="check-circle" size={12} color="#34D399" style={{ marginLeft: 4 }} />} 
                    {isCurrentUser && message.isDelivered && !message.isSeen && <Feather name="check" size={12} color="#A0AEC0" style={{ marginLeft: 4 }} />} 
                </Text>
            </View>
        </TouchableOpacity>
    );
});

// Helper function to generate SHA256 hash for tags
const generateTagsHash = async (tags: string[]): Promise<string> => {
    if (!tags || tags.length === 0) return '';
    // Ensure consistent ordering for the hash
    const sortedTagsString = [...tags].sort().join(',');
    try {
        const digest = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            sortedTagsString
        );
        return digest;
    } catch (hashError) {
        console.error("Failed to generate tags hash:", hashError);
        return ''; // Fallback or handle error appropriately
    }
};

const IndividualChatScreen: React.FC = () => {
    const route = useRoute<IndividualChatScreenRouteProp>();
    const navigation = useNavigation<RootNavigationProp>();
    const { session, musicLoverProfile } = useAuth();

    const currentUserIdFromSession = session?.user?.id;
    const { 
        matchUserId: matchUserIdFromRoute,
        commonTags, 
        isFirstInteractionFromMatches, 
        sharedEventData: initialSharedEventData 
    } = route.params;

    const currentUserId = currentUserIdFromSession;
    const matchUserId = matchUserIdFromRoute;

    // --- All State Declarations (useState) ---
    const [dynamicMatchName, setDynamicMatchName] = useState(route.params.matchName || 'Chat');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMatchMuted, setIsMatchMuted] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [isChatMutuallyInitiated, setIsChatMutuallyInitiated] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [imageViewerVisible, setImageViewerVisible] = useState(false);
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [conversationStarters, setConversationStarters] = useState<string[]>([]);
    const [loadingStarters, setLoadingStarters] = useState(false);
    const [currentStarterIndex, setCurrentStarterIndex] = useState(0);
    const [sharedEventMessage, setSharedEventMessage] = useState<string | null>(null);
    
    const [selectedMessageForAction, setSelectedMessageForAction] = useState<ChatMessage | null>(null);
    const [messageActionModalVisible, setMessageActionModalVisible] = useState(false);
    const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
    const [editText, setEditText] = useState("");
    const [replyingToMessage, setReplyingToMessage] = useState<ChatMessage | null>(null);
    const [messageInfoVisible, setMessageInfoVisible] = useState(false);
    const [messageInfoData, setMessageInfoData] = useState<any>(null);
    const [loadingMessageInfo, setLoadingMessageInfo] = useState(false);
    
    const [selectedEventDataForModal, setSelectedEventDataForModal] = useState<MappedEvent | null>(null);
    const [eventModalVisible, setEventModalVisible] = useState(false);
    const [loadingEventDetails, setLoadingEventDetails] = useState(false);
    // --- End State Declarations ---

    const flatListRef = useRef<SectionList<any>>(null);
    const isCurrentUserPremium = musicLoverProfile?.isPremium;

    // --- Callback Functions (useCallback) & Other Helpers ---

    const handleEventPressInternal = async (eventId: string) => {
        if (!eventId) return;
        console.log("[ChatScreen] Event preview pressed, Event ID:", eventId);
        setLoadingEventDetails(true);
        setSelectedEventDataForModal(null); 
        try {
            const { data: eventData, error: eventError } = await supabase
                .from('events_public_data')
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

            const organizerProfileSource = eventData.MusicLoverProfile as any; 
            const mappedEvent: MappedEvent = {
                id: eventData.event_id,
                title: eventData.event_name || "Event Title",
                date: formatEventDateTimeForModal(eventData.event_date).date, // Correctly map date part
                time: formatEventDateTimeForModal(eventData.event_date).time, // Correctly map time part
                venue: eventData.venue_name || "Venue N/A",
                images: eventData.event_poster_url ? [eventData.event_poster_url] : [DEFAULT_EVENT_IMAGE_CHAT],
                organizer: {
                    userId: organizerProfileSource?.user_id || "N/A", 
                    name: `${organizerProfileSource?.first_name || ''} ${organizerProfileSource?.last_name || ''}`.trim() || DEFAULT_ORGANIZER_NAME_CHAT,
                    image: organizerProfileSource?.profile_picture || DEFAULT_ORGANIZER_LOGO_CHAT,
                },
                description: eventData.event_description || "No description available.",
                event_datetime_iso: eventData.event_date || new Date().toISOString(),
                genres: eventData.genre_tags || [],
                artists: eventData.artist_lineup_names || [],
                songs: [], // Default as per MappedEvent if not available from source
                booking_type: null, // Default
                ticket_price: null, // Default
                pass_fee_to_user: false, // Default
                max_tickets: null, // Default
                max_reservations: null, // Default
                isViewable: true, // Default
            };
            setSelectedEventDataForModal(mappedEvent);
            setEventModalVisible(true);
        } catch (err: any) {
            console.error("Error fetching event details:", err);
            Alert.alert("Error", "Could not load event details.");
        } finally {
            setLoadingEventDetails(false);
        }
    };

    const mapDbMessageToChatMessage = useCallback((dbMessage: DbMessage): ChatMessage => {
        let sharedEventInfo: ChatMessage['sharedEvent'] = null;
        const rawContent = dbMessage.content ?? '';
        let displayText = rawContent;

        if (rawContent.startsWith('SHARED_EVENT:')) {
            try {
                const parts = rawContent.split(':');
                if (parts.length >= 3) {
                    const eventId = parts[1];
                    const detailsString = parts.slice(2).join(':');
                    let eventName = detailsString; let eventDate = 'N/A'; let eventVenue = 'N/A';
                    const onSeparator = ' on '; const atSeparator = ' at ';
                    const atIndex = detailsString.lastIndexOf(atSeparator);
                    if (atIndex !== -1) { eventVenue = detailsString.substring(atIndex + atSeparator.length); eventName = detailsString.substring(0, atIndex); }
                    const onIndex = eventName.lastIndexOf(onSeparator);
                    if (onIndex !== -1) { eventDate = eventName.substring(onIndex + onSeparator.length); eventName = eventName.substring(0, onIndex); }
                    sharedEventInfo = { eventId: eventId, eventTitle: eventName.trim(), eventDate: eventDate.trim(), eventVenue: eventVenue.trim(), eventImage: DEFAULT_EVENT_IMAGE_CHAT, };
                    displayText = `Shared an event: ${sharedEventInfo.eventTitle}`;
                } else { console.warn("SHARED_EVENT string has invalid format:", rawContent); displayText = "Shared an event"; sharedEventInfo = { eventId: "unknown", eventTitle: "Event", eventDate: "N/A", eventVenue: "N/A", eventImage: DEFAULT_EVENT_IMAGE_CHAT, }; }
            } catch (e) { console.error("Failed to parse shared event content:", rawContent, e); displayText = "Shared an event"; sharedEventInfo = { eventId: "unknown", eventTitle: "Event", eventDate: "N/A", eventVenue: "N/A", eventImage: DEFAULT_EVENT_IMAGE_CHAT, };}
        }
        return {
            _id: dbMessage.id, text: displayText, createdAt: new Date(dbMessage.created_at),
            user: { _id: dbMessage.sender_id }, image: dbMessage.image_url || null, sharedEvent: sharedEventInfo,
            originalContent: dbMessage.original_content, isEdited: dbMessage.is_edited, editedAt: dbMessage.edited_at ? new Date(dbMessage.edited_at) : null,
            isDeleted: dbMessage.is_deleted, deletedAt: dbMessage.deleted_at ? new Date(dbMessage.deleted_at) : null,
            replyToMessageId: dbMessage.reply_to_message_id, isDelivered: dbMessage.is_delivered,
            deliveredAt: dbMessage.delivered_at ? new Date(dbMessage.delivered_at) : null,
            isSeen: dbMessage.is_seen, seenAt: dbMessage.seen_at ? new Date(dbMessage.seen_at) : null,
        };
    }, []);

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
    }, [currentUserId, matchUserId, error]);

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

    const fetchMessages = useCallback(async () => {
        if (!currentUserId || !matchUserId || isBlocked) {
            if (!isBlocked && currentUserId) setLoading(true);
            return;
        }
        console.log(`[ChatScreen] Fetching messages for ${matchUserId}`);
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('messages')
                .select('*, message_status(is_delivered, delivered_at, is_seen, seen_at)')
                .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${matchUserId}),and(sender_id.eq.${matchUserId},receiver_id.eq.${currentUserId})`)
                .order('created_at', { ascending: true });

            if (fetchError) throw fetchError;

            // Fetch hidden messages for the current user
            const { data: hiddenMessagesData, error: hiddenMessagesError } = await supabase
                .from('user_hidden_messages')
                .select('message_id')
                .eq('user_id', currentUserId);
            
            if (hiddenMessagesError) {
                console.error("Error fetching hidden messages:", hiddenMessagesError);
                // Potentially proceed without filtering or show a non-critical error
            }
            const hiddenMessageIds = new Set(hiddenMessagesData?.map((h: {message_id: string}) => h.message_id) || []);

            if (data) {
                const visibleMessages = data.filter((msg: DbMessage) => !hiddenMessageIds.has(msg.id));
                const fetchedChatMessages = visibleMessages.map((dbMsg: any) => { // dbMsg can be any because of the join
                    const chatMsg = mapDbMessageToChatMessage(dbMsg as DbMessage);
                    // @ts-ignore
                    const status = dbMsg.message_status && Array.isArray(dbMsg.message_status) ? dbMsg.message_status[0] : dbMsg.message_status;
                    if (status) {
                        chatMsg.isDelivered = status.is_delivered;
                        chatMsg.deliveredAt = status.delivered_at ? new Date(status.delivered_at) : null;
                        chatMsg.isSeen = status.is_seen;
                        chatMsg.seenAt = status.seen_at ? new Date(status.seen_at) : null;
                    }
                    return chatMsg;
                });

                setMessages(fetchedChatMessages);
                checkMutualInitiation(fetchedChatMessages);
                console.log(`[ChatScreen] Fetched ${fetchedChatMessages.length} messages.`);
            } else {
                setMessages([]);
                setIsChatMutuallyInitiated(false);
                console.log(`[ChatScreen] No messages found.`);
            }
        } catch (err: any) {
            console.error("[ChatScreen] Error fetching messages:", err);
            setError("Could not load messages.");
            setMessages([]);
            setIsChatMutuallyInitiated(false);
        } finally {
            setLoading(false);
        }
    }, [currentUserId, matchUserId, isBlocked, mapDbMessageToChatMessage, checkMutualInitiation]);

    // --- Share Event (using RPC) --- 
    const shareEventToUser = useCallback(async (eventDataToShare: typeof initialSharedEventData) => {
        if (!currentUserId || !matchUserId || !eventDataToShare || isUploading) return;
        const { eventId } = eventDataToShare;

        setInputText(''); 
        setSharedEventMessage(null);
        setError(null);
        Keyboard.dismiss();

        const tempId = `temp_shared_${Date.now()}`;
        const eventMessageText = `Shared an event: ${eventDataToShare.eventTitle}`;

        let replyingToMessagePreview: ChatMessage['replyToMessagePreview'] = null;
        if (replyingToMessage) {
            replyingToMessagePreview = {
                text: replyingToMessage.image ? '[Image]' : replyingToMessage.text,
                senderName: dynamicMatchName,
                image: replyingToMessage.image
            };
        }

        const optimisticMessage: ChatMessage = {
            _id: tempId,
            text: eventMessageText,
            createdAt: new Date(),
            user: { _id: currentUserId! },
            image: null,
            sharedEvent: {
                eventId: eventDataToShare.eventId,
                eventTitle: eventDataToShare.eventTitle,
                eventDate: eventDataToShare.eventDate,
                eventVenue: eventDataToShare.eventVenue,
                eventImage: eventDataToShare.eventImage || DEFAULT_EVENT_IMAGE_CHAT,
            },
            replyToMessageId: replyingToMessage?._id || null,
            replyToMessagePreview: replyingToMessagePreview
        };
        setMessages(prev => [...prev, optimisticMessage]);
        const replyToId = replyingToMessage?._id;
        setReplyingToMessage(null);

        try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('share_event_to_user', {
                p_event_id: eventId,
                p_recipient_id: matchUserId,
                p_reply_to_message_id: replyToId || null
            });

            if (rpcError) throw rpcError;
            if (!rpcData || !rpcData.success || !rpcData.message_id) {
                throw new Error('Failed to share event via RPC or received invalid response.');
            }
            console.log('[IndividualChatScreen] Event shared to user via RPC successfully, message_id:', rpcData.message_id);
            markChatAsInitiatedInStorage(matchUserId);
            setMessages(prev => prev.map(msg => 
                msg._id === tempId ? { ...optimisticMessage, _id: rpcData.message_id } : msg
            ));

        } catch (err: any) {
            console.error("Error sharing event to user:", err);
            setError(`Event share fail: ${err.message}`);
            setMessages(prev => prev.filter(msg => msg._id !== tempId));
        }
    }, [currentUserId, matchUserId, isUploading, markChatAsInitiatedInStorage, replyingToMessage, dynamicMatchName]);

    // --- Send Message (Text only, event sharing uses RPC now) ---
    const sendTextMessage = useCallback(async (text: string) => {
         if (!currentUserId || !matchUserId || !text.trim() || isBlocked) { return; }
         const currentUserHasSentBefore = messages.some(msg => msg.user._id === currentUserId);
         const tempId = `temp_txt_${Date.now()}`;

         let replyingToMessagePreview: ChatMessage['replyToMessagePreview'] = null;
         if (replyingToMessage) {
             replyingToMessagePreview = {
                 text: replyingToMessage.image ? '[Image]' : replyingToMessage.text,
                 senderName: dynamicMatchName,
                 image: replyingToMessage.image
             };
         }

         let newMessage: ChatMessage = { 
             _id: tempId, 
             text: text.trim(), 
             createdAt: new Date(), 
             user: { _id: currentUserId },
             replyToMessageId: replyingToMessage?._id || null,
             replyToMessagePreview: replyingToMessagePreview
         }; 
         setMessages(previousMessages => [...previousMessages, newMessage]);
         setInputText('');
         const replyToId = replyingToMessage?._id;
         setReplyingToMessage(null);
         setMessages(prev => { checkMutualInitiation(prev); return prev; });
         Keyboard.dismiss();
         if (!currentUserHasSentBefore) {
             markChatAsInitiatedInStorage(matchUserId);
         }
         try {
             let insertData: any = { 
                 sender_id: currentUserId, 
                 receiver_id: matchUserId, 
                 content: newMessage.text,
                 reply_to_message_id: replyToId || null,
                };
             const { data: insertedMessage, error: insertError } = await supabase.from('messages').insert(insertData).select('id, created_at').single(); 
             if (insertError) { throw insertError; }
             if (insertedMessage) {
                setMessages(prev => prev.map(msg => 
                    msg._id === tempId ? { ...newMessage, _id: insertedMessage.id, createdAt: new Date(insertedMessage.created_at) } : msg
                ));
             }
             setError(null);
         } catch (err: any) { 
             console.error("Error sending message:", err); 
             setError("Failed to send message."); 
             setMessages(prevMessages => prevMessages.filter(msg => msg._id !== tempId)); 
             setInputText(newMessage.text); 
             checkMutualInitiation(messages.filter(msg => msg._id !== tempId)); 
         }
    }, [currentUserId, matchUserId, isBlocked, checkMutualInitiation, markChatAsInitiatedInStorage, messages, replyingToMessage, dynamicMatchName]);

    const handleSendPress = () => {
        if (sharedEventMessage && initialSharedEventData?.eventId) {
            shareEventToUser(initialSharedEventData);
        } else if (inputText.trim()) {
            sendTextMessage(inputText);
        }
    };

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
                 headerTitle: () => (
                     <TouchableOpacity
                         onPress={() => {
                             if (isChatMutuallyInitiated) {
                                 if (matchUserId) {
                                     navigation.navigate('OtherUserProfileScreen', {
                                         userId: matchUserId,
                                         fromChat: true,
                                         chatImages: messages
                                             .filter(msg => msg.image)
                                             .map(msg => msg.image!)
                                     });
                                 }
                             } else {
                                 Alert.alert(
                                     "Interaction Required",
                                     "Both you and this user need to send at least one message in this chat before you can view their profile from here."
                                 );
                             }
                         }}
                         style={styles.headerTitleContainer}
                     >
                         <Image
                             source={{ uri: route.params.matchProfilePicture ?? DEFAULT_PROFILE_PIC }}
                             style={styles.headerProfileImage}
                         />
                         <Text style={[styles.headerTitleText, isBlocked && styles.blockedText]} numberOfLines={1}>
                             {dynamicMatchName || 'Chat'}
                         </Text>
                         {isMatchMuted && !isBlocked && (
                             <Feather name="volume-x" size={16} color="#FF8C00" style={styles.muteIcon} />
                         )}
                     </TouchableOpacity>
                 ),
                 headerRight: () => (isBlocked ? <View style={{width: 30}} /> : undefined),
                 headerStyle: { backgroundColor: 'white' },
             });

        }, [navigation, dynamicMatchName, matchUserId, route.params.matchProfilePicture, fetchInteractionStatus, isBlocked, isMatchMuted, isChatMutuallyInitiated, messages]) // Add messages to dependencies
    );

    // Fetch initial messages AFTER checking block status
    useEffect(() => {
        if (!isBlocked && currentUserId && matchUserId) {
            fetchMessages();
        } else if (isBlocked) {
            setMessages([]); // Ensure messages are cleared if blocked
        }
    }, [fetchMessages, isBlocked, currentUserId, matchUserId]); // Run when block status or IDs change

    // --- Fetch Conversation Starters (Updated Logic) ---
    useEffect(() => {
        const fetchStarters = async () => {
            if (
                messages.length === 0 &&
                isCurrentUserPremium &&
                commonTags && commonTags.length > 0 &&
                matchUserId && currentUserId && !isBlocked
            ) {
                setLoadingStarters(true);
                setCurrentStarterIndex(0);
                setConversationStarters([]); // Clear previous starters

                try {
                    // Bypassing client-side cache check. Always go to Edge Function.
                    console.log('[ChatScreen] Invoking Edge Function for NEW starters for tags:', commonTags);
                    const { data: edgeFnResponse, error: edgeFnError } = await supabase.functions.invoke(
                        'get-conversation-starters', 
                        { body: { commonTags } }
                    );

                    if (edgeFnError) {
                        console.error('[ChatScreen] Edge Function invocation error:', edgeFnError.message);
                        setConversationStarters([]); 
                    } else if (edgeFnResponse?.error) {
                        console.error('[ChatScreen] Error from Edge Function logic:', edgeFnResponse.error);
                        setConversationStarters(edgeFnResponse.starters || []); 
                    } else if (edgeFnResponse?.starters && edgeFnResponse.starters.length > 0) {
                        console.log('[ChatScreen] Fetched NEW starters from Edge Function:', edgeFnResponse.starters);
                        setConversationStarters(edgeFnResponse.starters);
                        // The Edge Function would handle its own caching if it were enabled there.
                    } else {
                        console.log('[ChatScreen] Edge Function returned no starters or an unexpected format.');
                        setConversationStarters([]); 
                    }
                } catch (e: any) {
                    console.error("[ChatScreen] Critical error in fetchStarters:", e.message || e);
                    setConversationStarters([]);
                } finally {
                    setLoadingStarters(false);
                }
            } else {
                 // Conditions for fetching starters not met
                if (loadingStarters) setLoadingStarters(false);
                if (messages.length === 0) { 
                    if (!isCurrentUserPremium) console.log('[ChatScreen] User not premium, not fetching starters.');
                    else if (!commonTags || commonTags.length === 0) console.log('[ChatScreen] No common tags, not fetching starters.');
                    else if (isBlocked) console.log('[ChatScreen] Chat is blocked, not fetching starters.');
                }
            }
        };

        fetchStarters();
    }, [
        messages.length, 
        isCurrentUserPremium,
        commonTags, 
        matchUserId,
        currentUserId,
        isBlocked,
        // supabase // Removed as direct DB call for cache is gone. Invoking function is stable.
    ]);

    // Clear Conversation Starters when messages are present
    useEffect(() => {
        if (messages.length > 0 && conversationStarters.length > 0) {
            console.log('[ChatScreen] Messages are present, clearing conversation starters.');
            setConversationStarters([]);
        }
    }, [messages.length, conversationStarters.length]);

    // Real-time Subscription Setup
    useEffect(() => {
        if (!currentUserId || !matchUserId || isBlocked) {
            return () => { 
                const channelName = `chat_${[currentUserId, matchUserId].sort().join('_')}`;
                const messageStatusChannelName = `message_status_updates_${[currentUserId, matchUserId].sort().join('_')}`;
                supabase.channel(channelName).unsubscribe(); 
                supabase.channel(messageStatusChannelName).unsubscribe();
            };
        }

        console.log(`[ChatScreen] Subscribing to channel for ${matchUserId}`);
        const channelName = `chat_${[currentUserId, matchUserId].sort().join('_')}`;
        const messageChannel = supabase
            .channel(channelName)
            .on<DbMessage>(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages',
                  filter: `or(and(sender_id.eq.${currentUserId},receiver_id.eq.${matchUserId}),and(sender_id.eq.${matchUserId},receiver_id.eq.${currentUserId}))` },
                async (payload: any) => {
                    if (isBlocked) return;
                    console.log('[ChatScreen] New message received via subscription:', payload.new);
                    const newMessageDb = payload.new as DbMessage;

                    // Check if message is hidden for current user
                    const { data: hiddenCheck } = await supabase.from('user_hidden_messages').select('message_id').eq('user_id', currentUserId).eq('message_id', newMessageDb.id).maybeSingle();
                    if (hiddenCheck) return; // Skip if hidden

                    const receivedMessage = mapDbMessageToChatMessage(newMessageDb);
                    
                    // Add reply preview if it exists
                    if (receivedMessage.replyToMessageId) {
                        const repliedMsg = messages.find(m => m._id === receivedMessage.replyToMessageId) || await fetchMessageById(receivedMessage.replyToMessageId);
                        if (repliedMsg) {
                            receivedMessage.replyToMessagePreview = {
                                text: repliedMsg.image ? '[Image]' : repliedMsg.text,
                                senderName: repliedMsg.user._id === currentUserId ? musicLoverProfile?.firstName || 'You' : dynamicMatchName,
                                image: repliedMsg.image
                            };
                        }
                    }

                    if (receivedMessage.user._id === matchUserId || receivedMessage.user._id === currentUserId) { // Process if sender or receiver
                        setMessages(prevMessages => {
                            // Replace temp message or add new message
                            const existingMsgIndex = prevMessages.findIndex(msg => msg._id.startsWith('temp_') && msg.text === receivedMessage.text && msg.replyToMessageId === receivedMessage.replyToMessageId);
                            if (existingMsgIndex !== -1) {
                                const newMessages = [...prevMessages];
                                newMessages[existingMsgIndex] = receivedMessage;
                                return newMessages;
                            } else if (!prevMessages.some(msg => msg._id === receivedMessage._id)) {
                                return [...prevMessages, receivedMessage];
                            }
                            return prevMessages;
                        });
                    }
                    checkMutualInitiation([...messages, receivedMessage]);
                     // If the message is for the current user, mark as delivered
                    if (receivedMessage.user._id === matchUserId && currentUserId) { // Message from other user to me
                        markMessageDelivered(receivedMessage._id);
                    }
                }
            )
            .on<DbMessage>(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'messages',
                  filter: `or(and(sender_id.eq.${currentUserId},receiver_id.eq.${matchUserId}),and(sender_id.eq.${matchUserId},receiver_id.eq.${currentUserId}))` },
                async (payload: any) => {
                    if (isBlocked) return;
                    const updatedMessageDb = payload.new as DbMessage;
                    
                     // Check if message update is relevant (e.g., not hidden, unless it's a delete for everyone)
                    const { data: hiddenCheck } = await supabase.from('user_hidden_messages').select('message_id').eq('user_id', currentUserId).eq('message_id', updatedMessageDb.id).maybeSingle();
                    if (hiddenCheck && !updatedMessageDb.is_deleted) return; 

                    const updatedMessageUi = mapDbMessageToChatMessage(updatedMessageDb);
                    
                     // Add reply preview if it exists
                    if (updatedMessageUi.replyToMessageId) {
                        const repliedMsg = messages.find(m => m._id === updatedMessageUi.replyToMessageId) || await fetchMessageById(updatedMessageUi.replyToMessageId);
                        if (repliedMsg) {
                            updatedMessageUi.replyToMessagePreview = {
                                text: repliedMsg.image ? '[Image]' : repliedMsg.text,
                                senderName: repliedMsg.user._id === currentUserId ? musicLoverProfile?.firstName || 'You' : dynamicMatchName,
                                image: repliedMsg.image
                            };
                        }
                    }

                    setMessages(prev => prev.map(msg => 
                        msg._id === updatedMessageUi._id ? updatedMessageUi : msg
                    ));

                    if (editingMessage && editingMessage._id === updatedMessageUi._id && updatedMessageUi.isEdited && currentUserId === updatedMessageUi.user._id) {
                        setEditingMessage(null);
                        setEditText("");
                    }
                }
            )
            .subscribe();

        // Subscription for message_status updates
        const messageStatusChannelName = `message_status_updates_${[currentUserId, matchUserId].sort().join('_')}`;
        const statusChannel = supabase
            .channel(messageStatusChannelName)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'message_status',
                  filter: `message_id=in.(SELECT id FROM messages WHERE (sender_id = '${currentUserId}' AND receiver_id = '${matchUserId}') OR (sender_id = '${matchUserId}' AND receiver_id = '${currentUserId}'))`
                },
                (payload: any) => {
                    const statusUpdate = payload.new as {message_id: string; is_delivered: boolean; delivered_at: string; is_seen: boolean; seen_at: string;};
                    if (statusUpdate && statusUpdate.message_id) {
                        setMessages(prevMessages => 
                            prevMessages.map(msg => {
                                if (msg._id === statusUpdate.message_id) {
                                    return {
                                        ...msg,
                                        isDelivered: statusUpdate.is_delivered,
                                        deliveredAt: statusUpdate.delivered_at ? new Date(statusUpdate.delivered_at) : null,
                                        isSeen: statusUpdate.is_seen,
                                        seenAt: statusUpdate.seen_at ? new Date(statusUpdate.seen_at) : null,
                                    };
                                }
                                return msg;
                            })
                        );
                    }
                }
            )
            .subscribe();

        return () => {
            console.log(`[ChatScreen] Unsubscribing from channels for ${matchUserId}`);
            supabase.removeChannel(messageChannel);
            supabase.removeChannel(statusChannel);
        };
    }, [currentUserId, matchUserId, mapDbMessageToChatMessage, isBlocked, checkMutualInitiation, messages, editingMessage, musicLoverProfile, dynamicMatchName]);

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

    // Add image viewer handlers
    const handleImagePress = (imageUrl: string) => {
        // Get all images from messages
        const allImages = messages
            .filter(msg => msg.image)
            .map(msg => msg.image!);
        
        // Find the index of the clicked image
        const index = allImages.findIndex(img => img === imageUrl);
        
        if (index !== -1) {
            setSelectedImages(allImages);
            setSelectedImageIndex(index);
            setImageViewerVisible(true);
        }
    };

    // Update pickAndSendImage function
    const pickAndSendImage = useCallback(async () => {
        if (!currentUserId || !matchUserId || isUploading) {
            console.log('[pickAndSendImage] Aborted: Missing userId/matchUserId or already uploading.');
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
        setError(null);
        console.log(`[pickAndSendImage] Processing asset. URI: ${imageUri}`);

        let tempId: string | null = null;
        try {
            // Create a temporary message to show in the UI
            tempId = `temp_${Date.now()}_img`;

            let replyingToMessagePreview: ChatMessage['replyToMessagePreview'] = null;
            if (replyingToMessage) {
                replyingToMessagePreview = {
                    text: replyingToMessage.image ? '[Image]' : replyingToMessage.text,
                    senderName: dynamicMatchName,
                    image: replyingToMessage.image
                };
            }

            const optimisticMessage: ChatMessage = {
                _id: tempId,
                text: '',
                createdAt: new Date(),
                user: { _id: currentUserId },
                image: imageUri,
                replyToMessageId: replyingToMessage?._id || null,
                replyToMessagePreview: replyingToMessagePreview
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
            const filePath = `${currentUserId}/${matchUserId}/${fileName}`;

            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('individual-chat-images')
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
                .from('individual-chat-images')
                .getPublicUrl(uploadData.path);

            if (!urlData?.publicUrl) {
                throw new Error('Failed to get public URL for uploaded image');
            }

            // Insert message record with image_url
            const { data: insertedData, error: insertError } = await supabase
                .from('messages')
                .insert({
                    sender_id: currentUserId,
                    receiver_id: matchUserId,
                    content: '',
                    image_url: urlData.publicUrl,
                    reply_to_message_id: replyToId || null,
                })
                .select('id, created_at, image_url')
                .single();

            if (insertError) {
                await supabase.storage.from('individual-chat-images').remove([filePath]);
                throw insertError;
            }

            // Update the message with the final data
            setMessages(prev => prev.map(msg => 
                msg._id === tempId 
                    ? { 
                        ...optimisticMessage, 
                        _id: insertedData.id,
                        image: insertedData.image_url,
                        createdAt: new Date(insertedData.created_at)
                    } 
                    : msg
            ));

        } catch (err: any) {
            console.error('[pickAndSendImage] Error:', err);
            setError(`Failed to send image: ${err.message}`);
            if (tempId) {
                setMessages(prev => prev.filter(msg => msg._id !== tempId));
            }
        } finally {
            setIsUploading(false);
        }
    }, [currentUserId, matchUserId, isUploading, replyingToMessage, dynamicMatchName, supabase]); // Added supabase back for now, ensure it is stable

    // Handle shared event data from navigation params (for composing the message)
    useEffect(() => {
        if (initialSharedEventData && initialSharedEventData.isSharing) {
            setSharedEventMessage(JSON.stringify(initialSharedEventData)); 
            // Clear the sharing flag from route params to prevent re-triggering
            navigation.setParams({ sharedEventData: { ...initialSharedEventData, isSharing: false } });
        }
    }, [initialSharedEventData, navigation]);

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
                        <Text style={styles.sharedEventTitle} numberOfLines={1}>{initialSharedEventData.eventTitle}</Text>
                        <Text style={styles.sharedEventDetails} numberOfLines={1}>{initialSharedEventData.eventDate}</Text>
                        <Text style={styles.sharedEventDetails} numberOfLines={1}>{initialSharedEventData.eventVenue}</Text>
                    </View>
                </View>
                <TouchableOpacity 
                    style={styles.sharedEventCloseButton}
                    onPress={() => {
                        setSharedEventMessage(null); // Clear the shared event message state
                        // Optionally clear the initialSharedEventData from route params if it was set via navigation.setParams
                        // navigation.setParams({ sharedEventData: undefined } as any);
                    }}
                >
                    <Feather name="x" size={18} color="#9CA3AF" />
                </TouchableOpacity>
            </View>
        );
    };

    // --- New Chat Feature Handlers ---

    const handleMessageLongPress = (message: ChatMessage) => {
        if (message.isDeleted) return; // Don't show actions for already deleted messages
        setSelectedMessageForAction(message);
        setMessageActionModalVisible(true);
    };

    const handleReply = () => {
        if (!selectedMessageForAction) return;
        setReplyingToMessage(selectedMessageForAction);
        setMessageActionModalVisible(false);
        setSelectedMessageForAction(null);
    };

    const handleEdit = () => {
        if (!selectedMessageForAction || selectedMessageForAction.user._id !== currentUserId || selectedMessageForAction.image || selectedMessageForAction.sharedEvent) {
             Alert.alert("Cannot Edit", "You can only edit your own text messages.");
            return;
        }
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
            const { error } = await supabase.rpc('edit_message', {
                message_id_input: editingMessage._id,
                new_content: editText.trim(),
            });
            if (error) throw error;
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
        if (!selectedMessageForAction || selectedMessageForAction.user._id !== currentUserId) {
            Alert.alert("Cannot Delete", "You can only delete your own messages for everyone.");
            return;
        }
        try {
            const { error } = await supabase.rpc('delete_chat_message', {
                message_id_input: selectedMessageForAction._id,
            });
            if (error) throw error;
            setMessages(prev => prev.map(msg => 
                msg._id === selectedMessageForAction._id 
                ? { ...msg, 
                    text: 'This message was deleted', 
                    isDeleted: true, 
                    deletedAt: new Date(),
                    image: null, 
                    sharedEvent: null 
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
        if (!selectedMessageForAction || selectedMessageForAction.user._id !== currentUserId) {
            // For individual chats, info is usually only relevant for own messages (sent, delivered, seen)
            // Or, if we want to show when the *other* user's message was delivered/seen by *us* - this needs clarification
             Alert.alert("Info", "Message status is shown with checkmarks.");
             setMessageActionModalVisible(false);
             setSelectedMessageForAction(null);
            return;
        }
        setMessageActionModalVisible(false);
        setLoadingMessageInfo(true);
        setMessageInfoVisible(true);
        try {
            const { data, error } = await supabase.rpc('get_individual_message_status', {
                message_id_input: selectedMessageForAction._id
            });
            if (error) throw error;
            setMessageInfoData(data);
        } catch (err: any) {
            Alert.alert("Error", `Failed to get message info: ${err.message}`);
            setMessageInfoVisible(false); 
        } finally {
            setLoadingMessageInfo(false);
            setSelectedMessageForAction(null); 
        }
    };

    const getRepliedMessagePreview = (messageId: string): ChatMessage['replyToMessagePreview'] | null => {
        const repliedMsg = messages.find(msg => msg._id === messageId);
        if (repliedMsg) {
            return {
                text: repliedMsg.image ? '[Image]' : repliedMsg.text,
                senderName: repliedMsg.user._id === currentUserId ? musicLoverProfile?.firstName || 'You' : dynamicMatchName,
                image: repliedMsg.image
            };
        }
        return null;
    };

    // Function to mark a message as delivered (called when a message is received by this user)
    const markMessageDelivered = async (messageId: string) => {
        if (!currentUserId) return;
        try {
            const { error } = await supabase.rpc('mark_message_delivered', { message_id_input: messageId });
            if (error) console.error('Error marking message delivered:', error);
            else {
                console.log(`Message ${messageId} marked as delivered.`);
                 // Optimistically update UI or rely on subscription to message_status table
                setMessages(prev => prev.map(m => m._id === messageId ? {...m, isDelivered: true, deliveredAt: new Date()} : m));
            }
        } catch (e) {
            console.error('Exception marking message delivered:', e);
        }
    };

    // Function to mark messages as seen when the chat screen is focused or messages are visible
    const markMessagesAsSeen = useCallback(async () => {
        if (!currentUserId || !matchUserId || messages.length === 0) return;

        const unseenMessagesFromOtherUser = messages.filter(
            msg => msg.user._id === matchUserId && !msg.isSeen
        );

        if (unseenMessagesFromOtherUser.length === 0) return;

        console.log(`[ChatScreen] Marking ${unseenMessagesFromOtherUser.length} messages as seen from ${matchUserId}`);

        for (const message of unseenMessagesFromOtherUser) {
            try {
                const { error } = await supabase.rpc('mark_message_seen', { message_id_input: message._id });
                if (error) {
                    console.error(`Error marking message ${message._id} as seen:`, error.message);
                } else {
                    // Optimistically update UI or rely on subscription
                    setMessages(prev => prev.map(m => m._id === message._id ? {...m, isSeen: true, seenAt: new Date()} : m));
                }
            } catch (e: any) {
                console.error(`Exception marking message ${message._id} as seen:`, e.message);
            }
        }
    }, [currentUserId, matchUserId, messages, supabase]);

    // Call markMessagesAsSeen when the screen focuses and when new messages arrive from the other user
    useFocusEffect(
        useCallback(() => {
            markMessagesAsSeen();
        }, [markMessagesAsSeen])
    );
    useEffect(() => {
        // Also mark as seen if new messages arrive while screen is focused
        markMessagesAsSeen();
    }, [messages, markMessagesAsSeen]);

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

                {/* Conversation Starters */}
                {loadingStarters && messages.length === 0 && (
                    <View style={styles.startersLoadingContainer}>
                        <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} />
                        <Text style={styles.startersLoadingText}>Loading conversation starters...</Text>
                    </View>
                )}
                {!loadingStarters && conversationStarters.length > 0 && !isBlocked && messages.length === 0 && (
                    <View style={styles.startersOuterContainer}>
                        <Text style={styles.startersTitle}>Try these conversation starters:</Text>
                        <View style={styles.startersNavigationContainer}>
                            <TouchableOpacity
                                onPress={() => setCurrentStarterIndex(prev => Math.max(0, prev - 1))}
                                disabled={currentStarterIndex === 0}
                                style={[styles.starterNavButton, currentStarterIndex === 0 && styles.starterNavButtonDisabled]}
                            >
                                <Feather name="chevron-left" size={20} color={currentStarterIndex === 0 ? '#CBD5E1' : APP_CONSTANTS.COLORS.PRIMARY} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.starterButton}
                                onPress={() => {
                                    setInputText(conversationStarters[currentStarterIndex]);
                                }}
                            >
                                <Text style={styles.starterText} numberOfLines={3}>
                                    {conversationStarters[currentStarterIndex]}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setCurrentStarterIndex(prev => Math.min(conversationStarters.length - 1, prev + 1))}
                                disabled={currentStarterIndex === conversationStarters.length - 1}
                                style={[styles.starterNavButton, currentStarterIndex === conversationStarters.length - 1 && styles.starterNavButtonDisabled]}
                            >
                                <Feather name="chevron-right" size={20} color={currentStarterIndex === conversationStarters.length - 1 ? '#CBD5E1' : APP_CONSTANTS.COLORS.PRIMARY} />
                            </TouchableOpacity>
                        </View>
                         {conversationStarters.length > 1 && (
                            <Text style={styles.starterCounterText}>
                                {currentStarterIndex + 1} / {conversationStarters.length}
                            </Text>
                        )}
                    </View>
                )}

                <SectionList
                    ref={flatListRef}
                    sections={sections}
                    style={styles.messageList}
                    contentContainerStyle={styles.messageListContent}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <MessageBubble 
                            message={item} 
                            currentUserId={currentUserId} 
                            onImagePress={handleImagePress}
                            onEventPress={handleEventPressInternal}
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
                            <Text style={styles.replyingToTitle} numberOfLines={1}>Replying to {replyingToMessage.user._id === currentUserId ? 'Yourself' : dynamicMatchName}</Text>
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

                <View style={styles.inputToolbar}>
                    <TouchableOpacity 
                        style={styles.attachButton} 
                        onPress={pickAndSendImage} 
                        disabled={isUploading || isBlocked}
                    >
                        {isUploading ? (
                            <ActivityIndicator size="small" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} />
                        ) : (
                            <Feather name="paperclip" size={22} color="#52525b" />
                        )}
                    </TouchableOpacity>
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
                        style={[styles.sendButton, ((!inputText.trim() && !sharedEventMessage) || isBlocked) && styles.sendButtonDisabled]}
                        onPress={handleSendPress}
                        disabled={(!inputText.trim() && !sharedEventMessage) || isBlocked}
                    >
                        <Feather name="send" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {imageViewerVisible && selectedImages.length > 0 && (
                <ImageViewer
                    imageUrls={selectedImages.map(url => ({ url }))}
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
                            {/* Message Info for own messages in individual chat */}
                            {selectedMessageForAction.user._id === currentUserId && (
                                <TouchableOpacity style={styles.actionModalButton} onPress={handleShowMessageInfo}>
                                    <Feather name="info" size={20} color="#3B82F6" style={styles.actionModalIcon}/>
                                    <Text style={styles.actionModalButtonText}>Info</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity style={styles.actionModalButton} onPress={handleDeleteForMe}>
                                <Feather name="trash" size={20} color="#EF4444" style={styles.actionModalIcon}/>
                                <Text style={[styles.actionModalButtonText, {color: '#EF4444'}]}>Delete for Me</Text>
                            </TouchableOpacity>

                            {selectedMessageForAction.user._id === currentUserId && (
                                <TouchableOpacity style={styles.actionModalButton} onPress={handleDeleteForEveryone}>
                                    <Feather name="trash-2" size={20} color="#EF4444" style={styles.actionModalIcon}/>
                                    <Text style={[styles.actionModalButtonText, {color: '#EF4444'}]}>Delete for Everyone</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>
            </Modal>

            {/* Editing Message Modal */}
            {editingMessage && (
                <Modal
                    visible={true} 
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

            {/* Message Info Modal (for individual messages) */}
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
                        <View>
                            <Text style={styles.messageInfoText}>Status for your message:</Text>
                            <Text style={styles.messageInfoDetailText}>Sent: {formatTime(new Date(messageInfoData.sent_at || Date.now()))}</Text>
                            {messageInfoData.is_delivered && messageInfoData.delivered_at && 
                                <Text style={styles.messageInfoDetailText}>Delivered: {formatTime(new Date(messageInfoData.delivered_at))}</Text>}
                            {!messageInfoData.is_delivered && 
                                <Text style={styles.messageInfoDetailText}>Delivered: Not yet</Text>}
                            {messageInfoData.is_seen && messageInfoData.seen_at && 
                                <Text style={styles.messageInfoDetailText}>Seen: {formatTime(new Date(messageInfoData.seen_at))}</Text>}
                            {!messageInfoData.is_seen && 
                                <Text style={styles.messageInfoDetailText}>Seen: Not yet</Text>}
                            {messageInfoData.is_edited && messageInfoData.edited_at && 
                                <Text style={styles.messageInfoDetailText}>Edited: {formatTime(new Date(messageInfoData.edited_at))}</Text>}
                        </View>
                    ) : (
                        <Text>No information available.</Text>
                    )}
                    <TouchableOpacity style={styles.messageInfoCloseButton} onPress={() => setMessageInfoVisible(false)}>
                        <Text style={styles.messageInfoCloseButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
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
    messageContentContainer: {
        maxWidth: '100%',
    },
    messageBubble: {
        borderRadius: 15,
        overflow: 'hidden',
        padding: 0,
        backgroundColor: 'transparent',
        alignSelf: 'flex-start',
        maxWidth: 210,
        maxHeight: 210,
    },
    messageBubbleSent: {
        backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6',
        borderBottomRightRadius: 4,
        alignSelf: 'flex-end',
        paddingVertical: 8,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
    },
    messageBubbleReceived: {
        backgroundColor: '#E5E7EB',
        borderBottomLeftRadius: 4,
        alignSelf: 'flex-start',
        paddingVertical: 8,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
    },
    messageTextSent: { color: '#FFFFFF', fontSize: 15, },
    messageTextReceived: { color: '#1F2937', fontSize: 15, },
    inputToolbar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF', },
    textInput: { flex: 1, minHeight: 40, maxHeight: 120, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 15, marginRight: 10, color: '#1F2937', },
    sendButton: { backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', },
    sendButtonDisabled: { backgroundColor: '#9CA3AF', },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerProfileImage: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 8,
    },
    headerTitleText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000',
    },
    blockedText: {
        color: '#999',
    },
    muteIcon: {
        marginLeft: 4,
    },
    timeText: {
        fontSize: 10,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeTextBelowBubble: {
        marginTop: 2,
        paddingHorizontal: 5,
        color: '#9CA3AF',
    },
    timeTextSent: {
        alignSelf: 'flex-end',
        marginRight: 5
    },
    timeTextReceived: {
        alignSelf: 'flex-start',
        marginLeft: 0
    },
    sectionHeader: {
        alignItems: 'center',
        marginVertical: 10,
        backgroundColor: '#FFFFFF',
    },
    sectionHeaderText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    imageBubble: {
        borderRadius: 15,
        overflow: 'hidden',
        padding: 0,
        backgroundColor: 'transparent',
        alignSelf: 'flex-start',
        maxWidth: 210,
        maxHeight: 210,
    },
    messageBubbleSentImage: {
        alignSelf: 'flex-end',
        backgroundColor: 'transparent',
        borderBottomRightRadius: 4,
    },
    messageBubbleReceivedImage: {
        alignSelf: 'flex-start',
        backgroundColor: 'transparent',
        borderBottomLeftRadius: 4,
    },
    chatImage: {
        width: 200,
        height: 200,
        borderRadius: 14,
    },
    imageErrorOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    imageErrorText: {
        color: '#fff',
        fontSize: 12,
        marginTop: 4,
    },
    attachButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 5,
        marginBottom: Platform.OS === 'ios' ? 0 : 1,
    },
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
    startersContainer: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#F9F9F9',
    },
    startersOuterContainer: {
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#F9F9F9',
        alignItems: 'center',
    },
    startersNavigationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 10,
        marginTop: 8,
    },
    starterNavButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT || '#A5B4FC',
    },
    starterNavButtonDisabled: {
        backgroundColor: '#F3F4F6',
        borderColor: '#E5E7EB',
    },
    startersTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4B5563',
        marginBottom: 0,
    },
    startersScrollContent: {
        paddingRight: 10,
    },
    starterButton: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 16,
        marginHorizontal: 8,
        borderWidth: 1,
        borderColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT || '#A5B4FC',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
        elevation: 1,
        minHeight: 60,
        justifyContent: 'center',
    },
    starterText: {
        fontSize: 13,
        color: APP_CONSTANTS.COLORS.PRIMARY || '#3B82F6',
        textAlign: 'center',
    },
    starterCounterText: {
        fontSize: 11,
        color: '#9CA3AF',
        marginTop: 4,
    },
    startersLoadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        backgroundColor: '#F9F9F9',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    startersLoadingText: {
        marginLeft: 10,
        fontSize: 13,
        color: '#4B5563',
    },
    sharedEventContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        backgroundColor: '#F9F9F9',
    },
    sharedEventContent: {
        flexDirection: 'row',
        alignItems: 'center',
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
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
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
    messageInfoText: {
        fontSize: 15,
        color: '#374151',
        marginBottom: 10,
    },
    messageInfoDetailText: {
        fontSize: 14,
        color: '#4B5563',
        marginBottom: 5,
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
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    modalContent: { 
        backgroundColor: 'white', 
        borderRadius: 12, 
        padding: 25, 
        marginHorizontal: '10%', 
        marginTop: '30%', 
        shadowColor: "#000", 
        shadowOffset: { width: 0, height: 2 }, 
        shadowOpacity: 0.25, 
        shadowRadius: 4, 
        elevation: 5, 
        minHeight: 200 
    },
    modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 20, textAlign: 'center', color: '#1F2937', },
    modalInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, marginBottom: 25, minHeight: 60, textAlignVertical: 'top' },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', },
    modalButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center', minWidth: 90, },
    modalButtonCancel: { backgroundColor: '#E5E7EB', },
    modalButtonSave: { backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', },
    modalButtonDisabled: { backgroundColor: '#A5B4FC', },
    modalButtonTextCancel: { color: '#4B5563', fontWeight: '500', },
    modalButtonTextSave: { color: 'white', fontWeight: '600', },
    imageViewerContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Styles for deleted messages, edited indicator, reply previews (adapted from GroupChatScreen)
    deletedMessageBubble: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E5E7EB', // Consistent with received bubble
        opacity: 0.8,
    },
    deletedMessageText: {
        fontSize: 14,
        fontStyle: 'italic',
        color: '#6B7280',
    },
    editedIndicator: {
        fontSize: 10,
        fontStyle: 'italic',
        marginLeft: 4, // Add some margin if it's next to text
    },
    editedIndicatorSent: {
        color: 'rgba(255, 255, 255, 0.7)',
    },
    editedIndicatorReceived: {
        color: '#6B7280',
    },
    editedIndicatorImage: { // For images, position might need adjustment or be overlayed
        position: 'absolute',
        bottom: 5,
        right: 5,
        backgroundColor: 'rgba(0,0,0,0.4)',
        color: 'white',
        paddingHorizontal: 4,
        borderRadius: 3,
        fontSize: 9,
    },
    messageRowTouchable: { // Used for messages that have long-press actions
        flexDirection: 'row',
        marginVertical: 4, // same as messageRow
        alignItems: 'flex-end',
    },
    replyPreviewContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.03)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        marginBottom: -2, // To slightly overlap with the message bubble below
        maxWidth: '90%', // Constrain width
    },
    replyPreviewSent: { // Style for reply preview on a sent message
        alignSelf: 'flex-end',
        borderLeftColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6',
        borderLeftWidth: 3,
    },
    replyPreviewReceived: { // Style for reply preview on a received message
        alignSelf: 'flex-start',
        borderLeftColor: '#A0AEC0', // A neutral color
        borderLeftWidth: 3,
    },
    replyPreviewBorder: {
        // This view is used for the colored border, already styled by replyPreviewSent/Received
    },
    replyPreviewContent: {
        marginLeft: 6,
        flexShrink: 1, // Allow text to shrink
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
});

// Helper to fetch a single message by ID (e.g., for reply previews if not in current `messages` state)
const fetchMessageById = async (messageId: string): Promise<ChatMessage | null> => {
    try {
        const { data: dbMessage, error } = await supabase
            .from('messages')
            .select('*, message_status(is_delivered, delivered_at, is_seen, seen_at)')
            .eq('id', messageId)
            .single();
        if (error || !dbMessage) throw error || new Error('Message not found');
        
        // Simplified mapDbMessageToChatMessage for this context
        let sharedEventInfo: ChatMessage['sharedEvent'] = null;
        const rawContent = dbMessage.content ?? '';
        let displayText = rawContent;
        if (rawContent.startsWith('SHARED_EVENT:')) {
             try {
                const parts = rawContent.split(':');
                if (parts.length >= 3) {
                    const eventId = parts[1]; const detailsString = parts.slice(2).join(':');
                    let eventName = detailsString; let eventDate = 'N/A'; let eventVenue = 'N/A';
                    const onSeparator = ' on '; const atSeparator = ' at ';
                    const atIndex = detailsString.lastIndexOf(atSeparator);
                    if (atIndex !== -1) { eventVenue = detailsString.substring(atIndex + atSeparator.length); eventName = detailsString.substring(0, atIndex); }
                    const onIndex = eventName.lastIndexOf(onSeparator);
                    if (onIndex !== -1) { eventDate = eventName.substring(onIndex + onSeparator.length); eventName = eventName.substring(0, onIndex); }
                    sharedEventInfo = { eventId: eventId, eventTitle: eventName.trim(), eventDate: eventDate.trim(), eventVenue: eventVenue.trim(), eventImage: DEFAULT_EVENT_IMAGE_CHAT, };
                    displayText = `Shared an event: ${sharedEventInfo.eventTitle}`; 
                }
            } catch (e) { console.error("Failed to parse shared event content for reply:", rawContent, e); }
        }
        const chatMsg: ChatMessage = {
            _id: dbMessage.id,
            text: displayText,
            createdAt: new Date(dbMessage.created_at),
            user: { _id: dbMessage.sender_id },
            image: dbMessage.image_url || null,
            sharedEvent: sharedEventInfo,
            originalContent: dbMessage.original_content,
            isEdited: dbMessage.is_edited,
            editedAt: dbMessage.edited_at ? new Date(dbMessage.edited_at) : null,
            isDeleted: dbMessage.is_deleted,
            deletedAt: dbMessage.deleted_at ? new Date(dbMessage.deleted_at) : null,
            replyToMessageId: dbMessage.reply_to_message_id,
        };
        // @ts-ignore - dbMessage can be complex due to join
        const status = dbMessage.message_status && Array.isArray(dbMessage.message_status) ? dbMessage.message_status[0] : dbMessage.message_status;
        if (status) {
            chatMsg.isDelivered = status.is_delivered;
            chatMsg.deliveredAt = status.delivered_at ? new Date(status.delivered_at) : null;
            chatMsg.isSeen = status.is_seen;
            chatMsg.seenAt = status.seen_at ? new Date(status.seen_at) : null;
        }
        return chatMsg;

    } catch (err) {
        console.error("Failed to fetch message by ID for reply preview:", err);
        return null;
    }
};

export default IndividualChatScreen;