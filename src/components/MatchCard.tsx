import React from 'react';
import { View, Text, Image, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Keep MusicLoverBio as is
export interface MusicLoverBio {
    musicTaste?: string | null;
    firstSong?: string | null;
    goToSong?: string | null;
    mustListenAlbum?: string | null;
    dreamConcert?: string | null;
}

const DEFAULT_PROFILE_PIC = 'https://via.placeholder.com/150/CCCCCC/808080?text=No+Image'; // Or use your APP_CONSTANTS import

// Keep MatchCardProps including commonTags
export interface MatchCardProps {
    id: string;
    userId: string;
    name: string;
    image: string | null;
    bio: MusicLoverBio | null;
    isPremium: boolean;
    commonTags: string[]; // Array of common tags from SQL function
}

// Keep navigation types as is
type RootStackParamList = {
    ChatsScreen: { matchUserId: string; matchName: string; };
    IndividualChatScreen: {
        matchUserId: string;
        matchName: string;
        matchProfilePicture?: string | null;
    };
};
type MatchCardNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Define labels including musicTaste now
const bioDetailLabels: Record<string, string> = {
    musicTaste: "Music Taste", // Add label for Music Taste
    firstSong: "First Concert / Memory",
    goToSong: "Go-To Song Right Now",
    mustListenAlbum: "Must-Listen Album",
    dreamConcert: "Dream Concert Lineup",
};


const MatchCard: React.FC<MatchCardProps> = ({
    id,
    userId,
    name,
    image,
    bio,
    isPremium,
    commonTags,
}) => {
    const navigation = useNavigation<MatchCardNavigationProp>();

    /**
     * Memoized calculation for ALL bio details to display in the list, including musicTaste.
     * Filters out any empty/null values.
     * Maps keys to readable labels using bioDetailLabels.
     * Reorders to potentially put musicTaste first.
     */
    const allBioDetailsToDisplay = React.useMemo(() => {
        if (!bio) return [];

        const details = Object.entries(bio)
            .filter(([key, value]) =>
                value != null && String(value).trim() !== '' // Ensure value exists and is not empty
            )
            .map(([key, value]) => ({
                key: key, // Keep the original key for sorting/identification
                label: bioDetailLabels[key] || key.replace(/([A-Z])/g, ' $1').trim(), // Use label or format key
                value: String(value).trim(),
            }));

        // Optional: Sort to put 'musicTaste' first if it exists
        details.sort((a, b) => {
            if (a.key === 'musicTaste') return -1;
            if (b.key === 'musicTaste') return 1;
            return 0; // Keep original order for others
        });

        return details;

    }, [bio]); // Dependency array ensures recalculation only if bio changes


    const handleChatPress = () => {
        console.log(`Navigating to chat with user: ${userId}, name: ${name}`);
        navigation.navigate('IndividualChatScreen', { matchUserId: userId, matchName: name, matchProfilePicture: image });
    };

    // Prepare display strings safely
    const displayName = name && String(name).trim() !== '' ? String(name).trim() : 'User';
    const hasBioDetails = allBioDetailsToDisplay.length > 0;

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
                <Image source={{ uri: image ?? DEFAULT_PROFILE_PIC }} style={styles.profileImage} />

                {/* Info Container below Image */}
                <View style={styles.infoContainer}>
                    {/* Display Name */}
                    <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{displayName}</Text>

                     {/* Common Tags Section - Render if tags exist */}
                     {commonTags && commonTags.length > 0 && (
                         <View style={styles.commonTagsSection}>
                             <Feather name="tag" size={14} color="#10B981" style={styles.commonTagsIcon}/>
                             <Text style={styles.commonTagsTitle}>Shared Interests:</Text>
                             <View style={styles.tagsContainer}>
                                 {commonTags.slice(0, 5).map((tag, index) => (
                                     <View key={`${id}-tag-${index}`} style={styles.tag}>
                                         <Text style={styles.tagText}>{tag}</Text>
                                     </View>
                                 ))}
                                 {commonTags.length > 5 && (
                                     <Text style={styles.moreTagsText}>...</Text>
                                 )}
                             </View>
                         </View>
                     )}

                    {/* "About [Name]" Section - Renders the list including music taste */}
                    {/* Conditionally render the whole section */}
                    {hasBioDetails ? (
                        <View style={styles.bioDetailsSection}>
                             <Text style={styles.bioSectionTitle}>About {displayName.split(' ')[0]}</Text>
                             {/* Map over the prepared details */}
                            {allBioDetailsToDisplay.map((detail, index) => (
                                <View key={`${id}-bio-${index}`} style={styles.bioDetailItem}>
                                    {/* Optional: Add specific icon for musicTaste */}
                                    {detail.key === 'musicTaste' && <Feather name="music" size={13} color="#6B7280" style={styles.bioDetailIcon} />}
                                    <Text style={styles.bioDetailLabel}>{detail.label}:</Text>
                                    <Text style={styles.bioDetailValue}>{detail.value}</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                         // Show placeholder only if common tags are also missing
                         (!commonTags || commonTags.length === 0) &&
                         <Text style={styles.noBioText}>More about them coming soon...</Text>
                    )}
                </View>

                 {/* Chat Button */}
                 <View style={styles.actionsContainer}>
                     <TouchableOpacity style={styles.chatButton} onPress={handleChatPress}>
                         <Feather name="message-circle" size={18} color="#FFFFFF" />
                         <Text style={styles.chatButtonText}>Chat with {displayName.split(' ')[0]}</Text>
                     </TouchableOpacity>
                 </View>
            </View>
        </View>
    );
};

// --- Styles --- (Adjusted styles for bio list and spacing)
const styles = StyleSheet.create({
    cardContainer: { width: '100%', alignItems: 'center', paddingVertical: 10, },
    card: { backgroundColor: 'white', borderRadius: 16, width: Platform.OS === 'web' ? 360 : '95%', maxWidth: 400, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden', },
    premiumBadge: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 215, 0, 0.2)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.5)', zIndex: 1, },
    premiumText: { color: '#856A00', fontSize: 10, fontWeight: 'bold', marginLeft: 4, textTransform: 'uppercase', },
    profileImage: { width: '100%', height: 300, backgroundColor: '#E5E7EB', },
    infoContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, alignItems: 'center', width: '100%', }, // Ensure takes width for alignment
    name: { fontSize: 24, fontWeight: 'bold', color: '#1F2937', marginBottom: 10, textAlign: 'center', },

    // --- Common Tags Styles (Keep as before) ---
    commonTagsSection: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16, paddingHorizontal: 5, width: '100%', }, // Increased bottom margin
    commonTagsIcon: { marginRight: 5, marginTop: 1, },
    commonTagsTitle: { fontSize: 13, fontWeight: '600', color: '#10B981', marginRight: 8, marginBottom: 5, },
    tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', flex: 1, },
    tag: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 12, paddingVertical: 3, paddingHorizontal: 8, margin: 3, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)', },
    tagText: { color: '#059669', fontSize: 11, fontWeight: '500', },
    moreTagsText: { fontSize: 11, color: '#6B7280', marginLeft: 3, alignSelf: 'center', paddingVertical: 3, },

    // --- Styles for Combined Bio Details Section ---
    bioDetailsSection: {
        width: '100%',
        marginTop: 0, // Reset margin top as spacing is handled by commonTags section
        marginBottom: 16, // Space below the list
        paddingTop: 12, // Add padding top
        borderTopWidth: 1, // Separator line above bio details
        borderTopColor: '#F3F4F6', // Light gray separator
    },
    bioSectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151', // Dark gray title
        marginBottom: 12, // Increased space below title
        textAlign: 'left', // Align title left
    },
    bioDetailItem: {
        flexDirection: 'row', // Label and value side-by-side
        marginBottom: 10, // Increased space between items
        alignItems: 'flex-start', // Align items to the top
    },
    bioDetailIcon: { // Style for optional icon (like for musicTaste)
        marginRight: 5,
        marginTop: 1.5, // Fine-tune vertical alignment
    },
    bioDetailLabel: {
        fontSize: 13,
        color: '#6B7280', // Medium gray label
        fontWeight: '500',
        width: '40%', // Allocate consistent space for label
        marginRight: 5,
        lineHeight: 18, // Consistent line height
    },
    bioDetailValue: {
        fontSize: 13,
        color: '#374151', // Dark gray value
        flex: 1, // Take remaining space
        textAlign: 'left',
        lineHeight: 18, // Consistent line height
    },
     noBioText: { // Placeholder when bioDetails is empty
        fontSize: 13,
        color: '#9CA3AF', // Lighter gray, italic
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 15,
        width: '100%',
    },
    // --- Styles for Actions (Keep as before) ---
    actionsContainer: { flexDirection: 'row', justifyContent: 'center', paddingTop: 15, paddingBottom: 15, borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#F9FAFB', },
    chatButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3, },
    chatButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginLeft: 8, },
});

export default MatchCard;