import { Platform } from 'react-native';
import { supabase } from './supabase';
import Constants from 'expo-constants';
import { createPowerSyncDatabase } from './powersync/database';
import { PowerSyncConnector } from './powersync/connector';

// Access environment variables
const powersyncUrl = process.env.POWERSYNC_URL || Constants.expoConfig?.extra?.POWERSYNC_URL;

if (!powersyncUrl) {
  console.error('❌ PowerSync: URL is missing. Please check your environment variables.');
  console.log('🔍 PowerSync: Available extra config:', Constants.expoConfig?.extra);
} else {
  console.log('✅ PowerSync: URL configured:', powersyncUrl);
}

// Platform-specific PowerSync configuration
// Note: PowerSync is only used on mobile platforms
// Web platform uses Supabase directly for data access
export const powersyncConfig = {
  endpoint: powersyncUrl as string,
  platform: Platform.OS,
  // The database will be connected when the user is authenticated
  // This will be set up in the PowerSyncProvider
};

// Helper function to get auth token for PowerSync
export const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

// Helper function to check if user is authenticated
export const isAuthenticated = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
};

// Export the PowerSync connector
export { PowerSyncConnector } from './powersync/connector';
export { createAppSchema } from './powersync/schema';

// Re-export the createPowerSyncDatabase function
export { createPowerSyncDatabase } from './powersync/database';

console.log('PowerSync configuration loaded:', { powersyncUrl, platform: Platform.OS }); 