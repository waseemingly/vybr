// // src/screens/GroupChatScreen.tsx
// // Contains the fix for fetching profiles separately and includes group image display + navigation to GroupInfoScreen.

// import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
// import {
//     View, StyleSheet, ActivityIndicator, Text, TouchableOpacity,
//     Platform, TextInput, SectionList, KeyboardAvoidingView, Keyboard,
//     Modal, Alert, Image // <-- Image import is crucial
// } from 'react-native';
// import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
// import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
// import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// import { Feather } from '@expo/vector-icons';

// import { supabase } from '@/lib/supabase';
// import { useAuth } from '@/hooks/useAuth';
// // Ensure RootStackParamList includes GroupInfoScreen with correct params
// import type { RootStackParamList } from "@/navigation/AppNavigator";
// import { APP_CONSTANTS } from '@/config/constants';

// // Helper to format timestamps
// const formatTime = (date: Date) => date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

// // --- Type Definitions ---

// type GroupChatScreenRouteProp = RouteProp<RootStackParamList, 'GroupChatScreen'>;
// // Ensure the navigation prop uses the RootStackParamList which now includes GroupInfoScreen
// type GroupChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GroupChatScreen'>;

// // Interface matching DB structure (NO joined profile here)
// interface DbGroupMessage {
//     id: string;
//     created_at: string;
//     sender_id: string;
//     group_id: string;
//     content: string;
//     is_system_message: boolean;
// }

// // Interface for UI rendering
// interface ChatMessage {
//     _id: string;
//     text: string;
//     createdAt: Date;
//     user: {
//         _id: string;
//         name?: string;
//         avatar?: string; // User avatar
//     };
//     isSystemMessage: boolean;
// }

// // Interface for Profile data fetched separately
// interface UserProfileInfo {
//     user_id: string;
//     first_name: string | null;
//     last_name: string | null;
//     profile_picture: string | null; // User profile picture URL
// }

// // Interface for Group details from DB (used in real-time update)
// interface DbGroupChat {
//     id: string;
//     group_name: string;
//     group_image: string | null; // Group image URL
//     can_members_add_others?: boolean; // Optional: if subscription payload includes it
//     can_members_edit_info?: boolean;  // Optional: if subscription payload includes it
//     // ... other fields if needed
// }

// // --- Constants and Cache ---

// // Cache for fetched user profiles to avoid redundant lookups
// const userProfileCache: Record<string, { name?: string; avatar?: string }> = {};
// const DEFAULT_PROFILE_PIC = APP_CONSTANTS.DEFAULT_PROFILE_PIC;
// const DEFAULT_GROUP_PIC = 'https://placehold.co/40x40/e2e8f0/64748b?text=G'; // Default Group Icon for header

// // --- GroupMessageBubble Component ---
// interface GroupMessageBubbleProps { message: ChatMessage; currentUserId: string | undefined; }
// const GroupMessageBubble: React.FC<GroupMessageBubbleProps> = React.memo(({ message, currentUserId }) => {
//     const isCurrentUser = message.user._id === currentUserId;
//     const senderName = message.user.name; // Display name (could be 'You' or fetched name)

//     // Render system messages differently
//     if (message.isSystemMessage) {
//          return (
//              <View style={styles.systemMessageContainer}>
//                  <Text style={styles.systemMessageText}>{message.text}</Text>
//              </View>
//          );
//     }

//     // Render regular chat messages
//     return (
//         <View style={[
//             styles.messageRow,
//             isCurrentUser ? styles.messageRowSent : styles.messageRowReceived
//         ]}>
//             {/* Optional: Add Avatar here if desired, next to the bubble */}
//             {/* {!isCurrentUser && message.user.avatar && (
//                 <Image source={{ uri: message.user.avatar }} style={styles.senderAvatar} />
//             )} */}
//             <View style={styles.messageContentContainer}>
//                  {/* Show sender's name above their message if not the current user */}
//                  {!isCurrentUser && senderName && senderName !== 'User' && (
//                      <Text style={styles.senderName}>{senderName}</Text>
//                  )}
//                 <View style={[
//                     styles.messageBubble,
//                     isCurrentUser ? styles.messageBubbleSent : styles.messageBubbleReceived
//                 ]}>
//                     <Text style={isCurrentUser ? styles.messageTextSent : styles.messageTextReceived}>
//                         {message.text}
//                     </Text>
//                     <Text style={styles.timeText}>{formatTime(message.createdAt)}</Text>
//                 </View>
//             </View>
//         </View>
//     );
// });

// // --- GroupChatScreen Component ---
// const GroupChatScreen: React.FC = () => {
//     const route = useRoute<GroupChatScreenRouteProp>();
//     const navigation = useNavigation<GroupChatScreenNavigationProp>();
//     const { session } = useAuth();
//     const currentUserId = session?.user?.id;
//     const { groupId } = route.params;

//     // State variables
//     const [currentGroupName, setCurrentGroupName] = useState(route.params.groupName ?? 'Group Chat'); // Use passed name or default
//     const [currentGroupImage, setCurrentGroupImage] = useState(route.params.groupImage); // Use passed image URI
//     const [messages, setMessages] = useState<ChatMessage[]>([]);
//     const [inputText, setInputText] = useState('');
//     const [loading, setLoading] = useState(true);
//     const [loadError, setLoadError] = useState<string | null>(null);
//     const [sendError, setSendError] = useState<string | null>(null);
//     const [isEditModalVisible, setIsEditModalVisible] = useState(false);
//     const [editingName, setEditingName] = useState(''); // Initialize empty, set when modal opens
//     const [isUpdatingName, setIsUpdatingName] = useState(false);
//     const flatListRef = useRef<SectionList<any>>(null);
//     const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
//     const [canMembersAddOthers, setCanMembersAddOthers] = useState(false);
//     const [canMembersEditInfo, setCanMembersEditInfo] = useState(false); // <-- New state

//     // Group messages by date for section headers
//     const sections = useMemo(() => {
//         const groups: Record<string, ChatMessage[]> = {};
//         messages.forEach(msg => {
//             const dateKey = msg.createdAt.toDateString();
//             (groups[dateKey] = groups[dateKey] || []).push(msg);
//         });
//         const sortedKeys = Object.keys(groups).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());
//         const today = new Date(), yesterday = new Date(today.getTime() - 86400000);
//         return sortedKeys.map(dateKey => {
//             const date = new Date(dateKey);
//             let title = date.toDateString() === today.toDateString() ? 'Today'
//                 : date.toDateString() === yesterday.toDateString() ? 'Yesterday'
//                 : (today.getTime() - date.getTime() <= 7*86400000) ? date.toLocaleDateString(undefined, { weekday:'long' })
//                 : date.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
//             return { title, data: groups[dateKey] };
//         });
//     }, [messages]);

//     // --- Data Fetching and Mapping ---

//     // Map Database Message to ChatMessage UI Object
//     const mapDbMessageToChatMessage = useCallback((
//         dbMessage: DbGroupMessage,
//         profilesMap: Map<string, UserProfileInfo> // Pass map of already fetched profiles
//     ): ChatMessage => {
//         let senderName = 'User'; // Default name
//         let senderAvatar: string | undefined = undefined; // Default avatar

//         // Check cache first
//         const profileFromCache = userProfileCache[dbMessage.sender_id];
//         if (profileFromCache) {
//             senderName = profileFromCache.name || 'User';
//             senderAvatar = profileFromCache.avatar;
//         } else {
//             // If not cached, check the map passed from fetchMessages/real-time fetch
//             const profileFromMap = profilesMap.get(dbMessage.sender_id);
//             if (profileFromMap) {
//                  senderName = `${profileFromMap.first_name || ''} ${profileFromMap.last_name || ''}`.trim() || 'User';
//                  senderAvatar = profileFromMap.profile_picture || undefined; // Use profile picture URL

//                  // Cache the fetched profile info for future use
//                  if (!dbMessage.is_system_message) { // Don't cache system message 'senders' if they aren't real users
//                      userProfileCache[dbMessage.sender_id] = { name: senderName, avatar: senderAvatar };
//                  }
//             }
//         }

//         // Ensure current user's profile ('You') is cached if needed
//         if (currentUserId && !userProfileCache[currentUserId]) {
//              userProfileCache[currentUserId] = { name: 'You', avatar: undefined }; // Current user doesn't need own avatar shown typically
//         }

//         return {
//             _id: dbMessage.id,
//             text: dbMessage.content,
//             createdAt: new Date(dbMessage.created_at),
//             user: { // Structure required by message bubble potentially
//                 _id: dbMessage.sender_id,
//                 name: dbMessage.sender_id === currentUserId ? 'You' : senderName,
//                 avatar: dbMessage.sender_id === currentUserId ? undefined : senderAvatar,
//             },
//              isSystemMessage: dbMessage.is_system_message,
//         };
//     }, [currentUserId]);

//     // Fetch Initial Messages, Profiles, AND Permissions
//     const fetchInitialData = useCallback(async () => {
//         if (!currentUserId || !groupId) {
//             setLoadError("Authentication or Group ID missing."); setLoading(false); return;
//         }
//         console.log(`[GroupChatScreen] Fetching initial data for group: ${groupId}`);
//         setLoading(true); setLoadError(null);
//         setIsCurrentUserAdmin(false);
//         setCanMembersAddOthers(false);
//         setCanMembersEditInfo(false); // <-- Reset new state

//         try {
//             console.log(`[GroupChatScreen] Calling RPC get_group_info for group ${groupId}`);
//             const { data: groupInfoData, error: groupInfoError } = await supabase
//                 .rpc('get_group_info', { group_id_input: groupId });

//             if (groupInfoError) throw groupInfoError;
//             if (!groupInfoData?.group_details || !groupInfoData?.participants) {
//                 throw new Error("Incomplete group data received from get_group_info.");
//             }

//             const groupDetails = groupInfoData.group_details;
//             const participantsRaw: { user_id: string, is_admin: boolean }[] = groupInfoData.participants;

//             // --- Set Permissions ---
//             const currentUserParticipant = participantsRaw.find(p => p.user_id === currentUserId);
//             setIsCurrentUserAdmin(currentUserParticipant?.is_admin ?? false);
//             setCanMembersAddOthers(groupDetails.can_members_add_others ?? false);
//             setCanMembersEditInfo(groupDetails.can_members_edit_info ?? false); // <-- Set new state
//             setCurrentGroupImage(groupDetails.group_image ?? null); // Persist group image from DB
//             console.log(`[GroupChatScreen] Permissions set: isAdmin=${currentUserParticipant?.is_admin ?? false}, canAdd=${groupDetails.can_members_add_others ?? false}, canEdit=${groupDetails.can_members_edit_info ?? false}`);
//             // --- End Set Permissions ---

//             // --- Fetch Messages (existing logic, slightly adapted) ---
//             console.log(`[GroupChatScreen] Fetching messages for group: ${groupId}`);
//             const { data: messagesData, error: messagesError } = await supabase
//                 .from('group_chat_messages')
//                 .select('id, created_at, sender_id, group_id, content, is_system_message')
//                 .eq('group_id', groupId)
//                 .order('created_at', { ascending: true });

//             if (messagesError) throw messagesError;

//             if (!messagesData || messagesData.length === 0) {
//                 setMessages([]);
//                 // No need to fetch profiles if no messages
//             } else {
//                 const senderIds = Array.from(
//                     new Set(
//                         messagesData
//                             .filter(msg => !msg.is_system_message && msg.sender_id)
//                             .map(msg => msg.sender_id)
//                     )
//                 );

//                 const profilesMap = new Map<string, UserProfileInfo>();
//                 if (senderIds.length > 0) {
//                     const idsToFetch = senderIds.filter(id => !userProfileCache[id]);
//                     if (idsToFetch.length > 0) {
//                         console.log(`[GroupChatScreen] Fetching profiles for ${idsToFetch.length} users.`);
//                         const { data: profilesData, error: profilesError } = await supabase
//                             .from('music_lover_profiles')
//                             .select('user_id, first_name, last_name, profile_picture')
//                             .in('user_id', idsToFetch);

//                         if (profilesError) {
//                              console.error("[GroupChatScreen] Error fetching profiles:", profilesError);
//                         } else if (profilesData) {
//                             profilesData.forEach((profile: UserProfileInfo) => {
//                                 profilesMap.set(profile.user_id, profile);
//                                 const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User';
//                                 const avatar = profile.profile_picture || undefined;
//                                 userProfileCache[profile.user_id] = { name, avatar };
//                             });
//                         }
//                     }
//                      senderIds.forEach(id => {
//                          if (userProfileCache[id] && !profilesMap.has(id)) {
//                               profilesMap.set(id, {
//                                   user_id: id,
//                                   first_name: userProfileCache[id].name?.split(' ')[0] || null,
//                                   last_name: userProfileCache[id].name?.split(' ')[1] || null,
//                                   profile_picture: userProfileCache[id].avatar || null
//                               });
//                          }
//                      });
//                 }

//                 if (currentUserId && !userProfileCache[currentUserId]) {
//                     userProfileCache[currentUserId] = { name: 'You' };
//                 }

//                 const mappedMessages = (messagesData as DbGroupMessage[]).map(dbMsg =>
//                     mapDbMessageToChatMessage(dbMsg, profilesMap)
//                 );
//                 setMessages(mappedMessages);
//             }
//             // --- End Fetch Messages ---

//         } catch (err: any) {
//             console.error("[GroupChatScreen] Error fetching initial data:", err);
//              if (err.message.includes('permission') || err.message.includes('session') || err.message.includes('JWT')) {
//                  setLoadError("Could not load group data. Please check your connection or try logging in again.");
//              } else if (err.message.includes("User is not a member")) {
//                  setLoadError("You are not a member of this group.");
//                  // Consider navigating back or showing a specific message
//                  Alert.alert("Access Denied", "You are not a member of this group.", [{ text: "OK", onPress: () => navigation.goBack() }]);
//              }
//               else {
//                  setLoadError(`Could not load group data: ${err.message}`);
//              }
//             setMessages([]); // Clear messages on error
//             // Ensure permissions are false on error
//             setIsCurrentUserAdmin(false);
//             setCanMembersAddOthers(false);
//             setCanMembersEditInfo(false); // <-- Reset on error
//         } finally {
//             setLoading(false);
//         }
//     // Removed mapDbMessageToChatMessage from dependencies as it's stable
//     }, [currentUserId, groupId, navigation]);


//     // --- Sending Messages ---

//     // Send a New Message
//     const sendMessage = useCallback(async (text: string) => {
//          if (!currentUserId || !groupId || !text.trim()) {
//              console.warn("[GroupChatScreen] Send message aborted: Missing userId, groupId, or text.");
//              return;
//          }
//          const trimmedText = text.trim();

//          // Optimistic UI Update: Add temporary message immediately
//          const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
//          const currentUserProfile = userProfileCache[currentUserId] || { name: 'You', avatar: undefined };
//          const optimisticMessage: ChatMessage = {
//              _id: tempId,
//              text: trimmedText,
//              createdAt: new Date(),
//              user: {
//                  _id: currentUserId,
//                  name: currentUserProfile.name,
//                  avatar: currentUserProfile.avatar
//              },
//              isSystemMessage: false
//          };

//          setMessages(previousMessages => [...previousMessages, optimisticMessage]);
//          setInputText(''); // Clear input field
//          setSendError(null); // Clear previous send errors
//          Keyboard.dismiss(); // Dismiss keyboard
//          console.log(`[GroupChatScreen] Sending message to group ${groupId}: "${trimmedText}"`);

//          try {
//              // Insert message into the database
//              const { data: insertedData, error: insertError } = await supabase
//                  .from('group_chat_messages')
//                  .insert({
//                      sender_id: currentUserId,
//                      group_id: groupId,
//                      content: trimmedText,
//                      is_system_message: false
//                  })
//                  .select('id, created_at') // Select the actual ID and timestamp
//                  .single(); // Expect only one row inserted

//              if (insertError) throw insertError;
//              if (!insertedData) throw new Error("Message sent but no confirmation received from DB.");

//              // Replace temporary message with confirmed message data
//              setMessages(prevMessages => prevMessages.map(msg =>
//                  msg._id === tempId
//                      ? { ...optimisticMessage, _id: insertedData.id, createdAt: new Date(insertedData.created_at) } // Update ID and timestamp
//                      : msg
//              ));
//              // Ensure sendError is cleared on success
//              if (sendError) setSendError(null);

//          } catch (err: any) {
//              console.error("[GroupChatScreen] Error sending group message:", err);
//              setSendError(`Failed to send message: ${err.message}`);
//              // Revert Optimistic Update: Remove the temporary message on failure
//              setMessages(prevMessages => prevMessages.filter(msg => msg._id !== tempId));
//              setInputText(trimmedText); // Restore text in input field for user to retry
//          }
//     }, [currentUserId, groupId, sendError]); // Dependencies

//     const handleSendPress = () => {
//         sendMessage(inputText);
//     };


//     // --- Real-time Subscriptions ---

//     // Subscribe to New Messages
//     useEffect(() => {
//         if (!groupId || !currentUserId) return;

//         console.log(`[GroupChatScreen] Subscribing to messages for group ${groupId}`);
//         const messageChannel = supabase.channel(`group_chat_messages_${groupId}`)
//             .on<DbGroupMessage>(
//                 'postgres_changes',
//                 { event: 'INSERT', schema: 'public', table: 'group_chat_messages', filter: `group_id=eq.${groupId}` },
//                 async (payload) => {
//                     const newMessageDb = payload.new;
//                     console.log('[GroupChatScreen] Realtime message received:', newMessageDb);

//                     // Ignore messages sent by the current user (already handled optimistically)
//                     // unless it's a system message potentially triggered by others
//                     if (newMessageDb.sender_id === currentUserId && !newMessageDb.is_system_message) {
//                         console.log('[GroupChatScreen] Realtime: Ignoring self-sent message.');
//                         return;
//                     }

//                     // Check if profile for sender is needed and not cached
//                     const rtProfilesMap = new Map<string, UserProfileInfo>();
//                     if (newMessageDb.sender_id && !newMessageDb.is_system_message && !userProfileCache[newMessageDb.sender_id]) {
//                          console.log(`[GroupChatScreen] Realtime: Fetching profile for ${newMessageDb.sender_id}`);
//                          try {
//                             // Fetch the profile for the sender of the new message
//                             const { data: profileData, error: profileError } = await supabase
//                                 .from('music_lover_profiles') // Adjust if needed
//                                 .select('user_id, first_name, last_name, profile_picture')
//                                 .eq('user_id', newMessageDb.sender_id)
//                                 .single();

//                             if (profileError) throw profileError;

//                             if (profileData) {
//                                 rtProfilesMap.set(profileData.user_id, profileData); // Add to map for mapping function
//                                 // Update cache as well
//                                 const name = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || 'User';
//                                 const avatar = profileData.profile_picture || undefined;
//                                 userProfileCache[profileData.user_id] = { name, avatar };
//                             }
//                          } catch (err) {
//                             console.error(`[GroupChatScreen] Realtime: Failed to fetch profile for ${newMessageDb.sender_id}`, err);
//                             // Continue without profile, mapDbMessageToChatMessage will handle defaults
//                          }
//                     }

//                     // Map the new DB message to a ChatMessage object
//                     const receivedMessage = mapDbMessageToChatMessage(newMessageDb, rtProfilesMap);

//                     // Add the new message to the state, preventing duplicates if already added
//                     setMessages(previousMessages =>
//                         previousMessages.some(msg => msg._id === receivedMessage._id)
//                             ? previousMessages // Already exists (e.g., handled optimistically or duplicate event)
//                             : [...previousMessages, receivedMessage] // Add new message
//                     );
//                 }
//             )
//             .subscribe((status, err) => { // Handle subscription status/errors
//                 if (status === 'SUBSCRIBED') {
//                     console.log(`[GroupChatScreen] Message subscription active for group ${groupId}`);
//                 } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
//                     console.error(`[GroupChatScreen] Message subscription error for group ${groupId}:`, status, err);
//                     // Optionally: Implement retry logic or notify user
//                     // setLoadError("Real-time connection issue. Please refresh.");
//                 } else if (status === 'CLOSED') {
//                      console.log(`[GroupChatScreen] Message subscription closed for group ${groupId}`);
//                 }
//             });

//         // Cleanup function to remove the channel subscription when the component unmounts or groupId changes
//         return () => {
//             console.log(`[GroupChatScreen] Unsubscribing messages for group ${groupId}`);
//             supabase.removeChannel(messageChannel);
//         };
//     }, [groupId, currentUserId, mapDbMessageToChatMessage]); // Dependencies

//     // Subscribe to Group Info Updates (Name, Image)
//     useEffect(() => {
//         if (!groupId) return;

//         console.log(`[GroupChatScreen] Subscribing to info updates for group ${groupId}`);
//         const infoChannel = supabase.channel(`group_info_${groupId}`)
//             .on<DbGroupChat>( // Use specific type if known
//                 'postgres_changes',
//                 { event: 'UPDATE', schema: 'public', table: 'group_chats', filter: `id=eq.${groupId}` },
//                 (payload) => {
//                      const updatedGroupData = payload.new as DbGroupChat; // Type cast includes optional fields
//                      console.log("[GroupChatScreen] Group info update received:", updatedGroupData);

//                      if (updatedGroupData.group_name !== currentGroupName) {
//                          console.log(`[GroupChatScreen] Updating group name from "${currentGroupName}" to "${updatedGroupData.group_name}"`);
//                          setCurrentGroupName(updatedGroupData.group_name);
//                      }
//                      if (updatedGroupData.group_image !== currentGroupImage) {
//                           console.log(`[GroupChatScreen] Real-time: updating group image.`);
//                          setCurrentGroupImage(updatedGroupData.group_image);
//                      }
//                      // --- Update Permission State from Real-time ---
//                      if (updatedGroupData.can_members_add_others !== undefined && updatedGroupData.can_members_add_others !== canMembersAddOthers) {
//                          console.log(`[GroupChatScreen] Updating canMembersAddOthers from ${canMembersAddOthers} to ${updatedGroupData.can_members_add_others}`);
//                          setCanMembersAddOthers(updatedGroupData.can_members_add_others);
//                      }
//                      if (updatedGroupData.can_members_edit_info !== undefined && updatedGroupData.can_members_edit_info !== canMembersEditInfo) {
//                          console.log(`[GroupChatScreen] Updating canMembersEditInfo from ${canMembersEditInfo} to ${updatedGroupData.can_members_edit_info}`);
//                          setCanMembersEditInfo(updatedGroupData.can_members_edit_info);
//                      }
//                      // --- End Update Permission State ---
//                 }
//             )
//              .on<any>( // Listen for DELETE event to handle group deletion while user is viewing
//                  'postgres_changes',
//                  { event: 'DELETE', schema: 'public', table: 'group_chats', filter: `id=eq.${groupId}` },
//                  (payload) => {
//                      console.log('[GroupChatScreen] Group deleted remotely.');
//                      Alert.alert("Group Deleted", "This group no longer exists.", [
//                          { text: "OK", onPress: () => navigation.popToTop() } // Navigate back up the stack
//                      ]);
//                  }
//              )
//             .subscribe((status, err) => { // Handle subscription status/errors
//                 if (status === 'SUBSCRIBED') {
//                     console.log(`[GroupChatScreen] Group info subscription active for group ${groupId}`);
//                 } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
//                     console.error(`[GroupChatScreen] Group info subscription error for group ${groupId}:`, status, err);
//                 } else if (status === 'CLOSED') {
//                     console.log(`[GroupChatScreen] Group info subscription closed for group ${groupId}`);
//                 }
//             });

//         // Cleanup function
//         return () => {
//             console.log(`[GroupChatScreen] Unsubscribing group info for group ${groupId}`);
//             supabase.removeChannel(infoChannel);
//         };
//     }, [groupId, currentGroupName, currentGroupImage, navigation, canMembersAddOthers, canMembersEditInfo]); // Dependencies include state vars being updated


//     // --- Navigation and Header ---

//     // Navigate to Group Info Screen
//     const navigateToGroupInfo = () => {
//          // Ensure we have the necessary info before navigating
//         if (!groupId || !currentGroupName) {
//              console.warn("[GroupChatScreen] Cannot navigate to Group Info: Missing groupId or groupName.");
//              Alert.alert("Error", "Could not load group details.");
//              return;
//          }
//         navigation.navigate('GroupInfoScreen', {
//             groupId: groupId,
//             groupName: currentGroupName ?? 'Group', // Ensure name is not undefined
//             groupImage: currentGroupImage ?? null, // Ensure image is null or string
//         });
//     };

//     // Set Header Options (Dynamically updates when name/image/permissions change)
//     useEffect(() => {
//         // Determine if the add members button should be enabled
//         const canAddMembers = isCurrentUserAdmin || canMembersAddOthers;
//         // Edit name button enabled if admin OR if group setting allows it
//         const canEditName = isCurrentUserAdmin || canMembersEditInfo;

//         console.log(`[GroupChatScreen] Updating header options. CanAddMembers: ${canAddMembers}, CanEditName: ${canEditName}`);

//         navigation.setOptions({
//             // Use headerTitle to render a custom component
//              headerTitle: () => (
//                  <TouchableOpacity style={styles.headerTitleContainer} onPress={navigateToGroupInfo} activeOpacity={0.8}>
//                      <Image
//                         source={{ uri: currentGroupImage ?? DEFAULT_GROUP_PIC }} // Use state variable or default
//                         style={styles.headerGroupImage}
//                         />
//                      <Text style={styles.headerTitleText} > 
//                          {currentGroupName}
//                      </Text>
//                  </TouchableOpacity>
//              ),
//             headerBackVisible: true,
//             headerRight: () => (
//                 <View style={styles.headerButtons}>
//                     {/* Conditionally render or disable Add Members button */}
//                     <TouchableOpacity
//                         onPress={() => {
//                             if (canAddMembers) {
//                                 navigation.navigate('AddGroupMembersScreen', { groupId, groupName: currentGroupName });
//                             } else {
//                                 Alert.alert("Permission Denied", "Only admins can add members currently.");
//                             }
//                         }}
//                         style={styles.headerButton}
//                         disabled={!canAddMembers} // Disable the button visually/functionally
//                     >
//                         <Feather
//                             name="user-plus"
//                             size={22}
//                             color={canAddMembers ? APP_CONSTANTS.COLORS.PRIMARY : APP_CONSTANTS.COLORS.DISABLED} // Change color when disabled
//                         />
//                     </TouchableOpacity>

//                     {/* Edit Name button (updated logic) */}
//                     <TouchableOpacity
//                          onPress={() => {
//                             // Check combined permission before opening modal
//                             if (canEditName) {
//                                 setEditingName(currentGroupName ?? '');
//                                 setIsEditModalVisible(true);
//                             } else {
//                                 // Provide a clearer message based on the setting
//                                 Alert.alert("Permission Denied", "Only admins are currently allowed to edit group info.");
//                             }
//                          }}
//                          style={styles.headerButton}
//                          disabled={!canEditName} // Disable based on combined permission
//                      >
//                          <Feather
//                             name="edit-2"
//                             size={22}
//                             color={canEditName ? APP_CONSTANTS.COLORS.PRIMARY : APP_CONSTANTS.COLORS.DISABLED}
//                         />
//                      </TouchableOpacity>
//                 </View>
//             ),
//         });
//     // Update header if edit permissions change
//     }, [navigation, currentGroupName, currentGroupImage, groupId, isCurrentUserAdmin, canMembersAddOthers, canMembersEditInfo]);


//     // --- Modal and Actions ---

//     // Handle Updating Group Name via RPC
//     const handleUpdateName = async () => {
//         const newName = editingName.trim();
//         // Validate new name
//         if (!newName) {
//             Alert.alert("Invalid Name", "Group name cannot be empty.");
//             return; // Don't close modal yet
//         }
//          if (newName === currentGroupName) {
//               setIsEditModalVisible(false); // Close modal if name hasn't changed
//               return;
//          }
//         if (isUpdatingName || !groupId) return; // Prevent multiple updates or if groupId is missing

//         setIsUpdatingName(true);
//         try {
//             console.log(`[GroupChatScreen] Calling RPC 'rename_group_chat' for group ${groupId} to name "${newName}"`);
//             const { error: rpcError } = await supabase.rpc('rename_group_chat', {
//                 group_id_input: groupId,
//                 new_group_name: newName
//             });

//             if (rpcError) throw rpcError;

//             // Success: Name updated in DB. Real-time subscription will update the state (currentGroupName).
//             console.log("[GroupChatScreen] Group rename successful via RPC.");
//             setIsEditModalVisible(false); // Close modal on success

//         } catch (err: any) {
//             console.error("[GroupChatScreen] Error updating group name:", err);
//             Alert.alert("Error", `Could not update group name: ${err.message || 'Please try again.'}`);
//             // Keep modal open on error for user to retry or cancel
//         } finally {
//             setIsUpdatingName(false);
//              // Don't clear editingName here, let the modal close handle it or keep it for retry
//         }
//     };

//     // --- Effects ---

//     // Fetch initial data when the screen focuses or dependencies change
//     useFocusEffect(
//         useCallback(() => {
//             fetchInitialData(); // Call the function
//             // Return cleanup function if needed
//             return () => {
//                 // console.log("[GroupChatScreen] Screen blurred/unfocused");
//             };
//         // Add fetchInitialData to dependency array
//         }, [fetchInitialData])
//     );

//     // Scroll to end when messages change (with a small delay for layout)
//      useEffect(() => {
//          const timer = setTimeout(() => {
//              if (flatListRef.current && messages.length > 0 && sections.length) {
//                  const lastSection = sections.length - 1;
//                  const lastItem = sections[lastSection].data.length - 1;
//                  flatListRef.current.scrollToLocation({ sectionIndex: lastSection, itemIndex: lastItem, animated: true, viewPosition: 1 });
//              }
//          }, 100);
//          return () => clearTimeout(timer);
//      }, [messages]); // Trigger whenever messages array changes


//     // --- Render Logic ---

//     // Loading state
//     if (loading && messages.length === 0) { // Show loading only on initial load
//         return <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} /></View>;
//     }

//     // Error state (only if messages are empty)
//     if (loadError && messages.length === 0) {
//         // Customize error display based on type if needed
//         const displayError = loadError.includes('permission') || loadError.includes('session')
//             ? "Could not load messages due to a permission or session issue."
//             : loadError;
//         return <View style={styles.centered}><Text style={styles.errorText}>{displayError}</Text></View>;
//     }

//     // Guard against missing user/group info (should ideally not happen if navigation is correct)
//     if (!currentUserId || !groupId) {
//         return <View style={styles.centered}><Text style={styles.errorText}>Missing User or Group Information.</Text></View>;
//     }

//     // Edges for SafeAreaView - avoid keyboard on Android, use bottom inset on iOS
//     const safeAreaEdges: Edge[] = Platform.OS === 'ios' ? ['bottom'] : [];

//     return (
//         <SafeAreaView style={styles.safeArea} edges={safeAreaEdges}>
//             <KeyboardAvoidingView
//                 style={styles.keyboardAvoidingContainer}
//                 behavior={Platform.OS === "ios" ? "padding" : undefined} // Use "height" on Android if padding fails
//                 keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0} // Adjust offset as needed
//             >
//                 {/* Display Send Error Banner */}
//                 {sendError && (
//                      <View style={styles.errorBanner}>
//                          <Text style={styles.errorBannerText}>{sendError}</Text>
//                          <TouchableOpacity onPress={() => setSendError(null)} style={styles.errorBannerClose}>
//                              <Feather name="x" size={16} color="#B91C1C" />
//                          </TouchableOpacity>
//                      </View>
//                  )}

//                 {/* Message List */}
//                 <SectionList
//                     ref={flatListRef}
//                     sections={sections}
//                     style={styles.messageList}
//                     contentContainerStyle={styles.messageListContent}
//                     keyExtractor={(item) => item._id}
//                     renderItem={({ item }) => <GroupMessageBubble message={item} currentUserId={currentUserId} />}
//                     renderSectionHeader={({ section: { title } }) => (
//                         <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>{title}</Text></View>
//                     )}
//                     onContentSizeChange={() => {
//                         if (flatListRef.current && sections.length) {
//                             const si = sections.length - 1;
//                             const ii = sections[si].data.length - 1;
//                             flatListRef.current.scrollToLocation({ sectionIndex: si, itemIndex: ii, animated: false, viewPosition: 1 });
//                         }
//                     }}
//                     onLayout={() => {
//                         if (flatListRef.current && sections.length) {
//                             const si = sections.length - 1;
//                             const ii = sections[si].data.length - 1;
//                             flatListRef.current.scrollToLocation({ sectionIndex: si, itemIndex: ii, animated: false, viewPosition: 1 });
//                         }
//                     }}
//                     ListEmptyComponent={
//                         !loading ? (
//                             <View style={styles.centeredEmptyList}>
//                                 <Text style={styles.noMessagesText}>Be the first one to chat!</Text>
//                             </View>
//                          ) : null
//                     }
//                     stickySectionHeadersEnabled
//                     keyboardShouldPersistTaps="handled"
//                 />

//                 {/* Input Toolbar */}
//                 <View style={styles.inputToolbar}>
//                     <TextInput
//                         style={styles.textInput}
//                         value={inputText}
//                         onChangeText={setInputText}
//                         placeholder="Type a message..."
//                         placeholderTextColor="#9CA3AF"
//                         multiline // Allow multi-line input
//                         // Optional: Add max height for input
//                     />
//                     <TouchableOpacity
//                         style={[styles.sendButton, (!inputText.trim()) && styles.sendButtonDisabled]} // Disable if no text
//                         onPress={handleSendPress}
//                         disabled={!inputText.trim()} // Actual disabled state
//                     >
//                         <Feather name="send" size={20} color="#FFFFFF" />
//                     </TouchableOpacity>
//                 </View>
//             </KeyboardAvoidingView>

//             {/* Edit Group Name Modal */}
//             <Modal
//                 visible={isEditModalVisible}
//                 transparent={true}
//                 animationType="fade"
//                 onRequestClose={() => setIsEditModalVisible(false)} // Android back button
//             >
//                 <TouchableOpacity
//                     style={styles.modalBackdrop}
//                     activeOpacity={1}
//                     onPress={() => setIsEditModalVisible(false)} // Close on backdrop press
//                 />
//                 <View style={styles.modalContent}>
//                      <Text style={styles.modalTitle}>Edit Group Name</Text>
//                      <TextInput
//                          style={styles.modalInput}
//                          value={editingName}
//                          onChangeText={setEditingName}
//                          placeholder="Enter new group name"
//                          maxLength={50} // Match create screen limit
//                          autoFocus={true} // Focus input when modal opens
//                          returnKeyType="done"
//                          onSubmitEditing={handleUpdateName} // Allow saving via keyboard 'done'
//                      />
//                      <View style={styles.modalActions}>
//                          <TouchableOpacity
//                             style={[styles.modalButton, styles.modalButtonCancel]}
//                             onPress={() => setIsEditModalVisible(false)}
//                             disabled={isUpdatingName} // Disable cancel while saving
//                          >
//                             <Text style={styles.modalButtonTextCancel}>Cancel</Text>
//                          </TouchableOpacity>
//                          <TouchableOpacity
//                             style={[
//                                 styles.modalButton,
//                                 styles.modalButtonSave,
//                                 // Disable save if updating, no text, or name hasn't changed
//                                 (isUpdatingName || !editingName.trim() || editingName.trim() === currentGroupName) && styles.modalButtonDisabled
//                             ]}
//                             onPress={handleUpdateName}
//                             disabled={isUpdatingName || !editingName.trim() || editingName.trim() === currentGroupName}
//                          >
//                              {isUpdatingName
//                                 ? <ActivityIndicator color="#FFF" size="small" />
//                                 : <Text style={styles.modalButtonTextSave}>Save</Text>
//                              }
//                          </TouchableOpacity>
//                      </View>
//                  </View>
//             </Modal>
//         </SafeAreaView>
//     );
// };

// // --- Styles ---
// const styles = StyleSheet.create({
//     safeArea: {
//         flex: 1,
//         backgroundColor: '#FFFFFF', // Or your app's background color
//     },
//     keyboardAvoidingContainer: {
//         flex: 1,
//     },
//     centered: { // Centered container for loading/error states
//         flex: 1,
//         justifyContent: 'center',
//         alignItems: 'center',
//         padding: 20,
//         backgroundColor: '#F9FAFB', // Slightly off-white background
//     },
//      centeredEmptyList: { // Centered container for empty list message
//         flex: 1,
//         justifyContent: 'center',
//         alignItems: 'center',
//         paddingTop: 50, // Add some padding from the top
//         minHeight: 200, // Ensure it takes some space
//     },
//     errorText: {
//         color: '#DC2626', // Red-700
//         fontSize: 16,
//         textAlign: 'center',
//     },
//     errorBanner: {
//         backgroundColor: 'rgba(239, 68, 68, 0.1)', // Light red background
//         paddingVertical: 8,
//         paddingHorizontal: 15,
//         flexDirection: 'row',
//         justifyContent: 'space-between',
//         alignItems: 'center',
//         borderBottomWidth: 1,
//         borderBottomColor: 'rgba(239, 68, 68, 0.2)',
//     },
//     errorBannerText: {
//         color: '#B91C1C', // Red-800
//         fontSize: 13,
//         flexShrink: 1, // Allow text to wrap
//         marginRight: 10,
//     },
//     errorBannerClose: {
//         padding: 4,
//     },
//     noMessagesText: {
//         color: '#6B7280', // Gray-500
//         fontSize: 14,
//         textAlign: 'center',
//     },
//     messageList: {
//         flex: 1,
//         paddingHorizontal: 10,
//         backgroundColor: '#F9FAFB', // Match centered background
//     },
//     messageListContent: {
//         paddingVertical: 10,
//         flexGrow: 1, // Ensure content pushes input bar down
//         justifyContent: 'flex-end', // Messages start from bottom
//     },
//     messageRow: {
//         flexDirection: 'row',
//         marginVertical: 4,
//         alignItems: 'flex-end', // Align bubble bottom with avatar bottom (if shown)
//     },
//     messageRowSent: {
//         justifyContent: 'flex-end', // Align sent messages to the right
//         marginLeft: '20%', // Prevent full width overlap
//     },
//     messageRowReceived: {
//         justifyContent: 'flex-start', // Align received messages to the left
//         marginRight: '20%', // Prevent full width overlap
//     },
//     // senderAvatar: { // If showing avatars next to bubbles
//     //     width: 28,
//     //     height: 28,
//     //     borderRadius: 14,
//     //     marginHorizontal: 8,
//     //     marginBottom: 2, // Align slightly lower with bubble
//     // },
//     messageContentContainer: { // Container for name + bubble
//         maxWidth: '100%', // Ensure bubble doesn't exceed row width constraint
//     },
//     messageBubble: {
//         paddingVertical: 8,
//         paddingHorizontal: 14,
//         borderRadius: 18,
//         minWidth: 30, // Ensure very short messages have some width
//     },
//     messageBubbleSent: {
//         backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', // Primary color
//         borderBottomRightRadius: 4, // Tail effect
//         alignSelf: 'flex-end', // Align bubble itself to end
//     },
//     messageBubbleReceived: {
//         backgroundColor: '#E5E7EB', // Gray-200
//         borderBottomLeftRadius: 4, // Tail effect
//         alignSelf: 'flex-start', // Align bubble itself to start
//     },
//     messageTextSent: {
//         color: '#FFFFFF',
//         fontSize: 15,
//     },
//     messageTextReceived: {
//         color: '#1F2937', // Gray-800
//         fontSize: 15,
//     },
//     senderName: { // Name above received messages
//         fontSize: 11,
//         color: '#6B7280', // Gray-500
//         marginBottom: 3,
//         marginLeft: 5, // Indent name slightly
//         alignSelf: 'flex-start', // Ensure it stays left aligned
//     },
//     systemMessageContainer: { // Centered, styled system messages
//         alignSelf: 'center',
//         backgroundColor: 'rgba(107, 114, 128, 0.1)', // Gray-500 with alpha
//         borderRadius: 10,
//         paddingHorizontal: 10,
//         paddingVertical: 4,
//         marginVertical: 8,
//         maxWidth: '80%',
//     },
//     systemMessageText: {
//         fontSize: 11,
//         color: '#4B5563', // Gray-600
//         textAlign: 'center',
//         fontStyle: 'italic',
//     },
//     inputToolbar: {
//         flexDirection: 'row',
//         alignItems: 'flex-end', // Align items to bottom when input grows
//         paddingVertical: 8,
//         paddingHorizontal: 10,
//         borderTopWidth: 1,
//         borderTopColor: '#E5E7EB', // Gray-200
//         backgroundColor: '#FFFFFF', // White background
//         paddingBottom: Platform.OS === 'ios' ? 5 : 8, // Extra padding for iOS home indicator/keyboard spacing
//     },
//     textInput: {
//         flex: 1,
//         minHeight: 40, // Start height
//         maxHeight: 120, // Max height before scrolling
//         backgroundColor: '#F3F4F6', // Gray-100
//         borderRadius: 20, // Rounded input field
//         paddingHorizontal: 15,
//         paddingVertical: Platform.OS === 'ios' ? 10 : 8, // Adjust padding per platform
//         fontSize: 15,
//         marginRight: 10, // Space before send button
//         color: '#1F2937', // Dark text color
//     },
//     sendButton: {
//         backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6',
//         width: 40,
//         height: 40,
//         borderRadius: 20, // Circular button
//         justifyContent: 'center',
//         alignItems: 'center',
//         marginBottom: Platform.OS === 'ios' ? 0 : 1, // Align button slightly on Android
//     },
//     sendButtonDisabled: {
//         backgroundColor: '#9CA3AF', // Gray-400 for disabled state
//     },
//     headerTitleContainer: { // Touchable container for header image + title
//         flexDirection: 'row',
//         alignItems: 'center',
//         marginLeft: Platform.OS === 'ios' ? -10 : 0, // Adjust left margin for iOS default back button spacing
//         maxWidth: '80%', // Limit width to prevent overlap with right buttons
//     },
//     headerGroupImage: {
//         width: 32, // Smaller size for header
//         height: 32,
//         borderRadius: 16, // Circular
//         marginRight: 8,
//         backgroundColor: '#E5E7EB', // Placeholder background
//     },
//     headerTitleText: {
//         fontSize: 17,
//         fontWeight: '600',
//         color: '#1F2937', // Standard header title color
//         // No flex: 1 here, let it take needed space up to maxWidth
//     },
//     headerButtons: { // Container for right-side header buttons
//         flexDirection: 'row',
//         marginRight: Platform.OS === 'ios' ? 5 : 15, // Adjust right margin per platform
//     },
//     headerButton: { // Style for individual header icons
//         paddingHorizontal: 8,
//         paddingVertical: 5,
//     },
//     modalBackdrop: { // Semi-transparent background for modal
//         flex: 1,
//         backgroundColor: 'rgba(0,0,0,0.4)', // Dark overlay
//         justifyContent: 'center', // Center content vertically
//         alignItems: 'center', // Center content horizontally
//     },
//     modalContent: { // Styling for the modal popup itself
//         position: 'absolute', // Use absolute positioning to float over backdrop
//         // Center the modal (adjust percentages as needed)
//         top: '30%',
//         left: '10%',
//         right: '10%',
//         backgroundColor: 'white',
//         borderRadius: 12,
//         padding: 25,
//         shadowColor: "#000",
//         shadowOffset: { width: 0, height: 2 },
//         shadowOpacity: 0.25,
//         shadowRadius: 4,
//         elevation: 5, // Elevation for Android shadow
//         width: '80%', // Explicit width
//         minHeight: 200, // Ensure minimum height
//     },
//     modalTitle: {
//         fontSize: 18,
//         fontWeight: '600',
//         marginBottom: 20,
//         textAlign: 'center',
//         color: '#1F2937',
//     },
//     modalInput: {
//         borderWidth: 1,
//         borderColor: '#D1D5DB', // Gray-300
//         borderRadius: 6,
//         paddingHorizontal: 12,
//         paddingVertical: 12,
//         fontSize: 16,
//         marginBottom: 25,
//     },
//     modalActions: { // Container for modal buttons
//         flexDirection: 'row',
//         justifyContent: 'space-between', // Space out cancel/save buttons
//     },
//     modalButton: { // Base style for modal buttons
//         paddingVertical: 10,
//         paddingHorizontal: 20,
//         borderRadius: 6,
//         alignItems: 'center',
//         justifyContent: 'center',
//         minWidth: 90, // Ensure buttons have minimum width
//     },
//     modalButtonCancel: {
//         backgroundColor: '#E5E7EB', // Light gray background
//     },
//     modalButtonSave: {
//         backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', // Primary color
//     },
//     modalButtonDisabled: { // Style for disabled save button
//         backgroundColor: '#A5B4FC', // Lighter primary color
//     },
//     modalButtonTextCancel: {
//         color: '#4B5563', // Gray-600
//         fontWeight: '500',
//     },
//     modalButtonTextSave: {
//         color: 'white',
//         fontWeight: '600',
//     },
//     timeText: {
//         fontSize: 11,
//         color: '#9CA3AF',
//         marginTop: 4,
//         alignSelf: 'flex-end',
//     },
//     sectionHeader: { alignItems: 'center', marginVertical: 10 },
//     sectionHeaderText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
// });

// export default GroupChatScreen;
// src/screens/GroupChatScreen.tsx
// --- ALL IMPORTS ---
// src/screens/GroupChatScreen.tsx
// --- ALL IMPORTS ---
// src/screens/GroupChatScreen.tsx
// --- ALL IMPORTS ---
// src/screens/GroupChatScreen.tsx
// --- ALL IMPORTS ---
// src/screens/GroupChatScreen.tsx
// --- ALL IMPORTS ---
// src/screens/GroupChatScreen.tsx
// --- ALL IMPORTS ---

// src/screens/GroupChatScreen.tsx
// --- ALL IMPORTS ---
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

// --- Adjust Paths ---
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { RootStackParamList } from "@/navigation/AppNavigator"; // Adjust path
import { APP_CONSTANTS } from '@/config/constants';               // Adjust path
// --- End Adjust Paths ---

// Helper to format timestamps safely
const formatTime = (date: Date | string | number): string => {
    try {
        const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
        if (!dateObj || isNaN(dateObj.getTime())) return '--:--';
        return dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch (e) { console.warn("Fmt err:", date, e); return '--:--'; }
};

// --- Type Definitions ---
type GroupChatScreenRouteProp = RouteProp<RootStackParamList, 'GroupChatScreen'>;
type GroupChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GroupChatScreen'>;
interface DbGroupMessage { id: string; created_at: string; sender_id: string; group_id: string; content: string | null; image_url: string | null; is_system_message: boolean; }
interface ChatMessage { _id: string; text: string; createdAt: Date; user: { _id: string; name?: string; avatar?: string; }; image?: string | null; isSystemMessage: boolean; }
interface UserProfileInfo { user_id: string; first_name: string | null; last_name: string | null; profile_picture: string | null; }
interface DbGroupChat { id: string; group_name: string; group_image: string | null; can_members_add_others?: boolean; can_members_edit_info?: boolean; }

// --- Constants and Cache ---
const userProfileCache: Record<string, { name?: string; avatar?: string }> = {};
const DEFAULT_PROFILE_PIC = APP_CONSTANTS?.DEFAULT_PROFILE_PIC || 'https://via.placeholder.com/40';
const DEFAULT_GROUP_PIC = 'https://placehold.co/40x40/e2e8f0/64748b?text=G';

// --- GroupMessageBubble Component ---
interface GroupMessageBubbleProps { message: ChatMessage; currentUserId: string | undefined; }
const GroupMessageBubble: React.FC<GroupMessageBubbleProps> = React.memo(({ message, currentUserId }) => {
    const isCurrentUser = message.user._id === currentUserId;
    const senderName = message.user.name;

    // System Message
    if (message.isSystemMessage) {
        return ( <View style={styles.systemMessageContainer}><Text style={styles.systemMessageText}>{message.text}</Text></View> );
    }

    // Image Message
    if (message.image) {
        return (
            <View style={[styles.messageRow, isCurrentUser ? styles.messageRowSent : styles.messageRowReceived]}>
                <View style={styles.messageContentContainer}>
                    {!isCurrentUser && senderName && senderName !== 'User' && ( <Text style={styles.senderName}>{senderName}</Text> )}
                    <TouchableOpacity style={[ styles.messageBubble, styles.imageBubble, isCurrentUser ? styles.messageBubbleSentImage : styles.messageBubbleReceivedImage ]} activeOpacity={0.8} /* onPress={()=> viewImage(message.image)} */>
                         <Image
                            source={{ uri: message.image }}
                            style={styles.chatImage}
                            resizeMode="cover"
                            onError={(e) => console.warn(`Failed load chat image ${message._id}: ${message.image}`, e.nativeEvent.error)}
                         />
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
    const { groupId } = route.params;

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

    // Memoized sections
    const sections = useMemo(() => { const groups: Record<string, ChatMessage[]> = {}; messages.forEach(msg => { const dateKey = msg.createdAt.toDateString(); if (!groups[dateKey]) groups[dateKey] = []; groups[dateKey].push(msg); }); const sortedKeys = Object.keys(groups).sort((a,b) => new Date(a).getTime() - new Date(b).getTime()); const today = new Date(); today.setHours(0,0,0,0); const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1); const oneWeekAgo = new Date(today); oneWeekAgo.setDate(today.getDate() - 7); return sortedKeys.map(dateKey => { const date = new Date(dateKey); date.setHours(0,0,0,0); let title = 'Older'; if (date.getTime() === today.getTime()) title = 'Today'; else if (date.getTime() === yesterday.getTime()) title = 'Yesterday'; else if (date > oneWeekAgo) title = date.toLocaleDateString(undefined, { weekday:'long' }); else title = date.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' }); return { title, data: groups[dateKey] }; }); }, [messages]);

    // Map DB Message to UI
    const mapDbMessageToChatMessage = useCallback((dbMessage: DbGroupMessage, profilesMap: Map<string, UserProfileInfo>): ChatMessage => { let senderName = 'User'; let senderAvatar: string | undefined = undefined; if (dbMessage.sender_id) { const pfc = userProfileCache[dbMessage.sender_id]; if (pfc) { senderName = pfc.name || 'User'; senderAvatar = pfc.avatar; } else { const pfm = profilesMap.get(dbMessage.sender_id); if (pfm) { senderName = `${pfm.first_name||''} ${pfm.last_name||''}`.trim()||'User'; senderAvatar = pfm.profile_picture||undefined; if (!dbMessage.is_system_message) userProfileCache[dbMessage.sender_id]={name: senderName, avatar: senderAvatar}; } } } if (currentUserId && !userProfileCache[currentUserId]) userProfileCache[currentUserId] = { name: 'You', avatar: undefined }; return { _id: dbMessage.id, text: dbMessage.content ?? '', createdAt: new Date(dbMessage.created_at), user: { _id: dbMessage.sender_id || 'system', name: dbMessage.sender_id === currentUserId ? 'You' : senderName, avatar: dbMessage.sender_id === currentUserId ? undefined : senderAvatar, }, image: dbMessage.image_url, isSystemMessage: dbMessage.is_system_message }; }, [currentUserId]);

    // Fetch Initial Data
    const fetchInitialData = useCallback(async () => { if (!currentUserId || !groupId) { setLoadError("Auth/Group ID missing."); setLoading(false); return; } setLoading(true); setLoadError(null); setIsCurrentUserAdmin(false); setCanMembersAddOthers(false); setCanMembersEditInfo(false); try { const { data: groupInfoData, error: groupInfoError } = await supabase.rpc('get_group_info', { group_id_input: groupId }); if (groupInfoError) throw groupInfoError; if (!groupInfoData?.group_details || !groupInfoData?.participants) throw new Error("Incomplete group data."); const groupDetails = groupInfoData.group_details; const participantsRaw: { user_id: string, is_admin: boolean }[] = groupInfoData.participants; const currentUserParticipant = participantsRaw.find(p => p.user_id === currentUserId); setIsCurrentUserAdmin(currentUserParticipant?.is_admin ?? false); setCanMembersAddOthers(groupDetails.can_members_add_others ?? false); setCanMembersEditInfo(groupDetails.can_members_edit_info ?? false); setCurrentGroupName(groupDetails.group_name); setCurrentGroupImage(groupDetails.group_image ?? null); const { data: messagesData, error: messagesError } = await supabase.from('group_chat_messages').select('id, created_at, sender_id, group_id, content, image_url, is_system_message').eq('group_id', groupId).order('created_at', { ascending: true }); if (messagesError) throw messagesError; if (!messagesData || messagesData.length === 0) { setMessages([]); } else { const senderIds = Array.from(new Set(messagesData.filter(msg => !msg.is_system_message && msg.sender_id).map(msg => msg.sender_id))); const profilesMap = new Map<string, UserProfileInfo>(); if (senderIds.length > 0) { const idsToFetch = senderIds.filter(id => !userProfileCache[id]); if (idsToFetch.length > 0) { const { data: profilesData, error: profilesError } = await supabase.from('music_lover_profiles').select('user_id, first_name, last_name, profile_picture').in('user_id', idsToFetch); if (profilesError) { console.error("Err fetch profiles:", profilesError); } else if (profilesData) { profilesData.forEach((p: UserProfileInfo) => { profilesMap.set(p.user_id, p); const n = `${p.first_name||''} ${p.last_name||''}`.trim()||'User'; const a = p.profile_picture||undefined; userProfileCache[p.user_id] = { name: n, avatar: a }; }); } } senderIds.forEach(id => { if (userProfileCache[id] && !profilesMap.has(id)) { profilesMap.set(id, { user_id: id, first_name: userProfileCache[id].name?.split(' ')[0]||null, last_name: userProfileCache[id].name?.split(' ')[1]||null, profile_picture: userProfileCache[id].avatar||null }); } }); } if (currentUserId && !userProfileCache[currentUserId]) userProfileCache[currentUserId] = { name: 'You' }; const mappedMessages = messagesData.map(dbMsg => mapDbMessageToChatMessage(dbMsg as DbGroupMessage, profilesMap)); setMessages(mappedMessages); } } catch (err: any) { console.error("Error fetching initial data:", err); if (err.message?.includes("User is not a member")) { Alert.alert("Access Denied", "Not member.", [{ text: "OK", onPress: () => navigation.goBack() }]); setLoadError("Not a member."); } else { setLoadError(`Load fail: ${err.message || 'Unknown'}`); } setMessages([]); setIsCurrentUserAdmin(false); setCanMembersAddOthers(false); setCanMembersEditInfo(false); } finally { setLoading(false); } }, [currentUserId, groupId, navigation, mapDbMessageToChatMessage]);

    // Send Text Message
    const sendTextMessage = useCallback(async (text: string) => { if (!currentUserId || !groupId || !text.trim() || isUploading) return; const trimmedText = text.trim(); const tempId = `temp_${Date.now()}_txt`; const currentUserProfile = userProfileCache[currentUserId] || { name: 'You' }; const optimisticMessage: ChatMessage = { _id: tempId, text: trimmedText, createdAt: new Date(), user: { _id: currentUserId, name: currentUserProfile.name, avatar: currentUserProfile.avatar }, image: null, isSystemMessage: false }; setMessages(previousMessages => [...previousMessages, optimisticMessage]); setInputText(''); setSendError(null); Keyboard.dismiss(); try { const { data: insertedData, error: insertError } = await supabase.from('group_chat_messages').insert({ sender_id: currentUserId, group_id: groupId, content: trimmedText, image_url: null, is_system_message: false }).select('id, created_at').single(); if (insertError) throw insertError; if (!insertedData) throw new Error("Text send no confirmation."); setMessages(prevMessages => prevMessages.map(msg => msg._id === tempId ? { ...optimisticMessage, _id: insertedData.id, createdAt: new Date(insertedData.created_at) } : msg)); if (sendError) setSendError(null); } catch (err: any) { console.error("Error sending text:", err); setSendError(`Send fail: ${err.message}`); setMessages(prevMessages => prevMessages.filter(msg => msg._id !== tempId)); setInputText(trimmedText); } }, [currentUserId, groupId, sendError, isUploading]);
    const handleSendPress = () => { sendTextMessage(inputText); };

    // Pick and Send Image
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
                base64: Platform.OS === 'web', // Request base64 ONLY for web
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
        console.log(`[pickAndSendImage] Processing asset. URI: ${imageUri.substring(0, 100)}...`);
        console.log(`[pickAndSendImage] Asset details:`, JSON.stringify(selectedAsset, null, 2)); // Log all asset details

        try {
            let fileBody: Blob | ArrayBuffer | null = null; // Initialize as null
            let contentType: string = 'image/jpeg'; // Default
            let fileExt: string = 'jpg';
            let fileSize: number = 0;

            if (Platform.OS === 'web') {
                console.log('[pickAndSendImage] Platform: Web');
                if (!selectedAsset.base64) {
                    // Try fetching if base64 is missing (might work for some web URIs)
                    console.warn('[pickAndSendImage] Base64 missing on web asset, attempting fetch...');
                    try {
                        const response = await fetch(imageUri);
                        console.log(`[Web Fetch] Status: ${response.status}, OK: ${response.ok}`);
                        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
                        fileBody = await response.arrayBuffer(); // Get ArrayBuffer directly
                        fileSize = fileBody.byteLength;
                        contentType = response.headers.get('content-type') || selectedAsset.mimeType || 'image/jpeg';
                        fileExt = contentType.split('/')[1]?.split('+')[0] || 'jpg'; // Handle svg+xml etc.
                        console.log(`[Web Fetch] Success. Size: ${fileSize}, Type: ${contentType}`);
                    } catch(fetchErr: any) {
                         console.error("[Web Fetch] Fetch failed:", fetchErr);
                         throw new Error(`Web fetch failed & Base64 missing. URI: ${imageUri.substring(0,50)}...`);
                    }

                } else {
                    console.log(`[Web Upload] Base64 length: ${selectedAsset.base64.length}`);
                    if (selectedAsset.base64.length < 10) throw new Error("Base64 string seems too short."); // Basic sanity check
                    try {
                        fileBody = decode(selectedAsset.base64); // Decode base64 to ArrayBuffer
                        fileSize = fileBody.byteLength;
                        contentType = selectedAsset.mimeType || 'image/jpeg';
                        fileExt = contentType.split('/')[1]?.split('+')[0] || 'jpg';
                        console.log(`[Web Base64 Decode] Success. Size: ${fileSize} bytes, Type: ${contentType}`);
                    } catch (decodeError: any) {
                         console.error("[Web Base64 Decode] Failed:", decodeError);
                         throw new Error(`Failed to decode base64: ${decodeError.message}`);
                    }
                }
            } else {
                // Native Platform
                console.log('[pickAndSendImage] Platform: Native');
                try {
                    console.log(`[Native Upload] Attempting fetch for URI: ${imageUri.substring(0,100)}...`);
                    const response = await fetch(imageUri);
                    console.log(`[Native Upload] Fetch Status: ${response.status}, OK: ${response.ok}`);
                    if (!response.ok) {
                        let errorText = response.statusText;
                        try { errorText = await response.text(); } catch (_) {}
                        throw new Error(`Fetch failed: ${response.status} ${errorText.substring(0,100)}`);
                    }
                    fileBody = await response.blob();
                    fileSize = fileBody.size;
                    contentType = fileBody.type || selectedAsset.mimeType || 'image/jpeg'; // Use blob type first
                    fileExt = contentType.split('/')[1]?.split('+')[0] || 'jpg';
                    console.log(`[Native Upload] Prepared Blob size: ${fileSize} bytes, Type: ${contentType}`);
                } catch (fetchError: any) {
                    console.error("[Native Upload] Fetch/Blob failed:", fetchError);
                    throw new Error(`Failed to get image data from URI: ${fetchError.message}`);
                }
            }

            // *** CRITICAL CHECK: Ensure file body was created and has size ***
            if (!fileBody) {
                throw new Error("File body (Blob/ArrayBuffer) could not be created.");
            }
            if (fileSize === 0) {
                throw new Error(`Prepared image file is empty (0 bytes). URI: ${imageUri.substring(0,50)}...`);
            }
            // *** END CHECK ***

            const fileName = `${currentUserId}-${Date.now()}.${fileExt}`;
            // Ensure groupId is valid before creating path
            if (!groupId || typeof groupId !== 'string' || groupId.trim() === '') {
                throw new Error(`Invalid groupId for storage path: ${groupId}`);
            }
            const filePath = `${groupId}/${currentUserId}/${fileName}`;

            console.log(`Uploading to Storage path: ${filePath}, Size: ${fileSize} bytes, ContentType: ${contentType}`);
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('group-chat-images')
                .upload(filePath, fileBody, { // Pass ArrayBuffer for web, Blob for native
                    cacheControl: '3600',
                    upsert: false, // Important: Use false if you want to avoid overwriting identically named files quickly
                    contentType: contentType,
                 });

            if (uploadError) {
                console.error('[Supabase Upload Error Details]:', JSON.stringify(uploadError, null, 2));
                // Check for specific Supabase error messages if possible
                if (uploadError.message?.includes('Bucket not found')) {
                     throw new Error("Storage Error: Bucket 'group-chat-images' not found.");
                } else if (uploadError.message?.includes('policy')) {
                    throw new Error("Storage Error: Permission denied by storage policy.");
                }
                throw uploadError; // Re-throw generic Supabase error
            }
            if (!uploadData?.path) {
                console.error('[Supabase Upload Success but No Path]:', uploadData);
                throw new Error("Storage upload succeeded but path is missing in response.");
            }

            console.log(`Storage upload successful, path: ${uploadData.path}`);
            const { data: urlData } = supabase.storage.from('group-chat-images').getPublicUrl(uploadData.path);
            if (!urlData?.publicUrl) {
                console.error('[Supabase Get URL Failed]: urlData is null or missing publicUrl');
                throw new Error("Failed to get public URL for uploaded image.");
            }
            const imageUrl = urlData.publicUrl;
            console.log(`Public URL obtained: ${imageUrl}`);

            // Insert DB record
            console.log(`Inserting image message record into DB.`);
            const { data: insertedData, error: insertError } = await supabase
                .from('group_chat_messages')
                .insert({
                    sender_id: currentUserId,
                    group_id: groupId,
                    content: null, // Explicitly null for image-only
                    image_url: imageUrl,
                    is_system_message: false
                 })
                .select('id') // Select only ID is enough to confirm insert
                .single();

             if (insertError) {
                 console.error('[Supabase DB Insert Error]:', JSON.stringify(insertError, null, 2));
                 // Attempt to delete the orphaned storage object if DB insert fails
                 console.warn(`DB insert failed for ${filePath}, attempting to delete from storage...`);
                 await supabase.storage.from('group-chat-images').remove([filePath]);
                 throw insertError; // Re-throw DB error
             }
             if (!insertedData) {
                 console.error('[Supabase DB Insert Failed]: No data returned after insert.');
                  console.warn(`DB insert possibly failed for ${filePath}, attempting to delete from storage...`);
                 await supabase.storage.from('group-chat-images').remove([filePath]);
                 throw new Error("Image message DB insert failed (no data returned).");
             }

             console.log(`Image message sent and DB record created successfully (ID: ${insertedData.id}).`);

        } catch (err: any) {
            console.error("[pickAndSendImage] Overall Error:", err);
            let displayError = `Failed send image: ${err.message || 'Unknown error'}`;
            // Add more specific messages based on error strings checked earlier
            if(err.message?.includes('empty')){displayError="Failed send image: File empty.";}
            else if(err.message?.includes('Storage')||err.message?.includes('Upload')){displayError=`Failed send image: Storage error. ${err.message}`;}
            else if(err.message?.includes('constraint')||err.code==='23502'){displayError=`Failed send image: DB error. ${err.message}`;}
            else if(err.message?.includes('Fetch fail')||err.message?.includes('Network request fail')){displayError=`Failed send image: Network error accessing image. ${err.message}`;}
            else if(err.message?.includes('Permission denied by storage policy')){displayError="Upload Permission Denied. Check Storage Policies.";}
            else if(err.message?.includes('Bucket not found')){displayError="Storage Error: Image bucket missing.";}

            setSendError(displayError);
            Alert.alert("Upload Failed", displayError);
        } finally {
            setIsUploading(false); // Ensure loading indicator stops
        }
    };

    // Real-time Subscriptions
    useEffect(() => { if (!groupId || !currentUserId) return; const messageChannel = supabase.channel(`group_chat_messages_${groupId}`).on<DbGroupMessage>( 'postgres_changes',{ event: 'INSERT', schema: 'public', table: 'group_chat_messages', filter: `group_id=eq.${groupId}` }, async (payload) => { const newMessageDb = payload.new; if (newMessageDb.sender_id === currentUserId && !newMessageDb.is_system_message) return; const rtProfilesMap = new Map<string, UserProfileInfo>(); if (newMessageDb.sender_id && !newMessageDb.is_system_message && !userProfileCache[newMessageDb.sender_id]) { try { const { data: p } = await supabase.from('music_lover_profiles').select('user_id, first_name, last_name, profile_picture').eq('user_id', newMessageDb.sender_id).maybeSingle(); if (p) { rtProfilesMap.set(p.user_id, p); const n = `${p.first_name||''} ${p.last_name||''}`.trim()||'User'; const a = p.profile_picture||undefined; userProfileCache[p.user_id]={name:n,avatar:a}; } } catch (err) { console.error(`RT Profile Fetch Err ${newMessageDb.sender_id}`, err); } } const receivedMessage = mapDbMessageToChatMessage(newMessageDb, rtProfilesMap); setMessages(prev => prev.some(msg => msg._id === receivedMessage._id) ? prev : [...prev, receivedMessage]); }).subscribe(); const infoChannel = supabase.channel(`group_info_${groupId}`).on<DbGroupChat>('postgres_changes',{ event: 'UPDATE', schema: 'public', table: 'group_chats', filter: `id=eq.${groupId}` },(payload) => { const d=payload.new; if(d.group_name!==currentGroupName){setCurrentGroupName(d.group_name);} if(d.group_image!==currentGroupImage){setCurrentGroupImage(d.group_image);} if(d.can_members_add_others!==undefined){setCanMembersAddOthers(d.can_members_add_others);} if(d.can_members_edit_info!==undefined){setCanMembersEditInfo(d.can_members_edit_info);} }).on<any>('postgres_changes',{ event: 'DELETE', schema: 'public', table: 'group_chats', filter: `id=eq.${groupId}` },(payload) => { Alert.alert("Group Deleted", "This group no longer exists.", [{ text: "OK", onPress: () => navigation.popToTop() }]); }).subscribe(); return () => { supabase.removeChannel(messageChannel); supabase.removeChannel(infoChannel); }; }, [groupId, currentUserId, mapDbMessageToChatMessage, navigation, currentGroupName, currentGroupImage, canMembersAddOthers, canMembersEditInfo]);

    // Navigation and Header
    const navigateToGroupInfo = () => { if (!groupId || !currentGroupName) return; navigation.navigate('GroupInfoScreen', { groupId, groupName: currentGroupName ?? 'Group', groupImage: currentGroupImage ?? null }); };
    useEffect(() => { const canAdd = isCurrentUserAdmin || canMembersAddOthers; const canEdit = isCurrentUserAdmin || canMembersEditInfo; const headerColor = APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'; const disabledColor = APP_CONSTANTS?.COLORS?.DISABLED || '#D1D5DB'; navigation.setOptions({ headerTitle: () => ( <TouchableOpacity style={styles.headerTitleContainer} onPress={navigateToGroupInfo} activeOpacity={0.8}><Image source={{uri:currentGroupImage??DEFAULT_GROUP_PIC}} style={styles.headerGroupImage}/><Text style={styles.headerTitleText} numberOfLines={1}>{currentGroupName}</Text></TouchableOpacity>), headerRight: () => ( <View style={styles.headerButtons}><TouchableOpacity onPress={()=>{if(canAdd)navigation.navigate('AddGroupMembersScreen',{groupId,groupName:currentGroupName});else Alert.alert("Denied","Admin only");}} style={styles.headerButton} disabled={!canAdd}><Feather name="user-plus" size={22} color={canAdd?headerColor:disabledColor}/></TouchableOpacity><TouchableOpacity onPress={()=>{if(canEdit){setEditingName(currentGroupName??'');setIsEditModalVisible(true);}else Alert.alert("Denied","Admin only");}} style={styles.headerButton} disabled={!canEdit}><Feather name="edit-2" size={22} color={canEdit?headerColor:disabledColor}/></TouchableOpacity></View>), headerBackTitleVisible: false, headerShown: true }); }, [navigation, currentGroupName, currentGroupImage, groupId, isCurrentUserAdmin, canMembersAddOthers, canMembersEditInfo]);

    // Modal and Actions
    const handleUpdateName = async () => { const n=editingName.trim();if(!n||n===currentGroupName||isUpdatingName||!groupId){setIsEditModalVisible(false);return;}setIsUpdatingName(true); try{const{error}=await supabase.rpc('rename_group_chat',{group_id_input:groupId,new_group_name:n});if(error)throw error;setIsEditModalVisible(false);}catch(e:any){Alert.alert("Error",`Update fail: ${e.message}`);}finally{setIsUpdatingName(false);}};

    // Effects
    useFocusEffect( useCallback(() => { fetchInitialData(); return () => {}; }, [fetchInitialData]) );

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
                    keyExtractor={(item, index) => item._id + index}
                    renderItem={({ item }) => <GroupMessageBubble message={item} currentUserId={currentUserId} />}
                    renderSectionHeader={({ section: { title } }) => ( <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>{title}</Text></View> )}
                    ListEmptyComponent={ !loading ? ( <View style={styles.centeredEmptyList}><Text style={styles.noMessagesText}>Be the first one to chat!</Text></View> ) : null }
                    stickySectionHeadersEnabled
                    keyboardShouldPersistTaps="handled"
                    maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 10 }}
                    removeClippedSubviews={true}
                    initialNumToRender={15}
                    maxToRenderPerBatch={10}
                    windowSize={11}
                />

                {/* Input Toolbar */}
                <View style={styles.inputToolbar}>
                    <TouchableOpacity style={styles.attachButton} onPress={pickAndSendImage} disabled={isUploading} >
                         {isUploading ? <ActivityIndicator size="small" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} /> : <Feather name="paperclip" size={22} color="#52525b" /> }
                    </TouchableOpacity>
                    <TextInput style={styles.textInput} value={inputText} onChangeText={setInputText} placeholder="Type a message..." placeholderTextColor="#9CA3AF" multiline />
                    <TouchableOpacity style={[styles.sendButton, (!inputText.trim()) && styles.sendButtonDisabled]} onPress={handleSendPress} disabled={!inputText.trim() || isUploading} >
                        <Feather name="send" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Edit Group Name Modal */}
             <Modal visible={isEditModalVisible} transparent={true} animationType="fade" onRequestClose={() => setIsEditModalVisible(false)}>
                 <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setIsEditModalVisible(false)} />
                 <View style={styles.modalContent}><Text style={styles.modalTitle}>Edit Group Name</Text><TextInput style={styles.modalInput} value={editingName} onChangeText={setEditingName} placeholder="Enter new group name" maxLength={50} autoFocus={true} returnKeyType="done" onSubmitEditing={handleUpdateName} /><View style={styles.modalActions}><TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => setIsEditModalVisible(false)} disabled={isUpdatingName}><Text style={styles.modalButtonTextCancel}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[ styles.modalButton, styles.modalButtonSave, (isUpdatingName || !editingName.trim() || editingName.trim() === currentGroupName) && styles.modalButtonDisabled ]} onPress={handleUpdateName} disabled={isUpdatingName || !editingName.trim() || editingName.trim() === currentGroupName}>{isUpdatingName ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.modalButtonTextSave}>Save</Text>}</TouchableOpacity></View></View>
             </Modal>
        </SafeAreaView>
    );
};


// --- Styles ---
// ... (All the imports, helpers, types, constants, components, state, functions, useEffects, render logic from the PREVIOUS correct answer) ...

// --- Styles ---
const styles = StyleSheet.create({
    // ... (ALL the style definitions from safeArea down to modalButtonSave from the previous answer)
    safeArea: { flex: 1, backgroundColor: '#FFFFFF', },
    keyboardAvoidingContainer: { flex: 1, },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F9FAFB', },
    centeredEmptyList: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50, minHeight: 200, },
    errorText: { color: '#DC2626', fontSize: 16, textAlign: 'center', },
    errorBanner: { backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingVertical: 8, paddingHorizontal: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(239, 68, 68, 0.2)', },
    errorBannerText: { color: '#B91C1C', fontSize: 13, flexShrink: 1, marginRight: 10, },
    errorBannerClose: { padding: 4, },
    noMessagesText: { color: '#6B7280', fontSize: 14, textAlign: 'center', },
    messageList: { flex: 1, paddingHorizontal: 10, backgroundColor: '#F9FAFB', },
    messageListContent: { paddingVertical: 10, flexGrow: 1, justifyContent: 'flex-end', },
    messageRow: { flexDirection: 'row', marginVertical: 4, alignItems: 'flex-end', },
    messageRowSent: { justifyContent: 'flex-end', marginLeft: '20%', },
    messageRowReceived: { justifyContent: 'flex-start', marginRight: '20%', },
    messageContentContainer: { maxWidth: '100%', },
    messageBubble: { borderRadius: 18, minWidth: 30, marginBottom: 2, },
    messageBubbleSentText: { backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', borderBottomRightRadius: 4, alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'flex-end', flexWrap:'wrap', },
    messageBubbleReceivedText: { backgroundColor: '#E5E7EB', borderBottomLeftRadius: 4, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'flex-end', flexWrap:'wrap', },
    imageBubble: { borderRadius: 15, overflow: 'hidden', padding: 0, backgroundColor: '#E5E7EB', alignSelf: 'flex-start', maxWidth: 210, maxHeight: 210, borderWidth: 1, borderColor: '#d1d5db', },
    messageBubbleSentImage: { alignSelf: 'flex-end', backgroundColor: 'transparent', borderBottomRightRadius: 4, },
    messageBubbleReceivedImage: { alignSelf: 'flex-start', backgroundColor: 'transparent', borderBottomLeftRadius: 4, },
    chatImage: { width: 200, height: 200, borderRadius: 14, },
    messageText: { fontSize: 15, lineHeight: 21, flexShrink: 1, },
    messageTextSent: { color: '#FFFFFF', },
    messageTextReceived: { color: '#1F2937', },
    senderName: { fontSize: 11, color: '#6B7280', marginBottom: 3, marginLeft: 5, alignSelf: 'flex-start', },
    systemMessageContainer: { alignSelf: 'center', backgroundColor: 'rgba(107, 114, 128, 0.1)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginVertical: 8, maxWidth: '80%', },
    systemMessageText: { fontSize: 11, color: '#4B5563', textAlign: 'center', fontStyle: 'italic', },
    timeText: { fontSize: 10, },
    timeTextInsideBubble: { marginLeft: 8, alignSelf: 'flex-end', lineHeight: 15, },
    timeTextInsideSentBubble: { color: 'rgba(255, 255, 255, 0.7)' },
    timeTextInsideReceivedBubble: { color: '#6B7280'},
    timeTextBelowBubble: { marginTop: 2, paddingHorizontal: 5, color: '#9CA3AF', },
    timeTextSent: { alignSelf: 'flex-end', marginRight: 5 },
    timeTextReceived: { alignSelf: 'flex-start', marginLeft: 0 },
    sectionHeader: { alignSelf: 'center', marginVertical: 10, },
    sectionHeaderText: { fontSize: 11, fontWeight: '500', color: '#6B7280', backgroundColor: 'rgba(229, 231, 235, 0.7)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden'},
    inputToolbar: { flexDirection: 'row', alignItems: 'flex-end', paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF', paddingBottom: Platform.OS === 'ios' ? 5 : 8, },
    attachButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 5, marginBottom: Platform.OS === 'ios' ? 0 : 1, },
    textInput: { flex: 1, minHeight: 40, maxHeight: 120, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 15, marginRight: 10, color: '#1F2937', textAlignVertical: 'center', },
    sendButton: { backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: Platform.OS === 'ios' ? 0 : 1, },
    sendButtonDisabled: { backgroundColor: '#9CA3AF', },
    headerTitleContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: Platform.OS === 'ios' ? -10 : 0, maxWidth: '75%', },
    headerGroupImage: { width: 32, height: 32, borderRadius: 16, marginRight: 8, backgroundColor: '#E5E7EB', },
    headerTitleText: { fontSize: 17, fontWeight: '600', color: '#1F2937', },
    headerButtons: { flexDirection: 'row', marginRight: Platform.OS === 'ios' ? 5 : 10, },
    headerButton: { paddingHorizontal: 6, paddingVertical: 5, },
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
// --------- THE FIX IS HERE ----------
}); // <-- Correctly closes StyleSheet.create({}) call
// ------------------------------------



export default GroupChatScreen;