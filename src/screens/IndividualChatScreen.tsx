// screens/IndividualChatScreen.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import {
    View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Pressable,
    Platform, TextInput, SectionList, KeyboardAvoidingView, Keyboard,
    Image, Alert, Modal, ScrollView, AppState
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
import { useRealtime } from '@/context/RealtimeContext'; // Import useRealtime
import UnifiedNotificationService from '@/services/UnifiedNotificationService';
import { useUnreadCount } from '@/hooks/useUnreadCount';

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
      eventDateTime?: string; // Add the ISO datetime field
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
            eventDateTime?: string;
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
        eventDateTime?: string | null; // Add the ISO datetime field
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
    onReplyPress: (messageId: string) => void;
    getRepliedMessagePreview: (messageId: string) => ChatMessage['replyToMessagePreview'] | null;
    isHighlighted?: boolean;
}

// Add DEFAULT_PROFILE_PIC constant
const DEFAULT_PROFILE_PIC = APP_CONSTANTS.DEFAULT_PROFILE_PIC;
const DEFAULT_EVENT_IMAGE_CHAT = "https://picsum.photos/800/450?random=1"; // Changed to a more reliable placeholder
const DEFAULT_ORGANIZER_LOGO_CHAT = "https://picsum.photos/150/150?random=2"; // Changed to a more reliable placeholder
const DEFAULT_ORGANIZER_NAME_CHAT = "Event Organizer";

// Helper to format timestamps
const formatTime = (date: Date) => {
    try {
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '--:--';
    }
};

// Helper to check if event is over
const isEventOver = (eventDateString: string): boolean => {
    try {
        console.log('[DEBUG] Checking if event is over, date string:', eventDateString);
        
        // First, try direct parsing
        let eventDate = new Date(eventDateString);
        const now = new Date();
        
        // If direct parsing failed, try other formats
        if (isNaN(eventDate.getTime())) {
            // Try to parse common date formats manually
            const dateFormats = [
                eventDateString, // Original format
                eventDateString.replace(/(\d+)(st|nd|rd|th)/, '$1'), // Remove ordinal suffixes
                // Handle formats like "Dec 15, 2024" or "December 15, 2024"
                eventDateString.replace(/(\w+)\s+(\d+),?\s+(\d{4})/, '$1 $2, $3'),
                // Handle formats like "Dec 15" (assume current year)
                eventDateString.includes(',') ? eventDateString : `${eventDateString}, ${new Date().getFullYear()}`,
            ];
            
            for (const format of dateFormats) {
                const parsed = new Date(format);
                console.log('[DEBUG] Trying format:', format, 'Result:', parsed.toISOString(), 'Valid:', !isNaN(parsed.getTime()));
                if (!isNaN(parsed.getTime())) {
                    eventDate = parsed;
                    break;
                }
            }
            
            // If still couldn't parse, assume event is not over
            if (isNaN(eventDate.getTime())) {
                console.log('[DEBUG] Could not parse event date, assuming not over:', eventDateString);
                return false;
            }
        }
        
        const isOver = eventDate < now;
        console.log('[DEBUG] Event date:', eventDate.toISOString(), 'Now:', now.toISOString(), 'Is over:', isOver);
        return isOver;
    } catch (e) {
        console.warn('Error checking if event is over:', e);
        return false;
    }
};

// Helper to check if event is over using sharedEvent data
const isSharedEventOver = (sharedEvent: ChatMessage['sharedEvent']): boolean => {
    if (!sharedEvent) return false;
    
    // Use eventDateTime if available (more accurate) - this should be the primary method
    if (sharedEvent.eventDateTime) {
        try {
            const eventDate = new Date(sharedEvent.eventDateTime);
            const now = new Date();
            
            // Validate the parsed date
            if (isNaN(eventDate.getTime())) {
                console.warn('Invalid eventDateTime:', sharedEvent.eventDateTime);
            } else {
                const isOver = eventDate < now;
                console.log('[DEBUG] Using eventDateTime:', sharedEvent.eventDateTime, 'Is over:', isOver);
                return isOver;
            }
        } catch (e) {
            console.warn('Error parsing eventDateTime:', sharedEvent.eventDateTime, e);
        }
    }
    
    // Fallback to eventDate string parsing (less reliable due to formatting issues)
    if (sharedEvent.eventDate) {
        console.log('[DEBUG] Falling back to eventDate string parsing for:', sharedEvent.eventDate);
        return isEventOver(sharedEvent.eventDate);
    }
    
    return false;
};

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
    onReplyPress,
    getRepliedMessagePreview,
    isHighlighted
}) => {
    const isCurrentUser = message.user._id === currentUserId;
    const [imageError, setImageError] = useState(false);
    const [hasLoggedImpression, setHasLoggedImpression] = useState(false);
    
    // Debug: Log when isSeen changes for sender's messages
    useEffect(() => {
        if (isCurrentUser) {
            console.log('[MessageBubble] Message seen status:', {
                messageId: message._id,
                isSeen: message.isSeen,
                seenAt: message.seenAt
            });
        }
    }, [message.isSeen, message.seenAt, isCurrentUser, message._id]);
    const navigation = useNavigation<RootNavigationProp>();

    // Log impression for shared events when message bubble comes into view
    useEffect(() => {
        if (message.sharedEvent?.eventId && !hasLoggedImpression) {
            // Check if event is over - don't log impressions for past events
            const eventIsOver = isSharedEventOver(message.sharedEvent);
            if (eventIsOver) {
                console.log(`[IMPRESSION] Skipping impression for past event: ${message.sharedEvent.eventId}`);
                return;
            }
            
            const logEventImpression = async () => {
                try {
                    console.log(`[IMPRESSION] Logging impression for future event: ${message.sharedEvent?.eventId} from individual chat`);
                    const { error } = await supabase.from('event_impressions').insert({
                        event_id: message.sharedEvent?.eventId,
                        user_id: currentUserId || null,
                        source: 'individual_chat',
                        viewed_at: new Date().toISOString()
                    });
                    
                    if (error) {
                        console.warn(`[IMPRESSION] Failed for shared event ${message.sharedEvent?.eventId}:`, error.message);
                    } else {
                        console.log(`[IMPRESSION] Successfully logged for future event ${message.sharedEvent?.eventId} by user ${currentUserId || 'anonymous'}`);
                        setHasLoggedImpression(true);
                    }
                } catch (err) {
                    console.error("[IMPRESSION] Failed to log impression:", err);
                }
            };
            
            // Add a small delay to ensure the message is actually visible to the user
            const timeoutId = setTimeout(() => {
                logEventImpression();
            }, 100);
            
            return () => clearTimeout(timeoutId);
        }
    }, [message.sharedEvent?.eventId, currentUserId, hasLoggedImpression]);

    // Handle event press 
    const handleEventPress = () => {
        if (message.sharedEvent?.eventId && onEventPress) {
            // Check if event is over - if so, don't open modal
            if (isSharedEventOver(message.sharedEvent)) {
                return; // Don't open modal for past events
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
                        <Feather name="slash" size={14} color={isCurrentUser ? "rgba(255,255,255,0.7)" : "#9CA3AF"} style={{marginRight: 6}}/>
                        <Text style={[styles.deletedMessageText, isCurrentUser ? styles.messageTextSent : styles.messageTextReceived]}>
                            This message was deleted
                        </Text>
                    </View>
                    <Text style={[styles.timeText, isCurrentUser ? styles.timeTextSent : styles.timeTextReceived]}>
                        {formatTime(message.createdAt)}
                        {isCurrentUser && message.isSeen && <Feather name="check-circle" size={12} color="#34D399" style={{ marginLeft: 4 }} />} 
                    </Text>
                </View>
            </View>
        );
    }

    const repliedMessagePreview = message.replyToMessageId ? getRepliedMessagePreview(message.replyToMessageId) : null;

    // Shared Event Message
    if (message.sharedEvent) {
        const eventIsOver = isSharedEventOver(message.sharedEvent);
        
        return (
            <TouchableOpacity
                style={[styles.messageRowTouchable, isCurrentUser ? styles.messageRowSent : styles.messageRowReceived]}
                onLongPress={() => onMessageLongPress(message)}
                delayLongPress={200}
                activeOpacity={0.8}
            >
                <View style={styles.messageContentContainer}>
                    <View style={[
                        styles.messageBubble, 
                        styles.sharedEventMessageBubble,
                        isCurrentUser ? styles.messageBubbleSent : styles.messageBubbleReceived
                    ]}>
                        <Text style={[
                            styles.messageText,
                            isCurrentUser ? styles.messageTextSent : styles.messageTextReceived
                        ]}>
                            {message.text}
                        </Text>
                        
                        <TouchableOpacity 
                            style={[
                                styles.sharedEventPreview,
                                eventIsOver && styles.sharedEventPreviewDisabled
                            ]}
                            onPress={eventIsOver ? undefined : handleEventPress}
                            activeOpacity={eventIsOver ? 1 : 0.7}
                            disabled={eventIsOver}
                        >
                            <Image 
                                source={{ uri: message.sharedEvent.eventImage || DEFAULT_EVENT_IMAGE_CHAT }}
                                style={[
                                    styles.sharedEventPreviewImage,
                                    eventIsOver && styles.sharedEventPreviewImageDisabled
                                ]}
                                resizeMode="cover"
                                onError={() => setImageError(true)}
                            />
                            {imageError && (
                                <View style={styles.imageErrorOverlay}>
                                    <Feather name="image" size={20} color="#FFFFFF" />
                                </View>
                            )}
                            {eventIsOver && (
                                <View style={styles.eventOverOverlay}>
                                    <Text style={styles.eventOverText}>Event is Over</Text>
                                </View>
                            )}
                            <View style={styles.sharedEventPreviewContent}>
                                {eventIsOver ? (
                                    <>
                                        <Text style={[styles.sharedEventPreviewTitle, styles.eventOverTitle]} numberOfLines={1}>
                                            {message.sharedEvent.eventTitle}
                                        </Text>
                                        <Text style={[styles.sharedEventPreviewDetails, styles.eventOverDetails]} numberOfLines={1}>
                                            Event is Over
                                        </Text>
                                    </>
                                ) : (
                                    <>
                                        <Text style={styles.sharedEventPreviewTitle} numberOfLines={1}>
                                            {message.sharedEvent.eventTitle}
                                        </Text>
                                        <Text style={styles.sharedEventPreviewDetails} numberOfLines={1}>
                                            {message.sharedEvent.eventDate}
                                        </Text>
                                        <Text style={styles.sharedEventPreviewDetails} numberOfLines={1}>
                                            {message.sharedEvent.eventVenue}
                                        </Text>
                                    </>
                                )}
                            </View>
                        </TouchableOpacity>
                        <View style={styles.timeAndEditContainer}>
                            {message.isEdited && <Text style={[styles.editedIndicator, isCurrentUser ? styles.editedIndicatorSent : styles.editedIndicatorReceived]}>(edited)</Text>}
                            <Text style={[styles.timeText, styles.timeTextInsideBubble, isCurrentUser ? styles.timeTextInsideSentBubble : styles.timeTextInsideReceivedBubble]}>
                                {formatTime(message.createdAt)}
                                {isCurrentUser && message.isSeen && <Feather name="check-circle" size={12} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />} 
                            </Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    }

    // Image Message
    if (message.image) {
        return (
            <Pressable
                style={[styles.messageRowTouchable, isCurrentUser ? styles.messageRowSent : styles.messageRowReceived]}
                onLongPress={() => {
                    console.log('[DEBUG] Long press detected on image message:', message._id);
                    onMessageLongPress(message);
                }}
                onPress={() => {
                    console.log('[DEBUG] Image tap detected for:', message.image);
                    onImagePress(message.image!);
                }}
                delayLongPress={200}
                android_ripple={{ color: 'rgba(0,0,0,0.1)', borderless: false }}
            >
                <View style={styles.messageContentContainer}>
                    {/* Reply Preview for Image */} 
                    {repliedMessagePreview && (
                        <TouchableOpacity 
                            style={[styles.replyPreviewContainer, isCurrentUser ? styles.replyPreviewSent : styles.replyPreviewReceived]}
                            onPress={() => message.replyToMessageId && onReplyPress(message.replyToMessageId)}
                            activeOpacity={0.7}
                        >
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
                        </TouchableOpacity>
                    )}
                    <View style={[styles.messageBubble, styles.imageBubble, isCurrentUser ? styles.messageBubbleSentImage : styles.messageBubbleReceivedImage, isHighlighted && styles.highlightedImageBubble]}>
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
                        {message.isEdited && <Text style={styles.editedIndicatorImage}>(edited)</Text>}
                    </View>
                    <Text style={[styles.timeText, isCurrentUser ? styles.timeTextSent : styles.timeTextReceived]}>
                        {formatTime(message.createdAt)}
                        {isCurrentUser && message.isSeen && <Feather name="check-circle" size={12} color="#34D399" style={{ marginLeft: 4 }} />} 
                    </Text>
                </View>
            </Pressable>
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
                    <Text style={[styles.messageText, isCurrentUser ? styles.messageTextSent : styles.messageTextReceived]}>
                        {message.text}
                    </Text>
                    <View style={styles.timeAndEditContainer}>
                        {message.isEdited && <Text style={[styles.editedIndicator, isCurrentUser ? styles.editedIndicatorSent : styles.editedIndicatorReceived]}>(edited)</Text>}
                        <Text style={[styles.timeText, styles.timeTextInsideBubble, isCurrentUser ? styles.timeTextInsideSentBubble : styles.timeTextInsideReceivedBubble]}>
                            {formatTime(message.createdAt)}
                            {isCurrentUser && message.isSeen && <Feather name="check-circle" size={12} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />} 
                        </Text>
                    </View>
                </View>
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
    const { presenceState, subscribeToIndividualChat, sendIndividualTypingIndicator, sendBroadcast, subscribeToEvent, unsubscribeFromEvent } = useRealtime();
    const { refreshUnreadCount } = useUnreadCount();

    const currentUserIdFromSession = session?.user?.id;
    const { 
        matchUserId: matchUserIdFromRoute,
        matchName,
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
    
    const [isTyping, setIsTyping] = useState(false);
    const [isMatchOnline, setIsMatchOnline] = useState(false);
    
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
    
    // Forward functionality states
    const [forwardModalVisible, setForwardModalVisible] = useState(false);
    const [forwardMessage, setForwardMessage] = useState<ChatMessage | null>(null);
    const [availableChats, setAvailableChats] = useState<Array<{id: string, name: string, type: 'individual' | 'group'}>>([]);
    const [loadingChats, setLoadingChats] = useState(false);
    // --- End State Declarations ---

    // --- State for message highlighting ---
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
    // --- End State for message highlighting ---

    // --- State for scroll management ---
    const [isUserScrolling, setIsUserScrolling] = useState(false);
    const [isNearBottom, setIsNearBottom] = useState(true);
    const [isScrollingToMessage, setIsScrollingToMessage] = useState(false);
    const [showScrollToBottomFAB, setShowScrollToBottomFAB] = useState(false);
    const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
    const [earliestUnreadMessageId, setEarliestUnreadMessageId] = useState<string | null>(null);
    const [hasScrolledToUnread, setHasScrolledToUnread] = useState(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    // --- End State for scroll management ---

    const flatListRef = useRef<SectionList<any>>(null);
    const isCurrentUserPremium = musicLoverProfile?.isPremium;

    // --- Callback Functions (useCallback) & Other Helpers ---

    const handleEventPressInternal = async (eventId: string) => {
        if (!eventId) {
            console.warn("[ChatScreen] handleEventPressInternal called with empty eventId");
            return;
        }
        console.log("[ChatScreen] Event preview pressed, Event ID:", eventId);
        setLoadingEventDetails(true);
        setSelectedEventDataForModal(null); 
        try {
            console.log("[ChatScreen] Fetching event details from database...");
            const { data: eventData, error: eventError } = await supabase
                .from('events')
                .select(`
                    id,
                    title,
                    event_datetime,
                    location_text,
                    poster_urls,
                    organizer_id,
                    description,
                    tags_genres,
                    tags_artists,
                    tags_songs,
                    booking_type,
                    ticket_price,
                    pass_fee_to_user,
                    max_tickets,
                    max_reservations
                `)
                .eq('id', eventId)
                .maybeSingle(); // Changed from .single() to .maybeSingle()

            if (eventError) {
                console.error("[ChatScreen] Error fetching event:", eventError);
                throw eventError;
            }
            if (!eventData) {
                console.warn("[ChatScreen] Event not found for ID:", eventId);
                throw new Error("Event not found");
            }

            console.log("[ChatScreen] Event data fetched successfully:", {
                id: eventData.id,
                title: eventData.title,
                organizer_id: eventData.organizer_id,
                booking_type: eventData.booking_type,
                ticket_price: eventData.ticket_price
            });

            // Fetch organizer profile from organizer_profiles table (not music_lover_profiles)
            let organizerProfile = null;
            if (eventData.organizer_id) {
                try {
                    console.log("[ChatScreen] Fetching organizer profile for:", eventData.organizer_id);
                    const { data: profileData, error: profileError } = await supabase
                        .from('organizer_profiles')
                        .select('user_id, company_name, logo')
                        .eq('user_id', eventData.organizer_id)
                        .maybeSingle(); // Changed from .single() to .maybeSingle()
                    
                    if (profileError) {
                        console.warn("[ChatScreen] Could not fetch organizer profile:", profileError.message);
                    } else if (profileData) {
                        console.log("[ChatScreen] Organizer profile fetched successfully");
                        organizerProfile = profileData;
                    } else {
                        console.warn("[ChatScreen] No organizer profile found for ID:", eventData.organizer_id);
                    }
                } catch (profileErr) {
                    console.warn("[ChatScreen] Exception fetching organizer profile:", profileErr);
                    // Continue without organizer profile
                }
            }

            const mappedEvent: MappedEvent = {
                id: eventData.id,
                title: eventData.title || "Event Title",
                images: eventData.poster_urls && eventData.poster_urls.length > 0 ? eventData.poster_urls : [DEFAULT_EVENT_IMAGE_CHAT],
                date: formatEventDateTimeForModal(eventData.event_datetime).date,
                time: formatEventDateTimeForModal(eventData.event_datetime).time,
                venue: eventData.location_text || "Venue N/A",
                genres: eventData.tags_genres || [],
                artists: eventData.tags_artists || [],
                songs: eventData.tags_songs || [],
                description: eventData.description || "No description.",
                booking_type: eventData.booking_type,
                ticket_price: eventData.ticket_price,
                pass_fee_to_user: eventData.pass_fee_to_user ?? true,
                max_tickets: eventData.max_tickets,
                max_reservations: eventData.max_reservations,
                organizer: {
                    userId: organizerProfile?.user_id || eventData.organizer_id || "N/A",
                    name: organizerProfile?.company_name || DEFAULT_ORGANIZER_NAME_CHAT,
                    image: organizerProfile?.logo || DEFAULT_ORGANIZER_LOGO_CHAT,
                },
                event_datetime_iso: eventData.event_datetime || new Date().toISOString(),
            };
            console.log("[ChatScreen] Mapped event data successfully, opening modal");
            setSelectedEventDataForModal(mappedEvent);
            setEventModalVisible(true);
        } catch (err: any) {
            console.error("[ChatScreen] Error fetching event details:", err);
            Alert.alert("Error", `Could not load event details: ${err.message}`);
        } finally {
            setLoadingEventDetails(false);
            console.log("[ChatScreen] handleEventPressInternal completed");
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
                    
                    // Check metadata for stored event image and datetime first
                    let eventImage = DEFAULT_EVENT_IMAGE_CHAT;
                    let eventDateTime: string | null = null;
                    if (dbMessage.metadata && typeof dbMessage.metadata === 'object' && dbMessage.metadata.shared_event) {
                        const metadataEvent = dbMessage.metadata.shared_event as any;
                        if (metadataEvent.eventImage) {
                            eventImage = metadataEvent.eventImage;
                        }
                        if (metadataEvent.eventDateTime) {
                            eventDateTime = metadataEvent.eventDateTime;
                        }
                    }
                    
                    sharedEventInfo = { 
                        eventId: eventId, 
                        eventTitle: eventName.trim(), 
                        eventDate: eventDate.trim(), 
                        eventVenue: eventVenue.trim(), 
                        eventImage: eventImage,
                        eventDateTime: eventDateTime,
                    };
                    // Show proper sender name for individual chats
                    const displayName = dbMessage.sender_id === currentUserId ? 'You' : dynamicMatchName;
                    displayText = `${displayName} shared an event`;
                } else { 
                    console.warn("SHARED_EVENT string has invalid format:", rawContent); 
                    displayText = "Shared an event"; 
                    sharedEventInfo = { 
                        eventId: "unknown", 
                        eventTitle: "Event", 
                        eventDate: "N/A", 
                        eventVenue: "N/A", 
                        eventImage: DEFAULT_EVENT_IMAGE_CHAT,
                    }; 
                }
            } catch (e) { 
                console.error("Failed to parse shared event content:", rawContent, e); 
                displayText = "Shared an event"; 
                sharedEventInfo = { 
                    eventId: "unknown", 
                    eventTitle: "Event", 
                    eventDate: "N/A", 
                    eventVenue: "N/A", 
                    eventImage: DEFAULT_EVENT_IMAGE_CHAT,
                };
            }
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
    }, [currentUserId, dynamicMatchName]);

    // Function to enhance shared events with missing eventDateTime (for older messages)
    const enhanceSharedEventsWithDateTime = useCallback(async (messages: ChatMessage[]): Promise<ChatMessage[]> => {
        const messagesToEnhance = messages.filter(msg => 
            msg.sharedEvent && 
            !msg.sharedEvent.eventDateTime && 
            msg.sharedEvent.eventId && 
            msg.sharedEvent.eventId !== 'unknown'
        );

        if (messagesToEnhance.length === 0) {
            return messages;
        }

        console.log(`[DEBUG] Enhancing ${messagesToEnhance.length} shared event messages with missing eventDateTime`);

        // Fetch event data for all messages that need enhancement
        const eventIds = messagesToEnhance.map(msg => msg.sharedEvent!.eventId);
        const uniqueEventIds = [...new Set(eventIds)];

        try {
            const { data: eventsData, error: eventsError } = await supabase
                .from('events')
                .select('id, event_datetime, poster_urls')
                .in('id', uniqueEventIds);

            if (eventsError) {
                console.warn('[DEBUG] Error fetching event data for enhancement:', eventsError.message);
                return messages;
            }

            if (!eventsData || eventsData.length === 0) {
                console.warn('[DEBUG] No event data found for enhancement');
                return messages;
            }

            // Create a map of event data
            const eventDataMap = new Map(eventsData.map(event => [event.id, event]));

            // Enhance messages with fetched event data
            const enhancedMessages = messages.map(msg => {
                if (msg.sharedEvent && !msg.sharedEvent.eventDateTime && msg.sharedEvent.eventId !== 'unknown') {
                    const eventData = eventDataMap.get(msg.sharedEvent.eventId);
                    if (eventData) {
                        console.log(`[DEBUG] Enhanced message ${msg._id} with eventDateTime: ${eventData.event_datetime}`);
                        return {
                            ...msg,
                            sharedEvent: {
                                ...msg.sharedEvent,
                                eventDateTime: eventData.event_datetime,
                                // Also update image if needed
                                eventImage: (eventData.poster_urls && eventData.poster_urls.length > 0) 
                                    ? eventData.poster_urls[0] 
                                    : msg.sharedEvent.eventImage
                            }
                        };
                    }
                }
                return msg;
            });

            return enhancedMessages;
        } catch (error) {
            console.warn('[DEBUG] Exception during event enhancement:', error);
            return messages;
        }
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
                .from('muted_users')
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
                const fetchedChatMessages = visibleMessages.map((dbMsg: any) => {
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

                // Enhance shared events with missing eventDateTime (for older messages)
                const enhancedMessages = await enhanceSharedEventsWithDateTime(fetchedChatMessages);

                setMessages(enhancedMessages);
                checkMutualInitiation(enhancedMessages);
                console.log(`[ChatScreen] Fetched ${enhancedMessages.length} messages.`);
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
    }, [currentUserId, matchUserId, isBlocked, mapDbMessageToChatMessage, checkMutualInitiation, enhanceSharedEventsWithDateTime]);

    // --- Share Event (using inline logic instead of RPC) --- 
    const shareEventToUser = useCallback(async (eventDataToShare: typeof initialSharedEventData) => {
        if (!currentUserId || !matchUserId || !eventDataToShare || isUploading) return;
        const { eventId } = eventDataToShare;

        setInputText(''); 
        setSharedEventMessage(null);
        setError(null);
        Keyboard.dismiss();

        const tempId = `temp_shared_${Date.now()}`;
        const eventMessageText = `You shared an event`;

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
                eventDateTime: eventDataToShare.eventDateTime || null, // Include the ISO datetime if available
            },
            replyToMessageId: replyingToMessage?._id || null,
            replyToMessagePreview: replyingToMessagePreview
        };
        setMessages(prev => [...prev, optimisticMessage]);
        const replyToId = replyingToMessage?._id;
        setReplyingToMessage(null);

        try {
            // First, fetch the actual event datetime from the database
            const { data: eventData, error: eventError } = await supabase
                .from('events')
                .select('event_datetime, poster_urls')
                .eq('id', eventId)
                .single();

            if (eventError) {
                console.warn('Could not fetch event datetime:', eventError);
            }

            // Create formatted content for the message (similar to group chat format)
            const formattedContent = `SHARED_EVENT:${eventId}:${eventDataToShare.eventTitle} on ${eventDataToShare.eventDate} at ${eventDataToShare.eventVenue}`;
            
            // Insert message directly into messages table
            const { data: insertedMessage, error: insertError } = await supabase
                .from('messages')
                .insert({
                    sender_id: currentUserId,
                    receiver_id: matchUserId,
                    content: formattedContent,
                    reply_to_message_id: replyToId || null,
                    metadata: {
                        shared_event: {
                            eventId: eventDataToShare.eventId,
                            eventTitle: eventDataToShare.eventTitle,
                            eventDate: eventDataToShare.eventDate,
                            eventVenue: eventDataToShare.eventVenue,
                            eventImage: (eventData?.poster_urls && eventData.poster_urls.length > 0) 
                                ? eventData.poster_urls[0] 
                                : eventDataToShare.eventImage || DEFAULT_EVENT_IMAGE_CHAT,
                            eventDateTime: eventData?.event_datetime || null, // Store the actual ISO datetime
                        }
                    }
                })
                .select('*')
                .single();

            if (insertError) throw insertError;
            if (!insertedMessage) throw new Error('Failed to insert shared event message.');

            sendBroadcast('individual', matchUserId, 'message', insertedMessage);

            // Log event impression
            try {
                await supabase.from('event_impressions').insert({
                    event_id: eventId,
                    user_id: currentUserId,
                    source: 'individual_chat_share',
                    viewed_at: new Date().toISOString()
                });
            } catch (impressionError) {
                console.warn('Failed to log event impression:', impressionError);
                // Don't fail the whole operation for impression logging
            }

            console.log('[IndividualChatScreen] Event shared to user successfully, message_id:', insertedMessage.id);
            markChatAsInitiatedInStorage(matchUserId);
            
            setMessages(prev => prev.map(msg => 
                msg._id === tempId ? { 
                    ...optimisticMessage, 
                    _id: insertedMessage.id, 
                    createdAt: new Date(insertedMessage.created_at),
                    sharedEvent: optimisticMessage.sharedEvent ? {
                        ...optimisticMessage.sharedEvent,
                        eventDateTime: eventData?.event_datetime || optimisticMessage.sharedEvent.eventDateTime,
                        eventImage: (eventData?.poster_urls && eventData.poster_urls.length > 0) 
                            ? eventData.poster_urls[0] 
                            : optimisticMessage.sharedEvent.eventImage
                    } : null
                } : msg
            ));

            // Explicitly create the message status entry for the receiver
            const { error: statusError } = await supabase.rpc('create_message_status_entry', {
                message_id_input: insertedMessage.id,
                receiver_id_input: matchUserId
            });

            if (statusError) {
                console.error("Failed to create shared event message status entry:", statusError);
            }

            // --- Send Notification ---
            try {
                await UnifiedNotificationService.notifyNewMessage({
                    receiver_id: matchUserId,
                    sender_id: currentUserId,
                    sender_name: musicLoverProfile?.firstName || 'Someone',
                    message_id: insertedMessage.id,
                    content: `Shared an event: ${eventDataToShare.eventTitle}`,
                });
            } catch (notificationError) {
                console.error("Failed to send shared event notification:", notificationError);
            }

        } catch (err: any) {
            console.error("Error sharing event to user:", err);
            setError(`Event share fail: ${err.message}`);
            setMessages(prev => prev.filter(msg => msg._id !== tempId));
        }
    }, [currentUserId, matchUserId, isUploading, markChatAsInitiatedInStorage, replyingToMessage, dynamicMatchName, sendBroadcast]);

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
             console.log("Sending message to receiver_id:", matchUserId); // Added for debugging
             let insertData: any = { 
                 sender_id: currentUserId, 
                 receiver_id: matchUserId, 
                 content: newMessage.text,
                 reply_to_message_id: replyToId || null,
                };
             const { data: insertedMessage, error: insertError } = await supabase.from('messages').insert(insertData).select('*').single(); 
             if (insertError) { throw insertError; }

             if (insertedMessage) {
                sendBroadcast('individual', matchUserId, 'message', insertedMessage);
                setMessages(prev => prev.map(msg => 
                    msg._id === tempId ? { ...newMessage, _id: insertedMessage.id, createdAt: new Date(insertedMessage.created_at) } : msg
                ));

                // Explicitly create the message status entry for the receiver
                const { error: statusError } = await supabase.rpc('create_message_status_entry', {
                    message_id_input: insertedMessage.id,
                    receiver_id_input: matchUserId
                });

                if (statusError) {
                    // This is a non-fatal error for the user, but we must log it.
                    console.error("Failed to create message status entry:", statusError);
                }

                // --- Send Notification ---
                try {
                    await UnifiedNotificationService.notifyNewMessage({
                        receiver_id: matchUserId,
                        sender_id: currentUserId,
                        sender_name: musicLoverProfile?.firstName || 'Someone',
                        message_id: insertedMessage.id,
                        content: newMessage.text,
                    });
                } catch (notificationError) {
                    console.error("Failed to send new message notification:", notificationError);
                }
             }
             setError(null);
         } catch (err: any) { 
             console.error("Error sending message:", err); 
             setError("Failed to send message."); 
             setMessages(prevMessages => prevMessages.filter(msg => msg._id !== tempId)); 
             setInputText(newMessage.text); 
             checkMutualInitiation(messages.filter(msg => msg._id !== tempId)); 
         }
    }, [currentUserId, matchUserId, isBlocked, checkMutualInitiation, markChatAsInitiatedInStorage, messages, replyingToMessage, dynamicMatchName, sendBroadcast]);

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
            fetchInteractionStatus();
        }, [fetchInteractionStatus, matchUserId])
    );

    // Update header options when dynamic data changes
    useEffect(() => {
        const currentName = route.params.matchName || 'Chat';
        setDynamicMatchName(currentName);
        
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
                     <View>
                          <Image
                              source={{ uri: route.params.matchProfilePicture ?? DEFAULT_PROFILE_PIC }}
                              style={styles.headerProfileImage}
                          />
                          {isMatchOnline && !isBlocked && <View style={styles.onlineIndicator} />}
                      </View>
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
    }, [navigation, route.params.matchName, route.params.matchProfilePicture, matchUserId, isBlocked, isMatchMuted, isChatMutuallyInitiated, isMatchOnline, dynamicMatchName, messages, sendBroadcast]);

    // Fetch initial messages AFTER checking block status
    useEffect(() => {
        if (!isBlocked && currentUserId && matchUserId) {
            fetchMessages();
        } else if (isBlocked) {
            setMessages([]); // Ensure messages are cleared if blocked
        }
    }, [fetchMessages, isBlocked, currentUserId, matchUserId]); // Run when block status or IDs change

    // Update online status from presence state
    useEffect(() => {
        if (!matchUserId || !presenceState) {
            setIsMatchOnline(false);
            return;
        }

        const matchUserPresence = presenceState[matchUserId];
        const isOnline = !!(matchUserPresence && matchUserPresence.length > 0);

        if (isOnline !== isMatchOnline) {
            setIsMatchOnline(isOnline);
        }
    }, [presenceState, matchUserId, isMatchOnline]);

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

    // Real-time Subscription Setup using RealtimeContext
    useEffect(() => {
        if (!currentUserId || !matchUserId || isBlocked) {
            return;
        }

        console.log(`[IndividualChatScreen] Setting up realtime subscription for ${matchUserId}`);
        
        // Subscribe to direct database changes for new messages (similar to GroupChatScreen)
        const individualMessageSubscription = supabase
            .channel('individual_messages_direct')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `or(and(sender_id.eq.${currentUserId},receiver_id.eq.${matchUserId}),and(sender_id.eq.${matchUserId},receiver_id.eq.${currentUserId}))`
                },
                async (payload) => {
                    const newMessageDb = payload.new as DbMessage;
                    console.log('[IndividualChatScreen] New message received via direct DB subscription:', newMessageDb.id, 'from:', newMessageDb.sender_id);
                    
                    // Skip if it's our own message (we already have it optimistically)
                    if (newMessageDb.sender_id === currentUserId) {
                        return;
                    }
                    
                    // Skip if it's our own message (we already have it optimistically)
                    if (newMessageDb.sender_id === currentUserId) {
                        return;
                    }
                    
                    // If the message is from the other user, mark it as seen immediately
                    if (newMessageDb.sender_id === matchUserId) {
                        try {
                            const { error } = await supabase.rpc('mark_message_seen', { message_id_input: newMessageDb.id });
                            if (error) {
                                console.error(`Error marking message ${newMessageDb.id} as seen via RPC:`, error.message);
                            } else {
                                // Send broadcast to notify sender about seen status
                                sendBroadcast('individual', matchUserId, 'message_status', {
                                    message_id: newMessageDb.id,
                                    is_seen: true,
                                    seen_at: new Date().toISOString(),
                                    user_id: currentUserId
                                });
                                
                                // Also update the message locally to show seen status immediately
                                setMessages(prevMessages => {
                                    return prevMessages.map(msg => {
                                        if (msg._id === newMessageDb.id) {
                                            return {
                                                ...msg,
                                                isSeen: true,
                                                seenAt: new Date()
                                            };
                                        }
                                        return msg;
                                    });
                                });
                            }
                        } catch (e: any) {
                            console.error(`Exception marking message ${newMessageDb.id} as seen:`, e.message);
                        }
                    }

                    // Check if message is hidden for current user
                    try {
                        const { data: hiddenCheck, error: hiddenError } = await supabase
                            .from('user_hidden_messages')
                            .select('message_id')
                            .eq('user_id', currentUserId)
                            .eq('message_id', newMessageDb.id)
                            .maybeSingle();
                        
                        if (hiddenError) {
                            console.warn("Error checking if message is hidden:", hiddenError.message);
                        } else if (hiddenCheck) {
                            console.log("Message is hidden for current user, skipping");
                            return; // Skip if hidden
                        }
                    } catch (hiddenCheckErr) {
                        console.warn("Exception checking hidden message status:", hiddenCheckErr);
                    }

                    const receivedMessage = mapDbMessageToChatMessage(newMessageDb);
                    
                    // Add reply preview if it exists
                    if (receivedMessage.replyToMessageId) {
                        try {
                            const repliedMsg = messages.find(m => m._id === receivedMessage.replyToMessageId) || await fetchMessageById(receivedMessage.replyToMessageId);
                            if (repliedMsg) {
                                receivedMessage.replyToMessagePreview = {
                                    text: repliedMsg.image ? '[Image]' : repliedMsg.text,
                                    senderName: repliedMsg.user._id === currentUserId ? musicLoverProfile?.firstName || 'You' : dynamicMatchName,
                                    image: repliedMsg.image
                                };
                            }
                        } catch (replyErr) {
                            console.warn("Error fetching reply preview:", replyErr);
                        }
                    }

                    setMessages(prevMessages => {
                        // Prevent duplicate messages
                        if (prevMessages.some(msg => msg._id === receivedMessage._id)) {
                            return prevMessages;
                        }
                        
                        // Optimistically update seen status in the UI
                        if (receivedMessage.user._id === matchUserId) {
                            receivedMessage.isSeen = true;
                            receivedMessage.seenAt = new Date();
                        }

                        // Replace temp message or add new message
                        const existingMsgIndex = prevMessages.findIndex(msg => msg._id.startsWith('temp_') && msg.text === receivedMessage.text && msg.replyToMessageId === receivedMessage.replyToMessageId);
                        if (existingMsgIndex !== -1) {
                            const newMessages = [...prevMessages];
                            newMessages[existingMsgIndex] = receivedMessage;
                            checkMutualInitiation(newMessages); // Check mutual initiation with the new state
                            return newMessages;
                        }
                        
                        const finalMessages = [...prevMessages, receivedMessage];
                        checkMutualInitiation(finalMessages); // Check mutual initiation with the new state
                        return finalMessages;
                    });
                }
            )
            .subscribe((status) => {
                console.log('[IndividualChatScreen] Direct DB subscription status:', status);
            });

        // Subscribe to message updates (edits, deletes)
        const individualMessageUpdateSubscription = supabase
            .channel('individual_messages_update')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                    filter: `or(and(sender_id.eq.${currentUserId},receiver_id.eq.${matchUserId}),and(sender_id.eq.${matchUserId},receiver_id.eq.${currentUserId}))`
                },
                async (payload) => {
                    const updatedMessageDb = payload.new as DbMessage;
                    console.log('[IndividualChatScreen] Message update received via direct DB subscription:', updatedMessageDb.id);
                    
                    // Check if message update is relevant (e.g., not hidden, unless it's a delete for everyone)
                    try {
                        const { data: hiddenCheck, error: hiddenError } = await supabase
                            .from('user_hidden_messages')
                            .select('message_id')
                            .eq('user_id', currentUserId)
                            .eq('message_id', updatedMessageDb.id)
                            .maybeSingle();
                        
                        if (hiddenError) {
                            console.warn("Error checking if updated message is hidden:", hiddenError.message);
                        } else if (hiddenCheck && !updatedMessageDb.is_deleted) {
                            console.log("Updated message is hidden for current user, skipping unless delete");
                            return;
                        }
                    } catch (hiddenCheckErr) {
                        console.warn("Exception checking hidden status for updated message:", hiddenCheckErr);
                    }

                    const updatedMessageUi = mapDbMessageToChatMessage(updatedMessageDb);
                    
                    // Add reply preview if it exists
                    if (updatedMessageUi.replyToMessageId) {
                        try {
                            const repliedMsg = messages.find(m => m._id === updatedMessageUi.replyToMessageId) || await fetchMessageById(updatedMessageUi.replyToMessageId);
                            if (repliedMsg) {
                                updatedMessageUi.replyToMessagePreview = {
                                    text: repliedMsg.image ? '[Image]' : repliedMsg.text,
                                    senderName: repliedMsg.user._id === currentUserId ? musicLoverProfile?.firstName || 'You' : dynamicMatchName,
                                    image: repliedMsg.image
                                };
                            }
                        } catch (replyErr) {
                            console.warn("Error fetching reply preview for updated message:", replyErr);
                        }
                    }

                    setMessages(prev => prev.map(msg => {
                        if (msg._id === updatedMessageUi._id) {
                            return { ...msg, ...updatedMessageUi };
                        }
                        return msg;
                    }));
                }
            )
            .subscribe((status) => {
                console.log('[IndividualChatScreen] Message update subscription status:', status);
            });
        
        const unsubscribe = subscribeToIndividualChat(matchUserId, {
            onMessage: async (payload: any) => {
                if (isBlocked) {
                    console.log('[IndividualChatScreen] Ignoring message - user is blocked');
                    return;
                }
                
                console.log('[IndividualChatScreen] New message received via RealtimeContext:', payload.new);
                const newMessageDb = payload.new as DbMessage;

                // If the message is from the other user, mark it as seen immediately.
                if (newMessageDb.sender_id === matchUserId) {
                    try {
                        const { error } = await supabase.rpc('mark_message_seen', { message_id_input: newMessageDb.id });
                        if (error) {
                            console.error(`Error marking message ${newMessageDb.id} as seen via RPC:`, error.message);
                        } else {
                            // Send broadcast to notify sender about seen status
                            sendBroadcast('individual', matchUserId, 'message_status', {
                                message_id: newMessageDb.id,
                                is_seen: true,
                                seen_at: new Date().toISOString(),
                                user_id: currentUserId
                            });
                            
                            // Also update the message locally to show seen status immediately
                            setMessages(prevMessages => {
                                return prevMessages.map(msg => {
                                    if (msg._id === newMessageDb.id) {
                                        return {
                                            ...msg,
                                            isSeen: true,
                                            seenAt: new Date()
                                        };
                                    }
                                    return msg;
                                });
                            });
                        }
                    } catch (e: any) {
                        console.error(`Exception marking message ${newMessageDb.id} as seen:`, e.message);
                    }
                }

                // Check if message is hidden for current user
                try {
                    const { data: hiddenCheck, error: hiddenError } = await supabase
                        .from('user_hidden_messages')
                        .select('message_id')
                        .eq('user_id', currentUserId)
                        .eq('message_id', newMessageDb.id)
                        .maybeSingle();
                    
                    if (hiddenError) {
                        console.warn("Error checking if message is hidden:", hiddenError.message);
                    } else if (hiddenCheck) {
                        console.log("Message is hidden for current user, skipping");
                        return; // Skip if hidden
                    }
                } catch (hiddenCheckErr) {
                    console.warn("Exception checking hidden message status:", hiddenCheckErr);
                }

                const receivedMessage = mapDbMessageToChatMessage(newMessageDb);
                
                // Add reply preview if it exists
                if (receivedMessage.replyToMessageId) {
                    try {
                        const repliedMsg = messages.find(m => m._id === receivedMessage.replyToMessageId) || await fetchMessageById(receivedMessage.replyToMessageId);
                        if (repliedMsg) {
                            receivedMessage.replyToMessagePreview = {
                                text: repliedMsg.image ? '[Image]' : repliedMsg.text,
                                senderName: repliedMsg.user._id === currentUserId ? musicLoverProfile?.firstName || 'You' : dynamicMatchName,
                                image: repliedMsg.image
                            };
                        }
                    } catch (replyErr) {
                        console.warn("Error fetching reply preview:", replyErr);
                    }
                }

                setMessages(prevMessages => {
                    // Prevent duplicate messages
                    if (prevMessages.some(msg => msg._id === receivedMessage._id)) {
                        return prevMessages;
                    }
                    
                    // Optimistically update seen status in the UI
                    if (receivedMessage.user._id === matchUserId) {
                        receivedMessage.isSeen = true;
                        receivedMessage.seenAt = new Date();
                    }

                    // Replace temp message or add new message
                    const existingMsgIndex = prevMessages.findIndex(msg => msg._id.startsWith('temp_') && msg.text === receivedMessage.text && msg.replyToMessageId === receivedMessage.replyToMessageId);
                    if (existingMsgIndex !== -1) {
                        const newMessages = [...prevMessages];
                        newMessages[existingMsgIndex] = receivedMessage;
                        checkMutualInitiation(newMessages); // Check mutual initiation with the new state
                        return newMessages;
                    }
                    
                    const finalMessages = [...prevMessages, receivedMessage];
                    checkMutualInitiation(finalMessages); // Check mutual initiation with the new state
                    return finalMessages;
                });
            },
            onMessageUpdate: async (payload: any) => {
                if (isBlocked) return;
                const updatedMessageDb = payload.new as DbMessage;
                
                // Check if message update is relevant (e.g., not hidden, unless it's a delete for everyone)
                try {
                    const { data: hiddenCheck, error: hiddenError } = await supabase
                        .from('user_hidden_messages')
                        .select('message_id')
                        .eq('user_id', currentUserId)
                        .eq('message_id', updatedMessageDb.id)
                        .maybeSingle();
                    
                    if (hiddenError) {
                        console.warn("Error checking if updated message is hidden:", hiddenError.message);
                    } else if (hiddenCheck && !updatedMessageDb.is_deleted) {
                        console.log("Updated message is hidden for current user, skipping unless delete");
                        return;
                    }
                } catch (hiddenCheckErr) {
                    console.warn("Exception checking hidden status for updated message:", hiddenCheckErr);
                }

                const updatedMessageUi = mapDbMessageToChatMessage(updatedMessageDb);
                
                // Add reply preview if it exists
                if (updatedMessageUi.replyToMessageId) {
                    try {
                        const repliedMsg = messages.find(m => m._id === updatedMessageUi.replyToMessageId) || await fetchMessageById(updatedMessageUi.replyToMessageId);
                        if (repliedMsg) {
                            updatedMessageUi.replyToMessagePreview = {
                                text: repliedMsg.image ? '[Image]' : repliedMsg.text,
                                senderName: repliedMsg.user._id === currentUserId ? musicLoverProfile?.firstName || 'You' : dynamicMatchName,
                                image: repliedMsg.image
                            };
                        }
                    } catch (replyErr) {
                        console.warn("Error fetching reply preview for updated message:", replyErr);
                    }
                }

                setMessages(prev => prev.map(msg => {
                    if (msg._id === updatedMessageUi._id) {
                        return { ...msg, ...updatedMessageUi };
                    }
                    return msg;
                }));
            },
            onMessageStatus: (payload: any) => {
                const statusUpdate = payload.new;
                if (!statusUpdate) return;
                
                console.log('[IndividualChatScreen] Message status update received via broadcast:', statusUpdate);
                
                // Handle bulk updates (from mark_all_messages_seen_from_user)
                if (statusUpdate.message_ids && Array.isArray(statusUpdate.message_ids) && statusUpdate.seen_by !== currentUserId) {
                    setMessages(prev => prev.map(msg => {
                        if (msg.user._id === currentUserId && statusUpdate.message_ids.includes(msg._id)) {
                            console.log('[IndividualChatScreen] ✅ Seen tick should now appear for message (bulk):', msg._id);
                            return { ...msg, isSeen: true, seenAt: new Date() };
                        }
                        return msg;
                    }));
                    return;
                }
                
                // Handle single message updates (from broadcast or database)
                const messageId = statusUpdate.message_id;
                if (!messageId) return;
                
                setMessages(prevMessages => {
                    let needsUpdate = false;
                    const newMessages = prevMessages.map(msg => {
                        if (msg._id === messageId) {
                            const deliveredChanged = msg.isDelivered !== statusUpdate.is_delivered;
                            const seenChanged = msg.isSeen !== statusUpdate.is_seen;
                            
                            if (deliveredChanged || seenChanged) {
                                needsUpdate = true;
                                
                                // Add debug logging for seen status changes
                                if (seenChanged && statusUpdate.is_seen && msg.user._id === currentUserId) {
                                    console.log('[IndividualChatScreen] ✅ Seen tick should now appear for message (broadcast):', msg._id);
                                }
                                
                                return {
                                    ...msg,
                                    isDelivered: statusUpdate.is_delivered,
                                    deliveredAt: statusUpdate.delivered_at ? new Date(statusUpdate.delivered_at) : msg.deliveredAt,
                                    isSeen: statusUpdate.is_seen,
                                    seenAt: statusUpdate.seen_at ? new Date(statusUpdate.seen_at) : msg.seenAt,
                                };
                            }
                        }
                        return msg;
                    });
                    return needsUpdate ? newMessages : prevMessages;
                });
            },
            onTyping: (payload: any) => {
                if (payload.sender_id === matchUserId) {
                    setIsTyping(true);
                }
            },
            onTypingStop: () => {
                setIsTyping(false);
            }
        });

        // Subscribe to database message status updates (similar to GroupChatScreen)
        const handleMessageStatusUpdate = (payload: any) => {
            const statusUpdate = payload.new;
            if (!statusUpdate || !statusUpdate.message_id) return;
            
            console.log('[IndividualChatScreen] Database message status update:', statusUpdate);
            
            // Only update if this status change is for a message in this chat
            setMessages(prevMessages => {
                let needsUpdate = false;
                const newMessages = prevMessages.map(msg => {
                    if (msg._id === statusUpdate.message_id) {
                        const deliveredChanged = msg.isDelivered !== statusUpdate.is_delivered;
                        const seenChanged = msg.isSeen !== statusUpdate.is_seen;
                        
                        if (deliveredChanged || seenChanged) {
                            needsUpdate = true;
                            
                            // Add debug logging for seen status changes
                            if (seenChanged && statusUpdate.is_seen && msg.user._id === currentUserId) {
                                console.log('[IndividualChatScreen] ✅ Seen tick should now appear for message (database):', msg._id);
                            }
                            
                            return {
                                ...msg,
                                isDelivered: statusUpdate.is_delivered,
                                deliveredAt: statusUpdate.delivered_at ? new Date(statusUpdate.delivered_at) : msg.deliveredAt,
                                isSeen: statusUpdate.is_seen,
                                seenAt: statusUpdate.seen_at ? new Date(statusUpdate.seen_at) : msg.seenAt,
                            };
                        }
                    }
                    return msg;
                });
                return needsUpdate ? newMessages : prevMessages;
            });
        };

        // Subscribe to individual message status table changes for real-time seen updates
        console.log('[IndividualChatScreen] Setting up message_status real-time subscription for individual chat');
        const messageStatusSubscription = supabase
            .channel('individual_message_status_changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'message_status',
                },
                async (payload) => {
                    const statusUpdate = payload.new;
                    if (!statusUpdate || !statusUpdate.message_id) return;
                    
                    console.log('[IndividualChatScreen] Real-time message status update:', statusUpdate);
                    
                    // Only update if this status change is for a message in this chat
                    setMessages(prevMessages => {
                        let needsUpdate = false;
                        const newMessages = prevMessages.map(msg => {
                            if (msg._id === statusUpdate.message_id) {
                                const deliveredChanged = msg.isDelivered !== statusUpdate.is_delivered;
                                const seenChanged = msg.isSeen !== statusUpdate.is_seen;
                                
                                if (deliveredChanged || seenChanged) {
                                    needsUpdate = true;
                                    
                                    // Add debug logging for seen status changes
                                    if (seenChanged && statusUpdate.is_seen && msg.user._id === currentUserId) {
                                        console.log('[IndividualChatScreen] ✅ Seen tick should now appear for message:', msg._id);
                                    }
                                    
                                    return {
                                        ...msg,
                                        isDelivered: statusUpdate.is_delivered,
                                        deliveredAt: statusUpdate.delivered_at ? new Date(statusUpdate.delivered_at) : msg.deliveredAt,
                                        isSeen: statusUpdate.is_seen,
                                        seenAt: statusUpdate.seen_at ? new Date(statusUpdate.seen_at) : msg.seenAt,
                                    };
                                }
                            }
                            return msg;
                        });
                        return needsUpdate ? newMessages : prevMessages;
                    });
                }
            )
            .subscribe((status) => {
                console.log('[IndividualChatScreen] Message status subscription status:', status);
            });

        subscribeToEvent('message_status_updated', handleMessageStatusUpdate);

        return () => {
            unsubscribe();
            unsubscribeFromEvent('message_status_updated', handleMessageStatusUpdate);
            messageStatusSubscription.unsubscribe();
            individualMessageSubscription.unsubscribe();
            individualMessageUpdateSubscription.unsubscribe();
        };
    }, [currentUserId, matchUserId, isBlocked, mapDbMessageToChatMessage, checkMutualInitiation, messages, musicLoverProfile?.firstName, dynamicMatchName, sendBroadcast, subscribeToIndividualChat, subscribeToEvent, unsubscribeFromEvent]);

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

    // --- Proper Scroll to Message Handler ---
    const handleScrollToMessage = useCallback((messageId: string) => {
        if (isScrollingToMessage) return; // Prevent multiple simultaneous scrolls
        
        // Find the message in sections
        let targetSectionIndex = -1;
        let targetItemIndex = -1;
        
        for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
            const itemIndex = sections[sectionIndex].data.findIndex((msg: ChatMessage) => msg._id === messageId);
            if (itemIndex !== -1) {
                targetSectionIndex = sectionIndex;
                targetItemIndex = itemIndex;
                break;
            }
        }
        
        if (targetSectionIndex !== -1 && targetItemIndex !== -1) {
            setIsScrollingToMessage(true);
            setHighlightedMessageId(messageId);
            
            // Clear any existing scroll timeout
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            
            // Scroll to the message
            if (flatListRef.current) {
                try {
                    flatListRef.current.scrollToLocation({
                        sectionIndex: targetSectionIndex,
                        itemIndex: targetItemIndex,
                        animated: true,
                        viewPosition: 0.5, // Center the message in view
                    });
                } catch (error) {
                    console.warn('Failed to scroll to message location:', error);
                    // Fallback: Try to scroll to the section
                    try {
                        flatListRef.current.scrollToLocation({
                            sectionIndex: targetSectionIndex,
                            itemIndex: 0,
                            animated: true,
                        });
                    } catch (fallbackError) {
                        console.warn('Fallback scroll also failed:', fallbackError);
                    }
                }
            }
            
            // Remove highlight and reset scroll state after delay
            scrollTimeoutRef.current = setTimeout(() => {
                setHighlightedMessageId(null);
                setIsScrollingToMessage(false);
            }, 2500);
        } else {
            console.warn('Message not found in current view:', messageId);
        }
    }, [sections, isScrollingToMessage]);
    // --- End Scroll to Message Handler ---

    // --- Smart Auto-Scroll Handler ---
    const handleAutoScrollToBottom = useCallback(() => {
        if (isUserScrolling || isScrollingToMessage || !isNearBottom) {
            return; // Don't auto-scroll if user is scrolling or not near bottom
        }
        
        if (flatListRef.current && sections.length > 0 && messages.length > 0) {
            try {
                const sectionListRef = flatListRef.current as any;
                sectionListRef._wrapperListRef._listRef.scrollToEnd({ animated: false });
            } catch (error) {
                console.warn('Auto-scroll failed:', error);
            }
        }
    }, [isUserScrolling, isScrollingToMessage, isNearBottom, sections.length, messages.length]);

    // --- Scroll to Bottom FAB Handler ---
    const handleScrollToBottom = useCallback(() => {
        if (flatListRef.current && sections.length > 0 && messages.length > 0) {
            try {
                const sectionListRef = flatListRef.current as any;
                sectionListRef._wrapperListRef._listRef.scrollToEnd({ animated: true });
                setShowScrollToBottomFAB(false);
            } catch (error) {
                console.warn('Scroll to bottom failed:', error);
            }
        }
    }, [sections.length, messages.length]);

    // --- Find and Scroll to Earliest Unread Message ---
    const findAndScrollToEarliestUnread = useCallback(() => {
        if (!currentUserId || !matchUserId || hasScrolledToUnread) {
            console.log('[IndividualChatScreen] findAndScrollToEarliestUnread: Early return', { currentUserId, matchUserId, hasScrolledToUnread });
            return;
        }

        console.log('[IndividualChatScreen] findAndScrollToEarliestUnread: Starting search for unread messages');
        
        // Find the earliest unread message from the partner
        const unreadMessages = messages.filter(msg => 
            msg.user._id === matchUserId && !msg.isSeen
        );

        console.log('[IndividualChatScreen] findAndScrollToEarliestUnread: Found unread messages', unreadMessages.length);

        if (unreadMessages.length === 0) {
            // No unread messages, scroll to bottom
            console.log('[IndividualChatScreen] findAndScrollToEarliestUnread: No unread messages, scrolling to bottom');
            handleAutoScrollToBottom();
            setHasScrolledToUnread(true);
            return;
        }

        // Find the earliest unread message
        const earliestUnread = unreadMessages.reduce((earliest, current) => 
            current.createdAt < earliest.createdAt ? current : earliest
        );

        console.log('[IndividualChatScreen] findAndScrollToEarliestUnread: Scrolling to earliest unread message', earliestUnread._id);
        
        setEarliestUnreadMessageId(earliestUnread._id);
        setHasUnreadMessages(true);
        setHasScrolledToUnread(true);

        // Scroll to the earliest unread message
        handleScrollToMessage(earliestUnread._id);
    }, [currentUserId, matchUserId, messages, hasScrolledToUnread, handleScrollToMessage, handleAutoScrollToBottom]);

    // Handle scroll to unread messages when messages are loaded and seen status is updated
    useEffect(() => {
        console.log('[IndividualChatScreen] useEffect for scroll to unread:', { messagesLength: messages.length, loading, hasScrolledToUnread });
        if (messages.length > 0 && !loading && !hasScrolledToUnread) {
            // Wait for seen status to be properly updated before determining unread messages
            const timer = setTimeout(() => {
                // Double-check that we haven't already scrolled to unread
                if (!hasScrolledToUnread) {
                    console.log('[IndividualChatScreen] Triggering findAndScrollToEarliestUnread after delay');
                    findAndScrollToEarliestUnread();
                }
            }, 500); // Increased delay to ensure seen status is updated
            return () => clearTimeout(timer);
        }
    }, [messages.length, loading, hasScrolledToUnread, findAndScrollToEarliestUnread]);

    // --- Scroll Event Handlers ---
    const handleScrollBeginDrag = useCallback(() => {
        setIsUserScrolling(true);
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }
    }, []);

    const handleScrollEndDrag = useCallback(() => {
        scrollTimeoutRef.current = setTimeout(() => {
            setIsUserScrolling(false);
        }, 1000); // Wait 1 second after user stops scrolling
    }, []);

    const handleScroll = useCallback((event: any) => {
        if (isScrollingToMessage) return; // Don't update state during reply navigation
        
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100; // 100px threshold
        setIsNearBottom(isAtBottom);
        
        // Show/hide scroll to bottom FAB based on position
        setShowScrollToBottomFAB(!isAtBottom && messages.length > 0);
    }, [isScrollingToMessage, messages.length]);
    // --- End Scroll Event Handlers ---

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
                text: '[Image]',
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
                    content: '[Image]', // Provide default content for image messages
                    image_url: urlData.publicUrl,
                    reply_to_message_id: replyToId || null,
                })
                .select('*')
                .single();

            if (insertError) {
                await supabase.storage.from('individual-chat-images').remove([filePath]);
                throw insertError;
            }

            if (insertedData) {
                sendBroadcast('individual', matchUserId, 'message', insertedData);
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
                
                // Explicitly create the message status entry for the receiver
                const { error: statusError } = await supabase.rpc('create_message_status_entry', {
                    message_id_input: insertedData.id,
                    receiver_id_input: matchUserId
                });

                if (statusError) {
                    console.error("Failed to create image message status entry:", statusError);
                }

                // --- Send Notification ---
                try {
                    await UnifiedNotificationService.notifyNewMessage({
                        receiver_id: matchUserId,
                        sender_id: currentUserId,
                        sender_name: musicLoverProfile?.firstName || 'Someone',
                        message_id: insertedData.id,
                        content: '[Image]',
                    });
                } catch (notificationError) {
                    console.error("Failed to send new image notification:", notificationError);
                }
            }

        } catch (err: any) {
            console.error('[pickAndSendImage] Error:', err);
            setError(`Failed to send image: ${err.message}`);
            if (tempId) {
                setMessages(prev => prev.filter(msg => msg._id !== tempId));
            }
        } finally {
            setIsUploading(false);
        }
    }, [currentUserId, matchUserId, isUploading, replyingToMessage, dynamicMatchName, supabase, sendBroadcast]); // Added supabase back for now, ensure it is stable

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
        console.log('[DEBUG] handleMessageLongPress called with message:', {
            id: message._id,
            type: message.image ? 'image' : message.sharedEvent ? 'sharedEvent' : 'text',
            isDeleted: message.isDeleted
        });
        
        if (message.isDeleted) {
            console.log('[DEBUG] Message is deleted, returning early');
            return; // Don't show actions for already deleted messages
        }
        
        console.log('[DEBUG] Setting selected message and showing modal');
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
            const { data: updatedMessage } = await supabase.from('messages').select('*').eq('id', editingMessage._id).single();
            if (updatedMessage) {
                sendBroadcast('individual', matchUserId, 'message_update', updatedMessage);
            }
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
            const { data: updatedMessage } = await supabase.from('messages').select('*').eq('id', selectedMessageForAction._id).single();
            if (updatedMessage) {
                sendBroadcast('individual', matchUserId, 'message_update', updatedMessage);
            }
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
            const { data: updatedMessage } = await supabase.from('messages').select('*').eq('id', selectedMessageForAction._id).single();
            if (updatedMessage) {
                sendBroadcast('individual', matchUserId, 'message_update', updatedMessage);
            }
            setMessages(prev => prev.map(msg => 
                msg._id === selectedMessageForAction._id 
                ? { ...msg, 
                    text: 'This message was deleted', 
                    isDeleted: true, 
                    deletedAt: new Date(),
                    image: null, 
                    sharedEvent: null,
                    originalContent: null,
                    replyToMessageId: null,
                    replyToMessagePreview: null
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
            Alert.alert("Info", "Message status is shown with checkmarks.");
            setMessageActionModalVisible(false);
            setSelectedMessageForAction(null);
            return;
        }
        setMessageActionModalVisible(false);
        setLoadingMessageInfo(true);
        setMessageInfoVisible(true);
        try {
            // Query the message_status table directly for this specific message
            const { data: statusData, error } = await supabase
                .from('message_status')
                .select('is_seen, seen_at')
                .eq('message_id', selectedMessageForAction._id)
                .maybeSingle();

            if (error) {
                console.warn('Error fetching message status:', error);
                // If no status record exists, the message hasn't been seen yet
                setMessageInfoData({
                    sent_at: selectedMessageForAction.createdAt.toISOString(),
                    is_seen: false,
                    seen_at: null
                });
            } else if (statusData) {
                setMessageInfoData({
                    sent_at: selectedMessageForAction.createdAt.toISOString(),
                    is_seen: statusData.is_seen,
                    seen_at: statusData.seen_at
                });
            } else {
                // No status record found - message not seen yet
                setMessageInfoData({
                    sent_at: selectedMessageForAction.createdAt.toISOString(),
                    is_seen: false,
                    seen_at: null
                });
            }
        } catch (err: any) {
            console.error("Error fetching message info:", err);
            // Fallback to message data we already have
            setMessageInfoData({
                sent_at: selectedMessageForAction.createdAt.toISOString(),
                is_seen: selectedMessageForAction.isSeen || false,
                seen_at: selectedMessageForAction.seenAt?.toISOString() || null
            });
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

    // --- Cleanup scroll timeout on unmount ---
    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, []);

    const broadcastTyping = useCallback(() => {
        if (!currentUserId || !matchUserId || isBlocked) return;
        // Use the RealtimeContext typing indicator
        sendIndividualTypingIndicator(matchUserId, true);
    }, [currentUserId, matchUserId, isBlocked, sendIndividualTypingIndicator]);

    const handleTextInputChange = (text: string) => {
        setInputText(text);
        if (text) {
            broadcastTyping();
        }
    };

    // Add a function to mark messages as seen when the screen is focused
    const markMessagesAsSeen = useCallback(async () => {
        if (!currentUserId || !matchUserId || messages.length === 0) return;

        const unseenMessagesFromPartner = messages.filter(
            msg => msg.user._id === matchUserId && !msg.isSeen
        );

        if (unseenMessagesFromPartner.length === 0) return;

        console.log(`[IndividualChatScreen] Marking ${unseenMessagesFromPartner.length} messages as seen from ${matchUserId}`);

        try {
            // Use bulk function for better performance and real-time updates
            const { error } = await supabase.rpc('mark_all_messages_seen_from_user', {
                sender_id_input: matchUserId,
                receiver_id_input: currentUserId
            });

            if (error) {
                console.error('Error marking all messages as seen:', error.message);
            } else {
                sendBroadcast('individual', matchUserId, 'message_status', { 
                    message_ids: unseenMessagesFromPartner.map(m => m._id),
                    seen_by: currentUserId
                });
                // Optimistically update UI for all unseen messages from this user
                setMessages(prev => prev.map(m => 
                    m.user._id === matchUserId && !m.isSeen
                        ? {...m, isSeen: true, seenAt: new Date()} 
                        : m
                ));
                
                // Refresh unread count immediately
                refreshUnreadCount();
            }
        } catch (e: any) {
            console.error('Exception marking messages as seen:', e.message);
        }
    }, [currentUserId, matchUserId, messages, refreshUnreadCount, sendBroadcast]);

    // Enhanced function to check and update seen status for messages loaded from database
    const checkAndUpdateSeenStatus = useCallback(async () => {
        if (!currentUserId || !matchUserId || messages.length === 0) return;

        // Check if any messages from the partner are marked as unseen in our local state
        // but might actually be seen in the database
        const potentiallyUnseenMessages = messages.filter(
            msg => msg.user._id === matchUserId && !msg.isSeen
        );

        if (potentiallyUnseenMessages.length === 0) return;

        console.log(`[IndividualChatScreen] Checking seen status for ${potentiallyUnseenMessages.length} messages from ${matchUserId}`);

        try {
            // Fetch the actual seen status from the database for these messages
            const messageIds = potentiallyUnseenMessages.map(msg => msg._id);
            const { data: statusData, error: statusError } = await supabase
                .from('message_status')
                .select('message_id, is_seen, seen_at')
                .in('message_id', messageIds)
                .eq('receiver_id', currentUserId);

            if (statusError) {
                console.error('Error fetching message status:', statusError);
                return;
            }

            // Update messages that are actually seen in the database
            const seenMessageIds = new Set(
                statusData
                    ?.filter(status => status.is_seen)
                    .map(status => status.message_id) || []
            );

            if (seenMessageIds.size > 0) {
                console.log(`[IndividualChatScreen] Found ${seenMessageIds.size} messages that are actually seen in database`);
                
                setMessages(prev => prev.map(msg => {
                    if (msg.user._id === matchUserId && seenMessageIds.has(msg._id) && !msg.isSeen) {
                        const status = statusData?.find(s => s.message_id === msg._id);
                        return {
                            ...msg,
                            isSeen: true,
                            seenAt: status?.seen_at ? new Date(status.seen_at) : new Date()
                        };
                    }
                    return msg;
                }));
            }
        } catch (e: any) {
            console.error('Exception checking seen status:', e.message);
        }
    }, [currentUserId, matchUserId, messages]);

    // Call markMessagesAsSeen when the screen focuses and when new messages arrive from the partner
    useFocusEffect(
        useCallback(() => {
            console.log('[IndividualChatScreen] Screen focused, checking and updating seen status');
            const checkTimer = setTimeout(() => {
                if (hasScrolledToUnread) checkAndUpdateSeenStatus();
            }, 100);
            const markTimer = setTimeout(() => {
                if (hasScrolledToUnread) markMessagesAsSeen();
            }, 300);
            return () => {
                clearTimeout(checkTimer);
                clearTimeout(markTimer);
            };
        }, [checkAndUpdateSeenStatus, markMessagesAsSeen, hasScrolledToUnread])
    );

    // Also mark as seen when new messages arrive while screen is focused
    useEffect(() => {
        const hasNewMessagesFromPartner = messages.some(msg => 
            msg.user._id === matchUserId && !msg.isSeen
        );
        if (hasNewMessagesFromPartner && hasScrolledToUnread) {
            markMessagesAsSeen();
        }
    }, [messages.length, markMessagesAsSeen, matchUserId, hasScrolledToUnread]);

    // Mark messages as seen immediately when component mounts (for notification navigation)
    useEffect(() => {
        if (currentUserId && matchUserId && messages.length > 0 && hasScrolledToUnread) {
            const timer = setTimeout(() => {
                checkAndUpdateSeenStatus();
                markMessagesAsSeen();
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [currentUserId, matchUserId, messages.length, checkAndUpdateSeenStatus, markMessagesAsSeen, hasScrolledToUnread]);

    // Reset unread state when all messages are seen
    useEffect(() => {
        if (messages.length > 0) {
            const hasUnseenMessages = messages.some(msg => 
                msg.user._id === matchUserId && !msg.isSeen
            );
            
            if (!hasUnseenMessages && hasUnreadMessages) {
                setHasUnreadMessages(false);
                setEarliestUnreadMessageId(null);
            }
            
            // If we haven't scrolled to unread yet and there are no unseen messages, scroll to bottom
            if (!hasScrolledToUnread && !hasUnseenMessages) {
                setHasScrolledToUnread(true);
                handleAutoScrollToBottom();
            }
        }
    }, [messages, matchUserId, hasUnreadMessages, hasScrolledToUnread, handleAutoScrollToBottom]);

    // Handle app state changes (when app comes back from background)
    useEffect(() => {
        const handleAppStateChange = (nextAppState: string) => {
            if (nextAppState === 'active' && currentUserId && matchUserId && messages.length > 0 && hasScrolledToUnread) {
                console.log('[IndividualChatScreen] App became active, checking seen status');
                // Small delay to ensure the app is fully active
                setTimeout(() => {
                    checkAndUpdateSeenStatus();
                    markMessagesAsSeen();
                }, 500);
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription?.remove();
    }, [currentUserId, matchUserId, messages.length, checkAndUpdateSeenStatus, markMessagesAsSeen, hasScrolledToUnread]);

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

    // --- Add dynamic imports for Sharing and Clipboard (top of component) ---
    let Sharing: any;
    let Clipboard: any;
    try {
        Sharing = require('expo-sharing');
    } catch {}
    try {
        Clipboard = require('expo-clipboard');
    } catch {}

    // --- Enhanced cross-platform download and share helpers ---
    const downloadImage = async (url: string) => {
        try {
            if (Platform.OS === 'web') {
                // Enhanced web download with file explorer dialog
                const response = await fetch(url);
                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = url.split('/').pop()?.split('?')[0] || `image_${Date.now()}.jpg`;
                link.style.display = 'none';
                
                // Trigger file explorer dialog
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Clean up blob URL
                setTimeout(() => {
                    window.URL.revokeObjectURL(blobUrl);
                }, 100);
                
                Alert.alert('Download', 'File explorer opened. Choose where to save the image.');
            } else {
                // Enhanced mobile download with gallery save option
                const filename = url.split('/').pop()?.split('?')[0] || `image_${Date.now()}.jpg`;
                
                // Show options to user
                Alert.alert(
                    'Save Image',
                    'Choose where to save the image:',
                    [
                        {
                            text: 'Save to Gallery',
                            onPress: async () => {
                                try {
                                    // For mobile, we'll use the share functionality to save to gallery
                                    if (Sharing && Sharing.isAvailableAsync && (await Sharing.isAvailableAsync())) {
                                        const fileUri = (FileSystem.cacheDirectory || '/tmp/') + filename;
                                        
                                        if (FileSystem.downloadAsync) {
                                            await FileSystem.downloadAsync(url, fileUri);
                                            await Sharing.shareAsync(fileUri, {
                                                mimeType: 'image/jpeg',
                                                dialogTitle: 'Save to Gallery'
                                            });
                                        }
                                    } else {
                                        Alert.alert('Gallery Save', 'Gallery save not available on this device.');
                                    }
                                } catch (e) {
                                    const msg = typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e);
                                    Alert.alert('Save Failed', msg || 'Could not save to gallery.');
                                }
                            }
                        },
                        {
                            text: 'Download to Files',
                            onPress: async () => {
                                try {
                                    const fileUri = (FileSystem.cacheDirectory || '/tmp/') + filename;
                                    
                                    if (FileSystem.createDownloadResumable) {
                                        const downloadResumable = FileSystem.createDownloadResumable(url, fileUri);
                                        const result = await downloadResumable.downloadAsync();
                                        const uri = (result as any)?.uri || fileUri;
                                        Alert.alert('Downloaded', `Image saved to: ${uri}`);
                                    } else if (FileSystem.downloadAsync) {
                                        const result = await FileSystem.downloadAsync(url, fileUri);
                                        const uri = (result as any)?.uri || fileUri;
                                        Alert.alert('Downloaded', `Image saved to: ${uri}`);
                                    } else {
                                        Alert.alert('Download not supported on this platform.');
                                    }
                                } catch (e) {
                                    const msg = typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e);
                                    Alert.alert('Download failed', msg || 'Could not download image.');
                                }
                            }
                        },
                        {
                            text: 'Cancel',
                            style: 'cancel'
                        }
                    ]
                );
            }
        } catch (e) {
            const msg = typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e);
            Alert.alert('Download failed', msg || 'Could not download image.');
        }
    };

    const shareImage = async (url: string) => {
        try {
            if (Platform.OS === 'web') {
                // Web sharing using Web Share API or clipboard fallback
                if (navigator.share) {
                    await navigator.share({
                        title: 'Shared Image',
                        url: url
                    });
                } else if (Clipboard && Clipboard.setStringAsync) {
                    await Clipboard.setStringAsync(url);
                    Alert.alert('Copied', 'Image URL copied to clipboard.');
                } else {
                    // Fallback for web without clipboard support
                    const textArea = document.createElement('textarea');
                    textArea.value = url;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    Alert.alert('Copied', 'Image URL copied to clipboard.');
                }
            } else {
                // Mobile sharing
                const filename = url.split('/').pop()?.split('?')[0] || `image_${Date.now()}.jpg`;
                const fileUri = (FileSystem.cacheDirectory || '/tmp/') + filename;
                
                if (FileSystem.downloadAsync) {
                    await FileSystem.downloadAsync(url, fileUri);
                }
                
                if (Sharing && Sharing.isAvailableAsync && (await Sharing.isAvailableAsync())) {
                    await Sharing.shareAsync(fileUri);
                } else if (Clipboard && Clipboard.setStringAsync) {
                    await Clipboard.setStringAsync(url);
                    Alert.alert('Copied', 'Image URL copied to clipboard.');
                } else {
                    Alert.alert('Share not supported on this platform.');
                }
            }
        } catch (e) {
            const msg = typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e);
            Alert.alert('Share failed', msg || 'Could not share image.');
        }
    };

    // Forward functionality
    const handleForward = async (message: ChatMessage) => {
        setForwardMessage(message);
        setForwardModalVisible(true);
        setLoadingChats(true);
        
        try {
            console.log('[Forward] Fetching available chats for user:', currentUserId);
            
            // Fetch available chats (individual and group) using the same RPC functions as the chat list
            const [individualChats, groupChats] = await Promise.all([
                // Get individual chats using the same RPC as the chat list
                supabase.rpc('get_chat_list_with_unread'),
                
                // Get group chats using the same RPC as the chat list
                supabase.rpc('get_group_chat_list_with_unread')
            ]);
            
            console.log('[Forward] Individual chats result:', individualChats);
            console.log('[Forward] Group chats result:', groupChats);
            
            const chats: Array<{id: string, name: string, type: 'individual' | 'group'}> = [];
            
            // Process individual chats
            if (individualChats.data && individualChats.data.length > 0) {
                console.log('[Forward] Processing individual chats:', individualChats.data.length);
                for (const chat of individualChats.data) {
                    const name = `${chat.partner_first_name || ''} ${chat.partner_last_name || ''}`.trim() || 'User';
                    chats.push({
                        id: chat.partner_user_id,
                        name,
                        type: 'individual'
                    });
                }
            }
            
            // Process group chats
            if (groupChats.data && groupChats.data.length > 0) {
                console.log('[Forward] Processing group chats:', groupChats.data.length);
                for (const chat of groupChats.data) {
                    if (chat.group_name) {
                        chats.push({
                            id: chat.group_id,
                            name: chat.group_name,
                            type: 'group'
                        });
                    }
                }
            }
            
            // Filter out current chat
            const filteredChats = chats.filter(chat => 
                !(chat.type === 'individual' && chat.id === matchUserId)
            );
            
            console.log('[Forward] Final available chats:', filteredChats);
            setAvailableChats(filteredChats);
            
            if (filteredChats.length === 0) {
                console.log('[Forward] No available chats found');
            }
            
        } catch (error) {
            console.error('[Forward] Error fetching chats for forward:', error);
            Alert.alert('Error', 'Could not load available chats');
        } finally {
            setLoadingChats(false);
        }
    };

    const forwardMessageToChat = async (chatId: string, chatType: 'individual' | 'group', chatName: string) => {
        if (!forwardMessage || !currentUserId) return;
        
        try {
            let messageContent = '';
            let imageUrl = null;
            let metadata = null;
            
            if (forwardMessage.image) {
                messageContent = '[Image]';
                imageUrl = forwardMessage.image;
            } else if (forwardMessage.sharedEvent) {
                messageContent = `SHARED_EVENT:${forwardMessage.sharedEvent.eventId}:${forwardMessage.sharedEvent.eventTitle} on ${forwardMessage.sharedEvent.eventDate} at ${forwardMessage.sharedEvent.eventVenue}`;
                metadata = {
                    shared_event: forwardMessage.sharedEvent
                };
            } else {
                messageContent = forwardMessage.text;
            }
            
            if (chatType === 'individual') {
                // Forward to individual chat
                const { data: insertedMessage, error: insertError } = await supabase
                    .from('messages')
                    .insert({
                        sender_id: currentUserId,
                        receiver_id: chatId,
                        content: messageContent,
                        image_url: imageUrl,
                        metadata: metadata
                    })
                    .select('id, created_at')
                    .single();
                
                if (insertError) throw insertError;
                
                // Create message status entry
                await supabase.rpc('create_message_status_entry', {
                    message_id_input: insertedMessage.id,
                    receiver_id_input: chatId
                });
                
            } else {
                // Forward to group chat
                const { data: insertedMessage, error: insertError } = await supabase
                    .from('group_chat_messages')
                    .insert({
                        sender_id: currentUserId,
                        group_id: chatId,
                        content: messageContent,
                        image_url: imageUrl,
                        is_system_message: false,
                        metadata: metadata
                    })
                    .select('id, created_at')
                    .single();
                
                if (insertError) throw insertError;
            }
            
            // Close the forward modal first
            setForwardModalVisible(false);
            setForwardMessage(null);
            
            console.log('[Forward] Successfully forwarded message to:', chatType, chatId, chatName);
            
            // Navigate immediately to the destination chat
            try {
                if (chatType === 'individual') {
                    console.log('[Forward] Navigating to individual chat:', chatId);
                    // Navigate to individual chat
                    navigation.navigate('IndividualChatScreen', {
                        matchUserId: chatId,
                        matchName: chatName,
                        matchProfilePicture: null,
                        commonTags: [],
                        topArtists: [],
                        topTracks: [],
                        topGenres: [],
                        topMoods: [],
                        isFirstInteractionFromMatches: false
                    });
                } else {
                    console.log('[Forward] Navigating to group chat:', chatId);
                    // Navigate to group chat
                    navigation.navigate('GroupChatScreen', {
                        groupId: chatId,
                        groupName: chatName,
                        groupImage: null
                    });
                }
                
                // Show success message after navigation
                setTimeout(() => {
                    Alert.alert('Forwarded Successfully', `Message forwarded to ${chatName}`);
                }, 500);
                
            } catch (navError) {
                console.error('[Forward] Navigation error:', navError);
                Alert.alert('Forwarded Successfully', `Message forwarded to ${chatName}. Please navigate to the chat manually.`);
            }
            
        } catch (error: any) {
            console.error('Error forwarding message:', error);
            Alert.alert('Error', `Failed to forward message: ${error.message}`);
        }
    };

    // Enhanced copy function for cross-platform compatibility
    const copyToClipboard = async (text: string, successMessage: string) => {
        try {
            if (Platform.OS === 'web') {
                // Try modern Clipboard API first
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                    Alert.alert('Copied', successMessage);
                } else if (Clipboard.setStringAsync) {
                    // Fallback to Expo Clipboard
                    await Clipboard.setStringAsync(text);
                    Alert.alert('Copied', successMessage);
                } else {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-999999px';
                    textArea.style.top = '-999999px';
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    
                    try {
                        document.execCommand('copy');
                        Alert.alert('Copied', successMessage);
                    } catch (err) {
                        Alert.alert('Copy Failed', 'Could not copy to clipboard. Please try selecting and copying manually.');
                    } finally {
                        document.body.removeChild(textArea);
                    }
                }
            } else {
                // Mobile platforms
                if (Clipboard.setStringAsync) {
                    await Clipboard.setStringAsync(text);
                    Alert.alert('Copied', successMessage);
                } else {
                    Alert.alert('Copy Failed', 'Clipboard not supported on this device.');
                }
            }
        } catch (e) {
            console.error('Copy to clipboard error:', e);
            const msg = typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e);
            Alert.alert('Copy Failed', msg || 'Could not copy to clipboard.');
        }
    };

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

                {isTyping && (
                    <View style={styles.typingIndicatorContainer}>
                        <Text style={styles.typingIndicatorText}>{`${dynamicMatchName} is typing...`}</Text>
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
                            onReplyPress={handleScrollToMessage}
                            getRepliedMessagePreview={getRepliedMessagePreview}
                            isHighlighted={item._id === highlightedMessageId}
                        />
                    )}
                    renderSectionHeader={({ section: { title, data } }) => (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionHeaderText}>{title}</Text>
                            {/* New Messages Divider */}
                            {hasUnreadMessages && data.some((msg: ChatMessage) => msg._id === earliestUnreadMessageId) && (
                                <View style={styles.newMessagesDivider}>
                                    <View style={styles.newMessagesDividerLine} />
                                    <Text style={styles.newMessagesDividerText}>New Messages</Text>
                                    <View style={styles.newMessagesDividerLine} />
                                </View>
                            )}
                        </View>
                    )}
                    onContentSizeChange={handleAutoScrollToBottom}
                    onLayout={handleAutoScrollToBottom}
                    onScrollToIndexFailed={(info) => {
                        console.warn('Failed to scroll to index:', info);
                        handleAutoScrollToBottom();
                    }}
                    stickySectionHeadersEnabled
                    onScrollBeginDrag={handleScrollBeginDrag}
                    onScrollEndDrag={handleScrollEndDrag}
                    onScroll={handleScroll}
                />

                {/* Scroll to Bottom FAB */}
                {showScrollToBottomFAB && (
                    <TouchableOpacity
                        style={styles.scrollToBottomFAB}
                        onPress={handleScrollToBottom}
                        activeOpacity={0.8}
                    >
                        <Feather name="chevron-down" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                )}

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
                    <TouchableOpacity style={styles.attachButton} onPress={pickAndSendImage} disabled={isUploading} >
                         {isUploading ? <ActivityIndicator size="small" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} /> : <Feather name="paperclip" size={22} color="#52525b" /> }
                    </TouchableOpacity>
                    <TextInput
                        style={styles.textInput}
                        value={inputText}
                        onChangeText={handleTextInputChange}
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
                <Modal visible={true} transparent={true} onRequestClose={() => setImageViewerVisible(false)}>
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
                        renderHeader={() => {
                            const url = selectedImages[selectedImageIndex];
                            return (
                                <View style={{ position: 'absolute', top: 40, right: 20, left: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    <TouchableOpacity onPress={() => setImageViewerVisible(false)} style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 8, marginRight: 8 }}>
                                        <Feather name="x" size={28} color="#fff" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => url && downloadImage(url)} style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 8, marginRight: 8 }}>
                                        <Feather name="download" size={24} color="#fff" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => url && shareImage(url)} style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 8 }}>
                                        <Feather name="share-2" size={24} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            );
                        }}
                        renderIndicator={(currentIndex, allSize) => (
                            <View style={{ position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 }}>
                                <Text style={{ color: '#fff', fontSize: 16 }}>{currentIndex} / {allSize}</Text>
                            </View>
                        )}
                        backgroundColor="#000"
                        saveToLocalByLongPress={false}
                    />
                </Modal>
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

                            <TouchableOpacity style={styles.actionModalButton} onPress={handleShowMessageInfo}>
                                <Feather name="info" size={20} color="#3B82F6" style={styles.actionModalIcon}/>
                                <Text style={styles.actionModalButtonText}>Info</Text>
                            </TouchableOpacity>

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

                            {/* Forward and Copy actions */}
                            <TouchableOpacity style={styles.actionModalButton} onPress={() => {
                                setMessageActionModalVisible(false);
                                handleForward(selectedMessageForAction);
                            }}>
                                <Feather name="corner-up-right" size={20} color="#3B82F6" style={styles.actionModalIcon} />
                                <Text style={styles.actionModalButtonText}>Forward</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionModalButton} onPress={async () => {
                                setMessageActionModalVisible(false);
                                try {
                                    if (selectedMessageForAction.image) {
                                        await copyToClipboard(selectedMessageForAction.image, 'Image URL copied to clipboard.');
                                    } else if (selectedMessageForAction.text) {
                                        await copyToClipboard(selectedMessageForAction.text, 'Message copied to clipboard.');
                                    } else if (selectedMessageForAction.sharedEvent) {
                                        const eventInfo = `${selectedMessageForAction.sharedEvent.eventTitle} - ${selectedMessageForAction.sharedEvent.eventDate} at ${selectedMessageForAction.sharedEvent.eventVenue}`;
                                        await copyToClipboard(eventInfo, 'Event info copied to clipboard.');
                                    }
                                } catch (e) {
                                    const msg = typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e);
                                    Alert.alert('Copy failed', msg || 'Could not copy.');
                                }
                            }}>
                                <Feather name="copy" size={20} color="#3B82F6" style={styles.actionModalIcon} />
                                <Text style={styles.actionModalButtonText}>Copy</Text>
                            </TouchableOpacity>
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
                        <ScrollView>
                            <Text style={styles.messageInfoSectionTitle}>Sent at: {formatTime(new Date(messageInfoData.sent_at))}</Text>
                            {messageInfoData.is_seen && messageInfoData.seen_at ? (
                                <Text style={styles.messageInfoDetailText}>Seen: {formatTime(new Date(messageInfoData.seen_at))}</Text>
                            ) : (
                                <Text style={styles.messageInfoDetailText}>Seen: Not yet</Text>
                            )}
                        </ScrollView>
                    ) : (
                        <Text>No information available.</Text>
                    )}
                    <TouchableOpacity style={styles.messageInfoCloseButton} onPress={() => setMessageInfoVisible(false)}>
                        <Text style={styles.messageInfoCloseButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </Modal>

            {/* Forward Modal */}
            <Modal
                visible={forwardModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => {
                    setForwardModalVisible(false);
                    setForwardMessage(null);
                }}
            >
                <TouchableOpacity 
                    style={styles.modalBackdrop} 
                    activeOpacity={1} 
                    onPress={() => {
                        setForwardModalVisible(false);
                        setForwardMessage(null);
                    }} 
                />
                <View style={styles.forwardModalContent}>
                    <Text style={styles.forwardModalTitle}>Forward Message</Text>
                    
                    {forwardMessage && (
                        <View style={styles.forwardMessagePreview}>
                            <Text style={styles.forwardMessagePreviewText}>
                                {forwardMessage.image ? '[Image]' : 
                                 forwardMessage.sharedEvent ? `Shared event: ${forwardMessage.sharedEvent.eventTitle}` :
                                 forwardMessage.text}
                            </Text>
                        </View>
                    )}
                    
                    <Text style={styles.forwardModalSubtitle}>Select a chat to forward to:</Text>
                    
                    {loadingChats ? (
                        <View style={styles.forwardLoadingContainer}>
                            <ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} />
                            <Text style={styles.forwardLoadingText}>Loading chats...</Text>
                        </View>
                    ) : availableChats.length === 0 ? (
                        <View style={styles.forwardEmptyContainer}>
                            <Text style={styles.forwardEmptyText}>No other chats available</Text>
                            <Text style={styles.forwardEmptyText}>Debug: {JSON.stringify({loadingChats, availableChatsLength: availableChats.length})}</Text>
                        </View>
                    ) : (
                        <ScrollView style={styles.forwardChatsList}>
                            <Text style={styles.forwardEmptyText}>Debug: Found {availableChats.length} chats</Text>
                            {availableChats.map((chat) => (
                                <TouchableOpacity
                                    key={`${chat.type}-${chat.id}`}
                                    style={styles.forwardChatItem}
                                    onPress={() => {
                                        console.log('[Forward] Chat selected:', chat);
                                        forwardMessageToChat(chat.id, chat.type, chat.name);
                                    }}
                                >
                                    <View style={styles.forwardChatInfo}>
                                        <Feather 
                                            name={chat.type === 'individual' ? 'user' : 'users'} 
                                            size={20} 
                                            color="#6B7280" 
                                            style={styles.forwardChatIcon}
                                        />
                                        <Text style={styles.forwardChatName}>{chat.name}</Text>
                                    </View>
                                    <Feather name="chevron-right" size={16} color="#9CA3AF" />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                    
                    <TouchableOpacity 
                        style={styles.forwardModalCloseButton} 
                        onPress={() => {
                            setForwardModalVisible(false);
                            setForwardMessage(null);
                        }}
                    >
                        <Text style={styles.forwardModalCloseButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </Modal>

            {/* Event Detail Modal */}
            {selectedEventDataForModal && (
                <EventDetailModal
                    event={selectedEventDataForModal}
                    visible={eventModalVisible}
                    onClose={() => {
                        setEventModalVisible(false);
                        setSelectedEventDataForModal(null);
                    }}
                    navigation={navigation as any}
                />
            )}
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
    messageList: { flex: 1, paddingHorizontal: 10, backgroundColor: '#FFFFFF', },
    messageListContent: { paddingVertical: 10, flexGrow: 1, justifyContent: 'flex-end' },
    messageRow: { flexDirection: 'row', marginVertical: 4, alignItems: 'flex-end', },
    messageRowSent: { justifyContent: 'flex-end', marginLeft: '20%', },
    messageRowReceived: { justifyContent: 'flex-start', marginRight: '20%', },
    messageContentContainer: {
        maxWidth: '100%',
    },
    messageBubble: {
        borderRadius: 18,
        minWidth: 30,
        marginBottom: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    messageBubbleSent: {
        backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6',
        borderBottomRightRadius: 4,
        alignSelf: 'flex-end',
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    messageBubbleReceived: {
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 4,
        alignSelf: 'flex-start',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    messageText: { 
        fontSize: 15, 
        lineHeight: 21, 
        flexShrink: 1,
    },
    messageTextSent: { color: '#FFFFFF' },
    messageTextReceived: { color: '#1F2937' },
    inputToolbar: { flexDirection: 'row', alignItems: 'flex-end', paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF', },
    textInput: { 
        flex: 1, 
        minHeight: 44, 
        maxHeight: 120, 
        backgroundColor: '#F8F9FA', 
        borderRadius: 22, 
        paddingHorizontal: 16, 
        paddingVertical: Platform.OS === 'ios' ? 12 : 10, 
        fontSize: 16, 
        marginHorizontal: 8, 
        color: '#1F2937',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    sendButton: { backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', },
    sendButtonDisabled: { backgroundColor: '#9CA3AF', },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerProfileImage: {
        width: 34,
        height: 34,
        borderRadius: 17,
        marginRight: 10,
    },
    headerTitleText: {
        fontSize: 17,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 1,
    },
    blockedText: {
        color: '#9CA3AF',
    },
    muteIcon: {
        marginLeft: 6,
    },
    timeText: {
        fontSize: 11,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeTextSent: {
        alignSelf: 'flex-end',
        marginRight: 8,
        marginTop: 4,
        color: '#9CA3AF',
    },
    timeTextReceived: {
        alignSelf: 'flex-start',
        marginLeft: 8,
        marginTop: 4,
        color: '#9CA3AF',
    },
    timeTextInsideBubble: {
        fontSize: 10,
        marginLeft: 8,
        alignSelf: 'flex-end',
        lineHeight: 15,
    },
    timeTextInsideSentBubble: { 
        color: 'rgba(255, 255, 255, 0.7)' 
    },
    timeTextInsideReceivedBubble: { 
        color: '#6B7280'
    },
    timeAndEditContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 4,
        minHeight: 16,
    },
    sectionHeader: {
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#F9FAFB',
        zIndex: 100,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    sectionHeaderText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    imageBubble: {
        borderRadius: 18,
        overflow: 'hidden',
        padding: 0,
        backgroundColor: 'transparent',
        alignSelf: 'flex-start',
        maxWidth: 220,
        maxHeight: 220,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
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
        width: 210,
        height: 210,
        borderRadius: 16,
    },
    imageErrorOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 16,
    },
    imageErrorText: {
        color: '#FFFFFF',
        fontSize: 12,
        marginTop: 4,
        textAlign: 'center',
    },
    attachButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 22,
        backgroundColor: '#F8F9FA',
        borderWidth: 1,
        borderColor: '#E5E7EB',
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
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#F8F9FA',
        alignItems: 'center',
    },
    startersNavigationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 16,
        marginTop: 12,
    },
    starterNavButton: {
        padding: 10,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT || '#A5B4FC',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    starterNavButtonDisabled: {
        backgroundColor: '#F3F4F6',
        borderColor: '#E5E7EB',
    },
    startersTitle: {
        fontSize: 14,
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
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginHorizontal: 8,
        borderWidth: 1,
        borderColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT || '#A5B4FC',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        minHeight: 70,
        justifyContent: 'center',
    },
    starterText: {
        fontSize: 14,
        color: APP_CONSTANTS.COLORS.PRIMARY || '#3B82F6',
        textAlign: 'center',
        lineHeight: 20,
    },
    starterCounterText: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 6,
    },
    startersLoadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        backgroundColor: '#F8F9FA',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    startersLoadingText: {
        marginLeft: 10,
        fontSize: 14,
        color: '#4B5563',
    },
    sharedEventContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        backgroundColor: '#F8F9FA',
    },
    sharedEventContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    sharedEventImage: {
        width: 50,
        height: 50,
        borderRadius: 10,
        marginRight: 12,
    },
    sharedEventInfo: {
        flex: 1,
    },
    sharedEventTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 2,
    },
    sharedEventDetails: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 1,
    },
    sharedEventCloseButton: {
        padding: 8,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
    },
    sharedEventMessageBubble: {
        padding: 14,
        maxWidth: 300,
    },
    sharedEventPreview: {
        marginTop: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    sharedEventPreviewImage: {
        width: '100%',
        height: 140,
        backgroundColor: '#F3F4F6',
    },
    sharedEventPreviewContent: {
        padding: 12,
    },
    sharedEventPreviewTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 4,
    },
    sharedEventPreviewDetails: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 2,
    },
    loadingOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    loadingOverlayText: {
        marginTop: 12,
        color: 'white',
        fontSize: 16,
    },
    replyingToContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#F0F1F3',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    replyingToContent: {
        flex: 1,
    },
    replyingToTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 2,
    },
    replyingToText: {
        fontSize: 13,
        color: '#6B7280',
    },
    replyingToCloseButton: {
        padding: 6,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
    },
    actionModalContent: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 34 : 20, 
        left: 16,
        right: 16,
        backgroundColor: 'white',
        borderRadius: 16,
        paddingVertical: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
    },
    actionModalButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
    },
    actionModalIcon: {
        marginRight: 16,
    },
    actionModalButtonText: {
        fontSize: 16,
        color: '#1F2937',
        fontWeight: '500',
    },
    messageInfoModalContent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '60%',
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 12,
    },
    messageInfoTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
        color: '#1F2937',
    },

    messageInfoDetailText: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 4,
    },
    messageInfoCloseButton: {
        marginTop: 24,
        paddingVertical: 14,
        backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6',
        borderRadius: 12,
        alignItems: 'center',
    },
    messageInfoCloseButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    messageInfoSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginTop: 12,
        marginBottom: 8,
    },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { 
        backgroundColor: 'white', 
        borderRadius: 16, 
        padding: 28, 
        marginHorizontal: '8%', 
        marginTop: '25%', 
        shadowColor: "#000", 
        shadowOffset: { width: 0, height: 4 }, 
        shadowOpacity: 0.3, 
        shadowRadius: 8, 
        elevation: 8, 
        minHeight: 220 
    },
    modalTitle: { fontSize: 20, fontWeight: '600', marginBottom: 24, textAlign: 'center', color: '#1F2937', },
    modalInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 28, minHeight: 80, textAlignVertical: 'top' },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', },
    modalButton: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minWidth: 100, },
    modalButtonCancel: { backgroundColor: '#F3F4F6', },
    modalButtonSave: { backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', },
    modalButtonDisabled: { backgroundColor: '#D1D5DB', },
    modalButtonTextCancel: { color: '#4B5563', fontWeight: '600', },
    modalButtonTextSave: { color: 'white', fontWeight: '600', },
    deletedMessageBubble: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        opacity: 0.8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    deletedMessageText: {
        fontSize: 14,
        fontStyle: 'italic',
        color: '#6B7280',
    },
    editedIndicator: {
        fontSize: 10,
        fontStyle: 'italic',
        marginRight: 6,
    },
    editedIndicatorSent: {
        color: 'rgba(255, 255, 255, 0.7)',
    },
    editedIndicatorReceived: {
        color: '#6B7280',
    },
    editedIndicatorImage: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.6)',
        color: 'white',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        fontSize: 9,
    },
    messageRowTouchable: {
        flexDirection: 'row',
        marginVertical: 4,
        alignItems: 'flex-end',
    },
    replyPreviewContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.04)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
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
        marginLeft: 8,
        flexShrink: 1,
    },
    replyPreviewSenderName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4B5563',
        marginBottom: 2,
    },
    replyPreviewText: {
        fontSize: 12,
        color: '#6B7280',
    },
    // Highlighting styles
    highlightedMessageContainer: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderRadius: 12,
        padding: 4,
        margin: 2,
    },
    highlightedMessageBubble: {
        borderWidth: 2,
        borderColor: 'rgba(59, 130, 246, 0.3)',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    highlightedImageBubble: {
        borderWidth: 2,
        borderColor: 'rgba(59, 130, 246, 0.3)',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    sharedEventPreviewDisabled: {
        opacity: 0.5,
    },
    sharedEventPreviewImageDisabled: {
        opacity: 0.5,
    },
    eventOverOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 16,
    },
    eventOverText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    eventOverTitle: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2,
    },
    eventOverDetails: {
        color: '#FFFFFF',
        fontSize: 13,
        marginBottom: 1,
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 0,
        right: 10,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#22C55E', // tailwind green-500
        borderWidth: 2,
        borderColor: '#FFFFFF', // white
    },
    typingIndicatorContainer: {
        paddingHorizontal: 15,
        paddingBottom: 5,
        height: 25,
    },
    typingIndicatorText: {
        fontSize: 12,
        color: '#6B7280',
        fontStyle: 'italic',
    },
    // Forward modal styles
    forwardModalContent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '80%',
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 12,
    },
    forwardModalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 16,
        color: '#1F2937',
    },
    forwardMessagePreview: {
        backgroundColor: '#F3F4F6',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    forwardMessagePreviewText: {
        fontSize: 14,
        color: '#4B5563',
        fontStyle: 'italic',
    },
    forwardModalSubtitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 12,
    },
    forwardLoadingContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    forwardLoadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
    },
    forwardEmptyContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    forwardEmptyText: {
        fontSize: 14,
        color: '#6B7280',
        fontStyle: 'italic',
    },
    forwardChatsList: {
        maxHeight: 300,
    },
    forwardChatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    forwardChatInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    forwardChatIcon: {
        marginRight: 12,
    },
    forwardChatName: {
        fontSize: 16,
        color: '#1F2937',
        fontWeight: '500',
    },
    forwardModalCloseButton: {
        marginTop: 24,
        paddingVertical: 14,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        alignItems: 'center',
    },
    forwardModalCloseButtonText: {
        color: '#4B5563',
        fontSize: 16,
        fontWeight: '600',
    },
    // New Messages Divider styles
    newMessagesDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 4,
    },
    newMessagesDividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6',
        opacity: 0.6,
    },
    newMessagesDividerText: {
        fontSize: 12,
        fontWeight: '600',
        color: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6',
        marginHorizontal: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    // Scroll to Bottom FAB styles
    scrollToBottomFAB: {
        position: 'absolute',
        bottom: 100,
        right: 20,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 1000,
    },
});

// Helper to fetch a single message by ID (e.g., for reply previews if not in current `messages` state)
const fetchMessageById = async (messageId: string): Promise<ChatMessage | null> => {
    try {
        const { data: dbMessage, error } = await supabase
            .from('messages')
            .select('*, message_status(is_delivered, delivered_at, is_seen, seen_at)')
            .eq('id', messageId)
            .maybeSingle(); // Changed from .single() to .maybeSingle()
            
        if (error) {
            console.error("Error fetching message by ID:", error);
            return null;
        }
        if (!dbMessage) {
            console.warn("Message not found for ID:", messageId);
            return null;
        }
        
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
                    
                    // Check metadata for stored event image first
                    let eventImage = DEFAULT_EVENT_IMAGE_CHAT;
                    let eventDateTime: string | null = null;
                    if (dbMessage.metadata && typeof dbMessage.metadata === 'object' && dbMessage.metadata.shared_event) {
                        const metadataEvent = dbMessage.metadata.shared_event as any;
                        if (metadataEvent.eventImage) {
                            eventImage = metadataEvent.eventImage;
                        }
                        if (metadataEvent.eventDateTime) {
                            eventDateTime = metadataEvent.eventDateTime;
                        }
                    }
                    
                    sharedEventInfo = { 
                        eventId: eventId, 
                        eventTitle: eventName.trim(), 
                        eventDate: eventDate.trim(), 
                        eventVenue: eventVenue.trim(), 
                        eventImage: eventImage,
                        eventDateTime: eventDateTime,
                    };
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