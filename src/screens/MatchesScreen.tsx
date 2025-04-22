import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Platform,
    RefreshControl, // Added for pull-to-refresh
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
// --- Adjust these import paths based on YOUR project structure ---
import MatchCard, { MusicLoverBio } from "@/components/MatchCard"; // Assuming MatchCard is default export now
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { APP_CONSTANTS } from "@/config/constants";
// --- End Adjustments ---

// Interface includes commonTags
interface FetchedMatchData {
    userId: string;
    profileId: string;
    firstName: string;
    lastName: string;
    profilePicture: string | null;
    isPremium: boolean;
    bio: MusicLoverBio | null;
    compatibilityScore: number;
    commonTags: string[]; // <<< Interface is correct
}

const DEFAULT_PROFILE_PIC = APP_CONSTANTS?.DEFAULT_PROFILE_PIC || 'https://via.placeholder.com/150/CCCCCC/808080?text=No+Image';

const MatchesScreen = () => {
    const { session, loading: authLoading } = useAuth();
    const [matches, setMatches] = useState<FetchedMatchData[]>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchMatches = useCallback(async (refreshing = false) => {
        if (!session?.user?.id) {
            setError("You must be logged in to find matches.");
            setIsLoading(false); setIsRefreshing(false); return;
        }
        if (!refreshing) setIsLoading(true);
        setError(null);

        try {
            console.log("[MatchesScreen] Calling RPC 'get_matches_sql' for user:", session.user.id);
            const { data, error: rpcError } = await supabase.rpc(
                'get_matches_sql',
                { current_user_id_input: session.user.id }
            );

            if (rpcError) {
                if (rpcError.code === '42883') { throw new Error("Match function not found or mismatch."); }
                else { throw new Error(rpcError.message || "Failed to fetch matches via RPC."); }
            }

            if (data && Array.isArray(data)) {
                 console.log(`[MatchesScreen] Received ${data.length} matches via RPC.`);
                 // Add console log to check received data including commonTags
                 if (data.length > 0) {
                     console.log("[MatchesScreen] First match data received:", data[0]);
                 }
                 setMatches(data as FetchedMatchData[]);
                 setCurrentMatchIndex(0);
                 if (data.length === 0) console.log("[MatchesScreen] No matches found.");
                 setError(null);
            } else {
                console.warn("[MatchesScreen] Received unexpected data format from RPC:", data);
                setMatches([]); setCurrentMatchIndex(0); setError("Received invalid match data.");
            }
        } catch (err: any) {
            console.error("[MatchesScreen] Error fetching matches:", err);
            setError(err.message || "An unexpected error occurred while fetching matches.");
            setMatches([]); setCurrentMatchIndex(0);
        } finally {
            setIsLoading(false); setIsRefreshing(false);
        }
    }, [session?.user?.id]);

    useEffect(() => {
        if (!authLoading && session?.user?.id) { fetchMatches(); }
        else if (!authLoading && !session?.user?.id) {
            setIsLoading(false); setError("Please log in to see matches."); setMatches([]); setCurrentMatchIndex(0);
        }
    }, [authLoading, session?.user?.id, fetchMatches]);

    const onRefresh = useCallback(() => {
        setIsRefreshing(true); fetchMatches(true);
    }, [fetchMatches]);

    const goToNextMatch = () => {
        if (matches.length > 1) { setCurrentMatchIndex((prev) => (prev + 1) % matches.length); }
    };

    const currentMatchData = matches.length > 0 ? matches[currentMatchIndex] : null;

    // --- Render Logic ---
    const renderContent = () => {
        if (isLoading) { /* ... Loading UI ... */
             return ( <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || "#3B82F6"} /><Text style={styles.infoText}>Finding matches...</Text></View> );
        }
        if (error) { /* ... Error UI ... */
            return ( <View style={styles.centered}><Feather name="alert-circle" size={48} color="#EF4444" /><Text style={styles.errorText}>Oops!</Text><Text style={styles.errorSubText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => fetchMatches()}><Feather name="refresh-cw" size={16} color="white" /><Text style={styles.retryButtonText}>Try Again</Text></TouchableOpacity></View> );
        }
        if (!currentMatchData) { /* ... No Matches UI ... */
            return ( <View style={styles.centered}><Feather name="users" size={48} color="#6B7280" /><Text style={styles.infoText}>No Matches Found</Text><Text style={styles.infoSubText}>Try updating your profile or check back later!</Text></View> );
        }

        // Display the match card
        return (
            <View style={styles.mainContent}>
                <MatchCard
                    id={currentMatchData.profileId}
                    userId={currentMatchData.userId}
                    name={`${currentMatchData.firstName || ''} ${currentMatchData.lastName || ''}`.trim()}
                    image={currentMatchData.profilePicture ?? DEFAULT_PROFILE_PIC}
                    bio={currentMatchData.bio}
                    isPremium={currentMatchData.isPremium}
                    commonTags={currentMatchData.commonTags ?? []} // <<< ADD THIS PROP (using ?? [] as fallback)
                    // Pass commonTags, provide empty array as fallback if it's null/undefined for safety
                />
            </View>
        );
    }; // End renderContent


    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={["rgba(59, 130, 246, 0.05)", "white"]} style={styles.background} >
                {/* Header */}
                 <View style={styles.header}>
                      {/* ... header content ... */}
                       <View style={styles.headerInner}>
                          <View style={styles.headerTitleRow}>
                              <View style={styles.titleContainer}><Feather name="heart" size={22} color="#60A5FA" style={styles.headerIcon} /><Text style={styles.title}>Matches</Text>{matches.length > 0 && (<Text style={styles.matchCount}>({currentMatchIndex + 1}/{matches.length})</Text>)}</View>
                          </View>
                          <View style={styles.headerSubtitleRow}>
                             <Text style={styles.subtitle}>Your potential music connections</Text>
                             <TouchableOpacity style={[styles.nextButton, matches.length <= 1 && styles.disabledButton]} activeOpacity={matches.length <= 1 ? 1 : 0.7} onPress={goToNextMatch} disabled={matches.length <= 1} >
                                 <Text style={[styles.nextButtonText, matches.length <= 1 && styles.disabledButtonText]}>Next match</Text>
                                 <Feather name="arrow-right" size={16} color={matches.length <= 1 ? "#9CA3AF" : "#3B82F6"} />
                             </TouchableOpacity>
                          </View>
                      </View>
                 </View>

                 {/* Scrollable content area */}
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={onRefresh}
                            colors={[APP_CONSTANTS?.COLORS?.PRIMARY || "#3B82F6"]}
                            tintColor={APP_CONSTANTS?.COLORS?.PRIMARY || "#3B82F6"}
                        />
                    }
                 >
                    {renderContent()}
                </ScrollView>
            </LinearGradient>
        </SafeAreaView>
    );
};

// --- Styles --- (Keep the previous styles)
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
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, marginTop: -50, },
    mainContent: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24, alignItems: "center", width: '100%', },
    infoText: { marginTop: 15, fontSize: 18, fontWeight: '600', color: '#4B5563', textAlign: 'center', },
    infoSubText: { marginTop: 8, fontSize: 14, color: '#6B7280', textAlign: 'center', maxWidth: '85%', lineHeight: 20, },
    errorText: { marginTop: 15, fontSize: 18, fontWeight: '600', color: '#DC2626', textAlign: 'center', },
    errorSubText: { marginTop: 8, fontSize: 14, color: '#4B5563', textAlign: 'center', maxWidth: '90%', lineHeight: 20, },
    retryButton: { flexDirection: 'row', alignItems: 'center', marginTop: 25, backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2, },
    retryButtonText: { color: 'white', fontWeight: '600', fontSize: 15, marginLeft: 8, }
});


export default MatchesScreen;