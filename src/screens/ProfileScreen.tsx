import React, { useState } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { useOrganizerMode } from "@/hooks/useOrganizerMode";

// Define types
interface Genre {
  name: string;
  value: number;
}

interface Song {
  title: string;
  artist: string;
}

interface Album {
  title: string;
  artist: string;
  year: string;
}

interface UserData {
  name: string;
  age: number;
  profilePic: string;
  bio: string;
  friends: number;
  following: number;
  isPremium: boolean;
  genres: string[];
  genreData: Genre[];
  artists: string[];
  songs: Song[];
  albums: Album[];
}

// Sample user data
const USER_DATA: UserData = {
  name: "Alex Chen",
  age: 28,
  profilePic:
    "https://images.unsplash.com/photo-1536104968055-4d61aa56f46a?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
  bio: "Music lover and concert enthusiast. Always looking for new artists and genres to explore. Let's connect and share playlists!",
  friends: 124,
  following: 56,
  isPremium: true,
  genres: [
    "Alternative Rock",
    "Indie Pop",
    "Electronic",
    "Hip Hop",
    "Jazz",
    "R&B",
    "Folk",
    "Lo-fi",
    "Dream Pop",
    "Post Rock",
  ],
  genreData: [
    { name: "Alternative Rock", value: 35 },
    { name: "Indie Pop", value: 25 },
    { name: "Electronic", value: 15 },
    { name: "Hip Hop", value: 12 },
    { name: "Jazz", value: 8 },
    { name: "Others", value: 5 },
  ],
  artists: [
    "Tame Impala",
    "Mac DeMarco",
    "Kendrick Lamar",
    "Frank Ocean",
    "FKA Twigs",
    "The Strokes",
    "Beach House",
    "Radiohead",
    "Arctic Monkeys",
    "Childish Gambino",
    "Bon Iver",
    "Flume",
    "SZA",
    "Tyler, The Creator",
    "James Blake",
  ],
  songs: [
    {
      title: "The Less I Know The Better",
      artist: "Tame Impala",
    },
    {
      title: "Self Control",
      artist: "Frank Ocean",
    },
    {
      title: "DNA",
      artist: "Kendrick Lamar",
    },
    {
      title: "Chamber of Reflection",
      artist: "Mac DeMarco",
    },
    {
      title: "Cellophane",
      artist: "FKA Twigs",
    },
    {
      title: "Reptilia",
      artist: "The Strokes",
    },
    {
      title: "Space Song",
      artist: "Beach House",
    },
    {
      title: "Weird Fishes/Arpeggi",
      artist: "Radiohead",
    },
    {
      title: "505",
      artist: "Arctic Monkeys",
    },
    {
      title: "Redbone",
      artist: "Childish Gambino",
    },
    {
      title: "Holocene",
      artist: "Bon Iver",
    },
  ],
  albums: [
    {
      title: "Currents",
      artist: "Tame Impala",
      year: "2015",
    },
    {
      title: "Blonde",
      artist: "Frank Ocean",
      year: "2016",
    },
    {
      title: "To Pimp a Butterfly",
      artist: "Kendrick Lamar",
      year: "2015",
    },
    {
      title: "In Rainbows",
      artist: "Radiohead",
      year: "2007",
    },
  ],
};

interface SeparatorProps {
  vertical?: boolean;
}

// A simple separator component
const Separator: React.FC<SeparatorProps> = ({ vertical = false }) => (
  <View
    style={[
      styles.separator,
      vertical ? { height: 40, width: 1 } : { height: 1, width: "100%" },
    ]}
  />
);

interface ProfileSectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  isPremiumFeature?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}

// Profile section component
const ProfileSection: React.FC<ProfileSectionProps> = ({
  title,
  icon,
  children,
  isPremiumFeature = false,
  expanded = true,
  onToggle = () => {},
}) => {
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
          {isPremiumFeature && (
            <View style={styles.premiumBadge}>
              <Feather name="award" size={10} color="#FFD700" />
              <Text style={styles.premiumText}>Premium</Text>
            </View>
          )}
        </View>
        {isPremiumFeature && (
          <TouchableOpacity onPress={onToggle} style={styles.toggleButton}>
            <Text style={styles.toggleButtonText}>
              {expanded ? "See Less" : "See More"}
            </Text>
            <Feather
              name="chevron-right"
              size={16}
              color="#3B82F6"
              style={[
                styles.toggleIcon,
                expanded && { transform: [{ rotate: "90deg" }] },
              ]}
            />
          </TouchableOpacity>
        )}
      </View>
      {expanded && children}
    </View>
  );
};

interface ExpandedSections {
  artists: boolean;
  songs: boolean;
  analytics: boolean;
}

const ProfileScreen: React.FC = () => {
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    artists: false,
    songs: false,
    analytics: true,
  });

  const { toggleOrganizerMode } = useOrganizerMode();

  const toggleSection = (section: keyof ExpandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.titleContainer}>
            <Feather
              name="user"
              size={22}
              color="#60A5FA"
              style={styles.headerIcon}
            />
            <Text style={styles.title}>Profile</Text>
          </View>
          <TouchableOpacity
            style={styles.modeButtonSmall}
            onPress={toggleOrganizerMode}
          >
            <Feather name="repeat" size={16} color="#3B82F6" />
            <Text style={styles.modeButtonTextSmall}>Switch to Organizer</Text>
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
              source={{ uri: USER_DATA.profilePic }}
              style={styles.avatar}
            />
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.nameContainer}>
              <Text style={styles.name}>{USER_DATA.name}</Text>
              {USER_DATA.isPremium && (
                <View style={styles.premiumBadge}>
                  <Feather name="award" size={10} color="#FFD700" />
                  <Text style={styles.premiumText}>Premium</Text>
                </View>
              )}
            </View>
            <Text style={styles.age}>{USER_DATA.age} years old</Text>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{USER_DATA.friends}</Text>
                <Text style={styles.statLabel}>Friends</Text>
              </View>
              <Separator vertical />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{USER_DATA.following}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
            </View>

            <Text style={styles.bio}>{USER_DATA.bio}</Text>
          </View>
        </View>

        {/* Analytics Section */}
        {USER_DATA.isPremium && (
          <ProfileSection
            title="Music Taste Analytics"
            icon="bar-chart-2"
            isPremiumFeature
            expanded={expandedSections.analytics}
            onToggle={() => toggleSection("analytics")}
          >
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsTitle}>Genre Distribution</Text>
              <View style={styles.pieChartPlaceholder}>
                <Text style={styles.placeholderText}>
                  Pie Chart Visualization
                </Text>
                <Text style={styles.placeholderSubtext}>
                  Alternative Rock: 35%
                </Text>
                <Text style={styles.placeholderSubtext}>Indie Pop: 25%</Text>
                <Text style={styles.placeholderSubtext}>Electronic: 15%</Text>
              </View>
            </View>
          </ProfileSection>
        )}

        {/* Favorite Genres Section */}
        <ProfileSection title="Favorite Genres" icon="music">
          <View style={styles.tagsContainer}>
            {USER_DATA.genres.map((genre, index) => (
              <View key={index} style={styles.genreTag}>
                <Text style={styles.genreTagText}>{genre}</Text>
              </View>
            ))}
          </View>
        </ProfileSection>

        {/* Favorite Artists Section */}
        <ProfileSection
          title="Favorite Artists"
          icon="users"
          isPremiumFeature={
            USER_DATA.isPremium && USER_DATA.artists.length > 10
          }
          expanded={expandedSections.artists}
          onToggle={() => toggleSection("artists")}
        >
          <View style={styles.listContainer}>
            {USER_DATA.artists
              .slice(
                0,
                expandedSections.artists || !USER_DATA.isPremium
                  ? USER_DATA.artists.length
                  : 10
              )
              .map((artist, index) => (
                <View key={index} style={styles.listItem}>
                  <Text style={styles.listItemText}>{artist}</Text>
                  <Feather name="user" size={16} color="#3B82F6" />
                </View>
              ))}
          </View>

          {USER_DATA.isPremium &&
            USER_DATA.artists.length > 10 &&
            !expandedSections.artists && (
              <TouchableOpacity
                style={styles.seeAllButton}
                onPress={() => toggleSection("artists")}
              >
                <Text style={styles.seeAllButtonText}>
                  See all {USER_DATA.artists.length} artists
                </Text>
                <Feather name="chevron-right" size={16} color="#3B82F6" />
              </TouchableOpacity>
            )}
        </ProfileSection>

        {/* Favorite Songs Section */}
        <ProfileSection
          title="Favorite Songs"
          icon="disc"
          isPremiumFeature={USER_DATA.isPremium && USER_DATA.songs.length > 10}
          expanded={expandedSections.songs}
          onToggle={() => toggleSection("songs")}
        >
          <View style={styles.listContainer}>
            {USER_DATA.songs
              .slice(
                0,
                expandedSections.songs || !USER_DATA.isPremium
                  ? USER_DATA.songs.length
                  : 10
              )
              .map((song, index) => (
                <View key={index} style={styles.listItem}>
                  <View>
                    <Text style={styles.listItemText}>{song.title}</Text>
                    <Text style={styles.listItemSubtext}>{song.artist}</Text>
                  </View>
                  <Feather name="music" size={16} color="#3B82F6" />
                </View>
              ))}
          </View>

          {USER_DATA.isPremium &&
            USER_DATA.songs.length > 10 &&
            !expandedSections.songs && (
              <TouchableOpacity
                style={styles.seeAllButton}
                onPress={() => toggleSection("songs")}
              >
                <Text style={styles.seeAllButtonText}>
                  See all {USER_DATA.songs.length} songs
                </Text>
                <Feather name="chevron-right" size={16} color="#3B82F6" />
              </TouchableOpacity>
            )}
        </ProfileSection>

        {/* Favorite Albums Section */}
        <ProfileSection title="Favorite Albums" icon="disc">
          <View style={styles.listContainer}>
            {USER_DATA.albums.map((album, index) => (
              <View key={index} style={styles.listItem}>
                <View>
                  <Text style={styles.listItemText}>{album.title}</Text>
                  <Text style={styles.listItemSubtext}>
                    {album.artist} • {album.year}
                  </Text>
                </View>
                <Feather name="disc" size={16} color="#3B82F6" />
              </View>
            ))}
          </View>
        </ProfileSection>

        {/* Match Radio Feature for Premium Users */}
        {USER_DATA.isPremium && (
          <ProfileSection title="Match Radio" icon="radio" isPremiumFeature>
            <View style={styles.premiumFeatureCard}>
              <View style={styles.premiumFeatureHeader}>
                <View>
                  <Text style={styles.premiumFeatureTitle}>
                    AI-Generated Playlists
                  </Text>
                  <Text style={styles.premiumFeatureSubtitle}>
                    Create custom playlists that blend your music taste with
                    your matches
                  </Text>
                </View>
                <View style={styles.featureIconContainer}>
                  <Feather name="radio" size={24} color="#3B82F6" />
                </View>
              </View>
              <TouchableOpacity style={styles.createButton}>
                <Text style={styles.createButtonText}>
                  Create a Match Radio
                </Text>
              </TouchableOpacity>
            </View>
          </ProfileSection>
        )}

        {/* Organizer Mode Button */}
        <TouchableOpacity
          style={styles.modeButton}
          onPress={toggleOrganizerMode}
        >
          <Feather name="briefcase" size={18} color="#FFF" />
          <Text style={styles.modeButtonText}>Switch to Organizer Mode</Text>
        </TouchableOpacity>
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
  background: {
    flex: 1,
  },
  scrollViewContainer: {
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
  logo: {
    height: 36,
    width: 36,
    resizeMode: "contain",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 80, // Space for tab bar
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
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  name: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
    marginRight: 8,
  },
  age: {
    fontSize: 14,
    color: "#6B7280",
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(155, 135, 245, 0.8)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  premiumText: {
    color: "white",
    fontSize: 10,
    fontWeight: "500",
    marginLeft: 3,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 16,
    width: "60%",
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: 20,
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
  separator: {
    backgroundColor: "#E5E7EB",
  },
  bio: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
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
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  toggleButtonText: {
    fontSize: 12,
    color: "#3B82F6",
    marginRight: 4,
  },
  toggleIcon: {
    transform: [{ rotate: "0deg" }],
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  genreTag: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    margin: 4,
  },
  genreTagText: {
    color: "#3B82F6",
    fontSize: 14,
  },
  analyticsCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  analyticsTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 12,
  },
  pieChartPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    height: 200,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 16,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#3B82F6",
    marginBottom: 12,
  },
  placeholderSubtext: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  listContainer: {
    marginBottom: 8,
  },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  listItemText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1F2937",
  },
  listItemSubtext: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  seeAllButtonText: {
    color: "#3B82F6",
    fontSize: 14,
    marginRight: 4,
  },
  premiumFeatureCard: {
    backgroundColor: "rgba(59, 130, 246, 0.05)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.1)",
  },
  premiumFeatureHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  premiumFeatureTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3B82F6",
    marginBottom: 4,
  },
  premiumFeatureSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    width: "85%",
  },
  featureIconContainer: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  createButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  createButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
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
});

export default ProfileScreen;
