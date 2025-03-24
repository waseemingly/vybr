import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

// Sample search results
const SEARCH_RESULTS = [
  {
    id: "1",
    type: "artist",
    name: "Kendrick Lamar",
    image:
      "https://images.unsplash.com/photo-1468164016595-6108e4c60c8b?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
    genre: "Hip Hop",
  },
  {
    id: "2",
    type: "genre",
    name: "Jazz",
    count: "245 events",
  },
  {
    id: "3",
    type: "event",
    name: "Jazz Weekend Festival",
    date: "July 15-17, 2023",
    venue: "Esplanade",
  },
  {
    id: "4",
    type: "user",
    name: "Alex Rivera",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=crop&w=687&q=80",
    genres: ["Rock", "Alternative"],
  },
];

// Popular search categories
const POPULAR_SEARCHES = [
  { id: "1", name: "Jazz", icon: "music" },
  { id: "2", name: "Hip Hop", icon: "music" },
  { id: "3", name: "DJs", icon: "user" },
  { id: "4", name: "Near me", icon: "map-pin" },
];

const SearchScreen = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showResults, setShowResults] = useState(false);

  const handleSearch = () => {
    if (searchTerm.trim()) {
      setShowResults(true);
    }
  };

  const renderSearchResult = (result) => {
    switch (result.type) {
      case "artist":
        return (
          <TouchableOpacity
            key={result.id}
            style={styles.resultCard}
            activeOpacity={0.7}
          >
            <Image source={{ uri: result.image }} style={styles.resultImage} />
            <View style={styles.resultContent}>
              <Text style={styles.resultTitle}>{result.name}</Text>
              <Text style={styles.resultSubtitle}>Artist • {result.genre}</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        );

      case "genre":
        return (
          <TouchableOpacity
            key={result.id}
            style={styles.resultCard}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: "rgba(59, 130, 246, 0.1)" },
              ]}
            >
              <Feather name="music" size={24} color="#3B82F6" />
            </View>
            <View style={styles.resultContent}>
              <Text style={styles.resultTitle}>{result.name}</Text>
              <Text style={styles.resultSubtitle}>Genre • {result.count}</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        );

      case "event":
        return (
          <TouchableOpacity
            key={result.id}
            style={styles.resultCard}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: "rgba(96, 165, 250, 0.2)" },
              ]}
            >
              <Feather name="calendar" size={24} color="#3B82F6" />
            </View>
            <View style={styles.resultContent}>
              <Text style={styles.resultTitle}>{result.name}</Text>
              <Text style={styles.resultSubtitle}>
                {result.date} • {result.venue}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        );

      case "user":
        return (
          <TouchableOpacity
            key={result.id}
            style={styles.resultCard}
            activeOpacity={0.7}
          >
            <Image source={{ uri: result.image }} style={styles.resultImage} />
            <View style={styles.resultContent}>
              <Text style={styles.resultTitle}>{result.name}</Text>
              <View style={styles.tagsContainer}>
                {result.genres.map((genre, idx) => (
                  <View key={idx} style={styles.tag}>
                    <Text style={styles.tagText}>{genre}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Feather name="chevron-right" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.titleContainer}>
            <Feather
              name="search"
              size={22}
              color="#60A5FA"
              style={styles.headerIcon}
            />
            <Text style={styles.title}>Search</Text>
          </View>

          <Image
            source={{ uri: "https://yourappurl.com/logo.png" }}
            style={styles.logo}
          />
        </View>

        <Text style={styles.subtitle}>Find music lovers near you</Text>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchCard}>
          {/* Search Input */}
          <View style={styles.searchInputContainer}>
            <Feather
              name="search"
              size={20}
              color="#9CA3AF"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by artist, genre, or location"
              value={searchTerm}
              onChangeText={setSearchTerm}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <View style={styles.searchButtonsContainer}>
              <TouchableOpacity style={styles.searchActionButton}>
                <Feather name="mic" size={16} color="#6B7280" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.searchActionButton}>
                <Feather name="sliders" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Popular Searches */}
          <View style={styles.popularSearchesContainer}>
            <Text style={styles.sectionTitle}>Popular searches</Text>
            <View style={styles.popularTagsContainer}>
              {POPULAR_SEARCHES.map((item) => (
                <TouchableOpacity key={item.id} style={styles.popularTag}>
                  <Feather
                    name={item.icon}
                    size={16}
                    color="#3B82F6"
                    style={styles.popularTagIcon}
                  />
                  <Text style={styles.popularTagText}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Search Results */}
        {showResults && (
          <View style={styles.searchResultsContainer}>
            <Text style={styles.sectionTitle}>Search Results</Text>
            {SEARCH_RESULTS.map((result) => renderSearchResult(result))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
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
  logo: {
    height: 36,
    width: 36,
    resizeMode: "contain",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 52,
    marginBottom: 24,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
    height: "100%",
  },
  searchButtonsContainer: {
    flexDirection: "row",
  },
  searchActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  popularSearchesContainer: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  popularTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  popularTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    margin: 4,
  },
  popularTagIcon: {
    marginRight: 6,
  },
  popularTagText: {
    color: "#3B82F6",
    fontSize: 14,
  },
  searchResultsContainer: {
    marginTop: 8,
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  resultImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1F2937",
    marginBottom: 4,
  },
  resultSubtitle: {
    fontSize: 12,
    color: "#6B7280",
  },
  tagsContainer: {
    flexDirection: "row",
    marginTop: 4,
  },
  tag: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginRight: 4,
  },
  tagText: {
    fontSize: 10,
    color: "#4B5563",
  },
});

export default SearchScreen;
