import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, ActivityIndicator, RefreshControl, TouchableOpacity, Image, TextInput } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { APP_CONSTANTS } from '@/config/constants';

interface Reservation {
  booking_id: string;
  booking_code: string | null;
  quantity: number;
  status: string;
  event_id: string;
  event_title: string;
  event_datetime: string;
  user_id: string;
  user_name: string;
  user_profile_picture: string | null;
}

interface Section {
  title: string; // Date string e.g., "June 26, 2024"
  data: Reservation[];
}

const DEFAULT_PROFILE_IMAGE = APP_CONSTANTS.DEFAULT_PROFILE_PIC || 'https://via.placeholder.com/100x100/D1D5DB/1F2937?text=N';

const OrganizerReservationsScreen = () => {
    const { organizerProfile } = useAuth();
    const navigation = useNavigation();
    const [sections, setSections] = useState<Section[]>([]);
    const [filteredSections, setFilteredSections] = useState<Section[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchReservations = useCallback(async () => {
        if (!organizerProfile?.user_id) {
            setError("Organizer profile not available.");
            setIsLoading(false);
            return;
        }

        if (!refreshing) setIsLoading(true);
        setError(null);

        try {
            // Step 1: Fetch all upcoming 'RESERVATION' type events for the organizer
            const today = new Date().toISOString();
            const { data: eventsData, error: eventsError } = await supabase
                .from('events')
                .select('id, title, event_datetime')
                .eq('organizer_id', organizerProfile.user_id)
                .eq('booking_type', 'RESERVATION')
                .gte('event_datetime', today)
                .order('event_datetime', { ascending: true });

            if (eventsError) throw eventsError;
            if (!eventsData || eventsData.length === 0) {
                setSections([]);
                return;
            }

            const eventIds = eventsData.map(e => e.id);

            // Step 2: Fetch all confirmed bookings for those events
            const { data: bookingsData, error: bookingsError } = await supabase
                .from('event_bookings')
                .select('id, event_id, user_id, quantity, status, booking_code')
                .in('event_id', eventIds)
                .eq('status', 'CONFIRMED');
            
            if (bookingsError) throw bookingsError;
            if (!bookingsData || bookingsData.length === 0) {
                setSections([]);
                return;
            }

            // Step 3: Fetch profiles for all users who made bookings
            const userIds = Array.from(new Set(bookingsData.map(b => b.user_id).filter(Boolean)));
            const profilesMap = new Map<string, { full_name: string, profile_picture: string | null }>();

            if (userIds.length > 0) {
                const { data: profilesData, error: profilesError } = await supabase
                    .from('music_lover_profiles')
                    .select('user_id, first_name, last_name, profile_picture')
                    .in('user_id', userIds as string[]);

                if (profilesError) {
                    console.warn("Could not fetch user profiles:", profilesError.message);
                } else {
                    profilesData?.forEach(p => {
                        profilesMap.set(p.user_id, {
                            full_name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown User',
                            profile_picture: p.profile_picture,
                        });
                    });
                }
            }

            // Step 4: Map and group reservations by date
            const eventsMap = new Map(eventsData.map(e => [e.id, { title: e.title, datetime: e.event_datetime }]));
            
            const reservations = bookingsData.map(booking => {
                const event = eventsMap.get(booking.event_id);
                const user = profilesMap.get(booking.user_id);
                return {
                    booking_id: booking.id,
                    booking_code: booking.booking_code,
                    quantity: booking.quantity,
                    status: booking.status,
                    event_id: booking.event_id,
                    event_title: event?.title || 'Unknown Event',
                    event_datetime: event?.datetime || '',
                    user_id: booking.user_id,
                    user_name: user?.full_name || 'Unknown User',
                    user_profile_picture: user?.profile_picture ?? null,
                };
            });

            const groupedByDate = reservations.reduce((acc, res) => {
                const date = new Date(res.event_datetime).toLocaleDateString(undefined, {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
                if (!acc[date]) {
                    acc[date] = [];
                }
                acc[date].push(res);
                return acc;
            }, {} as Record<string, Reservation[]>);

            const finalSections = Object.keys(groupedByDate).map(date => ({
                title: date,
                data: groupedByDate[date].sort((a,b) => new Date(a.event_datetime).getTime() - new Date(b.event_datetime).getTime()),
            })).sort((a,b) => new Date(a.title).getTime() - new Date(b.title).getTime());

            setSections(finalSections);

        } catch (err: any) {
            console.error("Failed to fetch reservations:", err);
            setError("Could not load reservations. Please try again.");
            setSections([]);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [organizerProfile?.user_id, refreshing]);

    useFocusEffect(
        useCallback(() => {
            fetchReservations();
        }, [fetchReservations])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchReservations();
    }, [fetchReservations]);

    // Handle Search
    React.useEffect(() => {
        if (!searchQuery) {
            setFilteredSections(sections);
            return;
        }
        const lowercasedQuery = searchQuery.toLowerCase();
        const filtered = sections.map(section => {
            const filteredData = section.data.filter(reservation => 
                reservation.user_name.toLowerCase().includes(lowercasedQuery) ||
                reservation.booking_code?.toLowerCase().includes(lowercasedQuery) ||
                reservation.event_title.toLowerCase().includes(lowercasedQuery)
            );
            return { ...section, data: filteredData };
        }).filter(section => section.data.length > 0);

        setFilteredSections(filtered);
    }, [searchQuery, sections]);


    const renderItem = ({ item }: { item: Reservation }) => (
        <View style={styles.bookingItem}>
            <Image
              source={{ uri: item.user_profile_picture || DEFAULT_PROFILE_IMAGE }}
              style={styles.profilePic}
            />
            <View style={styles.bookingInfo}>
              <Text style={styles.userName}>{item.user_name}</Text>
              <Text style={styles.ticketInfo}>{item.quantity} {item.quantity === 1 ? 'guest' : 'guests'} for {item.event_title}</Text>
              {item.booking_code && (
                <View style={styles.codeContainer}>
                  <Feather name="tag" size={12} color="#6B7280" style={styles.codeIcon} />
                  <Text style={styles.codeText}>{item.booking_code}</Text>
                </View>
              )}
            </View>
        </View>
    );

    const renderSectionHeader = ({ section: { title } }: { section: Section }) => (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
        </View>
    );

    const renderEmpty = () => {
        if (isLoading) return null;
        if (error) {
            return (
                <View style={styles.centeredContainer}>
                    <Feather name="alert-circle" size={40} color="#F87171" />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        if (searchQuery && filteredSections.length === 0) {
             return (
                <View style={styles.centeredContainer}>
                    <Feather name="search" size={40} color="#6B7280" />
                    <Text style={styles.emptyText}>No Results Found</Text>
                    <Text style={styles.emptySubText}>No reservations match your search.</Text>
                </View>
            );
        }
        return (
            <View style={styles.centeredContainer}>
                <Feather name="bookmark" size={40} color="#6B7280" />
                <Text style={styles.emptyText}>No Upcoming Reservations</Text>
                <Text style={styles.emptySubText}>You don't have any reservations for your upcoming events yet.</Text>
            </View>
        );
    };

    if (isLoading) {
        return (
            <View style={styles.centeredContainer}>
                <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>All Reservations</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.searchContainer}>
                <Feather name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name, event, or code..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#9CA3AF"
                />
                 {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                        <Feather name="x" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                )}
            </View>

            <SectionList
                sections={filteredSections}
                keyExtractor={(item) => item.booking_id}
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                ListEmptyComponent={renderEmpty}
                contentContainerStyle={styles.listContentContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[APP_CONSTANTS.COLORS.PRIMARY]} />
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
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 10,
        paddingHorizontal: 12,
        margin: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        height: 48,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#1F2937',
        height: '100%',
    },
    clearButton: {
        padding: 4,
    },
    listContentContainer: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    sectionHeader: {
        paddingTop: 20,
        paddingBottom: 8,
        backgroundColor: '#F9FAFB',
    },
    sectionHeaderText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4B5563',
    },
    bookingItem: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    profilePic: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 16,
        backgroundColor: '#E5E7EB',
    },
    bookingInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
    },
    ticketInfo: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    codeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        alignSelf: 'flex-start',
    },
    codeIcon: {
        marginRight: 4,
    },
    codeText: {
        fontSize: 12,
        color: '#4B5563',
        fontWeight: '500',
        fontFamily: 'monospace',
    },
    centeredContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        marginTop: 50,
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
    errorText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#DC2626',
        marginTop: 10,
        textAlign: 'center',
    },
    retryButton: {
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginTop: 15,
    },
    retryButtonText: {
        color: '#FFF',
        fontWeight: '600',
    },
});

export default OrganizerReservationsScreen; 