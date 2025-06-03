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
                        {isCurrentUser && message.isDelivered && !message.isSeen && <Feather name="check" size={12} color="#A0AEC0" style={{ marginLeft: 4 }} />} 
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
            <View style={[styles.messageRow, isCurrentUser ? styles.messageRowSent : styles.messageRowReceived]}>
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
                                {isCurrentUser && message.isDelivered && !message.isSeen && <Feather name="check" size={12} color="rgba(255,255,255,0.5)" style={{ marginLeft: 4 }} />} 
                            </Text>
                        </View>
                    </View>
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
                    <TouchableOpacity 
                        onPress={() => onImagePress(message.image!)}
                        style={[styles.messageBubble, styles.imageBubble, isCurrentUser ? styles.messageBubbleSentImage : styles.messageBubbleReceivedImage, isHighlighted && styles.highlightedImageBubble]}
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
                        {message.isEdited && <Text style={styles.editedIndicatorImage}>(edited)</Text>}
                    </TouchableOpacity>
                    <Text style={[styles.timeText, isCurrentUser ? styles.timeTextSent : styles.timeTextReceived]}>
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
                    <Text style={[styles.messageText, isCurrentUser ? styles.messageTextSent : styles.messageTextReceived]}>
                        {message.text}
                    </Text>
                    <View style={styles.timeAndEditContainer}>
                        {message.isEdited && <Text style={[styles.editedIndicator, isCurrentUser ? styles.editedIndicatorSent : styles.editedIndicatorReceived]}>(edited)</Text>}
                        <Text style={[styles.timeText, styles.timeTextInsideBubble, isCurrentUser ? styles.timeTextInsideSentBubble : styles.timeTextInsideReceivedBubble]}>
                            {formatTime(message.createdAt)}
                            {isCurrentUser && message.isSeen && <Feather name="check-circle" size={12} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />} 
                            {isCurrentUser && message.isDelivered && !message.isSeen && <Feather name="check" size={12} color="rgba(255,255,255,0.5)" style={{ marginLeft: 4 }} />} 
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

    // --- State for message highlighting ---
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
    // --- End State for message highlighting ---

    // --- State for scroll management ---
    const [isUserScrolling, setIsUserScrolling] = useState(false);
    const [isNearBottom, setIsNearBottom] = useState(true);
    const [isScrollingToMessage, setIsScrollingToMessage] = useState(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
                .select('id, created_at')
                .single();

            if (insertError) throw insertError;
            if (!insertedMessage) throw new Error('Failed to insert shared event message.');

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
                    try {
                        const { data: hiddenCheck, error: hiddenError } = await supabase
                            .from('user_hidden_messages')
                            .select('message_id')
                            .eq('user_id', currentUserId)
                            .eq('message_id', newMessageDb.id)
                            .maybeSingle(); // Changed from implicit single to maybeSingle
                            
                        if (hiddenError) {
                            console.warn("Error checking if message is hidden:", hiddenError.message);
                            // Continue processing the message despite the error
                        } else if (hiddenCheck) {
                            console.log("Message is hidden for current user, skipping");
                            return; // Skip if hidden
                        }
                    } catch (hiddenCheckErr) {
                        console.warn("Exception checking hidden message status:", hiddenCheckErr);
                        // Continue processing the message
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
                            // Continue without reply preview
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
                    try {
                        checkMutualInitiation([...messages, receivedMessage]);
                    } catch (mutualErr) {
                        console.warn("Error checking mutual initiation:", mutualErr);
                    }
                     // If the message is for the current user, mark as delivered
                    if (receivedMessage.user._id === matchUserId && currentUserId) { // Message from other user to me
                        try {
                            await markMessageDelivered(receivedMessage._id);
                        } catch (deliveredErr) {
                            console.warn("Error marking message as delivered:", deliveredErr);
                        }
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
                    try {
                        const { data: hiddenCheck, error: hiddenError } = await supabase
                            .from('user_hidden_messages')
                            .select('message_id')
                            .eq('user_id', currentUserId)
                            .eq('message_id', updatedMessageDb.id)
                            .maybeSingle(); // Changed from implicit single to maybeSingle
                            
                        if (hiddenError) {
                            console.warn("Error checking if updated message is hidden:", hiddenError.message);
                        } else if (hiddenCheck && !updatedMessageDb.is_deleted) {
                            console.log("Updated message is hidden for current user, skipping unless delete");
                            return;
                        }
                    } catch (hiddenCheckErr) {
                        console.warn("Exception checking hidden status for updated message:", hiddenCheckErr);
                        // Continue processing
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
                            // Continue without reply preview
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
    }, [isScrollingToMessage]);
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

    // --- Cleanup scroll timeout on unmount ---
    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, []);

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
                            onReplyPress={handleScrollToMessage}
                            getRepliedMessagePreview={getRepliedMessagePreview}
                            isHighlighted={item._id === highlightedMessageId}
                        />
                    )}
                    renderSectionHeader={({ section: { title } }) => (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionHeaderText}>{title}</Text>
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
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
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
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
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
    messageInfoText: {
        fontSize: 16,
        color: '#374151',
        marginBottom: 12,
    },
    messageInfoDetailText: {
        fontSize: 15,
        color: '#4B5563',
        marginBottom: 8,
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