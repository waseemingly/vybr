import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Image, ActivityIndicator, RefreshControl, ScrollView, Alert, Dimensions
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
type PastEventsListRouteProp = RouteProp<MainStackParamList, 'PastEventsListScreen'>;
type PastEventsListNavigationProp = NativeStackNavigationProp<RootStackParamList & MainStackParamList>;

const DEFAULT_EVENT_IMAGE = "https://via.placeholder.com/800x450/D1D5DB/1F2937?text=No+Image";
const DEFAULT_ORGANIZER_LOGO = APP_CONSTANTS.DEFAULT_ORGANIZER_LOGO;
const DEFAULT_ORGANIZER_NAME = "Event Organizer";

// --- NEW: Organizer-specific Event Item View ---
// Note: identical to the one in UpcomingEventsListScreen, candidate for extraction
const OrganizerEventItemView: React.FC<{ item: MappedEvent, navigation: PastEventsListNavigationProp }> = ({ item, navigation }) => {
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
            style={organizerCardStyles.eventCard}
            onPress={() => handleAnalyticsPress(item.id)} // Pressing card goes to analytics
        >
            <ImageSwiper
                images={item.images}
                defaultImage={DEFAULT_EVENT_IMAGE}
                containerStyle={organizerCardStyles.eventImageContainer}
                imageStyle={organizerCardStyles.eventImageStyle}
                height={organizerCardStyles.eventImageStyle.height}
            />
            <View style={organizerCardStyles.eventContent}>
                <View style={organizerCardStyles.eventHeader}>
                    <Text style={organizerCardStyles.eventTitle} numberOfLines={2}>{item.title}</Text>
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
                 {/* Add booking info if desired (e.g., final attendee count) */}
                <View style={organizerCardStyles.cardActions}>
                    <TouchableOpacity style={[organizerCardStyles.actionButton, { backgroundColor: '#F3F4F6' }]} onPress={() => handleEditPress(item.id)} disabled={true}>
                        <Feather name="edit-2" size={14} color={APP_CONSTANTS.COLORS.DISABLED} />
                        <Text style={[organizerCardStyles.actionButtonText, { color: APP_CONSTANTS.COLORS.DISABLED }]}>Edit</Text>
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

const PastEventsListScreen: React.FC = () => {
    const navigation = useNavigation<PastEventsListNavigationProp>();
    const route = useRoute<PastEventsListRouteProp>();
    const { session } = useAuth();
    const { organizerUserId, organizerName } = route.params;

    // Check if the current logged-in user is the organizer being viewed (define early)
    const isOrganizerViewingOwnEvents = useMemo(() => session?.user?.id === organizerUserId, [session, organizerUserId]);

    const [events, setEvents] = useState<MappedEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Organizer info is passed
    // Memoize organizerInfoFromParams to stabilize its reference
    const organizerInfoFromParams = useMemo(() => ({
        userId: organizerUserId,
        name: organizerName ?? DEFAULT_ORGANIZER_NAME,
        image: null
    }), [organizerUserId, organizerName]);

    const fetchPastEvents = useCallback(async (refreshing = false) => {
        if (!organizerUserId) {
            setError("Organizer ID missing."); setIsLoading(false); setIsRefreshing(false); return;
        }
        if (!refreshing) setIsLoading(true); else setIsRefreshing(true);
        setError(null);
        console.log(`[PastEventsListScreen] Fetching past events for organizer: ${organizerUserId}...`);

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
                .lte('event_datetime', now) // Filter for past or ongoing events
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
                    genres: event.tags_genres ?? [], artists: event.tags_artists ?? [], songs: event.tags_songs ?? [],
                    description: event.description ?? "No description.",
                    booking_type: event.booking_type,
                    ticket_price: event.ticket_price,
                    pass_fee_to_user: event.pass_fee_to_user ?? true,
                    max_tickets: event.max_tickets,
                    max_reservations: event.max_reservations,
                    organizer: organizerInfoFromParams,
                    isViewable: false,
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
    }, [organizerUserId, organizerInfoFromParams]);

    useFocusEffect(useCallback(() => { fetchPastEvents(); }, [fetchPastEvents]));

    const onRefresh = () => { fetchPastEvents(true); };

    // Use effect to set header title (add isOrganizerViewingOwnEvents to dependencies)
    useEffect(() => {
        const screenTitle = isOrganizerViewingOwnEvents
            ? "My Past Events"
            : `${organizerName ?? 'Organizer'}'s Past Events`;
        navigation.setOptions({ 
            title: screenTitle, 
            headerBackVisible: true,
        });
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
                    isViewable={true} // isViewable doesn't really apply here
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

// --- Styles (Same as UpcomingEventsListScreen) ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
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

// --- NEW: Organizer Card Styles (Identical to Upcoming screen, maybe extract?) ---
const organizerCardStyles = StyleSheet.create({
     eventCard: { backgroundColor: "white", borderRadius: 12, overflow: "hidden", marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2, borderWidth: 1, borderColor: '#E5E7EB'},
     eventImage: { width: "100%", aspectRatio: 16 / 9, backgroundColor: '#F3F4F6', borderBottomWidth: 1, borderColor: '#E5E7EB' },
     eventImageStyle: {
        height: (Dimensions.get('window').width - 32) * (9 / 16),
     },
     eventImageContainer: {
        width: "100%",
        aspectRatio: 16 / 9,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        backgroundColor: '#F3F4F6',
        borderBottomWidth: 1,
        borderColor: '#E5E7EB',
     },
     eventContent: { padding: 16, },
     eventHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
     eventTitle: { fontSize: 17, fontWeight: "600", color: "#1F2937", flexShrink: 1, marginRight: 8 },
     statusBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 12, marginLeft: 8, },
     statusText: { fontSize: 11, fontWeight: "600" },
     eventInfoRow: { flexDirection: "row", alignItems: "center", marginBottom: 6, },
     eventInfoText: { fontSize: 13, color: "#6B7280", marginLeft: 8, },
     cardActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', },
     actionButton: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: 'rgba(59, 130, 246, 0.1)' },
     actionButtonText: { color: APP_CONSTANTS.COLORS.PRIMARY, fontWeight: "500", fontSize: 13, marginLeft: 5, },
});
// ---------------------------------------------------------

export default PastEventsListScreen; 