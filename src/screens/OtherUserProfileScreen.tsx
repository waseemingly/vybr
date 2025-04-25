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
const DEFAULT_PROFILE_PIC = APP_CONSTANTS?.DEFAULT_PROFILE_PIC || 'https://via.placeholder.com/150/CCCCCC/808080?text=No+Image';
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

    const currentUserId = session?.user?.id;

    // --- Data Fetching ---
    const fetchProfileData = useCallback(async () => {
        if (!profileUserId) { setError("User ID not provided."); return; } // No need to set loading false here
        setError(null); console.log(`[OtherUserProfileScreen] Fetching profile for ${profileUserId}`);
        try {
            const { data: profile, error: profileError } = await supabase.from('music_lover_profiles').select('*').eq('user_id', profileUserId).single();
            if (profileError && profileError.code !== 'PGRST116') { throw profileError; }
            if (!profile) { setProfileData(null); setError("Profile not found."); console.log(`[OtherUserProfileScreen] Profile not found.`); return; } // Set error state here
            setProfileData(profile as MusicLoverProfile);
            await fetchFriendsCount(); // Fetch count after profile data is set
        } catch (err: any) { console.error("Error fetching profile data:", err); setError(err.message || "Could not load profile."); setProfileData(null); }
    }, [profileUserId]); // Removed fetchFriendsCount from deps

    const fetchFriendsCount = useCallback(async () => {
        if (!profileUserId) return;
        console.log("[OtherUserProfileScreen] Fetching friends count...");
        try {
            const { count, error } = await supabase.from('friends').select('*', { count: 'exact', head: true }).or(`user_id_1.eq.${profileUserId},user_id_2.eq.${profileUserId}`).eq('status', 'accepted');
            if (!error) setFriendCount(count ?? 0);
            else console.error("Error fetching friend count:", error);
        } catch (e) { console.error("Error fetching friend count:", e) }
    }, [profileUserId]);

    const fetchInteractionStatus = useCallback(async () => {
        if (!currentUserId || !profileUserId || currentUserId === profileUserId) { setFriendshipStatus('not_friends'); setIsMuted(false); setIsBlocked(false); return; }
        console.log(`[OtherUserProfileScreen] Fetching interaction status (Direct Add) between ${currentUserId} and ${profileUserId}`);
        setFriendshipStatus('loading'); // Indicate status loading
        try {
            const { data: blockData, error: blockError } = await supabase.from('blocks').select('blocker_id').or(`and(blocker_id.eq.${currentUserId},blocked_id.eq.${profileUserId}),and(blocker_id.eq.${profileUserId},blocked_id.eq.${currentUserId})`);
            if (blockError) throw blockError;
            const blockedByCurrentUser = blockData?.some(b => b.blocker_id === currentUserId) ?? false;
            const blockedByProfileUser = blockData?.some(b => b.blocker_id === profileUserId) ?? false;
            setIsBlocked(blockedByCurrentUser); // Set block status based on current user
            if (blockedByCurrentUser) { setFriendshipStatus('blocked_by_you'); setIsMuted(false); return; }
            if (blockedByProfileUser) { setFriendshipStatus('blocked_by_them'); setIsMuted(false); return; }

            const { data: friendData, error: friendError } = await supabase.from('friends').select('status').or(`and(user_id_1.eq.${currentUserId},user_id_2.eq.${profileUserId}),and(user_id_1.eq.${profileUserId},user_id_2.eq.${currentUserId})`).eq('status', 'accepted').maybeSingle();
            if (friendError) throw friendError;
            const isCurrentlyFriends = !!friendData; // True if 'accepted' record exists
            setFriendshipStatus(isCurrentlyFriends ? 'friends' : 'not_friends');
            console.log(`[OtherUserProfileScreen] Status: ${isCurrentlyFriends ? 'Friends' : 'Not friends'}`);

            if (!isCurrentlyFriends) { // Only check mute if not friends (or check always?) - Let's check always for simplicity
                 const { count: muteCount, error: muteError } = await supabase.from('mutes').select('*', { count: 'exact', head: true }).eq('muter_id', currentUserId).eq('muted_id', profileUserId);
                 if (muteError) throw muteError;
                 const mutedResult = (muteCount ?? 0) > 0;
                 setIsMuted(mutedResult); console.log(`[OtherUserProfileScreen] Mute status: ${mutedResult}`);
            } else {
                 setIsMuted(false); // Assume not muted if friends? Or fetch anyway? Fetching always is safer.
                 const { count: muteCount, error: muteError } = await supabase.from('mutes').select('*', { count: 'exact', head: true }).eq('muter_id', currentUserId).eq('muted_id', profileUserId);
                 if (muteError) throw muteError;
                 const mutedResult = (muteCount ?? 0) > 0;
                 setIsMuted(mutedResult); console.log(`[OtherUserProfileScreen] Mute status (friends check): ${mutedResult}`);
            }

        } catch (err: any) { console.error("Error fetching interaction status:", err); setFriendshipStatus('error'); setIsMuted(false); setIsBlocked(false); }
    }, [currentUserId, profileUserId]);

    // --- Initial data fetch ---
    useEffect(() => {
        setIsLoading(true);
        fetchProfileData().finally(() => setIsLoading(false));
    }, [fetchProfileData]);

    // --- Interaction status fetch on focus ---
     useFocusEffect(
         useCallback(() => {
             console.log(`[OtherUserProfileScreen] Focus effect: Fetching interaction status.`);
             // Fetch status immediately on focus, don't wait for isLoading
             fetchInteractionStatus();
         }, [fetchInteractionStatus]) // Only depends on the stable callback
     );

    // --- Set Header Options ---
    useEffect(() => {
        // Function to derive header state from current component state
        const getHeaderConfig = () => {
            let title = 'User Profile'; let canChat = false; let profileUserNameForChat = 'User';
            const currentBlockStatus = isBlocked; // Read latest state
            const currentFriendshipStatus = friendshipStatus; // Read latest state

            if (isLoading && !profileData) { // Show loading only if profile isn't available yet
                 title = 'Loading Profile...';
             } else if (currentFriendshipStatus === 'blocked_by_them') {
                title = 'Profile Unavailable';
            } else if (profileData) { // Use profile data if available
                const fetchedUserName = `${profileData.firstName ?? ''} ${profileData.lastName ?? ''}`.trim();
                title = fetchedUserName || 'User Profile';
                profileUserNameForChat = fetchedUserName || 'User';
                canChat = !currentBlockStatus; // Can chat if not blocked BY YOU
            } else if (error) { // Handle error state
                 title = 'Error Loading';
             } else { // Fallback if profileData is null after loading without specific error
                title = 'Profile Not Found';
            }
            return { title, canChat, profileUserNameForChat };
        };

        const { title, canChat, profileUserNameForChat } = getHeaderConfig();
        console.log(`[OtherUserProfileScreen] Updating header - Title: ${title}, CanChat: ${canChat}`);

        navigation.setOptions({
            headerShown: true, headerTitle: title, headerTitleAlign: 'center', headerBackTitleVisible: false,
            headerLeft: () => ( <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: Platform.OS === 'ios' ? 10 : 0, padding: 5 }}> <Feather name="chevron-left" size={26} color={APP_CONSTANTS.COLORS.PRIMARY} /> </TouchableOpacity> ),
            headerRight: () => (
                <TouchableOpacity onPress={() => navigation.navigate('IndividualChatScreen', { matchUserId: profileUserId, matchName: profileUserNameForChat })} style={{ marginRight: Platform.OS === 'ios' ? 10 : 15, padding: 5 }} disabled={!canChat} >
                    <Feather name="message-circle" size={24} color={canChat ? APP_CONSTANTS.COLORS.PRIMARY : APP_CONSTANTS.COLORS.DISABLED} />
                </TouchableOpacity>
            ),
            headerStyle: { backgroundColor: 'white' }, headerTitleStyle: { fontWeight: '600', color: '#1F2937' },
        });
    // Depend on all states that influence the header's content/behavior
    }, [navigation, profileData, profileUserId, isLoading, error, friendshipStatus, isBlocked]);


    // --- Action Handlers ---
    const handleAddFriendDirectly = async () => {
        if (!currentUserId || friendshipStatus !== 'not_friends') return;
        console.log(`[OtherUserProfileScreen] Adding friend directly: ${profileUserId}`);
        setFriendshipStatus('loading');
        try {
            const { error } = await supabase.from('friends').insert({ user_id_1: currentUserId, user_id_2: profileUserId, status: 'accepted' }); // Rely on DB trigger/constraint for order/uniqueness
            if (error) throw error; // Let RLS handle violation check
            setFriendshipStatus('friends'); fetchFriendsCount(); // Refresh count on success
        } catch (err: any) { console.error("Error adding friend:", err); Alert.alert("Error", `Could not add friend: ${err.message}`); fetchInteractionStatus(); } // Refetch status on error
    };

    const handleUnfriend = async () => {
        if (!currentUserId || friendshipStatus !== 'friends') return; Alert.alert("Unfriend User", `Remove ${profileData?.firstName ?? 'this user'} as friend?`, [ { text: "Cancel", style: "cancel" }, { text: "Unfriend", style: "destructive", onPress: async () => { setFriendshipStatus('loading'); try { const { error } = await supabase.from('friends').delete().or(`and(user_id_1.eq.${currentUserId},user_id_2.eq.${profileUserId}),and(user_id_1.eq.${profileUserId},user_id_2.eq.${currentUserId})`).eq('status', 'accepted'); if (error) throw error; setFriendshipStatus('not_friends'); fetchFriendsCount(); } catch (err: any) { console.error("Error unfriending:", err); Alert.alert("Error", "Could not unfriend."); setFriendshipStatus('friends'); } } } ]);
    };
    const handleToggleMute = async () => { if (!currentUserId || isBlocked || friendshipStatus === 'blocked_by_them') return; const currentlyMuted = isMuted; console.log(`[OtherUserProfileScreen] Attempting to ${currentlyMuted ? 'unmute' : 'mute'} user ${profileUserId}`); setIsMuted(!currentlyMuted); try { if (currentlyMuted) { const { error } = await supabase.from('mutes').delete().eq('muter_id', currentUserId).eq('muted_id', profileUserId); if (error) throw error; console.log(`[OtherUserProfileScreen] Successfully unmuted user ${profileUserId}`); } else { const { error } = await supabase.from('mutes').insert({ muter_id: currentUserId, muted_id: profileUserId }); if (error && error.code !== '23505') { throw error; } else if (error?.code === '23505') { console.warn(`[OtherUserProfileScreen] Already muted user ${profileUserId}, but proceeding.`); } console.log(`[OtherUserProfileScreen] Successfully muted user ${profileUserId}`); } } catch (err: any) { console.error(`[OtherUserProfileScreen] Raw Error object (${currentlyMuted ? 'unmuting' : 'muting'}):`, err); const errorMessage = err.message || err.details || err.hint || 'An unexpected error occurred.'; console.error(`[OtherUserProfileScreen] Parsed Error Message: ${errorMessage}`); Alert.alert("Error", `Could not ${currentlyMuted ? 'unmute' : 'mute'} user. ${errorMessage}`); setIsMuted(currentlyMuted); } };
    const handleBlock = async () => { if (!currentUserId || isBlocked) return; Alert.alert( "Block User", `Block ${profileData?.firstName ?? 'this user'}? You won't see their profile or messages. This action cannot be undone from their profile.`, [ { text: "Cancel", style: "cancel" }, { text: "Block", style: "destructive", onPress: async () => { setFriendshipStatus('loading'); setIsBlocked(true); setIsMuted(false); try { await supabase.from('friends').delete().or(`and(user_id_1.eq.${currentUserId},user_id_2.eq.${profileUserId}),and(user_id_1.eq.${profileUserId},user_id_2.eq.${currentUserId})`); const { error: blockError } = await supabase.from('blocks').insert({ blocker_id: currentUserId, blocked_id: profileUserId }); if (blockError && blockError.code !== '23505') throw blockError; setFriendshipStatus('blocked_by_you'); console.log("User blocked"); navigation.navigate('MainApp', { screen: 'UserTabs', params: { screen: 'Matches' } }); } catch (err: any) { console.error("Error blocking user:", err); Alert.alert("Error", "Could not block user."); setIsBlocked(false); fetchInteractionStatus(); } } } ] ); };
    const handleUnblock = async () => { if (!currentUserId || !isBlocked) return; setIsBlocked(false); setFriendshipStatus('loading'); try { const { error } = await supabase.from('blocks').delete().eq('blocker_id', currentUserId).eq('blocked_id', profileUserId); if (error) throw error; console.log("User unblocked"); fetchInteractionStatus(); } catch (err: any) { console.error("Error unblocking user:", err); Alert.alert("Error", "Could not unblock user."); setIsBlocked(true); setFriendshipStatus('blocked_by_you'); } };
    const submitReport = async () => { if (!currentUserId || !profileUserId || !reportReason.trim()) { Alert.alert("Error", "Please provide a reason for the report."); return; } setIsSubmittingReport(true); setError(null); try { const { error: reportError } = await supabase.from('reports').insert({ reporter_id: currentUserId, reported_id: profileUserId, reason: reportReason.trim(), }); if (reportError) throw reportError; await supabase.from('friends').delete().or(`and(user_id_1.eq.${currentUserId},user_id_2.eq.${profileUserId}),and(user_id_1.eq.${profileUserId},user_id_2.eq.${currentUserId})`); const { error: blockError } = await supabase.from('blocks').insert({ blocker_id: currentUserId, blocked_id: profileUserId }); if (blockError && blockError.code !== '23505') throw blockError; setReportReason(''); setReportModalVisible(false); setIsBlocked(true); setFriendshipStatus('blocked_by_you'); setIsMuted(false); Alert.alert("Report Submitted", "User reported and blocked."); navigation.navigate('MainApp', { screen: 'UserTabs', params: { screen: 'Matches' } }); } catch (err: any) { console.error("Error submitting report and blocking:", err); setError("Failed to submit report. Please try again."); Alert.alert("Error", "Failed to submit report."); } finally { setIsSubmittingReport(false); } };


    // --- Render Logic ---
    if (isLoading && !profileData) { return <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} /></View>; }
    if (!profileData && !isLoading) { return ( <View style={styles.centered}><Feather name={error === "Profile not found." ? "user-x" : "alert-circle"} size={48} color={APP_CONSTANTS.COLORS.WARNING} /><Text style={styles.errorText}>{error || "Profile Not Found"}</Text><Text style={styles.infoSubText}>User may not exist or load failed.</Text>{error && error !== "Profile not found." && ( <TouchableOpacity onPress={fetchProfileData} style={styles.retryButton}><Text style={styles.retryButtonText}>Try Again</Text></TouchableOpacity>)}</View> );}
    if (friendshipStatus === 'blocked_by_them') { return ( <View style={styles.container}><View style={styles.centered}><Feather name="slash" size={60} color={APP_CONSTANTS.COLORS.DISABLED} /><Text style={styles.infoText}>You cannot view this profile.</Text></View></View> ); }
    if (!profileData) return null; // Safety net

    // --- Data Extraction ---
    const profilePictureUrl = profileData.profilePicture ?? DEFAULT_PROFILE_PIC;
    const userName = `${profileData.firstName ?? ''} ${profileData.lastName ?? ''}`.trim() || "User";
    const userAge = profileData.age; const userCity = profileData.city; const userCountry = profileData.country; const isPremium = profileData.isPremium ?? false;
    const allBioDetails = profileData.bio ? Object.entries(profileData.bio).filter(([_, v]) => v && String(v).trim() !== '').map(([k, v]) => ({ label: bioDetailLabels[k as keyof MusicLoverBio] || k, value: String(v).trim() })) : [];
    const favoriteGenres = (profileData.musicData?.genres as string[]) ?? [];

    // --- Dynamic Action Buttons ---
    const renderFriendButton = () => {
        const buttonStyle = [styles.actionButton, styles.friendButton]; let iconName: React.ComponentProps<typeof Feather>['name'] = 'user-plus'; let buttonText = 'Add Friend'; let onPress = handleAddFriendDirectly; let disabled = friendshipStatus === 'loading' || friendshipStatus === 'error' || friendshipStatus === 'blocked_by_you';
        switch (friendshipStatus) { case 'loading': buttonText = 'Loading...'; break; case 'friends': iconName = 'user-check'; buttonText = 'Friends'; buttonStyle.push(styles.friendsButton); onPress = handleUnfriend; break; case 'blocked_by_you': return null; case 'error': buttonText = 'Error'; break; case 'not_friends': default: iconName = 'user-plus'; buttonText = 'Add Friend'; onPress = handleAddFriendDirectly; break; }
        return ( <TouchableOpacity style={[...buttonStyle, disabled && styles.disabledButton]} onPress={onPress} disabled={disabled}> <Feather name={iconName} size={16} color={friendshipStatus === 'friends' ? APP_CONSTANTS.COLORS.SUCCESS_DARK : 'white'} /> <Text style={[styles.actionButtonText, friendshipStatus === 'friends' && styles.actionButtonTextDark]}> {buttonText} </Text> </TouchableOpacity> );
     };
     const renderMuteButton = () => { if (isBlocked) return null; const iconName: React.ComponentProps<typeof Feather>['name'] = isMuted ? 'volume-x' : 'volume-2'; const text = isMuted ? 'Unmute User' : 'Mute User'; const buttonStyle = [styles.actionButton, styles.secondaryButton, isMuted && styles.mutedButton]; return ( <TouchableOpacity style={buttonStyle} onPress={handleToggleMute}> <Feather name={iconName} size={16} color={isMuted ? APP_CONSTANTS.COLORS.WARNING_DARK : APP_CONSTANTS.COLORS.TEXT_SECONDARY} /> <Text style={[styles.actionButtonText, styles.secondaryButtonText, isMuted && styles.mutedButtonText]}>{text}</Text> </TouchableOpacity> ); };
     const renderBlockButton = () => { if (isBlocked) { return ( <TouchableOpacity style={[styles.actionButton, styles.unblockButton]} onPress={handleUnblock}> <Feather name="unlock" size={16} color={APP_CONSTANTS.COLORS.SUCCESS_DARK} /> <Text style={[styles.actionButtonText, styles.unblockButtonText]}>Unblock User</Text> </TouchableOpacity> ); } else { return ( <TouchableOpacity style={[styles.actionButton, styles.reportButton]} onPress={() => setReportModalVisible(true)}> <Feather name="alert-octagon" size={16} color={APP_CONSTANTS.COLORS.ERROR} /> <Text style={[styles.actionButtonText, styles.reportButtonText]}>Report / Block</Text> </TouchableOpacity> ); } };

    // --- Main Return ---
    return (
        <View style={styles.container}>
            <Modal animationType="slide" transparent={true} visible={reportModalVisible} onRequestClose={() => { if (!isSubmittingReport) setReportModalVisible(false); }} >
                <View style={styles.modalOverlay}><View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Report and Block {userName}</Text>
                    <Text style={styles.modalSubtitle}>Reason for report? User will be blocked.</Text>
                    <TextInput style={styles.reportInput} placeholder="Reason..." value={reportReason} onChangeText={setReportReason} multiline maxLength={500} />
                    {isSubmittingReport && error && <Text style={styles.modalErrorText}>{error}</Text>}
                    <View style={styles.modalActions}>
                        <TouchableOpacity style={[styles.modalButton, styles.modalCancelButton]} onPress={() => setReportModalVisible(false)} disabled={isSubmittingReport}><Text style={styles.modalCancelButtonText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, styles.modalSubmitButton, (!reportReason.trim() || isSubmittingReport) && styles.disabledButton]} onPress={submitReport} disabled={!reportReason.trim() || isSubmittingReport} >
                            {isSubmittingReport ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.modalSubmitButtonText}>Submit & Block</Text>}
                        </TouchableOpacity>
                    </View>
                </View></View>
            </Modal>
            <ScrollView style={profileStyles.scrollViewContainer} contentContainerStyle={profileStyles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={profileStyles.profileCard}>
                    <LinearGradient colors={[APP_CONSTANTS.COLORS.PRIMARY_LIGHT, APP_CONSTANTS.COLORS.PRIMARY]} style={[profileStyles.coverPhoto, { height: 90 }]} />
                    <View style={[profileStyles.avatarContainer, { top: 40 }]}><Image source={{ uri: profilePictureUrl }} style={[profileStyles.avatar, { width: 90, height: 90, borderRadius: 45 }]} /></View>
                    <View style={[profileStyles.profileInfo, { paddingTop: 55 }]}>
                        <View style={profileStyles.nameContainer}><Text style={profileStyles.name}>{userName}</Text>{isPremium && (<View style={profileStyles.premiumBadgeName}><Feather name="award" size={10} color="#B8860B" /><Text style={profileStyles.premiumTextName}>Premium</Text></View>)}</View>
                        <View style={profileStyles.locationAgeContainer}>
                            {userAge && <Text style={profileStyles.age}>{userAge} y/o</Text>}
                            {/* Fix: Ensure Text wraps the separator */}
                            {(userCity || userCountry) && userAge && <Text style={profileStyles.locationSeparator}> • </Text>}
                            {(userCity || userCountry) && (
                                <View style={profileStyles.locationRow}>
                                    <Feather name="map-pin" size={12} color="#6B7280" style={{ marginRight: 4 }}/>
                                    <Text style={profileStyles.location}>{userCity}{userCity && userCountry ? ', ' : ''}{userCountry}</Text>
                                </View>
                            )}
                        </View>
                        <View style={profileStyles.statsContainer}><View style={profileStyles.statItem}><Text style={profileStyles.statValue}>{friendCount}</Text><Text style={profileStyles.statLabel}>Friends</Text></View></View>
                    </View>
                </View>
                <View style={styles.actionsRow}>{renderFriendButton()}</View>
                <ProfileSection title="Things About Them" icon="info" hasData={allBioDetails.length > 0}><View style={profileStyles.bioDetailsListContainer}>{allBioDetails.map((d, i) => (<View key={i} style={profileStyles.bioDetailItem}><Text style={profileStyles.bioDetailLabel}>{d.label}:</Text><Text style={profileStyles.bioDetailValue}>{d.value}</Text></View>))}</View></ProfileSection>
                <ProfileSection title="Favorite Genres" icon="music" hasData={favoriteGenres.length > 0}><View style={profileStyles.tagsContainer}>{favoriteGenres.map((g, i) => (<View key={i} style={profileStyles.genreTag}><Text style={profileStyles.genreTagText}>{g}</Text></View>))}</View></ProfileSection>
                <View style={styles.moreOptionsSection}><Text style={styles.moreOptionsTitle}>More Options</Text>{renderMuteButton()}{renderBlockButton()}</View>
            </ScrollView>
        </View>
    );
};

// --- Styles ---
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: "#F9FAFB", }, centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, }, errorText: { color: APP_CONSTANTS.COLORS.ERROR, fontSize: 16, textAlign: 'center', marginBottom: 10 }, infoText: { fontSize: 16, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, textAlign: 'center', marginTop: 10, }, infoSubText: { fontSize: 14, color: APP_CONSTANTS.COLORS.DISABLED, textAlign: 'center', marginTop: 5 }, retryButton: { marginTop: 20, backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, }, retryButtonText: { color: 'white', fontWeight: '600' }, actionsRow: { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 16, marginBottom: 24, marginTop: -10, gap: 10, }, actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2, minWidth: 120, borderWidth: 1, borderColor: 'transparent', }, actionButtonText: { marginLeft: 8, fontSize: 14, fontWeight: '600', color: 'white', }, actionButtonTextDark: { color: '#374151', }, friendButton: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, borderColor: APP_CONSTANTS.COLORS.PRIMARY_DARK, }, friendsButton: { backgroundColor: APP_CONSTANTS.COLORS.SUCCESS_LIGHT, borderColor: APP_CONSTANTS.COLORS.SUCCESS, }, disabledButton: { backgroundColor: '#D1D5DB', shadowOpacity: 0, elevation: 0, borderColor: '#B0B0B0' }, moreOptionsSection: { marginTop: 16, marginBottom: 32, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 20, }, moreOptionsTitle: { fontSize: 16, fontWeight: '600', color: '#4B5563', marginBottom: 15, textAlign: 'center', }, secondaryButton: { backgroundColor: '#F3F4F6', marginBottom: 12, shadowOpacity: 0.05, elevation: 1, borderColor: '#E5E7EB', borderWidth: 1, justifyContent: 'flex-start', paddingHorizontal: 16, width: '100%', borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, }, secondaryButtonText: { color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, fontWeight: '500', marginLeft: 8, fontSize: 14, }, mutedButton: { backgroundColor: APP_CONSTANTS.COLORS.WARNING_LIGHT, borderColor: APP_CONSTANTS.COLORS.WARNING, }, mutedButtonText: { color: APP_CONSTANTS.COLORS.WARNING_DARK, }, reportButton: { backgroundColor: `${APP_CONSTANTS.COLORS.ERROR}1A`, borderColor: APP_CONSTANTS.COLORS.ERROR, borderWidth: 1, justifyContent: 'flex-start', paddingHorizontal: 16, width: '100%', marginBottom: 12, shadowOpacity: 0.05, elevation: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, }, reportButtonText: { color: APP_CONSTANTS.COLORS.ERROR, fontWeight: '500', marginLeft: 8, fontSize: 14, }, unblockButton: { backgroundColor: `${APP_CONSTANTS.COLORS.SUCCESS_LIGHT}CC`, borderColor: APP_CONSTANTS.COLORS.SUCCESS, borderWidth: 1, justifyContent: 'flex-start', paddingHorizontal: 16, width: '100%', marginBottom: 12, shadowOpacity: 0.05, elevation: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, }, unblockButtonText: { color: APP_CONSTANTS.COLORS.SUCCESS_DARK, fontWeight: '500', marginLeft: 8, fontSize: 14, }, modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)', }, modalContent: { width: '90%', maxWidth: 400, backgroundColor: 'white', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, }, modalTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 8, textAlign: 'center', }, modalSubtitle: { fontSize: 14, color: '#4B5563', marginBottom: 16, textAlign: 'center', lineHeight: 20, }, reportInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', fontSize: 14, color: '#1F2937', marginBottom: 16, }, modalErrorText: { color: APP_CONSTANTS.COLORS.ERROR, fontSize: 13, textAlign: 'center', marginBottom: 10, }, modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, }, modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', }, modalCancelButton: { backgroundColor: '#E5E7EB', marginRight: 10, }, modalCancelButtonText: { color: '#4B5563', fontWeight: '600', }, modalSubmitButton: { backgroundColor: APP_CONSTANTS.COLORS.ERROR, marginLeft: 10, }, modalSubmitButtonText: { color: 'white', fontWeight: '600', }, });
const profileStyles = StyleSheet.create({ scrollViewContainer: { flex: 1, }, scrollContent: { paddingBottom: 40, paddingTop: 16, }, profileCard: { backgroundColor: "white", borderRadius: 16, marginBottom: 24, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5, elevation: 3, marginHorizontal: 16, }, coverPhoto: { height: 120, width: "100%", }, avatarContainer: { position: "absolute", top: 65, alignSelf: 'center', backgroundColor: "white", borderRadius: 55, padding: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 4, }, avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: 'white', }, profileInfo: { paddingTop: 65, paddingBottom: 20, paddingHorizontal: 20, alignItems: "center", }, nameContainer: { flexDirection: "row", alignItems: "center", justifyContent: 'center', marginBottom: 4, flexWrap: 'wrap', }, name: { fontSize: 22, fontWeight: "bold", color: "#1F2937", marginRight: 8, textAlign: 'center', }, premiumBadgeName: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255, 215, 0, 0.15)", paddingVertical: 3, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255, 215, 0, 0.4)", }, premiumTextName: { color: "#B8860B", fontSize: 10, fontWeight: "600", marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5, }, locationAgeContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' }, age: { fontSize: 14, color: "#6B7280", }, locationSeparator: { color: "#D1D5DB", marginHorizontal: 6, fontSize: 14, }, locationRow: { flexDirection: 'row', alignItems: 'center'}, // Added wrapper View
    location: { fontSize: 14, color: "#6B7280", marginLeft: 0, textAlign: 'center' }, // Removed margin left
    statsContainer: { flexDirection: "row", justifyContent: "space-around", alignItems: 'center', marginVertical: 16, width: "80%", paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F3F4F6', }, statItem: { alignItems: "center", paddingHorizontal: 10 }, statValue: { fontSize: 18, fontWeight: "600", color: APP_CONSTANTS.COLORS.PRIMARY, }, statLabel: { fontSize: 12, color: "#6B7280", marginTop: 2, }, separator: { backgroundColor: "#E5E7EB", }, section: { marginBottom: 24, paddingHorizontal: 16, }, sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6", }, sectionTitleContainer: { flexDirection: "row", alignItems: "center", flexShrink: 1, }, sectionIcon: { marginRight: 10, }, sectionTitle: { fontSize: 18, fontWeight: "600", color: "#111827", marginRight: 8, }, dataMissingText: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingVertical: 20, paddingHorizontal: 10, fontStyle: 'italic', backgroundColor: '#F9FAFB', borderRadius: 8, marginTop: 4, }, bioDetailsListContainer: { width: '100%', marginTop: 4, }, bioDetailItem: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'flex-start', marginBottom: 10, paddingHorizontal: 0, }, bioDetailLabel: { fontSize: 14, color: '#4B5563', fontWeight: '600', width: '45%', marginRight: 8, }, bioDetailValue: { fontSize: 14, color: '#1F2937', flex: 1, textAlign: 'left', }, tagsContainer: { flexDirection: "row", flexWrap: "wrap", marginTop: 4, }, genreTag: { backgroundColor: "rgba(59, 130, 246, 0.1)", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 8, marginBottom: 8, }, genreTagText: { color: APP_CONSTANTS.COLORS.PRIMARY, fontSize: 13, fontWeight: '500', }, });

export default OtherUserProfileScreen;