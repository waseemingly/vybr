import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useOrganizerMode } from "@/hooks/useOrganizerMode";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/hooks/useAuth";

// Sample organizer data
const ORGANIZER_DATA = {
  name: "Indie Sounds SG",
  profilePic:
    "https://images.unsplash.com/photo-1485579149621-3123dd979885?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
  bio: "Independent concert and event organizer. Bringing the best indie music to Singapore since 2018.",
  followers: 1245,
  events: 37,
  contactEmail: "contact@indiesoundssg.com",
  phone: "+65 9123 4567",
  website: "www.indiesoundssg.com",
  upcomingEvents: 3,
  pastEvents: 34,
  rating: 4.8,
  reviews: 156,
  location: "Singapore, SG",
  specialties: [
    "Indie Rock",
    "Alternative",
    "Live Music",
    "Open Mic",
    "Festivals",
  ],
  recentEvents: [
    {
      id: "1",
      title: "Indie Night Live",
      date: "June 25, 2023",
      attendees: 350,
    },
    {
      id: "2",
      title: "Acoustic Sessions Vol.4",
      date: "May 12, 2023",
      attendees: 120,
    },
    {
      id: "3",
      title: "Summer Indie Festival",
      date: "April 8, 2023",
      attendees: 780,
    },
  ],
};

// Section Component
interface SectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, icon, children }) => {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          <Feather
            name={icon as any}
            size={18}
            color="#3B82F6"
            style={styles.sectionIcon}
          />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
      </View>
      {children}
    </View>
  );
};

const OrganizerProfileScreen: React.FC = () => {
  const { toggleOrganizerMode } = useOrganizerMode();
  const { logout } = useAuth();

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.titleContainer}>
            <Feather
              name="briefcase"
              size={22}
              color="#60A5FA"
              style={styles.headerIcon}
            />
            <Text style={styles.title}>Organizer Profile</Text>
          </View>
          <TouchableOpacity
            style={styles.modeButtonSmall}
            onPress={toggleOrganizerMode}
          >
            <Feather name="repeat" size={16} color="#3B82F6" />
            <Text style={styles.modeButtonTextSmall}>Switch to User</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile Content */}
      <ScrollView
        style={styles.scrollViewContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        scrollEnabled={true}
      >
        <View style={styles.profileCard}>
          <LinearGradient
            colors={["#3B82F6", "#60A5FA"]}
            style={styles.coverPhoto}
          />

          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: ORGANIZER_DATA.profilePic }}
              style={styles.avatar}
            />
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.name}>{ORGANIZER_DATA.name}</Text>
            <Text style={styles.location}>
              <Feather name="map-pin" size={14} color="#6B7280" />{" "}
              {ORGANIZER_DATA.location}
            </Text>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{ORGANIZER_DATA.followers}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{ORGANIZER_DATA.events}</Text>
                <Text style={styles.statLabel}>Events</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{ORGANIZER_DATA.rating}</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
            </View>

            <Text style={styles.bio}>{ORGANIZER_DATA.bio}</Text>

            <TouchableOpacity
              style={styles.createEventButton}
              onPress={() => {
                /* Navigate to create event */
              }}
            >
              <Feather name="plus" size={16} color="#FFF" />
              <Text style={styles.createEventButtonText}>Create New Event</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Contact Information Section */}
        <Section title="Contact Information" icon="phone">
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <Feather name="mail" size={16} color="#6B7280" />
              <Text style={styles.infoText}>{ORGANIZER_DATA.contactEmail}</Text>
            </View>
            <View style={styles.infoRow}>
              <Feather name="phone" size={16} color="#6B7280" />
              <Text style={styles.infoText}>{ORGANIZER_DATA.phone}</Text>
            </View>
            <View style={styles.infoRow}>
              <Feather name="globe" size={16} color="#6B7280" />
              <Text style={styles.infoText}>{ORGANIZER_DATA.website}</Text>
            </View>
          </View>
        </Section>

        {/* Specialties Section */}
        <Section title="Event Specialties" icon="tag">
          <View style={styles.tagsContainer}>
            {ORGANIZER_DATA.specialties.map((specialty, index) => (
              <View key={index} style={styles.specialtyTag}>
                <Text style={styles.specialtyTagText}>{specialty}</Text>
              </View>
            ))}
          </View>
        </Section>

        {/* Recent Events Section */}
        <Section title="Recent Events" icon="calendar">
          {ORGANIZER_DATA.recentEvents.map((event, index) => (
            <View key={index} style={styles.eventItem}>
              <View>
                <Text style={styles.eventItemTitle}>{event.title}</Text>
                <Text style={styles.eventItemDate}>{event.date}</Text>
              </View>
              <View style={styles.attendeesContainer}>
                <Text style={styles.attendeesCount}>{event.attendees}</Text>
                <Text style={styles.attendeesLabel}>Attendees</Text>
              </View>
            </View>
          ))}
        </Section>

        {/* Stats Summary Section */}
        <Section title="Performance" icon="bar-chart-2">
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Feather name="calendar" size={24} color="#3B82F6" />
              <Text style={styles.statBoxValue}>
                {ORGANIZER_DATA.upcomingEvents}
              </Text>
              <Text style={styles.statBoxLabel}>Upcoming</Text>
            </View>
            <View style={styles.statBox}>
              <Feather name="check-circle" size={24} color="#10B981" />
              <Text style={styles.statBoxValue}>
                {ORGANIZER_DATA.pastEvents}
              </Text>
              <Text style={styles.statBoxLabel}>Completed</Text>
            </View>
            <View style={styles.statBox}>
              <Feather name="users" size={24} color="#F59E0B" />
              <Text style={styles.statBoxValue}>{ORGANIZER_DATA.reviews}</Text>
              <Text style={styles.statBoxLabel}>Reviews</Text>
            </View>
          </View>
        </Section>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={logout}
        >
          <Feather name="log-out" size={18} color="#FFF" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        {/* Switch to User Mode Button */}
        <TouchableOpacity
          style={styles.modeButton}
          onPress={toggleOrganizerMode}
        >
          <Feather name="refresh-cw" size={18} color="#FFF" />
          <Text style={styles.modeButtonText}>Switch to User Mode</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollViewContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 80, // Space for tab bar
  },
  header: {
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: "#f8fafc",
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
  modeButtonSmall: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  modeButtonTextSmall: {
    color: "#3B82F6",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
  },
  profileCard: {
    backgroundColor: "white",
    borderRadius: 16,
    marginBottom: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  coverPhoto: {
    height: 100,
    width: "100%",
  },
  avatarContainer: {
    position: "absolute",
    top: 40,
    left: (width - 32 - 100) / 2, // Centered with padding consideration
    backgroundColor: "white",
    borderRadius: 50,
    padding: 3,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profileInfo: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  name: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "80%",
    marginVertical: 16,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3B82F6",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#E5E7EB",
  },
  bio: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  createEventButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B82F6",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  createEventButtonText: {
    color: "white",
    fontWeight: "600",
    marginLeft: 8,
  },
  section: {
    marginBottom: 20,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  infoContainer: {
    marginTop: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  infoText: {
    marginLeft: 12,
    fontSize: 14,
    color: "#4B5563",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  specialtyTag: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    margin: 4,
  },
  specialtyTagText: {
    color: "#3B82F6",
    fontSize: 14,
  },
  eventItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  eventItemTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1F2937",
    marginBottom: 4,
  },
  eventItemDate: {
    fontSize: 13,
    color: "#6B7280",
  },
  attendeesContainer: {
    alignItems: "center",
  },
  attendeesCount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3B82F6",
  },
  attendeesLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    padding: 10,
    marginHorizontal: 5,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
  },
  statBoxValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginTop: 8,
  },
  statBoxLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444", // Red color for logout
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  logoutButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 8,
  },
  modeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3B82F6",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  modeButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 8,
  },
});

export default OrganizerProfileScreen;
