import React, { useState, useMemo } from 'react';
import { View, Text, Image, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { StorageImage } from '@/components/StorageImage';
// *** Import CommonActions and useNavigation ***
import { useNavigation, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { APP_CONSTANTS } from '@/config/constants';

// Define the bio structure (as you provided)
export interface MusicLoverBio {
    musicTaste?: string | null;
    firstSong?: string | null;
    goToSong?: string | null;
    mustListenAlbum?: string | null;
    dreamConcert?: string | null;
}

const DEFAULT_PROFILE_PIC = 'https://via.placeholder.com/150/CCCCCC/808080?text=No+Image';

// Define the props for this component (as you provided)
export interface MatchCardProps {
    id: string;
    userId: string; // This is the user ID of the MATCHED person
    name: string;
    image: string | null;
    bio: MusicLoverBio | null;
    isPremium: boolean;
    commonTags: string[];
    compatibilityScore?: number; // Add compatibility score (optional number)
    onChatPress?: (userId: string) => void; // Changed to pass userId back
    isViewerPremium?: boolean; // <<< Add prop for logged-in user's premium status
    topArtists?: string[]; // Artists matched with current user
    topTracks?: string[]; // Tracks matched with current user
    topGenres?: string[]; // Genres matched with current user
    topMoods?: string[]; // Moods matched with current user (only for premium)
}

// --- Define Navigation Type for useNavigation ---
// This needs to understand the structure for the reset action
// It assumes your RootStack has 'MainApp' and 'IndividualChatScreen'
// And 'MainApp' renders a stack ('MainStack') which renders 'UserTabs'
// And 'UserTabs' renders a tab navigator with a 'Chats' screen. Adjust names if different.
type AppNavigationParams = {
    MainApp: { // Target screen in RootStack
      screen?: 'UserTabs', // Target screen within MainApp's stack (MainStack)
      params?: { // Params for UserTabs
        screen?: 'Chats' // Target screen within UserTabs navigator
      }
    };
    IndividualChatScreen: { // Target screen in RootStack with its params
        matchUserId: string;
        matchName: string;
        matchProfilePicture?: string | null;
        commonTags?: string[];
        topArtists?: string[];
        topTracks?: string[];
        topGenres?: string[];
        topMoods?: string[];
        isFirstInteractionFromMatches?: boolean;
    };
    // Add other RootStack screen names if directly navigated to from here
};
type MatchCardNavigationProp = NativeStackNavigationProp<AppNavigationParams>;
// --- End Navigation Type Definition ---


// Define labels including musicTaste (as you provided)
const bioDetailLabels: Record<string, string> = {
    musicTaste: "Music Taste",
    firstSong: "First Concert / Memory",
    goToSong: "Go-To Song Right Now",
    mustListenAlbum: "Must-Listen Album",
    dreamConcert: "Dream Concert Lineup",
};


const MatchCard: React.FC<MatchCardProps> = ({
    id,
    userId, // This is matchUserId for the chat screen
    name,
    image,
    bio,
    isPremium,
    commonTags,
    compatibilityScore,
    onChatPress,
    isViewerPremium,
    topArtists,
    topTracks,
    topGenres,
    topMoods,
}) => {
    // Use the correctly typed navigation hook
    const navigation = useNavigation<MatchCardNavigationProp>();

    // State for expanding sections
    const [showAllArtists, setShowAllArtists] = useState(false);
    const [showAllTracks, setShowAllTracks] = useState(false);
    const [showAllGenres, setShowAllGenres] = useState(false);
    const [showAllMoods, setShowAllMoods] = useState(false);

    console.log(`[MatchCard] Rendering card for ID: ${id}, Name: ${name}, Common Tags:`, commonTags, `Viewer Premium: ${isViewerPremium}`);

    // Memoized calculation for bio details (as you provided)
    const allBioDetailsToDisplay = useMemo(() => {
        if (!bio) return [];
        const details = Object.entries(bio)
            .filter(([key, value]) => value != null && String(value).trim() !== '')
            .map(([key, value]) => ({
                key: key,
                label: bioDetailLabels[key] || key.replace(/([A-Z])/g, ' $1').trim(),
                value: String(value).trim(),
            }));
        details.sort((a, b) => { /* sort logic */ if (a.key === 'musicTaste') return -1; if (b.key === 'musicTaste') return 1; return 0; });
        return details;
    }, [bio]);

    // *** THIS IS THE CORRECTED NAVIGATION HANDLER ***
    const handleChatPress = () => {
        console.log(`Resetting navigation stack to chat with user: ${userId}, name: ${name}`);

        navigation.dispatch(
            CommonActions.reset({
                index: 1, // Set the active screen index to the second route (IndividualChatScreen)
                routes: [
                    // Route 0: Define the state for the screen that the back button should go to
                    {
                        name: 'MainApp', // Target the screen in RootStack that holds your main app flow
                        // Define the state *inside* MainApp (for its MainStack navigator)
                        state: {
                            routes: [
                                {
                                    name: 'UserTabs', // Target the screen holding the tabs within MainStack
                                    // Define the state *inside* UserTabs (for the Tab navigator)
                                    state: {
                                        routes: [{ name: 'Chats' }], // Make the 'Chats' tab the active one
                                    },
                                },
                                // If MainStack needs other history before UserTabs, add them here
                            ],
                            // index: 0 // Usually defaults to the last route in the array
                        },
                    },
                    // Route 1: Define the screen to navigate to (the chat screen)
                    {
                        name: 'IndividualChatScreen', // Must match name in RootStack
                        params: { // Pass required parameters
                            matchUserId: userId, // The ID of the user to chat with
                            matchName: name,     // Their name for the header
                            matchProfilePicture: image, // Their picture URL
                            commonTags: commonTags,
                            topArtists: topArtists,
                            topTracks: topTracks,
                            topGenres: topGenres,
                            topMoods: topMoods,
                            isFirstInteractionFromMatches: true,
                        },
                    },
                ],
            })
        );
    };
    // *** END OF CORRECTED HANDLER ***


    // Prepare display strings safely (as you provided)
    const displayName = name && String(name).trim() !== '' ? String(name).trim() : 'User';
    const hasBioDetails = allBioDetailsToDisplay.length > 0;

    // Determine if we should show matching music data sections
    const hasTopArtists = topArtists && topArtists.length > 0;
    const hasTopTracks = topTracks && topTracks.length > 0;
    const hasTopGenres = topGenres && topGenres.length > 0;
    const hasTopMoods = topMoods && topMoods.length > 0 && isViewerPremium;

    // UPDATED: Premium users see 5 items initially, free users see 3
    const initialItemsToShow = isViewerPremium ? 5 : 3;

    const renderMusicList = (
        items: string[] | undefined,
        showAll: boolean,
        setShowAll: (value: boolean) => void,
        categoryKey: string,
        isPremiumCategory: boolean = false
    ) => {
        if (!items || items.length === 0) return null;

        const displayedItems = showAll ? items : items.slice(0, initialItemsToShow);
        const remainingCount = items.length - initialItemsToShow;

        return (
            <>
                <View style={styles.tagsContainer}>
                    {displayedItems.map((item, index) => (
                        <View key={`${id}-${categoryKey}-${index}`} style={[styles.musicTag, isPremiumCategory && styles.premiumMusicTag]}>
                            <Text style={[styles.musicTagText, isPremiumCategory && styles.premiumMusicTagText]}>{item}</Text>
                        </View>
                    ))}
                </View>
                {items.length > initialItemsToShow && (
                    <TouchableOpacity onPress={() => setShowAll(!showAll)} style={styles.seeMoreButton}>
                        <Text style={styles.seeMoreButtonText}>
                            {showAll ? 'See less' : `+${remainingCount} more`}
                        </Text>
                    </TouchableOpacity>
                )}
            </>
        );
    };

    // --- JSX (Ensure the TouchableOpacity calls the correct handleChatPress) ---
    return (
        <View style={styles.cardContainer}>
            <View style={styles.card}>
                 {/* Premium Badge */}
                 {isPremium && (
                    <View style={styles.premiumBadge}>
                        <Feather name="award" size={12} color="#B8860B" />
                        <Text style={styles.premiumText}>Premium</Text>
                    </View>
                 )}

                {/* Image */}
                {image && image !== DEFAULT_PROFILE_PIC ? (
                    <StorageImage sourceUri={image} style={styles.profileImage} resizeMode="cover" />
                ) : (
                    <Image source={{ uri: DEFAULT_PROFILE_PIC }} style={styles.profileImage} />
                )}

                {/* Info Container below Image */}
                <View style={styles.infoContainer}>
                    {/* Name and Score Row */}
                    <View style={styles.nameRow}>
                        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{displayName}</Text>
                        {/* Compatibility Score Indicator - Show if logged-in user is premium */}
                        {isViewerPremium && typeof compatibilityScore === 'number' && compatibilityScore >= 0 && (
                            <View style={styles.compatibilityIndicator}>
                                <Text style={styles.compatibilityScoreText}>{Math.round(compatibilityScore)}%</Text>
                            </View>
                        )}
                    </View>

                    {/* Top Artists Section - COMMENTED OUT FOR SOFT LAUNCH */}
                    {/* {hasTopArtists && (
                        <View style={styles.matchedMusicSection}>
                            <Feather name="mic" size={14} color="#4F46E5" style={styles.matchedMusicIcon}/>
                            <Text style={styles.matchedMusicTitle}>Similar Artists:</Text>
                            {renderMusicList(topArtists, showAllArtists, setShowAllArtists, 'artist')}
                        </View>
                    )} */}

                    {/* Top Tracks Section - COMMENTED OUT FOR SOFT LAUNCH */}
                    {/* {hasTopTracks && (
                        <View style={styles.matchedMusicSection}>
                            <Feather name="disc" size={14} color="#8B5CF6" style={styles.matchedMusicIcon}/>
                            <Text style={styles.matchedMusicTitle}>Similar Tracks:</Text>
                            {renderMusicList(topTracks, showAllTracks, setShowAllTracks, 'track')}
                        </View>
                    )} */}

                    {/* Top Genres Section - COMMENTED OUT FOR SOFT LAUNCH */}
                    {/* {hasTopGenres && (
                        <View style={styles.matchedMusicSection}>
                            <Feather name="headphones" size={14} color="#EC4899" style={styles.matchedMusicIcon}/>
                            <Text style={styles.matchedMusicTitle}>Similar Genres:</Text>
                            {renderMusicList(topGenres, showAllGenres, setShowAllGenres, 'genre')}
                        </View>
                    )} */}

                    {/* Top Moods Section - Only for Premium Viewers, data already filtered by SQL for match premium status - COMMENTED OUT FOR SOFT LAUNCH */}
                    {/* {hasTopMoods && (
                        <View style={styles.matchedMusicSection}>
                            <Feather name="smile" size={14} color="#F59E0B" style={styles.matchedMusicIcon}/>
                            <Text style={styles.matchedMusicTitle}>Similar Moods:</Text>
                            {renderMusicList(topMoods, showAllMoods, setShowAllMoods, 'mood', true)}
                        </View>
                    )} */}

                    {/* "About [Name]" Section */}
                    {hasBioDetails ? (
                        <View style={styles.bioDetailsSection}>
                             <Text style={styles.bioSectionTitle}>About {displayName.split(' ')[0]}</Text>
                            {allBioDetailsToDisplay.map((detail, index) => (
                                <View key={`${id}-bio-${index}`} style={styles.bioDetailItem}>
                                    <Text style={styles.bioDetailLabel}>{detail.label}:</Text>
                                    <Text style={styles.bioDetailValue}>{detail.value}</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                         (!commonTags || commonTags.length === 0) &&
                         <Text style={styles.noBioText}>More about them coming soon...</Text>
                    )}
                </View>

                 {/* Chat Button */}
                 <View style={styles.actionsContainer}>
                     {/* Ensure this TouchableOpacity calls the MODIFIED handleChatPress */}
                     <TouchableOpacity style={styles.chatButton} onPress={() => onChatPress && onChatPress(userId)}>
                         <Feather name="message-circle" size={18} color="#FFFFFF" />
                         <Text style={styles.chatButtonText}>Chat with {displayName.split(' ')[0]}</Text>
                     </TouchableOpacity>
                 </View>
            </View>
        </View>
    );
};

// --- Styles --- (Copied from your provided code)
const styles = StyleSheet.create({
    cardContainer: { width: '100%', alignItems: 'center', paddingVertical: 10, },
    card: { backgroundColor: 'white', borderRadius: 16, width: Platform.OS === 'web' ? 360 : '95%', maxWidth: 400, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden', },
    premiumBadge: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 215, 0, 0.2)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.5)', zIndex: 1, },
    premiumText: { color: '#856A00', fontSize: 10, fontWeight: 'bold', marginLeft: 4, textTransform: 'uppercase', },
    profileImage: { width: '100%', height: 300, backgroundColor: '#E5E7EB', },
    infoContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, alignItems: 'center', width: '100%', },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        width: '100%',
        paddingHorizontal: 5,
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1F2937',
        textAlign: 'center',
        flexShrink: 1,
    },
    commonTagsSection: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        marginBottom: 16,
        paddingHorizontal: 5,
        width: '100%',
    },
    commonTagsIcon: {
        marginRight: 6,
        marginTop: 2,
    },
    commonTagsTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#10B981',
        marginRight: 8,
        lineHeight: 20,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        flex: 1,
        justifyContent: 'flex-start',
    },
    tag: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 12, paddingVertical: 3, paddingHorizontal: 8, margin: 3, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)', },
    tagText: { color: '#059669', fontSize: 11, fontWeight: '500', },
    moreTagsText: { fontSize: 11, color: '#6B7280', marginLeft: 3, alignSelf: 'center', paddingVertical: 3, },
    bioDetailsSection: { width: '100%', marginTop: 0, marginBottom: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', },
    bioSectionTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12, textAlign: 'left', width: '100%', },
    bioDetailItem: {
        flexDirection: 'row',
        marginBottom: 10,
        alignItems: 'flex-start',
        width: '100%',
    },
    bioDetailLabel: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
        marginRight: 8,
        lineHeight: 18,
        textAlign: 'left',
    },
    bioDetailValue: {
        fontSize: 13,
        color: '#374151',
        flex: 1,
        textAlign: 'left',
        lineHeight: 18,
    },
     noBioText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', marginTop: 10, marginBottom: 15, width: '100%', },
    actionsContainer: { flexDirection: 'row', justifyContent: 'center', paddingTop: 15, paddingBottom: 15, borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#F9FAFB', },
    chatButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3, },
    chatButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginLeft: 8, },
    compatibilityIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        marginLeft: 10,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    compatibilityScoreText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    // New styles for music matching sections
    matchedMusicSection: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        marginBottom: 12,
        paddingHorizontal: 5,
        width: '100%',
    },
    matchedMusicIcon: {
        marginRight: 6,
        marginTop: 2,
    },
    matchedMusicTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4F46E5',
        marginRight: 8,
        lineHeight: 20,
    },
    musicTag: {
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        borderRadius: 12,
        paddingVertical: 3,
        paddingHorizontal: 8,
        margin: 3,
        borderWidth: 1,
        borderColor: 'rgba(79, 70, 229, 0.2)',
    },
    musicTagText: {
        color: '#4338CA',
        fontSize: 11,
        fontWeight: '500',
    },
    premiumMusicTag: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    premiumMusicTagText: {
        color: '#D97706',
    },
    seeMoreButton: {
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: 8,
        marginTop: 4,
        marginLeft: 5, // Align with tags container padding
    },
    seeMoreButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.PRIMARY || '#3B82F6',
    }
});

export default MatchCard;