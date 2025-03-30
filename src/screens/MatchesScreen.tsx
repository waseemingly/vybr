import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import MatchCard from "@/components/MatchCard";
import { useIsMobile } from "@/hooks/use-mobile";

// Sample data for matches
const MATCHES = [
  {
    id: "1",
    name: "Sarah Chen",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80",
    bio: "Music is my escape. I'm a big fan of indie rock and alternative music. Always looking for new artists to discover and concerts to attend!",
    matchedArtists: ["Kendrick Lamar", "Anderson .Paak", "SZA"],
    genres: ["Hip Hop", "R&B", "Jazz Rap"],
    compatibilityScore: 87,
    isPremium: true,
    isThrowback: false,
  },
  {
    id: "2",
    name: "Alex Rivera",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80",
    bio: "Vinyl collector and music enthusiast. I play guitar in a local band and love discovering underground artists. Let's talk music!",
    matchedArtists: ["Tame Impala", "Arctic Monkeys", "The Strokes"],
    genres: ["Indie Rock", "Psychedelic Rock", "Alternative"],
    compatibilityScore: 92,
    isPremium: true,
    isThrowback: true,
  },
];

const MatchesScreen = () => {
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const currentMatch = MATCHES[currentMatchIndex];
  const isMobile = useIsMobile();

  const goToNextMatch = () => {
    if (currentMatchIndex < MATCHES.length - 1) {
      setCurrentMatchIndex(currentMatchIndex + 1);
    } else {
      setCurrentMatchIndex(0);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["rgba(59, 130, 246, 0.05)", "white"]}
        style={styles.background}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerInner}>
              <View style={styles.headerTitleRow}>
                <View style={styles.titleContainer}>
                  <Feather
                    name="heart"
                    size={22}
                    color="#60A5FA"
                    style={styles.headerIcon}
                  />
                  <Text style={styles.title}>Matches</Text>
                </View>
              </View>

              <View style={styles.headerSubtitleRow}>
                <Text style={styles.subtitle}>
                  Find your musical connection
                </Text>

                <TouchableOpacity
                  style={styles.nextButton}
                  activeOpacity={0.7}
                  onPress={goToNextMatch}
                >
                  <Text style={styles.nextButtonText}>Next match</Text>
                  <Feather name="arrow-right" size={16} color="#3B82F6" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            <MatchCard
              id={currentMatch.id}
              name={currentMatch.name}
              image={currentMatch.image}
              bio={currentMatch.bio}
              matchedArtists={currentMatch.matchedArtists}
              genres={currentMatch.genres}
              compatibilityScore={currentMatch.compatibilityScore}
              isPremium={currentMatch.isPremium}
              isThrowback={currentMatch.isThrowback}
            />
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  background: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80, // Space for tab bar
  },
  header: {
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerInner: {
    width: "100%",
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
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
  },
  nextButtonText: {
    color: "#3B82F6",
    marginRight: 4,
    fontSize: 14,
  },
  mainContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    alignItems: "center",
  },
});

export default MatchesScreen;
