import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from './useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { 
  calculateTopGenres, 
  calculateTopTracksFromRecent, 
  StreamingData, 
  TopArtist, 
  TopTrack, 
  TopAlbum, 
  TopGenre, 
  TopMood
} from './useStreamingData';
import * as AuthSession from 'expo-auth-session';
import { MUSIC_MOODS, generateGeminiMoodAnalysisPrompt, SongForMoodAnalysis, GeminiMoodResponseItem } from '@/lib/moods';

// --- APPLE MUSIC CONSTANTS ---
// Constants for Apple Music API
const APPLE_MUSIC_API_URL = 'https://api.music.apple.com/v1';
const APPLE_MUSIC_CATALOG_URL = 'https://api.music.apple.com/v1/catalog';
const AUTH_CALLBACK_SCHEME = 'vybr';

// Apple Music OAuth constants
const APPLE_MUSIC_CLIENT_ID = 'com.vybr.musickit.oauth'; // Your Services ID
const APPLE_MUSIC_CLIENT_SECRET = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlVKWThaVU1VNEQifQ.eyJpYXQiOjE3NjExOTY0MTgsImV4cCI6MTc3Njc0ODQxOCwiaXNzIjoiUjhVVjQ0OVdSWSJ9.QLrZ5zyEMQ9R-o825RMtaf2aiK811s6c7bfSnKdYWTM9ns_vpOUQ1LiGPzE2u-R_R2eB8qVpImwASdtAsuS8fQ';
const APPLE_MUSIC_REDIRECT_URI = process.env.APPLE_MUSIC_REDIRECT_URI || 'https://unmodern-sleeveless-ahmad.ngrok-free.dev/apple-music-callback';

// Apple Music auth scopes needed
const APPLE_MUSIC_SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-top-read',
  'user-read-recently-played',
  'user-library-read'
];

// Define token storage keys
const APPLE_MUSIC_ACCESS_TOKEN_KEY = 'apple_music_access_token';
const APPLE_MUSIC_REFRESH_TOKEN_KEY = 'apple_music_refresh_token';
const APPLE_MUSIC_TOKEN_EXPIRY_KEY = 'apple_music_token_expiry';
const APPLE_MUSIC_DEVELOPER_TOKEN_KEY = 'apple_music_developer_token';

// Apple Music API interfaces
interface AppleMusicTrack {
  id: string;
  type: 'songs';
  attributes: {
    name: string;
    artistName: string;
    albumName: string;
    durationInMillis: number;
    genreNames: string[];
    artwork: {
      url: string;
      width: number;
      height: number;
    };
    playParams?: {
      id: string;
      kind: string;
    };
  };
  relationships?: {
    artists: {
      data: AppleMusicArtist[];
    };
    albums: {
      data: AppleMusicAlbum[];
    };
  };
}

interface AppleMusicArtist {
  id: string;
  type: 'artists';
  attributes: {
    name: string;
    genreNames: string[];
    artwork?: {
      url: string;
      width: number;
      height: number;
    };
  };
}

interface AppleMusicAlbum {
  id: string;
  type: 'albums';
  attributes: {
    name: string;
    artistName: string;
    artwork: {
      url: string;
      height: number;
      width: number;
    };
  };
}

interface AppleMusicPlayHistory {
  id: string;
  type: 'play-history';
  attributes: {
    playDate: string;
    song: AppleMusicTrack;
  };
}

interface AppleMusicUserLibrary {
  data: AppleMusicTrack[];
  next?: string;
}

export const useAppleMusicAuth = () => {
  const { session } = useAuth();
  
  // Auth state
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isUpdatingListeningData, setIsUpdatingListeningData] = useState(false);

  // Apple Music credentials state
  const [appleMusicTeamId, setAppleMusicTeamId] = useState<string | null>(null);
  const [appleMusicKeyId, setAppleMusicKeyId] = useState<string | null>(null);
  const [appleMusicPrivateKey, setAppleMusicPrivateKey] = useState<string | null>(null);
  const [developerToken, setDeveloperToken] = useState<string | null>(null);
  const [credentialsLoaded, setCredentialsLoaded] = useState<boolean>(false);

  // Function to fetch Apple Music credentials from Supabase
  const fetchAppleMusicCredentials = async () => {
    try {
      const { data, error } = await supabase
        .from('api_credentials')
        .select('*')
        .eq('service', 'apple_music')
        .single();

      if (error) {
        console.error('Error fetching Apple Music credentials:', error);
        setError('Failed to load Apple Music credentials');
        return;
      }

      if (data) {
        setAppleMusicTeamId(data.team_id);
        setAppleMusicKeyId(data.key_id);
        setAppleMusicPrivateKey(data.private_key);
        setCredentialsLoaded(true);
        console.log('Apple Music credentials loaded successfully');
        console.log('Team ID:', data.team_id);
        console.log('Key ID:', data.key_id);
      }
    } catch (err: any) {
      console.error('Error fetching Apple Music credentials:', err);
      setError('Failed to load Apple Music credentials');
    }
  };

  // Generate JWT developer token for Apple Music API
  const generateDeveloperToken = useCallback(async () => {
    if (!appleMusicTeamId || !appleMusicKeyId || !appleMusicPrivateKey) {
      console.error('Missing Apple Music credentials for JWT generation');
      return null;
    }

    try {
      // This would typically be done on the server side for security
      // For now, we'll store the developer token in AsyncStorage
      const storedToken = await AsyncStorage.getItem(APPLE_MUSIC_DEVELOPER_TOKEN_KEY);
      if (storedToken) {
        setDeveloperToken(storedToken);
        return storedToken;
      }

      // In a real implementation, you'd generate the JWT here
      // For now, we'll need the developer token to be provided
      console.warn('Apple Music developer token needs to be generated server-side');
      return null;
    } catch (err: any) {
      console.error('Error generating Apple Music developer token:', err);
      return null;
    }
  }, [appleMusicTeamId, appleMusicKeyId, appleMusicPrivateKey]);

  // Load credentials on mount
  useEffect(() => {
    fetchAppleMusicCredentials();
  }, []);

  // Generate developer token when credentials are loaded
  useEffect(() => {
    if (credentialsLoaded) {
      generateDeveloperToken();
    }
  }, [credentialsLoaded, generateDeveloperToken]);

  // Check if tokens exist and are valid on mount
  useEffect(() => {
    const checkExistingTokens = async () => {
      try {
        const storedAccessToken = await AsyncStorage.getItem(APPLE_MUSIC_ACCESS_TOKEN_KEY);
        const storedRefreshToken = await AsyncStorage.getItem(APPLE_MUSIC_REFRESH_TOKEN_KEY);
        const storedExpiryTime = await AsyncStorage.getItem(APPLE_MUSIC_TOKEN_EXPIRY_KEY);
        
        if (storedAccessToken && storedRefreshToken && storedExpiryTime) {
          const expiryTime = parseInt(storedExpiryTime, 10);
          const now = Date.now();
          
          if (now >= expiryTime) {
            // Token expired, refresh it
            console.log('[useAppleMusicAuth] Existing token expired, attempting refresh.');
            refreshAccessToken(storedRefreshToken);
          } else {
            // Token is still valid
            console.log('[useAppleMusicAuth] Existing valid token found.');
            setAccessToken(storedAccessToken);
            setRefreshToken(storedRefreshToken);
            setExpiresAt(expiryTime);
            setIsLoggedIn(true);
            fetchUserProfile(storedAccessToken);
          }
        } else {
          console.log('[useAppleMusicAuth] No existing Apple Music tokens found.');
        }
      } catch (err: any) {
        console.error('Error checking Apple Music tokens:', err);
        setError('Failed to retrieve Apple Music authentication status');
      }
    };
    checkExistingTokens();
  }, []);

  // Refresh access token
  const refreshAccessToken = async (refreshToken: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Apple Music token refresh would be implemented here
      // This is a placeholder - actual implementation depends on Apple's OAuth flow
      console.log('Apple Music token refresh not yet implemented');
      
    } catch (err: any) {
      console.error('Error refreshing Apple Music token:', err);
      setError('Failed to refresh Apple Music token');
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch user profile
  const fetchUserProfile = async (token: string) => {
    try {
      if (!developerToken) {
        console.error('Developer token not available for Apple Music API calls');
        return;
      }

      // Apple Music doesn't have a direct user profile endpoint like Spotify
      // We'll use the user's library as a proxy for user data
      const response = await fetch(`${APPLE_MUSIC_API_URL}/me/library/songs`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Music-User-Token': token,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Apple Music API error: ${response.status}`);
      }

      const data = await response.json();
      setUserData(data);
      console.log('Apple Music user profile fetched successfully');
    } catch (err: any) {
      console.error('Error fetching Apple Music user profile:', err);
      setError('Failed to fetch Apple Music user profile');
    }
  };

  // Login function - Apple Music OAuth using Sign in with Apple
  const login = async () => {
    try {
      console.log('[useAppleMusicAuth] 🍎 Login function called');
      setIsLoading(true);
      setError(null);

      if (!developerToken) {
        console.log('[useAppleMusicAuth] ❌ Developer token not available');
        setError('Apple Music developer token not available');
        return;
      }

      console.log('[useAppleMusicAuth] Starting Apple Music OAuth flow...');

      // Apple Music uses Sign in with Apple for authentication
      // We need to implement this using Apple's OAuth flow
      const state = Math.random().toString(36).substring(7);
      const appleAuthUrl = `https://appleid.apple.com/auth/authorize?` +
        `client_id=${APPLE_MUSIC_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(APPLE_MUSIC_REDIRECT_URI)}&` +
        `response_type=code&` +
        `scope=name%20email&` +
        `state=${state}`;

      console.log('[useAppleMusicAuth] Opening Apple OAuth URL:', appleAuthUrl);

      // Open Apple's OAuth page in browser
      const result = await WebBrowser.openAuthSessionAsync(
        appleAuthUrl,
        APPLE_MUSIC_REDIRECT_URI
      );

      if (result.type === 'success' && result.url) {
        console.log('[useAppleMusicAuth] OAuth callback received:', result.url);
        
        // Parse the authorization code from the callback URL
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        
        if (code) {
          console.log('[useAppleMusicAuth] Authorization code received, exchanging for tokens...');
          
          // Exchange authorization code for access token
          const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: APPLE_MUSIC_CLIENT_ID,
              client_secret: APPLE_MUSIC_CLIENT_SECRET,
              code: code,
              grant_type: 'authorization_code',
              redirect_uri: APPLE_MUSIC_REDIRECT_URI
            })
          });

          if (!tokenResponse.ok) {
            throw new Error(`Token exchange failed: ${tokenResponse.status}`);
          }

          const tokens = await tokenResponse.json();
          console.log('[useAppleMusicAuth] Tokens received successfully');

          // Store tokens
          const accessToken = tokens.access_token;
          const refreshToken = tokens.refresh_token;
          const expiresIn = tokens.expires_in;
          const expiryTime = Date.now() + (expiresIn * 1000);

          // Save tokens to AsyncStorage
          await AsyncStorage.multiSet([
            [APPLE_MUSIC_ACCESS_TOKEN_KEY, accessToken],
            [APPLE_MUSIC_REFRESH_TOKEN_KEY, refreshToken],
            [APPLE_MUSIC_TOKEN_EXPIRY_KEY, expiryTime.toString()]
          ]);

          // Update state
          setAccessToken(accessToken);
          setRefreshToken(refreshToken);
          setExpiresAt(expiryTime);
          setIsLoggedIn(true);

          // Fetch user profile
          await fetchUserProfile(accessToken);

          console.log('[useAppleMusicAuth] Apple Music login successful');
        } else {
          throw new Error('No authorization code received');
        }
      } else if (result.type === 'cancel') {
        console.log('[useAppleMusicAuth] User cancelled OAuth flow');
        setError('Apple Music login was cancelled');
      } else {
        throw new Error('OAuth flow failed');
      }
      
    } catch (err: any) {
      console.error('Error during Apple Music login:', err);
      setError(`Failed to login to Apple Music: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Clear stored tokens
      await AsyncStorage.multiRemove([
        APPLE_MUSIC_ACCESS_TOKEN_KEY,
        APPLE_MUSIC_REFRESH_TOKEN_KEY,
        APPLE_MUSIC_TOKEN_EXPIRY_KEY
      ]);

      // Reset state
      setAccessToken(null);
      setRefreshToken(null);
      setExpiresAt(null);
      setIsLoggedIn(false);
      setUserData(null);

      console.log('Apple Music logout successful');
    } catch (err: any) {
      console.error('Error during Apple Music logout:', err);
      setError('Failed to logout from Apple Music');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch user's recently played tracks from Apple Music
  const fetchRecentlyPlayedTracks = async (token: string): Promise<AppleMusicTrack[]> => {
    try {
      if (!developerToken) {
        throw new Error('Developer token not available');
      }

      const response = await fetch(`${APPLE_MUSIC_API_URL}/me/history/heavy-rotation`, {
        headers: {
          'Authorization': `Bearer ${developerToken}`,
          'Music-User-Token': token,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Apple Music API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (err: any) {
      console.error('Error fetching Apple Music recently played tracks:', err);
      throw err;
    }
  };

  // Fetch user's library tracks
  const fetchUserLibraryTracks = async (token: string): Promise<AppleMusicTrack[]> => {
    try {
      if (!developerToken) {
        throw new Error('Developer token not available');
      }

      const response = await fetch(`${APPLE_MUSIC_API_URL}/me/library/songs`, {
        headers: {
          'Authorization': `Bearer ${developerToken}`,
          'Music-User-Token': token,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Apple Music API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (err: any) {
      console.error('Error fetching Apple Music library tracks:', err);
      throw err;
    }
  };

  // Process Apple Music tracks to match Spotify format
  const processAppleMusicTracks = (tracks: AppleMusicTrack[]): TopTrack[] => {
    return tracks.map(track => ({
      id: track.id,
      name: track.attributes.name,
      uri: `apple:music:track:${track.id}`,
      album: {
        id: track.relationships?.albums?.data[0]?.id || track.id,
        name: track.attributes.albumName,
        images: track.attributes.artwork?.url ? [{
          url: track.attributes.artwork.url.replace('{w}', '300').replace('{h}', '300'),
          height: 300,
          width: 300
        }] : []
      },
      artists: [{
        id: track.relationships?.artists?.data[0]?.id || track.attributes.artistName.toLowerCase().replace(/\s+/g, '-'),
        name: track.attributes.artistName
      }],
      popularity: 50, // Default popularity for Apple Music tracks
      played_count: 1 // Apple Music doesn't provide play counts in the same way
    }));
  };

  // Process Apple Music artists to match Spotify format
  const processAppleMusicArtists = (tracks: AppleMusicTrack[]): TopArtist[] => {
    const artistMap = new Map<string, TopArtist>();
    
    tracks.forEach(track => {
      const artistName = track.attributes.artistName;
      if (!artistMap.has(artistName)) {
        artistMap.set(artistName, {
          id: artistName.toLowerCase().replace(/\s+/g, '-'), // Generate ID from name
          name: artistName,
          genres: track.attributes.genreNames || [],
          images: track.attributes.artwork?.url ? [{
            url: track.attributes.artwork.url.replace('{w}', '300').replace('{h}', '300'),
            height: 300,
            width: 300
          }] : [],
          popularity: 50, // Default popularity
          uri: `apple:music:artist:${artistName.toLowerCase().replace(/\s+/g, '-')}`
        });
      }
    });

    return Array.from(artistMap.values());
  };

  // Process Apple Music albums to match Spotify format
  const processAppleMusicAlbums = (tracks: AppleMusicTrack[]): TopAlbum[] => {
    const albumMap = new Map<string, TopAlbum>();
    
    tracks.forEach(track => {
      const albumName = track.attributes.albumName;
      if (!albumMap.has(albumName)) {
        albumMap.set(albumName, {
          id: albumName.toLowerCase().replace(/\s+/g, '-'), // Generate ID from name
          name: albumName,
          artists: [{
            id: track.attributes.artistName.toLowerCase().replace(/\s+/g, '-'),
            name: track.attributes.artistName
          }],
          images: track.attributes.artwork?.url ? [{
            url: track.attributes.artwork.url.replace('{w}', '300').replace('{h}', '300'),
            height: 300,
            width: 300
          }] : [],
          uri: `apple:music:album:${albumName.toLowerCase().replace(/\s+/g, '-')}`
        });
      }
    });

    return Array.from(albumMap.values());
  };

  // Function to fetch, calculate, and save all Apple Music streaming data
  const fetchAndSaveAppleMusicData = async (isPremium: boolean = false): Promise<boolean> => {
    if (!accessToken || !session?.user?.id) {
      console.error('Missing Apple Music access token or user session');
      return false;
    }

    try {
      setIsUpdatingListeningData(true);
      setIsLoading(true);
      setError(null);

      console.log('[useAppleMusicAuth] Starting Apple Music data fetch...');

      // 1. Fetch user's library tracks and recently played
      const [libraryTracks, recentTracks] = await Promise.all([
        fetchUserLibraryTracks(accessToken),
        fetchRecentlyPlayedTracks(accessToken)
      ]);

      console.log(`[useAppleMusicAuth] Fetched ${libraryTracks.length} library tracks, ${recentTracks.length} recent tracks`);

      // 2. Combine and process tracks
      const allTracks = [...libraryTracks, ...recentTracks];
      const topTracks = processAppleMusicTracks(allTracks);
      const topArtists = processAppleMusicArtists(allTracks);
      const topAlbums = processAppleMusicAlbums(allTracks);

      // 3. Calculate genres from artists
      const topGenres = calculateTopGenres(topArtists);

      // 4. Calculate moods using Gemini (similar to Spotify implementation)
      const songsForMoodAnalysis: SongForMoodAnalysis[] = topTracks.slice(0, 50).map(track => ({
        title: track.name,
        artist: track.artists[0]?.name || 'Unknown Artist',
        album: track.album.name
      }));

      let topMoodsData: TopMood[] = [];
      if (songsForMoodAnalysis.length > 0) {
        try {
          const moodPrompt = generateGeminiMoodAnalysisPrompt(songsForMoodAnalysis);
          // This would call your Gemini API implementation
          // For now, we'll use default moods
          topMoodsData = MUSIC_MOODS.map(mood => ({
            name: mood.moodName,
            count: Math.floor(Math.random() * 10) + 1, // Placeholder
            score: Math.floor(Math.random() * 100) + 1 // Placeholder score
          }));
        } catch (moodError) {
          console.warn('Error calculating moods:', moodError);
          topMoodsData = [];
        }
      }

      // 5. Limit data to reasonable sizes
      const limitedTracks = topTracks.slice(0, 100);
      const limitedArtists = topArtists.slice(0, 50);
      const limitedAlbums = topAlbums.slice(0, 50);
      const limitedGenres = topGenres.slice(0, 20);

      // 6. Save to database using the same schema as Spotify
      const snapshotDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      const { error: saveError } = await supabase
        .from('user_streaming_data')
        .upsert({
          user_id: session.user.id,
          service_id: 'apple_music',
          snapshot_date: snapshotDate,
          last_updated: new Date().toISOString(),
          top_artists: limitedArtists,
          top_tracks: limitedTracks,
          top_albums: limitedAlbums,
          top_genres: limitedGenres,
          top_moods: topMoodsData,
          raw_data: {
            full_artists: topArtists,
            full_tracks: topTracks,
            full_albums: topAlbums,
            full_genres: topGenres,
            full_moods: topMoodsData
          }
        }, {
          onConflict: 'user_id,service_id,snapshot_date'
        });
      
      if (saveError) throw saveError;
      
      // Provide detailed feedback about data collection
      if (topArtists.length === 0 && topTracks.length === 0) {
        console.warn(`[useAppleMusicAuth] No music data found for user ${session.user.id}. This usually indicates insufficient Apple Music library or listening history.`);
        setError('No listening history found. Please add music to your Apple Music library and try refreshing your music data again.');
      } else if (topArtists.length > 0 || topTracks.length > 0) {
        console.log(`Successfully saved Apple Music data for user ${session.user.id}. Artists: ${limitedArtists.length}, Tracks: ${limitedTracks.length}, Genres: ${limitedGenres.length}, Moods: ${topMoodsData.length}`);
      }
      
      return true;
    } catch (err: any) {
      console.error('Error fetching and saving Apple Music data:', err);
      setError(`Failed to fetch and save Apple Music data: ${err.message}`);
      return false;
    } finally {
      setIsLoading(false);
      setIsUpdatingListeningData(false);
    }
  };

  return {
    // Auth state
    accessToken,
    refreshToken,
    expiresAt,
    isLoggedIn,
    isLoading,
    error,
    userData,
    isUpdatingListeningData,
    
    // Credentials
    credentialsLoaded,
    developerToken,
    
    // Auth functions
    login,
    logout,
    refreshAccessToken,
    fetchUserProfile,
    
    // Data functions
    fetchAndSaveAppleMusicData,
    fetchRecentlyPlayedTracks,
    fetchUserLibraryTracks,
    
    // Utility functions
    processAppleMusicTracks,
    processAppleMusicArtists,
    processAppleMusicAlbums
  };
};
