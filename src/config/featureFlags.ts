// Feature flags for soft launch. Set to true when ready to enable payments & organizers.
// Revert by changing PAYMENTS_AND_ORGANIZERS_ENABLED to true.

export const FEATURE_FLAGS = {
  /** When false: organizer login/signup, premium signup, event creation, and payments show "Coming soon" overlay. */
  PAYMENTS_AND_ORGANIZERS_ENABLED: false,
} as const;
