// src/screens/user/EventsScreen.tsx (Example Path)
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ScrollView, Modal,
  Dimensions, ActivityIndicator, RefreshControl, Alert, GestureResponderEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

// --- !!! ADJUST PATHS !!! ---
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth"; // Assuming useAuth provides session
// ---------------------------

// Define navigation stack parameters
type RootStackParamList = {
  Events: undefined;
  BookingScreen: { eventId: string }; // Example target screen after booking
  Profile: undefined;
  AuthFlow: undefined; // For login prompt
};
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Interface matching the Supabase 'events' table structure + booking fields
interface SupabasePublicEvent {
  id: string; title: string; description: string | null; event_datetime: string;
  location_text: string | null; poster_urls: string[]; tags_genres: string[]; tags_artists: string[];
  organizer_id: string; // Keep in case needed later
  event_type: string | null; // Raw ENUM string from DB
  booking_type: 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null;
  ticket_price: number | null; pass_fee_to_user: boolean | null; // Default true handled in mapping
  max_tickets: number | null; max_reservations: number | null;
}

// Interface for data mapped specifically for the EventsScreen UI
interface MappedEvent {
  id: string; title: string; images: string[]; date: string; venue: string;
  genres: string[]; artists: string[]; description: string;
  booking_type: 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null;
  ticket_price: number | null; // Base price
  pass_fee_to_user: boolean; // Fee rule
  max_tickets: number | null; max_reservations: number | null; // Needed for availability check
  // Using default organizer info as join caused issues
  organizer: { name: string; image: string; };
}

// --- Constants and Helpers ---
const DEFAULT_EVENT_IMAGE = "https://via.placeholder.com/800x450/D1D5DB/1F2937?text=No+Image";
const DEFAULT_ORGANIZER_LOGO = "https://via.placeholder.com/150/BFDBFE/1E40AF?text=Logo";
const DEFAULT_ORGANIZER_NAME = "Event Organizer";
const TRANSACTION_FEE = 0.50; // The fee amount

// Formats date string for display
const formatEventDateTime = (isoString: string | null): string => { if(!isoString)return "N/A"; try{const d=new Date(isoString);return d.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'long',year:'numeric'})+" • "+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',hour12:true});}catch(e){return "Invalid Date";}};

// Calculates the final display price including the fee if applicable
const calculateDisplayPrice = (basePrice: number | null, passFee: boolean): string => {
    if (basePrice === null || basePrice < 0) return "Price N/A"; // Should not happen with schema
    if (basePrice === 0) return "Free";
    const finalPrice = passFee ? basePrice + TRANSACTION_FEE : basePrice;
    return `$${finalPrice.toFixed(2)}`;
};
// --- End Helpers ---


// --- Event Detail Modal Component ---
interface EventDetailModalProps { event: MappedEvent | null; visible: boolean; onClose: () => void; onBookNow: (event: MappedEvent) => void; isBooking: boolean; }
const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, visible, onClose, onBookNow, isBooking }) => {
  if (!event) return null;

  let buttonText = "View Details"; let buttonIcon: React.ComponentProps<typeof Feather>['name'] = "info"; let canBookOrReserve = false;
  const displayPrice = calculateDisplayPrice(event.ticket_price, event.pass_fee_to_user);

  if (event.booking_type === 'TICKETED') { buttonIcon = "tag"; canBookOrReserve = true; buttonText = `Get Ticket (${displayPrice})`; if (event.pass_fee_to_user && event.ticket_price && event.ticket_price > 0) buttonText += " Incl. Fee"; }
  else if (event.booking_type === 'RESERVATION') { buttonText = "Make Reservation"; buttonIcon = "bookmark"; canBookOrReserve = true; }

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalContainer}><View style={styles.modalContent}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}><Feather name="x" size={24} color="#6B7280" /></TouchableOpacity>
        <ScrollView showsVerticalScrollIndicator={false}>
            <Image source={{ uri: event.images[0] ?? DEFAULT_EVENT_IMAGE }} style={styles.modalImage} resizeMode="cover"/>
            <View style={styles.modalBody}>
                <Text style={styles.modalTitle}>{event.title}</Text>
                <View style={styles.organizerRow}><View style={styles.organizerInfo}><Image source={{ uri: event.organizer.image }} style={styles.organizerImage} /><View><Text style={styles.organizerName}>{event.organizer.name}</Text><Text style={styles.organizerLabel}>Organizer</Text></View></View><TouchableOpacity style={styles.followButton} onPress={()=>Alert.alert("Follow")}><Feather name="heart" size={14} color="#3B82F6" /><Text style={styles.followButtonText}>Follow</Text></TouchableOpacity></View>
                {event.genres.length > 0 && (<View style={styles.genreContainer}>{event.genres.map((g, i) => (<View key={i} style={styles.genreBadge}><Text style={styles.genreText}>{g}</Text></View>))}</View>)}
                <View style={styles.eventInfoRow}><Feather name="clock" size={16} color="#6B7280" /><Text style={styles.eventInfoText}>{event.date}</Text></View>
                <View style={styles.eventInfoRow}><Feather name="map-pin" size={16} color="#6B7280" /><Text style={styles.eventInfoText}>{event.venue}</Text></View>
                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>About</Text><Text style={styles.descriptionText}>{event.description}</Text>
                {event.artists.length > 0 && (<><View style={styles.divider} /><Text style={styles.sectionTitle}>Artists</Text>{event.artists.map((a, i) => (<View key={i} style={styles.artistRow}><Feather name="music" size={18} color="#3B82F6" /><Text style={styles.artistName}>{a}</Text></View>))}</>)}
                {canBookOrReserve && (<TouchableOpacity style={[styles.bookNowButton, isBooking && styles.disabledButton]} onPress={() => onBookNow(event)} disabled={isBooking}>{isBooking ? <ActivityIndicator color="#fff" size="small"/> : <Feather name={buttonIcon} size={18} color="#fff" />}<Text style={styles.bookNowButtonText}>{isBooking ? 'Processing...' : buttonText}</Text></TouchableOpacity>)}
            </View>
        </ScrollView>
      </View></View>
    </Modal>
  );
};
// --- End Event Detail Modal ---

// --- Event Card Component ---
interface EventCardProps { event: MappedEvent; onPress: () => void; onBookPress: (event: MappedEvent) => void; }
const EventCard: React.FC<EventCardProps> = ({ event, onPress, onBookPress }) => {
  let buttonText = "View"; let buttonIcon: React.ComponentProps<typeof Feather>['name'] = "info"; let canBook = false; let priceText = "Info Only";
  if(event.booking_type === 'TICKETED') { buttonText = "Get Tickets"; buttonIcon = "tag"; canBook=true; priceText = calculateDisplayPrice(event.ticket_price, event.pass_fee_to_user); }
  else if(event.booking_type === 'RESERVATION') { buttonText = "Reserve"; buttonIcon = "bookmark"; canBook=true; priceText="Reservations";}

  const handleBookPressOnCard = (e: GestureResponderEvent) => { e.stopPropagation(); if(canBook) onBookPress(event); else onPress(); }; // Pass full event

  return (
    <TouchableOpacity style={styles.eventCard} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.imageContainer}><Image source={{ uri: event.images[0] ?? DEFAULT_EVENT_IMAGE }} style={styles.eventImage} /></View>
      <View style={styles.cardContent}>
        <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
        {event.genres.length > 0 && (<View style={styles.genreContainer}>{event.genres.slice(0,3).map((g, i) => (<View key={i} style={styles.genreBadge}><Text style={styles.genreText}>{g}</Text></View>))}{event.genres.length > 3 && <Text style={styles.genreText}>...</Text>}</View>)}
        <View style={styles.eventInfoRow}><Feather name="clock" size={14} color="#6B7280" /><Text style={styles.eventInfoText} numberOfLines={1}>{event.date}</Text></View>
        <View style={styles.eventInfoRow}><Feather name="map-pin" size={14} color="#6B7280" /><Text style={styles.eventInfoText} numberOfLines={1}>{event.venue}</Text></View>
        <View style={styles.cardFooter}>
            <Text style={styles.priceText}>{priceText}</Text>
            <TouchableOpacity style={styles.bookButton} onPress={handleBookPressOnCard} disabled={!canBook && event.booking_type !== 'INFO_ONLY'} >
                <Feather name={buttonIcon} size={14} color="#fff" />
                <Text style={styles.bookButtonText}>{buttonText}</Text>
            </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};
// --- End Event Card Component ---


// --- Main Events Screen ---
const EventsScreen: React.FC = () => {
  const { session } = useAuth();
  const [events, setEvents] = useState<MappedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<MappedEvent | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isBooking, setIsBooking] = useState(false); // Booking loading state
  const navigation = useNavigation<NavigationProp>();

  // Fetch upcoming events, including booking/price fields
  const fetchEvents = useCallback(async () => {
    console.log("Fetching public upcoming events...");
    if (!refreshing) setIsLoading(true); setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("events")
        .select(`id, title, description, event_datetime, location_text, poster_urls, tags_genres, tags_artists, organizer_id, event_type, booking_type, ticket_price, pass_fee_to_user, max_tickets, max_reservations`) // Select all needed fields
        .gt('event_datetime', new Date().toISOString())
        .order("event_datetime", { ascending: true });
      if (fetchError) throw fetchError;

      const mappedEvents: MappedEvent[] = (data || []).map((event: any) => ({ // Use 'any' or define Supabase select type
            id: event.id, title: event.title,
            images: event.poster_urls?.length > 0 ? event.poster_urls : [DEFAULT_EVENT_IMAGE],
            date: formatEventDateTime(event.event_datetime), venue: event.location_text ?? "N/A",
            genres: event.tags_genres ?? [], artists: event.tags_artists ?? [],
            description: event.description ?? "No description.",
            booking_type: event.booking_type, ticket_price: event.ticket_price,
            pass_fee_to_user: event.pass_fee_to_user ?? true,
            max_tickets: event.max_tickets, max_reservations: event.max_reservations,
            organizer: { name: DEFAULT_ORGANIZER_NAME, image: DEFAULT_ORGANIZER_LOGO }, // Use defaults
          })
        );
      setEvents(mappedEvents);
    } catch (err: any) { console.error("Fetch Events Error:", err); setError(`Failed to fetch events. Please try again.`); setEvents([]); }
    finally { setIsLoading(false); setRefreshing(false); }
  }, [refreshing]);

  useFocusEffect(useCallback(() => { fetchEvents(); }, [fetchEvents]));
  const onRefresh = useCallback(() => { setRefreshing(true); }, []);

  // Booking/Reservation Handler
  const handleBookNow = async (event: MappedEvent) => { // Accept full event object
    if (!session?.user) { Alert.alert("Login Required", "Please log in to get tickets or make reservations.", [{ text: "OK", onPress: () => navigation.navigate('AuthFlow') }]); return; } // Redirect to login
    if (isBooking) return; // Prevent double clicks

    const { id: eventId, booking_type, max_tickets, max_reservations } = event;
    const actionTextLower = booking_type === 'TICKETED' ? 'ticket' : 'reservation';
    const actionTextProper = booking_type === 'TICKETED' ? 'Ticket' : 'Reservation';

    setIsBooking(true);
    try {
        console.log(`Attempting ${actionTextLower} for event ${eventId}, user ${session.user.id}`);

        // --- Availability Check (IMPORTANT FOR PRODUCTION - UNCOMMENT AND TEST) ---
        /*
        const { count, error: countError } = await supabase
            .from('event_bookings')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', eventId);

        if (countError) {
            console.error("Availability check error:", countError);
            throw new Error("Could not check event availability. Please try again.");
        }

        const currentBookings = count ?? 0;

        if (booking_type === 'TICKETED') {
            // Treat max_tickets = 0 as explicitly unavailable, NULL might mean error or truly unlimited (depends on creation logic)
            if (max_tickets === 0) {
                 throw new Error("Sorry, tickets for this event are not available.");
            }
            // Only check limit if it's a positive number (treat 0 as no limit for simplicity here, adjust if 0 means 0)
            if (max_tickets !== null && max_tickets > 0 && currentBookings >= max_tickets) {
                 throw new Error("Sorry, tickets for this event are sold out.");
            }
        } else if (booking_type === 'RESERVATION') {
             if (max_reservations === 0) {
                 throw new Error("Sorry, reservations for this event are not available.");
            }
            if (max_reservations !== null && max_reservations > 0 && currentBookings >= max_reservations) {
                throw new Error("Sorry, reservations for this event are full.");
            }
        }
        */
        // --- End Availability Check ---

        // Insert the booking record
        const { error: bookingError } = await supabase
            .from('event_bookings')
            .insert({ event_id: eventId, user_id: session.user.id }); // Basic insert

        if (bookingError) {
            if (bookingError.code === '23505') Alert.alert("Already Registered", `You already have a ${actionTextLower} for this event.`);
            else throw bookingError; // Throw other DB errors
        } else {
            Alert.alert(`${actionTextProper} Successful!`, `Your ${actionTextLower} is confirmed!`);
            handleCloseModal();
            // Optional navigation: navigation.navigate('BookingScreen', { eventId });
        }
    } catch (error: any) {
        Alert.alert(`${actionTextProper} Failed`, `Could not complete: ${error.message}`);
    } finally { setIsBooking(false); }
};

  // Modal control
  const handleEventPress = (event: MappedEvent) => { setSelectedEvent(event); setModalVisible(true); };
  const handleCloseModal = () => { setModalVisible(false); setSelectedEvent(null); };

  // Main render logic
  const renderContent = () => { /* ... keep implementation ... */ if (isLoading && !refreshing && events.length === 0) return <View style={styles.centeredContainer}><ActivityIndicator size="large" color="#3B82F6" /></View>; if (error) return ( <View style={styles.centeredContainer}><Feather name="alert-triangle" size={40} color="#F87171" /><Text style={styles.errorText}>{error}</Text>{!isLoading && (<TouchableOpacity onPress={fetchEvents} style={styles.retryButton}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity>)}</View>); if (!isLoading && !refreshing && events.length === 0) return ( <View style={styles.centeredContainer}><Feather name="coffee" size={40} color="#9CA3AF" /><Text style={styles.emptyText}>No Upcoming Events</Text><Text style={styles.emptySubText}>Check back later or refresh!</Text></View>); return ( <FlatList data={events} keyExtractor={(item) => item.id} renderItem={({ item }) => (<EventCard event={item} onPress={() => handleEventPress(item)} onBookPress={handleBookNow} />)} contentContainerStyle={styles.eventsList} style={styles.flatListContainer} refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3B82F6"]} /> }/>);};

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <View style={styles.rootContainer}>
        <View style={styles.header}><View style={styles.headerTitleRow}><View style={styles.titleContainer}><Feather name="calendar" size={22} color="#60A5FA" style={styles.headerIcon} /><Text style={styles.title}>Upcoming Events</Text></View></View><Text style={styles.subtitle}>Discover concerts and music events</Text></View>
        {renderContent()}
      </View>
      <EventDetailModal event={selectedEvent} visible={modalVisible} onClose={handleCloseModal} onBookNow={handleBookNow} isBooking={isBooking} />
      {isBooking && ( <View style={styles.bookingOverlay}><ActivityIndicator size="large" color="#FFFFFF" /><Text style={styles.bookingText}>Processing...</Text></View> )}
    </SafeAreaView>
  );
};

// --- Styles --- (Keep as before)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f8fafc", },
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f8fafc', },
    errorText: { fontSize: 16, fontWeight: '600', color: '#DC2626', marginTop: 10, textAlign: 'center', },
    retryButton: { backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginTop: 15, },
    retryButtonText: { color: '#FFF', fontWeight: '600', },
    emptyText: { fontSize: 18, fontWeight: '600', color: '#4B5563', marginTop: 10, },
    emptySubText: { fontSize: 14, color: '#6B7280', marginTop: 5, textAlign: 'center', },
    rootContainer: { flex: 1, },
    flatListContainer: { flex: 1, },
    header: { paddingTop: 16, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: '#E5E7EB', },
    headerTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, },
    titleContainer: { flexDirection: "row", alignItems: "center", },
    headerIcon: { marginRight: 8, },
    title: { fontSize: 22, fontWeight: "bold", color: "#3B82F6", },
    subtitle: { fontSize: 14, color: "#6B7280", marginTop: 4, },
    eventsList: { padding: 16, paddingBottom: 80, },
    eventCard: { backgroundColor: "white", borderRadius: 12, overflow: "hidden", marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 3, },
    imageContainer: { position: "relative", },
    eventImage: { width: "100%", aspectRatio: 16 / 9, backgroundColor: '#F3F4F6', },
    cardContent: { padding: 16, },
    eventTitle: { fontSize: 18, fontWeight: "700", color: "#1F2937", marginBottom: 10, },
    genreContainer: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12, },
    genreBadge: { backgroundColor: "rgba(59, 130, 246, 0.1)", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, marginRight: 8, marginBottom: 8, },
    genreText: { fontSize: 12, color: "#1E3A8A", fontWeight: '500', },
    eventInfoRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, },
    eventInfoText: { fontSize: 14, color: "#6B7280", marginLeft: 8, flexShrink: 1, },
    cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12, },
    priceText: { fontSize: 16, fontWeight: "700", color: "#3B82F6", flexShrink: 1, marginRight: 5 },
    bookButton: { backgroundColor: "#3B82F6", flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 50, },
    bookButtonText: { color: "white", fontWeight: "600", fontSize: 14, marginLeft: 6, },
    // Modal Styles
    modalContainer: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.6)", justifyContent: "flex-end", },
    modalContent: { backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, height: "90%", overflow: "hidden", },
    closeButton: { position: "absolute", top: 20, left: 16, zIndex: 10, backgroundColor: "rgba(230, 230, 230, 0.8)", borderRadius: 50, padding: 8, },
    modalImage: { width: "100%", height: 250, backgroundColor: '#F3F4F6', },
    modalBody: { padding: 20, paddingBottom: 40 },
    modalTitle: { fontSize: 24, fontWeight: "bold", color: "#1F2937", marginBottom: 16, },
    organizerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, },
    organizerInfo: { flexDirection: "row", alignItems: "center", flexShrink: 1, marginRight: 10 },
    organizerImage: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: '#E5E7EB', },
    organizerName: { fontSize: 15, fontWeight: "600", color: "#1F2937", flexShrink: 1 },
    organizerLabel: { fontSize: 13, color: "#6B7280", },
    followButton: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 50, backgroundColor: "rgba(59, 130, 246, 0.1)", },
    followButtonText: { fontSize: 14, fontWeight: "500", color: "#3B82F6", marginLeft: 6, },
    divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 20, },
    sectionTitle: { fontSize: 18, fontWeight: "600", color: "#1F2937", marginBottom: 12, },
    descriptionText: { fontSize: 15, lineHeight: 24, color: "#4B5563", },
    artistRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, },
    artistName: { fontSize: 15, color: "#374151", marginLeft: 10, },
    bookNowButton: { backgroundColor: "#3B82F6", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, marginTop: 24, marginBottom: 24, },
    bookNowButtonText: { color: "white", fontWeight: "600", fontSize: 16, marginLeft: 8, },
     bookingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 1000, },
    bookingText: { marginTop: 10, color: '#FFFFFF', fontSize: 16, fontWeight: '600', },
    disabledButton: { backgroundColor: '#9CA3AF' },
});

export default EventsScreen;