import { Platform } from 'react-native';
import { createAppSchema } from './schema';
import Constants from 'expo-constants';

// Access environment variables
const powersyncUrl = process.env.POWERSYNC_URL || Constants.expoConfig?.extra?.POWERSYNC_URL;

if (!powersyncUrl) {
  console.error('❌ PowerSync: URL is missing. Please check your environment variables.');
  console.log('🔍 PowerSync: Available extra config:', Constants.expoConfig?.extra);
} else {
  console.log('✅ PowerSync: URL configured:', powersyncUrl);
}

// Platform-specific database creation
export const createPowerSyncDatabase = async () => {
  const platform = Platform.OS;
  
  console.log('🔍 PowerSync: createPowerSyncDatabase called');
  console.log('🔍 PowerSync: Platform:', platform);
  console.log('🔍 PowerSync: isWeb:', platform === 'web');
  
  if (platform === 'web') {
    // Web platform - PowerSync not supported, return null
    console.log('⚠️ PowerSync: Web platform not supported, using Supabase instead');
    return null;
  } else {
    // Mobile implementation using PowerSync React Native SDK
    try {
      console.log(`🔍 PowerSync: Creating ${platform} database...`);
      
      // Import PowerSync React Native SDK dynamically with error handling
      let PowerSyncDatabaseNative;
      try {
        const powersyncNativeModule = await import('@powersync/react-native');
        PowerSyncDatabaseNative = powersyncNativeModule.PowerSyncDatabase;
      } catch (importError) {
        console.error('❌ PowerSync: Failed to import @powersync/react-native:', importError);
        return null;
      }
      
      if (!PowerSyncDatabaseNative) {
        console.error('❌ PowerSync: PowerSyncDatabase not found in module');
        return null;
      }
      
      // Create the schema dynamically
      const schema = await createAppSchema();
      
      const database = new PowerSyncDatabaseNative({
        schema,
        database: {
          dbFilename: 'vybr-powersync-mobile.db'
        }
      });

      console.log(`✅ PowerSync: ${platform} database created successfully`);
      return database;
    } catch (error) {
      console.error(`❌ Failed to create PowerSync ${platform} database:`, error);
      return null;
    }
  }
}; 