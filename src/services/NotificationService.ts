import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

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
   * Register for push notifications and store the token in the database
   */
  async registerForPushNotifications(userId: string): Promise<string | null> {
    try {
      console.log('[NotificationService] Starting push notification registration for user:', userId);
      console.log('[NotificationService] Platform:', Platform.OS);

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
        console.log('[NotificationService] Android notification channel configured');
      }

      // Check if running on a physical device
      const isPhysicalDevice = Device.isDevice;
      console.log('[NotificationService] Device.isDevice:', isPhysicalDevice);
      console.log('[NotificationService] Device info:', {
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
        console.warn('[NotificationService] Running on emulator/simulator - push notifications may not work, but attempting registration anyway...');
        // Continue with registration - the token might still be useful for testing
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('[NotificationService] Existing permission status:', existingStatus);
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        console.log('[NotificationService] Requesting notification permissions...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log('[NotificationService] Permission request result:', finalStatus);
      }
      
      if (finalStatus !== 'granted') {
        console.error('[NotificationService] Failed to get push token - permissions not granted!');
        return null;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      console.log('[NotificationService] EAS Project ID:', projectId);
      
      if (!projectId) {
        console.error('[NotificationService] EAS Project ID is missing! Push notifications may not work.');
      }

      console.log('[NotificationService] Getting Expo push token...');
      
      // Check if Firebase is properly configured (Android only)
      if (Platform.OS === 'android' && !isPhysicalDevice) {
        // On emulator, Firebase may not be initialized
        // This is expected and we should handle it gracefully
        console.warn('[NotificationService] Running on Android emulator - Firebase may not be initialized.');
        console.warn('[NotificationService] Attempting to get token anyway (may fail, but worth trying)...');
      }
      
      try {
        const token = await Notifications.getExpoPushTokenAsync({
          projectId,
        });

        console.log('[NotificationService] ✅ Expo push token obtained:', token.data);
        this.expoPushToken = token.data;

        // Store the token in the database
        console.log('[NotificationService] Storing push token in database...');
        await this.storePushToken(userId, token.data);

        console.log('[NotificationService] ✅ Push notification registration completed successfully');
        if (!isPhysicalDevice) {
          console.warn('[NotificationService] ⚠️ Note: Token registered but push notifications may not work on emulator.');
        }
        return token.data;
      } catch (tokenError: any) {
        // Check if this is a Firebase initialization error
        if (tokenError.message && tokenError.message.includes('FirebaseApp is not initialized')) {
          console.warn('[NotificationService] Firebase not initialized. This is expected on emulators or if FCM credentials are not configured.');
          console.warn('[NotificationService] To fix: Configure FCM credentials in EAS dashboard or add google-services.json for local builds.');
          
          // On emulator, this is expected - but still log it clearly
          if (!isPhysicalDevice) {
            console.warn('[NotificationService] ⚠️ Cannot get push token on emulator due to Firebase initialization error.');
            console.warn('[NotificationService] ⚠️ This is EXPECTED behavior - push notifications require a physical device.');
            console.warn('[NotificationService] ⚠️ To test push notifications, build and run on a physical Android device.');
            return null;
          }
          
          // On physical device, this is a configuration issue
          console.error('[NotificationService] ❌ Firebase not initialized on physical device. Please configure FCM credentials.');
          console.error('[NotificationService] ❌ Check that google-services.json is properly configured.');
          return null;
        }
        throw tokenError; // Re-throw if it's a different error
      }
    } catch (error: any) {
      console.error('[NotificationService] Error registering for push notifications:', error);
      console.error('[NotificationService] Error details:', error.message, error.stack);
      return null;
    }
  }

  /**
   * Store push token in the database
   */
  private async storePushToken(userId: string, token: string): Promise<void> {
    try {
      console.log('[NotificationService] Storing push token:', { userId, token: token.substring(0, 20) + '...', platform: Platform.OS });
      
      const tokenData = {
        user_id: userId,
        push_token: token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      };

      console.log('[NotificationService] Token data to upsert:', { ...tokenData, push_token: tokenData.push_token.substring(0, 20) + '...' });

      const { data, error } = await supabase
        .from('user_push_tokens')
        .upsert(tokenData, {
          onConflict: 'user_id,platform'
        })
        .select();

      if (error) {
        console.error('[NotificationService] Error storing push token:', error);
        console.error('[NotificationService] Error details:', JSON.stringify(error, null, 2));
      } else {
        console.log('[NotificationService] Push token stored successfully:', data);
        
        // Verify the token was stored by querying it back
        const { data: verifyData, error: verifyError } = await supabase
          .from('user_push_tokens')
          .select('*')
          .eq('user_id', userId)
          .eq('platform', Platform.OS);
        
        if (verifyError) {
          console.error('[NotificationService] Error verifying stored token:', verifyError);
        } else {
          console.log('[NotificationService] Verified stored token:', verifyData);
          if (!verifyData || verifyData.length === 0) {
            console.error('[NotificationService] WARNING: Token was not found after storage!');
          }
        }
      }
    } catch (error: any) {
      console.error('[NotificationService] Exception storing push token:', error);
      console.error('[NotificationService] Exception details:', error.message, error.stack);
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
      console.error('Error sending local notification:', error);
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
      console.error('Error clearing badge:', error);
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
   * Remove push token from database (on logout)
   */
  async removePushToken(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_push_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('platform', Platform.OS);

      if (error) {
        console.error('[NotificationService] Error removing push token:', error);
      } else {
        console.log('[NotificationService] Push token removed successfully');
      }
    } catch (error) {
      console.error('[NotificationService] Exception removing push token:', error);
    }
  }

  /**
   * Check if push token exists for user and re-register if missing
   */
  async ensurePushTokenRegistered(userId: string): Promise<string | null> {
    try {
      console.log('[NotificationService] Ensuring push token is registered for user:', userId);
      
      // Check if token exists in database
      const { data: existingTokens, error: fetchError } = await supabase
        .from('user_push_tokens')
        .select('push_token')
        .eq('user_id', userId)
        .eq('platform', Platform.OS);

      if (fetchError) {
        console.error('[NotificationService] Error checking existing token:', fetchError);
        // Try to register anyway
        return await this.registerForPushNotifications(userId);
      }

      if (existingTokens && existingTokens.length > 0 && existingTokens[0].push_token) {
        console.log('[NotificationService] ✅ Push token already exists in database:', existingTokens[0].push_token.substring(0, 20) + '...');
        this.expoPushToken = existingTokens[0].push_token;
        return existingTokens[0].push_token;
      }

      console.log('[NotificationService] ⚠️ No push token found in database for user:', userId, 'platform:', Platform.OS);
      console.log('[NotificationService] Attempting to register new push token...');
      const newToken = await this.registerForPushNotifications(userId);
      if (newToken) {
        console.log('[NotificationService] ✅ Successfully registered new push token');
      } else {
        console.error('[NotificationService] ❌ Failed to register push token. User will not receive push notifications.');
      }
      return newToken;
    } catch (error: any) {
      console.error('[NotificationService] Error ensuring push token:', error);
      return null;
    }
  }
}

export default NotificationService.getInstance(); 