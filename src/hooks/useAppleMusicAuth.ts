import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from './useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { 
  calculateTopGenres, 
  StreamingData, 
  TopArtist, 
  TopTrack, 
  TopAlbum, 
  TopGenre, 
  TopMood
} from './useStreamingData';
import { MUSIC_MOODS, generateGeminiMoodAnalysisPrompt, SongForMoodAnalysis, GeminiMoodResponseItem } from '@/lib/moods';

// --- APPLE MUSIC CONSTANTS ---
const APPLE_MUSIC_API_URL = 'https://api.music.apple.com/v1';
const AUTH_CALLBACK_SCHEME = 'vybr';
// Apple Music requires HTTPS, so we use ngrok URL for web
// Spotify can use HTTP localhost, but Apple Music needs HTTPS
const REGISTERED_WEB_REDIRECT_URI = 'https://unmodern-sleeveless-ahmad.ngrok-free.dev/apple-music-callback';

// Define token storage keys
const APPLE_MUSIC_USER_TOKEN_KEY = 'apple_music_user_token';
const APPLE_MUSIC_DEV_TOKEN_KEY = 'apple_music_dev_token';
const APPLE_MUSIC_DEV_TOKEN_EXPIRY_KEY = 'apple_music_dev_token_expiry';

// Apple Music requires developer token (JWT) which expires
// We'll fetch it from a backend function that generates it from credentials
const DEV_TOKEN_VALIDITY_MS = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months in ms

declare global {
  interface Window {
    MusicKit?: any;
  }
}

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

  // Apple Music credentials state
  const [credentialsLoaded, setCredentialsLoaded] = useState<boolean>(false);

  // Function to fetch Apple Music developer token from backend
  // The backend generates a JWT token from Apple credentials stored in Supabase
  const fetchDeveloperToken = async (): Promise<string | null> => {
    try {
      console.log('[useAppleMusicAuth] Fetching developer token from backend...');
      
      // Check if we have a cached valid token
      const cachedToken = await AsyncStorage.getItem(APPLE_MUSIC_DEV_TOKEN_KEY);
      const cachedExpiry = await AsyncStorage.getItem(APPLE_MUSIC_DEV_TOKEN_EXPIRY_KEY);
      
      if (cachedToken && cachedExpiry) {
        const expiryTime = parseInt(cachedExpiry, 10);
        const now = Date.now();
        
        // If token is still valid (with 1 day buffer), use it
        if (now < expiryTime - (24 * 60 * 60 * 1000)) {
          console.log('[useAppleMusicAuth] Using cached developer token');
          setDeveloperToken(cachedToken);
          return cachedToken;
        }
      }
      
      // Fetch new token from Supabase Edge Function
      console.log('[useAppleMusicAuth] Calling Edge Function: generate-apple-music-token');
      console.log('[useAppleMusicAuth] Session:', session ? 'exists' : 'none');
      
      // Get Supabase URL and key for direct fetch (bypassing Supabase client issues)
      const supabaseUrl = process.env.SUPABASE_URL || Constants.expoConfig?.extra?.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_KEY || Constants.expoConfig?.extra?.SUPABASE_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('[useAppleMusicAuth] Missing Supabase configuration');
        setError('Apple Music configuration error: Missing Supabase credentials.');
        return null;
      }
      
      const functionUrl = `${supabaseUrl}/functions/v1/generate-apple-music-token`;
      console.log('[useAppleMusicAuth] Function URL:', functionUrl);
      
      // Use direct fetch instead of supabase.functions.invoke to avoid client-side issues
      try {
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
          },
          body: JSON.stringify({}),
        });
        
        console.log('[useAppleMusicAuth] Response status:', response.status);
        console.log('[useAppleMusicAuth] Response ok:', response.ok);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[useAppleMusicAuth] Response error:', errorText);
          setError(`Apple Music service error: ${response.status} ${response.statusText}. ${errorText}`);
          return null;
        }
        
        const data = await response.json();
        console.log('[useAppleMusicAuth] Edge Function response:', data);
        
        if (!data?.token) {
          console.error('[useAppleMusicAuth] No developer token in response. Response data:', data);
          if (data?.error) {
            setError(`Apple Music configuration error: ${data.error}`);
          } else {
            setError('Apple Music configuration not available. Please check Edge Function logs.');
          }
          return null;
        }
        
        const token = data.token as string;
        const expiryTime = Date.now() + DEV_TOKEN_VALIDITY_MS;
        
        // Cache the token
        await AsyncStorage.setItem(APPLE_MUSIC_DEV_TOKEN_KEY, token);
        await AsyncStorage.setItem(APPLE_MUSIC_DEV_TOKEN_EXPIRY_KEY, expiryTime.toString());
        
        setDeveloperToken(token);
        console.log('[useAppleMusicAuth] Successfully fetched developer token');
        
        return token;
      } catch (fetchError: any) {
        console.error('[useAppleMusicAuth] Fetch error:', fetchError);
        console.error('[useAppleMusicAuth] Error name:', fetchError.name);
        console.error('[useAppleMusicAuth] Error message:', fetchError.message);
        
        // Check if it's a network/CORS issue
        if (fetchError.message?.includes('Failed to fetch') || fetchError.name === 'TypeError') {
          setError('Network error: Unable to connect to Apple Music service. Please check your internet connection and try again. If using ngrok, ensure the Supabase URL is accessible.');
        } else {
          setError(`Failed to fetch Apple Music configuration: ${fetchError.message || 'Unknown error'}. Please check Edge Function logs.`);
        }
        return null;
      }
    } catch (err: any) {
      console.error('[useAppleMusicAuth] Error fetching developer token:', err);
      setError('Failed to fetch Apple Music configuration. Please try again.');
      return null;
    }
  };

  // Load developer token on mount (for web)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      fetchDeveloperToken().then(() => {
        setCredentialsLoaded(true);
      });
    } else {
      // For native, credentials are handled differently
      setCredentialsLoaded(true);
    }
  }, []);

  // Check if tokens exist and are valid on mount
  useEffect(() => {
    const checkExistingTokens = async () => {
      try {
        const storedUserToken = await AsyncStorage.getItem(APPLE_MUSIC_USER_TOKEN_KEY);
        const storedDevToken = await AsyncStorage.getItem(APPLE_MUSIC_DEV_TOKEN_KEY);
        
        if (storedUserToken && storedDevToken) {
          console.log('[useAppleMusicAuth] Existing tokens found.');
          setUserToken(storedUserToken);
          setDeveloperToken(storedDevToken);
          setIsLoggedIn(true);
          
          // Verify token is still valid by fetching user data
          if (Platform.OS === 'web') {
            await fetchUserProfile(storedUserToken, storedDevToken);
          }
        } else {
          console.log('[useAppleMusicAuth] No existing Apple Music tokens found.');
        }
      } catch (err: any) {
        console.error('Error checking Apple Music tokens:', err);
        setError('Failed to retrieve Apple Music authentication status');
      }
    };
    
    if (credentialsLoaded) {
      checkExistingTokens();
    }
  }, [credentialsLoaded]);

  // Clear all stored tokens
  const clearTokens = async () => {
    try {
      await AsyncStorage.removeItem(APPLE_MUSIC_USER_TOKEN_KEY);
      await AsyncStorage.removeItem(APPLE_MUSIC_DEV_TOKEN_KEY);
      await AsyncStorage.removeItem(APPLE_MUSIC_DEV_TOKEN_EXPIRY_KEY);
      
      setUserToken(null);
      setDeveloperToken(null);
      setIsLoggedIn(false);
      setUserData(null);
      console.log('[useAppleMusicAuth] Cleared Apple Music tokens.');
    } catch (err: any) {
      console.error('Error clearing Apple Music tokens:', err);
    }
  };

  // Function to initialize MusicKit JS on web
  // We use MusicKit JS ONLY for user authentication, then use REST API for all data operations
  const initializeMusicKit = async (): Promise<boolean> => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return false;
    }

    try {
      // Wait for DOM to be fully ready before loading MusicKit
      if (document.readyState === 'loading') {
        console.log('[useAppleMusicAuth] Waiting for DOM to be ready...');
        await new Promise<void>((resolve) => {
          if (document.readyState === 'complete') {
            resolve();
          } else {
            window.addEventListener('load', () => resolve(), { once: true });
          }
        });
        console.log('[useAppleMusicAuth] ✅ DOM ready');
      }
      
      // Ensure all required DOM elements exist
      if (!document.body || !document.documentElement) {
        console.error('[useAppleMusicAuth] ❌ Required DOM elements missing');
        console.error('[useAppleMusicAuth] document.body:', !!document.body);
        console.error('[useAppleMusicAuth] document.documentElement:', !!document.documentElement);
        setError('Page not fully loaded. Please refresh and try again.');
        return false;
      }
      
      // Check if MusicKit is already loaded and ready
      const MusicKit = (window as any).MusicKit || (globalThis as any).MusicKit;
      if (MusicKit && typeof MusicKit.configure === 'function') {
        console.log('[useAppleMusicAuth] ✅ MusicKit already loaded from index.html');
        return true;
      }

      // If MusicKit script exists in HTML but not initialized, wait for it
      const existingScript = document.querySelector('script[src*="musickit.js"]');
      if (existingScript) {
        console.log('[useAppleMusicAuth] MusicKit script found in HTML, waiting for initialization...');
        return new Promise((resolve) => {
          // Wait for musickitloaded event
          const onMusicKitLoaded = () => {
            console.log('[useAppleMusicAuth] ✅ musickitloaded event fired');
            const MusicKitAPI = (window as any).MusicKit || (globalThis as any).MusicKit;
            if (MusicKitAPI && typeof MusicKitAPI.configure === 'function') {
              resolve(true);
            } else {
              resolve(false);
            }
          };
          
          document.addEventListener('musickitloaded', onMusicKitLoaded, { once: true });
          
          // Also poll in case event already fired
          let attempts = 0;
          const maxAttempts = 50; // 5 seconds
          const pollInterval = setInterval(() => {
            attempts++;
            const MusicKitAPI = (window as any).MusicKit || (globalThis as any).MusicKit;
            if (MusicKitAPI && typeof MusicKitAPI.configure === 'function') {
              clearInterval(pollInterval);
              document.removeEventListener('musickitloaded', onMusicKitLoaded);
              resolve(true);
            } else if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              document.removeEventListener('musickitloaded', onMusicKitLoaded);
              console.error('[useAppleMusicAuth] ❌ Timeout waiting for MusicKit from HTML script');
              resolve(false);
            }
          }, 100);
        });
      }

      // Load MusicKit JS library dynamically (fallback if not in HTML)
      console.log('[useAppleMusicAuth] Loading MusicKit JS dynamically...');
      return new Promise((resolve) => {
        // If window.MusicKit exists but is empty, delete it and remove the script to allow proper initialization
        if ((window as any).MusicKit && Object.keys((window as any).MusicKit).length === 0) {
          console.log('[useAppleMusicAuth] ⚠️ Found empty MusicKit object, removing script and object to allow proper initialization');
          delete (window as any).MusicKit;
          // Remove any existing script that might have caused this
          const existingScript = document.querySelector('script[src*="musickit.js"]');
          if (existingScript) {
            existingScript.remove();
            console.log('[useAppleMusicAuth] Removed existing MusicKit script');
          }
        }
        
        // Ensure required DOM elements exist before loading MusicKit
        // MusicKit JS may require document.body, document.documentElement, or other elements
        if (!document.body || !document.documentElement) {
          console.error('[useAppleMusicAuth] ❌ Required DOM elements not available');
          console.error('[useAppleMusicAuth] document.body:', !!document.body);
          console.error('[useAppleMusicAuth] document.documentElement:', !!document.documentElement);
          setError('Apple Music requires the page to be fully loaded. Please refresh and try again.');
          resolve(false);
          return;
        }
        
        // Ensure window and document are fully available
        if (typeof window === 'undefined' || typeof document === 'undefined') {
          console.error('[useAppleMusicAuth] ❌ window or document not available');
          setError('Apple Music requires a browser environment. Please refresh and try again.');
          resolve(false);
          return;
        }
        
        // Check if script already exists
        const existingScript = document.querySelector('script[src*="musickit.js"]') as HTMLScriptElement;
        let script: HTMLScriptElement;
        
        if (existingScript) {
          console.log('[useAppleMusicAuth] MusicKit script already exists in DOM, will wait for it to load');
          script = existingScript;
        } else {
          // Create and add script dynamically
          // Use v1 - the stable version
          script = document.createElement('script');
          script.src = 'https://js-cdn.music.apple.com/musickit/v1/musickit.js';
          script.crossOrigin = 'anonymous';
          script.defer = false; // Don't defer - load immediately
          
          // Add error handler BEFORE appending to catch initialization errors
          script.onerror = (error) => {
            console.error('[useAppleMusicAuth] ❌ Script failed to load:', error);
            setError('Failed to load Apple Music library. Please check your internet connection and try again.');
            resolve(false);
          };
          
          // Set up global error handler to catch MusicKit initialization errors
          const errorHandler = (event: ErrorEvent) => {
            if (event.filename && event.filename.includes('musickit.js')) {
              console.error('[useAppleMusicAuth] ❌ MusicKit script error:', event.message, 'at', event.filename, 'line', event.lineno);
              console.error('[useAppleMusicAuth] Error details:', event.error);
              // Don't resolve here - let the polling handle it
            }
          };
          window.addEventListener('error', errorHandler);
          
          // Load in body - MusicKit JS needs body context
          try {
            // Ensure we're appending to a valid parent
            if (document.body && document.body.parentNode) {
              document.body.appendChild(script);
              console.log('[useAppleMusicAuth] 📥 Added MusicKit v1 script to body');
            } else {
              // Fallback to head if body structure is unexpected
              document.head.appendChild(script);
              console.log('[useAppleMusicAuth] 📥 Added MusicKit v1 script to head (body structure issue)');
            }
          } catch (err) {
            console.error('[useAppleMusicAuth] ❌ Failed to append script:', err);
            setError('Failed to initialize Apple Music. Please refresh the page and try again.');
            window.removeEventListener('error', errorHandler);
            resolve(false);
            return;
          }
          
          // Clean up error handler after script loads (or timeout)
          setTimeout(() => {
            window.removeEventListener('error', errorHandler);
          }, 5000);
        }
        
        // Function to check if MusicKit is ready
        const checkMusicKitReady = (): boolean => {
          // Check multiple possible locations for MusicKit
          const MusicKitAPI = (window as any).MusicKit || 
                              (globalThis as any).MusicKit ||
                              (window as any).musicKit ||
                              (globalThis as any).musicKit;
          
          // If MusicKit exists but is empty object, it's not ready yet
          if (MusicKitAPI && Object.keys(MusicKitAPI).length === 0) {
            // Empty object - not ready yet
            return false;
          }
          
          if (MusicKitAPI) {
            const keys = Object.keys(MusicKitAPI);
            console.log('[useAppleMusicAuth] MusicKit found:', {
              type: typeof MusicKitAPI,
              hasConfigure: typeof MusicKitAPI.configure === 'function',
              hasGetInstance: typeof MusicKitAPI.getInstance === 'function',
              keysCount: keys.length,
              keys: keys.slice(0, 10)
            });
            
            // Check if it has the methods we need
            if (typeof MusicKitAPI.configure === 'function') {
              return true;
            }
            
            // Maybe it's a different API structure - check for common methods
            if (keys.length > 0) {
              console.log('[useAppleMusicAuth] MusicKit has keys but no configure method. Available methods:', keys);
            }
          }
          
          return false;
        };
        
        // Check immediately (might already be loaded)
        if (checkMusicKitReady()) {
          console.log('[useAppleMusicAuth] ✅ MusicKit already available');
          resolve(true);
          return;
        }
        
        // Add error handler for script loading
        script.onerror = (error) => {
          console.error('[useAppleMusicAuth] ❌ Script failed to load:', error);
          console.error('[useAppleMusicAuth] Script src:', script.src);
          console.error('[useAppleMusicAuth] Check Network tab for musickit.js - is it blocked?');
          setError('Failed to load Apple Music library. Please check your internet connection and try again.');
          resolve(false);
        };
        
        // Listen for script load event
        script.onload = () => {
          console.log('[useAppleMusicAuth] ✅ Script onload fired - script loaded successfully');
          console.log('[useAppleMusicAuth] Document readyState:', document.readyState);
          console.log('[useAppleMusicAuth] Checking if MusicKit initialized...');
          
          // Wait for DOM to be fully ready, then check multiple times
          const checkAfterLoad = (delay: number) => {
            setTimeout(() => {
              const MusicKitAPI = (window as any).MusicKit || (globalThis as any).MusicKit;
              const keys = MusicKitAPI ? Object.keys(MusicKitAPI) : [];
              console.log(`[useAppleMusicAuth] After ${delay}ms - MusicKit keys:`, keys.length, keys.slice(0, 5));
              
              if (keys.length === 0 && MusicKitAPI) {
                if (delay < 2000) {
                  // Keep checking for up to 2 seconds
                  checkAfterLoad(delay + 500);
                } else {
                  console.error('[useAppleMusicAuth] ⚠️ Script loaded but MusicKit is empty object after 2 seconds!');
                  console.error('[useAppleMusicAuth] This might indicate:');
                  console.error('[useAppleMusicAuth] 1. Script execution blocked (CSP/CORS)');
                  console.error('[useAppleMusicAuth] 2. Script error during execution');
                  console.error('[useAppleMusicAuth] 3. Something overwriting MusicKit');
                  console.error('[useAppleMusicAuth] 4. MusicKit requires specific DOM/environment conditions');
                  console.error('[useAppleMusicAuth] Check Console for script execution errors');
                }
              }
            }, delay);
          };
          
          // Start checking immediately, then at 500ms, 1000ms, 1500ms, 2000ms
          checkAfterLoad(0);
        };
        
        // Listen for musickitloaded event
        const onMusicKitLoaded = () => {
          console.log('[useAppleMusicAuth] ✅ musickitloaded event fired');
          if (checkMusicKitReady()) {
            console.log('[useAppleMusicAuth] ✅ MusicKit.configure available');
            clearInterval(pollInterval);
            resolve(true);
          } else {
            console.error('[useAppleMusicAuth] ❌ MusicKit.configure not available after musickitloaded event');
            // Continue polling
          }
        };
        
        document.addEventListener('musickitloaded', onMusicKitLoaded, { once: true });
        
        // Polling fallback - check every 100ms for MusicKit availability
        // This handles cases where musickitloaded event doesn't fire
        let attempts = 0;
        const maxAttempts = 100; // 10 seconds total (100 * 100ms)
        const pollInterval = setInterval(() => {
          attempts++;
          
          // Log every 10 attempts for debugging
          if (attempts % 10 === 0) {
            console.log('[useAppleMusicAuth] Polling attempt', attempts, '- checking for MusicKit...');
            const MusicKitAPI = (window as any).MusicKit || (globalThis as any).MusicKit;
            console.log('[useAppleMusicAuth] window.MusicKit:', MusicKitAPI ? 'exists' : 'undefined');
            if (MusicKitAPI) {
              console.log('[useAppleMusicAuth] MusicKit type:', typeof MusicKitAPI);
              console.log('[useAppleMusicAuth] MusicKit keys:', Object.keys(MusicKitAPI).slice(0, 5));
            }
          }
          
          if (checkMusicKitReady()) {
            console.log('[useAppleMusicAuth] ✅ MusicKit ready (detected via polling after', attempts * 100, 'ms)');
            clearInterval(pollInterval);
            document.removeEventListener('musickitloaded', onMusicKitLoaded);
            resolve(true);
          } else if (attempts >= maxAttempts) {
            console.error('[useAppleMusicAuth] ❌ Timeout waiting for MusicKit (tried', attempts, 'times)');
            console.error('[useAppleMusicAuth] Final check - window.MusicKit:', (window as any).MusicKit);
            console.error('[useAppleMusicAuth] Final check - globalThis.MusicKit:', (globalThis as any).MusicKit);
            console.error('[useAppleMusicAuth] Script src:', script.src);
            console.error('[useAppleMusicAuth] Script readyState:', (script as any).readyState);
            clearInterval(pollInterval);
            document.removeEventListener('musickitloaded', onMusicKitLoaded);
            // Check if there was a script execution error
            const scriptError = (script as any).__error;
            if (scriptError) {
              console.error('[useAppleMusicAuth] Script execution error detected:', scriptError);
            }
            setError('Apple Music authentication is not compatible with this environment. MusicKit JS requires a standard web browser environment. Please try using Spotify instead, or access the app from a standard web browser.');
            resolve(false);
          }
        }, 100);
      });
    } catch (err: any) {
      console.error('[useAppleMusicAuth] Error initializing MusicKit:', err);
      setError('Failed to initialize Apple Music. Please try again.');
      return false;
    }
  };

  // Function to configure MusicKit with developer token
  const configureMusicKit = async (devToken: string): Promise<boolean> => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return false;
    }

    try {
      // MusicKit JS automatically detects the current domain
      // For Apple Music, the app must be accessed via HTTPS (ngrok URL)
      // The redirect URI is registered in Apple Developer Portal
      const currentOrigin = window.location.origin;
      console.log('[useAppleMusicAuth] Configuring MusicKit on origin:', currentOrigin);
      console.log('[useAppleMusicAuth] Expected redirect URI:', REGISTERED_WEB_REDIRECT_URI);
      
      // MusicKit JS requires waiting for the 'musickitloaded' event before configuring
      // Check if MusicKit is already available (might be loaded but not configured)
      const MusicKit = (window as any).MusicKit;
      
      if (!MusicKit) {
        // Wait for musickitloaded event
        console.log('[useAppleMusicAuth] Waiting for musickitloaded event...');
        await new Promise<void>((resolve) => {
          const checkMusicKit = () => {
            if ((window as any).MusicKit) {
              console.log('[useAppleMusicAuth] ✅ MusicKit available');
              resolve();
            } else {
              // Listen for the musickitloaded event
              document.addEventListener('musickitloaded', () => {
                console.log('[useAppleMusicAuth] ✅ musickitloaded event fired');
                resolve();
              }, { once: true });
              
              // Also check periodically in case event already fired
              setTimeout(() => {
                if ((window as any).MusicKit) {
                  resolve();
                }
              }, 1000);
            }
          };
          checkMusicKit();
        });
      }
      
      const MusicKitAPI = (window as any).MusicKit;
      console.log('[useAppleMusicAuth] MusicKit API available:', !!MusicKitAPI);
      console.log('[useAppleMusicAuth] MusicKit type:', typeof MusicKitAPI);
      
      // MusicKit.configure() is a static method (not on window.MusicKit)
      if (typeof MusicKitAPI?.configure === 'function') {
        console.log('[useAppleMusicAuth] Using MusicKit.configure()');
        await MusicKitAPI.configure({
          developerToken: devToken,
          app: {
            name: 'Vybr',
            build: '1.0.0'
          }
        });
        console.log('[useAppleMusicAuth] ✅ MusicKit configured successfully');
        return true;
      } else {
        // Try global MusicKit (without window prefix)
        const globalMusicKit = (globalThis as any).MusicKit || (window as any).MusicKit;
        if (typeof globalMusicKit?.configure === 'function') {
          console.log('[useAppleMusicAuth] Using global MusicKit.configure()');
          await globalMusicKit.configure({
            developerToken: devToken,
            app: {
              name: 'Vybr',
              build: '1.0.0'
            }
          });
          console.log('[useAppleMusicAuth] ✅ MusicKit configured successfully');
          return true;
        } else {
          throw new Error(`MusicKit.configure is not a function. MusicKit type: ${typeof MusicKitAPI}, available: ${MusicKitAPI ? Object.keys(MusicKitAPI).join(', ') : 'none'}`);
        }
      }
    } catch (err: any) {
      console.error('[useAppleMusicAuth] ❌ Error configuring MusicKit:', err);
      console.error('[useAppleMusicAuth] Error details:', {
        message: err.message,
        name: err.name,
        stack: err.stack
      });
      setError(`Failed to configure Apple Music: ${err.message || 'Please try again.'}`);
      return false;
    }
  };

  // Function to fetch user profile
  const fetchUserProfile = async (userToken: string, devToken: string) => {
    try {
      // Apple Music API doesn't have a direct /me endpoint like Spotify
      // We can verify the token is valid by making a simple API call
      const response = await fetch(`${APPLE_MUSIC_API_URL}/me/library`, {
        headers: {
          'Authorization': `Bearer ${devToken}`,
          'Music-User-Token': userToken
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Store minimal user data (Apple Music doesn't provide user profile like Spotify)
        setUserData({ authorized: true });
        console.log('[useAppleMusicAuth] User profile verified');
      } else {
        // If 401 Unauthorized, token might be invalid
        if (response.status === 401) {
          console.warn('[useAppleMusicAuth] Token validation failed, user may need to re-authorize');
          await clearTokens();
        } else {
          const errorData = await response.json();
          throw new Error(errorData.errors?.[0]?.detail || 'Failed to verify user profile');
        }
      }
    } catch (err: any) {
      console.error('Error fetching Apple Music user profile:', err);
      // Don't set error here as it might be a temporary issue
    }
  };

  // Function to initiate Apple Music login using a popup window
  // We use a static HTML file for auth to avoid MusicKit JS conflicts with React Native Web
  const login = useCallback(async () => {
    setError(null);
    console.log('[useAppleMusicAuth] 🎵 Prompting Apple Music login via popup...');
    
    setIsLoading(true);
    setIsLoggedIn(false);

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Step 1: Fetch developer token
        console.log('[useAppleMusicAuth] Step 1: Fetching developer token...');
        const devToken = await fetchDeveloperToken();
        if (!devToken) {
          throw new Error('Failed to get Apple Music developer token');
        }
        
        // Step 2: Open popup for auth
        console.log('[useAppleMusicAuth] Step 2: Opening auth popup...');
        
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        // Use the static HTML file in public folder
        const authUrl = `${window.location.origin}/apple-music-auth.html?devToken=${encodeURIComponent(devToken)}`;
        console.log('[useAppleMusicAuth] Auth URL:', authUrl);
        
        const popup = window.open(
          authUrl,
          'AppleMusicAuth',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
        );
        
        if (!popup) {
          throw new Error('Popup blocked. Please allow popups for this site.');
        }
        
        // Step 3: Listen for message from popup
        const handleMessage = async (event: MessageEvent) => {
          if (event.data?.type === 'APPLE_MUSIC_AUTH_SUCCESS' && event.data.token) {
            console.log('[useAppleMusicAuth] ✅ Received token from popup');
            
            // Cleanup
            window.removeEventListener('message', handleMessage);
            if (checkPopup) clearInterval(checkPopup);
            
            const userToken = event.data.token;
            
            // Store tokens
            await AsyncStorage.setItem(APPLE_MUSIC_USER_TOKEN_KEY, userToken);
            setUserToken(userToken);
            setDeveloperToken(devToken);
            setIsLoggedIn(true);
            setError(null);
            
            // Fetch profile to verify
            await fetchUserProfile(userToken, devToken);
            setIsLoading(false);
          }
        };
        
        window.addEventListener('message', handleMessage);
        
        // Check if popup closed
        const checkPopup = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkPopup);
            window.removeEventListener('message', handleMessage);
            // If we are not logged in yet, it means user closed popup without success
            if (!userToken) { 
               setIsLoading(false);
               console.log('[useAppleMusicAuth] Popup closed by user');
            }
          }
        }, 1000);
        
      } else {
        setError('Apple Music authentication is currently only supported on web.');
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('[useAppleMusicAuth] Auth error:', err);
      setError(err.message || 'Authentication failed');
      setIsLoading(false);
    }
  }, [credentialsLoaded, fetchDeveloperToken, fetchUserProfile, userToken]);


  // Function to logout
  const logout = async () => {
    // No MusicKit JS - just clear tokens
    await clearTokens();
    Alert.alert('Logged Out', 'You have been logged out of Apple Music');
  };

  // Function to get user's heavy rotation (similar to top artists/tracks)
  const getHeavyRotation = async (limit: number = 50): Promise<{ artists: TopArtist[]; tracks: TopTrack[] }> => {
    if (!userToken || !developerToken) {
      throw new Error('Not authenticated with Apple Music');
    }
    
    try {
      console.log(`[useAppleMusicAuth] Fetching heavy rotation with limit: ${limit}`);
      
      // Apple Music API endpoint for heavy rotation
      const response = await fetch(`${APPLE_MUSIC_API_URL}/me/history/heavy-rotation`, {
        headers: {
          'Authorization': `Bearer ${developerToken}`,
          'Music-User-Token': userToken
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.errors?.[0]?.detail || `Failed to fetch heavy rotation: ${response.status}`);
      }
      
      const data = await response.json();
      const resources = data.data || [];
      
      // Parse artists and tracks from heavy rotation
      const artists: TopArtist[] = [];
      const tracks: TopTrack[] = [];
      
      resources.forEach((resource: any) => {
        if (resource.type === 'artists') {
          artists.push({
            id: resource.id,
            name: resource.attributes.name,
            genres: [],
            images: resource.attributes.artwork ? [{
              url: resource.attributes.artwork.url.replace('{w}', '300').replace('{h}', '300'),
              height: 300,
              width: 300
            }] : [],
            popularity: 0,
            uri: `apple-music:artist:${resource.id}`
          });
        } else if (resource.type === 'songs') {
          tracks.push({
            id: resource.id,
            name: resource.attributes.name,
            uri: `apple-music:song:${resource.id}`,
            album: {
              id: resource.relationships?.albums?.data?.[0]?.id || '',
              name: resource.attributes.albumName || '',
              images: resource.attributes.artwork ? [{
                url: resource.attributes.artwork.url.replace('{w}', '300').replace('{h}', '300'),
                height: 300,
                width: 300
              }] : []
            },
            artists: resource.attributes.artistName ? [{
              id: '',
              name: resource.attributes.artistName
            }] : [],
            popularity: 0
          });
        }
      });
      
      console.log(`[useAppleMusicAuth] Found ${artists.length} artists and ${tracks.length} tracks in heavy rotation`);
      return { artists, tracks };
    } catch (err: any) {
      console.error('Error fetching Apple Music heavy rotation:', err);
      throw err;
    }
  };

  // Function to get user's recently played tracks
  const getRecentlyPlayedTracks = async (limit: number = 50): Promise<TopTrack[]> => {
    if (!userToken || !developerToken) {
      throw new Error('Not authenticated with Apple Music');
    }
    
    try {
      console.log(`[useAppleMusicAuth] Fetching recently played tracks with limit: ${limit}`);
      
      const response = await fetch(`${APPLE_MUSIC_API_URL}/me/recent/played/tracks`, {
        headers: {
          'Authorization': `Bearer ${developerToken}`,
          'Music-User-Token': userToken
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.errors?.[0]?.detail || `Failed to fetch recently played: ${response.status}`);
      }
      
      const data = await response.json();
      const resources = data.data || [];
      
      const tracks: TopTrack[] = resources.slice(0, limit).map((resource: any) => ({
        id: resource.id,
        name: resource.attributes.name,
        uri: `apple-music:song:${resource.id}`,
        album: {
          id: resource.relationships?.albums?.data?.[0]?.id || '',
          name: resource.attributes.albumName || '',
          images: resource.attributes.artwork ? [{
            url: resource.attributes.artwork.url.replace('{w}', '300').replace('{h}', '300'),
            height: 300,
            width: 300
          }] : []
        },
        artists: resource.attributes.artistName ? [{
          id: '',
          name: resource.attributes.artistName
        }] : [],
        popularity: 0
      }));
      
      console.log(`[useAppleMusicAuth] Found ${tracks.length} recently played tracks`);
      return tracks;
    } catch (err: any) {
      console.error('Error fetching Apple Music recently played tracks:', err);
      throw err;
    }
  };

  // Function to fetch, calculate, and save all streaming data
  const fetchAndSaveAppleMusicData = async (isPremium: boolean = false): Promise<boolean> => {
    if (!userToken || !developerToken || !session?.user?.id) {
      return false;
    }
    
    setIsLoading(true);
    setError(null);
    setIsUpdatingListeningData(true);
    
    let topMoodsData: TopMood[] = [];

    try {
      // 1. Try to get heavy rotation first (Apple Music's equivalent of top artists/tracks)
      console.log('[useAppleMusicAuth] Step 1: Fetching heavy rotation...');
      let topArtists: TopArtist[] = [];
      let topTracks: TopTrack[] = [];
      
      try {
        const heavyRotation = await getHeavyRotation(50);
        topArtists = heavyRotation.artists;
        topTracks = heavyRotation.tracks;
      } catch (heavyRotationError) {
        console.warn('[useAppleMusicAuth] Heavy rotation failed, trying recently played...', heavyRotationError);
        // Fallback to recently played
        topTracks = await getRecentlyPlayedTracks(50);
        // Extract artists from tracks
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
      
      console.log(`[useAppleMusicAuth] Step 1 completed: Got ${topArtists.length} artists, ${topTracks.length} tracks`);
      
      // 2. Calculate top genres from artists
      console.log('[useAppleMusicAuth] Step 2: Calculating top genres...');
      const topGenres = calculateTopGenres(topArtists);
      console.log(`[useAppleMusicAuth] Step 2 completed: Got ${topGenres.length} top genres`);
      
      // 3. Extract top albums from tracks
      console.log('[useAppleMusicAuth] Step 3: Extracting top albums...');
      const albumMap = new Map<string, TopAlbum>();
      topTracks.forEach(track => {
        if (track.album && !albumMap.has(track.album.id)) {
          albumMap.set(track.album.id, {
            id: track.album.id,
            name: track.album.name,
            images: track.album.images,
            artists: track.artists.length > 0 ? [track.artists[0]] : [],
            uri: `apple-music:album:${track.album.id}`
          });
        }
      });
      const topAlbums = Array.from(albumMap.values());
      console.log(`[useAppleMusicAuth] Step 3 completed: Got ${topAlbums.length} top albums`);
      
      // 4. Mood analysis (same as Spotify)
      if (isPremium && topTracks.length > 0) {
        console.log('[useAppleMusicAuth] Starting mood analysis for premium user.');
        try {
          const songsForMoodAnalysis: SongForMoodAnalysis[] = topTracks
            .slice(0, 20)
            .map(track => ({ title: track.name, artist: track.artists[0]?.name || 'Unknown Artist', id: track.id }));

          if (songsForMoodAnalysis.length > 0) {
            const { data: apiKeyData, error: apiKeyError } = await supabase.rpc('get_google_api_key');
            if (apiKeyError) {
              console.error('[useAppleMusicAuth] Error response from get_google_api_key RPC:', apiKeyError);
            } else if (!apiKeyData) {
              console.error('[useAppleMusicAuth] Google API key not found.');
            } else {
              const googleApiKey = apiKeyData as string;
              const prompt = generateGeminiMoodAnalysisPrompt(songsForMoodAnalysis);
              
              console.log('[useAppleMusicAuth] Calling Gemini API for mood analysis...');
              const geminiResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${googleApiKey}`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    contents: [
                      {
                        parts: [
                          { text: prompt }
                        ]
                      }
                    ],
                    generationConfig: {
                        responseMimeType: "application/json",
                    }
                  }),
                }
              );

              if (!geminiResponse.ok) {
                const errorText = await geminiResponse.text();
                console.error('[useAppleMusicAuth] Gemini API error:', geminiResponse.status, errorText);
              } else {
                const geminiResult = await geminiResponse.json();
                let categorizedSongs: GeminiMoodResponseItem[] = [];
                if (geminiResult.candidates && geminiResult.candidates[0].content && geminiResult.candidates[0].content.parts && geminiResult.candidates[0].content.parts[0].text) {
                    try {
                        categorizedSongs = JSON.parse(geminiResult.candidates[0].content.parts[0].text);
                    } catch (parseError) {
                        console.error('[useAppleMusicAuth] Error parsing Gemini JSON response:', parseError);
                    }
                }

                if (Array.isArray(categorizedSongs) && categorizedSongs.length > 0) {
                  const moodCounts: { [moodName: string]: number } = {};
                  categorizedSongs.forEach(song => {
                    if (song.determinedMood && MUSIC_MOODS.some(m => m.moodName === song.determinedMood)) {
                      moodCounts[song.determinedMood] = (moodCounts[song.determinedMood] || 0) + 1;
                    }
                  });

                  const sortedMoods = Object.entries(moodCounts)
                    .map(([name, count]) => ({ name, count, score: count }))
                    .sort((a, b) => b.count - a.count);
                  
                  topMoodsData = sortedMoods.slice(0, 3);
                  console.log('[useAppleMusicAuth] Top moods calculated:', topMoodsData);
                }
              }
            }
          }
        } catch (moodError: any) {
          console.error('[useAppleMusicAuth] Error during mood analysis:', moodError);
        }
      }
      
      // 5. Prepare the data based on premium status
      const limitedArtists = isPremium ? topArtists.slice(0, 5) : topArtists.slice(0, 3);
      const limitedTracks = isPremium ? topTracks.slice(0, 5) : topTracks.slice(0, 3);
      const limitedAlbums = isPremium ? topAlbums.slice(0, 5) : topAlbums.slice(0, 3);
      const limitedGenres = isPremium ? topGenres.slice(0, 5) : topGenres.slice(0, 3);
      
      // Create a snapshot date (today)
      const snapshotDate = new Date().toISOString().split('T')[0];
      
      // 6. Save to database using the new schema
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
      
      if (topArtists.length === 0 && topTracks.length === 0) {
        console.warn(`[useAppleMusicAuth] No music data found for user ${session.user.id}.`);
        setError('No listening history found. Please use Apple Music for a few weeks and try refreshing your music data again.');
      } else {
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

  // Force fetch for a specific user ID (used during signup)
  const forceFetchAndSaveAppleMusicData = async (
    userId: string,
    isPremium: boolean = false
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    setIsUpdatingListeningData(true);
    
    console.log(`[useAppleMusicAuth] forceFetchAndSaveAppleMusicData called for user ${userId}, isPremium: ${isPremium}`);
    
    // Load tokens if not available
    if (!userToken || !developerToken) {
      const storedUserToken = await AsyncStorage.getItem(APPLE_MUSIC_USER_TOKEN_KEY);
      const storedDevToken = await AsyncStorage.getItem(APPLE_MUSIC_DEV_TOKEN_KEY);
      
      if (!storedUserToken || !storedDevToken) {
        setError('Apple Music session expired. Please reconnect your account.');
        setIsLoading(false);
        setIsUpdatingListeningData(false);
        return false;
      }
      
      setUserToken(storedUserToken);
      setDeveloperToken(storedDevToken);
    }
    
    // Use the same logic as fetchAndSaveAppleMusicData but with userId parameter
    const currentUserToken = userToken || await AsyncStorage.getItem(APPLE_MUSIC_USER_TOKEN_KEY);
    const currentDevToken = developerToken || await AsyncStorage.getItem(APPLE_MUSIC_DEV_TOKEN_KEY);
    
    if (!currentUserToken || !currentDevToken) {
      setError('Unable to authenticate with Apple Music. Please reconnect your account.');
      setIsLoading(false);
      setIsUpdatingListeningData(false);
      return false;
    }
    
    // Temporarily set session user ID for the fetch function
    const originalUserId = session?.user?.id;
    // We'll need to modify fetchAndSaveAppleMusicData to accept userId, or duplicate the logic
    // For now, let's duplicate the core logic
    
    let topMoodsData: TopMood[] = [];
    
    try {
      // Same logic as fetchAndSaveAppleMusicData
      let topArtists: TopArtist[] = [];
      let topTracks: TopTrack[] = [];
      
      try {
        const heavyRotation = await getHeavyRotation(50);
        topArtists = heavyRotation.artists;
        topTracks = heavyRotation.tracks;
      } catch (heavyRotationError) {
        topTracks = await getRecentlyPlayedTracks(50);
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
      
      const topGenres = calculateTopGenres(topArtists);
      
      const albumMap = new Map<string, TopAlbum>();
      topTracks.forEach(track => {
        if (track.album && !albumMap.has(track.album.id)) {
          albumMap.set(track.album.id, {
            id: track.album.id,
            name: track.album.name,
            images: track.album.images,
            artists: track.artists.length > 0 ? [track.artists[0]] : [],
            uri: `apple-music:album:${track.album.id}`
          });
        }
      });
      const topAlbums = Array.from(albumMap.values());
      
      // Mood analysis (same as above)
      if (isPremium && topTracks.length > 0) {
        try {
          const songsForMoodAnalysis: SongForMoodAnalysis[] = topTracks
            .slice(0, 20)
            .map(track => ({ title: track.name, artist: track.artists[0]?.name || 'Unknown Artist', id: track.id }));

          if (songsForMoodAnalysis.length > 0) {
            const { data: apiKeyData } = await supabase.rpc('get_google_api_key');
            if (apiKeyData) {
              const googleApiKey = apiKeyData as string;
              const prompt = generateGeminiMoodAnalysisPrompt(songsForMoodAnalysis);
              
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

              if (geminiResponse.ok) {
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
                      topMoodsData = sortedMoods.slice(0, 3);
                    }
                  } catch (parseError) {
                    console.error('[useAppleMusicAuth] Error parsing Gemini response:', parseError);
                  }
                }
              }
            }
          }
        } catch (moodError) {
          console.error('[useAppleMusicAuth] Error during mood analysis:', moodError);
        }
      }
      
      const limitedArtists = isPremium ? topArtists.slice(0, 5) : topArtists.slice(0, 3);
      const limitedTracks = isPremium ? topTracks.slice(0, 5) : topTracks.slice(0, 3);
      const limitedAlbums = isPremium ? topAlbums.slice(0, 5) : topAlbums.slice(0, 3);
      const limitedGenres = isPremium ? topGenres.slice(0, 5) : topGenres.slice(0, 3);
      
      const snapshotDate = new Date().toISOString().split('T')[0];
      
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
        }, {
          onConflict: 'user_id,service_id,snapshot_date'
        });
      
      if (saveError) throw saveError;
      
      if (topArtists.length === 0 && topTracks.length === 0) {
        console.warn(`[useAppleMusicAuth] No music data found for user ${userId}.`);
        setError('No listening history found.');
      } else {
        console.log(`Successfully saved Apple Music data for user ${userId}.`);
      }
      
      return true;
    } catch (err: any) {
      console.error('Error in forceFetchAndSaveAppleMusicData:', err);
      setError(`Failed to force fetch Apple Music data: ${err.message}`);
      return false;
    } finally {
      setIsLoading(false);
      setIsUpdatingListeningData(false);
    }
  };

  // Function to verify authorization completed
  const verifyAuthorizationCompleted = async (): Promise<boolean> => {
    if (!userToken || !developerToken) {
      console.log('[useAppleMusicAuth] No tokens available, authorization not complete');
      return false;
    }
    
    // Verify token with an API call
    try {
      const response = await fetch(`${APPLE_MUSIC_API_URL}/me/library`, {
        headers: {
          'Authorization': `Bearer ${developerToken}`,
          'Music-User-Token': userToken
        }
      });
      
      return response.ok;
    } catch (err) {
      console.error('[useAppleMusicAuth] Token validation error:', err);
      return false;
    }
  };

  // Return the hook interface
  return {
    login,
    logout,
    isLoggedIn,
    isLoading,
    error,
    userData,
    getHeavyRotation,
    getRecentlyPlayedTracks,
    userToken,
    developerToken,
    fetchAndSaveAppleMusicData,
    forceFetchAndSaveAppleMusicData,
    isUpdatingListeningData,
    verifyAuthorizationCompleted,
    credentialsLoaded,
  };
};