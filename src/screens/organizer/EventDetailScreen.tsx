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
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

// Sample event data
const EVENT_DATA = {
  id: "1",
  title: "Indie Night Live",
  description:
    "Join us for an unforgettable night of indie rock and alternative music. Experience the atmospheric sounds of The Neighbourhood and Cigarettes After Sex live at The Projector.",
  date: "June 25, 2023",
  time: "8:00 PM",
  venue: "The Projector, Golden Mile Tower",
  venueAddress: "6001 Beach Road, #05-00 Golden Mile Tower, Singapore 199589",
  image:
    "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
  artists: ["The Neighbourhood", "Cigarettes After Sex"],
  genres: ["Indie Rock", "Alternative"],
  ticketTypes: [
    {
      name: "General Admission",
      price: "$35",
      sold: 180,
      available: 300,
      total: 300,
    },
    {
      name: "VIP Access",
      price: "$65",
      sold: 65,
      available: 35,
      total: 100,
    },
  ],
  salesData: {
    totalSold: 245,
    totalRevenue: "$8,575",
    averageTicketPrice: "$35",
    percentageSold: 61,
  },
  analytics: {
    viewCount: 1876,
    conversionRate: "13.1%",
    visitorsByAge: [
      { age: "18-24", percentage: 35 },
      { age: "25-34", percentage: 45 },
      { age: "35-44", percentage: 15 },
      { age: "45+", percentage: 5 },
    ],
    visitorsByGender: [
      { gender: "Male", percentage: 55 },
      { gender: "Female", percentage: 42 },
      { gender: "Other", percentage: 3 },
    ],
  },
  status: "Upcoming",
};

// Section Component
interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
};

// Statistics Item Component
interface StatItemProps {
  label: string;
  value: string;
  icon?: string;
  color?: string;
}

const StatItem: React.FC<StatItemProps> = ({
  label,
  value,
  icon = "bar-chart-2",
  color = "#3B82F6",
}) => {
  return (
    <View style={styles.statItem}>
      <View
        style={[styles.statIconContainer, { backgroundColor: `${color}20` }]}
      >
        <Feather name={icon as any} size={16} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
};

const EventDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color="#3B82F6" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Details</Text>
        <TouchableOpacity style={styles.moreButton}>
          <Feather name="more-vertical" size={24} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <Image source={{ uri: EVENT_DATA.image }} style={styles.coverImage} />

        <View style={styles.statusBadgeContainer}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  EVENT_DATA.status === "Upcoming"
                    ? "rgba(59, 130, 246, 0.1)"
                    : "rgba(16, 185, 129, 0.1)",
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    EVENT_DATA.status === "Upcoming" ? "#3B82F6" : "#10B981",
                },
              ]}
            >
              {EVENT_DATA.status}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{EVENT_DATA.title}</Text>

          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <Feather
                name="calendar"
                size={16}
                color="#6B7280"
                style={styles.infoIcon}
              />
              <Text style={styles.infoText}>
                {EVENT_DATA.date} • {EVENT_DATA.time}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Feather
                name="map-pin"
                size={16}
                color="#6B7280"
                style={styles.infoIcon}
              />
              <View style={styles.venueContainer}>
                <Text style={styles.infoText}>{EVENT_DATA.venue}</Text>
                <Text style={styles.addressText}>
                  {EVENT_DATA.venueAddress}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.tagsContainer}>
            {EVENT_DATA.genres.map((genre, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{genre}</Text>
              </View>
            ))}
          </View>

          <Section title="Description">
            <Text style={styles.description}>{EVENT_DATA.description}</Text>
          </Section>

          <Section title="Artists">
            <View style={styles.artistsContainer}>
              {EVENT_DATA.artists.map((artist, index) => (
                <View key={index} style={styles.artistRow}>
                  <Feather name="music" size={16} color="#3B82F6" />
                  <Text style={styles.artistName}>{artist}</Text>
                </View>
              ))}
            </View>
          </Section>

          <Section title="Ticket Sales">
            <View style={styles.statsRow}>
              <StatItem
                label="Tickets Sold"
                value={EVENT_DATA.salesData.totalSold.toString()}
                icon="ticket"
              />
              <StatItem
                label="Revenue"
                value={EVENT_DATA.salesData.totalRevenue}
                icon="dollar-sign"
                color="#10B981"
              />
              <StatItem
                label="% Sold"
                value={`${EVENT_DATA.salesData.percentageSold}%`}
                icon="percent"
              />
            </View>

            {EVENT_DATA.ticketTypes.map((ticket, index) => (
              <View key={index} style={styles.ticketTypeContainer}>
                <View style={styles.ticketHeader}>
                  <Text style={styles.ticketName}>{ticket.name}</Text>
                  <Text style={styles.ticketPrice}>{ticket.price}</Text>
                </View>

                <View style={styles.ticketProgressContainer}>
                  <View style={styles.ticketProgressTextRow}>
                    <Text style={styles.ticketProgressText}>
                      {ticket.sold} / {ticket.total} sold
                    </Text>
                    <Text style={styles.ticketRemainingText}>
                      {ticket.available} remaining
                    </Text>
                  </View>

                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        { width: `${(ticket.sold / ticket.total) * 100}%` },
                      ]}
                    />
                  </View>
                </View>
              </View>
            ))}
          </Section>

          <Section title="Audience Analytics">
            <View style={styles.statsRow}>
              <StatItem
                label="Page Views"
                value={EVENT_DATA.analytics.viewCount.toString()}
                icon="eye"
              />
              <StatItem
                label="Conversion"
                value={EVENT_DATA.analytics.conversionRate}
                icon="trending-up"
                color="#F59E0B"
              />
            </View>

            <Text style={styles.analyticsSubtitle}>Visitor Demographics</Text>

            <View style={styles.demographicsContainer}>
              <View style={styles.demographicSection}>
                <Text style={styles.demographicTitle}>Age</Text>
                {EVENT_DATA.analytics.visitorsByAge.map((item, index) => (
                  <View key={index} style={styles.demographicRow}>
                    <Text style={styles.demographicLabel}>{item.age}</Text>
                    <View style={styles.demographicBarContainer}>
                      <View
                        style={[
                          styles.demographicBar,
                          { width: `${item.percentage}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.demographicPercentage}>
                      {item.percentage}%
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.demographicSection}>
                <Text style={styles.demographicTitle}>Gender</Text>
                {EVENT_DATA.analytics.visitorsByGender.map((item, index) => (
                  <View key={index} style={styles.demographicRow}>
                    <Text style={styles.demographicLabel}>{item.gender}</Text>
                    <View style={styles.demographicBarContainer}>
                      <View
                        style={[
                          styles.demographicBar,
                          {
                            width: `${item.percentage}%`,
                            backgroundColor:
                              item.gender === "Male"
                                ? "#3B82F6"
                                : item.gender === "Female"
                                ? "#EC4899"
                                : "#8B5CF6",
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.demographicPercentage}>
                      {item.percentage}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Section>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.editButton}>
              <Feather name="edit-2" size={18} color="#3B82F6" />
              <Text style={styles.editButtonText}>Edit Event</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.promoteButton}>
              <Feather name="trending-up" size={18} color="#FFFFFF" />
              <Text style={styles.promoteButtonText}>Promote Event</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "white",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
  },
  moreButton: {
    padding: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  coverImage: {
    width: "100%",
    height: 240,
  },
  statusBadgeContainer: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 16,
  },
  infoContainer: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    fontSize: 16,
    color: "#4B5563",
  },
  venueContainer: {
    flex: 1,
  },
  addressText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  tag: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    color: "#3B82F6",
    fontSize: 14,
    fontWeight: "500",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: "#4B5563",
  },
  artistsContainer: {
    marginTop: 8,
  },
  artistRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  artistName: {
    fontSize: 16,
    color: "#4B5563",
    marginLeft: 12,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  ticketTypeContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  ticketName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  ticketPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#3B82F6",
  },
  ticketProgressContainer: {
    marginTop: 4,
  },
  ticketProgressTextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  ticketProgressText: {
    fontSize: 14,
    color: "#4B5563",
  },
  ticketRemainingText: {
    fontSize: 14,
    color: "#6B7280",
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 3,
  },
  analyticsSubtitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#4B5563",
    marginTop: 8,
    marginBottom: 12,
  },
  demographicsContainer: {
    marginTop: 8,
  },
  demographicSection: {
    marginBottom: 20,
  },
  demographicTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
  },
  demographicRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  demographicLabel: {
    width: 60,
    fontSize: 14,
    color: "#4B5563",
  },
  demographicBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: "hidden",
  },
  demographicBar: {
    height: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 4,
  },
  demographicPercentage: {
    width: 40,
    fontSize: 14,
    color: "#4B5563",
    textAlign: "right",
  },
  actionButtons: {
    flexDirection: "row",
    marginTop: 8,
  },
  editButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  editButtonText: {
    color: "#3B82F6",
    fontWeight: "600",
    marginLeft: 8,
  },
  promoteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3B82F6",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  promoteButtonText: {
    color: "white",
    fontWeight: "600",
    marginLeft: 8,
  },
});

export default EventDetailScreen;
