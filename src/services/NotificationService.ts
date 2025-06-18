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
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      if (!Device.isDevice) {
        console.log('Must use physical device for Push Notifications');
        return null;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      console.log('Expo push token:', token.data);
      this.expoPushToken = token.data;

      // Store the token in the database
      await this.storePushToken(userId, token.data);

      return token.data;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  /**
   * Store push token in the database
   */
  private async storePushToken(userId: string, token: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_push_tokens')
        .upsert({
          user_id: userId,
          push_token: token,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,platform'
        });

      if (error) {
        console.error('Error storing push token:', error);
      } else {
        console.log('Push token stored successfully');
      }
    } catch (error) {
      console.error('Exception storing push token:', error);
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
        console.error('Error removing push token:', error);
      } else {
        console.log('Push token removed successfully');
      }
    } catch (error) {
      console.error('Exception removing push token:', error);
    }
  }
}

export default NotificationService.getInstance(); 