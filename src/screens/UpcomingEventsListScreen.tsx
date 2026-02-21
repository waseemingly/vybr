import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Image, ActivityIndicator, RefreshControl, ScrollView, Alert, Dimensions,
    Share, Modal, Platform
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
import ImageSwiper from '@/components/ImageSwiper';

// Define Navigation and Route Types
// type UpcomingEventsListRouteProp = RouteProp<MainStackParamList, 'UpcomingEventsListScreen'>;

// Corrected Route Prop Type to include organizerId and organizerName
type UpcomingEventsListRouteProp = RouteProp<MainStackParamList & { UpcomingEventsListScreen: { organizerId: string; organizerName?: string } }, 'UpcomingEventsListScreen'>;

type UpcomingEventsListNavigationProp = NativeStackNavigationProp<RootStackParamList & MainStackParamList>;

const DEFAULT_EVENT_IMAGE = "https://via.placeholder.com/800x450/D1D5DB/1F2937?text=No+Image";
// const DEFAULT_ORGANIZER_LOGO = APP_CONSTANTS.DEFAULT_ORGANIZER_LOGO;
const DEFAULT_ORGANIZER_LOGO = "https://via.placeholder.com/150/BFDBFE/1E40AF?text=Logo"; // Using a fallback
const DEFAULT_ORGANIZER_NAME = "Event Organizer";

// Add web constants after imports
const CARDS_PER_ROW_WEB = 4;
const CARD_MARGIN_WEB = 16;

// --- NEW: Organizer-specific Event Item View ---
const OrganizerEventItemView: React.FC<{ item: MappedEvent, navigation: UpcomingEventsListNavigationProp }> = ({ item, navigation }) => {
    const [shareModalVisible, setShareModalVisible] = useState(false);
    
    // Calculate card dimensions like OrganizerPostsScreen
    const cardWidth = Platform.OS === 'web'
        ? (Dimensions.get('window').width - organizerCardStyles.postsList.paddingHorizontal! * 2 - CARD_MARGIN_WEB * (CARDS_PER_ROW_WEB - 1)) / CARDS_PER_ROW_WEB
        : Dimensions.get('window').width - organizerCardStyles.postsList.paddingHorizontal! * 2;
    const imageDimension = cardWidth; // Square 1:1 aspect ratio
    
    const handleEditPress = (eventId: string) => {
        navigation.navigate("EditEvent", { eventId });
    };
    const handleAnalyticsPress = (eventId: string) => {
        // Navigate to the Organizer EventDetail screen, not the user-facing one
        navigation.navigate("EventDetail", { eventId });
    };

    const handleSharePress = (event: MappedEvent) => {
        setShareModalVisible(true);
    };

    const handleExternalShare = async () => {
        try {
            const result = await Share.share({
                message: `Check out this event: ${item.title} on ${item.date} at ${item.venue}. Find out more on Vybr!`,
                title: `Vybr Event: ${item.title}`
            });
            
            if (result.action === Share.sharedAction) {
                console.log('Shared with activity type:', result.activityType || 'Unknown');
            } else if (result.action === Share.dismissedAction) {
                console.log('Share dismissed');
            }
        } catch (error: any) {
            Alert.alert("Error", error.message);
        }
        setShareModalVisible(false);
    };

    const handleNavigateToShareWithChat = () => {
        setShareModalVisible(false);
        navigation.navigate('ShareEventScreen' as any, {
            eventId: item.id,
            eventTitle: item.title,
            eventDate: item.date,
            eventVenue: item.venue,
            eventImage: item.images?.[0] || DEFAULT_EVENT_IMAGE
        });
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
                <Text style={organizerCardStyles.postTitle} numberOfLines={2}>{item.title}</Text>
                <View style={organizerCardStyles.eventInfoRow}>
                    <Feather name="calendar" size={14} color="#6B7280" />
                    <Text style={organizerCardStyles.eventInfoText} numberOfLines={2}>{item.date}{'\n'}{item.time}</Text>
                </View>
                <View style={organizerCardStyles.eventInfoRow}>
                    <Feather name="map-pin" size={14} color="#6B7280" />
                    <Text style={organizerCardStyles.eventInfoText} numberOfLines={2}>{item.venue}</Text>
                </View>
                <View style={organizerCardStyles.cardActions}>
                    <TouchableOpacity style={organizerCardStyles.actionButton} onPress={(e) => { e.stopPropagation(); handleEditPress(item.id); }}>
                        <Feather name="edit-2" size={14} color={APP_CONSTANTS.COLORS.PRIMARY} />
                        <Text style={organizerCardStyles.actionButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={organizerCardStyles.actionButton} onPress={(e) => { e.stopPropagation(); handleAnalyticsPress(item.id); }}>
                        <Feather name="bar-chart-2" size={14} color={APP_CONSTANTS.COLORS.PRIMARY} />
                        <Text style={organizerCardStyles.actionButtonText}>Analytics</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={organizerCardStyles.actionButton} onPress={(e) => { e.stopPropagation(); handleSharePress(item); }}>
                        <Feather name="share-2" size={14} color={APP_CONSTANTS.COLORS.PRIMARY} />
                        <Text style={organizerCardStyles.actionButtonText}>Share</Text>
                    </TouchableOpacity>
                </View>
            </View>
            
            {/* Share Options Modal */}
            <Modal
                visible={shareModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShareModalVisible(false)}
            >
                <TouchableOpacity 
                    style={styles.shareModalOverlay}
                    activeOpacity={1}
                    onPress={() => setShareModalVisible(false)}
                >
                    <View style={styles.shareModalContent}>
                        <Text style={styles.shareModalTitle}>Share Event</Text>
                        
                        <TouchableOpacity 
                            style={styles.shareOption}
                            onPress={handleNavigateToShareWithChat}
                        >
                            <Feather name="message-circle" size={24} color="#3B82F6" />
                            <Text style={styles.shareOptionText}>Share to Chats</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={styles.shareOption}
                            onPress={handleExternalShare}
                        >
                            <Feather name="external-link" size={24} color="#10B981" />
                            <Text style={styles.shareOptionText}>Share to External Apps</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            style={[styles.shareOption, styles.cancelShareOption]}
                            onPress={() => setShareModalVisible(false)}
                        >
                            <Text style={styles.cancelShareText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </TouchableOpacity>
    );
};
// ---------------------------------------------

const UpcomingEventsListScreen: React.FC = () => {
    const navigation = useNavigation<UpcomingEventsListNavigationProp>();
    const route = useRoute<UpcomingEventsListRouteProp>();
    const { session } = useAuth();
    const { organizerId, organizerName } = route.params;

    // Check if the current logged-in user is the organizer being viewed (define early)
    const isOrganizerViewingOwnEvents = useMemo(() => session?.user?.id === organizerId, [session, organizerId]);

    const [events, setEvents] = useState<MappedEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Organizer info is passed, but we could re-fetch if needed
    // Memoize organizerInfoFromParams to stabilize its reference
    const organizerInfoFromParams = useMemo(() => ({
        userId: organizerId,
        name: organizerName ?? DEFAULT_ORGANIZER_NAME,
        image: null // We don't pass image via params, fetch if needed or rely on EventCard default
    }), [organizerId, organizerName]);

    const fetchUpcomingEvents = useCallback(async (refreshing = false) => {
        if (!organizerId) {
            setError("Organizer ID missing."); setIsLoading(false); setIsRefreshing(false); return;
        }
        if (!refreshing) setIsLoading(true); else setIsRefreshing(true);
        setError(null);
        console.log(`[UpcomingEventsListScreen] Fetching upcoming events for organizer: ${organizerId}...`);

        try {
            const now = new Date().toISOString();
            console.log(`[UpcomingEventsListScreen] Filtering for events after: ${now}`);
            const { data: eventData, error: eventsError } = await supabase
                .from("events")
                .select(`
                    id, title, description, event_datetime, location_text, poster_urls,
                    tags_genres, tags_artists, tags_songs, organizer_id,
                    event_type, booking_type, ticket_price, pass_fee_to_user,
                    max_tickets, max_reservations, country, state, city
                `)
                .eq('organizer_id', organizerId)
                .gt('event_datetime', now)
                .neq('booking_type', 'RESERVATION')
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
                    country: event.country,
                    city: event.city,
                    genres: event.tags_genres ?? [], artists: event.tags_artists ?? [], songs: event.tags_songs ?? [],
                    description: event.description ?? "No description.",
                    booking_type: event.booking_type,
                    ticket_price: event.ticket_price,
                    pass_fee_to_user: event.pass_fee_to_user ?? true,
                    max_tickets: event.max_tickets,
                    max_reservations: event.max_reservations,
                    organizer: organizerInfoFromParams, // Use consistent organizer info
                    isViewable: false, // isViewable might not be needed here
                    event_datetime_iso: event.event_datetime // Added missing property
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
    }, [organizerId, organizerInfoFromParams]);

    useFocusEffect(useCallback(() => { fetchUpcomingEvents(); }, [fetchUpcomingEvents]));

    const onRefresh = () => { fetchUpcomingEvents(true); };

    // Get screen title
    const screenTitle = isOrganizerViewingOwnEvents
        ? "My Upcoming Events"
        : `${organizerName ?? 'Organizer'}'s Upcoming Events`;

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
                contentContainerStyle={organizerCardStyles.postsList}
                ItemSeparatorComponent={null} // Remove separator for grid layout
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[APP_CONSTANTS.COLORS.PRIMARY]} tintColor={APP_CONSTANTS.COLORS.PRIMARY} />}
            />
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
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

// --- Styles (Adapted from list screens) ---
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
    separator: { height: 20, }, // Add space between cards
    emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
    emptyText: { fontSize: 18, fontWeight: '600', color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, marginTop: 15, textAlign: 'center', },
    emptySubText: { fontSize: 14, color: APP_CONSTANTS.COLORS.DISABLED, marginTop: 8, textAlign: 'center', },
    // Removed placeholder style
    shareModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    shareModalContent: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        width: '80%',
        maxWidth: 400,
    },
    shareModalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 16,
        textAlign: 'center',
    },
    shareOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    shareOptionText: {
        fontSize: 16,
        marginLeft: 12,
        color: '#4B5563',
    },
    cancelShareOption: {
        justifyContent: 'center',
        borderBottomWidth: 0,
        marginTop: 8,
    },
    cancelShareText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: '500',
    }
});

// --- NEW: Updated Organizer Card Styles (Based on OrganizerPostsScreen) ---
const organizerCardStyles = StyleSheet.create({
    postsList: {
        paddingHorizontal: Platform.OS === 'web' ? 0 : 16,
        paddingTop: 20,
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
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
        ...(Platform.OS === 'web' ? {} : { width: '100%' })
    },
    postCardWeb: {
        marginHorizontal: CARD_MARGIN_WEB / 2,
        marginBottom: CARD_MARGIN_WEB,
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
    cardContent: { padding: 18 },
    postTitle: { fontSize: 17, fontWeight: "700", color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, marginBottom: 10, lineHeight: 22 },
    eventInfoRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10, minHeight: 20 },
    eventInfoText: { fontSize: 14, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, marginLeft: 8, flexShrink: 1, flex: 1, lineHeight: 20 },
    cardActions: { flexDirection: "row", justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: APP_CONSTANTS.COLORS.BORDER_LIGHT ||'#F3F4F6', paddingTop: 14, marginTop: 14 },
    actionButton: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingHorizontal: 8 },
    actionButtonText: { color: APP_CONSTANTS.COLORS.PRIMARY, fontWeight: "500", fontSize: 14, marginLeft: 6 },
});
// ---------------------------------------------------------

export default UpcomingEventsListScreen; 