import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, 
  TouchableOpacity, RefreshControl, Dimensions, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { APP_CONSTANTS } from '../../config/constants';
import { shouldUseSGD, getOrganizerPrimaryCurrency, convertOrganizerCosts, formatPriceWithCurrency } from '../../utils/currencyUtils'; // Add currency utilities
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getCurrencyForCountry, convertCurrency } from '../../utils/currencyUtils';

// Navigation types
type NavigationProp = NativeStackNavigationProp<any>;

// Types for various analytics data
interface MonthlyExpenditure {
  month: string;
  impressionCost: number;
  bookingCost: number;
  totalCost: number;
  currency: string; // Add currency info
  originalCosts?: { // For tracking original currencies
    impressionCost: { amount: number; currency: string };
    bookingCost: { amount: number; currency: string };
  };
}

interface EventRevenue {
  eventId: string;
  eventName: string;
  revenue: number;
  attendeeCount: number;
  bookingType: 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null;
  currency: string; // Add currency info
  originalRevenue?: { amount: number; currency: string }; // For tracking original currency
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
  currency: string; // Add currency info
}

interface EventRating {
  eventId: string;
  eventName: string;
  averageRating: number;
  numberOfRatings: number;
}

interface PopularTag {
  tag: string;
  count: number;
}

interface AnalyticsSummary {
  avgCostPerEvent: number;
  avgRevenuePerEvent: number;
  avgAttendeesPerEvent: number;
  avgImpressionsPerEvent: number;
  popularTags: PopularTag[];
  currency: string; // Add currency info
}

// New interface for separated booking counts
interface TicketsReservationsData {
  ticketedEvents: {
    eventId: string;
    eventName: string;
    ticketCount: number;
  }[];
  reservationEvents: {
    eventId: string;
    eventName: string;
    reservationCount: number;
  }[];
}

// New interface for impressions data
interface EventImpressionData {
  eventId: string;
  eventName: string;
  impressionCount: number;
}

// New interface for monthly aggregated data
interface MonthlyTrendData {
  month: string; // YYYY-MM
  count: number;
}

// Define chart configs
const screenWidth = Dimensions.get('window').width;
const chartWidth = screenWidth - 40; // Accounting for padding
const chartConfig = {
  backgroundColor: '#FFFFFF',
  backgroundGradientFrom: '#FFFFFF',
  backgroundGradientTo: '#FFFFFF',
  decimalPlaces: 2,
  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
  style: { borderRadius: 16 },
  propsForLabels: { fontSize: 10 },
  barPercentage: 0.7,
};

// Helper components
interface SectionProps {
  title: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  children: React.ReactNode;
  loading?: boolean;
}

const Section: React.FC<SectionProps> = ({ title, icon, children, loading = false }) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleContainer}>
        <Feather name={icon} size={20} color={APP_CONSTANTS.COLORS.PRIMARY} style={{ marginRight: 8 }} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {loading && <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} />}
    </View>
    <View style={styles.sectionContent}>
      {children}
    </View>
  </View>
);

const OverallAnalyticsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { session } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState('SGD');
  
  // Loading states
  const [loadingExpenditures, setLoadingExpenditures] = useState(false);
  const [loadingRevenues, setLoadingRevenues] = useState(false);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [loadingTicketsReservations, setLoadingTicketsReservations] = useState(false);
  const [loadingImpressions, setLoadingImpressions] = useState(false);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  
  // Data states
  const [monthlyExpenditures, setMonthlyExpenditures] = useState<MonthlyExpenditure[]>([]);
  const [eventRevenues, setEventRevenues] = useState<EventRevenue[]>([]);
  const [monthlyRevenues, setMonthlyRevenues] = useState<MonthlyRevenue[]>([]);
  const [eventRatings, setEventRatings] = useState<EventRating[]>([]);
  const [ticketsReservations, setTicketsReservations] = useState<TicketsReservationsData>({
    ticketedEvents: [],
    reservationEvents: []
  });
  const [eventImpressions, setEventImpressions] = useState<EventImpressionData[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrendData[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary>({
    avgCostPerEvent: 0,
    avgRevenuePerEvent: 0,
    avgAttendeesPerEvent: 0,
    avgImpressionsPerEvent: 0,
    popularTags: [],
    currency: 'SGD'
  });

  const organizerId = session?.user?.id;

  useEffect(() => {
    if (session?.user?.id) {
      initializeCurrency();
      fetchAllData();
    }
  }, [session]);

  const initializeCurrency = async () => {
    if (!session?.user?.id) return;
    
    try {
      const currency = await getOrganizerPrimaryCurrency(session.user.id);
      setDisplayCurrency(currency);
    } catch (error) {
      console.error('Error initializing currency:', error);
      setDisplayCurrency('SGD');
    }
  };

  const fetchAllData = async () => {
    if (!session?.user?.id) return;

    await Promise.all([
      fetchMonthlyExpenditure(),
      fetchEventRevenue(),
      fetchMonthlyRevenue(),
      fetchEventRatings(),
      fetchTicketsReservations(),
      fetchEventImpressions(),
      fetchMonthlyTrends(),
      fetchAnalyticsSummary(),
    ]);
  };

  const fetchMonthlyExpenditure = async () => {
    if (!session?.user?.id) return;
    
    setLoadingExpenditures(true);
    try {
      setHasError(false);

      // Generate all 12 months including the current month (matching original logic)
      const today = new Date();
      today.setMonth(today.getMonth() + 1);
      const last12Months = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        return { 
          year: d.getFullYear(), 
          month: d.getMonth(), 
          monthKey: d.toISOString().substring(0, 7) 
        };
      }).reverse(); // Oldest month first
      
      const firstMonthToConsider = last12Months[0].monthKey + "-01T00:00:00.000Z";
      const lastMonthToConsiderDate = new Date(last12Months[11].year, last12Months[11].month + 1, 0, 23, 59, 59, 999);
      const lastMonthToConsider = lastMonthToConsiderDate.toISOString();

      // Initialize empty data for all 12 months
      const expendituresMap: { [monthKey: string]: { impressionCost: number; bookingCost: number; totalCost: number; countries: Set<string> } } = {};
      last12Months.forEach(dateInfo => {
        expendituresMap[dateInfo.monthKey] = {
          impressionCost: 0,
          bookingCost: 0,
          totalCost: 0,
          countries: new Set()
        };
      });

      // 1. Fetch all events for the organizer to map event_id to its date and country
      const { data: allEventsData, error: alleventsError } = await supabase
        .from('events')
        .select('id, event_datetime, country')
        .eq('organizer_id', session.user.id);

      if (alleventsError) {
        console.error("Error fetching events for expenditures:", alleventsError);
        throw alleventsError;
      }
      
      if (allEventsData && allEventsData.length > 0) {
        const eventIdToInfoMap = new Map<string, { date: string; country: string }>();
        allEventsData.forEach(event => eventIdToInfoMap.set(event.id, { 
          date: event.event_datetime, 
          country: event.country || 'Singapore' 
        }));

        // 2. Fetch relevant event_impressions for the last 12 months
        const { data: impressionData, error: impressionError } = await supabase
          .from('event_impressions')
          .select('event_id, viewed_at')
          .in('event_id', allEventsData.map(e => e.id))
          .gte('viewed_at', firstMonthToConsider)
          .lte('viewed_at', lastMonthToConsider);

        if (impressionError) {
          console.error("Error fetching impression data:", impressionError);
        }

        // 3. Fetch relevant event_bookings for these events
        const { data: bookingData, error: bookingError } = await supabase
          .from('event_bookings')
          .select('event_id, quantity')
          .in('event_id', allEventsData.map(e => e.id))
          .eq('status', 'CONFIRMED');

        if (bookingError) {
          console.error("Error fetching booking data:", bookingError);
        }

        // Process impressions
        if (impressionData) {
          impressionData.forEach(imp => {
            const viewMonthKey = new Date(imp.viewed_at).toISOString().substring(0, 7);
            const eventInfo = eventIdToInfoMap.get(imp.event_id);
            if (expendituresMap[viewMonthKey] && eventInfo) {
              expendituresMap[viewMonthKey].impressionCost += 0.0075;
              expendituresMap[viewMonthKey].countries.add(eventInfo.country);
            }
          });
        }

        // Process bookings
        if (bookingData) {
          bookingData.forEach(booking => {
            const eventInfo = eventIdToInfoMap.get(booking.event_id);
            if (eventInfo) {
              const eventDate = new Date(eventInfo.date);
              // Check if event_datetime is within our 12 month window
              if (eventDate.toISOString() >= firstMonthToConsider && eventDate.toISOString() <= lastMonthToConsider) {
                const eventMonthKey = eventDate.toISOString().substring(0, 7);
                if (expendituresMap[eventMonthKey]) {
                  expendituresMap[eventMonthKey].bookingCost += (booking.quantity || 0) * 0.50;
                  expendituresMap[eventMonthKey].countries.add(eventInfo.country);
                }
              }
            }
          });
        }
      }
      
      // Convert to target currency and format for state
      const monthlyExpenditureData: MonthlyExpenditure[] = [];
      for (const [month, data] of Object.entries(expendituresMap)) {
        const shouldUseSGD = data.countries.size > 1;
        const targetCurrency = shouldUseSGD ? 'SGD' : displayCurrency;
        
        let impressionCost = data.impressionCost;
        let bookingCost = data.bookingCost;
        
        // Convert from SGD to target currency if needed
        if (targetCurrency !== 'SGD') {
          const convertedImpression = await convertCurrency(data.impressionCost, 'SGD', targetCurrency);
          const convertedBooking = await convertCurrency(data.bookingCost, 'SGD', targetCurrency);
          impressionCost = convertedImpression || data.impressionCost;
          bookingCost = convertedBooking || data.bookingCost;
        }

        monthlyExpenditureData.push({
        month,
          impressionCost,
          bookingCost,
          totalCost: impressionCost + bookingCost,
          currency: targetCurrency,
          originalCosts: {
            impressionCost: { amount: data.impressionCost, currency: 'SGD' },
            bookingCost: { amount: data.bookingCost, currency: 'SGD' }
          }
        });
      }

      setMonthlyExpenditures(monthlyExpenditureData.sort((a, b) => a.month.localeCompare(b.month)));
    } catch (error) {
      console.error("Error in fetchMonthlyExpenditure:", error);
      setHasError(true);
      
      // Even on error, provide empty data for all 12 months (matching original logic)
      const today = new Date();
      today.setMonth(today.getMonth() + 1);
      const last12Months = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        return d.toISOString().substring(0, 7);
      }).reverse();
      
      const emptyData = last12Months.map(month => ({
        month,
        impressionCost: 0,
        bookingCost: 0,
        totalCost: 0,
        currency: displayCurrency,
        originalCosts: {
          impressionCost: { amount: 0, currency: 'SGD' },
          bookingCost: { amount: 0, currency: 'SGD' }
        }
      }));
      
      setMonthlyExpenditures(emptyData);
    } finally {
      setLoadingExpenditures(false);
    }
  };

  const fetchEventRevenue = async () => {
    if (!session?.user?.id) return;

    setLoadingRevenues(true);
    try {
      setHasError(false);

      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

      // 1. Fetch events for the organizer within the current month with booking_type
      const { data: currentMonthEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, title, booking_type, event_datetime, country')
        .eq('organizer_id', session.user.id)
        .gte('event_datetime', firstDayOfMonth)
        .lte('event_datetime', lastDayOfMonth);

      if (eventsError) {
        console.error("Error fetching events for event revenues:", eventsError);
        throw eventsError;
      }

      if (!currentMonthEvents || currentMonthEvents.length === 0) {
        setEventRevenues([]);
        setTicketsReservations({ ticketedEvents: [], reservationEvents: [] });
        setEventImpressions([]);
        return;
      }

      // Initialize data structures for the events
      const eventIds = currentMonthEvents.map(event => event.id);
      
      interface EventRevenueMapItem {
        eventId: string;
        eventName: string;
        revenue: number;
        attendeeCount: number;
        bookingType: 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null;
        impressionCount: number;
        country: string;
        eventCurrency: string;
      }
      
      const eventRevenueMap: Record<string, EventRevenueMapItem> = {};

      // Process and categorize events by booking type
      currentMonthEvents.forEach(event => {
        const eventCurrency = getCurrencyForCountry(event.country || 'Singapore');
        eventRevenueMap[event.id] = { 
          eventId: event.id,
          eventName: event.title, 
          revenue: 0, 
          attendeeCount: 0,
          bookingType: event.booking_type,
          impressionCount: 0,
          country: event.country || 'Singapore',
          eventCurrency: eventCurrency
        };
      });

      // 2. Fetch ALL confirmed bookings for these events
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('event_bookings')
        .select('event_id, quantity, total_price_paid, status')
        .in('event_id', eventIds)
        .eq('status', 'CONFIRMED');

      if (bookingsError) {
        console.error("Error fetching bookings for event revenues:", bookingsError);
        throw bookingsError;
      }

      // 3. Fetch impressions for these events
      const { data: impressionsData, error: impressionsError } = await supabase
        .from('event_impressions')
        .select('event_id, id')
        .in('event_id', eventIds);

      if (impressionsError) {
        console.error("Error fetching impressions:", impressionsError);
      } else {
        // Count impressions per event
        if (impressionsData && impressionsData.length > 0) {
          impressionsData.forEach(impression => {
            if (eventRevenueMap[impression.event_id]) {
              eventRevenueMap[impression.event_id].impressionCount += 1;
            }
          });
        }
      }

      // Process each booking to aggregate revenue and attendance counts
      if (bookingsData && bookingsData.length > 0) {
        bookingsData.forEach(booking => {
          if (eventRevenueMap[booking.event_id]) {
            // Revenue is already in the correct currency (stored in event's local currency)
            eventRevenueMap[booking.event_id].revenue += (booking.total_price_paid || 0);
            
            // Add to attendee count regardless of payment
            eventRevenueMap[booking.event_id].attendeeCount += (booking.quantity || 0);
          }
        });
      }

      // Determine display currency for analytics
      const countries = new Set(Object.values(eventRevenueMap).map(e => e.country));
      const shouldUseSGD = countries.size > 1;
      const targetDisplayCurrency = shouldUseSGD ? 'SGD' : displayCurrency;

      // Convert revenue to display currency and create final arrays
      const eventRevenueData: EventRevenue[] = [];
      const ticketedEvents: { eventId: string; eventName: string; ticketCount: number }[] = [];
      const reservationEvents: { eventId: string; eventName: string; reservationCount: number }[] = [];
      const impressionEvents: { eventId: string; eventName: string; impressionCount: number }[] = [];

      for (const event of Object.values(eventRevenueMap)) {
        let displayRevenue = event.revenue;
        
        // Only convert if the event's currency is different from our target display currency
        if (event.revenue > 0 && event.eventCurrency !== targetDisplayCurrency) {
          const converted = await convertCurrency(event.revenue, event.eventCurrency, targetDisplayCurrency);
          displayRevenue = converted || event.revenue;
        }

        if (displayRevenue > 0) {
          eventRevenueData.push({
            eventId: event.eventId,
            eventName: event.eventName,
            revenue: displayRevenue,
            attendeeCount: event.attendeeCount,
            bookingType: event.bookingType,
            currency: targetDisplayCurrency,
            originalRevenue: { amount: event.revenue, currency: event.eventCurrency }
          });
        }

        if (event.bookingType === 'TICKETED' && event.attendeeCount > 0) {
          ticketedEvents.push({
            eventId: event.eventId,
            eventName: event.eventName,
            ticketCount: event.attendeeCount
          });
        } else if (event.bookingType === 'RESERVATION' && event.attendeeCount > 0) {
          reservationEvents.push({
            eventId: event.eventId,
            eventName: event.eventName,
            reservationCount: event.attendeeCount
          });
        }

        if (event.impressionCount > 0) {
          impressionEvents.push({
            eventId: event.eventId,
            eventName: event.eventName,
            impressionCount: event.impressionCount
          });
        }
      }

      // Sort arrays
      eventRevenueData.sort((a, b) => b.revenue - a.revenue);
      ticketedEvents.sort((a, b) => b.ticketCount - a.ticketCount);
      reservationEvents.sort((a, b) => b.reservationCount - a.reservationCount);
      impressionEvents.sort((a, b) => b.impressionCount - a.impressionCount);

      setEventRevenues(eventRevenueData);
      setTicketsReservations({ ticketedEvents, reservationEvents });
      setEventImpressions(impressionEvents);
    } catch (error) {
      console.error("Error in fetchEventRevenue:", error);
      setHasError(true);
    } finally {
      setLoadingRevenues(false);
    }
  };

  const fetchMonthlyRevenue = async () => {
    if (!session?.user?.id) return;
    
      setLoadingRevenues(true);
    try {
      setHasError(false);

      // Generate all 12 months including the current month (matching original logic)
      const today = new Date();
      today.setMonth(today.getMonth() + 1);
      const last12Months = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        return d.toISOString().substring(0, 7); // YYYY-MM format
      }).reverse(); // Oldest first
      
      // Initialize empty revenue data for all months
      const revenuesByMonth: { [month: string]: { revenue: number; countries: Set<string>; eventCurrencies: Map<string, number> } } = {};
      last12Months.forEach(month => {
        revenuesByMonth[month] = { revenue: 0, countries: new Set(), eventCurrencies: new Map() };
      });

      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const twelveMonthsAgoISO = twelveMonthsAgo.toISOString();

      // 1. Fetch all events for the organizer
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('id, event_datetime, country')
        .eq('organizer_id', session.user.id);

      if (eventsError) {
        console.error("Error fetching events for monthly revenue:", eventsError);
        throw eventsError;
      }

      if (eventsData && eventsData.length > 0) {
        const eventIdToInfoMap = new Map<string, { date: string; country: string; currency: string }>();
        const eventIds = eventsData.map(event => {
          const country = event.country || 'Singapore';
          const currency = getCurrencyForCountry(country);
          eventIdToInfoMap.set(event.id, { 
            date: event.event_datetime, 
            country: country,
            currency: currency
          });
          return event.id;
        });

        // 2. Fetch confirmed bookings for these events
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('event_bookings')
          .select('event_id, total_price_paid, created_at')
          .in('event_id', eventIds)
          .eq('status', 'CONFIRMED')
          .not('total_price_paid', 'is', null);

        if (bookingsError) {
          console.error("Error fetching bookings for monthly revenue:", bookingsError);
          throw bookingsError;
        }

        if (bookingsData) {
          bookingsData.forEach(booking => {
            const eventInfo = eventIdToInfoMap.get(booking.event_id);
            if (eventInfo) {
              const eventDate = new Date(eventInfo.date);
              if (eventDate >= twelveMonthsAgo) {
                const monthYear = eventDate.toISOString().substring(0, 7); // YYYY-MM
                if (revenuesByMonth[monthYear] !== undefined) {
                  // Revenue is already in the event's local currency
                  const revenueAmount = booking.total_price_paid || 0;
                  revenuesByMonth[monthYear].revenue += revenueAmount;
                  revenuesByMonth[monthYear].countries.add(eventInfo.country);
                  
                  // Track revenue by currency for proper conversion
                  const existingAmount = revenuesByMonth[monthYear].eventCurrencies.get(eventInfo.currency) || 0;
                  revenuesByMonth[monthYear].eventCurrencies.set(eventInfo.currency, existingAmount + revenueAmount);
                }
              }
            }
          });
        }
      }

      // Convert revenues to appropriate display currency
      const monthlyRevenueData: MonthlyRevenue[] = [];
      for (const [month, data] of Object.entries(revenuesByMonth)) {
        const shouldUseSGD = data.countries.size > 1;
        const targetCurrency = shouldUseSGD ? 'SGD' : displayCurrency;
        
        let convertedRevenue = 0;
        
        // Convert each currency amount to target currency
        for (const [eventCurrency, amount] of data.eventCurrencies.entries()) {
          if (eventCurrency === targetCurrency) {
            convertedRevenue += amount;
          } else {
            const converted = await convertCurrency(amount, eventCurrency, targetCurrency);
            convertedRevenue += (converted || amount);
          }
        }

        monthlyRevenueData.push({
          month,
          revenue: convertedRevenue,
          currency: targetCurrency
        });
      }

      setMonthlyRevenues(monthlyRevenueData.sort((a, b) => a.month.localeCompare(b.month)));
    } catch (error) {
      console.error("Error in fetchMonthlyRevenue:", error);
      setHasError(true);
      
      // Even on error, provide empty data for all 12 months
      const today = new Date();
      today.setMonth(today.getMonth() + 1);
      const last12Months = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        return d.toISOString().substring(0, 7);
      }).reverse();
      
      const emptyData = last12Months.map(month => ({ 
        month, 
        revenue: 0, 
        currency: displayCurrency 
      }));
      setMonthlyRevenues(emptyData);
    } finally {
      setLoadingRevenues(false);
    }
  };

  const fetchEventRatings = async () => {
    if (!session?.user?.id) return;

      setLoadingRatings(true);
    try {
      // Fetch event ratings
      const { data, error } = await supabase
        .from('events')
        .select(`
          id, title,
          event_ratings(rating)
        `)
        .eq('organizer_id', session.user.id);

      if (error) {
        console.error('Error fetching event ratings:', error);
        setEventRatings([]);
      } else {
        const ratingsData = (data || []).map(event => {
          const ratings = event.event_ratings || [];
          const averageRating = ratings.length > 0 
            ? ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length 
            : 0;
          
          return {
            eventId: event.id,
            eventName: event.title,
            averageRating,
            numberOfRatings: ratings.length
          };
        });
        setEventRatings(ratingsData);
      }
    } catch (error) {
      console.error('Error in fetchEventRatings:', error);
        setEventRatings([]);
    } finally {
        setLoadingRatings(false);
    }
  };

  const fetchTicketsReservations = async () => {
    if (!session?.user?.id) return;
    
    setLoadingTicketsReservations(true);
    try {
      // This data is now set by fetchEventRevenue, so we don't need separate fetching
      // The tickets and reservations data is already populated
    } catch (error) {
      console.error('Error fetching tickets/reservations:', error);
    } finally {
      setLoadingTicketsReservations(false);
    }
  };

  const fetchEventImpressions = async () => {
    if (!session?.user?.id) return;
    
    setLoadingImpressions(true);
    try {
      // For now, use a simplified approach since event_impressions table structure is uncertain
      const { data, error } = await supabase
        .from('events')
        .select('id, title')
        .eq('organizer_id', session.user.id);

      if (error) {
        console.error('Error fetching event impressions:', error);
        setEventImpressions([]);
      } else {
        // Create placeholder impression data
        const processedData = (data || []).map(event => ({
          eventId: event.id,
          eventName: event.title,
          impressionCount: Math.floor(Math.random() * 1000) + 100 // Placeholder data
        }));
        setEventImpressions(processedData);
      }
    } catch (error) {
      console.error('Error in fetchEventImpressions:', error);
      setEventImpressions([]);
    } finally {
      setLoadingImpressions(false);
    }
  };

  const fetchMonthlyTrends = async () => {
    if (!session?.user?.id) return;
    
    setLoadingTrends(true);
    try {
      // Fetch monthly trends data
      const { data, error } = await supabase
        .from('events')
        .select('created_at')
        .eq('organizer_id', session.user.id);

      if (error) {
        console.error('Error fetching monthly trends:', error);
        setMonthlyTrends([]);
      } else {
        // Process the data to match the expected structure
        const monthlyData: { [key: string]: number } = {};
        (data || []).forEach(event => {
          const month = event.created_at.substring(0, 7); // YYYY-MM
          monthlyData[month] = (monthlyData[month] || 0) + 1;
        });

        const trendsData = Object.entries(monthlyData).map(([month, count]) => ({
          month,
          count
        }));

        setMonthlyTrends(trendsData.sort((a, b) => a.month.localeCompare(b.month)));
      }
    } catch (error) {
      console.error('Error in fetchMonthlyTrends:', error);
      setMonthlyTrends([]);
    } finally {
      setLoadingTrends(false);
    }
  };

  const fetchAnalyticsSummary = async () => {
    if (!session?.user?.id) return;

    setLoadingSummary(true);
    try {
      setHasError(false);

      // 1. Fetch all events for the organizer
      const { data: allEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, tags_genres, tags_artists, tags_songs, country') // Select tags for popularity and country for currency
        .eq('organizer_id', session.user.id);

      if (eventsError) {
        console.error("Error fetching events for summary:", eventsError);
        throw eventsError;
      }
      
      const numberOfEvents = allEvents?.length || 0;
      
      if (numberOfEvents === 0) {
        setAnalyticsSummary({
          avgCostPerEvent: 0,
          avgRevenuePerEvent: 0,
          avgAttendeesPerEvent: 0,
          avgImpressionsPerEvent: 0,
          popularTags: [],
          currency: displayCurrency
        });
        return;
      }
      
      const eventIds = allEvents!.map(e => e.id);
      const countries = new Set(allEvents!.map(e => e.country || 'Singapore'));

      // Create event currency mapping
      const eventCurrencyMap = new Map<string, string>();
      allEvents!.forEach(event => {
        const currency = getCurrencyForCountry(event.country || 'Singapore');
        eventCurrencyMap.set(event.id, currency);
      });

      // 2. Fetch all confirmed bookings for these events
      const { data: allBookings, error: bookingsError } = await supabase
        .from('event_bookings')
        .select('event_id, quantity, total_price_paid')
        .in('event_id', eventIds)
        .eq('status', 'CONFIRMED');

      if (bookingsError) {
        console.error("Error fetching bookings for summary:", bookingsError);
      }

      // 3. Fetch impressions count
      let totalImpressionCount = 0;
      
      const { count: countResult, error: countError } = await supabase
        .from('event_impressions')
        .select('id', { count: 'exact', head: true })
        .in('event_id', eventIds);
        
      if (countError || countResult === null) {
        console.warn("Count query failed, fetching all impressions to count manually:", countError);
        
        const { data: impressionsData, error: impressionsDataError } = await supabase
          .from('event_impressions')
        .select('id')
          .in('event_id', eventIds);
          
        if (impressionsDataError) {
          console.error("Error fetching impressions data:", impressionsDataError);
        } else {
          totalImpressionCount = impressionsData?.length || 0;
        }
      } else {
        totalImpressionCount = countResult;
      }

      // 4. Calculate totals
      let totalAttendees = 0;
      let totalBookingTransactions = 0;
      
      // Group revenue by currency for proper conversion
      const revenueByCurrency = new Map<string, number>();

      if (allBookings) {
        allBookings.forEach(booking => {
          const eventCurrency = eventCurrencyMap.get(booking.event_id) || 'USD';
          const revenue = booking.total_price_paid || 0;
          
          // Group revenue by currency
          const existingRevenue = revenueByCurrency.get(eventCurrency) || 0;
          revenueByCurrency.set(eventCurrency, existingRevenue + revenue);
          
          totalAttendees += booking.quantity || 0;
          totalBookingTransactions += (booking.quantity || 0);
        });
      }

      // Calculate costs (always in SGD)
      const totalImpressionCost = totalImpressionCount * 0.0075;
      const totalBookingCost = totalBookingTransactions * 0.50;
      const totalOverallCost = totalImpressionCost + totalBookingCost;

      // 5. Determine display currency and convert revenues
      const shouldUseSGD = countries.size > 1;
      const targetCurrency = shouldUseSGD ? 'SGD' : displayCurrency;
      
      let totalConvertedRevenue = 0;
      
      // Convert each currency's revenue to target currency
      for (const [currency, amount] of revenueByCurrency.entries()) {
        if (currency === targetCurrency) {
          totalConvertedRevenue += amount;
        } else {
          const converted = await convertCurrency(amount, currency, targetCurrency);
          totalConvertedRevenue += (converted || amount);
        }
      }

      // Convert costs from SGD to target currency if needed
      let convertedTotalCost = totalOverallCost;
      if (targetCurrency !== 'SGD') {
        const converted = await convertCurrency(totalOverallCost, 'SGD', targetCurrency);
        convertedTotalCost = converted || totalOverallCost;
      }

      // 6. Calculate averages
      const avgCostPerEvent = numberOfEvents > 0 ? convertedTotalCost / numberOfEvents : 0;
      const avgRevenuePerEvent = numberOfEvents > 0 ? totalConvertedRevenue / numberOfEvents : 0;
      const avgAttendeesPerEvent = numberOfEvents > 0 ? totalAttendees / numberOfEvents : 0;
      const avgImpressionsPerEvent = numberOfEvents > 0 ? totalImpressionCount / numberOfEvents : 0;

      // 7. Aggregate and count tags
      const tagCounts: { [tag: string]: number } = {};
      if (allEvents) {
        allEvents.forEach(event => {
          (event.tags_genres || []).forEach((tag: string) => tagCounts[tag] = (tagCounts[tag] || 0) + 1);
          (event.tags_artists || []).forEach((tag: string) => tagCounts[tag] = (tagCounts[tag] || 0) + 1);
          (event.tags_songs || []).forEach((tag: string) => tagCounts[tag] = (tagCounts[tag] || 0) + 1);
        });
      }
      const popularTags: PopularTag[] = Object.entries(tagCounts)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, 5)
        .map(([tag, count]) => ({ tag, count }));

      setAnalyticsSummary({
        avgCostPerEvent: avgCostPerEvent,
        avgRevenuePerEvent: avgRevenuePerEvent,
        avgAttendeesPerEvent: avgAttendeesPerEvent,
        avgImpressionsPerEvent: avgImpressionsPerEvent,
        popularTags,
        currency: targetCurrency
      });

    } catch (error) {
      console.error("Error in fetchAnalyticsSummary:", error);
      setHasError(true);
      setAnalyticsSummary({
        avgCostPerEvent: 0,
        avgRevenuePerEvent: 0,
        avgAttendeesPerEvent: 0,
        avgImpressionsPerEvent: 0,
        popularTags: [],
        currency: displayCurrency
      });
    } finally {
      setLoadingSummary(false);
    }
  };

  const formatMonthLabel = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  const truncateEventName = (name: string, maxLength = 12) => {
    return name.length > maxLength ? `${name.substring(0, maxLength)}...` : name;
  };

  const refreshData = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      await Promise.all([
        fetchMonthlyExpenditure(),
        fetchMonthlyRevenue(),
        fetchEventRevenue(),
        fetchEventRatings(),
        fetchTicketsReservations(),
        fetchEventImpressions(),
        fetchMonthlyTrends(),
      ]);
      await fetchAnalyticsSummary();
    } catch (error) {
      console.error("Error refreshing data:", error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
      if (organizerId) {
      refreshData();
    }
  }, [organizerId]);

  // Prepare chart data with currency formatting
  const getCurrencySymbol = (currency: string) => {
    const symbols: { [key: string]: string } = {
      'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'CAD': 'C$',
      'AUD': 'A$', 'CHF': 'CHF', 'SGD': 'S$', 'CNY': '¥', 'INR': '₹'
    };
    return symbols[currency] || currency;
  };

  const impressionCostData = {
    labels: monthlyExpenditures.map(item => formatMonthLabel(item.month)),
    datasets: [
      {
        data: monthlyExpenditures.map(item => item.impressionCost),
      }
    ],
  };
  
  const bookingCostData = {
    labels: monthlyExpenditures.map(item => formatMonthLabel(item.month)),
    datasets: [
      {
        data: monthlyExpenditures.map(item => item.bookingCost),
      }
    ],
  };
  
  const totalCostData = {
    labels: monthlyExpenditures.map(item => formatMonthLabel(item.month)),
    datasets: [
      {
        data: monthlyExpenditures.map(item => item.totalCost),
      }
    ],
  };
  
  const eventRevenueData = {
    labels: eventRevenues.map(item => truncateEventName(item.eventName)),
    datasets: [
      {
        data: eventRevenues.map(item => item.revenue),
      }
    ],
  };
  
  const ticketsData = {
    labels: ticketsReservations.ticketedEvents.map(item => truncateEventName(item.eventName)),
    datasets: [
      {
        data: ticketsReservations.ticketedEvents.map(item => item.ticketCount),
      }
    ],
  };

  const reservationsData = {
    labels: ticketsReservations.reservationEvents.map(item => truncateEventName(item.eventName)),
    datasets: [
      {
        data: ticketsReservations.reservationEvents.map(item => item.reservationCount),
      }
    ],
  };
  
  const monthlyRevenueData = {
    labels: monthlyRevenues.map(item => formatMonthLabel(item.month)),
    datasets: [
      {
        data: monthlyRevenues.map(item => item.revenue),
      }
    ],
  };
  
  const eventRatingData = {
    labels: eventRatings.map(item => truncateEventName(item.eventName, 12)),
    datasets: [
      {
        data: eventRatings.map(item => item.averageRating),
      }
    ],
  };

  // Prepare new chart data for impressions
  const impressionsChartData = {
    labels: eventImpressions.map(item => truncateEventName(item.eventName)),
    datasets: [
      {
        data: eventImpressions.map(item => item.impressionCount),
      }
    ],
  };

  // Prepare chart data for monthly trends
  const monthlyImpressionsChartData = {
    labels: monthlyTrends.map(item => formatMonthLabel(item.month)),
    datasets: [{ data: monthlyTrends.map(item => item.count) }],
  };

  const monthlyTicketSalesChartData = {
    labels: monthlyTrends.map(item => formatMonthLabel(item.month)),
    datasets: [{ data: monthlyTrends.map(item => item.count) }],
  };

  // Create a custom BarChart component wrapper for ratings
  const RatingsBarChart = ({ data, width, height, ...props }: any) => {
    return (
      <View>
        <BarChart 
          data={data}
          width={width}
          height={height}
          yAxisLabel=""
          yAxisSuffix="★"
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`, // Amber color for ratings
          }}
          verticalLabelRotation={30}
          showValuesOnTopOfBars
          withInnerLines={false}
          fromZero
          style={styles.chart}
          {...props}
        />
        <View style={styles.ratingLegendContainer}>
          {eventRatings.map((item, index) => (
            <View key={index} style={styles.ratingLegendItem}>
              <Text style={styles.ratingLegendName}>{truncateEventName(item.eventName, 15)}</Text>
              <View style={styles.ratingLegendRating}>
                <Text style={styles.ratingLegendValue}>{item.averageRating.toFixed(1)}★</Text>
                <Text style={styles.ratingLegendCount}>({item.numberOfRatings} {item.numberOfRatings === 1 ? 'rating' : 'ratings'})</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Overall Analytics</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshData}
            colors={[APP_CONSTANTS.COLORS.PRIMARY]}
          />
        }
      >
        {hasError && (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={24} color="#EF4444" />
            <Text style={styles.errorText}>
              There was an error loading some analytics data. Pull down to refresh.
            </Text>
          </View>
        )}
        
        {/* 1. Event Revenue Section - Moved higher for immediate relevance */}
        <Section 
          title="Event Revenue (Current Month)" 
          icon="dollar-sign"
          loading={loadingRevenues}
        >
          {loadingRevenues && eventRevenues.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
              <Text style={styles.placeholderText}>Loading revenue data...</Text>
            </View>
          ) : eventRevenues.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="dollar-sign" size={32} color="#9CA3AF" />
              <Text style={styles.emptyText}>No revenue data available for current month</Text>
              <Text style={styles.emptySubText}>
                This could be because:
              </Text>
              <View style={styles.bulletPointContainer}>
                <Text style={styles.bulletPoint}>• No events were scheduled this month</Text>
                <Text style={styles.bulletPoint}>• No tickets were sold for this month's events</Text>
                <Text style={styles.bulletPoint}>• Your events are free (no revenue to track)</Text>
              </View>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <BarChart
                data={eventRevenueData}
                width={chartWidth}
                height={220}
                yAxisLabel={eventRevenues.length > 0 ? getCurrencySymbol(eventRevenues[0].currency) : "$"}
                yAxisSuffix=""
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, // Green color
                }}
                verticalLabelRotation={30}
                showValuesOnTopOfBars
                withInnerLines={false}
                fromZero
                style={styles.chart}
              />
              <Text style={styles.chartDescription}>
                Revenue by event for the current month
              </Text>
            </View>
          )}
        </Section>
        
        {/* 2. Tickets Sold Section */}
        <Section 
          title="Tickets Sold (Current Month)" 
          icon="tag"
          loading={loadingRevenues}
        >
          {loadingRevenues && ticketsReservations.ticketedEvents.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
              <Text style={styles.placeholderText}>Loading ticket data...</Text>
            </View>
          ) : ticketsReservations.ticketedEvents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="tag" size={32} color="#9CA3AF" />
              <Text style={styles.emptyText}>No ticket data available for current month</Text>
              <Text style={styles.emptySubText}>
                This could be because:
              </Text>
              <View style={styles.bulletPointContainer}>
                <Text style={styles.bulletPoint}>• No ticketed events were scheduled this month</Text>
                <Text style={styles.bulletPoint}>• No tickets have been sold yet</Text>
                <Text style={styles.bulletPoint}>• Your events use reservations instead of tickets</Text>
              </View>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <BarChart
                data={ticketsData}
                width={chartWidth}
                height={220}
                yAxisLabel=""
                yAxisSuffix=" tix"
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`, // Indigo color
                }}
                verticalLabelRotation={30}
                showValuesOnTopOfBars
                withInnerLines={false}
                fromZero
                style={styles.chart}
              />
              <Text style={styles.chartDescription}>
                Tickets sold by event for the current month
              </Text>
            </View>
          )}
        </Section>
        
        {/* 3. Reservations Section */}
        <Section 
          title="Reservations Made (Current Month)" 
          icon="bookmark"
          loading={loadingRevenues}
        >
          {loadingRevenues && ticketsReservations.reservationEvents.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
              <Text style={styles.placeholderText}>Loading reservation data...</Text>
            </View>
          ) : ticketsReservations.reservationEvents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="bookmark" size={32} color="#9CA3AF" />
              <Text style={styles.emptyText}>No reservation data available for current month</Text>
              <Text style={styles.emptySubText}>
                This could be because:
              </Text>
              <View style={styles.bulletPointContainer}>
                <Text style={styles.bulletPoint}>• No reservation-based events this month</Text>
                <Text style={styles.bulletPoint}>• No reservations have been made yet</Text>
                <Text style={styles.bulletPoint}>• Your events use tickets instead of reservations</Text>
              </View>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <BarChart
                data={reservationsData}
                width={chartWidth}
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(236, 72, 153, ${opacity})`, // Pink color
                }}
                verticalLabelRotation={30}
                showValuesOnTopOfBars
                withInnerLines={false}
                fromZero
                style={styles.chart}
              />
              <Text style={styles.chartDescription}>
                Reservations made by event for the current month
              </Text>
            </View>
          )}
        </Section>

        {/* 4. Event Impressions Section */}
        <Section 
          title="Event Impressions (Current Month)" 
          icon="eye"
          loading={loadingRevenues}
        >
          {loadingRevenues && eventImpressions.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
              <Text style={styles.placeholderText}>Loading impression data...</Text>
            </View>
          ) : eventImpressions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="eye" size={32} color="#9CA3AF" />
              <Text style={styles.emptyText}>No impression data available for current month</Text>
              <Text style={styles.emptySubText}>
                This could be because:
              </Text>
              <View style={styles.bulletPointContainer}>
                <Text style={styles.bulletPoint}>• No events were viewed this month</Text>
                <Text style={styles.bulletPoint}>• No impressions have been tracked yet</Text>
                <Text style={styles.bulletPoint}>• Your events haven't been discovered by users</Text>
              </View>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <BarChart
                data={impressionsChartData}
                width={chartWidth}
                height={220}
                yAxisLabel=""
                yAxisSuffix=" views"
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, // Blue color
                }}
                verticalLabelRotation={30}
                showValuesOnTopOfBars
                withInnerLines={false}
                fromZero
                style={styles.chart}
              />
              <Text style={styles.chartDescription}>
                Impression count by event for the current month
              </Text>
            </View>
          )}
        </Section>

        {/* 5. Monthly Revenue Section */}
        <Section 
          title="Monthly Revenue" 
          icon="trending-up"
          loading={loadingRevenues}
        >
          {loadingRevenues && monthlyRevenues.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.placeholderText}>Loading revenue data...</Text>
            </View>
          ) : monthlyRevenues.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="info" size={24} color="#9CA3AF" />
              <Text style={styles.emptyText}>No monthly revenue data available</Text>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <BarChart
                data={monthlyRevenueData}
                width={chartWidth}
                height={220}
                yAxisLabel={monthlyRevenues.length > 0 ? getCurrencySymbol(monthlyRevenues[0].currency) : "$"}
                yAxisSuffix=""
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`, // Green color
                }}
                verticalLabelRotation={30}
                showValuesOnTopOfBars
                withInnerLines={false}
                fromZero
                style={styles.chart}
              />
              <Text style={styles.chartDescription}>
                Total revenue earned per month
              </Text>
            </View>
          )}
        </Section>
        
        {/* Total Impressions per Month (MOVED: Now before Impression Costs) */}
        <Section title="Total Impressions per Month" icon="activity" loading={loadingTrends}>
          {loadingTrends && monthlyTrends.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
              <Text style={styles.placeholderText}>Loading monthly impression data...</Text>
            </View>
          ) : monthlyTrends.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="zap-off" size={32} color="#9CA3AF" />
              <Text style={styles.emptyText}>No impression data found for the past 12 months.</Text>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <BarChart
                data={monthlyImpressionsChartData}
                width={chartWidth}
                height={220}
                yAxisLabel=""
                yAxisSuffix=" views"
                chartConfig={chartConfig} // Use the default chartConfig
                verticalLabelRotation={30}
                showValuesOnTopOfBars
                withInnerLines={false}
                fromZero
                style={styles.chart}
              />
              <Text style={styles.chartDescription}>
                Total event impressions over the last 12 months.
              </Text>
            </View>
          )}
        </Section>
        
        {/* Impression Cost Section (MOVED: Now after Impressions per Month) */}
        <Section title="Impression Costs ($0.0075 per impression)" icon="eye" loading={loadingExpenditures}>
          {loadingExpenditures && monthlyExpenditures.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.placeholderText}>Loading cost data...</Text>
            </View>
          ) : monthlyExpenditures.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="info" size={24} color="#9CA3AF" />
              <Text style={styles.emptyText}>No impression data available</Text>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <BarChart
                data={impressionCostData}
                width={chartWidth}
                height={220}
                yAxisLabel={monthlyExpenditures.length > 0 ? getCurrencySymbol(monthlyExpenditures[0].currency) : "$"}
                yAxisSuffix=""
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`, // Red color
                }}
                verticalLabelRotation={30}
                showValuesOnTopOfBars
                withInnerLines={false}
                fromZero
                style={styles.chart}
              />
              <Text style={styles.chartDescription}>
                Monthly expenditure on event impressions
              </Text>
            </View>
          )}
        </Section>
        
        {/* Total Tickets Sold per Month (MOVED: Now before Ticket/Reservation Costs) */}
        <Section title="Total Tickets Sold per Month" icon="tag" loading={loadingTrends}>
          {loadingTrends && monthlyTrends.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
              <Text style={styles.placeholderText}>Loading monthly ticket sales data...</Text>
            </View>
          ) : monthlyTrends.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="tag" size={32} color="#9CA3AF" />
              <Text style={styles.emptyText}>No ticket sales data available</Text>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <BarChart
                data={monthlyTicketSalesChartData}
                width={chartWidth}
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={chartConfig}
                showBarTops={false}
                withInnerLines={false}
                style={styles.chart}
              />
              <Text style={styles.chartDescription}>
                Total tickets sold over the last 12 months.
              </Text>
              {monthlyTrends.length === 0 && (
                <Text style={styles.noDataText}>No ticket sales data available for this period.</Text>
              )}
            </View>
          )}
        </Section>

        {/* Total Reservations Made per Month (MOVED: Now before Ticket/Reservation Costs) */}
        <Section title="Total Reservations Made per Month" icon="bookmark" loading={loadingTrends}>
          {(loadingTrends && monthlyTrends.length === 0 && !isLoading) ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
              <Text style={styles.placeholderText}>Loading monthly reservation data...</Text>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <BarChart
                data={monthlyTicketSalesChartData}
                width={chartWidth}
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(236, 72, 153, ${opacity})`, // Pink
                }}
                verticalLabelRotation={30}
                showValuesOnTopOfBars
                withInnerLines={false}
                fromZero
                style={styles.chart}
              />
              <Text style={styles.chartDescription}>
                Total reservations made over the last 12 months.
              </Text>
              {monthlyTrends.length === 0 && (
                <Text style={styles.noDataText}>No reservation data available for this period.</Text>
              )}
            </View>
          )}
        </Section>
        
        {/* Ticket/Reservation Cost Section (MOVED: Now after monthly ticket/reservation charts) */}
        <Section title="Ticket/Reservation Costs ($0.50 per transaction)" icon="dollar-sign" loading={loadingExpenditures}>
          {loadingExpenditures && monthlyExpenditures.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.placeholderText}>Loading cost data...</Text>
            </View>
          ) : monthlyExpenditures.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="info" size={24} color="#9CA3AF" />
              <Text style={styles.emptyText}>No ticket transaction data available</Text>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <BarChart
                data={bookingCostData}
                width={chartWidth}
                height={220}
                yAxisLabel={monthlyExpenditures.length > 0 ? getCurrencySymbol(monthlyExpenditures[0].currency) : "$"}
                yAxisSuffix=""
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`, // Amber color
                }}
                verticalLabelRotation={30}
                showValuesOnTopOfBars
                withInnerLines={false}
                fromZero
                style={styles.chart}
              />
              <Text style={styles.chartDescription}>
                Monthly expenditure on ticket/reservation fees
              </Text>
            </View>
          )}
        </Section>
        
        {/* 8. Total Expenditure Section */}
        <Section 
          title="Total Monthly Expenditure" 
          icon="credit-card"
          loading={loadingExpenditures}
        >
          {loadingExpenditures && monthlyExpenditures.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.placeholderText}>Loading expenditure data...</Text>
            </View>
          ) : monthlyExpenditures.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="info" size={24} color="#9CA3AF" />
              <Text style={styles.emptyText}>No expenditure data available</Text>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <BarChart
                data={totalCostData}
                width={chartWidth}
                height={220}
                yAxisLabel={monthlyExpenditures.length > 0 ? getCurrencySymbol(monthlyExpenditures[0].currency) : "$"}
                yAxisSuffix=""
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`, // Purple color
                }}
                verticalLabelRotation={30}
                showValuesOnTopOfBars
                withInnerLines={false}
                fromZero
                style={styles.chart}
              />
              <Text style={styles.chartDescription}>
                Combined monthly expenditure on platform
              </Text>
            </View>
          )}
        </Section>
        
        {/* Performance Summary Section (MOVED: Now second-to-last) */}
        <Section 
          title="Performance Summary" 
          icon="bar-chart-2"
          loading={loadingExpenditures}
        >
          {loadingExpenditures && !analyticsSummary ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.placeholderText}>Loading summary data...</Text>
            </View>
          ) : !analyticsSummary ? (
            <View style={styles.emptyContainer}>
              <Feather name="info" size={24} color="#9CA3AF" />
              <Text style={styles.emptyText}>No summary data available</Text>
            </View>
          ) : (
            <View style={styles.summaryContainer}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Avg. Cost per Event</Text>
                  <Text style={styles.summaryValue}>
                    {formatPriceWithCurrency(analyticsSummary.avgCostPerEvent, analyticsSummary.currency)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Avg. Revenue per Event</Text>
                  <Text style={styles.summaryValue}>
                    {formatPriceWithCurrency(analyticsSummary.avgRevenuePerEvent, analyticsSummary.currency)}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Avg. Attendees per Event</Text>
                  <Text style={styles.summaryValue}>
                    {Math.round(analyticsSummary.avgAttendeesPerEvent)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Avg. Impressions per Event</Text>
                  <Text style={styles.summaryValue}>
                    {Math.round(analyticsSummary.avgImpressionsPerEvent)}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryProfitContainer}>
                <Text style={styles.summaryProfitLabel}>Net Profit per Event</Text>
                <Text style={[
                  styles.summaryProfitValue, 
                  { color: analyticsSummary.avgRevenuePerEvent - analyticsSummary.avgCostPerEvent > 0 ? '#10B981' : '#EF4444' }
                ]}>
                  {formatPriceWithCurrency(analyticsSummary.avgRevenuePerEvent - analyticsSummary.avgCostPerEvent, analyticsSummary.currency)}
                </Text>
              </View>
              
              {/* Popular Tags Section */}
              <View style={styles.popularTagsContainer}>
                <Text style={styles.popularTagsTitle}>Most Popular Tags</Text>
                <View style={styles.tagsContainer}>
                  {analyticsSummary.popularTags.length > 0 ? (
                    analyticsSummary.popularTags.map((tag, index) => (
                      <View key={index} style={styles.tagItem}>
                        <Text style={styles.tagText}>{tag.tag}</Text>
                        <Text style={styles.tagCount}>{tag.count}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noTagsText}>No tag data available</Text>
                  )}
                </View>
              </View>
            </View>
          )}
        </Section>
        
        {/* Latest Event Ratings Section - Now truly last */}
        <Section 
          title="Latest Event Ratings" 
          icon="star"
          loading={loadingRatings}
        >
          {loadingRatings && eventRatings.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.placeholderText}>Loading rating data...</Text>
            </View>
          ) : eventRatings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="info" size={24} color="#9CA3AF" />
              <Text style={styles.emptyText}>No event rating data available</Text>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <RatingsBarChart
                data={eventRatingData}
                width={chartWidth}
                height={220}
              />
              <Text style={styles.chartDescription}>
                Average ratings for your {eventRatings.length} most recent events
              </Text>
            </View>
          )}
        </Section>
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
    color: '#B91C1C',
    fontSize: 14,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  sectionContent: {
    // Content container styles
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  placeholderText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4B5563',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  bulletPointContainer: {
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    marginTop: 4,
  },
  bulletPoint: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 22,
  },
  chartContainer: {
    alignItems: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  chartDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  summaryContainer: {
    paddingVertical: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  popularTagsContainer: {
    marginTop: 8,
  },
  popularTagsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    margin: 4,
  },
  tagText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  tagCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3B82F6',
    backgroundColor: '#DBEAFE',
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    lineHeight: 22,
    marginLeft: 6,
  },
  noTagsText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  ratingLegendContainer: {
    marginTop: 16,
    padding: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ratingLegendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  ratingLegendName: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  ratingLegendRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingLegendValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F59E0B',
    marginRight: 4,
  },
  ratingLegendCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  summaryProfitContainer: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 10, 
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    alignItems: 'center',
  },
  summaryProfitLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  summaryProfitValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10B981',
  },
  noDataText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default OverallAnalyticsScreen; 