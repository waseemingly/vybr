import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { safeLocalStorage } from '@/utils/safeStorage';

// Access environment variables
const supabaseUrl = process.env.SUPABASE_URL || Constants.expoConfig?.extra?.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || Constants.expoConfig?.extra?.SUPABASE_KEY;

// If environment variables are not available, fail gracefully with error message
if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL and/or key is missing. Please check your environment variables.');
}

// Custom storage implementation for better mobile session persistence
const customStorage = {
  getItem: async (key: string) => {
    try {
      if (Platform.OS === 'web') {
        return safeLocalStorage.getItem(key);
      } else {
        return await AsyncStorage.getItem(key);
      }
    } catch (error) {
      console.error('Error getting item from storage:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      if (Platform.OS === 'web') {
        safeLocalStorage.setItem(key, value);
      } else {
        await AsyncStorage.setItem(key, value);
      }
    } catch (error) {
      console.error('Error setting item in storage:', error);
    }
  },
  removeItem: async (key: string) => {
    try {
      if (Platform.OS === 'web') {
        safeLocalStorage.removeItem(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error('Error removing item from storage:', error);
    }
  },
};

export const supabase = createClient(
  supabaseUrl as string, 
  supabaseKey as string, 
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      storage: customStorage,
      detectSessionInUrl: Platform.OS === 'web', // Only detect session in URL on web
    },
    global: {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        'apikey': supabaseKey as string,
      },
    },
  }
);

console.log({ supabaseUrl, supabaseKey });

export type UserTypes = 'music_lover' | 'organizer';

export interface SignUpCredentials {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  userType: UserTypes;
  companyName?: string;
  senderEmail?: string;
}

export interface LoginCredentials {
  email?: string;
  username?: string;
  password: string;
  userType: UserTypes;
}

export interface SpotifyData {
  genres: string[];
  artists: string[];
  songs: { title: string; artist: string }[];
  albums: { title: string; artist: string; year: number }[];
  analytics?: {
    genreDistribution?: { name: string; value: number }[];
  };
}

export interface MusicLoverBio {
  firstSong?: string;
  goToSong?: string;
  mustListenAlbum?: string;
  dreamConcert?: string;
  musicTaste?: string;
}

export interface MusicLoverProfile {
  id: string;
  userId?: string; // Keep this optional if it's not always present
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  age?: number; // Keep as number if DB expects integer
  profilePicture?: string; // This will store the URL
  bio?: MusicLoverBio; // Use the specific interface or object
  country?: string;
  city?: string;
  isPremium?: boolean;
  /**
   * UI-level flag for onboarding/tour completion.
   * In Supabase this is stored as `has_completed_tour` (snake_case) and typically mapped
   * to this camelCase field when constructing app state.
   */
  hasCompletedTour?: boolean;
  musicData?: SpotifyData; // Keep if still relevant
  favorite_artists?: string | null;
  favorite_songs?: string | null;
  favorite_albums?: string | null;
}

export interface OrganizerProfile {
  id: string;
  userId?: string;
  companyName: string;
  email: string;
  phoneNumber?: string;
  logo?: string;
  businessType?: 'venue' | 'promoter' | 'artist_management' | 'festival_organizer' | 'other';
  bio?: string;
  website?: string;
  stripe_customer_id?: string | null; // Allow null
  stripe_connect_account_id?: string | null; // Add this for payouts
  /**
   * UI-level flag for onboarding/tour completion.
   * In Supabase this is stored as `has_completed_tour` (snake_case) and typically mapped
   * to this camelCase field when constructing app state.
   */
  hasCompletedTour?: boolean;
}

export interface UserSession {
  user: {
    id: string;
    email: string;
  } | null;
  userType: UserTypes | null;
  musicLoverProfile?: MusicLoverProfile | null;
  organizerProfile?: OrganizerProfile | null;
}

// Custom sender email configuration 
// This should match what is configured in Supabase
export const EMAIL_CONFIG = {
  SENDER_NAME: 'Vybr Connect',
  SENDER_EMAIL: 'vybr.connect@gmail.com',
  REPLY_TO: 'support@vybr.com',
  EMAIL_SUBJECTS: {
    VERIFICATION: 'Confirm your email address for vybr',
    PASSWORD_RESET: 'Reset your password for vybr',
    WELCOME: 'Welcome to vybr!',
  },
};

// Function to format email details (for display purposes only)
export const formatEmailDetails = (type: 'verification' | 'password_reset' | 'welcome') => {
  let subject = '';
  
  switch (type) {
    case 'verification':
      subject = EMAIL_CONFIG.EMAIL_SUBJECTS.VERIFICATION;
      break;
    case 'password_reset':
      subject = EMAIL_CONFIG.EMAIL_SUBJECTS.PASSWORD_RESET;
      break;
    case 'welcome':
      subject = EMAIL_CONFIG.EMAIL_SUBJECTS.WELCOME;
      break;
  }
  
  
  return {
    from: `${EMAIL_CONFIG.SENDER_NAME} <${EMAIL_CONFIG.SENDER_EMAIL}>`,
    subject,
    replyTo: EMAIL_CONFIG.REPLY_TO,
  };
}; 