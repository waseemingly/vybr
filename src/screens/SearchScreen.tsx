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
    Alert, // Ensure Alert is imported
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase'; // Adjust path
import { format, parseISO } from 'date-fns'; // Ensure date-fns is installed

// --- Define Types ---

// 1. Navigation Param List (Adjust stack name and other screens as needed)
type HomeStackParamList = {
    Search: undefined;
    EventDetail: { eventId: string };
    // Add other screens in this stack
};

// 2. Navigation Prop for this Screen
type SearchScreenNavigationProp = NativeStackNavigationProp<HomeStackParamList, 'Search'>;

// 3. Structure for Event data after processing RPC results
interface EventSearchResult {
    id: string;
    title: string;
    // IMPORTANT: Use the correct timestamp column name from your 'events' table
    event_datetime: string; // Or event_date_start, etc.
    venue_name: string | null;
    // IMPORTANT: Use the correct image URL column name or logic for poster_urls
    image_url: string | null;      // If you have a single image_url column
    // poster_urls?: string[] | null; // If you have a poster_urls JSONB array
    event_type: string | null;     // Assumes RPC returns this from events table
    booking_type: string | null;   // Assumes RPC returns this from events table
    ticket_price: number | null;   // Assumes RPC returns this from events table
    organizer_id: string | null;   // Need organizer_id to fetch name (assumes RPC returns it)
    organizer_profiles: {          // Manually added structure after fetch
        company_name: string | null;
    } | null;
}

// Type for dynamic popular searches
interface PopularSearchItem {
    name: string; // The actual genre/tag string
    icon: React.ComponentProps<typeof Feather>['name']; // Assign a default icon
}


// --- Helper Functions ---
const formatEventType = (type: string | null): string => {
    if (!type) return 'Event';
    // Handle potential database ENUM values directly
    return type
        .replace(/_/g, ' ') // Replace underscores with spaces
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

// --- Component ---
const SearchScreen = () => {
    const navigation = useNavigation<SearchScreenNavigationProp>();
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<EventSearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false); // Tracks if results view is active
    const [popularSearches, setPopularSearches] = useState<PopularSearchItem[]>([]);
    const [isLoadingPopular, setIsLoadingPopular] = useState(true);

    // --- Fetch Popular Searches (Dynamic) ---
    const fetchPopularGenres = useCallback(async () => {
        console.log("Fetching popular genres...");
        setIsLoadingPopular(true);
        try {
            // Call the RPC function created in Supabase SQL Editor
            const { data, error } = await supabase
                .rpc('get_distinct_future_genres', { limit_count: 8 }); // Fetch up to 8

            if (error) {
                throw error; // Let the catch block handle it
            }

            let popularItems: PopularSearchItem[] = [];
            if (data && Array.isArray(data)) {
                 // Assign a default icon to each genre string returned
                popularItems = data
                    .filter((genreName): genreName is string => typeof genreName === 'string' && genreName.trim() !== '') // Ensure they are non-empty strings
                    .map((genreName: string) => ({
                        name: genreName,
                        icon: 'music' // Default icon
                    }));
            }
            console.log("Popular genres fetched:", popularItems);
            setPopularSearches(popularItems);

        } catch (error: any) {
            console.error("Error fetching popular genres:", error.message);
            // Log error but don't show disruptive alert, default to empty
            setPopularSearches([]);
        } finally {
            setIsLoadingPopular(false);
        }
    }, []);

    // Fetch popular searches on component mount
    useEffect(() => {
        fetchPopularGenres();
    }, [fetchPopularGenres]);


    // --- Fetch Event Search Results (Uses RPC with date filter inside) ---
    const fetchEvents = useCallback(async (query: string): Promise<EventSearchResult[]> => {
        if (!query.trim()) return [];

        console.log(`Searching events via RPC for: "${query}"`);

        // Call the 'search_events_with_organizer' function (assumes it filters future dates)
        const { data: eventsData, error: rpcError } = await supabase
            .rpc('search_events_with_organizer', { search_term: query });

        if (rpcError) {
            console.error("Error calling RPC search_events_with_organizer:", rpcError);
            Alert.alert("Search Error", `Could not perform search. ${rpcError.message}`);
            return [];
        }

        if (!eventsData || eventsData.length === 0) {
             console.log("RPC returned no results.");
             return [];
        }

        // --- Manually Fetch Organizer Names ---
        const organizerIds = eventsData
            .map(event => event.organizer_id) // Make sure RPC returns organizer_id
            .filter((id, index, self): id is string => id !== null && id !== undefined && self.indexOf(id) === index);

        let organizerMap: Record<string, { company_name: string | null }> = {};

        if (organizerIds.length > 0) {
            const { data: organizersData, error: orgError } = await supabase
                .from('organizer_profiles')
                .select('id, company_name')
                .in('id', organizerIds);

            if (orgError) {
                console.error("Error fetching organizer names:", orgError);
            } else if (organizersData) {
                organizerMap = organizersData.reduce((acc, org) => {
                    acc[org.id] = { company_name: org.company_name };
                    return acc;
                }, {} as Record<string, { company_name: string | null }>);
            }
        }

        // --- Combine event data with organizer names ---
        const results: EventSearchResult[] = eventsData.map(event => ({
            // Map fields based on 'events' table structure returned by RPC
            id: event.id,
            title: event.title,
            event_datetime: event.event_datetime, // ** Verify column name **
            venue_name: event.venue_name,
            image_url: event.image_url,           // ** Verify column name or use poster_urls **
            event_type: event.event_type,
            booking_type: event.booking_type,
            ticket_price: event.ticket_price,
            organizer_id: event.organizer_id,
            organizer_profiles: event.organizer_id ? organizerMap[event.organizer_id] ?? null : null,
            // poster_urls: event.poster_urls,    // ** Uncomment/use if needed **
        }));

        console.log(`Found ${results.length} results via RPC (future events only).`);
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
            const results = await fetchEvents(trimmedQuery);
            setSearchResults(results);
        } catch (err: any) {
            console.error("HandleSearch Catch Block:", err);
            Alert.alert("Error", "An unexpected error occurred during search.");
        } finally {
            setIsLoading(false);
        }
    }, [searchTerm, fetchEvents]); // Re-create if searchTerm or fetchEvents changes

    const handlePopularSearch = useCallback((query: string) => {
        if (!query) return;
        console.log(`Popular search clicked: "${query}"`)
        setSearchTerm(query); // Set the search term
        // Trigger search immediately
        Keyboard.dismiss();
        setIsSearching(true);
        setIsLoading(true);
        setSearchResults([]); // Clear previous results
        fetchEvents(query).then(results => {
            setSearchResults(results);
        }).catch(err => {
            console.error("HandlePopularSearch Fetch Catch Block:", err);
            Alert.alert("Error", "An unexpected error occurred during search.");
        }).finally(() => {
            setIsLoading(false);
        });
    }, [fetchEvents]); // Depends only on fetchEvents

    const handleClearSearch = () => {
        setIsSearching(false);
        setSearchTerm("");
        setSearchResults([]);
        Keyboard.dismiss();
    };

    const navigateToEventDetail = (eventId: string) => {
        console.log(`Navigating to EventDetail for eventId: ${eventId}`);
        navigation.navigate('EventDetail', { eventId });
    };

    // --- Render Functions ---

    // Event Result Renderer (Using empty spacer for missing image, navigates on press)
    const renderEventResult = ({ item }: { item: EventSearchResult }) => {
        let formattedDate = 'Date TBC';
        try {
            // Use the correct date column name here
            if (item.event_datetime && typeof item.event_datetime === 'string') {
                formattedDate = format(parseISO(item.event_datetime), 'EEE, MMM d, yyyy');
            }
        } catch (e) { console.warn(`Failed to parse date: ${item.event_datetime}`, e); }

        const venue = item.venue_name || 'Venue TBC';
        const organizerName = item.organizer_profiles?.company_name || 'Organizer TBC';
        const formattedType = formatEventType(item.event_type);

        let priceDisplay = null;
        if (item.booking_type === 'TICKETED') {
            priceDisplay = (item.ticket_price !== null && item.ticket_price > 0)
                ? `$${item.ticket_price.toFixed(2)}`
                : "Free";
        } else if (item.booking_type === 'RESERVATION') {
            priceDisplay = "Reservation";
        }

        // ** IMPORTANT: Adjust image URL logic based on your schema **
        const imageUrl = item.image_url; // Use this if you have a single image_url text column
        // const imageUrl = item.poster_urls?.[0]; // Use this if you have a poster_urls JSONB array

        const hasValidImage = imageUrl && typeof imageUrl === 'string';

        return (
            <TouchableOpacity
                style={styles.resultCard}
                activeOpacity={0.7}
                onPress={() => navigateToEventDetail(item.id)} // Navigation triggered here
            >
                {/* Conditionally render Image OR an empty spacer View */}
                {hasValidImage ? (
                    <Image
                        source={{ uri: imageUrl }}
                        style={styles.resultImage}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={styles.resultImageSpacer} /> // Empty spacer
                )}

                <View style={styles.resultContent}>
                     <View style={styles.eventTypeBadgeFixed}>
                         <Text style={styles.eventTypeBadgeText}>{formattedType}</Text>
                     </View>
                    <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.resultSubtitle} numberOfLines={1}>{formattedDate} • {venue}</Text>
                    <Text style={styles.resultOrganizer} numberOfLines={1}>By: {organizerName}</Text>
                </View>

                {/* Price Tag */}
                {priceDisplay && (
                     <View style={[
                         styles.priceTag,
                         priceDisplay === 'Free' && styles.priceTagFree,
                         priceDisplay === 'Reservation' && styles.priceTagReservation,
                     ]}>
                         <Text style={styles.priceTagText}>{priceDisplay}</Text>
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

    // Results View Renderer (Unchanged structure)
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
                renderItem={renderEventResult} // Renders items that navigate on press
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
            {!isSearching ? renderInitialView() : renderResultsView()}
        </SafeAreaView>
    );
};


// --- Styles --- (Includes style for noPopularText and spacer)
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
        alignItems: "center",
        backgroundColor: "white",
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#F3F4F6",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    resultImage: { // Style for the actual Image component
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: '#E5E7EB' // Shows while image loads
    },
    resultImageSpacer: { // Style for the empty spacer View when no image
        width: 60,          // Same width as image
        height: 60,         // Same height as image
        marginRight: 12,    // Same margin as image
    },
    resultContent: {
        flex: 1,
        marginRight: 8,
    },
    eventTypeBadgeFixed: { // Positioned within content flow
        backgroundColor: '#6B7280',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        alignSelf: 'flex-start',
        marginBottom: 6,
    },
    eventTypeBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    resultTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1F2937",
        marginBottom: 4,
        marginTop: 0, // Reset top margin
    },
    resultSubtitle: {
        fontSize: 13,
        color: "#6B7280",
        marginBottom: 3,
    },
    resultOrganizer: {
        fontSize: 12,
        color: "#9CA3AF",
    },
    priceTag: {
        backgroundColor: '#3B82F6',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginLeft: 'auto',
        alignSelf: 'flex-start',
    },
    priceTagFree: {
        backgroundColor: '#10B981',
    },
    priceTagReservation: {
        backgroundColor: '#F59E0B',
    },
    priceTagText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    chevronIcon: {
       marginLeft: 8,
    },
});

export default SearchScreen;