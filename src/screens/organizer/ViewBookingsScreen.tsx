import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase'; // Adjust path as needed
import { APP_CONSTANTS } from '../../config/constants'; // Adjust path as needed

// Assuming MainStackParamList is defined in your AppNavigator
// You might need to import it or a relevant part of it.
// For now, defining local param list for this screen.
type OrganizerStackParamList = {
  ViewBookings: { eventId: string; eventTitle: string };
  // ... other screens in this stack if any direct navigation from here
};

type ViewBookingsScreenRouteProp = RouteProp<OrganizerStackParamList, 'ViewBookings'>;
type ViewBookingsScreenNavigationProp = NativeStackNavigationProp<OrganizerStackParamList, 'ViewBookings'>;

interface BookingInfo {
  id: string; // booking id
  user_id: string;
  name: string; // User's full name or display name
  profile_picture_url?: string | null;
  quantity: number;
  status: string; // e.g., CONFIRMED
  checked_in: boolean; // Added for check-in status
  booking_code: string | null;
}

const DEFAULT_PROFILE_IMAGE = APP_CONSTANTS.DEFAULT_PROFILE_PIC || 'https://via.placeholder.com/100x100/D1D5DB/1F2937?text=N';

const ViewBookingsScreen = () => {
  const route = useRoute<ViewBookingsScreenRouteProp>();
  const navigation = useNavigation<ViewBookingsScreenNavigationProp>();
  const { eventId, eventTitle } = route.params;

  const [bookings, setBookings] = useState<BookingInfo[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<BookingInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Removed title setting to maintain static "Vybr Web" title
  }, [navigation, eventTitle]);

  const fetchBookings = useCallback(async () => {
    if (!eventId) {
      setError("Event ID is missing.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Fetch confirmed bookings for the event, including checked_in status
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('event_bookings')
        .select('id, user_id, quantity, status, checked_in, booking_code') // Added checked_in and booking_code
        .eq('event_id', eventId)
        .eq('status', 'CONFIRMED');

      if (bookingsError) {
        throw bookingsError;
      }
      console.log('[ViewBookingsScreen] Fetched bookingsData:', bookingsData);

      if (bookingsData && bookingsData.length > 0) {
        const userIds = Array.from(new Set(bookingsData.map(b => b.user_id))).filter(id => id != null) as string[];
        console.log('[ViewBookingsScreen] Extracted userIds:', userIds);

        let profilesMap = new Map<string, { full_name: string | null, profile_picture: string | null }>();

        if (userIds.length > 0) {
          // Fetch profiles from music_lover_profiles table (profiles table doesn't exist)
          const { data: mlpData, error: mlpError } = await supabase
            .from('music_lover_profiles')
            .select('user_id, first_name, last_name, profile_picture')
            .in('user_id', userIds);
          
          console.log('[ViewBookingsScreen] Fetched data from music_lover_profiles:', mlpData);
          
          if (mlpError) {
            console.warn("[ViewBookingsScreen] Failed to fetch some music lover profiles:", mlpError.message);
          }

          if (mlpData && mlpData.length > 0) {
            mlpData.forEach(profile => {
              if (profile.user_id) {
                // Combine first_name and last_name
                const fullName = [profile.first_name, profile.last_name]
                  .filter(Boolean)
                  .join(' ');
                  
                profilesMap.set(profile.user_id, { 
                  full_name: fullName || 'Unknown User',
                  profile_picture: profile.profile_picture
                });
              }
            });
          }
        }
        
        console.log('[ViewBookingsScreen] Populated profilesMap:', 
          Array.from(profilesMap.entries()).map(([key, value]) => ({key, name: value.full_name})));

        const mappedBookings = bookingsData.map((booking: any) => {
          const profile = booking.user_id ? profilesMap.get(booking.user_id) : null;
          console.log(`[ViewBookingsScreen] Mapping booking for user_id ${booking.user_id}, profile found:`, 
            profile ? {name: profile.full_name, pic: profile.profile_picture} : 'No profile found');
            
          return {
            id: booking.id,
            user_id: booking.user_id,
            name: profile?.full_name || 'Unknown User',
            profile_picture_url: profile?.profile_picture ?? DEFAULT_PROFILE_IMAGE,
            quantity: booking.quantity || 0,
            status: booking.status,
            checked_in: booking.checked_in || false, // Ensure default if null
            booking_code: booking.booking_code,
          };
        });
        setBookings(mappedBookings);
      } else {
        setBookings([]);
      }
    } catch (err: any) {
      console.error("[ViewBookingsScreen] Failed to fetch bookings:", err);
      setError(`Failed to load bookings: ${err.message || 'Unknown error'}`);
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredBookings(bookings);
    } else {
      const lowercasedQuery = searchQuery.toLowerCase();
      const filtered = bookings.filter(booking => {
        const nameMatch = booking.name.toLowerCase().includes(lowercasedQuery);
        const codeMatch = booking.booking_code?.toLowerCase().includes(lowercasedQuery);
        return nameMatch || codeMatch;
      });
      setFilteredBookings(filtered);
    }
  }, [searchQuery, bookings]);

  const handleToggleCheckIn = async (bookingId: string, currentCheckedInStatus: boolean) => {
    console.log(`[ViewBookingsScreen] Toggling check-in for bookingId: ${bookingId} from ${currentCheckedInStatus} to ${!currentCheckedInStatus}`);
    // Optimistically update both lists
    const updater = (b: BookingInfo) => b.id === bookingId ? { ...b, checked_in: !currentCheckedInStatus } : b;
    setBookings(prev => prev.map(updater));
    setFilteredBookings(prev => prev.map(updater));

    // Update in Supabase
    const { error: updateError } = await supabase
      .from('event_bookings')
      .update({ checked_in: !currentCheckedInStatus })
      .eq('id', bookingId);

    if (updateError) {
      console.error("[ViewBookingsScreen] Failed to update check-in status in Supabase:", updateError);
      // Revert optimistic update on error
      setBookings(prev => prev.map(updater));
      setFilteredBookings(prev => prev.map(updater));
      Alert.alert("Error", "Could not update check-in status. Please try again.");
    }
  };

  const renderBookingItem = ({ item }: { item: BookingInfo }) => {
    // Verify the profile picture URL for debugging
    console.log(`[ViewBookingsScreen:renderBookingItem] Profile picture URL for ${item.user_id}:`, item.profile_picture_url);
    
    return (
      <View style={styles.bookingItem}>
        <Image
          source={{ uri: item.profile_picture_url || DEFAULT_PROFILE_IMAGE }}
          style={styles.profilePic}
          onError={(e) => {
            console.log(`[ViewBookingsScreen] Image load error for ${item.user_id}:`, e.nativeEvent.error);
          }}
        />
        <View style={styles.bookingInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.ticketInfo}>{item.quantity} {item.quantity === 1 ? 'ticket' : 'tickets'}</Text>
          {item.booking_code && (
            <View style={styles.codeContainer}>
              <Feather name="tag" size={12} color="#6B7280" style={styles.codeIcon} />
              <Text style={styles.codeText}>{item.booking_code}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => handleToggleCheckIn(item.id, item.checked_in)} style={styles.checkboxContainer}>
          <Feather 
              name={item.checked_in ? "check-square" : "square"} 
              size={24} 
              color={item.checked_in ? APP_CONSTANTS.COLORS.SUCCESS || '#10B981' : APP_CONSTANTS.COLORS.PRIMARY || '#3B82F6'} 
          />
        </TouchableOpacity>
      </View>
    )
  };

  const renderHeaderWithBack = () => (
    <View style={styles.headerRow}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Feather name="chevron-left" size={24} color="#111827" />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{eventTitle}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centeredContainer} edges={['top', 'bottom', 'left', 'right']}>
        {renderHeaderWithBack()}
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY || "#3B82F6"} />
          <Text style={styles.loadingText}>Loading attendees...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centeredContainer} edges={['top', 'bottom', 'left', 'right']}>
        {renderHeaderWithBack()}
        <View style={styles.centeredContent}>
          <Feather name="alert-circle" size={40} color="#F87171" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchBookings} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (bookings.length === 0) {
    return (
      <SafeAreaView style={styles.centeredContainer} edges={['top', 'bottom', 'left', 'right']}>
        {renderHeaderWithBack()}
        <View style={styles.centeredContent}>
          <Feather name="users" size={40} color="#6B7280" />
          <Text style={styles.emptyText}>No confirmed bookings for this event yet.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      {renderHeaderWithBack()}
      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or code..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <FlatList
        data={filteredBookings}
        renderItem={renderBookingItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContentContainer}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFF',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerSpacer: {
    width: 80,
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#4B5563',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
    marginTop: 10,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 10,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY || '#3B82F6',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
  listContentContainer: {
    paddingVertical: 8,
  },
  bookingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  profilePic: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
    backgroundColor: '#E5E7EB', // Placeholder background
  },
  bookingInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  ticketInfo: {
    fontSize: 14,
    color: '#4B5563',
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  codeIcon: {
    marginRight: 4,
  },
  codeText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
    letterSpacing: 1,
  },
  checkboxContainer: {
    padding: 8, // For easier touch
    marginLeft: 12,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6', // Light separator line
    marginLeft: 16 + 50 + 16, // Align with text, after image and margin
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#111827',
  },
});

export default ViewBookingsScreen; 