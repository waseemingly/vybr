import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Image,
    ScrollView,
    FlatList,
    ActivityIndicator,
    Keyboard,
    Platform,
    Alert,
    Modal,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase'; // Adjust path
import { format, parseISO, isValid } from 'date-fns'; // Ensure date-fns is installed
// import { BlurView } from 'expo-blur'; // Remove if not installed/used
import { useAuth } from '@/hooks/useAuth';
import { APP_CONSTANTS } from '@/config/constants';
import type { RootStackParamList, MainStackParamList } from '@/navigation/AppNavigator';
// import { formatEventType } from '@/utils/stringUtils'; // Assuming you have this - Define locally if not
import ImageSwiper from '@/components/ImageSwiper'; // <-- Import ImageSwiper

// Import necessary things from EventsScreen, including shared types
import {
    OrganizerInfo, // Import OrganizerInfo
    EventDetailModal, // Import EventDetailModal
    MappedEvent, // Import MappedEvent
    SupabasePublicEvent // Import the definition from EventsScreen if needed, or redefine
} from '@/screens/EventsScreen'; // Adjust path if needed

// --- Define Types ---

// 1. Navigation Param List (Adjust stack name and other screens as needed)
// Keep using the SearchScreenNavigationProp for internal navigation if needed
// but note the modal doesn't use stack navigation in the same way.
type SearchScreenNavigationProp = NativeStackNavigationProp<RootStackParamList & MainStackParamList>; // Use combined type

// Define the structure returned by the RPC (matching SupabasePublicEvent essentially)
// Or re-import SupabasePublicEvent from EventsScreen if identical
interface RpcEventResult {
  id: string;
  title: string;
  description: string | null;
  event_datetime: string;
  location_text: string | null;
  poster_urls: string[];
  tags_genres: string[];
  tags_artists: string[];
  tags_songs: string[];
  organizer_id: string | null; // Crucially includes organizer_id
  event_type: string | null;
  booking_type: 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null;
  ticket_price: number | null;
  pass_fee_to_user: boolean | null;
  max_tickets: number | null;
  max_reservations: number | null;
  // Add other fields if your 'events' table has more and they are needed
}

// Type for dynamic popular searches
interface PopularSearchItem {
    name: string; // The actual genre/tag string
    icon: React.ComponentProps<typeof Feather>['name']; // Assign a default icon
}


// --- Helper Functions ---
const formatEventType = (type: string | null): string => {
    if (!type) return "Event";
    return type.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

// --- Helper Functions from EventsScreen ---
const DEFAULT_EVENT_IMAGE = "https://via.placeholder.com/800x450/D1D5DB/1F2937?text=No+Image";
const DEFAULT_ORGANIZER_LOGO = APP_CONSTANTS.DEFAULT_ORGANIZER_LOGO || "https://via.placeholder.com/150/BFDBFE/1E40AF?text=Logo";
const DEFAULT_ORGANIZER_NAME = "Event Organizer";

const formatEventDateTime = (isoString: string | null): { date: string; time: string } => {
  if (!isoString) return { date: "N/A", time: "N/A" };
  try {
    const d = new Date(isoString);
    // Use a consistent format, maybe simpler for search results card
    const datePart = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
    return { date: datePart, time: timePart };
  } catch (e) { return { date: "Invalid Date", time: "" }; }
};


// --- Component ---
const SearchScreen = () => {
    const navigation = useNavigation<SearchScreenNavigationProp>();
    const [searchTerm, setSearchTerm] = useState("");
    // State now holds MappedEvent for consistency with modal
    const [searchResults, setSearchResults] = useState<MappedEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [popularSearches, setPopularSearches] = useState<PopularSearchItem[]>([]);
    const [isLoadingPopular, setIsLoadingPopular] = useState(true);

    // State for the modal
    const [selectedEventDetail, setSelectedEventDetail] = useState<MappedEvent | null>(null);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);


    // --- Fetch Popular Searches (Dynamic) ---
    const fetchPopularGenres = useCallback(async () => {
        console.log("Fetching popular genres...");
        setIsLoadingPopular(true);
        try {
            const { data, error } = await supabase
                .rpc('get_distinct_future_genres', { limit_count: 8 });
            if (error) throw error;
            let popularItems: PopularSearchItem[] = [];
            if (data && Array.isArray(data)) {
                popularItems = data
                    .filter((genreName): genreName is string => typeof genreName === 'string' && genreName.trim() !== '')
                    .map((genreName: string) => ({ name: genreName, icon: 'music' }));
            }
            setPopularSearches(popularItems);
        } catch (error: any) {
            console.error("Error fetching popular genres:", error.message);
            setPopularSearches([]);
        } finally {
            setIsLoadingPopular(false);
        }
    }, []);

    // Fetch popular searches on component mount
    useEffect(() => {
        fetchPopularGenres();
    }, [fetchPopularGenres]);


    // --- Fetch Event Search Results & Map to MappedEvent ---
    const fetchAndMapEvents = useCallback(async (query: string): Promise<MappedEvent[]> => {
        if (!query.trim()) return [];
        console.log(`Searching events via RPC for: "${query}"`);

        // 1. Fetch Events using the RPC (which returns SETOF events)
        // Explicitly type the expected return data structure using correct Supabase RPC syntax
        const { data: rawEventsData, error: rpcError } = await supabase
            .rpc('search_events_with_organizer', { search_term: query }, { count: 'exact' }) // Pass function name and args
            // Note: Supabase types might infer the return type, or you might need a cast
            // Let's assume inference works first, or cast if needed: as { data: RpcEventResult[] | null; error: any; count: number | null };

        if (rpcError) {
            console.error("Error calling RPC search_events_with_organizer:", rpcError);
            Alert.alert("Search Error", `Could not perform search. ${rpcError.message}`);
            return [];
        }

        if (!rawEventsData || rawEventsData.length === 0) {
            console.log("RPC returned no results.");
            return [];
        }

        // Log the raw data structure from RPC to confirm fields
        console.log("[SearchScreen] Raw data from RPC:", rawEventsData[0]);

        // NOTE: The RPC returns SETOF events, so it only contains fields from the events table.
        // We need a separate query to get organizer details.

        // 2. Extract Unique Organizer IDs from the results
        const organizerIds = [
            ...new Set(
                (rawEventsData as RpcEventResult[]) // Cast to ensure map works on the correct type
                    .map(event => event?.organizer_id) // Get organizer_id or undefined
                    .filter((id): id is string => typeof id === 'string' && id.length > 0) // Type guard: ensure id is a non-empty string
            )
        ];

        let organizerMap = new Map<string, OrganizerInfo>();

        // 3. Fetch Organizer Profiles if IDs exist
        if (organizerIds.length > 0) {
            console.log(`[SearchScreen] Fetching profiles for ${organizerIds.length} organizers found in search...`);
            const { data: organizerProfiles, error: profilesError } = await supabase
                .from('organizer_profiles')
                .select('user_id, company_name, logo') // Select the fields we need
                .in('user_id', organizerIds);

            if (profilesError) {
                console.warn("[SearchScreen] Error fetching organizer profiles:", profilesError);
            } else if (organizerProfiles) {
                console.log(`[SearchScreen] Successfully fetched ${organizerProfiles.length} organizer profiles.`);
                organizerProfiles.forEach(profile => {
                    if (profile.user_id) {
                        organizerMap.set(profile.user_id, {
                            userId: profile.user_id,
                            name: profile.company_name ?? DEFAULT_ORGANIZER_NAME,
                            image: profile.logo ?? null
                        });
                    }
                });
            }
        }

        // 4. Map RpcEventResult to MappedEvent
        // Ensure rawEventsData is correctly typed as RpcEventResult[] before mapping
        const results: MappedEvent[] = (rawEventsData as RpcEventResult[]).map((event: RpcEventResult) => {
            const { date, time } = formatEventDateTime(event.event_datetime);

            const organizerInfo = event.organizer_id ? organizerMap.get(event.organizer_id) : null;

            const finalOrganizerData: OrganizerInfo = organizerInfo || {
                userId: event.organizer_id ?? '',
                name: DEFAULT_ORGANIZER_NAME,
                image: null
            };

            const posterUrls = event.poster_urls ?? [];

            return {
                id: event.id,
                title: event.title ?? 'Untitled Event',
                images: posterUrls.length > 0 ? posterUrls : [DEFAULT_EVENT_IMAGE],
                date: date,
                time: time,
                venue: event.location_text ?? "Venue TBC",
                genres: event.tags_genres ?? [],
                artists: event.tags_artists ?? [],
                songs: event.tags_songs ?? [],
                description: event.description ?? "No description provided.",
                booking_type: event.booking_type,
                ticket_price: event.ticket_price,
                pass_fee_to_user: event.pass_fee_to_user ?? true,
                max_tickets: event.max_tickets,
                max_reservations: event.max_reservations,
                organizer: finalOrganizerData,
                isViewable: false,
            };
        });

        console.log(`Mapped ${results.length} results for search term "${query}".`);
        return results;
    }, []);


    // --- Handlers ---
    const handleSearch = useCallback(async () => {
        const trimmedQuery = searchTerm.trim();
        if (!trimmedQuery) return;
        Keyboard.dismiss();
        setIsSearching(true);
        setIsLoading(true);
        setSearchResults([]); // Clear previous results
        try {
            const results = await fetchAndMapEvents(trimmedQuery); // Use the mapping function
            setSearchResults(results);
        } catch (err: any) {
            console.error("HandleSearch Catch Block:", err);
            Alert.alert("Error", "An unexpected error occurred during search.");
        } finally {
            setIsLoading(false);
        }
    }, [searchTerm, fetchAndMapEvents]);

    const handlePopularSearch = useCallback((query: string) => {
        if (!query) return;
        console.log(`Popular search clicked: "${query}"`)
        setSearchTerm(query); // Set the search term
        // Trigger search immediately
        Keyboard.dismiss();
        setIsSearching(true);
        setIsLoading(true);
        setSearchResults([]); // Clear previous results
        fetchAndMapEvents(query).then(results => { // Use mapping function
            setSearchResults(results);
        }).catch(err => {
            console.error("HandlePopularSearch Fetch Catch Block:", err);
            Alert.alert("Error", "An unexpected error occurred during search.");
        }).finally(() => {
            setIsLoading(false);
        });
    }, [fetchAndMapEvents]);

    const handleClearSearch = () => {
        setIsSearching(false);
        setSearchTerm("");
        setSearchResults([]);
        Keyboard.dismiss();
    };

    // --- Modal Handlers ---
    const handleEventPress = (event: MappedEvent) => {
        setSelectedEventDetail(event);
        setIsDetailModalVisible(true);
    };

    const handleCloseModal = () => {
        setIsDetailModalVisible(false);
        setSelectedEventDetail(null);
    };
    // --- End Modal Handlers ---

    // --- Render Functions ---

    // Event Result Renderer - Modified to accept MappedEvent and use handleEventPress
    const renderEventResult = ({ item }: { item: MappedEvent }) => { // Item is now MappedEvent
        // Use data directly from MappedEvent (already formatted)
        const venue = item.venue || 'Venue TBC';
        const organizerName = item.organizer?.name || 'Organizer TBC'; // Use organizer from MappedEvent

        // Note: We cannot display formattedType as event_type is not in the shared MappedEvent
        // const formattedType = formatEventType(item.event_type); // Remove this line

        // Simplified price display for card (can reuse logic from EventsScreen if needed)
        let priceDisplay = null;
        if (item.booking_type === 'TICKETED') {
             priceDisplay = (item.ticket_price !== null && item.ticket_price >= 0)
                 ? (item.ticket_price === 0 ? "Free" : `$${item.ticket_price.toFixed(2)}`)
                 : "N/A";
        } else if (item.booking_type === 'RESERVATION') {
             priceDisplay = "Reservation";
        }


        return (
            <TouchableOpacity
                style={styles.resultCard}
                activeOpacity={0.7}
                onPress={() => handleEventPress(item)} // Use new handler to open modal
            >
                <ImageSwiper
                    images={item.images} // Use images from MappedEvent
                    defaultImage={DEFAULT_EVENT_IMAGE}
                    containerStyle={styles.resultImageContainer}
                    imageStyle={styles.resultImageStyle}
                    height={styles.resultImageStyle.height as number}
                />
                <View style={styles.resultContent}>
                     {/* Removed eventTypeBadgeFixed as event_type is not available */}
                     {/* <View style={styles.eventTypeBadgeFixed}>
                         <Text style={styles.eventTypeBadgeText}>{formattedType}</Text>
                     </View> */}
                    <Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text>
                    {/* Display date/time/venue from MappedEvent */}
                    <Text style={styles.resultSubtitle} numberOfLines={1}>{item.date} at {item.time} • {venue}</Text>
                    <Text style={styles.resultOrganizer} numberOfLines={1}>By: {organizerName}</Text>
                </View>

                {/* Price Tag */}
                {priceDisplay && (
                     <View style={[
                         styles.priceTag,
                         priceDisplay === 'Free' && styles.priceTagFree,
                         priceDisplay === 'Reservation' && styles.priceTagReservation,
                         priceDisplay === 'N/A' && styles.priceTagNA, // Add style for N/A
                     ]}>
                         <Text style={styles.priceTagText}>
                             {priceDisplay === 'N/A' ? 'Info' : priceDisplay}
                         </Text>
                     </View>
                 )}
                <Feather name="chevron-right" size={20} color="#9CA3AF" style={styles.chevronIcon}/>
            </TouchableOpacity>
        );
    };


    // Initial View Renderer (Shows dynamic popular searches)
    const renderInitialView = () => (
        <ScrollView
            style={styles.contentInitial}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
             <View style={styles.headerInitial}>
                <View style={styles.titleContainer}>
                    <Feather name="search" size={22} color="#60A5FA" style={styles.headerIcon}/>
                    <Text style={styles.titleInitial}>Search Events</Text>
                </View>
                <Text style={styles.subtitleInitial}>Discover events, artists, and venues</Text>
            </View>
            <View style={styles.searchCardInitial}>
                <View style={styles.searchInputContainer}>
                    <Feather name="search" size={20} color="#9CA3AF" style={styles.searchIcon}/>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by event, artist, genre..."
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                        onSubmitEditing={handleSearch} // Trigger search on submit
                        returnKeyType="search"
                        clearButtonMode="while-editing"
                    />
                </View>
                {/* Dynamic Popular Searches Section */}
                <View style={styles.popularSearchesContainer}>
                    <Text style={styles.sectionTitle}>Popular searches</Text>
                    {isLoadingPopular ? (
                        <ActivityIndicator style={{marginTop: 10}} color="#3B82F6" />
                    ) : popularSearches.length > 0 ? (
                         <View style={styles.popularTagsContainer}>
                            {popularSearches.map((item) => ( // Use fetched popularSearches
                                <TouchableOpacity
                                    key={item.name} // Use unique name as key
                                    style={styles.popularTag}
                                    onPress={() => handlePopularSearch(item.name)} // Trigger search on press
                                >
                                    <Feather name={item.icon} size={16} color="#3B82F6" style={styles.popularTagIcon}/>
                                    <Text style={styles.popularTagText}>{item.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.noPopularText}>No popular searches found.</Text>
                    )}
                </View>
                {/* End Dynamic Popular Searches */}
            </View>
        </ScrollView>
    );

    // Results View Renderer (Unchanged structure, FlatList uses renderEventResult)
    const renderResultsView = () => (
         <View style={styles.resultsContainer}>
            <View style={styles.headerResults}>
                <View style={styles.searchInputContainerResults}>
                    <Feather name="search" size={18} color="#9CA3AF" style={styles.searchIconResults}/>
                    <TextInput
                        style={styles.searchInputResults}
                        placeholder="Search again..."
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                        onSubmitEditing={handleSearch} // Allow searching again
                        returnKeyType="search"
                        autoFocus={false}
                        clearButtonMode="while-editing"
                    />
                </View>
                 <TouchableOpacity onPress={handleClearSearch} style={styles.cancelButton}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                 </TouchableOpacity>
            </View>
            <FlatList
                data={searchResults}
                renderItem={renderEventResult} // Renders items that now open the modal
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.resultsListContent}
                ListEmptyComponent={() => ( // Show empty state only when not loading
                    !isLoading ? (
                        <View style={styles.emptyStateContainer}>
                            <Feather name="alert-circle" size={40} color="#CBD5E1" />
                            <Text style={styles.emptyStateText}>No results found for "{searchTerm}"</Text>
                            <Text style={styles.emptyStateSubText}>Try searching for something else.</Text>
                        </View>
                    ) : null
                )}
                ListHeaderComponent={isLoading ? ( // Show loading indicator at the top
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#3B82F6" />
                        </View>
                    ) : null
                }
                keyboardShouldPersistTaps="handled"
            />
        </View>
    );

    // --- Main Return ---
    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Render initial or results view */}
            {!isSearching ? renderInitialView() : renderResultsView()}

            {/* Add the Event Detail Modal */}
            <EventDetailModal
                event={selectedEventDetail}
                visible={isDetailModalVisible}
                onClose={handleCloseModal}
                navigation={navigation} // Pass navigation prop
            />
        </SafeAreaView>
    );
};


// --- Styles --- (Removed eventTypeBadgeFixed and related styles)
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F9FAFB",
    },
    // --- Initial View Styles ---
    contentInitial: { flex: 1 },
    headerInitial: {
        paddingTop: Platform.OS === 'android' ? 20 : 10,
        paddingBottom: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: 'white'
    },
    titleContainer: { flexDirection: "row", alignItems: "center" },
    headerIcon: { marginRight: 10 },
    titleInitial: { fontSize: 24, fontWeight: "bold", color: "#1F2937" },
    subtitleInitial: { fontSize: 15, color: "#6B7280", marginTop: 4 },
    searchCardInitial: {
        backgroundColor: "white",
        borderRadius: 12,
        margin: 16,
        padding: 16,
        // Adding shadow for elevation feel
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1, },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    searchInputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F3F4F6",
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 52,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, fontSize: 16, color: "#1F2937", height: "100%" },
    popularSearchesContainer: {
        minHeight: 50, // Ensure space for loader or text
     },
     noPopularText: { // Style for the 'no popular searches' message
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: 10,
        fontStyle: 'italic',
     },
    sectionTitle: { fontSize: 16, fontWeight: "600", color: "#1F2937", marginBottom: 12 },
    popularTagsContainer: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
    popularTag: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#EFF6FF",
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 14,
        margin: 4,
    },
    popularTagIcon: { marginRight: 6 },
    popularTagText: { color: "#3B82F6", fontSize: 14, fontWeight: '500' },

    // --- Results View Styles ---
    resultsContainer: { flex: 1, backgroundColor: 'white' },
    headerResults: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: 'white',
    },
    searchInputContainerResults: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F3F4F6",
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 40,
        marginRight: 12,
    },
    searchIconResults: { marginRight: 8 },
    searchInputResults: { flex: 1, fontSize: 15, color: "#1F2937", height: "100%" },
    cancelButton: { paddingVertical: 5, paddingLeft: 5 },
    cancelButtonText: { fontSize: 16, color: "#3B82F6", fontWeight: '500' },
    resultsListContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30 },
    loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
    emptyStateContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 50,
        paddingHorizontal: 30,
    },
    emptyStateText: { fontSize: 18, fontWeight: '600', color: '#4B5563', marginTop: 16, textAlign: 'center' },
    emptyStateSubText: { fontSize: 14, color: '#9CA3AF', marginTop: 8, textAlign: 'center' },

    // --- Result Card Styles ---
    resultCard: {
        flexDirection: "row",
        alignItems: "center", // Changed from center to stretch potentially? No, keep center
        backgroundColor: "white",
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#F3F4F6", // Lighter border
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    // Styles for ImageSwiper in search results
    resultImageContainer: {
       width: 80, // Fixed width for search result card image
       height: 80, // Make it square or adjust as needed
       borderRadius: 8,
       marginRight: 16,
       backgroundColor: '#E5E7EB', // Background for loading/default
    },
    resultImageStyle: {
       height: 80, // Match container height
       borderRadius: 8,
    },
    resultContent: {
        flex: 1,
        marginRight: 8, // Space before price/chevron
        justifyContent: 'center', // Vertically center content in the flex container
    },
    // Removed eventTypeBadgeFixed styles as it's no longer used
    resultTitle: {
        fontSize: 15, // Slightly smaller for card
        fontWeight: "600",
        color: "#1F2937",
        marginBottom: 4, // Reduced margin
    },
    resultSubtitle: {
        fontSize: 13,
        color: "#6B7280",
        marginBottom: 3,
    },
    resultOrganizer: {
        fontSize: 12,
        color: "#9CA3AF", // Lighter color for organizer
    },
    priceTag: {
        // Position absolute to float top right? No, keep in flow, adjust container maybe.
        // Let's try keeping it simple for now.
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginLeft: 'auto', // Push to the right of result content
        alignSelf: 'flex-start', // Align to top of its space
        minWidth: 50, // Ensure minimum width
        textAlign: 'center',
    },
    priceTagFree: { backgroundColor: '#10B981', }, // Green for Free
    priceTagReservation: { backgroundColor: '#F59E0B', }, // Amber for Reservation
    priceTagNA: { backgroundColor: '#9CA3AF', }, // Gray for N/A/Info
    priceTagText: {
        color: 'white',
        fontSize: 11, // Smaller text
        fontWeight: '700', // Bolder
        textAlign: 'center',
    },
    chevronIcon: {
       marginLeft: 8, // Space between price and chevron
       alignSelf: 'center', // Vertically align chevron
    },
});

export default SearchScreen;