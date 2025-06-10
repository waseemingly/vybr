import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity,
  Image, Alert, RefreshControl, ScrollView, Dimensions, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase'; // Adjust path if necessary
import { useAuth } from '@/hooks/useAuth'; // Adjust path if necessary
import { APP_CONSTANTS } from '@/config/constants'; // Adjust path if necessary
import ImageSwiper from '@/components/ImageSwiper'; // Import ImageSwiper

// --- Constants for Web Layout ---
const CARDS_PER_ROW_WEB = 4;
const CARD_MARGIN_WEB = 16;

// Type for Attended Event Data + User Rating
interface AttendedEvent {
  event_id: string;
  title: string;
  poster_urls: string[];
  event_datetime: string;
  location_text: string | null;
  organizer_name: string | null;
  organizer_id: string | null;
  user_rating: number | null;
  rating_id: string | null;
  tags_genres: string[];
  tags_artists: string[];
}

// Simple Star Rating Component
interface StarRatingProps {
  rating: number | null;
  maxRating?: number;
  onRate: (newRating: number) => void;
  disabled?: boolean;
  size?: number;
  style?: object;
}

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  onRate,
  disabled = false,
  size = 28,
  style = {},
}) => {
  const stars = [];
  for (let i = 1; i <= maxRating; i++) {
    stars.push(
      <TouchableOpacity
        key={i}
        disabled={disabled}
        onPress={() => !disabled && onRate(i)}
        style={styles.starButton}
      >
        <Feather
          name="star"
          size={size}
          color={rating !== null && i <= rating ? APP_CONSTANTS.COLORS.WARNING : '#D1D5DB'}
        />
      </TouchableOpacity>
    );
  }
  return <View style={[styles.starContainer, style]}>{stars}</View>;
};


const AttendedEventsScreen = () => {
  const navigation = useNavigation();
  const { session } = useAuth();
  const [attendedEvents, setAttendedEvents] = useState<AttendedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [ratingSubmitting, setRatingSubmitting] = useState<Record<string, boolean>>({}); // Track submission state per event

  const userId = session?.user?.id;

  const fetchAttendedEvents = useCallback(async () => {
    if (!userId) {
        setError("You must be logged in to view attended events.");
        setLoading(false);
        setRefreshing(false);
        return;
    }
    if (!refreshing) setLoading(true);
    setError(null);

    try {
        const now = new Date().toISOString();

        // 1. Fetch confirmed bookings for the user
        const { data: bookings, error: bookingError } = await supabase
            .from('event_bookings')
            .select('event_id')
            .eq('user_id', userId)
            .eq('status', 'CONFIRMED');

        if (bookingError) throw bookingError;
        if (!bookings || bookings.length === 0) {
            setAttendedEvents([]);
            setLoading(false);
            setRefreshing(false);
            return;
        }

        const bookedEventIds = bookings.map(b => b.event_id);

        // 2. Fetch details for past events (including organizer_id)
        const { data: pastEventsData, error: eventsError } = await supabase
            .from('events')
            .select(`
                id,
                title,
                poster_urls,
                event_datetime,
                location_text,
                organizer_id,
                tags_genres,
                tags_artists
            `)
            .in('id', bookedEventIds)
            .lt('event_datetime', now)
            .order('event_datetime', { ascending: false });

        if (eventsError) throw eventsError;

        if (!pastEventsData || pastEventsData.length === 0) {
             setAttendedEvents([]);
        } else {
            const pastEventIds = pastEventsData.map(e => e.id);
            const organizerIds = [...new Set(pastEventsData.map(e => e.organizer_id).filter(id => !!id))] as string[]; // Get unique, non-null organizer IDs

            // 3. Fetch Organizer Profiles separately
            let organizerProfilesMap = new Map<string, { companyName: string | null }>();
            if (organizerIds.length > 0) {
                const { data: profilesData, error: profilesError } = await supabase
                    .from('organizer_profiles')
                    .select('user_id, company_name')
                    .in('user_id', organizerIds);

                if (profilesError) throw profilesError;
                
                if (profilesData) {
                    profilesData.forEach(p => {
                         if (p.user_id) {
                              organizerProfilesMap.set(p.user_id, { companyName: p.company_name });
                         }
                    });
                }
            }

            // 4. Fetch existing ratings for these past events
            const { data: ratingsData, error: ratingsError } = await supabase
                .from('event_ratings')
                .select('id, event_id, rating')
                .eq('user_id', userId)
                .in('event_id', pastEventIds);

            if (ratingsError) {
                console.warn("Error fetching ratings:", ratingsError.message);
            }

            const ratingsMap = new Map<string, { rating: number; id: string }>();
            if (ratingsData) {
                ratingsData.forEach(r => ratingsMap.set(r.event_id, { rating: r.rating, id: r.id }));
            }

            // 5. Map data together
            const mappedEvents: AttendedEvent[] = pastEventsData.map((event: any) => {
                 const organizerProfileData = organizerProfilesMap.get(event.organizer_id);
                 const companyName = organizerProfileData?.companyName ?? 'Unknown Organizer';

                 return {
                     event_id: event.id,
                     title: event.title ?? 'Untitled Event',
                     poster_urls: event.poster_urls?.length > 0 ? event.poster_urls : [],
                     event_datetime: event.event_datetime,
                     location_text: event.location_text ?? 'N/A',
                     organizer_name: companyName,
                     organizer_id: event.organizer_id,
                     user_rating: ratingsMap.get(event.id)?.rating ?? null,
                     rating_id: ratingsMap.get(event.id)?.id ?? null,
                     tags_genres: event.tags_genres ?? [],
                     tags_artists: event.tags_artists ?? [],
                 };
             });
            setAttendedEvents(mappedEvents);
        }

    } catch (err: any) {
        // Error handling... Keep existing error handling
        console.error("Error fetching attended events:", err);
        // Use the specific error message if possible
        const displayError = err.message.includes('relationship') 
             ? "Database relationship error. Could not load organizer names."
             : `Failed to load events: ${err.message}`;
        setError(displayError); 
        setAttendedEvents([]);
    } finally {
        // Finally block... Keep existing logic
        setLoading(false);
        setRefreshing(false);
    }
  }, [userId, refreshing]);

  useFocusEffect(useCallback(() => { fetchAttendedEvents(); }, [fetchAttendedEvents]));
  const onRefresh = useCallback(() => { setRefreshing(true); }, []);

  // Function to handle rating submission
  const handleRateEvent = async (eventId: string, ratingId: string | null, newRating: number) => {
    if (!userId) return;

    setRatingSubmitting(prev => ({ ...prev, [eventId]: true })); // Start submitting indicator

    try {
      const ratingData = {
        user_id: userId,
        event_id: eventId,
        rating: newRating,
      };

      let error;
      if (ratingId) {
        // Update existing rating
        const { error: updateError } = await supabase
          .from('event_ratings')
          .update({ rating: newRating, updated_at: new Date().toISOString() })
          .eq('id', ratingId);
        error = updateError;
      } else {
        // Insert new rating
        const { error: insertError } = await supabase
          .from('event_ratings')
          .insert(ratingData);
        error = insertError;
      }

      if (error) {
        throw error;
      }

      // Optimistically update the UI or re-fetch
      setAttendedEvents(prevEvents =>
        prevEvents.map(event =>
          event.event_id === eventId
            ? { ...event, user_rating: newRating, rating_id: ratingId ?? 'temp' } // Update rating, handle potential new ID later if needed
            : event
        )
      );
       // Optionally re-fetch to get the correct rating_id if it was an insert
       if (!ratingId) {
           await fetchAttendedEvents(); // Re-fetch to ensure rating_id is updated
       }


    } catch (err: any) {
      console.error("Error submitting rating:", err);
      Alert.alert("Error", `Could not submit rating: ${err.message}`);
    } finally {
      setRatingSubmitting(prev => ({ ...prev, [eventId]: false })); // End submitting indicator
    }
  };

  const formatDateTime = (isoString: string) => {
    if (!isoString) return { date: "N/A", time: "N/A" };
    try {
      const d = new Date(isoString);
      const date = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' });
      const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
      return { date, time };
    } catch (e) {
      return { date: "Invalid Date", time: "" };
    }
  };

  const renderEventItem = ({ item }: { item: AttendedEvent }) => {
    const { date, time } = formatDateTime(item.event_datetime);
    const isSubmitting = ratingSubmitting[item.event_id];
    const allTags = [...(item.tags_genres || []), ...(item.tags_artists || [])];

    const cardWidth = Platform.OS === 'web' 
        ? (Dimensions.get('window').width - (styles.listContentContainer.paddingHorizontal * 2) - CARD_MARGIN_WEB * (CARDS_PER_ROW_WEB - 1)) / CARDS_PER_ROW_WEB
        : Dimensions.get('window').width - (styles.listContentContainer.paddingHorizontal * 2);

    const imageDimension = cardWidth; // For 1:1 aspect ratio

    return (
      <View style={[styles.eventCard, Platform.OS === 'web' && styles.eventCardWeb]}>
         <ImageSwiper
            images={item.poster_urls}
            defaultImage={APP_CONSTANTS.DEFAULT_EVENT_IMAGE}
            containerStyle={[styles.eventImageContainer, { height: imageDimension }]}
            imageStyle={[styles.eventImage, { height: imageDimension, width: cardWidth }]}
            height={imageDimension}
         />
        <View style={styles.cardContent}>
            <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.cardOrganizerName} numberOfLines={1}>by {item.organizer_name || 'Unknown Organizer'}</Text>
            
            <View style={styles.tagsScrollContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsContainerCard}>
                    {allTags.length > 0 ? (
                        allTags.slice(0, 4).map((tag, i) => (
                            <View key={`${tag}-${i}-card`} style={styles.tagBadgeCard}>
                                <Text style={styles.tagTextCard}>{tag}</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noTagsTextCard}>No tags</Text>
                    )}
                    {allTags.length > 4 && <Text style={styles.tagTextCard}>...</Text>}
                </ScrollView>
            </View>
            
            <View style={styles.eventInfoRow}>
                <Feather name="calendar" size={14} color="#6B7280" />
                <Text style={styles.eventInfoText}>{date}</Text>
            </View>
            <View style={styles.eventInfoRow}>
                <Feather name="clock" size={14} color="#6B7280" />
                <Text style={styles.eventInfoText}>{time}</Text>
            </View>
             <View style={styles.eventInfoRow}>
                <Feather name="map-pin" size={14} color="#6B7280" />
                <Text style={styles.eventInfoText}>{item.location_text}</Text>
            </View>
        </View>

        <View style={styles.cardFooter}>
            <View style={styles.ratingContainer}>
                <Text style={styles.ratingLabel}>Your Rating</Text>
                <StarRating
                    rating={item.user_rating}
                    onRate={(newRating) => handleRateEvent(item.event_id, item.rating_id, newRating)}
                    disabled={isSubmitting}
                    size={22}
                />
            </View>
            {isSubmitting && <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} />}
        </View>
      </View>
    );
  };

  const renderListEmpty = () => (
    <View style={styles.centeredContainer}>
      <Feather name="calendar" size={40} color={APP_CONSTANTS.COLORS.DISABLED} style={styles.emptyStateIcon} />
      <Text style={styles.emptyStateText}>No Past Attended Events Found</Text>
      <Text style={styles.emptySubText}>Events you've attended will appear here after they happen.</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="chevron-left" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attended Events</Text>
        <View style={{ width: 28 }} />
      </View>
      {loading && !refreshing ? (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
        </View>
      ) : error ? (
        <View style={styles.centeredContainer}>
          <Feather name="alert-circle" size={40} color={APP_CONSTANTS.COLORS.ERROR} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchAttendedEvents}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={attendedEvents}
          renderItem={renderEventItem}
          keyExtractor={(item) => item.event_id}
          ListEmptyComponent={renderListEmpty}
          contentContainerStyle={styles.listContentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[APP_CONSTANTS.COLORS.PRIMARY]}/>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
      padding: 4,
  },
  headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#111827',
  },
  listContentContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexGrow: 1, // Allow content to grow
    ...(Platform.OS === 'web' ? { 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        justifyContent: 'center', 
    } : {})
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  eventCard: {
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
  eventCardWeb: {
    width: (Dimensions.get('window').width - 16 * 2 - CARD_MARGIN_WEB * (CARDS_PER_ROW_WEB -1) ) / CARDS_PER_ROW_WEB,
    marginHorizontal: CARD_MARGIN_WEB / 2,
    marginBottom: CARD_MARGIN_WEB,
  },
  eventImageContainer: {
    width: "100%",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  eventImage: {
    width: "100%",
    backgroundColor: '#F3F4F6',
  },
  cardContent: {
    padding: 16,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  cardOrganizerName: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 10,
  },
  tagsScrollContainer: {
    marginBottom: 12,
  },
  tagsContainerCard: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: 'center',
  },
  tagBadgeCard: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 0,
  },
  tagTextCard: {
    fontSize: 12,
    color: "#1E3A8A",
    fontWeight: '500',
  },
  noTagsTextCard: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  eventInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  eventInfoText: {
    fontSize: 14,
    color: "#6B7280",
    marginLeft: 8,
    flexShrink: 1,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  ratingContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  starContainer: {
    flexDirection: 'row',
  },
  starButton: {
    paddingHorizontal: 4,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONSTANTS.COLORS.ERROR,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyStateIcon: {
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4B5563',
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: '80%',
  },
});

export default AttendedEventsScreen; 