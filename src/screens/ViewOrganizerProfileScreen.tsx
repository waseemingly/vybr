import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
    ActivityIndicator, Alert, RefreshControl, Modal, TextInput, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Linking } from 'react-native';

// --- !!! ADJUST PATHS !!! ---
import { supabase } from "@/lib/supabase"; // Assuming standard path
import { useAuth } from "@/hooks/useAuth";
import { APP_CONSTANTS } from "@/config/constants";
import type { RootStackParamList, MainStackParamList } from '@/navigation/AppNavigator'; // Assuming AppNavigator exports these
import { OrganizerProfile } from '@/hooks/useAuth'; // Import OrganizerProfile type
// ----------------------------

// --- Navigation and Route Types ---
// Ensure MainStackParamList defines: ViewOrganizerProfileScreen: { organizerUserId: string };
type ViewOrganizerProfileRouteParams = { organizerUserId?: string };
type ViewOrganizerProfileRouteProp = RouteProp<MainStackParamList, 'ViewOrganizerProfileScreen'>;
type ViewOrganizerProfileNavigationProp = NativeStackNavigationProp<RootStackParamList & MainStackParamList>;

// --- Constants ---
const DEFAULT_ORGANIZER_LOGO = 'https://via.placeholder.com/150/BFDBFE/1E40AF?text=Logo';

// --- Helper Functions ---
const formatBusinessType = (type?: string | null): string | null => { if (!type) return null; return type.replace(/_/g, ' ').replace(/-/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '); };

// Helper to try opening links (add Linking import if not present)
const tryOpenLink = async (url: string | null | undefined) => {
    if (!url) return;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
        await Linking.openURL(url);
    } else {
        Alert.alert(`Don't know how to open this URL: ${url}`);
    }
};

// --- Component ---
const ViewOrganizerProfileScreen: React.FC = () => {
    const navigation = useNavigation<ViewOrganizerProfileNavigationProp>();
    const route = useRoute<ViewOrganizerProfileRouteProp>();
    // Get organizer's user ID from route params, handling potential unknown type
    const params = route.params as ViewOrganizerProfileRouteParams | undefined;
    const organizerUserId = params?.organizerUserId;
    const { session, loading: authLoading } = useAuth(); // Get current user session

    const [organizerProfile, setOrganizerProfile] = useState<OrganizerProfile | null>(null);
    const [profileLoading, setProfileLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [stats, setStats] = useState<{ followerCount: number | null; eventCount: number | null }>({ followerCount: null, eventCount: null });
    const [statsLoading, setStatsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reportModalVisible, setReportModalVisible] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [isReporting, setIsReporting] = useState(false);

    const currentUserId = session?.user?.id;

    // --- Data Fetching ---
    // Add check for organizerUserId at the beginning
    useEffect(() => {
        if (!organizerUserId) {
            setError("Organizer ID not provided in route.");
            setProfileLoading(false);
            setStatsLoading(false);
            setFollowLoading(false);
        }
    }, [organizerUserId]);

    const fetchOrganizerProfile = useCallback(async () => {
        if (!organizerUserId) { setError("Organizer ID missing."); setProfileLoading(false); return; } // Guard added
        console.log(`[ViewOrganizerProfile] Fetching profile for organizer user ID: ${organizerUserId}`);
        if (!isRefreshing) setProfileLoading(true);
        setError(null);

        try {
            const { data, error: profileError } = await supabase
                .from('organizer_profiles')
                // Select all fields based on the SQL schema
                .select('*')
                .eq('user_id', organizerUserId)
                .maybeSingle();

            if (profileError) throw profileError;
            if (!data) throw new Error("Organizer profile not found.");

            console.log(`[ViewOrganizerProfile] Organizer profile data:`, JSON.stringify(data, null, 2));
            setOrganizerProfile(data);
        } catch (err: any) {
            console.error("[ViewOrganizerProfile] Error fetching profile:", err);
            setError(`Could not load profile: ${err.message}`);
            setOrganizerProfile(null);
        } finally {
            setProfileLoading(false);
        }
    }, [organizerUserId, isRefreshing]);

    const fetchFollowStatus = useCallback(async () => {
        if (!currentUserId || !organizerUserId) { setIsFollowing(false); return; }
        console.log(`[ViewOrganizerProfile] Checking follow status: User ${currentUserId} -> Organizer ${organizerUserId}`);
        setFollowLoading(true);
        try {
            const { count, error } = await supabase
                .from('organizer_follows')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', currentUserId)
                .eq('organizer_id', organizerUserId);

            if (error) throw error;
            setIsFollowing((count ?? 0) > 0);
            console.log(`[ViewOrganizerProfile] Follow status: ${count !== null ? (count > 0) : 'Error/Null'}`);
        } catch (err: any) {
            console.error("[ViewOrganizerProfile] Error fetching follow status:", err);
            // Don't set an error message, just assume not following
            setIsFollowing(false);
        } finally {
            setFollowLoading(false);
        }
    }, [currentUserId, organizerUserId]);

    const fetchStats = useCallback(async () => {
        if (!organizerUserId) return;
        console.log(`[ViewOrganizerProfile] Fetching stats for organizer: ${organizerUserId}`);
        if (!isRefreshing) setStatsLoading(true);
        try {
            // Use Promise.all to fetch follower count and event count concurrently
            const [followerRes, eventRes] = await Promise.all([
                supabase.from('organizer_follows').select('*', { count: 'exact', head: true }).eq('organizer_id', organizerUserId),
                supabase.from('events').select('*', { count: 'exact', head: true }).eq('organizer_id', organizerUserId)
            ]);

            // Check follower query error
            if (followerRes.error) {
                console.error("[ViewOrganizerProfile] Error fetching follower count:", followerRes.error);
                throw followerRes.error;
            }
             // Check event query error
            if (eventRes.error) {
                console.warn("[ViewOrganizerProfile] Error fetching event count:", eventRes.error);
                // Decide if you want to proceed without event count or throw
            }

            // Set stats using the results, ensuring default to 0
            const followerCount = followerRes.count ?? 0;
            const eventCount = eventRes.count ?? 0;
            
            setStats({
                followerCount: followerCount,
                eventCount: eventCount
            });

            console.log(`[ViewOrganizerProfile] Stats fetched: Followers=${followerCount}, Events=${eventCount}`);
        } catch (err: any) {
            console.error("[ViewOrganizerProfile] Error in fetchStats:", err);
            setStats({ followerCount: null, eventCount: null }); // Keep null default on error
        } finally {
            setStatsLoading(false);
        }
    }, [organizerUserId, isRefreshing]);

    // Chain fetches in useFocusEffect
    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const loadData = async () => {
                setError(null);
                setProfileLoading(true);
                setFollowLoading(true);
                setStatsLoading(true);

                try {
                    await fetchOrganizerProfile();
                    // Check if component is still mounted and profile fetch didn't immediately fail
                    if (isActive && organizerUserId) { 
                        // Run these only after profile fetch seems okay
                        await Promise.all([fetchFollowStatus(), fetchStats()]);
                    }
                } catch (err) {
                    // Error handled within individual fetch functions, but log here if needed
                    console.error("[ViewOrganizerProfileScreen] Error during chained fetch:", err);
                } finally {
                    if (isActive) {
                        setProfileLoading(false); // Ensure all loading states are false
                        setFollowLoading(false);
                        setStatsLoading(false);
                    }
                }
            };

            if (organizerUserId) { // Only run if we have an ID
                loadData();
            }
            
            return () => {
                isActive = false; // Cleanup function to prevent state updates on unmounted component
            };
        }, [organizerUserId, fetchOrganizerProfile, fetchFollowStatus, fetchStats]) // Dependencies
    );

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        setError(null);
        // Reset loading states for refresh indicator
        setProfileLoading(true);
        setFollowLoading(true);
        setStatsLoading(true);

        try {
            await fetchOrganizerProfile();
            // Only fetch others if profile fetch worked and we still have the ID
             if (organizerUserId) { 
                await Promise.all([fetchFollowStatus(), fetchStats()]);
             }
        } catch (err) {
            console.error("[ViewOrganizerProfileScreen] Error during refresh:", err);
            setError("Failed to refresh data."); // Set a general refresh error
        } finally {
             // Ensure all loading states are reset after refresh attempt
             setProfileLoading(false);
             setFollowLoading(false);
             setStatsLoading(false);
             setIsRefreshing(false); // Stop the refresh indicator
        }
    }, [organizerUserId, fetchOrganizerProfile, fetchFollowStatus, fetchStats]);

    // --- Actions ---
    const handleFollowToggle = async () => {
        if (!currentUserId || !organizerUserId || followLoading) return;
        setFollowLoading(true);
        try {
            if (isFollowing) {
                // Unfollow
                console.log(`[ViewOrganizerProfile] Unfollowing organizer ${organizerUserId}...`);
                const { error } = await supabase
                    .from('organizer_follows')
                    .delete()
                    .eq('user_id', currentUserId)
                    .eq('organizer_id', organizerUserId);
                if (error) throw error;
                console.log(`[ViewOrganizerProfile] Unfollowed successfully.`);
                setIsFollowing(false); // Update UI state *after* success
                fetchStats(); // Refresh stats immediately after DB success

            } else {
                // Follow
                 console.log(`[ViewOrganizerProfile] Following organizer ${organizerUserId}...`);
                const { error } = await supabase
                    .from('organizer_follows')
                    .insert({ user_id: currentUserId, organizer_id: organizerUserId });
                if (error) throw error;
                console.log(`[ViewOrganizerProfile] Followed successfully.`);
                setIsFollowing(true); // Update UI state *after* success
                 fetchStats(); // Refresh stats immediately after DB success
            }
        } catch (err: any) {
            console.error("[ViewOrganizerProfile] Error toggling follow:", err);
            Alert.alert("Error", `Could not ${isFollowing ? 'unfollow' : 'follow'} organizer: ${err.message}`);
            // Re-fetch actual status on error
            await fetchFollowStatus(); // Ensure status is correct after error
        } finally {
            setFollowLoading(false);
        }
    };

    const handleViewEvents = (type: 'upcoming' | 'past') => {
        // Explicitly check organizerUserId again inside the handler
        if (!organizerUserId) {
            console.error("[ViewOrganizerProfile] handleViewEvents called but organizerUserId is missing.");
            Alert.alert("Error", "Cannot view events. Organizer information is missing.");
            return;
        }

        const screenName = type === 'upcoming' ? 'UpcomingEventsListScreen' : 'PastEventsListScreen';
        console.log(`[ViewOrganizerProfile] Navigating to ${screenName} for organizer ${organizerUserId}`);

        navigation.navigate(screenName as any, { // Cast to any to bypass type checking
             organizerId: organizerUserId,
             organizerName: organizerProfile?.company_name // Pass name for header
        });
    };

    const openReportModal = () => {
        setReportReason('');
        setReportModalVisible(true);
    };

    const submitReport = async () => {
        if (!currentUserId || !organizerUserId || !reportReason.trim()) {
            Alert.alert("Error", "Please provide a reason for the report.");
            return;
        }
        setIsReporting(true);
        try {
             console.log(`[ViewOrganizerProfile] Submitting report for organizer ${organizerUserId} by user ${currentUserId}...`);
            const { error } = await supabase
                .from('organizer_reports')
                .insert({
                    reporter_id: currentUserId,
                    reported_organizer_id: organizerUserId,
                    reason: reportReason.trim()
                });
            if (error) throw error;

            Alert.alert("Report Submitted", "Thank you for your feedback. We will review this report.");
            setReportModalVisible(false);
             console.log(`[ViewOrganizerProfile] Report submitted successfully.`);
        } catch (err: any) {
            console.error("[ViewOrganizerProfile] Error submitting report:", err);
            Alert.alert("Error", `Could not submit report: ${err.message}`);
        } finally {
            setIsReporting(false);
        }
    };

    // --- Render Logic ---
    useEffect(() => {
        // Set header title dynamically with custom back button
        navigation.setOptions({ 
            headerShown: false, // Use custom header for all platforms
            headerBackVisible: false, // Hide default back button
            headerBackTitleVisible: false, // Hide back title
            headerLeft: Platform.OS !== 'web' ? () => (
                <TouchableOpacity 
                    onPress={() => navigation.goBack()} 
                    style={{ marginLeft: Platform.OS === 'ios' ? 10 : 0, padding: 5 }}
                >
                    <Feather name="chevron-left" size={26} color={APP_CONSTANTS.COLORS.PRIMARY} />
                </TouchableOpacity>
            ) : undefined,
            headerStyle: { backgroundColor: 'white' },
            headerTitleStyle: { fontWeight: '600', color: '#1F2937' },
        });
    }, [navigation, organizerProfile?.company_name]);


    if (profileLoading && !isRefreshing) {
        return <SafeAreaView style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} /></SafeAreaView>;
    }

    if (error) {
        return <SafeAreaView style={styles.centered}><Feather name="alert-circle" size={40} color={APP_CONSTANTS.COLORS.ERROR} /><Text style={styles.errorText}>{error}</Text><TouchableOpacity onPress={onRefresh} style={styles.retryButton}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity></SafeAreaView>;
    }

    if (!organizerProfile) {
        return <SafeAreaView style={styles.centered}><Text style={styles.errorText}>Organizer profile not found.</Text></SafeAreaView>;
    }

    const logoUrl = organizerProfile.logo ?? DEFAULT_ORGANIZER_LOGO;
    const businessTypeFormatted = formatBusinessType(organizerProfile.businessType);

    return (
        <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.container}>
            {/* Custom Header */}
            <View style={styles.customHeader}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackButton}>
                    <Feather name="chevron-left" size={26} color={APP_CONSTANTS.COLORS.PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{organizerProfile?.company_name || 'Organizer Profile'}</Text>
                <View style={{ width: 30 }} />
            </View>
            {/* Web Header */}
            {Platform.OS === 'web' && (
                <View style={styles.webHeader}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Feather name="chevron-left" size={28} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.webHeaderTitle}>{organizerProfile?.company_name || 'Organizer Profile'}</Text>
                    {/* Spacer */}
                    <View style={{ width: 28 }} />
                </View>
            )}
            <ScrollView
                style={styles.scrollViewContainer}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[APP_CONSTANTS.COLORS.PRIMARY]} />}
            >
                {/* Profile Header Card - Adapted from OrganizerProfileScreen */}
                <View style={styles.profileCard}>
                    <LinearGradient colors={[APP_CONSTANTS.COLORS.PRIMARY_LIGHT, APP_CONSTANTS.COLORS.PRIMARY]} style={styles.coverPhoto} />
                    <View style={styles.avatarContainer}><Image source={{ uri: logoUrl }} style={styles.avatar} /></View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.name}>{organizerProfile.company_name ?? "Organizer"}</Text>
                        {businessTypeFormatted && (<Text style={styles.businessType}>{businessTypeFormatted}</Text>)}
                        {/* Stats Row */}
                        <View style={styles.statsContainer}>
                             <View style={styles.statItem}>
                                {statsLoading ? <ActivityIndicator size="small"/> : <Text style={styles.statValue}>{stats.followerCount ?? 'N/A'}</Text>}
                                <Text style={styles.statLabel}>Followers</Text>
                            </View>
                            <View style={styles.statDivider} />
                             <View style={styles.statItem}>
                                {statsLoading ? <ActivityIndicator size="small"/> : <Text style={styles.statValue}>{stats.eventCount ?? 'N/A'}</Text>}
                                <Text style={styles.statLabel}>Events</Text>
                             </View>
                        </View>
                         {/* Follow Button */}
                        <TouchableOpacity
                            style={[styles.actionButton, isFollowing ? styles.followingButton : styles.followButton]}
                            onPress={handleFollowToggle}
                            disabled={followLoading}
                        >
                            {followLoading ? (
                                <ActivityIndicator size="small" color={isFollowing ? APP_CONSTANTS.COLORS.PRIMARY : "#FFF"} />
                            ) : (
                                <Feather name={isFollowing ? "user-check" : "user-plus"} size={16} color={isFollowing ? APP_CONSTANTS.COLORS.PRIMARY : "#FFF"} />
                            )}
                            <Text style={[styles.actionButtonText, isFollowing ? styles.followingButtonText : styles.followButtonText]}>
                                {isFollowing ? 'Following' : 'Follow'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Bio Section */}
                 {organizerProfile.bio && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>About</Text>
                        <Text style={styles.bioText}>{organizerProfile.bio}</Text>
                    </View>
                )}

                {/* Contact Information Section - Using fields from SQL schema */}
                {(organizerProfile.email || organizerProfile.phoneNumber || organizerProfile.website) && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Contact Information</Text>
                        {organizerProfile.email && (
                            <TouchableOpacity style={styles.contactRow} onPress={() => tryOpenLink(`mailto:${organizerProfile.email}`)}>
                                <Feather name="mail" size={16} color={APP_CONSTANTS.COLORS.TEXT_SECONDARY} />
                                <Text style={styles.contactText} numberOfLines={1}>{organizerProfile.email}</Text>
                            </TouchableOpacity>
                        )}
                        {organizerProfile.phoneNumber && (
                            <TouchableOpacity style={styles.contactRow} onPress={() => tryOpenLink(`tel:${organizerProfile.phoneNumber}`)}>
                                <Feather name="phone" size={16} color={APP_CONSTANTS.COLORS.TEXT_SECONDARY} />
                                <Text style={styles.contactText} numberOfLines={1}>{organizerProfile.phoneNumber}</Text>
                            </TouchableOpacity>
                        )}
                        {organizerProfile.website && (
                             <TouchableOpacity style={styles.contactRow} onPress={() => tryOpenLink(organizerProfile.website)}>
                                <Feather name="globe" size={16} color={APP_CONSTANTS.COLORS.TEXT_SECONDARY} />
                                <Text style={styles.contactText} numberOfLines={1}>{organizerProfile.website.replace(/^https?:\/\//, '')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                 {/* Events Section */}
                 <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Events</Text>
                    <TouchableOpacity style={styles.linkButton} onPress={() => handleViewEvents('upcoming')}>
                        <Feather name="calendar" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                        <Text style={styles.linkButtonText}>View Upcoming Events</Text>
                        <Feather name="chevron-right" size={16} color={APP_CONSTANTS.COLORS.DISABLED} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.linkButton} onPress={() => handleViewEvents('past')}>
                        <Feather name="check-square" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                        <Text style={styles.linkButtonText}>View Past Events</Text>
                         <Feather name="chevron-right" size={16} color={APP_CONSTANTS.COLORS.DISABLED} />
                    </TouchableOpacity>
                 </View>

                 {/* Report Section */}
                 <View style={styles.section}>
                     <TouchableOpacity style={[styles.linkButton, styles.reportButton]} onPress={openReportModal}>
                        <Feather name="alert-octagon" size={16} color={APP_CONSTANTS.COLORS.ERROR} />
                        <Text style={[styles.linkButtonText, styles.reportButtonText]}>Report Organizer</Text>
                         <Feather name="chevron-right" size={16} color={APP_CONSTANTS.COLORS.DISABLED} />
                    </TouchableOpacity>
                 </View>

            </ScrollView>

             {/* Report Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={reportModalVisible}
                onRequestClose={() => setReportModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Report Organizer</Text>
                        <Text style={styles.modalSubtitle}>Please provide a reason for reporting "{organizerProfile.company_name}".</Text>
                        <TextInput
                            style={styles.reportInput}
                            placeholder="Reason for reporting (e.g., inappropriate content, scam, etc.)"
                            value={reportReason}
                            onChangeText={setReportReason}
                            multiline
                            maxLength={500} // Limit reason length
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setReportModalVisible(false)}
                                disabled={isReporting}
                            >
                                <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.submitReportButton]}
                                onPress={submitReport}
                                disabled={isReporting || !reportReason.trim()}
                            >
                                {isReporting ? (
                                    <ActivityIndicator color="#FFF" size="small" />
                                ) : (
                                    <Text style={[styles.modalButtonText, styles.submitReportButtonText]}>Submit Report</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    customHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerBackButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F9FAFB' },
    errorText: { fontSize: 16, fontWeight: '600', color: APP_CONSTANTS.COLORS.ERROR, marginTop: 10, textAlign: 'center' },
    retryButton: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginTop: 15 },
    retryButtonText: { color: '#FFF', fontWeight: '600' },
    webHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 4,
    },
    webHeaderTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    scrollViewContainer: { flex: 1, },
    scrollContent: { paddingBottom: 40, paddingTop: 0, }, // No horizontal padding here, sections handle it
    profileCard: { backgroundColor: "white", marginBottom: 24, overflow: "hidden", borderBottomLeftRadius: 16, borderBottomRightRadius: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 3, },
    coverPhoto: { height: 140, width: "100%", },
    avatarContainer: { position: "absolute", top: 80, alignSelf: 'center', backgroundColor: "white", borderRadius: 60, padding: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 5, },
    avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: 'white', backgroundColor: '#E5E7EB' },
    profileInfo: { paddingTop: 70, paddingBottom: 24, paddingHorizontal: 20, alignItems: "center", },
    name: { fontSize: 24, fontWeight: "bold", color: "#1F2937", marginBottom: 6, textAlign: 'center' },
    businessType: { fontSize: 15, color: "#6B7280", fontWeight: '500', marginBottom: 16, },
    statsContainer: { flexDirection: "row", justifyContent: "space-around", width: "80%", marginVertical: 16, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F3F4F6', alignItems: 'center' },
    statItem: { alignItems: "center", paddingHorizontal: 15, minWidth: 70 },
    statValue: { fontSize: 18, fontWeight: "600", color: APP_CONSTANTS.COLORS.PRIMARY, minHeight: 21 },
    statLabel: { fontSize: 12, color: "#6B7280", marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
    statDivider: { width: 1, height: 35, backgroundColor: "#E5E7EB", },
    actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 50, marginTop: 16, minWidth: 140, height: 40 },
    actionButtonText: { marginLeft: 8, fontSize: 14, fontWeight: '600' },
    followButton: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY },
    followButtonText: { color: '#FFF' },
    followingButton: { backgroundColor: '#E0E7FF', borderWidth: 1, borderColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT },
    followingButtonText: { color: APP_CONSTANTS.COLORS.PRIMARY },
    section: { marginHorizontal: 16, backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1, },
    sectionTitle: { fontSize: 18, fontWeight: "600", color: "#111827", marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    bioText: { fontSize: 15, lineHeight: 22, color: "#4B5563" },
    linkButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
    linkButtonText: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '500', color: '#374151' },
    reportButton: { borderBottomWidth: 0 }, // Remove border for last item in section
    reportButtonText: { color: APP_CONSTANTS.COLORS.ERROR },
    // Contact Styles
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F9FAFB',
    },
    contactText: {
        marginLeft: 12,
        fontSize: 15,
        color: APP_CONSTANTS.COLORS.PRIMARY, // Make links look clickable
        flexShrink: 1,
    },
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20, },
    modalContent: { backgroundColor: 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 8, textAlign: 'center' },
    modalSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 16, textAlign: 'center' },
    reportInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, minHeight: 100, textAlignVertical: 'top', fontSize: 14, marginBottom: 20, },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', },
    modalButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginLeft: 10, alignItems: 'center', justifyContent: 'center' },
    modalButtonText: { fontSize: 14, fontWeight: '600' },
    cancelButton: { backgroundColor: '#E5E7EB' },
    cancelButtonText: { color: '#4B5563' },
    submitReportButton: { backgroundColor: APP_CONSTANTS.COLORS.ERROR },
    submitReportButtonText: { color: '#FFF' },
});

export default ViewOrganizerProfileScreen; 