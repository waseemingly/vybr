import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { NavigationContainerRef } from '@react-navigation/native'; // Import type for ref
// Adjust path as necessary
import { supabase, UserTypes, SignUpCredentials, LoginCredentials, UserSession, MusicLoverProfile as DbMusicLoverProfile, OrganizerProfile as DbOrganizerProfile, MusicLoverBio as SupabaseMusicLoverBio } from '../lib/supabase';
import { useOrganizerMode } from './useOrganizerMode'; // Ensure path is correct
// Use explicit imports for Image Picker
import {
  launchImageLibraryAsync,
  requestMediaLibraryPermissionsAsync,
  MediaTypeOptions // Use correct import for MediaTypeOptions
} from 'expo-image-picker';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants'; // For fallback Supabase URL

// --- Exported Types ---
export type MusicLoverBio = SupabaseMusicLoverBio;

// Update MusicLoverProfile interface to include the new DB column
// Assuming DbMusicLoverProfile from supabase types might not have it yet
export interface MusicLoverProfile extends Omit<DbMusicLoverProfile, 'selected_streaming_service'> {
  termsAccepted?: boolean; // Keep this if not in base type
  selectedStreamingService?: string | null; // Add this field
}

// Update CreateMusicLoverProfileData to require the new field during creation
export type CreateMusicLoverProfileData = Omit<DbMusicLoverProfile, 'id' | 'user_id' | 'is_premium' | 'created_at' | 'updated_at' | 'age' | 'music_data' | 'profile_picture' | 'bio' | 'country' | 'city' | 'terms_accepted' | 'selected_streaming_service'> & {
  userId: string;
  age?: number | null;
  profilePictureUri?: string;
  termsAccepted: boolean; // Ensure this is required
  bio: MusicLoverBio;
  country?: string;
  city?: string;
  selectedStreamingService: string; // Add this required field
};

// Keep Organizer Profile Type
export type CreateOrganizerProfileData = Omit<DbOrganizerProfile, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'logo'> & {
  userId: string;
  logoUri?: string;
};
// --- End Exported Types ---

// --- Context Definition ---
const AuthContext = createContext<{
  session: UserSession | null;
  loading: boolean;
  signUp: (credentials: SignUpCredentials) => Promise<{ error: any } | { user: any }>;
  login: (credentials: LoginCredentials) => Promise<{ error: any } | { user: any }>;
  logout: () => Promise<void>;
  checkSession: (options?: { navigateToProfile?: boolean }) => Promise<void>;
  createMusicLoverProfile: (profileData: CreateMusicLoverProfileData) => Promise<{ error: any } | { success: boolean }>;
  createOrganizerProfile: (profileData: CreateOrganizerProfileData) => Promise<{ error: any } | { success: boolean }>;
  updatePremiumStatus: (userId: string, isPremium: boolean) => Promise<{ error: any } | { success: boolean }>;
  requestMediaLibraryPermissions: () => Promise<boolean>;
}>({
  session: null,
  loading: true,
  signUp: async () => ({ error: 'Not implemented' }),
  login: async () => ({ error: 'Not implemented' }),
  logout: async () => {},
  checkSession: async () => {},
  createMusicLoverProfile: async () => ({ error: 'Not implemented' }),
  createOrganizerProfile: async () => ({ error: 'Not implemented' }),
  updatePremiumStatus: async () => ({ error: 'Not implemented' }),
  requestMediaLibraryPermissions: async () => false,
});

// --- Provider Component ---
interface AuthProviderProps {
  children: React.ReactNode;
  navigationRef: React.RefObject<NavigationContainerRef<any>>; // Use correct ref type
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, navigationRef }) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const { isOrganizerMode, setIsOrganizerMode } = useOrganizerMode();
  const previousSessionRef = useRef<UserSession | null>(null);

  useEffect(() => {
    previousSessionRef.current = session;
  }, [session]);

  // --- Permissions ---
  const requestMediaLibraryPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'web') {
      try {
         const { status } = await requestMediaLibraryPermissionsAsync();
         if (status !== 'granted') {
           Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to make this work!');
           return false;
         }
         console.log("[AuthProvider] Media library permission granted.");
         return true;
      } catch (e) {
         console.error("[AuthProvider] Error requesting media library permissions:", e)
         Alert.alert('Permission Error', 'Could not request camera roll permissions.');
         return false;
      }
    }
    return true; // Assume granted or not applicable on web
  };

  // --- Image Upload ---
  const _uploadImage = async (userId: string, fileUri: string, mimeType: string | undefined, bucket: 'profile-pictures' | 'logos'): Promise<string | null> => {
    if (!userId || !fileUri) {
        console.error('[AuthProvider] _uploadImage: Invalid userId or fileUri provided.');
        return null;
    }
    try {
        console.log(`[AuthProvider] _uploadImage: Uploading for user ${userId}. Bucket: ${bucket}. URI: ${fileUri.substring(0,100)}...`); // Log start of URI

        // Determine Extension
        let fileExt = mimeType?.split('/')[1] || fileUri.split('.').pop()?.toLowerCase();
        const commonImageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
        if (!fileExt || !commonImageExtensions.includes(fileExt)) {
            // Fallback for URI without extension (common from expo-image-picker)
            const lastSegment = fileUri.split('/').pop();
            if (lastSegment?.includes('.')) {
                fileExt = lastSegment.split('.').pop()?.toLowerCase();
            }
            if (!fileExt || !commonImageExtensions.includes(fileExt)) {
                console.warn(`[AuthProvider] _uploadImage: Could not determine common extension ('${fileExt || 'none'}'). Defaulting to 'jpeg'.`);
                fileExt = 'jpeg'; // Default if still unknown
            }
             if (mimeType && mimeType.startsWith('image/') && commonImageExtensions.includes(mimeType.split('/')[1])) {
                fileExt = mimeType.split('/')[1]; // Prefer mimeType if valid
                console.log(`[AuthProvider] _uploadImage: Using extension from valid mimeType: '${fileExt}'`);
            }
        }

        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = `${userId}/${fileName}`; // RLS expects userId as first segment
        console.log(`[AuthProvider] _uploadImage: Determined filePath: ${filePath}`);

        // Prepare a blob to upload
        let blob: Blob;

        if (fileUri.startsWith('file:') || fileUri.startsWith('content:') || fileUri.startsWith('ph:')) {
          console.log('[AuthProvider] _uploadImage: Using XMLHttpRequest for local file URI');
          try {
            blob = await new Promise<Blob>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.onload = function() {
                if (this.status === 200) {
                  const responseBlob = new Blob([this.response], { type: mimeType || `image/${fileExt}` });
                  console.log(`[AuthProvider] _uploadImage: XHR blob created, size: ${responseBlob.size}`);
                  resolve(responseBlob);
                } else { reject(new Error(`XHR failed with status ${this.status}`)); }
              };
              xhr.onerror = function() { reject(new Error('XHR network error')); };
              xhr.responseType = 'blob';
              xhr.open('GET', fileUri, true);
              xhr.send();
            });
            console.log(`[AuthProvider] _uploadImage: Successfully created blob via XHR, size: ${blob.size}`);
          } catch (xhrError: any) {
            console.error('[AuthProvider] _uploadImage: XHR approach failed:', xhrError.message);
            console.log('[AuthProvider] _uploadImage: Falling back to fetch API for local file...');
            const response = await fetch(fileUri);
            if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);
            blob = await response.blob();
            console.log(`[AuthProvider] _uploadImage: Successfully created blob via fetch fallback, size: ${blob.size}`);
          }
        } else {
          console.log('[AuthProvider] _uploadImage: Using fetch API for remote/data URI');
          const response = await fetch(fileUri);
          if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
          blob = await response.blob();
          console.log(`[AuthProvider] _uploadImage: Blob created via fetch, size: ${blob.size}`);
        }

        if (!blob || blob.size === 0) {
          console.error('[AuthProvider] _uploadImage: Created blob is empty or invalid.');
          throw new Error('Created blob is empty - cannot upload');
        }

        // Determine Content-Type
        let finalContentType = mimeType;
        if (!finalContentType || !finalContentType.startsWith('image/')) {
          console.warn(`[AuthProvider] _uploadImage: Provided mimeType '${mimeType}' invalid. Trying blob type '${blob.type}'.`);
          finalContentType = blob.type && blob.type.startsWith('image/') ? blob.type : `image/${fileExt}`;
          console.warn(`[AuthProvider] _uploadImage: Using final content type: '${finalContentType}'.`);
        }
        console.log(`[AuthProvider] _uploadImage: Final ContentType for upload: ${finalContentType}.`);

        // Upload to Supabase
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(filePath, blob, { cacheControl: '3600', upsert: false, contentType: finalContentType });

        if (uploadError) {
            console.error('[AuthProvider] _uploadImage: Supabase upload error:', JSON.stringify(uploadError, null, 2));
            if (uploadError.message?.includes('security policy') || uploadError.message?.includes('403')) {
                 console.error(`--->>> [AuthProvider] RLS ERROR HINT: Check INSERT policy for bucket '${bucket}'. Policy should allow authenticated users based on user ID in path: (bucket_id = '${bucket}') AND (auth.uid() = (storage.foldername(name))[1]::uuid) <<<---`);
            }
            throw new Error(`Supabase storage upload failed: ${uploadError.message || 'Unknown upload error'}`);
        }
        if (!uploadData?.path) throw new Error('Supabase storage upload succeeded but returned no path.');

        const uploadedPath = uploadData.path;
        console.log('[AuthProvider] _uploadImage: Image uploaded successfully, path:', uploadedPath);

        // Get Public URL
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(uploadedPath);
         if (!urlData?.publicUrl) {
              console.warn('[AuthProvider] _uploadImage: Could not get public URL immediately. Constructing fallback.');
              const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl;
              if (!supabaseUrl) {
                 console.error('[AuthProvider] _uploadImage: Cannot construct fallback URL - Supabase URL missing.');
                 return null;
              }
              const constructedUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${uploadedPath}`;
              console.log('[AuthProvider] _uploadImage: Using manually constructed URL:', constructedUrl);
              return constructedUrl;
         }
        console.log('[AuthProvider] _uploadImage: Public URL obtained:', urlData.publicUrl);
        return urlData.publicUrl;

    } catch (error: any) {
        console.error(`[AuthProvider] _uploadImage: Error during upload for user ${userId}. Bucket: ${bucket}. URI: ${fileUri.substring(0,100)}... Error:`, error.message || error);
        if (error.message?.includes('Failed to fetch')) console.error(`[AuthProvider] _uploadImage: HINT - Check if the file URI is correct and accessible.`);
        return null;
    }
  };

  // --- Check Session ---
  const checkSession = async (options?: { navigateToProfile?: boolean }) => {
    const navigateAfterProfileComplete = options?.navigateToProfile ?? false;
    console.log(`[AuthProvider] checkSession: START (NavOnComplete: ${navigateAfterProfileComplete})`);
    const wasMusicLoverProfileComplete = !!previousSessionRef.current?.musicLoverProfile;
    const wasOrganizerProfileComplete = !!previousSessionRef.current?.organizerProfile;

    try {
      const { data: { session: authSession }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) { console.error('[AuthCheck] Error getSession:', sessionError); setSession(null); setLoading(false); return; }
      if (!authSession) { console.log('[AuthCheck] No active session.'); setSession(null); setLoading(false); return; }

      console.log('[AuthCheck] Active session for user:', authSession.user.id);

      // Determine User Type
      let userType: UserTypes | null = null;
       const { data: userTypeData, error: userTypeError } = await supabase
        .from('user_types').select('type').eq('user_id', authSession.user.id).maybeSingle();

       if (userTypeError) console.error('[AuthCheck] Error fetch type:', userTypeError);

       if (userTypeData?.type) { userType = userTypeData.type as UserTypes; }
       else {
         const metaUserType = authSession.user.user_metadata?.user_type as UserTypes;
         if (metaUserType) {
           userType = metaUserType;
           console.log('[AuthCheck] User type from metadata:', userType);
           supabase.from('user_types').upsert({ user_id: authSession.user.id, type: userType }, { onConflict: 'user_id' })
              .then(({ error }) => { if (error) console.error('[AuthCheck] Failed DB type upsert:', error); });
         } else {
            console.error('[AuthCheck] CRITICAL: No user type found! Signing out.');
            await supabase.auth.signOut().catch(e => console.warn("Sign out failed after missing type", e));
            setSession(null); setLoading(false); return;
          }
      }
      if (!userType) { console.error("User type determination failed unexpectedly."); setSession(null); setLoading(false); return; }
      console.log('[AuthCheck] Determined User Type:', userType);

      // Build Base Session
      let currentUserSession: UserSession = {
        user: { id: authSession.user.id, email: authSession.user.email! },
        userType: userType,
        musicLoverProfile: null,
        organizerProfile: null,
      };
      if ((userType === 'organizer') !== isOrganizerMode) {
            setIsOrganizerMode(userType === 'organizer');
            console.log(`[AuthCheck] Set Organizer Mode: ${userType === 'organizer'}`);
       }

      // Fetch Specific Profile
      let profileJustCompleted = false;
      if (userType === 'music_lover') {
        // Fetch profile including the new streaming service field
        const { data: profile, error: profileError } = await supabase
          .from('music_lover_profiles')
          .select('*, selected_streaming_service') // Ensure it's selected
          .eq('user_id', authSession.user.id)
          .maybeSingle();

        if (profileError) { console.error('[AuthCheck] Error fetch ML profile:', profileError); }
        else if (profile) {
          console.log(`[AuthCheck] Music lover profile FOUND. User: ${profile.username}, Premium: ${profile.is_premium}, Service: ${profile.selected_streaming_service}`);
          // Map all relevant fields including the new one
          currentUserSession.musicLoverProfile = {
            id: profile.id, userId: profile.user_id, firstName: profile.first_name, lastName: profile.last_name,
            username: profile.username, email: profile.email, age: profile.age, profilePicture: profile.profile_picture,
            bio: profile.bio || {}, country: profile.country, city: profile.city,
            termsAccepted: profile.terms_accepted ?? false, isPremium: profile.is_premium ?? false,
            musicData: profile.music_data || {},
            selectedStreamingService: profile.selected_streaming_service, // <-- Map the value
          };
          if (!wasMusicLoverProfileComplete && currentUserSession.musicLoverProfile) {
            profileJustCompleted = true;
            console.log('[AuthCheck] Music Lover profile JUST COMPLETED.');
          }
        } else console.log('[AuthCheck] No music lover profile found in DB yet.');

      } else if (userType === 'organizer') {
         // Organizer profile fetch (no changes needed here)
         const { data: profile, error: profileError } = await supabase
          .from('organizer_profiles').select('*').eq('user_id', authSession.user.id).maybeSingle();
        if (profileError) { console.error('[AuthCheck] Error fetch Org profile:', profileError); }
        else if (profile) {
           console.log(`[AuthCheck] Organizer profile FOUND. Company: ${profile.company_name}`);
           currentUserSession.organizerProfile = { /* ... mapping ... */ };
           if (!wasOrganizerProfileComplete && currentUserSession.organizerProfile) {
             profileJustCompleted = true;
             console.log('[AuthCheck] Organizer profile JUST COMPLETED.');
           }
        } else console.log('[AuthCheck] No organizer profile found in DB yet.');
      }

      // Update State
      console.log(`[AuthCheck] Updating session state. Profile Just Completed Flag: ${profileJustCompleted}`);
      setSession(currentUserSession);

      // Navigate on Profile Completion (if requested)
      if (profileJustCompleted && navigateAfterProfileComplete) {
         setTimeout(() => {
            if (navigationRef.current && navigationRef.current.isReady()) {
                 console.log('[AuthCheck] Profile completed & nav requested. Triggering navigation reset...');
                 const targetTab = userType === 'music_lover' ? 'UserTabs' : 'OrganizerTabs';
                 const targetScreen = userType === 'music_lover' ? 'Profile' : 'OrganizerProfile';

                 navigationRef.current.reset({
                     index: 0,
                     routes: [ { name: 'MainApp', state: { routes: [ { name: targetTab, state: { routes: [{ name: targetScreen }] } } ] } } ],
                 });
                 console.log(`[AuthCheck] Navigation reset attempted to ${targetTab} -> ${targetScreen}`);
            } else {
                 console.warn('[AuthCheck] Profile completed, nav requested, but navigation ref not ready after delay.');
            }
         }, 100);
       }

    } catch (error: any) {
      console.error('[AuthCheck] UNEXPECTED error:', error);
      setSession(null); setIsOrganizerMode(false);
    } finally {
      if (loading) {
          setLoading(false);
          console.log('[AuthCheck] FINISHED initial load. Set loading=false');
      } else {
        console.log('[AuthCheck] FINISHED subsequent check.');
      }
    }
  };

  // --- Auth Listener ---
  useEffect(() => {
    console.log('[AuthProvider] Setting up onAuthStateChange listener.');
    if (loading) { checkSession(); } // Initial check

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentAuthSession) => {
       console.log(`[AuthProvider] Auth State Change Event: ${event}`, currentAuthSession ? `User: ${currentAuthSession.user?.id}` : 'null');
      switch (event) {
           case 'SIGNED_IN':
           case 'INITIAL_SESSION':
           case 'TOKEN_REFRESHED':
           case 'USER_UPDATED':
           case 'PASSWORD_RECOVERY':
               console.log(`[AuthProvider] Auth Event (${event}): Calling checkSession...`);
              await checkSession(); // Update state, don't force navigation here
              break;
          case 'SIGNED_OUT':
               console.log('[AuthProvider] Auth Event: SIGNED_OUT received.');
              setSession(null);
              setIsOrganizerMode(false);
              setLoading(false);
              break;
          default:
               console.log('[AuthProvider] Auth Event: Unhandled:', event);
      }
    });
    return () => {
      console.log('[AuthProvider] Unsubscribing from onAuthStateChange listener.');
      authListener?.subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount


  // --- Sign Up ---
  const signUp = async (credentials: SignUpCredentials): Promise<{ error: any } | { user: any }> => {
    console.log(`[AuthProvider] signUp: Type: ${credentials.userType}, Email: ${credentials.email}`);
    try {
        const { email, password, userType } = credentials;
        if (!email || !password || !userType) return { error: new Error('Missing required fields (email, password, userType).') };

        console.log('[AuthProvider] signUp: Calling Supabase auth.signUp...');
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email, password, options: { data: { user_type: userType } }
        });
        if (authError || !authData?.user) {
            console.error('[AuthProvider] signUp: Supabase Error:', authError || 'No user data returned');
            if (authError?.message.includes('User already registered')) return { error: new Error('Email already in use. Please log in.') };
            return { error: authError || new Error('Sign up failed.') };
        }
        const userId = authData.user.id;
        console.log('[AuthProvider] signUp: Auth user created:', userId);

        // Upsert user type in DB
        console.log('[AuthProvider] signUp: Upserting user type in DB...');
        const { error: upsertTypeError } = await supabase
            .from('user_types').upsert({ user_id: userId, type: userType }, { onConflict: 'user_id' });
        if (upsertTypeError) {
            console.error('[AuthProvider] signUp: DB type upsert failed:', upsertTypeError);
            console.warn(`[AuthProvider] signUp: User ${userId} created, but failed DB user_type upsert.`);
        } else {
             console.log('[AuthProvider] signUp: DB user type upserted successfully.');
        }

        console.log('[AuthProvider] signUp: Success for user:', userId, 'Returning user object.');
        return { user: authData.user }; // Listener will handle state update

    } catch (error: any) {
        console.error('[AuthProvider] signUp: UNEXPECTED error:', error);
        return { error };
    }
};

  // --- Create Music Lover Profile ---
  const createMusicLoverProfile = async (profileData: CreateMusicLoverProfileData): Promise<{ error: any } | { success: boolean }> => {
    console.log(`[AuthProvider] createMusicLoverProfile: START user: ${profileData.userId}, Service: ${profileData.selectedStreamingService}`);
    let publicImageUrl: string | null = null;

    try {
      // Validate required fields including the new service field
      if (!profileData.firstName || !profileData.lastName || !profileData.username || !profileData.email || profileData.termsAccepted === undefined || !profileData.selectedStreamingService) {
          console.error("[AuthProvider] createMusicLoverProfile: Missing required profile data.");
          return { error: new Error("Missing required profile information (name, username, email, terms, streaming service).") };
      }

      // Handle Image Upload
      if (profileData.profilePictureUri) {
        console.log('[AuthProvider] createMusicLoverProfile: Uploading profile picture...');
        const extension = profileData.profilePictureUri.split('.').pop()?.toLowerCase();
        let imageMimeType: string | undefined = undefined;
        if (extension && ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) {
           imageMimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
        }
        console.log(`[AuthProvider] Determined MimeType for upload: ${imageMimeType}`);

        publicImageUrl = await _uploadImage(profileData.userId, profileData.profilePictureUri, imageMimeType, 'profile-pictures');

        if (publicImageUrl === null) {
          console.error('[AuthProvider] createMusicLoverProfile: Pic upload FAILED. Proceeding without.');
        } else console.log('[AuthProvider] createMusicLoverProfile: Pic uploaded successfully:', publicImageUrl);
      } else {
         console.log('[AuthProvider] createMusicLoverProfile: No profile picture provided.');
      }

      // Prepare DB Data including the new service field
      const dbData = {
        user_id: profileData.userId,
        first_name: profileData.firstName.trim(),
        last_name: profileData.lastName.trim(),
        username: profileData.username.trim(),
        email: profileData.email.trim(),
        age: profileData.age || null,
        bio: profileData.bio || {},
        country: profileData.country?.trim() || null,
        city: profileData.city?.trim() || null,
        terms_accepted: profileData.termsAccepted,
        profile_picture: publicImageUrl, // Null if upload failed/skipped
        selected_streaming_service: profileData.selectedStreamingService, // <-- Save the service
        music_data: {}, // Default empty object
        is_premium: false, // Default, updated later
      };
      console.log('[AuthProvider] createMusicLoverProfile: Upserting profile data...');
      const { error: upsertError } = await supabase.from('music_lover_profiles').upsert(dbData, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('[AuthProvider] createMusicLoverProfile: Upsert FAILED:', JSON.stringify(upsertError, null, 2));
        if (upsertError.code === '23505' && upsertError.message.includes('username')) return { error: new Error('Username already taken.') };
        return { error: upsertError };
      }
      console.log('[AuthProvider] createMusicLoverProfile: Upsert SUCCESS.');
      // Success - next step (updatePremiumStatus) will trigger checkSession/navigation
      return { success: true };
    } catch (error: any) {
      console.error('[AuthProvider] createMusicLoverProfile: UNEXPECTED error:', error);
      return { error };
    }
  };

  // --- Create Organizer Profile ---
  const createOrganizerProfile = async (profileData: CreateOrganizerProfileData): Promise<{ error: any } | { success: boolean }> => {
    console.log('[AuthProvider] createOrganizerProfile: START user:', profileData.userId);
    let publicLogoUrl: string | null = null;

    try {
      // Validation
      if (!profileData.companyName || !profileData.email) {
         console.error("[AuthProvider] createOrganizerProfile: Missing required profile data.");
         return { error: new Error("Missing required profile information (company name, email).") };
      }

      // Logo Upload
      if (profileData.logoUri) {
        console.log('[AuthProvider] createOrganizerProfile: Uploading logo...');
        const extension = profileData.logoUri.split('.').pop()?.toLowerCase();
        const imageMimeType = extension ? `image/${extension === 'jpg' ? 'jpeg' : extension}` : undefined;
         publicLogoUrl = await _uploadImage(profileData.userId, profileData.logoUri, imageMimeType, 'logos');
        if (publicLogoUrl === null) console.error('[AuthProvider] createOrganizerProfile: Logo upload FAILED. Proceeding without.');
        else console.log('[AuthProvider] createOrganizerProfile: Logo uploaded successfully.');
      } else {
         console.log('[AuthProvider] createOrganizerProfile: No logo provided.');
      }

      // Prepare DB Data
      const organizerDbData = {
        user_id: profileData.userId,
        company_name: profileData.companyName.trim(),
        email: profileData.email.trim(),
        phone_number: profileData.phoneNumber?.trim() || null,
        business_type: profileData.businessType || null,
        bio: profileData.bio?.trim() || null,
        website: profileData.website?.trim() || null,
        logo: publicLogoUrl,
      };
      console.log('[AuthProvider] createOrganizerProfile: Upserting profile data...');
      const { error: upsertError } = await supabase.from('organizer_profiles').upsert(organizerDbData, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('[AuthProvider] createOrganizerProfile: Upsert FAILED:', JSON.stringify(upsertError, null, 2));
        return { error: upsertError };
      }
      console.log('[AuthProvider] createOrganizerProfile: Upsert SUCCESS.');

      // Call checkSession with navigation flag for organizers
      console.log('[AuthProvider] createOrganizerProfile: Calling checkSession with navigate=true...');
      await checkSession({ navigateToProfile: true }); // Trigger navigation
      return { success: true };
    } catch (error: any) {
      console.error('[AuthProvider] createOrganizerProfile: UNEXPECTED error:', error);
      return { error };
    }
  };

  // --- Update Premium Status (Music Lover) ---
  const updatePremiumStatus = async (userId: string, isPremium: boolean): Promise<{ error: any } | { success: boolean }> => {
    console.log(`[AuthProvider] updatePremiumStatus: Setting premium=${isPremium} for user ${userId}`);
    try {
      // Update profile table
      console.log('[AuthPremium] Updating music_lover_profiles...');
      const { error: updateError } = await supabase
        .from('music_lover_profiles').update({ is_premium: isPremium }).eq('user_id', userId);
      if (updateError) { console.error('[AuthPremium] Profile update failed:', updateError); return { error: updateError }; }
      console.log('[AuthPremium] Profile status updated in DB.');

      // Handle Subscriptions/Payments (ensure tables/columns exist)
      if (isPremium) {
        console.log('[AuthPremium] Processing premium subscription/payment records...');
        const now = new Date();
        const endDate = new Date(now.getTime());
        endDate.setMonth(endDate.getMonth() + 1);

        // Upsert subscription (ensure `subscriptions` table and columns exist)
        const { error: subError } = await supabase.from('subscriptions').upsert({
          user_id: userId, status: 'active', plan_type: 'premium',
          start_date: now.toISOString(),
          end_date: endDate.toISOString(), // Ensure 'end_date' column exists
          payment_method: 'credit_card' // Placeholder
        }, { onConflict: 'user_id' });

        if (subError) {
            console.error('[AuthPremium] Subscription upsert failed:', subError);
             if (subError.message?.includes("column") && subError.message?.includes("end_date")) {
               console.error(" --->>> HINT: The 'end_date' column might be missing or misspelled in your 'subscriptions' table schema. <<<---");
            }
            // Decide whether to return error or just log
        } else {
          console.log('[AuthPremium] Subscription upsert OK.');
          // Insert payment history (ensure `payment_history` table and columns exist)
          const { error: payError } = await supabase.from('payment_history').insert({
            user_id: userId, amount: 4.99, currency: 'USD',
            payment_method: 'credit_card', status: 'succeeded',
            description: 'Premium Subscription Activation'
          });
          if (payError) console.error('[AuthPremium] Payment insert failed:', payError);
          else console.log('[AuthPremium] Payment record OK.');
        }
      } else {
        // Deactivate subscription if downgrading to free
        console.log('[AuthPremium] Processing free status (deactivation)...');
        const { error: deactError } = await supabase.from('subscriptions')
          .update({ status: 'inactive', end_date: new Date().toISOString() }) // Or 'cancelled', set end date
          .eq('user_id', userId)
          .eq('status', 'active');
        if (deactError) console.error('[AuthPremium] Subscription deactivation failed:', deactError);
        else console.log('[AuthPremium] Subscription deactivated (if applicable).');
      }

      // Refresh session AND NAVIGATE after updates
      console.log(`[AuthProvider] updatePremiumStatus: Calling checkSession with navigate=true...`);
      await checkSession({ navigateToProfile: true });

      return { success: true };
    } catch (error: any) {
      console.error('[AuthProvider] updatePremiumStatus: UNEXPECTED error:', error);
      return { error };
    }
  };

  // --- Login / Logout ---
  const login = async (credentials: LoginCredentials): Promise<{ error: any } | { user: any }> => {
      console.log(`[AuthProvider] login: Type: ${credentials.userType}, Email: ${credentials.email}`);
      try {
          const { email, password, userType } = credentials;
          if (!email || !password || !userType) return { error: new Error('Missing fields.') };

          console.log('[AuthProvider] login: Signing in...');
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
          if (loginError) { console.error("Login Error:", loginError); return { error: { message: 'Invalid email or password.' } }; }
          if (!loginData?.user) return { error: new Error('Login failed: No user data.') };
          const userId = loginData.user.id;
          console.log('[AuthProvider] login: Sign in successful:', userId);

          // Verify type from DB post-login
          console.log('[AuthProvider] login: Verifying user type from DB...');
          const { data: typeData, error: typeError } = await supabase
              .from('user_types').select('type').eq('user_id', userId).single();

          if (typeError || !typeData) {
              console.error('[AuthProvider] login: Failed to verify DB type:', typeError);
              await supabase.auth.signOut().catch(e => console.warn("Sign out failed after type verify error", e));
              return { error: { message: 'Could not verify account type after login.' } };
          }
          if (typeData.type !== userType) {
              console.warn(`[AuthProvider] login: Type mismatch! Attempted ${userType}, DB has ${typeData.type}. Signing out.`);
              await supabase.auth.signOut().catch(e => console.warn("Sign out failed after type mismatch", e));
              return { error: { message: 'Incorrect login portal used for this account type.' } };
          }
          console.log('[AuthProvider] login: User type verified:', typeData.type);

          setIsOrganizerMode(typeData.type === 'organizer');
          await checkSession(); // Refresh session, no forced nav needed here
          console.log('[AuthProvider] login: Session refreshed.');
          return { user: loginData.user }; // Login screen handles navigation
    } catch (error: any) {
        console.error('[AuthProvider] login: UNEXPECTED error:', error);
        return { error };
    }
  };

  const logout = async () => {
    console.log('[AuthProvider] logout: Called');
    try {
        const { error } = await supabase.auth.signOut();
        if (error) console.error("[AuthProvider] logout: Supabase signOut Error:", error);
        else console.log("[AuthProvider] logout: Supabase signOut successful.");
      } catch (e) { console.error("[AuthProvider] logout: UNEXPECTED error during signOut call:", e); }
      finally {
          // Always clear local state
        console.log("[AuthProvider] logout: Clearing local session state.");
        setSession(null);
        setIsOrganizerMode(false);
        setLoading(false); // Ensure loading is false on logout
    }
  };

  // Provide context value
  return (
    <AuthContext.Provider value={{
      session,
      loading,
      signUp,
      login,
      logout,
      checkSession,
      createMusicLoverProfile,
      createOrganizerProfile,
      updatePremiumStatus,
      requestMediaLibraryPermissions
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};