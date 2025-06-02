import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ScrollView, Modal,
  Dimensions, ActivityIndicator, RefreshControl, Alert, GestureResponderEvent,
  Platform, 
  Share, // Added Share API
  // SectionList // No longer used
} from "react-native";
// import { TabView, SceneMap, TabBar } from 'react-native-tab-view'; // Removed
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

        navigation.navigate('BookingConfirmation' as any, {
            eventId: event.id, eventTitle: event.title, quantity: quantity,
            pricePerItemDisplay: pricePerItemDisplay, totalPriceDisplay: totalPriceDisplay,
            bookingType: event.booking_type, // Pass validated type
            rawPricePerItem: rawPricePerItemValue, rawTotalPrice: rawTotalPriceValue,
            rawFeePaid: rawFeePaidValue, maxTickets: event.max_tickets,
            maxReservations: event.max_reservations,
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
              <ScrollView showsVerticalScrollIndicator={false}>
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
                      ? formatDisplayPricePerItem(basePrice, event.pass_fee_to_user)
                      : event.booking_type === 'RESERVATION' ? "Reservation" : "";
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
            navigation.navigate('BookingConfirmation' as any, {
                eventId: event.id, eventTitle: event.title, quantity: 1,
                pricePerItemDisplay: pricePerItemDisplayCard, totalPriceDisplay: totalPriceDisplayCard,
                bookingType: event.booking_type, // Pass validated type
                rawPricePerItem: rawPricePerItemValueCard, rawTotalPrice: rawTotalPriceValueCard,
                rawFeePaid: rawFeePaidValueCard, maxTickets: event.max_tickets,
                maxReservations: event.max_reservations,
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
    const [organizerMap, setOrganizerMap] = useState<Map<string, OrganizerInfo>>(new Map());
    
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
    const [refreshing, setRefreshing] = useState(false);
    const navigation = useNavigation<NavigationProp>();

    // TabView state // Replaced with manual tab state
    const [activeTabIndex, setActiveTabIndex] = useState(0); // 0 for 'For You', 1 for 'All Events'

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

    // Fetch ALL upcoming events and organizers (Modified)
    const fetchEventsAndOrganizers = useCallback(async () => {
        console.log("[EventsScreen] Fetching ALL events and organizers...");
        if (!refreshing) setIsLoading(true); // Set loading only if not refreshing
        setError(null);

        try {
            // 1. Fetch all Events (upcoming and past initially, filtering happens later)
            const { data: eventData, error: eventsError } = await supabase
                .from("events")
                .select(`
                    id, title, description, event_datetime, location_text, poster_urls,
                    tags_genres, tags_artists, tags_songs, organizer_id,
                    event_type, booking_type, ticket_price, pass_fee_to_user,
                    max_tickets, max_reservations, country, city 
                `)
                 // No date filter here - fetch all initially
                .order("event_datetime", { ascending: true }); // Fetch oldest first

            if (eventsError) throw eventsError;
            setRawEvents(eventData || []);

            // 2. Fetch Organizers (only for events fetched)
            // Fix Set iteration for older targets if needed
            const organizerIds = Array.from(new Set((eventData || []).map(event => event.organizer_id).filter(id => !!id)));
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

        } catch (err: any) {
            console.error("[EventsScreen] Fetch Events/Organizers Error:", err);
            setError(`Failed to fetch events. Please try again.`);
            setRawEvents([]);
            setOrganizerMap(new Map());
        } 
        // Loading state is handled after processing in useEffect
    }, [refreshing]);

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

        Promise.all([fetchUserProfile(), fetchEventsAndOrganizers()])
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
    }, [fetchUserProfile, fetchEventsAndOrganizers, route.params]));

    // Process events whenever raw data or user profile changes
    useEffect(() => {
        console.log("[EventsScreen] Processing events for tabs...");
        if (!rawEvents || userProfile === undefined) { 
             console.log("[EventsScreen] Waiting for raw events or user profile fetch status...");
             setIsLoading(true); // Keep loading true if critical data is missing
             return; 
        }
        
        const now = new Date();
        const mappedEventsWithScores: MappedEvent[] = rawEvents
            .map((event: SupabasePublicEvent) => { // Map first, then filter by date
                const { date, time } = formatEventDateTime(event.event_datetime);
                const organizerInfo = organizerMap.get(event.organizer_id);
                const finalOrganizerData: OrganizerInfo = organizerInfo || {
                    userId: event.organizer_id,
                    name: DEFAULT_ORGANIZER_NAME,
                    image: null
                };
                const eventForScoring = {
                    ...event,
                    organizer: finalOrganizerData, 
                    images: event.poster_urls ?? [],
                    date: date, 
                    time: time,
                    venue: event.location_text ?? 'N/A',
                    description: event.description ?? '',
                    genres: event.tags_genres ?? [], 
                    artists: event.tags_artists ?? [], 
                    songs: event.tags_songs ?? [],
                    pass_fee_to_user: event.pass_fee_to_user ?? true, 
                    event_datetime_iso: event.event_datetime // Added missing property
                }
                const score = calculateEventScore(eventForScoring as MappedEvent, userProfile);
                
                return {
                    id: event.id, title: event.title,
                    images: event.poster_urls?.length > 0 ? event.poster_urls : [DEFAULT_EVENT_IMAGE],
                    date: date, time: time,
                    venue: event.location_text ?? "N/A",
                    country: event.country,
                    city: event.city,
                    genres: event.tags_genres ?? [], artists: event.tags_artists ?? [], songs: event.tags_songs ?? [],
                    description: event.description ?? "No description.",
                    booking_type: event.booking_type,
                    ticket_price: event.ticket_price,
                    pass_fee_to_user: event.pass_fee_to_user ?? true,
                    max_tickets: event.max_tickets,
                    max_reservations: event.max_reservations,
                    organizer: finalOrganizerData,
                    score: score,
                    event_datetime_iso: event.event_datetime 
                };
            })
            .filter(event => new Date(event.event_datetime_iso) > now); // Filter for upcoming events AFTER mapping

        // Filter by location
        let locationFilteredEvents = mappedEventsWithScores;
        if (userProfile?.country && userProfile.city) {
            console.log(`[EventsScreen] Filtering for Country: ${userProfile.country}, City: ${userProfile.city}`);
            locationFilteredEvents = mappedEventsWithScores.filter(event => 
                event.country === userProfile.country && event.city === userProfile.city
            );
            console.log(`[EventsScreen] Found ${locationFilteredEvents.length} events in user's location after scoring.`);
        } else {
            console.log("[EventsScreen] User location not available, showing all upcoming events globally (if any).");
        }

        // Populate "For You" tab data
        const recommended = locationFilteredEvents
            .filter(event => event.score && event.score > 0)
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)); 
        setForYouEvents(recommended);

        // Populate "All Events" tab data (all in location, sorted by date)
        // If no location, it shows all global upcoming events sorted by date
        const allInLocationSortedByDate = [...locationFilteredEvents].sort((a, b) => 
            new Date(a.event_datetime_iso).getTime() - new Date(b.event_datetime_iso).getTime()
        );
        setAllEventsTabSource(allInLocationSortedByDate);
        
        // Reset pagination for both tabs as source data changed
        setCurrentPageForYou(1);
        setAllForYouEventsLoaded(false);
        setCurrentPageAllEvents(1);
        setAllAllEventsLoaded(false);

        // --- Auto-open event modal if openEventId is present ---
        const { openEventId } = route.params || {};
        if (openEventId && (allInLocationSortedByDate.length > 0 || recommended.length > 0)) {
            let eventToOpen: MappedEvent | undefined;
            // Prioritize finding it in the initially suggested tab or current active tab
            if (activeTabIndex === 1) { // All Events tab
                eventToOpen = allInLocationSortedByDate.find(event => event.id === openEventId);
            }
            if (!eventToOpen && activeTabIndex === 0) { // For You tab
                eventToOpen = recommended.find(event => event.id === openEventId);
            }
            // If not found in the active tab, search the other one
            if (!eventToOpen) {
                if (activeTabIndex === 1) { // Was All Events, check For You
                     eventToOpen = recommended.find(event => event.id === openEventId);
                } else { // Was For You, check All Events
                     eventToOpen = allInLocationSortedByDate.find(event => event.id === openEventId);
                }
            }
            // Fallback: If still not found, search all raw mapped events (before tab-specific sorting/filtering)
            if (!eventToOpen) {
                 const allMapped = rawEvents.map((event: SupabasePublicEvent) => { 
                    const { date, time } = formatEventDateTime(event.event_datetime);
                    const organizerInfo = organizerMap.get(event.organizer_id);
                    const finalOrganizerData: OrganizerInfo = organizerInfo || {
                        userId: event.organizer_id,
                        name: DEFAULT_ORGANIZER_NAME,
                        image: null
                    };
                    return {
                        id: event.id, title: event.title,
                        images: event.poster_urls?.length > 0 ? event.poster_urls : [DEFAULT_EVENT_IMAGE],
                        date: date, time: time,
                        venue: event.location_text ?? "N/A",
                        country: event.country, city: event.city,
                        genres: event.tags_genres ?? [], artists: event.tags_artists ?? [], songs: event.tags_songs ?? [],
                        description: event.description ?? "No description.",
                        booking_type: event.booking_type,
                        ticket_price: event.ticket_price,
                        pass_fee_to_user: event.pass_fee_to_user ?? true,
                        max_tickets: event.max_tickets, max_reservations: event.max_reservations,
                        organizer: finalOrganizerData,
                        score: 0, // Score might not be relevant here if just opening
                        event_datetime_iso: event.event_datetime 
                    };
                }).filter(event => new Date(event.event_datetime_iso) > now);
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
        console.log(`[EventsScreen] Processing complete. For You (source): ${recommended.length}, All Events (source): ${allInLocationSortedByDate.length}`);

    }, [rawEvents, organizerMap, userProfile, route.params, navigation, activeTabIndex]); // Added route.params, navigation, activeTabIndex

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
        Promise.all([fetchUserProfile(), fetchEventsAndOrganizers()])
            .catch(err => {
                console.error("Error during refresh:", err);
                setError("Failed to refresh data.");
            })
            // Processing useEffect will handle setting isLoading/refreshing to false
    }, [fetchUserProfile, fetchEventsAndOrganizers]);

    // Modal control (Unchanged)
    const handleEventPress = (event: MappedEvent) => { setSelectedEvent(event); setModalVisible(true); };
    const handleCloseModal = () => { setModalVisible(false); setSelectedEvent(null); };

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
                    <Text style={[styles.tabText, activeTabIndex === 0 && styles.activeTabText]}>Events For You</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tabItem, activeTabIndex === 1 && styles.activeTabItem]}
                    onPress={() => setActiveTabIndex(1)}
                >
                    <Text style={[styles.tabText, activeTabIndex === 1 && styles.activeTabText]}>All Events</Text>
                </TouchableOpacity>
            </View>
        );
    };

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
                {/* Wrap renderMainContent in a View that can have a RefreshControl if TabView itself doesn't support it well */}
                 <View style={{flex: 1}}> 
                    {/* It's often better to put RefreshControl on individual lists within tabs 
                        or use a custom solution if a global one over TabView is needed.
                        For simplicity, if FlatLists inside tabs become scrollable, their own
                        RefreshControl would be more standard. Adding a global one here for now.
                    */}
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3B82F6"]}>
                         {/* This ^ might not work as expected if TabView's content isn't directly scrollable from here.
                             Consider adding refreshControl to each FlatList in renderScene instead.
                             Removing from here for now as it's better on individual lists.
                          */}
                    </RefreshControl>
                    {renderMainContent()}
                 </View>
            </View>
            <EventDetailModal
                event={selectedEvent}
                visible={modalVisible}
                onClose={handleCloseModal}
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
        overflow: "hidden", 
        ...(Platform.OS === 'web' ? {
            width: '90%', // Take 90% of parent (modalContainer which is centered)
            maxWidth: 700, // Max width for web modal content
            maxHeight: Dimensions.get('window').height * 0.9, // Max height relative to viewport height
            borderRadius: 12, // Apply border radius to all corners on web
            boxShadow: '0 5px 15px rgba(0,0,0,0.3)', // Add shadow for web
        } : {})
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

export default EventsScreen;