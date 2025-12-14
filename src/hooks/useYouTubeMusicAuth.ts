/**
 * Placeholder YouTube Music auth hook.
 *
 * The app currently supports YouTube Music via external/manual syncing.
 * This hook exists to keep screens stable and provide a future integration point.
 */
export function useYouTubeMusicAuth() {
  return {
    isLoggedIn: false,
    login: async () => {
      throw new Error('YouTube Music linking is not available yet.');
    },
    logout: async () => {
      // no-op
    },
  };
}


