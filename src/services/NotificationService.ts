import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { devLog, devWarn, devError } from '@/utils/logger';

let PushDiagnostics: any = null;
try {
  // Local Expo module (iOS-only) that reads runtime entitlements and OS notification state.
  // On Android/web it won't be present/used.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  PushDiagnostics = require('vybr-push-diagnostics');
} catch (e: any) {
  PushDiagnostics = null;
  // Force visibility even when devLog is disabled in release builds.
  console.warn(
    '[PushDiagnostics] Native module not available (will skip NativeDiag entitlements/OS notification state).',
    'error=',
    e?.message ?? String(e)
  );
}

const EXPO_TOKEN_REGEX = /^ExponentPushToken\[.+\]$/;
// For iOS, APNs registration can legitimately take minutes (Apple TN2265).
// Use fewer retries so we don't burn a long time during diagnostics.
const MAX_REGISTRATION_RETRIES = 2;
const BASE_RETRY_DELAY_MS = 1000;
// iOS APNs registration can legitimately take a long time (Apple TN2265).
// Keep diagnostics bounded, but don't time out so aggressively that we
// misclassify a slow APNs connection as a hard failure.
const DEFAULT_APNS_DIAG_TIMEOUT_MS = 180000;
const DEFAULT_EXPO_TOKEN_TIMEOUT_MS = 180000;
const DEFAULT_DIRECT_EXPO_TOKEN_FETCH_TIMEOUT_MS = 20000;
// Debug-only toggle: bypass timeout wrappers to check whether calls eventually resolve.
// JS-only change (no rebuild required). Keep false for normal behavior.
const PUSH_DEBUG_DISABLE_TIMEOUTS = false;
const EXPO_GET_PUSH_TOKEN_URL = 'https://exp.host/--/api/v2/push/getExpoPushToken';

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

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage: string,
  onTimeout?: () => void | Promise<void>
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const t = setTimeout(() => {
      settled = true;
      try {
        const maybePromise = onTimeout?.();
        if (maybePromise && typeof (maybePromise as any).catch === 'function') {
          (maybePromise as Promise<void>).catch((e: any) => {
            console.warn('[withTimeout] onTimeout callback errored:', e?.message ?? String(e));
          });
        }
      } catch (e: any) {
        console.warn('[withTimeout] onTimeout callback threw:', e?.message ?? String(e));
      }
      reject(new Error(timeoutMessage));
    }, ms);

    promise.then(
      (v) => {
        if (settled) {
          console.warn('[withTimeout] Promise resolved after timeout:', timeoutMessage);
          return;
        }
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        if (settled) {
          console.warn('[withTimeout] Promise rejected after timeout:', timeoutMessage, 'error=', e?.message ?? String(e));
          return;
        }
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export class NotificationService {
  private static instance: NotificationService;
  private expoPushToken: string | null = null;
  private registrationPromise: Promise<string | null> | null = null;
  private lastRegistrationFailureAtMs: number | null = null;
  private readonly registrationFailureCooldownMs = 5 * 60 * 1000;

  private constructor() {}

  private async snapshotNotificationPermissions(userId: string, context: string, projectId?: string): Promise<void> {
    if (Platform.OS !== 'ios') return;
    try {
      const { status, granted } = await Notifications.getPermissionsAsync();
      const proj = projectId ? ` projectId=${projectId}` : '';
      console.warn(`[Snapshot][${context}] permissionsStatus=${status} granted=${granted ?? 'unknown'}${proj}`);
      // Best-effort: do not block token registration flow.
      void this.logPushFailure(
        userId,
        `[Snapshot][${context}] permissionsStatus=${status} granted=${granted ?? 'unknown'}${proj}`
      );
    } catch (e: any) {
      console.warn(`[Snapshot][${context}] failed:`, e?.message ?? String(e));
      void this.logPushFailure(
        userId,
        `[Snapshot][${context}] failed: ${e?.message ?? String(e)}`
      );
    }
  }

  private shouldRunApnsDiagnostics(): boolean {
    // Always run lightweight APNs diagnostics on iOS (8s timeout) so we can
    // distinguish "APNs token never arrives" from "Expo token service issue".
    return Platform.OS === 'ios';
  }

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

  private async probeExpoPushReachability(userId: string): Promise<void> {
    const targets = [
      'https://exp.host',
      'https://api.expo.dev',
    ];

    for (const url of targets) {
      const startedAt = Date.now();
      try {
        const res = await withTimeout(
          fetch(url, { method: 'GET' }),
          15000,
          `[NetProbe] ${url} timed out after 15000ms`
        );
        const elapsed = Date.now() - startedAt;
        const line = `[NetProbe] ${url} ok status=${res.status} elapsedMs=${elapsed}`;
        console.log(line);
        await this.logPushFailure(userId, line);
      } catch (e: any) {
        const elapsed = Date.now() - startedAt;
        const line = `[NetProbe] ${url} failed elapsedMs=${elapsed} error=${e?.message ?? String(e)}`;
        console.warn(line);
        await this.logPushFailure(userId, line);
      }
    }

    // Probe the exact Expo push-token endpoint path used by SDK internals.
    const startedAt = Date.now();
    try {
      const res = await withTimeout(
        fetch(EXPO_GET_PUSH_TOKEN_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'apns', deviceId: 'vybr-probe' }),
        }),
        15000,
        `[NetProbe] ${EXPO_GET_PUSH_TOKEN_URL} timed out after 15000ms`
      );
      const elapsed = Date.now() - startedAt;
      const line = `[NetProbe] ${EXPO_GET_PUSH_TOKEN_URL} ok status=${res.status} elapsedMs=${elapsed}`;
      console.log(line);
      await this.logPushFailure(userId, line);
    } catch (e: any) {
      const elapsed = Date.now() - startedAt;
      const line = `[NetProbe] ${EXPO_GET_PUSH_TOKEN_URL} failed elapsedMs=${elapsed} error=${e?.message ?? String(e)}`;
      console.warn(line);
      await this.logPushFailure(userId, line);
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
    if (this.lastRegistrationFailureAtMs) {
      const elapsed = Date.now() - this.lastRegistrationFailureAtMs;
      if (elapsed < this.registrationFailureCooldownMs) {
        const remainingMs = this.registrationFailureCooldownMs - elapsed;
        const remainingSec = Math.ceil(remainingMs / 1000);
        const line = `[PushRegistration] Cooldown active after failure; skipping for ${remainingSec}s`;
        console.warn(line);
        void this.logPushFailure(userId, line);
        return null;
      }
    }
    if (this.registrationPromise) {
      devLog('[NotificationService] Registration already in-flight, waiting...');
      return this.registrationPromise;
    }
    this.registrationPromise = this._doRegister(userId);
    try {
      const token = await this.registrationPromise;
      if (token) {
        this.lastRegistrationFailureAtMs = null;
      } else {
        this.lastRegistrationFailureAtMs = Date.now();
      }
      return token;
    } finally {
      this.registrationPromise = null;
    }
  }

  private async _doRegister(userId: string): Promise<string | null> {
    try {
      // Remote breadcrumb so we can debug TestFlight / production without JS logs.
      await this.logPushFailure(userId, '[_doRegister] entered');
      console.log('[PushRegistration] Starting for user:', userId);

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('[PushRegistration] getPermissionsAsync status=', existingStatus);
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
        console.log('[PushRegistration] requestPermissionsAsync status=', status);
      }

      if (finalStatus !== 'granted') {
        await this.logPushFailure(userId, `[Permissions] finalStatus=${finalStatus}`);
        console.warn('[PushRegistration] Permissions not granted. finalStatus=', finalStatus);
        return null;
      }

      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        (Constants as any).easConfig?.projectId;

      if (!projectId) {
        await this.logPushFailure(userId, '[EAS] projectId missing across all sources.');
        console.error('[PushRegistration] Missing EAS projectId; cannot call getExpoPushTokenAsync().');
        return null;
      }
      console.log('[PushRegistration] Using EAS projectId=', projectId);

      if (Platform.OS === 'ios') {
        // Verify the actual iOS entitlement value the runtime thinks it has.
        const apsEnv =
          (Constants as any)?.expoConfig?.ios?.entitlements?.['aps-environment'] ??
          (Constants as any)?.expoConfig?.ios?.entitlements?.['apsEnvironment'];
        console.log('[PushRegistration][iOS] aps-environment entitlement=', apsEnv ?? 'unknown');
        await this.logPushFailure(userId, `[Diag][iOS] aps-environment entitlement=${apsEnv ?? 'unknown'}`);
      }

      // Record what the running binary thinks it is (helps catch project/bundle mismatches).
      try {
        const iosBundleId = (Constants as any)?.expoConfig?.ios?.bundleIdentifier ?? 'unknown';
        const nativeApplicationId = Application.applicationId ?? 'unknown';
        const nativeBuildVersion = Application.nativeBuildVersion ?? 'unknown';
        const nativeApplicationVersion = Application.nativeApplicationVersion ?? 'unknown';
        const appOwnership = (Constants as any)?.appOwnership ?? 'unknown';
        const executionEnv = (Constants as any)?.executionEnvironment ?? 'unknown';
        await this.logPushFailure(
          userId,
          `[Diag] projectId=${projectId} iosBundleId=${iosBundleId} nativeApplicationId=${nativeApplicationId} nativeBuildVersion=${nativeBuildVersion} nativeApplicationVersion=${nativeApplicationVersion} appOwnership=${appOwnership} executionEnv=${executionEnv}`
        );
      } catch {
        // ignore
      }

      // Hard verification: read runtime entitlements + OS notification state (iOS only).
      if (Platform.OS === 'ios' && PushDiagnostics) {
        console.log('[NativeDiag] Native module present. Fetching aps-environment + notification state...');
        try {
          const apsEnv = await Promise.resolve(PushDiagnostics.getApsEnvironment?.());
          console.log('[NativeDiag] aps-environment=', apsEnv ?? 'missing');
          await this.logPushFailure(userId, `[NativeDiag] aps-environment=${apsEnv ?? 'missing'}`);
        } catch (e: any) {
          console.warn('[NativeDiag] aps-environment read failed:', e?.message ?? String(e));
          await this.logPushFailure(userId, `[NativeDiag] aps-environment read failed: ${e?.message ?? String(e)}`);
        }

        try {
          const state = await Promise.resolve(PushDiagnostics.getNotificationState?.());
          if (state && typeof state === 'object') {
            const auth = state.authorizationStatus ?? 'unknown';
            const registered = state.isRegisteredForRemoteNotifications ?? 'unknown';
            console.log(
              '[NativeDiag] isRegisteredForRemoteNotifications=',
              registered,
              'authorizationStatus=',
              auth
            );
            await this.logPushFailure(userId, `[NativeDiag] isRegisteredForRemoteNotifications=${registered} authorizationStatus=${auth}`);
          } else {
            console.warn('[NativeDiag] getNotificationState returned non-object:', state);
            await this.logPushFailure(userId, `[NativeDiag] getNotificationState returned non-object`);
          }
        } catch (e: any) {
          console.warn('[NativeDiag] getNotificationState failed:', e?.message ?? String(e));
          await this.logPushFailure(userId, `[NativeDiag] getNotificationState failed: ${e?.message ?? String(e)}`);
        }
      }
      if (Platform.OS === 'ios') {
        console.log('[NativeDiag] Native module loaded?', !!PushDiagnostics);
      }

      await this.logPushFailure(userId, '[_doRegister] permissions granted and projectId resolved, fetching token...');
      console.log('[PushRegistration] Permissions OK; fetching tokens now...');
      await this.probeExpoPushReachability(userId);
      const token = await this._getTokenWithRetry(projectId, userId);
      if (!token) return null;

      if (!EXPO_TOKEN_REGEX.test(token)) {
        await this.logPushFailure(userId, `[Validation] Token format invalid: ${token.slice(0, 30)}`);
        return null;
      }

      this.expoPushToken = token;
      await this.storePushToken(userId, token);
      console.log('[PushRegistration] Completed successfully. Expo token prefix=', token.slice(0, 28));
      return token;
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      await this.logPushFailure(userId, `[_doRegister] ${msg}`);
      return null;
    }
  }

  /**
   * iOS: Prefer a direct exp.host call using APNs device token.
   * Android/other: fallback to Notifications.getExpoPushTokenAsync.
   */
  private async _getTokenWithRetry(projectId: string, userId: string): Promise<string | null> {
    let lastError: any;
    const effectiveMaxRetries = Platform.OS === 'ios' ? 1 : MAX_REGISTRATION_RETRIES;
    for (let attempt = 0; attempt < effectiveMaxRetries; attempt++) {
      try {
        console.log(`[PushRegistration] getExpoPushToken attempt ${attempt + 1}/${effectiveMaxRetries}`);

        // This is the key mismatch signal you wanted to verify.
        const nativeAppId = Application.applicationId;
        const expoSlug = (Constants as any)?.expoConfig?.slug;
        const ownerFromConstants = (Constants as any)?.expoConfig?.owner;
        // TEMP DEBUG FALLBACK:
        // Your `app.config.js` currently does not set `expo.owner`, so Constants.expoConfig.owner is undefined at runtime.
        // For diagnosis only, fall back to the known Expo owner so we can form experienceId and get Expo's real error.
        const owner = ownerFromConstants ?? 'pradeep1234';
        console.log(
          '[PushDebug] applicationId=',
          nativeAppId,
          'slug=',
          expoSlug,
          'owner=',
          owner,
          'projectId=',
          projectId
        );

        // Expo's getExpoPushToken expects `development` to match the APNs environment.
        // For iOS we should derive it from the runtime entitlements we just set via `IOS_APS_ENV`.
        // Fallback to the old attempt-based behavior if we can't determine it.
        const apsEnvRaw =
          (Constants as any)?.expoConfig?.ios?.entitlements?.['aps-environment'] ??
          (Constants as any)?.expoConfig?.ios?.entitlements?.['apsEnvironment'];
        const apsEnv = typeof apsEnvRaw === 'string' ? apsEnvRaw.toLowerCase() : '';
        const development =
          apsEnv
            ? !apsEnv.includes('prod')
            : attempt % 2 === 0; // fallback: preserve previous behavior when env is unknown

        // iOS: bypass SDK hanging logic by calling exp.host directly with the APNs device token.
        if (Platform.OS === 'ios') {
          const experienceId = owner && expoSlug ? `@${owner}/${expoSlug}` : undefined;

          await this.logPushFailure(
            userId,
            `[DirectExpo] start: experienceId=${experienceId ?? 'missing'} appId=${nativeAppId} projectId=${projectId} development=${development}`
          );

          await this.logPushFailure(userId, `[APNs] getDevicePushTokenAsync start (attempt ${attempt + 1})`);
          const deviceToken = PUSH_DEBUG_DISABLE_TIMEOUTS
            ? await Notifications.getDevicePushTokenAsync()
            : await withTimeout(
                Notifications.getDevicePushTokenAsync(),
                DEFAULT_APNS_DIAG_TIMEOUT_MS,
                `getDevicePushTokenAsync timed out after ${DEFAULT_APNS_DIAG_TIMEOUT_MS}ms`
              );

          const deviceId = typeof deviceToken === 'string' ? deviceToken : deviceToken?.data ? deviceToken.data : undefined;

          console.log('[PushDebug] APNs device token len=', deviceId?.length ?? 'unknown');
          if (!deviceId) {
            throw new Error(`[DirectExpo] Missing APNs deviceId from getDevicePushTokenAsync result`);
          }

          // Expo token endpoint is expected to respond quickly (400 on mismatch, 200 with token).
          const requestBody = {
            deviceId,
            ...(experienceId ? { experienceId } : {}),
            appId: nativeAppId,
            applicationId: nativeAppId,
            type: 'apns',
            development,
            projectId,
          };

          const directRes = PUSH_DEBUG_DISABLE_TIMEOUTS
            ? await fetch(EXPO_GET_PUSH_TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
              })
            : await withTimeout(
                fetch(EXPO_GET_PUSH_TOKEN_URL, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(requestBody),
                }),
                DEFAULT_DIRECT_EXPO_TOKEN_FETCH_TIMEOUT_MS,
                `[DirectExpo] fetch timed out after ${DEFAULT_DIRECT_EXPO_TOKEN_FETCH_TIMEOUT_MS}ms`
              );

          const directJson = await directRes
            .json()
            .catch((e: any) => ({ _jsonParseError: e?.message ?? String(e) }));

          const directJsonStr = JSON.stringify(directJson).slice(0, 1200);
          await this.logPushFailure(
            userId,
            `[DirectExpo] response status=${directRes.status} body=${directJsonStr}`
          );
          console.log(
            '[PushDebug] Direct token response status=',
            directRes.status,
            'json=',
            directJsonStr
          );

          const tokenCandidate =
            typeof directJson?.data === 'string'
              ? directJson.data
              : typeof directJson?.data?.token === 'string'
                ? directJson.data.token
                : typeof directJson?.token === 'string'
                  ? directJson.token
                  : null;

          if (directRes.ok && tokenCandidate && EXPO_TOKEN_REGEX.test(tokenCandidate)) {
            await this.logPushFailure(userId, `[DirectExpo] ok. token prefix=${tokenCandidate.slice(0, 28)}`);
            console.log('[PushRegistration] Direct token ok. token prefix=', tokenCandidate.slice(0, 28));
            return tokenCandidate;
          }

          throw new Error(
            `[DirectExpo] failed: status=${directRes.status} tokenCandidate=${tokenCandidate ? tokenCandidate.slice(0, 28) : 'null'}`
          );
        }

        // Non-iOS: fallback to SDK.
        await this.logPushFailure(userId, `[Expo] getExpoPushTokenAsync start (attempt ${attempt + 1})`);
        console.log(
          `[PushRegistration] Calling getExpoPushTokenAsync with projectId=${projectId} (timeout ${DEFAULT_EXPO_TOKEN_TIMEOUT_MS}ms)`
        );

        if (PUSH_DEBUG_DISABLE_TIMEOUTS) {
          console.warn('[PushRegistration][Debug] Expo timeout wrapper disabled for this run');
        }

        const expoTokenResponse = PUSH_DEBUG_DISABLE_TIMEOUTS
          ? await Notifications.getExpoPushTokenAsync({ projectId })
          : await withTimeout(
              Notifications.getExpoPushTokenAsync({ projectId }),
              DEFAULT_EXPO_TOKEN_TIMEOUT_MS,
              `getExpoPushTokenAsync timed out after ${DEFAULT_EXPO_TOKEN_TIMEOUT_MS}ms`
            );
        const { data: tokenData } = expoTokenResponse;

        await this.logPushFailure(userId, `[Expo] getExpoPushTokenAsync ok (attempt ${attempt + 1})`);
        console.log(
          '[PushRegistration] getExpoPushTokenAsync ok. token prefix=',
          (typeof tokenData === 'string' ? tokenData.slice(0, 28) : String(tokenData).slice(0, 28)),
          'len=',
          typeof tokenData === 'string' ? tokenData.length : 'unknown'
        );

        return tokenData;
      } catch (error: any) {
        lastError = error;
        await this.snapshotNotificationPermissions(userId, `Expo push token failure (attempt ${attempt + 1})`, projectId);
        await this.logPushFailure(userId, `[Expo] getExpoPushToken attempt failed (attempt ${attempt + 1}): ${error?.message ?? String(error)}`);
        const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[PushRegistration] getExpoPushToken attempt failed (attempt ${attempt + 1}); retrying in ${delayMs}ms:`,
          error?.message ?? String(error),
          error?.stack ? '\nstack=' + error.stack : ''
        );
        if (attempt < effectiveMaxRetries - 1) {
          await sleep(delayMs);
        }
      }
    }
    const msg = lastError?.message ?? String(lastError);
    await this.logPushFailure(userId, `[getExpoPushTokenAsync] All ${effectiveMaxRetries} attempts failed: ${msg}`);
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
