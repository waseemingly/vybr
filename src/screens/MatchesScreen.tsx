import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
// --- Adjust these import paths based on YOUR project structure ---
// Import MatchCard AND the MusicLoverBio type if it's defined there
import MatchCard, { MusicLoverBio } from "@/components/MatchCard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { APP_CONSTANTS } from "@/config/constants"; // Optional
// --- End Adjustments ---

/**
 * **UPDATED Interface:** Defines the structure returned by the SQL function `get_matches_sql` (Version 13+)
 * Includes the 'bio' object and removes 'compatibilityScore' if SQL doesn't return it,
 * or keeps it if SQL still returns it but MatchCard ignores it.
 * Assuming SQL function (V13+) returns the bio object.
 */
interface FetchedMatchData {
    userId: string;
    profileId: string;
    firstName: string;
    lastName: string;
    profilePicture: string | null;
    isPremium: boolean;
    bio: MusicLoverBio | null; // <<<< Added bio object
    compatibilityScore: number; // <<<< Keep if SQL function still returns it, otherwise remove
                                // MatchCard component will ignore this prop anyway.
}

const DEFAULT_PROFILE_PIC = 'https://via.placeholder.com/150/CCCCCC/808080?text=No+Image';

const MatchesScreen = () => {
    const { session, loading: authLoading } = useAuth();
    // State now uses the updated FetchedMatchData interface
    const [matches, setMatches] = useState<FetchedMatchData[]>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMatches = useCallback(async () => {
        if (!session?.user?.id) {
            setError("You must be logged in to find matches.");
            setIsLoading(false); return;
        }
        setIsLoading(true); setError(null); setMatches([]); setCurrentMatchIndex(0);

        try {
            console.log("[MatchesScreen] Calling RPC 'get_matches_sql' for user:", session.user.id);

            const { data, error: rpcError } = await supabase.rpc(
                'get_matches_sql',
                { current_user_id_input: session.user.id }
            );

            if (rpcError) throw new Error(rpcError.message || "Failed to fetch matches via RPC.");

            if (data && Array.isArray(data)) {
                 console.log(`[MatchesScreen] Received ${data.length} matches via RPC.`);
                 // Cast to the updated FetchedMatchData type
                 setMatches(data as FetchedMatchData[]);
                 if (data.length === 0) console.log("[MatchesScreen] No matches found.");
            } else {
                console.warn("[MatchesScreen] Received unexpected data format from RPC:", data);
                setMatches([]);
            }
        } catch (err: any) {
            console.error("[MatchesScreen] Error fetching matches:", err);
            setError(err.message || "An unexpected error occurred.");
            setMatches([]);
        } finally { setIsLoading(false); }
    }, [session?.user?.id]);

    useEffect(() => {
        if (!authLoading && session?.user?.id) fetchMatches();
        else if (!authLoading && !session?.user?.id) { setIsLoading(false); setError("Please log in to see matches."); setMatches([]); }
    }, [authLoading, session?.user?.id, fetchMatches]);

    const goToNextMatch = () => {
        if (matches.length > 1) setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
    };

    const currentMatchData = matches.length > 0 ? matches[currentMatchIndex] : null;

    // --- Render Logic ---
    if (authLoading || isLoading) { /* ... Loading UI ... */ }
    if (error) { /* ... Error UI ... */ }
    if (!currentMatchData && !isLoading) { /* ... No Matches UI ... */ }

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={["rgba(59, 130, 246, 0.05)", "white"]} style={styles.background} >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} >
                    {/* Header remains the same */}
                    <View style={styles.header}>
                         {/* ... Header JSX ... */}
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

                    {/* Main Content - Pass CORRECT props to MatchCard */}
                    {currentMatchData && (
                        <View style={styles.mainContent}>
                            <MatchCard
                                id={currentMatchData.profileId} // Pass profileId
                                userId={currentMatchData.userId} // Pass auth userId
                                name={`${currentMatchData.firstName || ''} ${currentMatchData.lastName || ''}`.trim()}
                                image={currentMatchData.profilePicture ?? DEFAULT_PROFILE_PIC}
                                bio={currentMatchData.bio} // <<<< Pass the bio OBJECT
                                isPremium={currentMatchData.isPremium}
                                // <<<< NO compatibilityScore prop passed here
                            />
                        </View>
                    )}
                </ScrollView>
            </LinearGradient>
        </SafeAreaView>
    );
};

// --- Styles --- (Keep the COMPLETE styles object from previous responses)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "white", },
    background: { flex: 1, },
    scrollContent: { flexGrow: 1, paddingBottom: 80, },
    header: { paddingTop: Platform.OS === 'android' ? 20 : 16, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: 'rgba(255, 255, 255, 0.8)', },
    headerInner: { width: "100%", },
    headerTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4, },
    titleContainer: { flexDirection: "row", alignItems: "center", },
    headerIcon: { marginRight: 8, },
    title: { fontSize: 22, fontWeight: "bold", color: "#3B82F6", },
    matchCount: { fontSize: 14, color: "#6B7280", marginLeft: 10, fontWeight: "500", },
    headerSubtitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, },
    subtitle: { fontSize: 14, color: "#6B7280", },
    nextButton: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, backgroundColor: 'rgba(59, 130, 246, 0.1)', },
    nextButtonText: { color: "#3B82F6", marginRight: 6, fontSize: 14, fontWeight: '500', },
    disabledButton: { backgroundColor: 'rgba(209, 213, 219, 0.3)', },
    disabledButtonText: { color: "#9CA3AF", },
    mainContent: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24, alignItems: "center", },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F9FAFB', },
    infoText: { marginTop: 15, fontSize: 18, fontWeight: '600', color: '#4B5563', textAlign: 'center', },
    infoSubText: { marginTop: 8, fontSize: 14, color: '#6B7280', textAlign: 'center', maxWidth: '85%', },
    errorText: { marginTop: 15, fontSize: 18, fontWeight: '600', color: '#DC2626', textAlign: 'center', },
    errorSubText: { marginTop: 8, fontSize: 14, color: '#4B5563', textAlign: 'center', maxWidth: '90%', },
    retryButton: { flexDirection: 'row', alignItems: 'center', marginTop: 25, backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2, },
    retryButtonText: { color: 'white', fontWeight: '600', fontSize: 15, marginLeft: 8, }
});

export default MatchesScreen;