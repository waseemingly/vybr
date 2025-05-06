import * as SecureStore from 'expo-secure-store';
import { Store } from 'libmuse'; // Assuming libmuse exports its abstract Store class

// Key prefix for SecureStore items related to YouTube Music
const YTM_STORE_PREFIX = 'ytm_muse_store_';

export class SecureYouTubeMusicStore extends Store {
    private async getKey(key: string): Promise<string> {
        return `${YTM_STORE_PREFIX}${key}`;
    }

    async get<T>(key: string): Promise<T | null> {
        console.log(`[SecureYouTubeMusicStore] Getting key: ${key}`);
        const storeKey = await this.getKey(key);
        try {
            const jsonValue = await SecureStore.getItemAsync(storeKey);
            if (jsonValue !== null) {
                console.log(`[SecureYouTubeMusicStore] Found value for key: ${key}`);
                return JSON.parse(jsonValue) as T;
            }
            console.log(`[SecureYouTubeMusicStore] No value found for key: ${key}`);
            return null;
        } catch (error) {
            console.error(`[SecureYouTubeMusicStore] Error getting item for key ${key}:`, error);
            // Attempt to delete potentially corrupted data
            try {
                await SecureStore.deleteItemAsync(storeKey);
                console.warn(`[SecureYouTubeMusicStore] Deleted potentially corrupted item for key: ${key}`);
            } catch (deleteError) {
                console.error(`[SecureYouTubeMusicStore] Failed to delete corrupted item for key ${key}:`, deleteError);
            }
            return null;
        }
    }

    async set(key: string, value: unknown): Promise<void> {
        console.log(`[SecureYouTubeMusicStore] Setting key: ${key}`);
        const storeKey = await this.getKey(key);
        try {
            const jsonValue = JSON.stringify(value);
            await SecureStore.setItemAsync(storeKey, jsonValue);
            console.log(`[SecureYouTubeMusicStore] Successfully set value for key: ${key}`);
        } catch (error) {
            console.error(`[SecureYouTubeMusicStore] Error setting item for key ${key}:`, error);
            // Handle potential storage limit errors if necessary
        }
    }

    async delete(key: string): Promise<void> {
        console.log(`[SecureYouTubeMusicStore] Deleting key: ${key}`);
        const storeKey = await this.getKey(key);
        try {
            await SecureStore.deleteItemAsync(storeKey);
            console.log(`[SecureYouTubeMusicStore] Successfully deleted key: ${key}`);
        } catch (error) {
            console.error(`[SecureYouTubeMusicStore] Error deleting item for key ${key}:`, error);
        }
    }

    // Optional: Implement clearAll for full logout if needed
    async clearAllYtmData(): Promise<void> {
        console.warn('[SecureYouTubeMusicStore] Clearing ALL YouTube Music data from SecureStore!');
        // Note: SecureStore doesn't have a way to list keys.
        // We need to explicitly delete known keys used by libmuse (e.g., 'token', 'context').
        // Check libmuse source or debug logs to find exact keys used.
        const knownKeys = ['token', 'context', 'visitor_id']; // Add other known keys if discovered
        for (const key of knownKeys) {
            await this.delete(key);
        }
        console.log('[SecureYouTubeMusicStore] Finished attempting to clear known YTM keys.');
    }
}

// Export an instance for easy use
export const secureYouTubeMusicStore = new SecureYouTubeMusicStore();