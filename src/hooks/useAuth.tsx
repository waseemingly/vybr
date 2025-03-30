import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase, UserTypes, SignUpCredentials, LoginCredentials, UserSession } from '../lib/supabase';
import { useOrganizerMode } from './useOrganizerMode';
import { APP_CONSTANTS } from '@/config/constants';

// Create auth context
const AuthContext = createContext<{
  session: UserSession | null;
  loading: boolean;
  signUp: (credentials: SignUpCredentials) => Promise<{ error: any } | { user: any }>;
  login: (credentials: LoginCredentials) => Promise<{ error: any } | { user: any }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  createMusicLoverProfile: (profileData: {
    userId: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    age: string;
    profilePicture?: string;
    musicPlatform?: string;
    bio?: {
      firstSong?: string;
      goToSong?: string;
      mustListenAlbum?: string;
      dreamConcert?: string;
      musicTaste?: string;
    };
    isPremium?: boolean;
  }) => Promise<{ error: any } | { success: boolean }>;
  createOrganizerProfile: (profileData: {
    userId: string;
    companyName: string;
    email: string;
    logo?: string;
    phoneNumber?: string;
    businessType?: string;
    bio?: string;
    website?: string;
  }) => Promise<{ error: any } | { success: boolean }>;
}>({
  session: null,
  loading: true,
  signUp: async () => ({ error: null }),
  login: async () => ({ error: null }),
  logout: async () => {},
  checkSession: async () => {},
  createMusicLoverProfile: async () => ({ error: null }),
  createOrganizerProfile: async () => ({ error: null }),
});

// Create provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const { setIsOrganizerMode } = useOrganizerMode();

  // Check for existing session on mount
  useEffect(() => {
    checkSession();
    
    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await checkSession();
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setIsOrganizerMode(false);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Check and set current session
  const checkSession = async () => {
    try {
      setLoading(true);
      
      // Get current auth session
      const { data: { session: authSession } } = await supabase.auth.getSession();
      
      if (!authSession) {
        setSession(null);
        return;
      }

      // First check the user_types table to determine user type
      const { data: userTypeData, error: userTypeError } = await supabase
        .from('user_types')
        .select('type')
        .eq('user_id', authSession.user.id)
        .maybeSingle(); // Use maybeSingle instead of single to handle no rows case

      if (userTypeError) {
        console.error('Error fetching user type:', userTypeError);
        setSession(null);
        return;
      }

      // If no user type found, try to get it from auth metadata
      if (!userTypeData) {
        const userType = authSession.user.user_metadata?.user_type as UserTypes;
        if (!userType) {
          console.error('No user type found in metadata');
          setSession(null);
          return;
        }

        // Try to insert the user type into the database
        const { error: insertError } = await supabase
          .from('user_types')
          .insert({
            user_id: authSession.user.id,
            type: userType
          })
          .select()
          .maybeSingle(); // Use maybeSingle to handle the case where it already exists

        if (insertError) {
          // If it's a duplicate key error, we can ignore it as the user type already exists
          if (insertError.code !== '23505') {
            console.error('Error inserting user type:', insertError);
            setSession(null);
            return;
          }
        }

        // Set session with basic info
        let userSession: UserSession = {
          user: {
            id: authSession.user.id,
            email: authSession.user.email!,
          },
          userType,
        };

        // Update organizer mode if needed
        setIsOrganizerMode(userType === 'organizer');

        setSession(userSession);
        return;
      }

      const userType = userTypeData.type as UserTypes;
      
      // Set session with basic info
      let userSession: UserSession = {
        user: {
          id: authSession.user.id,
          email: authSession.user.email!,
        },
        userType,
      };

      // Update organizer mode if needed
      setIsOrganizerMode(userType === 'organizer');

      // Fetch specific profile based on user type
      if (userType === 'music_lover') {
        const { data: profile, error } = await supabase
          .from('music_lover_profiles')
          .select('*')
          .eq('user_id', authSession.user.id)
          .single();

        if (!error && profile) {
          userSession.musicLoverProfile = {
            id: profile.id,
            firstName: profile.first_name,
            lastName: profile.last_name,
            username: profile.username,
            email: profile.email,
            age: profile.age,
            profilePicture: profile.profile_picture,
            bio: profile.bio,
            country: profile.country,
            city: profile.city,
            isPremium: profile.is_premium,
            musicData: profile.music_data,
          };
        }
      } else if (userType === 'organizer') {
        const { data: profile, error } = await supabase
          .from('organizer_profiles')
          .select('*')
          .eq('user_id', authSession.user.id)
          .single();

        if (!error && profile) {
          userSession.organizerProfile = {
            id: profile.id,
            companyName: profile.company_name,
            email: profile.email,
            phoneNumber: profile.phone_number,
            logo: profile.logo,
            businessType: profile.business_type,
            bio: profile.bio,
            website: profile.website,
          };
        }
      }

      setSession(userSession);
    } catch (error) {
      console.error('Error checking session:', error);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  // Sign up a new user
  const signUp = async (credentials: SignUpCredentials) => {
    try {
      const { email, password, userType } = credentials;
      
      // Create auth user without email verification
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            user_type: userType,  // Store user type in auth metadata
            email_confirmed_at: new Date().toISOString() // Mark email as confirmed
          }
        }
      });

      if (error || !data.user) {
        console.error('Error creating auth user:', error);
        return { error };
      }

      // Check if user type already exists
      const { data: existingUserType, error: checkError } = await supabase
        .from('user_types')
        .select('type')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing user type:', checkError);
        await supabase.auth.signOut();
        return { error: checkError };
      }

      // Only insert if user type doesn't exist
      if (!existingUserType) {
        const { error: userTypeError } = await supabase
          .from('user_types')
          .insert({
            user_id: data.user.id,
            type: userType
          });

        if (userTypeError) {
          console.error('Error inserting user type:', userTypeError);
          await supabase.auth.signOut();
          return { error: userTypeError };
        }
      }

      // Sign in the user immediately
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('Error signing in after signup:', signInError);
        return { error: signInError };
      }

      return { user: signInData.user };
    } catch (error) {
      console.error('Error during sign up:', error);
      return { error };
    }
  };

  // Create music lover profile
  const createMusicLoverProfile = async (profileData: {
    userId: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    age: string;
    profilePicture?: string;
    musicPlatform?: string;
    bio?: {
      firstSong?: string;
      goToSong?: string;
      mustListenAlbum?: string;
      dreamConcert?: string;
      musicTaste?: string;
    };
    isPremium?: boolean;
  }) => {
    try {
      const { error: profileError } = await supabase
        .from('music_lover_profiles')
        .insert({
          user_id: profileData.userId,
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          username: profileData.username,
          email: profileData.email,
          age: parseInt(profileData.age),
          profile_picture: profileData.profilePicture || null,
          music_platform: profileData.musicPlatform || null,
          bio: profileData.bio || null,
          is_premium: profileData.isPremium || false,
          music_data: null
        });

      if (profileError) {
        console.error('Error creating music lover profile:', profileError);
        return { error: profileError };
      }

      return { success: true };
    } catch (error) {
      console.error('Error creating music lover profile:', error);
      return { error };
    }
  };

  // Create organizer profile
  const createOrganizerProfile = async (profileData: {
    userId: string;
    companyName: string;
    email: string;
    logo?: string;
    phoneNumber?: string;
    businessType?: string;
    bio?: string;
    website?: string;
  }) => {
    try {
      const { error: profileError } = await supabase
        .from('organizer_profiles')
        .insert({
          user_id: profileData.userId,
          company_name: profileData.companyName,
          email: profileData.email,
          logo: profileData.logo || null,
          phone_number: profileData.phoneNumber || null,
          business_type: profileData.businessType || null,
          bio: profileData.bio || null,
          website: profileData.website || null
        });

      if (profileError) {
        console.error('Error creating organizer profile:', profileError);
        return { error: profileError };
      }

      return { success: true };
    } catch (error) {
      console.error('Error creating organizer profile:', error);
      return { error };
    }
  };

  // Log in existing user
  const login = async (credentials: LoginCredentials) => {
    try {
      const { email, password, userType } = credentials;
      
      // Sign in with email and password
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      // Verify user type matches requested type
      const { data: userTypeData, error: userTypeError } = await supabase
        .from('user_types')
        .select('type')
        .eq('user_id', data.user.id)
        .single();

      if (userTypeError || userTypeData?.type !== userType) {
        await supabase.auth.signOut();
        return { 
          error: { 
            message: 'Invalid user type. Please use the correct login option.' 
          } 
        };
      }

      // Update organizer mode
      setIsOrganizerMode(userType === 'organizer');
      
      await checkSession();
      return { user: data.user };
    } catch (error) {
      console.error('Error during login:', error);
      return { error };
    }
  };

  // Log out the current user
  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setIsOrganizerMode(false);
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      loading, 
      signUp, 
      login, 
      logout, 
      checkSession,
      createMusicLoverProfile,
      createOrganizerProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for using auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default useAuth; 