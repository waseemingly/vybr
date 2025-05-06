import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// YOUTUBE MUSIC AUTH TOKEN KEYS
const YTM_TOKEN_KEY = 'ytm_oauth_token';
const YTM_REFRESH_TOKEN_KEY = 'ytm_refresh_token';
const YTM_TOKEN_EXPIRY_KEY = 'ytm_token_expiry';

// Get YouTube Music token without using hooks
export const getYTMToken = async () => {
  try {
    let token, refreshToken, expiryStr;
    
    // On web, use localStorage directly
    if (Platform.OS === 'web') {
      token = localStorage.getItem(YTM_TOKEN_KEY);
      refreshToken = localStorage.getItem(YTM_REFRESH_TOKEN_KEY);
      expiryStr = localStorage.getItem(YTM_TOKEN_EXPIRY_KEY);
      
      console.log('[YTMAuthUtils] Getting tokens from localStorage:', { 
        hasToken: !!token,
        hasRefreshToken: !!refreshToken,
        hasExpiry: !!expiryStr
      });
    } else {
      // For native platforms, use SecureStore
      token = await SecureStore.getItemAsync(YTM_TOKEN_KEY);
      refreshToken = await SecureStore.getItemAsync(YTM_REFRESH_TOKEN_KEY);
      expiryStr = await SecureStore.getItemAsync(YTM_TOKEN_EXPIRY_KEY);
    }
    
    if (!token || !refreshToken || !expiryStr) {
      return null;
    }
    
    const expiry = new Date(expiryStr);
    const now = new Date();
    
    return { 
      token, 
      refreshToken, 
      needsRefresh: now > expiry 
    };
  } catch (err) {
    console.error('[YTMAuthUtils] Error getting tokens:', err);
    return null;
  }
}; 