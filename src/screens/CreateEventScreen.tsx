import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

interface FormState {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  images: string[];
  artists: string[];
  songs: string[];
  genres: string[];
}

const CreateEventScreen: React.FC = () => {
  const [formState, setFormState] = useState<FormState>({
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
    images: [],
    artists: [],
    songs: [],
    genres: [],
  });

  const [artistInput, setArtistInput] = useState("");
  const [songInput, setSongInput] = useState("");
  const [genreInput, setGenreInput] = useState("");

  const handleChange = (name: string, value: string) => {
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddArtist = () => {
    if (artistInput.trim()) {
      setFormState((prev) => ({
        ...prev,
        artists: [...prev.artists, artistInput.trim()],
      }));
      setArtistInput("");
    }
  };

  const handleAddSong = () => {
    if (songInput.trim()) {
      setFormState((prev) => ({
        ...prev,
        songs: [...prev.songs, songInput.trim()],
      }));
      setSongInput("");
    }
  };

  const handleAddGenre = () => {
    if (genreInput.trim()) {
      setFormState((prev) => ({
        ...prev,
        genres: [...prev.genres, genreInput.trim()],
      }));
      setGenreInput("");
    }
  };

  const handleRemoveArtist = (index: number) => {
    setFormState((prev) => {
      const newArtists = [...prev.artists];
      newArtists.splice(index, 1);
      return { ...prev, artists: newArtists };
    });
  };

  const handleRemoveSong = (index: number) => {
    setFormState((prev) => {
      const newSongs = [...prev.songs];
      newSongs.splice(index, 1);
      return { ...prev, songs: newSongs };
    });
  };

  const handleRemoveGenre = (index: number) => {
    setFormState((prev) => {
      const newGenres = [...prev.genres];
      newGenres.splice(index, 1);
      return { ...prev, genres: newGenres };
    });
  };

  const handleSubmit = () => {
    console.log("Form submitted:", formState);
    // Here you would implement the API call to create the event
    alert("Event created successfully!");
  };

  const handleImageUpload = () => {
    // Normally would open image picker
    const mockImages = [
      "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80",
      "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80",
    ];
    setFormState((prev) => ({ ...prev, images: [...mockImages] }));
  };

  // Badge component
  const Badge = ({
    children,
    icon,
    onRemove,
  }: {
    children: React.ReactNode;
    icon: any;
    onRemove: () => void;
  }) => (
    <View style={styles.badge}>
      <Feather name={icon} size={12} color="#3B82F6" style={styles.badgeIcon} />
      <Text style={styles.badgeText}>{children}</Text>
      <TouchableOpacity onPress={onRemove} style={styles.badgeRemove}>
        <Feather name="x" size={12} color="#6B7280" />
      </TouchableOpacity>
    </View>
  );

  // Form Label component
  const Label = ({ children }: { children: React.ReactNode }) => (
    <Text style={styles.label}>{children}</Text>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["rgba(59, 130, 246, 0.05)", "white"]}
        style={styles.background}
      >
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
              <Text style={styles.title}>Create Event</Text>
            </View>

            <Image
              source={{ uri: "https://yourappurl.com/logo.png" }}
              style={styles.logo}
            />
          </View>
          <Text style={styles.subtitle}>Host your own music event</Text>
        </View>

        {/* Form */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.formContainer}
          showsVerticalScrollIndicator={false}
          scrollEnabled={true}
          nestedScrollEnabled={true}
        >
          {/* Event Images */}
          <View style={styles.formGroup}>
            <Label>Event Images</Label>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.imagesRow}
            >
              {formState.images.length > 0
                ? formState.images.map((img, index) => (
                    <View key={index} style={styles.imagePreview}>
                      <Image
                        source={{ uri: img }}
                        style={styles.previewImage}
                      />
                    </View>
                  ))
                : null}
              <TouchableOpacity
                style={styles.addImageButton}
                onPress={handleImageUpload}
              >
                <Feather name="image" size={24} color="#9CA3AF" />
                <Text style={styles.addImageText}>Add Image</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Event Title */}
          <View style={styles.formGroup}>
            <Label>Event Title</Label>
            <TextInput
              style={styles.input}
              placeholder="Give your event a name"
              value={formState.title}
              onChangeText={(text) => handleChange("title", text)}
            />
          </View>

          {/* Description */}
          <View style={styles.formGroup}>
            <Label>Description</Label>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What's this event about?"
              value={formState.description}
              onChangeText={(text) => handleChange("description", text)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Date and Time */}
          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
              <Label>Date</Label>
              <View style={styles.inputWithIcon}>
                <Feather
                  name="calendar"
                  size={16}
                  color="#9CA3AF"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.iconInput}
                  placeholder="Select date"
                  value={formState.date}
                  onChangeText={(text) => handleChange("date", text)}
                />
              </View>
            </View>
            <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
              <Label>Time</Label>
              <View style={styles.inputWithIcon}>
                <Feather
                  name="clock"
                  size={16}
                  color="#9CA3AF"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.iconInput}
                  placeholder="Select time"
                  value={formState.time}
                  onChangeText={(text) => handleChange("time", text)}
                />
              </View>
            </View>
          </View>

          {/* Location */}
          <View style={styles.formGroup}>
            <Label>Location</Label>
            <View style={styles.inputWithIcon}>
              <Feather
                name="map-pin"
                size={16}
                color="#9CA3AF"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.iconInput}
                placeholder="Where's the event?"
                value={formState.location}
                onChangeText={(text) => handleChange("location", text)}
              />
            </View>
          </View>

          {/* Genres */}
          <View style={styles.formGroup}>
            <Label>Music Genres</Label>
            <View style={styles.inputWithButton}>
              <View style={styles.inputWithIcon}>
                <Feather
                  name="music"
                  size={16}
                  color="#9CA3AF"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.iconInput}
                  placeholder="Add genre"
                  value={genreInput}
                  onChangeText={setGenreInput}
                  onSubmitEditing={handleAddGenre}
                />
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddGenre}
              >
                <Feather name="plus" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {formState.genres.length > 0 && (
              <View style={styles.badgesContainer}>
                {formState.genres.map((genre, index) => (
                  <Badge
                    key={index}
                    icon="tag"
                    onRemove={() => handleRemoveGenre(index)}
                  >
                    {genre}
                  </Badge>
                ))}
              </View>
            )}
          </View>

          {/* Artists */}
          <View style={styles.formGroup}>
            <Label>Featured Artists</Label>
            <View style={styles.inputWithButton}>
              <View style={styles.inputWithIcon}>
                <Feather
                  name="user"
                  size={16}
                  color="#9CA3AF"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.iconInput}
                  placeholder="Add artist"
                  value={artistInput}
                  onChangeText={setArtistInput}
                  onSubmitEditing={handleAddArtist}
                />
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddArtist}
              >
                <Feather name="plus" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {formState.artists.length > 0 && (
              <View style={styles.badgesContainer}>
                {formState.artists.map((artist, index) => (
                  <Badge
                    key={index}
                    icon="user"
                    onRemove={() => handleRemoveArtist(index)}
                  >
                    {artist}
                  </Badge>
                ))}
              </View>
            )}
          </View>

          {/* Songs */}
          <View style={styles.formGroup}>
            <Label>Featured Songs</Label>
            <View style={styles.inputWithButton}>
              <View style={styles.inputWithIcon}>
                <Feather
                  name="disc"
                  size={16}
                  color="#9CA3AF"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.iconInput}
                  placeholder="Add song"
                  value={songInput}
                  onChangeText={setSongInput}
                  onSubmitEditing={handleAddSong}
                />
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddSong}
              >
                <Feather name="plus" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {formState.songs.length > 0 && (
              <View style={styles.badgesContainer}>
                {formState.songs.map((song, index) => (
                  <Badge
                    key={index}
                    icon="disc"
                    onRemove={() => handleRemoveSong(index)}
                  >
                    {song}
                  </Badge>
                ))}
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Feather name="check" size={18} color="#fff" />
            <Text style={styles.submitButtonText}>Create Event</Text>
          </TouchableOpacity>
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
  },
  formContainer: {
    padding: 16,
    paddingBottom: 80, // Space for tab bar
  },
  formGroup: {
    marginBottom: 20,
  },
  formRow: {
    flexDirection: "row",
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "white",
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    backgroundColor: "white",
    paddingHorizontal: 12,
    paddingVertical: 0,
  },
  inputIcon: {
    marginRight: 8,
  },
  iconInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputWithButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  addButton: {
    backgroundColor: "#3B82F6",
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  badgesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  badgeIcon: {
    marginRight: 4,
  },
  badgeText: {
    fontSize: 14,
    color: "#3B82F6",
  },
  badgeRemove: {
    marginLeft: 6,
  },
  imagesRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginRight: 12,
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  addImageButton: {
    width: 120,
    height: 120,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
  },
  addImageText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});

export default CreateEventScreen;
