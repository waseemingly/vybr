// screens/MatchesScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Platform,
    RefreshControl
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage
import MatchCard, { MusicLoverBio } from "@/components/MatchCard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { APP_CONSTANTS } from "@/config/constants";
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from "@/navigation/AppNavigator";
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth'; // Import the Spotify hook

// Interface
interface FetchedMatchData {
    userId: string;
    profileId: string;
    firstName: string;
    lastName: string;
    profilePicture: string | null;
    isPremium: boolean;
    bio: MusicLoverBio | null;
    compatibilityScore: number;
    commonTags: string[];
}

// Constants
const DEFAULT_PROFILE_PIC = APP_CONSTANTS?.DEFAULT_PROFILE_PIC || 'https://via.placeholder.com/150/CCCCCC/808080?text=No+Image';
const CHATTED_USERS_STORAGE_KEY = '@ChattedUserIds';

type MatchesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MatchesScreen'>;


const MatchesScreen = () => {
    const { session, loading: authLoading } = useAuth();
    const navigation = useNavigation<MatchesScreenNavigationProp>();
    const [matches, setMatches] = useState<FetchedMatchData[]>([]); // Raw non-blocked matches
    const [filteredMatches, setFilteredMatches] = useState<FetchedMatchData[]>([]); // Displayed matches
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [chattedUserIds, setChattedUserIds] = useState<Set<string>>(new Set());
    const [chattedIdsLoaded, setChattedIdsLoaded] = useState(false); // Track storage load
    const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
    const chattedUserIdsRef = useRef(chattedUserIds); // Ref for saving
    const [isCurrentUserPremium, setIsCurrentUserPremium] = useState<boolean>(false); // State for logged-in user's premium status

    // Keep Ref updated
    useEffect(() => {
        chattedUserIdsRef.current = chattedUserIds;
    }, [chattedUserIds]);

    // --- Load Chatted IDs ---
    useEffect(() => {
        const loadChattedIds = async () => {
            if (!session?.user?.id) {
                 setChattedUserIds(new Set());
                 setChattedIdsLoaded(true);
                 return;
            }
            setChattedIdsLoaded(false); // Reset loading state
            try {
                const storedIdsJson = await AsyncStorage.getItem(`${CHATTED_USERS_STORAGE_KEY}_${session.user.id}`);
                if (storedIdsJson !== null) {
                    const storedIdsArray = JSON.parse(storedIdsJson);
                    setChattedUserIds(new Set(storedIdsArray));
                    console.log("[MatchesScreen] Loaded chatted IDs:", storedIdsArray.length);
                } else {
                     setChattedUserIds(new Set());
                     console.log("[MatchesScreen] No chatted IDs found in storage.");
                }
            } catch (e) {
                console.error("[MatchesScreen] Failed to load chatted IDs:", e);
                 setChattedUserIds(new Set());
            } finally {
                setChattedIdsLoaded(true);
            }
        };
        loadChattedIds();
    }, [session?.user?.id]);

    // --- Save Chatted IDs ---
    useEffect(() => {
        const saveChattedIds = async () => {
            if (chattedIdsLoaded && session?.user?.id && chattedUserIdsRef.current) {
                try {
                    const idsArray = Array.from(chattedUserIdsRef.current);
                    const jsonValue = JSON.stringify(idsArray);
                    await AsyncStorage.setItem(`${CHATTED_USERS_STORAGE_KEY}_${session.user.id}`, jsonValue);
                    // console.log("[MatchesScreen] Saved chatted IDs:", idsArray.length); // Optional: Log on save
                } catch (e) {
                    console.error("[MatchesScreen] Failed to save chatted IDs:", e);
                }
            }
        };
        // Save slightly delayed to batch potential rapid changes
        const timerId = setTimeout(saveChattedIds, 500);
        return () => clearTimeout(timerId); // Cleanup timer on unmount or re-run

    }, [chattedUserIds, chattedIdsLoaded, session?.user?.id]); // Depend on state


    // --- Fetch Logged-in User Premium Status ---
    const fetchCurrentUserPremiumStatus = useCallback(async () => {
        if (!session?.user?.id) {
            setIsCurrentUserPremium(false);
            return;
        }
        try {
            const { data, error } = await supabase
                .from('music_lover_profiles')
                .select('is_premium')
                .eq('user_id', session.user.id)
                .single();

            if (error) {
                console.error("[MatchesScreen] Error fetching current user premium status:", error);
                setIsCurrentUserPremium(false); // Assume not premium on error
            } else if (data) {
                setIsCurrentUserPremium(data.is_premium ?? false);
                console.log("[MatchesScreen] Current user premium status:", data.is_premium);
            } else {
                setIsCurrentUserPremium(false); // Profile might not exist yet
            }
        } catch (err) {
            console.error("[MatchesScreen] Exception fetching current user premium status:", err);
            setIsCurrentUserPremium(false);
        }
    }, [session?.user?.id]);

    // --- Fetch Blocked Users ---
    const fetchBlockedUsers = useCallback(async () => {
        if (!session?.user?.id) return new Set<string>();
        try {
            const { data, error } = await supabase
                .from('blocks').select('blocker_id, blocked_id')
                .or(`blocker_id.eq.${session.user.id},blocked_id.eq.${session.user.id}`);
            if (error) throw error;
            const blockedIds = new Set<string>();
            data?.forEach(item => {
                if (session?.user && item.blocker_id === session.user.id) {
                    blockedIds.add(item.blocked_id);
                } else if (session?.user && item.blocked_id === session.user.id) {
                    blockedIds.add(item.blocker_id);
                }
            });
            console.log("[MatchesScreen] Fetched blocked user IDs:", blockedIds.size);
            return blockedIds;
        } catch (err: any) {
            console.error("[MatchesScreen] Error fetching blocked users:", err);
            setError(prev => prev || "Could not check blocked users.");
            return new Set<string>();
        }
    }, [session?.user?.id]);

    // --- Fetch Matches & Blocks ---
    const fetchMatchesAndBlocks = useCallback(async (refreshing = false) => {
        if (!session?.user?.id || !chattedIdsLoaded) { // Wait for chatted IDs load
            if (!session?.user?.id) setError("You must be logged in.");
             // Keep loading true if waiting for chatted IDs
            setIsLoading(!chattedIdsLoaded);
            setIsRefreshing(false); return;
        }
        if (!refreshing) setIsLoading(true);
        setError(null);

        try {
            const currentBlockedIds = await fetchBlockedUsers();
            setBlockedUserIds(currentBlockedIds);

            const { data: rpcData, error: rpcError } = await supabase.rpc('get_matches_sql', { current_user_id_input: session.user.id });
            if (rpcError) throw new Error(rpcError.message || "Failed to fetch matches via RPC.");

            if (rpcData && Array.isArray(rpcData)) {
                const fetchedData = rpcData as FetchedMatchData[];
                const nonBlockedData = fetchedData.filter(m => !currentBlockedIds.has(m.userId));
                setMatches(nonBlockedData);
                console.log(`[MatchesScreen] Fetched ${nonBlockedData.length} non-blocked matches.`);
            } else {
                 console.warn("[MatchesScreen] Invalid data from RPC:", rpcData);
                 setMatches([]); setError("Received invalid match data.");
            }
        } catch (err: any) {
            console.error("[MatchesScreen] Error fetching matches/blocks:", err);
            setError(err.message || "An unexpected error occurred.");
            setMatches([]); // Clear matches on error
        } finally {
            setIsLoading(false); setIsRefreshing(false);
        }
    }, [session?.user?.id, fetchBlockedUsers, chattedIdsLoaded]);

    // --- Initial Fetch ---
    useEffect(() => {
        if (!authLoading && session?.user?.id && chattedIdsLoaded) {
            fetchCurrentUserPremiumStatus(); // Fetch premium status
            fetchMatchesAndBlocks();
        } else if (!authLoading && !session?.user?.id) {
            setIsLoading(false);
            setError("Please log in.");
            setMatches([]);
            setFilteredMatches([]);
            setCurrentMatchIndex(0);
            setChattedUserIds(new Set());
            setChattedIdsLoaded(true); // Ensure loaded flag is true on logout
            setIsCurrentUserPremium(false); // Reset premium status on logout
        } else if (!authLoading && session?.user?.id && !chattedIdsLoaded) {
            setIsLoading(true); // Explicitly set loading while waiting for chatted IDs
        }
    }, [authLoading, session?.user?.id, chattedIdsLoaded, fetchMatchesAndBlocks, fetchCurrentUserPremiumStatus]); // Added fetchCurrentUserPremiumStatus dependency

    // --- Re-apply filters ---
    useEffect(() => {
        if (!chattedIdsLoaded) return; // Don't filter until initial chatted IDs are loaded

        const currentChattedIds = chattedUserIdsRef.current; // Use ref for filtering consistency
        const newFiltered = matches.filter(m =>
            !currentChattedIds.has(m.userId) && !blockedUserIds.has(m.userId)
        );

        setFilteredMatches(prevFiltered => {
            if (prevFiltered.length === newFiltered.length && prevFiltered.every((val, index) => val.userId === newFiltered[index]?.userId)) {
                return prevFiltered;
            }
             console.log("[MatchesScreen] Updating filtered matches list.");
             return newFiltered;
        });

        setCurrentMatchIndex(prevIndex => {
            if (newFiltered.length === 0) return 0;
            if (prevIndex >= newFiltered.length) return Math.max(0, newFiltered.length - 1);
            return prevIndex;
        });

    }, [matches, chattedUserIds, blockedUserIds, chattedIdsLoaded]); // chattedUserIds state triggers re-filter


    // --- Refresh Logic ---
    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchMatchesAndBlocks(true);
    }, [fetchMatchesAndBlocks]);

     // --- Refetch blocks on focus ---
     useFocusEffect(
         useCallback(() => {
             if (session?.user?.id) { // Only fetch if logged in
                 console.log("[MatchesScreen] Focus effect: Fetching blocked users.");
                 fetchBlockedUsers().then(currentBlockedIds => {
                     setBlockedUserIds(prevBlockedIds => {
                         if (prevBlockedIds.size === currentBlockedIds.size && [...prevBlockedIds].every(id => currentBlockedIds.has(id))) {
                             return prevBlockedIds; // No change
                         }
                         console.log("[MatchesScreen] Blocked users updated on focus.");
                         return currentBlockedIds; // Update
                     });
                 });
             }
         }, [fetchBlockedUsers, session?.user?.id])
     );

    // --- Navigation Actions ---
    const goToNextMatch = () => {
        if (filteredMatches.length > 0) {
            setCurrentMatchIndex((prev) => (prev + 1) % filteredMatches.length);
        }
    };

    const handleInitiateChat = (match: FetchedMatchData) => {
        const userIdToMark = match.userId;

        // 1. Update the chatted IDs state
        let updatedChattedIds = chattedUserIds; // Assume no change initially
        if (!chattedUserIds.has(userIdToMark)) {
            console.log(`[MatchesScreen] Marking user ${userIdToMark} as chatted.`);
            updatedChattedIds = new Set(chattedUserIds);
            updatedChattedIds.add(userIdToMark);
            setChattedUserIds(updatedChattedIds); // Trigger state update (and async save)
        }

        // 2. Directly compute the new filtered list based on the *updated* IDs
        // Use the 'updatedChattedIds' variable which holds the latest set
        // console.log('[MatchesScreen] Directly recalculating filtered matches...');
        // const newFiltered = matches.filter(m =>
        //     !updatedChattedIds.has(m.userId) && !blockedUserIds.has(m.userId)
        // );

        // 3. Update the filteredMatches state
        // setFilteredMatches(newFiltered);
        // console.log(`[MatchesScreen] Filtered matches updated. New count: ${newFiltered.length}`);

        // 4. Update the current index if needed (e.g., stay on current index if possible, or move to last)
        // Note: This logic now relies on the filtering useEffect to update filteredMatches before the index potentially needs adjustment on re-render.
        // The useEffect dependency array includes filteredMatches indirectly via matches/chattedIds/blockedIds.
        // Let's keep the index adjustment simple for now, assuming the useEffect handles the list update promptly.
        setCurrentMatchIndex(prevIndex => {
            // Get the length of the list *after* the useEffect is expected to run
            const newFilteredLength = matches.filter(m =>
                !updatedChattedIds.has(m.userId) && !blockedUserIds.has(m.userId)
            ).length;

            if (newFilteredLength === 0) return 0;
            // Simple approach: If previous index is now out of bounds, go to the new last item. Otherwise stay.
            const adjustedIndex = Math.min(prevIndex, Math.max(0, newFilteredLength - 1));
            // console.log(`[MatchesScreen] Adjusting index from ${prevIndex} for anticipated new list size ${newFilteredLength}. New index: ${adjustedIndex}`);
            return adjustedIndex;
        });

        // 5. Navigate
        console.log(`[MatchesScreen] Navigating to chat with ${userIdToMark}.`);
        navigation.navigate('IndividualChatScreen', {
            matchUserId: userIdToMark,
            matchName: `${match.firstName || ''} ${match.lastName || ''}`.trim() || 'User',
            matchProfilePicture: match.profilePicture,
        });
    };

    const currentMatchData = filteredMatches.length > 0 ? filteredMatches[currentMatchIndex] : null;

    // --- Render Logic ---
    const renderContent = () => {
        if (isLoading || !chattedIdsLoaded) {
             return ( <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || "#3B82F6"} /><Text style={styles.infoText}>Loading data...</Text></View> );
        }
        if (error && !currentMatchData) {
            return ( <View style={styles.centered}><Feather name="alert-circle" size={48} color="#EF4444" /><Text style={styles.errorText}>Oops!</Text><Text style={styles.errorSubText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => fetchMatchesAndBlocks()}><Feather name="refresh-cw" size={16} color="white" /><Text style={styles.retryButtonText}>Try Again</Text></TouchableOpacity></View> );
        }
        if (!currentMatchData) {
            if (matches.length > 0) { // Had potential matches, but all filtered
                 return ( <View style={styles.centered}><Feather name="check-circle" size={48} color="#10B981" /><Text style={styles.infoText}>All Caught Up!</Text><Text style={styles.infoSubText}>You've seen, chatted with, or blocked everyone currently available. Pull down to refresh later!</Text></View> );
            } else { // Truly no matches found
                 return ( <View style={styles.centered}><Feather name="users" size={48} color="#6B7280" /><Text style={styles.infoText}>No Matches Found Yet</Text><Text style={styles.infoSubText}>Widen your search or check back later. Pull down to refresh!</Text></View> );
            }
        }
        // Display MatchCard
        return (
            <View style={styles.mainContent}>
                <MatchCard
                    id={currentMatchData.profileId}
                    userId={currentMatchData.userId}
                    name={`${currentMatchData.firstName || ''} ${currentMatchData.lastName || ''}`.trim()}
                    image={currentMatchData.profilePicture ?? DEFAULT_PROFILE_PIC}
                    bio={currentMatchData.bio}
                    isPremium={currentMatchData.isPremium}
                    commonTags={currentMatchData.commonTags ?? []}
                    compatibilityScore={currentMatchData.compatibilityScore}
                    onChatPress={() => handleInitiateChat(currentMatchData)}
                    isViewerPremium={isCurrentUserPremium}
                />
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={["rgba(59, 130, 246, 0.05)", "white"]} style={styles.background}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerInner}>
                        <View style={styles.headerTitleRow}>
                            <View style={styles.titleContainer}>
                                <Feather name="heart" size={22} color="#60A5FA" style={styles.headerIcon} />
                                <Text style={styles.title}>Matches</Text>
                                {filteredMatches.length > 0 && (
                                    <Text style={styles.matchCount}>({currentMatchIndex + 1}/{filteredMatches.length})</Text>
                                )}
                            </View>
                        </View>
                        <View style={styles.headerSubtitleRow}>
                            <Text style={styles.subtitle}>Your potential music connections</Text>
                            <TouchableOpacity
                                style={[styles.nextButton, filteredMatches.length <= 1 && styles.disabledButton]}
                                activeOpacity={filteredMatches.length <= 1 ? 1 : 0.7}
                                onPress={goToNextMatch}
                                disabled={filteredMatches.length <= 1} >
                                <Text style={[styles.nextButtonText, filteredMatches.length <= 1 && styles.disabledButtonText]}>
                                    {filteredMatches.length <= 1 ? 'No More' : 'Next Match'}
                                </Text>
                                <Feather name="arrow-right" size={16} color={filteredMatches.length <= 1 ? "#9CA3AF" : "#3B82F6"} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
                {/* ScrollView */}
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={onRefresh}
                            colors={[APP_CONSTANTS?.COLORS?.PRIMARY || "#3B82F6"]}
                            tintColor={APP_CONSTANTS?.COLORS?.PRIMARY || "#3B82F6"} />
                    } >
                    {renderContent()}
                </ScrollView>
            </LinearGradient>
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "white", },
    background: { flex: 1, },
    scrollContent: { flexGrow: 1, paddingBottom: Platform.OS === 'ios' ? 40 : 80, },
    header: { paddingTop: Platform.OS === 'android' ? 20 : 16, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: 'rgba(255, 255, 255, 0.9)', },
    headerInner: { width: "100%", },
    headerTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", },
    titleContainer: { flexDirection: "row", alignItems: "center", },
    headerIcon: { marginRight: 8, },
    title: { fontSize: 22, fontWeight: "700", color: "#3B82F6", },
    matchCount: { fontSize: 13, color: "#6B7280", marginLeft: 10, fontWeight: "500", fontVariant: ['tabular-nums'], },
    headerSubtitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, },
    subtitle: { fontSize: 14, color: "#4B5563", },
    nextButton: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: 'rgba(59, 130, 246, 0.1)', },
    nextButtonText: { color: "#3B82F6", marginRight: 6, fontSize: 14, fontWeight: '600', },
    disabledButton: { backgroundColor: 'rgba(209, 213, 219, 0.4)', },
    disabledButtonText: { color: "#9CA3AF", },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, marginTop: -50, textAlign: 'center', },
    mainContent: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24, alignItems: "center", width: '100%', },
    infoText: { marginTop: 15, fontSize: 18, fontWeight: '600', color: '#4B5563', textAlign: 'center', },
    infoSubText: { marginTop: 8, fontSize: 14, color: '#6B7280', textAlign: 'center', maxWidth: '85%', lineHeight: 20, },
    errorText: { marginTop: 15, fontSize: 18, fontWeight: '600', color: '#DC2626', textAlign: 'center', },
    errorSubText: { marginTop: 8, fontSize: 14, color: '#4B5563', textAlign: 'center', maxWidth: '90%', lineHeight: 20, },
    retryButton: { flexDirection: 'row', alignItems: 'center', marginTop: 25, backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2, },
    retryButtonText: { color: 'white', fontWeight: '600', fontSize: 15, marginLeft: 8, }
});

export default MatchesScreen;