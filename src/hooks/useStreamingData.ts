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

export type TopMood = {
  name: string;
  score: number; // Using score similar to genres, can be based on count or weighted
  count: number; // Explicit count of occurrences
};

export type StreamingData = {
  top_artists: TopArtist[];
  top_tracks: TopTrack[];
  top_albums: TopAlbum[];
  top_genres: TopGenre[];
  top_moods?: TopMood[]; // Added top_moods, optional for now
  raw_data?: any;
  snapshot_date?: string; // Added
  last_updated?: string;  // Added
};

export type StreamingServiceId = 'spotify' | 'apple_music' | 'deezer' | 'soundcloud' | 'tidal' | 'None' | ''; // Removed youtubemusic

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
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<StreamingServiceId | null>(null);
  const [topArtists, setTopArtists] = useState<TopArtist[]>([]);
  const [topTracks, setTopTracks] = useState<TopTrack[]>([]);
  const [topGenres, setTopGenres] = useState<TopGenre[]>([]);
  const [topAlbums, setTopAlbums] = useState<TopAlbum[]>([]);
  const [topMoods, setTopMoods] = useState<TopMood[]>([]); // Added topMoods state
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
      // For moods, premium users get top 3. Free users might not get this, or it's handled by the calling function.
      // Assuming top_moods in `data` is already prepared (e.g., top 3 if premium, empty/null otherwise)
      const finalTopMoods = data.top_moods || [];
      
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
          top_moods: finalTopMoods, // Added top_moods
          raw_data: {
            full_artists: data.top_artists,
            full_tracks: data.top_tracks,
            full_albums: data.top_albums,
            full_genres: data.top_genres,
            full_moods: data.raw_data?.full_moods // Store all categorized moods if available
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
      const dbRecord = data[0];
      const streamingDataResult: StreamingData = {
        top_artists: dbRecord.top_artists || [],
        top_tracks: dbRecord.top_tracks || [],
        top_albums: dbRecord.top_albums || [],
        top_genres: dbRecord.top_genres || [],
        top_moods: dbRecord.top_moods || [], // Added top_moods
        raw_data: dbRecord.raw_data,
        snapshot_date: dbRecord.snapshot_date, // Populate
        last_updated: dbRecord.last_updated,    // Populate
      };
      
      console.log(`[useStreamingData] Successfully retrieved data for ${serviceId}: ${streamingDataResult.top_artists.length} artists, ${streamingDataResult.top_tracks.length} tracks, ${streamingDataResult.top_moods?.length || 0} moods, snapshot: ${streamingDataResult.snapshot_date}`);

      return { data: streamingDataResult };
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
      
      return false;
    } catch (error) {
      console.error(`[useStreamingData] Error checking service connection for ${service}:`, error);
      return false;
    }
  };

  // Force fetch data from a specific service - updated to support YouTube Music
  const forceFetchServiceData = async (
    service: 'spotify', // Only spotify now
    isPremium: boolean
  ): Promise<boolean> => {
    if (!userId) return false;
    
    try {
      setLoading(true);
      
      if (service === 'spotify' && authProps?.isSpotifyLoggedIn) {
        // We're only handling Spotify API, not modifying Spotify code as requested
        // Use the existing pattern for Spotify
        const spotifyModule = await import('./useSpotifyAuth'); // This might cause a circular dependency if useSpotifyAuth imports useStreamingData. Check this.
                                                                // It's generally better if useSpotifyAuth calls a method from useStreamingData or updates context/state.
                                                                // For now, proceeding with caution.
        const spotifyAuthHook = spotifyModule.useSpotifyAuth(); // This creates a new instance of useSpotifyAuth, which might not be intended if state is involved.
                                                                 // The forceFetchAndSaveSpotifyData should ideally be part of useSpotifyAuth and directly called.
                                                                 // Or this hook should expose a method that useSpotifyAuth can call.
                                                                 // The current pattern in ProfileScreen.tsx for forceFetch is to call `forceFetchServiceData` from `useStreamingData`.
                                                                 // Let's assume `forceFetchAndSaveSpotifyData` is meant to be called from `useSpotifyAuth` context itself.
                                                                 // This part needs careful review of how `forceFetchAndSaveSpotifyData` is structured in `useSpotifyAuth`.

        // The User's request implies that the `forceFetchAndSaveSpotifyData` in `useSpotifyAuth`
        // will be updated to include mood fetching. So this call should remain.
        if (spotifyAuthHook.forceFetchAndSaveSpotifyData) {
          return await spotifyAuthHook.forceFetchAndSaveSpotifyData(userId, isPremium);
        }
        return false;
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
    if (!userId) return; // userId here is the one passed to the hook, can be current user or other user

    try {
      setLoading(true);
      setError(null); // Clear previous errors at the start
      console.log(`[useStreamingData] Attempting to fetch latest streaming data for user: ${userId}`);

      // Get the most recent snapshot for this user from user_streaming_data
      const { data: dbData, error: dbError, status } = await supabase
        .from('user_streaming_data')
        .select('*') // Select all necessary fields including service_id, top_artists, etc.
        .eq('user_id', userId)
        .order('snapshot_date', { ascending: false }) // Get the latest snapshot
        .limit(1)
        .maybeSingle(); // Use maybeSingle to handle null gracefully if no record found

      if (dbError) {
        console.error(`[useStreamingData] Supabase error fetching latest data for user ${userId}:`, dbError);
        // PGRST116 means no rows found, which is handled by dbData being null.
        // Only treat other errors as actual fetch errors.
        if (dbError.code !== 'PGRST116') {
            setError(dbError.message);
        }
        // Clear all data states if there's an error or no data
        setHasData(false);
        setStreamingData(null);
        setServiceId(null);
        setTopArtists([]);
        setTopTracks([]);
        setTopGenres([]);
        setTopAlbums([]);
        setTopMoods([]);
        setLoading(false);
        return;
      }

      if (dbData) { // A record was found
        console.log(`[useStreamingData] Latest data record found for user ${userId}:`, JSON.stringify(dbData).substring(0, 300) + "...");
        
        const streamingDataResult: StreamingData = {
          top_artists: dbData.top_artists || [],
          top_tracks: dbData.top_tracks || [],
          top_albums: dbData.top_albums || [],
          top_genres: dbData.top_genres || [],
          top_moods: dbData.top_moods || [],
          raw_data: dbData.raw_data, // This likely contains the full, non-premium limited data
          snapshot_date: dbData.snapshot_date,
          last_updated: dbData.last_updated,
        };

        setStreamingData(streamingDataResult);
        setServiceId(dbData.service_id as StreamingServiceId || null);
        
        // When displaying another user's profile, we should show what's in their limited fields
        // (top_artists, top_tracks etc.) as these are what they "share" based on their premium status at time of save.
        // The 'raw_data' might contain more, but that's for their own full view or potential future use.
        setTopArtists(streamingDataResult.top_artists);
        setTopTracks(streamingDataResult.top_tracks);
        setTopGenres(streamingDataResult.top_genres);
        setTopAlbums(streamingDataResult.top_albums);
        setTopMoods(streamingDataResult.top_moods || []);
        
        // Determine hasData based on if there are any top items.
        // This is important because an empty record might exist.
        const hasAnyData = (streamingDataResult.top_artists.length > 0 ||
                            streamingDataResult.top_tracks.length > 0 ||
                            streamingDataResult.top_genres.length > 0 ||
                            streamingDataResult.top_albums.length > 0 ||
                            (streamingDataResult.top_moods && streamingDataResult.top_moods.length > 0)
                           ) || false;
        setHasData(hasAnyData);
        
        console.log(`[useStreamingData] Successfully processed data for user ${userId} from service ${dbData.service_id}. Has Data: ${hasAnyData}. Artists: ${streamingDataResult.top_artists.length}, Tracks: ${streamingDataResult.top_tracks.length}, Moods: ${streamingDataResult.top_moods?.length || 0}, Snapshot: ${streamingDataResult.snapshot_date}`);
      } else {
        // No data record found for this user
        console.log(`[useStreamingData] No streaming data record found for user ${userId} in user_streaming_data table.`);
        setHasData(false);
        setStreamingData(null);
        setServiceId(null);
        setTopArtists([]);
        setTopTracks([]);
        setTopGenres([]);
        setTopAlbums([]);
        setTopMoods([]);
      }
    } catch (error: any) {
      console.error('[useStreamingData] Critical error in fetchStreamingData:', error);
      setError(error.message || 'Unknown error fetching streaming data');
      setHasData(false);
      setStreamingData(null);
      setServiceId(null);
      setTopArtists([]);
      setTopTracks([]);
      setTopGenres([]);
      setTopAlbums([]);
      setTopMoods([]);
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
    topMoods, // Added topMoods
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