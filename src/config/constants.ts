// Application-wide constants
export const APP_CONSTANTS = {
  // Color scheme
  COLORS: {
    PRIMARY: '#3B82F6',
    PRIMARY_LIGHT: '#93C5FD', // Light shade of primary for background, selected items, etc.
    SECONDARY: '#60A5FA',
    TERTIARY: '#93C5FD',
    BACKGROUND: 'white',
    BACKGROUND_LIGHT: '#F9FAFB',
    TEXT_PRIMARY: '#111827',
    TEXT_SECONDARY: '#6B7280',
    TEXT_TERTIARY: '#9CA3AF',
    BORDER: '#E5E7EB',
    BORDER_LIGHT: '#F3F4F6', // Lighter border color for subtle separators
    BORDER_DARK: '#D1D5DB', // Darker border color for more emphasis
    ERROR: '#EF4444',
    SUCCESS: '#10B981',
    WARNING: '#F59E0B',
    DISABLED: '#94A3B8',
    WHITE: '#FFFFFF',
  },
  
  // App configuration
  CONFIG: {
    APP_NAME: 'vybr',
    APP_SCHEME: 'com.vybr.app',
    APP_SLOGAN: 'Connect through music',
  },
  
  // Business values
  BUSINESS: {
    COST_PER_TICKET: 0.50,
    COST_PER_DINER: 0.50,
    COST_PER_THOUSAND_IMPRESSIONS: 7.50,
    TICKET_COST_PERCENTAGE: 5, // 5% of ticket sales
    DINER_COST_FIXED: 2, // $2 per diner
    ADVERTISING_COST_PER_IMPRESSION: 0.001, // $0.001 per impression
  },
  
  // API endpoints
  API: {
    SPOTIFY_AUTH_CALLBACK: 'vybr://spotify-auth-callback',
    AUTH_REDIRECT_URL: 'vybr://auth/callback',
  },
}; 