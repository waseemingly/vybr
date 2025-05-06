import React, { useState, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { useAuth } from './useAuth';
import * as muse from 'libmuse';
import { secureYouTubeMusicStore } from '@/lib/YoutubeMusicStore';
import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { getYTMToken } from '@/lib/YoutubeMusicAuthUtils';

// Interfaces matching Spotify for consistency (adapt based on actual YTM data)
interface SimplifiedArtist {
    id: string; // YTM Artist ID
    name: string;
    image_url?: string; // May need parsing from thumbnails
    external_url?: string; // Construct YTM URL if possible
}

interface SimplifiedTrack {
    id: string; // YTM Video ID
    name: string;
    artists: string[]; // Array of artist names
    album_name?: string; // May not always be present in history
    image_url?: string; // From thumbnails
    external_url?: string; // Construct YTM URL
    albumId?: string; // YTM Album ID if available
}

interface GenreCount {
    name: string;
    count: number;
}

interface YouTubeMusicLoginCode {
    device_code: string;
    user_code: string;
    verification_url: string;
    expires_in: number;
    interval: number;
}

// Define the structure for token info managed by libmuse (may need adjustment)
// libmuse manages this internally when using a store, but we might track state
interface YouTubeMusicTokenInfo {
    // Based on common OAuth patterns, adjust if libmuse differs
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number; // Milliseconds since epoch
}

// Keys for storing tokens securely
const SECURE_STORE_YTM_TOKEN_KEY = 'youtubeMusicAuthToken';
const SECURE_STORE_YTM_REFRESH_KEY = 'youtubeMusicRefreshToken';
const SECURE_STORE_YTM_EXPIRES_KEY = 'youtubeMusicTokenExpiresAt';

// Define interface for stored token info
interface StoredYTMTokenInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Absolute expiration timestamp (milliseconds since epoch)
  issuedAt: number; // When the token was issued (milliseconds since epoch)
}

// Interfaces for YouTube Music data models
export interface YTMArtist {
  id: string;
  name: string;
  thumbnails?: Array<{url: string, width: number, height: number}>;
  subscribers?: string;
  external_url?: string;
  popularity?: number; // Added for compatibility with top artist calculation
}

export interface YTMAlbum {
  id: string;
  name: string;
  artists?: YTMArtist[];
  year?: string;
  thumbnails?: Array<{url: string, width: number, height: number}>;
}

export interface YTMTrack {
  videoId: string;
  title: string;
  artists: YTMArtist[];
  album?: YTMAlbum;
  thumbnails?: Array<{url: string, width: number, height: number}>;
  isExplicit?: boolean;
  duration?: string;
  playCount?: number;
}

// YouTube Music history item interface from libmuse
interface HistoryItem {
  videoId: string;
  title: string;
  artists: YTMArtist[];
  album?: {
    name: string;
    id: string;
  };
  thumbnails: Array<{url: string; width: number; height: number}>;
  played: string; // ISO date string
}

// Custom type for history response from libmuse
interface HistoryResponse {
  items: any[]; // Using any here because the exact shape varies
  continuation?: string;
}

// YOUTUBE MUSIC AUTH TOKEN KEYS
const YTM_TOKEN_KEY = 'ytm_oauth_token';
const YTM_REFRESH_TOKEN_KEY = 'ytm_refresh_token';
const YTM_TOKEN_EXPIRY_KEY = 'ytm_token_expiry';

// Modified saveYTMToken with direct localStorage fallback for web
const saveYTMToken = async (token: string, refreshToken: string, expiresIn: number) => {
  try {
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + expiresIn);
    
    console.log(`[useYouTubeMusicAuth] Saving token to ${Platform.OS} platform`);
    
    // On web, use localStorage directly as SecureStore may not work reliably
    if (Platform.OS === 'web') {
      try {
        // Save debug info
        sessionStorage.setItem('ytm_debug_token_saved', 'true');
        sessionStorage.setItem('ytm_debug_token_time', new Date().toISOString());
        
        // Save actual tokens to localStorage
        localStorage.setItem(YTM_TOKEN_KEY, token);
        localStorage.setItem(YTM_REFRESH_TOKEN_KEY, refreshToken);
        localStorage.setItem(YTM_TOKEN_EXPIRY_KEY, expiryDate.toISOString());
        
        console.log('[useYouTubeMusicAuth] Saved tokens directly to localStorage');
        return true;
      } catch (e) {
        console.error('[useYouTubeMusicAuth] Failed to save tokens to localStorage:', e);
        return false;
      }
    }
    
    // For native platforms, use SecureStore
    await SecureStore.setItemAsync(YTM_TOKEN_KEY, token);
    await SecureStore.setItemAsync(YTM_REFRESH_TOKEN_KEY, refreshToken);
    await SecureStore.setItemAsync(YTM_TOKEN_EXPIRY_KEY, expiryDate.toISOString());
    
    console.log('[useYouTubeMusicAuth] Saved auth tokens to SecureStore');
    return true;
  } catch (err) {
    console.error('[useYouTubeMusicAuth] Error saving tokens:', err);
    return false;
  }
};

// Modified clearYTMTokens with direct localStorage fallback for web
const clearYTMTokens = async () => {
  try {
    // On web, use localStorage directly
    if (Platform.OS === 'web') {
      localStorage.removeItem(YTM_TOKEN_KEY);
      localStorage.removeItem(YTM_REFRESH_TOKEN_KEY);
      localStorage.removeItem(YTM_TOKEN_EXPIRY_KEY);
      sessionStorage.removeItem('ytm_debug_token_saved');
      sessionStorage.removeItem('ytm_debug_token_time');
    } else {
      // For native platforms, use SecureStore
      await SecureStore.deleteItemAsync(YTM_TOKEN_KEY);
      await SecureStore.deleteItemAsync(YTM_REFRESH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(YTM_TOKEN_EXPIRY_KEY);
    }
    
    console.log('[useYouTubeMusicAuth] Cleared all tokens');
    return true;
  } catch (err) {
    console.error('[useYouTubeMusicAuth] Error clearing tokens:', err);
    return false;
  }
};

// Initialize muse with our secure store and set context
const setupMuse = () => {
  try {
    console.log('[useYouTubeMusicAuth] Setting up muse with SecureYouTubeMusicStore');
    muse.setup({
      store: secureYouTubeMusicStore,
      debug: true,
    });
    
    return muse.get_option("auth");
  } catch (error) {
    console.error('[useYouTubeMusicAuth] Error initializing muse:', error);
    return null;
  }
};

// Hook for YouTube Music authentication and data fetching
export const useYouTubeMusicAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
  const [isUpdatingListeningData, setIsUpdatingListeningData] = useState(false);
  const [authObject, setAuthObject] = useState<any>(null);
  const initRef = useRef(false);
  
  // Initialize muse auth once
  useEffect(() => {
    if (!initRef.current) {
      const auth = setupMuse();
      setAuthObject(auth);
      initRef.current = true;
      
      // Check login status on init
      checkLoginStatus();
    }
  }, []);
  
  // Check if we have a valid token stored
  const checkLoginStatus = async () => {
    try {
      const tokenInfo = await getYTMToken();
      const isLoggedIn = !!tokenInfo?.token;
      setIsLoggedIn(isLoggedIn);
      console.log('[useYouTubeMusicAuth] Login status:', isLoggedIn);
      return isLoggedIn;
    } catch (err) {
      console.error('[useYouTubeMusicAuth] Error checking login status:', err);
      setIsLoggedIn(false);
      return false;
    }
  };
  
  // Login function - returns auth code info for UI display
  const login = async () => {
            setIsLoading(true);
            setError(null);
    
    try {
      if (!authObject) {
        throw new Error('YouTube Music auth not initialized');
      }
      
      // Get a login code from YouTube Music
      console.log('[useYouTubeMusicAuth] Getting login code...');
      const loginCode = await authObject.get_login_code();
      
            return {
        verificationUrl: loginCode.verification_url,
        userCode: loginCode.user_code,
        deviceCode: loginCode.device_code,
        interval: loginCode.interval,
                completion: async () => {
          try {
            console.log('[useYouTubeMusicAuth] Starting token polling...');
            
            // Start polling for token
            let tokenInfo = null;
            let attempts = 0;
            const maxAttempts = 30; // Poll for 5 minutes max (10s interval * 30)
            const pollInterval = loginCode.interval * 1000;
            
            while (!tokenInfo && attempts < maxAttempts) {
              try {
                // Add more detailed logging
                console.log(`[useYouTubeMusicAuth] Polling attempt ${attempts + 1}/${maxAttempts}`);
                
                // Try to get the token from the device code
                const response = await fetch('https://oauth2.googleapis.com/token', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                  body: new URLSearchParams({
                    client_id: '861556708454-d6dlm3lh05idd8npek18k6be8ba3oc68.apps.googleusercontent.com',
                    client_secret: 'SboVhoG9s0rNafixCSGGKXAT',
                    device_code: loginCode.device_code,
                    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                  }).toString(),
                });
                
                const data = await response.json();
                console.log('[useYouTubeMusicAuth] Token response:', JSON.stringify(data, null, 2));
                
                if (data.access_token) {
                  tokenInfo = data;
                  break;
                }
              } catch (err: any) {
                console.error('[useYouTubeMusicAuth] Polling error:', err.message);
                
                // If not authorization_pending, it's a real error
                if (!err.message?.includes('authorization_pending')) {
                  if (err.message?.includes('expired_token')) {
                    throw new Error('The code has expired. Please try again.');
                  }
                  throw err;
                }
              }
              
              attempts++;
              if (attempts < maxAttempts) {
                console.log(`[useYouTubeMusicAuth] Waiting ${pollInterval}ms before next poll...`);
                await new Promise(resolve => setTimeout(resolve, pollInterval));
              }
            }
            
            if (!tokenInfo) {
              throw new Error('Timeout waiting for authorization');
            }
            
            // Log detailed token info (exclude sensitive parts)
            console.log('[useYouTubeMusicAuth] Token received:', {
              access_token: tokenInfo.access_token ? '***' : undefined,
              refresh_token: tokenInfo.refresh_token ? '***' : undefined,
              expires_in: tokenInfo.expires_in,
              token_type: tokenInfo.token_type
            });
            
            try {
              // Save the tokens securely
              const saveResult = await saveYTMToken(
                tokenInfo.access_token,
                tokenInfo.refresh_token,
                tokenInfo.expires_in
              );
              
              if (!saveResult) {
                console.error('[useYouTubeMusicAuth] Failed to save tokens to SecureStore');
                throw new Error('Failed to save authentication tokens');
              }
              
              // Update login status
              setIsLoggedIn(true);
              
              // Verify token was actually saved correctly
              const verificationResult = await verifyTokenStorage();
              if (!verificationResult) {
                console.warn('[useYouTubeMusicAuth] Token verification failed after saving');
              }
              
              console.log('[useYouTubeMusicAuth] Login completed successfully');
              return true;
            } catch (saveErr) {
              console.error('[useYouTubeMusicAuth] Error saving tokens:', saveErr);
              throw saveErr;
            }
          } catch (err: any) {
            console.error('[useYouTubeMusicAuth] Error completing auth:', err);
            setError(err.message || 'Failed to complete YouTube Music authentication');
            return false;
          } finally {
            setIsLoading(false);
          }
                }
            };
    } catch (err: any) {
      console.error('[useYouTubeMusicAuth] Error getting login code:', err);
      setError(err.message || 'Failed to login with YouTube Music');
            setIsLoading(false);
            return null;
        }
  };

  // Logout function
  const logout = async () => {
    setIsLoading(true);
    try {
      // Clear tokens from our own SecureStore entries
      await clearYTMTokens();
      
      // Also clear libmuse store
      await secureYouTubeMusicStore.clearAllYtmData();
      console.log('[useYouTubeMusicAuth] Cleared token and data');
      
    setIsLoggedIn(false);
    Alert.alert('Logged Out', 'You have been logged out of YouTube Music');
    } catch (err: any) {
      console.error('[useYouTubeMusicAuth] Error during logout:', err);
      setError(err.message || 'Failed to logout');
    } finally {
      setIsLoading(false);
    }
  };

  // Set access token for API requests
  const prepareApiCall = async () => {
    const tokenInfo = await getYTMToken();
    if (!tokenInfo) {
      throw new Error('Not logged in to YouTube Music');
    }
    
    // If token needs refresh, we would handle that here
    if (tokenInfo.needsRefresh) {
      console.log('[useYouTubeMusicAuth] Token expired, attempting refresh...');
      try {
        // Refresh the token
        const response = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: '861556708454-d6dlm3lh05idd8npek18k6be8ba3oc68.apps.googleusercontent.com',
            client_secret: 'SboVhoG9s0rNafixCSGGKXAT',
            refresh_token: tokenInfo.refreshToken,
            grant_type: 'refresh_token',
          }).toString(),
        });
        
        const data = await response.json();
        
        if (data.access_token) {
          // Save the refreshed token
          await saveYTMToken(
            data.access_token,
            tokenInfo.refreshToken, // Keep the existing refresh token
            data.expires_in
          );
          console.log('[useYouTubeMusicAuth] Token refreshed successfully');
        } else {
          throw new Error('Failed to refresh token');
        }
      } catch (err) {
        console.error('[useYouTubeMusicAuth] Error refreshing token:', err);
        throw new Error('Token expired and refresh failed. Please login again.');
      }
    }
    
    // We'll use direct API calls with the token rather than relying on muse library
    // Store token for web console debugging
    if (Platform.OS === 'web') {
      try {
        sessionStorage.setItem('ytm_api_ready', 'true');
      } catch (e) {
        console.warn('[useYouTubeMusicAuth] Could not set sessionStorage flag:', e);
      }
    }
    
    return true;
  };

  // Get user history for the last 28 days
  const getHistory = async (): Promise<HistoryItem[]> => {
    try {
      // First ensure we're logged in and token is set
      const isReady = await prepareApiCall();
      if (!isReady) {
        throw new Error('Not logged in to YouTube Music');
      }
      
      console.log('[useYouTubeMusicAuth] Fetching history...');
      
      // Get history directly with fetch if muse gives trouble
      let historyItems = [];
      try {
        // Try with muse first
        const historyResponse = await muse.get_history() as unknown as { items: any[] };
        historyItems = historyResponse?.items || [];
      } catch (err) {
        console.error('[useYouTubeMusicAuth] Error with muse.get_history, falling back to direct API call:', err);
        
        // If muse fails, try direct API call as fallback
        const tokenInfo = await getYTMToken();
        if (!tokenInfo) throw new Error('Not logged in to YouTube Music');
        
        const response = await fetch('https://music.youtube.com/youtubei/v1/history/get_history?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenInfo.token}`,
            'Content-Type': 'application/json',
            'X-Goog-Request-Time': Date.now().toString(),
            'X-Origin': 'https://music.youtube.com'
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: "WEB_REMIX",
                clientVersion: "1.20230831.01.00"
              }
            }
          })
        });
        
        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        historyItems = data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicShelfRenderer?.contents || [];
      }
      
      // Process history items
      if (!Array.isArray(historyItems) || historyItems.length === 0) {
        console.log('[useYouTubeMusicAuth] No history items found');
        return [];
      }
      
      console.log(`[useYouTubeMusicAuth] Fetched ${historyItems.length} history items`);
      
      // Calculate the date 28 days ago
      const daysAgo28 = new Date();
      daysAgo28.setDate(daysAgo28.getDate() - 28);
      
      // Extract the correct data from history items based on the schema
      const processedItems = historyItems.map((item: any) => {
        // The structure depends on whether we're using muse or direct API
        const videoId = item.videoId || 
          item?.musicResponsiveListItemRenderer?.playlistItemData?.videoId || 
          item?.musicResponsiveListItemRenderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;
        
        const title = item.title?.runs?.[0]?.text || 
          item?.musicResponsiveListItemRenderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
        
        const artistName = (item.subtitles?.[0]?.runs?.[0]?.text) || 
          item?.musicResponsiveListItemRenderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
        
        const albumName = (item.subtitles?.[1]?.runs?.[0]?.text) || 
          item?.musicResponsiveListItemRenderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[2]?.text;
          
        const thumbnails = item.thumbnails || 
          item?.musicResponsiveListItemRenderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
          
        const playedDate = item.played?.text || 
          item?.musicResponsiveListItemRenderer?.flexColumns?.[4]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || 
          new Date().toISOString();
          
        return {
          videoId: videoId || '',
          title: title || 'Unknown Title',
          artists: [{ 
            id: '', 
            name: artistName || 'Unknown Artist' 
          }],
          album: albumName ? {
            name: albumName,
            id: ''
          } : undefined,
          thumbnails: thumbnails,
          played: playedDate
        };
      }).filter((item: any) => item.videoId && item.title); // Filter out items with missing video ID or title
      
      // Filter for recent items (last 28 days)
      const recentItems = processedItems.filter((item: any) => {
        const playedDate = new Date(item.played);
        return !isNaN(playedDate.getTime()) && playedDate >= daysAgo28;
      });
      
      console.log(`[useYouTubeMusicAuth] Found ${recentItems.length} items from the last 28 days`);
      return recentItems;
    } catch (err: any) {
      console.error('[useYouTubeMusicAuth] Error fetching history:', err);
      throw new Error(`Failed to fetch YouTube Music history: ${err.message}`);
    }
  };

  // Calculate top songs from history
  const calculateTopSongs = (historyItems: HistoryItem[], limit: number): YTMTrack[] => {
    // Count occurrences of each song
    const songMap = new Map<string, YTMTrack & { playCount: number }>();
    
    historyItems.forEach(item => {
      const songId = item.videoId;
      
      if (songMap.has(songId)) {
        // Increment play count
        const existing = songMap.get(songId)!;
        existing.playCount = (existing.playCount || 0) + 1;
        songMap.set(songId, existing);
      } else {
        // Add new song with play count 1
        songMap.set(songId, {
          videoId: item.videoId,
          title: item.title,
          artists: item.artists,
          album: item.album,
          thumbnails: item.thumbnails,
          playCount: 1
        });
      }
    });
    
    // Convert to array and sort by play count
    const topSongs = Array.from(songMap.values())
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, limit);
    
    console.log(`[useYouTubeMusicAuth] Calculated top ${topSongs.length} songs`);
    return topSongs;
  };

  // Calculate top artists from history
  const calculateTopArtists = (historyItems: HistoryItem[], limit: number): YTMArtist[] => {
    // Count occurrences of each artist
    const artistMap = new Map<string, { artist: YTMArtist, count: number }>();
    
    historyItems.forEach(item => {
      item.artists.forEach(artist => {
        const artistName = artist.name;
        
        if (artistMap.has(artistName)) {
          // Increment count
          const existing = artistMap.get(artistName)!;
          existing.count += 1;
          artistMap.set(artistName, existing);
        } else {
          // Add new artist with count 1
          artistMap.set(artistName, {
            artist: artist,
            count: 1
          });
        }
      });
    });
    
    // Convert to array and sort by count
    const topArtists = Array.from(artistMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(item => ({
        ...item.artist,
        popularity: item.count // Add popularity for compatibility with Spotify format
      }));
    
    console.log(`[useYouTubeMusicAuth] Calculated top ${topArtists.length} artists`);
    return topArtists;
  };

  // Fetch Spotify genre data for artists
  const fetchGenresForArtists = async (artists: YTMArtist[]): Promise<string[]> => {
    if (artists.length === 0) return [];
    
    try {
      console.log(`[useYouTubeMusicAuth] Fetching genre data for ${artists.length} artists`);
      
      // For each artist name, query Spotify's artist info from our database
      const artistGenres: string[] = [];
      
      for (const artist of artists) {
        // Query supabase for artist genres
        const { data, error } = await supabase
          .from('spotify_artists_metadata')
          .select('genres')
          .ilike('name', artist.name)
          .limit(1);
        
        if (error) {
          console.error(`[useYouTubeMusicAuth] Error fetching genre for ${artist.name}:`, error);
          continue;
        }
        
        if (data && data.length > 0 && data[0].genres) {
          // Add all genres from this artist
          if (Array.isArray(data[0].genres)) {
            artistGenres.push(...data[0].genres);
          }
        }
      }
      
      console.log(`[useYouTubeMusicAuth] Found ${artistGenres.length} total genres`);
      return artistGenres;
    } catch (err: any) {
      console.error('[useYouTubeMusicAuth] Error fetching genres:', err);
      return [];
    }
  };

  // Calculate top genres from artist genres
  const calculateTopGenres = (genres: string[], limit: number): { name: string, count: number }[] => {
    // Count occurrences of each genre
    const genreMap = new Map<string, number>();
    
    genres.forEach(genre => {
      const count = genreMap.get(genre) || 0;
      genreMap.set(genre, count + 1);
    });
    
    // Convert to array and sort by count
    const topGenres = Array.from(genreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
    
    console.log(`[useYouTubeMusicAuth] Calculated top ${topGenres.length} genres`);
    return topGenres;
  };

  // Main function to fetch and save YouTube Music data
  const forceFetchAndSaveYouTubeMusicData = async (
    userId: string,
    isPremium: boolean
  ): Promise<boolean> => {
    console.log(`[useYouTubeMusicAuth] Starting data fetch for user ${userId}, premium: ${isPremium}`);
    setIsLoading(true);
        setIsUpdatingListeningData(true);

        try {
      // First check if we're actually logged in
      const loggedIn = await checkLoginStatus();
      if (!loggedIn) {
        console.error('[useYouTubeMusicAuth] Not logged in to YouTube Music');
        return false;
      }
      
      // Determine the limit based on premium status
      const limit = isPremium ? 5 : 3;
      
      // 1. Get user history
      const historyItems = await getHistory();
      if (!historyItems.length) {
        console.warn('[useYouTubeMusicAuth] No history items found');
        return false;
      }
      
      // 2. Calculate top songs and artists
      const topSongs = calculateTopSongs(historyItems, limit);
      const topArtists = calculateTopArtists(historyItems, limit);
      
      // 3. Get genres for artists and calculate top genres
      const artistGenres = await fetchGenresForArtists(topArtists);
      const topGenres = calculateTopGenres(artistGenres, limit);
      
      // 4. Format data for storage in database
      const formattedData = {
        top_tracks: topSongs.map(song => ({
          id: song.videoId,
          name: song.title,
          uri: `https://music.youtube.com/watch?v=${song.videoId}`,
          album: {
            id: song.album?.id || '',
            name: song.album?.name || 'Unknown Album',
            images: song.thumbnails?.map(t => ({
              url: t.url,
              height: t.height,
              width: t.width
            })) || []
          },
          artists: song.artists.map(a => ({ id: a.id || '', name: a.name })),
          popularity: song.playCount || 0
        })),
        top_artists: topArtists.map(artist => ({
          id: artist.id || `ytm-artist-${artist.name.replace(/\s+/g, '-').toLowerCase()}`,
          name: artist.name,
          genres: [], // We'll use the separate genres list
          images: artist.thumbnails?.map(t => ({
            url: t.url,
            height: t.height,
            width: t.width
          })) || [],
          popularity: artist.popularity || 50,
          uri: artist.external_url || `https://music.youtube.com/channel/${artist.id}`
        })),
        top_genres: topGenres.map(genre => ({
          name: genre.name,
          count: genre.count,
          score: genre.count * 10 // Simple score calculation
        })),
        top_albums: [] // YouTube Music doesn't easily provide top albums data
      };
      
      // 5. Save to Supabase using existing schema
      const snapshotDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      const { error } = await supabase
        .from('user_streaming_data')
        .upsert({
          user_id: userId,
          service_id: 'youtubemusic',
          snapshot_date: snapshotDate,
          last_updated: new Date().toISOString(),
          top_artists: formattedData.top_artists,
          top_tracks: formattedData.top_tracks,
          top_genres: formattedData.top_genres,
          top_albums: formattedData.top_albums,
          raw_data: {
            history_count: historyItems.length,
            full_artists: formattedData.top_artists,
            full_tracks: formattedData.top_tracks,
            full_genres: formattedData.top_genres
          }
        }, {
          onConflict: 'user_id,service_id,snapshot_date'
        });
      
      if (error) {
        console.error('[useYouTubeMusicAuth] Error saving to Supabase:', error);
        throw new Error(`Failed to save YouTube Music data: ${error.message}`);
      }
      
      console.log(`[useYouTubeMusicAuth] Successfully saved data for user ${userId}`);
      return true;
    } catch (err: any) {
      console.error('[useYouTubeMusicAuth] Error in forceFetchAndSaveYouTubeMusicData:', err);
      setError(err.message || 'Error fetching YouTube Music data');
            return false;
        } finally {
      setIsLoading(false);
            setIsUpdatingListeningData(false);
    }
    };

  // After the completion function completes successfully, check login status
  // this will help verify if our token was correctly saved and can be retrieved
  const verifyTokenStorage = async (): Promise<boolean> => {
    try {
      // Wait a brief moment for storage operations to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try to get the token
      const tokenInfo = await getYTMToken();
      const hasToken = !!tokenInfo?.token;
      
      console.log(`[useYouTubeMusicAuth] Token verification: ${hasToken ? 'SUCCESS' : 'FAILED'}`);
      
      // Update login state
      setIsLoggedIn(hasToken);
      return hasToken;
    } catch (err) {
      console.error('[useYouTubeMusicAuth] Error verifying token storage:', err);
      return false;
    }
  };

    return {
        login,
    logout,
    isLoggedIn,
        isLoading,
    error,
        isUpdatingListeningData,
    forceFetchAndSaveYouTubeMusicData,
    checkLoginStatus,
    verifyTokenStorage
    };
};