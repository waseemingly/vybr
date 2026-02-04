import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ScrollView, Modal,
  Dimensions, ActivityIndicator, RefreshControl, Alert, GestureResponderEvent,
  Platform, 
  Share, // Added Share API
  // SectionList // No longer used
} from "react-native";
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../lib/supabase"; // Adjust path, remove EventBooking if unused
import { useAuth } from "../hooks/useAuth"; // Adjust path
import { APP_CONSTANTS } from "@/config/constants";
import type { MusicLoverBio } from "@/hooks/useAuth"; // Changed import source
import type { RootStackParamList, MainStackParamList } from '@/navigation/AppNavigator';
import ImageSwiper from '@/components/ImageSwiper'; // <-- Import the new component
import { TextInput } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { LinearGradient } from "expo-linear-gradient";
import { getCurrencyForCountry, getCurrencySymbol, formatPriceWithCurrency } from '../utils/currencyUtils'; // Add currency utilities

// Define navigation prop using imported types
// Add openEventId to EventsScreen params in RootStackParamList
// Example: EventsScreen: { openEventId?: string; initialScreenTab?: 'forYou' | 'allEvents' };
type EventsScreenRouteProp = RouteProp<RootStackParamList, 'EventsScreen'>;

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
  country?: string | null; // Added for filtering
  city?: string | null;    // Added for filtering
}

export interface OrganizerInfo {
    userId: string;
    name: string;
    image: string | null;
}

export interface FandBOrganizer {
  userId: string;
  name: string;
  image: string | null;
  capacity: number;
  opening_hours?: any; // Using 'any' to avoid deep type issues for now
  unavailable_dates?: string[];
}

export interface MappedEvent {
  id: string; title: string; images: string[]; date: string; time: string;
  venue: string; 
  country?: string | null; // Keep location info
  city?: string | null;
  genres: string[]; artists: string[]; songs: string[];
  description: string;
  booking_type: 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null;
  ticket_price: number | null;
  pass_fee_to_user: boolean;
  max_tickets: number | null; max_reservations: number | null;
  organizer: OrganizerInfo; // Use the separate interface
  score?: number; // Added for recommendation sorting
  event_datetime_iso: string; // Added for accurate sorting before display formatting
}

// Interface for user profile data needed for recommendations
interface MusicLoverProfileData {
    userId: string;
    country: string | null;
    city: string | null;
    top_genres?: string[];
    top_artists?: string[];
    top_tracks?: string[]; 
    favorite_artists?: string[];
    favorite_albums?: string[]; 
    favorite_songs?: string[];
    bio?: MusicLoverBio | null; 
    music_data?: { genres?: string[] }; // Added to reflect potential structure from SQL
}

// Section type for SectionList
interface EventSection {
  title: string;
  data: MappedEvent[];
}

// --- Constants and Helpers ---
const DEFAULT_EVENT_IMAGE = "https://via.placeholder.com/800x450/D1D5DB/1F2937?text=No+Image";
const DEFAULT_ORGANIZER_LOGO = /* APP_CONSTANTS.DEFAULT_ORGANIZER_LOGO || */ "https://via.placeholder.com/150/BFDBFE/1E40AF?text=Logo";
const DEFAULT_ORGANIZER_NAME = "Event Organizer";
const TRANSACTION_FEE = 0.50;
const EVENTS_PER_PAGE = 10;

// --- Timezone-safe Date Formatting Helper ---
const toYYYYMMDD = (date: Date) => {
    const y = date.getFullYear();
    const m = date.getMonth() + 1; // getMonth() is zero-based
    const d = date.getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

// Card dimensions for web
const CARDS_PER_ROW_WEB = 4;
const CARD_MARGIN_WEB = 16; // Total margin around a card (e.g., 8 on each side if space-between)

// Weights for scoring
const SCORE_WEIGHTS = {
    GENRE_MATCH: 2,
    ARTIST_MATCH: 5,
    SONG_MATCH: 1, // Lower weight as song tags might be less common/accurate
    BIO_TASTE_MATCH: 1, // Lower weight for broader description match
};

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

const formatDisplayPricePerItem = (basePrice: number | null, passFee: boolean, currency: string = 'USD'): string => {
    if (basePrice === null || basePrice < 0) return "N/A";
    if (basePrice === 0) return "Free";
    const finalPrice = calculateFinalPricePerItem(basePrice, passFee);
    return `${formatPriceWithCurrency(finalPrice, currency)} each`;
};

const formatDisplayTotalPrice = (basePrice: number | null, passFee: boolean, quantity: number, currency: string = 'USD'): string => {
     if (basePrice === null || basePrice < 0) return "N/A";
     if (basePrice === 0) return formatPriceWithCurrency(0, currency);
     const finalPricePerItem = calculateFinalPricePerItem(basePrice, passFee);
     return formatPriceWithCurrency(finalPricePerItem * quantity, currency);
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
    const [shareModalVisible, setShareModalVisible] = useState(false);

    useEffect(() => { if (visible) { setQuantity(1); setCurrentImageIndex(0); } }, [visible]);

    if (!event) return null;

    // For web, the modal content itself will be constrained, so image can take that width.
    // For native, it will take screen width.
    const windowWidth = Dimensions.get('window').width;
    // We will set a maxWidth for modalContent on web. Image width will be this max width or window width if smaller.
    const modalContentEffectiveMaxWidth = Platform.OS === 'web' ? Math.min(windowWidth * 0.9, 700) : windowWidth;
    
    const imageContainerWidth = modalContentEffectiveMaxWidth; 
    const imageContainerHeight = imageContainerWidth; // For 1:1 aspect ratio

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
            onClose(); // Close the modal first
            navigation.navigate('ViewOrganizerProfileScreen', { organizerUserId: event.organizer.userId });
        }
    };
    // ----------------------------------

    // --- Booking Logic (Check type before navigating) ---
     let canBookOrReserve = false;
     if (event.booking_type === 'TICKETED') {
         canBookOrReserve = event.ticket_price !== null; // For tickets, price must be set (even if 0 for free tickets)
     } else if (event.booking_type === 'RESERVATION') {
         canBookOrReserve = true; // For reservations, always allow if type is RESERVATION
     }
     const basePrice = event.ticket_price;
     const pricePerItemDisplay = event.booking_type === 'TICKETED'
                                ? formatDisplayPricePerItem(basePrice, event.pass_fee_to_user, event.country ? getCurrencyForCountry(event.country) : 'USD')
                                : "Free";
     const totalPriceDisplay = event.booking_type === 'TICKETED'
                               ? formatDisplayTotalPrice(basePrice, event.pass_fee_to_user, quantity, event.country ? getCurrencyForCountry(event.country) : 'USD')
                               : formatPriceWithCurrency(0, event.country ? getCurrencyForCountry(event.country) : 'USD');

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

        navigation.navigate('BookingConfirmation' as any, {
            eventId: event.id, eventTitle: event.title, quantity: quantity,
            pricePerItemDisplay: pricePerItemDisplay, totalPriceDisplay: totalPriceDisplay,
            bookingType: event.booking_type, // Pass validated type
            rawPricePerItem: rawPricePerItemValue, rawTotalPrice: rawTotalPriceValue,
            rawFeePaid: rawFeePaidValue, maxTickets: event.max_tickets,
            maxReservations: event.max_reservations,
            eventCurrency: event.country ? getCurrencyForCountry(event.country) : 'USD', // Pass event currency
            eventCountry: event.country, // Pass event country
        } as any); // Use type assertion as parameters might not match perfectly
        onClose();
    };

    const handleShare = async () => {
        if (!event) return;
        setShareModalVisible(true);
    };

    const handleExternalShare = async () => {
        if (!event) return;
        try {
            const result = await Share.share({
                message: `Check out this event: ${event.title} on ${event.date} at ${event.venue}. Find out more on Vybr!`,
                // url: 'YOUR_APP_STORE_LINK_OR_EVENT_DEEPLINK', // Optional: replace with a deep link to the event in your app
                title: `Vybr Event: ${event.title}`
            });
            
            if (result.action === Share.sharedAction) {
                if (result.activityType) {
                    // shared with activity type of result.activityType
                    console.log('Shared with activity type:', result.activityType);
                } else {
                    // shared
                    console.log('Shared');
                }
            } else if (result.action === Share.dismissedAction) {
                // dismissed
                console.log('Share dismissed');
            }
        } catch (error: any) {
            Alert.alert("Error", error.message);
        }
        setShareModalVisible(false);
    };

    const handleNavigateToShareWithChat = () => {
        setShareModalVisible(false);
        onClose(); // Close the event modal
        navigation.navigate('ShareEventScreen' as any, {
            eventId: event.id,
            eventTitle: event.title,
            eventDate: event.date,
            eventVenue: event.venue,
            eventImage: event.images?.[0] || DEFAULT_EVENT_IMAGE
        });
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}><Feather name="x" size={24} color="#6B7280" /></TouchableOpacity>
              <ScrollView 
                showsVerticalScrollIndicator={false}
                bounces={Platform.OS !== 'web'} // Enable bounce effect on mobile
                alwaysBounceVertical={Platform.OS !== 'web'} // Always allow vertical bounce on mobile
                contentContainerStyle={Platform.OS !== 'web' ? { flexGrow: 1 } : undefined} // Ensure content can grow on mobile
              >
                  <View style={[styles.imageSwiperContainer, { height: imageContainerHeight }]}>
                       <ScrollView
                           ref={scrollViewRef}
                           horizontal
                           pagingEnabled
                           showsHorizontalScrollIndicator={false}
                           onMomentumScrollEnd={(e) => onScroll(e.nativeEvent)}
                           scrollEventThrottle={16}
                           style={{ width: imageContainerWidth, height: imageContainerHeight }} // Use dynamic height
                       >
                           {images.map((uri, index) => (
                               <Image
                                   key={index}
                                   source={{ uri: uri }}
                                   style={[styles.modalImage, { width: imageContainerWidth, height: imageContainerHeight }]} // Use dynamic height
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
                      {/* Share Button */}
                        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                            <Feather name="share-2" size={18} color="#3B82F6" />
                            <Text style={styles.shareButtonText}>Share Event</Text>
                        </TouchableOpacity>
                      {/* Proceed Button */}
                      {canBookOrReserve && (
                          <TouchableOpacity style={styles.bookNowButton} onPress={handleProceedToConfirmation} >
                              <Feather name={buttonIcon} size={18} color="#fff" />
                              <Text style={styles.bookNowButtonText}>{buttonText}</Text>
                          </TouchableOpacity>
                      )}
                      {!canBookOrReserve && event.booking_type === 'INFO_ONLY' && (
                          <View style={styles.infoOnlyBadge}><Feather name="info" size={16} color="#6B7280" /><Text style={styles.infoOnlyText}> No booking required.</Text></View>
                      )}
                  </View>
              </ScrollView>
            </View>
          </View>
          
          {/* Share Options Modal */}
          <Modal
              visible={shareModalVisible}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShareModalVisible(false)}
          >
              <TouchableOpacity 
                  style={styles.shareModalOverlay}
                  activeOpacity={1}
                  onPress={() => setShareModalVisible(false)}
              >
                  <View style={styles.shareModalContent}>
                      <Text style={styles.shareModalTitle}>Share Event</Text>
                      
                      <TouchableOpacity 
                          style={styles.shareOption}
                          onPress={handleNavigateToShareWithChat}
                      >
                          <Feather name="message-circle" size={24} color="#3B82F6" />
                          <Text style={styles.shareOptionText}>Share to Chats</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                          style={styles.shareOption}
                          onPress={handleExternalShare}
                      >
                          <Feather name="external-link" size={24} color="#10B981" />
                          <Text style={styles.shareOptionText}>Share to External Apps</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                          style={[styles.shareOption, styles.cancelShareOption]}
                          onPress={() => setShareModalVisible(false)}
                      >
                          <Text style={styles.cancelShareText}>Cancel</Text>
                      </TouchableOpacity>
                  </View>
              </TouchableOpacity>
          </Modal>
        </Modal>
    );
};
// --- End Event Detail Modal ---

// --- Restaurant Card Component ---
interface RestaurantCardProps {
  organizer: FandBOrganizer;
  onPress: () => void;
}
const RestaurantCard: React.FC<RestaurantCardProps> = React.memo(({ organizer, onPress }) => (
    <View style={[styles.eventCard, styles.restaurantCard]}>
        <Image 
            source={{ uri: organizer.image ?? DEFAULT_ORGANIZER_LOGO }} 
            style={styles.restaurantImage}
        />
        <View style={styles.cardContent}>
            <Text style={styles.eventTitle} numberOfLines={1}>{organizer.name}</Text>
            <Text style={styles.restaurantCapacity} numberOfLines={1}>Capacity: {organizer.capacity} guests</Text>
            <View style={styles.cardFooter}>
                <TouchableOpacity style={styles.bookButton} onPress={onPress}>
                    <Feather name="bookmark" size={14} color="#fff" />
                    <Text style={styles.bookButtonText}>Reserve</Text>
                </TouchableOpacity>
            </View>
        </View>
    </View>
));
// --- End Restaurant Card Component ---

// --- Event Card Component ---
interface EventCardProps { event: MappedEvent; onPress: () => void; }
export const EventCard: React.FC<EventCardProps> = React.memo(({ event, onPress }) => {
    const navigation = useNavigation<NavigationProp>();
    const [hasLoggedImpression, setHasLoggedImpression] = useState(false);
    
    // --- Booking Logic (Check type before navigating) ---
     let canBook = false;
     if (event.booking_type === 'TICKETED') {
         canBook = event.ticket_price !== null;
     } else if (event.booking_type === 'RESERVATION') {
         canBook = true; // Allow direct reservation from card if type is RESERVATION
     }
     const basePrice = event.ticket_price;
     const priceText = event.booking_type === 'TICKETED'
                      ? formatDisplayPricePerItem(basePrice, event.pass_fee_to_user, event.country ? getCurrencyForCountry(event.country) : 'USD')
                      : event.booking_type === 'RESERVATION' ? "Reservation" : "";
     let buttonText = "View";
     let buttonIcon: React.ComponentProps<typeof Feather>['name'] = "info";
     if (event.booking_type === 'TICKETED') { buttonText = "Get Tickets"; buttonIcon = "tag"; }
     else if (event.booking_type === 'RESERVATION') { buttonText = "Reserve"; buttonIcon = "bookmark"; }
    // --- End Booking Logic ---

    const handleBookPressOnCard = (e: GestureResponderEvent) => {
        e.stopPropagation();
        if (event && (event.booking_type === 'TICKETED' || event.booking_type === 'RESERVATION')) {
             const pricePerItemDisplayCard = event.booking_type === 'TICKETED' ? formatDisplayPricePerItem(basePrice, event.pass_fee_to_user, event.country ? getCurrencyForCountry(event.country) : 'USD') : "Free";
             const totalPriceDisplayCard = event.booking_type === 'TICKETED' ? formatDisplayTotalPrice(basePrice, event.pass_fee_to_user, 1, event.country ? getCurrencyForCountry(event.country) : 'USD') : formatPriceWithCurrency(0, event.country ? getCurrencyForCountry(event.country) : 'USD');
             let rawPricePerItemValueCard: number | null = null;
             let rawTotalPriceValueCard: number | null = null;
             let rawFeePaidValueCard: number | null = null;
             if (event.booking_type === 'TICKETED' && event.ticket_price !== null && event.ticket_price >= 0) {
                 rawPricePerItemValueCard = event.ticket_price;
                 rawTotalPriceValueCard = calculateFinalPricePerItem(event.ticket_price, event.pass_fee_to_user) * 1;
                 rawFeePaidValueCard = event.pass_fee_to_user ? TRANSACTION_FEE * 1 : 0;
             }
            navigation.navigate('BookingConfirmation' as any, {
                eventId: event.id, eventTitle: event.title, quantity: 1,
                pricePerItemDisplay: pricePerItemDisplayCard, totalPriceDisplay: totalPriceDisplayCard,
                bookingType: event.booking_type, // Pass validated type
                rawPricePerItem: rawPricePerItemValueCard, rawTotalPrice: rawTotalPriceValueCard,
                rawFeePaid: rawFeePaidValueCard, maxTickets: event.max_tickets,
                maxReservations: event.max_reservations,
                eventCurrency: event.country ? getCurrencyForCountry(event.country) : 'USD', // Pass event currency
                eventCountry: event.country, // Pass event country
            } as any); // Use type assertion
        } else {
            onPress(); // Open modal if not directly bookable
        }
    };

    // Log impression when card comes into view - only once per event per session
    const logImpressionOnceRef = useRef(false);
    
    const handleViewableChange = useCallback((isViewable: boolean) => {
        if (isViewable && !logImpressionOnceRef.current && !hasLoggedImpression) {
            logImpressionOnceRef.current = true;
            setHasLoggedImpression(true);
            logImpression(event.id, 'feed');
        }
    }, [event.id, hasLoggedImpression]);

    const cardWidth = Platform.OS === 'web' 
        ? (Dimensions.get('window').width - (styles.eventsList.paddingHorizontal as number) * 2 - CARD_MARGIN_WEB * (CARDS_PER_ROW_WEB - 1)) / CARDS_PER_ROW_WEB
        : Dimensions.get('window').width - (styles.eventsList.paddingHorizontal as number) * 2;
    
    const imageDimension = cardWidth; // For 1:1 aspect ratio

    return (
        <TouchableOpacity style={[styles.eventCard, Platform.OS === 'web' && styles.eventCardWeb]} activeOpacity={0.9} onPress={onPress}>
             <ImageSwiper
                images={event.images}
                defaultImage={DEFAULT_EVENT_IMAGE}
                containerStyle={[styles.eventImageContainer, Platform.OS === 'web' ? { width: imageDimension, height: imageDimension } : { height: imageDimension }]}
                imageStyle={[styles.eventImageStyle, { width: imageDimension, height: imageDimension }]}
                height={imageDimension} // Pass calculated 1:1 dimension
                onViewableChange={handleViewableChange} // Pass the callback to ImageSwiper
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

// --- Impression Logging Function (Enhanced with better logging) ---
const logImpression = async (eventId: string, source: string = 'feed') => {
    console.log(`[IMPRESSION] Logging impression for event: ${eventId} from source: ${source}`);
    try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id ?? null;

        const { error } = await supabase.from('event_impressions').insert({
            event_id: eventId,
            user_id: userId,
            source: source,
            viewed_at: new Date().toISOString()
        });
        
        if (error) {
            console.warn(`[IMPRESSION] Failed for event ${eventId}:`, error.message);
        } else {
            console.log(`[IMPRESSION] Successfully logged for event ${eventId} by user ${userId || 'anonymous'}`);
        }

        // As requested, invoking the edge function to report usage.
        console.log(`[IMPRESSION] Invoking edge function 'report-monthly-impression-usage' for event: ${eventId}`);
        const { error: functionError } = await supabase.functions.invoke('report-monthly-impression-usage', {
            body: { eventId: eventId },
        });

        if (functionError) {
            console.error(`[IMPRESSION] Error invoking report-monthly-impression-usage function:`, functionError.message);
        } else {
            console.log(`[IMPRESSION] Successfully invoked edge function for event: ${eventId}`);
        }

    } catch (e) {
        console.error('[IMPRESSION] Unexpected error:', e);
    }
};

// --- Main Events Screen ---
const EventsScreen: React.FC = () => {
    const { session } = useAuth(); // Get session, user is inside session.user
    const route = useRoute<EventsScreenRouteProp>(); // Get route object
    const [userProfile, setUserProfile] = useState<MusicLoverProfileData | null>(null);
    // State for raw fetched data
    const [rawEvents, setRawEvents] = useState<SupabasePublicEvent[]>([]);
    const [forYouEventsRaw, setForYouEventsRaw] = useState<any[]>([]); // Raw RPC results for "For You" tab
    const [allEventsRaw, setAllEventsRaw] = useState<any[]>([]); // Raw RPC results for "All Events" tab
    const [organizerMap, setOrganizerMap] = useState<Map<string, OrganizerInfo>>(new Map());
    
    // State for F&B organizers (restaurants)
    const [restaurants, setRestaurants] = useState<FandBOrganizer[]>([]);
    const [loadingRestaurants, setLoadingRestaurants] = useState(true);
    const [restaurantSearchQuery, setRestaurantSearchQuery] = useState('');
    const [filteredRestaurants, setFilteredRestaurants] = useState<FandBOrganizer[]>([]);

    // State for processed event lists for tabs
    const [forYouEvents, setForYouEvents] = useState<MappedEvent[]>([]);
    const [allEventsTabSource, setAllEventsTabSource] = useState<MappedEvent[]>([]); // Source for "All Events" tab before pagination

    // Pagination states for "For You" tab
    const [currentPageForYou, setCurrentPageForYou] = useState(1);
    const [loadedForYouEvents, setLoadedForYouEvents] = useState<MappedEvent[]>([]);
    const [allForYouEventsLoaded, setAllForYouEventsLoaded] = useState(false);
    const [isFetchingMoreForYou, setIsFetchingMoreForYou] = useState(false);

    // Pagination states for "All Events" tab
    const [currentPageAllEvents, setCurrentPageAllEvents] = useState(1);
    const [loadedAllEvents, setLoadedAllEvents] = useState<MappedEvent[]>([]);
    const [allAllEventsLoaded, setAllAllEventsLoaded] = useState(false);
    const [isFetchingMoreAllEvents, setIsFetchingMoreAllEvents] = useState(false);

    const [isLoading, setIsLoading] = useState(true); // Combined loading state for profile + initial events
    const [error, setError] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<MappedEvent | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [reservationModalVisible, setReservationModalVisible] = useState(false);
    const [selectedRestaurant, setSelectedRestaurant] = useState<FandBOrganizer | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const navigation = useNavigation<NavigationProp>();

    // TabView state // Replaced with manual tab state
    const [activeTabIndex, setActiveTabIndex] = useState(0); // 0: For You, 1: All Events, 2: Restaurants

    // Impression tracking refs (keep as is)
    const viewabilityConfig = { itemVisiblePercentThreshold: 50 };
    const onViewableItemsChanged = useCallback(({ viewableItems, changed }: { viewableItems: Array<any>, changed: Array<any> }) => {
        changed.forEach((viewToken: any) => {
            const { item, isViewable } = viewToken;
            if (isViewable && item?.id) {
                logImpression(item.id);
            }
        });
    }, []);
    const viewabilityConfigRef = useRef(viewabilityConfig);
    const onViewableItemsChangedRef = useRef(onViewableItemsChanged);

    // Fetch User Profile
    const fetchUserProfile = useCallback(async () => {
        const userId = session?.user?.id; 
        if (!userId) {
            setUserProfile(null); 
            console.log("[EventsScreen] No user logged in, cannot fetch profile.");
            return;
        }
        console.log("[EventsScreen] Fetching user profile data...");
        try {
            // Fetch profile data (location, bio, favorites, music_data)
            const { data: profileData, error: profileError } = await supabase
                .from('music_lover_profiles')
                .select('user_id, country, city, bio, favorite_artists, favorite_albums, favorite_songs, music_data') // Added music_data
                .eq('user_id', userId)
                .single();

            if (profileError && profileError.code !== 'PGRST116') {
                console.error("[EventsScreen] Error fetching profile part:", profileError);
                throw new Error(`Profile fetch error: ${profileError.message}`);
            }
            
            // Fetch streaming data (top items)
            const { data: streamingData, error: streamingError } = await supabase
                .from('user_streaming_data')
                .select('top_artists, top_genres, top_tracks') // Added top_tracks
                .eq('user_id', userId)
                .maybeSingle(); // Use maybeSingle as user might not have connected streaming

            if (streamingError) {
                console.warn("[EventsScreen] Warning fetching streaming data:", streamingError.message);
            }

            if (!profileData) {
                 console.log("[EventsScreen] No base music lover profile found for user.");
                 setUserProfile(null); 
                 return;
            }

            // Helper to map JSON array of objects (e.g., [{name: "value"}]) to string array of names
            const mapJsonArrayToNames = (arr: any[] | undefined): string[] => {
                if (!Array.isArray(arr)) return [];
                return arr
                    .map(item => (item && typeof item.name === 'string' ? item.name.trim().toLowerCase() : null))
                    .filter((name): name is string => name !== null && name !== '');
            };
            
            // Combine data
            const combinedProfile: MusicLoverProfileData = {
                userId: profileData.user_id,
                country: profileData.country,
                city: profileData.city,
                bio: profileData.bio ? (typeof profileData.bio === 'string' ? JSON.parse(profileData.bio) : profileData.bio) : null, 
                favorite_artists: Array.isArray(profileData.favorite_artists) ? profileData.favorite_artists : [],
                favorite_albums: Array.isArray(profileData.favorite_albums) ? profileData.favorite_albums : [],
                favorite_songs: Array.isArray(profileData.favorite_songs) ? profileData.favorite_songs : [],
                music_data: profileData.music_data ? (typeof profileData.music_data === 'string' ? JSON.parse(profileData.music_data) : profileData.music_data) : { genres: [] }, 
                top_genres: mapJsonArrayToNames(streamingData?.top_genres),
                top_artists: mapJsonArrayToNames(streamingData?.top_artists),
                top_tracks: mapJsonArrayToNames(streamingData?.top_tracks) 
            };

            console.log("[EventsScreen] Combined user profile data set.");
            setUserProfile(combinedProfile);

        } catch (err: any) {
            console.error("[EventsScreen] Fetch User Profile Data Error:", err);
            setError(`Could not load your profile data: ${err.message}`);
            setUserProfile(null); // Set profile to null on error
        }
    }, [session]); // Depend on session

    // Fetch F&B Organizers (Restaurants)
    const fetchRestaurants = useCallback(async () => {
        console.log("[EventsScreen] Fetching restaurants (F&B organizers)...");
        setLoadingRestaurants(true);
        try {
            const { data, error } = await supabase
                .from('organizer_profiles')
                .select('user_id, company_name, logo, capacity, opening_hours, unavailable_dates') // <-- ADDED unavailable_dates
                .eq('business_type', 'F&B')
                .order('company_name', { ascending: true });

            if (error) throw error;

            const mappedRestaurants: FandBOrganizer[] = data.map(org => ({
                userId: org.user_id,
                name: org.company_name ?? 'Restaurant',
                image: org.logo,
                capacity: org.capacity ?? 0,
                opening_hours: org.opening_hours,
                unavailable_dates: org.unavailable_dates || [], // <-- MAPPED HERE
            }));
            
            setRestaurants(mappedRestaurants);
        } catch (err: any) {
            console.error("[EventsScreen] Fetch Restaurants Error:", err);
            setError("Failed to load restaurants.");
        } finally {
            setLoadingRestaurants(false);
        }
    }, []);

    // Fetch recommended events using Supabase RPC function (For You tab)
    const fetchRecommendedEvents = useCallback(async () => {
        const userId = session?.user?.id;
        if (!userId) {
            console.log("[EventsScreen] No user logged in, cannot fetch recommended events.");
            return [];
        }
        console.log("[EventsScreen] Fetching recommended events via RPC...");
        try {
            const { data, error } = await supabase.rpc('get_recommended_events_for_user', {
                p_current_user_id: userId
            });

            if (error) {
                console.error("[EventsScreen] RPC Error (get_recommended_events_for_user):", error);
                throw error;
            }

            console.log(`[EventsScreen] Fetched ${data?.length || 0} recommended events from RPC`);
            return data || [];
        } catch (err: any) {
            console.error("[EventsScreen] Fetch Recommended Events Error:", err);
            return [];
        }
    }, [session]);

    // Fetch events by user country using Supabase RPC function (All Events tab)
    const fetchEventsByCountry = useCallback(async () => {
        const userId = session?.user?.id;
        if (!userId) {
            console.log("[EventsScreen] No user logged in, cannot fetch events by country.");
            return [];
        }
        console.log("[EventsScreen] Fetching events by country via RPC...");
        try {
            const { data, error } = await supabase.rpc('get_events_by_user_country', {
                p_current_user_id: userId
            });

            if (error) {
                console.error("[EventsScreen] RPC Error (get_events_by_user_country):", error);
                throw error;
            }

            console.log(`[EventsScreen] Fetched ${data?.length || 0} events by country from RPC`);
            return data || [];
        } catch (err: any) {
            console.error("[EventsScreen] Fetch Events By Country Error:", err);
            return [];
        }
    }, [session]);

    // Fetch events and organizers using Supabase RPC functions
    const fetchEventsAndOrganizers = useCallback(async () => {
        console.log("[EventsScreen] Fetching events using Supabase RPC functions...");
        if (!refreshing) setIsLoading(true);
        setError(null);

        try {
            // Fetch both recommended events (For You) and country-based events (All Events) in parallel
            const [recommendedEventsData, countryEventsData] = await Promise.all([
                fetchRecommendedEvents(),
                fetchEventsByCountry()
            ]);

            // Combine and deduplicate events (use Set to avoid duplicates by event ID)
            const allEventsMap = new Map();
            
            // Add recommended events first
            recommendedEventsData.forEach((event: any) => {
                allEventsMap.set(event.id, event);
            });
            
            // Add country events (will overwrite if duplicate, but that's fine)
            countryEventsData.forEach((event: any) => {
                allEventsMap.set(event.id, event);
            });

            const allEvents = Array.from(allEventsMap.values());
            console.log(`[EventsScreen] Total unique events: ${allEvents.length} (${recommendedEventsData.length} recommended, ${countryEventsData.length} by country)`);
            
            // Store raw events for processing
            setRawEvents(allEvents);

            // Fetch Organizers for all unique events
            const organizerIds = Array.from(new Set(allEvents.map((event: any) => event.organizer_id).filter((id: any) => !!id)));
            const newOrganizerMap = new Map<string, OrganizerInfo>();
            
            if (organizerIds.length > 0) {
                const { data: organizerProfiles, error: profilesError } = await supabase
                    .from('organizer_profiles')
                    .select('user_id, company_name, logo')
                    .in('user_id', organizerIds);

                if (profilesError) {
                    console.warn("[EventsScreen] Error fetching organizer profiles:", profilesError);
                } else if (organizerProfiles) {
                    organizerProfiles.forEach(profile => {
                        newOrganizerMap.set(profile.user_id, {
                            userId: profile.user_id,
                            name: profile.company_name ?? DEFAULT_ORGANIZER_NAME,
                            image: profile.logo ?? null
                        });
                    });
                }
            }
            setOrganizerMap(newOrganizerMap);

            // Store separate arrays for each tab
            setForYouEventsRaw(recommendedEventsData);
            setAllEventsRaw(countryEventsData);

        } catch (err: any) {
            console.error("[EventsScreen] Fetch Events/Organizers Error:", err);
            setError(`Failed to fetch events. Please try again.`);
            setRawEvents([]);
            setOrganizerMap(new Map());
            setForYouEventsRaw([]);
            setAllEventsRaw([]);
        }
        // Loading state is handled after processing in useEffect
    }, [refreshing, fetchRecommendedEvents, fetchEventsByCountry]);

    // Initial data fetch
    useFocusEffect(useCallback(() => {
        setIsLoading(true); // Start loading indicator
        // Reset pagination on focus/initial load
        setCurrentPageForYou(1);
        setAllForYouEventsLoaded(false);
        setCurrentPageAllEvents(1);
        setAllAllEventsLoaded(false);

        const { openEventId, initialScreenTab } = route.params || {};
        if (initialScreenTab === 'allEvents') {
            setActiveTabIndex(1);
        } else {
            setActiveTabIndex(0); // Default to 'For You' or handle other tabs
        }

        Promise.all([fetchUserProfile(), fetchEventsAndOrganizers(), fetchRestaurants()])
            .then(() => {
                if (openEventId) {
                    // The processing useEffect will handle finding and setting the event
                    // Ensure it runs AFTER data is fetched and processed
                    console.log(`[EventsScreen] Focus: Received openEventId: ${openEventId}`);
                }
            })
            .finally(() => {
           // setIsLoading(false); // Loading is set to false after processing effect runs
        });
    }, [fetchUserProfile, fetchEventsAndOrganizers, fetchRestaurants, route.params]));

    // Helper function to map RPC event result to MappedEvent
    const mapRpcEventToMappedEvent = useCallback((rpcEvent: any): MappedEvent | null => {
        if (!rpcEvent) return null;
        
        const { date, time } = formatEventDateTime(rpcEvent.event_datetime);
        const organizerInfo = organizerMap.get(rpcEvent.organizer_id);
        const finalOrganizerData: OrganizerInfo = organizerInfo || {
            userId: rpcEvent.organizer_id,
            name: DEFAULT_ORGANIZER_NAME,
            image: null
        };

        // Parse JSONB arrays to regular arrays
        const parseJsonbArray = (jsonbArr: any): string[] => {
            if (!jsonbArr) return [];
            if (Array.isArray(jsonbArr)) return jsonbArr;
            try {
                const parsed = typeof jsonbArr === 'string' ? JSON.parse(jsonbArr) : jsonbArr;
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        };

        return {
            id: rpcEvent.id,
            title: rpcEvent.title,
            images: parseJsonbArray(rpcEvent.poster_urls)?.length > 0 
                ? parseJsonbArray(rpcEvent.poster_urls) 
                : [DEFAULT_EVENT_IMAGE],
            date: date,
            time: time,
            venue: rpcEvent.location_text ?? "N/A",
            country: rpcEvent.country,
            city: rpcEvent.city,
            genres: parseJsonbArray(rpcEvent.tags_genres),
            artists: parseJsonbArray(rpcEvent.tags_artists),
            songs: parseJsonbArray(rpcEvent.tags_songs),
            description: rpcEvent.description ?? "No description.",
            booking_type: rpcEvent.booking_type,
            ticket_price: rpcEvent.ticket_price,
            pass_fee_to_user: rpcEvent.pass_fee_to_user ?? true,
            max_tickets: rpcEvent.max_tickets,
            max_reservations: rpcEvent.max_reservations,
            organizer: finalOrganizerData,
            score: rpcEvent.recommendation_score ?? 0, // Use score from RPC function
            event_datetime_iso: rpcEvent.event_datetime
        };
    }, [organizerMap]);

    // Process events whenever raw data or user profile changes
    useEffect(() => {
        console.log("[EventsScreen] Processing events for tabs...");
        if (userProfile === undefined) { 
             console.log("[EventsScreen] Waiting for user profile...");
             setIsLoading(true);
             return; 
        }
        
        // Get F&B organizer IDs to filter out their automated reservations from event tabs
        const fandBOrganizerIds = new Set(restaurants.map(r => r.userId));

        // Process "For You" tab events (from get_recommended_events_for_user RPC)
        const mappedForYouEvents = forYouEventsRaw
            .filter((event: any) => {
                // Exclude events that are reservations from F&B organizers (restaurants)
                const isAutomatedFandBReservation = fandBOrganizerIds.has(event.organizer_id) && event.booking_type === 'RESERVATION';
                return !isAutomatedFandBReservation;
            })
            .map(mapRpcEventToMappedEvent)
            .filter((event): event is MappedEvent => event !== null)
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)); // Sort by recommendation score descending
        
        setForYouEvents(mappedForYouEvents);
        console.log(`[EventsScreen] Processed ${mappedForYouEvents.length} events for "For You" tab`);

        // Process "All Events" tab events (from get_events_by_user_country RPC)
        const mappedAllEvents = allEventsRaw
            .filter((event: any) => {
                // Exclude events that are reservations from F&B organizers (restaurants)
                const isAutomatedFandBReservation = fandBOrganizerIds.has(event.organizer_id) && event.booking_type === 'RESERVATION';
                return !isAutomatedFandBReservation;
            })
            .map(mapRpcEventToMappedEvent)
            .filter((event): event is MappedEvent => event !== null)
            .sort((a, b) => 
                new Date(a.event_datetime_iso).getTime() - new Date(b.event_datetime_iso).getTime()
            ); // Sort by date ascending
        
        setAllEventsTabSource(mappedAllEvents);
        console.log(`[EventsScreen] Processed ${mappedAllEvents.length} events for "All Events" tab`);
        
        // Reset pagination for both tabs as source data changed
        setCurrentPageForYou(1);
        setAllForYouEventsLoaded(false);
        setCurrentPageAllEvents(1);
        setAllAllEventsLoaded(false);

        // --- Auto-open event modal if openEventId is present ---
        const { openEventId } = route.params || {};
        if (openEventId && (mappedAllEvents.length > 0 || mappedForYouEvents.length > 0)) {
            let eventToOpen: MappedEvent | undefined;
            // Prioritize finding it in the initially suggested tab or current active tab
            if (activeTabIndex === 1) { // All Events tab
                eventToOpen = mappedAllEvents.find(event => event.id === openEventId);
            }
            if (!eventToOpen && activeTabIndex === 0) { // For You tab
                eventToOpen = mappedForYouEvents.find(event => event.id === openEventId);
            }
            // If not found in the active tab, search the other one
            if (!eventToOpen) {
                if (activeTabIndex === 1) { // Was All Events, check For You
                     eventToOpen = mappedForYouEvents.find(event => event.id === openEventId);
                } else { // Was For You, check All Events
                     eventToOpen = mappedAllEvents.find(event => event.id === openEventId);
                }
            }
            // Fallback: Search in raw events
            if (!eventToOpen) {
                const allMapped = [...forYouEventsRaw, ...allEventsRaw]
                    .map(mapRpcEventToMappedEvent)
                    .filter((event): event is MappedEvent => event !== null);
                eventToOpen = allMapped.find(e => e.id === openEventId);
            }

            if (eventToOpen) {
                console.log(`[EventsScreen] Auto-opening event modal for: ${openEventId}`);
                setSelectedEvent(eventToOpen);
                setModalVisible(true);
                // Clear the param so it doesn't re-trigger on next focus without a new navigation action
                navigation.setParams({ openEventId: undefined, initialScreenTab: undefined } as any);
            } else {
                console.warn(`[EventsScreen] Event with ID ${openEventId} not found after fetching and processing.`);
                // Optionally clear params if event not found to prevent retries
                 navigation.setParams({ openEventId: undefined, initialScreenTab: undefined } as any);
            }
        }
        // --- End auto-open logic ---

        setIsLoading(false); 
        setRefreshing(false); 
        console.log(`[EventsScreen] Processing complete. For You: ${mappedForYouEvents.length}, All Events: ${mappedAllEvents.length}`);

    }, [forYouEventsRaw, allEventsRaw, organizerMap, userProfile, route.params, navigation, activeTabIndex, restaurants, mapRpcEventToMappedEvent]);

    // Update displayed events for "For You" tab based on pagination
    useEffect(() => {
        const endIndex = currentPageForYou * EVENTS_PER_PAGE;
        const newLoadedForYou = forYouEvents.slice(0, endIndex);
        setLoadedForYouEvents(newLoadedForYou);
        if (newLoadedForYou.length >= forYouEvents.length && forYouEvents.length > 0) {
            setAllForYouEventsLoaded(true);
        } else {
            setAllForYouEventsLoaded(false);
        }
        setIsFetchingMoreForYou(false);
    }, [forYouEvents, currentPageForYou]);

    // Update displayed events for "All Events" tab based on pagination
    useEffect(() => {
        const endIndex = currentPageAllEvents * EVENTS_PER_PAGE;
        const newLoadedAll = allEventsTabSource.slice(0, endIndex);
        setLoadedAllEvents(newLoadedAll);
        if (newLoadedAll.length >= allEventsTabSource.length && allEventsTabSource.length > 0) {
            setAllAllEventsLoaded(true);
        } else {
            setAllAllEventsLoaded(false);
        }
        setIsFetchingMoreAllEvents(false);
    }, [allEventsTabSource, currentPageAllEvents]);

    const handleLoadMoreForYou = () => {
        if (!isFetchingMoreForYou && !allForYouEventsLoaded) {
            console.log("[EventsScreen] Loading more for 'For You' tab...");
            setIsFetchingMoreForYou(true);
            setCurrentPageForYou(prevPage => prevPage + 1);
        }
    };

    const handleLoadMoreAllEvents = () => {
        if (!isFetchingMoreAllEvents && !allAllEventsLoaded) {
            console.log("[EventsScreen] Loading more for 'All Events' tab...");
            setIsFetchingMoreAllEvents(true);
            setCurrentPageAllEvents(prevPage => prevPage + 1);
        }
    };

    // Refresh handler
    const onRefresh = useCallback(() => {
        console.log("[EventsScreen] Refresh triggered.");
        setRefreshing(true);
        setCurrentPageForYou(1); 
        setAllForYouEventsLoaded(false);
        setCurrentPageAllEvents(1);
        setAllAllEventsLoaded(false);
        setIsLoading(true); // Show loading indicator during refresh fetch
        // Re-fetch profile and events
        Promise.all([fetchUserProfile(), fetchEventsAndOrganizers(), fetchRestaurants()])
            .catch(err => {
                console.error("Error during refresh:", err);
                setError("Failed to refresh data.");
            })
            // Processing useEffect will handle setting isLoading/refreshing to false
    }, [fetchUserProfile, fetchEventsAndOrganizers, fetchRestaurants]);

    // Modal control (Unchanged)
    const handleEventPress = (event: MappedEvent) => { setSelectedEvent(event); setModalVisible(true); };
    const handleCloseModal = () => { setModalVisible(false); setSelectedEvent(null); };

    // Restaurant reservation modal control
    const handleOpenReservationModal = (organizer: FandBOrganizer) => {
        setSelectedRestaurant(organizer);
        setReservationModalVisible(true);
    };
    const handleCloseReservationModal = () => {
        setReservationModalVisible(false);
        setSelectedRestaurant(null);
    };

    // Render Section Header // NO LONGER USED with FlatList per tab
    // const renderSectionHeader = ({ section: { title } }: { section: EventSection }) => ( ... );

     // Render Footer for pagination loading or end message - adaptable for FlatList
    const renderListFooter = (isFetchingMore: boolean, allLoaded: boolean, itemsExist: boolean) => {
        if (isFetchingMore) {
            return (
                <View style={styles.listFooterContainer}> 
                    <ActivityIndicator style={{ marginVertical: 20 }} size="small" color="#3B82F6" />
                </View>
            );
        }
        if (allLoaded && itemsExist) { 
            return null; // Simply return null to show nothing
        }
        return null;
    };

    const renderEmptyList = (tabKey: 'forYou' | 'allEvents') => {
        let message = "No Events Found";
        let subMessage = "Check back later for events!";

        if (tabKey === 'forYou') {
            message = "No Recommendations For You Yet";
            subMessage = userProfile?.city 
                ? `We couldn't find events matching your profile in ${userProfile.city}. Try updating your preferences or check other events!`
                : "Update your music profile to get personalized event recommendations!";
        } else if (tabKey === 'allEvents') {
            message = "No Events In Your Area";
            subMessage = userProfile?.city
                ? `We couldn't find any upcoming events in ${userProfile.city} right now.`
                : "We couldn't find any upcoming events. Set your location in your profile for local listings!";
        }
         if (isLoading) return null; // Don't show empty if still loading initially

        return (
            <View style={styles.centeredContainerEmptyList}>
                 <Feather name="coffee" size={40} color="#9CA3AF" />
                 <Text style={styles.emptyText}>{message}</Text>
                 <Text style={styles.emptySubText}>{subMessage}</Text>
             </View>
        );
    };

    const renderCustomTabBar = () => {
        return (
            <View style={styles.tabBarContainer}>
                <TouchableOpacity 
                    style={[styles.tabItem, activeTabIndex === 0 && styles.activeTabItem]}
                    onPress={() => setActiveTabIndex(0)}
                >
                    <Text style={[styles.tabText, activeTabIndex === 0 && styles.activeTabText]}>For You</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tabItem, activeTabIndex === 1 && styles.activeTabItem]}
                    onPress={() => setActiveTabIndex(1)}
                >
                    <Text style={[styles.tabText, activeTabIndex === 1 && styles.activeTabText]}>All Events</Text>
                </TouchableOpacity>
                 <TouchableOpacity 
                    style={[styles.tabItem, activeTabIndex === 2 && styles.activeTabItem]}
                    onPress={() => setActiveTabIndex(2)}
                >
                    <Text style={[styles.tabText, activeTabIndex === 2 && styles.activeTabText]}>Restaurants</Text>
                </TouchableOpacity>
            </View>
        );
    };

    // Filter restaurants based on search query
    useEffect(() => {
        if (restaurantSearchQuery.trim() === '') {
            setFilteredRestaurants(restaurants);
        } else {
            const filtered = restaurants.filter(r =>
                r.name.toLowerCase().includes(restaurantSearchQuery.trim().toLowerCase())
            );
            setFilteredRestaurants(filtered);
        }
    }, [restaurantSearchQuery, restaurants]);

    // Main render logic
    const renderMainContent = () => {
        // Initial Loading state (covers profile fetch and initial event fetch)
        if (isLoading && forYouEvents.length === 0 && allEventsTabSource.length === 0 && !error) {
             return <View style={styles.centeredContainer}><ActivityIndicator size="large" color="#3B82F6" /></View>;
        }
        
        // Error state
        if (error && !isLoading) { 
             return (
                 <View style={styles.centeredContainer}>
                     <Feather name="alert-triangle" size={40} color="#F87171" />
                     <Text style={styles.errorText}>{error}</Text>
                     <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
                         <Text style={styles.retryButtonText}>Retry</Text>
                     </TouchableOpacity>
                 </View>
             );
         }
         
        // If no error and not loading, show Tabs and content.
        // Empty states are handled by FlatList's ListEmptyComponent.
        return (
            <View style={{ flex: 1 }}>
                {renderCustomTabBar()}
                {activeTabIndex === 0 && (
                    <FlatList
                        data={loadedForYouEvents}
                        keyExtractor={(item) => `forYou-${item.id}`}
                        renderItem={({ item, index }) => {
                            const isWebLastInRow = Platform.OS === 'web' && (index + 1) % CARDS_PER_ROW_WEB === 0;
                            return (
                                <EventCard
                                    event={item}
                                    onPress={() => handleEventPress(item)}
                                />
                            );
                        }}
                        contentContainerStyle={[
                            styles.eventsList,
                            // For web, if using justifyContent: 'center', the centering is handled by eventsList directly.
                            // If there are fewer than CARDS_PER_ROW_WEB items, they will be centered together.
                            // Platform.OS === 'web' && loadedForYouEvents.length > 0 && { justifyContent: 'space-between'} // This was changed to center
                        ]}
                        style={styles.flatListContainerOnly}
                        onEndReached={handleLoadMoreForYou}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={() => renderListFooter(isFetchingMoreForYou, allForYouEventsLoaded, loadedForYouEvents.length > 0)}
                        ListEmptyComponent={() => renderEmptyList('forYou')}
                        refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3B82F6"]} /> }
                    />
                )}
                {activeTabIndex === 1 && (
                    <FlatList
                        data={loadedAllEvents}
                        keyExtractor={(item) => `allEvents-${item.id}`}
                        renderItem={({ item, index }) => {
                            const isWebLastInRow = Platform.OS === 'web' && (index + 1) % CARDS_PER_ROW_WEB === 0;
                            return (
                                <EventCard
                                    event={item}
                                    onPress={() => handleEventPress(item)}
                                />
                            );
                        }}
                        contentContainerStyle={[
                            styles.eventsList,
                            // Platform.OS === 'web' && loadedAllEvents.length > 0 && { justifyContent: 'space-between'} // This was changed to center
                        ]}
                        style={styles.flatListContainerOnly}
                        onEndReached={handleLoadMoreAllEvents}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={() => renderListFooter(isFetchingMoreAllEvents, allAllEventsLoaded, loadedAllEvents.length > 0)}
                        ListEmptyComponent={() => renderEmptyList('allEvents')}
                        refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3B82F6"]} /> }
                    />
                )}
                 {activeTabIndex === 2 && (
                    <View style={{ flex: 1 }}>
                        <View style={styles.searchBarContainer}>
                            <Feather name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search restaurants..."
                                value={restaurantSearchQuery}
                                onChangeText={setRestaurantSearchQuery}
                                placeholderTextColor="#9CA3AF"
                            />
                            {restaurantSearchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setRestaurantSearchQuery('')} style={styles.clearSearchButton}>
                                    <Feather name="x" size={20} color="#9CA3AF" />
                                </TouchableOpacity>
                            )}
                        </View>
                        <FlatList
                            data={filteredRestaurants}
                            keyExtractor={(item) => `restaurant-${item.userId}`}
                            renderItem={({ item }) => (
                                <RestaurantCard
                                    organizer={item}
                                    onPress={() => handleOpenReservationModal(item)}
                                />
                            )}
                            contentContainerStyle={styles.eventsList}
                            ListEmptyComponent={() => {
                            if (loadingRestaurants) return null;
                            return (
                                <View style={styles.centeredContainerEmptyList}>
                                    <Feather name="coffee" size={40} color="#9CA3AF" />
                                    <Text style={styles.emptyText}>{restaurantSearchQuery ? 'No Results Found' : 'No Restaurants Found'}</Text>
                                    <Text style={styles.emptySubText}>
                                        {restaurantSearchQuery ? `No restaurants match "${restaurantSearchQuery}"` : "We couldn't find any F&B partners in your area yet."}
                                    </Text>
                                </View>
                            );
                            }}
                            refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3B82F6"]} /> }
                        />
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView edges={["top"]} style={styles.container}>
            <View style={styles.rootContainer}>
                <View style={styles.header}>
                  <View style={styles.headerTitleRow}>
                    <View style={styles.titleContainer}>
                      <Feather name="calendar" size={22} color="#60A5FA" style={styles.headerIcon} />
                      <Text style={styles.title}>Events</Text>
                    </View>
                  </View>
                  <Text style={styles.subtitle}>Discover concerts and music events</Text>
                </View>
                <View style={{flex: 1}}> 
                    {renderMainContent()}
                </View>
            </View>
            <EventDetailModal
                event={selectedEvent}
                visible={modalVisible}
                onClose={handleCloseModal}
                navigation={navigation}
            />
            <ReservationModal
                visible={reservationModalVisible}
                onClose={handleCloseReservationModal}
                organizer={selectedRestaurant}
                navigation={navigation}
            />
        </SafeAreaView>
    );
};

// --- Styles --- (Add sectionHeader, endListText styles)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f8fafc", },
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f8fafc', },
    centeredContainerEmptyList: { // For FlatList's ListEmptyComponent
        flex: 1, // Takes up available space in FlatList
        justifyContent: 'center', 
        alignItems: 'center', 
        paddingHorizontal: 20, // Changed from padding
        paddingVertical: 20, // Changed from padding
        marginTop: Dimensions.get('window').height * 0.1 // Push down a bit
    },
    errorText: { fontSize: 16, fontWeight: '600', color: '#DC2626', marginTop: 10, textAlign: 'center', },
    retryButton: { backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginTop: 15, },
    retryButtonText: { color: '#FFF', fontWeight: '600', },
    emptyText: { fontSize: 18, fontWeight: '600', color: '#4B5563', marginTop: 10, },
    emptySubText: { fontSize: 14, color: '#6B7280', marginTop: 5, textAlign: 'center', },
    rootContainer: { flex: 1, },
    flatListContainer: { flex: 1, }, // Original style, might not be needed if tabs have own lists
    flatListContainerOnly: { flex: 1 }, // Specific for FlatList inside TabView scene
    header: { paddingTop: 16, paddingBottom: 0, paddingHorizontal: 0, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: '#E5E7EB', },
    headerTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 8 },
    titleContainer: { flexDirection: "row", alignItems: "center", },
    headerIcon: { marginRight: 8, },
    title: { fontSize: 22, fontWeight: "bold", color: "#3B82F6", },
    subtitle: { fontSize: 14, color: "#6B7280", marginTop: 0, paddingHorizontal: 16, paddingBottom: 12 },
    eventsList: { 
        paddingHorizontal: 16, 
        paddingTop: 16, 
        paddingBottom: 80, 
        flexGrow: 1, // Allow content to grow and push footer
        ...(Platform.OS === 'web' ? { 
            flexDirection: 'row', 
            flexWrap: 'wrap', 
            justifyContent: 'center', // Center rows of cards
        } : {})
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
        ...(Platform.OS === 'web' ? {} : { width: '100%' }) // Ensure full width on mobile if not web
    },
    eventCardWeb: {
        width: (Dimensions.get('window').width - 16 * 2 - CARD_MARGIN_WEB * (CARDS_PER_ROW_WEB -1) ) / CARDS_PER_ROW_WEB,
        // marginRight: CARD_MARGIN_WEB, // Remove this
        marginHorizontal: CARD_MARGIN_WEB / 2, // Add horizontal margin for spacing when centered
        marginBottom: CARD_MARGIN_WEB, // Keep bottom margin for rows
        // Remove last item's right margin via nth-child if possible, or handle in FlatList renderItem logic if needed.
        // For simplicity, all cards have right margin, last one might push container if not careful or if parent has fixed width.
        // With justifyContent: 'flex-start' on eventsList, this should be okay.
    },
    imageContainer: { position: "relative", },
    eventImage: { width: "100%", backgroundColor: '#F3F4F6', }, // Removed aspectRatio
    restaurantCard: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    restaurantImage: {
        width: 80,
        height: 80,
        borderRadius: 10,
        marginRight: 16,
        backgroundColor: '#F3F4F6',
    },
    restaurantCapacity: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 8,
        marginTop: 4,
    },
    // Define eventImageStyle FIRST
    eventImageStyle: {
        // height is now dynamic, based on 1:1 aspect ratio of calculated width
        // width will also be set dynamically
        backgroundColor: '#F3F4F6', // Keep placeholder color
        // overflow: 'hidden', // Removed scroll, Image components don't scroll content
    },
    // Add styles for ImageSwiper in the card context
    eventImageContainer: {
        width: "100%", // Swiper takes full width of its parent (the card image area)
        // aspectRatio: 1 / 1, // Enforce 1:1 aspect ratio for the container
        borderTopLeftRadius: 12, // Match card radius
        borderTopRightRadius: 12,
        backgroundColor: '#F3F4F6',
        overflow: 'hidden', // Ensure images inside conform
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
    modalContainer: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.6)", justifyContent: "flex-end", alignItems: Platform.OS === 'web' ? 'center' : 'stretch' }, // Center modal on web
    modalContent: { 
        backgroundColor: "white", 
        borderTopLeftRadius: Platform.OS === 'web' ? 12 : 24, // Adjust radius for web if centered
        borderTopRightRadius: Platform.OS === 'web' ? 12 : 24,
        height: Platform.OS === 'web' ? "90%" : "90%", // Can adjust height for web too if needed
        overflow: Platform.OS === 'web' ? "hidden" : "visible", // Only hide overflow on web to allow mobile scrolling
        ...(Platform.OS === 'web' ? {
            width: '90%', // Take 90% of parent (modalContainer which is centered)
            maxWidth: 700, // Max width for web modal content
            maxHeight: Dimensions.get('window').height * 0.9, // Max height relative to viewport height
            borderRadius: 12, // Apply border radius to all corners on web
            boxShadow: '0 5px 15px rgba(0,0,0,0.3)', // Add shadow for web
        } : {
            // Mobile-specific styles for better scrolling
            width: '100%',
            maxHeight: Dimensions.get('window').height * 0.9,
        })
    },
    closeButton: { position: "absolute", top: Platform.OS === 'web' ? 15 : 20, left: Platform.OS === 'web' ? 15 : 16, zIndex: 10, backgroundColor: "rgba(230, 230, 230, 0.8)", borderRadius: 50, padding: 8, },
    imageSwiperContainer: {
        position: 'relative',
        width: '100%', // Take full width of its parent (modalContent)
        // height will be set dynamically in the component
        backgroundColor: '#F3F4F6',
    },
    modalImage: { 
        // width: "100%", // Will be set dynamically
        // height: 250, // Will be set dynamically
        backgroundColor: '#F3F4F6', 
        // overflow: 'hidden', // Removed scroll, Image components don't scroll content
    },
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
    modalBody: { 
        padding: 20, 
        paddingBottom: Platform.OS === 'web' ? 40 : 60, // Extra bottom padding on mobile for better UX
    },
    modalHeader: { padding: 20, paddingBottom: 0, alignItems: 'center' },
    restaurantName: { fontSize: 18, fontWeight: '600', color: '#4B5563', marginTop: 4 },
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
    disabledButton: { backgroundColor: '#9CA3AF' }, // Assuming this might be used by modal
    infoOnlyBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, marginTop: 24, marginBottom: 24 },
    infoOnlyText: { marginLeft: 8, fontSize: 14, color: '#4B5563', flexShrink: 1 },
    endListText: {
        textAlign: 'center',
        color: '#9CA3AF',
        paddingVertical: 20,
        fontSize: 14,
    },
    tabBarContainer: {
        flexDirection: 'row',
        height: 50,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: 'white',
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 2, // for the active indicator line
    },
    activeTabItem: {
        borderBottomWidth: 3,
        borderBottomColor: APP_CONSTANTS.COLORS.PRIMARY || '#3B82F6',
    },
    tabText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '600',
    },
    activeTabText: {
        color: APP_CONSTANTS.COLORS.PRIMARY || '#3B82F6',
    },
    shareButton: { // Style for the new share button
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        marginTop: 10, // Adjusted from 24 to give space if book now button is present
        marginBottom: 10, // Adjusted from 24
        backgroundColor: '#E0E7FF', // Lighter blue or a distinct color
    },
    shareButtonText: { // Style for the share button text
        color: '#3B82F6', // Primary color
        fontWeight: '600',
        fontSize: 16,
        marginLeft: 8,
    },
    shareModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    shareModalContent: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        width: '80%',
        maxWidth: 400,
    },
    shareModalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 16,
        textAlign: 'center',
    },
    shareOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    shareOptionText: {
        fontSize: 16,
        marginLeft: 12,
        color: '#4B5563',
    },
    cancelShareOption: {
        justifyContent: 'center',
        borderBottomWidth: 0,
        marginTop: 8,
    },
    cancelShareText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: '500',
    },
    listFooterContainer: {
        width: '100%', // Ensure it takes full width of the FlatList
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20, // Add some padding if needed
    },
    errorTextModal: { color: APP_CONSTANTS.COLORS.ERROR, marginBottom: 16, textAlign: 'center', fontSize: 14, marginTop: 10 },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 10,
        paddingHorizontal: 12,
        marginHorizontal: 16,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        height: 44,
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
    clearSearchButton: {
        padding: 4,
    },
    datePickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F3F4F6',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      marginBottom: 16,
    },
    datePickerButtonText: {
      marginLeft: 10,
      fontSize: 16,
      color: '#3B82F6',
    },
    timeSlotsContainer: {
        paddingVertical: 10,
    },
    timeSlot: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        marginHorizontal: 4,
    },
    timeSlotSelected: {
        backgroundColor: '#3B82F61A',
        borderColor: '#3B82F6',
    },
    timeSlotText: {
        color: '#3B82F6',
        fontWeight: '600',
    },
    timeSlotTextSelected: {
        color: '#3B82F6',
    },
    noSlotsText: {
        color: '#6B7280',
        fontStyle: 'italic',
        paddingHorizontal: 10,
    },
    calendarStyle: {
      marginBottom: 10,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 10,
    },
});

// Function to calculate recommendation score
const calculateEventScore = (event: MappedEvent, userProfile: MusicLoverProfileData | null): number => {
    if (!userProfile) return 0;
    let score = 0;

    // --- Prepare User Preference Sets (mirroring SQL logic for current user) ---
    
    // 1. User Artists
    const userArtists = new Set<string>();
    // From favorite_artists (CSV)
    (userProfile.favorite_artists ?? []).forEach(a => {
        if (typeof a === 'string') a.split(',').forEach(subA => userArtists.add(subA.trim().toLowerCase()));
    });
    // From top_artists (JSON array of objects with name)
    (userProfile.top_artists ?? []).forEach(a => {
        if (typeof a === 'string') userArtists.add(a.toLowerCase()); // Assuming top_artists is already just names from previous processing
        // If top_artists were raw JSON like [{name: "Artist"}], it would need: if (typeof a === 'object' && a.name) userArtists.add(a.name.toLowerCase());
    });
    // Artists from top_tracks (complex extraction, assuming top_tracks are track names and userProfile.top_artists contains artists from tracks)
    // The SQL function `extract_artist_names_from_tracks_json_array` is complex.
    // For client-side, if `userProfile.top_artists` already includes artists from tracks (as it should from `useStreamingData` hook if Spotify-like data), we rely on that.
    // If not, this part would need a client-side equivalent of `extract_artist_names_from_tracks_json_array` if `top_tracks` raw data was available here.

    // 2. User Songs/Tracks
    const userSongs = new Set<string>();
    // From favorite_songs (CSV)
    (userProfile.favorite_songs ?? []).forEach(s => {
        if (typeof s === 'string') s.split(',').forEach(subS => userSongs.add(subS.trim().toLowerCase()));
    });
    // From top_tracks (JSON array of names)
    (userProfile.top_tracks ?? []).forEach(s => {
        if (typeof s === 'string') userSongs.add(s.toLowerCase());
    });

    // 3. User Genres
    const userGenres = new Set<string>();
    // From music_data.genres (JSON array of strings)
    (userProfile.music_data?.genres ?? []).forEach(g => {
        if (typeof g === 'string') userGenres.add(g.toLowerCase());
    });
    // From top_genres (JSON array of names)
    (userProfile.top_genres ?? []).forEach(g => {
        if (typeof g === 'string') userGenres.add(g.toLowerCase());
    });

    // Add items from bio to respective sets (musicTaste to genres, dreamConcert to artists, goToSong to songs)
    if (userProfile.bio) {
        (userProfile.bio.musicTaste ?? '').toLowerCase().split(/,| and | with |\s+/).forEach(g => {
            const trimmed = g.trim();
            if (trimmed) userGenres.add(trimmed);
        });
        (userProfile.bio.dreamConcert ?? '').toLowerCase().split(/,| and | with /).forEach(a => {
            const trimmed = a.trim();
            if (trimmed) userArtists.add(trimmed);
        });
        const goToSong = userProfile.bio.goToSong?.trim().toLowerCase();
        if (goToSong) userSongs.add(goToSong);
    }

    // --- Keyword extraction from remaining bio fields and favorite_albums ---
    const bioKeywords = new Set<string>();
    if (userProfile.bio) {
        // Add other bio fields (firstSong, mustListenAlbum) to keywords
        const otherBioFields: (keyof MusicLoverBio)[] = ['firstSong', 'mustListenAlbum'];
        otherBioFields.forEach(key => {
            const value = userProfile.bio![key];
            if (typeof value === 'string') {
                value.toLowerCase().split(/\s+|,|\(|\)|-|\//).forEach(word => {
                    const trimmed = word.trim().replace(/[^a-z0-9\-]/g, '');
                    if (trimmed && trimmed.length > 2) bioKeywords.add(trimmed);
                });
            }
        });
    }
    (userProfile.favorite_albums ?? []).forEach(album => {
        if (typeof album === 'string') {
            album.toLowerCase().split(/\s+|,|\(|\)|-|\//).forEach(word => {
                const trimmed = word.trim().replace(/[^a-z0-9\-]/g, '');
                if (trimmed && trimmed.length > 2) bioKeywords.add(trimmed);
            });
        }
    });

    // Add all collected artists, genres, songs to bioKeywords for broader text matching against event title/desc
    userArtists.forEach(a => bioKeywords.add(a)); // Already lowercase
    userGenres.forEach(g => bioKeywords.add(g));  // Already lowercase
    userSongs.forEach(s => s.split(/\s+/).forEach(word => bioKeywords.add(word.replace(/[^a-z0-9\-]/g, '')))); // song titles as keywords


    // --- Score Event Based on Matches (using the sets prepared above) ---
    // Match Artists
    (event.artists ?? []).forEach(eventArtist => {
        if (userArtists.has(eventArtist.toLowerCase())) {
            score += SCORE_WEIGHTS.ARTIST_MATCH;
        }
    });

    // Match Genres
    (event.genres ?? []).forEach(eventGenre => {
        const lowerGenre = eventGenre.toLowerCase();
        if (userGenres.has(lowerGenre)) {
            score += SCORE_WEIGHTS.GENRE_MATCH;
        }
        // Also check if genre name is in general bio keywords (e.g. user mentioned "rock concert" in bio text)
        if (bioKeywords.has(lowerGenre)) {
            score += SCORE_WEIGHTS.BIO_TASTE_MATCH * 0.5; // Lesser weight than direct genre match
        }
    });

    // Match Songs
    (event.songs ?? []).forEach(eventSong => {
        if (userSongs.has(eventSong.toLowerCase())) {
            score += SCORE_WEIGHTS.SONG_MATCH;
        }
    });

    // Match keywords from event title/desc with user bio keywords (includes bio text, album keywords, and all preferred artists/genres/songs)
    const eventText = `${event.title.toLowerCase()} ${event.description.toLowerCase()}`;
    bioKeywords.forEach(keyword => {
        if (keyword.length > 2 && eventText.includes(keyword)) { // Ensure keyword is not too short
             score += SCORE_WEIGHTS.BIO_TASTE_MATCH * 0.2; 
        }
    });

    return score;
};

// --- Restaurant Reservation Modal ---
interface ReservationModalProps {
  visible: boolean;
  onClose: () => void;
  organizer: FandBOrganizer | null;
  navigation: NavigationProp;
}

const ReservationModal: React.FC<ReservationModalProps> = ({ visible, onClose, organizer, navigation }) => {
    if (!organizer) return null; // <-- ADD THIS GUARD CLAUSE

    const [reservationDate, setReservationDate] = useState(new Date());
    const [timeSlots, setTimeSlots] = useState<string[]>([]);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [isConfirming, setIsConfirming] = useState(false);
    const [error, setError] = useState('');

    const generateTimeSlots = (date: Date, hours: any): string[] => {
        if (!hours) return [];

        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
        const dayHours = hours[dayOfWeek] as { open: string, close: string }[] | undefined;

        if (!dayHours || dayHours.length === 0) return [];

        const slots: string[] = [];
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        dayHours.forEach(slot => {
            const [openHour, openMinute] = slot.open.split(':').map(Number);
            const [closeHour, closeMinute] = slot.close.split(':').map(Number);

            let currentTime = new Date(date);
            currentTime.setHours(openHour, openMinute, 0, 0);

            let endTime = new Date(date);
            endTime.setHours(closeHour, closeMinute, 0, 0);

            while (currentTime < endTime) {
                if (!isToday || currentTime > now) {
                    slots.push(currentTime.toTimeString().substring(0, 5));
                }
                currentTime.setMinutes(currentTime.getMinutes() + 30);
            }
        });

        return slots;
    };
    
    // --- NEW: Add max date and unavailable dates logic ---
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of day
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 28); // 4 weeks from now

    useEffect(() => {
        if (visible && organizer) {
            // Default to tomorrow if today has passed typical hours
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);

            setReservationDate(tomorrow);
            setQuantity(2);
            setError('');
            setIsConfirming(false);
            setSelectedTime(null);

            const initialSlots = generateTimeSlots(tomorrow, organizer.opening_hours);
            setTimeSlots(initialSlots);
        }
    }, [visible, organizer]);

    // --- NEW: Calendar onDayPress handler (Timezone-safe) ---
    const onDayPress = useCallback((day: DateData) => {
        // The 'day' object from react-native-calendars gives year, month (1-based), and day.
        // Creating a new Date object this way ensures it's interpreted in the user's local timezone.
        const { year, month, day: dayOfMonth } = day;
        const newDate = new Date(year, month - 1, dayOfMonth);

        setReservationDate(newDate);
        setSelectedTime(null); // Reset time when date changes
        const newSlots = generateTimeSlots(newDate, organizer.opening_hours);
        setTimeSlots(newSlots);
    }, [organizer.opening_hours]);

    // --- NEW: Memoized marked dates for the calendar ---
    const markedDates = useMemo(() => {
        const marked: { [key: string]: any } = {};

        // Mark all unavailable dates as disabled
        organizer.unavailable_dates?.forEach(dateString => {
            marked[dateString] = { disabled: true, disableTouchEvent: true };
        });

        // Highlight the currently selected date (Timezone-safe)
        const selectedDateString = toYYYYMMDD(reservationDate);
        marked[selectedDateString] = {
            ...(marked[selectedDateString] || {}), // Keep disabled property if it exists
            selected: true,
            selectedColor: APP_CONSTANTS.COLORS.PRIMARY
        };

        return marked;
    }, [organizer.unavailable_dates, reservationDate]);


    const incrementQuantity = () => setQuantity(q => q + 1);
    const decrementQuantity = () => setQuantity(q => Math.max(1, q - 1));

    const getOrCreateDailyReservationEvent = async (org: FandBOrganizer, date: Date): Promise<MappedEvent | null> => {
        console.log(`[Reservation] Calling RPC for event for ${org.name} on ${date.toISOString()}`);
        try {
            const { data, error } = await supabase.rpc('get_or_create_daily_reservation_event', {
                p_organizer_id: org.userId,
                p_date: date.toISOString(),
                p_capacity: org.capacity,
                p_organizer_name: org.name,
                p_organizer_image: org.image,
            });

            if (error) throw error;
            
            // The RPC returns a single JSON object which is the event row.
            const eventData = data;
            if (!eventData) throw new Error("RPC returned no event data.");

            console.log('[Reservation] Received event from RPC:', eventData.id);
            
            const { date: formattedDate, time } = formatEventDateTime(eventData.event_datetime);
            return {
                // Map the returned eventData to MappedEvent
                id: eventData.id,
                title: eventData.title,
                images: eventData.poster_urls ?? [],
                date: formattedDate,
                time: time,
                venue: eventData.location_text ?? org.name,
                genres: eventData.tags_genres ?? [],
                artists: eventData.tags_artists ?? [],
                songs: eventData.tags_songs ?? [],
                description: eventData.description ?? `Reservations for ${org.name}`,
                booking_type: eventData.booking_type,
                ticket_price: eventData.ticket_price,
                pass_fee_to_user: eventData.pass_fee_to_user ?? false,
                max_tickets: eventData.max_tickets,
                max_reservations: eventData.max_reservations,
                organizer: { userId: org.userId, name: org.name, image: org.image },
                event_datetime_iso: eventData.event_datetime,
                country: eventData.country,
                city: eventData.city,
            };

        } catch (e: any) {
            if (e?.code === 'PGRST202') { // Specific check for "Not Found"
                console.error('[Reservation] FATAL: The required database function `get_or_create_daily_reservation_event` is missing.', e);
                setError('A critical backend function is missing. Please contact support and mention code DBF-404.');
            } else {
                console.error('[Reservation] Error in getOrCreateDailyReservationEvent RPC call:', e);
                setError('Could not prepare reservation. Please check your connection and try again.');
            }
            return null;
        }
    };

    const handleConfirmReservation = async () => {
        if (!organizer || !selectedTime) return;
        
        setIsConfirming(true);
        setError('');

        try {
            const finalDateTime = new Date(reservationDate);
            const [hour, minute] = selectedTime.split(':').map(Number);
            finalDateTime.setHours(hour, minute, 0, 0);

            // Step 1: Get or create the daily reservation event
            const event = await getOrCreateDailyReservationEvent(organizer, finalDateTime);

            if (!event) {
                // Error is already set within the helper function
                setIsConfirming(false);
                return;
            }

            // Step 2: Check current bookings against capacity
            const { data: bookings, error: bookingsError } = await supabase
                .from('event_bookings')
                .select('quantity')
                .eq('event_id', event.id);

            if (bookingsError) {
                throw new Error(`Could not verify current bookings: ${bookingsError.message}`);
            }

            const currentBookings = bookings?.reduce((sum, booking) => sum + booking.quantity, 0) ?? 0;

            // Step 3: Validate capacity
            if (currentBookings + quantity > (organizer.capacity || 0)) {
                Alert.alert(
                    "Capacity Exceeded",
                    `Sorry, there are only ${Math.max(0, organizer.capacity - currentBookings)} spots remaining.`
                );
                setIsConfirming(false);
                return;
            }
            
            // Step 4: Proceed to confirmation if capacity is fine
            navigation.navigate('BookingConfirmation' as any, {
                eventId: event.id,
                eventTitle: event.title,
                quantity: quantity,
                pricePerItemDisplay: "Free",
                totalPriceDisplay: formatPriceWithCurrency(0, event.country ? getCurrencyForCountry(event.country) : 'USD'),
                bookingType: 'RESERVATION',
                rawPricePerItem: 0,
                rawTotalPrice: 0,
                rawFeePaid: 0,
                maxTickets: null,
                maxReservations: event.max_reservations,
                eventCurrency: event.country ? getCurrencyForCountry(event.country) : 'USD', // Pass event currency
                eventCountry: event.country, // Pass event country
            } as any);
            onClose();

        } catch (e: any) {
            console.error('[Reservation] Error during confirmation process:', e);
            setError(e.message || 'An unexpected error occurred.');
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}><Feather name="x" size={24} color="#6B7280" /></TouchableOpacity>
                    <ScrollView>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Make a Reservation</Text>
                            <Text style={styles.restaurantName}>{organizer.name}</Text>
                        </View>
                        <View style={styles.modalBody}>
                            <Text style={styles.sectionTitle}>Select Date</Text>
                            <Calendar
                                current={toYYYYMMDD(reservationDate)}
                                minDate={toYYYYMMDD(today)}
                                maxDate={toYYYYMMDD(maxDate)}
                                onDayPress={onDayPress}
                                markedDates={markedDates}
                                theme={{
                                    selectedDayBackgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
                                    selectedDayTextColor: '#ffffff',
                                    todayTextColor: APP_CONSTANTS.COLORS.PRIMARY,
                                    arrowColor: APP_CONSTANTS.COLORS.PRIMARY,
                                    disabledArrowColor: '#d9e1e8',
                                    monthTextColor: '#1F2937',
                                    textSectionTitleColor: '#6B7280',
                                    dayTextColor: '#1F2937',
                                    textDisabledColor: '#D1D5DB',
                                }}
                                hideExtraDays={true}
                                style={styles.calendarStyle}
                            />
                            <View style={styles.divider} />

                            <Text style={styles.sectionTitle}>Select a Time</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeSlotsContainer}>
                                {timeSlots.length > 0 ? (
                                    timeSlots.map((time: string) => (
                                        <TouchableOpacity
                                            key={time}
                                            style={[styles.timeSlot, selectedTime === time && styles.timeSlotSelected]}
                                            onPress={() => setSelectedTime(time)}
                                        >
                                            <Text style={[styles.timeSlotText, selectedTime === time && styles.timeSlotTextSelected]}>{time}</Text>
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <Text style={styles.noSlotsText}>No available times for this date.</Text>
                                )}
                            </ScrollView>
                            <View style={styles.divider} />

                            <Text style={styles.sectionTitle}>Number of Guests</Text>
                            <View style={styles.quantitySelector}>
                                <Text style={styles.quantityLabel}>{`${quantity} guest${quantity > 1 ? 's' : ''}`}</Text>
                                <View style={styles.quantityControls}>
                                    <TouchableOpacity onPress={decrementQuantity} style={styles.quantityButton} disabled={quantity <= 1}><Feather name="minus" size={20} color={quantity <= 1 ? "#9CA3AF" : "#3B82F6"} /></TouchableOpacity>
                                    <Text style={styles.quantityValue}>{quantity}</Text>
                                    <TouchableOpacity onPress={incrementQuantity} style={styles.quantityButton}><Feather name="plus" size={20} color={"#3B82F6"} /></TouchableOpacity>
                                </View>
                            </View>

                            {error ? <Text style={styles.errorTextModal}>{error}</Text> : null}

                            <TouchableOpacity
                                style={[styles.bookNowButton, (isConfirming || !selectedTime) && styles.disabledButton]}
                                onPress={handleConfirmReservation}
                                disabled={isConfirming || !selectedTime}
                            >
                                {isConfirming ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Feather name="bookmark" size={18} color="#fff" />
                                        <Text style={styles.bookNowButtonText}>Confirm Reservation</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};
// --- End Restaurant Reservation Modal ---

export default EventsScreen;