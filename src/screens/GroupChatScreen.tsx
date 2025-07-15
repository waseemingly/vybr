import React, { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import {
    View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Pressable,
    Platform, TextInput, SectionList, KeyboardAvoidingView, Keyboard,
    Modal, Alert, Image, ScrollView, Dimensions,
    RefreshControl, FlatList, StatusBar, AppState // Add AppState for background/foreground detection
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import ImageViewer from 'react-native-image-zoom-viewer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import UnifiedNotificationService from '@/services/UnifiedNotificationService';
import { useUnreadCount } from '@/hooks/useUnreadCount';

// --- Adjust Paths ---
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useRealtime } from '@/context/RealtimeContext';

import type { RootStackParamList, MainStackParamList } from '@/navigation/AppNavigator'; // Adjust path
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
    } catch (e) {
        console.warn("Format time error:", date, e);
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
            eventDateTime?: string; // Add the ISO datetime field
            isSharing: boolean;
        }
    }
}, 'GroupChatScreen'>;
type GroupChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList & MainStackParamList, 'GroupChatScreen'>;
interface DbGroupMessage {
    id: string;
    created_at: string;
    sender_id: string;
    group_id: string;
    content: string | null;
    image_url: string | null;
    is_system_message: boolean;
    metadata?: any; // Add metadata property for shared event data
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
    // Add seenBy to track who has seen the message and when
    seenBy?: {
        userId: string;
        userName: string;
        seenAt: Date;
    }[];
}
interface UserProfileInfo { user_id: string; first_name: string | null; last_name: string | null; profile_picture: string | null; }
interface DbGroupChat { id: string; group_name: string; group_image: string | null; can_members_add_others?: boolean; can_members_edit_info?: boolean; }

// --- Constants and Cache ---
const userProfileCache: Record<string, { name?: string; avatar?: string }> = {};
const DEFAULT_PROFILE_PIC = APP_CONSTANTS?.DEFAULT_PROFILE_PIC || 'https://via.placeholder.com/40/CCCCCC/808080?text=User';
const DEFAULT_GROUP_PIC = 'https://via.placeholder.com/40/CCCCCC/808080?text=Group';
const DEFAULT_EVENT_IMAGE_CHAT = "https://via.placeholder.com/800x450/E5E7EB/9CA3AF?text=Event+Image";
const DEFAULT_ORGANIZER_LOGO_CHAT = "https://via.placeholder.com/150/BFDBFE/1E40AF?text=Organizer";
const DEFAULT_ORGANIZER_NAME_CHAT = "Event Organizer";

// --- GroupMessageBubble Component ---
interface GroupMessageBubbleProps {
    message: ChatMessage;
    currentUserId: string | undefined;
    onImagePress: (imageUri: string) => void;
    onEventPress?: (eventId: string) => void;
    onMessageLongPress: (message: ChatMessage) => void;
    onReplyPress: (messageId: string) => void;
    getRepliedMessagePreview: (messageId: string) => ChatMessage['replyToMessagePreview'] | null;
    isHighlighted?: boolean;
}

const areEqual = (prevProps: GroupMessageBubbleProps, nextProps: GroupMessageBubbleProps) => {
    // Always re-render if isSeen or seenBy changes
    return (
        prevProps.message._id === nextProps.message._id &&
        prevProps.message.isSeen === nextProps.message.isSeen &&
        JSON.stringify(prevProps.message.seenBy) === JSON.stringify(nextProps.message.seenBy) &&
        prevProps.isHighlighted === nextProps.isHighlighted
    );
};

const GroupMessageBubble: React.FC<GroupMessageBubbleProps> = React.memo(({
    message,
    currentUserId,
    onImagePress,
    onEventPress,
    onMessageLongPress,
    onReplyPress,
    getRepliedMessagePreview,
    isHighlighted = false
}) => {
    const isCurrentUser = message.user._id === currentUserId;
    const senderName = message.user.name;
    const [imageError, setImageError] = useState(false);
    const [hasLoggedImpression, setHasLoggedImpression] = useState(false);
    
    // Debug: Log when isSeen changes for sender's messages
    useEffect(() => {
        if (isCurrentUser) {
            console.log('[GroupMessageBubble] Message seen status:', {
                messageId: message._id,
                isSeen: message.isSeen,
                seenByCount: message.seenBy?.length || 0,
                seenByUsers: message.seenBy?.map(s => s.userName) || []
            });
        }
    }, [message.isSeen, message.seenBy, isCurrentUser, message._id]);

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
                    console.log(`[IMPRESSION] Logging impression for future event: ${message.sharedEvent?.eventId} from group chat`);
                    const { error } = await supabase.from('event_impressions').insert({
                        event_id: message.sharedEvent?.eventId,
                        user_id: currentUserId || null,
                        source: 'group_chat',
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

    // System Message
    if (message.isSystemMessage) {
        return (
            <View style={styles.systemMessageContainer}>
                <Text style={styles.systemMessageText}>{message.text}</Text>
            </View>
        );
    }

    // Deleted Message
    if (message.isDeleted) {
        return (
            <View style={[styles.messageRow, isCurrentUser ? styles.messageRowSent : styles.messageRowReceived]}>
                <View style={styles.messageContentContainer}>
                    {!isCurrentUser && (
                        <View style={styles.senderInfoContainer}>
                            <Image
                                source={{ uri: message.user.avatar || DEFAULT_PROFILE_PIC }}
                                style={styles.senderAvatar}
                                onError={() => console.warn('Failed to load sender avatar, using default')}
                                defaultSource={{ uri: DEFAULT_PROFILE_PIC }}
                            />
                            {senderName && senderName !== 'User' && (
                                <Text style={styles.senderName}>{senderName}</Text>
                            )}
                        </View>
                    )}
                    <View style={[styles.messageBubble, styles.deletedMessageBubble, isCurrentUser ? styles.messageBubbleSent : styles.messageBubbleReceived]}>
                        <Feather name="slash" size={14} color={isCurrentUser ? "rgba(255,255,255,0.7)" : "#9CA3AF"} style={{ marginRight: 6 }} />
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

    // Determine the text for the seen status (exclude sender from count)
    const seenByCount = message.seenBy?.filter(s => s.userId !== message.user._id).length || 0;
    const seenByText = seenByCount > 0 ? `Seen by ${seenByCount}` : null;

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
                <View style={[styles.messageContentContainer, isHighlighted && styles.highlightedMessageContainer]}>
                    {!isCurrentUser && (
                        <View style={styles.senderInfoContainer}>
                            <Image
                                source={{ uri: message.user.avatar || DEFAULT_PROFILE_PIC }}
                                style={styles.senderAvatar}
                                onError={() => console.warn('Failed to load sender avatar, using default')}
                                defaultSource={{ uri: DEFAULT_PROFILE_PIC }}
                            />
                            {senderName && senderName !== 'User' && (
                                <Text style={styles.senderName}>{senderName}</Text>
                            )}
                        </View>
                    )}
                    <View style={[
                        styles.messageBubble,
                        styles.sharedEventMessageBubble,
                        isCurrentUser ? styles.messageBubbleSent : styles.messageBubbleReceived,
                        isHighlighted && styles.highlightedMessageBubble
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
                <View style={[styles.messageContentContainer, isHighlighted && styles.highlightedMessageContainer]}>
                    {!isCurrentUser && (
                        <View style={styles.senderInfoContainer}>
                            <Image
                                source={{ uri: message.user.avatar || DEFAULT_PROFILE_PIC }}
                                style={styles.senderAvatar}
                                onError={() => console.warn('Failed to load sender avatar, using default')}
                                defaultSource={{ uri: DEFAULT_PROFILE_PIC }}
                            />
                            {senderName && senderName !== 'User' && (
                                <Text style={styles.senderName}>{senderName}</Text>
                            )}
                        </View>
                    )}

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
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Feather name="image" size={12} color="#6B7280" style={{ marginRight: 4 }} />
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
                            resizeMode="cover"
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

    // Text Message
    if (message.text) {
        return (
            <TouchableOpacity
                style={[styles.messageRowTouchable, isCurrentUser ? styles.messageRowSent : styles.messageRowReceived]}
                onLongPress={() => onMessageLongPress(message)}
                delayLongPress={200}
                activeOpacity={0.8}
            >
                <View style={[styles.messageContentContainer, isHighlighted && styles.highlightedMessageContainer]}>
                    {!isCurrentUser && (
                        <View style={styles.senderInfoContainer}>
                            <Image
                                source={{ uri: message.user.avatar || DEFAULT_PROFILE_PIC }}
                                style={styles.senderAvatar}
                                onError={() => console.warn('Failed to load sender avatar, using default')}
                                defaultSource={{ uri: DEFAULT_PROFILE_PIC }}
                            />
                            {senderName && senderName !== 'User' && (
                                <Text style={styles.senderName}>{senderName}</Text>
                            )}
                        </View>
                    )}

                    {/* Reply Preview for Text */}
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
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Feather name="image" size={12} color="#6B7280" style={{ marginRight: 4 }} />
                                        <Text style={styles.replyPreviewText} numberOfLines={1}>{repliedMessagePreview.text}</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.replyPreviewText} numberOfLines={1}>{repliedMessagePreview.text}</Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    )}

                    <View style={[styles.messageBubble, isCurrentUser ? styles.messageBubbleSent : styles.messageBubbleReceived, isHighlighted && styles.highlightedMessageBubble]}>
                        <Text style={[styles.messageText, isCurrentUser ? styles.messageTextSent : styles.messageTextReceived]}>{message.text}</Text>
                        <View style={styles.timeAndEditContainer}>
                            {message.isEdited && <Text style={[styles.editedIndicator, isCurrentUser ? styles.editedIndicatorSent : styles.editedIndicatorReceived]}>(edited)</Text>}
                            <Text style={[styles.timeText, styles.timeTextInsideBubble, isCurrentUser ? styles.timeTextInsideSentBubble : styles.timeTextInsideReceivedBubble]}>
                                {formatTime(message.createdAt)}
                                {isCurrentUser && message.isSeen && <Feather name="check-circle" size={12} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />}
                            </Text>
                        </View>
                    </View>
                    {isCurrentUser && seenByText && (
                        <Text style={styles.seenByText}>{seenByText}</Text>
                    )}
                </View>
            </TouchableOpacity>
        );
    }

    return null; // Fallback
}, areEqual);


// --- GroupChatScreen Component ---
const GroupChatScreen: React.FC = () => {
    const route = useRoute<GroupChatScreenRouteProp>();
    const navigation = useNavigation<GroupChatScreenNavigationProp>();
    const { session } = useAuth();
    const { refreshUnreadCount } = useUnreadCount();
    const { presenceState, subscribeToGroupChat, sendGroupTypingIndicator, sendBroadcast, subscribeToEvent, unsubscribeFromEvent } = useRealtime();
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

    // --- Realtime state ---

    const [typingUsers, setTypingUsers] = useState<Map<string, { name: string; timestamp: number }>>(new Map());
    const [groupMembers, setGroupMembers] = useState<Map<string, { name: string; avatar?: string }>>(new Map());
    const typingTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
    // --- End Realtime state ---

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
    
    // Forward functionality states
    const [forwardModalVisible, setForwardModalVisible] = useState(false);
    const [forwardMessage, setForwardMessage] = useState<ChatMessage | null>(null);
    const [availableChats, setAvailableChats] = useState<Array<{id: string, name: string, type: 'individual' | 'group'}>>([]);
    const [loadingChats, setLoadingChats] = useState(false);
    // --- End State for Event Detail Modal ---

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
    // --- End State for scroll management ---

    // --- State for Real-time Features ---
    const [onlineMembers, setOnlineMembers] = useState<Set<string>>(new Set());
    // --- End State for Real-time Features ---

    // --- Event Press Handler (similar to IndividualChatScreen) ---
    const handleEventPressInternal = async (eventId: string) => {
        if (!eventId) {
            console.warn("[GroupChatScreen] handleEventPressInternal called with empty eventId");
            return;
        }
        console.log("[GroupChatScreen] Event preview pressed, Event ID:", eventId);
        setLoadingEventDetails(true);
        setSelectedEventDataForModal(null);
        try {
            console.log("[GroupChatScreen] Fetching event details from database...");
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
                console.error("[GroupChatScreen] Error fetching event for group chat:", eventError);
                throw eventError;
            }
            if (!eventData) {
                console.warn("[GroupChatScreen] Event not found for ID in group chat:", eventId);
                throw new Error("Event not found");
            }

            console.log("[GroupChatScreen] Event data fetched successfully:", {
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
                    console.log("[GroupChatScreen] Fetching organizer profile for:", eventData.organizer_id);
                    const { data: profileData, error: profileError } = await supabase
                        .from('organizer_profiles')
                        .select('user_id, company_name, logo')
                        .eq('user_id', eventData.organizer_id)
                        .maybeSingle(); // Changed from .single() to .maybeSingle()

                    if (profileError) {
                        console.warn("[GroupChatScreen] Could not fetch organizer profile in group chat:", profileError.message);
                    } else if (profileData) {
                        console.log("[GroupChatScreen] Organizer profile fetched successfully");
                        organizerProfile = profileData;
                    } else {
                        console.warn("[GroupChatScreen] No organizer profile found for ID:", eventData.organizer_id);
                    }
                } catch (profileErr) {
                    console.warn("[GroupChatScreen] Exception fetching organizer profile in group chat:", profileErr);
                    // Continue without organizer profile
                }
            }

            const mappedEvent: MappedEvent = {
                id: eventData.id,
                title: eventData.title || "Event Title",
                date: formatEventDateTimeForModal(eventData.event_datetime).date,
                time: formatEventDateTimeForModal(eventData.event_datetime).time,
                venue: eventData.location_text || "Venue N/A",
                images: eventData.poster_urls && eventData.poster_urls.length > 0 ? eventData.poster_urls : [DEFAULT_EVENT_IMAGE_CHAT],
                organizer: {
                    userId: organizerProfile?.user_id || eventData.organizer_id || "N/A",
                    name: organizerProfile?.company_name || DEFAULT_ORGANIZER_NAME_CHAT,
                    image: organizerProfile?.logo || DEFAULT_ORGANIZER_LOGO_CHAT,
                },
                description: eventData.description || "No description available.",
                event_datetime_iso: eventData.event_datetime || new Date().toISOString(),
                genres: eventData.tags_genres || [],
                artists: eventData.tags_artists || [],
                songs: eventData.tags_songs || [],
                booking_type: eventData.booking_type,
                ticket_price: eventData.ticket_price,
                pass_fee_to_user: eventData.pass_fee_to_user ?? true,
                max_tickets: eventData.max_tickets,
                max_reservations: eventData.max_reservations,
            };
            console.log("[GroupChatScreen] Mapped event data successfully, opening modal");
            setSelectedEventDataForModal(mappedEvent);
            setEventModalVisible(true);
        } catch (err: any) {
            console.error("[GroupChatScreen] Error fetching event details for group chat:", err);
            Alert.alert("Error", `Could not load event details: ${err.message}`);
        } finally {
            setLoadingEventDetails(false);
            console.log("[GroupChatScreen] handleEventPressInternal completed");
        }
    };
    // --- End Event Press Handler ---

    // Memoized sections
    const sections = useMemo(() => { const groups: Record<string, ChatMessage[]> = {}; messages.forEach(msg => { const dateKey = msg.createdAt.toDateString(); if (!groups[dateKey]) groups[dateKey] = []; groups[dateKey].push(msg); }); const sortedKeys = Object.keys(groups).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()); const today = new Date(); today.setHours(0, 0, 0, 0); const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1); const oneWeekAgo = new Date(today); oneWeekAgo.setDate(today.getDate() - 7); return sortedKeys.map(dateKey => { const date = new Date(dateKey); date.setHours(0, 0, 0, 0); let title = 'Older'; if (date.getTime() === today.getTime()) title = 'Today'; else if (date.getTime() === yesterday.getTime()) title = 'Yesterday'; else if (date > oneWeekAgo) title = date.toLocaleDateString(undefined, { weekday: 'long' }); else title = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); return { title, data: groups[dateKey] }; }); }, [messages]);

    // Map DB Message to UI
    const mapDbMessageToChatMessage = useCallback((dbMessage: DbGroupMessage, profilesMap: Map<string, UserProfileInfo>): ChatMessage => {
        let senderName = 'User'; let senderAvatar: string | undefined = undefined; if (dbMessage.sender_id) { const pfc = userProfileCache[dbMessage.sender_id]; if (pfc) { senderName = pfc.name || 'User'; senderAvatar = pfc.avatar; } else { const pfm = profilesMap.get(dbMessage.sender_id); if (pfm) { senderName = `${pfm.first_name || ''} ${pfm.last_name || ''}`.trim() || 'User'; senderAvatar = pfm.profile_picture || undefined; if (!dbMessage.is_system_message) userProfileCache[dbMessage.sender_id] = { name: senderName, avatar: senderAvatar }; } } } if (currentUserId && !userProfileCache[currentUserId]) userProfileCache[currentUserId] = { name: 'You', avatar: undefined };

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

                    // Check metadata for stored event image first
                    let eventImage = DEFAULT_EVENT_IMAGE_CHAT;
                    let eventDateTime: string | null = null;
                    if (dbMessage.metadata && typeof dbMessage.metadata === 'object' && (dbMessage.metadata as any).shared_event) {
                        const metadataEvent = (dbMessage.metadata as any).shared_event;
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
                    // Show proper user name in the display text
                    const displayName = dbMessage.sender_id === currentUserId ? 'You' : senderName;
                    displayText = `${displayName} shared an event`;
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
            isDelivered: false, // Will be set by calling code from joined data
            deliveredAt: null,
            isSeen: false, // Will be set by calling code from joined data
            seenAt: null,
            seenBy: [], // Initialize seenBy array
        };
    }, [currentUserId]);

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

    // Fetch Initial Data
    const fetchInitialData = useCallback(async () => {
        if (!currentUserId || !groupId) {
            setLoadError("Auth/Group ID missing.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setLoadError(null);
        setIsCurrentUserAdmin(false);
        setCanMembersAddOthers(false);
        setCanMembersEditInfo(false);
        try {
            const { data: groupInfoData, error: groupInfoError } = await supabase.rpc('get_group_info', { group_id_input: groupId });
            if (groupInfoError) throw groupInfoError;
            if (!groupInfoData?.group_details || !groupInfoData?.participants) throw new Error("Incomplete group data.");
            const groupDetails = groupInfoData.group_details;
            const participantsRaw: { user_id: string, is_admin: boolean }[] = groupInfoData.participants;
            const currentUserParticipant = participantsRaw.find(p => p.user_id === currentUserId);
            setIsCurrentUserAdmin(currentUserParticipant?.is_admin ?? false);
            setCanMembersAddOthers(groupDetails.can_members_add_others ?? false);
            setCanMembersEditInfo(groupDetails.can_members_edit_info ?? false);
            setCurrentGroupName(groupDetails.group_name);
            setCurrentGroupImage(groupDetails.group_image ?? null);

            // Fetch group member profiles for realtime features
            const memberIds = participantsRaw.map(p => p.user_id);
            const newGroupMembers = new Map<string, { name: string; avatar?: string }>();

            if (memberIds.length > 0) {
                try {
                    const { data: profilesData, error: profilesError } = await supabase
                        .from('music_lover_profiles')
                        .select('user_id, first_name, last_name, profile_picture')
                        .in('user_id', memberIds);

                    if (profilesError) {
                        console.warn("Error fetching group member profiles:", profilesError);
                    } else if (profilesData) {
                        profilesData.forEach((profile: any) => {
                            const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User';
                            newGroupMembers.set(profile.user_id, {
                                name: displayName,
                                avatar: profile.profile_picture || undefined
                            });
                        });
                    }
                } catch (profileErr) {
                    console.warn("Exception fetching group member profiles:", profileErr);
                }
            }

            setGroupMembers(newGroupMembers);

            const { data: messagesData, error: messagesError } = await supabase
                .from('group_chat_messages')
                .select(`
                    id, created_at, sender_id, group_id, content, image_url, is_system_message, metadata, 
                    original_content, is_edited, edited_at, is_deleted, deleted_at, reply_to_message_id,
                    group_message_status(*)
                `)
                .eq('group_id', groupId)
                .order('created_at', { ascending: true });

            if (messagesError) throw messagesError;

            if (!messagesData || messagesData.length === 0) {
                setMessages([]);
            } else {
                const visibleMessages = messagesData.filter(msg => !msg.is_system_message && msg.sender_id);
                const senderIds = Array.from(new Set(visibleMessages.map(msg => msg.sender_id).filter(id => id)));
                const profilesMap = new Map<string, UserProfileInfo>();
                if (senderIds.length > 0) {
                    const idsToFetch = senderIds.filter(id => !userProfileCache[id]);
                    if (idsToFetch.length > 0) {
                        const { data: profilesData, error: profilesError } = await supabase.from('music_lover_profiles').select('user_id, first_name, last_name, profile_picture').in('user_id', idsToFetch);
                        if (profilesError) {
                            console.error("Err fetch profiles:", profilesError);
                        } else if (profilesData) {
                            profilesData.forEach((p: UserProfileInfo) => {
                                profilesMap.set(p.user_id, p);
                                const n = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'User';
                                const a = p.profile_picture || undefined;
                                userProfileCache[p.user_id] = { name: n, avatar: a };
                            });
                        }
                    }
                    senderIds.forEach(id => {
                        if (userProfileCache[id] && !profilesMap.has(id)) {
                            profilesMap.set(id, { user_id: id, first_name: userProfileCache[id].name?.split(' ')[0] || null, last_name: userProfileCache[id].name?.split(' ')[1] || null, profile_picture: userProfileCache[id].avatar || null });
                        }
                    });
                }
                if (currentUserId && !userProfileCache[currentUserId]) userProfileCache[currentUserId] = { name: 'You' };

                const mappedMessages = visibleMessages.map((dbMsg: any) => {
                    const chatMsg = mapDbMessageToChatMessage(dbMsg as DbGroupMessage, profilesMap);

                    const allStatuses = dbMsg.group_message_status || [];

                    // Populate the seenBy array with everyone who has seen the message (excluding sender)
                    chatMsg.seenBy = allStatuses
                        .filter((s: any) => s.is_seen && s.user_id !== dbMsg.sender_id) // Exclude sender from seenBy
                        .map((s: any) => ({
                            userId: s.user_id,
                            userName: newGroupMembers.get(s.user_id)?.name || 'Someone',
                            seenAt: new Date(s.seen_at)
                        }));

                    // For messages sent by the current user, isSeen is true if anyone else has seen it.
                    if (chatMsg.user._id === currentUserId) {
                        chatMsg.isSeen = (chatMsg.seenBy || []).length > 0; // If anyone else has seen it
                    } else {
                        // For messages received by the current user, isSeen is true if they have seen it.
                        const currentUserStatus = allStatuses.find((s: any) => s.user_id === currentUserId && s.is_seen);
                        chatMsg.isSeen = !!currentUserStatus;
                        chatMsg.seenAt = currentUserStatus ? new Date(currentUserStatus.seen_at) : null;
                    }

                    return chatMsg;
                });
                setMessages(mappedMessages);
            }
        } catch (err: any) {
            console.error("Error fetching initial data:", err);
            if (err.message?.includes("User is not a member")) {
                Alert.alert("Access Denied", "Not member.", [{ text: "OK", onPress: () => navigation.goBack() }]);
                setLoadError("Not a member.");
            } else {
                setLoadError(`Load fail: ${err.message || 'Unknown'}`);
            }
            setMessages([]);
            setIsCurrentUserAdmin(false);
            setCanMembersAddOthers(false);
            setCanMembersEditInfo(false);
        } finally {
            setLoading(false);
        }
    }, [currentUserId, groupId, navigation, mapDbMessageToChatMessage]);

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
            isDelivered: true,
            deliveredAt: new Date(),
            isSeen: false, // Sender's message is not "seen" until others see it
            seenAt: null,
            seenBy: [], // Sender should not be in seenBy list
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
                .select('*') 
                .single();

            if (insertError) throw insertError;

            if (!insertedData) throw new Error("Text send no confirmation.");

            // Create group message status entries for all group members (except sender)
            const membersToCreateStatusFor = Array.from(groupMembers.keys()).filter(id => id !== currentUserId);
            if (membersToCreateStatusFor.length > 0) {
                try {
                    const statusEntries = membersToCreateStatusFor.map(userId => ({
                        message_id: insertedData.id,
                        user_id: userId,
                        group_id: groupId,
                        is_delivered: false,
                        is_seen: false
                    }));

                    const { error: statusError } = await supabase
                        .from('group_message_status')
                        .insert(statusEntries);

                    if (statusError) {
                        console.warn('Failed to create group message status entries:', statusError);
                    }
                } catch (statusErr) {
                    console.warn('Exception creating group message status entries:', statusErr);
                }
            }

            // Send broadcast for typing indicators and other real-time features
            sendBroadcast('group', groupId, 'message', insertedData);

            setMessages(prevMessages => prevMessages.map(msg =>
                msg._id === tempId ? {
                    ...msg,
                    _id: insertedData.id,
                    createdAt: new Date(insertedData.created_at)
                } : msg
            ));

            // --- Send Notification to all members except sender ---
            const membersToNotify = Array.from(groupMembers.entries())
                .filter(([userId, _]) => userId !== currentUserId)
                .map(([userId, _]) => userId);

            if (membersToNotify.length > 0) {
                try {
                    const notificationPromises = membersToNotify.map(userId =>
                        UnifiedNotificationService.notifyNewMessage({
                            receiver_id: userId,
                            sender_id: currentUserId,
                            sender_name: currentUserProfile.name || 'Someone',
                            message_id: insertedData.id,
                            content: trimmedText,
                            is_group: true,
                            group_id: groupId,
                            group_name: currentGroupName || 'Group Chat',
                        })
                    );
                    await Promise.all(notificationPromises);
                } catch (notificationError) {
                    console.error("Failed to send group message notifications:", notificationError);
                }
            }

            if (sendError) setSendError(null);

        } catch (err: any) {
            console.error("Error sending text:", err);
            setSendError(`Send fail: ${err.message}`);
            setMessages(prevMessages => prevMessages.filter(msg => msg._id !== tempId));
            setInputText(trimmedText);
        }
    }, [currentUserId, groupId, sendError, isUploading, replyingToMessage, userProfileCache, groupMembers, currentGroupName, sendBroadcast]);

    const broadcastTyping = useCallback(() => {
        if (!currentUserId || !groupId) return;
        // Use the RealtimeContext typing indicator
        const senderName = userProfileCache[currentUserId]?.name || 'You';
        sendGroupTypingIndicator(groupId, true, senderName);
    }, [currentUserId, groupId, sendGroupTypingIndicator, userProfileCache]);

    // Enhanced typing indicator with individual user tracking
    const handleTextInputChange = useCallback((text: string) => {
        setInputText(text);

        // Broadcast typing event using RealtimeContext
        if (text.trim() && currentUserId && groupId) {
            broadcastTyping();
        } else if (!text.trim() && currentUserId && groupId) {
            // Stop typing when input is empty
            const senderName = userProfileCache[currentUserId]?.name || 'You';
            sendGroupTypingIndicator(groupId, false, senderName);
        }
    }, [currentUserId, groupId, broadcastTyping, sendGroupTypingIndicator, userProfileCache]);

    const shareEventToGroupViaRpc = useCallback(async (eventDataToShare: typeof initialSharedEventData) => {
        if (!currentUserId || !groupId || !eventDataToShare || isUploading) return;
        const { eventId } = eventDataToShare;

        // Optimistic message construction
        const tempId = `temp_shared_${Date.now()}`;
        const currentUserProfile = userProfileCache[currentUserId] || { name: 'You' };
        const eventMessageText = `You shared an event`;

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
                eventDateTime: eventDataToShare.eventDateTime || null, // Include the ISO datetime if available
            },
            replyToMessageId: replyingToMessage?._id || null,
            replyToMessagePreview: replyingToMessagePreview,
            isDelivered: true,
            deliveredAt: new Date(),
            isSeen: false, // Sender's message is not "seen" until others see it
            seenAt: null,
            seenBy: [], // Sender should not be in seenBy list
        };

        setMessages(prevMessages => [...prevMessages, optimisticMessage]);
        setInputText('');
        setSharedEventMessage(null);
        setSendError(null);
        Keyboard.dismiss();
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

            // Create formatted content for the message (similar to individual chat format)
            const formattedContent = `SHARED_EVENT:${eventId}:${eventDataToShare.eventTitle} on ${eventDataToShare.eventDate} at ${eventDataToShare.eventVenue}`;

            // Insert message directly into group_chat_messages table
            const { data: insertedMessage, error: insertError } = await supabase
                .from('group_chat_messages')
                .insert({
                    sender_id: currentUserId,
                    group_id: groupId,
                    content: formattedContent,
                    reply_to_message_id: replyToId || null,
                    is_system_message: false,
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
            if (!insertedMessage) throw new Error('Failed to insert shared event message to group.');

            // Create group message status entries for all group members (except sender)
            const membersToCreateStatusFor = Array.from(groupMembers.keys()).filter(id => id !== currentUserId);
            if (membersToCreateStatusFor.length > 0) {
                try {
                    const statusEntries = membersToCreateStatusFor.map(userId => ({
                        message_id: insertedMessage.id,
                        user_id: userId,
                        group_id: groupId,
                        is_delivered: false,
                        is_seen: false
                    }));

                    const { error: statusError } = await supabase
                        .from('group_message_status')
                        .insert(statusEntries);

                    if (statusError) {
                        console.warn('Failed to create group message status entries for shared event:', statusError);
                    }
                } catch (statusErr) {
                    console.warn('Exception creating group message status entries for shared event:', statusErr);
                }
            }

            // Send broadcast for typing indicators and other real-time features
            sendBroadcast('group', groupId, 'message', insertedMessage);

            // Log event impression
            try {
                await supabase.from('event_impressions').insert({
                    event_id: eventId,
                    user_id: currentUserId,
                    source: 'group_chat_share',
                    viewed_at: new Date().toISOString()
                });
            } catch (impressionError) {
                console.warn('Failed to log event impression:', impressionError);
                // Don't fail the whole operation for impression logging
            }

            console.log('[GroupChatScreen] Event shared to group successfully, message_id:', insertedMessage.id);
            setMessages(prevMessages => prevMessages.map(msg =>
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

            // --- Send Notification ---
            const membersToNotify = Array.from(groupMembers.keys()).filter(id => id !== currentUserId);
            if (membersToNotify.length > 0) {
                try {
                    const senderName = userProfileCache[currentUserId]?.name || 'Someone';
                    const notificationPromises = membersToNotify.map(userId =>
                        UnifiedNotificationService.notifyNewMessage({
                            receiver_id: userId,
                            sender_id: currentUserId,
                            sender_name: senderName,
                            message_id: insertedMessage.id,
                            content: `Shared an event: ${eventDataToShare.eventTitle}`,
                            is_group: true,
                            group_id: groupId,
                            group_name: currentGroupName || 'Group Chat',
                        })
                    );
                    await Promise.all(notificationPromises);
                } catch (notificationError) {
                    console.error("Failed to send group event share notifications:", notificationError);
                }
            }

        } catch (err: any) {
            console.error("Error sharing event to group:", err);
            setSendError(`Event share fail: ${err.message}`);
            setMessages(prevMessages => prevMessages.filter(msg => msg._id !== tempId));
        }
    }, [currentUserId, groupId, isUploading, replyingToMessage, userProfileCache, currentGroupName, sendBroadcast]);

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
                isDelivered: true,
                deliveredAt: new Date(),
                isSeen: false, // Sender's message is not "seen" until others see it
                seenAt: null,
                seenBy: [], // Sender should not be in seenBy list
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
                    content: '[Image]', // Provide default content for image messages
                    image_url: urlData.publicUrl,
                    is_system_message: false,
                    reply_to_message_id: replyToId || null
                })
                .select('id, created_at, image_url')
                .single();

            if (insertError) {
                // Clean up storage if DB insert fails
                await supabase.storage.from('group-chat-images').remove([filePath]);
                throw insertError;
            }

            // Create group message status entries for all group members (except sender)
            const membersToCreateStatusFor = Array.from(groupMembers.keys()).filter(id => id !== currentUserId);
            if (membersToCreateStatusFor.length > 0) {
                try {
                    const statusEntries = membersToCreateStatusFor.map(userId => ({
                        message_id: insertedData.id,
                        user_id: userId,
                        group_id: groupId,
                        is_delivered: false,
                        is_seen: false
                    }));

                    const { error: statusError } = await supabase
                        .from('group_message_status')
                        .insert(statusEntries);

                    if (statusError) {
                        console.warn('Failed to create group message status entries for image:', statusError);
                    }
                } catch (statusErr) {
                    console.warn('Exception creating group message status entries for image:', statusErr);
                }
            }

            // Send broadcast for typing indicators and other real-time features
            sendBroadcast('group', groupId, 'message', insertedData);

            // Update the message with the final data
            setMessages(prev => prev.map(msg =>
                msg._id === tempId
                    ? {
                        ...msg,
                        _id: insertedData.id,
                        image: urlData.publicUrl,
                        createdAt: new Date(insertedData.created_at)
                    }
                    : msg
            ));

            // --- Send Notification ---
            const membersToNotify = Array.from(groupMembers.keys()).filter(id => id !== currentUserId);
            if (membersToNotify.length > 0) {
                try {
                    const senderName = userProfileCache[currentUserId]?.name || 'Someone';
                    const notificationPromises = membersToNotify.map(userId =>
                        UnifiedNotificationService.notifyNewMessage({
                            receiver_id: userId,
                            sender_id: currentUserId,
                            sender_name: senderName,
                            message_id: insertedData.id,
                            content: '[Image]',
                            is_group: true,
                            group_id: groupId,
                            group_name: currentGroupName || 'Group Chat',
                        })
                    );
                    await Promise.all(notificationPromises);
                } catch (notificationError) {
                    console.error("Failed to send group image notifications:", notificationError);
                }
            }

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

    // Add message status tracking functions for GroupChatScreen
    const markMessageDelivered = useCallback(async (messageId: string) => {
        if (!currentUserId) return;
        try {
            const { error } = await supabase.rpc('mark_group_message_delivered', {
                message_id_input: messageId,
                user_id_input: currentUserId
            });
            if (error) console.error('Error marking group message delivered:', error);
            else {
                console.log(`Group message ${messageId} marked as delivered for user ${currentUserId}.`);
                // Optimistically update UI
                setMessages(prev => prev.map(m => m._id === messageId ? { ...m, isDelivered: true, deliveredAt: new Date() } : m));
            }
        } catch (e) {
            console.error('Exception marking group message delivered:', e);
        }
    }, [currentUserId]);

    // Function to mark messages as seen when the chat screen is focused or messages are visible
    const markMessagesAsSeen = useCallback(async () => {
        if (!currentUserId || !groupId || messages.length === 0) return;

        console.log(`[GroupChatScreen] markMessagesAsSeen called with ${messages.length} messages`);

        // Find messages from others that haven't been marked as seen by the current user
        const unseenMessagesFromOthers = messages.filter(msg => {
            // Skip system messages and our own messages
            if (msg.isSystemMessage || msg.user._id === currentUserId) return false;
            
            // Check if current user has seen this message by looking at seenBy array
            const hasCurrentUserSeen = msg.seenBy?.some(seen => seen.userId === currentUserId);
            return !hasCurrentUserSeen;
        });

        if (unseenMessagesFromOthers.length === 0) {
            console.log(`[GroupChatScreen] No unseen messages from others found`);
            return;
        }

        console.log(`[GroupChatScreen] Marking ${unseenMessagesFromOthers.length} messages as seen in group ${groupId}`);
        console.log(`[GroupChatScreen] Message IDs to mark:`, unseenMessagesFromOthers.map(m => m._id));

        try {
            const messageIdsToMark = unseenMessagesFromOthers.map(msg => msg._id);
            if (messageIdsToMark.length > 0) {
                // Try the bulk mark function first
                const { error: bulkError } = await supabase.rpc('mark_all_group_messages_seen', {
                    group_id_input: groupId,
                    user_id_input: currentUserId
                });

                if (bulkError) {
                    console.error('Bulk mark failed, trying individual marks:', bulkError.message);
                    
                    // Fallback: mark messages individually
                    for (const messageId of messageIdsToMark) {
                        try {
                            const { error: individualError } = await supabase.rpc('mark_group_message_seen', {
                                message_id_input: messageId,
                                user_id_input: currentUserId
                            });
                            
                            if (individualError) {
                                console.error(`Error marking individual message ${messageId} as seen:`, individualError.message);
                            } else {
                                console.log(`Successfully marked message ${messageId} as seen`);
                            }
                        } catch (individualErr: any) {
                            console.error(`Exception marking individual message ${messageId} as seen:`, individualErr.message);
                        }
                    }
                } else {
                    console.log('[GroupChatScreen] Successfully marked group messages as seen via bulk operation');
                }
                
                // Always broadcast the status update to ensure real-time updates
                sendBroadcast('group', groupId, 'message_status', { 
                    message_ids: messageIdsToMark, 
                    seen_by: { userId: currentUserId, userName: userProfileCache[currentUserId]?.name || 'Someone' }
                });
                // Note: refreshUnreadCount() removed to prevent infinite loop
                // The unread count will be updated automatically through real-time subscriptions
            }
        } catch (e: any) {
            console.error('Exception marking group messages as seen:', e.message);
        }
    }, [currentUserId, groupId, messages, sendBroadcast]);

    // Enhanced function to check and update seen status for messages loaded from database
    const checkAndUpdateSeenStatus = useCallback(async () => {
        if (!currentUserId || !groupId || messages.length === 0) return;

        console.log(`[GroupChatScreen] checkAndUpdateSeenStatus called with ${messages.length} messages`);

        // Find messages from others that might be marked as unseen in our local state
        // but might actually be seen in the database
        const potentiallyUnseenMessages = messages.filter(msg => {
            // Skip system messages and our own messages
            if (msg.isSystemMessage || msg.user._id === currentUserId) return false;
            
            // Check if current user has seen this message by looking at seenBy array
            const hasCurrentUserSeen = msg.seenBy?.some(seen => seen.userId === currentUserId);
            return !hasCurrentUserSeen;
        });

        if (potentiallyUnseenMessages.length === 0) {
            console.log(`[GroupChatScreen] No potentially unseen messages found`);
            return;
        }

        console.log(`[GroupChatScreen] Checking seen status for ${potentiallyUnseenMessages.length} messages in group ${groupId}`);
        console.log(`[GroupChatScreen] Message IDs to check:`, potentiallyUnseenMessages.map(m => m._id));

        try {
            // Fetch the actual seen status from the database for these messages
            const messageIds = potentiallyUnseenMessages.map(msg => msg._id);
            const { data: statusData, error: statusError } = await supabase
                .from('group_message_status')
                .select('message_id, is_seen, seen_at, user_id')
                .in('message_id', messageIds)
                .eq('user_id', currentUserId)
                .eq('group_id', groupId);

            if (statusError) {
                console.error('Error fetching group message status:', statusError);
                return;
            }

            // Update messages that are actually seen in the database
            const seenMessageIds = new Set(
                statusData
                    ?.filter(status => status.is_seen)
                    .map(status => status.message_id) || []
            );

            if (seenMessageIds.size > 0) {
                console.log(`[GroupChatScreen] Found ${seenMessageIds.size} messages that are actually seen in database`);
                console.log(`[GroupChatScreen] Seen message IDs:`, Array.from(seenMessageIds));
                
                setMessages(prev => prev.map(msg => {
                    if (msg.user._id !== currentUserId && !msg.isSystemMessage && seenMessageIds.has(msg._id)) {
                        const status = statusData?.find(s => s.message_id === msg._id);
                        const currentSeenBy = [...(msg.seenBy || [])];
                        
                        // Add current user to seenBy if not already there
                        if (!currentSeenBy.some(s => s.userId === currentUserId)) {
                            currentSeenBy.push({
                                userId: currentUserId,
                                userName: userProfileCache[currentUserId]?.name || 'You',
                                seenAt: status?.seen_at ? new Date(status.seen_at) : new Date()
                            });
                        }
                        
                        // Update isSeen logic: for sender's messages, isSeen is true if others have seen it
                        // For received messages, isSeen is true if current user has seen it
                        let isSeen = msg.isSeen;
                        if (msg.user._id === currentUserId) {
                            // This is the sender's message - isSeen if others have seen it
                            isSeen = currentSeenBy.some(s => s.userId !== currentUserId);
                        } else {
                            // This is a received message - isSeen if current user has seen it
                            isSeen = currentSeenBy.some(s => s.userId === currentUserId);
                        }
                        
                        console.log(`[GroupChatScreen] Updating message ${msg._id}: isSeen=${isSeen}, seenBy count=${currentSeenBy.length}`);
                        
                        return {
                            ...msg,
                            isSeen: isSeen,
                            seenAt: status?.seen_at ? new Date(status.seen_at) : new Date(),
                            seenBy: currentSeenBy
                        };
                    }
                    return msg;
                }));
            } else {
                console.log(`[GroupChatScreen] No messages found to be seen in database`);
            }
        } catch (e: any) {
            console.error('Exception checking group seen status:', e.message);
        }
    }, [currentUserId, groupId, messages, userProfileCache]);

    // Call markMessagesAsSeen when the screen focuses
    useFocusEffect(
        useCallback(() => {
            console.log('[GroupChatScreen] Screen focused, checking and updating seen status');
            console.log('[GroupChatScreen] Current messages count:', messages.length);
            console.log('[GroupChatScreen] Current user ID:', currentUserId);
            console.log('[GroupChatScreen] Group ID:', groupId);
            
            // First check and update seen status for messages loaded from database
            const checkTimer = setTimeout(() => {
                console.log('[GroupChatScreen] Running checkAndUpdateSeenStatus...');
                checkAndUpdateSeenStatus();
            }, 100);
            
            // Then mark any remaining unseen messages as seen
            const markTimer = setTimeout(() => {
                console.log('[GroupChatScreen] Running markMessagesAsSeen...');
                markMessagesAsSeen();
            }, 300);
            
            return () => {
                clearTimeout(checkTimer);
                clearTimeout(markTimer);
            };
        }, [checkAndUpdateSeenStatus, markMessagesAsSeen, messages.length, currentUserId, groupId])
    );
    
    // Mark messages as seen when new messages arrive while screen is focused
    // Use a ref to track if we're currently marking messages to prevent infinite loops
    const isMarkingMessagesRef = useRef(false);
    
    useEffect(() => {
        // Only mark as seen if we're not already in the process and there are messages
        if (!isMarkingMessagesRef.current && messages.length > 0) {
            // Check if there are any unseen messages from others
            const hasUnseenMessagesFromOthers = messages.some(msg => {
                if (msg.isSystemMessage || msg.user._id === currentUserId) return false;
                const hasCurrentUserSeen = msg.seenBy?.some(seen => seen.userId === currentUserId);
                return !hasCurrentUserSeen;
            });
            
            if (hasUnseenMessagesFromOthers) {
                isMarkingMessagesRef.current = true;
                
                // Mark as seen immediately for better UX
                markMessagesAsSeen().finally(() => {
                    isMarkingMessagesRef.current = false;
                });
            }
        }
    }, [messages.length, markMessagesAsSeen, currentUserId]); // Only depend on messages.length, not the entire messages array

    // Mark messages as seen immediately when component mounts (for notification navigation)
    useEffect(() => {
        if (currentUserId && groupId && messages.length > 0) {
            const timer = setTimeout(() => {
                checkAndUpdateSeenStatus();
                markMessagesAsSeen();
            }, 200); // Slightly longer delay for initial load
            return () => clearTimeout(timer);
        }
    }, [currentUserId, groupId, messages.length, checkAndUpdateSeenStatus, markMessagesAsSeen]);

    // Handle app state changes (when app comes back from background)
    useEffect(() => {
        const handleAppStateChange = (nextAppState: string) => {
            if (nextAppState === 'active' && currentUserId && groupId && messages.length > 0) {
                console.log('[GroupChatScreen] App became active, checking seen status');
                // Small delay to ensure the app is fully active
                setTimeout(() => {
                    checkAndUpdateSeenStatus();
                    markMessagesAsSeen();
                }, 500);
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription?.remove();
    }, [currentUserId, groupId, messages.length, checkAndUpdateSeenStatus, markMessagesAsSeen]);



    // Real-time Subscription Setup using RealtimeContext
    useEffect(() => {
        if (!currentUserId || !groupId) {
            return;
        }

        console.log(`[GroupChatScreen] Setting up realtime subscription for group: ${groupId}`);
        
        // Subscribe to direct database changes for new messages
        const groupMessageSubscription = supabase
            .channel('group_messages_direct')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'group_chat_messages',
                    filter: `group_id=eq.${groupId}`
                },
                async (payload) => {
                    const newMessageDb = payload.new as DbGroupMessage;
                    console.log('[GroupChatScreen] New message received via direct DB subscription:', newMessageDb.id, 'from:', newMessageDb.sender_id);
                    
                    // Skip if it's our own message (we already have it optimistically)
                    if (newMessageDb.sender_id === currentUserId) {
                        return;
                    }
                    
                    if (newMessageDb.sender_id !== currentUserId) {
                        try {
                            console.log('[GroupChatScreen] Marking new message as delivered and seen');
                            await supabase.rpc('mark_group_message_delivered', { message_id_input: newMessageDb.id, user_id_input: currentUserId });
                            const { error } = await supabase.rpc('mark_group_message_seen', { message_id_input: newMessageDb.id, user_id_input: currentUserId });
                            if (!error) {
                                console.log('[GroupChatScreen] Successfully marked message as seen, broadcasting status update');
                                // Send broadcast to notify other group members about seen status
                                sendBroadcast('group', groupId, 'message_status', {
                                    message_id: newMessageDb.id,
                                    is_seen: true,
                                    seen_at: new Date().toISOString(),
                                    user_id: currentUserId,
                                    user_name: userProfileCache[currentUserId]?.name || 'Someone'
                                });
                                
                                // Also update the message locally to show seen status immediately
                                setMessages(prevMessages => {
                                    return prevMessages.map(msg => {
                                        if (msg._id === newMessageDb.id) {
                                            const seenByArray = [...(msg.seenBy || [])];
                                            const seenInfo = {
                                                userId: currentUserId,
                                                userName: userProfileCache[currentUserId]?.name || 'Someone',
                                                seenAt: new Date()
                                            };
                                            seenByArray.push(seenInfo);
                                            
                                            return {
                                                ...msg,
                                                isSeen: true,
                                                seenAt: new Date(),
                                                seenBy: seenByArray
                                            };
                                        }
                                        return msg;
                                    });
                                });
                            } else {
                                console.error('[GroupChatScreen] Error marking message as seen:', error);
                            }
                        } catch (e) { console.error('Exception marking group message status:', e); }
                    }
                    
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
                            return;
                        }
                    } catch (hiddenCheckErr) {
                        console.warn("Exception checking hidden message status:", hiddenCheckErr);
                    }
                    
                    const rtProfilesMap = new Map<string, UserProfileInfo>();
                    if (newMessageDb.sender_id && !userProfileCache[newMessageDb.sender_id]) {
                        try {
                            const { data: p, error } = await supabase
                                .from('music_lover_profiles')
                                .select('user_id, first_name, last_name, profile_picture')
                                .eq('user_id', newMessageDb.sender_id)
                                .single();
                            if (error) throw error;
                            if (p) {
                                const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'User';
                                const avatar = p.profile_picture || undefined;
                                userProfileCache[p.user_id] = { name, avatar };
                                rtProfilesMap.set(p.user_id, p);
                            }
                        } catch (err) { console.warn("On-the-fly profile fetch failed:", err) }
                    }
                    
                    const receivedMessage = mapDbMessageToChatMessage(newMessageDb, rtProfilesMap);
                    if (receivedMessage.replyToMessageId) {
                        try {
                            const repliedMsg = await fetchMessageById(receivedMessage.replyToMessageId);
                            if (repliedMsg) {
                                receivedMessage.replyToMessagePreview = {
                                    text: repliedMsg.image ? '[Image]' : repliedMsg.text,
                                    senderName: repliedMsg.user.name,
                                    image: repliedMsg.image
                                };
                            }
                        } catch (replyErr) {
                            console.warn("Error fetching reply preview:", replyErr);
                        }
                    }
                    
                    setMessages(prevMessages => {
                        if (prevMessages.some(msg => msg._id === receivedMessage._id)) {
                            return prevMessages;
                        }
                        if (receivedMessage.user._id !== currentUserId) {
                            receivedMessage.isSeen = true;
                            receivedMessage.seenAt = new Date();
                            // Add current user to seenBy array for received messages
                            receivedMessage.seenBy = [{
                                userId: currentUserId,
                                userName: userProfileCache[currentUserId]?.name || 'You',
                                seenAt: new Date()
                            }];
                        }
                        const optimisticIdPattern = `temp_`;
                        const optimisticIndex = prevMessages.findIndex(m => 
                            m._id.startsWith(optimisticIdPattern) && 
                            (m.text === receivedMessage.text || (m.image && receivedMessage.image)) &&
                            m.replyToMessageId === receivedMessage.replyToMessageId
                        );
                        if (optimisticIndex !== -1) {
                            const newMessages = [...prevMessages];
                            newMessages[optimisticIndex] = receivedMessage;
                            return newMessages;
                        }
                        return [...prevMessages, receivedMessage];
                    });
                }
            )
            .subscribe((status) => {
                console.log('[GroupChatScreen] Direct DB subscription status:', status);
            });

        // Subscribe to message updates (edits, deletes)
        const groupMessageUpdateSubscription = supabase
            .channel('group_messages_update')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'group_chat_messages',
                    filter: `group_id=eq.${groupId}`
                },
                async (payload) => {
                    const updatedMessageDb = payload.new as DbGroupMessage;
                    console.log('[GroupChatScreen] Message update received via direct DB subscription:', updatedMessageDb.id);
                    
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
                            return;
                        }
                    } catch (hiddenCheckErr) {
                        console.warn("Exception checking hidden status for updated message:", hiddenCheckErr);
                    }
                    
                    const rtProfilesMap = new Map<string, UserProfileInfo>();
                    if (updatedMessageDb.sender_id && !userProfileCache[updatedMessageDb.sender_id]) {
                        try {
                            const { data: p, error: profileError } = await supabase
                                .from('music_lover_profiles')
                                .select('user_id, first_name, last_name, profile_picture')
                                .eq('user_id', updatedMessageDb.sender_id)
                                .single();
                            if (profileError) throw profileError;
                            if (p) {
                                const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'User';
                                const avatar = p.profile_picture || undefined;
                                userProfileCache[p.user_id] = { name, avatar };
                                rtProfilesMap.set(p.user_id, p);
                            }
                        } catch (err) { console.warn(`[RT-UPDATE] Profile fetch err:`, err); }
                    }
                    
                    const updatedMessageUi = mapDbMessageToChatMessage(updatedMessageDb, rtProfilesMap);
                    if (updatedMessageUi.replyToMessageId) {
                        try {
                            const repliedMsg = await fetchMessageById(updatedMessageUi.replyToMessageId);
                            if (repliedMsg) {
                                updatedMessageUi.replyToMessagePreview = {
                                    text: repliedMsg.image ? '[Image]' : repliedMsg.text,
                                    senderName: repliedMsg.user.name,
                                    image: repliedMsg.image
                                };
                            }
                        } catch (replyErr) {
                            console.warn("Error fetching reply preview for updated message:", replyErr);
                        }
                    }
                    
                    setMessages(prev => prev.map(msg => {
                        if (msg._id === updatedMessageUi._id) {
                            updatedMessageUi.seenBy = msg.seenBy;
                            updatedMessageUi.isSeen = msg.isSeen;
                            updatedMessageUi.seenAt = msg.seenAt;
                            return updatedMessageUi;
                        }
                        return msg;
                    }));
                    
                    if (editingMessage && editingMessage._id === updatedMessageUi._id) {
                        setEditingMessage(null);
                        setEditText("");
                    }
                }
            )
            .subscribe((status) => {
                console.log('[GroupChatScreen] Message update subscription status:', status);
            });
        
        const unsubscribe = subscribeToGroupChat(groupId, {
            onMessage: async (payload: any) => {
                const newMessageDb = payload.new as DbGroupMessage;
                console.log('[GroupChatScreen] New message received via realtime:', newMessageDb.id, 'from:', newMessageDb.sender_id);
                if (newMessageDb.sender_id !== currentUserId) {
                    try {
                        console.log('[GroupChatScreen] Marking new message as delivered and seen');
                        await supabase.rpc('mark_group_message_delivered', { message_id_input: newMessageDb.id, user_id_input: currentUserId });
                        const { error } = await supabase.rpc('mark_group_message_seen', { message_id_input: newMessageDb.id, user_id_input: currentUserId });
                        if (!error) {
                            console.log('[GroupChatScreen] Successfully marked message as seen, broadcasting status update');
                            // Send broadcast to notify other group members about seen status
                            sendBroadcast('group', groupId, 'message_status', {
                                message_id: newMessageDb.id,
                                is_seen: true,
                                seen_at: new Date().toISOString(),
                                user_id: currentUserId,
                                user_name: userProfileCache[currentUserId]?.name || 'Someone'
                            });
                            
                            // Also update the message locally to show seen status immediately
                            setMessages(prevMessages => {
                                return prevMessages.map(msg => {
                                    if (msg._id === newMessageDb.id) {
                                        const seenByArray = [...(msg.seenBy || [])];
                                        const seenInfo = {
                                            userId: currentUserId,
                                            userName: userProfileCache[currentUserId]?.name || 'Someone',
                                            seenAt: new Date()
                                        };
                                        seenByArray.push(seenInfo);
                                        
                                        return {
                                            ...msg,
                                            isSeen: true,
                                            seenAt: new Date(),
                                            seenBy: seenByArray
                                        };
                                    }
                                    return msg;
                                });
                            });
                        } else {
                            console.error('[GroupChatScreen] Error marking message as seen:', error);
                        }
                    } catch (e) { console.error('Exception marking group message status:', e); }
                }
                
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
                        return;
                    }
                } catch (hiddenCheckErr) {
                    console.warn("Exception checking hidden message status:", hiddenCheckErr);
                }
                
                const rtProfilesMap = new Map<string, UserProfileInfo>();
                if (newMessageDb.sender_id && !userProfileCache[newMessageDb.sender_id]) {
                    try {
                        const { data: p, error } = await supabase
                            .from('music_lover_profiles')
                            .select('user_id, first_name, last_name, profile_picture')
                            .eq('user_id', newMessageDb.sender_id)
                            .single();
                        if (error) throw error;
                        if (p) {
                            const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'User';
                            const avatar = p.profile_picture || undefined;
                            userProfileCache[p.user_id] = { name, avatar };
                            rtProfilesMap.set(p.user_id, p);
                        }
                    } catch (err) { console.warn("On-the-fly profile fetch failed:", err) }
                }
                
                const receivedMessage = mapDbMessageToChatMessage(newMessageDb, rtProfilesMap);
                if (receivedMessage.replyToMessageId) {
                    try {
                        const repliedMsg = await fetchMessageById(receivedMessage.replyToMessageId);
                        if (repliedMsg) {
                            receivedMessage.replyToMessagePreview = {
                                text: repliedMsg.image ? '[Image]' : repliedMsg.text,
                                senderName: repliedMsg.user.name,
                                image: repliedMsg.image
                            };
                        }
                    } catch (replyErr) {
                        console.warn("Error fetching reply preview:", replyErr);
                    }
                }
                
                setMessages(prevMessages => {
                    if (prevMessages.some(msg => msg._id === receivedMessage._id)) {
                        return prevMessages;
                    }
                    if (receivedMessage.user._id !== currentUserId) {
                        receivedMessage.isSeen = true;
                        receivedMessage.seenAt = new Date();
                        // Add current user to seenBy array for received messages
                        receivedMessage.seenBy = [{
                            userId: currentUserId,
                            userName: userProfileCache[currentUserId]?.name || 'You',
                            seenAt: new Date()
                        }];
                    }
                    const optimisticIdPattern = `temp_`;
                    const optimisticIndex = prevMessages.findIndex(m => 
                        m._id.startsWith(optimisticIdPattern) && 
                        (m.text === receivedMessage.text || (m.image && receivedMessage.image)) &&
                        m.replyToMessageId === receivedMessage.replyToMessageId
                    );
                    if (optimisticIndex !== -1) {
                        const newMessages = [...prevMessages];
                        newMessages[optimisticIndex] = receivedMessage;
                        return newMessages;
                    }
                    return [...prevMessages, receivedMessage];
                });
            },
            onMessageUpdate: async (payload: any) => {
                const updatedMessageDb = payload.new as DbGroupMessage;
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
                        return;
                    }
                } catch (hiddenCheckErr) {
                    console.warn("Exception checking hidden status for updated message:", hiddenCheckErr);
                }
                
                const rtProfilesMap = new Map<string, UserProfileInfo>();
                if (updatedMessageDb.sender_id && !userProfileCache[updatedMessageDb.sender_id]) {
                    try {
                        const { data: p, error: profileError } = await supabase
                            .from('music_lover_profiles')
                            .select('user_id, first_name, last_name, profile_picture')
                            .eq('user_id', updatedMessageDb.sender_id)
                            .single();
                        if (profileError) throw profileError;
                        if (p) {
                            const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'User';
                            const avatar = p.profile_picture || undefined;
                            userProfileCache[p.user_id] = { name, avatar };
                            rtProfilesMap.set(p.user_id, p);
                        }
                    } catch (err) { console.warn(`[RT-UPDATE] Profile fetch err:`, err); }
                }
                
                const updatedMessageUi = mapDbMessageToChatMessage(updatedMessageDb, rtProfilesMap);
                if (updatedMessageUi.replyToMessageId) {
                    try {
                        const repliedMsg = await fetchMessageById(updatedMessageUi.replyToMessageId);
                        if (repliedMsg) {
                            updatedMessageUi.replyToMessagePreview = {
                                text: repliedMsg.image ? '[Image]' : repliedMsg.text,
                                senderName: repliedMsg.user.name,
                                image: repliedMsg.image
                            };
                        }
                    } catch (replyErr) {
                        console.warn("Error fetching reply preview for updated message:", replyErr);
                    }
                }
                
                setMessages(prev => prev.map(msg => {
                    if (msg._id === updatedMessageUi._id) {
                        updatedMessageUi.seenBy = msg.seenBy;
                        updatedMessageUi.isSeen = msg.isSeen;
                        updatedMessageUi.seenAt = msg.seenAt;
                        return updatedMessageUi;
                    }
                    return msg;
                }));
                
                if (editingMessage && editingMessage._id === updatedMessageUi._id) {
                    setEditingMessage(null);
                    setEditText("");
                }
            },
            onMessageStatus: (payload: any) => {
                const statusUpdate = payload.new;
                console.log('[GroupChatScreen] Message status update received via broadcast:', statusUpdate);
                if (!statusUpdate) return;
            
                if (statusUpdate.message_ids && Array.isArray(statusUpdate.message_ids)) {
                    // This is a bulk "seen" update
                    if (statusUpdate.seen_by?.userId === currentUserId) return; // Don't process own updates
            
                    setMessages(prev => prev.map(msg => {
                        if (statusUpdate.message_ids.includes(msg._id)) {
                            let newSeenBy = [...(msg.seenBy || [])];
                            // Only add to seenBy if it's not the sender
                            if (statusUpdate.seen_by.userId !== msg.user._id && !newSeenBy.some(s => s.userId === statusUpdate.seen_by.userId)) {
                                newSeenBy.push({
                                    userId: statusUpdate.seen_by.userId,
                                    userName: statusUpdate.seen_by.userName || 'Someone',
                                    seenAt: new Date()
                                });
                            }
                            const isSeenByCurrentUser = newSeenBy.some(s => s.userId === currentUserId);
                            
                            const newIsSeen = msg.user._id === currentUserId ? newSeenBy.length > 0 : isSeenByCurrentUser;
                            
                            if (newIsSeen && !msg.isSeen && msg.user._id === currentUserId) {
                                console.log('[GroupChatScreen] ✅ Seen tick should now appear for message (bulk):', msg._id, 'seenBy:', newSeenBy.map(s => s.userName));
                            }

                            return { 
                                ...msg, 
                                seenBy: newSeenBy,
                                // Update top-level isSeen based on who the message is for
                                isSeen: newIsSeen
                            };
                        }
                        return msg;
                    }));
                    return;
                }

                if (!statusUpdate.message_id) return;
                
                setMessages(prevMessages => {
                    let needsUpdate = false;
                    const newMessages = prevMessages.map(msg => {
                        if (msg._id === statusUpdate.message_id) {
                            const deliveredChanged = msg.isDelivered !== statusUpdate.is_delivered;
                            // Always update if there's a seen status change, regardless of the current isSeen value
                            const hasSeenUpdate = statusUpdate.is_seen && statusUpdate.seen_at;
                            if (deliveredChanged || hasSeenUpdate) {
                                needsUpdate = true;
                                let seenByArray = [...(msg.seenBy || [])];
                                if (statusUpdate.is_seen && statusUpdate.seen_at) {
                                    // Only add to seenBy if it's not the sender
                                    if (statusUpdate.user_id !== msg.user._id) {
                                        const existingSeenIndex = seenByArray.findIndex(s => s.userId === statusUpdate.user_id);
                                        const seenEntry = {
                                            userId: statusUpdate.user_id,
                                            userName: userProfileCache[statusUpdate.user_id]?.name || 'Someone',
                                            seenAt: new Date(statusUpdate.seen_at)
                                        };
                                        if (existingSeenIndex > -1) {
                                            seenByArray[existingSeenIndex] = seenEntry;
                                        } else {
                                            seenByArray.push(seenEntry);
                                        }
                                    }
                                }
                                
                                                                                                // Update isSeen logic: for sender's messages, isSeen is true if others have seen it
                            // For received messages, isSeen is true if current user has seen it
                            let isSeen = msg.isSeen;
                            if (msg.user._id === currentUserId) {
                                // This is the sender's message - isSeen if others have seen it
                                isSeen = seenByArray.some(s => s.userId !== currentUserId); // If anyone else has seen it
                                if (isSeen && !msg.isSeen) {
                                    console.log('[GroupChatScreen] ✅ Seen tick should now appear for message (postgres):', msg._id, 'seenBy:', seenByArray.map(s => s.userName));
                                }
                            } else {
                                // This is a received message - isSeen if current user has seen it
                                isSeen = seenByArray.some(s => s.userId === currentUserId);
                            }
                                
                                return {
                                    ...msg,
                                    isDelivered: statusUpdate.is_delivered,
                                    deliveredAt: statusUpdate.delivered_at ? new Date(statusUpdate.delivered_at) : msg.deliveredAt,
                                    isSeen: isSeen,
                                    seenAt: statusUpdate.seen_at ? new Date(statusUpdate.seen_at) : msg.seenAt,
                                    seenBy: seenByArray
                                };
                            }
                        }
                        return msg;
                    });
                    return needsUpdate ? newMessages : prevMessages;
                });
            },
            onTyping: (payload: any) => {
                if (payload.sender_id !== currentUserId) {
                    setTypingUsers(prev => {
                        const newTypingUsers = new Map(prev);
                        if (payload.typing) {
                            newTypingUsers.set(payload.sender_id, { name: payload.sender_name || 'Someone', timestamp: Date.now() });
                            const existingTimeout = typingTimeoutRef.current.get(payload.sender_id);
                            if (existingTimeout) clearTimeout(existingTimeout);
                            const timeout = setTimeout(() => {
                                setTypingUsers(curr => {
                                    const updated = new Map(curr);
                                    updated.delete(payload.sender_id);
                                    return updated;
                                });
                                typingTimeoutRef.current.delete(payload.sender_id);
                            }, 3000);
                            typingTimeoutRef.current.set(payload.sender_id, timeout);
                        } else {
                            newTypingUsers.delete(payload.sender_id);
                            const timeout = typingTimeoutRef.current.get(payload.sender_id);
                            if (timeout) {
                                clearTimeout(timeout);
                                typingTimeoutRef.current.delete(payload.sender_id);
                            }
                        }
                        return newTypingUsers;
                    });
                }
            },
            onTypingStop: (userId: string) => {
                setTypingUsers(prev => {
                    const newTypingUsers = new Map(prev);
                    newTypingUsers.delete(userId);
                    const timeout = typingTimeoutRef.current.get(userId);
                    if (timeout) {
                        clearTimeout(timeout);
                        typingTimeoutRef.current.delete(userId);
                    }
                    return newTypingUsers;
                });
            },
            onGroupUpdate: (payload: any) => {
                console.log('[GroupChatScreen] Group update received:', payload.new);
                fetchInitialData(); // Refetch all data on group update for simplicity
            }
        });

        // Subscribe to database group message status updates
        const handleGroupMessageStatusUpdate = (payload: any) => {
            const statusUpdate = payload.new;
            if (!statusUpdate || !statusUpdate.message_id) return;
            
            console.log('[GroupChatScreen] Database group message status update:', statusUpdate);
            
            // Only update if this status change is for a message in this group
            setMessages(prevMessages => {
                let needsUpdate = false;
                const newMessages = prevMessages.map(msg => {
                    if (msg._id === statusUpdate.message_id) {
                        const deliveredChanged = msg.isDelivered !== statusUpdate.is_delivered;
                        // Always update if there's a seen status change, regardless of the current isSeen value
                        const hasSeenUpdate = statusUpdate.is_seen && statusUpdate.seen_at;
                        if (deliveredChanged || hasSeenUpdate) {
                            needsUpdate = true;
                            let seenByArray = [...(msg.seenBy || [])];
                            if (statusUpdate.is_seen && statusUpdate.seen_at) {
                                // Only add to seenBy if it's not the sender
                                if (statusUpdate.user_id !== msg.user._id) {
                                    const existingIndex = seenByArray.findIndex(s => s.userId === statusUpdate.user_id);
                                    const seenInfo = {
                                        userId: statusUpdate.user_id,
                                        userName: userProfileCache[statusUpdate.user_id]?.name || 'Someone',
                                        seenAt: new Date(statusUpdate.seen_at)
                                    };
                                    if (existingIndex >= 0) {
                                        seenByArray[existingIndex] = seenInfo;
                                    } else {
                                        seenByArray.push(seenInfo);
                                    }
                                }
                            }
                            
                            // Update isSeen logic: for sender's messages, isSeen is true if others have seen it
                            // For received messages, isSeen is true if current user has seen it
                            let isSeen = msg.isSeen;
                            if (msg.user._id === currentUserId) {
                                // This is the sender's message - isSeen if others have seen it
                                isSeen = seenByArray.some(s => s.userId !== currentUserId);
                                if (isSeen && !msg.isSeen) {
                                    console.log('[GroupChatScreen] ✅ Seen tick should now appear for message (database):', msg._id, 'seenBy:', seenByArray.map(s => s.userName));
                                }
                            } else {
                                // This is a received message - isSeen if current user has seen it
                                isSeen = seenByArray.some(s => s.userId === currentUserId);
                            }
                            
                            return {
                                ...msg,
                                isDelivered: statusUpdate.is_delivered,
                                deliveredAt: statusUpdate.delivered_at ? new Date(statusUpdate.delivered_at) : msg.deliveredAt,
                                isSeen: isSeen,
                                seenAt: statusUpdate.seen_at ? new Date(statusUpdate.seen_at) : msg.seenAt,
                                seenBy: seenByArray
                            };
                        }
                    }
                    return msg;
                });
                return needsUpdate ? newMessages : prevMessages;
            });
        };

        // Subscribe to group_message_status table changes for real-time seen updates
        console.log('[GroupChatScreen] Setting up group_message_status real-time subscription for group:', groupId);
        const groupMessageStatusSubscription = supabase
            .channel('group_message_status_changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'group_message_status',
                },
                async (payload) => {
                    const statusUpdate = payload.new;
                    if (!statusUpdate || !statusUpdate.message_id || statusUpdate.group_id !== groupId) return;
                    
                    console.log('[GroupChatScreen] Real-time group message status update:', statusUpdate);
                    
                    // Fetch the user profile if not in cache
                    if (statusUpdate.user_id && !userProfileCache[statusUpdate.user_id]) {
                        try {
                            const { data: profileData, error: profileError } = await supabase
                                .from('music_lover_profiles')
                                .select('user_id, first_name, last_name, profile_picture')
                                .eq('user_id', statusUpdate.user_id)
                                .single();
                            
                            if (!profileError && profileData) {
                                const displayName = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || 'User';
                                userProfileCache[statusUpdate.user_id] = {
                                    name: displayName,
                                    avatar: profileData.profile_picture || undefined
                                };
                            }
                        } catch (err) {
                            console.warn('Error fetching profile for status update:', err);
                        }
                    }
                    
                    // Update messages state with the new seen status
                    setMessages(prevMessages => {
                        let needsUpdate = false;
                        const newMessages = prevMessages.map(msg => {
                            if (msg._id === statusUpdate.message_id) {
                                const deliveredChanged = msg.isDelivered !== statusUpdate.is_delivered;
                                // Always update if there's a seen status change, regardless of the current isSeen value
                                const hasSeenUpdate = statusUpdate.is_seen && statusUpdate.seen_at;
                                
                                if (deliveredChanged || hasSeenUpdate) {
                                    needsUpdate = true;
                                    let seenByArray = [...(msg.seenBy || [])];
                                    
                                    if (statusUpdate.is_seen && statusUpdate.seen_at) {
                                        // Add or update the user in seenBy array (excluding sender)
                                        if (statusUpdate.user_id !== msg.user._id) {
                                            const existingIndex = seenByArray.findIndex(s => s.userId === statusUpdate.user_id);
                                            const seenInfo = {
                                                userId: statusUpdate.user_id,
                                                userName: userProfileCache[statusUpdate.user_id]?.name || 'Someone',
                                                seenAt: new Date(statusUpdate.seen_at)
                                            };
                                            if (existingIndex >= 0) {
                                                seenByArray[existingIndex] = seenInfo;
                                            } else {
                                                seenByArray.push(seenInfo);
                                            }
                                        }
                                    }
                                    
                                    // Update isSeen logic: for sender's messages, isSeen is true if others have seen it
                                    // For received messages, isSeen is true if current user has seen it
                                    let isSeen = msg.isSeen;
                                    if (msg.user._id === currentUserId) {
                                        // This is the sender's message - isSeen if others have seen it
                                        isSeen = seenByArray.some(s => s.userId !== currentUserId); // If anyone else has seen it
                                        if (isSeen && !msg.isSeen) {
                                            console.log('[GroupChatScreen] ✅ Seen tick should now appear for message (broadcast):', msg._id, 'seenBy:', seenByArray.map(s => s.userName));
                                        }
                                    } else {
                                        // This is a received message - isSeen if current user has seen it
                                        isSeen = seenByArray.some(s => s.userId === currentUserId);
                                    }
                                    
                                    return {
                                        ...msg,
                                        isDelivered: statusUpdate.is_delivered,
                                        deliveredAt: statusUpdate.delivered_at ? new Date(statusUpdate.delivered_at) : msg.deliveredAt,
                                        isSeen: isSeen,
                                        seenAt: statusUpdate.seen_at ? new Date(statusUpdate.seen_at) : msg.seenAt,
                                        seenBy: seenByArray
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
                console.log('[GroupChatScreen] group_message_status subscription status:', status);
            });

        subscribeToEvent('group_message_status_updated', handleGroupMessageStatusUpdate);

        return () => {
            unsubscribe();
            unsubscribeFromEvent('group_message_status_updated', handleGroupMessageStatusUpdate);
            if (groupMessageStatusSubscription) {
                supabase.removeChannel(groupMessageStatusSubscription);
            }
            if (groupMessageSubscription) {
                supabase.removeChannel(groupMessageSubscription);
            }
            if (groupMessageUpdateSubscription) {
                supabase.removeChannel(groupMessageUpdateSubscription);
            }
            if (typingTimeoutRef.current) {
                typingTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
                typingTimeoutRef.current.clear();
            }
        };
    }, [currentUserId, groupId, mapDbMessageToChatMessage, editingMessage, subscribeToGroupChat, sendBroadcast, subscribeToEvent, unsubscribeFromEvent, userProfileCache]);

    // Navigation and Header
    const navigateToGroupInfo = () => { if (!groupId || !currentGroupName) return; navigation.navigate('GroupInfoScreen', { groupId, groupName: currentGroupName ?? 'Group', groupImage: currentGroupImage ?? null }); };
    useEffect(() => { 
        const canAdd = isCurrentUserAdmin || canMembersAddOthers; 
        const canEdit = isCurrentUserAdmin || canMembersEditInfo; 
        const headerColor = APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'; 
        const disabledColor = APP_CONSTANTS?.COLORS?.DISABLED || '#D1D5DB'; 
        
        // Calculate online member count
        const onlineCount = onlineMembers.size;
        const totalMembers = groupMembers.size;
        
        // Ensure we have a proper group name
        const displayGroupName = currentGroupName || route.params.groupName || 'Group Chat';
        
        navigation.setOptions({ 
            headerTitleAlign: 'center', 
            headerTitle: () => (
                <TouchableOpacity style={styles.headerTitleContainer} onPress={navigateToGroupInfo} activeOpacity={0.8}>
                    <View style={styles.headerImageContainer}>
                        <Image source={{ uri: currentGroupImage ?? route.params.groupImage ?? DEFAULT_GROUP_PIC }} style={styles.headerGroupImage} />
                        {onlineCount > 0 && (
                            <View style={styles.onlineIndicator}>
                                <Text style={styles.onlineIndicatorText}>{onlineCount}</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitleText} numberOfLines={1}>{displayGroupName}</Text>
                        {totalMembers > 0 && (
                            <Text style={styles.headerSubtitleText}>
                                {onlineCount > 0 ? `${onlineCount} online` : `${totalMembers} members`}
                            </Text>
                        )}
                    </View>
                </TouchableOpacity>
            ), 
            headerRight: () => (
                <View style={styles.headerButtons}>
                    <TouchableOpacity 
                        onPress={() => { 
                            if (canAdd) navigation.navigate('AddGroupMembersScreen', { groupId, groupName: displayGroupName }); 
                            else Alert.alert("Denied", "Admin only"); 
                        }} 
                        style={styles.headerButton} 
                        disabled={!canAdd}
                    >
                        <Feather name="user-plus" size={22} color={canAdd ? headerColor : disabledColor} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => { 
                            if (canEdit) { 
                                setEditingName(displayGroupName); 
                                setIsEditModalVisible(true); 
                            } else Alert.alert("Denied", "Admin only"); 
                        }} 
                        style={styles.headerButton} 
                        disabled={!canEdit}
                    >
                        <Feather name="edit-2" size={22} color={canEdit ? headerColor : disabledColor} />
                    </TouchableOpacity>
                </View>
            ), 
            headerBackTitleVisible: false, 
            headerShown: true 
        }); 
    }, [navigation, currentGroupName, currentGroupImage, groupId, isCurrentUserAdmin, canMembersAddOthers, canMembersEditInfo, onlineMembers, groupMembers, route.params.groupName, route.params.groupImage]);

    // Modal and Actions
    const handleUpdateName = async () => { const n = editingName.trim(); if (!n || n === currentGroupName || isUpdatingName || !groupId) { setIsEditModalVisible(false); return; } setIsUpdatingName(true); try { const { error } = await supabase.rpc('rename_group_chat', { group_id_input: groupId, new_group_name: n }); if (error) throw error; sendBroadcast('group', groupId, 'group_update', { type: 'rename', name: n, updated_by: currentUserId }); setIsEditModalVisible(false); } catch (e: any) { Alert.alert("Error", `Update fail: ${e.message}`); } finally { setIsUpdatingName(false); } };

    // Using RealtimeContext for all realtime functionality

    // Effects
    useFocusEffect(useCallback(() => { fetchInitialData(); return () => { }; }, [fetchInitialData]));

    // Ensure group name is set properly when entering via notification
    useEffect(() => {
        if (route.params.groupName && !currentGroupName) {
            setCurrentGroupName(route.params.groupName);
        }
        if (route.params.groupImage && !currentGroupImage) {
            setCurrentGroupImage(route.params.groupImage);
        }
    }, [route.params.groupName, route.params.groupImage, currentGroupName, currentGroupImage]);

    // Handle shared event data
    useEffect(() => {
        if (initialSharedEventData && initialSharedEventData.isSharing) {
            // setInputText logic is now handled by renderEventSharePreview's close button or send action
            setSharedEventMessage(JSON.stringify(initialSharedEventData));
            // Clear the sharing flag from route params to prevent re-triggering
            navigation.setParams({ sharedEventData: { ...initialSharedEventData, isSharing: false } });
        }
    }, [initialSharedEventData, navigation]);



    // --- Online Presence Tracking ---
    useEffect(() => {
        if (!currentUserId || !groupId) return;
        
        // Get online status for all group members
        const memberIds = Array.from(groupMembers.keys());
        const onlineStatus = new Set<string>();
        
        memberIds.forEach(memberId => {
            if (presenceState[memberId] && presenceState[memberId].length > 0) {
                onlineStatus.add(memberId);
            }
        });
        
        setOnlineMembers(onlineStatus);
    }, [presenceState, groupMembers, currentUserId, groupId]);

    // --- Cleanup on unmount ---
    useEffect(() => {
        return () => {
            // Cleanup scroll timeout
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            
            // Stop typing indicator when component unmounts
            if (currentUserId && groupId) {
                const senderName = userProfileCache[currentUserId]?.name || 'You';
                sendGroupTypingIndicator(groupId, false, senderName);
            }
            
            // Cleanup typing timeouts
            if (typingTimeoutRef.current) {
                typingTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
                typingTimeoutRef.current.clear();
            }
        };
    }, [currentUserId, groupId, sendGroupTypingIndicator, userProfileCache]);

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
        console.log('[DEBUG] handleMessageLongPress called with message:', {
            id: message._id,
            type: message.image ? 'image' : message.sharedEvent ? 'sharedEvent' : 'text',
            isSystemMessage: message.isSystemMessage,
            isDeleted: message.isDeleted
        });
        
        if (message.isSystemMessage || message.isDeleted) {
            console.log('[DEBUG] Message is system or deleted, returning early');
            return;
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
                    ? {
                        ...msg,
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
            // Get group member count
            const memberCountResult = await supabase
                .from('group_chat_participants')
                .select('*', { count: 'exact', head: true })
                .eq('group_id', groupId);

            if (memberCountResult.error) {
                throw memberCountResult.error;
            }

            const totalMembers = memberCountResult.count || 0;

            // Use the current message's seenBy data from state (which is updated in real-time)
            const currentMessage = messages.find(msg => msg._id === selectedMessageForAction._id);
            const seenByData = currentMessage?.seenBy || [];
            
            console.log('[GroupChatScreen] Message info - current message:', {
                messageId: selectedMessageForAction._id,
                isSeen: currentMessage?.isSeen,
                seenByCount: seenByData.length,
                seenByData: seenByData.map(s => ({ userId: s.userId, userName: s.userName }))
            });
            
            // Convert seenBy data to the format expected by the modal
            const seenUsers = seenByData.map(s => ({
                user_id: s.userId,
                name: s.userName,
                seen_at: s.seenAt.toISOString()
            }));

            // Find the senderId
            const senderId = selectedMessageForAction.user._id;
            // Exclude sender from group members
            const totalMembersExcludingSender = Array.from(groupMembers.keys()).filter(id => id !== senderId).length;
            // Exclude sender from seen users
            const seenUsersExcludingSender = (selectedMessageForAction.seenBy || []).filter(s => s.userId !== senderId).map(s => ({
                user_id: s.userId,
                name: s.userName,
                seen_at: s.seenAt.toISOString()
            }));

            setMessageInfoData({
                message_id: selectedMessageForAction._id,
                sent_at: selectedMessageForAction.createdAt.toISOString(),
                total_members: totalMembersExcludingSender,
                delivered_count: totalMembersExcludingSender, // All members except sender
                seen_count: seenUsersExcludingSender.length,
                seen_users: seenUsersExcludingSender
            });
        } catch (err: any) {
            console.error("Error fetching group message info:", err);
            // Fallback to basic message data
            setMessageInfoData({
                message_id: selectedMessageForAction._id,
                sent_at: selectedMessageForAction.createdAt.toISOString(),
                total_members: 0,
                delivered_count: 0,
                seen_count: 0,
                seen_users: []
            });
        } finally {
            setLoadingMessageInfo(false);
            setSelectedMessageForAction(null);
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

    // Refresh message info data when messages update (for live timestamp updates)
    useEffect(() => {
        if (messageInfoVisible && messageInfoData && messages.length > 0) {
            const currentMessage = messages.find(msg => msg._id === messageInfoData.message_id);
            if (currentMessage) {
                const senderId = currentMessage.user._id;
                const seenUsersExcludingSender = (currentMessage.seenBy || []).filter(s => s.userId !== senderId).map(s => ({
                    user_id: s.userId,
                    name: s.userName,
                    seen_at: s.seenAt.toISOString()
                }));
                setMessageInfoData((prev: any) => ({
                    ...prev,
                    seen_count: seenUsersExcludingSender.length,
                    seen_users: seenUsersExcludingSender
                }));
                console.log('[GroupChatScreen] Updated message info in real-time:', {
                    messageId: currentMessage._id,
                    seenCount: seenUsersExcludingSender.length,
                    seenUsers: seenUsersExcludingSender.map(u => u.name)
                });
            }
        }
    }, [messages, messageInfoVisible, messageInfoData]);

    // Helper to fetch a single message by ID (e.g., for reply previews if not in current `messages` state)
    const fetchMessageById = async (messageId: string): Promise<ChatMessage | null> => {
        try {
            const { data: dbMessage, error } = await supabase
                .from('group_chat_messages')
                .select(`*, group_message_status(*)`)
                .eq('id', messageId)
                .maybeSingle();

            if (error) {
                console.error("Error fetching group message by ID:", error);
                return null;
            }
            if (!dbMessage) {
                console.warn("Group message not found for ID:", messageId);
                return null;
            }

            const profilesMap = new Map<string, UserProfileInfo>();
            if (dbMessage.sender_id && !dbMessage.is_system_message && !userProfileCache[dbMessage.sender_id]) {
                try {
                    const { data: p, error: profileError } = await supabase
                        .from('music_lover_profiles')
                        .select('user_id, first_name, last_name, profile_picture')
                        .eq('user_id', dbMessage.sender_id)
                        .maybeSingle();

                    if (profileError) {
                        console.warn("Error fetching profile for message reply:", profileError.message);
                    } else if (p) {
                        profilesMap.set(p.user_id, p);
                        const n = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'User';
                        const a = p.profile_picture || undefined;
                        userProfileCache[p.user_id] = { name: n, avatar: a };
                    }
                } catch (profileErr) {
                    console.warn("Exception fetching profile for message reply:", profileErr);
                    // Continue without profile
                }
            }
            return mapDbMessageToChatMessage(dbMessage as any, profilesMap);
        } catch (err) {
            console.error("Failed to fetch group message by ID for reply preview:", err);
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

    // --- Scroll to Message Handler ---
    const handleScrollToMessage = useCallback((messageId: string) => {
        if (isScrollingToMessage) return; // Prevent multiple simultaneous scrolls

        // Find the message in sections
        let targetSectionIndex = -1;
        let targetItemIndex = -1;

        for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
            const itemIndex = sections[sectionIndex].data.findIndex(msg => msg._id === messageId);
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
        if (!currentUserId || !groupId || hasScrolledToUnread) {
            console.log('[GroupChatScreen] findAndScrollToEarliestUnread: Early return', { currentUserId, groupId, hasScrolledToUnread });
            return;
        }

        console.log('[GroupChatScreen] findAndScrollToEarliestUnread: Starting search for unread messages');
        
        // Find the earliest unread message from others (not system messages)
        const unreadMessages = messages.filter(msg => 
            !msg.isSystemMessage && 
            msg.user._id !== currentUserId && 
            !msg.seenBy?.some(seen => seen.userId === currentUserId)
        );

        console.log('[GroupChatScreen] findAndScrollToEarliestUnread: Found unread messages', unreadMessages.length);

        if (unreadMessages.length === 0) {
            // No unread messages, scroll to bottom
            console.log('[GroupChatScreen] findAndScrollToEarliestUnread: No unread messages, scrolling to bottom');
            handleAutoScrollToBottom();
            setHasScrolledToUnread(true);
            return;
        }

        // Find the earliest unread message
        const earliestUnread = unreadMessages.reduce((earliest, current) => 
            current.createdAt < earliest.createdAt ? current : earliest
        );

        console.log('[GroupChatScreen] findAndScrollToEarliestUnread: Scrolling to earliest unread message', earliestUnread._id);
        
        setEarliestUnreadMessageId(earliestUnread._id);
        setHasUnreadMessages(true);
        setHasScrolledToUnread(true);

        // Scroll to the earliest unread message
        handleScrollToMessage(earliestUnread._id);
    }, [currentUserId, groupId, messages, hasScrolledToUnread, handleScrollToMessage, handleAutoScrollToBottom]);

    // Reset unread state when all messages are seen
    useEffect(() => {
        if (messages.length > 0) {
            const hasUnseenMessages = messages.some(msg => 
                !msg.isSystemMessage && 
                msg.user._id !== currentUserId && 
                !msg.seenBy?.some(seen => seen.userId === currentUserId)
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
    }, [messages, currentUserId, hasUnreadMessages, hasScrolledToUnread, handleAutoScrollToBottom]);

    // Handle scroll to unread messages when messages are loaded and seen status is updated
    useEffect(() => {
        console.log('[GroupChatScreen] useEffect for scroll to unread:', { messagesLength: messages.length, loading, hasScrolledToUnread });
        if (messages.length > 0 && !loading && !hasScrolledToUnread) {
            // Wait for seen status to be properly updated before determining unread messages
            const timer = setTimeout(() => {
                // Double-check that we haven't already scrolled to unread
                if (!hasScrolledToUnread) {
                    console.log('[GroupChatScreen] Triggering findAndScrollToEarliestUnread after delay');
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

    // --- Render Logic ---
    if (loading && messages.length === 0) { return <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} /></View>; }
    if (loadError && messages.length === 0) { const displayError = loadError.includes('permission') || loadError.includes('session') ? "Permission/session issue." : loadError; return <View style={styles.centered}><Text style={styles.errorText}>{displayError}</Text></View>; }
    if (!currentUserId || !groupId) { return <View style={styles.centered}><Text style={styles.errorText}>Missing User/Group Info.</Text></View>; }

    const safeAreaEdges: Edge[] = Platform.OS === 'ios' ? ['bottom'] : [];

    // --- Add dynamic imports for Sharing and Clipboard ---
    let Sharing: any;
    let Clipboard: any;
    try {
        Sharing = require('expo-sharing');
    } catch {}
    try {
        Clipboard = require('expo-clipboard');
    } catch {}

    // Enhanced cross-platform download and share helpers
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
                !(chat.type === 'group' && chat.id === groupId)
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
                
                // Create group message status entries for all group members (except sender)
                const { data: groupMembersData, error: groupMembersError } = await supabase
                    .from('group_chat_participants')
                    .select('user_id')
                    .eq('group_id', chatId);
                
                if (!groupMembersError && groupMembersData) {
                    const membersToCreateStatusFor = groupMembersData
                        .map(p => p.user_id)
                        .filter(id => id !== currentUserId);
                    
                    if (membersToCreateStatusFor.length > 0) {
                        try {
                            const statusEntries = membersToCreateStatusFor.map(userId => ({
                                message_id: insertedMessage.id,
                                user_id: userId,
                                group_id: chatId,
                                is_delivered: false,
                                is_seen: false
                            }));

                            const { error: statusError } = await supabase
                                .from('group_message_status')
                                .insert(statusEntries);

                            if (statusError) {
                                console.warn('Failed to create group message status entries for forwarded message:', statusError);
                            }
                        } catch (statusErr) {
                            console.warn('Exception creating group message status entries for forwarded message:', statusErr);
                        }
                    }
                }
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
            <KeyboardAvoidingView style={styles.keyboardAvoidingContainer} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0} >
                {sendError && (<View style={styles.errorBanner}><Text style={styles.errorBannerText}>{sendError}</Text><TouchableOpacity onPress={() => setSendError(null)} style={styles.errorBannerClose}><Feather name="x" size={16} color="#B91C1C" /></TouchableOpacity></View>)}

                {/* Typing Indicators */}
                {typingUsers.size > 0 && (
                    <View style={styles.typingIndicatorContainer}>
                        <Text style={styles.typingIndicatorText}>
                            {Array.from(typingUsers.values()).map(user => user.name).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                        </Text>
                    </View>
                )}



                <SectionList
                    ref={flatListRef}
                    sections={sections}
                    style={styles.messageList}
                    contentContainerStyle={styles.messageListContent}
                    keyExtractor={(item) => `${item._id}-${item.isSeen ? 'seen' : 'unseen'}-${item.seenBy?.length || 0}`}
                    renderItem={({ item }) => (
                        <GroupMessageBubble
                            message={item}
                            currentUserId={currentUserId}
                            onImagePress={handleImagePress}
                            onEventPress={handleEventPressInternal} // Pass the new internal handler
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
                            <Text style={styles.replyingToTitle} numberOfLines={1}>Replying to {replyingToMessage.user.name || 'User'}</Text>
                            {replyingToMessage.image ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Feather name="image" size={14} color="#4B5563" style={{ marginRight: 5 }} />
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
                        {isUploading ? <ActivityIndicator size="small" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} /> : <Feather name="paperclip" size={22} color="#52525b" />}
                    </TouchableOpacity>
                    <TextInput style={styles.textInput} value={inputText} onChangeText={handleTextInputChange} placeholder="Type a message..." placeholderTextColor="#9CA3AF" multiline />
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
                <View style={styles.modalContent}><Text style={styles.modalTitle}>Edit Group Name</Text><TextInput style={styles.modalInput} value={editingName} onChangeText={setEditingName} placeholder="Enter new group name" maxLength={50} autoFocus={true} returnKeyType="done" onSubmitEditing={handleUpdateName} /><View style={styles.modalActions}><TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => setIsEditModalVisible(false)} disabled={isUpdatingName}><Text style={styles.modalButtonTextCancel}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[styles.modalButton, styles.modalButtonSave, (isUpdatingName || !editingName.trim() || editingName.trim() === currentGroupName) && styles.modalButtonDisabled]} onPress={handleUpdateName} disabled={isUpdatingName || !editingName.trim() || editingName.trim() === currentGroupName}>{isUpdatingName ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.modalButtonTextSave}>Save</Text>}</TouchableOpacity></View></View>
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
                                <Feather name="corner-up-left" size={20} color="#3B82F6" style={styles.actionModalIcon} />
                                <Text style={styles.actionModalButtonText}>Reply</Text>
                            </TouchableOpacity>

                            {selectedMessageForAction.user._id === currentUserId && !selectedMessageForAction.image && !selectedMessageForAction.sharedEvent && (
                                <TouchableOpacity style={styles.actionModalButton} onPress={handleEdit}>
                                    <Feather name="edit-2" size={20} color="#3B82F6" style={styles.actionModalIcon} />
                                    <Text style={styles.actionModalButtonText}>Edit</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity style={styles.actionModalButton} onPress={handleShowMessageInfo}>
                                <Feather name="info" size={20} color="#3B82F6" style={styles.actionModalIcon} />
                                <Text style={styles.actionModalButtonText}>Info</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionModalButton} onPress={handleDeleteForMe}>
                                <Feather name="trash" size={20} color="#EF4444" style={styles.actionModalIcon} />
                                <Text style={[styles.actionModalButtonText, { color: '#EF4444' }]}>Delete for Me</Text>
                            </TouchableOpacity>

                            {(selectedMessageForAction.user._id === currentUserId || isCurrentUserAdmin) && (
                                <TouchableOpacity style={styles.actionModalButton} onPress={handleDeleteForEveryone}>
                                    <Feather name="trash-2" size={20} color="#EF4444" style={styles.actionModalIcon} />
                                    <Text style={[styles.actionModalButtonText, { color: '#EF4444' }]}>Delete for Everyone</Text>
                                </TouchableOpacity>
                            )}

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
                    <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => { setEditingMessage(null); setEditText(""); }} />
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
                            <Text style={styles.messageInfoSectionTitle}>Sent at: {formatTime(new Date(messageInfoData.sent_at))}</Text>
                            <Text style={styles.messageInfoSectionTitle}>Seen by: {messageInfoData.seen_count} / {messageInfoData.total_members}</Text>

                            {messageInfoData.seen_users && messageInfoData.seen_users.length > 0 && (
                                <View style={{ marginTop: 16 }}>
                                    <Text style={styles.messageInfoSectionTitle}>Seen by:</Text>
                                    {messageInfoData.seen_users.map((seenUser: any, index: number) => (
                                        <Text key={`${seenUser.user_id}-${seenUser.seen_at}`} style={styles.messageInfoDetailText}>
                                            • {seenUser.name} at {formatTime(new Date(seenUser.seen_at))}
                                        </Text>
                                    ))}
                                </View>
                            )}

                            {messageInfoData.seen_count === 0 && (
                                <Text style={styles.messageInfoDetailText}>No one has seen this message yet</Text>
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

            {/* Image Viewer */}
            {imageViewerVisible && selectedImage && (
                <Modal visible={true} transparent={true} onRequestClose={() => setImageViewerVisible(false)}>
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
                        renderHeader={() => {
                            const imageList = messages.filter(msg => msg.image);
                            const current = imageList[selectedImageIndex];
                            const url = current?.image;
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
                <Modal transparent={true} visible={true} onRequestClose={() => { }}>
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
    errorBanner: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        paddingVertical: 8,
        paddingHorizontal: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(239, 68, 68, 0.2)',
    },
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

    // Legacy bubble styles (keeping for backward compatibility)
    messageBubbleSentText: {
        backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6',
        borderBottomRightRadius: 4,
        alignSelf: 'flex-end',
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    messageBubbleReceivedText: {
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 4,
        alignSelf: 'flex-start',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },

    // Image messages
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

    // Text styles
    messageText: {
        fontSize: 15,
        lineHeight: 21,
        flexShrink: 1,
    },
    messageTextSent: { color: '#FFFFFF', },
    messageTextReceived: { color: '#1F2937', },
    senderName: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
        marginLeft: 6,
        alignSelf: 'flex-start',
        fontWeight: '500',
    },

    // System messages
    systemMessageContainer: {
        alignSelf: 'center',
        backgroundColor: 'rgba(107, 114, 128, 0.1)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginVertical: 8,
        maxWidth: '80%',
    },
    systemMessageText: {
        fontSize: 12,
        color: '#4B5563',
        textAlign: 'center',
        fontStyle: 'italic',
        fontWeight: '500',
    },

    // Time indicators
    timeText: {
        fontSize: 11,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
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
    timeAndEditContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 4,
        minHeight: 16,
    },
    seenByText: {
        alignSelf: 'flex-end',
        fontSize: 11,
        color: '#9CA3AF',
        marginRight: 8,
        marginTop: 2,
    },

    // Section headers
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

    // Input area
    inputToolbar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
        paddingBottom: Platform.OS === 'ios' ? 8 : 12,
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
        textAlignVertical: 'center',
    },
    sendButton: {
        backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Platform.OS === 'ios' ? 0 : 1,
    },
    sendButtonDisabled: { backgroundColor: '#9CA3AF', },

    // Header
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: Platform.OS === 'ios' ? -10 : 0,
    },
    headerGroupImage: {
        width: 34,
        height: 34,
        borderRadius: 17,
        marginRight: 10,
        backgroundColor: '#E5E7EB',
    },
    headerTitleText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
    },
    headerButtons: {
        flexDirection: 'row',
        marginRight: Platform.OS === 'ios' ? 5 : 10,
    },
    headerButton: {
        paddingHorizontal: 8,
        paddingVertical: 6,
    },

    // Edit modal
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        position: 'absolute',
        top: '25%',
        left: '8%',
        right: '8%',
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 28,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        width: '84%',
        minHeight: 220,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 24,
        textAlign: 'center',
        color: '#1F2937',
    },
    modalInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        marginBottom: 28,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    modalButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 100,
    },
    modalButtonCancel: {
        backgroundColor: '#F3F4F6',
    },
    modalButtonSave: {
        backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6',
    },
    modalButtonDisabled: {
        backgroundColor: '#D1D5DB',
    },
    modalButtonTextCancel: {
        color: '#4B5563',
        fontWeight: '600',
    },
    modalButtonTextSave: {
        color: 'white',
        fontWeight: '600',
    },

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

    // Enhanced shared event styles
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

    // Error states
    imageErrorOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16,
    },
    imageErrorText: {
        color: '#FFFFFF',
        fontSize: 12,
        marginTop: 4,
        textAlign: 'center',
    },

    // Loading overlay
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
    messageRowTouchable: {
        flexDirection: 'row',
        marginVertical: 4,
        alignItems: 'flex-end',
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
    messageInfoSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginTop: 12,
        marginBottom: 8,
    },
    messageInfoMemberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
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
        fontSize: 15,
        fontWeight: '500',
        color: '#1F2937',
        marginBottom: 2,
    },
    messageInfoStatusText: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
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
    senderInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    senderAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 8,
    },
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
        backgroundColor: '#F3F4F6',
    },
    eventOverOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16,
    },
    eventOverText: {
        color: '#FFFFFF',
        fontSize: 12,
        marginTop: 4,
        textAlign: 'center',
    },
    eventOverTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 2,
    },
    eventOverDetails: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 1,
    },
    messageInfoDetailText: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 4,
    },
    // Realtime styles
    headerTextContainer: {
        flex: 1,
        alignItems: 'center',
    },

    typingIndicatorContainer: {
        paddingHorizontal: 15,
        paddingBottom: 5,
        height: 25,
        backgroundColor: '#F9FAFB',
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

    // Online presence styles
    headerImageContainer: {
        position: 'relative',
        marginRight: 10,
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#22C55E',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    onlineIndicatorText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    headerSubtitleText: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 2,
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



export default GroupChatScreen;