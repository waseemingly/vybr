import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ScrollView, Modal,
  Dimensions, ActivityIndicator, RefreshControl, Alert, GestureResponderEvent,
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../lib/supabase"; // Adjust path, remove EventBooking if unused
import { useAuth } from "../hooks/useAuth"; // Adjust path
import { APP_CONSTANTS } from "@/config/constants";
import type { RootStackParamList, MainStackParamList } from '@/navigation/AppNavigator';
import ImageSwiper from '@/components/ImageSwiper'; // <-- Import the new component

// Define navigation prop using imported types
type NavigationProp = NativeStackNavigationProp<RootStackParamList & MainStackParamList>;

// Export interfaces for reuse
export interface SupabasePublicEvent {
  id: string; title: string; description: string | null; event_datetime: string;
  location_text: string | null; poster_urls: string[]; tags_genres: string[]; tags_artists: string[]; tags_songs: string[];
  organizer_id: string; // We only get the ID initially
  event_type: string | null;
  booking_type: 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null;
  ticket_price: number | null; pass_fee_to_user: boolean | null;
  max_tickets: number | null; max_reservations: number | null;
}

export interface OrganizerInfo {
    userId: string;
    name: string;
    image: string | null;
}

export interface MappedEvent {
  id: string; title: string; images: string[]; date: string; time: string;
  venue: string; genres: string[]; artists: string[]; songs: string[];
  description: string;
  booking_type: 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null;
  ticket_price: number | null;
  pass_fee_to_user: boolean;
  max_tickets: number | null; max_reservations: number | null;
  organizer: OrganizerInfo; // Use the separate interface
  isViewable: boolean;
}

// --- Constants and Helpers ---
const DEFAULT_EVENT_IMAGE = "https://via.placeholder.com/800x450/D1D5DB/1F2937?text=No+Image";
const DEFAULT_ORGANIZER_LOGO = APP_CONSTANTS.DEFAULT_ORGANIZER_LOGO || "https://via.placeholder.com/150/BFDBFE/1E40AF?text=Logo";
const DEFAULT_ORGANIZER_NAME = "Event Organizer";
const TRANSACTION_FEE = 0.50;

const formatEventDateTime = (isoString: string | null): { date: string; time: string } => {
  if (!isoString) return { date: "N/A", time: "N/A" };
  try {
    const d = new Date(isoString);
    const datePart = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' });
    const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
    return { date: datePart, time: timePart };
  } catch (e) { return { date: "Invalid Date", time: "" }; }
};

const calculateFinalPricePerItem = (basePrice: number | null, passFee: boolean): number => {
    if (basePrice === null || basePrice < 0) return 0;
    if (basePrice === 0) return 0;
    return passFee ? basePrice + TRANSACTION_FEE : basePrice;
};

const formatDisplayPricePerItem = (basePrice: number | null, passFee: boolean): string => {
    if (basePrice === null || basePrice < 0) return "N/A";
    if (basePrice === 0) return "Free";
    const finalPrice = calculateFinalPricePerItem(basePrice, passFee);
    return `$${finalPrice.toFixed(2)} each`;
};

const formatDisplayTotalPrice = (basePrice: number | null, passFee: boolean, quantity: number): string => {
     if (basePrice === null || basePrice < 0) return "N/A";
     if (basePrice === 0) return "$0.00";
     const finalPricePerItem = calculateFinalPricePerItem(basePrice, passFee);
     return `$${(finalPricePerItem * quantity).toFixed(2)}`;
};

// --- Event Detail Modal Component ---
interface EventDetailModalProps {
    event: MappedEvent | null;
    visible: boolean;
    onClose: () => void;
    navigation: NavigationProp;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, visible, onClose, navigation }) => {
    const [quantity, setQuantity] = useState(1);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => { if (visible) { setQuantity(1); setCurrentImageIndex(0); } }, [visible]);

    if (!event) return null;

    const { width } = Dimensions.get('window');
    const imageContainerWidth = width;
    const images = event.images?.length > 0 ? event.images : [DEFAULT_EVENT_IMAGE];

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

    const incrementQuantity = () => setQuantity(q => q + 1);
    const decrementQuantity = () => setQuantity(q => Math.max(1, q - 1));

    // --- Navigate to Organizer Profile ---
    const handleOrganizerPress = () => {
        if (event?.organizer?.userId) {
            navigation.push('ViewOrganizerProfileScreen', { organizerUserId: event.organizer.userId });
            onClose(); // Close the modal after navigating
        }
    };
    // ----------------------------------

    // --- Booking Logic (Check type before navigating) ---
     let canBookOrReserve = false;
     if (event.booking_type === 'TICKETED' || event.booking_type === 'RESERVATION') {
         canBookOrReserve = event.ticket_price !== null; // Allow booking if ticketed/reservation unless price is null (unavailable)
     }
     const basePrice = event.ticket_price;
     const pricePerItemDisplay = event.booking_type === 'TICKETED'
                                ? formatDisplayPricePerItem(basePrice, event.pass_fee_to_user)
                                : "Free";
     const totalPriceDisplay = event.booking_type === 'TICKETED'
                               ? formatDisplayTotalPrice(basePrice, event.pass_fee_to_user, quantity)
                               : "$0.00";

     let buttonText = "View Details";
     let buttonIcon: React.ComponentProps<typeof Feather>['name'] = "info";
     if (event.booking_type === 'TICKETED') {
         buttonIcon = "tag";
         if (basePrice === 0) buttonText = quantity > 1 ? `Get ${quantity} Tickets` : "Get Ticket";
         else if (basePrice && basePrice > 0) buttonText = `Get ${quantity} Ticket${quantity > 1 ? 's' : ''} (${totalPriceDisplay})`;
         else { buttonText = "Tickets Unavailable"; canBookOrReserve = false; }
     } else if (event.booking_type === 'RESERVATION') {
         buttonText = `Reserve Spot${quantity > 1 ? 's' : ''} for ${quantity}`;
         buttonIcon = "bookmark";
     }
    // --- End Booking Logic ---

    const handleProceedToConfirmation = () => {
        // Ensure event exists and booking type is valid for confirmation screen
        if (!event || (event.booking_type !== 'TICKETED' && event.booking_type !== 'RESERVATION')) {
             console.warn("[EventDetailModal] Cannot proceed: Invalid booking type", event?.booking_type);
             return;
        }

        let rawPricePerItemValue: number | null = null;
        let rawTotalPriceValue: number | null = null;
        let rawFeePaidValue: number | null = null;
        if (event.booking_type === 'TICKETED' && event.ticket_price !== null && event.ticket_price >= 0) {
            rawPricePerItemValue = event.ticket_price;
            const finalPricePerItem = calculateFinalPricePerItem(event.ticket_price, event.pass_fee_to_user);
            rawTotalPriceValue = finalPricePerItem * quantity;
            rawFeePaidValue = event.pass_fee_to_user ? (TRANSACTION_FEE * quantity) : 0;
        }

        navigation.navigate('BookingConfirmation', {
            eventId: event.id, eventTitle: event.title, quantity: quantity,
            pricePerItemDisplay: pricePerItemDisplay, totalPriceDisplay: totalPriceDisplay,
            bookingType: event.booking_type, // Pass validated type
            rawPricePerItem: rawPricePerItemValue, rawTotalPrice: rawTotalPriceValue,
            rawFeePaid: rawFeePaidValue, maxTickets: event.max_tickets,
            maxReservations: event.max_reservations,
        });
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}><Feather name="x" size={24} color="#6B7280" /></TouchableOpacity>
              <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.imageSwiperContainer}>
                       <ScrollView
                           ref={scrollViewRef}
                           horizontal
                           pagingEnabled
                           showsHorizontalScrollIndicator={false}
                           onMomentumScrollEnd={(e) => onScroll(e.nativeEvent)}
                           scrollEventThrottle={16}
                           style={{ width: imageContainerWidth, height: styles.modalImage.height }}
                       >
                           {images.map((uri, index) => (
                               <Image
                                   key={index}
                                   source={{ uri: uri }}
                                   style={[styles.modalImage, { width: imageContainerWidth }]}
                                   resizeMode="cover"
                               />
                           ))}
                       </ScrollView>
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
                   </View>
                  <View style={styles.modalBody}>
                      <Text style={styles.modalTitle}>{event.title}</Text>
                      {/* Organizer Row - Made Pressable */}
                       <TouchableOpacity style={styles.organizerRow} onPress={handleOrganizerPress} activeOpacity={0.7} disabled={!event.organizer?.userId}>
                           <View style={styles.organizerInfo}>
                               {/* Use organizer data from MappedEvent */}
                               <Image source={{ uri: event.organizer.image ?? DEFAULT_ORGANIZER_LOGO }} style={styles.organizerImage} />
                               <View>
                                   <Text style={styles.organizerName}>{event.organizer.name}</Text>
                                   <Text style={styles.organizerLabel}>Organizer</Text>
                               </View>
                           </View>
                           <Feather name="chevron-right" size={20} color={APP_CONSTANTS.COLORS.DISABLED} />
                       </TouchableOpacity>
                      {/* Tags Display */}
                      <View style={styles.tagsScrollContainer}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsContainerModal}>{ [...event.genres, ...event.artists, ...event.songs].filter(t => t).map((tag, i) => (<View key={`${tag}-${i}`} style={styles.tagBadgeModal}><Text style={styles.tagTextModal}>{tag}</Text></View>)) }{ [...event.genres, ...event.artists, ...event.songs].filter(t => t).length === 0 && (<Text style={styles.noTagsText}>No tags provided</Text>) }</ScrollView></View>
                      {/* Event Info */}
                      <View style={styles.eventInfoRow}><Feather name="calendar" size={16} color="#6B7280" /><Text style={styles.eventInfoText}>{event.date}</Text></View>
                      <View style={styles.eventInfoRow}><Feather name="clock" size={16} color="#6B7280" /><Text style={styles.eventInfoText}>{event.time}</Text></View>
                      <View style={styles.eventInfoRow}><Feather name="map-pin" size={16} color="#6B7280" /><Text style={styles.eventInfoText}>{event.venue}</Text></View>
                      <View style={styles.divider} />
                      <Text style={styles.sectionTitle}>About</Text>
                      <Text style={styles.descriptionText}>{event.description}</Text>
                      {/* Quantity Selector */}
                      {canBookOrReserve && (
                          <>
                            <View style={styles.divider} />
                            <Text style={styles.sectionTitle}>{event.booking_type === 'TICKETED' ? 'Tickets' : 'Reservations'}</Text>
                            <View style={styles.quantitySelector}>
                                <Text style={styles.quantityLabel}>{`Quantity (${pricePerItemDisplay}):`}</Text>
                                <View style={styles.quantityControls}>
                                    <TouchableOpacity onPress={decrementQuantity} style={styles.quantityButton} disabled={quantity <= 1}><Feather name="minus" size={20} color={quantity <= 1 ? "#9CA3AF" : "#3B82F6"} /></TouchableOpacity>
                                    <Text style={styles.quantityValue}>{quantity}</Text>
                                    <TouchableOpacity onPress={incrementQuantity} style={styles.quantityButton}><Feather name="plus" size={20} color={"#3B82F6"} /></TouchableOpacity>
                                </View>
                            </View>
                          </>
                      )}
                      {/* Proceed Button */}
                      {canBookOrReserve && (
                          <TouchableOpacity style={styles.bookNowButton} onPress={handleProceedToConfirmation} >
                              <Feather name={buttonIcon} size={18} color="#fff" />
                              <Text style={styles.bookNowButtonText}>{buttonText}</Text>
                          </TouchableOpacity>
                      )}
                      {!canBookOrReserve && event.booking_type === 'INFO_ONLY' && (
                          <View style={styles.infoOnlyBadge}><Feather name="info" size={16} color="#6B7280" /><Text style={styles.infoOnlyText}>Info only. No booking required.</Text></View>
                      )}
                  </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
    );
};
// --- End Event Detail Modal ---

// --- Event Card Component ---
interface EventCardProps { event: MappedEvent; onPress: () => void; isViewable: boolean; }
export const EventCard: React.FC<EventCardProps> = React.memo(({ event, onPress, isViewable }) => {
    const navigation = useNavigation<NavigationProp>();
    // --- Booking Logic (Check type before navigating) ---
     let canBook = false;
     if (event.booking_type === 'TICKETED' || event.booking_type === 'RESERVATION') {
         canBook = event.ticket_price !== null; // Allow booking if ticketed/reservation unless price is null
     }
     const basePrice = event.ticket_price;
     const priceText = event.booking_type === 'TICKETED'
                      ? formatDisplayPricePerItem(basePrice, event.pass_fee_to_user)
                      : event.booking_type === 'RESERVATION' ? "Reservation" : "Info Only";
     let buttonText = "View";
     let buttonIcon: React.ComponentProps<typeof Feather>['name'] = "info";
     if (event.booking_type === 'TICKETED') { buttonText = "Get Tickets"; buttonIcon = "tag"; }
     else if (event.booking_type === 'RESERVATION') { buttonText = "Reserve"; buttonIcon = "bookmark"; }
    // --- End Booking Logic ---

    const handleBookPressOnCard = (e: GestureResponderEvent) => {
        e.stopPropagation();
        if (event && (event.booking_type === 'TICKETED' || event.booking_type === 'RESERVATION')) {
             const pricePerItemDisplayCard = event.booking_type === 'TICKETED' ? formatDisplayPricePerItem(basePrice, event.pass_fee_to_user) : "Free";
             const totalPriceDisplayCard = event.booking_type === 'TICKETED' ? formatDisplayTotalPrice(basePrice, event.pass_fee_to_user, 1) : "$0.00";
             let rawPricePerItemValueCard: number | null = null;
             let rawTotalPriceValueCard: number | null = null;
             let rawFeePaidValueCard: number | null = null;
             if (event.booking_type === 'TICKETED' && event.ticket_price !== null && event.ticket_price >= 0) {
                 rawPricePerItemValueCard = event.ticket_price;
                 rawTotalPriceValueCard = calculateFinalPricePerItem(event.ticket_price, event.pass_fee_to_user) * 1;
                 rawFeePaidValueCard = event.pass_fee_to_user ? TRANSACTION_FEE * 1 : 0;
             }
            navigation.navigate('BookingConfirmation', {
                eventId: event.id, eventTitle: event.title, quantity: 1,
                pricePerItemDisplay: pricePerItemDisplayCard, totalPriceDisplay: totalPriceDisplayCard,
                bookingType: event.booking_type, // Pass validated type
                rawPricePerItem: rawPricePerItemValueCard, rawTotalPrice: rawTotalPriceValueCard,
                rawFeePaid: rawFeePaidValueCard, maxTickets: event.max_tickets,
                maxReservations: event.max_reservations,
            });
        } else {
            onPress(); // Open modal if not directly bookable
        }
    };

    useEffect(() => { if (isViewable) { logImpression(event.id); } }, [isViewable, event.id]);

    return (
        <TouchableOpacity style={styles.eventCard} activeOpacity={0.9} onPress={onPress}>
             <ImageSwiper
                images={event.images}
                defaultImage={DEFAULT_EVENT_IMAGE}
                containerStyle={styles.eventImageContainer}
                imageStyle={styles.eventImageStyle}
                height={styles.eventImageStyle.height}
             />
             <View style={styles.cardContent}>
                 <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                 {/* Optional: Display organizer name on card */}
                 <Text style={styles.cardOrganizerName} numberOfLines={1}>by {event.organizer.name}</Text>
                 <View style={styles.tagsScrollContainer}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsContainerCard}>{ [...event.genres, ...event.artists].filter(t => t).slice(0, 4).map((tag, i) => (<View key={`${tag}-${i}-card`} style={styles.tagBadgeCard}><Text style={styles.tagTextCard}>{tag}</Text></View>)) }{ [...event.genres, ...event.artists].filter(t => t).length > 4 && (<Text style={styles.tagTextCard}>...</Text>) }{ [...event.genres, ...event.artists].filter(t => t).length === 0 && (<Text style={styles.noTagsTextCard}>No tags</Text>) }</ScrollView></View>
                 <View style={styles.eventInfoRow}><Feather name="calendar" size={14} color="#6B7280" /><Text style={styles.eventInfoText} numberOfLines={1}>{event.date}</Text></View>
                 <View style={styles.eventInfoRow}><Feather name="clock" size={14} color="#6B7280" /><Text style={styles.eventInfoText} numberOfLines={1}>{event.time}</Text></View>
                 <View style={styles.eventInfoRow}><Feather name="map-pin" size={14} color="#6B7280" /><Text style={styles.eventInfoText} numberOfLines={1}>{event.venue}</Text></View>
                 <View style={styles.cardFooter}>
                     <Text style={styles.priceText}>{priceText}</Text>
                     <TouchableOpacity style={styles.bookButton} onPress={handleBookPressOnCard} disabled={!canBook && event.booking_type !== 'INFO_ONLY'} >
                         <Feather name={buttonIcon} size={14} color="#fff" />
                         <Text style={styles.bookButtonText}>{buttonText}</Text>
                     </TouchableOpacity>
                 </View>
             </View>
        </TouchableOpacity>
    );
});
// --- End Event Card Component ---

// --- Impression Logging Function (Unchanged) ---
const logImpression = async (eventId: string) => {
    console.log(`Logging impression for event: ${eventId}`);
    try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id ?? null;

        const { error } = await supabase.from('event_impressions').insert({
            event_id: eventId,
            user_id: userId,
            source: 'feed' // Assuming impressions logged from the main feed
        });
        if (error) {
            console.warn(`[Impression Log] Failed for event ${eventId}:`, error.message);
        }
    } catch (e) {
        console.error('[Impression Log] Unexpected error:', e);
    }
};

// --- Main Events Screen ---
const EventsScreen: React.FC = () => {
    const { session } = useAuth();
    const [events, setEvents] = useState<MappedEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false); // Combined loading state
    const [error, setError] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<MappedEvent | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const navigation = useNavigation<NavigationProp>();

    const viewabilityConfig = { itemVisiblePercentThreshold: 50 };
    const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: Array<{ item: MappedEvent; isViewable: boolean }> }) => {
        setEvents(prevEvents => {
            const viewableIds = new Map(viewableItems.map(v => [v.item.id, v.isViewable]));
            return prevEvents.map(event => {
                const isNowViewable = viewableIds.get(event.id) ?? false;
                return event.isViewable !== isNowViewable ? { ...event, isViewable: isNowViewable } : event;
            });
        });
    }, []);
    const viewabilityConfigRef = useRef(viewabilityConfig);
    const onViewableItemsChangedRef = useRef(onViewableItemsChanged);

    // Fetch upcoming events and associated organizer profiles
    const fetchEventsAndOrganizers = useCallback(async () => {
        console.log("Fetching events and organizers...");
        if (!refreshing) setIsLoading(true);
        setError(null);

        try {
            // 1. Fetch Events (only IDs needed for organizers initially)
            const { data: eventData, error: eventsError } = await supabase
                .from("events")
                .select(`
                    id, title, description, event_datetime, location_text, poster_urls,
                    tags_genres, tags_artists, tags_songs, organizer_id,
                    event_type, booking_type, ticket_price, pass_fee_to_user,
                    max_tickets, max_reservations
                `)
                .gt('event_datetime', new Date().toISOString())
                .order("event_datetime", { ascending: true });

            if (eventsError) throw eventsError;
            if (!eventData || eventData.length === 0) {
                setEvents([]);
                console.log("No upcoming events found.");
                setIsLoading(false);
                setRefreshing(false);
                return;
            }

            // 2. Extract Unique Organizer IDs
            const organizerIds = [...new Set(eventData.map(event => event.organizer_id).filter(id => !!id))];
            console.log("[EventsScreen] Unique organizer IDs:", organizerIds);

            let organizerMap = new Map<string, OrganizerInfo>();

            // 3. Fetch Organizer Profiles if IDs exist
            if (organizerIds.length > 0) {
                console.log(`[EventsScreen] Fetching profiles for ${organizerIds.length} organizers...`);
                const { data: organizerProfiles, error: profilesError } = await supabase
                    .from('organizer_profiles')
                    .select('user_id, company_name, logo')
                    .in('user_id', organizerIds);

                if (profilesError) {
                    console.warn("[EventsScreen] Error fetching organizer profiles:", profilesError);
                    // Proceed without organizer names/logos if fetch fails
                } else if (organizerProfiles) {
                    console.log(`[EventsScreen] Successfully fetched ${organizerProfiles.length} organizer profiles.`);
                    organizerProfiles.forEach(profile => {
                        // Log each profile being added to the map
                        console.log(`[EventsScreen] Mapping organizer: ID=${profile.user_id}, Name=${profile.company_name}`);
                        organizerMap.set(profile.user_id, {
                             userId: profile.user_id,
                             name: profile.company_name ?? DEFAULT_ORGANIZER_NAME, // Use default name if company_name is null
                             image: profile.logo ?? null
                        });
                    });
                }
            } else {
                console.log("[EventsScreen] No organizer IDs found in events, skipping profile fetch.");
            }

            // 4. Map Events with Organizer Data
            console.log("[EventsScreen] Mapping events to include organizer info...");
            const mappedEvents: MappedEvent[] = eventData.map((event: SupabasePublicEvent) => {
                const { date, time } = formatEventDateTime(event.event_datetime);
                // Lookup organizer info using event.organizer_id
                const organizerInfo = organizerMap.get(event.organizer_id);

                // Log the lookup result for each event
                if (organizerInfo) {
                     // console.log(`[EventsScreen] Event ${event.id}: Found organizer ${organizerInfo.name} (ID: ${organizerInfo.userId}) in map.`);
                } else {
                     console.log(`[EventsScreen] Event ${event.id}: Organizer ID ${event.organizer_id} NOT found in map. Using defaults.`);
                }

                const finalOrganizerData: OrganizerInfo = organizerInfo || {
                    userId: event.organizer_id, // Critical: Ensure userId is always set, even if defaulting
                    name: DEFAULT_ORGANIZER_NAME,
                    image: null
                };

                return {
                    id: event.id, title: event.title,
                    images: event.poster_urls?.length > 0 ? event.poster_urls : [DEFAULT_EVENT_IMAGE],
                    date: date, time: time,
                    venue: event.location_text ?? "N/A",
                    genres: event.tags_genres ?? [], artists: event.tags_artists ?? [], songs: event.tags_songs ?? [],
                    description: event.description ?? "No description.",
                    booking_type: event.booking_type,
                    ticket_price: event.ticket_price,
                    pass_fee_to_user: event.pass_fee_to_user ?? true,
                    max_tickets: event.max_tickets,
                    max_reservations: event.max_reservations,
                    organizer: finalOrganizerData, // Assign the looked-up or default data
                    isViewable: false,
                };
            });

            setEvents(mappedEvents);

        } catch (err: any) {
            console.error("Fetch Events/Organizers Error:", err);
            setError(`Failed to fetch events. Please try again.`);
            setEvents([]);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [refreshing]);

    useFocusEffect(useCallback(() => { fetchEventsAndOrganizers(); }, [fetchEventsAndOrganizers]));
    const onRefresh = useCallback(() => { setRefreshing(true); }, []);

    // Modal control (Unchanged)
    const handleEventPress = (event: MappedEvent) => { setSelectedEvent(event); setModalVisible(true); };
    const handleCloseModal = () => { setModalVisible(false); setSelectedEvent(null); };

    // Main render logic (Unchanged)
    const renderContent = () => {
        if (isLoading && !refreshing && events.length === 0) return <View style={styles.centeredContainer}><ActivityIndicator size="large" color="#3B82F6" /></View>;
        if (error) return ( <View style={styles.centeredContainer}><Feather name="alert-triangle" size={40} color="#F87171" /><Text style={styles.errorText}>{error}</Text>{!isLoading && (<TouchableOpacity onPress={fetchEventsAndOrganizers} style={styles.retryButton}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity>)}</View>);
        if (!isLoading && !refreshing && events.length === 0) return ( <View style={styles.centeredContainer}><Feather name="coffee" size={40} color="#9CA3AF" /><Text style={styles.emptyText}>No Upcoming Events</Text><Text style={styles.emptySubText}>Check back later or refresh!</Text></View>);
        return (
            <FlatList
                data={events}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <EventCard
                        event={item}
                        onPress={() => handleEventPress(item)}
                        isViewable={item.isViewable}
                    />
                )}
                contentContainerStyle={styles.eventsList}
                style={styles.flatListContainer}
                refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3B82F6"]} /> }
                onViewableItemsChanged={onViewableItemsChangedRef.current}
                viewabilityConfig={viewabilityConfigRef.current}
            />
        );
    };

    return (
        <SafeAreaView edges={["top"]} style={styles.container}>
            <View style={styles.rootContainer}>
                <View style={styles.header}><View style={styles.headerTitleRow}><View style={styles.titleContainer}><Feather name="calendar" size={22} color="#60A5FA" style={styles.headerIcon} /><Text style={styles.title}>Upcoming Events</Text></View></View><Text style={styles.subtitle}>Discover concerts and music events</Text></View>
                {renderContent()}
            </View>
            <EventDetailModal
                event={selectedEvent}
                visible={modalVisible}
                onClose={handleCloseModal}
                navigation={navigation} // Pass navigation prop
            />
        </SafeAreaView>
    );
};

// --- Styles --- (Add cardOrganizerName style)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f8fafc", },
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f8fafc', },
    errorText: { fontSize: 16, fontWeight: '600', color: '#DC2626', marginTop: 10, textAlign: 'center', },
    retryButton: { backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginTop: 15, },
    retryButtonText: { color: '#FFF', fontWeight: '600', },
    emptyText: { fontSize: 18, fontWeight: '600', color: '#4B5563', marginTop: 10, },
    emptySubText: { fontSize: 14, color: '#6B7280', marginTop: 5, textAlign: 'center', },
    rootContainer: { flex: 1, },
    flatListContainer: { flex: 1, },
    header: { paddingTop: 16, paddingBottom: 0, paddingHorizontal: 0, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: '#E5E7EB', },
    headerTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 8 },
    titleContainer: { flexDirection: "row", alignItems: "center", },
    headerIcon: { marginRight: 8, },
    title: { fontSize: 22, fontWeight: "bold", color: "#3B82F6", },
    subtitle: { fontSize: 14, color: "#6B7280", marginTop: 0, paddingHorizontal: 16, paddingBottom: 12 },
    eventsList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 80, },
    eventCard: { backgroundColor: "white", borderRadius: 12, overflow: "hidden", marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 3, },
    imageContainer: { position: "relative", },
    eventImage: { width: "100%", aspectRatio: 16 / 9, backgroundColor: '#F3F4F6', },
    // Define eventImageStyle FIRST
    eventImageStyle: {
        // Calculate height based on aspect ratio (approximate for initial render)
        height: (Dimensions.get('window').width - 32) * (9 / 16), // 16px padding on each side
    },
    // Add styles for ImageSwiper in the card context
    eventImageContainer: {
        width: "100%",
        aspectRatio: 16 / 9, // Maintain aspect ratio
        borderTopLeftRadius: 12, // Match card radius
        borderTopRightRadius: 12,
        backgroundColor: '#F3F4F6',
    },
    cardContent: { padding: 16, },
    eventTitle: { fontSize: 18, fontWeight: "700", color: "#1F2937", marginBottom: 4, },
    cardOrganizerName: { fontSize: 13, color: "#6B7280", marginBottom: 10 },
    tagsScrollContainer: { marginBottom: 12, },
    tagsContainerCard: { flexDirection: "row", flexWrap: "nowrap", alignItems: 'center' },
    tagBadgeCard: { backgroundColor: "rgba(59, 130, 246, 0.1)", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, marginRight: 6, marginBottom: 0, },
    tagTextCard: { fontSize: 12, color: "#1E3A8A", fontWeight: '500', },
    noTagsTextCard: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic'},
    eventInfoRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, },
    eventInfoText: { fontSize: 14, color: "#6B7280", marginLeft: 8, flexShrink: 1, },
    cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12, },
    priceText: { fontSize: 16, fontWeight: "700", color: "#3B82F6", flexShrink: 1, marginRight: 5 },
    bookButton: { backgroundColor: "#3B82F6", flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 50, },
    bookButtonText: { color: "white", fontWeight: "600", fontSize: 14, marginLeft: 6, },
    // Modal Styles
    modalContainer: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.6)", justifyContent: "flex-end", },
    modalContent: { backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, height: "90%", overflow: "hidden", },
    closeButton: { position: "absolute", top: 20, left: 16, zIndex: 10, backgroundColor: "rgba(230, 230, 230, 0.8)", borderRadius: 50, padding: 8, },
    imageSwiperContainer: {
        position: 'relative',
        width: '100%',
        height: 250,
        backgroundColor: '#F3F4F6',
    },
    modalImage: { width: "100%", height: 250, backgroundColor: '#F3F4F6', },
    paginationContainer: {
        position: 'absolute',
        bottom: 15,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
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
        zIndex: 1,
    },
    arrowLeft: {
        left: 15,
    },
    arrowRight: {
        right: 15,
    },
    modalBody: { padding: 20, paddingBottom: 40 },
    modalTitle: { fontSize: 24, fontWeight: "bold", color: "#1F2937", marginBottom: 16, },
    organizerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, },
    organizerInfo: { flexDirection: "row", alignItems: "center", flexShrink: 1, marginRight: 10 },
    organizerImage: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: '#E5E7EB', },
    organizerName: { fontSize: 15, fontWeight: "600", color: "#1F2937", flexShrink: 1 },
    organizerLabel: { fontSize: 13, color: "#6B7280", },
    followButton: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 50, backgroundColor: "rgba(59, 130, 246, 0.1)", },
    followButtonText: { fontSize: 14, fontWeight: "500", color: "#3B82F6", marginLeft: 6, },
    tagsContainerModal: { flexDirection: "row", flexWrap: "nowrap", paddingBottom: 16 },
    tagBadgeModal: { backgroundColor: "#E0E7FF", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 8, },
    tagTextModal: { color: "#4338CA", fontSize: 14, fontWeight: '500' },
    noTagsText: { fontSize: 14, color: '#9CA3AF', fontStyle: 'italic', paddingVertical: 6 },
    divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 20, },
    sectionTitle: { fontSize: 18, fontWeight: "600", color: "#1F2937", marginBottom: 12, },
    descriptionText: { fontSize: 15, lineHeight: 24, color: "#4B5563", },
    quantitySelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 16, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E5E7EB'},
    quantityLabel: { fontSize: 16, color: '#374151', fontWeight: '500', flexShrink: 1, marginRight: 10 },
    quantityControls: { flexDirection: 'row', alignItems: 'center' },
    quantityButton: { padding: 8, borderRadius: 20, backgroundColor: '#F3F4F6', marginHorizontal: 10 },
    quantityValue: { fontSize: 18, fontWeight: '600', color: '#1F2937', minWidth: 30, textAlign: 'center' },
    bookNowButton: { backgroundColor: "#3B82F6", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, marginTop: 24, marginBottom: 24, },
    bookNowButtonText: { color: "white", fontWeight: "600", fontSize: 16, marginLeft: 8, },
    disabledButton: { backgroundColor: '#9CA3AF' },
    infoOnlyBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, marginTop: 24, marginBottom: 24 },
    infoOnlyText: { marginLeft: 8, fontSize: 14, color: '#4B5563', flexShrink: 1 },
});

export default EventsScreen;