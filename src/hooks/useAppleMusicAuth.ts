/**
 * Apple Music Authentication and Data Fetching Hook
 * 
 * This hook provides a unified interface for Apple Music integration:
 * - User authorization (Web via MusicKit JS, iOS via native MusicKit)
 * - Fetching user's listening data (recently played, heavy rotation)
 * - Computing top songs, artists, genres, and moods
 * - Saving data to Supabase
 * 
 * The hook follows the same patterns as useSpotifyAuth for consistency.
 */

import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from './useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { 
  TopArtist, 
  TopTrack, 
  TopAlbum, 
  TopGenre, 
  TopMood
} from './useStreamingData';
import { MUSIC_MOODS, generateGeminiMoodAnalysisPrompt, SongForMoodAnalysis } from '@/lib/moods';
import * as AppleMusic from 'vybr-apple-music';

// ========================================
// = OLD IMPLEMENTATION (COMMENTED OUT)
// ========================================
/*
// --- APPLE MUSIC CONSTANTS ---
const APPLE_MUSIC_USER_TOKEN_KEY = 'apple_music_user_token';
const APPLE_MUSIC_DEV_TOKEN_KEY = 'apple_music_dev_token';
const APPLE_MUSIC_DEV_TOKEN_EXPIRY_KEY = 'apple_music_dev_token_expiry';

const DEV_TOKEN_VALIDITY_MS = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months in ms

export const useAppleMusicAuth = () => {
  const { session } = useAuth();
  
  // Auth state
  const [userToken, setUserToken] = useState<string | null>(null);
  const [developerToken, setDeveloperToken] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isUpdatingListeningData, setIsUpdatingListeningData] = useState(false);
  const [credentialsLoaded, setCredentialsLoaded] = useState<boolean>(false);

  // ... rest of old implementation ...
};
*/
// ========================================
// = END OF OLD IMPLEMENTATION
// ========================================

// ========================================
// = NEW UNIFIED IMPLEMENTATION
// ========================================

// --- Constants ---
const APPLE_MUSIC_USER_TOKEN_KEY = 'apple_music_user_token';
const APPLE_MUSIC_DEV_TOKEN_KEY = 'apple_music_dev_token';
const APPLE_MUSIC_DEV_TOKEN_EXPIRY_KEY = 'apple_music_dev_token_expiry';
const APPLE_MUSIC_CONNECTED_IOS_KEY = 'apple_music_connected_ios';

const DEV_TOKEN_VALIDITY_MS = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months in ms

// --- Helper: Calculate top genres from artists ---
const calculateTopGenresFromArtists = (artists: TopArtist[]): TopGenre[] => {
  const genreMap = new Map<string, { count: number; score: number }>();

  artists.forEach((artist) => {
    const artistPopularity = artist.popularity || 50;
    
    artist.genres.forEach((genre) => {
      const genreData = genreMap.get(genre) || { count: 0, score: 0 };
      genreData.count += 1;
      genreData.score += artistPopularity;
      genreMap.set(genre, genreData);
    });
  });

  const topGenres: TopGenre[] = Array.from(genreMap.entries()).map(([name, data]) => ({
    name,
    count: data.count,
    score: data.score,
  }));

  topGenres.sort((a, b) => b.score - a.score);
  return topGenres;
};

// --- Helper: Calculate top genres from tracks (Apple Music specific) ---
const calculateTopGenresFromTracks = (tracks: any[]): TopGenre[] => {
  const genreMap = new Map<string, { count: number; score: number }>();

  tracks.forEach((track, index) => {
    const genres = track.genreNames || [];
    // Weight by position (earlier tracks = more recent/frequent)
    const weight = Math.max(1, 10 - Math.floor(index / 5));
    
    genres.forEach((genre: string) => {
      const genreData = genreMap.get(genre) || { count: 0, score: 0 };
      genreData.count += 1;
      genreData.score += weight;
      genreMap.set(genre, genreData);
    });
  });

  const topGenres: TopGenre[] = Array.from(genreMap.entries()).map(([name, data]) => ({
    name,
    count: data.count,
    score: data.score,
  }));

  topGenres.sort((a, b) => b.score - a.score);
  return topGenres;
};

// --- Main Hook ---
export const useAppleMusicAuth = () => {
  const { session } = useAuth();
  
  // Auth state
  const [userToken, setUserToken] = useState<string | null>(null);
  const [developerToken, setDeveloperToken] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isUpdatingListeningData, setIsUpdatingListeningData] = useState(false);
  const [credentialsLoaded, setCredentialsLoaded] = useState<boolean>(false);

  // --- Clear Cached Developer Token ---
  const clearCachedDeveloperToken = async (): Promise<void> => {
    await AsyncStorage.removeItem(APPLE_MUSIC_DEV_TOKEN_KEY);
    await AsyncStorage.removeItem(APPLE_MUSIC_DEV_TOKEN_EXPIRY_KEY);
    setDeveloperToken(null);
    console.log('[useAppleMusicAuth] Cleared cached developer token');
  };

  // --- Fetch Developer Token from Backend ---
  const fetchDeveloperToken = async (forceRefresh: boolean = false): Promise<string | null> => {
    try {
      console.log('[useAppleMusicAuth] Fetching developer token from backend...', { forceRefresh });
      
      // If forcing refresh, clear cache first
      if (forceRefresh) {
        await clearCachedDeveloperToken();
      }
      
      // Check cached token first
      const cachedToken = await AsyncStorage.getItem(APPLE_MUSIC_DEV_TOKEN_KEY);
      const cachedExpiry = await AsyncStorage.getItem(APPLE_MUSIC_DEV_TOKEN_EXPIRY_KEY);
      
      if (cachedToken && cachedExpiry && !forceRefresh) {
        const expiryTime = parseInt(cachedExpiry, 10);
        const now = Date.now();
        
        // Use cached token if it's still valid (with 1 day buffer)
        if (now < expiryTime - (24 * 60 * 60 * 1000)) {
          console.log('[useAppleMusicAuth] Using cached developer token');
          setDeveloperToken(cachedToken);
          return cachedToken;
        }
      }
      
      // Fetch new token from Supabase Edge Function
      const supabaseUrl = process.env.SUPABASE_URL || Constants.expoConfig?.extra?.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_KEY || Constants.expoConfig?.extra?.SUPABASE_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('[useAppleMusicAuth] Missing Supabase configuration');
        setError('Apple Music configuration error: Missing Supabase credentials.');
        return null;
      }
      
      const functionUrl = `${supabaseUrl}/functions/v1/generate-apple-music-token`;
      
      console.log('[useAppleMusicAuth] Calling generate-apple-music-token function...', {
        url: functionUrl,
        forceRefresh
      });
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({}),
      });
      
      console.log('[useAppleMusicAuth] Function response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[useAppleMusicAuth] Response error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        setError(`Apple Music service error: ${response.status} ${response.statusText}. Check backend configuration.`);
        return null;
      }
      
      const data = await response.json();
      
      if (!data?.token) {
        console.error('[useAppleMusicAuth] No token in response:', data);
        setError('Apple Music configuration error: No token received from backend');
        return null;
      }
      
      const token = data.token as string;
      
      // Validate token format (should be a JWT with 3 parts)
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        console.error('[useAppleMusicAuth] Invalid token format - not a JWT:', {
          parts: tokenParts.length,
          tokenLength: token.length,
          tokenPreview: token.substring(0, 50) + '...'
        });
        setError('Apple Music configuration error: Invalid token format received from backend');
        return null;
      }
      
      // Try to decode and validate token expiration
      try {
        const header = JSON.parse(atob(tokenParts[0]));
        const payload = JSON.parse(atob(tokenParts[1]));
        const exp = payload.exp;
        const now = Math.floor(Date.now() / 1000);
        
        if (exp < now) {
          console.warn('[useAppleMusicAuth] Token is already expired:', {
            expiredAt: new Date(exp * 1000).toISOString(),
            expiredBy: now - exp,
            issuer: payload.iss,
            keyId: header.kid
          });
        } else {
          console.log('[useAppleMusicAuth] Token is valid (format check):', {
            expiresAt: new Date(exp * 1000).toISOString(),
            expiresIn: exp - now,
            issuer: payload.iss,
            keyId: header.kid,
            algorithm: header.alg
          });
          console.log('[useAppleMusicAuth] ⚠️ If MusicKit rejects this token, check backend config:');
          console.log(`  - Team ID should be: ${payload.iss}`);
          console.log(`  - Key ID should be: ${header.kid}`);
          console.log('  - Verify these match your Apple Developer Portal settings');
        }
      } catch (e) {
        console.warn('[useAppleMusicAuth] Could not decode token payload:', e);
        // Continue anyway - let MusicKit validate it
      }
      
      const expiryTime = Date.now() + DEV_TOKEN_VALIDITY_MS;
      
      // Cache the token
      await AsyncStorage.setItem(APPLE_MUSIC_DEV_TOKEN_KEY, token);
      await AsyncStorage.setItem(APPLE_MUSIC_DEV_TOKEN_EXPIRY_KEY, expiryTime.toString());
      
      setDeveloperToken(token);
      return token;
    } catch (err: any) {
      console.error('[useAppleMusicAuth] Error fetching developer token:', err);
      setError('Failed to fetch Apple Music configuration.');
      return null;
    }
  };

  // --- Initialize ---
  useEffect(() => {
    const init = async () => {
      // For Web, we need the developer token loaded first
      // Force refresh on initial load to ensure we get a fresh token with the time fix
      if (Platform.OS === 'web') {
        await fetchDeveloperToken(true);
      }
      setCredentialsLoaded(true);
    };
    init();
  }, []);

  // --- Check Existing Tokens ---
  useEffect(() => {
    const checkExistingTokens = async () => {
      if (Platform.OS === 'web') {
        const storedUserToken = await AsyncStorage.getItem(APPLE_MUSIC_USER_TOKEN_KEY);
        const storedDevToken = await AsyncStorage.getItem(APPLE_MUSIC_DEV_TOKEN_KEY);
        
        if (storedUserToken && storedDevToken) {
          setUserToken(storedUserToken);
          setDeveloperToken(storedDevToken);
          setIsLoggedIn(true);
          
          // Update module state for API calls
          if (AppleMusic.setTokens) {
            AppleMusic.setTokens(storedDevToken, storedUserToken);
          }
          console.log('[useAppleMusicAuth] Restored tokens from storage (web)');
        }
      } else {
        // On iOS, check if previously connected
        const wasConnected = await AsyncStorage.getItem(APPLE_MUSIC_CONNECTED_IOS_KEY);
        if (wasConnected === 'true') {
          setIsLoggedIn(true);
          console.log('[useAppleMusicAuth] User was previously connected (iOS)');
        }
      }
    };
    
    if (credentialsLoaded) {
      checkExistingTokens();
    }
  }, [credentialsLoaded]);

  // --- Login ---
  const login = useCallback(async (retryCount: number = 0, overrideToken?: string | null) => {
    setError(null);
    setIsLoading(true);

    try {
      // Use override token if provided (for retries), otherwise use state or fetch
      let devToken = overrideToken !== undefined ? overrideToken : developerToken;
      
      // Fetch developer token if not available (required for web)
      // Force refresh on first attempt to ensure we get a fresh token with the time fix
      if (!devToken && Platform.OS === 'web') {
        devToken = await fetchDeveloperToken(retryCount === 0);
        if (!devToken) {
          throw new Error('Could not obtain developer token');
        }
      }

      if (!devToken) {
        throw new Error('Developer token is required');
      }

      console.log('[useAppleMusicAuth] Starting authorization...', { retryCount, hasToken: !!devToken });
      
      // Call the unified authorize function
      const result = await AppleMusic.authorize({ developerToken: devToken });
      
      if (Platform.OS === 'web') {
        // On web, result is the user token
        const newUserToken = result;
        await AsyncStorage.setItem(APPLE_MUSIC_USER_TOKEN_KEY, newUserToken);
        setUserToken(newUserToken);
        setIsLoggedIn(true);
        console.log('[useAppleMusicAuth] Web authorization successful');
      } else {
        // On iOS, result is the authorization status
        if (result === 'authorized') {
          await AsyncStorage.setItem(APPLE_MUSIC_CONNECTED_IOS_KEY, 'true');
          setIsLoggedIn(true);
          console.log('[useAppleMusicAuth] iOS authorization successful');
        } else {
          throw new Error(`Authorization failed: ${result}`);
        }
      }
      
      setIsLoading(false);
      
    } catch (err: any) {
      console.error('[useAppleMusicAuth] Login error:', err);
      
      const errorMessage = err.message || 'Authentication failed';
      
      // Check if error is related to token expiration/invalid and retry with fresh token
      const isTokenError = errorMessage.includes('invalid') || 
                          errorMessage.includes('expired') || 
                          errorMessage.includes('TOKEN_REFRESH_NEEDED') ||
                          errorMessage.includes('Developer token');
      
      // Auto-retry logic to prevent popup from reopening if token is stale
      // This allows us to fetch a fresh token if the current one is invalid
      if (isTokenError && retryCount === 0 && Platform.OS === 'web') {
        console.log('[useAppleMusicAuth] Token error detected, forcing refresh and retrying...');
        // Force refresh the token and retry once
        const freshToken = await fetchDeveloperToken(true);
        if (freshToken) {
          console.log('[useAppleMusicAuth] Got fresh token, retrying authorization...', {
            tokenLength: freshToken.length,
            tokenPreview: freshToken.substring(0, 50) + '...'
          });
          // Decode and log the new token's iat to verify it's backdated
          try {
            const parts = freshToken.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(atob(parts[1]));
              console.log('[useAppleMusicAuth] New token iat:', payload.iat, 'exp:', payload.exp, {
                issuedAt: new Date(payload.iat * 1000).toISOString(),
                expiresAt: new Date(payload.exp * 1000).toISOString()
              });
            }
          } catch (e) {
            console.warn('[useAppleMusicAuth] Could not decode new token:', e);
          }
          return login(1, freshToken);
        } else {
          console.error('[useAppleMusicAuth] Failed to get fresh token on retry');
        }
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  }, [developerToken]);

  // --- Logout ---
  const logout = async () => {
    await AsyncStorage.removeItem(APPLE_MUSIC_USER_TOKEN_KEY);
    await AsyncStorage.removeItem(APPLE_MUSIC_CONNECTED_IOS_KEY);
    setUserToken(null);
    setIsLoggedIn(false);
    setUserData(null);
    console.log('[useAppleMusicAuth] Logged out');
  };

  // --- Parse Helpers (Convert Apple Music data to unified format) ---
  const parseArtistsAndTracks = (resources: any[]): { artists: TopArtist[], tracks: TopTrack[] } => {
    const artists: TopArtist[] = [];
    const tracks: TopTrack[] = [];
    
    resources.forEach((resource: any) => {
      if (resource.type === 'artists' || resource.type === 'library-artists') {
        const attrs = resource.attributes || {};
        artists.push({
          id: resource.id,
          name: attrs.name || 'Unknown Artist',
          genres: attrs.genreNames || [],
          images: attrs.artwork ? [{
            url: attrs.artwork.url?.replace('{w}', '300').replace('{h}', '300') || '',
            height: 300,
            width: 300
          }] : [],
          popularity: 0,
          uri: `apple-music:artist:${resource.id}`
        });
      } else if (resource.type === 'songs' || resource.type === 'library-songs') {
        const attrs = resource.attributes || {};
        tracks.push({
          id: resource.id,
          name: attrs.name || 'Unknown Track',
          uri: `apple-music:song:${resource.id}`,
          album: {
            id: resource.relationships?.albums?.data?.[0]?.id || '',
            name: attrs.albumName || '',
            images: attrs.artwork ? [{
              url: attrs.artwork.url?.replace('{w}', '300').replace('{h}', '300') || '',
              height: 300,
              width: 300
            }] : []
          },
          artists: attrs.artistName ? [{
            id: resource.relationships?.artists?.data?.[0]?.id || '',
            name: attrs.artistName
          }] : [],
          popularity: 0
        });
      }
    });
    
    return { artists, tracks };
  };

  // --- Perform Mood Analysis using Gemini ---
  const analyzeMoods = async (tracks: TopTrack[]): Promise<TopMood[]> => {
    if (tracks.length === 0) return [];
    
    try {
      const songsForMoodAnalysis: SongForMoodAnalysis[] = tracks
        .slice(0, 20)
        .map(track => ({
          title: track.name,
          artist: track.artists[0]?.name || 'Unknown Artist',
          id: track.id
        }));

      if (songsForMoodAnalysis.length === 0) return [];

      // Fetch Google API Key
      const { data: apiKeyData, error: apiKeyError } = await supabase.rpc('get_google_api_key');
      
      if (apiKeyError || !apiKeyData) {
        console.error('[useAppleMusicAuth] Error fetching Google API key:', apiKeyError);
        return [];
      }

      const googleApiKey = apiKeyData as string;
      const prompt = generateGeminiMoodAnalysisPrompt(songsForMoodAnalysis);
      
      console.log('[useAppleMusicAuth] Calling Gemini API for mood analysis...');
      
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${googleApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          }),
        }
      );

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error('[useAppleMusicAuth] Gemini API error:', geminiResponse.status, errorText);
        return [];
      }

      const geminiResult = await geminiResponse.json();
      
      if (geminiResult.candidates?.[0]?.content?.parts?.[0]?.text) {
        try {
          const categorizedSongs = JSON.parse(geminiResult.candidates[0].content.parts[0].text);
          
          if (Array.isArray(categorizedSongs)) {
            const moodCounts: { [moodName: string]: number } = {};
            
            categorizedSongs.forEach((song: any) => {
              if (song.determinedMood && MUSIC_MOODS.some(m => m.moodName === song.determinedMood)) {
                moodCounts[song.determinedMood] = (moodCounts[song.determinedMood] || 0) + 1;
              }
            });

            const sortedMoods = Object.entries(moodCounts)
              .map(([name, count]) => ({ name, count, score: count }))
              .sort((a, b) => b.count - a.count);
            
            console.log('[useAppleMusicAuth] Mood analysis complete:', sortedMoods.slice(0, 3));
            return sortedMoods.slice(0, 3);
          }
        } catch (parseError) {
          console.error('[useAppleMusicAuth] Error parsing Gemini response:', parseError);
        }
      }
      
      return [];
    } catch (moodError: any) {
      console.error('[useAppleMusicAuth] Error during mood analysis:', moodError);
      return [];
    }
  };

  // --- Fetch and Save Apple Music Data ---
  const fetchAndSaveAppleMusicData = async (isPremium: boolean = false): Promise<boolean> => {
    if (!isLoggedIn || !session?.user?.id) {
      console.log('[useAppleMusicAuth] Cannot fetch data: not logged in or no session');
      return false;
    }

    setIsLoading(true);
    setError(null);
    setIsUpdatingListeningData(true);

    try {
      console.log('[useAppleMusicAuth] Fetching Apple Music data...');
      
      let topArtists: TopArtist[] = [];
      let topTracks: TopTrack[] = [];
      let topAlbums: TopAlbum[] = [];
      let topGenres: TopGenre[] = [];
      let topMoodsData: TopMood[] = [];
      
      // Try to use the unified fetchUserMusicData function first
      try {
        const musicData = await AppleMusic.fetchUserMusicData({ includeGenres: true, limit: 50 });
        
        // Convert to our format
        topTracks = (musicData.tracks || []).map((track: any) => ({
          id: track.id,
          name: track.name,
          uri: track.uri,
          album: track.album,
          artists: track.artists,
          popularity: track.popularity || 0
        }));
        
        topArtists = (musicData.artists || []).map((artist: any) => ({
          id: artist.id,
          name: artist.name,
          genres: artist.genres || [],
          images: artist.images || [],
          popularity: artist.popularity || 0,
          uri: artist.uri
        }));
        
        topAlbums = (musicData.albums || []).map((album: any) => ({
          id: album.id,
          name: album.name,
          artists: album.artists || [],
          images: album.images || [],
          uri: album.uri
        }));
        
        // Calculate genres from tracks and artists
        const trackGenres = calculateTopGenresFromTracks(musicData.tracks || []);
        const artistGenres = calculateTopGenresFromArtists(topArtists);
        
        // Merge genre lists
        const genreMap = new Map<string, TopGenre>();
        [...trackGenres, ...artistGenres].forEach(genre => {
          const existing = genreMap.get(genre.name);
          if (existing) {
            existing.count += genre.count;
            existing.score += genre.score;
          } else {
            genreMap.set(genre.name, { ...genre });
          }
        });
        topGenres = Array.from(genreMap.values()).sort((a, b) => b.score - a.score);
        
        console.log(`[useAppleMusicAuth] Fetched via unified API: ${topTracks.length} tracks, ${topArtists.length} artists, ${topAlbums.length} albums, ${topGenres.length} genres`);
        
      } catch (unifiedError) {
        console.warn('[useAppleMusicAuth] Unified API failed, falling back to individual calls:', unifiedError);
        
        // Fallback: Use individual API calls
        // 1. Get Heavy Rotation
        try {
          const heavyRotationResponse = await AppleMusic.getHeavyRotation(50);
          const resources = heavyRotationResponse.data || [];
          const parsed = parseArtistsAndTracks(resources);
          topArtists = parsed.artists;
          // Heavy rotation may also contain tracks
          if (parsed.tracks.length > 0) {
            topTracks = parsed.tracks;
          }
        } catch (err) {
          console.warn('[useAppleMusicAuth] Heavy rotation failed:', err);
        }

        // 2. Get Recently Played (primary source for tracks)
        try {
          const recentResponse = await AppleMusic.getRecentlyPlayed(50);
          const resources = recentResponse.data || [];
          const parsed = parseArtistsAndTracks(resources);
          
          if (parsed.tracks.length > 0) {
            topTracks = parsed.tracks;
          }
          
          // Extract artists from tracks if we don't have them
          if (topArtists.length === 0) {
            const artistMap = new Map<string, TopArtist>();
            topTracks.forEach(track => {
              track.artists.forEach(artist => {
                if (!artistMap.has(artist.name)) {
                  artistMap.set(artist.name, {
                    id: artist.id || '',
                    name: artist.name,
                    genres: [],
                    images: [],
                    popularity: 0,
                    uri: `apple-music:artist:${artist.id || artist.name}`
                  });
                }
              });
            });
            topArtists = Array.from(artistMap.values());
          }
        } catch (err) {
          console.warn('[useAppleMusicAuth] Recently played failed:', err);
        }

        // Calculate genres from artists
        topGenres = calculateTopGenresFromArtists(topArtists);
        
        // Extract albums from tracks
        const albumMap = new Map<string, TopAlbum>();
        topTracks.forEach(track => {
          if (track.album && track.album.id && !albumMap.has(track.album.id)) {
            albumMap.set(track.album.id, {
              id: track.album.id,
              name: track.album.name,
              images: track.album.images,
              artists: track.artists.length > 0 ? [track.artists[0]] : [],
              uri: `apple-music:album:${track.album.id}`
            });
          }
        });
        topAlbums = Array.from(albumMap.values());
      }

      console.log(`[useAppleMusicAuth] Got ${topArtists.length} artists, ${topTracks.length} tracks, ${topAlbums.length} albums, ${topGenres.length} genres`);

      // 3. Mood Analysis (Premium only)
      if (isPremium && topTracks.length > 0) {
        console.log('[useAppleMusicAuth] Starting mood analysis for premium user...');
        topMoodsData = await analyzeMoods(topTracks);
      }

      // 4. Prepare data based on premium status
      const limitedArtists = isPremium ? topArtists.slice(0, 5) : topArtists.slice(0, 3);
      const limitedTracks = isPremium ? topTracks.slice(0, 5) : topTracks.slice(0, 3);
      const limitedAlbums = isPremium ? topAlbums.slice(0, 5) : topAlbums.slice(0, 3);
      const limitedGenres = isPremium ? topGenres.slice(0, 5) : topGenres.slice(0, 3);
      const snapshotDate = new Date().toISOString().split('T')[0];

      // 5. Save to Supabase
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
        }, { onConflict: 'user_id,service_id,snapshot_date' });

      if (saveError) {
        throw saveError;
      }

      console.log(`[useAppleMusicAuth] Successfully saved Apple Music data. Artists: ${limitedArtists.length}, Tracks: ${limitedTracks.length}, Genres: ${limitedGenres.length}, Moods: ${topMoodsData.length}`);
      return true;
      
    } catch (err: any) {
      console.error('[useAppleMusicAuth] Fetch and save error:', err);
      setError(err.message || 'Failed to fetch Apple Music data');
      return false;
    } finally {
      setIsLoading(false);
      setIsUpdatingListeningData(false);
    }
  };

  // --- Force Fetch for Specific User ID (used during signup) ---
  const forceFetchAndSaveAppleMusicData = async (userId: string, isPremium: boolean = false): Promise<boolean> => {
    if (!isLoggedIn) {
      setError('Not authenticated with Apple Music');
      return false;
    }

    setIsLoading(true);
    setError(null);
    setIsUpdatingListeningData(true);
    
    try {
      console.log(`[useAppleMusicAuth] Force fetching Apple Music data for user ${userId}...`);
      
      let topArtists: TopArtist[] = [];
      let topTracks: TopTrack[] = [];
      let topAlbums: TopAlbum[] = [];
      let topGenres: TopGenre[] = [];
      let topMoodsData: TopMood[] = [];

      // Try unified API first
      try {
        const musicData = await AppleMusic.fetchUserMusicData({ includeGenres: true, limit: 50 });
        
        topTracks = (musicData.tracks || []).map((track: any) => ({
          id: track.id,
          name: track.name,
          uri: track.uri,
          album: track.album,
          artists: track.artists,
          popularity: track.popularity || 0
        }));
        
        topArtists = (musicData.artists || []).map((artist: any) => ({
          id: artist.id,
          name: artist.name,
          genres: artist.genres || [],
          images: artist.images || [],
          popularity: artist.popularity || 0,
          uri: artist.uri
        }));
        
        topAlbums = (musicData.albums || []).map((album: any) => ({
          id: album.id,
          name: album.name,
          artists: album.artists || [],
          images: album.images || [],
          uri: album.uri
        }));
        
        // Calculate genres
        const trackGenres = calculateTopGenresFromTracks(musicData.tracks || []);
        const artistGenres = calculateTopGenresFromArtists(topArtists);
        
        const genreMap = new Map<string, TopGenre>();
        [...trackGenres, ...artistGenres].forEach(genre => {
          const existing = genreMap.get(genre.name);
          if (existing) {
            existing.count += genre.count;
            existing.score += genre.score;
          } else {
            genreMap.set(genre.name, { ...genre });
          }
        });
        topGenres = Array.from(genreMap.values()).sort((a, b) => b.score - a.score);
        
      } catch (unifiedError) {
        console.warn('[useAppleMusicAuth] Unified API failed, using fallback:', unifiedError);
        
        // Fallback to individual API calls
        try {
          const heavyRotationResponse = await AppleMusic.getHeavyRotation(50);
          const parsed = parseArtistsAndTracks(heavyRotationResponse.data || []);
          topArtists = parsed.artists;
          topTracks = parsed.tracks;
        } catch (err) {
          console.warn('[useAppleMusicAuth] Heavy rotation failed:', err);
        }

        if (topTracks.length === 0) {
          try {
            const recentResponse = await AppleMusic.getRecentlyPlayed(50);
            const parsed = parseArtistsAndTracks(recentResponse.data || []);
            topTracks = parsed.tracks;
            
            const artistMap = new Map<string, TopArtist>();
            topTracks.forEach(track => {
              track.artists.forEach(artist => {
                if (!artistMap.has(artist.name)) {
                  artistMap.set(artist.name, {
                    id: artist.id || '',
                    name: artist.name,
                    genres: [],
                    images: [],
                    popularity: 0,
                    uri: `apple-music:artist:${artist.id || artist.name}`
                  });
                }
              });
            });
            if (topArtists.length === 0) {
              topArtists = Array.from(artistMap.values());
            }
          } catch (err) {
            console.warn('[useAppleMusicAuth] Recent failed:', err);
          }
        }

        topGenres = calculateTopGenresFromArtists(topArtists);
        
        const albumMap = new Map<string, TopAlbum>();
        topTracks.forEach(track => {
          if (track.album && track.album.id && !albumMap.has(track.album.id)) {
            albumMap.set(track.album.id, {
              id: track.album.id,
              name: track.album.name,
              images: track.album.images,
              artists: track.artists.length > 0 ? [track.artists[0]] : [],
              uri: `apple-music:album:${track.album.id}`
            });
          }
        });
        topAlbums = Array.from(albumMap.values());
      }

      // Mood analysis for premium users
      if (isPremium && topTracks.length > 0) {
        topMoodsData = await analyzeMoods(topTracks);
      }

      // Prepare limited data
      const limitedArtists = isPremium ? topArtists.slice(0, 5) : topArtists.slice(0, 3);
      const limitedTracks = isPremium ? topTracks.slice(0, 5) : topTracks.slice(0, 3);
      const limitedAlbums = isPremium ? topAlbums.slice(0, 5) : topAlbums.slice(0, 3);
      const limitedGenres = isPremium ? topGenres.slice(0, 5) : topGenres.slice(0, 3);
      const snapshotDate = new Date().toISOString().split('T')[0];

      // Save to database
      const { error: saveError } = await supabase
        .from('user_streaming_data')
        .upsert({
          user_id: userId,
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
        }, { onConflict: 'user_id,service_id,snapshot_date' });

      if (saveError) {
        throw saveError;
      }

      console.log(`[useAppleMusicAuth] Force fetch complete for user ${userId}. Artists: ${limitedArtists.length}, Tracks: ${limitedTracks.length}, Genres: ${limitedGenres.length}, Moods: ${topMoodsData.length}`);
      return true;
      
    } catch (err: any) {
      console.error('[useAppleMusicAuth] Force fetch error:', err);
      setError(err.message || 'Failed to fetch Apple Music data');
      return false;
    } finally {
      setIsLoading(false);
      setIsUpdatingListeningData(false);
    }
  };

  // --- Verify Authorization Completed ---
  const verifyAuthorizationCompleted = async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      // On web, check if we have both tokens
      const hasTokens = !!userToken && !!developerToken;
      console.log(`[useAppleMusicAuth] Web authorization verification: ${hasTokens}`);
      return hasTokens && isLoggedIn;
    } else {
      // On iOS, just return the logged in state
      console.log(`[useAppleMusicAuth] iOS authorization verification: ${isLoggedIn}`);
      return isLoggedIn;
    }
  };

  // --- Direct Data Access Methods (for compatibility) ---
  const getHeavyRotation = async () => {
    const res = await AppleMusic.getHeavyRotation(50);
    const parsed = parseArtistsAndTracks(res.data || []);
    return parsed;
  };
  
  const getRecentlyPlayedTracks = async () => {
    const res = await AppleMusic.getRecentlyPlayed(50);
    const parsed = parseArtistsAndTracks(res.data || []);
    return parsed.tracks;
  };

  // --- Return Hook Interface ---
  return {
    // Authentication
    login,
    logout,
    isLoggedIn,
    isLoading,
    error,
    userData,
    userToken,
    developerToken,
    credentialsLoaded,
    
    // Data fetching
    fetchAndSaveAppleMusicData,
    forceFetchAndSaveAppleMusicData,
    verifyAuthorizationCompleted,
    
    // Direct data access (for debugging/compatibility)
    getHeavyRotation,
    getRecentlyPlayedTracks,
    
    // Loading states
    isUpdatingListeningData,
  };
};
