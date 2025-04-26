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
import { supabase } from '../lib/supabase';
import { APP_CONSTANTS } from '../config/constants';

const UpdateMusicFavoritesScreen = () => {
  const { session, musicLoverProfile } = useAuth();
  const navigation = useNavigation();
  
  // Form state
  const [favoriteArtists, setFavoriteArtists] = useState('');
  const [favoriteAlbums, setFavoriteAlbums] = useState('');
  const [favoriteSongs, setFavoriteSongs] = useState('');
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
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
  
  // Save changes
  const handleSave = async () => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in to save preferences');
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
            Separate multiple entries with commas.
          </Text>
          
          <View style={styles.formContainer}>
            {/* Favorite Artists */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Favorite Artists</Text>
              <TextInput
                style={styles.input}
                value={favoriteArtists}
                onChangeText={setFavoriteArtists}
                placeholder="e.g. Taylor Swift, The Weeknd, Drake"
                multiline
                placeholderTextColor="#9CA3AF"
              />
            </View>
            
            {/* Favorite Albums */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Favorite Albums</Text>
              <TextInput
                style={styles.input}
                value={favoriteAlbums}
                onChangeText={setFavoriteAlbums}
                placeholder="e.g. Abbey Road, DAMN., Blonde"
                multiline
                placeholderTextColor="#9CA3AF"
              />
            </View>
            
            {/* Favorite Songs */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Favorite Songs</Text>
              <TextInput
                style={styles.input}
                value={favoriteSongs}
                onChangeText={setFavoriteSongs}
                placeholder="e.g. Bohemian Rhapsody, Blinding Lights, WAP"
                multiline
                placeholderTextColor="#9CA3AF"
              />
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
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 8,
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