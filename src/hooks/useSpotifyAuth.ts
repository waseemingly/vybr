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
  TopGenre 
} from './useStreamingData';
import * as AuthSession from 'expo-auth-session';

// --- HARDCODED SPOTIFY CONSTANTS ---
// Constants for Spotify API
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';
const CLIENT_ID = '7724af6090634c3db7c82fd54f1a0fff';
const CLIENT_SECRET = '6b5182f34c854e4ba3642f225f9b9ed6'; // Add client secret
const AUTH_CALLBACK_SCHEME = 'vybr';
const REGISTERED_WEB_REDIRECT_URI = 'http://127.0.0.1:8081/callback';

// For Web, use the explicit redirect URI. For native, AuthSession will generate one.
const explicitWebRedirectUri = REGISTERED_WEB_REDIRECT_URI || 
                        `${AUTH_CALLBACK_SCHEME}://spotify-auth-callback`;

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

// Define Spotify auth scopes needed
const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-top-read',
  'user-read-recently-played',
  'user-library-read'
];

// Define token storage keys
const SPOTIFY_ACCESS_TOKEN_KEY = 'spotify_access_token';
const SPOTIFY_REFRESH_TOKEN_KEY = 'spotify_refresh_token';
const SPOTIFY_TOKEN_EXPIRY_KEY = 'spotify_token_expiry';

WebBrowser.maybeCompleteAuthSession(); // Recommended for web and standalone builds

export const useSpotifyAuth = () => {
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

  // Determine the redirect URI based on the platform
  const redirectUri = Platform.select({
    web: REGISTERED_WEB_REDIRECT_URI, // Always use the registered URI for web
    default: AuthSession.makeRedirectUri({
      native: `${AUTH_CALLBACK_SCHEME}://spotify-auth-callback`, 
      // For native, AuthSession might use a proxy or require specific setup if not using custom scheme directly
    }),
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: SPOTIFY_SCOPES,
      redirectUri: redirectUri, // Use the platform-specific redirectUri
      usePKCE: false, // Disable PKCE since we'll use client secret
      extraParams: {
        show_dialog: 'true',
        scope: SPOTIFY_SCOPES.join(' ') // Explicitly include scopes as a space-separated string
      },
    },
    discovery
  );

  // Check if tokens exist and are valid on mount
  useEffect(() => {
    const checkExistingTokens = async () => {
       try {
        const storedAccessToken = await AsyncStorage.getItem(SPOTIFY_ACCESS_TOKEN_KEY);
        const storedRefreshToken = await AsyncStorage.getItem(SPOTIFY_REFRESH_TOKEN_KEY);
        const storedExpiryTime = await AsyncStorage.getItem(SPOTIFY_TOKEN_EXPIRY_KEY);
        
        if (storedAccessToken && storedRefreshToken && storedExpiryTime) {
          const expiryTime = parseInt(storedExpiryTime, 10);
          const now = Date.now();
          
          if (now >= expiryTime) {
            // Token expired, refresh it
            console.log('[useSpotifyAuth] Existing token expired, attempting refresh.');
            refreshAccessToken(storedRefreshToken);
          } else {
            // Token is still valid
            console.log('[useSpotifyAuth] Existing valid token found.');
            setAccessToken(storedAccessToken);
            setRefreshToken(storedRefreshToken);
            setExpiresAt(expiryTime);
            setIsLoggedIn(true);
            fetchUserProfile(storedAccessToken);
          }
        } else {
          console.log('[useSpotifyAuth] No existing Spotify tokens found.');
        }
      } catch (err: any) {
        console.error('Error checking Spotify tokens:', err);
        setError('Failed to retrieve Spotify authentication status');
      }
    };
    checkExistingTokens();
  }, []);

  // Handle the authentication response
  useEffect(() => {
    if (response) {
      setIsLoading(true);
      console.log('[useSpotifyAuth] AuthSession response:', JSON.stringify(response, null, 2));
      
      // Remove automatic dismissal - let the browser window close naturally
      // WebBrowser.dismissAuthSession();
      
      if (response.type === 'error') {
        setError(response.error?.message || response.params.error_description || 'Authentication error');
        setIsLoading(false);
      } else if (response.type === 'success') {
        const { code } = response.params;
        if (code) {
          console.log(`[useSpotifyAuth] AuthSession success, obtained code: ${code}`);
          exchangeCodeForToken(code);
        } else {
          setError('Authentication successful but no code received.');
          setIsLoading(false);
        }
      } else if (response.type === 'cancel' || response.type === 'dismiss') {
        setError('Authentication cancelled or dismissed.');
        setIsLoading(false);
      }
    }
  }, [response]);

  // Function to exchange authorization code for tokens
  const exchangeCodeForToken = async (code: string) => {
    try {
      console.log('[useSpotifyAuth] Exchanging code for token using client credentials');
      
      // Manually make the token request instead of using AuthSession.exchangeCodeAsync
      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('code', code);
      params.append('redirect_uri', redirectUri);
      params.append('client_id', CLIENT_ID);
      params.append('client_secret', CLIENT_SECRET);
      
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('[useSpotifyAuth] Token exchange failed:', errorData);
        throw new Error(errorData.error_description || 'Failed to exchange code for token');
      }
      
      const tokenResult = await response.json();
      console.log('[useSpotifyAuth] Token exchange result:', JSON.stringify({
        ...tokenResult,
        access_token: 'REDACTED',
        refresh_token: tokenResult.refresh_token ? 'REDACTED' : null,
        scope: tokenResult.scope // Log the granted scopes
      }, null, 2));

      // Log the granted scopes to help debug permission issues
      if (tokenResult.scope) {
        console.log('[useSpotifyAuth] Granted scopes:', tokenResult.scope);
        // Check if we got all required scopes
        const grantedScopes = tokenResult.scope.split(' ');
        const missingScopes = SPOTIFY_SCOPES.filter(scope => !grantedScopes.includes(scope));
        if (missingScopes.length > 0) {
          console.warn('[useSpotifyAuth] Some requested scopes were not granted:', missingScopes);
        }
      }

      const newAccessToken = tokenResult.access_token;
      const newRefreshToken = tokenResult.refresh_token;
      const expiresIn = tokenResult.expires_in;
      const now = Date.now();
      const expiryTime = now + (expiresIn * 1000) - 60000; // Convert to ms, 60s buffer

      await AsyncStorage.setItem(SPOTIFY_ACCESS_TOKEN_KEY, newAccessToken);
      if (newRefreshToken) {
        await AsyncStorage.setItem(SPOTIFY_REFRESH_TOKEN_KEY, newRefreshToken);
      }
      await AsyncStorage.setItem(SPOTIFY_TOKEN_EXPIRY_KEY, expiryTime.toString());
      
      setAccessToken(newAccessToken);
      if (newRefreshToken) {
        setRefreshToken(newRefreshToken);
      }
      setExpiresAt(expiryTime);
      setIsLoggedIn(true);
      setError(null);
      console.log('[useSpotifyAuth] Tokens stored, user is logged in.');
      
      await fetchUserProfile(newAccessToken);

    } catch (err: any) {
      console.error('Error exchanging code for token:', err);
      setError(err.message || 'Failed to complete Spotify authentication');
      setIsLoggedIn(false);
      await clearTokens(); 
    } finally {
      setIsLoading(false);
    }
  };

  // Function to refresh the access token using client credentials
  const refreshAccessToken = async (currentRefreshToken: string) => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('[useSpotifyAuth] Refreshing token with client credentials');
      
      // Manually make the refresh token request
      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', currentRefreshToken);
      params.append('client_id', CLIENT_ID);
      params.append('client_secret', CLIENT_SECRET);
      
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('[useSpotifyAuth] Token refresh failed:', errorData);
        throw new Error(errorData.error_description || 'Failed to refresh token');
      }
      
      const tokenResult = await response.json();
      console.log('[useSpotifyAuth] Token refresh result:', JSON.stringify({
        ...tokenResult,
        access_token: 'REDACTED',
        refresh_token: tokenResult.refresh_token ? 'REDACTED' : null,
      }, null, 2));

      const newAccessToken = tokenResult.access_token;
      const newRefreshTokenFromRefresh = tokenResult.refresh_token; // Spotify might return a new one
      const expiresIn = tokenResult.expires_in;
      const now = Date.now();
      const newExpiryTime = now + (expiresIn * 1000) - 60000; // Convert to ms, 60s buffer

      await AsyncStorage.setItem(SPOTIFY_ACCESS_TOKEN_KEY, newAccessToken);
      const finalRefreshToken = newRefreshTokenFromRefresh || currentRefreshToken;
      await AsyncStorage.setItem(SPOTIFY_REFRESH_TOKEN_KEY, finalRefreshToken);
      await AsyncStorage.setItem(SPOTIFY_TOKEN_EXPIRY_KEY, newExpiryTime.toString());
      
      setAccessToken(newAccessToken);
      setRefreshToken(finalRefreshToken);
      setExpiresAt(newExpiryTime);
      setIsLoggedIn(true);
      
      await fetchUserProfile(newAccessToken);
    } catch (err: any) {
      console.error('Error refreshing Spotify token:', err);
      setError(err.message || 'Failed to refresh Spotify access token');
      setIsLoggedIn(false);
      await clearTokens();
    } finally {
      setIsLoading(false);
    }
  };

  // Clear all stored tokens
  const clearTokens = async () => {
    try {
      await AsyncStorage.removeItem(SPOTIFY_ACCESS_TOKEN_KEY);
      await AsyncStorage.removeItem(SPOTIFY_REFRESH_TOKEN_KEY);
      await AsyncStorage.removeItem(SPOTIFY_TOKEN_EXPIRY_KEY);
      
      setAccessToken(null);
      setRefreshToken(null);
      setExpiresAt(null);
      setIsLoggedIn(false);
      setUserData(null);
      console.log('[useSpotifyAuth] Cleared Spotify tokens.');
    } catch (err: any) {
      console.error('Error clearing Spotify tokens:', err);
    }
  };

  // Function to initiate Spotify login
  const login = useCallback(async () => {
    setError(null);
    console.log('[useSpotifyAuth] Prompting Spotify login...');
    console.log(`[useSpotifyAuth] Requested scopes: ${SPOTIFY_SCOPES.join(', ')}`);
    console.log(`[useSpotifyAuth] Redirect URI: ${redirectUri}`);
    
    if (!request) {
      console.error('[useSpotifyAuth] Auth request is not available. Cannot prompt.');
      setError('Spotify authentication setup failed. Please try again.');
      return;
    }
    
    // Reset logged in state when starting the auth flow
    setIsLoggedIn(false);
    
    try {
      // Clear any existing tokens before starting a new auth flow
      await clearTokens();
      
      console.log('[useSpotifyAuth] Starting authentication flow...');
      const result = await promptAsync();
      console.log('[useSpotifyAuth] promptAsync result type:', result?.type);
      
      if (result?.type === 'error' || result?.type === 'cancel' || result?.type === 'dismiss') {
        setIsLoading(false); 
        if (result.type === 'error') {
          console.error('[useSpotifyAuth] Auth error:', result.error);
          setError(result.error?.message || 'Login failed')
        } else {
          setError('Login cancelled or dismissed');
        }
      }
    } catch (err: any) {
      console.error('[useSpotifyAuth] Error during promptAsync:', err);
      setError(err.message || 'Failed to start Spotify authentication');
      setIsLoading(false);
    }
  }, [request, promptAsync]);

  // Function to fetch user profile
  const fetchUserProfile = async (token: string) => {
    try {
      const response = await fetch(`${SPOTIFY_API_URL}/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserData(data);
      } else {
        // If 401 Unauthorized, token is invalid
        if (response.status === 401 && refreshToken) {
          // Try to refresh the token
          refreshAccessToken(refreshToken);
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to fetch user profile');
        }
      }
    } catch (err: any) {
      console.error('Error fetching Spotify user profile:', err);
      
      // Only set error if it's not a token refresh issue
      if (err.message !== 'Failed to fetch user profile') {
        setError(err.message);
      }
    }
  };

  // Function to logout
  const logout = async () => {
    await clearTokens();
    Alert.alert('Logged Out', 'You have been logged out of Spotify');
  };

  // Function to get the user's top artists
  const getTopArtists = async (timeRange: 'short_term' | 'medium_term' | 'long_term' = 'short_term', limit: number = 50): Promise<TopArtist[]> => {
    if (!accessToken) {
      throw new Error('Not authenticated with Spotify');
    }
    
    try {
      const response = await fetch(`${SPOTIFY_API_URL}/me/top/artists?time_range=${timeRange}&limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.items.map((item: any) => ({
          id: item.id,
          name: item.name,
          genres: item.genres || [],
          images: item.images || [],
          popularity: item.popularity || 0,
          uri: item.uri
        }));
      } else {
        // Handle token refresh if needed
        if (response.status === 401 && refreshToken) {
          await refreshAccessToken(refreshToken);
          // Retry after token refresh
          return getTopArtists(timeRange, limit);
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to fetch top artists');
        }
      }
    } catch (err: any) {
      console.error('Error fetching Spotify top artists:', err);
      throw err;
    }
  };

  // Function to get the user's top tracks directly instead of recently played
  const getTopTracks = async (timeRange: 'short_term' | 'medium_term' | 'long_term' = 'short_term', limit: number = 50): Promise<TopTrack[]> => {
    if (!accessToken) {
      throw new Error('Not authenticated with Spotify');
    }
    
    try {
      // Use the /me/top/tracks endpoint (requires user-top-read scope)
      const response = await fetch(`${SPOTIFY_API_URL}/me/top/tracks?time_range=${timeRange}&limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.items.map((item: any) => ({
          id: item.id,
          name: item.name,
          uri: item.uri,
          album: {
            id: item.album.id,
            name: item.album.name,
            images: item.album.images || []
          },
          artists: item.artists.map((artist: any) => ({ 
            id: artist.id || '', 
            name: artist.name 
          })),
          popularity: item.popularity || 0
        }));
      } else {
        // Handle token refresh if needed
        if (response.status === 401 && refreshToken) {
          await refreshAccessToken(refreshToken);
          // Retry after token refresh
          return getTopTracks(timeRange, limit);
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to fetch top tracks');
        }
      }
    } catch (err: any) {
      console.error('Error fetching Spotify top tracks:', err);
      throw err;
    }
  };

  // Keep the getRecentlyPlayedTracks for backward compatibility, but mark as deprecated
  // Function to get the user's recently played tracks
  const getRecentlyPlayedTracks = async (limit: number = 50): Promise<TopTrack[]> => {
    console.warn('getRecentlyPlayedTracks is deprecated. Use getTopTracks instead for better music taste analysis.');
    if (!accessToken) {
      throw new Error('Not authenticated with Spotify');
    }
    
    try {
      const response = await fetch(`${SPOTIFY_API_URL}/me/player/recently-played?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.items.map((item: any) => ({
          id: item.track.id,
          name: item.track.name,
          uri: item.track.uri,
          album: {
            id: item.track.album.id,
            name: item.track.album.name,
            images: item.track.album.images || []
          },
          artists: item.track.artists.map((artist: any) => ({ 
            id: artist.id || '', 
            name: artist.name 
          })),
          popularity: item.track.popularity || 0
        }));
      } else {
        // Handle token refresh if needed
        if (response.status === 401 && refreshToken) {
          await refreshAccessToken(refreshToken);
          // Retry after token refresh
          return getRecentlyPlayedTracks(limit);
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to fetch recently played tracks');
        }
      }
    } catch (err: any) {
      console.error('Error fetching Spotify recently played tracks:', err);
      throw err;
    }
  };

  // Helper function to extract unique albums from tracks
  const extractTopAlbums = (tracks: TopTrack[]): TopAlbum[] => {
    const albumMap = new Map<string, { 
      id: string; 
      name: string; 
      artists: { id: string; name: string }[];
      images: { url: string; height: number; width: number }[];
      uri: string;
      count: number;
    }>();
    
    tracks.forEach(track => {
      const albumId = track.album.id;
      if (albumMap.has(albumId)) {
        const existing = albumMap.get(albumId)!;
        existing.count++;
        albumMap.set(albumId, existing);
      } else {
        albumMap.set(albumId, {
          id: albumId,
          name: track.album.name,
          artists: track.artists,
          images: track.album.images,
          uri: `spotify:album:${albumId}`,
          count: 1
        });
      }
    });
    
    // Convert to array and sort by play count
    return Array.from(albumMap.values())
      .sort((a, b) => b.count - a.count)
      .map(({ id, name, artists, images, uri }) => ({
        id, name, artists, images, uri
      }));
  };

  // Function to fetch, calculate, and save all streaming data
  const fetchAndSaveSpotifyData = async (isPremium: boolean = false): Promise<boolean> => {
    if (!accessToken || !session?.user?.id) {
      return false;
    }
    
    setIsLoading(true);
    setError(null);
    setIsUpdatingListeningData(true);
    
    try {
      // 1. Fetch top artists (last 4 weeks)
      const topArtists = await getTopArtists('short_term', 50);
      
      // 2. Calculate top genres from artists
      const topGenres = calculateTopGenres(topArtists);
      
      // 3. Get top tracks directly instead of recently played
      const topTracks = await getTopTracks('short_term', 50);
      
      // 4. Extract top albums from top tracks
      const albumMap = new Map<string, TopAlbum>();
      topTracks.forEach(track => {
        if (track.album && !albumMap.has(track.album.id)) {
          albumMap.set(track.album.id, {
            id: track.album.id,
            name: track.album.name,
            images: track.album.images,
            artists: track.artists.length > 0 ? [track.artists[0]] : [],
            uri: `spotify:album:${track.album.id}`
          });
        }
      });
      const topAlbums = Array.from(albumMap.values());
      
      // 5. Prepare the data based on premium status
      const limitedArtists = isPremium ? topArtists.slice(0, 5) : topArtists.slice(0, 3);
      const limitedTracks = isPremium ? topTracks.slice(0, 5) : topTracks.slice(0, 3);
      const limitedAlbums = isPremium ? topAlbums.slice(0, 5) : topAlbums.slice(0, 3);
      const limitedGenres = isPremium ? topGenres.slice(0, 5) : topGenres.slice(0, 3);
      
      // Create a snapshot date (today)
      const snapshotDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // 6. Save to database using the new schema
      const { error: saveError } = await supabase
        .from('user_streaming_data')
        .upsert({
          user_id: session.user.id,
          service_id: 'spotify',
          snapshot_date: snapshotDate,
          last_updated: new Date().toISOString(),
          top_artists: limitedArtists,
          top_tracks: limitedTracks,
          top_albums: limitedAlbums,
          top_genres: limitedGenres,
          raw_data: {
            full_artists: topArtists,
            full_tracks: topTracks,
            full_albums: topAlbums,
            full_genres: topGenres
          }
        }, {
          onConflict: 'user_id,service_id,snapshot_date'
        });
      
      if (saveError) throw saveError;
      console.log('Successfully saved Spotify data');
      
      return true;
    } catch (err: any) {
      console.error('Error fetching and saving Spotify data:', err);
      setError(`Failed to fetch and save Spotify data: ${err.message}`);
      return false;
    } finally {
      setIsLoading(false);
      setIsUpdatingListeningData(false);
    }
  };

  // Force fetch for a specific user ID (used during signup)
  const forceFetchAndSaveSpotifyData = async (
    userId: string,
    isPremium: boolean = false
  ): Promise<boolean> => {
    if (!accessToken) {
      return false;
    }
    
    setIsLoading(true);
    setError(null);
    setIsUpdatingListeningData(true);
    
    try {
      // 1. Fetch top artists (last 4 weeks)
      const topArtists = await getTopArtists('short_term', 50);
      
      // 2. Calculate top genres from artists
      const topGenres = calculateTopGenres(topArtists);
      
      // 3. Get top tracks directly instead of recently played
      const topTracks = await getTopTracks('short_term', 50);
      
      // 4. Extract top albums from top tracks
      const albumMap = new Map<string, TopAlbum>();
      topTracks.forEach(track => {
        if (track.album && !albumMap.has(track.album.id)) {
          albumMap.set(track.album.id, {
            id: track.album.id,
            name: track.album.name,
            images: track.album.images,
            artists: track.artists.length > 0 ? [track.artists[0]] : [],
            uri: `spotify:album:${track.album.id}`
          });
        }
      });
      const topAlbums = Array.from(albumMap.values());
      
      // 5. Prepare the data based on premium status
      const limitedArtists = isPremium ? topArtists.slice(0, 5) : topArtists.slice(0, 3);
      const limitedTracks = isPremium ? topTracks.slice(0, 5) : topTracks.slice(0, 3);
      const limitedAlbums = isPremium ? topAlbums.slice(0, 5) : topAlbums.slice(0, 3);
      const limitedGenres = isPremium ? topGenres.slice(0, 5) : topGenres.slice(0, 3);
      
      // Create a snapshot date (today)
      const snapshotDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // 6. Save to database using the new schema
      const { error: saveError } = await supabase
        .from('user_streaming_data')
        .upsert({
          user_id: userId,
          service_id: 'spotify',
          snapshot_date: snapshotDate,
          last_updated: new Date().toISOString(),
          top_artists: limitedArtists,
          top_tracks: limitedTracks,
          top_albums: limitedAlbums,
          top_genres: limitedGenres,
          raw_data: {
            full_artists: topArtists,
            full_tracks: topTracks,
            full_albums: topAlbums,
            full_genres: topGenres
          }
        }, {
          onConflict: 'user_id,service_id,snapshot_date'
        });
      
      if (saveError) throw saveError;
      console.log('Successfully saved Spotify data for user:', userId);
      
      return true;
    } catch (err: any) {
      console.error('Error in forceFetchAndSaveSpotifyData:', err);
      setError(`Failed to force fetch Spotify data: ${err.message}`);
      return false;
    } finally {
      setIsLoading(false);
      setIsUpdatingListeningData(false);
    }
  };

  // Function to check if token is valid through a test API call
  const validateTokenWithApiCall = async (token: string): Promise<boolean> => {
    try {
      console.log('[useSpotifyAuth] Validating access token with API call');
      const response = await fetch(`${SPOTIFY_API_URL}/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        // Log detailed error information for debugging
        const errorText = await response.text();
        console.error(`[useSpotifyAuth] API validation failed with status ${response.status}:`, errorText);
        
        // Handle specific error cases
        if (response.status === 403) {
          console.error('[useSpotifyAuth] 403 Forbidden: This usually means the user needs to be added as an authorized test user in the Spotify Developer Dashboard');
          setError('Your Spotify account needs to be added as a test user in development mode. Please contact the app developer.');
        } else if (response.status === 401) {
          console.error('[useSpotifyAuth] 401 Unauthorized: Token is invalid or expired');
          setError('Authentication token is invalid or expired. Please try logging in again.');
        }
        
        return false;
      }
      
      console.log('[useSpotifyAuth] Token validation successful');
      // If we get a 200 response, the token is valid
      return response.ok;
    } catch (err) {
      console.error('[useSpotifyAuth] Error validating token:', err);
      return false;
    }
  };

  // Function to check if the user actually completed Spotify authorization
  const verifyAuthorizationCompleted = async (): Promise<boolean> => {
    if (!accessToken) {
      console.log('[useSpotifyAuth] No access token available, authorization not complete');
      return false;
    }
    
    // Validate token with an API call to make sure it's actually valid
    const isTokenValid = await validateTokenWithApiCall(accessToken);
    console.log(`[useSpotifyAuth] Token validation result: ${isTokenValid}`);
    
    return isTokenValid;
  };

  // Return the hook interface
  return {
    login,
    logout,
    isLoggedIn,
    isLoading,
    error,
    userData,
    getTopArtists,
    getTopTracks,
    getRecentlyPlayedTracks,
    accessToken,
    refreshToken,
    fetchAndSaveSpotifyData,
    forceFetchAndSaveSpotifyData,
    isUpdatingListeningData,
    verifyAuthorizationCompleted,
  };
}; 