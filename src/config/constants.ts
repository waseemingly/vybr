// Application-wide constants

// Define a type for the COLORS object for better type checking
type AppColors = {
  PRIMARY: string;
  PRIMARY_LIGHT: string;
  PRIMARY_DARK: string;
  SECONDARY: string;
  TERTIARY: string;
  BACKGROUND: string;
  BACKGROUND_LIGHT: string;
  TEXT_PRIMARY: string;
  TEXT_SECONDARY: string;
  TEXT_TERTIARY: string;
  BORDER: string;
  BORDER_LIGHT: string;
  BORDER_DARK: string;
  ERROR: string;
  SUCCESS: string;
  SUCCESS_LIGHT: string;
  SUCCESS_DARK: string;
  WARNING: string;
  WARNING_LIGHT: string;
  WARNING_DARK: string;
  DISABLED: string;
  WHITE: string;
  PREMIUM_LIGHT_BG: string;
  PREMIUM_BORDER: string;
  PREMIUM_DARK: string;
};

// Define the overall type for APP_CONSTANTS
interface AppConstantsType {
  COLORS: AppColors;
  CONFIG: {
    APP_NAME: string;
    APP_SCHEME: string;
    APP_SLOGAN: string;
  };
  BUSINESS: {
    COST_PER_TICKET: number;
    COST_PER_DINER: number;
    COST_PER_THOUSAND_IMPRESSIONS: number;
    TICKET_COST_PERCENTAGE: number;
    DINER_COST_FIXED: number;
    ADVERTISING_COST_PER_IMPRESSION: number;
  };
  API: {
    SPOTIFY_AUTH_CALLBACK: string;
    AUTH_REDIRECT_URL: string;
  };
  DEFAULT_PROFILE_PIC: string;
  DEFAULT_EVENT_IMAGE: string;
  DEFAULT_ORGANIZER_LOGO: string;
  NAVBAR_HEIGHT: number;
  API_BASE_URL: string;
}

export const APP_CONSTANTS: AppConstantsType = {
  // Color scheme
  COLORS: {
    PRIMARY: '#3B82F6',
    PRIMARY_LIGHT: '#93C5FD', // Light shade of primary for background, selected items, etc.
    PRIMARY_DARK: '#1D4ED8', // Darker shade of primary for borders, etc.
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
    SUCCESS_LIGHT: '#D1FAE5', // Light green for success backgrounds
    SUCCESS_DARK: '#059669', // Darker green for success text
    WARNING: '#F59E0B',
    WARNING_LIGHT: '#FEF3C7', // Light yellow for warning backgrounds
    WARNING_DARK: '#D97706', // Darker yellow for warning text
    DISABLED: '#94A3B8',
    WHITE: '#FFFFFF',
    PREMIUM_LIGHT_BG: 'rgba(255, 215, 0, 0.15)', // Light gold for premium features background
    PREMIUM_BORDER: 'rgba(255, 215, 0, 0.4)', // Gold border for premium features
    PREMIUM_DARK: '#B8860B', // Dark gold for premium text
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
  
  // Default assets
  DEFAULT_PROFILE_PIC: 'https://via.placeholder.com/150/CCCCCC/808080?text=No+Image',
  DEFAULT_EVENT_IMAGE: 'https://via.placeholder.com/800x450/D1D5DB/1F2937?text=No+Event+Image',
  DEFAULT_ORGANIZER_LOGO: 'https://via.placeholder.com/150/BFDBFE/1E40AF?text=Logo',
  
  // Layout dimensions
  NAVBAR_HEIGHT: 90,
  
  // API base URL
  API_BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api',
}; 