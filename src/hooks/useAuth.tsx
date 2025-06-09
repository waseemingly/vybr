import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import { NavigationContainerRef } from '@react-navigation/native';
// Adjust path as necessary
import { 
    supabase, 
    UserTypes, 
    SignUpCredentials, 
    LoginCredentials, 
    UserSession, 
    MusicLoverProfile,
    OrganizerProfile,
    MusicLoverBio as SupabaseMusicLoverBio,
    CreateMusicLoverProfileData,
    CreateOrganizerProfileData
} from '../lib/supabase';
import { useOrganizerMode } from './useOrganizerMode'; // Ensure path is correct
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants'; // For fallback Supabase URL
// *** ADD expo-file-system ***
import * as FileSystem from 'expo-file-system';
// Import permission function from expo-image-picker (needed by context consumer)
import { requestMediaLibraryPermissionsAsync } from 'expo-image-picker';
import { Buffer } from 'buffer'; // Import Buffer for robust Base64 handling

// --- Exported Types ---
export type MusicLoverBio = SupabaseMusicLoverBio;

// The types from supabase.ts are now the single source of truth.
// We just re-export them here if needed by other parts of the app.
export type { MusicLoverProfile, OrganizerProfile, CreateMusicLoverProfileData, CreateOrganizerProfileData };

// --- End Exported Types ---

// --- Context Definition ---
const AuthContext = createContext<{
    session: UserSession | null;
    loading: boolean;
    musicLoverProfile: MusicLoverProfile | null;
    organizerProfile: OrganizerProfile | null;
    signUp: (credentials: SignUpCredentials) => Promise<{ error: any } | { user: any }>;
    login: (credentials: LoginCredentials) => Promise<{ error: any } | { user: any }>;
    logout: () => Promise<void>;
    checkSession: (options?: { navigateToProfile?: boolean }) => Promise<void>;
    refreshSessionData: () => Promise<void>;
    refreshUserProfile: () => Promise<void>;
    createMusicLoverProfile: (profileData: CreateMusicLoverProfileData) => Promise<{ error: any } | { success: boolean; profilePictureUrl?: string | null }>;
    createOrganizerProfile: (profileData: CreateOrganizerProfileData) => Promise<{ error: any } | { success: boolean; logoUrl?: string | null }>;
    updatePremiumStatus: (userId: string, isPremium: boolean) => Promise<{ error: any } | { success: boolean }>;
    requestMediaLibraryPermissions: () => Promise<boolean>;
    checkUsernameExists: (username: string) => Promise<{ exists: boolean, error?: string }>;
    checkEmailExists: (email: string) => Promise<{ exists: boolean, error?: string }>; // For Music Lovers
    checkOrganizerEmailExists: (email: string) => Promise<{ exists: boolean, error?: string }>; // For Organizers
}>({
    session: null,
    loading: true,
    musicLoverProfile: null,
    organizerProfile: null,
    signUp: async () => ({ error: 'Not implemented' }),
    login: async () => ({ error: 'Not implemented' }),
    logout: async () => { },
    checkSession: async () => { },
    refreshSessionData: async () => { },
    refreshUserProfile: async () => { },
    createMusicLoverProfile: async () => ({ error: 'Not implemented' }),
    createOrganizerProfile: async () => ({ error: 'Not implemented' }),
    updatePremiumStatus: async () => ({ error: 'Not implemented' }),
    requestMediaLibraryPermissions: async () => false,
    checkUsernameExists: async () => ({ exists: false, error: 'Not implemented' }),
    checkEmailExists: async () => ({ exists: false, error: 'Not implemented' }),
    checkOrganizerEmailExists: async () => ({ exists: false, error: 'Not implemented' }),
});

// --- Provider Component ---
interface AuthProviderProps {
    children: React.ReactNode;
    navigationRef: React.RefObject<NavigationContainerRef<any>>; // Use correct ref type
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, navigationRef }) => {
    const [session, setSession] = useState<UserSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [musicLoverProfile, setMusicLoverProfile] = useState<MusicLoverProfile | null>(null);
    const [organizerProfile, setOrganizerProfile] = useState<OrganizerProfile | null>(null);
    const { isOrganizerMode, setIsOrganizerMode } = useOrganizerMode();
    const previousSessionRef = useRef<UserSession | null>(null);

    useEffect(() => {
        previousSessionRef.current = session;
    }, [session]);

    // --- Permissions Function (Exposed via context) ---
    const requestMediaLibraryPermissions = async (): Promise<boolean> => {
        if (Platform.OS !== 'web') {
            try {
                const { status } = await requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission Required', 'Vybr needs access to your photos to upload a profile picture.');
                    console.warn("[AuthProvider] Media library permission denied.");
                    return false;
                }
                console.log("[AuthProvider] Media library permission granted.");
                return true;
            } catch (e) {
                console.error("[AuthProvider] Error requesting media library permissions:", e)
                Alert.alert('Permission Error', 'Could not request photo permissions.');
                return false;
            }
        }
        console.log("[AuthProvider] Media library permissions not applicable on web or already assumed.");
        return true; // Assume granted or not needed on web
    };

    // --- Base64 to ArrayBuffer Helper using Buffer ---
    const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
        try {
            const buf = Buffer.from(base64, 'base64');
            // Create ArrayBuffer from Buffer's underlying ArrayBuffer
            return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        } catch (error) {
            console.error("Error in base64ToArrayBuffer:", error);
            throw new Error("Failed to decode base64 string."); // Re-throw
        }
    };


    // --- Image Upload Helper (REVISED with expo-file-system) ---
    const _uploadImage = async (
        userId: string,
        fileUri: string,
        bucket: 'profile-pictures' | 'logos',
        providedMimeType?: string | null // <<< Pass mimeType from picker result
    ): Promise<string | null> => {
        if (!userId || !fileUri) {
            console.error('[AuthProvider] _uploadImage: Invalid userId or fileUri provided.');
            return null;
        }
        const isNative = Platform.OS !== 'web' && (fileUri.startsWith('file:') || fileUri.startsWith('content:') || fileUri.startsWith('ph:'));
        const logPrefix = `[AuthProvider][${isNative ? 'Native' : 'Web'}] _uploadImage:`;

        try {
            console.log(`${logPrefix} Uploading for user ${userId}. Bucket: ${bucket}. URI: ${fileUri.substring(0, 100)}... MimeType Hint: ${providedMimeType || 'none'}`);

            // --- Determine File Extension (Best Effort) ---
            let fileExt = fileUri.split('.').pop()?.toLowerCase().split('?')[0]; // Handle query params
            if (fileExt && (fileExt.length > 5 || !/^[a-z0-9]+$/.test(fileExt))) fileExt = undefined; // Likely not a real extension
            if (!fileExt && providedMimeType?.startsWith('image/')) {
                fileExt = providedMimeType.split('/')[1]?.split('+')[0]; // Get ext from mime type (e.g., image/jpeg -> jpeg), handle image/svg+xml
                console.log(`${logPrefix} Using extension '${fileExt}' from provided mimeType.`);
            }
            if (!fileExt || !['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'svg'].includes(fileExt)) { // Added common types
                console.warn(`${logPrefix} Could not determine reliable extension ('${fileExt}'). Defaulting to 'jpg'.`);
                fileExt = 'jpg';
            }
            if (fileExt === 'jpg') fileExt = 'jpeg'; // Normalize

            const fileName = `${userId}-${Date.now()}.${fileExt}`;
            const filePath = `${userId}/${fileName}`;
            console.log(`${logPrefix} Determined filePath: ${filePath}`);

            // --- Get File Data (Native vs Web) ---
            let fileData: ArrayBuffer;
            let detectedMimeType: string | undefined | null = providedMimeType; // Start with hint

            if (isNative) {
                console.log(`${logPrefix} Using FileSystem.readAsStringAsync for native URI.`);
                let fileSize = 0;
                try {
                    const fileInfo = await FileSystem.getInfoAsync(fileUri, { size: true });
                    if (!fileInfo.exists) throw new Error(`File not found at URI: ${fileUri}`);
                    fileSize = fileInfo.size;
                    console.log(`${logPrefix} FileSystem.getInfoAsync: Exists=true, Size=${fileSize}`);
                    if (fileSize === 0) {
                       console.warn(`${logPrefix} File exists but FileSystem reports size 0. Will attempt to read anyway.`);
                       // Don't throw error here yet, reading might still yield data
                    }
                } catch (infoError: any) {
                    console.error(`${logPrefix} FileSystem.getInfoAsync failed: ${infoError.message}. Proceeding cautiously.`);
                }

                const base64 = await FileSystem.readAsStringAsync(fileUri, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                if (!base64 || base64.length < 10) {
                    throw new Error(`FileSystem.readAsStringAsync returned empty or invalid base64 (length: ${base64?.length})`);
                }
                console.log(`${logPrefix} Read file as Base64 successfully (Base64 length: ${base64.length}). Estimated original size: ${fileSize > 0 ? fileSize : 'unknown'}`);

                console.log(`${logPrefix} Converting Base64 to ArrayBuffer...`);
                fileData = base64ToArrayBuffer(base64);
                console.log(`${logPrefix} Converted to ArrayBuffer (byteLength: ${fileData.byteLength})`);

                if (fileData.byteLength === 0) {
                    throw new Error('Converted ArrayBuffer has size 0.');
                }
                // Optional size validation (less critical now)
                // if (fileSize > 0 && Math.abs(fileData.byteLength - fileSize) > fileSize * 0.1) { ... }

            } else {
                // Web: Use fetch API
                console.log(`${logPrefix} Using fetch API for web URI.`);
                const response = await fetch(fileUri);
                if (!response.ok) throw new Error(`Failed to fetch web URI: ${response.status}`);
                detectedMimeType = response.headers.get('content-type') || providedMimeType;
                console.log(`${logPrefix} Fetch response OK. Reading as ArrayBuffer...`);
                fileData = await response.arrayBuffer();
                console.log(`${logPrefix} Read web file as ArrayBuffer (byteLength: ${fileData.byteLength})`);
                if (fileData.byteLength === 0) {
                    throw new Error('Fetched ArrayBuffer has size 0.');
                }
            }

            // --- Determine Final Content-Type ---
            let finalContentType = detectedMimeType;
            if (!finalContentType || !finalContentType.startsWith('image/')) { // Be stricter for images
                 console.warn(`${logPrefix} MimeType '${finalContentType || 'none'}' is invalid/missing/not image. Falling back to extension guess: image/${fileExt}`);
                 finalContentType = `image/${fileExt}`;
            }
             // Special case for SVG if needed
            if (fileExt === 'svg' && finalContentType !== 'image/svg+xml') {
                 console.log(`${logPrefix} Setting content type to image/svg+xml for .svg extension.`);
                 finalContentType = 'image/svg+xml';
            }
            console.log(`${logPrefix} Final ContentType for upload: ${finalContentType}.`);


            // --- Upload ArrayBuffer to Supabase ---
            console.log(`${logPrefix} Uploading ArrayBuffer to Supabase bucket "${bucket}" at path "${filePath}"`);
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(filePath, fileData, { // <<< Pass ArrayBuffer
                    cacheControl: '3600',
                    upsert: false,
                    contentType: finalContentType // <<< Pass determined Content-Type
                });

            if (uploadError) {
                console.error(`${logPrefix} Supabase upload error:`, JSON.stringify(uploadError, null, 2));
                if (uploadError.message?.includes('policy') || uploadError.message?.includes('403')) { 
                    console.error(`--->>> [AuthProvider] RLS CHECK: Failed to upload to bucket '${bucket}'. Verify INSERT RLS policy for authenticated users. Policy should likely check \`(storage.foldername(name))[1] = auth.uid()::text\` <<<---`);
                } else if (uploadError.message?.includes('Bucket not found')) {
                    console.error(`--->>> [AuthProvider] BUCKET CHECK: Bucket named '${bucket}' not found in Supabase Storage. <<<---`);
                }
                throw new Error(`Supabase storage upload failed: ${uploadError.message || 'Unknown upload error'}`);
            }
            if (!uploadData?.path) throw new Error('Supabase storage upload succeeded but returned no path.');

            const uploadedPath = uploadData.path;
            console.log(`${logPrefix} Image uploaded successfully, path:`, uploadedPath);

            // --- Get Public URL ---
            const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(uploadedPath);
            let publicUrl: string | null = null;
            if (urlData?.publicUrl) {
                 publicUrl = urlData.publicUrl;
                 console.log(`${logPrefix} Public URL obtained via API: ${publicUrl}`);
            } else {
                 console.warn(`${logPrefix} Could not get public URL via API immediately. Constructing fallback.`);
                 const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl;
                 if (!supabaseUrl) {
                     console.error(`${logPrefix} CRITICAL - Cannot construct fallback URL. EXPO_PUBLIC_SUPABASE_URL or Constants...supabaseUrl is missing!`);
                 } else {
                     publicUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${uploadedPath}`;
                     console.log(`${logPrefix} Using manually constructed URL: ${publicUrl}`);
                 }
            }
            return publicUrl;

        } catch (error: any) {
            console.error(`${logPrefix} Error during upload process for user ${userId}. Bucket: ${bucket}. URI: ${fileUri.substring(0, 100)}... Error:`, error.message || error, error.stack);
            if (error.message?.includes('Failed to fetch') || error.message?.includes('Network request failed')) console.error(`${logPrefix} HINT - Check network connection and if the file URI '${fileUri.substring(0, 100)}...' is correct and accessible by the app.`);
            if (error.message?.includes('File not found at URI')) console.error(`${logPrefix} HINT - The file URI provided by the picker might be invalid or temporary and no longer accessible.`);
            if (error.message?.includes('size 0')) console.error(`${logPrefix} HINT - The file selected appears to be empty.`);
            Alert.alert("Upload Failed", `Could not upload image. Please try again or select a different image. ${error.message?.substring(0, 100)}`);
            return null;
        }
    };


    // --- Check Session & Fetch Profile --- 
    const checkSession = useCallback(async (options?: { navigateToProfile?: boolean }) => {
        console.log("[AuthProvider] checkSession called");
        setLoading(true);
        setMusicLoverProfile(null); // Clear profiles initially
        setOrganizerProfile(null);
        let currentSession: UserSession | null = null;
        let userType: UserTypes | null = null; // Define userType in broader scope

        try {
            const { data: { session: supabaseSession }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError) {
                console.error("[AuthProvider] Error getting session:", sessionError);
                throw sessionError;
            }

            if (supabaseSession) {
                console.log("[AuthProvider] Supabase session found, user ID:", supabaseSession.user.id);
                userType = (supabaseSession.user.user_metadata?.user_type as UserTypes) || null;
                // Construct session matching UserSession type correctly
                currentSession = {
                    // Ensure user object matches the type
                    user: {
                         id: supabaseSession.user.id,
                         email: supabaseSession.user.email ?? '' // Provide fallback for email
                    },
                    userType: userType,
                    musicLoverProfile: null, // Initialize as null, fetch below
                    organizerProfile: null, // Initialize as null, fetch below
                    // REMOVED token properties and duplicates
                };

                const userId = supabaseSession.user.id;
                console.log(`[AuthProvider] User type determined: ${userType}`);

                // Fetch the correct profile based on userType
                const _fetchProfileData = async (user: any, userType: UserTypes) => {
                    try {
                        if (userType === 'music_lover') {
                            console.log("[AuthProvider] Fetching music lover profile...");
                            const { data: profileData, error: profileError } = await supabase
                                .from('music_lover_profiles')
                                .select('*')
                                .eq('user_id', userId)
                            .maybeSingle();

                            if (profileError) {
                                console.error("[AuthProvider] Error fetching music lover profile:", profileError);
                                // Don't throw, allow session to proceed but profile will be null
                            } else if (profileData) {
                                console.log("[AuthProvider] Music lover profile fetched successfully:", profileData);
                                // Map DB snake_case to frontend camelCase
                                const fullProfile: MusicLoverProfile = {
                                   id: profileData.id,
                                   userId: profileData.user_id,
                                   firstName: profileData.first_name,
                                   lastName: profileData.last_name,
                                   username: profileData.username,
                                   email: profileData.email,
                                   age: profileData.age,
                                   profilePicture: profileData.profile_picture,
                                   bio: profileData.bio,
                                   country: profileData.country,
                                   city: profileData.city,
                                   isPremium: profileData.is_premium,
                                   musicData: profileData.music_data,
                                   selectedStreamingService: profileData.selected_streaming_service,
                                   termsAccepted: profileData.terms_accepted,
                                   secondary_streaming_services: profileData.secondary_streaming_services ?? null, // <<< MAP THE NEW FIELD
                                   // Map the favorite music fields
                                   favorite_artists: profileData.favorite_artists ?? null,
                                   favorite_albums: profileData.favorite_albums ?? null,
                                   favorite_songs: profileData.favorite_songs ?? null,
                                   // Add stripe_customer_id mapping for payment methods
                                   stripe_customer_id: profileData.stripe_customer_id,
                                };
                                console.log("[AuthProvider] Setting musicLoverProfile state:", fullProfile);
                                setMusicLoverProfile(fullProfile);
                                if (currentSession) currentSession.musicLoverProfile = fullProfile;
                           } else {
                                 console.log("[AuthProvider] No music lover profile found for this user.");
                            }
                        } else if (userType === 'organizer') {
                            console.log("[AuthProvider] Fetching organizer profile...");
                             const { data: profileData, error: profileError } = await supabase
                                .from('organizer_profiles')
                                .select('*')
                                .eq('user_id', userId)
                                .single();

                            if (profileError) {
                                console.error("[AuthProvider] Error fetching organizer profile:", profileError);
                            } else if (profileData) {
                                 console.log("[AuthProvider] Organizer profile fetched successfully.", profileData.id);
                                 const { data: avgRatingData } = await supabase.rpc('get_organizer_average_rating', { p_organizer_id: userId });

                                 const fullProfile: OrganizerProfile = {
                                   ...profileData,
                                   average_rating: avgRatingData,
                                   stripe_connect_account_id: profileData.stripe_connect_account_id,
                                   stripe_customer_id: profileData.stripe_customer_id,
                                 };
                                 setOrganizerProfile(fullProfile);
                                 if (currentSession) currentSession.organizerProfile = fullProfile;
                            } else {
                                console.log("[AuthProvider] No organizer profile found for this user.");
                            }
                        } else {
                            console.warn("[AuthProvider] User type is null or unrecognized, cannot fetch profile.");
                        }

                        // Set organizer mode based on fetched profile
                        if (currentSession?.organizerProfile) { // Guarded access
                            setIsOrganizerMode(true);
                            console.log("[AuthProvider] Setting Organizer Mode ON based on profile.");
                        } else {
                            setIsOrganizerMode(false);
                            console.log("[AuthProvider] Setting Organizer Mode OFF (no organizer profile).");
                        }

                    } catch (e) {
                        console.error("[AuthProvider] Error in checkSession process:", e);
                        setSession(null);
                        setMusicLoverProfile(null);
                        setOrganizerProfile(null);
                        setIsOrganizerMode(false);
                        // Optionally navigate to Auth on error
                        // navigationRef.current?.reset({ index: 0, routes: [{ name: 'Auth' }] });
                    }
                };

                await _fetchProfileData(supabaseSession.user, userType);

            } else {
                console.log("[AuthProvider] No active Supabase session found.");
                 // Ensure mode is off if no session
                setIsOrganizerMode(false);
                setSession(null); // Explicitly set session to null if no supabase session
            }

            setSession(currentSession);

            // --- Navigation logic --- 
            // Check if navigator is ready before attempting reset
            if (navigationRef.current?.isReady()) {
                if (options?.navigateToProfile && currentSession) {
                    const profileComplete = userType === 'music_lover'
                        ? !!currentSession.musicLoverProfile
                        : userType === 'organizer'
                            ? !!currentSession.organizerProfile
                            : false;
                    if (profileComplete) {
                        console.log("[AuthProvider] Navigating to MainApp (profile complete).");
                        navigationRef.current?.reset({ index: 0, routes: [{ name: 'MainApp' }] });
                    } else if (userType) {
                        console.log("[AuthProvider] Navigating to SignUpFlow (profile incomplete).");
                        navigationRef.current?.reset({ index: 0, routes: [{ name: userType === 'music_lover' ? 'MusicLoverSignUpFlow' : 'OrganizerSignUpFlow' }] });
                    } else {
                        console.log("[AuthProvider] Navigating to Auth (session exists, but no valid user type).");
                        navigationRef.current?.reset({ index: 0, routes: [{ name: 'Auth' }] });
                    }
                } else if (!currentSession) {
                    console.log("[AuthProvider] No session, navigating to Auth.");
                    navigationRef.current?.reset({ index: 0, routes: [{ name: 'Auth' }] });
                }
            } else {
                // Log if nav isn't ready, maybe retry later or handle differently
                console.warn("[AuthProvider] Navigation Ref not ready, navigation skipped.");
            }
            // --- End Navigation Logic ---

        } catch (e) {
            console.error("[AuthProvider] Error in checkSession process:", e);
            setSession(null);
            setMusicLoverProfile(null);
            setOrganizerProfile(null);
            setIsOrganizerMode(false);
            // Optionally navigate to Auth on error
            // navigationRef.current?.reset({ index: 0, routes: [{ name: 'Auth' }] });
        } finally {
                setLoading(false);
            console.log("[AuthProvider] checkSession finished.");
        }
    }, [navigationRef, setIsOrganizerMode]); // Added dependencies

    // --- Refresh Session Data --- 
    const refreshSessionData = useCallback(async () => {
        console.log("[AuthProvider] Refreshing session data...");
        await checkSession(); // Re-run the checkSession logic to fetch latest profiles
         console.log("[AuthProvider] Session data refreshed.");
    }, [checkSession]); // Depend on checkSession

    // ---> ADD refreshUserProfile function <---
    const refreshUserProfile = useCallback(async () => {
        console.log("[AuthProvider] Refreshing user profile data...");
        // Re-running checkSession also fetches the profile based on userType
        await checkSession(); 
        console.log("[AuthProvider] User profile data refreshed via checkSession.");
    }, [checkSession]);

    // --- Initial Session Check on Mount ---
    useEffect(() => {
        console.log("[AuthProvider] Initial checkSession on mount.");
             checkSession();
    }, [checkSession]); // Depend on checkSession

    // --- Supabase Auth State Change Listener ---
    useEffect(() => {
        console.log("[AuthProvider] Setting up Supabase auth listener.");
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSupabaseSession) => {
            console.log(`[AuthProvider] onAuthStateChange triggered: Event ${_event}`);
            // Simple comparison: re-fetch profile if user ID changes or logs in/out
            if (newSupabaseSession?.user?.id !== previousSessionRef.current?.user?.id) {
                console.log("[AuthProvider] Auth state change detected (user ID changed or login/logout), running checkSession...");
                 checkSession({ navigateToProfile: _event === 'SIGNED_IN' }); // Navigate on explicit sign-in
            } else if (newSupabaseSession && !previousSessionRef.current) {
                 console.log("[AuthProvider] Auth state change detected (session appeared), running checkSession...");
                 checkSession({ navigateToProfile: true }); // Navigate if session appears from null
            } else if (!newSupabaseSession && previousSessionRef.current) {
                 console.log("[AuthProvider] Auth state change detected (session disappeared), running checkSession...");
                 checkSession(); // Just update state, likely logout handled elsewhere
            } else {
                console.log("[AuthProvider] Auth state change ignored (no significant user change or already handled).");
            }
        });

        return () => {
            console.log("[AuthProvider] Unsubscribing from Supabase auth listener.");
            subscription.unsubscribe();
        };
    }, [checkSession]); // Depend on checkSession

    // --- Sign Up ---
    const signUp = async (credentials: SignUpCredentials): Promise<{ error: any } | { user: any }> => {
        console.log(`[AuthProvider] signUp: Type: ${credentials.userType}, Email: ${credentials.email}`);
        setLoading(true);
        try {
            const { email, password, userType, firstName, lastName, username } = credentials;
            if (!email || !password || !userType) {
                console.error('[AuthProvider] signUp: Missing required fields.');
                return { error: new Error('Missing required fields (email, password, userType).') };
            }

            // First check if this email exists in the specific profile table for this user type
            // (this is a double check, we already do UI validation using our specific email check functions)
            if (userType === 'organizer') {
                console.log('[AuthProvider] signUp: Checking if email exists in organizer_profiles table...');
                const result = await checkOrganizerEmailExists(email);
                if (result.exists) {
                    console.error('[AuthProvider] signUp: Email already exists in organizer_profiles table');
                    return { error: new Error('This email is already registered as an Organizer.') };
                }
            } else if (userType === 'music_lover') {
                console.log('[AuthProvider] signUp: Checking if email exists in music_lover_profiles table...');
                const result = await checkEmailExists(email);
                if (result.exists) {
                    console.error('[AuthProvider] signUp: Email already exists in music_lover_profiles table');
                    return { error: new Error('This email is already registered as a Music Lover.') };
                }
            }

            console.log('[AuthProvider] signUp: Calling Supabase auth.signUp...');
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email, password, options: { data: { user_type: userType, /* optional: first_name, last_name */ } }
            });
            
            if (authError || !authData?.user) {
                console.error('[AuthProvider] signUp: Supabase Auth Error:', JSON.stringify(authError, null, 2) || 'No user data returned');
                
                // Customize the error based on its type
                if (authError?.message.includes('User already registered')) {
                    console.error('[AuthProvider] signUp: Email already registered in Supabase auth');
                    
                    // Try to get more information about the existing user type
                    try {
                        // Check if a user exists with this email in the opposite profile table
                        const oppositeUserType = userType === 'organizer' ? 'music_lover' : 'organizer';
                        const profileTable = oppositeUserType === 'organizer' ? 'organizer_profiles' : 'music_lover_profiles';
                        
                        console.log(`[AuthProvider] signUp: Checking if email exists in ${profileTable} table...`);
                        const { count } = await supabase
                            .from(profileTable)
                            .select('*', { count: 'exact', head: true })
                            .eq('email', email);
                        
                        if (count && count > 0) {
                            const friendlyType = oppositeUserType === 'organizer' ? 'an Organizer' : 'a Music Lover';
                            return { error: new Error(`This email is already registered as ${friendlyType}. Please use a different email or login via the ${friendlyType} portal.`) };
                        }
                    } catch (e) {
                        console.error('[AuthProvider] signUp: Error checking opposite profile table:', e);
                    }
                    
                    // Default message if we couldn't determine more details
                    return { error: new Error('Email already in use. Please try logging in or use a different email.') };
                }
                
                if (authError?.message.includes('Password should be')) {
                    return { error: new Error('Password is too weak. Please use a stronger one.') };
                }
                
                return { error: authError || new Error('Sign up failed. Please try again.') };
            }
            
            const userId = authData.user.id;
            console.log('[AuthProvider] signUp: Auth user created:', userId);

            console.log('[AuthProvider] signUp: Upserting user type in DB...');
            const { error: upsertTypeError } = await supabase
                .from('user_types').upsert({ user_id: userId, type: userType }, { onConflict: 'user_id' });
            if (upsertTypeError) {
                console.error('[AuthProvider] signUp: DB type upsert failed:', upsertTypeError);
                console.warn(`[AuthProvider] signUp: User ${userId} created, but failed DB user_type upsert. Relying on metadata.`);
            } else {
                console.log('[AuthProvider] signUp: DB user type upserted successfully.');
            }

            console.log('[AuthProvider] signUp: Success for user:', userId, 'Returning user object.');
            // Listener will handle state update via SIGNED_IN -> checkSession
            return { user: authData.user };

        } catch (error: any) {
            console.error('[AuthProvider] signUp: UNEXPECTED error:', error);
            return { error };
        } finally {
            setLoading(false);
        }
    };

    // --- Create Music Lover Profile ---
    const createMusicLoverProfile = async (profileData: CreateMusicLoverProfileData): Promise<{ error: any } | { success: boolean; profilePictureUrl?: string | null }> => {
        console.log(`[AuthProvider] createMusicLoverProfile: START user: ${profileData.userId}, Username: ${profileData.username}, Service: ${profileData.selectedStreamingService}`);
        setLoading(true);
        let publicImageUrl: string | null = null;

        try {
            // --- Basic Validation ---
            if (!profileData.userId || !profileData.firstName || !profileData.lastName || !profileData.username || !profileData.email || profileData.termsAccepted === undefined || !profileData.selectedStreamingService) {
                console.error("[AuthProvider] createMusicLoverProfile: Missing required profile data.", profileData);
                return { error: new Error("Missing required profile information (name, username, email, terms, streaming service).") };
            }
            if (/\s/.test(profileData.username)) {
                return { error: new Error("Username cannot contain spaces.") };
            }

            // --- Handle Image Upload ---
            if (profileData.profilePictureUri) {
                console.log('[AuthProvider] createMusicLoverProfile: Uploading profile picture...');
                publicImageUrl = await _uploadImage(
                    profileData.userId,
                    profileData.profilePictureUri,
                    'profile-pictures',
                    profileData.profilePictureMimeType // Pass the hint
                );

                if (publicImageUrl === null) {
                    console.error('[AuthProvider] createMusicLoverProfile: Pic upload FAILED. Proceeding without saving URL.');
                } else {
                    console.log('[AuthProvider] createMusicLoverProfile: Pic uploaded successfully, URL:', publicImageUrl);
                }
            } else {
                console.log('[AuthProvider] createMusicLoverProfile: No profile picture provided.');
            }

            // --- Prepare DB Data (Match DB Columns) ---
            const { userId, profilePictureUri, profilePictureMimeType, termsAccepted, bio, country, city, age, selectedStreamingService, ...basicProfileData } = profileData;
            const profileToInsert = {
                user_id: userId,
                first_name: basicProfileData.firstName,
                last_name: basicProfileData.lastName,
                username: basicProfileData.username,
                email: basicProfileData.email,
                age: age === null ? undefined : age, // Convert null to undefined for DB
                profile_picture: publicImageUrl ?? undefined, // Use DB name (snake_case), handle null
                bio: bio,
                country: country === null ? undefined : country, // Convert null to undefined
                city: city === null ? undefined : city, // Convert null to undefined
                terms_accepted: termsAccepted,
                selected_streaming_service: selectedStreamingService === null ? undefined : selectedStreamingService, // Convert null to undefined
                is_premium: false,
                 // Ensure all REQUIRED DB fields are present or have defaults
                // music_data: {} // Example default if required and not nullable
            };
            console.log('[AuthProvider] createMusicLoverProfile: Preparing to upsert profile data:', { ...profileToInsert, profile_picture: profileToInsert.profile_picture ? 'URL exists' : 'null' });

            // --- Upsert Profile in DB ---
            const { data: upsertData, error: upsertError } = await supabase
                .from('music_lover_profiles') // *** CHECK TABLE NAME ***
                .upsert(profileToInsert, { onConflict: 'user_id' })
                .select('id')
                .single();

            if (upsertError) {
                console.error('[AuthProvider] createMusicLoverProfile: Upsert FAILED:', JSON.stringify(upsertError, null, 2));
                if (upsertError.code === '23505' && upsertError.message.includes('username')) return { error: new Error('This username is already taken.') };
                if (upsertError.code === '23505' && upsertError.message.includes('user_id')) {
                    console.warn('[AuthProvider] createMusicLoverProfile: Profile already existed (user_id conflict), was updated.');
                } else {
                    return { error: new Error(`Failed to save profile details: ${upsertError.message}`) };
                }
            }
            console.log('[AuthProvider] createMusicLoverProfile: Upsert SUCCESS.', upsertData);

            // Success! Return success flag and the image URL (if any).
            // The subsequent call to updatePremiumStatus will trigger checkSession and handle navigation.
            await checkSession();
            return { success: true, profilePictureUrl: publicImageUrl };

        } catch (error: any) {
            console.error('[AuthProvider] createMusicLoverProfile: UNEXPECTED error:', error);
            return { error: new Error('An unexpected error occurred while saving your profile.') };
        } finally {
            setLoading(false);
        }
    };

    // --- Create Organizer Profile ---
    const createOrganizerProfile = async (profileData: CreateOrganizerProfileData): Promise<{ error: any } | { success: boolean; logoUrl?: string | null }> => {
        console.log('[AuthProvider] createOrganizerProfile: START user:', profileData.userId);
        setLoading(true);
        let publicLogoUrl: string | null = null;

        try {
            // --- Validation ---
            if (!profileData.userId || !profileData.companyName || !profileData.email) {
                console.error("[AuthProvider] createOrganizerProfile: Missing required profile data.");
                return { error: new Error("Missing required profile information (company name, email).") };
            }

            // --- Logo Upload ---
            if (profileData.logoUri) {
                console.log('[AuthProvider] createOrganizerProfile: Uploading logo...');
                publicLogoUrl = await _uploadImage(
                    profileData.userId,
                    profileData.logoUri,
                    'logos',
                    profileData.logoMimeType // Pass hint
                );
                if (publicLogoUrl === null) {
                    console.error('[AuthProvider] createOrganizerProfile: Logo upload FAILED. Proceeding without saving URL.');
                } else {
                    console.log('[AuthProvider] createOrganizerProfile: Logo uploaded successfully.');
                }
            } else {
                console.log('[AuthProvider] createOrganizerProfile: No logo provided.');
            }

            // --- Prepare DB Data (Match DB Columns for organizer_profiles table) ---
            const { userId, logoUri, logoMimeType, ...basicOrgData } = profileData;
            const profileToInsert = {
                user_id: userId,
                company_name: basicOrgData.companyName,
                email: basicOrgData.email,
                // Convert null or empty string to undefined for optional fields
                phone_number: basicOrgData.phoneNumber === null || basicOrgData.phoneNumber === '' ? undefined : basicOrgData.phoneNumber,
                // business_type is a specific enum or null, only check for null
                business_type: basicOrgData.businessType === null ? undefined : basicOrgData.businessType,
                bio: basicOrgData.bio === null || basicOrgData.bio === '' ? undefined : basicOrgData.bio,
                website: basicOrgData.website === null || basicOrgData.website === '' ? undefined : basicOrgData.website,
                logo: publicLogoUrl ?? undefined,
                 // Ensure all REQUIRED DB fields are present or have defaults
            };
            console.log('[AuthProvider] createOrganizerProfile: Preparing to upsert profile data:', { ...profileToInsert, logo: profileToInsert.logo ? 'URL exists' : 'null' });

            // --- Upsert Profile in DB ---
            const { data: upsertData, error: upsertError } = await supabase
                .from('organizer_profiles') // *** CHECK TABLE NAME ***
                .upsert(profileToInsert, { onConflict: 'user_id' })
                .select('id')
                .single();

            if (upsertError) {
                console.error('[AuthProvider] createOrganizerProfile: Upsert FAILED:', JSON.stringify(upsertError, null, 2));
                return { error: new Error(`Failed to save organizer profile: ${upsertError.message}`) };
            }
            console.log('[AuthProvider] createOrganizerProfile: Upsert SUCCESS.', upsertData);

            // --- Refresh Session & Trigger Navigation ---
            console.log('[AuthProvider] createOrganizerProfile: Calling checkSession with navigate=true...');
            await checkSession({ navigateToProfile: true });

            return { success: true, logoUrl: publicLogoUrl };

        } catch (error: any) {
            console.error('[AuthProvider] createOrganizerProfile: UNEXPECTED error:', error);
            return { error: new Error('An unexpected error occurred saving the organizer profile.') };
        } finally {
            setLoading(false);
        }
    };

    // --- Update Premium Status ---
    const updatePremiumStatus = async (userId: string, isPremium: boolean): Promise<{ error: any } | { success: boolean }> => {
        console.log(`[AuthProvider] updatePremiumStatus: Setting premium=${isPremium} for user ${userId}`);
        setLoading(true);
        try {
            console.log(`[AuthPremium] Updating 'is_premium' flag in music_lover_profiles for ${userId}...`);
            const { error: updateError } = await supabase
                .from('music_lover_profiles') // *** CHECK TABLE NAME ***
                .update({ is_premium: isPremium, updated_at: new Date().toISOString() })
                .eq('user_id', userId); // Use user_id

            if (updateError) {
                console.error(`[AuthPremium] Failed to update is_premium flag for ${userId}:`, updateError);
                return { error: new Error(`Failed to update account status: ${updateError.message}`) };
            }
            console.log(`[AuthPremium] is_premium flag updated successfully for ${userId}.`);

            // --- Handle Subscription/Payment Records (Optional) ---
            // Add logic here if needed for subscriptions/payments tables

            // --- Refresh session AND NAVIGATE ---
            console.log(`[AuthProvider] updatePremiumStatus: Calling checkSession with navigate=true after status update for ${userId}...`);
            await checkSession({ navigateToProfile: true });

            return { success: true };
        } catch (error: any) {
            console.error('[AuthProvider] updatePremiumStatus: UNEXPECTED error:', error);
            return { error: new Error('An unexpected error occurred while updating premium status.') };
        } finally {
            setLoading(false);
        }
    };

    // --- Login ---
    const login = async (credentials: LoginCredentials): Promise<{ error: any } | { user: any }> => {
        console.log(`[AuthProvider] login: Starting login process`);
        console.log(`[AuthProvider] login: Credentials received - Type: ${credentials.userType}, Email: ${credentials.email}, Username: ${credentials.username}`);
        
        try {
            const { email, username, password, userType } = credentials;
            
            // Validate required fields
            if ((!email && !username) || !password || !userType) {
                console.error('[AuthProvider] login: Missing required fields.');
                return { error: new Error('Please enter email/username, password, and select account type.') };
            }

            // First try to authenticate with the provided input as email
            const loginInput = email || username;
            if (!loginInput) {
                console.error('[AuthProvider] login: No login input provided');
                return { error: new Error('Please enter email/username and password.') };
            }

            // Try to authenticate with the input as email first
            console.log('[AuthProvider] login: First attempt - trying input as email:', loginInput);
            const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                email: loginInput,
                password
            });

            // If email authentication fails, try username lookup
            if (loginError) {
                console.log('[AuthProvider] login: Email authentication failed, trying username lookup for:', loginInput);
                const { data: profileData, error: profileError } = await supabase
                    .from('music_lover_profiles')
                    .select('email, user_id')
                    .eq('username', loginInput)
                    .single();

                if (profileError || !profileData?.email) {
                    console.error('[AuthProvider] login: Username lookup failed:', profileError);
                    return { error: { message: 'Invalid email/username or password.' } };
                }

                const loginEmail = profileData.email;
                console.log('[AuthProvider] login: Found email for username:', loginEmail);

                // Try authentication again with the looked-up email
                const { data: retryLoginData, error: retryLoginError } = await supabase.auth.signInWithPassword({
                    email: loginEmail,
                    password
                });

                if (retryLoginError) {
                    console.error("[AuthProvider] login: Supabase signIn Error after username lookup:", retryLoginError);
                    return { error: { message: 'Invalid email/username or password.' } };
                }

                if (!retryLoginData?.user) {
                    console.error('[AuthProvider] login: Login successful but no user data returned.');
                    return { error: new Error('Login failed: Could not retrieve user data.') };
                }

                console.log('[AuthProvider] login: Successfully authenticated user via username:', retryLoginData.user.id);
                const userId = retryLoginData.user.id;

                // --- Verify User Type from DB --- 
                console.log('[AuthProvider] login: Verifying user type from DB...');
                const { data: typeData, error: typeError } = await supabase
                    .from('user_types') 
                    .select('type')
                    .eq('user_id', userId)
                    .single();

                if (typeError || !typeData) {
                    console.error(`[AuthProvider] login: Failed to verify DB user type for ${userId}:`, typeError || 'No type data found');
                    await logout();
                    setLoading(false);
                    return { error: { message: 'Login failed: Could not verify account type. Please contact support.' } };
                }

                const dbUserType = typeData.type as UserTypes;
                console.log(`[AuthProvider] login: DB user type confirmed as: ${dbUserType}`);

                if (dbUserType !== userType) {
                    console.warn(`[AuthProvider] login: TYPE MISMATCH! User ${userId} tried logging in via ${userType} portal, but DB type is ${dbUserType}.`);
                    await logout();
                    setLoading(false);
                    return { error: { message: `Incorrect login portal. This account is registered as a ${dbUserType === 'music_lover' ? 'Music Lover' : 'Organizer'}. Please use the correct login page.` } };
                }

                console.log('[AuthProvider] login: User type verified. Calling checkSession...');
                setIsOrganizerMode(dbUserType === 'organizer');
                await checkSession({ navigateToProfile: true });
                return { user: retryLoginData.user };
            }

            // If we get here, the first email authentication attempt was successful
            if (!loginData?.user) {
                console.error('[AuthProvider] login: Login successful but no user data returned.');
                return { error: new Error('Login failed: Could not retrieve user data.') };
            }

            console.log('[AuthProvider] login: Successfully authenticated user via email:', loginData.user.id);
            const userId = loginData.user.id;

            // --- Verify User Type from DB --- 
            console.log('[AuthProvider] login: Verifying user type from DB...');
            const { data: typeData, error: typeError } = await supabase
                .from('user_types') 
                .select('type')
                .eq('user_id', userId)
                .single();

            if (typeError || !typeData) {
                console.error(`[AuthProvider] login: Failed to verify DB user type for ${userId}:`, typeError || 'No type data found');
                await logout();
                setLoading(false);
                return { error: { message: 'Login failed: Could not verify account type. Please contact support.' } };
            }

            const dbUserType = typeData.type as UserTypes;
            console.log(`[AuthProvider] login: DB user type confirmed as: ${dbUserType}`);

            if (dbUserType !== userType) {
                console.warn(`[AuthProvider] login: TYPE MISMATCH! User ${userId} tried logging in via ${userType} portal, but DB type is ${dbUserType}.`);
                await logout();
                setLoading(false);
                return { error: { message: `Incorrect login portal. This account is registered as a ${dbUserType === 'music_lover' ? 'Music Lover' : 'Organizer'}. Please use the correct login page.` } };
            }

            console.log('[AuthProvider] login: User type verified. Calling checkSession...');
            setIsOrganizerMode(dbUserType === 'organizer');
            await checkSession({ navigateToProfile: true });
            return { user: loginData.user };

        } catch (error: any) {
            console.error('[AuthProvider] login: UNEXPECTED error:', error);
            setLoading(false);
            return { error: new Error('An unexpected error occurred during login.') };
        }
    };

    // --- Logout ---
    const logout = async () => {
        console.log('[AuthProvider] logout: Initiating logout...');
        setLoading(true);
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error("[AuthProvider] logout: Supabase signOut Error:", error);
            } else {
                console.log("[AuthProvider] logout: Supabase signOut successful.");
            }
        } catch (e) {
            console.error("[AuthProvider] logout: UNEXPECTED error during Supabase signOut call:", e);
        } finally {
            console.log("[AuthProvider] logout: Clearing local session state and resetting mode.");
            setSession(null);
            setMusicLoverProfile(null);
            setOrganizerProfile(null);
            setIsOrganizerMode(false);
            setLoading(false);
        }
    };

    const checkUsernameExists = async (username: string): Promise<{ exists: boolean, error?: string }> => {
        console.log(`[AuthProvider] checkUsernameExists: Checking username "${username}"`);
        if (!username || username.trim().length < 3) {
            // Basic client-side check, though MusicLoverSignUpFlow also does this
            return { exists: false, error: "Username must be at least 3 characters." };
        }
        try {
            // Check against music_lover_profiles table - username field
            const { data: mlData, error: mlError, count: mlCount } = await supabase
                .from('music_lover_profiles')
                .select('username', { count: 'exact', head: true })
                .eq('username', username.trim());

            if (mlError) {
                console.error('[AuthProvider] checkUsernameExists: Supabase error:', mlError);
                return { exists: false, error: `Error checking username: ${mlError.message}` };
            }

            // If found in music_lover_profiles, return early
            if (mlCount !== null && mlCount > 0) {
                console.log(`[AuthProvider] checkUsernameExists: Username "${username}" exists in music_lover_profiles`);
                return { exists: true };
            }

            // For organizers, we don't have username but company_name should be unique
            // Check if this username exists as a company_name in organizer_profiles
            const { data: orgData, error: orgError, count: orgCount } = await supabase
                .from('organizer_profiles')
                .select('company_name', { count: 'exact', head: true })
                .eq('company_name', username.trim());

            if (orgError) {
                console.error('[AuthProvider] checkUsernameExists: Supabase error checking organizer_profiles:', orgError);
                return { exists: false, error: `Error checking username: ${orgError.message}` };
            }

            const totalCount = (mlCount || 0) + (orgCount || 0);
            console.log(`[AuthProvider] checkUsernameExists: Count for username "${username}": ${totalCount} (ML: ${mlCount}, Org: ${orgCount})`);
            return { exists: totalCount > 0 };

        } catch (e: any) {
            console.error('[AuthProvider] checkUsernameExists: Unexpected error:', e);
            return { exists: false, error: 'An unexpected error occurred while checking username.' };
        }
    };

    // This function is now specifically for Music Lover email checks
    const checkEmailExists = async (email: string): Promise<{ exists: boolean, error?: string }> => {
        console.log(`[AuthProvider] checkEmailExists (MusicLover): Checking email "${email}"`);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email.trim())) {
            return { exists: false, error: "Invalid email format." };
        }
        try {
            // Check for email in music_lover_profiles table
            console.log(`[AuthProvider] checkEmailExists (MusicLover): Checking music_lover_profiles table for email "${email}"`);
            const { error: mlError, count: mlCount } = await supabase
                .from('music_lover_profiles')
                .select('email', { count: 'exact', head: true })
                .eq('email', email.trim());

            if (mlError) {
                console.error('[AuthProvider] checkEmailExists (MusicLover): Supabase error:', mlError);
                return { exists: false, error: `Error checking email: ${mlError.message}` };
            }

            if (mlCount !== null && mlCount > 0) {
                console.log(`[AuthProvider] checkEmailExists (MusicLover): Email "${email}" exists in music_lover_profiles`);
                return { exists: true };
            }
            
            console.log(`[AuthProvider] checkEmailExists (MusicLover): Email "${email}" does NOT exist in music_lover_profiles`);
            return { exists: false };

        } catch (e: any) {
            console.error('[AuthProvider] checkEmailExists (MusicLover): Unexpected error:', e);
            return { exists: false, error: 'An unexpected error occurred while checking email.' };
        }
    };

    // New function specifically for Organizer email checks
    const checkOrganizerEmailExists = async (email: string): Promise<{ exists: boolean, error?: string }> => {
        console.log(`[AuthProvider] checkOrganizerEmailExists: Checking email "${email}"`);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email.trim())) {
            return { exists: false, error: "Invalid email format." };
        }
        try {
            console.log(`[AuthProvider] checkOrganizerEmailExists: Querying organizer_profiles table for email "${email}"`);
            const { data, error: orgError, count } = await supabase
                .from('organizer_profiles')
                .select('email', { count: 'exact' }) // Remove head:true to see if data comes back
                .eq('email', email.trim())
                .limit(1); // We only need to know if at least one exists

            console.log(`[AuthProvider] checkOrganizerEmailExists: Query result - data:`, data, `count:`, count, `error:`, orgError);

            if (orgError) {
                console.error('[AuthProvider] checkOrganizerEmailExists: Supabase error:', orgError);
                return { exists: false, error: `Error checking email: ${orgError.message}` };
            }

            // Check if data array is not empty OR if count is greater than 0
            // Supabase might return data and count, or just one of them depending on version/query.
            const emailExists = (data && data.length > 0) || (count !== null && count > 0);

            if (emailExists) {
                console.log(`[AuthProvider] checkOrganizerEmailExists: Email "${email}" EXISTS in organizer_profiles`);
                return { exists: true };
            }
            
            console.log(`[AuthProvider] checkOrganizerEmailExists: Email "${email}" does NOT exist in organizer_profiles`);
            return { exists: false };

        } catch (e: any) {
            console.error('[AuthProvider] checkOrganizerEmailExists: Unexpected error:', e);
            return { exists: false, error: 'An unexpected error occurred while checking email.' };
        }
    };

    // Provide context value
    return (
        <AuthContext.Provider value={{
            session,
            loading,
            musicLoverProfile,
            organizerProfile,
            signUp,
            login,
            logout,
            checkSession,
            refreshSessionData,
            refreshUserProfile,
            createMusicLoverProfile,
            createOrganizerProfile,
            updatePremiumStatus,
            requestMediaLibraryPermissions,
            checkUsernameExists,
            checkEmailExists, // For Music Lovers
            checkOrganizerEmailExists // For Organizers
        }}>
            {children}
        </AuthContext.Provider>
    );
}; // <<< End of AuthProvider

// Custom hook
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};