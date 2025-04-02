import React, { createContext, useState, useEffect, useContext } from 'react';
// Adjust path as necessary
import { supabase, UserTypes, SignUpCredentials, LoginCredentials, UserSession, MusicLoverProfile as DbMusicLoverProfile, OrganizerProfile as DbOrganizerProfile, MusicLoverBio as SupabaseMusicLoverBio } from '../lib/supabase';
import { useOrganizerMode } from './useOrganizerMode'; // Ensure path is correct
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import Constants from 'expo-constants'; // For fallback Supabase URL

// --- Exported Types ---
export type MusicLoverBio = SupabaseMusicLoverBio;

// Define types for profile data input more explicitly
// Type for data passed TO createMusicLoverProfile function
export type CreateMusicLoverProfileData = Omit<DbMusicLoverProfile, 'id' | 'user_id' | 'is_premium' | 'created_at' | 'updated_at' | 'age' | 'music_data' | 'profile_picture' | 'bio' | 'country' | 'city'> & {
  userId: string; // Add userId explicitly
  age?: number | null; // Expect number or null
  profilePictureUri?: string; // Local URI from image picker
  termsAccepted: boolean;
  bio: MusicLoverBio; // Use the bio type
  country?: string;
  city?: string;
};

// Type for data passed TO createOrganizerProfile function
export type CreateOrganizerProfileData = Omit<DbOrganizerProfile, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'logo'> & {
  userId: string; // Add userId explicitly
  logoUri?: string; // Local URI from image picker
};
// --- End Exported Types ---


// Context Definition
const AuthContext = createContext<{
  session: UserSession | null;
  loading: boolean;
  signUp: (credentials: SignUpCredentials) => Promise<{ error: any } | { user: any }>;
  login: (credentials: LoginCredentials) => Promise<{ error: any } | { user: any }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
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

// Provider Component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const { isOrganizerMode, setIsOrganizerMode } = useOrganizerMode(); // Correctly get both

  // --- Helper: Request Media Library Permissions ---
  const requestMediaLibraryPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'web') {
      try {
         const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
         if (status !== 'granted') {
           Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to make this work!');
           return false;
         }
         return true;
      } catch (e) {
         console.error("Error requesting media library permissions:", e)
         Alert.alert('Permission Error', 'Could not request camera roll permissions.');
         return false;
      }
    }
    return true; // Assume granted or not applicable on web
  };


  // --- Helper: Upload Image to Supabase Storage (Add RLS hint on policy error) ---
  const _uploadImage = async (userId: string, fileUri: string, mimeType: string | undefined, bucket: 'profile-pictures' | 'logos'): Promise<string | null> => {
    if (!userId || !fileUri) {
        console.error('[AuthProvider] _uploadImage: Invalid userId or fileUri provided.', { userId, fileUri: fileUri?.substring(0, 100) });
        return null;
    }
    try {
        console.log(`[AuthProvider] _uploadImage: Uploading for user ${userId}. Bucket: ${bucket}. Provided MimeType: ${mimeType}. URI starts with: ${fileUri.substring(0, 100)}...`);

        // 1. Determine Extension
        let fileExt = mimeType ? mimeType.split('/')[1] : fileUri.split('.').pop()?.toLowerCase();
        const commonImageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
        if (!fileExt || !commonImageExtensions.includes(fileExt || '')) { // Add check for fileExt being potentially undefined
            console.warn(`[AuthProvider] _uploadImage: Could not reliably determine extension from URI/mimeType ('${fileExt}'). Defaulting to 'jpeg'.`);
            fileExt = 'jpeg';
        }
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = `${userId}/${fileName}`; // Path structure: userId/fileName.ext
        console.log(`[AuthProvider] _uploadImage: Determined filePath: ${filePath}`);

        // 2. Fetch the image data
        console.log(`[AuthProvider] _uploadImage: Fetching image from URI: ${fileUri.substring(0, 100)}...`);
        const response = await fetch(fileUri);
        console.log(`[AuthProvider] _uploadImage: Fetch response status OK: ${response.ok}, Status: ${response.status}`);
        if (!response.ok) {
            let errorBody = 'Could not read response body.';
            try { errorBody = await response.text(); } catch (e) { /* ignore */ }
            console.error(`[AuthProvider] _uploadImage: Failed to fetch image blob. Status: ${response.status} ${response.statusText}. URI: ${fileUri}. Response Body Hint: ${errorBody.substring(0, 500)}`);
            throw new Error(`Failed to fetch image blob: ${response.status} ${response.statusText}`);
        }

        // 3. Create Blob
        const blob = await response.blob();
        console.log(`[AuthProvider] _uploadImage: Blob created, size: ${blob.size}, type: ${blob.type}`);
        if (blob.size === 0) {
             console.error(`[AuthProvider] _uploadImage: Created blob has size 0. Upload aborted.`);
             throw new Error('Created blob is empty.');
        }

        // 4. Determine Content-Type for Upload
        let finalContentType = mimeType;
        if (!finalContentType || !finalContentType.startsWith('image/')) {
             console.warn(`[AuthProvider] _uploadImage: Provided mimeType '${mimeType}' invalid/missing. Trying blob type '${blob.type}'.`);
            if (blob.type && blob.type.startsWith('image/')) { finalContentType = blob.type; }
            else { finalContentType = `image/${fileExt}`; console.warn(`[AuthProvider] _uploadImage: Blob type invalid/missing. Using constructed default: '${finalContentType}'.`); }
        }
        console.log(`[AuthProvider] _uploadImage: Final ContentType for upload: ${finalContentType}.`);

        // 5. Upload to Supabase
        console.log(`[AuthProvider] _uploadImage: Attempting upload to path: ${filePath} with ContentType: ${finalContentType}`);
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(filePath, blob, { cacheControl: '3600', upsert: false, contentType: finalContentType });

        if (uploadError) {
            console.error('[AuthProvider] _uploadImage: Supabase upload error:', JSON.stringify(uploadError, null, 2));
            if (uploadError.message?.includes('policy') || uploadError.message?.includes('permission')) {
                 console.error(`[AuthProvider] _uploadImage: HINT: Possible RLS policy issue on bucket '${bucket}'. Check INSERT policies. Does policy allow authenticated users to insert into their own folder (e.g., path_tokens[1] = auth.uid()::text)?`);
            }
            // Add other hints if needed
            throw new Error(`Supabase storage upload failed: ${uploadError.message || 'Unknown upload error'}`);
        }

        if (!uploadData || !uploadData.path) {
             console.error('[AuthProvider] _uploadImage: Supabase storage upload returned no path or data, although no explicit error was thrown.');
             throw new Error('Supabase storage upload succeeded but returned no path.');
        }
        console.log('[AuthProvider] _uploadImage: Image uploaded successfully, path:', uploadData.path);

        // 6. Get Public URL
        console.log('[AuthProvider] _uploadImage: Getting public URL for path:', filePath);
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
         if (!urlData || !urlData.publicUrl) {
              console.warn('[AuthProvider] _uploadImage: Could not get public URL immediately after upload for path:', filePath, '- Attempting manual construction.');
              const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl;
              if (supabaseUrl) {
                const cleanSupabaseUrl = supabaseUrl.replace(/\/$/, '');
                const constructedUrl = `${cleanSupabaseUrl}/storage/v1/object/public/${bucket}/${filePath}`;
                console.log('[AuthProvider] _uploadImage: Using manually constructed URL:', constructedUrl);
                return constructedUrl;
              }
              console.error('[AuthProvider] _uploadImage: Could not get or construct public URL (Supabase URL not found in env/config).');
             return null;
         }
        console.log('[AuthProvider] _uploadImage: Public URL obtained:', urlData.publicUrl);
        return urlData.publicUrl;

    } catch (error: any) {
        console.error(`[AuthProvider] _uploadImage: Error during upload process for user ${userId}. Error:`, error.message || error);
        return null; // Return null on any error
    }
  };


  // Check and set current session
  const checkSession = async () => {
    console.log('[AuthProvider] checkSession: START');
    try {
      const { data: { session: authSession }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[AuthProvider] checkSession: Error getting session:', sessionError);
        setSession(null);
        setIsOrganizerMode(false);
        setLoading(false);
        return;
      }

      if (!authSession) {
        console.log('[AuthProvider] checkSession: No active session found.');
        if (session !== null) setSession(null);
        if (isOrganizerMode) setIsOrganizerMode(false); // Use state variable
        if (loading) setLoading(false);
        return;
      }

      console.log('[AuthProvider] checkSession: Active session found for user:', authSession.user.id);

      // --- Determine User Type ---
      let userType: UserTypes | null = null;
       const { data: userTypeData, error: userTypeError } = await supabase
        .from('user_types').select('type').eq('user_id', authSession.user.id).maybeSingle();

       if (userTypeError) console.error('[AuthProvider] checkSession: Error fetching user type from DB:', userTypeError);

       if (userTypeData?.type) {
         userType = userTypeData.type as UserTypes;
         console.log('[AuthProvider] checkSession: User type found in DB:', userType);
       } else {
         console.log('[AuthProvider] checkSession: User type not in DB, checking auth metadata...');
         const metaUserType = authSession.user.user_metadata?.user_type as UserTypes;
         if (metaUserType) {
           userType = metaUserType;
           console.log('[AuthProvider] checkSession: User type found in metadata:', userType);
           const { error: insertError } = await supabase
             .from('user_types').insert({ user_id: authSession.user.id, type: userType }, { onConflict: 'user_id' })
             .select().maybeSingle();
           if (insertError && insertError.code !== '23505') console.error('[AuthProvider] checkSession: Error inserting/updating user type into DB:', insertError);
           else if (!insertError) console.log('[AuthProvider] checkSession: User type successfully inserted/ensured in DB.');
         } else {
           console.error('[AuthProvider] checkSession: CRITICAL: No user type found in DB or metadata for user:', authSession.user.id, '- Forcing logout.');
           await supabase.auth.signOut().catch(e => console.warn("[AuthProvider] checkSession: Sign out failed after missing user type", e));
           setSession(null);
           setIsOrganizerMode(false);
           setLoading(false);
           return;
         }
       }

      // --- Build Base Session ---
      let currentUserSession: UserSession = {
        user: { id: authSession.user.id, email: authSession.user.email! },
        userType: userType,
        musicLoverProfile: null,
        organizerProfile: null,
      };

       if ((userType === 'organizer') !== isOrganizerMode) {
            setIsOrganizerMode(userType === 'organizer');
       }

      // --- Fetch Specific Profile ---
      let profileFetched = false;
      if (userType === 'music_lover') {
        const { data: profile, error: profileError } = await supabase
          .from('music_lover_profiles').select('*').eq('user_id', authSession.user.id).maybeSingle();

        if (profileError) console.error('[AuthProvider] checkSession: Error fetching music lover profile:', profileError);
        else if (profile) {
          console.log(`[AuthProvider] checkSession: Music lover profile FOUND. ID: ${profile.id}, isPremium: ${profile.is_premium}, Username: ${profile.username}`);
          // Map DB snake_case to session camelCase
          currentUserSession.musicLoverProfile = {
            id: profile.id, userId: profile.user_id, firstName: profile.first_name, lastName: profile.last_name,
            username: profile.username, email: profile.email, age: profile.age, profilePicture: profile.profile_picture,
            bio: profile.bio || {}, country: profile.country, city: profile.city,
            termsAccepted: profile.terms_accepted ?? false, isPremium: profile.is_premium ?? false,
            musicData: profile.music_data || {},
            // Map timestamps if needed
            // createdAt: profile.created_at,
            // updatedAt: profile.updated_at
          };
          profileFetched = true;
        } else console.log('[AuthProvider] checkSession: No music lover profile found in DB for user yet.');

      } else if (userType === 'organizer') {
         const { data: profile, error: profileError } = await supabase
          .from('organizer_profiles').select('*').eq('user_id', authSession.user.id).maybeSingle();

        if (profileError) console.error('[AuthProvider] checkSession: Error fetching organizer profile:', profileError);
        else if (profile) {
           console.log('[AuthProvider] checkSession: Organizer profile FOUND. ID:', profile.id, 'Company:', profile.company_name);
          // Map DB snake_case to session camelCase
          currentUserSession.organizerProfile = {
            id: profile.id, userId: profile.user_id, companyName: profile.company_name, email: profile.email,
            phoneNumber: profile.phone_number, logo: profile.logo, businessType: profile.business_type,
            bio: profile.bio, website: profile.website,
            // Map timestamps if needed
            // createdAt: profile.created_at,
            // updatedAt: profile.updated_at
          };
          profileFetched = true;
        } else console.log('[AuthProvider] checkSession: No organizer profile found in DB for user yet.');
      }

      console.log(`[AuthProvider] checkSession: Setting session state - User: ${!!currentUserSession.user}, Type: ${currentUserSession.userType}, Profile Fetched: ${profileFetched}, ML Profile Exists: ${!!currentUserSession.musicLoverProfile}, Org Profile Exists: ${!!currentUserSession.organizerProfile}`);

       // Update session state if changed
       if (session?.user?.id !== currentUserSession.user.id ||
           !!session?.musicLoverProfile !== !!currentUserSession.musicLoverProfile ||
           !!session?.organizerProfile !== !!currentUserSession.organizerProfile ||
           session?.musicLoverProfile?.isPremium !== currentUserSession.musicLoverProfile?.isPremium
           ) {
            console.log('[AuthProvider] checkSession: Session state changed, updating context.');
            setSession(currentUserSession);
       } else {
            console.log('[AuthProvider] checkSession: Session state appears unchanged, skipping context update.');
       }

    } catch (error: any) {
      console.error('[AuthProvider] checkSession: UNEXPECTED error:', error);
      setSession(null);
      setIsOrganizerMode(false);
    } finally {
      if (loading) {
          console.log('[AuthProvider] checkSession: FINISHED. Setting loading to false.');
          setLoading(false);
      } else {
          console.log('[AuthProvider] checkSession: FINISHED (loading was already false).');
      }
    }
  };

  // --- Auth State Change Listener Setup ---
  useEffect(() => {
    console.log('[AuthProvider] Setting up onAuthStateChange listener.');
    setLoading(true);
    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentAuthSession) => { // Renamed session variable
       console.log(`[AuthProvider] Auth State Change Event: ${event}`, 'Session object:', currentAuthSession ? `User: ${currentAuthSession.user?.id}` : 'null');

       if (!loading && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
           console.log('[AuthProvider] Auth State Change: Setting loading=true before checkSession.');
           setLoading(true);
       }

      switch (event) {
          case 'SIGNED_IN':
          case 'INITIAL_SESSION':
          case 'TOKEN_REFRESHED':
          case 'USER_UPDATED':
              // Always call checkSession to get full profile data, regardless of event payload
              console.log(`[AuthProvider] Auth State Change (${event}): Calling checkSession...`);
              await checkSession();
              console.log(`[AuthProvider] Auth State Change (${event}): checkSession call completed.`);
              break;

          case 'SIGNED_OUT':
              console.log('[AuthProvider] Auth State Change: SIGNED_OUT received.');
              setSession(null);
              setIsOrganizerMode(false);
              setLoading(false);
              break;

          case 'PASSWORD_RECOVERY':
              console.log('[AuthProvider] Auth State Change: PASSWORD_RECOVERY event.');
              break;

          default:
              console.log('[AuthProvider] Auth State Change: Unhandled event:', event);
      }
    });

    return () => {
      console.log('[AuthProvider] Unsubscribing from onAuthStateChange listener.');
      authListener?.subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount


  // Sign up a new user
  const signUp = async (credentials: SignUpCredentials) => {
    console.log(`[AuthProvider] signUp: Called for type: ${credentials.userType}, Email: ${credentials.email}`);
    try {
        // Include firstName, lastName, username in destructuring for validation
        const { email, password, userType, firstName, lastName, username } = credentials;

        // Ensure required fields for music_lover are present
        if (!email || !password || !userType || (userType === 'music_lover' && (!firstName || !lastName || !username))) {
            console.error('[AuthProvider] signUp: Missing required fields.');
            return { error: new Error('Missing required sign up information.') };
        }

        console.log('[AuthProvider] signUp: Calling supabase.auth.signUp...');
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email, password, options: { data: { user_type: userType } } // Only include user_type in options.data
        });

        if (authError || !authData?.user) {
            console.error('[AuthProvider] signUp: Supabase auth.signUp error:', authError ? JSON.stringify(authError) : 'No user data returned');
            await supabase.auth.signOut().catch(e => console.warn("[AuthProvider] signUp: Sign out failed after sign up error", e));
            return { error: authError || new Error('User creation failed or returned no data.') };
        }
        const userId = authData.user.id;
        console.log('[AuthProvider] signUp: Auth user created successfully:', userId);

        console.log('[AuthProvider] signUp: Upserting user type into DB...');
        const { error: upsertTypeError } = await supabase
            .from('user_types').upsert({ user_id: userId, type: userType }, { onConflict: 'user_id' });

        if (upsertTypeError) {
            console.error('[AuthProvider] signUp: Error upserting user type:', upsertTypeError);
             await supabase.auth.signOut().catch(e => console.warn("[AuthProvider] signUp: Sign out failed after user type upsert error", e));
            return { error: upsertTypeError };
        } else console.log('[AuthProvider] signUp: User type upserted successfully.');

        console.log('[AuthProvider] signUp: Success for user:', userId, 'Returning user object. Auth listener will handle session update.');
        return { user: authData.user }; // Return user object for profile creation step

    } catch (error: any) {
        console.error('[AuthProvider] signUp: UNEXPECTED error:', error);
        await supabase.auth.signOut().catch(e => console.warn("[AuthProvider] signUp: Sign out failed after general sign up error", e));
        return { error };
    }
};


  // Create/Update a music lover profile
  const createMusicLoverProfile = async (profileData: CreateMusicLoverProfileData): Promise<{ error: any } | { success: boolean }> => {
    console.log('[AuthProvider] createMusicLoverProfile: START for user:', profileData.userId);
    let publicImageUrl: string | null | undefined = undefined;

    try {
      // 1. Handle Image Upload
      if (profileData.profilePictureUri) {
         console.log('[AuthProvider] createMusicLoverProfile: Profile picture URI provided, attempting upload...');
         let imageMimeType: string | undefined = undefined;
         // Simple MimeType Deduction (consider a library or passing from picker if possible)
         const extensionMatch = profileData.profilePictureUri.match(/\.([^.]+)$/);
         const extension = extensionMatch ? extensionMatch[1].toLowerCase() : null;
         if (extension === 'jpg' || extension === 'jpeg') imageMimeType = 'image/jpeg';
         else if (extension === 'png') imageMimeType = 'image/png';
         else if (extension === 'webp') imageMimeType = 'image/webp';
         else if (extension === 'gif') imageMimeType = 'image/gif';
         console.log(`[AuthProvider] createMusicLoverProfile: Deduced mimeType: ${imageMimeType} for upload.`);

         publicImageUrl = await _uploadImage(profileData.userId, profileData.profilePictureUri, imageMimeType, 'profile-pictures');

        if (publicImageUrl === null) {
          console.error('[AuthProvider] createMusicLoverProfile: Failed to upload profile picture. Proceeding without picture.');
        } else {
           console.log('[AuthProvider] createMusicLoverProfile: Profile picture uploaded:', publicImageUrl);
        }
      } else {
         console.log('[AuthProvider] createMusicLoverProfile: No profile picture URI provided, skipping upload.');
      }

      // 2. Prepare data for Supabase (using snake_case for DB columns)
      const musicLoverDbData = {
        user_id: profileData.userId,
        first_name: profileData.firstName,
        last_name: profileData.lastName,
        username: profileData.username,
        email: profileData.email,
        age: profileData.age, // Pass number or null
        // Ensure bio is an object or null
        bio: profileData.bio && Object.values(profileData.bio).some(v => v && v.trim() !== '') ? profileData.bio : null,
        country: profileData.country || null,
        city: profileData.city || null,
        terms_accepted: profileData.termsAccepted,
        profile_picture: publicImageUrl || null, // Use uploaded URL or null
        music_data: null, // Initialize music_data
        // is_premium is handled separately
      };

      console.log('[AuthProvider] createMusicLoverProfile: Data prepared for upsert:', JSON.stringify(musicLoverDbData, null, 2));

      // 3. Upsert Profile Data
      console.log('[AuthProvider] createMusicLoverProfile: Attempting profile upsert...');
      const { error: upsertError } = await supabase
        .from('music_lover_profiles')
        .upsert(musicLoverDbData, { onConflict: 'user_id' }); // Use user_id as conflict target

      if (upsertError) {
        console.error('[AuthProvider] createMusicLoverProfile: UPSERT FAILED:', JSON.stringify(upsertError, null, 2));
        if (upsertError.message?.includes('policy') || upsertError.message?.includes('permission')) {
             console.error(`[AuthProvider] createMusicLoverProfile: HINT: Possible RLS policy issue on table 'music_lover_profiles'. Check INSERT/UPDATE policies.`);
        }
        return { error: upsertError };
      }

      console.log('[AuthProvider] createMusicLoverProfile: UPSERT SUCCESSFUL for user:', profileData.userId);
      // IMPORTANT: Do NOT call checkSession here. It will be called by updatePremiumStatus.
      console.log('[AuthProvider] createMusicLoverProfile: Profile data saved. Deferring session refresh.');
      return { success: true };

    } catch (error: any) {
      console.error('[AuthProvider] createMusicLoverProfile: UNEXPECTED error:', error);
      return { error };
    }
  };

  // Create/Update an organizer profile
  const createOrganizerProfile = async (profileData: CreateOrganizerProfileData): Promise<{ error: any } | { success: boolean }> => {
    console.log('[AuthProvider] createOrganizerProfile: START for user:', profileData.userId);
    let publicLogoUrl: string | null | undefined = undefined;

    try {
      // 1. Handle Logo Upload
      if (profileData.logoUri) {
         console.log('[AuthProvider] createOrganizerProfile: Logo URI provided, attempting upload...');
          let imageMimeType: string | undefined = undefined;
          const extensionMatch = profileData.logoUri.match(/\.([^.]+)$/);
          const extension = extensionMatch ? extensionMatch[1].toLowerCase() : null;
          if (extension === 'jpg' || extension === 'jpeg') imageMimeType = 'image/jpeg';
          else if (extension === 'png') imageMimeType = 'image/png';
          // Add other types
          console.log(`[AuthProvider] createOrganizerProfile: Deduced mimeType: ${imageMimeType} from extension: ${extension}`);

         publicLogoUrl = await _uploadImage(profileData.userId, profileData.logoUri, imageMimeType, 'logos');

        if (publicLogoUrl === null) console.error('[AuthProvider] createOrganizerProfile: Failed to upload organizer logo. Proceeding without logo.');
        else console.log('[AuthProvider] createOrganizerProfile: Organizer logo uploaded:', publicLogoUrl);
      } else console.log('[AuthProvider] createOrganizerProfile: No logo URI provided, skipping upload.');

      // 2. Prepare DB Data (snake_case)
      const organizerDbData = {
        user_id: profileData.userId,
        company_name: profileData.companyName,
        email: profileData.email,
        phone_number: profileData.phoneNumber || null,
        business_type: profileData.businessType || null,
        bio: profileData.bio || null,
        website: profileData.website || null,
        logo: publicLogoUrl || null, // Use uploaded URL or null
      };
       console.log('[AuthProvider] createOrganizerProfile: Organizer data prepared for upsert:', organizerDbData);

      // 3. Upsert Profile Data
      const { error: upsertError } = await supabase
        .from('organizer_profiles')
        .upsert(organizerDbData, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('[AuthProvider] createOrganizerProfile: UPSERT FAILED:', JSON.stringify(upsertError, null, 2));
        if (upsertError.message?.includes('policy') || upsertError.message?.includes('permission')) {
             console.error(`[AuthProvider] createOrganizerProfile: HINT: Possible RLS policy issue on table 'organizer_profiles'. Check INSERT/UPDATE policies.`);
        }
        return { error: upsertError };
      }
       console.log('[AuthProvider] createOrganizerProfile: UPSERT SUCCESSFUL.');

      // 4. Call checkSession to immediately reflect the profile change for organizers
      console.log('[AuthProvider] createOrganizerProfile: Calling checkSession to refresh state...');
      await checkSession();
      console.log('[AuthProvider] createOrganizerProfile: checkSession finished.');
      return { success: true };

    } catch (error: any) {
      console.error('[AuthProvider] createOrganizerProfile: UNEXPECTED error:', error);
      return { error };
    }
  };


  // Log in existing user
  const login = async (credentials: LoginCredentials) => {
    console.log(`[AuthProvider] login: Attempting for type: ${credentials.userType}, Email: ${credentials.email}`);
    try {
        const { email, password, userType } = credentials;
        if (!email || !password || !userType) {
             console.error('[AuthProvider] login: Missing required fields.');
            return { error: new Error('Missing required login information.') };
        }

        console.log('[AuthProvider] login: Calling supabase.auth.signInWithPassword...');
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });

        if (loginError) {
            console.error('[AuthProvider] login: Supabase signIn Error:', loginError);
            return { error: { message: 'Invalid email or password.' } };
        }
        if (!loginData?.user) {
            console.error('[AuthProvider] login: Login successful but no user data returned.');
            return { error: new Error('Login failed: No user data received.') };
        }
        const userId = loginData.user.id;
        console.log('[AuthProvider] login: Supabase signIn successful for user:', userId);

        console.log('[AuthProvider] login: Verifying user type from DB...');
        const { data: userTypeData, error: userTypeError } = await supabase
            .from('user_types').select('type').eq('user_id', userId).single();

        if (userTypeError) {
            console.error('[AuthProvider] login: Error fetching user type post-login:', userTypeError);
            await supabase.auth.signOut().catch(e => console.warn("[AuthProvider] login: Sign out failed after fetch type error", e));
            return { error: { message: 'Could not verify account type after login. Please try again.' } };
        }
        if (!userTypeData || userTypeData.type !== userType) {
            console.warn(`[AuthProvider] login: Type mismatch! Login attempted as '${userType}', but DB has '${userTypeData?.type}'. Signing out.`);
            await supabase.auth.signOut().catch(e => console.warn("[AuthProvider] login: Sign out failed due to user type mismatch", e));
            return { error: { message: 'Invalid email or password, or incorrect login portal used.' } };
        }
        console.log('[AuthProvider] login: User type verified:', userTypeData.type);

        setIsOrganizerMode(userType === 'organizer'); // Set mode immediately

        console.log('[AuthProvider] login: Calling checkSession after successful login and type verification...');
        if (!loading) setLoading(true);
        await checkSession(); // Trigger session refresh with profile data
        console.log('[AuthProvider] login: checkSession completed after login.');
        return { user: loginData.user };

    } catch (error: any) {
        console.error('[AuthProvider] login: UNEXPECTED error:', error);
        return { error };
    }
  };

  // Log out the current user
  const logout = async () => {
    console.log('[AuthProvider] logout: Called');
    try {
        const { error } = await supabase.auth.signOut();
        if (error) console.error("[AuthProvider] logout: Supabase signOut Error:", error);
        else console.log("[AuthProvider] logout: Supabase signOut successful.");
    } catch (e) {
        console.error("[AuthProvider] logout: UNEXPECTED error during signOut call:", e);
    } finally {
        console.log("[AuthProvider] logout: Clearing local session state.");
        setSession(null);
        setIsOrganizerMode(false);
        setLoading(false);
    }
  };

  // Update Premium Status Function
  const updatePremiumStatus = async (userId: string, isPremium: boolean): Promise<{ error: any } | { success: boolean }> => {
      console.log(`[AuthProvider] updatePremiumStatus: Called for user ${userId}, setting isPremium to ${isPremium}`);
      if (!userId) {
          console.error(`[AuthProvider] updatePremiumStatus: Invalid userId provided.`);
          return { error: { message: 'Invalid user ID for status update.'} };
      }
      try {
          console.log(`[AuthProvider] updatePremiumStatus: Attempting DB update for user ${userId}...`);
          // Use update with select to check if row was affected
          const { data, error } = await supabase
              .from('music_lover_profiles')
              .update({ is_premium: isPremium })
              .eq('user_id', userId)
              .select('id') // Select minimal data to confirm update
              .maybeSingle(); // Use maybeSingle to handle case where profile might not exist yet (shouldn't happen ideally)

          if (error) {
              console.error(`[AuthProvider] updatePremiumStatus: DB update FAILED for user ${userId}:`, error);
              if (error.message?.includes('policy') || error.message?.includes('permission')) {
                   console.error(`[AuthProvider] updatePremiumStatus: HINT: Possible RLS policy issue on table 'music_lover_profiles'. Check UPDATE policies.`);
              }
              // Return error, but DO NOT call checkSession here
              return { error };
          }

          if (!data) {
              // This case should ideally not happen if createMusicLoverProfile succeeded before this call
              console.warn(`[AuthProvider] updatePremiumStatus: Update command succeeded but no matching row found for user_id ${userId}. Profile might not exist yet.`);
              // Depending on requirements, maybe return an error? For now, proceed to checkSession.
              // return { error: { message: 'Profile not found during status update.' } };
          } else {
             console.log(`[AuthProvider] updatePremiumStatus: Successfully updated is_premium to ${isPremium} for user ${userId} in DB.`);
          }

          // --- CRUCIAL: Refresh session data AFTER successful DB update ---
          console.log('[AuthProvider] updatePremiumStatus: Calling checkSession to refresh state...');
          if (!loading) setLoading(true); // Ensure loading is true for checkSession
          await checkSession(); // This triggers the state update and potential navigation
          console.log('[AuthProvider] updatePremiumStatus: checkSession finished.');

          return { success: true }; // Return success after checkSession is initiated

      } catch (err: any) {
          console.error(`[AuthProvider] updatePremiumStatus: UNEXPECTED error for user ${userId}:`, err);
          return { error: err };
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

// Custom hook for using auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};