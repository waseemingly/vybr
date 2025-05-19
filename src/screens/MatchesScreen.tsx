import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Alert, Platform, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useStreamingData } from '@/hooks/useStreamingData';
import MatchCard, { MatchCardProps, MusicLoverBio } from '@/components/MatchCard'; // Ensure MusicLoverBio is exported from MatchCard or a shared types file
import { supabase } from '@/lib/supabase';
import { APP_CONSTANTS } from '@/config/constants';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from "@/navigation/AppNavigator";

// Type for the data returned by the Supabase RPC function
interface MatchDbResult {
    match_user_id: string;
    name: string;
    profile_picture: string | null;
    bio: MusicLoverBio | null;
    is_premium: boolean;
    city: string | null;
    country: string | null;
    common_tags: string[]; // This will be the overall list of common tags
    compatibility_score: number | null;
    common_artists: string[]; // Specifically common artists
    common_tracks: string[];  // Specifically common tracks
    common_genres: string[];  // Specifically common genres
    common_moods: string[];   // Specifically common moods
}

const MatchesScreen: React.FC = () => {
    const { session, musicLoverProfile, loading: authLoading } = useAuth();
    // streamingData will be used implicitly by the SQL function via the user_id.
    // We listen to changes in musicLoverProfile and streamingData to refetch.
    const { streamingData, loading: streamingDataLoading, fetchStreamingData } = useStreamingData(session?.user?.id, { 
        isSpotifyLoggedIn: musicLoverProfile?.selectedStreamingService === 'spotify',
    });

    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const [matches, setMatches] = useState<MatchCardProps[]>([]);
    const [loadingMatches, setLoadingMatches] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [initialMatchesLoadAttempted, setInitialMatchesLoadAttempted] = useState(false);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

    const currentUserIsPremium = musicLoverProfile?.isPremium ?? false;
    const hasMusicLoverProfile = !!musicLoverProfile;

    const fetchMatchesCallback = useCallback(async (isSilentRefresh = false) => {
        if (!session?.user?.id || !hasMusicLoverProfile) {
            setMatches([]);
            if (!isSilentRefresh) {
                 setLoadingMatches(false);
                 setIsRefreshing(false);
            }
            return;
        }
        
        if (!isSilentRefresh) {
            setLoadingMatches(true);
        }
        console.log('[MatchesScreen] Calling RPC with p_current_user_id:', session.user.id);

        try {
            const { data, error } = await supabase.rpc('get_matches_for_user', {
                p_current_user_id: session.user.id,
            });

            if (error) {
                console.error('[MatchesScreen] Error fetching matches:', error);
                if (!isSilentRefresh) Alert.alert('Error', 'Could not load matches. ' + error.message);
            } else if (data) {
                const formattedMatches: MatchCardProps[] = data.map((match: MatchDbResult) => ({
                    id: match.match_user_id,
                    userId: match.match_user_id,
                    name: match.name,
                    image: match.profile_picture,
                    bio: match.bio,
                    isPremium: match.is_premium,
                    commonTags: match.common_tags || [],
                    compatibilityScore: currentUserIsPremium ? (match.compatibility_score ?? undefined) : undefined,
                    isViewerPremium: currentUserIsPremium,
                    topArtists: match.common_artists || [],
                    topTracks: match.common_tracks || [],
                    topGenres: match.common_genres || [],
                    topMoods: match.common_moods || [],
                }));
                setMatches(formattedMatches);
                console.log(`[MatchesScreen] Fetched ${formattedMatches.length} matches. Data:`, formattedMatches);
                setCurrentMatchIndex(0);
            } else {
                 setMatches([]); 
                 setCurrentMatchIndex(0);
                 console.log('[MatchesScreen] No matches data returned by RPC.');
            }
        } catch (e: any) {
            console.error('[MatchesScreen] Unexpected error fetching matches:', e);
            if (!isSilentRefresh) Alert.alert('Error', 'An unexpected error occurred while loading matches.');
        } finally {
            if (!isSilentRefresh) {
                setLoadingMatches(false);
                setIsRefreshing(false);
                setInitialMatchesLoadAttempted(true);
            }
        }
    }, [session?.user?.id, hasMusicLoverProfile, currentUserIsPremium, supabase]);

    // Memoize complex dependencies for the effect below
    const profileBioJSON = useMemo(() => JSON.stringify(musicLoverProfile?.bio), [musicLoverProfile?.bio]);
    const profileArtistsJSON = useMemo(() => JSON.stringify(musicLoverProfile?.favorite_artists), [musicLoverProfile?.favorite_artists]);
    const profileAlbumsJSON = useMemo(() => JSON.stringify(musicLoverProfile?.favorite_albums), [musicLoverProfile?.favorite_albums]);
    const profileSongsJSON = useMemo(() => JSON.stringify(musicLoverProfile?.favorite_songs), [musicLoverProfile?.favorite_songs]);
    const streamingDataJSON = useMemo(() => JSON.stringify(streamingData), [streamingData]);
    const streamingTopArtistsJSON = useMemo(() => JSON.stringify(streamingData?.top_artists), [streamingData?.top_artists]);
    const streamingTopTracksJSON = useMemo(() => JSON.stringify(streamingData?.top_tracks), [streamingData?.top_tracks]);
    const streamingTopGenresJSON = useMemo(() => JSON.stringify(streamingData?.top_genres), [streamingData?.top_genres]);
    const streamingTopMoodsJSON = useMemo(() => JSON.stringify(streamingData?.top_moods), [streamingData?.top_moods]);

    // useEffect for profile/streaming data changes (with useRef pattern for content change detection)
    const prevProfileCityRef = useRef<string | null | undefined>(undefined);
    const prevProfileCountryRef = useRef<string | null | undefined>(undefined);
    const prevProfileBioJSONRef = useRef<string | undefined>(undefined);
    const prevProfileArtistsJSONRef = useRef<string | undefined>(undefined);
    const prevProfileAlbumsJSONRef = useRef<string | undefined>(undefined);
    const prevProfileSongsJSONRef = useRef<string | undefined>(undefined);
    const prevStreamingDataJSONRef = useRef<string | undefined>(undefined);
    const prevStreamingTopArtistsJSONRef = useRef<string | undefined>(undefined);
    const prevStreamingTopTracksJSONRef = useRef<string | undefined>(undefined);
    const prevStreamingTopGenresJSONRef = useRef<string | undefined>(undefined);
    const prevStreamingTopMoodsJSONRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (!session?.user?.id || !hasMusicLoverProfile) {
            return;
        }

        let changed = false;
        if (musicLoverProfile?.city !== prevProfileCityRef.current) changed = true;
        if (musicLoverProfile?.country !== prevProfileCountryRef.current) changed = true;
        if (profileBioJSON !== prevProfileBioJSONRef.current) changed = true;
        if (profileArtistsJSON !== prevProfileArtistsJSONRef.current) changed = true;
        if (profileAlbumsJSON !== prevProfileAlbumsJSONRef.current) changed = true;
        if (profileSongsJSON !== prevProfileSongsJSONRef.current) changed = true;
        if (streamingDataJSON !== prevStreamingDataJSONRef.current) changed = true;
        if (streamingTopArtistsJSON !== prevStreamingTopArtistsJSONRef.current) changed = true;
        if (streamingTopTracksJSON !== prevStreamingTopTracksJSONRef.current) changed = true;
        if (streamingTopGenresJSON !== prevStreamingTopGenresJSONRef.current) changed = true;
        if (streamingTopMoodsJSON !== prevStreamingTopMoodsJSONRef.current) changed = true;

        // Update refs for the next render *after* comparison
        const updateRefs = () => {
            prevProfileCityRef.current = musicLoverProfile?.city;
            prevProfileCountryRef.current = musicLoverProfile?.country;
            prevProfileBioJSONRef.current = profileBioJSON;
            prevProfileArtistsJSONRef.current = profileArtistsJSON;
            prevProfileAlbumsJSONRef.current = profileAlbumsJSON;
            prevProfileSongsJSONRef.current = profileSongsJSON;
            prevStreamingDataJSONRef.current = streamingDataJSON;
            prevStreamingTopArtistsJSONRef.current = streamingTopArtistsJSON;
            prevStreamingTopTracksJSONRef.current = streamingTopTracksJSON;
            prevStreamingTopGenresJSONRef.current = streamingTopGenresJSON;
            prevStreamingTopMoodsJSONRef.current = streamingTopMoodsJSON;
        };

        if (changed) {
            // Only log and fetch if it wasn't the initial population of refs
            const isInitialPopulation = prevProfileCityRef.current === undefined &&
                                      prevProfileCountryRef.current === undefined &&
                                      prevProfileBioJSONRef.current === undefined &&
                                      prevProfileArtistsJSONRef.current === undefined &&
                                      prevProfileAlbumsJSONRef.current === undefined &&
                                      prevProfileSongsJSONRef.current === undefined &&
                                      prevStreamingDataJSONRef.current === undefined &&
                                      prevStreamingTopArtistsJSONRef.current === undefined &&
                                      prevStreamingTopTracksJSONRef.current === undefined &&
                                      prevStreamingTopGenresJSONRef.current === undefined &&
                                      prevStreamingTopMoodsJSONRef.current === undefined;
            
            if (!isInitialPopulation) {
                console.log("[MatchesScreen] Profile/Streaming data content changed, triggering silent refresh of matches.");
                fetchMatchesCallback(true); // Perform a silent refresh
            }
        }
        updateRefs();

    }, [
        session?.user?.id, hasMusicLoverProfile, // Guard conditions
        musicLoverProfile?.city, musicLoverProfile?.country, // Primitives
        profileBioJSON, profileArtistsJSON, profileAlbumsJSON, profileSongsJSON, // Memoized strings for comparison
        streamingDataJSON, // Memoized string for comparison
        streamingTopArtistsJSON, streamingTopTracksJSON, streamingTopGenresJSON, streamingTopMoodsJSON, // Top streaming data
        fetchMatchesCallback // The action
    ]);

    // Ref for useFocusEffect to track content changes in streamingDataJSON
    const prevStreamingDataJSONFocusRef = useRef<string | undefined>(undefined);

    // Fetch matches when the screen is focused
    useFocusEffect(
        useCallback(() => {
            let significantChange = false;
            if (streamingDataJSON !== prevStreamingDataJSONFocusRef.current) {
                significantChange = true;
            }
            // If it's the very first run, prevRef will be undefined, consider it a significant change.
            if (prevStreamingDataJSONFocusRef.current === undefined) {
                significantChange = true;
            }

            if (significantChange) {
                if (session?.user?.id && hasMusicLoverProfile) {
                    console.log("[MatchesScreen] Focus effect (significant data change or first run): Fetching matches.");
                    fetchMatchesCallback(); // This call resets the index to 0

                    const isStreamingDataEffectivelyEmpty = streamingDataJSON === 'null' || streamingDataJSON === 'undefined' || streamingDataJSON === '{}';
                    if (isStreamingDataEffectivelyEmpty && !streamingDataLoading) {
                        console.log("[MatchesScreen] Focus effect: streamingData appears empty/null and not loading, fetching streaming data.");
                        fetchStreamingData();
                    }
                } else if (session?.user?.id && hasMusicLoverProfile) {
                    // Log if effect ran but no significant change was detected (after first run)
                    console.log("[MatchesScreen] Focus effect ran, but no significant change in streamingDataJSON content detected to re-fetch matches.");
                }
            }
            prevStreamingDataJSONFocusRef.current = streamingDataJSON;

        }, [
            session?.user?.id,
            hasMusicLoverProfile,
            fetchMatchesCallback,
            streamingDataJSON, // Callback re-created if this is new ref. Logic inside handles content change.
            streamingDataLoading,
            fetchStreamingData
        ])
    );

    const handleChatPress = useCallback((matchUserId: string) => {
        const matchDetails = matches.find(m => m.userId === matchUserId);
        if (!matchDetails) {
            console.error(`[MatchesScreen] Could not find details for match ${matchUserId}`);
            return;
        }

        const newMatches = matches.filter(match => match.userId !== matchUserId);
        setMatches(newMatches);
        console.log(`[MatchesScreen] Chat pressed for ${matchUserId}. Card removed locally. Navigating...`);
        
        if (newMatches.length === 0) {
            setCurrentMatchIndex(0);
        } else if (currentMatchIndex >= newMatches.length && newMatches.length > 0) {
            setCurrentMatchIndex(newMatches.length - 1);
        }
        
        // IMPORTANT: Ensure RootStackParamList for IndividualChatScreen accepts these params.
        // If linter errors persist here, the definition in AppNavigator.ts (or equivalent) for
        // IndividualChatScreen's params needs to be updated.
        navigation.navigate('IndividualChatScreen', {
            matchUserId: matchDetails.userId,
            matchName: matchDetails.name,
            matchProfilePicture: matchDetails.image,
            commonTags: matchDetails.commonTags, // Overall common tags
            // Pass the categorized common tags
            topArtists: matchDetails.topArtists,
            topTracks: matchDetails.topTracks,
            topGenres: matchDetails.topGenres,
            topMoods: matchDetails.topMoods, // Already filtered by premium status from SQL/mapping
            isFirstInteractionFromMatches: true
        });
    }, [matches, currentMatchIndex, navigation, currentUserIsPremium]);

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchMatchesCallback(); 
        fetchStreamingData(); // Also refresh streaming data on pull-to-refresh
    }, [fetchMatchesCallback, fetchStreamingData]);

    const handleNextMatch = () => {
        console.log('[MatchesScreen] handleNextMatch called. Current index:', currentMatchIndex, 'Total matches:', matches.length);
        if (currentMatchIndex < matches.length - 1) {
            setCurrentMatchIndex(currentMatchIndex + 1);
        }
    };

    const handlePreviousMatch = () => {
        console.log('[MatchesScreen] handlePreviousMatch called. Current index:', currentMatchIndex, 'Total matches:', matches.length);
        if (currentMatchIndex > 0) {
            setCurrentMatchIndex(currentMatchIndex - 1);
        }
    };

    // Primary loading state for initial profile and first match fetch
    if (authLoading || (!initialMatchesLoadAttempted && loadingMatches && !isRefreshing && matches.length === 0)) {
        return (
            <SafeAreaView style={styles.centered}>
                <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
                <Text style={styles.statusText}>Loading Profile & Matches...</Text>
            </SafeAreaView>
        );
    }

    if (!session || !musicLoverProfile) {
        return (
            <SafeAreaView style={styles.centered}>
                <Feather name="user-x" size={40} color={APP_CONSTANTS.COLORS.PRIMARY} />
                <Text style={styles.errorTitle}>Not Logged In</Text>
                <Text style={styles.errorSubtitle}>Please log in to see your matches.</Text>
            </SafeAreaView>
        );
    }
    
    const renderEmptyListComponent = () => {
        // If profile is loaded, and initial matches are being fetched for the first time
        if (!initialMatchesLoadAttempted && loadingMatches) {
            return (
                <View style={styles.centeredMessage}>
                    <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
                    <Text style={styles.statusText}>Finding your Vybs...</Text>
                </View>
            );
        }

        // If initial attempt is done and no matches, or any subsequent refresh yields no matches
        if (matches.length === 0 && initialMatchesLoadAttempted) {
        return (
                <View style={styles.centeredMessage}>
                    <Feather name="users" size={48} color={APP_CONSTANTS.COLORS.TEXT_SECONDARY} style={{marginBottom: 16}} />
                    <Text style={styles.emptyTitle}>No Matches Yet</Text>
                    <Text style={styles.emptySubtitle}>
                        Looks like there's no one new around matching your Vyb right now.
                        Try updating your profile details or check back later!
                    </Text>
            </View>
        );
        }
    };

    console.log('[MatchesScreen] Rendering. Current Index:', currentMatchIndex, 'Matches Count:', matches.length, 'InitialLoadAttempted:', initialMatchesLoadAttempted);

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                <View style={styles.header}>
                <Text style={styles.headerTitle}>Discover Vybs</Text>
                </View>
                <ScrollView
                contentContainerStyle={styles.scrollContentContainer}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={onRefresh}
                        colors={[APP_CONSTANTS.COLORS.PRIMARY]}
                        tintColor={APP_CONSTANTS.COLORS.PRIMARY}
                    />
                }
            >
                {matches.length > 0 && initialMatchesLoadAttempted ? (
                    <View style={styles.matchViewerContainer}>
                        <MatchCard
                            {...matches[currentMatchIndex]}
                            onChatPress={handleChatPress}
                        />
                        {matches.length > 1 && (
                            <View style={styles.navigationButtonsContainer}>
                                <TouchableOpacity
                                    style={[styles.navButton, currentMatchIndex === 0 && styles.navButtonDisabled]}
                                    onPress={handlePreviousMatch}
                                    disabled={currentMatchIndex === 0}
                                >
                                    <Feather name="arrow-left" size={24} color={currentMatchIndex === 0 ? '#B0B0B0' : APP_CONSTANTS.COLORS.PRIMARY} />
                                    <Text style={[styles.navButtonText, currentMatchIndex === 0 && styles.navButtonTextDisabled]}>Previous</Text>
                                </TouchableOpacity>
                                <Text style={styles.matchCounterText}>{`${currentMatchIndex + 1} / ${matches.length}`}</Text>
                                <TouchableOpacity
                                    style={[styles.navButton, currentMatchIndex === matches.length - 1 && styles.navButtonDisabled]}
                                    onPress={handleNextMatch}
                                    disabled={currentMatchIndex === matches.length - 1}
                                >
                                    <Text style={[styles.navButtonText, currentMatchIndex === matches.length - 1 && styles.navButtonTextDisabled]}>Next</Text>
                                    <Feather name="arrow-right" size={24} color={currentMatchIndex === matches.length - 1 ? '#B0B0B0' : APP_CONSTANTS.COLORS.PRIMARY} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                ) : (
                    renderEmptyListComponent() // This will show "No Matches Yet" or "Finding your Vybs..."
                )}
                </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND || '#F0F2F5', // A slightly off-white
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? 20 : 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: APP_CONSTANTS.COLORS.BORDER_LIGHT || '#E5E7EB',
        backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND_LIGHT || 'white',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: APP_CONSTANTS.COLORS.PRIMARY_DARK || '#1F2937',
        textAlign: 'center',
    },
    centered: { // For full screen loading/error states
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND || '#F0F2F5',
    },
    centeredMessage: { // For ListEmptyComponent content
        flex: 1, // Take available space if list is empty
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
        marginTop: Dimensions.get('window').height * 0.15, // Push down a bit
    },
    statusText: {
        marginTop: 15,
        fontSize: 16,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY || '#4B5563',
    },
    errorTitle: {
        marginTop: 15,
        fontSize: 20,
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.PRIMARY_DARK || '#1F2937',
        textAlign: 'center',
    },
    errorSubtitle: {
        marginTop: 8,
        fontSize: 15,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY || '#4B5563',
        textAlign: 'center',
        maxWidth: '85%',
    },
    listContentContainer: {
        paddingVertical: 8,
    },
    emptyListContainer: { // Ensures ListEmptyComponent can take up full space
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.PRIMARY_DARK || '#1F2937',
        marginBottom: 10,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY || '#4B5563',
        textAlign: 'center',
        paddingHorizontal: 20,
        lineHeight: 20,
    },
    scrollContentContainer: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    matchViewerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
    },
    navigationButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        width: '90%',
        maxWidth: 400,
        marginTop: 15,
        paddingHorizontal: 10,
    },
    navButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 25,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    navButtonDisabled: {
        backgroundColor: '#F0F0F0',
        borderColor: '#D0D0D0',
    },
    navButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.PRIMARY,
        marginHorizontal: 8,
    },
    navButtonTextDisabled: {
        color: '#A0A0A0',
    },
    matchCounterText: {
        fontSize: 14,
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    }
});

export default MatchesScreen;