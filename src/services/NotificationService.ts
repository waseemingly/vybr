import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { devLog, devWarn, devError } from '@/utils/logger';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  private static instance: NotificationService;
  private expoPushToken: string | null = null;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Register for push notifications and store the token in the database.
   * Only supported on native (iOS/Android). On web we skip; push is delivered when user opens the app on a device.
   */
  async registerForPushNotifications(userId: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      devLog('[NotificationService] Skipping Expo push registration on web (no native token).');
      return null;
    }
    try {
      devLog('[NotificationService] Starting push notification registration for user:', userId);
      devLog('[NotificationService] Platform:', Platform.OS);

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
        devLog('[NotificationService] Android notification channel configured');
      }

      // Check if running on a physical device
      const isPhysicalDevice = Device.isDevice;
      devLog('[NotificationService] Device.isDevice:', isPhysicalDevice);
      devLog('[NotificationService] Device info:', {
        brand: Device.brand,
        manufacturer: Device.manufacturer,
        modelName: Device.modelName,
        osName: Device.osName,
        osVersion: Device.osVersion,
      });

      // Allow registration even on emulators for development/testing
      // Push notifications won't work on emulators, but tokens can still be registered
      // This helps with debugging and ensures tokens are registered on physical devices
      if (!isPhysicalDevice) {
        devWarn('[NotificationService] Running on emulator/simulator - push notifications may not work, but attempting registration anyway...');
        // Continue with registration - the token might still be useful for testing
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      devLog('[NotificationService] Existing permission status:', existingStatus);
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        devLog('[NotificationService] Requesting notification permissions...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        devLog('[NotificationService] Permission request result:', finalStatus);
      }
      
      if (finalStatus !== 'granted') {
        devError('[NotificationService] Failed to get push token - permissions not granted!');
        return null;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      devLog('[NotificationService] EAS Project ID:', projectId);
      
      if (!projectId) {
        devError('[NotificationService] EAS Project ID is missing! Push notifications may not work.');
      }

      devLog('[NotificationService] Getting Expo push token...');
      
      // Check if Firebase is properly configured (Android only)
      if (Platform.OS === 'android' && !isPhysicalDevice) {
        // On emulator, Firebase may not be initialized
        // This is expected and we should handle it gracefully
        devWarn('[NotificationService] Running on Android emulator - Firebase may not be initialized.');
        devWarn('[NotificationService] Attempting to get token anyway (may fail, but worth trying)...');
      }
      
      try {
        const token = await Notifications.getExpoPushTokenAsync({
          projectId,
        });

        devLog('[NotificationService] ✅ Expo push token obtained:', token.data);
        this.expoPushToken = token.data;

        // Store the token in the database
        devLog('[NotificationService] Storing push token in database...');
        await this.storePushToken(userId, token.data);

        devLog('[NotificationService] ✅ Push notification registration completed successfully');
        if (!isPhysicalDevice) {
          devWarn('[NotificationService] ⚠️ Note: Token registered but push notifications may not work on emulator.');
        }
        return token.data;
      } catch (tokenError: any) {
        // Check if this is a Firebase initialization error
        if (tokenError.message && tokenError.message.includes('FirebaseApp is not initialized')) {
          devWarn('[NotificationService] Firebase not initialized. This is expected on emulators or if FCM credentials are not configured.');
          devWarn('[NotificationService] To fix: Configure FCM credentials in EAS dashboard or add google-services.json for local builds.');
          
          // On emulator, this is expected - but still log it clearly
          if (!isPhysicalDevice) {
            devWarn('[NotificationService] ⚠️ Cannot get push token on emulator due to Firebase initialization error.');
            devWarn('[NotificationService] ⚠️ This is EXPECTED behavior - push notifications require a physical device.');
            devWarn('[NotificationService] ⚠️ To test push notifications, build and run on a physical Android device.');
            return null;
          }
          
          // On physical device, this is a configuration issue
          devError('[NotificationService] ❌ Firebase not initialized on physical device. Please configure FCM credentials.');
          devError('[NotificationService] ❌ Check that google-services.json is properly configured.');
          return null;
        }
        throw tokenError; // Re-throw if it's a different error
      }
    } catch (error: any) {
      devError('[NotificationService] Error registering for push notifications:', error);
      devError('[NotificationService] Error details:', error.message, error.stack);
      return null;
    }
  }

  /**
   * Store push token in the database
   */
  private async storePushToken(userId: string, token: string): Promise<void> {
    try {
      devLog('[NotificationService] Storing push token:', { userId, token: token.substring(0, 20) + '...', platform: Platform.OS });
      
      const tokenData = {
        user_id: userId,
        push_token: token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      };

      devLog('[NotificationService] Token data to upsert:', { ...tokenData, push_token: tokenData.push_token.substring(0, 20) + '...' });

      const { data, error } = await supabase
        .from('user_push_tokens')
        .upsert(tokenData, {
          onConflict: 'user_id,platform'
        })
        .select();

      if (error) {
        devError('[NotificationService] Error storing push token:', error);
        devError('[NotificationService] Error details:', JSON.stringify(error, null, 2));
      } else {
        devLog('[NotificationService] Push token stored successfully:', data);
        
        // Verify the token was stored by querying it back
        const { data: verifyData, error: verifyError } = await supabase
          .from('user_push_tokens')
          .select('*')
          .eq('user_id', userId)
          .eq('platform', Platform.OS);
        
        if (verifyError) {
          devError('[NotificationService] Error verifying stored token:', verifyError);
        } else {
          devLog('[NotificationService] Verified stored token:', verifyData);
          if (!verifyData || verifyData.length === 0) {
            devError('[NotificationService] WARNING: Token was not found after storage!');
          }
        }
      }
    } catch (error: any) {
      devError('[NotificationService] Exception storing push token:', error);
      devError('[NotificationService] Exception details:', error.message, error.stack);
    }
  }

  /**
   * Send a local notification (for testing or immediate feedback)
   */
  async sendLocalNotification(title: string, body: string, data?: any): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      devError('Error sending local notification:', error);
    }
  }

  /**
   * Get the current push token
   */
  getExpoPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Clear notification badge
   */
  async clearBadge(): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      devError('Error clearing badge:', error);
    }
  }

  /**
   * Handle notification received while app is in foreground
   */
  addNotificationReceivedListener(listener: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(listener);
  }

  /**
   * Handle notification response when user taps on notification
   */
  addNotificationResponseReceivedListener(listener: (response: Notifications.NotificationResponse) => void) {
    return Notifications.addNotificationResponseReceivedListener(listener);
  }

  /**
   * Remove push token from database (on logout).
   * No-op on web since we don't store Expo tokens for web.
   */
  async removePushToken(userId: string): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      const { error } = await supabase
        .from('user_push_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('platform', Platform.OS);

      if (error) {
        devError('[NotificationService] Error removing push token:', error);
      } else {
        devLog('[NotificationService] Push token removed successfully');
      }
    } catch (error) {
      devError('[NotificationService] Exception removing push token:', error);
    }
  }

  /**
   * Check if push token exists for user and re-register if missing.
   * No-op on web; only native app can register Expo push tokens.
   */
  async ensurePushTokenRegistered(userId: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      devLog('[NotificationService] Skipping push token check on web.');
      return null;
    }
    try {
      devLog('[NotificationService] Ensuring push token is registered for user:', userId);
      
      // Check if token exists in database
      const { data: existingTokens, error: fetchError } = await supabase
        .from('user_push_tokens')
        .select('push_token')
        .eq('user_id', userId)
        .eq('platform', Platform.OS);

      if (fetchError) {
        devError('[NotificationService] Error checking existing token:', fetchError);
        // Try to register anyway
        return await this.registerForPushNotifications(userId);
      }

      if (existingTokens && existingTokens.length > 0 && existingTokens[0].push_token) {
        devLog('[NotificationService] ✅ Push token already exists in database:', existingTokens[0].push_token.substring(0, 20) + '...');
        this.expoPushToken = existingTokens[0].push_token;
        return existingTokens[0].push_token;
      }

      devLog('[NotificationService] ⚠️ No push token found in database for user:', userId, 'platform:', Platform.OS);
      devLog('[NotificationService] Attempting to register new push token...');
      const newToken = await this.registerForPushNotifications(userId);
      if (newToken) {
        devLog('[NotificationService] ✅ Successfully registered new push token');
      } else {
        devError('[NotificationService] ❌ Failed to register push token. User will not receive push notifications.');
      }
      return newToken;
    } catch (error: any) {
      devError('[NotificationService] Error ensuring push token:', error);
      return null;
    }
  }
}

export default NotificationService.getInstance(); 