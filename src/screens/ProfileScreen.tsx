import React, { useState, useEffect, useCallback } from "react";
import {
    View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
    Dimensions, ActivityIndicator, Alert, Platform, RefreshControl,
    FlatList, Modal
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useOrganizerMode } from "@/hooks/useOrganizerMode";
import { useAuth, MusicLoverBio } from "@/hooks/useAuth";
import { useStreamingData, TopArtist, TopTrack, TopGenre, TopMood } from '@/hooks/useStreamingData';
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth';
// import { useYouTubeMusicAuth } from '@/hooks/useYouTubeMusicAuth';
import { APP_CONSTANTS } from "@/config/constants";
import { useNavigation, useFocusEffect, useRoute, useNavigationState } from "@react-navigation/native";
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { supabase } from "@/lib/supabase";
import type { RootStackParamList, MainStackParamList, UserTabParamList, OrganizerTabParamList } from '@/navigation/AppNavigator';
import PremiumSignupScreen from '@/screens/auth/PremiumSignupScreen';
import PaymentSuccessScreen from '@/screens/auth/PaymentSuccessScreen';

// --- Navigation Type ---
// Keep type broad to allow navigation to various stacks
type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList & MainStackParamList>;
type ProfileScreenRouteProp = RouteProp<UserTabParamList, 'Profile'>;

// Used for route params from navigation
type ProfileScreenRouteProps = {
    goToLinkMusic?: boolean;
    autoLinkSpotify?: boolean;
    // autoLinkYouTubeMusic?: boolean;
};

// Update Link Music Screen route params type
type LinkMusicServicesScreenParams = {
    autoLinkSpotify?: boolean;
    // autoLinkYouTubeMusic?: boolean;
};

// --- Constants & Components ---
const DEFAULT_PROFILE_PIC = APP_CONSTANTS?.DEFAULT_PROFILE_PIC || 'https://via.placeholder.com/150/CCCCCC/808080?text=No+Image';
interface SeparatorProps { vertical?: boolean; style?: object; }
const Separator: React.FC<SeparatorProps> = ({ vertical = false, style = {} }) => ( <View style={[ styles.separator, vertical ? { height: '60%', width: 1 } : { height: 1, width: "100%" }, style ]} /> );

interface ProfileSectionProps { title: string; icon: React.ComponentProps<typeof Feather>['name']; children: React.ReactNode; isPremiumFeature?: boolean; isPremiumUser?: boolean; expanded?: boolean; onToggle?: () => void; hasData?: boolean; }
const ProfileSection: React.FC<ProfileSectionProps> = (props) => {
    const { title, icon, children, isPremiumFeature = false, isPremiumUser = false, expanded = true, onToggle, hasData = true } = props;
    const canToggle = !!onToggle;
    const showContent = expanded;

    return (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleContainer}>
                    <Feather name={icon} size={18} color={APP_CONSTANTS.COLORS.PRIMARY} style={styles.sectionIcon} />
                    <Text style={styles.sectionTitle}>{title}</Text>
                    {isPremiumFeature && (
                        <View style={[styles.premiumBadgePill, !isPremiumUser && styles.premiumBadgeLocked]}>
                            <Feather name="award" size={10} color={isPremiumUser ? "#B8860B" : "#A0A0A0"} />
                            <Text style={[styles.premiumTextPill, !isPremiumUser && styles.premiumTextLocked]}>
                                {isPremiumUser ? 'Premium' : 'Locked'}
                            </Text>
                        </View>
                    )}
                </View>
                {canToggle && onToggle && (
                    <TouchableOpacity onPress={onToggle} style={styles.toggleButton}>
                        <Text style={styles.toggleButtonText}>{expanded ? "See Less" : "See More"}</Text>
                        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={APP_CONSTANTS.COLORS.PRIMARY} style={styles.toggleIcon} />
                    </TouchableOpacity>
                )}
            </View>
            {showContent && hasData && children}
            {showContent && !hasData && !isPremiumFeature && (<Text style={styles.dataMissingText}>Nothing here yet!</Text>)}
            {isPremiumFeature && !isPremiumUser && (<View style={styles.lockedContent}><Feather name="lock" size={16} color="#A0A0A0" style={{marginRight: 5}} /><Text style={styles.lockedText}>Upgrade to Premium to unlock.</Text></View>)}
            {showContent && !hasData && isPremiumFeature && isPremiumUser && (<Text style={styles.dataMissingText}>No analytics data available yet.</Text>)}
        </View>
    );
};

const bioDetailLabels: Record<keyof MusicLoverBio, string> = {
    firstSong: "First Concert / Memory", goToSong: "Go-To Song Right Now", mustListenAlbum: "Must-Listen Album", dreamConcert: "Dream Concert Lineup", musicTaste: "Music Taste Description",
};

// --- Component Types ---
type ExpandedSections = {
    artists: boolean;
    songs: boolean;
    analytics: boolean;
    tracks: boolean;
    genres: boolean;
    moods: boolean;
    favArtists: boolean;
    favSongs: boolean;
    favAlbums: boolean;
};

// --- ProfileScreen Component ---
const ProfileScreen: React.FC = () => {
    const { session, loading: authLoading, logout, musicLoverProfile, refreshUserProfile } = useAuth();
    const { toggleOrganizerMode } = useOrganizerMode();
    const navigation = useNavigation<ProfileScreenNavigationProp>();
    const route = useRoute();
    const userId = session?.user?.id;
    const { isLoggedIn: isSpotifyLoggedIn, forceFetchAndSaveSpotifyData, accessToken: spotifyAccessToken, isLoading: spotifyAuthLoading, login: spotifyLogin, error: spotifyError } = useSpotifyAuth();
    // const { isLoggedIn: isYouTubeMusicLoggedIn } = useYouTubeMusicAuth();
    // const isYouTubeMusicLoggedInPlaceholder = false; // Placeholder for YouTube Music status

    const { 
        streamingData, loading: streamingDataLoading, 
        topArtists, topTracks, topGenres, topMoods,
        serviceId, hasData, fetchStreamingData, 
        isServiceConnected
    } = useStreamingData(userId, {
        isSpotifyLoggedIn,
        spotifyAccessToken,
        // Removed: isYouTubeMusicLoggedIn: isYouTubeMusicLoggedInPlaceholder
    });
    
    const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
        artists: false,
        songs: false,
        analytics: true,
        tracks: false,
        genres: false,
        moods: false,
        favArtists: false,
        favSongs: false,
        favAlbums: false,
    });
    const [friendCount, setFriendCount] = useState<number>(0);
    const [followedOrganizersCount, setFollowedOrganizersCount] = useState<number>(0);
    const [countsLoading, setCountsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshingStreamingData, setRefreshingStreamingData] = useState(false);
    const [showSpotifyReconnectModal, setShowSpotifyReconnectModal] = useState(false);

    // Handle navigation to LinkMusicServicesScreen if requested via params
    useEffect(() => {
        // Use any type to avoid TypeScript errors with route.params
        const params = route.params as any;
        if (params?.goToLinkMusic) {
            console.log("[ProfileScreen] Detected goToLinkMusic flag. Navigating to LinkMusicServicesScreen...");
            // Update the navigation params to avoid infinite loop
            navigation.setParams({ 
                goToLinkMusic: undefined, 
                autoLinkSpotify: params.autoLinkSpotify,
            });
            // Navigate to LinkMusicServicesScreen with autoLink flags if present
            navigation.navigate('LinkMusicServicesScreen', { 
                autoLinkSpotify: params.autoLinkSpotify,
            });
        }
    }, [navigation, route.params]);

    // Initial streaming data fetch is handled inside `useStreamingData`.
    // Keeping an extra auto-fetch here caused repeated requests/log spam when the callback identity changed.


    // Add debug logging when streaming data changes
    useEffect(() => {
        // Reduce noisy logs in development; these were spamming terminals.
        if (!__DEV__) return;
        if (serviceId) {
            console.log(`[ProfileScreen] Streaming data loaded for service: ${serviceId}`);
        }
    }, [serviceId]);

    // Fetch friend count and followed organizers count
    const fetchCounts = useCallback(async () => {
        if (!userId) { setCountsLoading(false); return; }
        console.log("[ProfileScreen] Fetching counts (friends, following organizers)...");
        setCountsLoading(true);
        try {
            const [friendsRes, followingRes] = await Promise.all([
                // Fetch friends count
                supabase.from('friends')
                    .select('*', { count: 'exact', head: true })
                    .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
                    .eq('status', 'accepted'),
                // Fetch followed organizers count
                supabase.from('organizer_follows')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId)
            ]);

            if (friendsRes.error) console.error("[ProfileScreen] Error fetching friend count:", friendsRes.error);
            if (followingRes.error) console.error("[ProfileScreen] Error fetching following count:", followingRes.error);

            setFriendCount(friendsRes.count ?? 0);
            setFollowedOrganizersCount(followingRes.count ?? 0);
            console.log(`[ProfileScreen] Counts: Friends=${friendsRes.count ?? 0}, Following=${followingRes.count ?? 0}`);

        } catch (err: any) {
            console.error("[ProfileScreen] Error fetching counts:", err);
            setFriendCount(0);
            setFollowedOrganizersCount(0);
        }
        finally { setCountsLoading(false); }
    }, [userId]);

    useFocusEffect(useCallback(() => { fetchCounts(); }, [fetchCounts]));

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        try { 
            await Promise.all([
                refreshUserProfile(), 
                fetchCounts(),
                fetchStreamingData(true) // Pass true to force a re-fetch from the database
            ]); 
        }
        catch (error) { 
            console.error("Error during refresh:", error); 
            Alert.alert("Refresh Failed", "Could not update profile data."); 
        }
        finally { 
            setIsRefreshing(false); 
        }
    }, [refreshUserProfile, fetchCounts, fetchStreamingData]);

    const isPremium = musicLoverProfile?.isPremium ?? false;

    const toggleSection = (section: keyof ExpandedSections) => {
        setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    // Handle Spotify reconnection modal
    const handleSpotifyReconnect = useCallback(async () => {
        console.log('[ProfileScreen] Starting Spotify reconnection process...');
        setShowSpotifyReconnectModal(true);
    }, []);

    const handleSpotifyLoginInModal = useCallback(async () => {
        try {
            console.log('[ProfileScreen] Attempting Spotify login from modal...');
            await spotifyLogin();
            
            // The useEffect below will handle the success case
        } catch (error: any) {
            console.error('[ProfileScreen] Error during Spotify login:', error);
            Alert.alert(
                'Login Failed',
                'Failed to connect to Spotify. Please try again.',
                [{ text: 'OK' }]
            );
        }
    }, [spotifyLogin]);

    // Monitor Spotify auth state changes and handle modal closure
    useEffect(() => {
        if (showSpotifyReconnectModal && isSpotifyLoggedIn && spotifyAccessToken) {
            console.log('[ProfileScreen] Spotify login successful, closing modal and refreshing data...');
            setShowSpotifyReconnectModal(false);
            
            // Refresh data after successful reconnection
            const refreshAfterReconnect = async () => {
                try {
                    const premium = !!musicLoverProfile?.isPremium;
                    console.log('[ProfileScreen] Refreshing Spotify data after reconnection...');
                    
                    const success = await forceFetchAndSaveSpotifyData(userId!, premium);
                    if (success) {
                        await fetchStreamingData(true);
                        Alert.alert('Success!', 'Spotify reconnected and data refreshed successfully.');
                    } else {
                        Alert.alert('Partial Success', 'Spotify reconnected, but there was an issue refreshing your data. Please try refreshing manually.');
                    }
                } catch (error: any) {
                    console.error('[ProfileScreen] Error refreshing data after reconnection:', error);
                    Alert.alert('Reconnected', 'Spotify reconnected successfully. Please try refreshing your data manually.');
                }
            };
            
            refreshAfterReconnect();
        }
    }, [showSpotifyReconnectModal, isSpotifyLoggedIn, spotifyAccessToken, userId, musicLoverProfile, forceFetchAndSaveSpotifyData, fetchStreamingData]);

    // Handle Spotify auth errors in modal
    useEffect(() => {
        if (showSpotifyReconnectModal && spotifyError && !spotifyAuthLoading) {
            console.error('[ProfileScreen] Spotify auth error in modal:', spotifyError);
            Alert.alert(
                'Spotify Connection Failed',
                spotifyError,
                [
                    { text: 'Cancel', onPress: () => setShowSpotifyReconnectModal(false) },
                    { text: 'Try Again', onPress: handleSpotifyLoginInModal }
                ]
            );
        }
    }, [showSpotifyReconnectModal, spotifyError, spotifyAuthLoading, handleSpotifyLoginInModal]);

    // Handle manual refresh of streaming service data
    const handleForceRefreshStreamingData = useCallback(async (service: 'spotify') => {
        if (!musicLoverProfile || !userId) {
            console.warn(`[ProfileScreen] Cannot refresh ${service} data: Profile or user ID not loaded.`);
            return;
        }

        // Smart connectivity check
        const hasSpotifyAccess = !!spotifyAccessToken || isSpotifyLoggedIn;
        const hasExistingSpotifyData = serviceId === 'spotify' && hasData;
        const isStillLoading = spotifyAuthLoading;
        
        // If Spotify is still loading, wait a moment
        if (isStillLoading) {
            console.log(`[ProfileScreen] Spotify auth is still loading, waiting...`);
            Alert.alert("Loading", "Please wait while we check your Spotify connection...");
            return;
        }

        // If no access and no existing data, offer to connect
        if (!hasSpotifyAccess && !hasExistingSpotifyData) {
            console.log(`[ProfileScreen] Starting Spotify connection process...`);
            Alert.alert(
                "Spotify Not Connected", 
                `Your Spotify account is not connected. Would you like to connect it now?`,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Connect", onPress: handleSpotifyReconnect }
                ]
            );
            return;
        }

        // If we have existing data but no current access, automatically start reconnection
        if (!hasSpotifyAccess && hasExistingSpotifyData) {
            console.log(`[ProfileScreen] Starting Spotify reconnection process...`);
            handleSpotifyReconnect();
            return;
        }

        console.log(`[ProfileScreen] Proceeding with Spotify data refresh...`);

        // Legacy check (keeping for compatibility but should not be needed now)
        const isConnected = await isServiceConnected(service);
        console.log(`[ProfileScreen] Legacy service connection check result: ${isConnected}`);

        setRefreshingStreamingData(true);
        console.log(`[ProfileScreen] Force refreshing ${service} data...`);
        
        try {
            const premium = !!musicLoverProfile.isPremium;
            console.log(`[ProfileScreen] Calling forceFetchAndSaveSpotifyData for ${premium ? 'premium' : 'free'} user (ID: ${userId})`);

            // Use the Spotify auth hook's forceFetchAndSaveSpotifyData method directly
            const success = await forceFetchAndSaveSpotifyData(userId, premium);

            if (success) {
                console.log(`[ProfileScreen] ${service} data refresh completed successfully.`);
                
                // Force refresh the streaming data from database to get the latest data
                console.log('[ProfileScreen] Fetching updated data from database...');
                await fetchStreamingData(true);
                
                Alert.alert('Success!', `Your Spotify data has been refreshed with the latest information.`);
            } else {
                console.error(`[ProfileScreen] ${service} data refresh completed but reported failure.`);
                
                // Check if this is a token issue with existing data
                if (hasExistingSpotifyData) {
                    Alert.alert(
                        'Reconnection Required', 
                        `Your Spotify session has expired. Please reconnect your account to refresh your music data.`,
                        [
                            { text: "Cancel", style: "cancel" },
                            { text: "Reconnect Spotify", onPress: handleSpotifyReconnect }
                        ]
                    );
                } else {
                    Alert.alert(
                        'Refresh Failed', 
                        `We couldn't refresh your Spotify data. Please try reconnecting your account.`,
                        [
                            { text: "Cancel", style: "cancel" },
                            { text: "Connect Spotify", onPress: handleSpotifyReconnect }
                        ]
                    );
                }
                
                // Still try to refresh the UI with any available data
                await fetchStreamingData(true);
            }
        } catch (error: any) {
            console.error(`[ProfileScreen] Error refreshing ${service} data:`, error);
            
            // Check if this is an authentication error with existing data
            if (hasExistingSpotifyData && (error.message?.includes('authentication') || error.message?.includes('token'))) {
                Alert.alert(
                    'Spotify Reconnection Needed', 
                    `Your Spotify session has expired. Would you like to reconnect to refresh your music data?`,
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Reconnect", onPress: handleSpotifyReconnect }
                    ]
                );
            } else {
                Alert.alert('Refresh Error', `An error occurred while refreshing: ${error.message || 'Unknown error'}`);
            }
            
            // Still try to fetch any existing data
            await fetchStreamingData(true);
        } finally {
            setRefreshingStreamingData(false);
        }
    }, [userId, musicLoverProfile, isServiceConnected, forceFetchAndSaveSpotifyData, fetchStreamingData, isSpotifyLoggedIn, serviceId, hasData, spotifyAccessToken, spotifyAuthLoading, handleSpotifyReconnect]);

    // Function to render streaming service card with correct action buttons
    const renderStreamingServiceCard = () => {
        if (!serviceId) {
            return (
                <TouchableOpacity
                    style={styles.actionCard}
                    onPress={() => navigation.navigate('LinkMusicServicesScreen')}
                >
                    <Feather name="music" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
                    <Text style={styles.actionCardTitle}>Connect Music Service</Text>
                    <Text style={styles.actionCardSubtitle}>
                        Link your Spotify account to see your top artists, songs, and more
                    </Text>
                </TouchableOpacity>
            );
        }

        return (
            <View style={styles.streamingServiceCard}>
                <View style={styles.streamingServiceHeader}>
                    <View style={styles.streamingServiceInfo}>
                        <Feather 
                            name={'music'}
                            size={24} 
                            color={'#1DB954'}
                        />
                        <Text style={styles.streamingServiceName}>
                            {serviceId === 'spotify' ? 'Spotify' : serviceId}
                        </Text>
                    </View>
                    
                    <TouchableOpacity 
                        style={styles.refreshButton}
                        onPress={() => handleSpotifyReconnect()}
                        disabled={refreshingStreamingData}
                    >
                        {refreshingStreamingData ? (
                            <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} />
                        ) : (
                            <Text style={styles.refreshButtonText}>Refresh Data</Text>
                        )}
                    </TouchableOpacity>
                </View>
                
                <View style={styles.streamingServiceActions}>
                    <TouchableOpacity 
                        style={styles.streamingServiceButton}
                        onPress={() => navigation.navigate('LinkMusicServicesScreen')}
                    >
                        <Text style={styles.streamingServiceButtonText}>Change Service</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    // Render Spotify Reconnection Modal
    const renderSpotifyReconnectModal = () => (
        <Modal
            visible={showSpotifyReconnectModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowSpotifyReconnectModal(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Reconnect Spotify</Text>
                        <TouchableOpacity 
                            onPress={() => setShowSpotifyReconnectModal(false)}
                            style={styles.modalCloseButton}
                        >
                            <Feather name="x" size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.modalBody}>
                        <View style={styles.spotifyLogoContainer}>
                            <View style={styles.spotifyIcon}>
                                <Feather name="music" size={32} color="#1DB954" />
                            </View>
                        </View>
                        
                        <Text style={styles.modalSubtitle}>
                            Your Spotify session has expired. Please reconnect to refresh your music data.
                        </Text>
                        
                        {spotifyError && (
                            <View style={styles.errorContainer}>
                                <Text style={styles.modalErrorText}>{spotifyError}</Text>
                            </View>
                        )}
                        
                        <TouchableOpacity 
                            style={[styles.spotifyConnectButton, spotifyAuthLoading && styles.spotifyConnectButtonDisabled]}
                            onPress={handleSpotifyLoginInModal}
                            disabled={spotifyAuthLoading}
                        >
                            {spotifyAuthLoading ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <>
                                    <Feather name="music" size={20} color="white" />
                                    <Text style={styles.spotifyConnectButtonText}>Connect to Spotify</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={styles.modalCancelButton}
                            onPress={() => setShowSpotifyReconnectModal(false)}
                        >
                            <Text style={styles.modalCancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    if (authLoading || (countsLoading && !isRefreshing)) {
         return (<SafeAreaView style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} /><Text style={styles.loadingText}>Loading Profile...</Text></SafeAreaView> );
    }

    if (!session || !musicLoverProfile) {
        return ( <SafeAreaView style={styles.centered}> <Feather name="alert-circle" size={40} color={!session ? APP_CONSTANTS.COLORS.PRIMARY : APP_CONSTANTS.COLORS.WARNING} /> <Text style={styles.errorText}>{!session ? "Not Logged In" : "Profile Data Missing"}</Text> <Text style={styles.errorSubText}>{!session ? "Please log in." : "Could not load profile details."}</Text> <TouchableOpacity style={[styles.logoutButton, { marginTop: 20, backgroundColor: !session ? APP_CONSTANTS.COLORS.PRIMARY : '#EF4444' }]} onPress={() => !session ? navigation.navigate('Auth') : logout()} > <Feather name={!session ? "log-in" : "log-out"} size={18} color="#FFF" /><Text style={styles.logoutButtonText}>{!session ? "Go to Login" : "Logout"}</Text> </TouchableOpacity> </SafeAreaView> );
    }

    const profilePictureUrl = musicLoverProfile.profilePicture ?? DEFAULT_PROFILE_PIC;
    const userName = `${musicLoverProfile.firstName ?? ''} ${musicLoverProfile.lastName ?? ''}`.trim() || "User";
    const userAge = musicLoverProfile.age; const userCity = musicLoverProfile.city; const userCountry = musicLoverProfile.country;
    const allBioDetails = musicLoverProfile.bio ? Object.entries(musicLoverProfile.bio).filter(([_, v]) => v && String(v).trim() !== '').map(([k, v]) => ({ label: bioDetailLabels[k as keyof MusicLoverBio] || k.replace(/([A-Z])/g, ' $1').trim(), value: String(v).trim() })) : [];
    // Parse favorite music - handle both arrays (new format) and strings (old format)
    const parseCsvString = (value: string | string[] | null | undefined): string[] => {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
            return value.split(',').map(s => s.trim()).filter(Boolean);
        }
        return [];
    };
    const favoriteGenres = (musicLoverProfile.musicData?.genres as string[]) ?? []; // Keep if still used for Genre section
    // Now using the updated MusicLoverProfile type from useAuth
    const favArtistsList = parseCsvString(musicLoverProfile.favorite_artists);
    const favSongsList = parseCsvString(musicLoverProfile.favorite_songs);
    const genreAnalyticsData = (musicLoverProfile.musicData?.analytics?.genreDistribution as { name: string; value: number }[] | undefined) ?? [];
    const favAlbumsList = parseCsvString(musicLoverProfile.favorite_albums); // Keep manual list

    return (
        <SafeAreaView edges={["top"]} style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                    <View style={styles.titleContainer}><Feather name="user" size={22} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} style={styles.headerIcon} /><Text style={styles.title}>My Profile</Text></View>
                    <TouchableOpacity 
                        style={styles.settingsButton} 
                        onPress={() => navigation.navigate('UserSettingsScreen')}
                    >
                        <Feather name="settings" size={22} color={APP_CONSTANTS.COLORS.PRIMARY} />
                    </TouchableOpacity>
                </View>
            </View>
            <ScrollView style={styles.scrollViewContainer} contentContainerStyle={[
                styles.scrollContent,
                Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth < 768 && { paddingBottom: 100 }
            ]} showsVerticalScrollIndicator={false} refreshControl={ <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[APP_CONSTANTS.COLORS.PRIMARY]} tintColor={APP_CONSTANTS.COLORS.PRIMARY} /> } >
                <View style={styles.profileCard}>
                    <LinearGradient colors={[APP_CONSTANTS.COLORS.PRIMARY_LIGHT, APP_CONSTANTS.COLORS.PRIMARY]} style={styles.coverPhoto} />
                    <View style={styles.avatarContainer}><Image source={{ uri: profilePictureUrl }} style={styles.avatar} /></View>
                    <View style={styles.profileInfo}>
                        <View style={styles.nameContainer}><Text style={styles.name}>{userName}</Text>{isPremium && (<View style={styles.premiumBadgeName}><Feather name="award" size={10} color="#B8860B" /><Text style={styles.premiumTextName}>Premium</Text></View>)}</View>
                        {musicLoverProfile.username && (
                            <Text style={styles.username}>@{musicLoverProfile.username}</Text>
                        )}
                        <View style={styles.locationAgeContainer}>{userAge && <Text style={styles.age}>{userAge} y/o</Text>}{(userCity || userCountry) && (<>{userAge && <Text style={styles.locationSeparator}>•</Text>}<Feather name="map-pin" size={12} color="#6B7280" style={{ marginRight: 4 }}/><Text style={styles.location}>{userCity}{userCity && userCountry ? ', ' : ''}{userCountry}</Text></>)}</View>
                        <View style={styles.statsContainer}>
                            <TouchableOpacity 
                                style={styles.statItemTouchable} 
                                disabled={countsLoading} 
                                // Try direct navigation assuming screens are in Root/Main stack
                                onPress={() => !countsLoading ? navigation.navigate('FriendsListScreen') : null}
                            >
                                {countsLoading && !isRefreshing ? (
                                    <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} style={{height: 21}}/>
                                ) : (
                                    <Text style={styles.statValue}>{friendCount}</Text>
                                )}
                                <Text style={styles.statLabel}>Friends</Text>
                            </TouchableOpacity>
                            <Separator vertical style={{ backgroundColor: '#E5E7EB' }}/>
                            <TouchableOpacity 
                                style={styles.statItemTouchable} 
                                disabled={countsLoading} 
                                // Try direct navigation assuming screens are in Root/Main stack
                                onPress={() => !countsLoading ? navigation.navigate('OrganizerListScreen') : null}
                            >
                                {countsLoading && !isRefreshing ? (
                                    <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} style={{height: 21}}/>
                                ) : (
                                    <Text style={styles.statValue}>{followedOrganizersCount}</Text>
                                )}
                                <Text style={styles.statLabel}>Following</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <ProfileSection title="Things About Me" icon="info" isPremiumUser={isPremium} hasData={allBioDetails.length > 0} >
                    <View style={styles.bioDetailsListContainer}>{allBioDetails.map((d, i) => (<View key={i} style={styles.bioDetailItem}><Text style={styles.bioDetailLabel}>{d.label}:</Text><Text style={styles.bioDetailValue}>{d.value}</Text></View>))}</View>
                </ProfileSection>
                
                {/* Top Artists Section - From Spotify - COMMENTED OUT FOR SOFT LAUNCH */}
                {/* <ProfileSection title="Top Artists" icon="users" expanded={expandedSections.artists} onToggle={() => toggleSection("artists")} hasData={topArtists.length > 0}>
                    Spotify Reconnection Notice - Show if we have data but no current auth
                    {serviceId === 'spotify' && topArtists.length > 0 && !isSpotifyLoggedIn && !spotifyAccessToken && !spotifyAuthLoading && (
                        <View style={styles.reconnectionNotice}>
                            <View style={styles.reconnectionHeader}>
                                <Feather name="alert-circle" size={20} color="#F59E0B" />
                                <Text style={styles.reconnectionTitle}>Spotify Session Expired</Text>
                            </View>
                            <Text style={styles.reconnectionText}>
                                Your Spotify connection has expired. Reconnect to refresh your music data.
                            </Text>
                            <TouchableOpacity 
                                style={styles.reconnectionButton}
                                onPress={handleSpotifyReconnect}
                            >
                                <Feather name="refresh-cw" size={16} color="white" />
                                <Text style={styles.reconnectionButtonText}>Reconnect Spotify</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    
                    Spotify Refresh Button - Show if Spotify is connected OR user has authenticated with Spotify
                    {(serviceId === 'spotify' || isSpotifyLoggedIn) && (
                        <TouchableOpacity 
                            style={styles.refreshSpotifyButton}
                            onPress={() => handleForceRefreshStreamingData('spotify')}
                            disabled={refreshingStreamingData}
                        >
                            <View style={styles.refreshButtonContent}>
                                <Feather 
                                    name="refresh-cw" 
                                    size={18} 
                                    color={refreshingStreamingData ? APP_CONSTANTS.COLORS.TEXT_SECONDARY : APP_CONSTANTS.COLORS.PRIMARY} 
                                    style={{marginRight: 8}} 
                                />
                                <Text style={[
                                    styles.refreshButtonText, 
                                    {color: refreshingStreamingData ? APP_CONSTANTS.COLORS.TEXT_SECONDARY : APP_CONSTANTS.COLORS.PRIMARY, fontWeight: '600'}
                                ]}>
                                    {refreshingStreamingData ? 'Refreshing...' : 'Refresh Spotify Data'}
                                </Text>
                            </View>
                            {refreshingStreamingData && (
                                <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} style={{marginLeft: 8}} />
                            )}
                        </TouchableOpacity>
                    )}
                    
                      {topArtists.length > 0 ? (
                          <View style={styles.listContainer}>
                            {topArtists.map((artist: TopArtist, i: number) => (
                                  <View key={`stream-artist-${i}`} style={styles.listItem}>
                                      <Text style={styles.listItemText}>{artist.name}</Text>
                                      <Feather name="user" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                                  </View>
                              ))}
                              <Text style={styles.dataSourceText}>
                                  Data from {serviceId || 'your streaming service'}
                                  {!isPremium && topArtists.length === 3 && ' • Upgrade to Premium for top 10'}
                              </Text>
                          </View>
                      ) : (
                        refreshingStreamingData ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
                                <Text style={styles.loadingText}>Loading Spotify data...</Text>
                            </View>
                        ) : (
                            <View style={styles.emptyStateContainer}>
                                <Text style={styles.emptyStateText}>
                                    {isSpotifyLoggedIn 
                                        ? 'No data available yet. Try refreshing your Spotify data.' 
                                        : 'Connect your streaming service to see top artists'}
                                </Text>
                                {!isSpotifyLoggedIn ? (
                                    <TouchableOpacity 
                                        style={styles.connectServiceButton} 
                                        onPress={() => navigation.navigate('LinkMusicServicesScreen')}
                                    >
                                        <Text style={styles.connectServiceButtonText}>Connect Service</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity 
                                        style={styles.refreshSpotifyButton}
                                        onPress={() => handleSpotifyReconnect()}
                                    >
                                        <Text style={[styles.refreshButtonText, {color: APP_CONSTANTS.COLORS.PRIMARY}]}>
                                            Refresh Spotify Data
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                  </View>
                        )
                    )}
                </ProfileSection> */}
                
                {/* Top Tracks Section - From Spotify - COMMENTED OUT FOR SOFT LAUNCH */}
                {/* <ProfileSection title="Top Tracks" icon="music" expanded={expandedSections.tracks} onToggle={() => toggleSection("tracks")} hasData={topTracks.length > 0}>
                    Spotify Reconnection Notice - Show if we have data but no current auth
                    {serviceId === 'spotify' && topTracks.length > 0 && !isSpotifyLoggedIn && !spotifyAccessToken && !spotifyAuthLoading && (
                        <View style={styles.reconnectionNotice}>
                            <View style={styles.reconnectionHeader}>
                                <Feather name="alert-circle" size={20} color="#F59E0B" />
                                <Text style={styles.reconnectionTitle}>Spotify Session Expired</Text>
                            </View>
                            <Text style={styles.reconnectionText}>
                                Your Spotify connection has expired. Reconnect to refresh your music data.
                            </Text>
                            <TouchableOpacity 
                                style={styles.reconnectionButton}
                                onPress={handleSpotifyReconnect}
                            >
                                <Feather name="refresh-cw" size={16} color="white" />
                                <Text style={styles.reconnectionButtonText}>Reconnect Spotify</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    
                    Spotify Refresh Button - Show if Spotify is connected OR user has authenticated with Spotify
                    {(serviceId === 'spotify' || isSpotifyLoggedIn) && (
                        <TouchableOpacity 
                            style={styles.refreshSpotifyButton}
                            onPress={() => handleForceRefreshStreamingData('spotify')}
                            disabled={refreshingStreamingData}
                        >
                            <View style={styles.refreshButtonContent}>
                                <Feather 
                                    name="refresh-cw" 
                                    size={18} 
                                    color={refreshingStreamingData ? APP_CONSTANTS.COLORS.TEXT_SECONDARY : APP_CONSTANTS.COLORS.PRIMARY} 
                                    style={{marginRight: 8}} 
                                />
                                <Text style={[
                                    styles.refreshButtonText, 
                                    {color: refreshingStreamingData ? APP_CONSTANTS.COLORS.TEXT_SECONDARY : APP_CONSTANTS.COLORS.PRIMARY, fontWeight: '600'}
                                ]}>
                                    {refreshingStreamingData ? 'Refreshing...' : 'Refresh Spotify Data'}
                                </Text>
                          </View>
                            {refreshingStreamingData && (
                                <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} style={{marginLeft: 8}} />
                      )}
                          </TouchableOpacity>
                      )}
                    
                       {topTracks.length > 0 ? (
                           <View style={styles.listContainer}>
                            {topTracks.map((track: TopTrack, i: number) => (
                                   <View key={`stream-track-${i}`} style={styles.listItem}>
                                       <View style={styles.listItemDetails}>
                                           <Text style={styles.listItemText}>{track.name}</Text>
                                           <Text style={styles.listItemSubtext}>{track.artists.map(artist => artist.name).join(', ')}</Text>
                                       </View>
                                       <Feather name="music" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                                   </View>
                               ))}
                               <Text style={styles.dataSourceText}>
                                   Data from {serviceId || 'your streaming service'}
                                   {!isPremium && topTracks.length === 3 && ' • Upgrade to Premium for top 10'}
                               </Text>
                           </View>
                       ) : (
                        <View style={styles.emptyStateContainer}>
                            <Text style={styles.emptyStateText}>
                                {isSpotifyLoggedIn 
                                    ? 'No data available yet. Try refreshing your Spotify data.' 
                                    : 'Connect your streaming service to see top tracks'}
                            </Text>
                            {!isSpotifyLoggedIn ? (
                                <TouchableOpacity 
                                    style={styles.connectServiceButton} 
                                    onPress={() => navigation.navigate('LinkMusicServicesScreen')}
                                >
                                    <Text style={styles.connectServiceButtonText}>Connect Service</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity 
                                    style={styles.refreshSpotifyButton}
                                    onPress={() => handleSpotifyReconnect()}
                                >
                                    <Text style={[styles.refreshButtonText, {color: APP_CONSTANTS.COLORS.PRIMARY}]}>
                                        Refresh Spotify Data
                                    </Text>
                                </TouchableOpacity>
                            )}
                           </View>
                       )}
                </ProfileSection> */}
                
                {/* Top Genres Section - From Spotify - COMMENTED OUT FOR SOFT LAUNCH */}
                {/* <ProfileSection title="Top Genres" icon="tag" expanded={expandedSections.genres} onToggle={() => toggleSection("genres")} hasData={topGenres.length > 0}>
                    Spotify Reconnection Notice - Show if we have data but no current auth
                    {serviceId === 'spotify' && topGenres.length > 0 && !isSpotifyLoggedIn && !spotifyAccessToken && !spotifyAuthLoading && (
                        <View style={styles.reconnectionNotice}>
                            <View style={styles.reconnectionHeader}>
                                <Feather name="alert-circle" size={20} color="#F59E0B" />
                                <Text style={styles.reconnectionTitle}>Spotify Session Expired</Text>
                            </View>
                            <Text style={styles.reconnectionText}>
                                Your Spotify connection has expired. Reconnect to refresh your music data.
                            </Text>
                            <TouchableOpacity 
                                style={styles.reconnectionButton}
                                onPress={handleSpotifyReconnect}
                            >
                                <Feather name="refresh-cw" size={16} color="white" />
                                <Text style={styles.reconnectionButtonText}>Reconnect Spotify</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    
                    Spotify Refresh Button
                    {(serviceId === 'spotify' || isSpotifyLoggedIn) && (
                        <TouchableOpacity 
                            style={styles.refreshSpotifyButton}
                            onPress={() => handleForceRefreshStreamingData('spotify')}
                            disabled={refreshingStreamingData}
                        >
                            <View style={styles.refreshButtonContent}>
                                <Feather 
                                    name="refresh-cw" 
                                    size={18} 
                                    color={refreshingStreamingData ? APP_CONSTANTS.COLORS.TEXT_SECONDARY : APP_CONSTANTS.COLORS.PRIMARY} 
                                    style={{marginRight: 8}} 
                                />
                                <Text style={[
                                    styles.refreshButtonText, 
                                    {color: refreshingStreamingData ? APP_CONSTANTS.COLORS.TEXT_SECONDARY : APP_CONSTANTS.COLORS.PRIMARY, fontWeight: '600'}
                                ]}>
                                    {refreshingStreamingData ? 'Refreshing...' : 'Refresh Spotify Data'}
                                </Text>
                            </View>
                            {refreshingStreamingData && (
                                <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} style={{marginLeft: 8}} />
                            )}
                        </TouchableOpacity>
                    )}
                    
                    {topGenres.length > 0 ? (
                        <View style={styles.analyticsCard}>
                            <View style={styles.tagsContainer}>
                                {topGenres.map((genre: TopGenre, index: number) => (
                                    <View key={`genre-${index}`} style={styles.genreTag}>
                                        <Text style={styles.genreTagText}>{genre.name}</Text>
                                    </View>
                                ))}
                            </View>
                            <Text style={styles.dataSourceText}>
                                Data from {serviceId || 'your streaming service'}
                                {!isPremium && topGenres.length === 3 && ' • Upgrade to Premium for top 10'}
                            </Text>
                        </View>
                    ) : (
                        refreshingStreamingData ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
                                <Text style={styles.loadingText}>Loading Spotify data...</Text>
                            </View>
                        ) : (
                            <View style={styles.emptyStateContainer}>
                                <Text style={styles.emptyStateText}>
                                    {isSpotifyLoggedIn 
                                        ? 'No data available yet. Try refreshing your Spotify data.' 
                                        : 'Connect your streaming service to see top genres'}
                                </Text>
                                {!isSpotifyLoggedIn ? (
                                    <TouchableOpacity 
                                        style={styles.connectServiceButton} 
                                        onPress={() => navigation.navigate('LinkMusicServicesScreen')}
                                    >
                                        <Text style={styles.connectServiceButtonText}>Connect Service</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity 
                                        style={styles.refreshSpotifyButton}
                                        onPress={() => handleSpotifyReconnect()}
                                    >
                                        <Text style={[styles.refreshButtonText, {color: APP_CONSTANTS.COLORS.PRIMARY}]}>
                                            Refresh Spotify Data
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )
                    )}
                </ProfileSection> */}
                
                {/* Top Moods Section - From Spotify (Premium Only) - COMMENTED OUT FOR SOFT LAUNCH */} 
                {/* <ProfileSection
                    title="Top Moods" 
                    icon="smile" 
                    expanded={expandedSections.moods} 
                    onToggle={() => toggleSection("moods")} 
                    hasData={topMoods && topMoods.length > 0} 
                    isPremiumFeature 
                    isPremiumUser={isPremium}
                >
                    Spotify Reconnection Notice - Show if we have data but no current auth
                    {serviceId === 'spotify' && topMoods.length > 0 && !isSpotifyLoggedIn && !spotifyAccessToken && !spotifyAuthLoading && (
                        <View style={styles.reconnectionNotice}>
                            <View style={styles.reconnectionHeader}>
                                <Feather name="alert-circle" size={20} color="#F59E0B" />
                                <Text style={styles.reconnectionTitle}>Spotify Session Expired</Text>
                            </View>
                            <Text style={styles.reconnectionText}>
                                Your Spotify connection has expired. Reconnect to refresh your music data.
                            </Text>
                            <TouchableOpacity 
                                style={styles.reconnectionButton}
                                onPress={handleSpotifyReconnect}
                            >
                                <Feather name="refresh-cw" size={16} color="white" />
                                <Text style={styles.reconnectionButtonText}>Reconnect Spotify</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    
                    Spotify Refresh Button
                    {(serviceId === 'spotify' || isSpotifyLoggedIn) && isPremium && (
                        <TouchableOpacity 
                            style={styles.refreshSpotifyButton}
                            onPress={() => handleForceRefreshStreamingData('spotify')}
                            disabled={refreshingStreamingData}
                        >
                            <View style={styles.refreshButtonContent}>
                                <Feather 
                                    name="refresh-cw" 
                                    size={18} 
                                    color={refreshingStreamingData ? APP_CONSTANTS.COLORS.TEXT_SECONDARY : APP_CONSTANTS.COLORS.PRIMARY} 
                                    style={{marginRight: 8}} 
                                />
                                <Text style={[
                                    styles.refreshButtonText, 
                                    {color: refreshingStreamingData ? APP_CONSTANTS.COLORS.TEXT_SECONDARY : APP_CONSTANTS.COLORS.PRIMARY, fontWeight: '600'}
                                ]}>
                                    {refreshingStreamingData ? 'Refreshing...' : 'Refresh Spotify Data'}
                                </Text>
                            </View>
                            {refreshingStreamingData && (
                                <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} style={{marginLeft: 8}} />
                            )}
                        </TouchableOpacity>
                    )}
                    
                    {isPremium && topMoods && topMoods.length > 0 ? (
                        <View style={styles.analyticsCard}> 
                            <View style={styles.tagsContainer}>
                                {topMoods.map((mood: TopMood, index: number) => (
                                    <View key={`mood-${index}`} style={[styles.genreTag, {backgroundColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT}]}> 
                                        <Text style={[styles.genreTagText, {color: APP_CONSTANTS.COLORS.PRIMARY_DARK}]}>{mood.name} ({mood.count})</Text>
                                    </View>
                                ))}
                            </View>
                            <Text style={styles.dataSourceText}>
                                Data from {serviceId || 'your streaming service'}
                            </Text>
                        </View>
                    ) : refreshingStreamingData && isPremium ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
                            <Text style={styles.loadingText}>Loading Spotify mood data...</Text>
                        </View>
                    ) : isPremium ? (
                        <View style={styles.emptyStateContainer}>
                            <Text style={styles.emptyStateText}>
                                {isSpotifyLoggedIn 
                                    ? 'No mood data available yet. Try refreshing your Spotify data.' 
                                    : 'Connect your Spotify account to see top moods.'}
                            </Text>
                            {!isSpotifyLoggedIn ? (
                                <TouchableOpacity 
                                    style={styles.connectServiceButton} 
                                    onPress={() => navigation.navigate('LinkMusicServicesScreen')}
                                >
                                    <Text style={styles.connectServiceButtonText}>Connect Spotify</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity 
                                    style={styles.refreshSpotifyButton}
                                    onPress={() => handleSpotifyReconnect()}
                                >
                                    <Text style={[styles.refreshButtonText, {color: APP_CONSTANTS.COLORS.PRIMARY}]}>
                                        Refresh Spotify Data
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : null
                </ProfileSection> */}
                
                <ProfileSection title="Favorite Artists" icon="star" isPremiumUser={isPremium} expanded={expandedSections.favArtists} onToggle={() => toggleSection("favArtists")} hasData={favArtistsList.length > 0}>
                    <View style={styles.listContainer}>
                        {favArtistsList.slice(0, expandedSections.favArtists ? favArtistsList.length : 5).map((artist, i) => (
                            <View key={`artist-${i}`} style={styles.listItem}>
                                <Text style={styles.listItemText}>{artist}</Text>
                                <Feather name="user" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                            </View>
                        ))}
                    </View>
                    {(favArtistsList.length > 5 && !expandedSections.favArtists) && (
                        <TouchableOpacity style={styles.seeAllButton} onPress={() => toggleSection("favArtists")}>
                            <Text style={styles.seeAllButtonText}>See all {favArtistsList.length}</Text>
                            <Feather name="chevron-down" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                        </TouchableOpacity>
                    )}
                </ProfileSection>

                <ProfileSection title="Favorite Songs" icon="star" isPremiumUser={isPremium} expanded={expandedSections.favSongs} onToggle={() => toggleSection("favSongs")} hasData={favSongsList.length > 0}>
                    <View style={styles.listContainer}>
                        {favSongsList.slice(0, expandedSections.favSongs ? favSongsList.length : 5).map((song, i) => (
                            <View key={`song-${i}`} style={styles.listItem}>
                                <Text style={styles.listItemText}>{song}</Text>
                                <Feather name="music" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                            </View>
                        ))}
                    </View>
                    {(favSongsList.length > 5 && !expandedSections.favSongs) && (
                        <TouchableOpacity style={styles.seeAllButton} onPress={() => toggleSection("favSongs")}>
                            <Text style={styles.seeAllButtonText}>See all {favSongsList.length}</Text>
                            <Feather name="chevron-down" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                        </TouchableOpacity>
                    )}
                </ProfileSection>
                
                <ProfileSection title="Favorite Albums" icon="star" isPremiumUser={isPremium} expanded={expandedSections.favAlbums} onToggle={() => toggleSection("favAlbums")} hasData={favAlbumsList.length > 0}>
                    <View style={styles.listContainer}>
                        {favAlbumsList.slice(0, expandedSections.favAlbums ? favAlbumsList.length : 5).map((album, i) => (
                            <View key={`album-${i}`} style={styles.listItem}>
                                <Text style={styles.listItemText}>{album}</Text>
                                <Feather name="disc" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                            </View>
                        ))}
                    </View>
                    {(favAlbumsList.length > 5 && !expandedSections.favAlbums) && (
                        <TouchableOpacity style={styles.seeAllButton} onPress={() => toggleSection("favAlbums")}>
                            <Text style={styles.seeAllButtonText}>See all {favAlbumsList.length}</Text>
                            <Feather name="chevron-down" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                        </TouchableOpacity>
                    )}
                </ProfileSection>

                 {/* Match Radio Feature - COMMENTED OUT FOR SOFT LAUNCH */}
                 {/* <ProfileSection title="Match Radio" icon="radio" isPremiumFeature isPremiumUser={isPremium} hasData={true}>
                     {isPremium ? ( <View style={styles.premiumFeatureCard}><View style={styles.premiumFeatureHeader}><View><Text style={styles.premiumFeatureTitle}>AI Playlists</Text><Text style={styles.premiumFeatureSubtitle}>Blend taste w/ matches</Text></View><View style={styles.featureIconContainer}><Feather name="radio" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} /></View></View><TouchableOpacity style={styles.createButton} onPress={() => Alert.alert("Coming Soon!")}><Text style={styles.createButtonText}>Create Match Radio</Text></TouchableOpacity></View> ) : null }
                 </ProfileSection> */}
                 <ProfileSection title="My Attended Events" icon="check-square" isPremiumUser={isPremium}>
                      <TouchableOpacity 
                          style={styles.linkButton} 
                          onPress={() => navigation.navigate('AttendedEventsScreen')}
                      >
                         <Text style={styles.linkButtonText}>View & Rate Past Events</Text>
                         <Feather name="chevron-right" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                      </TouchableOpacity>
                 </ProfileSection>

                 <ProfileSection title="My Bookings" icon="book-open" isPremiumUser={isPremium}>
                    <TouchableOpacity
                        style={styles.linkButton}
                        onPress={() => navigation.navigate('MyBookingsScreen')}
                    >
                       <Text style={styles.linkButtonText}>View Upcoming Bookings</Text>
                       <Feather name="chevron-right" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                    </TouchableOpacity>
               </ProfileSection>

                {!isPremium && (
                    <TouchableOpacity 
                        style={styles.buyPremiumButton} 
                        onPress={() => {
                            if (userId && musicLoverProfile?.email) {
                                console.log(`[ProfileScreen] Navigating to UpgradeScreen for user: ${userId}, email: ${musicLoverProfile.email}`);
                                navigation.navigate('UpgradeScreen'); 
                            } else {
                                console.warn('[ProfileScreen] Cannot navigate to UpgradeScreen: userId or email missing.', { userId, email: musicLoverProfile?.email });
                                Alert.alert("Error", "Could not initiate premium upgrade. User details are missing. Please try logging out and back in.");
                            }
                        }}
                        >
                        <Feather name="star" size={18} color="#FFF" />
                        <Text style={styles.buyPremiumButtonText}>Upgrade to Premium</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.logoutButton} onPress={logout} ><Feather name="log-out" size={18} color="#FFF" /><Text style={styles.logoutButtonText}>Logout</Text></TouchableOpacity>
            </ScrollView>
            
            {/* Spotify Reconnection Modal */}
            {renderSpotifyReconnectModal()}
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F9FAFB", },
    scrollViewContainer: { flex: 1, },
    header: { paddingTop: Platform.OS === 'android' ? 20 : 16, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', },
    headerTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", },
    titleContainer: { flexDirection: "row", alignItems: "center", },
    headerIcon: { marginRight: 8, },
    title: { fontSize: 22, fontWeight: "bold", color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, },
    settingsButton: { padding: 8, borderRadius: 20, },
    scrollContent: { paddingHorizontal: 0, paddingBottom: 40, paddingTop: 16, },
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
    age: { fontSize: 14, color: "#6B7280", },
    locationSeparator: { color: "#D1D5DB", marginHorizontal: 6, fontSize: 14, },
    location: { fontSize: 14, color: "#6B7280", marginLeft: 2, textAlign: 'center' },
    statsContainer: { flexDirection: "row", justifyContent: "space-around", alignItems: 'center', marginVertical: 16, width: "80%", paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F3F4F6', },
    statItem: { alignItems: "center", paddingHorizontal: 10, minWidth: 60, },
    statItemTouchable: { alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, minWidth: 60, },
    statValue: { fontSize: 18, fontWeight: "600", color: APP_CONSTANTS.COLORS.PRIMARY, minHeight: 21, },
    statLabel: { fontSize: 12, color: "#6B7280", marginTop: 2, },
    separator: { backgroundColor: "#E5E7EB", },
    bioDetailsListContainer: { width: '100%', marginTop: 4, },
    bioDetailItem: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'flex-start', marginBottom: 10, paddingHorizontal: 0, },
    bioDetailLabel: { fontSize: 14, color: '#4B5563', fontWeight: '600', width: '45%', marginRight: 8, },
    bioDetailValue: { fontSize: 14, color: '#1F2937', flex: 1, textAlign: 'left', },
    section: { marginBottom: 24, paddingHorizontal: 16 },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6", },
    sectionTitleContainer: { flexDirection: "row", alignItems: "center", flexShrink: 1, },
    sectionIcon: { marginRight: 10, },
    sectionTitle: { fontSize: 18, fontWeight: "600", color: "#111827", marginRight: 8, },
    premiumBadgePill: { flexDirection: "row", alignItems: "center", backgroundColor: APP_CONSTANTS.COLORS.PREMIUM_LIGHT_BG, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: APP_CONSTANTS.COLORS.PREMIUM_BORDER, },
    premiumBadgeLocked: { backgroundColor: "rgba(150, 150, 150, 0.1)", borderColor: "rgba(150, 150, 150, 0.3)", },
    premiumTextPill: { color: APP_CONSTANTS.COLORS.PREMIUM_DARK, fontSize: 9, fontWeight: "600", marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5, },
    premiumTextLocked: { color: '#A0A0A0', },
    toggleButton: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingLeft: 8, },
    toggleButtonText: { fontSize: 13, color: APP_CONSTANTS.COLORS.PRIMARY, fontWeight: '500', marginRight: 4, },
    toggleIcon: {},
    lockedContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: '#E5E7EB', },
    lockedText: { fontSize: 13, color: '#6B7280', fontWeight: '500', },
    tagsContainer: { flexDirection: "row", flexWrap: "wrap", marginTop: 4, },
    genreTag: { backgroundColor: "rgba(59, 130, 246, 0.1)", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 8, marginBottom: 8, },
    genreTagText: { color: APP_CONSTANTS.COLORS.PRIMARY, fontSize: 13, fontWeight: '500', },
    analyticsCard: { backgroundColor: "white", borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: "#E5E7EB", },
    analyticsTitle: { fontSize: 14, fontWeight: "500", color: "#6B7280", textAlign: "center", marginBottom: 12, },
    pieChartPlaceholder: { alignItems: "center", justifyContent: "center", minHeight: 150, backgroundColor: "#F9FAFB", borderRadius: 8, padding: 16, },
    placeholderText: { fontSize: 15, fontWeight: "500", color: "#6B7280", marginBottom: 12, textAlign: 'center', },
    placeholderSubtext: { fontSize: 12, color: "#9CA3AF", marginBottom: 4, textAlign: 'center', },
    dataMissingText: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingVertical: 20, paddingHorizontal: 10, fontStyle: 'italic', backgroundColor: '#F9FAFB', borderRadius: 8, marginTop: 4, },
    listContainer: { marginTop: 4, },
    listItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: "#F3F4F6", },
    listItemText: { fontSize: 14, fontWeight: "500", color: "#1F2937", flexShrink: 1, paddingRight: 10 },
    listItemSubtext: { fontSize: 12, color: "#6B7280", marginTop: 2, },
    seeAllButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, marginTop: 4, },
    seeAllButtonText: { color: APP_CONSTANTS.COLORS.PRIMARY, fontSize: 14, fontWeight: '500', marginRight: 4, },
    premiumFeatureCard: { backgroundColor: "rgba(59, 130, 246, 0.05)", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "rgba(59, 130, 246, 0.1)", },
    premiumFeatureHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, },
    premiumFeatureTitle: { fontSize: 16, fontWeight: "600", color: APP_CONSTANTS.COLORS.PRIMARY, marginBottom: 4, },
    premiumFeatureSubtitle: { fontSize: 13, color: "#4B5563", width: "85%", lineHeight: 18, },
    featureIconContainer: { backgroundColor: "white", borderRadius: 24, padding: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, marginLeft: 8, },
    createButton: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 8, },
    createButtonText: { color: "white", fontWeight: "600", fontSize: 14, },
    buyPremiumButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#F59E0B", paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, marginTop: 24, marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2, marginHorizontal: 16, },
    buyPremiumButtonText: { color: "white", fontWeight: "600", fontSize: 16, marginLeft: 8, },
    logoutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#EF4444", paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, marginTop: 8, marginBottom: 16, marginHorizontal: 16, },
    logoutButtonText: { color: "white", fontWeight: "600", fontSize: 16, marginLeft: 8, },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F9FAFB', },
    errorText: { marginTop: 15, fontSize: 18, fontWeight: '600', color: '#DC2626', textAlign: 'center', },
    errorSubText: { marginTop: 8, fontSize: 14, color: '#4B5563', textAlign: 'center', maxWidth: '85%', },
    linkButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, marginTop: 4, },
    linkButtonText: { color: APP_CONSTANTS.COLORS.PRIMARY, fontSize: 14, fontWeight: '500', marginRight: 4, },
    dataSourceText: { fontSize: 12, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, marginTop: 10, fontStyle: 'italic' },
    listItemDetails: { flexDirection: "column", flex: 1, },
    refreshSpotifyButton: { backgroundColor: "rgba(59, 130, 246, 0.1)", borderRadius: 8, padding: 12, marginTop: 8, marginBottom: 8, marginHorizontal: 16, },
    refreshButtonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", },
    refreshButtonText: { color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, fontSize: 14, fontWeight: '500', marginRight: 8, },
    emptyStateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F9FAFB', borderRadius: 8, },
    emptyStateText: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingVertical: 20, paddingHorizontal: 10, fontStyle: 'italic', },
    connectServiceButton: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, padding: 12, borderRadius: 8, marginTop: 8, marginBottom: 8, marginHorizontal: 16, },
    connectServiceButtonText: { color: "white", fontWeight: "600", fontSize: 14, },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    loadingText: { marginTop: 12, fontSize: 14, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY },
    streamingServiceCard: {
        backgroundColor: '#f8f8f8',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    streamingServiceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    streamingServiceInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    streamingServiceName: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 10,
    },
    refreshButton: {
        paddingVertical: 5,
        paddingHorizontal: 10,
    },
    streamingServiceActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    streamingServiceButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: APP_CONSTANTS.COLORS.PRIMARY,
    },
    streamingServiceButtonText: {
        color: APP_CONSTANTS.COLORS.PRIMARY,
        fontSize: 14,
    },
    actionCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    actionCardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
        marginTop: 12,
        marginBottom: 8,
        textAlign: 'center',
    },
    actionCardSubtitle: {
        fontSize: 14,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        textAlign: 'center',
        lineHeight: 20,
    },
    username: { fontSize: 14, color: "#6B7280", marginTop: 4, textAlign: 'center' },
    reconnectionNotice: {
        backgroundColor: '#FEF3C7',
        borderLeftWidth: 4,
        borderLeftColor: '#F59E0B',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        marginHorizontal: 16,
    },
    reconnectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    reconnectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#92400E',
        marginLeft: 8,
    },
    reconnectionText: {
        fontSize: 14,
        color: '#92400E',
        lineHeight: 20,
        marginBottom: 12,
    },
    reconnectionButton: {
        backgroundColor: '#F59E0B',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 6,
    },
    reconnectionButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: 'white',
        borderRadius: 16,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1F2937',
    },
    modalCloseButton: {
        padding: 4,
    },
    modalBody: {
        padding: 24,
        alignItems: 'center',
    },
    spotifyLogoContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    spotifyIcon: {
        backgroundColor: 'rgba(29, 185, 84, 0.1)',
        borderRadius: 40,
        padding: 20,
        marginBottom: 16,
    },
    modalSubtitle: {
        fontSize: 16,
        color: '#4B5563',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    errorContainer: {
        backgroundColor: '#FEE2E2',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        width: '100%',
    },
    modalErrorText: {
        color: '#DC2626',
        fontSize: 14,
        textAlign: 'center',
    },
    spotifyConnectButton: {
        backgroundColor: '#1DB954',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 8,
        width: '100%',
        marginBottom: 12,
    },
    spotifyConnectButtonDisabled: {
        backgroundColor: '#9CA3AF',
    },
    spotifyConnectButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    modalCancelButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
    },
    modalCancelButtonText: {
        color: '#6B7280',
        fontSize: 16,
        fontWeight: '500',
    },
});

export default ProfileScreen;