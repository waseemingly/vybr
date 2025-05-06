import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// Type definitions
export type TopArtist = {
  id: string;
  name: string;
  genres: string[];
  images: { url: string; height: number; width: number }[];
  popularity: number;
  uri: string;
};

export type TopTrack = {
  id: string;
  name: string;
  uri: string;
  album: {
    id: string;
    name: string;
    images: { url: string; height: number; width: number }[];
  };
  artists: { id: string; name: string }[];
  popularity: number;
  played_count?: number; // For recently played calculation
};

export type TopAlbum = {
  id: string;
  name: string;
  artists: {
    id: string;
    name: string;
  }[];
  images: { url: string; height: number; width: number }[];
  uri: string;
};

export type TopGenre = {
  name: string;
  count: number;
  score: number;
};

export type StreamingData = {
  top_artists: TopArtist[];
  top_tracks: TopTrack[];
  top_albums: TopAlbum[];
  top_genres: TopGenre[];
  raw_data?: any;
};

export type StreamingServiceId = 'spotify' | 'apple_music' | 'youtubemusic' | 'deezer' | 'soundcloud' | 'tidal' | 'None' | '';

// Helper utility functions (outside the hook)
export const calculateTopGenres = (artists: TopArtist[]): TopGenre[] => {
  // Create a map to track genres and their scores
  const genreMap = new Map<string, { count: number; score: number }>();

  // Process each artist
  artists.forEach((artist) => {
    const artistPopularity = artist.popularity || 50; // Default to 50 if missing
    
    // Process each genre for this artist
    artist.genres.forEach((genre) => {
      const genreData = genreMap.get(genre) || { count: 0, score: 0 };
      
      // Increment count and add weighted score (popularity as weight)
      genreData.count += 1;
      genreData.score += artistPopularity;
      
      genreMap.set(genre, genreData);
    });
  });

  // Convert map to array of TopGenre objects
  const topGenres: TopGenre[] = Array.from(genreMap.entries()).map(([name, data]) => ({
    name,
    count: data.count,
    score: data.score,
  }));

  // Sort by score (descending)
  topGenres.sort((a, b) => b.score - a.score);

  return topGenres;
};

// This function is deprecated - we now get top tracks directly from Spotify API
// Kept for backwards compatibility but no longer used in the main data flow
export const calculateTopTracksFromRecent = (recentTracks: TopTrack[]): TopTrack[] => {
  // Create a map to track track counts
  const trackMap = new Map<string, TopTrack & { played_count: number }>();

  // Process each track
  recentTracks.forEach((track) => {
    const trackId = track.id;
    
    if (trackMap.has(trackId)) {
      // Increment play count if track already in map
      const existingTrack = trackMap.get(trackId)!;
      existingTrack.played_count = (existingTrack.played_count || 0) + 1;
      trackMap.set(trackId, existingTrack);
    } else {
      // Add new track to map with play count of 1
      trackMap.set(trackId, { ...track, played_count: 1 });
    }
  });

  // Convert map to array
  const topTracks: TopTrack[] = Array.from(trackMap.values());

  // Sort by play count (descending)
  topTracks.sort((a, b) => (b.played_count || 0) - (a.played_count || 0));

  return topTracks;
};

// Hook for streaming data operations
export const useStreamingData = (userId?: string | null, authProps?: {
  isSpotifyLoggedIn: boolean; 
  isYouTubeMusicLoggedIn: boolean;
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<StreamingServiceId | null>(null);
  const [topArtists, setTopArtists] = useState<TopArtist[]>([]);
  const [topTracks, setTopTracks] = useState<TopTrack[]>([]);
  const [topGenres, setTopGenres] = useState<TopGenre[]>([]);
  const [topAlbums, setTopAlbums] = useState<TopAlbum[]>([]);
  const [streamingData, setStreamingData] = useState<StreamingData | null>(null);
  const [hasData, setHasData] = useState<boolean>(false);
  
  // Save streaming data to database
  const saveStreamingData = async (
    serviceId: StreamingServiceId,
    data: StreamingData,
    isPremium: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      
      if (!userId) {
        throw new Error("User ID is required to save streaming data");
      }

      // Prepare the data based on premium status
      const limitedArtists = isPremium ? data.top_artists.slice(0, 5) : data.top_artists.slice(0, 3);
      const limitedTracks = isPremium ? data.top_tracks.slice(0, 5) : data.top_tracks.slice(0, 3);
      const limitedAlbums = isPremium ? data.top_albums.slice(0, 5) : data.top_albums.slice(0, 3);
      const limitedGenres = isPremium ? data.top_genres.slice(0, 5) : data.top_genres.slice(0, 3);
      
      // Create a snapshot date (today)
      const snapshotDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      // Save to Supabase using the new schema
      const { error } = await supabase
        .from('user_streaming_data')
        .upsert({
          user_id: userId,
          service_id: serviceId,
          snapshot_date: snapshotDate,
          last_updated: new Date().toISOString(),
          top_artists: limitedArtists,
          top_tracks: limitedTracks,
          top_albums: limitedAlbums, 
          top_genres: limitedGenres,
          raw_data: {
            full_artists: data.top_artists,
            full_tracks: data.top_tracks,
            full_albums: data.top_albums,
            full_genres: data.top_genres
          }
        }, {
          onConflict: 'user_id,service_id,snapshot_date'
        });

      if (error) throw error;

      console.log(`Saved streaming data for ${serviceId}`);
      return { success: true };
    } catch (error) {
      console.error('Error saving streaming data:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error saving streaming data' 
      };
    } finally {
      setLoading(false);
    }
  };

  // Get user's streaming data from database
  const getUserStreamingData = async (
    serviceId: StreamingServiceId
  ): Promise<{ data: StreamingData | null; error?: string }> => {
    try {
      setLoading(true);
      
      if (!userId) {
        return { data: null, error: "User ID is required to fetch streaming data" };
      }

      console.log(`[useStreamingData] Fetching data for user: ${userId}, service: ${serviceId}`);

      // Get the most recent snapshot for this user and service
      const { data, error, status } = await supabase
        .from('user_streaming_data')
        .select('*')
        .eq('user_id', userId)
        .eq('service_id', serviceId)
        .order('snapshot_date', { ascending: false })
        .limit(1);
      
      console.log(`[useStreamingData] Supabase response status: ${status}`);
      
      if (error) {
        // If no data found, return null without error
        if (error.code === 'PGRST116') {
          console.log(`[useStreamingData] No data found for ${serviceId}`);
          return { data: null };
        }
        
        // For 406 errors, log details
        if (status === 406) {
          console.error(`[useStreamingData] Content negotiation error (406): ${JSON.stringify(error)}`);
          return { data: null, error: `API error: ${error.message}` };
        }
        
        throw error;
      }

      if (!data || data.length === 0) {
        console.log(`[useStreamingData] No data returned for ${serviceId}`);
        return { data: null };
      }

      // Convert to StreamingData format for compatibility
      const streamingData: StreamingData = {
        top_artists: data[0].top_artists || [],
        top_tracks: data[0].top_tracks || [],
        top_albums: data[0].top_albums || [],
        top_genres: data[0].top_genres || [],
        raw_data: data[0].raw_data
      };
      
      console.log(`[useStreamingData] Successfully retrieved data for ${serviceId}: ${streamingData.top_artists.length} artists, ${streamingData.top_tracks.length} tracks`);

      return { data: streamingData };
    } catch (error) {
      console.error('[useStreamingData] Error getting streaming data:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error fetching streaming data' 
      };
    } finally {
      setLoading(false);
    }
  };

  // Check if a service is connected
  const isServiceConnected = async (service: string): Promise<boolean> => {
    if (!authProps) return false;
    
    try {
      if (service === 'spotify') {
        // Check if Spotify is connected by looking at the auth flag
        return authProps.isSpotifyLoggedIn;
      }
      
      if (service === 'youtubemusic') {
        // For YouTube Music, we need to check if there's an actual token stored
        if (!authProps.isYouTubeMusicLoggedIn) return false;
        
        // Import only the necessary utility functions from our new utility file
        const { getYTMToken } = await import('../lib/YoutubeMusicAuthUtils');
        
        // Check if tokens exist without using the hook
        try {
          const tokenInfo = await getYTMToken();
          return !!tokenInfo?.token;
        } catch (err) {
          console.error('[useStreamingData] Error checking YTM token:', err);
          return false;
        }
      }
      
      return false;
    } catch (error) {
      console.error(`[useStreamingData] Error checking service connection for ${service}:`, error);
      return false;
    }
  };

  // Force fetch data from a specific service - updated to support YouTube Music
  const forceFetchServiceData = async (
    service: 'spotify' | 'youtubemusic',
    isPremium: boolean
  ): Promise<boolean> => {
    if (!userId) return false;
    
    try {
      setLoading(true);
      
      if (service === 'spotify' && authProps?.isSpotifyLoggedIn) {
        // We're only handling Spotify API, not modifying Spotify code as requested
        // Use the existing pattern for Spotify
        const spotifyModule = await import('./useSpotifyAuth');
        const spotifyAuthHook = spotifyModule.useSpotifyAuth();
        
        if (spotifyAuthHook.forceFetchAndSaveSpotifyData) {
          return await spotifyAuthHook.forceFetchAndSaveSpotifyData(userId, isPremium);
        }
        return false;
      }
      
      if (service === 'youtubemusic' && authProps?.isYouTubeMusicLoggedIn) {
        try {
          // Import the utility module as a default export
          const YoutubeMusicDataUtils = (await import('@/lib/YoutubeMusicDataUtils')).default;
          
          // Call the utility function directly from the default export
          return await YoutubeMusicDataUtils.fetchAndSaveYouTubeMusicData(userId, isPremium);
        } catch (err) {
          console.error(`[useStreamingData] Error fetching YouTube Music data:`, err);
          return false;
        }
      }
      
      return false;
    } catch (err) {
      console.error(`[useStreamingData] Error fetching service data for ${service}:`, err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Fetch streaming data for the current user
  const fetchStreamingData = async (forceRefresh = false) => {
    if (!userId) return;
    
    try {
      setLoading(true);
      
      // Check main services
      const services: StreamingServiceId[] = ['spotify', 'youtubemusic'];
      
      // Try each service
      for (const service of services) {
        const isConnected = await isServiceConnected(service);
        
        if (isConnected) {
          console.log(`[useStreamingData] Fetching data for service: ${service}`);
          const result = await getUserStreamingData(service);
          
          if (result.data) {
            setStreamingData(result.data);
            setServiceId(service);
            setTopArtists(result.data.top_artists || []);
            setTopTracks(result.data.top_tracks || []);
            setTopGenres(result.data.top_genres || []);
            setTopAlbums(result.data.top_albums || []);
            setHasData(true);
            console.log(`[useStreamingData] Successfully loaded data for ${service}`);
            return;
          } else {
            console.log(`[useStreamingData] No data found for ${service}`);
          }
        } else {
          console.log(`[useStreamingData] Service ${service} is not connected`);
        }
      }
      
      // If we get here, no data was found
      console.log(`[useStreamingData] No streaming data found for any connected service`);
      setHasData(false);
      
    } catch (error) {
      console.error('[useStreamingData] Error in fetchStreamingData:', error);
      setHasData(false);
    } finally {
      setLoading(false);
    }
  };

  // Check user's premium status
  const checkPremiumStatus = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('music_lover_profiles')
        .select('is_premium')
        .eq('user_id', userId)
        .single();
        
      if (error) throw error;
      return data?.is_premium ?? false;
    } catch (err) {
      console.error("Error checking premium status:", err);
      return false;
    }
  };

  // Fetch data on hook initialization or userId change
  useEffect(() => {
    if (userId) {
      fetchStreamingData();
    }
  }, [userId]);

  return {
    loading,
    error,
    streamingData,
    topArtists,
    topTracks,
    topGenres,
    topAlbums,
    serviceId,
    hasData,
    saveStreamingData,
    getUserStreamingData,
    isServiceConnected,
    fetchStreamingData,
    forceFetchServiceData,
    checkPremiumStatus
  };
}; 