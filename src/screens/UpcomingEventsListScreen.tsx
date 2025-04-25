import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Image, ActivityIndicator, RefreshControl, ScrollView, Alert
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
    EventCard, EventDetailModal // Assuming EventCard/Modal are default/named exports
} from '@/screens/EventsScreen';

// Define Navigation and Route Types
type UpcomingEventsListRouteProp = RouteProp<MainStackParamList, 'UpcomingEventsListScreen'>;
type UpcomingEventsListNavigationProp = NativeStackNavigationProp<RootStackParamList & MainStackParamList>;

const DEFAULT_EVENT_IMAGE = "https://via.placeholder.com/800x450/D1D5DB/1F2937?text=No+Image";
const DEFAULT_ORGANIZER_LOGO = APP_CONSTANTS.DEFAULT_ORGANIZER_LOGO;
const DEFAULT_ORGANIZER_NAME = "Event Organizer";

// --- NEW: Organizer-specific Event Item View ---
const OrganizerEventItemView: React.FC<{ item: MappedEvent, navigation: UpcomingEventsListNavigationProp }> = ({ item, navigation }) => {
    const handleEditPress = (eventId: string) => {
        navigation.navigate("EditEvent", { eventId });
    };
    const handleAnalyticsPress = (eventId: string) => {
        // Navigate to the Organizer EventDetail screen, not the user-facing one
        navigation.navigate("EventDetail", { eventId });
    };
    const handleSharePress = (eventId: string) => {
        Alert.alert("Share Event", "Sharing feature coming soon!");
    };

    return (
        <TouchableOpacity
            style={organizerCardStyles.eventCard}
            onPress={() => handleAnalyticsPress(item.id)} // Pressing card goes to analytics
        >
            <Image source={{ uri: item.images[0] ?? DEFAULT_EVENT_IMAGE }} style={organizerCardStyles.eventImage} />
            <View style={organizerCardStyles.eventContent}>
                <View style={organizerCardStyles.eventHeader}>
                    <Text style={organizerCardStyles.eventTitle} numberOfLines={2}>{item.title}</Text>
                    {/* Maybe add status badge if needed */}
                </View>
                <View style={organizerCardStyles.eventInfoRow}>
                    <Feather name="calendar" size={14} color="#6B7280" />
                    <Text style={organizerCardStyles.eventInfoText}>{item.date} • {item.time}</Text>
                </View>
                <View style={organizerCardStyles.eventInfoRow}>
                    <Feather name="map-pin" size={14} color="#6B7280" />
                    <Text style={organizerCardStyles.eventInfoText} numberOfLines={1}>{item.venue}</Text>
                </View>
                 {/* Add booking info if desired (e.g., tickets sold/reservations) */}
                <View style={organizerCardStyles.cardActions}>
                    <TouchableOpacity style={organizerCardStyles.actionButton} onPress={() => handleEditPress(item.id)}>
                        <Feather name="edit-2" size={14} color={APP_CONSTANTS.COLORS.PRIMARY} />
                        <Text style={organizerCardStyles.actionButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={organizerCardStyles.actionButton} onPress={() => handleAnalyticsPress(item.id)}>
                        <Feather name="bar-chart-2" size={14} color={APP_CONSTANTS.COLORS.PRIMARY} />
                        <Text style={organizerCardStyles.actionButtonText}>Analytics</Text>
                    </TouchableOpacity>
                     <TouchableOpacity style={organizerCardStyles.actionButton} onPress={() => handleSharePress(item.id)}>
                        <Feather name="share-2" size={14} color={APP_CONSTANTS.COLORS.PRIMARY} />
                        <Text style={organizerCardStyles.actionButtonText}>Share</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );
};
// ---------------------------------------------

const UpcomingEventsListScreen: React.FC = () => {
    const navigation = useNavigation<UpcomingEventsListNavigationProp>();
    const route = useRoute<UpcomingEventsListRouteProp>();
    const { session } = useAuth();
    const { organizerUserId, organizerName } = route.params;

    // Check if the current logged-in user is the organizer being viewed (define early)
    const isOrganizerViewingOwnEvents = useMemo(() => session?.user?.id === organizerUserId, [session, organizerUserId]);

    const [events, setEvents] = useState<MappedEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Organizer info is passed, but we could re-fetch if needed
    // Memoize organizerInfoFromParams to stabilize its reference
    const organizerInfoFromParams = useMemo(() => ({
        userId: organizerUserId,
        name: organizerName ?? DEFAULT_ORGANIZER_NAME,
        image: null // We don't pass image via params, fetch if needed or rely on EventCard default
    }), [organizerUserId, organizerName]);

    const fetchUpcomingEvents = useCallback(async (refreshing = false) => {
        if (!organizerUserId) {
            setError("Organizer ID missing."); setIsLoading(false); setIsRefreshing(false); return;
        }
        if (!refreshing) setIsLoading(true); else setIsRefreshing(true);
        setError(null);
        console.log(`[UpcomingEventsListScreen] Fetching upcoming events for organizer: ${organizerUserId}...`);

        try {
            const now = new Date().toISOString();
            const { data: eventData, error: eventsError } = await supabase
                .from("events")
                .select(`
                    id, title, description, event_datetime, location_text, poster_urls,
                    tags_genres, tags_artists, tags_songs, organizer_id,
                    event_type, booking_type, ticket_price, pass_fee_to_user,
                    max_tickets, max_reservations
                `)
                .eq('organizer_id', organizerUserId)
                .gt('event_datetime', now)
                .order("event_datetime", { ascending: true });

            if (eventsError) throw eventsError;

            if (!eventData || eventData.length === 0) {
                setEvents([]);
                console.log("[UpcomingEventsListScreen] No upcoming events found for this organizer.");
                return;
            }

            // Map events, using the passed/default organizer info
            const mappedEvents: MappedEvent[] = eventData.map((event: SupabasePublicEvent) => {
                const { date, time } = formatEventDateTime(event.event_datetime);
                return {
                    id: event.id, title: event.title,
                    images: event.poster_urls?.length > 0 ? event.poster_urls : [DEFAULT_EVENT_IMAGE],
                    date: date, time: time,
                    venue: event.location_text ?? "N/A",
                    genres: event.tags_genres ?? [], artists: event.tags_artists ?? [], songs: event.tags_songs ?? [],
                    description: event.description ?? "No description.",
                    booking_type: event.booking_type,
                    ticket_price: event.ticket_price,
                    pass_fee_to_user: event.pass_fee_to_user ?? true,
                    max_tickets: event.max_tickets,
                    max_reservations: event.max_reservations,
                    organizer: organizerInfoFromParams, // Use consistent organizer info
                    isViewable: false, // isViewable might not be needed here
                };
            });

            console.log(`[UpcomingEventsListScreen] Fetched ${mappedEvents.length} upcoming events.`);
            setEvents(mappedEvents);

        } catch (err: any) {
            console.error("[UpcomingEventsListScreen] Error fetching events:", err);
            setError("Could not load upcoming events.");
            setEvents([]);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [organizerUserId, organizerInfoFromParams]);

    useFocusEffect(useCallback(() => { fetchUpcomingEvents(); }, [fetchUpcomingEvents]));

    const onRefresh = () => { fetchUpcomingEvents(true); };

    // Use effect to set header title (add isOrganizerViewingOwnEvents to dependencies)
    useEffect(() => {
        const screenTitle = isOrganizerViewingOwnEvents
            ? "My Upcoming Events"
            : `${organizerName ?? 'Organizer'}'s Upcoming Events`;
        navigation.setOptions({ title: screenTitle });
    }, [navigation, organizerName, isOrganizerViewingOwnEvents]);

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
                    onPress={() => handleEventPress(item)} // Use the correct handler
                    isViewable={true} // Or set based on flatlist viewability if needed
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
                    <Feather name="calendar" size={60} color={APP_CONSTANTS.COLORS.DISABLED} />
                    <Text style={styles.emptyText}>No Upcoming Events</Text>
                    <Text style={styles.emptySubText}>{organizerName ?? 'This organizer'} has no upcoming events listed.</Text>
                </ScrollView>
            );
        }
        return (
            <FlatList
                data={events}
                renderItem={renderEventItem}
                keyExtractor={(item) => item.id}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[APP_CONSTANTS.COLORS.PRIMARY]} tintColor={APP_CONSTANTS.COLORS.PRIMARY} />}
            />
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
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

// --- Styles (Adapted from list screens) ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    errorText: { color: APP_CONSTANTS.COLORS.ERROR, fontSize: 16, textAlign: 'center' },
    list: { flex: 1, },
    listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
    separator: { height: 20, }, // Add space between cards
    emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
    emptyText: { fontSize: 18, fontWeight: '600', color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, marginTop: 15, textAlign: 'center', },
    emptySubText: { fontSize: 14, color: APP_CONSTANTS.COLORS.DISABLED, marginTop: 8, textAlign: 'center', },
    // Removed placeholder style
});

// --- NEW: Organizer Card Styles (Similar to OrganizerPostsScreen) ---
const organizerCardStyles = StyleSheet.create({
     eventCard: { backgroundColor: "white", borderRadius: 12, overflow: "hidden", marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2, borderWidth: 1, borderColor: '#E5E7EB'},
     eventImage: { width: "100%", aspectRatio: 16 / 9, backgroundColor: '#F3F4F6', borderBottomWidth: 1, borderColor: '#E5E7EB' },
     eventContent: { padding: 16, },
     eventHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
     eventTitle: { fontSize: 17, fontWeight: "600", color: "#1F2937", flexShrink: 1, marginRight: 8 },
     eventInfoRow: { flexDirection: "row", alignItems: "center", marginBottom: 6, },
     eventInfoText: { fontSize: 13, color: "#6B7280", marginLeft: 8, },
     cardActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', },
     actionButton: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: 'rgba(59, 130, 246, 0.1)' },
     actionButtonText: { color: APP_CONSTANTS.COLORS.PRIMARY, fontWeight: "500", fontSize: 13, marginLeft: 5, },
});
// ---------------------------------------------------------

export default UpcomingEventsListScreen; 