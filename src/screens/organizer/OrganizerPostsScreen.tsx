import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

// Define the navigation prop type
type RootStackParamList = {
  EventDetail: { eventId: string };
  Create: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Sample organizer events data
const EVENTS_DATA = [
  {
    id: "1",
    title: "Indie Night Live",
    date: "June 25, 2023",
    time: "8:00 PM",
    venue: "The Projector, Golden Mile Tower",
    image:
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
    tickets: {
      sold: 245,
      total: 400,
    },
    status: "Upcoming",
    revenue: "$8,575",
  },
  {
    id: "2",
    title: "Acoustic Sessions Vol.4",
    date: "May 12, 2023",
    time: "7:30 PM",
    venue: "Blu Jaz Cafe, Bali Lane",
    image:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
    tickets: {
      sold: 120,
      total: 120,
    },
    status: "Completed",
    revenue: "$3,600",
  },
  {
    id: "3",
    title: "Summer Indie Festival",
    date: "April 8, 2023",
    time: "2:00 PM",
    venue: "Fort Canning Park",
    image:
      "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
    tickets: {
      sold: 780,
      total: 1000,
    },
    status: "Completed",
    revenue: "$27,300",
  },
  {
    id: "4",
    title: "Electronic Sunset Sessions",
    date: "July 15, 2023",
    time: "6:00 PM",
    venue: "Tanjong Beach Club, Sentosa",
    image:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
    tickets: {
      sold: 120,
      total: 500,
    },
    status: "Upcoming",
    revenue: "$4,200",
  },
];

const OrganizerPostsScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  const renderEventItem = ({ item }) => {
    const isUpcoming = item.status === "Upcoming";
    const ticketPercentage = (item.tickets.sold / item.tickets.total) * 100;

    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => navigation.navigate("EventDetail", { eventId: item.id })}
      >
        <Image source={{ uri: item.image }} style={styles.eventImage} />
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <Text style={styles.eventTitle}>{item.title}</Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: isUpcoming
                    ? "rgba(59, 130, 246, 0.1)"
                    : "rgba(16, 185, 129, 0.1)",
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: isUpcoming ? "#3B82F6" : "#10B981" },
                ]}
              >
                {item.status}
              </Text>
            </View>
          </View>

          <View style={styles.eventInfoRow}>
            <Feather name="calendar" size={14} color="#6B7280" />
            <Text style={styles.eventInfoText}>
              {item.date} • {item.time}
            </Text>
          </View>

          <View style={styles.eventInfoRow}>
            <Feather name="map-pin" size={14} color="#6B7280" />
            <Text style={styles.eventInfoText}>{item.venue}</Text>
          </View>

          <View style={styles.ticketStatusContainer}>
            <View style={styles.ticketStatusRow}>
              <Text style={styles.ticketText}>
                Tickets Sold: {item.tickets.sold}/{item.tickets.total}
              </Text>
              <Text style={styles.revenueText}>{item.revenue}</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View
                style={[styles.progressBar, { width: `${ticketPercentage}%` }]}
              />
            </View>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Feather name="edit-2" size={14} color="#3B82F6" />
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Feather name="bar-chart-2" size={14} color="#3B82F6" />
              <Text style={styles.actionButtonText}>Analytics</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Feather name="share-2" size={14} color="#3B82F6" />
              <Text style={styles.actionButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.titleContainer}>
            <Feather
              name="layout"
              size={22}
              color="#60A5FA"
              style={styles.headerIcon}
            />
            <Text style={styles.title}>Your Events</Text>
          </View>

          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate("Create")}
          >
            <Feather name="plus" size={16} color="#3B82F6" />
            <Text style={styles.createButtonText}>New</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filtersContainer}>
        <TouchableOpacity
          style={[styles.filterButton, styles.activeFilterButton]}
        >
          <Text style={styles.activeFilterText}>All Events</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton}>
          <Text style={styles.filterText}>Upcoming</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton}>
          <Text style={styles.filterText}>Completed</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={EVENTS_DATA}
        keyExtractor={(item) => item.id}
        renderItem={renderEventItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={true}
        style={styles.flatListContainer}
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
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  createButtonText: {
    color: "#3B82F6",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 4,
  },
  filtersContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
  },
  activeFilterButton: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },
  filterText: {
    fontSize: 14,
    color: "#6B7280",
  },
  activeFilterText: {
    fontSize: 14,
    color: "#3B82F6",
    fontWeight: "500",
  },
  flatListContainer: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80, // Space for tab bar
  },
  eventCard: {
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  eventImage: {
    width: "100%",
    height: 160,
  },
  eventContent: {
    padding: 16,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  eventInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  eventInfoText: {
    fontSize: 14,
    color: "#6B7280",
    marginLeft: 8,
  },
  ticketStatusContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  ticketStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  ticketText: {
    fontSize: 14,
    color: "#4B5563",
  },
  revenueText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#10B981",
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
  cardActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  actionButtonText: {
    fontSize: 14,
    color: "#3B82F6",
    marginLeft: 4,
  },
});

export default OrganizerPostsScreen;
