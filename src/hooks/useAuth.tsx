import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase, UserTypes, SignUpCredentials, LoginCredentials, UserSession } from '@/lib/supabase';
import { useOrganizerMode } from './useOrganizerMode';
import { APP_CONSTANTS } from '@/config/constants';

// Create auth context
const AuthContext = createContext<{
  session: UserSession | null;
  loading: boolean;
  signUp: (credentials: SignUpCredentials) => Promise<{ error: any } | { user: any, verificationSent: boolean }>;
  login: (credentials: LoginCredentials) => Promise<{ error: any } | { user: any }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  checkEmailVerification: (userId: string) => Promise<boolean>;
  resendVerificationEmail: (email: string) => Promise<{ error: any } | { success: boolean }>;
}>({
  session: null,
  loading: true,
  signUp: async () => ({ error: null }),
  login: async () => ({ error: null }),
  logout: async () => {},
  checkSession: async () => {},
  checkEmailVerification: async () => false,
  resendVerificationEmail: async () => ({ error: null }),
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
        .single();

      if (userTypeError || !userTypeData) {
        console.error('Error fetching user type:', userTypeError);
        setSession(null);
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
      const { email, password, userType, senderEmail } = credentials;
      
      // Create auth user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: APP_CONSTANTS.API.AUTH_REDIRECT_URL,
          data: {
            user_type: userType  // Store user type in auth metadata
          }
        }
      });

      if (error || !data.user) {
        return { error };
      }

      // Add user type to user_types table
      await supabase.from('user_types').insert({
        user_id: data.user.id,
        type: userType
      });

      // Create profile based on user type
      if (userType === 'music_lover') {
        const { firstName, lastName, username } = credentials;
        await supabase.from('music_lover_profiles').insert({
          user_id: data.user.id,
          first_name: firstName,
          last_name: lastName,
          username,
          email,
        });
      } else if (userType === 'organizer') {
        const { companyName } = credentials;
        await supabase.from('organizer_profiles').insert({
          user_id: data.user.id,
          company_name: companyName,
          email,
        });
      }

      return { 
        user: data.user,
        verificationSent: true
      };
    } catch (error) {
      console.error('Error during sign up:', error);
      return { error };
    }
  };

  // Check if user's email is verified
  const checkEmailVerification = async (userId: string): Promise<boolean> => {
    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('No active session found');
        return false;
      }
      
      // For security, only allow checking verification status of the currently signed-in user
      if (session.user.id !== userId) {
        console.log('User ID mismatch');
        return false;
      }
      
      // The presence of a valid session after email verification means the user is verified
      // We also check email_confirmed_at if available in user metadata
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('No user data available');
        return false;
      }
      
      console.log('User verification status:', user.email_confirmed_at !== null);
      
      // If email_confirmed_at exists and is not null, the email is verified
      return user.email_confirmed_at !== null;
    } catch (error) {
      console.error('Error checking email verification:', error);
      return false;
    }
  };
  
  // Resend verification email
  const resendVerificationEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: APP_CONSTANTS.API.AUTH_REDIRECT_URL,
        }
      });
      
      if (error) {
        return { error };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error resending verification email:', error);
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
      checkEmailVerification,
      resendVerificationEmail
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