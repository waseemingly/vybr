import { Platform } from 'react-native';

/**
 * Safe localStorage wrapper that handles iOS Safari private mode errors
 * iOS Safari throws QuotaExceededError when accessing localStorage in private mode
 */
export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (Platform.OS !== 'web' || typeof localStorage === 'undefined') {
      return null;
    }
    
    try {
      return localStorage.getItem(key);
    } catch (error) {
      // iOS Safari private mode throws QuotaExceededError
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('[safeStorage] localStorage not available (likely iOS Safari private mode)');
        return null;
      }
      console.error('[safeStorage] Error getting item from localStorage:', error);
      return null;
    }
  },

  setItem: (key: string, value: string): boolean => {
    if (Platform.OS !== 'web' || typeof localStorage === 'undefined') {
      return false;
    }
    
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      // iOS Safari private mode throws QuotaExceededError
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('[safeStorage] localStorage not available (likely iOS Safari private mode)');
        return false;
      }
      console.error('[safeStorage] Error setting item in localStorage:', error);
      return false;
    }
  },

  removeItem: (key: string): boolean => {
    if (Platform.OS !== 'web' || typeof localStorage === 'undefined') {
      return false;
    }
    
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      // iOS Safari private mode throws QuotaExceededError
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('[safeStorage] localStorage not available (likely iOS Safari private mode)');
        return false;
      }
      console.error('[safeStorage] Error removing item from localStorage:', error);
      return false;
    }
  },

  isAvailable: (): boolean => {
    if (Platform.OS !== 'web' || typeof localStorage === 'undefined') {
      return false;
    }
    
    try {
      const testKey = '__localStorage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }
};

