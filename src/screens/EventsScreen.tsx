import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  ScrollView,
  Modal,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

// Define the RootStackParamList
type RootStackParamList = {
  Events: undefined;
  CreateEvent: undefined;
  Profile: undefined;
};

// Define the navigation prop type
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Define event type
interface Event {
  id: string;
  title: string;
  images: string[];
  date: string;
  venue: string;
  genres: string[];
  artists: string[];
  price: string;
  matchesUserTaste: boolean;
  organizer: {
    name: string;
    image: string;
    contact: string;
  };
  description: string;
}

// Sample event data
const EVENTS: Event[] = [
  {
    id: "1",
    title: "Indie Night Live",
    images: [
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
    ],
    date: "Sat, 25 June 2023 • 8:00 PM",
    venue: "The Projector, Golden Mile Tower",
    genres: ["Indie Rock", "Alternative"],
    artists: ["The Neighbourhood", "Cigarettes After Sex"],
    price: "$35",
    matchesUserTaste: true,
    organizer: {
      name: "Indie Sounds SG",
      image:
        "https://images.unsplash.com/photo-1485579149621-3123dd979885?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
      contact: "contact@indiesoundssg.com",
    },
    description:
      "Join us for an unforgettable night of indie rock and alternative music. Experience the atmospheric sounds of The Neighbourhood and Cigarettes After Sex live at The Projector.",
  },
  {
    id: "2",
    title: "Electronic Dreams Festival",
    images: [
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1506157786151-b8491531f063?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
    ],
    date: "Fri, 1 July 2023 • 10:00 PM",
    venue: "Zouk Singapore, Clarke Quay",
    genres: ["Electronic", "House", "Techno"],
    artists: ["Disclosure", "Flume"],
    price: "$45",
    matchesUserTaste: false,
    organizer: {
      name: "Electronic Vibes",
      image:
        "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
      contact: "info@electronicvibes.sg",
    },
    description:
      "Electronic Dreams Festival brings you the best electronic music experience with world-class DJs and producers. Immerse yourself in cutting-edge sound and visual technology at Zouk.",
  },
  {
    id: "3",
    title: "Jazz in the Gardens",
    images: [
      "https://images.unsplash.com/photo-1511192336575-5a79af67a629?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
    ],
    date: "Sun, 10 July 2023 • 5:00 PM",
    venue: "Gardens by the Bay, Marina Bay",
    genres: ["Jazz", "Soul"],
    artists: ["Kamasi Washington", "Robert Glasper"],
    price: "$30",
    matchesUserTaste: true,
    organizer: {
      name: "Jazz Connection",
      image:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
      contact: "hello@jazzconnection.sg",
    },
    description:
      "Experience the smooth sounds of jazz against the stunning backdrop of Gardens by the Bay. This open-air concert features celebrated artists Kamasi Washington and Robert Glasper.",
  },
];

// Event Detail Modal Component
interface EventDetailModalProps {
  event: Event | null;
  visible: boolean;
  onClose: () => void;
  onBookNow: () => void;
}

const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  visible,
  onClose,
  onBookNow,
}) => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Feather name="arrow-left" size={24} color="#000" />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Image
              source={{ uri: event?.images[0] }}
              style={styles.modalImage}
              resizeMode="cover"
            />

            <View style={styles.modalBody}>
              <Text style={styles.modalTitle}>{event?.title}</Text>

              <View style={styles.organizerRow}>
                <View style={styles.organizerInfo}>
                  <Image
                    source={{ uri: event?.organizer.image }}
                    style={styles.organizerImage}
                  />
                  <View>
                    <Text style={styles.organizerName}>
                      {event?.organizer.name}
                    </Text>
                    <Text style={styles.organizerLabel}>Organizer</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.followButton}>
                  <Feather name="heart" size={14} color="#3B82F6" />
                  <Text style={styles.followButtonText}>Follow</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.genreContainer}>
                {event?.genres.map((genre: string, index: number) => (
                  <View key={index} style={styles.genreBadge}>
                    <Text style={styles.genreText}>{genre}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.eventInfoRow}>
                <Feather name="clock" size={16} color="#6B7280" />
                <Text style={styles.eventInfoText}>{event?.date}</Text>
              </View>

              <View style={styles.eventInfoRow}>
                <Feather name="map-pin" size={16} color="#6B7280" />
                <Text style={styles.eventInfoText}>{event?.venue}</Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>About This Event</Text>
              <Text style={styles.descriptionText}>{event?.description}</Text>

              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>Featured Artists</Text>
              {event?.artists.map((artist: string, index: number) => (
                <View key={index} style={styles.artistRow}>
                  <Feather name="music" size={18} color="#3B82F6" />
                  <Text style={styles.artistName}>{artist}</Text>
                </View>
              ))}

              <TouchableOpacity
                style={styles.bookNowButton}
                onPress={() => {
                  onClose();
                  navigation.navigate("CreateEvent");
                }}
              >
                <Feather name="tag" size={18} color="#fff" />
                <Text style={styles.bookNowButtonText}>Book Now</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Event Card Component
interface EventCardProps {
  event: Event;
  onPress: () => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, onPress }) => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <TouchableOpacity
      style={styles.eventCard}
      activeOpacity={0.9}
      onPress={onPress}
    >
      <View style={styles.imageContainer}>
        <Image source={{ uri: event.images[0] }} style={styles.eventImage} />
        {event.matchesUserTaste && (
          <View style={styles.matchBadge}>
            <Feather name="music" size={12} color="#3B82F6" />
            <Text style={styles.matchText}>Matches your taste</Text>
          </View>
        )}
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.eventTitle}>{event.title}</Text>

        <View style={styles.genreContainer}>
          {event.genres.map((genre: string, index: number) => (
            <View key={index} style={styles.genreBadge}>
              <Text style={styles.genreText}>{genre}</Text>
            </View>
          ))}
        </View>

        <View style={styles.eventInfoRow}>
          <Feather name="clock" size={14} color="#6B7280" />
          <Text style={styles.eventInfoText}>{event.date}</Text>
        </View>

        <View style={styles.eventInfoRow}>
          <Feather name="map-pin" size={14} color="#6B7280" />
          <Text style={styles.eventInfoText}>{event.venue}</Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.priceText}>{event.price}</Text>
          <TouchableOpacity
            style={styles.bookButton}
            onPress={() => navigation.navigate("CreateEvent")}
          >
            <Feather name="tag" size={14} color="#fff" />
            <Text style={styles.bookButtonText}>Book Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const EventsScreen: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const navigation = useNavigation<NavigationProp>();

  const handleEventPress = (event: Event) => {
    setSelectedEvent(event);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
  };

  const handleBookNow = () => {
    // Navigate to CreateEvent screen
    navigation.navigate("CreateEvent");
    setModalVisible(false);
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {/* Root container without flex or with padding */}
      <View style={styles.rootContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.titleContainer}>
              <Feather
                name="calendar"
                size={22}
                color="#60A5FA"
                style={styles.headerIcon}
              />
              <Text style={styles.title}>Events</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>
            Discover concerts and music events in Singapore
          </Text>
        </View>

        {/* Events List */}
        <FlatList
          data={EVENTS}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventCard event={item} onPress={() => handleEventPress(item)} />
          )}
          contentContainerStyle={styles.eventsList}
          showsVerticalScrollIndicator={true}
          scrollEnabled={true}
          style={styles.flatListContainer}
        />
      </View>

      {/* Event Detail Modal */}
      <EventDetailModal
        event={selectedEvent}
        visible={modalVisible}
        onClose={handleCloseModal}
        onBookNow={handleBookNow}
      />
    </SafeAreaView>
  );
};

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  rootContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  background: {
    flex: 1,
  },
  flatListContainer: {
    flex: 1,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: {
    marginRight: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#3B82F6",
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  eventsList: {
    padding: 16,
    paddingBottom: 80, // Space for tab bar
  },
  eventCard: {
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  imageContainer: {
    position: "relative",
  },
  eventImage: {
    width: "100%",
    height: width,
    aspectRatio: 1,
  },
  matchBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 50,
  },
  matchText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#3B82F6",
    marginLeft: 4,
  },
  cardContent: {
    padding: 16,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  genreContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  genreBadge: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  genreText: {
    fontSize: 12,
    color: "#1E3A8A",
  },
  eventInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  eventInfoText: {
    fontSize: 14,
    color: "#6B7280",
    marginLeft: 8,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  priceText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3B82F6",
  },
  bookButton: {
    backgroundColor: "#3B82F6",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 50,
  },
  bookButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 6,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "90%",
    overflow: "hidden",
  },
  closeButton: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 10,
    backgroundColor: "white",
    borderRadius: 50,
    padding: 8,
  },
  modalImage: {
    width: "100%",
    height: 250,
  },
  modalBody: {
    padding: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 16,
  },
  organizerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  organizerInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  organizerImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  organizerName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  organizerLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  followButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 50,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#3B82F6",
    marginLeft: 6,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#4B5563",
  },
  artistRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  artistName: {
    fontSize: 14,
    color: "#1F2937",
    marginLeft: 8,
  },
  bookNowButton: {
    backgroundColor: "#3B82F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
  },
  bookNowButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 8,
  },
});

export default EventsScreen;
