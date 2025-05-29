import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Dimensions,
  ActivityIndicator, Alert, RefreshControl, Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LineChart, PieChart } from "react-native-chart-kit";
import { supabase } from "../../lib/supabase"; // Adjust path

// Define Param List to match AppNavigator
type OrganizerStackParamList = {
  OrganizerPosts: undefined;
  EventDetail: { eventId: string };
  EditEvent: { eventId: string };
  PromoteEvent: { eventId: string }; // Keep if planning to implement
  ViewBookings: { eventId: string; eventTitle: string }; // Keep if planning to implement
};
type EventDetailScreenRouteProp = RouteProp<OrganizerStackParamList, 'EventDetail'>;
type EventDetailScreenNavigationProp = NativeStackNavigationProp<OrganizerStackParamList, 'EventDetail'>;

// Raw data from 'events' table
interface SupabaseEventDetailData {
  id: string; organizer_id: string; title: string; description: string | null;
  event_datetime: string; location_text: string | null; poster_urls: string[];
  tags_genres: string[] | null; tags_artists: string[] | null; tags_songs: string[] | null;
  created_at: string; updated_at: string;
  event_type: string | null;
  booking_type: 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null;
  max_tickets: number | null; max_reservations: number | null;
  ticket_price: number | null; pass_fee_to_user: boolean | null;
}

// Mapped data for UI including analytics
interface MappedEventDetail {
  id: string; title: string; description: string; date: string; time: string;
  venue: string; 
  images: string[];
  artists: string[]; genres: string[]; songs: string[];
  status: "Upcoming" | "Completed" | "Ongoing";
  event_type: string | null;
  booking_type: 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null;
  max_tickets: number | null; max_reservations: number | null;
  ticket_price: number | null; pass_fee_to_user: boolean;
  confirmedBookingsCount: number | null;
  totalImpressions: number | null;
  totalRevenue: number | null;
  ageDistribution: AttendeeAgeGroup[] | null;
  impressionsOverTime: ImpressionTimePoint[] | null;
  bookingsOverTime: BookingTimePoint[] | null;
}

// --- Define Missing Types Locally (Replace with actual imports if available) --- 
interface AttendeeAgeGroup {
  age_group: string;
  count: number;
}

interface ImpressionTimePoint {
  interval_start: string; // Assuming ISO string
  impression_count: number;
}

interface BookingTimePoint {
  interval_start: string; // Assuming ISO string
  booking_count: number;
}
// --- End Missing Type Definitions ---

const DEFAULT_EVENT_IMAGE = "https://via.placeholder.com/800x450/D1D5DB/1F2937?text=No+Image";
const formatDateTime = (isoString: string | null): { date: string; time: string } => { if(!isoString)return{date:"N/A",time:"N/A"};try{const d=new Date(isoString);const dt=d.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});const tm=d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',hour12:true});return{date:dt,time:tm};}catch(e){return{date:"Invalid",time:""};}};
const getEventStatus = (isoString: string | null): "Upcoming" | "Completed" | "Ongoing" => { if(!isoString)return "Upcoming";try{return new Date(isoString)>new Date()?"Upcoming":"Completed";}catch(e){return "Upcoming";}};
const formatEventType = (type: string | null): string => { if (!type) return "Unknown"; return type.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '); };

interface SectionProps { title: string; children: React.ReactNode; icon?: React.ComponentProps<typeof Feather>['name']; }
const Section: React.FC<SectionProps> = ({ title, children, icon }) => ( <View style={styles.section}><View style={styles.sectionHeader}><View style={styles.sectionTitleContainer}>{icon && <Feather name={icon} size={18} color="#4B5563" style={{marginRight: 8}}/>}<Text style={styles.sectionTitle}>{title}</Text></View></View>{children}</View> );

const screenWidth = Dimensions.get("window").width;
const chartConfig = { backgroundColor: "#F9FAFB", backgroundGradientFrom: "#F9FAFB", backgroundGradientTo: "#F9FAFB", decimalPlaces: 0, color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`, style: { borderRadius: 8 }, propsForDots: { r: "4", strokeWidth: "1", stroke: "#3B82F6" } };
const pieChartColors = ["#60A5FA", "#34D399", "#FBBF24", "#F87171", "#A78BFA", "#FB923C", "#9CA3AF"];

const EventDetailScreen = () => {
  const navigation = useNavigation<EventDetailScreenNavigationProp>();
  const route = useRoute<EventDetailScreenRouteProp>();
  const { eventId } = route.params;

  const [event, setEvent] = useState<MappedEventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Fetch event details AND analytics data
  const fetchEventData = useCallback(async () => {
    if (!eventId) { setError("Event ID missing."); setIsLoading(false); setRefreshing(false); return; }
    if (!refreshing) { setIsLoading(true); setAnalyticsLoading(true); }
    setError(null);

    try {
        const { data: eventDetailsData, error: eventDetailsError } = await supabase
            .from("events").select("*").eq("id", eventId).maybeSingle();

        if (eventDetailsError) throw eventDetailsError;
        if (!eventDetailsData) { setError("Event not found."); setEvent(null); setIsLoading(false); setAnalyticsLoading(false); setRefreshing(false); return; }

        const rawData = eventDetailsData as SupabaseEventDetailData;
        const { date, time } = formatDateTime(rawData.event_datetime);

        // Set base event data first
        const baseMappedData: MappedEventDetail = {
          id: rawData.id, title: rawData.title, description: rawData.description ?? "N/A",
          date: date, time: time, venue: rawData.location_text ?? "N/A",
          images: rawData.poster_urls?.length > 0 ? rawData.poster_urls : [DEFAULT_EVENT_IMAGE],
          artists: rawData.tags_artists ?? [],
          genres: rawData.tags_genres ?? [], songs: rawData.tags_songs ?? [], status: getEventStatus(rawData.event_datetime),
          event_type: rawData.event_type, booking_type: rawData.booking_type,
          max_tickets: rawData.max_tickets, max_reservations: rawData.max_reservations,
          ticket_price: rawData.ticket_price, pass_fee_to_user: rawData.pass_fee_to_user ?? true,
          confirmedBookingsCount: null, totalImpressions: null, totalRevenue: null,
          ageDistribution: null, impressionsOverTime: null,
          bookingsOverTime: null,
        };
        setEvent(baseMappedData);
        setIsLoading(false); // Base loading finished

        // Fetch analytics in parallel
        const analyticsPromises = [
             supabase.from("event_bookings").select('quantity').eq("event_id", eventId).eq('status', 'CONFIRMED'),
             supabase.from("event_impressions").select('*', { count: 'exact', head: true }).eq("event_id", eventId),
             rawData.booking_type === 'TICKETED'
                ? supabase.from("event_bookings").select('total_price_paid').eq("event_id", eventId).eq('status', 'CONFIRMED').not('total_price_paid', 'is', null)
                : Promise.resolve({ data: [], error: null }),
             supabase.rpc('get_event_attendee_age_distribution', { target_event_id: eventId }),
             supabase.rpc('get_event_impressions_over_time', { target_event_id: eventId }), // Using default '1 day' interval
             supabase.rpc('get_event_bookings_over_time', { target_event_id: eventId })
        ];

        const [ bookingsResult, impressionsResult, revenueResult, ageResult, impressionsTimeResult, bookingsTimeResult ] = await Promise.all(analyticsPromises);

        // Process results
        let confirmedBookingsCount: number | null = null;
        if (!bookingsResult.error && bookingsResult.data) {
            confirmedBookingsCount = bookingsResult.data.reduce((sum: number, row: { quantity: number | null }) => sum + (row.quantity || 0), 0);
        } else { console.warn("Bookings count fetch warn:", bookingsResult.error?.message); }

        let totalImpressions: number | null = (impressionsResult as any).count ?? null;
        if (impressionsResult.error) { console.warn("Impressions count fetch warn:", impressionsResult.error.message); totalImpressions = null; }

        let totalRevenue: number | null = null;
        if (rawData.booking_type === 'TICKETED' && !revenueResult.error && revenueResult.data) {
             totalRevenue = revenueResult.data.reduce((sum: number, row: { total_price_paid: number | null }) => sum + (row.total_price_paid || 0), 0);
        } else if (rawData.booking_type === 'TICKETED' && revenueResult.error) { console.warn("Revenue fetch warn:", revenueResult.error?.message); }

        let ageDistribution: AttendeeAgeGroup[] | null = null;
        if (!ageResult.error && ageResult.data) {
            ageDistribution = ageResult.data as AttendeeAgeGroup[];
        } else { console.warn("Age distribution fetch warn:", ageResult.error?.message); }

        let impressionsOverTime: ImpressionTimePoint[] | null = null;
        if (!impressionsTimeResult.error && impressionsTimeResult.data) {
            impressionsOverTime = impressionsTimeResult.data as ImpressionTimePoint[];
        } else { console.warn("Impressions time fetch warn:", impressionsTimeResult.error?.message); }
        
        // Process booking time data
        let bookingsOverTime: BookingTimePoint[] | null = null;
        if (!bookingsTimeResult.error && bookingsTimeResult.data) {
            bookingsOverTime = bookingsTimeResult.data as BookingTimePoint[];
        } else { console.warn("Bookings time fetch warn:", bookingsTimeResult.error?.message); }

        // Update state with analytics
        setEvent(prev => prev ? ({ 
            ...prev, 
            confirmedBookingsCount, 
            totalImpressions, 
            totalRevenue, 
            ageDistribution, 
            impressionsOverTime,
            bookingsOverTime 
        }) : null);

    } catch (err: any) { console.error("Fetch Error:", err); setError(`Failed to load event: ${err.message}`); setEvent(null); setIsLoading(false); }
    finally { setAnalyticsLoading(false); setRefreshing(false); }
  }, [eventId, refreshing]);

  useFocusEffect(useCallback(() => { fetchEventData(); }, [fetchEventData]));
  const onRefresh = useCallback(() => { setRefreshing(true); }, []);

  // Actions
  const handleEdit = () => { if(event?.id) navigation.navigate('EditEvent', { eventId: event.id }); };
  const handlePromote = () => { if(event?.id) Alert.alert("Promote", `Promote feature coming soon!`); };
  const handleViewBookings = () => { if(event?.id && event.title) navigation.navigate('ViewBookings', { eventId: event.id, eventTitle: event.title }); else Alert.alert("Error", "Cannot view bookings without event details."); };
  const handleMoreOptions = () => { Alert.alert("More Options", "Future options: Duplicate Event, Cancel Event, etc."); };

  // --- Image Swiper Logic ---
  const windowWidth = Dimensions.get('window').width;
  // Constrain the content width on web, and image takes this constrained width
  const contentContainerMaxWidth = Platform.OS === 'web' ? Math.min(windowWidth * 0.9, 650) : windowWidth;
  
  const imageContainerWidth = contentContainerMaxWidth;
  const imageContainerHeight = imageContainerWidth; // For 1:1 aspect ratio
  const images = event?.images ?? [DEFAULT_EVENT_IMAGE];

  const onScroll = (nativeEvent: any) => {
    if (nativeEvent) {
      const slide = Math.ceil(nativeEvent.contentOffset.x / nativeEvent.layoutMeasurement.width);
      if (slide !== currentImageIndex) {
        setCurrentImageIndex(slide);
      }
    }
  };

  const goToPrevious = () => {
      if (currentImageIndex > 0) {
          scrollViewRef.current?.scrollTo({ x: imageContainerWidth * (currentImageIndex - 1), animated: true });
          setCurrentImageIndex(currentImageIndex - 1);
      }
  };

  const goToNext = () => {
      if (currentImageIndex < images.length - 1) {
          scrollViewRef.current?.scrollTo({ x: imageContainerWidth * (currentImageIndex + 1), animated: true });
          setCurrentImageIndex(currentImageIndex + 1);
      }
  };
  // --- End Image Swiper Logic ---

  // Prepare chart data (handle cases with no/insufficient data)
  const lineChartData = {
      labels: event?.impressionsOverTime && event.impressionsOverTime.length > 0
                ? event.impressionsOverTime.map(p => new Date(p.interval_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
                : ["Start"], // Default label if no data
      datasets: [{
          data: event?.impressionsOverTime && event.impressionsOverTime.length > 0
                ? event.impressionsOverTime.reduce((acc: number[], point, index) => {
                    // Calculate cumulative sum
                    const prevTotal = index > 0 ? acc[index - 1] : 0;
                    acc.push(prevTotal + point.impression_count);
                    return acc;
                  }, [])
                : [0] // Default data point if no data
      }],
      legend: ["Cumulative Impressions"]
  };
  const pieChartData = event?.ageDistribution?.filter(g => g.count > 0) // Filter out zero-count groups
                        .map((group, index) => ({
                            name: group.age_group,
                            population: group.count,
                            color: pieChartColors[index % pieChartColors.length],
                            legendFontColor: "#7F7F7F",
                            legendFontSize: 13
                        })) ?? [];

  // Render Logic
  if (isLoading && !event) return ( <SafeAreaView edges={["top"]} style={styles.centeredContainer}><ActivityIndicator size="large" color="#3B82F6" /></SafeAreaView> );
  if (error) return ( <SafeAreaView edges={["top"]} style={styles.centeredContainer}><Feather name="alert-circle" size={40} color="#F87171" /><Text style={styles.errorText}>{error}</Text>{!isLoading && (<TouchableOpacity onPress={fetchEventData} style={styles.retryButton}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity>)}</SafeAreaView> );
  if (!event) return ( <SafeAreaView edges={["top"]} style={styles.centeredContainer}><Feather name="help-circle" size={40} color="#6B7280" /><Text style={styles.emptyText}>Event not found.</Text></SafeAreaView> );

  const bookingLimit = event.booking_type === 'TICKETED' ? event.max_tickets : event.booking_type === 'RESERVATION' ? event.max_reservations : null;
  const isUnlimited = bookingLimit === null; // Treat null as unlimited (0 means 0 capacity)
  const bookingsMade = event.confirmedBookingsCount ?? 0;
  const percentageSold = (!isUnlimited && bookingLimit && bookingLimit > 0 && event.confirmedBookingsCount !== null)
                         ? Math.min((bookingsMade / bookingLimit) * 100, 100)
                         : 0;
  const spotsRemaining = !isUnlimited && bookingLimit ? bookingLimit - bookingsMade : null;

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <ScrollView 
        style={[
          styles.scrollContainer,
          Platform.OS === 'web' && {
            width: '100%',
            maxWidth: contentContainerMaxWidth,
            alignSelf: 'center',
          }
        ]}
        contentContainerStyle={styles.scrollContent} 
        refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3B82F6"]} /> }
      >
        {/* --- Image Swiper Start --- */}
         <View style={[styles.imageSwiperContainer, { height: imageContainerHeight }]}>
             <ScrollView
                 ref={scrollViewRef}
                 horizontal
                 pagingEnabled
                 showsHorizontalScrollIndicator={false}
                 onMomentumScrollEnd={(e) => onScroll(e.nativeEvent)}
                 scrollEventThrottle={16}
                 style={{ width: imageContainerWidth, height: imageContainerHeight }}
             >
                 {images.map((uri, index) => (
                     <Image
                         key={index}
                         source={{ uri: uri }}
                         style={[styles.coverImage, { width: imageContainerWidth, height: imageContainerHeight }]}
                         resizeMode="cover"
                     />
                 ))}
             </ScrollView>
             {/* Pagination Dots */}
             {images.length > 1 && (
                 <View style={styles.paginationContainer}>
                     {images.map((_, index) => (
                         <View
                             key={index}
                             style={[styles.paginationDot, index === currentImageIndex ? styles.paginationDotActive : {}]}
                         />
                     ))}
                 </View>
             )}
             {/* Arrow Buttons (Web Only) */}
             {Platform.OS === 'web' && images.length > 1 && (
                 <>
                     <TouchableOpacity
                         style={[styles.arrowButton, styles.arrowLeft]}
                         onPress={goToPrevious}
                         disabled={currentImageIndex === 0}
                     >
                         <Feather name="chevron-left" size={28} color={currentImageIndex === 0 ? '#9CA3AF' : '#FFF'} />
                     </TouchableOpacity>
                     <TouchableOpacity
                         style={[styles.arrowButton, styles.arrowRight]}
                         onPress={goToNext}
                         disabled={currentImageIndex === images.length - 1}
                     >
                         <Feather name="chevron-right" size={28} color={currentImageIndex === images.length - 1 ? '#9CA3AF' : '#FFF'} />
                     </TouchableOpacity>
                 </>
             )}
             {/* Status Badge is now inside the swiper container to overlay */}
             <View style={styles.statusBadgeContainer}><View style={[styles.statusBadge,{backgroundColor:event.status==="Upcoming"?"#EFF6FF":"#E0F2F1"}]}><Text style={[styles.statusText,{color:event.status==="Upcoming"?"#3B82F6":"#10B981"}]}>{event.status}</Text></View></View>
         </View>
         {/* --- Image Swiper End --- */}
        <View style={styles.content}>
          <Text style={styles.title}>{event.title}</Text>
          <View style={styles.eventTypeContainer}><Feather name="info" size={16} color="#6B7280" style={styles.infoIcon}/><Text style={styles.infoTextBold}>Type:</Text><Text style={styles.infoText}> {formatEventType(event.event_type)}</Text></View>
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}><Feather name="calendar" size={16} color="#6B7280" style={styles.infoIcon} /><Text style={styles.infoText}>{event.date} • {event.time}</Text></View>
            <View style={styles.infoRow}><Feather name="map-pin" size={16} color="#6B7280" style={styles.infoIcon} /><Text style={styles.infoText} numberOfLines={2}>{event.venue}</Text></View>
          </View>
          {/* Combined Tags */}
          <Section title="Tags" icon="tag">
            <View style={styles.tagsContainer}>{ [...event.genres, ...event.artists, ...event.songs].filter(t => t).map((tag, i) => (<View key={`${tag}-${i}-detail`} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)) }{ [...event.genres, ...event.artists, ...event.songs].filter(t => t).length === 0 && (<Text style={styles.dataMissingTextSmall}>No tags provided.</Text>) }</View>
          </Section>

          <Section title="Description" icon="file-text"><Text style={styles.description}>{event.description}</Text></Section>

          {/* Ticket Sales / Reservations Section */}
           <Section title={event.booking_type === 'TICKETED' ? "Ticket Sales" : event.booking_type === 'RESERVATION' ? "Reservations" : "Booking Info"} icon={event.booking_type === 'TICKETED' ? 'tag' : event.booking_type === 'RESERVATION' ? 'bookmark' : 'info'} >
              {event.booking_type === 'INFO_ONLY' ? (<View style={styles.dataMissingContainer}><Feather name="info" size={24} color="#9CA3AF" /><Text style={styles.dataMissingText}>This event is for information only.</Text></View>
              ) : analyticsLoading && event.confirmedBookingsCount === null ? ( // Show loading only if count is still null
                  <View style={styles.dataMissingContainer}><ActivityIndicator color="#3B82F6"/><Text style={styles.dataMissingTextSmall}>Loading booking data...</Text></View>
              ) : (
                  <View>
                      {event.booking_type === 'TICKETED' && (<View style={styles.infoRow}><Feather name="dollar-sign" size={16} color="#6B7280" style={styles.infoIcon}/><Text style={styles.infoTextBold}>Price:</Text><Text style={styles.infoText}> {event.ticket_price !== null && event.ticket_price >= 0 ? (event.ticket_price === 0 ? 'Free' : `$${event.ticket_price.toFixed(2)}`) : 'N/A'} {event.ticket_price !== null && event.ticket_price > 0 ? (event.pass_fee_to_user ? ' (+ $0.50 Fee)' : ' (Fee Absorbed)') : ''}</Text></View>)}
                      <View style={styles.ticketTypeContainer}>
                         <View style={styles.ticketHeader}><Text style={styles.ticketName}>{event.booking_type === 'TICKETED' ? 'Tickets Sold' : 'Reservations Made'}</Text><Text style={styles.ticketPrice}>{bookingsMade} / {isUnlimited ? 'Unlimited' : bookingLimit ?? 'N/A'}</Text></View>
                         {!isUnlimited && bookingLimit && bookingLimit > 0 && (<View style={styles.progressBarContainer}><View style={[styles.progressBar, { width: `${percentageSold}%` }]} /></View>)}
                         {!isUnlimited && bookingLimit && spotsRemaining !== null && spotsRemaining >= 0 && (<Text style={styles.ticketRemainingText}>{spotsRemaining} remaining</Text>)}
                         {bookingLimit === 0 && (<Text style={styles.warningTextSmall}>Capacity set to 0. Booking disabled.</Text>)}
                      </View>
                      {bookingsMade > 0 ? (<TouchableOpacity style={styles.viewBookingsButtonFullWidth} onPress={handleViewBookings}><Text style={styles.viewBookingsText}>View Attendee List ({bookingsMade})</Text><Feather name="users" size={16} color="#3B82F6" /></TouchableOpacity>
                      ) : ( <Text style={styles.dataMissingTextSmall}>No {event.booking_type === 'TICKETED' ? 'tickets sold' : 'reservations made'} yet.</Text> )}
                      {event.booking_type === 'TICKETED' && (<View style={[styles.infoRow, {marginTop: 15, borderTopWidth: 1, borderColor: '#F3F4F6', paddingTop: 15}]}><Feather name="trending-up" size={16} color="#10B981" style={styles.infoIcon}/><Text style={styles.infoTextBold}>Total Revenue:</Text><Text style={[styles.infoText, {color: '#10B981', fontWeight: '600'}]}> ${event.totalRevenue !== null ? event.totalRevenue.toFixed(2) : '0.00'}</Text></View>)}
                  </View>
              )}
           </Section>

          {/* Audience Analytics Section */}
          <Section title="Audience Analytics" icon="bar-chart-2">
             {analyticsLoading ? ( 
                 <View style={styles.dataMissingContainer}><ActivityIndicator color="#3B82F6"/><Text style={styles.dataMissingTextSmall}>Loading analytics...</Text></View> 
             ) : ( 
                 // Only show analytics content if loading is finished
                 <>
                     <View style={styles.analyticItem}><Feather name="eye" size={16} color="#6B7280" style={styles.infoIcon}/><Text style={styles.infoTextBold}>Total Views:</Text><Text style={styles.infoText}> {event.totalImpressions !== null ? event.totalImpressions : 'N/A'}</Text></View>
                     
                     {/* Impressions Chart */}
                     {(event.impressionsOverTime && event.impressionsOverTime.length > 1) ? ( // Require at least 2 points for a line
                         <View style={styles.chartContainer}>
                             <Text style={styles.chartTitle}>Impressions Over Time</Text>
                             <LineChart data={lineChartData} width={screenWidth - 64} height={220} chartConfig={chartConfig} bezier style={styles.chartStyle} />
                         </View>
                     ) : ( <Text style={styles.dataMissingTextSmall}>Not enough impression data for trend chart.</Text> )}
                     
                     {/* Age Distribution Chart */}
                      {(pieChartData && pieChartData.length > 0) ? ( 
                          <View style={styles.chartContainer}>
                              <Text style={styles.chartTitle}>Attendee Age Distribution</Text>
                              <PieChart data={pieChartData} width={screenWidth - 64} height={220} chartConfig={chartConfig} accessor={"population"} backgroundColor={"transparent"} paddingLeft={"15"} absolute style={styles.chartStyle} />
                          </View>
                      ) : ( 
                          <View style={styles.dataMissingContainer}><Feather name="users" size={24} color="#9CA3AF" /><Text style={styles.dataMissingText}>No attendee age data available.</Text></View>
                      )}
                 </>
             )}
          </Section>

          {/* Cost Tracking Section */}
          <Section title="Cost Tracking" icon="dollar-sign">
              {analyticsLoading ? ( 
                  <View style={styles.dataMissingContainer}>
                      <ActivityIndicator color="#3B82F6"/>
                      <Text style={styles.dataMissingTextSmall}>Loading cost data...</Text>
                  </View> 
              ) : ( 
                  <>
                      {/* Impression Costs */}
                      <View style={styles.costSection}>
                          <Text style={styles.costTitle}>Impression Costs</Text>
                          <Text style={styles.costDescription}>
                              Cost per impression: $0.0075
                          </Text>
                          
                          {(event.impressionsOverTime && event.impressionsOverTime.length > 1) ? (
                              <View style={styles.chartContainer}>
                                  <LineChart 
                                      data={{
                                          labels: event.impressionsOverTime.map(p => 
                                              new Date(p.interval_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                          ),
                                          datasets: [{
                                              data: event.impressionsOverTime.reduce((acc: number[], point, index) => {
                                                  // Calculate cumulative cost (at $0.0075 per impression)
                                                  const currentCost = point.impression_count * 0.0075;
                                                  const prevTotal = index > 0 ? acc[index - 1] : 0;
                                                  acc.push(prevTotal + currentCost);
                                                  return acc;
                                              }, [])
                                          }],
                                          legend: ["Cumulative Impression Cost ($)"]
                                      }}
                                      width={screenWidth - 64}
                                      height={220}
                                      chartConfig={{
                                          ...chartConfig,
                                          color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`, // Red color
                                      }}
                                      bezier
                                      style={styles.chartStyle}
                                      yAxisSuffix="$"
                                      formatYLabel={(value) => parseFloat(value).toFixed(2)}
                                  />
                              </View>
                          ) : (
                              <Text style={styles.dataMissingTextSmall}>Not enough impression data for cost chart.</Text>
                          )}
                          
                          <Text style={styles.costTotalAmount}>
                              Total Impression Cost: ${event.totalImpressions ? (event.totalImpressions * 0.0075).toFixed(2) : '0.00'}
                          </Text>
                      </View>
                      
                      {/* Booking/Transaction Costs */}
                      <View style={styles.costSection}>
                          <Text style={styles.costTitle}>Transaction Costs</Text>
                          <Text style={styles.costDescription}>
                              Cost per ticket/reservation: $0.50
                          </Text>
                          
                          {(event.bookingsOverTime && event.bookingsOverTime.length > 1) ? (
                              <View style={styles.chartContainer}>
                                  <LineChart 
                                      data={{
                                          labels: event.bookingsOverTime.map(p => 
                                              new Date(p.interval_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                          ),
                                          datasets: [{
                                              data: event.bookingsOverTime.reduce((acc: number[], point, index) => {
                                                  // Calculate cumulative transaction costs at $0.50 per booking
                                                  const currentCost = point.booking_count * 0.50;
                                                  const prevTotal = index > 0 ? acc[index - 1] : 0;
                                                  acc.push(prevTotal + currentCost);
                                                  return acc;
                                              }, [])
                                          }],
                                          legend: ["Cumulative Transaction Cost ($)"]
                                      }}
                                      width={screenWidth - 64}
                                      height={220}
                                      chartConfig={{
                                          ...chartConfig,
                                          color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`, // Amber color
                                      }}
                                      bezier
                                      style={styles.chartStyle}
                                      yAxisSuffix="$"
                                      formatYLabel={(value) => parseFloat(value).toFixed(2)}
                                  />
                              </View>
                          ) : (
                              <Text style={styles.dataMissingTextSmall}>Not enough booking data for transaction cost chart.</Text>
                          )}
                          
                          <Text style={styles.costTotalAmount}>
                              Total Transaction Cost: ${
                                  event.confirmedBookingsCount ? 
                                  (event.confirmedBookingsCount * 0.50).toFixed(2) : '0.00'
                              }
                          </Text>
                      </View>
                      
                      {/* Combined Total Costs */}
                      <View style={styles.costSection}>
                          <Text style={styles.costTitle}>Total Platform Costs</Text>
                          <Text style={styles.costDescription}>
                              Combined impression and transaction costs
                          </Text>
                          
                          {(event.impressionsOverTime && event.impressionsOverTime.length > 1 && 
                            event.bookingsOverTime && event.bookingsOverTime.length > 1) ? (
                              <View style={styles.chartContainer}>
                                  <LineChart 
                                      data={{
                                          // Use impression data points for the timeline
                                          labels: event.impressionsOverTime.map(p => 
                                              new Date(p.interval_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                          ),
                                          datasets: [{
                                              data: event.impressionsOverTime.map((impressionPoint, index) => {
                                                  // Get impression cost
                                                  const impressionCost = event.impressionsOverTime!.slice(0, index + 1)
                                                      .reduce((sum, p) => sum + (p.impression_count * 0.0075), 0);
                                                  
                                                  // Find matching booking data point (approximately by date)
                                                  // This is simplified and assumes the time intervals align
                                                  // A more robust solution would match dates properly
                                                  const bookingCost = index < event.bookingsOverTime!.length ?
                                                      event.bookingsOverTime!.slice(0, index + 1)
                                                          .reduce((sum, p) => {
                                                              // Updated to use flat $0.50 fee
                                                              return sum + (p.booking_count * 0.50);
                                                          }, 0) : 0;
                                                  
                                                  // Return combined cost
                                                  return impressionCost + bookingCost;
                                              })
                                          }],
                                          legend: ["Total Platform Cost ($)"]
                                      }}
                                      width={screenWidth - 64}
                                      height={220}
                                      chartConfig={{
                                          ...chartConfig,
                                          color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`, // Indigo color
                                      }}
                                      bezier
                                      style={styles.chartStyle}
                                      yAxisSuffix="$"
                                      formatYLabel={(value) => parseFloat(value).toFixed(2)}
                                  />
                              </View>
                          ) : (
                              <Text style={styles.dataMissingTextSmall}>Not enough data for combined cost chart.</Text>
                          )}
                          
                          <Text style={styles.costTotalAmount}>
                              Total Platform Cost: ${
                                  (
                                      // Impression costs
                                      (event.totalImpressions ? event.totalImpressions * 0.0075 : 0) +
                                      // Transaction costs - updated to flat $0.50 fee
                                      (event.confirmedBookingsCount ? event.confirmedBookingsCount * 0.50 : 0)
                                  ).toFixed(2)
                              }
                          </Text>
                      </View>
                  </>
              )}
          </Section>

          {/* Action Buttons - Promote Removed */}
          <View style={styles.actionButtons}>
             <TouchableOpacity style={styles.editButtonFullWidth} onPress={handleEdit}>
                 <Feather name="edit-2" size={18} color="#3B82F6" />
                 <Text style={styles.editButtonText}>Edit Event</Text>
             </TouchableOpacity>
             {/* Add more buttons here if needed later, like View Bookings if not already present */}
             {/* <TouchableOpacity style={styles.viewBookingsButton} onPress={handleViewBookings}><Feather name="users" size={18} color="#3B82F6" /><Text style={styles.viewBookingsButtonText}>View Bookings</Text></TouchableOpacity> */}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'white' },
  errorText: { fontSize: 16, fontWeight: '600', color: '#DC2626', marginTop: 10, textAlign: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#4B5563', marginTop: 10, textAlign: 'center' },
  retryButton: { backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginTop: 15 },
  retryButtonText: { color: '#FFF', fontWeight: '600' },
  scrollContainer: { 
    flex: 1,
  },
  scrollContent: { paddingBottom: 40 },
  imageSwiperContainer: {
      position: 'relative',
      width: '100%',
      backgroundColor: '#F3F4F6',
  },
  coverImage: { width: "100%", backgroundColor: '#F3F4F6' },
  paginationContainer: {
      position: 'absolute',
      bottom: 15,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2,
  },
  paginationDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.6)',
      marginHorizontal: 4,
  },
  paginationDotActive: {
      backgroundColor: '#FFFFFF',
  },
  arrowButton: {
      position: 'absolute',
      top: '50%',
      marginTop: -20,
      padding: 6,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      borderRadius: 20,
      zIndex: 2,
  },
  arrowLeft: {
      left: 15,
  },
  arrowRight: {
      right: 15,
  },
  statusBadgeContainer: { position: "absolute", top: 16, right: 16, zIndex: 10 },
  statusBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.8)' },
  statusText: { fontSize: 12, fontWeight: "600" },
  content: { flex: 1, padding: 16 },
  title: { fontSize: 26, fontWeight: "bold", color: "#1F2937", marginBottom: 8 },
  eventTypeContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, },
  infoContainer: { marginBottom: 16 },
  infoRow: { flexDirection: "row", marginBottom: 12, alignItems: 'flex-start' },
  infoIcon: { marginRight: 12, marginTop: 3, width: 16, textAlign: 'center' },
  infoText: { fontSize: 16, color: "#4B5563", flexShrink: 1 },
  infoTextBold: { fontSize: 16, color: "#374151", fontWeight: '600'},
  tagsContainer: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  tag: { backgroundColor: "rgba(59, 130, 246, 0.1)", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 8, marginBottom: 8 },
  tagText: { color: "#3B82F6", fontSize: 14, fontWeight: "500" },
  section: { marginBottom: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionTitleContainer: {flexDirection: 'row', alignItems: 'center'},
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#111827", },
  description: { fontSize: 16, lineHeight: 24, color: "#4B5563" },
  ticketTypeContainer: { backgroundColor: "#F9FAFB", borderRadius: 8, padding: 12, marginBottom: 12 },
  ticketHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  ticketName: { fontSize: 16, fontWeight: "600", color: "#1F2937" },
  ticketPrice: { fontSize: 16, fontWeight: "bold", color: "#4B5563" },
  progressBarContainer: { height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, overflow: "hidden", marginTop: 8 },
  progressBar: { height: "100%", backgroundColor: "#3B82F6", borderRadius: 4 },
  ticketRemainingText: { fontSize: 12, color: '#6B7280', textAlign: 'right', marginTop: 4, },
  viewBookingsButtonFullWidth: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginTop: 12, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8 },
  viewBookingsText: { fontSize: 14, color: '#3B82F6', fontWeight: '500', marginRight: 4 },
  dataMissingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30, paddingHorizontal: 10, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  dataMissingText: { marginTop: 12, fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  dataMissingTextSmall: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 8, fontStyle: 'italic', paddingVertical: 10 },
  warningTextSmall: { fontSize: 13, color: '#F59E0B', textAlign: 'center', marginTop: 4, },
  analyticItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingVertical: 4 },
  chartContainer: { marginTop: 16, alignItems: 'center', marginBottom: 16 },
  chartTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8, textAlign: 'center' },
  chartStyle: { marginVertical: 8, borderRadius: 8 },
  actionButtons: { flexDirection: "row", marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  editButtonFullWidth: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(59, 130, 246, 0.1)", paddingVertical: 12, borderRadius: 8, },
  editButtonText: { color: "#3B82F6", fontWeight: "600", marginLeft: 8, fontSize: 16 },
  costSection: {
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  costTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  costDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  costTotalAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
});

export default EventDetailScreen;