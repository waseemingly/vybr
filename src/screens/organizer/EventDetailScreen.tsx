// src/screens/organizer/EventDetailScreen.tsx (Example Path)
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Dimensions,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

// --- !!! ADJUST PATH !!! ---
import { supabase } from "../../lib/supabase";
// ---------------------------

type RootStackParamList = {
  OrganizerPosts: undefined;
  EventDetail: { eventId: string };
  EditEvent: { eventId: string };
  PromoteEvent: { eventId: string };
  ViewBookings: { eventId: string; eventTitle: string }; // Screen to view list of attendees
};
type EventDetailScreenRouteProp = RouteProp<RootStackParamList, 'EventDetail'>;
type EventDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EventDetail'>;

// Raw data from 'events' table including new fields
interface SupabaseEventDetailData {
  id: string; organizer_id: string; title: string; description: string | null;
  event_datetime: string; location_text: string | null; poster_urls: string[];
  tags_genres: string[]; tags_artists: string[]; tags_songs: string[];
  created_at: string; updated_at: string;
  event_type: string | null; // Raw ENUM value
  booking_type: 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null;
  max_tickets: number | null; max_reservations: number | null;
  ticket_price: number | null; pass_fee_to_user: boolean | null;
}

// Mapped data for UI
interface MappedEventDetail {
  id: string; title: string; description: string; date: string; time: string;
  venue: string; image: string; artists: string[]; genres: string[];
  status: "Upcoming" | "Completed" | "Ongoing";
  event_type: string | null; // Store the raw type string
  booking_type: 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null;
  max_tickets: number | null; max_reservations: number | null;
  ticket_price: number | null; pass_fee_to_user: boolean;
  bookingsCount: number | null; // Fetched booking count
  analyticsPlaceholder: boolean; // Keep as placeholder
}

const DEFAULT_EVENT_IMAGE = "https://via.placeholder.com/800x450/D1D5DB/1F2937?text=No+Image";
const formatDateTime = (isoString: string | null): { date: string; time: string } => { if(!isoString)return{date:"N/A",time:"N/A"};try{const d=new Date(isoString);const dt=d.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});const tm=d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',hour12:true});return{date:dt,time:tm};}catch(e){return{date:"Invalid",time:""};}};
const getEventStatus = (isoString: string | null): "Upcoming" | "Completed" | "Ongoing" => { if(!isoString)return "Upcoming";try{return new Date(isoString)>new Date()?"Upcoming":"Completed";}catch(e){return "Upcoming";}};
const formatEventType = (type: string | null): string => { if (!type) return "Unknown"; return type.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '); };

interface SectionProps { title: string; children: React.ReactNode; }
const Section: React.FC<SectionProps> = ({ title, children }) => ( <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View> );

const EventDetailScreen = () => {
  const navigation = useNavigation<EventDetailScreenNavigationProp>();
  const route = useRoute<EventDetailScreenRouteProp>();
  const { eventId } = route.params;

  const [event, setEvent] = useState<MappedEventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch event details AND booking count
  const fetchEventData = useCallback(async () => {
    if (!eventId) { setError("Event ID missing."); setIsLoading(false); setRefreshing(false); return; }
    if (!refreshing) setIsLoading(true); setError(null);

    try {
        const [eventDetailsResult, bookingCountResult] = await Promise.all([
            supabase.from("events").select("*").eq("id", eventId).maybeSingle(),
            supabase.from("event_bookings").select('*', { count: 'exact', head: true }).eq("event_id", eventId)
        ]);

        if (eventDetailsResult.error) throw eventDetailsResult.error;
        if (!eventDetailsResult.data) { setError("Event not found."); setEvent(null); setIsLoading(false); setRefreshing(false); return; }

        const rawData = eventDetailsResult.data as SupabaseEventDetailData;
        const { date, time } = formatDateTime(rawData.event_datetime);
        let bookingsCount: number | null = null;
        if (bookingCountResult.error) console.warn("Count fetch warn:", bookingCountResult.error.message);
        else bookingsCount = bookingCountResult.count;

        const mappedData: MappedEventDetail = {
          id: rawData.id, title: rawData.title, description: rawData.description ?? "N/A",
          date: date, time: time, venue: rawData.location_text ?? "N/A",
          image: rawData.poster_urls?.[0] ?? DEFAULT_EVENT_IMAGE, artists: rawData.tags_artists ?? [],
          genres: rawData.tags_genres ?? [], status: getEventStatus(rawData.event_datetime),
          event_type: rawData.event_type, booking_type: rawData.booking_type,
          max_tickets: rawData.max_tickets, max_reservations: rawData.max_reservations,
          ticket_price: rawData.ticket_price, pass_fee_to_user: rawData.pass_fee_to_user ?? true,
          bookingsCount: bookingsCount, analyticsPlaceholder: true,
        };
        setEvent(mappedData);

    } catch (err: any) { console.error("Fetch Error:", err); setError(`Failed: ${err.message}`); setEvent(null); }
    finally { setIsLoading(false); setRefreshing(false); }
  }, [eventId, refreshing]);

  useFocusEffect(useCallback(() => { fetchEventData(); }, [fetchEventData]));
  const onRefresh = useCallback(() => { setRefreshing(true); }, []);

  // Actions
  const handleEdit = () => { if(event?.id) navigation.navigate('EditEvent', { eventId: event.id }); };
  const handlePromote = () => { if(event?.id) Alert.alert("Promote", `Promote: ${event.id}`); /* navigation.navigate('PromoteEvent', { eventId: event.id }); */ };
  const handleViewBookings = () => { if(event?.id) navigation.navigate('ViewBookings', { eventId: event.id, eventTitle: event.title }); };
  const handleMoreOptions = () => { Alert.alert("More Options", "Implement Delete, etc."); };

  // Render Logic
  if (isLoading && !event) return ( <SafeAreaView edges={["top"]} style={styles.centeredContainer}><ActivityIndicator size="large" color="#3B82F6" /></SafeAreaView> );
  if (error) return ( <SafeAreaView edges={["top"]} style={styles.centeredContainer}><Feather name="alert-circle" size={40} color="#F87171" /><Text style={styles.errorText}>{error}</Text>{!isLoading && (<TouchableOpacity onPress={fetchEventData} style={styles.retryButton}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity>)}</SafeAreaView> );
  if (!event) return ( <SafeAreaView edges={["top"]} style={styles.centeredContainer}><Feather name="help-circle" size={40} color="#6B7280" /><Text style={styles.emptyText}>Event not found.</Text></SafeAreaView> );

  const bookingLimit = event.booking_type === 'TICKETED' ? event.max_tickets : event.booking_type === 'RESERVATION' ? event.max_reservations : null;
  // Treat 0 as unlimited in UI, NULL means something went wrong or not applicable
  const isUnlimited = bookingLimit === 0;
  const bookingsMade = event.bookingsCount ?? 0; // Default to 0 if count is null
  // Calculate percentage only if limit is defined, positive, and count is available
  const percentageSold = (bookingLimit && bookingLimit > 0 && event.bookingsCount !== null) ? Math.min((bookingsMade / bookingLimit) * 100, 100) : 0;

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <View style={styles.header}><TouchableOpacity style={styles.backButton} onPress={()=>navigation.goBack()}><Feather name="arrow-left" size={24} color="#3B82F6" /></TouchableOpacity><Text style={styles.headerTitle} numberOfLines={1}>Event Details</Text><TouchableOpacity style={styles.moreButton} onPress={handleMoreOptions}><Feather name="more-vertical" size={24} color="#3B82F6" /></TouchableOpacity></View>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3B82F6"]} /> }>
        <Image source={{ uri: event.image }} style={styles.coverImage} />
        <View style={styles.statusBadgeContainer}><View style={[styles.statusBadge,{backgroundColor:event.status==="Upcoming"?"#EFF6FF":"#E0F2F1"}]}><Text style={[styles.statusText,{color:event.status==="Upcoming"?"#3B82F6":"#10B981"}]}>{event.status}</Text></View></View>
        <View style={styles.content}>
          <Text style={styles.title}>{event.title}</Text>
          <View style={styles.eventTypeContainer}><Feather name="info" size={16} color="#6B7280" style={styles.infoIcon}/><Text style={styles.infoTextBold}>Type:</Text><Text style={styles.infoText}> {formatEventType(event.event_type)}</Text></View>
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}><Feather name="calendar" size={16} color="#6B7280" style={styles.infoIcon} /><Text style={styles.infoText}>{event.date} • {event.time}</Text></View>
            <View style={styles.infoRow}><Feather name="map-pin" size={16} color="#6B7280" style={styles.infoIcon} /><Text style={styles.infoText} numberOfLines={2}>{event.venue}</Text></View>
          </View>
          {event.genres.length > 0 && (<View style={styles.tagsContainer}>{event.genres.map((g, i) => (<View key={i} style={styles.tag}><Text style={styles.tagText}>{g}</Text></View>))}</View>)}
          <Section title="Description"><Text style={styles.description}>{event.description}</Text></Section>
          {event.artists.length > 0 && ( <Section title="Artists"><View style={styles.artistsContainer}>{event.artists.map((a, i) => (<View key={i} style={styles.artistRow}><Feather name="music" size={16} color="#3B82F6" /><Text style={styles.artistName}>{a}</Text></View>))}</View></Section> )}

          {/* Updated Ticket Sales / Reservations Section */}
           <Section title={event.booking_type === 'TICKETED' ? "Ticket Sales" : event.booking_type === 'RESERVATION' ? "Reservations" : "Booking Info"}>
              {event.booking_type === 'INFO_ONLY' ? (
                  <View style={styles.dataMissingContainer}><Feather name="info" size={24} color="#9CA3AF" /><Text style={styles.dataMissingText}>This event is for information only.</Text></View>
              ) : event.bookingsCount === null ? (
                  <View style={styles.dataMissingContainer}><ActivityIndicator color="#3B82F6"/><Text style={styles.dataMissingTextSmall}>Loading booking data...</Text></View>
              ) : (
                  <View>
                      {/* Price Info (Tickets Only) */}
                      {event.booking_type === 'TICKETED' && (
                           <View style={styles.infoRow}><Feather name="dollar-sign" size={16} color="#6B7280" style={styles.infoIcon}/><Text style={styles.infoTextBold}>Price:</Text><Text style={styles.infoText}> {event.ticket_price !== null && event.ticket_price >= 0 ? (event.ticket_price === 0 ? 'Free' : `$${event.ticket_price.toFixed(2)}`) : 'N/A'} {event.ticket_price !== null && event.ticket_price > 0 ? (event.pass_fee_to_user ? ' (+ $0.50 Fee)' : ' (Fee Absorbed)') : ''}</Text></View>
                      )}
                      {/* Booking/Reservation Progress */}
                      <View style={styles.ticketTypeContainer}>
                         <View style={styles.ticketHeader}>
                            <Text style={styles.ticketName}>{event.booking_type === 'TICKETED' ? 'Tickets Sold' : 'Reservations Made'}</Text>
                            <Text style={styles.ticketPrice}>{bookingsMade} / {isUnlimited ? 'Unlimited' : bookingLimit ?? 'N/A'}</Text>
                         </View>
                         {/* Progress Bar */}
                         {!isUnlimited && bookingLimit !== null && bookingLimit > 0 && (
                              <View style={styles.progressBarContainer}><View style={[styles.progressBar, { width: `${percentageSold}%` }]} /></View>
                         )}
                         {/* Remaining Text */}
                         {!isUnlimited && bookingLimit !== null && bookingLimit > 0 && (
                             <Text style={styles.ticketRemainingText}>{bookingLimit - bookingsMade} remaining</Text>
                         )}
                      </View>
                      {/* View Bookings Button */}
                      {bookingsMade > 0 ? (
                           <TouchableOpacity style={styles.viewBookingsButtonFullWidth} onPress={handleViewBookings}><Text style={styles.viewBookingsText}>View Attendee List ({bookingsMade})</Text><Feather name="users" size={16} color="#3B82F6" /></TouchableOpacity>
                      ) : (
                          <Text style={styles.dataMissingTextSmall}>No {event.booking_type === 'TICKETED' ? 'tickets sold' : 'reservations made'} yet.</Text>
                      )}
                  </View>
              )}
           </Section>

          {event.analyticsPlaceholder && ( <Section title="Audience Analytics"><View style={styles.dataMissingContainer}><Feather name="bar-chart-2" size={24} color="#9CA3AF" /><Text style={styles.dataMissingText}>Detailed audience analytics not available.</Text></View></Section> )}
          <View style={styles.actionButtons}><TouchableOpacity style={styles.editButton} onPress={handleEdit}><Feather name="edit-2" size={18} color="#3B82F6" /><Text style={styles.editButtonText}>Edit Event</Text></TouchableOpacity><TouchableOpacity style={styles.promoteButton} onPress={handlePromote}><Feather name="trending-up" size={18} color="#FFFFFF" /><Text style={styles.promoteButtonText}>Promote Event</Text></TouchableOpacity></View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// --- Styles --- (Keep previous styles, ensure sales section styles are present)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'white' },
  errorText: { fontSize: 16, fontWeight: '600', color: '#DC2626', marginTop: 10, textAlign: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#4B5563', marginTop: 10, textAlign: 'center' },
  retryButton: { backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginTop: 15 },
  retryButtonText: { color: '#FFF', fontWeight: '600' },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6", backgroundColor: "white" },
  backButton: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#1F2937", flex: 1, textAlign: 'center', marginHorizontal: 8 },
  moreButton: { padding: 8, marginLeft: 8 },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  coverImage: { width: "100%", height: 240, backgroundColor: '#F3F4F6' },
  statusBadgeContainer: { position: "absolute", top: 16, right: 16, zIndex: 10 },
  statusBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.8)' },
  statusText: { fontSize: 12, fontWeight: "600" },
  content: { flex: 1, padding: 16 },
  title: { fontSize: 26, fontWeight: "bold", color: "#1F2937", marginBottom: 8 },
  eventTypeContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, },
  infoContainer: { marginBottom: 16 },
  infoRow: { flexDirection: "row", marginBottom: 12, alignItems: 'flex-start' },
  infoIcon: { marginRight: 12, marginTop: 3 },
  infoText: { fontSize: 16, color: "#4B5563", flexShrink: 1 },
  infoTextBold: { fontSize: 16, color: "#4B5563", fontWeight: '600'},
  venueContainer: { flex: 1 },
  tagsContainer: { flexDirection: "row", flexWrap: "wrap", marginBottom: 20 },
  tag: { backgroundColor: "rgba(59, 130, 246, 0.1)", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 8, marginBottom: 8 },
  tagText: { color: "#3B82F6", fontSize: 14, fontWeight: "500" },
  section: { marginBottom: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#111827", marginBottom: 16 },
  description: { fontSize: 16, lineHeight: 24, color: "#4B5563" },
  artistsContainer: { marginTop: 8 },
  artistRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  artistName: { fontSize: 16, color: "#374151", marginLeft: 12 },
  // Sales/Reservation Styles
  ticketTypeContainer: { backgroundColor: "#F9FAFB", borderRadius: 8, padding: 12, marginBottom: 12 },
  ticketHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  ticketName: { fontSize: 16, fontWeight: "600", color: "#1F2937" },
  ticketPrice: { fontSize: 16, fontWeight: "bold", color: "#4B5563" },
  progressBarContainer: { height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, overflow: "hidden", marginTop: 8 },
  progressBar: { height: "100%", backgroundColor: "#3B82F6", borderRadius: 4 },
   ticketRemainingText: { // Added style for remaining text
     fontSize: 12,
     color: '#6B7280',
     textAlign: 'right',
     marginTop: 4,
   },
  viewBookingsButtonFullWidth: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginTop: 12, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8 },
  viewBookingsText: { fontSize: 14, color: '#3B82F6', fontWeight: '500', marginRight: 4 },
  // Placeholders
  dataMissingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30, paddingHorizontal: 10, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  dataMissingText: { marginTop: 12, fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  dataMissingTextSmall: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 8 },
  // Action Buttons
  actionButtons: { flexDirection: "row", marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  editButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(59, 130, 246, 0.1)", paddingVertical: 12, borderRadius: 8, marginRight: 8 },
  editButtonText: { color: "#3B82F6", fontWeight: "600", marginLeft: 8, fontSize: 16 },
  promoteButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#3B82F6", paddingVertical: 12, borderRadius: 8, marginLeft: 8 },
  promoteButtonText: { color: "white", fontWeight: "600", marginLeft: 8, fontSize: 16 },
});

export default EventDetailScreen;