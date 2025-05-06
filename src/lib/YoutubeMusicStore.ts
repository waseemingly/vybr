import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Define the Store abstract class since we can't directly import from libmuse in TypeScript
// This matches the interface from libmuse
export abstract class Store {
    abstract get<T>(key: string): T | null;
    abstract set(key: string, value: unknown): void;
    abstract delete(key: string): void;
    // Add version property required by libmuse - must be string
    version = '1';
}

// Key prefix for SecureStore items related to YouTube Music
const YTM_STORE_PREFIX = 'ytm_muse_store_';

// Helper for web platform which doesn't support SecureStore
const webStorage = {
    async getItem(key: string): Promise<string | null> {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.error(`[WebStorage] Error getting item for key ${key}:`, e);
            return null;
        }
    },
    async setItem(key: string, value: string): Promise<void> {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.error(`[WebStorage] Error setting item for key ${key}:`, e);
        }
    },
    async removeItem(key: string): Promise<void> {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error(`[WebStorage] Error removing item for key ${key}:`, e);
        }
    }
};

// Use SecureStore on native, localStorage on web with consistent API
const storage = Platform.OS === 'web' 
    ? webStorage 
    : {
        getItem: SecureStore.getItemAsync,
        setItem: SecureStore.setItemAsync,
        removeItem: SecureStore.deleteItemAsync
    };

export class SecureYouTubeMusicStore extends Store {
    // We must include the version property here too
    version = '1';
    
    private async getKey(key: string): Promise<string> {
        return `${YTM_STORE_PREFIX}${key}`;
    }

    // Implementation that returns directly instead of Promise
    get<T>(key: string): T | null {
        const storeKey = `${YTM_STORE_PREFIX}${key}`;
        try {
            console.log(`[SecureYouTubeMusicStore] SYNC Get requested for key: ${key}, platform: ${Platform.OS}`);
            
            // Create empty cache for libmuse when we can't return the actual value
            if (key === 'visitor_id') return '' as unknown as T;
            if (key === 'token') {
                // For token, we'll handle auth directly in the hook
                return null;
            }
            
            return null;
        } catch (error) {
            console.error(`[SecureYouTubeMusicStore] Error in sync get for key ${key}:`, error);
            return null;
        }
    }

    // Implementation that doesn't actually store anything synchronously
    set(key: string, value: unknown): void {
        console.log(`[SecureYouTubeMusicStore] SYNC Set requested for key: ${key}, platform: ${Platform.OS}`);
        // We handle token storage separately in the hook
        return;
    }

    // Implementation that doesn't actually delete anything synchronously
    delete(key: string): void {
        console.log(`[SecureYouTubeMusicStore] SYNC Delete requested for key: ${key}, platform: ${Platform.OS}`);
        // We handle token deletion separately in the hook
        return;
    }

    // Real async methods that could be used by our code
    async getAsync<T>(key: string): Promise<T | null> {
        const storeKey = await this.getKey(key);
        try {
            const value = await storage.getItem(storeKey);
            if (value === null) return null;
            return JSON.parse(value) as T;
        } catch (error) {
            console.error(`[SecureYouTubeMusicStore] Error in getAsync for key ${key}:`, error);
            return null;
        }
    }

    async setAsync(key: string, value: unknown): Promise<void> {
        const storeKey = await this.getKey(key);
        try {
            await storage.setItem(storeKey, JSON.stringify(value));
        } catch (error) {
            console.error(`[SecureYouTubeMusicStore] Error in setAsync for key ${key}:`, error);
        }
    }

    async deleteAsync(key: string): Promise<void> {
        const storeKey = await this.getKey(key);
        try {
            await storage.removeItem(storeKey);
        } catch (error) {
            console.error(`[SecureYouTubeMusicStore] Error in deleteAsync for key ${key}:`, error);
        }
    }

    // Method to clear all YouTube Music related data
    async clearAllYtmData(): Promise<void> {
        try {
            // List all keys that might have been set by YTM 
            const keysToDelete = [
                'token', 'visitor_id', 'request_theme', 'client_config',
                'client', 'logged_in', 'auth_token', 'access_token', 'refresh_token'
            ];
            
            // Delete each key
            for (const key of keysToDelete) {
                const storeKey = await this.getKey(key);
                await storage.removeItem(storeKey);
                console.log(`[SecureYouTubeMusicStore] Deleted key: ${key}`);
            }
            
            console.log('[SecureYouTubeMusicStore] Cleared all YTM data');
        } catch (error) {
            console.error('[SecureYouTubeMusicStore] Error clearing YTM data:', error);
        }
    }
}

// Export instance for use in the app
export const secureYouTubeMusicStore = new SecureYouTubeMusicStore();