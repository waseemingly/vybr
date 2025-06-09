import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Dimensions,
  ActivityIndicator, RefreshControl, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect, RouteProp, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import ImageSwiper from "../../components/ImageSwiper";
import { APP_CONSTANTS } from "../../config/constants";

// --- Navigation and Param Types ---
// Corrected: Assuming OrganizerPostsScreen might be part of a stack that could receive params
// The key for this screen itself in the stack navigator param list.
// Let's assume the tab navigator is 'OrganizerTabs' and this screen is 'Posts' within it.
// If navigating *to* this screen with params, it'd be on the parent navigator containing OrganizerTabs.
// For now, let's assume OrganizerStackParamList includes OrganizerPosts directly for simplicity if params are needed.
type OrganizerStackParamList = {
  OrganizerTabs: { screen?: 'Posts' | 'Create' | 'OrganizerProfile', params?: any }; // Adjusted for clarity
  EditEvent: { eventId: string };
  EventDetail: { eventId: string };
  Create: undefined;
  OrganizerPosts: { openPostId?: string; initialScreenTab?: 'allMyEvents' | 'upcoming' }; // Key for this screen itself
};
type OrganizerPostsScreenRouteProp = RouteProp<OrganizerStackParamList, 'OrganizerPosts'>;


type NavigationProp = NativeStackNavigationProp<OrganizerStackParamList>;

// --- Interfaces ---
interface SupabaseEventFromDB { // More specific name for data from DB
  id: string;
  organizer_id: string; // Keep this if needed elsewhere, though not directly in MappedPost
  title: string;
  event_datetime: string;
  location_text: string | null;
  poster_urls: string[];
  booking_type: 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null;
  // Add other fields actually fetched
  event_type?: string | null; // Make optional if not always present
}

interface MappedPost { // Equivalent to MappedEvent in EventsScreen
  id: string;
  title: string;
  images: string[];
  date: string;
  time: string;
  venue: string;
  booking_type: 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null;
  event_datetime_iso: string;
  status: "Upcoming" | "Completed" | "Ongoing"; // Added status based on usage
}

// --- Constants ---
const DEFAULT_POST_IMAGE = "https://via.placeholder.com/800x450/D1D5DB/1F2937?text=No+Image";
const POSTS_PER_PAGE = 10;
const CARDS_PER_ROW_WEB = 4;
const CARD_MARGIN_WEB = 16;

// --- Helper Functions ---
const formatDateTime = (isoString: string | null): { date: string; time: string } => {
  if (!isoString) return { date: "N/A", time: "N/A" };
  try {
    const d = new Date(isoString);
    const datePart = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' });
    const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
    return { date: datePart, time: timePart };
  } catch (e) { return { date: "Invalid Date", time: "" }; }
};

const getEventStatus = (isoString: string | null): "Upcoming" | "Completed" | "Ongoing" => {
    if (!isoString) return "Upcoming";
    try { return new Date(isoString) > new Date() ? "Upcoming" : "Completed"; }
    catch (e) { return "Upcoming"; }
};


const OrganizerPostsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<OrganizerPostsScreenRouteProp>();
  const { session, loading: authLoading } = useAuth();

  // Tab-specific data states
  const [allMyEventsTabSource, setAllMyEventsTabSource] = useState<MappedPost[]>([]);
  const [upcomingEventsTabSource, setUpcomingEventsTabSource] = useState<MappedPost[]>([]);

  // Pagination states for "All My Events" tab
  const [currentPageAllMyEvents, setCurrentPageAllMyEvents] = useState(1);
  const [loadedAllMyEvents, setLoadedAllMyEvents] = useState<MappedPost[]>([]);
  const [allMyEventsLoaded, setAllMyEventsLoaded] = useState(false);
  const [isFetchingMoreAllMyEvents, setIsFetchingMoreAllMyEvents] = useState(false);

  // Pagination states for "Upcoming" tab
  const [currentPageUpcoming, setCurrentPageUpcoming] = useState(1);
  const [loadedUpcomingEvents, setLoadedUpcomingEvents] = useState<MappedPost[]>([]);
  const [allUpcomingEventsLoaded, setAllUpcomingEventsLoaded] = useState(false);
  const [isFetchingMoreUpcoming, setIsFetchingMoreUpcoming] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTabIndex, setActiveTabIndex] = useState(0); // 0 for 'All My Events', 1 for 'Upcoming'

  const [selectedPost, setSelectedPost] = useState<MappedPost | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchOrganizerPosts = useCallback(async (page: number, tabIndex: number) => {
    if (!session?.user?.id) {
      setError("Login required.");
      setIsLoading(false);
      setRefreshing(false);
      return { data: [], error: new Error("Login required"), isLastPage: true };
    }
    if (!refreshing && page === 1) setIsLoading(true);
    setError(null);

    const itemsPerPage = POSTS_PER_PAGE;
    const rangeFrom = (page - 1) * itemsPerPage;
    const rangeTo = page * itemsPerPage - 1;

    try {
      let query = supabase
        .from("events")
        .select("id, title, event_datetime, location_text, poster_urls, booking_type") // Removed confirmed_bookings_count
        .eq("organizer_id", session.user.id);

      const now = new Date().toISOString();
      if (tabIndex === 1) { // "Upcoming" tab
        query = query.gt('event_datetime', now);
      }
      query = query.order("event_datetime", { ascending: tabIndex === 1 });
      query = query.range(rangeFrom, rangeTo);

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const isLastPage = !data || data.length < itemsPerPage;
      return { data: data as SupabaseEventFromDB[] || [], error: null, isLastPage }; // Cast data

    } catch (err: any) {
      console.error("Fetch Organizer Posts Err:", err);
      setError(`Failed to fetch posts: ${err.message}`);
      return { data: [], error: err, isLastPage: true };
    }
  }, [session, refreshing]);

  const loadPostsForTab = useCallback(async (tabIndex: number, forRefresh = false) => {
    const isAllMyEventsTab = tabIndex === 0;
    const currentPage = isAllMyEventsTab ? currentPageAllMyEvents : currentPageUpcoming;
    const pageToFetch = forRefresh ? 1 : currentPage;

    if (isAllMyEventsTab) { if(!forRefresh) setIsFetchingMoreAllMyEvents(true); } 
    else { if(!forRefresh) setIsFetchingMoreUpcoming(true); }
    
    if (forRefresh || pageToFetch === 1) {
        if (isAllMyEventsTab) { setLoadedAllMyEvents([]); setCurrentPageAllMyEvents(1); setAllMyEventsLoaded(false); }
        else { setLoadedUpcomingEvents([]); setCurrentPageUpcoming(1); setAllUpcomingEventsLoaded(false); }
    }

    const { data: newPostsData, error: fetchError, isLastPage } = await fetchOrganizerPosts(pageToFetch, tabIndex);

    if (fetchError) {
        if (isAllMyEventsTab) setIsFetchingMoreAllMyEvents(false); else setIsFetchingMoreUpcoming(false);
        if (forRefresh) setRefreshing(false);
        setIsLoading(false);
        return;
    }
    
    // Corrected type for post in map
    const mappedNewPosts: MappedPost[] = newPostsData.map((post: SupabaseEventFromDB): MappedPost => {
        const { date, time } = formatDateTime(post.event_datetime);
        return {
          id: post.id,
          title: post.title,
          images: post.poster_urls?.length > 0 ? post.poster_urls : [DEFAULT_POST_IMAGE],
          date: date,
          time: time,
          venue: post.location_text ?? "N/A",
          booking_type: post.booking_type,
          event_datetime_iso: post.event_datetime,
          status: getEventStatus(post.event_datetime), // Add status
        };
    });

    if (isAllMyEventsTab) {
        setLoadedAllMyEvents(prev => forRefresh ? mappedNewPosts : [...prev, ...mappedNewPosts]);
        if (pageToFetch > 1) setCurrentPageAllMyEvents(pageToFetch);
        if (isLastPage) setAllMyEventsLoaded(true);
        setIsFetchingMoreAllMyEvents(false);
    } else {
        setLoadedUpcomingEvents(prev => forRefresh ? mappedNewPosts : [...prev, ...mappedNewPosts]);
        if (pageToFetch > 1) setCurrentPageUpcoming(pageToFetch);
        if (isLastPage) setAllUpcomingEventsLoaded(true);
        setIsFetchingMoreUpcoming(false);
    }
    if (forRefresh) setRefreshing(false);
    setIsLoading(false);

  }, [fetchOrganizerPosts, currentPageAllMyEvents, currentPageUpcoming ]); // Removed setIsLoading from deps

  useEffect(() => {
    if (session?.user?.id) {
        setIsLoading(true);
        loadPostsForTab(activeTabIndex, true);
    } else {
        setError("Please log in.");
        setLoadedAllMyEvents([]);
        setLoadedUpcomingEvents([]);
        setIsLoading(false);
    }
  }, [activeTabIndex, session?.user?.id, loadPostsForTab]); 

  useFocusEffect(useCallback(() => {
    const { openPostId, initialScreenTab } = route.params || {};
    let tabToLoad = activeTabIndex;
    let needsTabChange = false;

    if (initialScreenTab === 'upcoming' && activeTabIndex !== 1) {
        tabToLoad = 1;
        needsTabChange = true;
    } else if (initialScreenTab === 'allMyEvents' && activeTabIndex !== 0) {
        tabToLoad = 0;
        needsTabChange = true;
    }

    if (needsTabChange) {
        setActiveTabIndex(tabToLoad); // This will trigger the useEffect above to load data
    } else {
        // If no tab change, or already on the correct tab, refresh its data
        setIsLoading(true); // Show loading for focus refresh
        loadPostsForTab(tabToLoad, true);
    }
  }, [route.params, activeTabIndex, loadPostsForTab]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // No need to reset currentPage here, loadPostsForTab with forRefresh=true handles it.
    loadPostsForTab(activeTabIndex, true);
  }, [activeTabIndex, loadPostsForTab]);

  useEffect(() => {
    const getAndLogToken = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            console.log('Organizer Bearer Token:', session.access_token);
        } else {
            console.log('Could not find bearer token. The session object was:', JSON.stringify(session, null, 2));
        }
    };

    getAndLogToken();
  }, []);

  const handleLoadMoreAllMyEvents = () => {
    if (!isFetchingMoreAllMyEvents && !allMyEventsLoaded) {
      const nextPage = currentPageAllMyEvents + 1;
      setCurrentPageAllMyEvents(nextPage);
      loadPostsForTab(0, false); 
    }
  };

  const handleLoadMoreUpcoming = () => {
    if (!isFetchingMoreUpcoming && !allUpcomingEventsLoaded) {
       const nextPage = currentPageUpcoming + 1;
       setCurrentPageUpcoming(nextPage);
       loadPostsForTab(1, false);
    }
  };

  const handlePostPress = (post: MappedPost) => { 
    navigation.navigate("EventDetail", { eventId: post.id }); 
  };

  const renderListFooter = (isFetchingMore: boolean, allLoaded: boolean, itemsExist: boolean) => {
    if (isFetchingMore) {
      return <View style={styles.listFooterContainer}><ActivityIndicator style={{ marginVertical: 20 }} size="small" color={APP_CONSTANTS.COLORS.PRIMARY} /></View>;
    }
    return null;
  };

  const renderEmptyList = () => {
    if (isLoading && !refreshing) return null; 
    return (
      <View style={styles.centeredContainerEmptyList}>
        <Feather name="archive" size={40} color="#9CA3AF" />
        <Text style={styles.emptyText}>No Posts Found</Text>
        <Text style={styles.emptySubText}>Looks like you haven't created any posts yet, or there are no posts matching the current filter.</Text>
        <TouchableOpacity style={styles.createButtonLarge} onPress={() => navigation.navigate("Create")}>
            <Feather name="plus" size={18} color="#FFF" />
            <Text style={styles.createButtonLargeText}>Create New Post</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderPostItem = ({ item }: { item: MappedPost }) => {
    const cardWidth = Platform.OS === 'web'
        ? (Dimensions.get('window').width - styles.postsList.paddingHorizontal! * 2 - CARD_MARGIN_WEB * (CARDS_PER_ROW_WEB -1) ) / CARDS_PER_ROW_WEB
        : Dimensions.get('window').width - styles.postsList.paddingHorizontal! * 2;
    const imageDimension = cardWidth;

    return (
      <TouchableOpacity 
        style={[styles.postCard, Platform.OS === 'web' && styles.postCardWeb, Platform.OS === 'web' ? {width: cardWidth} : {}]} 
        onPress={() => handlePostPress(item)}>
        <ImageSwiper
          images={item.images}
          defaultImage={DEFAULT_POST_IMAGE}
          containerStyle={[styles.postImageContainer, {width: imageDimension, height: imageDimension}]}
          imageStyle={[styles.postImageStyle, {width: imageDimension, height: imageDimension}]}
          height={imageDimension}
        />
        <View style={styles.cardContent}>
          <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.eventInfoRow}><Feather name="calendar" size={14} color="#6B7280" /><Text style={styles.eventInfoText}>{item.date} • {item.time}</Text></View>
          {item.venue !== "N/A" && <View style={styles.eventInfoRow}><Feather name="map-pin" size={14} color="#6B7280" /><Text style={styles.eventInfoText} numberOfLines={1}>{item.venue}</Text></View>}
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.actionButton} onPress={(e) => { e.stopPropagation(); navigation.navigate("EditEvent", { eventId: item.id }); }}>
                <Feather name="edit-2" size={14} color={APP_CONSTANTS.COLORS.PRIMARY} />
                <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>
            {/* Add other actions like "View Analytics" or "View Bookings" */}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCustomTabBar = () => {
    return (
      <View style={styles.tabBarContainer}>
        <TouchableOpacity
          style={[styles.tabItem, activeTabIndex === 0 && styles.activeTabItem]}
          onPress={() => setActiveTabIndex(0)}
        >
          <Text style={[styles.tabText, activeTabIndex === 0 && styles.activeTabText]}>All My Events</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTabIndex === 1 && styles.activeTabItem]}
          onPress={() => setActiveTabIndex(1)}
        >
          <Text style={[styles.tabText, activeTabIndex === 1 && styles.activeTabText]}>Upcoming</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMainContent = () => {
    const isInitialTabLoading = isLoading && (activeTabIndex === 0 ? loadedAllMyEvents.length === 0 : loadedUpcomingEvents.length === 0) && !error && !refreshing;
    if (isInitialTabLoading) {
      return <View style={styles.centeredContainer}><ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} /></View>;
    }
    if (error && !isLoading && !refreshing) { // Show error only if not loading/refreshing
      return (
        <View style={styles.centeredContainer}>
          <Feather name="alert-triangle" size={40} color="#F87171" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => loadPostsForTab(activeTabIndex, true)} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const currentData = activeTabIndex === 0 ? loadedAllMyEvents : loadedUpcomingEvents;
    const handleLoadMore = activeTabIndex === 0 ? handleLoadMoreAllMyEvents : handleLoadMoreUpcoming;
    const isFetchingMore = activeTabIndex === 0 ? isFetchingMoreAllMyEvents : isFetchingMoreUpcoming;
    const allLoaded = activeTabIndex === 0 ? allMyEventsLoaded : allUpcomingEventsLoaded;

    return (
      <View style={{ flex: 1 }}>
        {renderCustomTabBar()}
        <FlatList
          data={currentData}
          keyExtractor={(item) => `post-${item.id}`}
          renderItem={renderPostItem}
          contentContainerStyle={styles.postsList}
          style={styles.flatListContainerOnly}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() => renderListFooter(isFetchingMore, allLoaded, currentData.length > 0)}
          ListEmptyComponent={renderEmptyList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[APP_CONSTANTS.COLORS.PRIMARY]} />}
        />
      </View>
    );
  };
  
  if (authLoading && !session) {
    return <SafeAreaView edges={["top"]} style={styles.centeredContainer}><ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} /></SafeAreaView>;
  }
  if (!session && !authLoading) {
    return (
      <SafeAreaView edges={["top"]} style={styles.centeredContainer}>
        <Feather name="lock" size={40} color="#F87171" />
        <Text style={styles.errorText}>Not Logged In</Text>
        <Text style={styles.errorSubText}>Log in as an organizer to manage your posts.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <View style={styles.rootContainer}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.titleContainer}>
              <Feather name="layout" size={22} color={APP_CONSTANTS.COLORS.PRIMARY_LIGHT || "#60A5FA"} style={styles.headerIcon} />
              <Text style={styles.title}>Your Posts</Text>
            </View>
            <TouchableOpacity style={styles.createButton} onPress={() => navigation.navigate("Create")}>
              <Feather name="plus" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
              <Text style={styles.createButtonText}>New Post</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{flex: 1}}>
            {renderMainContent()}
        </View>
      </View>
      {/* PostDetailModal will be added here */}
    </SafeAreaView>
  );
};

// Styles (Adapted from EventsScreen, with OrganizerPostsScreen specific adjustments)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND || "#f8fafc" },
  rootContainer: { flex: 1 },
  centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND || '#f8fafc' },
  centeredContainerEmptyList: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 40, marginTop: Dimensions.get('window').height * 0.05 },
  errorText: { fontSize: 16, fontWeight: '600', color: APP_CONSTANTS.COLORS.ERROR ||'#DC2626', marginTop: 10, textAlign: 'center' },
  errorSubText: { fontSize: 14, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY ||'#4B5563', marginTop: 5, textAlign: 'center', marginBottom: 15 },
  retryButton: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginTop: 15 },
  retryButtonText: { color: '#FFF', fontWeight: '600' },
  emptyText: { fontSize: 18, fontWeight: '600', color: APP_CONSTANTS.COLORS.TEXT_PRIMARY ||'#4B5563', marginTop: 10 },
  emptySubText: { fontSize: 14, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY ||'#6B7280', marginTop: 5, textAlign: 'center', marginBottom: 20, paddingHorizontal: 20 },
  createButtonLarge: { flexDirection: 'row', alignItems: 'center', backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  createButtonLargeText: { color: '#FFF', fontWeight: '600', marginLeft: 8, fontSize: 16 },
  header: { paddingTop: 16, paddingBottom: 12, paddingHorizontal: 0, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: APP_CONSTANTS.COLORS.BORDER_LIGHT ||'#E5E7EB' },
  headerTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: Platform.OS === 'ios' ? 8 : 8 },
  titleContainer: { flexDirection: "row", alignItems: "center" },
  headerIcon: { marginRight: 8 },
  title: { fontSize: 22, fontWeight: "bold", color: APP_CONSTANTS.COLORS.PRIMARY },
  createButton: { flexDirection: "row", alignItems: "center", backgroundColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT || "rgba(59, 130, 246, 0.1)", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 },
  createButtonText: { color: APP_CONSTANTS.COLORS.PRIMARY, fontSize: 14, fontWeight: "500", marginLeft: 4 },
  tabBarContainer: { flexDirection: 'row', height: 50, borderBottomWidth: 1, borderBottomColor: APP_CONSTANTS.COLORS.BORDER_LIGHT ||'#E5E7EB', backgroundColor: 'white' },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 2 },
  activeTabItem: { borderBottomWidth: 3, borderBottomColor: APP_CONSTANTS.COLORS.PRIMARY },
  tabText: { fontSize: 14, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, fontWeight: '600' },
  activeTabText: { color: APP_CONSTANTS.COLORS.PRIMARY },
  flatListContainerOnly: { flex: 1 },
  postsList: {
    paddingHorizontal: Platform.OS === 'web' ? 0 : 16, // Web horizontal padding handled by card margin
    paddingTop: 16,
    paddingBottom: 80,
    flexGrow: 1,
    ...(Platform.OS === 'web' ? {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
    } : {})
  },
  postCard: {
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
  postCardWeb: {
    marginHorizontal: CARD_MARGIN_WEB / 2, // For spacing between cards in a row
    marginBottom: CARD_MARGIN_WEB, // For spacing between rows
  },
  postImageContainer: {
    width: "100%",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: APP_CONSTANTS.COLORS.BORDER_LIGHT ||'#F3F4F6',
    overflow: 'hidden',
  },
  postImageStyle: {
    backgroundColor: APP_CONSTANTS.COLORS.BORDER_LIGHT ||'#F3F4F6',
  },
  cardContent: { padding: 16 },
  postTitle: { fontSize: 18, fontWeight: "700", color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, marginBottom: 8 },
  eventInfoRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  eventInfoText: { fontSize: 14, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, marginLeft: 8, flexShrink: 1 },
  cardActions: { flexDirection: "row", justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: APP_CONSTANTS.COLORS.BORDER_LIGHT ||'#F3F4F6', paddingTop: 12, marginTop: 12 },
  actionButton: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingHorizontal: 8, marginLeft:12 },
  actionButtonText: { color: APP_CONSTANTS.COLORS.PRIMARY, fontWeight: "500", fontSize: 14, marginLeft: 6 },
  listFooterContainer: { width: '100%', justifyContent: 'center', alignItems: 'center', paddingVertical: 20 },
});

export default OrganizerPostsScreen;