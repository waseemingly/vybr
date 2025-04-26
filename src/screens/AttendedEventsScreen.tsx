import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity,
  Image, Alert, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase'; // Adjust path if necessary
import { useAuth } from '@/hooks/useAuth'; // Adjust path if necessary
import { APP_CONSTANTS } from '@/config/constants'; // Adjust path if necessary

// Type for Attended Event Data + User Rating
interface AttendedEvent {
  event_id: string;
  title: string;
  poster_url: string | null;
  event_datetime: string;
  location_text: string | null;
  organizer_name: string | null; // Fetch organizer name if needed
  user_rating: number | null; // User's rating for this event (1-5)
  rating_id: string | null; // ID of the rating record if it exists
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
          style={rating !== null && i <= rating ? styles.starFilled : styles.starOutline} // Add fill for selected stars
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
                organizer_id 
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

                if (profilesError) {
                    console.warn("Error fetching organizer profiles:", profilesError.message);
                } else if (profilesData) {
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
                     poster_url: event.poster_urls?.[0] ?? APP_CONSTANTS.DEFAULT_EVENT_IMAGE ?? null,
                     event_datetime: event.event_datetime,
                     location_text: event.location_text ?? 'N/A',
                     organizer_name: companyName,
                     user_rating: ratingsMap.get(event.id)?.rating ?? null,
                     rating_id: ratingsMap.get(event.id)?.id ?? null,
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
      Alert.alert('Rating Failed', `Could not submit rating: ${err.message}`);
    } finally {
      setRatingSubmitting(prev => ({ ...prev, [eventId]: false })); // Stop submitting indicator
    }
  };


  const renderEventItem = ({ item }: { item: AttendedEvent }) => {
    const isSubmitting = ratingSubmitting[item.event_id] ?? false;
    const eventDate = new Date(item.event_datetime);
    const formattedDate = eventDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

    return (
      <View style={styles.eventCard}>
        <Image source={{ uri: item.poster_url || undefined }} style={styles.eventImage} />
        <View style={styles.eventDetails}>
          <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.eventOrganizer}>{item.organizer_name}</Text>
          <Text style={styles.eventDate}>{formattedDate}</Text>
          <View style={styles.ratingSection}>
             <Text style={styles.ratingLabel}>Your Rating:</Text>
             {isSubmitting ? (
                <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} style={{marginLeft: 10}} />
             ) : (
                 <StarRating
                     rating={item.user_rating}
                     onRate={(newRating) => handleRateEvent(item.event_id, item.rating_id, newRating)}
                     disabled={isSubmitting}
                 />
             )}
           </View>
        </View>
      </View>
    );
  };

  const renderListEmpty = () => (
    <View style={styles.centered}>
      <Feather name="calendar" size={40} color={APP_CONSTANTS.COLORS.DISABLED} />
      <Text style={styles.emptyText}>No Past Attended Events Found</Text>
      <Text style={styles.emptySubText}>Events you've booked tickets for and have passed will appear here.</Text>
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {loading && !refreshing ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} /></View>
      ) : error ? (
        <View style={styles.centered}>
            <Feather name="alert-circle" size={40} color={APP_CONSTANTS.COLORS.WARNING} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchAttendedEvents}>
                 <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={attendedEvents}
          renderItem={renderEventItem}
          keyExtractor={(item) => item.event_id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderListEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[APP_CONSTANTS.COLORS.PRIMARY]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: 'white',
  },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, marginTop: 50 },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#6B7280', marginTop: 15, textAlign: 'center' },
  emptySubText: { fontSize: 14, color: '#9CA3AF', marginTop: 8, textAlign: 'center', maxWidth: '80%' },
  errorText: { fontSize: 16, color: '#DC2626', marginTop: 10, textAlign: 'center' },
  retryButton: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginTop: 15 },
  retryButtonText: { color: '#FFF', fontWeight: '600' },
  listContent: { paddingVertical: 16, paddingHorizontal: 16 },
  eventCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden', // Ensure image corners are rounded if needed
  },
  eventImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#E5E7EB', // Placeholder color
  },
  eventDetails: { padding: 12 },
  eventTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  eventOrganizer: { fontSize: 13, color: '#6B7280', marginBottom: 6 },
  eventDate: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  ratingSection: {
     marginTop: 8,
     paddingTop: 12,
     borderTopWidth: 1,
     borderTopColor: '#F3F4F6',
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'space-between'
   },
  ratingLabel: { fontSize: 14, fontWeight: '500', color: '#374151', marginRight: 10 },
  // Star Rating Styles
  starContainer: { flexDirection: 'row' },
  starButton: { paddingHorizontal: 3 }, // Add some space between stars
  starFilled: { opacity: 1.0 }, // Make filled stars fully opaque
  starOutline: { opacity: 0.9 }, // Make outline slightly less opaque for contrast
});

export default AttendedEventsScreen; 