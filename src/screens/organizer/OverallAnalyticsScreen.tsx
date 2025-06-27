import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, 
  TouchableOpacity, RefreshControl, Dimensions, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-chart-kit';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
const chartWidth = Math.min(screenWidth - 90, 700); // Wider chart for better visibility
const chartHeight = 260; // Increased height for better visibility

const baseChartConfig = {
  backgroundColor: '#FFFFFF',
  backgroundGradientFrom: '#FFFFFF',
  backgroundGradientTo: '#FAFBFF',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(51, 65, 85, ${opacity})`,
  style: { 
    borderRadius: 20,
    paddingRight: 35, // Increased to prevent right label cutoff
    paddingLeft: 15,  // Added padding to prevent left label cutoff
  },
  propsForLabels: { 
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  propsForBackgroundLines: {
    strokeWidth: 1,
    stroke: '#F1F5F9',
    strokeDasharray: '3,3',
  },
  barPercentage: 0.65,
  fillShadowGradientFrom: '#EEF2FF',
  fillShadowGradientFromOpacity: 0.8,
  fillShadowGradientTo: '#FAFBFF',
  fillShadowGradientToOpacity: 0.2,
  strokeWidth: 2,
  useShadowColorFromDataset: false,
};

// Enhanced color palette with gradients
const chartColors = {
  revenue: {
    primary: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, // Emerald
    gradient: ['#10B981', '#059669'],
    background: '#ECFDF5',
    light: '#D1FAE5',
  },
  tickets: {
    primary: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`, // Indigo
    gradient: ['#6366F1', '#4F46E5'],
    background: '#EEF2FF',
    light: '#E0E7FF',
  },
  reservations: {
    primary: (opacity = 1) => `rgba(236, 72, 153, ${opacity})`, // Pink
    gradient: ['#EC4899', '#DB2777'],
    background: '#FDF2F8',
    light: '#FCE7F3',
  },
  impressions: {
    primary: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, // Blue
    gradient: ['#3B82F6', '#2563EB'],
    background: '#EFF6FF',
    light: '#DBEAFE',
  },
  costs: {
    primary: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`, // Red
    gradient: ['#EF4444', '#DC2626'],
    background: '#FEF2F2',
    light: '#FECACA',
  },
  ratings: {
    primary: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`, // Amber
    gradient: ['#F59E0B', '#D97706'],
    background: '#FFFBEB',
    light: '#FEF3C7',
  },
  combined: {
    primary: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`, // Purple
    gradient: ['#8B5CF6', '#7C3AED'],
    background: '#F5F3FF',
    light: '#E0E7FF',
  },
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
  const navigation = useNavigation();
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
  
  // Function to format month labels with better formatting
  const formatMonthLabel = (monthStr: string) => {
    const date = new Date(monthStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };
  
  // Function to truncate event names for charts with better handling
  const truncateEventName = (name: string, maxLength = 10) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 1) + '…';
  };

  // Enhanced helper function to format currency values
  const formatCurrency = (value: number) => {
    if (value === 0) return '$0';
    if (value < 0.01) return `$${value.toFixed(4)}`;
    if (value < 1) return `$${value.toFixed(3)}`;
    if (value < 100) return `$${value.toFixed(2)}`;
    if (value < 1000) return `$${Math.round(value)}`;
    if (value < 1000000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${(value / 1000000).toFixed(1)}M`;
  };

  // Enhanced helper function to format numbers with proper scaling
  const formatNumber = (value: number) => {
    if (value === 0) return '0';
    if (value < 1000) return Math.round(value).toString();
    if (value < 1000000) return `${(value / 1000).toFixed(1)}k`;
    return `${(value / 1000000).toFixed(1)}M`;
  };

  // Enhanced chart data preparation with better formatting
  const createChartConfig = (colorScheme: any, decimalPlaces = 0) => ({
    ...baseChartConfig,
    color: colorScheme.primary,
    fillShadowGradientFrom: colorScheme.light,
    fillShadowGradientTo: colorScheme.background,
    decimalPlaces,
  });

  // Prepare chart data with enhanced formatting
  const impressionCostData = {
    labels: monthlyExpenditures.map(item => formatMonthLabel(item.month)),
    datasets: [
      {
        data: monthlyExpenditures.map(item => Math.max(item.impressionCost, 0.001)),
        colors: monthlyExpenditures.map(() => chartColors.costs.primary),
      }
    ],
  };
  
  const bookingCostData = {
    labels: monthlyExpenditures.map(item => formatMonthLabel(item.month)),
    datasets: [
      {
        data: monthlyExpenditures.map(item => Math.max(item.bookingCost, 0.001)),
        colors: monthlyExpenditures.map(() => chartColors.ratings.primary),
      }
    ],
  };
  
  const totalCostData = {
    labels: monthlyExpenditures.map(item => formatMonthLabel(item.month)),
    datasets: [
      {
        data: monthlyExpenditures.map(item => Math.max(item.totalCost, 0.001)),
        colors: monthlyExpenditures.map(() => chartColors.combined.primary),
      }
    ],
  };
  
  const eventRevenueData = {
    labels: eventRevenues.slice(0, 6).map(item => truncateEventName(item.eventName, 8)), // Reduced to 6 for better readability
    datasets: [
      {
        data: eventRevenues.slice(0, 6).map(item => Math.max(item.revenue, 0.01)),
        colors: eventRevenues.slice(0, 6).map(() => chartColors.revenue.primary),
      }
    ],
  };
  
  const ticketsData = {
    labels: ticketsReservationsData.ticketedEvents.slice(0, 6).map(item => truncateEventName(item.eventName, 8)),
    datasets: [
      {
        data: ticketsReservationsData.ticketedEvents.slice(0, 6).map(item => Math.max(item.ticketCount, 1)),
        colors: ticketsReservationsData.ticketedEvents.slice(0, 6).map(() => chartColors.tickets.primary),
      }
    ],
  };

  const reservationsData = {
    labels: ticketsReservationsData.reservationEvents.slice(0, 6).map(item => truncateEventName(item.eventName, 8)),
    datasets: [
      {
        data: ticketsReservationsData.reservationEvents.slice(0, 6).map(item => Math.max(item.reservationCount, 1)),
        colors: ticketsReservationsData.reservationEvents.slice(0, 6).map(() => chartColors.reservations.primary),
      }
    ],
  };
  
  const monthlyRevenueData = {
    labels: monthlyRevenues.map(item => formatMonthLabel(item.month)),
    datasets: [
      {
        data: monthlyRevenues.map(item => Math.max(item.revenue, 0.01)),
        colors: monthlyRevenues.map(() => chartColors.revenue.primary),
      }
    ],
  };
  
  const eventRatingData = {
    labels: eventRatings.slice(0, 6).map(item => truncateEventName(item.eventName, 8)),
    datasets: [
      {
        data: eventRatings.slice(0, 6).map(item => Math.max(item.averageRating, 0.1)),
        colors: eventRatings.slice(0, 6).map(() => chartColors.ratings.primary),
      }
    ],
  };

  // Prepare new chart data for impressions
  const impressionsChartData = {
    labels: impressionsData.slice(0, 6).map(item => truncateEventName(item.eventName, 8)),
    datasets: [
      {
        data: impressionsData.slice(0, 6).map(item => Math.max(item.impressionCount, 1)),
        colors: impressionsData.slice(0, 6).map(() => chartColors.impressions.primary),
      }
    ],
  };

  // Prepare chart data for monthly trends
  const monthlyImpressionsChartData = {
    labels: monthlyImpressions.map(item => formatMonthLabel(item.month)),
    datasets: [{ 
      data: monthlyImpressions.map(item => Math.max(item.count, 0)),
      colors: monthlyImpressions.map(() => chartColors.impressions.primary),
    }],
  };

  const monthlyTicketSalesChartData = {
    labels: monthlyTicketSales.map(item => formatMonthLabel(item.month)),
    datasets: [{ 
      data: monthlyTicketSales.map(item => Math.max(item.count, 0)),
      colors: monthlyTicketSales.map(() => chartColors.tickets.primary),
    }],
  };

  const monthlyReservationsChartData = {
    labels: monthlyReservations.map(item => formatMonthLabel(item.month)),
    datasets: [{ 
      data: monthlyReservations.map(item => Math.max(item.count, 0)),
      colors: monthlyReservations.map(() => chartColors.reservations.primary),
    }],
  };

  // Enhanced BarChart component wrapper for ratings
  const RatingsBarChart = ({ data, width, height, ...props }: any) => {
    const maxRating = 5;
    const chartData = {
      ...data,
      datasets: data.datasets.map((dataset: any) => ({
        ...dataset,
        data: dataset.data.map((value: number) => Math.min(Math.max(value, 0.1), maxRating))
      }))
    };

    return (
      <View style={styles.ratingChartContainer}>
        <View style={styles.chartGradientOverlay} />
        <BarChart 
          data={chartData}
          width={width}
          height={height}
          yAxisLabel=""
          yAxisSuffix="★"
          chartConfig={createChartConfig(chartColors.ratings, 1)}
          verticalLabelRotation={30}
          showValuesOnTopOfBars
          withInnerLines={true}
          fromZero
          segments={5}
          style={styles.enhancedChart}
          {...props}
        />
        <View style={styles.ratingLegendContainer}>
          <Text style={styles.legendTitle}>Event Ratings Details</Text>
          {eventRatings.slice(0, 6).map((item, index) => (
            <View key={index} style={styles.ratingLegendItem}>
              <View style={styles.legendDot} />
              <Text style={styles.ratingLegendName}>{truncateEventName(item.eventName, 25)}</Text>
              <View style={styles.ratingLegendRating}>
                <Text style={styles.ratingLegendValue}>{item.averageRating.toFixed(1)}★</Text>
                <Text style={styles.ratingLegendCount}>({item.numberOfRatings})</Text>
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
        
        {/* 1. Event Revenue Section - Enhanced */}
        <Section 
          title="💰 Event Revenue (Current Month)" 
          icon="dollar-sign"
          loading={loadingRevenues}
        >
          {loadingRevenues && eventRevenues.length === 0 ? (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingSpinner}>
                <ActivityIndicator size="large" color={chartColors.revenue.primary()} />
              </View>
              <Text style={styles.placeholderText}>Loading revenue data...</Text>
            </View>
          ) : eventRevenues.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: chartColors.revenue.background }]}>
                <Feather name="dollar-sign" size={40} color={chartColors.revenue.primary()} />
              </View>
              <Text style={styles.emptyTitle}>No Revenue Data</Text>
              <Text style={styles.emptyText}>No revenue generated this month</Text>
              <View style={styles.emptyDetailsContainer}>
                <Text style={styles.emptySubText}>This could be because:</Text>
                <View style={styles.bulletPointContainer}>
                  <Text style={styles.bulletPoint}>• No events were scheduled this month</Text>
                  <Text style={styles.bulletPoint}>• No tickets were sold for this month's events</Text>
                  <Text style={styles.bulletPoint}>• Your events are free (no revenue to track)</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.enhancedChartContainer}>
              <View style={styles.chartHeaderContainer}>
                <Text style={styles.chartMetricValue}>
                  ${eventRevenues.reduce((sum, event) => sum + event.revenue, 0).toFixed(2)}
                </Text>
                <Text style={styles.chartMetricLabel}>Total Revenue This Month</Text>
              </View>
              <View style={styles.chartWrapper}>
                <BarChart
                  data={eventRevenueData}
                  width={chartWidth}
                  height={chartHeight}
                  yAxisLabel="$"
                  yAxisSuffix=""
                  chartConfig={createChartConfig(chartColors.revenue)}
                  verticalLabelRotation={30}
                  showValuesOnTopOfBars
                  withInnerLines={false}
                  fromZero
                  style={styles.enhancedChart}
                />
              </View>
              <Text style={styles.chartDescription}>
                Revenue by event for the current month
              </Text>
              {eventRevenues.length > 6 && (
                <Text style={styles.chartNote}>
                  Showing top 6 events • {eventRevenues.length} total events
                </Text>
              )}
            </View>
          )}
        </Section>
        
        {/* 2. Tickets Sold Section - Enhanced */}
        <Section 
          title="🎫 Tickets Sold (Current Month)" 
          icon="tag"
          loading={loadingRevenues}
        >
          {loadingRevenues && ticketsReservationsData.ticketedEvents.length === 0 ? (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingSpinner}>
                <ActivityIndicator size="large" color={chartColors.tickets.primary()} />
              </View>
              <Text style={styles.placeholderText}>Loading ticket data...</Text>
            </View>
          ) : ticketsReservationsData.ticketedEvents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: chartColors.tickets.background }]}>
                <Feather name="tag" size={40} color={chartColors.tickets.primary()} />
              </View>
              <Text style={styles.emptyTitle}>No Ticket Sales</Text>
              <Text style={styles.emptyText}>No tickets sold this month</Text>
              <View style={styles.emptyDetailsContainer}>
                <Text style={styles.emptySubText}>This could be because:</Text>
                <View style={styles.bulletPointContainer}>
                  <Text style={styles.bulletPoint}>• No ticketed events were scheduled this month</Text>
                  <Text style={styles.bulletPoint}>• No tickets have been sold yet</Text>
                  <Text style={styles.bulletPoint}>• Your events use reservations instead of tickets</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.enhancedChartContainer}>
              <View style={styles.chartHeaderContainer}>
                <Text style={styles.chartMetricValue}>
                  {ticketsReservationsData.ticketedEvents.reduce((sum, event) => sum + event.ticketCount, 0)}
                </Text>
                <Text style={styles.chartMetricLabel}>Total Tickets Sold</Text>
              </View>
              <View style={styles.chartWrapper}>
                <BarChart
                  data={ticketsData}
                  width={chartWidth}
                  height={chartHeight}
                  yAxisLabel=""
                  yAxisSuffix=" tix"
                  chartConfig={createChartConfig(chartColors.tickets)}
                  verticalLabelRotation={30}
                  showValuesOnTopOfBars
                  withInnerLines={false}
                  fromZero
                  style={styles.enhancedChart}
                />
              </View>
              <Text style={styles.chartDescription}>
                Tickets sold by event for the current month
              </Text>
              {ticketsReservationsData.ticketedEvents.length > 6 && (
                <Text style={styles.chartNote}>
                  Showing top 6 events • {ticketsReservationsData.ticketedEvents.length} total events
                </Text>
              )}
            </View>
          )}
        </Section>
        
        {/* 3. Reservations Section - Enhanced */}
        <Section 
          title="📋 Reservations Made (Current Month)" 
          icon="bookmark"
          loading={loadingRevenues}
        >
          {loadingRevenues && ticketsReservationsData.reservationEvents.length === 0 ? (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingSpinner}>
                <ActivityIndicator size="large" color={chartColors.reservations.primary()} />
              </View>
              <Text style={styles.placeholderText}>Loading reservation data...</Text>
            </View>
          ) : ticketsReservationsData.reservationEvents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: chartColors.reservations.background }]}>
                <Feather name="bookmark" size={40} color={chartColors.reservations.primary()} />
              </View>
              <Text style={styles.emptyTitle}>No Reservations</Text>
              <Text style={styles.emptyText}>No reservations made this month</Text>
              <View style={styles.emptyDetailsContainer}>
                <Text style={styles.emptySubText}>This could be because:</Text>
                <View style={styles.bulletPointContainer}>
                  <Text style={styles.bulletPoint}>• No reservation-based events this month</Text>
                  <Text style={styles.bulletPoint}>• No reservations have been made yet</Text>
                  <Text style={styles.bulletPoint}>• Your events use tickets instead of reservations</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.enhancedChartContainer}>
              <View style={styles.chartHeaderContainer}>
                <Text style={styles.chartMetricValue}>
                  {ticketsReservationsData.reservationEvents.reduce((sum, event) => sum + event.reservationCount, 0)}
                </Text>
                <Text style={styles.chartMetricLabel}>Total Reservations Made</Text>
              </View>
              <View style={styles.chartWrapper}>
                <BarChart
                  data={reservationsData}
                  width={chartWidth}
                  height={chartHeight}
                  yAxisLabel=""
                  yAxisSuffix=""
                  chartConfig={createChartConfig(chartColors.reservations)}
                  verticalLabelRotation={30}
                  showValuesOnTopOfBars
                  withInnerLines={false}
                  fromZero
                  style={styles.enhancedChart}
                />
              </View>
              <Text style={styles.chartDescription}>
                Reservations made by event for the current month
              </Text>
              {ticketsReservationsData.reservationEvents.length > 6 && (
                <Text style={styles.chartNote}>
                  Showing top 6 events • {ticketsReservationsData.reservationEvents.length} total events
                </Text>
              )}
            </View>
          )}
        </Section>

        {/* 4. Event Impressions Section - Enhanced */}
        <Section 
          title="👀 Event Impressions (Current Month)" 
          icon="eye"
          loading={loadingRevenues}
        >
          {loadingRevenues && impressionsData.length === 0 ? (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingSpinner}>
                <ActivityIndicator size="large" color={chartColors.impressions.primary()} />
              </View>
              <Text style={styles.placeholderText}>Loading impression data...</Text>
            </View>
          ) : impressionsData.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: chartColors.impressions.background }]}>
                <Feather name="eye" size={40} color={chartColors.impressions.primary()} />
              </View>
              <Text style={styles.emptyTitle}>No Impressions</Text>
              <Text style={styles.emptyText}>No event views this month</Text>
              <View style={styles.emptyDetailsContainer}>
                <Text style={styles.emptySubText}>This could be because:</Text>
                <View style={styles.bulletPointContainer}>
                  <Text style={styles.bulletPoint}>• No events were viewed this month</Text>
                  <Text style={styles.bulletPoint}>• No impressions have been tracked yet</Text>
                  <Text style={styles.bulletPoint}>• Your events haven't been discovered by users</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.enhancedChartContainer}>
              <View style={styles.chartHeaderContainer}>
                <Text style={styles.chartMetricValue}>
                  {impressionsData.reduce((sum, event) => sum + event.impressionCount, 0).toLocaleString()}
                </Text>
                <Text style={styles.chartMetricLabel}>Total Impressions This Month</Text>
              </View>
              <View style={styles.chartWrapper}>
                <BarChart
                  data={impressionsChartData}
                  width={chartWidth}
                  height={chartHeight}
                  yAxisLabel=""
                  yAxisSuffix=" views"
                  chartConfig={createChartConfig(chartColors.impressions)}
                  verticalLabelRotation={30}
                  showValuesOnTopOfBars
                  withInnerLines={false}
                  fromZero
                  style={styles.enhancedChart}
                />
              </View>
              <Text style={styles.chartDescription}>
                Impression count by event for the current month
              </Text>
              {impressionsData.length > 6 && (
                <Text style={styles.chartNote}>
                  Showing top 6 events • {impressionsData.length} total events
                </Text>
              )}
            </View>
          )}
        </Section>

        {/* 5. Monthly Revenue Section - Enhanced */}
        <Section 
          title="📈 Monthly Revenue Trend" 
          icon="trending-up"
          loading={loadingRevenues}
        >
          {loadingRevenues && monthlyRevenues.length === 0 ? (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingSpinner}>
                <ActivityIndicator size="large" color={chartColors.revenue.primary()} />
              </View>
              <Text style={styles.placeholderText}>Loading revenue data...</Text>
            </View>
          ) : monthlyRevenues.every(item => item.revenue === 0) ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: chartColors.revenue.background }]}>
                <Feather name="trending-up" size={40} color={chartColors.revenue.primary()} />
              </View>
              <Text style={styles.emptyTitle}>No Revenue History</Text>
              <Text style={styles.emptyText}>No revenue generated in the past 12 months</Text>
            </View>
          ) : (
            <View style={styles.enhancedChartContainer}>
              <View style={styles.chartHeaderContainer}>
                <Text style={styles.chartMetricValue}>
                  ${monthlyRevenues.reduce((sum, item) => sum + item.revenue, 0).toFixed(2)}
                </Text>
                <Text style={styles.chartMetricLabel}>Total Revenue (12 Months)</Text>
              </View>
              <View style={styles.chartWrapper}>
                <BarChart
                  data={monthlyRevenueData}
                  width={chartWidth}
                  height={chartHeight}
                  yAxisLabel="$"
                  yAxisSuffix=""
                  chartConfig={createChartConfig(chartColors.revenue)}
                  verticalLabelRotation={30}
                  showValuesOnTopOfBars
                  withInnerLines={false}
                  fromZero
                  style={styles.enhancedChart}
                />
              </View>
              <Text style={styles.chartDescription}>
                Total revenue earned per month over the last 12 months
              </Text>
            </View>
          )}
        </Section>
        
        {/* Total Impressions per Month - Enhanced */}
        <Section title="📊 Total Impressions per Month" icon="activity" loading={loadingMonthlyTrends}>
          {loadingMonthlyTrends && monthlyImpressions.length === 0 ? (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingSpinner}>
                <ActivityIndicator size="large" color={chartColors.impressions.primary()} />
              </View>
              <Text style={styles.placeholderText}>Loading monthly impression data...</Text>
            </View>
          ) : monthlyImpressions.every(item => item.count === 0) ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: chartColors.impressions.background }]}>
                <Feather name="activity" size={40} color={chartColors.impressions.primary()} />
              </View>
              <Text style={styles.emptyTitle}>No Impression History</Text>
              <Text style={styles.emptyText}>No impressions tracked in the past 12 months</Text>
            </View>
          ) : (
            <View style={styles.enhancedChartContainer}>
              <View style={styles.chartHeaderContainer}>
                <Text style={styles.chartMetricValue}>
                  {monthlyImpressions.reduce((sum, item) => sum + item.count, 0).toLocaleString()}
                </Text>
                <Text style={styles.chartMetricLabel}>Total Impressions (12 Months)</Text>
              </View>
              <View style={styles.chartWrapper}>
                <BarChart
                  data={monthlyImpressionsChartData}
                  width={chartWidth}
                  height={chartHeight}
                  yAxisLabel=""
                  yAxisSuffix=" views"
                  chartConfig={createChartConfig(chartColors.impressions)}
                  verticalLabelRotation={30}
                  showValuesOnTopOfBars
                  withInnerLines={false}
                  fromZero
                  style={styles.enhancedChart}
                />
              </View>
              <Text style={styles.chartDescription}>
                Total event impressions over the last 12 months
              </Text>
            </View>
          )}
        </Section>
        
        {/* Impression Cost Section - Enhanced */}
        <Section title="💸 Impression Costs ($0.0075 per impression)" icon="eye" loading={loadingExpenses}>
          {loadingExpenses && monthlyExpenditures.length === 0 ? (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingSpinner}>
                <ActivityIndicator size="large" color={chartColors.costs.primary()} />
              </View>
              <Text style={styles.placeholderText}>Loading cost data...</Text>
            </View>
          ) : monthlyExpenditures.every(item => item.impressionCost === 0) ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: chartColors.costs.background }]}>
                <Feather name="eye" size={40} color={chartColors.costs.primary()} />
              </View>
              <Text style={styles.emptyTitle}>No Impression Costs</Text>
              <Text style={styles.emptyText}>No impression costs incurred</Text>
            </View>
          ) : (
            <View style={styles.enhancedChartContainer}>
              <View style={styles.chartHeaderContainer}>
                <Text style={styles.chartMetricValue}>
                  ${monthlyExpenditures.reduce((sum, item) => sum + item.impressionCost, 0).toFixed(3)}
                </Text>
                <Text style={styles.chartMetricLabel}>Total Impression Costs (12 Months)</Text>
              </View>
              <View style={styles.chartWrapper}>
                <BarChart
                  data={impressionCostData}
                  width={chartWidth}
                  height={chartHeight}
                  yAxisLabel="$"
                  yAxisSuffix=""
                  chartConfig={createChartConfig(chartColors.costs, 3)}
                  verticalLabelRotation={30}
                  showValuesOnTopOfBars
                  withInnerLines={false}
                  fromZero
                  style={styles.enhancedChart}
                />
              </View>
              <Text style={styles.chartDescription}>
                Monthly expenditure on event impressions ($0.0075 per view)
              </Text>
            </View>
          )}
        </Section>
        
        {/* Total Tickets Sold per Month - Enhanced */}
        <Section title="🎟️ Total Tickets Sold per Month" icon="tag" loading={loadingMonthlyTrends}>
          {loadingMonthlyTrends && monthlyTicketSales.length === 0 ? (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingSpinner}>
                <ActivityIndicator size="large" color={chartColors.tickets.primary()} />
              </View>
              <Text style={styles.placeholderText}>Loading monthly ticket sales data...</Text>
            </View>
          ) : monthlyTicketSales.every(item => item.count === 0) ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: chartColors.tickets.background }]}>
                <Feather name="tag" size={40} color={chartColors.tickets.primary()} />
              </View>
              <Text style={styles.emptyTitle}>No Ticket Sales History</Text>
              <Text style={styles.emptyText}>No tickets sold in the past 12 months</Text>
            </View>
          ) : (
            <View style={styles.enhancedChartContainer}>
              <View style={styles.chartHeaderContainer}>
                <Text style={styles.chartMetricValue}>
                  {monthlyTicketSales.reduce((sum, item) => sum + item.count, 0).toLocaleString()}
                </Text>
                <Text style={styles.chartMetricLabel}>Total Tickets Sold (12 Months)</Text>
              </View>
              <View style={styles.chartWrapper}>
                <BarChart
                  data={monthlyTicketSalesChartData}
                  width={chartWidth}
                  height={chartHeight}
                  yAxisLabel=""
                  yAxisSuffix=" tix"
                  chartConfig={createChartConfig(chartColors.tickets)}
                  verticalLabelRotation={30}
                  showValuesOnTopOfBars
                  withInnerLines={false}
                  fromZero
                  style={styles.enhancedChart}
                />
              </View>
              <Text style={styles.chartDescription}>
                Total tickets sold over the last 12 months
              </Text>
            </View>
          )}
        </Section>

        {/* Total Reservations Made per Month - Enhanced */}
        <Section title="📅 Total Reservations Made per Month" icon="bookmark" loading={loadingMonthlyTrends}>
          {(loadingMonthlyTrends && monthlyReservations.length === 0 && !isRefreshing) ? (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingSpinner}>
                <ActivityIndicator size="large" color={chartColors.reservations.primary()} />
              </View>
              <Text style={styles.placeholderText}>Loading monthly reservation data...</Text>
            </View>
          ) : monthlyReservations.every(item => item.count === 0) ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: chartColors.reservations.background }]}>
                <Feather name="bookmark" size={40} color={chartColors.reservations.primary()} />
              </View>
              <Text style={styles.emptyTitle}>No Reservation History</Text>
              <Text style={styles.emptyText}>No reservations made in the past 12 months</Text>
            </View>
          ) : (
            <View style={styles.enhancedChartContainer}>
              <View style={styles.chartHeaderContainer}>
                <Text style={styles.chartMetricValue}>
                  {monthlyReservations.reduce((sum, item) => sum + item.count, 0).toLocaleString()}
                </Text>
                <Text style={styles.chartMetricLabel}>Total Reservations (12 Months)</Text>
              </View>
              <View style={styles.chartWrapper}>
                <BarChart
                  data={monthlyReservationsChartData}
                  width={chartWidth}
                  height={chartHeight}
                  yAxisLabel=""
                  yAxisSuffix=""
                  chartConfig={createChartConfig(chartColors.reservations)}
                  verticalLabelRotation={30}
                  showValuesOnTopOfBars
                  withInnerLines={false}
                  fromZero
                  style={styles.enhancedChart}
                />
              </View>
              <Text style={styles.chartDescription}>
                Total reservations made over the last 12 months
              </Text>
            </View>
          )}
        </Section>
        
        {/* Ticket/Reservation Cost Section - Enhanced */}
        <Section title="💳 Ticket/Reservation Costs ($0.50 per transaction)" icon="dollar-sign" loading={loadingExpenses}>
          {loadingExpenses && monthlyExpenditures.length === 0 ? (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingSpinner}>
                <ActivityIndicator size="large" color={chartColors.ratings.primary()} />
              </View>
              <Text style={styles.placeholderText}>Loading cost data...</Text>
            </View>
          ) : monthlyExpenditures.every(item => item.bookingCost === 0) ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: chartColors.ratings.background }]}>
                <Feather name="dollar-sign" size={40} color={chartColors.ratings.primary()} />
              </View>
              <Text style={styles.emptyTitle}>No Transaction Costs</Text>
              <Text style={styles.emptyText}>No ticket/reservation transaction costs incurred</Text>
            </View>
          ) : (
            <View style={styles.enhancedChartContainer}>
              <View style={styles.chartHeaderContainer}>
                <Text style={styles.chartMetricValue}>
                  ${monthlyExpenditures.reduce((sum, item) => sum + item.bookingCost, 0).toFixed(2)}
                </Text>
                <Text style={styles.chartMetricLabel}>Total Transaction Costs (12 Months)</Text>
              </View>
              <View style={styles.chartWrapper}>
                <BarChart
                  data={bookingCostData}
                  width={chartWidth}
                  height={chartHeight}
                  yAxisLabel="$"
                  yAxisSuffix=""
                  chartConfig={createChartConfig(chartColors.ratings, 2)}
                  verticalLabelRotation={30}
                  showValuesOnTopOfBars
                  withInnerLines={false}
                  fromZero
                  style={styles.enhancedChart}
                />
              </View>
              <Text style={styles.chartDescription}>
                Monthly expenditure on ticket/reservation fees ($0.50 per transaction)
              </Text>
            </View>
          )}
        </Section>
        
        {/* Total Expenditure Section - Enhanced */}
        <Section 
          title="💰 Total Monthly Expenditure" 
          icon="credit-card"
          loading={loadingExpenses}
        >
          {loadingExpenses && monthlyExpenditures.length === 0 ? (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingSpinner}>
                <ActivityIndicator size="large" color={chartColors.combined.primary()} />
              </View>
              <Text style={styles.placeholderText}>Loading expenditure data...</Text>
            </View>
          ) : monthlyExpenditures.every(item => item.totalCost === 0) ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: chartColors.combined.background }]}>
                <Feather name="credit-card" size={40} color={chartColors.combined.primary()} />
              </View>
              <Text style={styles.emptyTitle}>No Expenditure History</Text>
              <Text style={styles.emptyText}>No platform costs incurred</Text>
            </View>
          ) : (
            <View style={styles.enhancedChartContainer}>
              <View style={styles.chartHeaderContainer}>
                <Text style={styles.chartMetricValue}>
                  ${monthlyExpenditures.reduce((sum, item) => sum + item.totalCost, 0).toFixed(2)}
                </Text>
                <Text style={styles.chartMetricLabel}>Total Platform Costs (12 Months)</Text>
              </View>
              <View style={styles.chartWrapper}>
                <BarChart
                  data={totalCostData}
                  width={chartWidth}
                  height={chartHeight}
                  yAxisLabel="$"
                  yAxisSuffix=""
                  chartConfig={createChartConfig(chartColors.combined, 2)}
                  verticalLabelRotation={30}
                  showValuesOnTopOfBars
                  withInnerLines={false}
                  fromZero
                  style={styles.enhancedChart}
                />
              </View>
              <Text style={styles.chartDescription}>
                Combined monthly expenditure on platform (impressions + transactions)
              </Text>
            </View>
          )}
        </Section>
        
        {/* Performance Summary Section - Enhanced */}
        <Section 
          title="📊 Performance Summary" 
          icon="bar-chart-2"
          loading={loadingSummary}
        >
          {loadingSummary && !analyticsSummary ? (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingSpinner}>
                <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
              </View>
              <Text style={styles.placeholderText}>Loading summary data...</Text>
            </View>
          ) : !analyticsSummary ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: '#F0F9FF' }]}>
                <Feather name="bar-chart-2" size={40} color="#0EA5E9" />
              </View>
              <Text style={styles.emptyTitle}>No Summary Available</Text>
              <Text style={styles.emptyText}>Performance data not available</Text>
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
                  { color: analyticsSummary.avgRevenuePerEvent - analyticsSummary.avgCostPerEvent > 0 ? '#047857' : '#DC2626' }
                ]}>
                  ${(analyticsSummary.avgRevenuePerEvent - analyticsSummary.avgCostPerEvent).toFixed(2)}
                </Text>
              </View>
              
              {/* Popular Tags Section */}
              <View style={styles.popularTagsContainer}>
                <Text style={styles.popularTagsTitle}>🏷️ Most Popular Tags</Text>
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
        
        {/* Latest Event Ratings Section - Enhanced */}
        <Section 
          title="⭐ Latest Event Ratings" 
          icon="star"
          loading={loadingRatings}
        >
          {loadingRatings && eventRatings.length === 0 ? (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingSpinner}>
                <ActivityIndicator size="large" color={chartColors.ratings.primary()} />
              </View>
              <Text style={styles.placeholderText}>Loading rating data...</Text>
            </View>
          ) : eventRatings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: chartColors.ratings.background }]}>
                <Feather name="star" size={40} color={chartColors.ratings.primary()} />
              </View>
              <Text style={styles.emptyTitle}>No Event Ratings</Text>
              <Text style={styles.emptyText}>No ratings available for recent events</Text>
            </View>
          ) : (
            <View style={styles.enhancedChartContainer}>
              <View style={styles.chartHeaderContainer}>
                <Text style={styles.chartMetricValue}>
                  {(eventRatings.reduce((sum, event) => sum + event.averageRating, 0) / eventRatings.length).toFixed(1)}★
                </Text>
                <Text style={styles.chartMetricLabel}>Average Rating Across Events</Text>
              </View>
              <RatingsBarChart
                data={eventRatingData}
                width={chartWidth}
                height={chartHeight}
              />
              <Text style={styles.chartDescription}>
                Average ratings for your {Math.min(eventRatings.length, 6)} most recent events
              </Text>
              {eventRatings.length > 6 && (
                <Text style={styles.chartNote}>
                  Showing 6 most recent events • {eventRatings.length} total events with ratings
                </Text>
              )}
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  backButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingBottom: 50,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  errorText: {
    flex: 1,
    marginLeft: 14,
    color: '#B91C1C',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#F1F5F9',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.3,
  },
  sectionContent: {},
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  loadingSpinner: {
    padding: 20,
    borderRadius: 50,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  placeholderText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  emptyDetailsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptySubText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
  bulletPointContainer: {
    alignItems: 'flex-start',
  },
  bulletPoint: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 24,
    paddingLeft: 4,
  },
  enhancedChartContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  chartHeaderContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
  },
  chartMetricValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 4,
    letterSpacing: -1,
  },
  chartMetricLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartWrapper: {
    borderRadius: 20,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  enhancedChart: {
    borderRadius: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  chartGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 1,
  },
  chartDescription: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 20,
    fontWeight: '600',
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  chartNote: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  ratingChartContainer: {
    position: 'relative',
  },
  summaryContainer: {
    paddingVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginHorizontal: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  popularTagsContainer: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 2,
    borderTopColor: '#F1F5F9',
  },
  popularTagsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    margin: 8,
    borderWidth: 2,
    borderColor: '#C7D2FE',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tagText: {
    fontSize: 15,
    color: '#4338CA',
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  tagCount: {
    fontSize: 12,
    fontWeight: '900',
    color: '#4338CA',
    backgroundColor: '#C7D2FE',
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    lineHeight: 28,
    marginLeft: 12,
  },
  noTagsText: {
    fontSize: 15,
    color: '#94A3B8',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 24,
    fontWeight: '500',
  },
  ratingLegendContainer: {
    marginTop: 24,
    padding: 20,
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FEF3C7',
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
    marginRight: 12,
  },
  ratingLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FEF3C7',
  },
  ratingLegendName: {
    flex: 1,
    fontSize: 15,
    color: '#92400E',
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  ratingLegendRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingLegendValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#D97706',
    marginRight: 8,
  },
  ratingLegendCount: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
  summaryProfitContainer: {
    backgroundColor: '#ECFDF5',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginTop: 20,
    borderWidth: 2,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryProfitLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#065F46',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryProfitValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#047857',
    letterSpacing: -1,
  },
  noDataText: {
    fontSize: 15,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
});
  
export default OverallAnalyticsScreen; 