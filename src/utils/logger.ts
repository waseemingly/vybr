/**
 * Dev-only logger. In production (e.g. app.vybr.sg) these are no-ops so console stays clean.
 * Use for [DEBUG], [AuthProvider], [NotificationService], [MatchesScreen], etc.
 */
const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

export const devLog = isDev ? (...args: unknown[]) => console.log(...args) : () => {};
export const devWarn = isDev ? (...args: unknown[]) => console.warn(...args) : () => {};
export const devError = isDev ? (...args: unknown[]) => console.error(...args) : () => {};
