// src/screens/organizer/OrganizerPostsScreen.tsx (Example Path)
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Dimensions,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

// --- !!! ADJUST PATHS !!! ---
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth"; // Using the AuthProvider context
// ---------------------------

type RootStackParamList = {
  EventDetail: { eventId: string }; // Navigating to the organizer's detailed view
  Create: undefined; // Navigate to CreateEventScreen
};
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Interface matching relevant 'events' table schema columns
interface SupabaseEvent {
  id: string; organizer_id: string; title: string;
  event_datetime: string; location_text: string | null; poster_urls: string[];
  event_type: string | null; // Raw ENUM value or string representation
  booking_type: 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null;
  // Add other fields if needed for display later
}

// Interface for UI display in this list
interface OrganizerEventItem {
  id: string; title: string; date: string; time: string; venue: string;
  image: string; status: "Upcoming" | "Completed" | "Ongoing";
  booking_type: 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null;
}

const DEFAULT_EVENT_IMAGE = "https://via.placeholder.com/800x450/D1D5DB/1F2937?text=No+Image";
const formatDateTime = (isoString: string | null): { date: string; time: string } => { if(!isoString)return{date:"N/A",time:"N/A"};try{const d=new Date(isoString);const dt=d.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});const tm=d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',hour12:true});return{date:dt,time:tm};}catch(e){return{date:"Invalid",time:""};}};
const getEventStatus = (isoString: string | null): "Upcoming" | "Completed" | "Ongoing" => { if(!isoString)return "Upcoming";try{return new Date(isoString)>new Date()?"Upcoming":"Completed";}catch(e){return "Upcoming";}};

const OrganizerPostsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { session, loading: authLoading } = useAuth(); // Get session from context
  const [events, setEvents] = useState<OrganizerEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Upcoming' | 'Completed'>('All');

  // Fetch events based on filter and organizer ID
  const fetchOrganizerEvents = useCallback(async (filter: 'All' | 'Upcoming' | 'Completed' = 'All') => {
    if (!session?.user?.id) { setError("Login required."); setEvents([]); setIsLoading(false); setRefreshing(false); return; }
    if (!refreshing) setIsLoading(true); setError(null);

    try {
      let query = supabase
        .from("events")
        .select("id, title, event_datetime, location_text, poster_urls, booking_type") // Select needed fields
        .eq("organizer_id", session.user.id);

      const now = new Date().toISOString();
      if (filter === 'Upcoming') query = query.gt('event_datetime', now);
      else if (filter === 'Completed') query = query.lte('event_datetime', now);
      query = query.order("event_datetime", { ascending: filter !== 'Completed' });

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      const mappedEvents: OrganizerEventItem[] = (data || []).map((event: any) => {
          const { date, time } = formatDateTime(event.event_datetime);
          return {
            id: event.id, title: event.title, date: date, time: time,
            venue: event.location_text ?? "N/A",
            image: event.poster_urls?.[0] ?? DEFAULT_EVENT_IMAGE,
            status: getEventStatus(event.event_datetime),
            booking_type: event.booking_type,
          };
        }
      );
      setEvents(mappedEvents);
    } catch (err: any) { console.error("Fetch Err:", err); setError(`Failed: ${err.message}`); setEvents([]); }
    finally { setIsLoading(false); setRefreshing(false); }
  }, [session, refreshing]); // Keep dependencies

  useFocusEffect(useCallback(() => { if(session?.user?.id){ fetchOrganizerEvents(activeFilter); } else { setError("Please log in."); setEvents([]); }}, [fetchOrganizerEvents, activeFilter, session]));
  const onRefresh = useCallback(() => { setRefreshing(true); }, []);
  const handleFilterChange = (newFilter: 'All' | 'Upcoming' | 'Completed') => { if (newFilter !== activeFilter) setActiveFilter(newFilter); };

  // Render single event card
  const renderEventItem = ({ item }: { item: OrganizerEventItem }) => {
    const isUpcoming = item.status === "Upcoming";
     let bookingStatusText = "View Details"; // Default
     let bookingIcon: React.ComponentProps<typeof Feather>['name'] = 'info';
     if (item.booking_type === 'TICKETED') { bookingStatusText = "Ticket Sales"; bookingIcon = 'tag'; }
     else if (item.booking_type === 'RESERVATION') { bookingStatusText = "Reservations"; bookingIcon = 'bookmark'; }

    return (
      <TouchableOpacity style={styles.eventCard} onPress={() => navigation.navigate("EventDetail", { eventId: item.id })}>
        <Image source={{ uri: item.image }} style={styles.eventImage} />
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}><Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text><View style={[styles.statusBadge, { backgroundColor: isUpcoming ? "#EFF6FF":"#E0F2F1" }]}><Text style={[styles.statusText, { color: isUpcoming ? "#3B82F6":"#10B981" }]}>{item.status}</Text></View></View>
          <View style={styles.eventInfoRow}><Feather name="calendar" size={14} color="#6B7280" /><Text style={styles.eventInfoText}>{item.date} • {item.time}</Text></View>
          <View style={styles.eventInfoRow}><Feather name="map-pin" size={14} color="#6B7280" /><Text style={styles.eventInfoText} numberOfLines={1}>{item.venue}</Text></View>
          <View style={styles.ticketStatusPlaceholder}><Feather name={bookingIcon} size={14} color="#6B7280" style={{marginRight: 5}}/><Text style={styles.ticketStatusPlaceholderText}>{bookingStatusText}</Text></View>
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.actionButton} onPress={(e) => { e.stopPropagation(); Alert.alert("Edit", `Edit: ${item.id}`); }}><Feather name="edit-2" size={14} color="#3B82F6" /><Text style={styles.actionButtonText}>Edit</Text></TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={(e) => { e.stopPropagation(); Alert.alert("Analytics", `Analytics: ${item.id}`); }}><Feather name="bar-chart-2" size={14} color="#3B82F6" /><Text style={styles.actionButtonText}>Analytics</Text></TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={(e) => { e.stopPropagation(); Alert.alert("Share", `Share: ${item.id}`); }}><Feather name="share-2" size={14} color="#3B82F6" /><Text style={styles.actionButtonText}>Share</Text></TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render main content area
  const renderContent = () => { /* ... keep implementation ... */ if (isLoading && !refreshing && events.length === 0) return <View style={styles.centeredContainer}><ActivityIndicator size="large" color="#3B82F6" /></View>; if (error && !isLoading) return ( <View style={styles.centeredContainer}><Feather name="alert-circle" size={40} color="#F87171" /><Text style={styles.errorText}>{error}</Text><TouchableOpacity onPress={() => fetchOrganizerEvents(activeFilter)} style={styles.retryButton}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity></View>); if (!isLoading && events.length === 0) return ( <View style={styles.centeredContainer}><Feather name="calendar" size={40} color="#9CA3AF" /><Text style={styles.emptyText}>No Events Found</Text><Text style={styles.emptySubText}>{activeFilter==='All'?"Create an event!":`No ${activeFilter.toLowerCase()} events.`}</Text><TouchableOpacity style={styles.createButtonLarge} onPress={() => navigation.navigate("Create")}><Feather name="plus" size={18} color="#FFF" /><Text style={styles.createButtonLargeText}>Create Event</Text></TouchableOpacity></View>); return ( <FlatList data={events} keyExtractor={(item) => item.id} renderItem={renderEventItem} contentContainerStyle={styles.listContainer} style={styles.flatListContainer} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3B82F6"]} />}/>);};
  if (authLoading && !session) return <SafeAreaView edges={["top"]} style={styles.centeredContainer}><ActivityIndicator size="large" color="#3B82F6" /></SafeAreaView>;
  if (!session && !authLoading) return ( <SafeAreaView edges={["top"]} style={styles.centeredContainer}><Feather name="lock" size={40} color="#F87171" /><Text style={styles.errorText}>Not Logged In</Text><Text style={styles.errorSubText}>Log in to manage events.</Text></SafeAreaView>);

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <View style={styles.header}><View style={styles.headerTitleRow}><View style={styles.titleContainer}><Feather name="layout" size={22} color="#60A5FA" style={styles.headerIcon} /><Text style={styles.title}>Your Events</Text></View><TouchableOpacity style={styles.createButton} onPress={() => navigation.navigate("Create")}><Feather name="plus" size={16} color="#3B82F6" /><Text style={styles.createButtonText}>New</Text></TouchableOpacity></View></View>
      <View style={styles.filtersContainer}>{(['All', 'Upcoming', 'Completed'] as const).map(f => (<TouchableOpacity key={f} style={[styles.filterButton, activeFilter === f && styles.activeFilterButton]} onPress={() => handleFilterChange(f)}><Text style={activeFilter === f ? styles.activeFilterText : styles.filterText}>{f} Events</Text></TouchableOpacity>))}</View>
      {renderContent()}
    </SafeAreaView>
  );
};

// --- Styles --- (Keep styles as they were)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", },
  centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f8fafc', },
  errorText: { fontSize: 16, fontWeight: '600', color: '#DC2626', marginTop: 10, textAlign: 'center', },
  errorSubText: { fontSize: 14, color: '#4B5563', marginTop: 5, textAlign: 'center', marginBottom: 15, },
  retryButton: { backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginTop: 10, },
  retryButtonText: { color: '#FFF', fontWeight: '600', },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#4B5563', marginTop: 10, },
  emptySubText: { fontSize: 14, color: '#6B7280', marginTop: 5, textAlign: 'center', marginBottom: 20, },
  createButtonLarge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, },
  createButtonLargeText: { color: '#FFF', fontWeight: '600', marginLeft: 8, fontSize: 16, },
  header: { paddingTop: 16, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: '#E5E7EB', },
  headerTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", },
  titleContainer: { flexDirection: "row", alignItems: "center", },
  headerIcon: { marginRight: 8, },
  title: { fontSize: 22, fontWeight: "bold", color: "#3B82F6", },
  createButton: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(59, 130, 246, 0.1)", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, },
  createButtonText: { color: "#3B82F6", fontSize: 14, fontWeight: "500", marginLeft: 4, },
  filtersContainer: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, marginBottom: 4, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', },
  filterButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 8, backgroundColor: '#F3F4F6', },
  activeFilterButton: { backgroundColor: "rgba(59, 130, 246, 0.1)", },
  filterText: { fontSize: 14, color: "#4B5563", },
  activeFilterText: { fontSize: 14, color: "#3B82F6", fontWeight: "500", },
  flatListContainer: { flex: 1, },
  listContainer: { padding: 16, paddingBottom: 80, },
  eventCard: { backgroundColor: "white", borderRadius: 12, overflow: "hidden", marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2, borderWidth: 1, borderColor: '#E5E7EB', },
  eventImage: { width: "100%", height: 160, backgroundColor: '#F3F4F6', },
  eventContent: { padding: 16, },
  eventHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, },
  eventTitle: { fontSize: 18, fontWeight: "600", color: "#1F2937", flex: 1, marginRight: 8, },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, marginTop: 2, alignSelf: 'flex-start'},
  statusText: { fontSize: 12, fontWeight: "500", },
  eventInfoRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, },
  eventInfoText: { fontSize: 14, color: "#6B7280", marginLeft: 8, flexShrink: 1, },
  ticketStatusPlaceholder: { marginTop: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', },
  ticketStatusPlaceholderText: { fontSize: 13, color: '#6B7280', },
  cardActions: { flexDirection: "row", justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 12, marginTop: 8, },
  actionButton: { flexDirection: "row", alignItems: "center", padding: 4, },
  actionButtonText: { fontSize: 14, color: "#3B82F6", marginLeft: 4, },
});

export default OrganizerPostsScreen;