/**
 * Dev-only logger. In production (e.g. app.vybr.sg) these are no-ops so console stays clean.
 * Use for [DEBUG], [AuthProvider], [NotificationService], [MatchesScreen], etc.
 */
const isDev =
  (typeof __DEV__ !== 'undefined' && __DEV__) ||
  (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development');

export const devLog = isDev ? (...args: unknown[]) => console.log(...args) : () => {};
export const devWarn = isDev ? (...args: unknown[]) => console.warn(...args) : () => {};
export const devError = isDev ? (...args: unknown[]) => console.error(...args) : () => {};

/**
 * OAuth / Supabase display-name debugging — always logs (not dev-only).
 * Filter device / Metro logs with: `[OAuthProfile]`
 */
export function logOAuthProfile(source: string, payload: Record<string, unknown>): void {
  try {
    console.log('[OAuthProfile]', source, JSON.stringify(payload, null, 2));
  } catch {
    console.log('[OAuthProfile]', source, payload);
  }
}
