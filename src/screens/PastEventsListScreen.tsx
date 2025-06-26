import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Image, ActivityIndicator, RefreshControl, ScrollView, Alert, Dimensions,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { APP_CONSTANTS } from '@/config/constants';
import type { RootStackParamList, MainStackParamList } from '@/navigation/AppNavigator';
import { formatEventDateTime } from '@/utils/dateUtils';
import {
    MappedEvent, SupabasePublicEvent, OrganizerInfo,
    EventCard, EventDetailModal
} from '@/screens/EventsScreen';
import ImageSwiper from '@/components/ImageSwiper';

// Define Navigation and Route Types
type PastEventsListRouteProp = RouteProp<MainStackParamList & { PastEventsListScreen: { organizerId: string; organizerName?: string } }, 'PastEventsListScreen'>;
type PastEventsListNavigationProp = NativeStackNavigationProp<RootStackParamList & MainStackParamList>;

const DEFAULT_EVENT_IMAGE = "https://via.placeholder.com/800x450/D1D5DB/1F2937?text=No+Image";
const DEFAULT_ORGANIZER_LOGO = "https://via.placeholder.com/150/BFDBFE/1E40AF?text=Logo";
const DEFAULT_ORGANIZER_NAME = "Event Organizer";

// Add web constants after imports
const CARDS_PER_ROW_WEB = 4;
const CARD_MARGIN_WEB = 16;

// --- NEW: Organizer-specific Event Item View ---
const OrganizerEventItemView: React.FC<{ item: MappedEvent, navigation: PastEventsListNavigationProp }> = ({ item, navigation }) => {
    
    // Calculate card dimensions like OrganizerPostsScreen
    const cardWidth = Platform.OS === 'web'
        ? (Dimensions.get('window').width - organizerCardStyles.postsList.paddingHorizontal! * 2 - CARD_MARGIN_WEB * (CARDS_PER_ROW_WEB - 1)) / CARDS_PER_ROW_WEB
        : Dimensions.get('window').width - organizerCardStyles.postsList.paddingHorizontal! * 2;
    const imageDimension = cardWidth; // Square 1:1 aspect ratio
    
    const handleEditPress = (eventId: string) => {
        // Past events typically aren't editable, but let's keep the button disabled or show info
        Alert.alert("Edit Past Event", "Past events cannot be edited.");
        // OR: navigation.navigate("EditEvent", { eventId }); // If editing past is allowed
    };
    const handleAnalyticsPress = (eventId: string) => {
        // Navigate to the Organizer EventDetail screen
        navigation.navigate("EventDetail", { eventId });
    };
    const handleSharePress = (eventId: string) => {
        Alert.alert("Share Event", "Sharing feature coming soon!");
    };

    return (
        <TouchableOpacity
            style={[organizerCardStyles.postCard, Platform.OS === 'web' && organizerCardStyles.postCardWeb, Platform.OS === 'web' ? {width: cardWidth} : {}]}
            onPress={() => handleAnalyticsPress(item.id)} // Pressing card goes to analytics
        >
            <ImageSwiper
                images={item.images}
                defaultImage={DEFAULT_EVENT_IMAGE}
                containerStyle={[organizerCardStyles.postImageContainer, {width: imageDimension, height: imageDimension}]}
                imageStyle={[organizerCardStyles.postImageStyle, {width: imageDimension, height: imageDimension}]}
                height={imageDimension}
            />
            <View style={organizerCardStyles.cardContent}>
                <View style={organizerCardStyles.eventHeader}>
                    <Text style={organizerCardStyles.postTitle} numberOfLines={2}>{item.title}</Text>
                    {/* Add status badge (e.g., "Completed") */}
                     <View style={[organizerCardStyles.statusBadge, { backgroundColor:"#E0F2F1" }]}>
                        <Text style={[organizerCardStyles.statusText, { color:"#10B981" }]}>Completed</Text>
                     </View>
                </View>
                <View style={organizerCardStyles.eventInfoRow}>
                    <Feather name="calendar" size={14} color="#6B7280" />
                    <Text style={organizerCardStyles.eventInfoText}>{item.date} • {item.time}</Text>
                </View>
                <View style={organizerCardStyles.eventInfoRow}>
                    <Feather name="map-pin" size={14} color="#6B7280" />
                    <Text style={organizerCardStyles.eventInfoText} numberOfLines={1}>{item.venue}</Text>
                </View>
                <View style={organizerCardStyles.cardActions}>
                    <TouchableOpacity style={[organizerCardStyles.actionButton, { backgroundColor: '#F3F4F6' }]} onPress={(e) => { e.stopPropagation(); handleEditPress(item.id); }} disabled={true}>
                        <Feather name="edit-2" size={14} color={APP_CONSTANTS.COLORS.DISABLED} />
                        <Text style={[organizerCardStyles.actionButtonText, { color: APP_CONSTANTS.COLORS.DISABLED }]}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={organizerCardStyles.actionButton} onPress={(e) => { e.stopPropagation(); handleAnalyticsPress(item.id); }}>
                        <Feather name="bar-chart-2" size={14} color={APP_CONSTANTS.COLORS.PRIMARY} />
                        <Text style={organizerCardStyles.actionButtonText}>Analytics</Text>
                    </TouchableOpacity>
                     <TouchableOpacity style={organizerCardStyles.actionButton} onPress={(e) => { e.stopPropagation(); handleSharePress(item.id); }}>
                        <Feather name="share-2" size={14} color={APP_CONSTANTS.COLORS.PRIMARY} />
                        <Text style={organizerCardStyles.actionButtonText}>Share</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );
};
// ---------------------------------------------

const PastEventsListScreen: React.FC = () => {
    const navigation = useNavigation<PastEventsListNavigationProp>();
    const route = useRoute<PastEventsListRouteProp>();
    const { session } = useAuth();
    const { organizerId, organizerName } = route.params;

    // Check if the current logged-in user is the organizer being viewed (define early)
    const isOrganizerViewingOwnEvents = useMemo(() => session?.user?.id === organizerId, [session, organizerId]);

    const [events, setEvents] = useState<MappedEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Organizer info is passed
    // Memoize organizerInfoFromParams to stabilize its reference
    const organizerInfoFromParams = useMemo(() => ({
        userId: organizerId,
        name: organizerName ?? DEFAULT_ORGANIZER_NAME,
        image: null
    }), [organizerId, organizerName]);

    const fetchPastEvents = useCallback(async (refreshing = false) => {
        if (!organizerId) {
            setError("Organizer ID missing."); setIsLoading(false); setIsRefreshing(false); return;
        }
        if (!refreshing) setIsLoading(true); else setIsRefreshing(true);
        setError(null);
        console.log(`[PastEventsListScreen] Fetching past events for organizer: ${organizerId}...`);

        try {
            const now = new Date().toISOString();
            console.log(`[PastEventsListScreen] Filtering for events before or at: ${now}`);
            const { data: eventData, error: eventsError } = await supabase
                .from("events")
                .select(`
                    id, title, description, event_datetime, location_text, poster_urls,
                    tags_genres, tags_artists, tags_songs, organizer_id,
                    event_type, booking_type, ticket_price, pass_fee_to_user,
                    max_tickets, max_reservations, country, state, city
                `)
                .eq('organizer_id', organizerId)
                .lte('event_datetime', now) // Filter for past or ongoing events
                .neq('booking_type', 'RESERVATION') // Exclude automated reservation posts
                .order("event_datetime", { ascending: false }); // Show most recent first

            if (eventsError) throw eventsError;

            if (!eventData || eventData.length === 0) {
                setEvents([]);
                console.log("[PastEventsListScreen] No past events found for this organizer.");
                return;
            }

            // Map events
            const mappedEvents: MappedEvent[] = eventData.map((event: SupabasePublicEvent) => {
                const { date, time } = formatEventDateTime(event.event_datetime);
                return {
                    id: event.id, title: event.title,
                    images: event.poster_urls?.length > 0 ? event.poster_urls : [DEFAULT_EVENT_IMAGE],
                    date: date, time: time,
                    venue: event.location_text ?? "N/A",
                    country: event.country,
                    city: event.city,
                    genres: event.tags_genres ?? [], artists: event.tags_artists ?? [], songs: event.tags_songs ?? [],
                    description: event.description ?? "No description.",
                    booking_type: event.booking_type,
                    ticket_price: event.ticket_price,
                    pass_fee_to_user: event.pass_fee_to_user ?? true,
                    max_tickets: event.max_tickets,
                    max_reservations: event.max_reservations,
                    organizer: organizerInfoFromParams,
                    isViewable: false,
                    event_datetime_iso: event.event_datetime
                };
            });

            console.log(`[PastEventsListScreen] Fetched ${mappedEvents.length} past events.`);
            setEvents(mappedEvents);

        } catch (err: any) {
            console.error("[PastEventsListScreen] Error fetching events:", err);
            setError("Could not load past events.");
            setEvents([]);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [organizerId, organizerInfoFromParams]);

    useFocusEffect(useCallback(() => { fetchPastEvents(); }, [fetchPastEvents]));

    const onRefresh = () => { fetchPastEvents(true); };

    // Get screen title
    const screenTitle = isOrganizerViewingOwnEvents
        ? "My Past Events"
        : `${organizerName ?? 'Organizer'}'s Past Events`;

    // --- Modal State --- (Only needed for non-organizer view)
    const [selectedEvent, setSelectedEvent] = useState<MappedEvent | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const handleEventPress = (event: MappedEvent) => { setSelectedEvent(event); setModalVisible(true); };
    const handleCloseModal = () => { setModalVisible(false); setSelectedEvent(null); };
    // -------------------

    // --- UPDATED: Conditional Rendering ---
    const renderEventItem = ({ item }: { item: MappedEvent }) => {
        if (isOrganizerViewingOwnEvents) {
             return <OrganizerEventItemView item={item} navigation={navigation} />;
        } else {
            // User view: Use EventCard and Modal
            return (
                <EventCard
                    event={item}
                    onPress={() => handleEventPress(item)}
                />
            );
        }
    };
    // ------------------------------------

    const renderContent = () => {
        if (isLoading && !isRefreshing) { return <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} /></View>; }
        if (error) { return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>; }
        if (events.length === 0) {
            return (
                <ScrollView
                    contentContainerStyle={styles.emptyContainer}
                    refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[APP_CONSTANTS.COLORS.PRIMARY]} />}
                >
                    <Feather name="rewind" size={60} color={APP_CONSTANTS.COLORS.DISABLED} />
                    <Text style={styles.emptyText}>No Past Events</Text>
                    <Text style={styles.emptySubText}>{organizerName ?? 'This organizer'} has no past events listed.</Text>
                </ScrollView>
            );
        }
        return (
            <FlatList
                data={events}
                renderItem={renderEventItem}
                keyExtractor={(item) => item.id}
                style={styles.list}
                contentContainerStyle={organizerCardStyles.postsList}
                ItemSeparatorComponent={null} // Remove separator for grid layout
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[APP_CONSTANTS.COLORS.PRIMARY]} tintColor={APP_CONSTANTS.COLORS.PRIMARY} />}
            />
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="chevron-left" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{screenTitle}</Text>
            </View>
            {renderContent()}
            {/* Only render modal if NOT organizer view */}
             {!isOrganizerViewingOwnEvents && (
                 <EventDetailModal
                     event={selectedEvent}
                     visible={modalVisible}
                     onClose={handleCloseModal}
                     navigation={navigation}
                 />
             )}
        </SafeAreaView>
    );
};

// --- Styles (Same as UpcomingEventsListScreen) ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 8,
        marginRight: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        flex: 1,
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    errorText: { color: APP_CONSTANTS.COLORS.ERROR, fontSize: 16, textAlign: 'center' },
    list: { flex: 1, },
    listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
    separator: { height: 20, },
    emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
    emptyText: { fontSize: 18, fontWeight: '600', color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, marginTop: 15, textAlign: 'center', },
    emptySubText: { fontSize: 14, color: APP_CONSTANTS.COLORS.DISABLED, marginTop: 8, textAlign: 'center', },
    // Removed placeholder style
});

// --- NEW: Updated Organizer Card Styles (Based on OrganizerPostsScreen) ---
const organizerCardStyles = StyleSheet.create({
     postsList: {
         paddingHorizontal: Platform.OS === 'web' ? 0 : 16, // Web horizontal padding handled by card margin
         paddingTop: 16,
         paddingBottom: 80,
         flexGrow: 1,
         ...(Platform.OS === 'web' ? {
             flexDirection: 'row',
             flexWrap: 'wrap',
             justifyContent: 'center',
         } : {})
     },
     postCard: {
         backgroundColor: "white",
         borderRadius: 12,
         overflow: "hidden",
         marginBottom: 20,
         shadowColor: "#000",
         shadowOffset: { width: 0, height: 2 },
         shadowOpacity: 0.08,
         shadowRadius: 4,
         elevation: 3,
         ...(Platform.OS === 'web' ? {} : { width: '100%' })
     },
     postCardWeb: {
         marginHorizontal: CARD_MARGIN_WEB / 2, // For spacing between cards in a row
         marginBottom: CARD_MARGIN_WEB, // For spacing between rows
     },
     postImageContainer: {
         width: "100%",
         borderTopLeftRadius: 12,
         borderTopRightRadius: 12,
         backgroundColor: APP_CONSTANTS.COLORS.BORDER_LIGHT ||'#F3F4F6',
         overflow: 'hidden',
     },
     postImageStyle: {
         backgroundColor: APP_CONSTANTS.COLORS.BORDER_LIGHT ||'#F3F4F6',
     },
     cardContent: { padding: 16 },
     eventHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
     postTitle: { fontSize: 18, fontWeight: "700", color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, flexShrink: 1, marginRight: 8 },
     statusBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 12, marginLeft: 8, },
     statusText: { fontSize: 11, fontWeight: "600" },
     eventInfoRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
     eventInfoText: { fontSize: 14, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, marginLeft: 8, flexShrink: 1 },
     cardActions: { flexDirection: "row", justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: APP_CONSTANTS.COLORS.BORDER_LIGHT ||'#F3F4F6', paddingTop: 12, marginTop: 12 },
     actionButton: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingHorizontal: 8 },
     actionButtonText: { color: APP_CONSTANTS.COLORS.PRIMARY, fontWeight: "500", fontSize: 14, marginLeft: 6 },
});
// ---------------------------------------------------------

export default PastEventsListScreen; 