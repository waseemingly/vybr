import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ScrollView, Modal,
  Dimensions, ActivityIndicator, RefreshControl, Alert, GestureResponderEvent,
  Platform, SectionList
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../lib/supabase"; // Adjust path, remove EventBooking if unused
import { useAuth } from "../hooks/useAuth"; // Adjust path
import { APP_CONSTANTS } from "@/config/constants";
import type { MusicLoverBio } from "@/hooks/useAuth"; // Changed import source
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
  isViewable: boolean;
  score?: number; // Added for recommendation sorting
}

// Interface for user profile data needed for recommendations
interface MusicLoverProfileData {
    userId: string;
    country: string | null;
    city: string | null;
    // Assumed fields based on MusicLoverSignUpFlow and potential streaming sync
    top_genres?: string[];
    top_artists?: string[];
    top_songs?: string[]; // Maybe less useful for matching event tags?
    // Fields from music_lover_profiles
    favorite_artists?: string[];
    favorite_albums?: string[]; // Harder to match directly
    favorite_songs?: string[];
    bio?: MusicLoverBio | null; // Contains musicTaste, dreamConcert etc. Can be null
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
            // Use navigation type assertion if structure mismatch is known
            navigation.push('ViewOrganizerProfileScreen' as any, { organizerUserId: event.organizer.userId });
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

// Function to calculate recommendation score
const calculateEventScore = (event: MappedEvent, userProfile: MusicLoverProfileData | null): number => {
    if (!userProfile) return 0;
    let score = 0;

    // --- Prepare User Preference Sets --- 
    const userGenres = new Set<string>();
    (userProfile.top_genres ?? []).forEach(g => userGenres.add(g.toLowerCase()));
    // Add genres from bio.musicTaste
    (userProfile.bio?.musicTaste ?? '').toLowerCase().split(/,|\band\b|\bwith\b|\s+/).forEach(g => {
        const trimmed = g.trim();
        if (trimmed) userGenres.add(trimmed);
    });

    const userArtists = new Set<string>();
    (userProfile.top_artists ?? []).forEach(a => userArtists.add(a.toLowerCase()));
    (userProfile.favorite_artists ?? []).forEach(a => userArtists.add(a.toLowerCase()));
    // Add artists from bio.dreamConcert
    (userProfile.bio?.dreamConcert ?? '').toLowerCase().split(/,|\band\b|\bwith\b/).forEach((artist: string) => {
        const trimmed = artist.trim();
        if (trimmed) userArtists.add(trimmed);
    });

    const userSongs = new Set<string>();
    (userProfile.top_songs ?? []).forEach(s => userSongs.add(s.toLowerCase()));
    (userProfile.favorite_songs ?? []).forEach(s => userSongs.add(s.toLowerCase()));
    // Add song from bio.goToSong
    const goToSong = userProfile.bio?.goToSong?.trim().toLowerCase();
    if (goToSong) userSongs.add(goToSong);

    // Extract all keywords from bio values (excluding common words could be added)
    const bioKeywords = new Set<string>();
    if (userProfile.bio) {
        Object.values(userProfile.bio).forEach(value => {
            if (typeof value === 'string') {
                value.toLowerCase().split(/\s+|,|\(|\)/).forEach((word: string) => {
                    const trimmed = word.trim().replace(/[^a-z0-9\-]/g, ''); // Basic cleanup
                    if (trimmed && trimmed.length > 2) { // Avoid very short/common words
                        bioKeywords.add(trimmed);
                    }
                });
            }
        });
    }
    
    // Combine artist names into keywords as well for broader matching
    userArtists.forEach(artist => bioKeywords.add(artist));

    // --- Score Event Based on Matches --- 

    // Match Genres
    (event.genres ?? []).forEach(genre => {
        const lowerGenre = genre.toLowerCase();
        if (userGenres.has(lowerGenre)) {
            score += SCORE_WEIGHTS.GENRE_MATCH;
        }
        if (bioKeywords.has(lowerGenre)) {
            score += SCORE_WEIGHTS.BIO_TASTE_MATCH; 
        }
    });

    // Match Artists
    (event.artists ?? []).forEach(artist => {
        const lowerArtist = artist.toLowerCase();
        if (userArtists.has(lowerArtist)) {
            score += SCORE_WEIGHTS.ARTIST_MATCH;
        }
         // Check if artist name appears as a keyword in bio
        if (bioKeywords.has(lowerArtist)) {
             score += SCORE_WEIGHTS.BIO_TASTE_MATCH * 0.5; 
        }
    });

    // Match Songs (Lower weight)
    (event.songs ?? []).forEach(song => {
        const lowerSong = song.toLowerCase();
        if (userSongs.has(lowerSong)) {
            score += SCORE_WEIGHTS.SONG_MATCH;
        }
        // Check if song title keywords appear in bio keywords
        lowerSong.split(/\s+/).forEach(word => {
             if (bioKeywords.has(word.replace(/[^a-z0-9\-]/g, ''))) {
                  score += SCORE_WEIGHTS.BIO_TASTE_MATCH * 0.1; // Very low score for keyword match
             }
        });
    });

    // Match keywords from event title/desc with user bio keywords
    const eventText = `${event.title.toLowerCase()} ${event.description.toLowerCase()}`;
    bioKeywords.forEach(word => {
        if (eventText.includes(word)) {
             score += SCORE_WEIGHTS.BIO_TASTE_MATCH * 0.2; // Slightly higher score for direct keyword match in text
        }
    });

    // Note: Matching favorite_albums is complex. We could extract artist names from album strings,
    // or check if event artists are associated with user's favorite albums (requires more data).
    // For now, album matching is implicitly handled via artists/keywords from bio.mustListenAlbum.

    return score;
};

// --- Main Events Screen ---
const EventsScreen: React.FC = () => {
    const { session } = useAuth(); // Get session, user is inside session.user
    const [userProfile, setUserProfile] = useState<MusicLoverProfileData | null>(null);
    // State for raw fetched data
    const [rawEvents, setRawEvents] = useState<SupabasePublicEvent[]>([]);
    const [organizerMap, setOrganizerMap] = useState<Map<string, OrganizerInfo>>(new Map());
    // State for processed event lists
    const [recommendedEvents, setRecommendedEvents] = useState<MappedEvent[]>([]);
    const [otherLocalEvents, setOtherLocalEvents] = useState<MappedEvent[]>([]);
    // State for SectionList
    const [sections, setSections] = useState<EventSection[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [allEventsLoaded, setAllEventsLoaded] = useState(false); // Track if all events are loaded
    
    const [isLoading, setIsLoading] = useState(true); // Combined loading state for profile + initial events
    const [isFetchingMore, setIsFetchingMore] = useState(false); // For pagination loading
    const [error, setError] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<MappedEvent | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const navigation = useNavigation<NavigationProp>();

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
        const userId = session?.user?.id; // Access user ID via session
        if (!userId) {
            setUserProfile(null); // No user logged in
            console.log("[EventsScreen] No user logged in, cannot fetch profile.");
            return;
        }
        console.log("[EventsScreen] Fetching user profile data...");
        try {
            // Fetch profile data (location, bio, favorites)
            const { data: profileData, error: profileError } = await supabase
                .from('music_lover_profiles')
                 // Add favorite fields to select
                .select('user_id, country, city, bio, favorite_artists, favorite_albums, favorite_songs')
                .eq('user_id', userId)
                .single();

            if (profileError && profileError.code !== 'PGRST116') {
                console.error("[EventsScreen] Error fetching profile part:", profileError);
                throw new Error(`Profile fetch error: ${profileError.message}`);
            }
            
            // Fetch streaming data (top items)
            const { data: streamingData, error: streamingError } = await supabase
                .from('user_streaming_data')
                .select('top_artists, top_genres, top_songs') // Adjust column names if different
                .eq('user_id', userId)
                .maybeSingle(); // Use maybeSingle as user might not have connected streaming

            if (streamingError) {
                console.warn("[EventsScreen] Warning fetching streaming data:", streamingError.message);
                // Don't throw; proceed without streaming data if it fails
            }

            if (!profileData) {
                 console.log("[EventsScreen] No base music lover profile found for user.");
                 setUserProfile(null); // Essential profile part missing
                 // Optionally set an error state here?
                 return;
            }
            
            // Combine data
            const combinedProfile: MusicLoverProfileData = {
                userId: profileData.user_id,
                country: profileData.country,
                city: profileData.city,
                bio: profileData.bio ? (typeof profileData.bio === 'string' ? JSON.parse(profileData.bio) : profileData.bio) : null, // Ensure bio can be null
                favorite_artists: profileData.favorite_artists ?? [],
                favorite_albums: profileData.favorite_albums ?? [],
                favorite_songs: profileData.favorite_songs ?? [],
                top_genres: streamingData?.top_genres ?? [],
                top_artists: streamingData?.top_artists ?? [],
                top_songs: streamingData?.top_songs ?? []
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
        Promise.all([fetchUserProfile(), fetchEventsAndOrganizers()]).finally(() => {
           // setIsLoading(false); // Loading is set to false after processing effect runs
        });
    }, [fetchUserProfile, fetchEventsAndOrganizers]));

    // Process events whenever raw data or user profile changes
    useEffect(() => {
        console.log("[EventsScreen] Processing events...");
        if (!rawEvents || !userProfile === undefined) { // Wait for profile fetch attempt (even if null)
             console.log("[EventsScreen] Waiting for raw events or user profile fetch...");
             return; // Don't process until we have data and profile status
        }
        
        const now = new Date();
        const mappedEvents: MappedEvent[] = rawEvents
            .filter(event => new Date(event.event_datetime) > now) // Filter for upcoming events here
            .map((event: SupabasePublicEvent) => {
                const { date, time } = formatEventDateTime(event.event_datetime);
                const organizerInfo = organizerMap.get(event.organizer_id);
                const finalOrganizerData: OrganizerInfo = organizerInfo || {
                    userId: event.organizer_id,
                    name: DEFAULT_ORGANIZER_NAME,
                    image: null
                };
                // Ensure pass_fee_to_user has a default value before scoring
                const eventForScoring = {
                    ...event,
                    organizer: finalOrganizerData, 
                    isViewable: false, 
                    images: event.poster_urls ?? [], // Provide default for images
                    date: date, // Provide default date/time/venue/desc
                    time: time,
                    venue: event.location_text ?? 'N/A',
                    description: event.description ?? '',
                    genres: event.tags_genres ?? [], 
                    artists: event.tags_artists ?? [], 
                    songs: event.tags_songs ?? [],
                    pass_fee_to_user: event.pass_fee_to_user ?? true, // Ensure boolean
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
                    isViewable: false,
                    score: score, // Assign calculated score
                };
            });

        // Filter by location
        let locationFilteredEvents = mappedEvents;
        if (userProfile?.country && userProfile.city) {
            console.log(`[EventsScreen] Filtering for Country: ${userProfile.country}, City: ${userProfile.city}`);
            locationFilteredEvents = mappedEvents.filter(event => 
                event.country === userProfile.country && event.city === userProfile.city
            );
            console.log(`[EventsScreen] Found ${locationFilteredEvents.length} events in user's location.`);
        } else {
            console.log("[EventsScreen] User location not available, showing all upcoming events.");
            // Or decide to show nothing if location is mandatory for feed?
            // locationFilteredEvents = []; // Uncomment to show nothing if no user location
        }

        // Separate into recommended and other
        const recommended = locationFilteredEvents
            .filter(event => event.score && event.score > 0)
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)); // Sort by score desc

        const otherLocal = locationFilteredEvents
            .filter(event => !event.score || event.score <= 0)
             // Already sorted by date ascending from initial fetch

        setRecommendedEvents(recommended);
        setOtherLocalEvents(otherLocal);
        setCurrentPage(1); // Reset page on new data/profile
        setAllEventsLoaded(false); // Reset loaded status
        setIsLoading(false); // Stop initial loading indicator
        setRefreshing(false); // Stop refresh indicator
        console.log(`[EventsScreen] Processing complete. Recommended: ${recommended.length}, Other Local: ${otherLocal.length}`);

    }, [rawEvents, organizerMap, userProfile]);

    // Update displayed sections based on pagination
     useEffect(() => {
        console.log(`[EventsScreen] Updating sections for page: ${currentPage}`);
        const startIndex = 0; // Start from beginning each time
        const endIndex = currentPage * EVENTS_PER_PAGE;
        
        const recommendedToShow = recommendedEvents.slice(startIndex, endIndex);
        const remainingSlots = endIndex - recommendedToShow.length;
        const otherLocalToShow = remainingSlots > 0 ? otherLocalEvents.slice(0, remainingSlots) : [];

        const newSections: EventSection[] = [];

        if (recommendedToShow.length > 0) {
            newSections.push({ title: "Recommended For You", data: recommendedToShow });
        }

        if (otherLocalToShow.length > 0) {
            let otherTitle = "Other Upcoming Events";
            if (userProfile?.city && userProfile.country) {
                otherTitle = `Other Events in ${userProfile.city}, ${userProfile.country}`;
            } else if (recommendedToShow.length === 0) {
                 // If no recommendations and no user location, fallback title
                 otherTitle = "Upcoming Events";
            }
            // Only add section if it wasn't implicitly covered by recommendations
            if (recommendedToShow.length < recommendedEvents.length || recommendedEvents.length === 0) {
                 newSections.push({ title: otherTitle, data: otherLocalToShow });
            }
        }
        
        setSections(newSections);

        // Check if all events are loaded
        const totalDisplayed = recommendedToShow.length + otherLocalToShow.length;
        const totalAvailable = recommendedEvents.length + otherLocalEvents.length;
        if (totalDisplayed >= totalAvailable) {
            console.log("[EventsScreen] All events loaded.");
            setAllEventsLoaded(true);
        } else {
             setAllEventsLoaded(false);
        }
        setIsFetchingMore(false); // Stop pagination loading indicator

    }, [recommendedEvents, otherLocalEvents, currentPage, userProfile]);

    const handleLoadMore = () => {
        if (!isFetchingMore && !allEventsLoaded) {
            console.log("[EventsScreen] Loading more events...");
            setIsFetchingMore(true);
            setCurrentPage(prevPage => prevPage + 1);
        }
    };

    // Refresh handler
    const onRefresh = useCallback(() => {
        console.log("[EventsScreen] Refresh triggered.");
        setRefreshing(true);
        setCurrentPage(1); // Reset page on refresh
        setAllEventsLoaded(false);
        // Re-fetch profile and events
        Promise.all([fetchUserProfile(), fetchEventsAndOrganizers()])
            .catch(err => console.error("Error during refresh:", err))
            .finally(() => {
                // Processing useEffect will handle setting refreshing to false
            });
    }, [fetchUserProfile, fetchEventsAndOrganizers]);

    // Modal control (Unchanged)
    const handleEventPress = (event: MappedEvent) => { setSelectedEvent(event); setModalVisible(true); };
    const handleCloseModal = () => { setModalVisible(false); setSelectedEvent(null); };

    // Render Section Header
    const renderSectionHeader = ({ section: { title } }: { section: EventSection }) => (
        <Text style={styles.sectionHeader}>{title}</Text>
    );

     // Render Footer for pagination loading or end message
    const renderListFooter = () => {
        if (isFetchingMore) {
            return <ActivityIndicator style={{ marginVertical: 20 }} size="small" color="#3B82F6" />;
        }
        if (allEventsLoaded && (recommendedEvents.length + otherLocalEvents.length > 0)) {
             return <Text style={styles.endListText}>No more events</Text>;
        }
        return null;
    };

    // Main render logic using SectionList
    const renderContent = () => {
        // Initial Loading state
        if (isLoading && sections.length === 0) return <View style={styles.centeredContainer}><ActivityIndicator size="large" color="#3B82F6" /></View>;
        
        // Error state
        if (error && !isLoading) return (
             <View style={styles.centeredContainer}>
                 <Feather name="alert-triangle" size={40} color="#F87171" />
                 <Text style={styles.errorText}>{error}</Text>
                 {!isLoading && (
                     <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
                         <Text style={styles.retryButtonText}>Retry</Text>
                     </TouchableOpacity>
                 )}
             </View>
         );
         
        // Empty state (after loading, no errors, but no events found for user/location)
        if (!isLoading && !refreshing && sections.every(sec => sec.data.length === 0)) return (
             <View style={styles.centeredContainer}>
                 <Feather name="coffee" size={40} color="#9CA3AF" />
                 <Text style={styles.emptyText}>No Events Found</Text>
                 <Text style={styles.emptySubText}>
                     {userProfile?.city ? `We couldn't find events matching your profile in ${userProfile.city}. Check back later!` : "Check back later for events!"}
                 </Text>
             </View>
         );
         
        // Display SectionList
        return (
            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <EventCard
                        event={item}
                        onPress={() => handleEventPress(item)}
                        isViewable={item.isViewable} // isViewable state is not managed per item here, needs onViewableItemsChanged logic if required
                    />
                )}
                renderSectionHeader={renderSectionHeader}
                contentContainerStyle={styles.eventsList}
                style={styles.flatListContainer}
                refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3B82F6"]} /> }
                onViewableItemsChanged={onViewableItemsChangedRef.current} // Impression tracking
                viewabilityConfig={viewabilityConfigRef.current} // Impression tracking
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5} // Load more when 50% scrolled
                ListFooterComponent={renderListFooter}
                stickySectionHeadersEnabled={false} // Optional: makes headers scroll with content
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

// --- Styles --- (Add sectionHeader, endListText styles)
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
    sectionHeader: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        backgroundColor: '#f8fafc', // Match background
        paddingVertical: 8,
        paddingHorizontal: 0, // Use list padding
        marginTop: 10, // Add some space above headers
        marginBottom: 5,
    },
    endListText: {
        textAlign: 'center',
        color: '#9CA3AF',
        paddingVertical: 20,
        fontSize: 14,
    },
});

export default EventsScreen;