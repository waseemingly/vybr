import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth';

// Types for streaming service data
export interface StreamingArtist {
  id: string;
  name: string;
  image_url?: string;
  external_url: string;
}

export interface StreamingTrack {
  id: string;
  name: string;
  artists: string[];
  album_name: string;
  image_url?: string;
  external_url: string;
}

export interface StreamingGenre {
  name: string;
  count: number;
}

export interface UserStreamingData {
  id: string;
  user_id: string;
  service_id: string;
  snapshot_date: string;
  last_updated: string;
  top_artists: StreamingArtist[];
  top_tracks: StreamingTrack[];
  top_genres: StreamingGenre[];
  raw_data?: any;
}

export const useStreamingData = (userId?: string) => {
  const [streamingData, setStreamingData] = useState<UserStreamingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isLoggedIn: isSpotifyLoggedIn, forceFetchAndSaveSpotifyData, updateUserListeningData } = useSpotifyAuth();

  // Derived state
  const serviceId = streamingData?.service_id || null;
  const topArtists = streamingData?.top_artists || [];
  const topTracks = streamingData?.top_tracks || [];
  const topGenres = streamingData?.top_genres || [];
  const hasData = !!(topArtists.length || topTracks.length || topGenres.length);

  // Fetch streaming data from Supabase
  const fetchStreamingData = useCallback(async (forceRefresh: boolean = false) => {
    if (!userId) {
      setError('No user ID provided');
      setLoading(false);
      return;
    }

    // Check if the user is on a premium plan to determine how much data we show
    let isPremium = false;
    try {
      const { data: profileData } = await supabase
        .from('music_lover_profiles')
        .select('is_premium')
        .eq('user_id', userId)
        .single();
      
      isPremium = profileData?.is_premium || false;
      console.log("[useStreamingData] User premium status:", isPremium ? "Premium" : "Free");
    } catch (err) {
      console.error("Error checking premium status:", err);
    }

    try {
      setLoading(true);
      setError(null);

      const today = new Date();
      const currentMonthDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];

      console.log(`Looking for streaming data for user ${userId} for date ${currentMonthDate}`);
      
      const { data, error } = await supabase
        .from('user_streaming_data')
        .select('*')
        .eq('user_id', userId)
        .eq('snapshot_date', currentMonthDate)
        .order('last_updated', { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error fetching streaming data:", error);
        setError(error.message);
        return;
      }

      if (data && data.length > 0) {
        console.log("Retrieved streaming data:", data[0].service_id);
        setStreamingData(data[0]);
      } else {
        console.log("No streaming data found in database");
        setStreamingData(null);
        
        // Try to update from Spotify if connected and we don't have data
        if (isSpotifyLoggedIn && forceRefresh) {
          console.log("Spotify is connected, attempting to fetch new data");
          const dataUpdated = await updateUserListeningData(userId, true, isPremium);
          
          if (dataUpdated) {
            console.log("Spotify data updated, fetching again");
            // Fetch again now that we've updated
            const { data: updatedData, error: updatedError } = await supabase
              .from('user_streaming_data')
              .select('*')
              .eq('user_id', userId)
              .eq('snapshot_date', currentMonthDate)
              .order('last_updated', { ascending: false })
              .limit(1);
            
            if (!updatedError && updatedData && updatedData.length > 0) {
              console.log("Retrieved updated streaming data:", updatedData[0].service_id);
              setStreamingData(updatedData[0]);
            } else if (updatedError) {
              console.error("Error fetching updated streaming data:", updatedError);
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Error in fetchStreamingData:", err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [userId, isSpotifyLoggedIn, updateUserListeningData]);

  // Load data when the component mounts or userId changes
  useEffect(() => {
    fetchStreamingData();
  }, [fetchStreamingData]);

  // ADDED: Direct function to force fetch data from Spotify and save it
  const forceFetchSpotifyData = useCallback(async (isPremium: boolean = false) => {
    if (!userId) {
      console.error("Cannot force fetch Spotify data: No user ID provided");
      return false;
    }
    
    if (!isSpotifyLoggedIn) {
      console.error("Cannot force fetch Spotify data: Not logged in to Spotify");
      return false;
    }
    
    console.log("Forcing fetch and save of Spotify data...");
    const success = await forceFetchAndSaveSpotifyData(userId, isPremium);
    
    if (success) {
      // If successful, refresh the component data
      await fetchStreamingData(true);
      return true;
    }
    
    return false;
  }, [userId, isSpotifyLoggedIn, forceFetchAndSaveSpotifyData, fetchStreamingData]);

  // Returned hook values
  return {
    streamingData,
    loading,
    error,
    fetchStreamingData,
    forceFetchSpotifyData, // Export the new function
    serviceId,
    topArtists,
    topTracks,
    topGenres,
    hasData
  };
}; 