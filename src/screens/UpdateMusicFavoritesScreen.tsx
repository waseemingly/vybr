import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '../hooks/useAuth';
import { useStreamingData, TopArtist, TopTrack } from '../hooks/useStreamingData';
import { supabase } from '../lib/supabase';
import { APP_CONSTANTS } from '../config/constants';

const UpdateMusicFavoritesScreen = () => {
  const { session, musicLoverProfile } = useAuth();
  const { topArtists, topTracks } = useStreamingData(session?.user?.id);
  const navigation = useNavigation();
  
  // Form state
  const [favoriteArtists, setFavoriteArtists] = useState('');
  const [favoriteAlbums, setFavoriteAlbums] = useState('');
  const [favoriteSongs, setFavoriteSongs] = useState('');
  
  // Error states
  const [artistsError, setArtistsError] = useState('');
  const [albumsError, setAlbumsError] = useState('');
  const [songsError, setSongsError] = useState('');
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Check if user is premium
  const isPremium = musicLoverProfile?.isPremium || false;
  const maxItems = isPremium ? 5 : 3;
  
  // Load existing data
  useEffect(() => {
    const loadFavorites = async () => {
      if (!session?.user?.id) return;
      
      try {
        setIsLoading(true);
        
        const { data, error } = await supabase
          .from('music_lover_profiles')
          .select('favorite_artists, favorite_albums, favorite_songs')
          .eq('user_id', session.user.id)
          .single();
          
        if (error) throw error;
        
        if (data) {
          setFavoriteArtists(data.favorite_artists || '');
          setFavoriteAlbums(data.favorite_albums || '');
          setFavoriteSongs(data.favorite_songs || '');
        }
      } catch (error) {
        console.error('Error loading music favorites:', error);
        Alert.alert('Error', 'Failed to load your music preferences');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadFavorites();
  }, [session?.user?.id]);
  
  // Utility functions
  const parseCsvString = (str: string): string[] => {
    return str.split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  };
  
  const formatTrackToArtistSong = (track: TopTrack): string => {
    const artistNames = track.artists.map(artist => artist.name).join(', ');
    return `${artistNames} - ${track.name}`;
  };
  
  const isValidSongFormat = (song: string): boolean => {
    // Check if the song is in "Artist Name - Song" format
    return song.includes(' - ') && song.split(' - ').length >= 2;
  };
  
  const checkForOverlaps = (
    favorites: string[], 
    topItems: Array<TopArtist | TopTrack>, 
    isArtist: boolean
  ): string[] => {
    const overlaps: string[] = [];
    
    favorites.forEach(favorite => {
      // For artists, direct comparison with top artist names
      if (isArtist) {
        const matchingArtist = topItems.find(
          (item) => (item as TopArtist).name.toLowerCase() === favorite.toLowerCase()
        );
        if (matchingArtist) {
          overlaps.push(favorite);
        }
      } 
      // For songs, compare with formatted top tracks
      else {
        const topTracksFormatted = topItems.map(track => 
          formatTrackToArtistSong(track as TopTrack).toLowerCase()
        );
        
        if (topTracksFormatted.includes(favorite.toLowerCase())) {
          overlaps.push(favorite);
        }
      }
    });
    
    return overlaps;
  };
  
  // Validation functions
  const validateArtists = (value: string): boolean => {
    const artists = parseCsvString(value);
    
    // Check limit
    if (artists.length > maxItems) {
      setArtistsError(`You can only have ${maxItems} favorite artists as a ${isPremium ? 'premium' : 'free'} user.`);
      return false;
    }
    
    setArtistsError('');
    return true;
  };
  
  const validateAlbums = (value: string): boolean => {
    const albums = parseCsvString(value);
    
    // Check limit
    if (albums.length > maxItems) {
      setAlbumsError(`You can only have ${maxItems} favorite albums as a ${isPremium ? 'premium' : 'free'} user.`);
      return false;
    }
    
    setAlbumsError('');
    return true;
  };
  
  const validateSongs = (value: string): boolean => {
    const songs = parseCsvString(value);
    
    // Check limit
    if (songs.length > maxItems) {
      setSongsError(`You can only have ${maxItems} favorite songs as a ${isPremium ? 'premium' : 'free'} user.`);
      return false;
    }
    
    // Check format
    const invalidSongs = songs.filter(song => !isValidSongFormat(song));
    if (invalidSongs.length > 0) {
      setSongsError(`The following songs are not in "Artist Name - Song" format: ${invalidSongs.join(', ')}`);
      return false;
    }
    
    // Check for overlaps with top tracks
    if (topTracks && topTracks.length > 0) {
      const overlaps = checkForOverlaps(songs, topTracks, false);
      if (overlaps.length > 0) {
        setSongsError(`The following songs overlap with your top tracks: ${overlaps.join(', ')}`);
        return false;
      }
    }
    
    setSongsError('');
    return true;
  };
  
  // Save changes
  const handleSave = async () => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in to save preferences');
      return;
    }
    
    // Validate all fields
    const isArtistsValid = validateArtists(favoriteArtists);
    const isAlbumsValid = validateAlbums(favoriteAlbums);
    const isSongsValid = validateSongs(favoriteSongs);
    
    if (!isArtistsValid || !isAlbumsValid || !isSongsValid) {
      Alert.alert('Validation Error', 'Please fix the errors before saving.');
      return;
    }
    
    try {
      setIsSaving(true);
      
      const { error } = await supabase
        .from('music_lover_profiles')
        .update({
          favorite_artists: favoriteArtists.trim(),
          favorite_albums: favoriteAlbums.trim(),
          favorite_songs: favoriteSongs.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', session.user.id);
        
      if (error) throw error;
      
      Alert.alert('Success', 'Your music favorites have been updated');
      navigation.goBack();
    } catch (error) {
      console.error('Error saving music favorites:', error);
      Alert.alert('Error', 'Failed to save your music preferences');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Character count indicator component
  const CharacterCount = ({ current, max, isError }: { current: number, max: number, isError: boolean }) => (
    <Text style={[styles.characterCount, isError && styles.characterCountError]}>
      {current}/{max}
    </Text>
  );
  
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.header}>
            <Feather name="music" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
            <Text style={styles.headerText}>Update Your Music Favorites</Text>
          </View>
          
          <Text style={styles.description}>
            Your music preferences help us connect you with like-minded music lovers.
            Separate multiple entries with commas. You can add up to {maxItems} items per category.
          </Text>
          
          <View style={styles.formContainer}>
            {/* Favorite Artists */}
            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <Text style={styles.label}>Favorite Artists</Text>
                <CharacterCount 
                  current={parseCsvString(favoriteArtists).length} 
                  max={maxItems} 
                  isError={!!artistsError}
                />
              </View>
              <TextInput
                style={[styles.input, artistsError ? styles.inputError : null]}
                value={favoriteArtists}
                onChangeText={(text) => {
                  setFavoriteArtists(text);
                  validateArtists(text);
                }}
                placeholder="e.g. Taylor Swift, The Weeknd, Drake"
                multiline
                placeholderTextColor="#9CA3AF"
              />
              {artistsError ? <Text style={styles.errorText}>{artistsError}</Text> : null}
            </View>
            
            {/* Favorite Albums */}
            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <Text style={styles.label}>Favorite Albums</Text>
                <CharacterCount 
                  current={parseCsvString(favoriteAlbums).length} 
                  max={maxItems} 
                  isError={!!albumsError}
                />
              </View>
              <TextInput
                style={[styles.input, albumsError ? styles.inputError : null]}
                value={favoriteAlbums}
                onChangeText={(text) => {
                  setFavoriteAlbums(text);
                  validateAlbums(text);
                }}
                placeholder="e.g. Abbey Road, DAMN., Blonde"
                multiline
                placeholderTextColor="#9CA3AF"
              />
              {albumsError ? <Text style={styles.errorText}>{albumsError}</Text> : null}
            </View>
            
            {/* Favorite Songs */}
            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <Text style={styles.label}>Favorite Songs</Text>
                <CharacterCount 
                  current={parseCsvString(favoriteSongs).length} 
                  max={maxItems} 
                  isError={!!songsError}
                />
              </View>
              <TextInput
                style={[styles.input, songsError ? styles.inputError : null]}
                value={favoriteSongs}
                onChangeText={(text) => {
                  setFavoriteSongs(text);
                  validateSongs(text);
                }}
                placeholder="e.g. The Weeknd - Blinding Lights, Taylor Swift - Cruel Summer"
                multiline
                placeholderTextColor="#9CA3AF"
              />
              {songsError ? <Text style={styles.errorText}>{songsError}</Text> : null}
              <Text style={styles.helpText}>Format: "Artist Name - Song Title"</Text>
            </View>
            
            {/* Save Button */}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Feather name="check" size={18} color="white" style={styles.buttonIcon} />
                  <Text style={styles.saveButtonText}>Save Preferences</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  headerText: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 10,
    color: '#1F2937',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    paddingHorizontal: 16,
    paddingBottom: 16,
    lineHeight: 20,
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    margin: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2.5,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 20,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  characterCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  characterCountError: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  helpText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
    borderRadius: 8,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 8,
  },
});

export default UpdateMusicFavoritesScreen; 