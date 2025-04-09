import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ScrollView,
    Dimensions,
    ActivityIndicator,
    Alert,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useOrganizerMode } from "@/hooks/useOrganizerMode"; // Assuming path is correct
import { useAuth, MusicLoverBio } from "@/hooks/useAuth"; // Import useAuth and MusicLoverBio type
import { APP_CONSTANTS } from "@/config/constants"; // Import constants for colors/defaults if needed
import { useNavigation } from "@react-navigation/native"; // Import for navigation


// Default Profile Picture Placeholder
const DEFAULT_PROFILE_PIC = 'https://via.placeholder.com/150/CCCCCC/808080?text=No+Image';

// Interface and Separator Component (Keep as before)
interface SeparatorProps { vertical?: boolean; style?: object; }
const Separator: React.FC<SeparatorProps> = ({ vertical = false, style = {} }) => ( <View style={[ styles.separator, vertical ? { height: '60%', width: 1 } : { height: 1, width: "100%" }, style ]} /> );

// Interface and ProfileSection Component (Keep as before)
interface ProfileSectionProps { title: string; icon: React.ComponentProps<typeof Feather>['name']; children: React.ReactNode; isPremiumFeature?: boolean; isPremiumUser?: boolean; expanded?: boolean; onToggle?: () => void; hasData?: boolean; }
const ProfileSection: React.FC<ProfileSectionProps> = (props) => {
    const { title, icon, children, isPremiumFeature = false, isPremiumUser = false, expanded = true, onToggle = () => { }, hasData = true } = props;
    const canToggle = !!onToggle;
    const showContent = expanded; // Content visibility only depends on expanded state

    return (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleContainer}>
                    <Feather name={icon} size={18} color={APP_CONSTANTS.COLORS.PRIMARY} style={styles.sectionIcon} />
                    <Text style={styles.sectionTitle}>{title}</Text>
                    {isPremiumFeature && ( /* Premium Badge Logic */
                        <View style={[styles.premiumBadgePill, !isPremiumUser && styles.premiumBadgeLocked]}>
                            <Feather name="award" size={10} color={isPremiumUser ? "#FFD700" : "#A0A0A0"} />
                            <Text style={[styles.premiumTextPill, !isPremiumUser && styles.premiumTextLocked]}>
                                {isPremiumUser ? 'Premium' : 'Locked'}
                            </Text>
                        </View>
                    )}
                </View>
                {canToggle && ( /* Toggle Button Logic */
                    <TouchableOpacity onPress={onToggle} style={styles.toggleButton}>
                        <Text style={styles.toggleButtonText}>{expanded ? "See Less" : "See More"}</Text>
                        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={APP_CONSTANTS.COLORS.PRIMARY} style={styles.toggleIcon} />
                    </TouchableOpacity>
                )}
            </View>
            {/* Content/Placeholder/Locked Logic */}
            {showContent && hasData && children}
            {showContent && !hasData && (<Text style={styles.dataMissingText}>No data available yet. Connect your streaming service in Settings.</Text>)}
            {isPremiumFeature && !isPremiumUser && (<View style={styles.lockedContent}><Feather name="lock" size={16} color="#A0A0A0" style={{marginRight: 5}} /><Text style={styles.lockedText}>Upgrade to Premium to unlock this feature.</Text></View>)}
        </View>
    );
};

// Labels for Bio Details
const bioDetailLabels: Record<keyof MusicLoverBio, string> = {
    firstSong: "First Concert / Memory",
    goToSong: "Go-To Song Right Now",
    mustListenAlbum: "Must-Listen Album",
    dreamConcert: "Dream Concert Lineup",
    musicTaste: "Music Taste Description",
};

// Expanded Sections Interface (Keep as before)
interface ExpandedSections { artists: boolean; songs: boolean; analytics: boolean; }

// --- ProfileScreen Component ---
const ProfileScreen: React.FC = () => {
    // Hooks
    const { session, loading: authLoading, logout } = useAuth();
    const { toggleOrganizerMode } = useOrganizerMode();
    const navigation = useNavigation();

    // State
    const [expandedSections, setExpandedSections] = useState<ExpandedSections>({ artists: false, songs: false, analytics: true, });

    // Profile data extraction
    const musicLoverProfile = session?.musicLoverProfile;
    const isPremium = musicLoverProfile?.isPremium ?? false;

    // Toggle function (Keep as before)
    const toggleSection = (section: keyof ExpandedSections) => { /* ... */
        const isTrulyPremiumFeature = section === 'analytics';
        if (isTrulyPremiumFeature && !isPremium) {
             Alert.alert("Premium Feature","Upgrade to Premium to see details in this section.", [ { text: "Cancel", style: "cancel" }, { text: "Upgrade Now", onPress: () => navigation.navigate('UpgradeScreen' as never) } ]);
             return;
        }
        setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    // Loading State (Keep as before)
    if (authLoading) { return (<SafeAreaView style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} /><Text style={styles.loadingText}>Loading Profile...</Text></SafeAreaView>);}

    // Not Logged In State (Keep as before)
    if (!session || !musicLoverProfile) { return (<SafeAreaView style={styles.centered}><Feather name="alert-circle" size={40} color="#FFA500" /><Text style={styles.errorText}>Could not load profile.</Text><Text style={styles.errorSubText}>{ !session ? "You are not logged in." : "Your profile setup might be incomplete."}</Text><TouchableOpacity style={[styles.logoutButton, {marginTop: 20, backgroundColor: !session ? APP_CONSTANTS.COLORS.PRIMARY : '#EF4444'}]} onPress={() => !session ? navigation.navigate('AuthFlow' as never) : logout()}><Feather name={!session ? "log-in" : "log-out"} size={18} color="#FFF" /><Text style={styles.logoutButtonText}>{!session ? "Go to Login" : "Logout"}</Text></TouchableOpacity></SafeAreaView>);}

    // --- Data Extraction ---
    const profilePictureUrl = musicLoverProfile.profilePicture ?? DEFAULT_PROFILE_PIC;
    const userName = `${musicLoverProfile.firstName ?? ''} ${musicLoverProfile.lastName ?? ''}`.trim() || "User";
    const userAge = musicLoverProfile.age;
    const userCity = musicLoverProfile.city;
    const userCountry = musicLoverProfile.country;

    // *** NEW BIO HANDLING ***
    // Get ALL non-empty bio details for the list
    const allBioDetails = musicLoverProfile.bio
        ? Object.entries(musicLoverProfile.bio)
            .filter(([key, value]) => value && String(value).trim() !== '') // Filter only empty/null/whitespace values
            .map(([key, value]) => ({
                label: bioDetailLabels[key as keyof MusicLoverBio] || key, // Get readable label
                value: String(value).trim() // Ensure value is string and trimmed
            }))
        : [];
    // *** END NEW BIO HANDLING ***

    // Music Data Placeholders (Keep as before)
    const favoriteGenres = (musicLoverProfile.musicData?.genres as string[]) ?? [];
    const favoriteArtists = (musicLoverProfile.musicData?.artists as string[]) ?? [];
    const favoriteSongs = (musicLoverProfile.musicData?.songs as { title: string; artist: string }[]) ?? [];
    const favoriteAlbums = (musicLoverProfile.musicData?.albums as { title: string; artist: string; year: string }[]) ?? [];
    const genreAnalyticsData = (musicLoverProfile.musicData?.analytics?.genreDistribution as { name: string; value: number }[]) ?? [];


    // --- Render Profile ---
    return (
        <SafeAreaView edges={["top"]} style={styles.container}>
            {/* Header (Keep as before) */}
            <View style={styles.header}>
            </View>

            <ScrollView style={styles.scrollViewContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} >
                {/* --- Main Profile Card --- */}
                <View style={styles.profileCard}>
                    <LinearGradient colors={[APP_CONSTANTS.COLORS.PRIMARY_LIGHT, APP_CONSTANTS.COLORS.PRIMARY]} style={styles.coverPhoto} />
                    <View style={styles.avatarContainer}><Image source={{ uri: profilePictureUrl }} style={styles.avatar} /></View>

                    <View style={styles.profileInfo}>
                        {/* Name, Premium Badge */}
                        <View style={styles.nameContainer}><Text style={styles.name}>{userName}</Text>{isPremium && (<View style={styles.premiumBadgeName}><Feather name="award" size={10} color="#FFD700" /><Text style={styles.premiumTextName}>Premium</Text></View>)}</View>
                        {/* Location, Age */}
                        <View style={styles.locationAgeContainer}>{userAge && <Text style={styles.age}>{userAge} years old</Text>}{(userCity || userCountry) && (<>{userAge && <Text style={styles.locationSeparator}> • </Text>}<Feather name="map-pin" size={12} color="#6B7280" style={{ marginRight: 4 }}/><Text style={styles.location}>{userCity}{userCity && userCountry ? ', ' : ''}{userCountry}</Text></>)}</View>
                        {/* Friends, Following */}
                        <View style={styles.statsContainer}><View style={styles.statItem}><Text style={styles.statValue}>0</Text><Text style={styles.statLabel}>Friends</Text></View><Separator vertical style={{ backgroundColor: '#E5E7EB' }}/><View style={styles.statItem}><Text style={styles.statValue}>0</Text><Text style={styles.statLabel}>Following</Text></View></View>

                        {/* REMOVED the separate main bio Text component */}
                        {/* <Text style={styles.bio}>{mainBioText}</Text> */}

                        {/* The bio details list is now inside its own section below */}
                    </View>
                </View>

                {/* --- "Things About Me" Section (NEW) --- */}
                <ProfileSection
                    title="Things About Me"
                    icon="info" // Using 'info' icon, change if desired
                    isPremiumUser={isPremium} // Pass premium status if needed by styling later
                    hasData={allBioDetails.length > 0} // Check if there's anything to show
                >
                    {/* Render the list of bio details */}
                    <View style={styles.bioDetailsListContainer}>
                        {allBioDetails.map((detail, index) => (
                            <View key={index} style={styles.bioDetailItem}>
                                <Text style={styles.bioDetailLabel}>{detail.label}:</Text>
                                <Text style={styles.bioDetailValue}>{detail.value}</Text>
                            </View>
                        ))}
                    </View>
                    {/* Placeholder shown by ProfileSection if hasData is false */}
                </ProfileSection>


                {/* --- Music Data Sections (Keep as before, including making Artists/Songs non-premium) --- */}
                 {/* Analytics (Remains Premium) */}
                 <ProfileSection title="Music Taste Analytics" icon="bar-chart-2" isPremiumFeature isPremiumUser={isPremium} expanded={expandedSections.analytics} onToggle={() => toggleSection("analytics")} hasData={genreAnalyticsData.length > 0}>
                      <View style={styles.analyticsCard}><Text style={styles.analyticsTitle}>Genre Distribution</Text><View style={styles.pieChartPlaceholder}><Text style={styles.placeholderText}>Chart Component Here</Text>{genreAnalyticsData.slice(0, 3).map(g => (<Text key={g.name} style={styles.placeholderSubtext}>{g.name}: {g.value}%</Text>))}</View></View>
                 </ProfileSection>
                 {/* Genres (Not Premium) */}
                 <ProfileSection title="Favorite Genres" icon="music" isPremiumUser={isPremium} hasData={favoriteGenres.length > 0}>
                      <View style={styles.tagsContainer}>{favoriteGenres.map((genre, index) => (<View key={index} style={styles.genreTag}><Text style={styles.genreTagText}>{genre}</Text></View>))}</View>
                 </ProfileSection>
                 {/* Artists (Not Premium Feature) */}
                 <ProfileSection title="Favorite Artists" icon="users" isPremiumUser={isPremium} expanded={expandedSections.artists} onToggle={() => toggleSection("artists")} hasData={favoriteArtists.length > 0}>
                      <View style={styles.listContainer}>{favoriteArtists.slice(0, expandedSections.artists ? favoriteArtists.length : 5).map((artist, index) => (<View key={index} style={styles.listItem}><Text style={styles.listItemText}>{artist}</Text><Feather name="user" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} /></View>))}</View>
                      {favoriteArtists.length > 5 && !expandedSections.artists && (<TouchableOpacity style={styles.seeAllButton} onPress={() => toggleSection("artists")}><Text style={styles.seeAllButtonText}>See all {favoriteArtists.length} artists</Text><Feather name="chevron-down" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} /></TouchableOpacity>)}
                 </ProfileSection>
                 {/* Songs (Not Premium Feature) */}
                 <ProfileSection title="Favorite Songs" icon="headphones" isPremiumUser={isPremium} expanded={expandedSections.songs} onToggle={() => toggleSection("songs")} hasData={favoriteSongs.length > 0}>
                       <View style={styles.listContainer}>{favoriteSongs.slice(0, expandedSections.songs ? favoriteSongs.length : 5).map((song, index) => (<View key={index} style={styles.listItem}><View><Text style={styles.listItemText}>{song.title}</Text><Text style={styles.listItemSubtext}>{song.artist}</Text></View><Feather name="music" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} /></View>))}</View>
                      {favoriteSongs.length > 5 && !expandedSections.songs && (<TouchableOpacity style={styles.seeAllButton} onPress={() => toggleSection("songs")}><Text style={styles.seeAllButtonText}>See all {favoriteSongs.length} songs</Text><Feather name="chevron-down" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} /></TouchableOpacity>)}
                 </ProfileSection>
                 {/* Albums (Not Premium) */}
                 <ProfileSection title="Favorite Albums" icon="disc" isPremiumUser={isPremium} hasData={favoriteAlbums.length > 0}>
                      <View style={styles.listContainer}>{favoriteAlbums.map((album, index) => (<View key={index} style={styles.listItem}><View><Text style={styles.listItemText}>{album.title}</Text><Text style={styles.listItemSubtext}>{album.artist} • {album.year}</Text></View><Feather name="disc" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} /></View>))}</View>
                 </ProfileSection>
                 {/* Match Radio (Remains Premium) */}
                 <ProfileSection title="Match Radio" icon="radio" isPremiumFeature isPremiumUser={isPremium} hasData={true}>
                      <View style={styles.premiumFeatureCard}><View style={styles.premiumFeatureHeader}><View><Text style={styles.premiumFeatureTitle}>AI-Generated Playlists</Text><Text style={styles.premiumFeatureSubtitle}>Blend your music taste with your matches</Text></View><View style={styles.featureIconContainer}><Feather name="radio" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} /></View></View><TouchableOpacity style={styles.createButton} onPress={() => Alert.alert("Coming Soon!", "Match Radio feature is under development.")}><Text style={styles.createButtonText}>Create a Match Radio</Text></TouchableOpacity></View>
                 </ProfileSection>

                {/* Action Buttons (Keep as before) */}
                {!isPremium && (<TouchableOpacity style={styles.buyPremiumButton} onPress={() => navigation.navigate('UpgradeScreen' as never)}><Feather name="star" size={18} color="#FFF" /><Text style={styles.buyPremiumButtonText}>Upgrade to Premium</Text></TouchableOpacity>)}
                <TouchableOpacity style={styles.logoutButton} onPress={logout} ><Feather name="log-out" size={18} color="#FFF" /><Text style={styles.logoutButtonText}>Logout</Text></TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
};

const { width } = Dimensions.get("window");

// --- Styles ---
// *** PASTE THE FULL STYLES OBJECT FROM THE PREVIOUS RESPONSE HERE ***
// Make sure it includes the bioDetail styles.
const styles = StyleSheet.create({
    // ... (All previous styles including container, header, profileCard, avatar, sections, lists, buttons, loading/error, etc.) ...
    container: { flex: 1, backgroundColor: "#F9FAFB", },
    scrollViewContainer: { flex: 1, },
    header: { paddingTop: Platform.OS === 'android' ? 20 : 16, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', },
    headerTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", },
    titleContainer: { flexDirection: "row", alignItems: "center", },
    headerIcon: { marginRight: 8, },
    title: { fontSize: 22, fontWeight: "bold", color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 16, },
    profileCard: { backgroundColor: "white", borderRadius: 16, marginBottom: 24, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5, elevation: 3, },
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
    statItem: { alignItems: "center", paddingHorizontal: 10 },
    statValue: { fontSize: 18, fontWeight: "600", color: APP_CONSTANTS.COLORS.PRIMARY, },
    statLabel: { fontSize: 12, color: "#6B7280", marginTop: 2, },
    separator: { backgroundColor: "#E5E7EB", },
    bio: { fontSize: 14, color: "#4B5563", textAlign: "center", lineHeight: 21, marginTop: 16, marginBottom: 8 }, // Kept for potential future use, but not rendered by default

    // Styles for the specific bio details list (inside "Things About Me" section)
    bioDetailsListContainer: { // Renamed container for clarity
        width: '100%',
        marginTop: 4, // Space below section header line
    },
    bioDetailItem: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        marginBottom: 10,
        paddingHorizontal: 0, // Padding handled by section now
    },
    bioDetailLabel: {
        fontSize: 14,
        color: '#4B5563',
        fontWeight: '600',
        width: '45%', // Adjust width as needed
        marginRight: 8,
    },
    bioDetailValue: {
        fontSize: 14,
        color: '#1F2937',
        flex: 1,
        textAlign: 'left',
    },
    // --- End Bio Detail Styles ---

    section: { marginBottom: 24, },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6", },
    sectionTitleContainer: { flexDirection: "row", alignItems: "center", flexShrink: 1, },
    sectionIcon: { marginRight: 10, },
    sectionTitle: { fontSize: 18, fontWeight: "600", color: "#111827", marginRight: 8, },
    premiumBadgePill: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(59, 130, 246, 0.1)", paddingVertical: 3, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: "rgba(59, 130, 246, 0.3)", },
    premiumBadgeLocked: { backgroundColor: "rgba(150, 150, 150, 0.1)", borderColor: "rgba(150, 150, 150, 0.3)", },
    premiumTextPill: { color: APP_CONSTANTS.COLORS.PRIMARY, fontSize: 9, fontWeight: "600", marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5, },
    premiumTextLocked: { color: '#A0A0A0', },
    toggleButton: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingLeft: 8, },
    toggleButtonText: { fontSize: 13, color: APP_CONSTANTS.COLORS.PRIMARY, fontWeight: '500', marginRight: 4, },
    toggleIcon: { /* No style */ },
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
    listItemText: { fontSize: 14, fontWeight: "500", color: "#1F2937", },
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
    modeButtonSmall: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(59, 130, 246, 0.1)", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, },
    modeButtonTextSmall: { color: APP_CONSTANTS.COLORS.PRIMARY, fontSize: 12, fontWeight: "500", marginLeft: 5, },
     buyPremiumButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#F59E0B", paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, marginTop: 24, marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2, },
     buyPremiumButtonText: { color: "white", fontWeight: "600", fontSize: 16, marginLeft: 8, },
    logoutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#EF4444", paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, marginTop: 8, marginBottom: 16, },
    logoutButtonText: { color: "white", fontWeight: "600", fontSize: 16, marginLeft: 8, },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F9FAFB', },
    loadingText: { marginTop: 10, fontSize: 16, color: '#6B7280', },
    errorText: { marginTop: 15, fontSize: 18, fontWeight: '600', color: '#DC2626', textAlign: 'center', },
    errorSubText: { marginTop: 8, fontSize: 14, color: '#4B5563', textAlign: 'center', },
});

export default ProfileScreen;