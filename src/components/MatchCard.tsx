import React from 'react';
import { View, Text, Image, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

/**
 * Define the structure of the bio object received from the backend.
 * Ensure this precisely matches the keys and potential types in the 'bio' JSON object
 * returned by your SQL function.
 */
export interface MusicLoverBio {
    musicTaste?: string | null;
    firstSong?: string | null;
    goToSong?: string | null;
    mustListenAlbum?: string | null;
    dreamConcert?: string | null;
    // Add any other potential fields if they exist in your bio JSON
}

const DEFAULT_PROFILE_PIC = 'https://via.placeholder.com/150/CCCCCC/808080?text=No+Image';

/**
 * Props expected by the MatchCard component.
 * It now only expects data needed for display, excluding the score.
 */
export interface MatchCardProps {
    id: string;             // profileId from match data
    userId: string;         // auth userId from match data (for chat)
    name: string;
    image: string | null;
    bio: MusicLoverBio | null; // The bio object itself
    isPremium: boolean;
}

// Define navigation stack for typing
type RootStackParamList = {
    ChatsScreen: { matchUserId: string; matchName: string; };
    IndividualChatScreen: { // <--- Define the target screen and params
        matchUserId: string;
        matchName: string;
        matchProfilePicture?: string | null;
    };
    // Add other screens if needed
};
type MatchCardNavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * Labels for Bio Details - maps keys from MusicLoverBio to display strings.
 * Use a simple Record<string, string> for flexibility.
 */
const bioDetailLabels: Record<string, string> = {
    firstSong: "First Concert / Memory",
    goToSong: "Go-To Song Right Now",
    mustListenAlbum: "Must-Listen Album",
    dreamConcert: "Dream Concert Lineup",
    // musicTaste is handled separately, so it's not needed here for the list
};


const MatchCard: React.FC<MatchCardProps> = ({
    id,
    userId,
    name,
    image,
    bio, // Receive the bio object
    isPremium,
}) => {
    const navigation = useNavigation<MatchCardNavigationProp>();

    /**
     * Memoized calculation of the bio details to display in the "Things About Me" list.
     * Filters out musicTaste and any empty/null values.
     * Maps keys to readable labels using bioDetailLabels.
     */
    const otherBioDetailsToDisplay = React.useMemo(() => {
        if (!bio) return []; // Return empty array if bio object is null/undefined

        return Object.entries(bio)
            .filter(([key, value]) =>
                key !== 'musicTaste' && // Explicitly exclude musicTaste
                value != null && String(value).trim() !== '' // Ensure value is not null/undefined and not an empty string
            )
            .map(([key, value]) => ({
                // Use the label from the map, or format the key as a fallback
                label: bioDetailLabels[key] || key.replace(/([A-Z])/g, ' $1').trim(),
                value: String(value).trim(), // Ensure value is a string
            }));
    }, [bio]); // Dependency array ensures recalculation only if bio changes


    // const handleChatPress = () => {
    //     navigation.navigate('ChatsScreen', {
    //         matchUserId: userId,
    //         matchName: name,
    //     });
    // };

    const handleChatPress = () => {
        console.log(`Navigating to chat with user: ${userId}, name: ${name}`);
        navigation.navigate('IndividualChatScreen', {
            matchUserId: userId, // Pass the matched user's ID
            matchName: name,     // Pass their name
            matchProfilePicture: image // Pass their image URL
        });
    };

    // Prepare display strings safely
    const displayName = name && String(name).trim() !== '' ? String(name).trim() : 'User';
    const musicTasteDisplay = bio?.musicTaste && String(bio.musicTaste).trim() !== '' ? String(bio.musicTaste).trim() : null;

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
                <Image
                    source={{ uri: image ?? DEFAULT_PROFILE_PIC }}
                    style={styles.profileImage}
                />

                {/* Info Container below Image */}
                <View style={styles.infoContainer}>
                    <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{displayName}</Text>

                     {/* Music Taste Display */}
                     {musicTasteDisplay && (
                         <View style={styles.musicTasteContainer}>
                             <Feather name="music" size={14} color="#6B7280" style={styles.musicTasteIcon}/>
                             <Text style={styles.musicTasteText} numberOfLines={2} ellipsizeMode="tail">
                                 {musicTasteDisplay}
                             </Text>
                         </View>
                     )}

                    {/* "Things About Me" Section - Renders the list */}
                    {/* Conditionally render the whole section */}
                    {otherBioDetailsToDisplay.length > 0 ? (
                        <View style={styles.bioDetailsSection}>
                             <Text style={styles.bioSectionTitle}>Things About Me</Text>
                             {/* Map over the prepared details */}
                            {otherBioDetailsToDisplay.map((detail, index) => (
                                <View key={`${id}-bio-${index}`} style={styles.bioDetailItem}>
                                    <Text style={styles.bioDetailLabel}>{detail.label}:</Text>
                                    <Text style={styles.bioDetailValue}>{detail.value}</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                         // Placeholder if no other bio details are available
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

// --- Styles --- (Using the layout with large image top)
const styles = StyleSheet.create({
    cardContainer: { width: '100%', alignItems: 'center', paddingVertical: 10, },
    card: { backgroundColor: 'white', borderRadius: 16, width: Platform.OS === 'web' ? 360 : '95%', maxWidth: 400, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden', },
    premiumBadge: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 215, 0, 0.2)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.5)', zIndex: 1, },
    premiumText: { color: '#856A00', fontSize: 10, fontWeight: 'bold', marginLeft: 4, textTransform: 'uppercase', },
    profileImage: { width: '100%', height: 250, backgroundColor: '#E5E7EB', },
    infoContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, alignItems: 'center', },
    name: { fontSize: 22, fontWeight: 'bold', color: '#1F2937', marginBottom: 8, textAlign: 'center', },
    musicTasteContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginBottom: 16, alignSelf: 'center', maxWidth: '95%', },
    musicTasteIcon: { marginRight: 6, color: '#6B7280', },
    musicTasteText: { fontSize: 13, color: '#4B5563', fontWeight: '500', flexShrink: 1, },
    // --- Styles specific to Bio Details Section ---
    bioDetailsSection: { // Container for the title and list
        width: '100%',
        marginTop: 0, // Adjusted margin
        marginBottom: 16, // Space below the list
        paddingTop: 12, // Add padding top
        borderTopWidth: 1, // Separator line above bio details
        borderTopColor: '#F3F4F6',
    },
    bioSectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 10,
        textAlign: 'left',
    },
    bioDetailItem: {
        flexDirection: 'row',
        marginBottom: 8,
        alignItems: 'flex-start',
    },
    bioDetailLabel: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
        width: '40%', // Adjust as needed
        marginRight: 5,
        lineHeight: 18, // Improve line height consistency
    },
    bioDetailValue: {
        fontSize: 13,
        color: '#374151',
        flex: 1,
        textAlign: 'left',
        lineHeight: 18, // Improve line height consistency
    },
     noBioText: { // Placeholder when otherBioDetails is empty
        fontSize: 13,
        color: '#9CA3AF',
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 10, // Space from music taste if bio is empty
        marginBottom: 15,
        width: '100%',
    },
    // --- Styles for Actions ---
    actionsContainer: { flexDirection: 'row', justifyContent: 'center', paddingTop: 15, paddingBottom: 15, borderTopWidth: 1, borderTopColor: '#F3F4F6', },
    chatButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3, },
    chatButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginLeft: 8, },
});

export default MatchCard;