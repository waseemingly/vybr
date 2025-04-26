import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
    ActivityIndicator, Alert, RefreshControl, Modal, TextInput
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
// Ensure RootStackParamList defines: ViewOrganizerProfileScreen: { organizerUserId: string };
type ViewOrganizerProfileRouteParams = { organizerUserId?: string };
type ViewOrganizerProfileRouteProp = RouteProp<RootStackParamList, 'ViewOrganizerProfileScreen'>;
type ViewOrganizerProfileNavigationProp = NativeStackNavigationProp<RootStackParamList & MainStackParamList>;

// --- Constants ---
const DEFAULT_ORGANIZER_LOGO = APP_CONSTANTS?.DEFAULT_ORGANIZER_LOGO || 'https://via.placeholder.com/150/BFDBFE/1E40AF?text=Logo';

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
            const [followerRes, eventRes] = await Promise.all([
                supabase.from('organizer_follows').select('*', { count: 'exact', head: true }).eq('organizer_id', organizerUserId),
                supabase.from('events').select('*', { count: 'exact', head: true }).eq('organizer_id', organizerUserId)
            ]);

            if (followerRes.error || eventRes.error) {
                console.warn("[ViewOrganizerProfile] Error fetching stats:", followerRes.error || eventRes.error);
            }
            setStats({
                followerCount: followerRes.count ?? 0,
                eventCount: eventRes.count ?? 0
            });
             console.log(`[ViewOrganizerProfile] Stats fetched: Followers=${followerRes.count}, Events=${eventRes.count}`);
        } catch (err: any) {
            console.error("[ViewOrganizerProfile] Error fetching stats:", err);
            setStats({ followerCount: null, eventCount: null });
        } finally {
            setStatsLoading(false);
        }
    }, [organizerUserId, isRefreshing]);

    const loadAllData = useCallback(() => {
        // Fetch profile first, then others can run in parallel
        fetchOrganizerProfile().then(() => {
            if (organizerUserId) { // Check if profile fetch was successful enough to get an ID
                fetchFollowStatus();
                fetchStats();
            }
        });
    }, [fetchOrganizerProfile, fetchFollowStatus, fetchStats, organizerUserId]);

    useFocusEffect(loadAllData);

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        loadAllData(); // Re-fetch everything
        setIsRefreshing(false); // Set refreshing false after calls initiated
    }, [loadAllData]);

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
                setIsFollowing(false);
                // Optimistically decrement count
                 setStats(prev => ({ ...prev, followerCount: Math.max(0, (prev.followerCount ?? 1) - 1) }));
                console.log(`[ViewOrganizerProfile] Unfollowed successfully.`);

            } else {
                // Follow
                 console.log(`[ViewOrganizerProfile] Following organizer ${organizerUserId}...`);
                const { error } = await supabase
                    .from('organizer_follows')
                    .insert({ user_id: currentUserId, organizer_id: organizerUserId });
                if (error) throw error;
                setIsFollowing(true);
                // Optimistically increment count
                 setStats(prev => ({ ...prev, followerCount: (prev.followerCount ?? 0) + 1 }));
                 console.log(`[ViewOrganizerProfile] Followed successfully.`);
            }
            // Optional: Refresh stats after a delay to confirm count
            // setTimeout(fetchStats, 1500);
        } catch (err: any) {
            console.error("[ViewOrganizerProfile] Error toggling follow:", err);
            Alert.alert("Error", `Could not ${isFollowing ? 'unfollow' : 'follow'} organizer: ${err.message}`);
            // Re-fetch actual status on error
            fetchFollowStatus();
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

        navigation.navigate(screenName, { // Changed from push to navigate
             organizerUserId: organizerUserId,
             organizerName: organizerProfile?.companyName // Pass name for header
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
        // Set header title dynamically
        navigation.setOptions({ 
            title: organizerProfile?.companyName || 'Organizer Profile', 
            headerBackVisible: true,
        });
    }, [navigation, organizerProfile?.companyName]);


    if (profileLoading && !isRefreshing) {
        return <SafeAreaView style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} /></SafeAreaView>;
    }

    if (error) {
        return <SafeAreaView style={styles.centered}><Feather name="alert-circle" size={40} color={APP_CONSTANTS.COLORS.ERROR} /><Text style={styles.errorText}>{error}</Text><TouchableOpacity onPress={loadAllData} style={styles.retryButton}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity></SafeAreaView>;
    }

    if (!organizerProfile) {
        return <SafeAreaView style={styles.centered}><Text style={styles.errorText}>Organizer profile not found.</Text></SafeAreaView>;
    }

    const logoUrl = organizerProfile.logo ?? DEFAULT_ORGANIZER_LOGO;
    const businessTypeFormatted = formatBusinessType(organizerProfile.businessType);

    return (
        <SafeAreaView edges={["bottom", "left", "right"]} style={styles.container}>
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
                        <Text style={styles.name}>{organizerProfile.companyName ?? "Organizer"}</Text>
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
                {(organizerProfile.email || organizerProfile.phone_number || organizerProfile.website) && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Contact Information</Text>
                        {organizerProfile.email && (
                            <TouchableOpacity style={styles.contactRow} onPress={() => tryOpenLink(`mailto:${organizerProfile.email}`)}>
                                <Feather name="mail" size={16} color={APP_CONSTANTS.COLORS.TEXT_SECONDARY} />
                                <Text style={styles.contactText} numberOfLines={1}>{organizerProfile.email}</Text>
                            </TouchableOpacity>
                        )}
                        {organizerProfile.phone_number && (
                            <TouchableOpacity style={styles.contactRow} onPress={() => tryOpenLink(`tel:${organizerProfile.phone_number}`)}>
                                <Feather name="phone" size={16} color={APP_CONSTANTS.COLORS.TEXT_SECONDARY} />
                                <Text style={styles.contactText} numberOfLines={1}>{organizerProfile.phone_number}</Text>
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
                        <Text style={styles.modalSubtitle}>Please provide a reason for reporting "{organizerProfile.companyName}".</Text>
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
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F9FAFB' },
    errorText: { fontSize: 16, fontWeight: '600', color: APP_CONSTANTS.COLORS.ERROR, marginTop: 10, textAlign: 'center' },
    retryButton: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginTop: 15 },
    retryButtonText: { color: '#FFF', fontWeight: '600' },
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