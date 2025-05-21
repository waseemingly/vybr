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

// Types and MessageBubble component
type IndividualChatScreenRouteProp = RouteProp<RootStackParamList, 'IndividualChatScreen'>;
type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;
interface DbMessage { id: string; created_at: string; sender_id: string; receiver_id: string; content: string; image_url?: string | null; }
interface ChatMessage { _id: string; text: string; createdAt: Date; user: { _id: string; }; image?: string | null; }
interface MessageBubbleProps { message: ChatMessage; currentUserId: string | undefined; }

// Add DEFAULT_PROFILE_PIC constant
const DEFAULT_PROFILE_PIC = APP_CONSTANTS.DEFAULT_PROFILE_PIC;

// Helper to format timestamps
const formatTime = (date: Date) => date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const MessageBubble: React.FC<{ 
    message: ChatMessage; 
    currentUserId: string;
    onImagePress: (imageUrl: string) => void;
}> = React.memo(({ message, currentUserId, onImagePress }) => {
    const isCurrentUser = message.user._id === currentUserId;
    const [imageError, setImageError] = useState(false);

    return (
        <View style={[styles.messageRow, isCurrentUser ? styles.messageRowSent : styles.messageRowReceived]}>
            <View style={styles.messageContentContainer}>
                {message.image ? (
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
                            <View style={styles.imageErrorContainer}>
                                <Text style={styles.imageErrorText}>Failed to load image</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                ) : (
                    <View style={[styles.messageBubble, isCurrentUser ? styles.messageBubbleSent : styles.messageBubbleReceived]}>
                        <Text style={isCurrentUser ? styles.messageTextSent : styles.messageTextReceived}>
                            {message.text}
                        </Text>
                    </View>
                )}
                <Text style={[styles.timeText, styles.timeTextBelowBubble, isCurrentUser ? styles.timeTextSent : styles.timeTextReceived]}>
                    {formatTime(message.createdAt)}
                </Text>
            </View>
        </View>
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
    const { session } = useAuth();
    const { musicLoverProfile } = useAuth();

    const { matchUserId, commonTags, isFirstInteractionFromMatches } = route.params;
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

    const currentUserId = session?.user?.id;
    const flatListRef = useRef<SectionList<any>>(null);
    const isCurrentUserPremium = musicLoverProfile?.isPremium;

    const mapDbMessageToChatMessage = useCallback((dbMessage: DbMessage): ChatMessage => ({
        _id: dbMessage.id,
        text: dbMessage.content,
        createdAt: new Date(dbMessage.created_at),
        user: { _id: dbMessage.sender_id },
        image: dbMessage.image_url || null
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
                .select('*')
                .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${matchUserId}),and(sender_id.eq.${matchUserId},receiver_id.eq.${currentUserId})`)
                .order('created_at', { ascending: true });

            if (fetchError) throw fetchError;
            if (data) {
                const fetchedChatMessages = data.map(mapDbMessageToChatMessage);
                setMessages(fetchedChatMessages);
                checkMutualInitiation(fetchedChatMessages);
                console.log(`[ChatScreen] Fetched ${data.length} messages.`);
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
                    const { data: edgeFnResponse, error: edgeFnError } = await supabase.functions.invoke<{ starters?: string[], error?: string }>(
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
                    if (isBlocked) return;
                    console.log('[ChatScreen] New message received via subscription:', payload.new);
                    const receivedMessage = mapDbMessageToChatMessage(payload.new as DbMessage);
                    if (receivedMessage.user._id === matchUserId) {
                        setMessages(prevMessages => {
                            if (prevMessages.some(msg => msg._id === receivedMessage._id)) return prevMessages;
                            return [...prevMessages, receivedMessage];
                        });
                    } else if (receivedMessage.user._id === currentUserId) {
                        setMessages(prevMessages =>
                            prevMessages.map(msg =>
                                msg._id.startsWith('temp_') && msg.text === receivedMessage.text
                                ? receivedMessage
                                : msg
                            )
                        );
                    }
                }
            )
            .subscribe();

        return () => {
            console.log(`[ChatScreen] Unsubscribing from channel for ${matchUserId}`);
            supabase.removeChannel(channel);
        };
    }, [currentUserId, matchUserId, mapDbMessageToChatMessage, isBlocked]);

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
    const pickAndSendImage = async () => {
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
            const optimisticMessage: ChatMessage = {
                _id: tempId,
                text: '[Image]',
                createdAt: new Date(),
                user: { _id: currentUserId },
                image: imageUri
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
                    content: '[Image]',
                    image_url: urlData.publicUrl
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
    };

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
                    renderItem={({ item }) => <MessageBubble message={item} currentUserId={currentUserId} onImagePress={handleImagePress} />}
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
                        style={[styles.sendButton, (!inputText.trim() || isBlocked) && styles.sendButtonDisabled]}
                        onPress={handleSendPress}
                        disabled={!inputText.trim() || isBlocked}
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
    imageErrorContainer: {
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
    // Styles for Conversation Starters
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
});

export default IndividualChatScreen;