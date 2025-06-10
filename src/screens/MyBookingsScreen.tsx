import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase'; // Adjust path as needed
import { useAuth } from '../hooks/useAuth'; // Adjust path as needed
import { APP_CONSTANTS } from '../config/constants'; // Adjust path as needed
import type { MainStackParamList } from '@/navigation/AppNavigator'; // Adjust path
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type MyBookingsScreenNavigationProp = NativeStackNavigationProp<MainStackParamList, 'MyBookingsScreen'>;

interface UserBooking {
  booking_id: string;
  booking_code: string;
  event_id: string;
  event_title: string;
  event_datetime: string;
  event_poster: string | null;
  quantity: number;
}

const DEFAULT_EVENT_IMAGE = "https://via.placeholder.com/800x450/D1D5DB/1F2937?text=No+Image";

const MyBookingsScreen = () => {
  const navigation = useNavigation<MyBookingsScreenNavigationProp>();
  const { session } = useAuth();
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserBookings = useCallback(async () => {
    if (!session?.user) {
      setError("You must be logged in to see your bookings.");
      setIsLoading(false);
      return;
    }
    setError(null);

    try {
      // We only want to show bookings for events that haven't happened yet.
      const { data, error: fetchError } = await supabase
        .from('event_bookings')
        .select(`
          id,
          booking_code,
          quantity,
          event:events!inner(
            id,
            title,
            event_datetime,
            poster_urls
          )
        `)
        .eq('user_id', session.user.id)
        .eq('status', 'CONFIRMED')
        .gt('events.event_datetime', new Date().toISOString())
        .order('event_datetime', { foreignTable: 'events', ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      // --- DEBUG LOG ---
      console.log('[MyBookingsScreen] Raw booking data from Supabase:', JSON.stringify(data, null, 2));
      // --- END DEBUG LOG ---

      const mappedBookings: UserBooking[] = data.map((b: any) => ({
        booking_id: b.id,
        booking_code: b.booking_code,
        event_id: b.event.id,
        event_title: b.event.title,
        event_datetime: b.event.event_datetime,
        event_poster: b.event.poster_urls?.[0] || DEFAULT_EVENT_IMAGE,
        quantity: b.quantity,
      }));

      // Robust client-side sorting to guarantee order
      mappedBookings.sort((a, b) => new Date(a.event_datetime).getTime() - new Date(b.event_datetime).getTime());

      setBookings(mappedBookings);

    } catch (err: any) {
      console.error("[MyBookingsScreen] Error fetching bookings:", err);
      setError("Could not load your bookings. Please try again.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    setIsLoading(true);
    fetchUserBookings();
  }, [fetchUserBookings]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchUserBookings();
  };
  
  const formatDateTime = (isoString: string) => {
    if (!isoString) return { date: "N/A", time: "N/A" };
    try {
      const d = new Date(isoString);
      const date = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
      return { date, time };
    } catch (e) {
      return { date: "Invalid Date", time: "" };
    }
  };

  const renderBookingItem = ({ item }: { item: UserBooking }) => {
    const { date, time } = formatDateTime(item.event_datetime);

    return (
      <View style={styles.bookingCard}>
          <View style={styles.cardHeader}>
              <Text style={styles.eventTitle} numberOfLines={2}>{item.event_title}</Text>
          </View>
          <View style={styles.cardBody}>
              <View style={styles.bookingDetails}>
                  <View style={styles.detailRow}>
                      <Feather name="calendar" size={14} color="#6B7280" />
                      <Text style={styles.detailText}>{date} at {time}</Text>
                  </View>
                  <View style={styles.detailRow}>
                      <Feather name="users" size={14} color="#6B7280" />
                      <Text style={styles.detailText}>{item.quantity} {item.quantity === 1 ? 'Ticket' : 'Tickets'}</Text>
                  </View>
              </View>
              <View style={styles.codeContainer}>
                  <Text style={styles.codeLabel}>Booking Code</Text>
                  <Text style={styles.bookingCode}>{item.booking_code}</Text>
              </View>
          </View>
      </View>
    );
  };
  
  const ListEmptyComponent = () => (
     <View style={styles.centeredContainer}>
        <Feather name="calendar" size={48} color="#D1D5DB" />
        <Text style={styles.emptyText}>You have no upcoming bookings.</Text>
        <Text style={styles.emptySubText}>Book tickets for an event to see them here.</Text>
      </View>
  )

  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
        <Text style={styles.loadingText}>Loading Your Bookings...</Text>
      </View>
    );
  }

  if (error && !bookings.length) {
    return (
      <View style={styles.centeredContainer}>
        <Feather name="alert-circle" size={48} color={APP_CONSTANTS.COLORS.ERROR} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchUserBookings}>
            <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Feather name="chevron-left" size={28} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Bookings</Text>
            <View style={{ width: 28 }} />
        </View>
        <FlatList
            data={bookings}
            renderItem={renderBookingItem}
            keyExtractor={(item) => item.booking_id}
            contentContainerStyle={styles.listContentContainer}
            ListEmptyComponent={!isLoading && ListEmptyComponent}
            refreshControl={
                <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={onRefresh}
                    colors={[APP_CONSTANTS.COLORS.PRIMARY]}
                    tintColor={APP_CONSTANTS.COLORS.PRIMARY}
                />
            }
        />
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
        padding: 16,
        flexGrow: 1,
    },
    bookingCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#E5E7EB'
    },
    cardHeader: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    eventTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
    },
    cardBody: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    bookingDetails: {
        flex: 1,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    detailText: {
        fontSize: 14,
        color: '#4B5563',
        marginLeft: 8,
    },
    codeContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: 16,
        borderLeftWidth: 1,
        borderLeftColor: '#E5E7EB',
    },
    codeLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    bookingCode: {
        fontSize: 20,
        fontWeight: 'bold',
        color: APP_CONSTANTS.COLORS.PRIMARY,
        letterSpacing: 2,
    },
    centeredContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#F9FAFB',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#4B5563',
    },
    errorText: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '600',
        color: '#DC2626',
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
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#4B5563',
        marginTop: 16,
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

export default MyBookingsScreen; 