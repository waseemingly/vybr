import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";

interface MatchCardProps {
  id: string;
  name: string;
  image: string;
  bio: string;
  matchedArtists: string[];
  genres: string[];
  compatibilityScore: number;
  isPremium: boolean;
  isThrowback: boolean;
}

const { width } = Dimensions.get("window");
const cardWidth = Math.min(width - 32, 400);

const MatchCard = ({
  id,
  name,
  image,
  bio,
  matchedArtists,
  genres,
  compatibilityScore,
  isPremium,
  isThrowback,
}: MatchCardProps) => {
  return (
    <View style={styles.cardContainer}>
      {/* Profile Image */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: image }} style={styles.profileImage} />

        {/* Compatibility Badge */}
        <LinearGradient
          colors={["#3B82F6", "#60A5FA"]}
          style={styles.compatibilityBadge}
        >
          <Text style={styles.compatibilityText}>{compatibilityScore}%</Text>
          <Text style={styles.compatibilityLabel}>Match</Text>
        </LinearGradient>

        {/* Premium Badge */}
        {isPremium && (
          <View style={styles.premiumBadge}>
            <Feather name="star" size={12} color="#FCD34D" />
            <Text style={styles.premiumText}>Premium</Text>
          </View>
        )}

        {/* Throwback Badge */}
        {isThrowback && (
          <View style={styles.throwbackBadge}>
            <Feather name="clock" size={12} color="white" />
            <Text style={styles.throwbackText}>Throwback</Text>
          </View>
        )}
      </View>

      {/* Profile Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.bio}>{bio}</Text>

        {/* Matched Artists */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Matched Artists</Text>
          <View style={styles.tagContainer}>
            {matchedArtists.map((artist, index) => (
              <View key={`artist-${index}`} style={styles.tag}>
                <Text style={styles.tagText}>{artist}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Genres */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Genres</Text>
          <View style={styles.tagContainer}>
            {genres.map((genre, index) => (
              <View
                key={`genre-${index}`}
                style={[styles.tag, styles.genreTag]}
              >
                <Text style={[styles.tagText, styles.genreTagText]}>
                  {genre}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={[styles.actionButton, styles.messageButton]}>
            <Feather
              name="message-square"
              size={20}
              color="#3B82F6"
              style={styles.actionIcon}
            />
            <Text style={styles.messageButtonText}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.likeButton]}>
            <Feather
              name="heart"
              size={20}
              color="white"
              style={styles.actionIcon}
            />
            <Text style={styles.likeButtonText}>Like</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: cardWidth,
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  imageContainer: {
    height: cardWidth,
    width: "100%",
    position: "relative",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  compatibilityBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: "center",
  },
  compatibilityText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  compatibilityLabel: {
    color: "white",
    fontSize: 12,
    opacity: 0.9,
  },
  premiumBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  premiumText: {
    color: "#FCD34D",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  throwbackBadge: {
    position: "absolute",
    bottom: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  throwbackText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  infoContainer: {
    padding: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#1F2937",
  },
  bio: {
    fontSize: 14,
    color: "#4B5563",
    marginBottom: 16,
    lineHeight: 20,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },
  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  tag: {
    backgroundColor: "#EFF6FF",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    margin: 4,
  },
  tagText: {
    color: "#3B82F6",
    fontSize: 14,
  },
  genreTag: {
    backgroundColor: "#F3F4F6",
  },
  genreTagText: {
    color: "#6B7280",
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  actionIcon: {
    marginRight: 8,
  },
  messageButton: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  messageButtonText: {
    color: "#3B82F6",
    fontWeight: "600",
  },
  likeButton: {
    backgroundColor: "#3B82F6",
  },
  likeButtonText: {
    color: "white",
    fontWeight: "600",
  },
});

export default MatchCard;
