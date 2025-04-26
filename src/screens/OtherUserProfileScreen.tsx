// screens/OtherUserProfileScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
    ActivityIndicator, Alert, Platform, Modal, TextInput
} from 'react-native';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '@/lib/supabase';
import { useAuth, MusicLoverProfile, MusicLoverBio } from '@/hooks/useAuth';
import { APP_CONSTANTS } from '@/config/constants';
import type { RootStackParamList, MainStackParamList } from '@/navigation/AppNavigator';

// --- Reusable Components ---
const DEFAULT_PROFILE_PIC = APP_CONSTANTS.DEFAULT_PROFILE_PIC;
interface SeparatorProps { vertical?: boolean; style?: object; }
const Separator: React.FC<SeparatorProps> = ({ vertical = false, style = {} }) => ( <View style={[ profileStyles.separator, vertical ? { height: '60%', width: 1 } : { height: 1, width: "100%" }, style ]} /> );

interface ProfileSectionProps { title: string; icon: React.ComponentProps<typeof Feather>['name']; children: React.ReactNode; hasData?: boolean; }
const ProfileSection: React.FC<ProfileSectionProps> = ({ title, icon, children, hasData = true }) => (
    <View style={profileStyles.section}>
        <View style={profileStyles.sectionHeader}>
            <View style={profileStyles.sectionTitleContainer}>
                <Feather name={icon} size={18} color={APP_CONSTANTS.COLORS.PRIMARY} style={profileStyles.sectionIcon} />
                <Text style={profileStyles.sectionTitle}>{title}</Text>
            </View>
        </View>
        {hasData ? children : <Text style={profileStyles.dataMissingText}>Nothing here yet!</Text>}
    </View>
);

const bioDetailLabels: Record<keyof MusicLoverBio, string> = { firstSong: "First Concert / Memory", goToSong: "Go-To Song Right Now", mustListenAlbum: "Must-Listen Album", dreamConcert: "Dream Concert Lineup", musicTaste: "Music Taste Description", };
// --- End Reusable Components ---

interface ExpandedSections {
    artists: boolean;
    songs: boolean;
}

type OtherUserProfileRouteProp = RouteProp<RootStackParamList, 'OtherUserProfileScreen'>;
type OtherUserProfileNavigationProp = NativeStackNavigationProp<RootStackParamList & MainStackParamList>;
type FriendshipStatusDirect = 'not_friends' | 'friends' | 'blocked_by_you' | 'blocked_by_them' | 'loading' | 'error';

const OtherUserProfileScreen: React.FC = () => {
    const route = useRoute<OtherUserProfileRouteProp>();
    const navigation = useNavigation<OtherUserProfileNavigationProp>();
    const { session } = useAuth();
    const { userId: profileUserId } = route.params;

    const [profileData, setProfileData] = useState<MusicLoverProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [friendCount, setFriendCount] = useState<number>(0);
    const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatusDirect>('loading');
    const [isMuted, setIsMuted] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [reportModalVisible, setReportModalVisible] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);
    // --- State for custom unfriend confirmation modal ---
    const [showUnfriendConfirmModal, setShowUnfriendConfirmModal] = useState(false);
    const [expandedSections, setExpandedSections] = useState<ExpandedSections>({ artists: false, songs: false });

    const currentUserId = session?.user?.id;

    // --- Data Fetching (fetchFriendsCount, fetchProfileData, fetchInteractionStatus) ---
    const fetchFriendsCount = useCallback(async () => {
        if (!profileUserId) return;
        console.log("[OtherUserProfileScreen] Fetching friends count via RPC for profile user:", profileUserId);
        setFriendCount(0); // Reset before fetching
        
        try {
            // Call the new RPC function
            const { data: countData, error } = await supabase.rpc('get_friend_count', {
                user_id_to_check: profileUserId
            });
            
            if (error) throw error;
            
            const count = countData ?? 0;
            console.log(`[OtherUserProfileScreen] Friend count RPC result: ${count}`);
            setFriendCount(count);
            
        } catch (err) {
            console.error("[OtherUserProfileScreen] Error fetching friend count via RPC:", err);
            // Keep the count at 0 to indicate error
        }
    }, [profileUserId]);

    const fetchProfileData = useCallback(async () => {
        if (!profileUserId) { setError("User ID not provided."); setIsLoading(false); return; }
        setError(null);
        console.log(`[OtherUserProfileScreen] Fetching profile for ${profileUserId}`);
        try {
            const { data: profile, error: profileError } = await supabase
                .from('music_lover_profiles')
                .select('id, user_id, first_name, last_name, username, profile_picture, age, city, country, is_premium, bio, music_data, favorite_artists, favorite_albums, favorite_songs')
                .eq('user_id', profileUserId)
                .single();

            if (profileError && profileError.code === 'PGRST116') {
                console.log(`[OtherUserProfileScreen] Profile not found for user ${profileUserId}.`);
                setError("Profile not found.");
                setProfileData(null);
                return;
            } else if (profileError) {
                throw profileError;
            }

            if (!profile) {
                 console.log(`[OtherUserProfileScreen] Profile data is null for user ${profileUserId}.`);
                 setError("Profile not found.");
                 setProfileData(null);
                 return;
            }

            console.log(`[OtherUserProfileScreen] Retrieved profile successfully.`);
            setProfileData({
                id: profile.id,
                userId: profile.user_id,
                firstName: profile.first_name,
                lastName: profile.last_name,
                username: profile.username,
                profilePicture: profile.profile_picture,
                email: session?.user?.email ?? 'N/A',
                age: profile.age,
                city: profile.city,
                country: profile.country,
                isPremium: profile.is_premium,
                bio: profile.bio,
                musicData: profile.music_data,
                favorite_artists: profile.favorite_artists,
                favorite_albums: profile.favorite_albums,
                favorite_songs: profile.favorite_songs,
            });
            await fetchFriendsCount();

        } catch (err: any) {
            console.error("[OtherUserProfileScreen] Error fetching profile data:", err);
            setError(err.message || "Could not load profile.");
            setProfileData(null);
        }
    }, [profileUserId, fetchFriendsCount, session]);


    const fetchInteractionStatus = useCallback(async () => {
        if (!currentUserId || !profileUserId || currentUserId === profileUserId) {
             setFriendshipStatus('not_friends');
             setIsMuted(false);
             setIsBlocked(false);
             console.log("[OtherUserProfileScreen] Cannot fetch interaction: missing IDs or self-profile.");
             return;
         }

        console.log(`[OtherUserProfileScreen] Fetching interaction status between ${currentUserId} and ${profileUserId}`);
        setFriendshipStatus('loading');
        setIsMuted(false);
        setIsBlocked(false);

        try {
            // 1. Check Block Status
            const { data: blockData, error: blockError } = await supabase
                .from('blocks')
                .select('blocker_id')
                .or(`and(blocker_id.eq.${currentUserId},blocked_id.eq.${profileUserId}),and(blocker_id.eq.${profileUserId},blocked_id.eq.${currentUserId})`);
            if (blockError) throw new Error(`Block check failed: ${blockError.message}`);
            const blockedByCurrentUser = blockData?.some(b => b.blocker_id === currentUserId) ?? false;
            const blockedByProfileUser = blockData?.some(b => b.blocker_id === profileUserId) ?? false;
            setIsBlocked(blockedByCurrentUser);
            if (blockedByCurrentUser) {
                console.log("[OtherUserProfileScreen] Interaction Status: Blocked by You");
                setFriendshipStatus('blocked_by_you');
                setIsMuted(false); return;
            }
            if (blockedByProfileUser) {
                console.log("[OtherUserProfileScreen] Interaction Status: Blocked by Them");
                setFriendshipStatus('blocked_by_them');
                setIsMuted(false); return;
            }

            // 2. Check Friendship Status
            console.log("[OtherUserProfileScreen] Checking for 'accepted' friendship...");
            const { data: friendData, error: friendError } = await supabase
                .from('friends')
                .select('status')
                .or(`and(user_id_1.eq.${currentUserId},user_id_2.eq.${profileUserId}),and(user_id_1.eq.${profileUserId},user_id_2.eq.${currentUserId})`)
                .eq('status', 'accepted')
                .maybeSingle();
            if (friendError) throw new Error(`Friend check (accepted) failed: ${friendError.message}`);
            const isCurrentlyFriends = !!friendData;
            setFriendshipStatus(isCurrentlyFriends ? 'friends' : 'not_friends');
            console.log(`[OtherUserProfileScreen] Interaction Status (Friendship): ${isCurrentlyFriends ? 'Friends (accepted)' : 'Not friends (or pending/rejected)'}`);

            // 3. Check Mute Status
            console.log("[OtherUserProfileScreen] Checking mute status...");
            const { count: muteCount, error: muteError } = await supabase
                 .from('muted_users')
                 .select('*', { count: 'exact', head: true })
                 .eq('muter_id', currentUserId)
                 .eq('muted_id', profileUserId);
            if (muteError) throw new Error(`Mute check failed: ${muteError.message}`);
            const mutedResult = (muteCount ?? 0) > 0;
            setIsMuted(mutedResult);
            console.log(`[OtherUserProfileScreen] Interaction Status (Mute): ${mutedResult}`);

        } catch (err: any) {
             console.error("[OtherUserProfileScreen] Error fetching interaction status:", err);
             setFriendshipStatus('error');
             setIsMuted(false);
             setIsBlocked(false);
         }
    }, [currentUserId, profileUserId]);

    // --- useEffect Hooks (Initial fetch, Focus effect, Interaction after load, Header options) ---
    // These hooks remain unchanged from previous versions
    useEffect(() => {
        setIsLoading(true);
        setProfileData(null);
        setError(null);
        setFriendshipStatus('loading');
        fetchProfileData().finally(() => {
             setIsLoading(false)
        });
    }, [fetchProfileData]);

    useFocusEffect(
        useCallback(() => {
            console.log(`[OtherUserProfileScreen] Focus effect triggered. Fetching interaction status and friend count.`);
            if (currentUserId && profileUserId) {
                fetchInteractionStatus();
                fetchFriendsCount();
            } else {
                console.log("[OtherUserProfileScreen] Focus effect: Skipping fetch (missing IDs).");
            }
            return () => {
                console.log("[OtherUserProfileScreen] Focus effect cleanup (screen unfocused).");
            };
        }, [fetchInteractionStatus, fetchFriendsCount, currentUserId, profileUserId])
    );

    useEffect(() => {
        if (!isLoading && currentUserId && profileUserId) {
            console.log("[OtherUserProfileScreen] Post-load effect: Fetching interaction status and friend count.");
            fetchInteractionStatus();
            fetchFriendsCount();
        }
    }, [profileData, isLoading, fetchInteractionStatus, fetchFriendsCount, currentUserId, profileUserId]);

    useEffect(() => {
        const getHeaderConfig = () => {
            let title = 'User Profile';
            let canChat = false;
            let profileUserNameForChat = 'User';
            const currentBlockStatus = isBlocked;
            const currentFriendshipStatusValue = friendshipStatus;

            if (isLoading && !profileData) {
                 title = 'Loading Profile...';
             } else if (currentFriendshipStatusValue === 'blocked_by_them') {
                title = 'Profile Unavailable';
            } else if (profileData) {
                const first = profileData.firstName?.trim();
                const last = profileData.lastName?.trim();
                const username = profileData.username?.trim();
                let displayName = `${first ?? ''} ${last ?? ''}`.trim();
                if (!displayName && username) displayName = username;
                else if (!displayName) displayName = 'User Profile';
                title = displayName;
                profileUserNameForChat = displayName !== 'User Profile' ? displayName : (username || 'User');
            } else if (error) {
                 title = 'Error Loading';
             } else {
                title = 'Profile Not Found';
            }

            canChat = !currentBlockStatus && currentFriendshipStatusValue !== 'blocked_by_them';

            return { title, canChat, profileUserNameForChat };
        };

        const { title, canChat, profileUserNameForChat } = getHeaderConfig();
        console.log(`[OtherUserProfileScreen] Updating header - Title: ${title}, CanChat: ${canChat}`);

        navigation.setOptions({
            headerShown: true,
            headerTitle: title,
            headerTitleAlign: 'center',
            headerBackTitleVisible: false,
            headerLeft: () => (
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: Platform.OS === 'ios' ? 10 : 0, padding: 5 }}>
                    <Feather name="chevron-left" size={26} color={APP_CONSTANTS.COLORS.PRIMARY} />
                </TouchableOpacity>
            ),
            headerRight: () => (
                <TouchableOpacity
                    onPress={() => {
                        if (profileUserId && profileUserNameForChat && canChat) {
                           navigation.navigate('IndividualChatScreen', {
                               matchUserId: profileUserId,
                               matchName: profileUserNameForChat
                           });
                        } else {
                           console.warn("Cannot navigate to chat:", { profileUserId, profileUserNameForChat, canChat });
                           if (!canChat) {
                               Alert.alert("Cannot Chat", "Chat is unavailable with this user.");
                           } else {
                               Alert.alert("Error", "Could not open chat. User information might be missing.");
                           }
                        }
                    }}
                    style={{ marginRight: Platform.OS === 'ios' ? 10 : 15, padding: 5 }}
                    disabled={!canChat}
                >
                    <Feather name="message-circle" size={24} color={canChat ? APP_CONSTANTS.COLORS.PRIMARY : APP_CONSTANTS.COLORS.DISABLED} />
                </TouchableOpacity>
            ),
            headerStyle: { backgroundColor: 'white' },
            headerTitleStyle: { fontWeight: '600', color: '#1F2937' },
        });
    }, [navigation, profileData, profileUserId, isLoading, error, friendshipStatus, isBlocked]);


    // --- Action Handlers ---

    // handleAddFriendDirectly - remains unchanged
    const handleAddFriendDirectly = async () => {
        if (!currentUserId || !profileUserId || friendshipStatus !== 'not_friends' || isLoading) {
            console.log("[OtherUserProfileScreen] Add friend conditions not met:", { currentUserIdPresent: !!currentUserId, profileUserIdPresent: !!profileUserId, status: friendshipStatus, isLoading });
            return;
        }
        console.log(`[OtherUserProfileScreen] Initiating 'Add Friend' action for: ${profileUserId}`);
        setFriendshipStatus('loading');

        const id1 = currentUserId < profileUserId ? currentUserId : profileUserId;
        const id2 = currentUserId < profileUserId ? profileUserId : currentUserId;

        try {
            console.log(`[OtherUserProfileScreen] Checking for existing relationship: user_id_low=${id1}, user_id_high=${id2}`);
            const { data: existingRelation, error: checkError } = await supabase
                .from('friends')
                .select('id, status, requester_id')
                .eq('user_id_low', id1)
                .eq('user_id_high', id2)
                .maybeSingle();

            if (checkError) {
                console.error("[OtherUserProfileScreen] Error checking for existing relationship:", JSON.stringify(checkError, null, 2));
                throw new Error(`Failed to check relationship: ${checkError.message}`);
            }

            if (existingRelation) {
                console.log(`[OtherUserProfileScreen] Found existing relationship:`, existingRelation);
                if (existingRelation.status === 'accepted') {
                    console.warn("[OtherUserProfileScreen] Relationship already 'accepted'. Correcting state.");
                    setFriendshipStatus('friends');
                    fetchFriendsCount();
                    await fetchInteractionStatus();
                    return;
                }
                 else if (existingRelation.status === 'pending' && existingRelation.requester_id === profileUserId) {
                    console.log("[OtherUserProfileScreen] Existing request was pending from other user. Accepting it.");
                    const { error: updateError } = await supabase
                        .from('friends')
                        .update({ status: 'accepted', requester_id: currentUserId, updated_at: new Date().toISOString() })
                        .eq('id', existingRelation.id);
                    if (updateError) throw new Error(`Failed to accept request: ${updateError.message}`);
                    console.log("[OtherUserProfileScreen] Successfully updated status to 'accepted'.");
                    setFriendshipStatus('friends');
                    fetchFriendsCount();
                }
                 else {
                    console.log(`[OtherUserProfileScreen] Existing relationship status is '${existingRelation.status}'. Attempting to set to 'accepted'.`);
                    const { error: updateError } = await supabase
                       .from('friends')
                       .update({ status: 'accepted', requester_id: currentUserId, updated_at: new Date().toISOString() })
                       .eq('id', existingRelation.id);
                    if (updateError) throw new Error(`Failed to force accept: ${updateError.message}. Check RLS.`);
                    console.log("[OtherUserProfileScreen] Successfully forced status to 'accepted'.");
                    setFriendshipStatus('friends');
                    fetchFriendsCount();
                }
            }
             else {
                console.log("[OtherUserProfileScreen] No existing relationship found. Inserting new 'accepted' record.");
                const { error: insertError } = await supabase
                    .from('friends')
                    .insert({ user_id_1: id1, user_id_2: id2, status: 'accepted', requester_id: currentUserId });
                if (insertError) {
                    if (insertError.message?.toLowerCase().includes('rls') || insertError.message?.toLowerCase().includes('policy')) {
                       throw new Error(`Permission denied: ${insertError.message}`);
                    } else {
                       throw new Error(`Failed to insert friendship: ${insertError.message}`);
                    }
                }
                console.log("[OtherUserProfileScreen] Successfully inserted new 'accepted' friendship.");
                setFriendshipStatus('friends');
                fetchFriendsCount();
            }

        } catch (err: any) {
            console.error("[OtherUserProfileScreen] Error caught during 'Add Friend' action:", err);
            Alert.alert("Error", `Could not add friend: ${err.message || 'An unknown error occurred.'}`);
            await fetchInteractionStatus();
        }
    };

    // performUnfriendAction - contains the Supabase call, remains unchanged
    const performUnfriendAction = async () => {
        console.log("[performUnfriendAction] Entered function.");
        console.log("[performUnfriendAction] currentUserId:", currentUserId);
        console.log("[performUnfriendAction] profileUserId:", profileUserId);
        console.log("[performUnfriendAction] profileData exists:", !!profileData);

        if (!currentUserId || !profileUserId) {
            console.error("[performUnfriendAction] Missing user IDs.");
            Alert.alert("Error", "Cannot perform action due to missing user information.");
            await fetchInteractionStatus();
            return;
        }

        const displayName = profileData?.firstName ?? profileData?.username ?? 'this user';

        console.log(`[performUnfriendAction] Inside async action. Attempting unfriend for user: ${profileUserId}, current user: ${currentUserId}`);
        setFriendshipStatus('loading');

        const user1 = currentUserId;
        const user2 = profileUserId;

        try {
            console.log(`[performUnfriendAction] Entering try block...`);
            console.log(`[performUnfriendAction] Executing delete for users: ${user1}, ${user2} with status 'accepted'`);
            const { error, count } = await supabase
                .from('friends')
                .delete({ count: 'exact' })
                .or(`and(user_id_1.eq.${user1},user_id_2.eq.${user2}),and(user_id_1.eq.${user2},user_id_2.eq.${user1})`)
                .eq('status', 'accepted');

            console.log("[performUnfriendAction] Supabase delete response:", { error: JSON.stringify(error), count });

            if (error) {
                console.error("[performUnfriendAction] Supabase DELETE error object:", JSON.stringify(error, null, 2));
                if (error.message?.toLowerCase().includes('row level security') || error.message?.toLowerCase().includes('rls policy')) {
                     console.error("[performUnfriendAction] RLS policy likely denied the delete operation.");
                     throw new Error(`Permission denied. Please check application policies. (${error.code})`);
                } else {
                    throw new Error(`Supabase error: ${error.message} (Code: ${error.code})`);
                }
            }

            console.log(`[performUnfriendAction] Supabase DELETE successful. Rows deleted: ${count ?? 'unknown'}`);
            if (count === 0) {
                console.warn("[performUnfriendAction] Unfriend operation completed, but 0 rows were deleted. Friendship might have already been removed.");
            }

            setFriendshipStatus('not_friends');
            await fetchFriendsCount();
            console.log("[performUnfriendAction] Unfriend successful. State set to not_friends, friend count updated.");

        } catch (err: any) {
            console.error("[performUnfriendAction] Error caught in catch block:", err);
            console.error("[performUnfriendAction] Stringified catch error:", JSON.stringify(err, null, 2));
            let alertMessage = `Could not unfriend ${displayName}.`;
            if (err.message) { alertMessage += `\nReason: ${err.message}`; }
            else { alertMessage += "\nAn unknown error occurred."; }
            Alert.alert("Unfriend Failed", alertMessage);

            console.log("[performUnfriendAction] Fetching interaction status after failed unfriend attempt...");
            await fetchInteractionStatus();

            if (friendshipStatus === 'loading') {
                 console.warn("[performUnfriendAction] Status still 'loading' after error and fetchInteractionStatus. Refetching again.");
                 await fetchInteractionStatus();
            }
        }
    };

    // handleUnfriend - MODIFIED to show custom modal instead of Alert.alert
    const handleUnfriend = () => {
        console.log("[handleUnfriend] Function called. Current friendshipStatus:", friendshipStatus);

        // Pre-conditions check
        if (!currentUserId || !profileUserId || friendshipStatus !== 'friends' || isLoading) {
            console.log("[OtherUserProfileScreen] Unfriend conditions not met:", {
                currentUserIdPresent: !!currentUserId,
                profileUserIdPresent: !!profileUserId,
                status: friendshipStatus,
                isLoading
            });
            return;
        }

        console.log("[handleUnfriend] Conditions met. Showing custom confirmation modal.");
        setShowUnfriendConfirmModal(true); // Show the custom modal
    };

    // handleToggleMute, handleBlock, handleUnblock, submitReport - remain unchanged
    const handleToggleMute = async () => {
        if (!currentUserId || !profileUserId || isBlocked || friendshipStatus === 'blocked_by_them') return;
        const currentlyMuted = isMuted;
        console.log(`[OtherUserProfileScreen] Attempting to ${currentlyMuted ? 'unmute' : 'mute'} user ${profileUserId}`);
        setIsMuted(!currentlyMuted);
        try {
            if (currentlyMuted) {
                const { error } = await supabase
                    .from('muted_users')
                    .delete()
                    .eq('muter_id', currentUserId)
                    .eq('muted_id', profileUserId);
                if (error) throw error;
                console.log(`[OtherUserProfileScreen] Successfully unmuted user ${profileUserId}`);
            } else {
                const { error } = await supabase
                    .from('muted_users')
                    .upsert({ muter_id: currentUserId, muted_id: profileUserId });
                if (error) throw error;
                console.log(`[OtherUserProfileScreen] Successfully muted (or confirmed mute) for user ${profileUserId}`);
            }
            // Refresh interaction status after muting/unmuting
            await fetchInteractionStatus();
            // Also refresh friend count to ensure data is in sync
            await fetchFriendsCount();
        } catch (err: any) {
            console.error(`[OtherUserProfileScreen] Error ${currentlyMuted ? 'unmuting' : 'muting'} user:`, err);
            Alert.alert("Error", `Could not ${currentlyMuted ? 'unmute' : 'mute'} user. ${err.message || 'Please try again.'}`);
            setIsMuted(currentlyMuted);
        }
    };


    const handleBlock = async () => {
        if (!currentUserId || !profileUserId || isBlocked) return;
        const displayName = profileData?.firstName ?? profileData?.username ?? 'this user';

        Alert.alert(
            "Block User",
            `Block ${displayName}? You won't see their profile or messages, and they won't see yours. This also removes any existing friendship. This action is final from this screen.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Block",
                    style: "destructive",
                    onPress: async () => {
                        console.log(`[OtherUserProfileScreen] Initiating block for user: ${profileUserId}`);
                        setFriendshipStatus('loading');
                        setIsBlocked(true);
                        setIsMuted(false);

                        try {
                            console.log("[OtherUserProfileScreen] Removing existing friendship during block...");
                            const { error: friendDeleteError } = await supabase
                                .from('friends')
                                .delete()
                                .or(`and(user_id_1.eq.${currentUserId},user_id_2.eq.${profileUserId}),and(user_id_1.eq.${profileUserId},user_id_2.eq.${currentUserId})`);
                            if (friendDeleteError) {
                                console.warn("[OtherUserProfileScreen] Error removing friendship during block (might not exist):", friendDeleteError.message);
                            } else {
                                console.log("[OtherUserProfileScreen] Existing friendship removed (if any).");
                            }
                            await fetchFriendsCount();

                            console.log("[OtherUserProfileScreen] Inserting block record...");
                            const { error: blockError } = await supabase
                                .from('blocks')
                                .upsert({ blocker_id: currentUserId, blocked_id: profileUserId });
                            if (blockError) {
                                throw new Error(`Failed to insert block record: ${blockError.message}`);
                            }

                            console.log("[OtherUserProfileScreen] User blocked successfully.");
                            setFriendshipStatus('blocked_by_you');
                            Alert.alert("User Blocked", `${displayName} has been blocked.`);
                            navigation.navigate('MainApp', { screen: 'UserTabs', params: { screen: 'Matches' } });

                        } catch (err: any) {
                            console.error("[OtherUserProfileScreen] Error blocking user:", err);
                            Alert.alert("Error", `Could not block user: ${err.message || 'Unknown error'}`);
                            setIsBlocked(false);
                            await fetchInteractionStatus();
                        }
                    }
                }
            ]
        );
    };


    const handleUnblock = async () => {
        if (!currentUserId || !profileUserId || !isBlocked) return;
        console.log(`[OtherUserProfileScreen] Attempting to unblock user: ${profileUserId}`);
        setFriendshipStatus('loading');

        try {
            const { error } = await supabase
                .from('blocks')
                .delete()
                .eq('blocker_id', currentUserId)
                .eq('blocked_id', profileUserId);
            if (error) {
                 if (error.message?.toLowerCase().includes('rls') || error.message?.toLowerCase().includes('policy')) {
                      throw new Error(`Permission denied to unblock: ${error.message}`);
                 } else {
                     throw new Error(`Failed to unblock: ${error.message}`);
                 }
            }

            console.log("[OtherUserProfileScreen] User unblocked successfully.");
            setIsBlocked(false);
            Alert.alert("User Unblocked");
            await fetchInteractionStatus();

        } catch (err: any) {
            console.error("[OtherUserProfileScreen] Error unblocking user:", err);
            Alert.alert("Error", `Could not unblock user: ${err.message || 'Unknown error'}`);
            setFriendshipStatus('blocked_by_you');
            setIsBlocked(true);
        }
    };

    const submitReport = async () => {
        if (!currentUserId || !profileUserId || !reportReason.trim()) {
            Alert.alert("Input Required", "Please provide a reason for the report.");
            return;
        }
        const displayName = profileData?.firstName ?? profileData?.username ?? 'this user';
        setIsSubmittingReport(true);
        setError(null);

        try {
             console.log("[OtherUserProfileScreen] Submitting report...");
            const { error: reportError } = await supabase.from('reports').insert({
                reporter_id: currentUserId,
                reported_id: profileUserId,
                reason: reportReason.trim(),
            });
             if (reportError) throw new Error(`Report submission failed: ${reportError.message}`);
            console.log("[OtherUserProfileScreen] Report submitted successfully.");

             console.log("[OtherUserProfileScreen] Removing friendship after report...");
             const { error: friendDeleteError } = await supabase.from('friends').delete().or(`and(user_id_1.eq.${currentUserId},user_id_2.eq.${profileUserId}),and(user_id_1.eq.${profileUserId},user_id_2.eq.${currentUserId})`);
             if (friendDeleteError) console.warn("[OtherUserProfileScreen] Error removing friendship post-report (might not exist):", friendDeleteError.message);
             await fetchFriendsCount();

            console.log("[OtherUserProfileScreen] Blocking user after report...");
            const { error: blockError } = await supabase.from('blocks').upsert({ blocker_id: currentUserId, blocked_id: profileUserId });
             if (blockError) throw new Error(`Blocking failed after report: ${blockError.message}`);
            console.log("[OtherUserProfileScreen] User blocked successfully after report.");

            setReportReason('');
            setReportModalVisible(false);
            setIsBlocked(true);
            setFriendshipStatus('blocked_by_you');
            setIsMuted(false);
            Alert.alert("Report Submitted", `${displayName} has been reported and blocked.`);
            navigation.navigate('MainApp', { screen: 'UserTabs', params: { screen: 'Matches' } });

        } catch (err: any) {
            console.error("[OtherUserProfileScreen] Error submitting report and blocking:", err);
            Alert.alert("Error", `Failed to submit report: ${err.message || 'Unknown error. Please try again.'}`);
        } finally {
            setIsSubmittingReport(false);
        }
    };

    const toggleSection = (section: keyof ExpandedSections) => {
        setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    // --- Render Logic ---
    const showLoadingIndicator = isLoading || (friendshipStatus === 'loading' && !profileData);

    if (showLoadingIndicator) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} /></View>;
    }

     if (!profileData && !isLoading) {
         const isNotFoundError = error === "Profile not found." || error === "User ID not provided.";
         return (
              <View style={styles.centered}>
                  <Feather name={isNotFoundError ? "user-x" : "alert-circle"} size={48} color={APP_CONSTANTS.COLORS.WARNING} />
                  <Text style={styles.errorText}>{error || "Profile Not Found"}</Text>
                  <Text style={styles.infoSubText}>
                      {isNotFoundError
                          ? "This user profile could not be found."
                          : "We encountered an issue loading this profile."}
                  </Text>
                  {!isNotFoundError && (
                      <TouchableOpacity
                          onPress={() => {
                              console.log("Retrying profile fetch...");
                              setIsLoading(true);
                              setError(null);
                              fetchProfileData().finally(() => setIsLoading(false));
                          }}
                          style={styles.retryButton}
                       >
                          <Text style={styles.retryButtonText}>Try Again</Text>
                      </TouchableOpacity>
                  )}
              </View>
          );
     }

    if (friendshipStatus === 'blocked_by_them') {
        return (
            <View style={styles.container}>
                <View style={styles.centered}>
                    <Feather name="slash" size={60} color={APP_CONSTANTS.COLORS.DISABLED} />
                    <Text style={styles.infoText}>Profile Unavailable</Text>
                     <Text style={styles.infoSubText}>You cannot view this profile or interact with this user.</Text>
                </View>
            </View>
         );
     }

    if (!profileData) {
        console.error("[OtherUserProfileScreen] Render reached state where profileData is null unexpectedly.");
        return <View style={styles.centered}><Text style={styles.errorText}>An unexpected error occurred.</Text></View>;
    }


    // --- Data Extraction ---
    const profilePictureUrl = profileData.profilePicture ?? DEFAULT_PROFILE_PIC;
    const userName = `${profileData.firstName ?? ''} ${profileData.lastName ?? ''}`.trim() || profileData.username || "User";
    const userAge = profileData.age;
    const userCity = profileData.city;
    const userCountry = profileData.country;
    const isPremium = profileData.isPremium ?? false;
    const allBioDetails = profileData.bio ? Object.entries(profileData.bio).filter(([_, v]) => v && String(v).trim() !== '').map(([k, v]) => ({ label: bioDetailLabels[k as keyof MusicLoverBio] || k, value: String(v).trim() })) : [];
    const favoriteGenres = (profileData.musicData?.genres as string[]) ?? [];

    // Parse favorite music strings
    const parseCsvString = (str: string | null | undefined): string[] => {
        if (!str) return [];
        return str.split(',').map(s => s.trim()).filter(Boolean);
    };
    const favArtistsList = parseCsvString(profileData.favorite_artists);
    const favAlbumsList = parseCsvString(profileData.favorite_albums);
    const favSongsList = parseCsvString(profileData.favorite_songs);

    // --- Dynamic Action Buttons ---
    // renderFriendButton now calls handleUnfriend (which opens the modal)
    const renderFriendButton = () => {
        const currentStatus = friendshipStatus;
        const isLoadingInteraction = currentStatus === 'loading';

        const buttonStyle = [styles.actionButton, styles.friendButton];
        let iconName: React.ComponentProps<typeof Feather>['name'] = 'user-plus';
        let buttonText = 'Add Friend';
        let onPress: () => void | Promise<void> = handleAddFriendDirectly;
        let disabled = isLoadingInteraction || isBlocked || currentStatus === 'blocked_by_you' || currentStatus === 'error';

        switch (currentStatus) {
            case 'loading':
                buttonText = 'Loading...';
                break;
            case 'friends':
                iconName = 'user-check';
                buttonText = 'Friends';
                buttonStyle.length = 0;
                buttonStyle.push(styles.actionButton, styles.friendsButton);
                onPress = handleUnfriend;
                disabled = isLoadingInteraction;
                break;
            case 'not_friends':
                iconName = 'user-plus';
                buttonText = 'Add Friend';
                onPress = handleAddFriendDirectly;
                disabled = isLoadingInteraction;
                break;
             case 'error':
                 buttonText = 'Error';
                 iconName = 'alert-circle';
                 buttonStyle.push(styles.disabledButton);
                 disabled = true;
                 onPress = () => {
                     Alert.alert("Error", "Could not determine friendship status. Please try again later.");
                     fetchInteractionStatus();
                 };
                 break;
            case 'blocked_by_you':
                return null;
        }

        return (
            <TouchableOpacity
                style={[...buttonStyle, disabled && styles.disabledButton]}
                onPress={onPress}
                disabled={disabled}
            >
                {isLoadingInteraction ? (
                     <ActivityIndicator size="small" color={friendshipStatus === 'friends' ? APP_CONSTANTS.COLORS.SUCCESS_DARK : APP_CONSTANTS.COLORS.WHITE} style={{ marginRight: 8 }}/>
                 ) : (
                     <Feather name={iconName} size={16} color={friendshipStatus === 'friends' ? APP_CONSTANTS.COLORS.SUCCESS_DARK : APP_CONSTANTS.COLORS.WHITE} />
                 )}
                <Text style={[styles.actionButtonText, friendshipStatus === 'friends' && styles.actionButtonTextDark]}>
                     {buttonText}
                 </Text>
            </TouchableOpacity>
        );
     };

     // renderMuteButton, renderBlockButton remain unchanged
     const renderMuteButton = () => {
         if (isBlocked) return null;

         const iconName: React.ComponentProps<typeof Feather>['name'] = isMuted ? 'volume-x' : 'volume-2';
         const text = isMuted ? 'Unmute User' : 'Mute User';
         const buttonStyle = [styles.actionButton, styles.secondaryButton, isMuted && styles.mutedButton];
         return (
             <TouchableOpacity style={buttonStyle} onPress={handleToggleMute}>
                 <Feather name={iconName} size={16} color={isMuted ? APP_CONSTANTS.COLORS.WARNING_DARK : APP_CONSTANTS.COLORS.TEXT_SECONDARY} />
                 <Text style={[styles.actionButtonText, styles.secondaryButtonText, isMuted && styles.mutedButtonText]}>{text}</Text>
             </TouchableOpacity>
         );
     };

     const renderBlockButton = () => {
        if (isBlocked) {
            return (
                <TouchableOpacity style={[styles.actionButton, styles.unblockButton]} onPress={handleUnblock}>
                    <Feather name="unlock" size={16} color={APP_CONSTANTS.COLORS.SUCCESS_DARK} />
                    <Text style={[styles.actionButtonText, styles.unblockButtonText]}>Unblock User</Text>
                </TouchableOpacity>
            );
        } else {
            return (
                <TouchableOpacity style={[styles.actionButton, styles.reportButton]} onPress={() => setReportModalVisible(true)}>
                    <Feather name="alert-octagon" size={16} color={APP_CONSTANTS.COLORS.ERROR} />
                    <Text style={[styles.actionButtonText, styles.reportButtonText]}>Report / Block</Text>
                </TouchableOpacity>
            );
        }
    };

    // --- Main Return ---
    return (
        <View style={styles.container}>
            {/* Report Modal (existing) */}
            <Modal animationType="slide" transparent={true} visible={reportModalVisible} onRequestClose={() => { if (!isSubmittingReport) setReportModalVisible(false); }} >
                <View style={styles.modalOverlay}><View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Report and Block {userName}</Text>
                    <Text style={styles.modalSubtitle}>Reason for report? User will be blocked.</Text>
                    <TextInput style={styles.reportInput} placeholder="Reason..." value={reportReason} onChangeText={setReportReason} multiline maxLength={500} />
                    <View style={styles.modalActions}>
                        <TouchableOpacity style={[styles.modalButton, styles.modalCancelButton]} onPress={() => setReportModalVisible(false)} disabled={isSubmittingReport}><Text style={styles.modalCancelButtonText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, styles.modalSubmitButton, (!reportReason.trim() || isSubmittingReport) && styles.disabledButton]} onPress={submitReport} disabled={!reportReason.trim() || isSubmittingReport} >
                            {isSubmittingReport ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.modalSubmitButtonText}>Submit & Block</Text>}
                        </TouchableOpacity>
                    </View>
                </View></View>
            </Modal>

             {/* --- Custom Unfriend Confirmation Modal --- */}
             <Modal
                 animationType="fade"
                 transparent={true}
                 visible={showUnfriendConfirmModal}
                 onRequestClose={() => setShowUnfriendConfirmModal(false)} // Allows closing via back button on Android
             >
                 <View style={styles.modalOverlay}>
                     <View style={styles.modalContent}>
                         <Text style={styles.modalTitle}>Unfriend User</Text>
                         <Text style={styles.modalSubtitle}>
                             Are you sure you want to remove {userName} as a friend? {/* Use userName here */}
                         </Text>
                         <View style={styles.modalActions}>
                             <TouchableOpacity
                                 style={[styles.modalButton, styles.modalCancelButton]}
                                 onPress={() => {
                                    console.log("[Custom Modal] Cancel pressed.");
                                    setShowUnfriendConfirmModal(false);
                                }}
                             >
                                 <Text style={styles.modalCancelButtonText}>Cancel</Text>
                             </TouchableOpacity>
                             <TouchableOpacity
                                 // Use error color for destructive action
                                 style={[styles.modalButton, styles.modalSubmitButton, { backgroundColor: APP_CONSTANTS.COLORS.ERROR }]}
                                 onPress={() => {
                                     console.log("[Custom Modal] Unfriend confirmed. Calling performUnfriendAction...");
                                     setShowUnfriendConfirmModal(false); // Close modal first
                                     performUnfriendAction();        // Then call the action
                                 }}
                             >
                                 {/* Use white text matching the report modal */}
                                 <Text style={styles.modalSubmitButtonText}>Unfriend</Text>
                             </TouchableOpacity>
                         </View>
                     </View>
                 </View>
             </Modal>
             {/* --- End Custom Unfriend Confirmation Modal --- */}


            {/* Profile Content */}
            <ScrollView style={profileStyles.scrollViewContainer} contentContainerStyle={profileStyles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Profile Card */}
                <View style={profileStyles.profileCard}>
                    <LinearGradient colors={[APP_CONSTANTS.COLORS.PRIMARY_LIGHT, APP_CONSTANTS.COLORS.PRIMARY]} style={[profileStyles.coverPhoto, { height: 90 }]} />
                    <View style={[profileStyles.avatarContainer, { top: 40 }]}>
                         <Image source={{ uri: profilePictureUrl }} style={[profileStyles.avatar, { width: 90, height: 90, borderRadius: 45 }]} />
                    </View>
                    <View style={[profileStyles.profileInfo, { paddingTop: 55 }]}>
                        <View style={profileStyles.nameContainer}>
                            <Text style={profileStyles.name}>{userName}</Text>
                            {isPremium && (<View style={profileStyles.premiumBadgeName}><Feather name="award" size={10} color="#B8860B" /><Text style={profileStyles.premiumTextName}>Premium</Text></View>)}
                        </View>
                        <View style={profileStyles.locationAgeContainer}>
                            {userAge && <Text style={styles.age}>{userAge} y/o</Text>}
                            {(userCity || userCountry) && userAge && <Text style={styles.locationSeparator}> • </Text>}
                            {(userCity || userCountry) && (
                                <View style={profileStyles.locationRow}>
                                    <Feather name="map-pin" size={12} color="#6B7280" style={{ marginRight: 4 }}/>
                                    <Text style={profileStyles.locationText}>{userCity}{userCity && userCountry ? ', ' : ''}{userCountry}</Text>
                                </View>
                            )}
                        </View>
                        <View style={profileStyles.statsContainer}>
                            <View style={profileStyles.statItem}>
                                <Text style={profileStyles.statValue}>{friendCount}</Text>
                                <Text style={profileStyles.statLabel}>Friends</Text>
                            </View>
                        </View>
                    </View>
                </View>

                 {/* Friend Action Button Row */}
                 <View style={styles.actionsRow}>
                     {renderFriendButton()}
                 </View>

                {/* Profile Sections */}
                <ProfileSection title="Things About Them" icon="info" hasData={allBioDetails.length > 0}>
                     <View style={profileStyles.bioDetailsListContainer}>
                         {allBioDetails.map((d, i) => (
                             <View key={i} style={profileStyles.bioDetailItem}>
                                 <Text style={profileStyles.bioDetailLabel}>{d.label}:</Text>
                                 <Text style={profileStyles.bioDetailValue}>{d.value}</Text>
                             </View>
                         ))}
                     </View>
                 </ProfileSection>

                <ProfileSection title="Favorite Genres" icon="music" hasData={favoriteGenres.length > 0}>
                     <View style={profileStyles.tagsContainer}>
                         {favoriteGenres.map((g, i) => (
                             <View key={i} style={profileStyles.genreTag}>
                                 <Text style={profileStyles.genreTagText}>{g}</Text>
                             </View>
                         ))}
                     </View>
                 </ProfileSection>

                {/* Favorite Artists Section (matches ProfileScreen) */}
                <ProfileSection title="Favorite Artists" icon="users" hasData={favArtistsList.length > 0}>
                    <View style={profileStyles.listContainer}>
                        {favArtistsList.slice(0, expandedSections.artists ? favArtistsList.length : 5).map((item, index) => (
                            <View key={`artist-${index}`} style={profileStyles.listItem}>
                                <Text style={profileStyles.listItemText}>{item}</Text>
                                <Feather name="user" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                            </View>
                        ))}
                    </View>
                    {favArtistsList.length > 5 && (
                        <TouchableOpacity style={profileStyles.seeAllButton} onPress={() => toggleSection("artists")}>
                            <Text style={profileStyles.seeAllButtonText}>{expandedSections.artists ? "See Less" : `See all ${favArtistsList.length}`}</Text>
                            <Feather name={expandedSections.artists ? "chevron-up" : "chevron-down"} size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                        </TouchableOpacity>
                    )}
                </ProfileSection>

                {/* Favorite Albums Section (matches ProfileScreen - no expand) */}
                <ProfileSection title="Favorite Albums" icon="disc" hasData={favAlbumsList.length > 0}>
                    <View style={profileStyles.listContainer}>
                        {favAlbumsList.map((item, index) => (
                            <View key={`album-${index}`} style={profileStyles.listItem}>
                                <Text style={profileStyles.listItemText}>{item}</Text>
                                <Feather name="disc" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                            </View>
                        ))}
                    </View>
                </ProfileSection>

                {/* Favorite Songs Section (matches ProfileScreen) */}
                <ProfileSection title="Favorite Songs" icon="music" hasData={favSongsList.length > 0}>
                    <View style={profileStyles.listContainer}>
                        {favSongsList.slice(0, expandedSections.songs ? favSongsList.length : 5).map((item, index) => (
                            <View key={`song-${index}`} style={profileStyles.listItem}>
                                <Text style={profileStyles.listItemText}>{item}</Text>
                                <Feather name="music" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                            </View>
                        ))}
                    </View>
                    {favSongsList.length > 5 && (
                        <TouchableOpacity style={profileStyles.seeAllButton} onPress={() => toggleSection("songs")}>
                            <Text style={profileStyles.seeAllButtonText}>{expandedSections.songs ? "See Less" : `See all ${favSongsList.length}`}</Text>
                            <Feather name={expandedSections.songs ? "chevron-up" : "chevron-down"} size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                        </TouchableOpacity>
                    )}
                </ProfileSection>

                 {/* More Options Section */}
                 {!isBlocked && (
                     <View style={styles.moreOptionsSection}>
                          <Text style={styles.moreOptionsTitle}>More Options</Text>
                          {renderMuteButton()}
                          {renderBlockButton()}
                      </View>
                 )}
            </ScrollView>
        </View>
    );
};

// --- Styles ---
// Using existing styles, ensure they cover the modal elements added
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F9FAFB", },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
    errorText: { color: APP_CONSTANTS.COLORS.ERROR, fontSize: 16, fontWeight: '500', textAlign: 'center', marginBottom: 10 },
    infoText: { fontSize: 16, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, textAlign: 'center', marginTop: 10, },
    infoSubText: { fontSize: 14, color: APP_CONSTANTS.COLORS.DISABLED, textAlign: 'center', marginTop: 5 },
    retryButton: { marginTop: 20, backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, },
    retryButtonText: { color: 'white', fontWeight: '600' },
    actionsRow: { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 16, marginBottom: 24, marginTop: -10, gap: 10, minHeight: 40 },
    actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2, minWidth: 120, borderWidth: 1, borderColor: 'transparent', },
    actionButtonText: { marginLeft: 8, fontSize: 14, fontWeight: '600', color: 'white', },
    actionButtonTextDark: { color: APP_CONSTANTS.COLORS.SUCCESS_DARK },
    friendButton: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, borderColor: APP_CONSTANTS.COLORS.PRIMARY_DARK, },
    friendsButton: { backgroundColor: APP_CONSTANTS.COLORS.SUCCESS_LIGHT, borderColor: APP_CONSTANTS.COLORS.SUCCESS, },
    disabledButton: { backgroundColor: '#D1D5DB', shadowOpacity: 0, elevation: 0, borderColor: '#B0B0B0', opacity: 0.7 },
    moreOptionsSection: { marginTop: 16, marginBottom: 32, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 20, },
    moreOptionsTitle: { fontSize: 16, fontWeight: '600', color: '#4B5563', marginBottom: 15, textAlign: 'center', },
    secondaryButton: { backgroundColor: '#F3F4F6', marginBottom: 12, shadowOpacity: 0.05, elevation: 1, borderColor: '#E5E7EB', borderWidth: 1, justifyContent: 'flex-start', paddingHorizontal: 16, width: '100%', borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, },
    secondaryButtonText: { color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, fontWeight: '500', marginLeft: 8, fontSize: 14, },
    mutedButton: { backgroundColor: APP_CONSTANTS.COLORS.WARNING_LIGHT, borderColor: APP_CONSTANTS.COLORS.WARNING, },
    mutedButtonText: { color: APP_CONSTANTS.COLORS.WARNING_DARK, },
    reportButton: { backgroundColor: `${APP_CONSTANTS.COLORS.ERROR}1A`, borderColor: APP_CONSTANTS.COLORS.ERROR, borderWidth: 1, justifyContent: 'flex-start', paddingHorizontal: 16, width: '100%', marginBottom: 12, shadowOpacity: 0.05, elevation: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, },
    reportButtonText: { color: APP_CONSTANTS.COLORS.ERROR, fontWeight: '500', marginLeft: 8, fontSize: 14, },
    unblockButton: { backgroundColor: `${APP_CONSTANTS.COLORS.SUCCESS_LIGHT}CC`, borderColor: APP_CONSTANTS.COLORS.SUCCESS, borderWidth: 1, justifyContent: 'flex-start', paddingHorizontal: 16, width: '100%', marginBottom: 12, shadowOpacity: 0.05, elevation: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, },
    unblockButtonText: { color: APP_CONSTANTS.COLORS.SUCCESS_DARK, fontWeight: '500', marginLeft: 8, fontSize: 14, },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)', },
    modalContent: { width: '90%', maxWidth: 400, backgroundColor: 'white', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, },
    modalTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 8, textAlign: 'center', },
    modalSubtitle: { fontSize: 14, color: '#4B5563', marginBottom: 16, textAlign: 'center', lineHeight: 20, },
    reportInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', fontSize: 14, color: '#1F2937', marginBottom: 16, },
    modalErrorText: { color: APP_CONSTANTS.COLORS.ERROR, fontSize: 13, textAlign: 'center', marginBottom: 10, },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, },
    modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', },
    modalCancelButton: { backgroundColor: '#E5E7EB', marginRight: 10, },
    modalCancelButtonText: { color: '#4B5563', fontWeight: '600', },
    modalSubmitButton: { backgroundColor: APP_CONSTANTS.COLORS.ERROR, marginLeft: 10, }, // Default to error color
    modalSubmitButtonText: { color: 'white', fontWeight: '600', },
    age: { fontSize: 14, color: "#6B7280", },
    locationSeparator: { color: "#D1D5DB", marginHorizontal: 6, fontSize: 14, },
    locationText: { fontSize: 14, color: "#6B7280", marginLeft: 0, textAlign: 'center' },
 });

const profileStyles = StyleSheet.create({
    scrollViewContainer: { flex: 1, },
    scrollContent: { paddingBottom: 40, paddingTop: 16, },
    profileCard: { backgroundColor: "white", borderRadius: 16, marginBottom: 24, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5, elevation: 3, marginHorizontal: 16, },
    coverPhoto: { height: 120, width: "100%", },
    avatarContainer: { position: "absolute", top: 65, alignSelf: 'center', backgroundColor: "white", borderRadius: 55, padding: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 4, },
    avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: 'white', },
    profileInfo: { paddingTop: 65, paddingBottom: 20, paddingHorizontal: 20, alignItems: "center", },
    nameContainer: { flexDirection: "row", alignItems: "center", justifyContent: 'center', marginBottom: 4, flexWrap: 'wrap', },
    name: { fontSize: 22, fontWeight: "bold", color: "#1F2937", marginRight: 8, textAlign: 'center', },
    premiumBadgeName: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255, 215, 0, 0.15)", paddingVertical: 3, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255, 215, 0, 0.4)", },
    premiumTextName: { color: "#B8860B", fontSize: 10, fontWeight: "600", marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5, },
    locationAgeContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' },
    locationRow: { flexDirection: 'row', alignItems: 'center'},
    statsContainer: { flexDirection: "row", justifyContent: "space-around", alignItems: 'center', marginVertical: 16, width: "80%", paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F3F4F6', },
    statItem: { alignItems: "center", paddingHorizontal: 10 },
    statValue: { fontSize: 18, fontWeight: "600", color: APP_CONSTANTS.COLORS.PRIMARY, },
    statLabel: { fontSize: 12, color: "#6B7280", marginTop: 2, },
    separator: { backgroundColor: "#E5E7EB", },
    section: { marginBottom: 24, paddingHorizontal: 16, },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6", },
    sectionTitleContainer: { flexDirection: "row", alignItems: "center", flexShrink: 1, },
    sectionIcon: { marginRight: 10, },
    sectionTitle: { fontSize: 18, fontWeight: "600", color: "#111827", marginRight: 8, },
    dataMissingText: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingVertical: 20, paddingHorizontal: 10, fontStyle: 'italic', backgroundColor: '#F9FAFB', borderRadius: 8, marginTop: 4, },
    bioDetailsListContainer: { width: '100%', marginTop: 4, },
    bioDetailItem: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'flex-start', marginBottom: 10, paddingHorizontal: 0, },
    bioDetailLabel: { fontSize: 14, color: '#4B5563', fontWeight: '600', width: '45%', marginRight: 8, },
    bioDetailValue: { fontSize: 14, color: '#1F2937', flex: 1, textAlign: 'left', },
    tagsContainer: { flexDirection: "row", flexWrap: "wrap", marginTop: 4, },
    genreTag: { backgroundColor: "rgba(59, 130, 246, 0.1)", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 8, marginBottom: 8, },
    genreTagText: { color: APP_CONSTANTS.COLORS.PRIMARY, fontSize: 13, fontWeight: '500', },
    locationText: { fontSize: 14, color: "#6B7280", marginLeft: 0, textAlign: 'center' },
    listContainer: { marginTop: 4, },
    listItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: "#F3F4F6", },
    listItemText: { fontSize: 14, fontWeight: "500", color: "#1F2937", flexShrink: 1, paddingRight: 10 },
    listItemSubtext: { fontSize: 12, color: "#6B7280", marginTop: 2, },
    seeAllButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, marginTop: 4, },
    seeAllButtonText: { color: APP_CONSTANTS.COLORS.PRIMARY, fontSize: 14, fontWeight: '500', marginRight: 4, },
});


export default OtherUserProfileScreen;