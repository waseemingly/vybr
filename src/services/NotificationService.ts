import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { devLog, devWarn, devError } from '@/utils/logger';

const EXPO_TOKEN_REGEX = /^ExponentPushToken\[.+\]$/;
const MAX_REGISTRATION_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class NotificationService {
  private static instance: NotificationService;
  private expoPushToken: string | null = null;
  private registrationPromise: Promise<string | null> | null = null;

  private constructor() {}

  private getDeviceContext(): string {
    try {
      const parts = [
        `platform=${Platform.OS}`,
        `isDevice=${Device.isDevice}`,
        `osName=${Device.osName ?? 'unknown'}`,
        `osVersion=${Device.osVersion ?? 'unknown'}`,
        `brand=${Device.brand ?? 'unknown'}`,
        `modelName=${Device.modelName ?? 'unknown'}`,
      ];
      return parts.join(' ');
    } catch {
      return `platform=${Platform.OS}`;
    }
  }

  private async logPushFailure(userId: string, errorMessage: string): Promise<void> {
    try {
      const ctx = this.getDeviceContext();
      const fullMessage = `${errorMessage} | ${ctx}`.slice(0, 2000);
      const { error } = await supabase.from('push_registration_log').insert({
        user_id: userId,
        platform: Platform.OS,
        error_message: fullMessage,
      });
      if (error) {
        console.warn('[Vybr] push_registration_log insert failed:', error.message);
      }
    } catch (e: any) {
      console.warn('[Vybr] push_registration_log insert error:', e?.message || e);
    }
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Concurrent callers share the in-flight registration via a promise-based lock.
   */
  async registerForPushNotifications(userId: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      devLog('[NotificationService] Skipping push registration on web.');
      return null;
    }
    if (!Device.isDevice) {
      devWarn('[NotificationService] Push notifications require a physical device. Skipping on simulator/emulator.');
      return null;
    }
    if (this.registrationPromise) {
      devLog('[NotificationService] Registration already in-flight, waiting...');
      return this.registrationPromise;
    }
    this.registrationPromise = this._doRegister(userId);
    try {
      return await this.registrationPromise;
    } finally {
      this.registrationPromise = null;
    }
  }

  private async _doRegister(userId: string): Promise<string | null> {
    try {
      devLog('[NotificationService] Starting push registration for user:', userId);

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus === 'denied') {
        await this.logPushFailure(userId, '[Permissions] status=denied — user must enable in Settings.');
        Alert.alert(
          'Enable Notifications',
          'Push notifications are disabled. Please enable them in Settings to receive messages.',
          [
            { text: 'Not Now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return null;
      }

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        await this.logPushFailure(userId, `[Permissions] finalStatus=${finalStatus}`);
        return null;
      }

      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        (Constants as any).easConfig?.projectId;

      if (!projectId) {
        await this.logPushFailure(userId, '[EAS] projectId missing across all sources.');
        return null;
      }

      const token = await this._getTokenWithRetry(projectId, userId);
      if (!token) return null;

      if (!EXPO_TOKEN_REGEX.test(token)) {
        await this.logPushFailure(userId, `[Validation] Token format invalid: ${token.slice(0, 30)}`);
        return null;
      }

      this.expoPushToken = token;
      await this.storePushToken(userId, token);
      devLog('[NotificationService] Push registration completed successfully');
      return token;
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      await this.logPushFailure(userId, `[_doRegister] ${msg}`);
      return null;
    }
  }

  /**
   * Retry getExpoPushTokenAsync with exponential backoff (1s, 2s, 4s).
   */
  private async _getTokenWithRetry(projectId: string, userId: string): Promise<string | null> {
    let lastError: any;
    for (let attempt = 0; attempt < MAX_REGISTRATION_RETRIES; attempt++) {
      try {
        devLog(`[NotificationService] getExpoPushTokenAsync attempt ${attempt + 1}/${MAX_REGISTRATION_RETRIES}`);
        const { data: tokenData } = await Notifications.getExpoPushTokenAsync({ projectId });
        return tokenData;
      } catch (error: any) {
        lastError = error;
        const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        devWarn(`[NotificationService] Token fetch failed (attempt ${attempt + 1}), retrying in ${delayMs}ms:`, error?.message);
        if (attempt < MAX_REGISTRATION_RETRIES - 1) {
          await sleep(delayMs);
        }
      }
    }
    const msg = lastError?.message ?? String(lastError);
    await this.logPushFailure(userId, `[getExpoPushTokenAsync] All ${MAX_REGISTRATION_RETRIES} attempts failed: ${msg}`);
    return null;
  }

  private async storePushToken(userId: string, token: string): Promise<void> {
    try {
      const tokenData = {
        user_id: userId,
        push_token: token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_push_tokens')
        .upsert(tokenData, { onConflict: 'user_id,platform' })
        .select();

      if (error) {
        devError('[NotificationService] Error storing push token:', error);
        const detail = [
          '[storePushToken] Supabase error',
          `message=${error.message ?? ''}`,
          error.code ? `code=${error.code}` : '',
          error.hint ? `hint=${error.hint}` : '',
        ].filter(Boolean).join(' ');
        await this.logPushFailure(userId, detail);
      } else {
        devLog('[NotificationService] Push token stored successfully');
      }
    } catch (error: any) {
      devError('[NotificationService] Exception storing push token:', error);
      const detail = [
        '[storePushToken] exception',
        `message=${error?.message ?? String(error)}`,
      ].filter(Boolean).join(' ');
      await this.logPushFailure(userId, detail);
    }
  }

  async sendLocalNotification(title: string, body: string, data?: any): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data },
        trigger: { type: 'timeInterval', seconds: 1 } as any,
      });
    } catch (error) {
      devError('Error sending local notification:', error);
    }
  }

  getExpoPushToken(): string | null {
    return this.expoPushToken;
  }

  async clearBadge(): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      devError('Error clearing badge:', error);
    }
  }

  addNotificationReceivedListener(listener: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(listener);
  }

  addNotificationResponseReceivedListener(listener: (response: Notifications.NotificationResponse) => void) {
    return Notifications.addNotificationResponseReceivedListener(listener);
  }

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
        this.expoPushToken = null;
      }
    } catch (error) {
      devError('[NotificationService] Exception removing push token:', error);
    }
  }

  async ensurePushTokenRegistered(userId: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      devLog('[NotificationService] Skipping push token check on web.');
      return null;
    }
    if (!Device.isDevice) {
      devWarn('[NotificationService] Not a physical device, skipping push token check.');
      return null;
    }
    try {
      devLog('[NotificationService] Ensuring push token registered for user:', userId);

      const { data: existingTokens, error: fetchError } = await supabase
        .from('user_push_tokens')
        .select('push_token')
        .eq('user_id', userId)
        .eq('platform', Platform.OS);

      if (fetchError) {
        devError('[NotificationService] Error checking existing token:', fetchError);
        await this.logPushFailure(userId, `[ensurePushTokenRegistered] fetch failed: ${fetchError.message}`);
        return await this.registerForPushNotifications(userId);
      }

      if (existingTokens && existingTokens.length > 0 && existingTokens[0].push_token) {
        const stored = existingTokens[0].push_token;
        if (EXPO_TOKEN_REGEX.test(stored)) {
          devLog('[NotificationService] Push token already exists in DB');
          this.expoPushToken = stored;
          return stored;
        }
        devWarn('[NotificationService] Stored token has invalid format, re-registering');
      }

      devLog('[NotificationService] No valid push token found, registering...');
      return await this.registerForPushNotifications(userId);
    } catch (error: any) {
      devError('[NotificationService] Error ensuring push token:', error);
      await this.logPushFailure(userId, `[ensurePushTokenRegistered] exception: ${error?.message ?? String(error)}`);
      return null;
    }
  }
}

export default NotificationService.getInstance();
