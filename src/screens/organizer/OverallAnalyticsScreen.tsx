import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, 
  TouchableOpacity, RefreshControl, Dimensions, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-chart-kit';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { APP_CONSTANTS } from '../../config/constants';

// Types for various analytics data
interface MonthlyExpenditure {
  month: string;
  impressionCost: number;
  bookingCost: number;
  totalCost: number;
}

interface EventRevenue {
  eventId: string;
  eventName: string;
  revenue: number;
  attendeeCount: number;
  bookingType: 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
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
  const { session } = useAuth();
  const organizerId = session?.user?.id;
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // States for different analytics sections
  const [monthlyExpenditures, setMonthlyExpenditures] = useState<MonthlyExpenditure[]>([]);
  const [eventRevenues, setEventRevenues] = useState<EventRevenue[]>([]);
  const [ticketsReservationsData, setTicketsReservationsData] = useState<TicketsReservationsData>({
    ticketedEvents: [],
    reservationEvents: []
  });
  const [impressionsData, setImpressionsData] = useState<EventImpressionData[]>([]);
  const [monthlyRevenues, setMonthlyRevenues] = useState<MonthlyRevenue[]>([]);
  const [eventRatings, setEventRatings] = useState<EventRating[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);

  // New state variables for monthly trends
  const [monthlyImpressions, setMonthlyImpressions] = useState<MonthlyTrendData[]>([]);
  const [monthlyTicketSales, setMonthlyTicketSales] = useState<MonthlyTrendData[]>([]);
  const [monthlyReservations, setMonthlyReservations] = useState<MonthlyTrendData[]>([]);

  // Loading states for sections
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [loadingRevenues, setLoadingRevenues] = useState(true);
  const [loadingAttendees, setLoadingAttendees] = useState(true);
  const [loadingRatings, setLoadingRatings] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Loading states for new sections (can reuse or add new ones if specific timing is needed)
  const [loadingMonthlyTrends, setLoadingMonthlyTrends] = useState(true);

  // Error states
  const [hasError, setHasError] = useState(false);
  
  // Function to fetch monthly expenditures (impression costs and booking costs)
  const fetchMonthlyExpenditures = useCallback(async () => {
    if (!organizerId) return;

    try {
      setLoadingExpenses(true);
      setHasError(false);

      // Generate all 12 months including the current month
      const today = new Date();
      // Add one month to make May the last month instead of April
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
      const expendituresMap: { [monthKey: string]: MonthlyExpenditure } = {};
      last12Months.forEach(dateInfo => {
        expendituresMap[dateInfo.monthKey] = {
          month: dateInfo.monthKey,
          impressionCost: 0,
          bookingCost: 0,
          totalCost: 0,
        };
      });

      // 1. Fetch all events for the organizer to map event_id to its date
      const { data: allEventsData, error: alleventsError } = await supabase
        .from('events')
        .select('id, event_datetime')
        .eq('organizer_id', organizerId);

      if (alleventsError) {
        console.error("Error fetching events for expenditures:", alleventsError);
        throw alleventsError;
      }
      
      if (allEventsData && allEventsData.length > 0) {
        const eventIdToDateMap = new Map<string, string>();
        allEventsData.forEach(event => eventIdToDateMap.set(event.id, event.event_datetime));

        // 2. Fetch relevant event_impressions for the last 12 months
        const { data: impressionData, error: impressionError } = await supabase
          .from('event_impressions')
          .select('event_id, viewed_at')
          .in('event_id', allEventsData.map(e => e.id))
          .gte('viewed_at', firstMonthToConsider)
          .lte('viewed_at', lastMonthToConsider);

        if (impressionError) {
          console.error("Error fetching impression data:", impressionError);
          // Decide if partial data is acceptable or throw
        }

        // 3. Fetch relevant event_bookings for these events
        const { data: bookingData, error: bookingError } = await supabase
          .from('event_bookings')
          .select('event_id, quantity')
          .in('event_id', allEventsData.map(e => e.id))
          .eq('status', 'CONFIRMED');

        if (bookingError) {
          console.error("Error fetching booking data:", bookingError);
          // Decide if partial data is acceptable or throw
        }

        // Process impressions
        if (impressionData) {
          impressionData.forEach(imp => {
            const viewMonthKey = new Date(imp.viewed_at).toISOString().substring(0, 7);
            if (expendituresMap[viewMonthKey]) {
              expendituresMap[viewMonthKey].impressionCost += 0.0075;
            }
          });
        }

        // Process bookings
        if (bookingData) {
          bookingData.forEach(booking => {
            const eventDateStr = eventIdToDateMap.get(booking.event_id);
            if (eventDateStr) {
              const eventDate = new Date(eventDateStr);
              // Check if event_datetime is within our 12 month window
              if (eventDate.toISOString() >= firstMonthToConsider && eventDate.toISOString() <= lastMonthToConsider) {
                const eventMonthKey = eventDate.toISOString().substring(0, 7);
                if (expendituresMap[eventMonthKey]) {
                  expendituresMap[eventMonthKey].bookingCost += (booking.quantity || 0) * 0.50;
                }
              }
            }
          });
        }
      }
      
      // Calculate total costs and format for state
      const result = Object.values(expendituresMap).map(exp => ({
        month: exp.month,
        impressionCost: exp.impressionCost, // Keep exact value
        bookingCost: exp.bookingCost, // Keep exact value  
        totalCost: exp.impressionCost + exp.bookingCost, // Keep exact value
      }));

      setMonthlyExpenditures(result);
    } catch (error) {
      console.error("Error in fetchMonthlyExpenditures:", error);
      setHasError(true);
      
      // Even on error, provide empty data for all 12 months
      const today = new Date();
      // Add one month to make May the last month instead of April
      today.setMonth(today.getMonth() + 1);
      const last12Months = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        return d.toISOString().substring(0, 7);
      }).reverse();
      
      const emptyData = last12Months.map(month => ({
        month,
        impressionCost: 0,
        bookingCost: 0,
        totalCost: 0
      }));
      
      setMonthlyExpenditures(emptyData);
    } finally {
      setLoadingExpenses(false);
    }
  }, [organizerId]);
  
  // Function to fetch monthly revenues
  const fetchMonthlyRevenues = useCallback(async () => {
    if (!organizerId) return;

    try {
      setLoadingRevenues(true);
      setHasError(false);

      // Generate all 12 months including the current month
      const today = new Date();
      // Add one month to make May the last month instead of April
      today.setMonth(today.getMonth() + 1);
      const last12Months = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        return d.toISOString().substring(0, 7); // YYYY-MM format
      }).reverse(); // Oldest first
      
      // Initialize empty revenue data for all months
      const revenuesByMonth: { [month: string]: number } = {};
      last12Months.forEach(month => {
        revenuesByMonth[month] = 0;
      });

      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const twelveMonthsAgoISO = twelveMonthsAgo.toISOString();

      // 1. Fetch all events for the organizer
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('id, event_datetime')
        .eq('organizer_id', organizerId);

      if (eventsError) {
        console.error("Error fetching events for monthly revenue:", eventsError);
        throw eventsError;
      }

      if (eventsData && eventsData.length > 0) {
        const eventIdToDateMap = new Map<string, string>();
        const eventIds = eventsData.map(event => {
          eventIdToDateMap.set(event.id, event.event_datetime);
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
            const eventDateStr = eventIdToDateMap.get(booking.event_id);
            if (eventDateStr) {
              const eventDate = new Date(eventDateStr);
              if (eventDate >= twelveMonthsAgo) {
                const monthYear = eventDate.toISOString().substring(0, 7); // YYYY-MM
                if (revenuesByMonth[monthYear] !== undefined) {
                  revenuesByMonth[monthYear] = (revenuesByMonth[monthYear] || 0) + (booking.total_price_paid || 0);
                }
              }
            }
          });
        }
      }

      const formattedData = Object.entries(revenuesByMonth)
        .map(([month, revenue]) => ({ month, revenue }))
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

      setMonthlyRevenues(formattedData);
    } catch (error) {
      console.error("Error in fetchMonthlyRevenues:", error);
      setHasError(true);
      
      // Even on error, provide empty data for all 12 months
      const today = new Date();
      // Add one month to make May the last month instead of April
      today.setMonth(today.getMonth() + 1);
      const last12Months = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        return d.toISOString().substring(0, 7);
      }).reverse();
      
      const emptyData = last12Months.map(month => ({ month, revenue: 0 }));
      setMonthlyRevenues(emptyData);
    } finally {
      setLoadingRevenues(false);
    }
  }, [organizerId]);
  
  // Function to fetch total monthly impressions
  const fetchMonthlyImpressions = useCallback(async () => {
    if (!organizerId) return;
    console.log("Fetching monthly impressions...");
    try {
      setLoadingMonthlyTrends(true); // Use a shared loading state or create specific ones

      // Generate all 12 months including the current month
      const today = new Date();
      // Add one month to make May the last month instead of April
      today.setMonth(today.getMonth() + 1);
      const last12Months = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        return d.toISOString().substring(0, 7); // YYYY-MM format
      }).reverse(); // Oldest first
      
      // Initialize empty impression data for all months
      const impressionsByMonth: { [month: string]: number } = {};
      last12Months.forEach(month => {
        impressionsByMonth[month] = 0;
      });

      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const twelveMonthsAgoISO = twelveMonthsAgo.toISOString();

      const { data: organizerEvents, error: eventsError } = await supabase
        .from('events')
        .select('id')
        .eq('organizer_id', organizerId);

      if (eventsError) throw eventsError;
      
      if (organizerEvents && organizerEvents.length > 0) {
        const eventIds = organizerEvents.map(e => e.id);

        const { data: impressions, error: impressionsError } = await supabase
          .from('event_impressions')
          .select('viewed_at')
          .in('event_id', eventIds)
          .gte('viewed_at', twelveMonthsAgoISO);

        if (impressionsError) throw impressionsError;

        if (impressions && impressions.length > 0) {
          impressions.forEach(imp => {
            const monthYear = new Date(imp.viewed_at).toISOString().substring(0, 7);
            if (impressionsByMonth[monthYear] !== undefined) {
              impressionsByMonth[monthYear] += 1;
            }
          });
        }
      }
      
      const formattedData = Object.entries(impressionsByMonth)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
        
      setMonthlyImpressions(formattedData);
      console.log("Monthly impressions data (including zero months):", formattedData.length);
    } catch (error) {
      console.error("Error in fetchMonthlyImpressions:", error);
      
      // Even on error, provide empty data for all 12 months
      const today = new Date();
      // Add one month to make May the last month instead of April
      today.setMonth(today.getMonth() + 1);
      const last12Months = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        return d.toISOString().substring(0, 7);
      }).reverse();
      
      const emptyData = last12Months.map(month => ({ month, count: 0 }));
      setMonthlyImpressions(emptyData);
    }
    // No longer need to set loading to false here since it's handled in refreshAllData
  }, [organizerId]);

  // Function to fetch total monthly ticket sales
  const fetchMonthlyTicketSales = useCallback(async () => {
    if (!organizerId) return;
    console.log("Fetching monthly ticket sales...");
    try {
      setLoadingMonthlyTrends(true);
      
      // Generate all 12 months including the current month
      const today = new Date();
      // Add one month to make May the last month instead of April
      today.setMonth(today.getMonth() + 1);
      const last12Months = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        return d.toISOString().substring(0, 7); // YYYY-MM format
      }).reverse(); // Oldest first
      
      // Initialize empty ticket sales data for all months
      const salesByMonth: { [month: string]: number } = {};
      last12Months.forEach(month => {
        salesByMonth[month] = 0;
      });

      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const twelveMonthsAgoISO = twelveMonthsAgo.toISOString();

      // Fetch event_ids for TICKETED events by the organizer
      const { data: ticketedEvents, error: eventsError } = await supabase
        .from('events')
        .select('id')
        .eq('organizer_id', organizerId)
        .eq('booking_type', 'TICKETED');

      if (eventsError) throw eventsError;
      
      if (ticketedEvents && ticketedEvents.length > 0) {
        const eventIds = ticketedEvents.map(e => e.id);

        const { data: bookings, error: bookingsError } = await supabase
          .from('event_bookings')
          .select('created_at, quantity')
          .in('event_id', eventIds)
          .eq('status', 'CONFIRMED')
          .gte('created_at', twelveMonthsAgoISO);

        if (bookingsError) throw bookingsError;

        if (bookings && bookings.length > 0) {
          bookings.forEach(booking => {
            const monthYear = new Date(booking.created_at).toISOString().substring(0, 7);
            if (salesByMonth[monthYear] !== undefined) {
              salesByMonth[monthYear] += (booking.quantity || 0);
            }
          });
        }
      }
      
      const formattedData = Object.entries(salesByMonth)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
        
      setMonthlyTicketSales(formattedData);
      console.log("Monthly ticket sales data (including zero months):", formattedData.length);
    } catch (error) {
      console.error("Error in fetchMonthlyTicketSales:", error);
      
      // Even on error, provide empty data for all 12 months
      const today = new Date();
      // Add one month to make May the last month instead of April
      today.setMonth(today.getMonth() + 1);
      const last12Months = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        return d.toISOString().substring(0, 7);
      }).reverse();
      
      const emptyData = last12Months.map(month => ({ month, count: 0 }));
      setMonthlyTicketSales(emptyData);
    }
    // No longer need to set loading to false here since it's handled in refreshAllData
  }, [organizerId]);

  // Function to fetch monthly reservation counts
  const fetchMonthlyReservations = useCallback(async () => {
    if (!organizerId) return;
    console.log("Fetching monthly reservations...");
    try {
      setLoadingMonthlyTrends(true);
      
      // Generate all 12 months including the current month
      const today = new Date();
      // Add one month to make May the last month instead of April
      today.setMonth(today.getMonth() + 1);
      const last12Months = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        return d.toISOString().substring(0, 7); // YYYY-MM format
      }).reverse(); // Oldest first
      
      // Initialize empty reservations data for all months
      const reservationsByMonth: { [month: string]: number } = {};
      last12Months.forEach(month => {
        reservationsByMonth[month] = 0;
      });

      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const twelveMonthsAgoISO = twelveMonthsAgo.toISOString();

      // Fetch event_ids for RESERVATION events by the organizer
      const { data: reservationEvents, error: eventsError } = await supabase
        .from('events')
        .select('id')
        .eq('organizer_id', organizerId)
        .eq('booking_type', 'RESERVATION');

      if (eventsError) throw eventsError;
      
      if (reservationEvents && reservationEvents.length > 0) {
        const eventIds = reservationEvents.map(e => e.id);

        const { data: bookings, error: bookingsError } = await supabase
          .from('event_bookings')
          .select('created_at, quantity')
          .in('event_id', eventIds)
          .eq('status', 'CONFIRMED')
          .gte('created_at', twelveMonthsAgoISO);

        if (bookingsError) throw bookingsError;

        if (bookings && bookings.length > 0) {
          bookings.forEach(booking => {
            const monthYear = new Date(booking.created_at).toISOString().substring(0, 7);
            if (reservationsByMonth[monthYear] !== undefined) {
              reservationsByMonth[monthYear] += (booking.quantity || 0);
            }
          });
        }
      }
      
      const formattedData = Object.entries(reservationsByMonth)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
        
      setMonthlyReservations(formattedData);
    } catch (error) {
      console.error("Error in fetchMonthlyReservations:", error);
      
      // Even on error, provide empty data for all 12 months
      const today = new Date();
      // Add one month to make May the last month instead of April
      today.setMonth(today.getMonth() + 1);
      const last12Months = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        return d.toISOString().substring(0, 7);
      }).reverse();
      
      const emptyData = last12Months.map(month => ({ month, count: 0 }));
      setMonthlyReservations(emptyData);
    } 
    // No longer need to set loading to false here since it's handled in refreshAllData
  }, [organizerId]);

  // Function to refresh all data
  const refreshAllData = useCallback(async () => {
    if (!organizerId) {
      setIsRefreshing(false);
      return;
    }
    setIsRefreshing(true);
    setHasError(false);
    setLoadingMonthlyTrends(true); // Set loading true for the group of new charts

    // Divide into separate try/catch blocks to allow partial success
    try {
      await Promise.all([
        fetchMonthlyExpenditures(),
        fetchMonthlyRevenues(),
        fetchMonthlyImpressions(),
        fetchMonthlyTicketSales(),
        fetchMonthlyReservations(),
      ]);
    } catch (error) {
      console.error("Error refreshing monthly data:", error);
      setHasError(true);
    }

    try {
      // Call these functions separately to avoid circular dependencies
      await fetchEventRevenues();
    } catch (error) {
      console.error("Error refreshing event revenues:", error);
      setHasError(true);
    }

    try {
      await fetchEventRatings();
    } catch (error) {
      console.error("Error refreshing event ratings:", error);
      setHasError(true);
    }

    try {
      await fetchAnalyticsSummary();
    } catch (error) {
      console.error("Error refreshing analytics summary:", error);
      setHasError(true);
    }

    setLoadingMonthlyTrends(false);
    setIsRefreshing(false);
  }, [
    organizerId,
    fetchMonthlyExpenditures,
    fetchMonthlyRevenues,
    fetchMonthlyImpressions, 
    fetchMonthlyTicketSales, 
    fetchMonthlyReservations,
    // These are now called separately to avoid circular dependencies
    // fetchEventRevenues,
    // fetchEventRatings,
    // fetchAnalyticsSummary,
  ]);
  
  // Load all data when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (organizerId) {
        refreshAllData();
      }
    }, [organizerId, refreshAllData])
  );
  
  // Function to format month labels
  const formatMonthLabel = (monthStr: string) => {
    const date = new Date(monthStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };
  
  // Function to truncate event names for charts
  const truncateEventName = (name: string, maxLength = 12) => {
    return name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
  };

  // Prepare chart data
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
    labels: ticketsReservationsData.ticketedEvents.map(item => truncateEventName(item.eventName)),
    datasets: [
      {
        data: ticketsReservationsData.ticketedEvents.map(item => item.ticketCount),
      }
    ],
  };

  const reservationsData = {
    labels: ticketsReservationsData.reservationEvents.map(item => truncateEventName(item.eventName)),
    datasets: [
      {
        data: ticketsReservationsData.reservationEvents.map(item => item.reservationCount),
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
    labels: impressionsData.map(item => truncateEventName(item.eventName)),
    datasets: [
      {
        data: impressionsData.map(item => item.impressionCount),
      }
    ],
  };

  // Prepare chart data for monthly trends
  const monthlyImpressionsChartData = {
    labels: monthlyImpressions.map(item => formatMonthLabel(item.month)),
    datasets: [{ data: monthlyImpressions.map(item => item.count) }],
  };

  const monthlyTicketSalesChartData = {
    labels: monthlyTicketSales.map(item => formatMonthLabel(item.month)),
    datasets: [{ data: monthlyTicketSales.map(item => item.count) }],
  };

  const monthlyReservationsChartData = {
    labels: monthlyReservations.map(item => formatMonthLabel(item.month)),
    datasets: [{ data: monthlyReservations.map(item => item.count) }],
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

  // Updated function to fetch event revenues and impressions for the current month
  const fetchEventRevenues = useCallback(async () => {
    if (!organizerId) return;

    try {
      setLoadingRevenues(true);
      setHasError(false);

      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

      console.log(`Fetching events from ${firstDayOfMonth} to ${lastDayOfMonth}`);

      // 1. Fetch events for the organizer within the current month with booking_type
      const { data: currentMonthEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, title, booking_type, event_datetime')
        .eq('organizer_id', organizerId)
        .gte('event_datetime', firstDayOfMonth)
        .lte('event_datetime', lastDayOfMonth);

      if (eventsError) {
        console.error("Error fetching events for event revenues:", eventsError);
        throw eventsError;
      }

      console.log("Current month events:", currentMonthEvents?.length || 0);

      if (!currentMonthEvents || currentMonthEvents.length === 0) {
        console.log("No events found for current month");
        setEventRevenues([]);
        setTicketsReservationsData({ ticketedEvents: [], reservationEvents: [] });
        setImpressionsData([]);
        setLoadingRevenues(false);
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
        impressionCount: number; // Add this to track impressions
      }
      
      const eventRevenueMap: Record<string, EventRevenueMapItem> = {};
      const ticketedEvents: {
        eventId: string;
        eventName: string;
        ticketCount: number;
      }[] = [];
      
      const reservationEvents: {
        eventId: string;
        eventName: string;
        reservationCount: number;
      }[] = [];

      // Process and categorize events by booking type
      currentMonthEvents.forEach(event => {
        eventRevenueMap[event.id] = { 
          eventId: event.id,
          eventName: event.title, 
          revenue: 0, 
          attendeeCount: 0,
          bookingType: event.booking_type,
          impressionCount: 0 // Initialize impression count
        };
      });

      // 2. Fetch ALL confirmed bookings for these events
      console.log("Fetching bookings for events:", eventIds);
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('event_bookings')
        .select('event_id, quantity, total_price_paid, status')
        .in('event_id', eventIds)
        .eq('status', 'CONFIRMED');

      if (bookingsError) {
        console.error("Error fetching bookings for event revenues:", bookingsError);
        throw bookingsError;
      }

      console.log("Bookings found:", bookingsData?.length || 0);

      // 3. Fetch impressions for these events
      console.log("Fetching impressions for events:", eventIds);
      const { data: impressionsData, error: impressionsError } = await supabase
        .from('event_impressions')
        .select('event_id, id')
        .in('event_id', eventIds);

      if (impressionsError) {
        console.error("Error fetching impressions:", impressionsError);
        // Continue with available data even if impressions fetch fails
      } else {
        console.log("Impressions found:", impressionsData?.length || 0);
        
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
            // Add revenue if this is a paid booking
            eventRevenueMap[booking.event_id].revenue += (booking.total_price_paid || 0);
            
            // Add to attendee count regardless of payment
            eventRevenueMap[booking.event_id].attendeeCount += (booking.quantity || 0);
          }
        });
      }

      // Classify events into ticketed and reservation events
      Object.values(eventRevenueMap).forEach((event: EventRevenueMapItem) => {
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
      });

      // Sort both lists by count (highest first)
      ticketedEvents.sort((a, b) => b.ticketCount - a.ticketCount);
      reservationEvents.sort((a, b) => b.reservationCount - a.reservationCount);

      // Create a filtered array of events with revenue for the revenue chart
      const formattedEventRevenues = Object.values(eventRevenueMap)
        .filter((event: EventRevenueMapItem) => event.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue) as EventRevenue[];
      
      // Create array of events with impressions
      const formattedImpressions = Object.values(eventRevenueMap)
        .filter((event: EventRevenueMapItem) => event.impressionCount > 0)
        .map(event => ({
          eventId: event.eventId,
          eventName: event.eventName,
          impressionCount: event.impressionCount
        }))
        .sort((a, b) => b.impressionCount - a.impressionCount);

      console.log("Tickets events:", ticketedEvents.length);
      console.log("Reservation events:", reservationEvents.length);
      console.log("Revenue events:", formattedEventRevenues.length);
      console.log("Impression events:", formattedImpressions.length);

      setEventRevenues(formattedEventRevenues);
      setTicketsReservationsData({
        ticketedEvents,
        reservationEvents
      });
      setImpressionsData(formattedImpressions);
    } catch (error) {
      console.error("Error in fetchEventRevenues:", error);
      setHasError(true);
    } finally {
      setLoadingRevenues(false);
    }
  }, [organizerId]);

  // Function to fetch event attendee counts for the current month
  const fetchEventAttendees = useCallback(async () => {
    if (!organizerId) return;

    // This function now depends on eventRevenues state being populated by fetchEventRevenues
    // for the list of current month's events.
    const currentEventsForAttendeeCount = eventRevenues.map(er => er.eventId);
    if (currentEventsForAttendeeCount.length === 0) {
      // No current month events found by fetchEventRevenues, so nothing to do here.
      // Or, if eventRevenues is not yet populated, this might run prematurely.
      // Consider if initial call order matters or if eventRevenues should be passed.
      setLoadingAttendees(false);
      return;
    }

    try {
      setLoadingAttendees(true);
      setHasError(false);

      // Fetch confirmed bookings for the already identified current month events
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('event_bookings')
        .select('event_id, quantity')
        .in('event_id', currentEventsForAttendeeCount)
        .eq('status', 'CONFIRMED');

      if (bookingsError) {
        console.error("Error fetching bookings for event attendees:", bookingsError);
        throw bookingsError;
      }

      const attendeeCountMap: { [eventId: string]: number } = {};
      if (bookingsData) {
        bookingsData.forEach(booking => {
          attendeeCountMap[booking.event_id] = (attendeeCountMap[booking.event_id] || 0) + (booking.quantity || 0);
        });
      }

      // Update the eventRevenues state with attendee counts
      setEventRevenues(prevEventRevenues => 
        prevEventRevenues.map(eventRev => ({
          ...eventRev,
          attendeeCount: attendeeCountMap[eventRev.eventId] || eventRev.attendeeCount || 0,
        }))
      );

    } catch (error) {
      console.error("Error in fetchEventAttendees:", error);
      // Avoid overwriting a general error from another function if possible
      // setHasError(true); 
    } finally {
      setLoadingAttendees(false);
    }
  // Depend on eventRevenues to ensure it has the event IDs, this creates a potential dependency cycle if not handled carefully in useEffect
  // For now, keeping organizerId, but the logic relies on eventRevenues being somewhat up-to-date.
  }, [organizerId, eventRevenues]); // Added eventRevenues to dependency array

  // Function to fetch average event ratings
  const fetchEventRatings = useCallback(async () => {
    if (!organizerId) return;

    try {
      setLoadingRatings(true);
      setHasError(false);

      const now = new Date().toISOString();

      // 1. Fetch latest 5 completed events for the organizer
      const { data: recentCompletedEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, title')
        .eq('organizer_id', organizerId)
        .lt('event_datetime', now) // Event datetime is in the past
        .order('event_datetime', { ascending: false })
        .limit(5);

      if (eventsError) {
        console.error("Error fetching recent completed events:", eventsError);
        throw eventsError;
      }

      if (!recentCompletedEvents || recentCompletedEvents.length === 0) {
        setEventRatings([]);
        setLoadingRatings(false);
        return;
      }

      const eventIdsToFetchRatings = recentCompletedEvents.map(event => event.id);

      // 2. Fetch ratings for these specific events
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('event_ratings')
        .select('event_id, rating')
        .in('event_id', eventIdsToFetchRatings);

      if (ratingsError) {
        console.error("Error fetching event ratings data:", ratingsError);
        // Potentially set partial data or throw, for now, continue if possible
      }

      const ratingsMap: { [eventId: string]: { totalRating: number; count: number } } = {};
      if (ratingsData) {
        ratingsData.forEach(ratingEntry => {
          if (!ratingsMap[ratingEntry.event_id]) {
            ratingsMap[ratingEntry.event_id] = { totalRating: 0, count: 0 };
          }
          ratingsMap[ratingEntry.event_id].totalRating += ratingEntry.rating;
          ratingsMap[ratingEntry.event_id].count += 1;
        });
      }

      const formattedEventRatings: EventRating[] = recentCompletedEvents.map(event => {
        const DBratingInfo = ratingsMap[event.id];
        const averageRating = (DBratingInfo && DBratingInfo.count > 0) 
                              ? parseFloat((DBratingInfo.totalRating / DBratingInfo.count).toFixed(1))
                              : 0;
        const numberOfRatings = DBratingInfo?.count || 0;
        return {
          eventId: event.id,
          eventName: event.title,
          averageRating: averageRating,
          numberOfRatings: numberOfRatings,
        };
      });

      setEventRatings(formattedEventRatings);
    } catch (error) {
      console.error("Error in fetchEventRatings:", error);
      setHasError(true);
      setEventRatings([]);
    } finally {
      setLoadingRatings(false);
    }
  }, [organizerId]);

  // Update the fetchAnalyticsSummary function to include avgImpressionsPerEvent
  const fetchAnalyticsSummary = useCallback(async () => {
    if (!organizerId) return;

    try {
      setLoadingSummary(true);
      setHasError(false);

      // 1. Fetch all events for the organizer
      const { data: allEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, tags_genres, tags_artists, tags_songs') // Select tags for popularity
        .eq('organizer_id', organizerId);

      if (eventsError) {
        console.error("Error fetching events for summary:", eventsError);
        throw eventsError;
      }
      
      const numberOfEvents = allEvents?.length || 0;
      console.log(`Total events found for analytics: ${numberOfEvents}`);
      
      if (numberOfEvents === 0) {
        setAnalyticsSummary({
          avgCostPerEvent: 0,
          avgRevenuePerEvent: 0,
          avgAttendeesPerEvent: 0,
          avgImpressionsPerEvent: 0,
          popularTags: [],
        });
        setLoadingSummary(false);
        return;
      }
      const eventIds = allEvents!.map(e => e.id);

      // 2. Fetch all confirmed bookings for these events
      const { data: allBookings, error: bookingsError } = await supabase
        .from('event_bookings')
        .select('quantity, total_price_paid')
        .in('event_id', eventIds)
        .eq('status', 'CONFIRMED');

      if (bookingsError) {
        console.error("Error fetching bookings for summary:", bookingsError);
        // Continue with potentially partial data or throw
      }

      // 3. Fetch impressions count with a more robust approach
      let totalImpressionCount = 0;
      
      // First try with count query
      const { count: countResult, error: countError } = await supabase
        .from('event_impressions')
        .select('id', { count: 'exact', head: true })
        .in('event_id', eventIds);
        
      if (countError || countResult === null) {
        console.warn("Count query failed, fetching all impressions to count manually:", countError);
        
        // Fallback: fetch all impressions and count them
        const { data: impressionsData, error: impressionsDataError } = await supabase
          .from('event_impressions')
          .select('id')
          .in('event_id', eventIds);
          
        if (impressionsDataError) {
          console.error("Error fetching impressions data:", impressionsDataError);
        } else {
          totalImpressionCount = impressionsData?.length || 0;
          console.log(`Counted impressions manually: ${totalImpressionCount}`);
        }
      } else {
        totalImpressionCount = countResult;
        console.log(`Got impression count from API: ${totalImpressionCount}`);
      }

      // 4. Calculate totals
      let totalRevenue = 0;
      let totalAttendees = 0;
      let totalBookingTransactions = 0; // To calculate booking cost

      if (allBookings) {
        allBookings.forEach(booking => {
          totalRevenue += booking.total_price_paid || 0;
          totalAttendees += booking.quantity || 0;
          totalBookingTransactions += (booking.quantity || 0); // Each item in quantity is a transaction for cost purposes
        });
      }

      const totalImpressionCost = totalImpressionCount * 0.0075;
      const totalBookingCost = totalBookingTransactions * 0.50;
      const totalOverallCost = totalImpressionCost + totalBookingCost;

      // 5. Calculate averages
      const avgCostPerEvent = numberOfEvents > 0 ? totalOverallCost / numberOfEvents : 0;
      const avgRevenuePerEvent = numberOfEvents > 0 ? totalRevenue / numberOfEvents : 0;
      const avgAttendeesPerEvent = numberOfEvents > 0 ? totalAttendees / numberOfEvents : 0;
      const avgImpressionsPerEvent = numberOfEvents > 0 ? totalImpressionCount / numberOfEvents : 0;
      
      console.log("Analytics calculation results:");
      console.log(`Total events: ${numberOfEvents}`);
      console.log(`Total impressions: ${totalImpressionCount}`);
      console.log(`Avg impressions per event: ${avgImpressionsPerEvent}`);
      console.log(`Total revenue: $${totalRevenue}`);
      console.log(`Avg revenue per event: $${avgRevenuePerEvent}`);
      console.log(`Total attendees: ${totalAttendees}`);
      console.log(`Avg attendees per event: ${avgAttendeesPerEvent}`);

      // 6. Aggregate and count tags
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
        avgCostPerEvent: avgCostPerEvent, // Keep exact value
        avgRevenuePerEvent: avgRevenuePerEvent, // Keep exact value  
        avgAttendeesPerEvent: avgAttendeesPerEvent, // Keep exact value
        avgImpressionsPerEvent: avgImpressionsPerEvent, // Keep exact value
        popularTags,
      });

    } catch (error) {
      console.error("Error in fetchAnalyticsSummary:", error);
      setHasError(true);
      setAnalyticsSummary(null); // Clear or set to a default error state
    } finally {
      setLoadingSummary(false);
    }
  }, [organizerId]);
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshAllData}
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
                yAxisLabel="$"
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
          {loadingRevenues && ticketsReservationsData.ticketedEvents.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
              <Text style={styles.placeholderText}>Loading ticket data...</Text>
            </View>
          ) : ticketsReservationsData.ticketedEvents.length === 0 ? (
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
          {loadingRevenues && ticketsReservationsData.reservationEvents.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
              <Text style={styles.placeholderText}>Loading reservation data...</Text>
            </View>
          ) : ticketsReservationsData.reservationEvents.length === 0 ? (
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
          {loadingRevenues && impressionsData.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
              <Text style={styles.placeholderText}>Loading impression data...</Text>
            </View>
          ) : impressionsData.length === 0 ? (
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
                yAxisLabel=""
                yAxisSuffix="$"
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
        <Section title="Total Impressions per Month" icon="activity" loading={loadingMonthlyTrends}>
          {loadingMonthlyTrends && monthlyImpressions.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
              <Text style={styles.placeholderText}>Loading monthly impression data...</Text>
            </View>
          ) : monthlyImpressions.length === 0 ? (
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
        <Section title="Impression Costs ($0.0075 per impression)" icon="eye" loading={loadingExpenses}>
          {loadingExpenses && monthlyExpenditures.length === 0 ? (
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
                yAxisLabel=""
                yAxisSuffix="$"
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
        <Section title="Total Tickets Sold per Month" icon="tag" loading={loadingMonthlyTrends}>
          {loadingMonthlyTrends && monthlyTicketSales.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
              <Text style={styles.placeholderText}>Loading monthly ticket sales data...</Text>
            </View>
          ) : monthlyTicketSales.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="tag" size={32} color="#9CA3AF" />
              <Text style={styles.emptyText}>No ticket sales data found for the past 12 months.</Text>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <BarChart
                data={monthlyTicketSalesChartData}
                width={chartWidth}
                height={220}
                yAxisLabel=""
                yAxisSuffix=" tix"
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, // Green
                }}
                verticalLabelRotation={30}
                showValuesOnTopOfBars
                withInnerLines={false}
                fromZero
                style={styles.chart}
              />
              <Text style={styles.chartDescription}>
                Total tickets sold over the last 12 months.
              </Text>
            </View>
          )}
        </Section>

        {/* Total Reservations Made per Month (MOVED: Now before Ticket/Reservation Costs) */}
        <Section title="Total Reservations Made per Month" icon="bookmark" loading={loadingMonthlyTrends}>
          {(loadingMonthlyTrends && monthlyReservations.length === 0 && !isRefreshing) ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
              <Text style={styles.placeholderText}>Loading monthly reservation data...</Text>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <BarChart
                data={monthlyReservationsChartData}
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
              {monthlyReservations.length === 0 && (
                <Text style={styles.noDataText}>No reservation data available for this period.</Text>
              )}
            </View>
          )}
        </Section>
        
        {/* Ticket/Reservation Cost Section (MOVED: Now after monthly ticket/reservation charts) */}
        <Section title="Ticket/Reservation Costs ($0.50 per transaction)" icon="dollar-sign" loading={loadingExpenses}>
          {loadingExpenses && monthlyExpenditures.length === 0 ? (
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
                yAxisLabel=""
                yAxisSuffix="$"
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
          loading={loadingExpenses}
        >
          {loadingExpenses && monthlyExpenditures.length === 0 ? (
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
                yAxisLabel=""
                yAxisSuffix="$"
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
          loading={loadingSummary}
        >
          {loadingSummary && !analyticsSummary ? (
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
                    ${analyticsSummary.avgCostPerEvent.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Avg. Revenue per Event</Text>
                  <Text style={styles.summaryValue}>
                    ${analyticsSummary.avgRevenuePerEvent.toFixed(2)}
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
                  ${(analyticsSummary.avgRevenuePerEvent - analyticsSummary.avgCostPerEvent).toFixed(2)}
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
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
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
    marginBottom: 16,
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