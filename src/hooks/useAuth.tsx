import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import { NavigationContainerRef } from '@react-navigation/native';
// Adjust path as necessary
import { 
    supabase, 
    UserTypes, 
    SignUpCredentials, 
    LoginCredentials, 
    UserSession, 
    MusicLoverBio as SupabaseMusicLoverBio,
} from '../lib/supabase';
import { useOrganizerMode } from './useOrganizerMode'; // Ensure path is correct
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants'; // For fallback Supabase URL
// *** ADD expo-file-system ***
import * as FileSystem from 'expo-file-system';
// Import permission function from expo-image-picker (needed by context consumer)
import { requestMediaLibraryPermissionsAsync } from 'expo-image-picker';
import { Buffer } from 'buffer'; // Import Buffer for robust Base64 handling
import { createClient } from '@supabase/supabase-js';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AuthSession from 'expo-auth-session';
// Import notification service
import NotificationService from '../services/NotificationService';

// --- Exported Types ---
export type MusicLoverBio = SupabaseMusicLoverBio;

// --- Locally Defined/Patched Types to fix linter errors and add new fields ---
export interface MusicLoverProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  age: number | undefined;
  profilePicture: string | undefined;
  bio: MusicLoverBio | undefined;
  country: string | undefined;
  city: string | undefined;
  isPremium: boolean;
  musicData: any | null;
  selectedStreamingService: string | undefined;
  termsAccepted: boolean;
  secondary_streaming_services: string[] | undefined;
  favorite_artists: string | null | undefined;
  favorite_albums: string | null | undefined;
  favorite_songs: string | null | undefined;
  stripe_customer_id: string | undefined;
}

export interface OrganizerProfile {
    id: string;
    user_id: string;
    company_name: string;
    email: string;
    phone_number: string | undefined;
    business_type: 'venue' | 'promoter' | 'artist_management' | 'festival_organizer' | 'other' | 'F&B' | 'club' | 'party' | undefined;
    bio: string | undefined;
    website: string | undefined;
    logo: string | undefined;
    created_at: string;
    updated_at: string;
    stripe_connect_account_id: string | undefined;
    stripe_customer_id: string | undefined;
    average_rating?: number | undefined; // It's optional as it comes from an RPC call
    capacity?: number | undefined; // <-- ADDED
    opening_hours?: OpeningHours | undefined; // <-- ADDED
    unavailable_dates?: string[]; // <-- ADDED
    companyName: string;
    age?: number | null;
}

export interface CreateMusicLoverProfileData {
    userId: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    termsAccepted: boolean;
    selectedStreamingService: string;
    profilePictureUri?: string;
    profilePictureMimeType?: string | null;
    bio?: MusicLoverBio | null;
    country?: string | null;
    city?: string | null;
    age?: number | null;
    website?: string;
    capacity?: number; // <-- ADDED
    openingHours?: OpeningHours; // <-- ADDED
}

export interface CreateOrganizerProfileData {
    userId: string;
    companyName: string;
    email?: string;
    logoUri?: string;
    logoMimeType?: string | null;
    phoneNumber?: string;
    businessType?: 'venue' | 'promoter' | 'artist_management' | 'festival_organizer' | 'other' | 'F&B' | 'club' | 'party';
    bio?: string;
    website?: string;
    capacity?: number;
    openingHours?: OpeningHours;
}

export type TimeSlot = {
  open: string;
  close: string;
};

export type DayOpeningHours = TimeSlot[];

export type OpeningHours = {
  monday: DayOpeningHours;
  tuesday: DayOpeningHours;
  wednesday: DayOpeningHours;
  thursday: DayOpeningHours;
  friday: DayOpeningHours;
  saturday: DayOpeningHours;
  sunday: DayOpeningHours;
};

// The types from supabase.ts are now the single source of truth.
// We just re-export them here if needed by other parts of the app.
// export type { MusicLoverProfile, OrganizerProfile, CreateMusicLoverProfileData, CreateOrganizerProfileData };

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
    updateOrganizerProfile: (userId: string, profileData: Partial<CreateOrganizerProfileData>) => Promise<{ error: any } | { success: boolean; logoUrl?: string | null }>;
    updatePremiumStatus: (userId: string, isPremium: boolean) => Promise<{ error: any } | { success: boolean }>;
    requestMediaLibraryPermissions: () => Promise<boolean>;
    checkUsernameExists: (username: string) => Promise<{ exists: boolean, error?: string }>;
    checkEmailExists: (email: string) => Promise<{ exists: boolean, error?: string }>;
    verifyEmailIsReal: (email: string) => Promise<{ isValid: boolean, error?: string }>;
    signInWithGoogle: () => Promise<{ error: any } | { user: any }>;
    verifyGoogleAuthCompleted: () => Promise<boolean>;
    updateUserMetadata: (userType: UserTypes) => Promise<{ error: any } | { success: boolean }>;
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
    updateOrganizerProfile: async () => ({ error: 'Not implemented' }),
    updatePremiumStatus: async () => ({ error: 'Not implemented' }),
    requestMediaLibraryPermissions: async () => false,
    checkUsernameExists: async () => ({ exists: false, error: 'Not implemented' }),
    checkEmailExists: async () => ({ exists: false, error: 'Not implemented' }),
    verifyEmailIsReal: async () => ({ isValid: false, error: 'Not implemented' }),
    signInWithGoogle: async () => ({ error: 'Not implemented' }),
    verifyGoogleAuthCompleted: async () => false,
    updateUserMetadata: async () => ({ error: 'Not implemented' }),
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
    
    // Flag to prevent auth state change listener from navigating during login/signup
    const isManualAuthInProgress = useRef(false);

    useEffect(() => {
        if (Platform.OS !== 'web') {
            const webClientId = Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "830574548321-h59962oi42ok7tejuhkefud8tbooo18j.apps.googleusercontent.com";
            console.log('🔍 DEBUG: Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID =', Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
            console.log('🔍 DEBUG: Using webClientId =', webClientId);
            
            GoogleSignin.configure({
                webClientId: webClientId, // Web client ID for backend verification
                offlineAccess: true,
            });
        }
    }, []);

    useEffect(() => {
        previousSessionRef.current = session;
    }, [session]);

    // Attempt to use service role key if environment provides it (bypass RLS)
    // WARNING: Only use this for specific admin functions, never expose in client code
    const supabaseAdmin = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ? 
        createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '',
            {
                auth: {
                    persistSession: false
                }
            }
        ) : null;

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
                const userId = supabaseSession.user.id;
                
                // ENHANCED: Better user type determination with multiple fallbacks
                userType = (supabaseSession.user.user_metadata?.user_type as UserTypes) || null;
                console.log(`[AuthProvider] User type from metadata: ${userType}`);
                
                // Fallback 1: Check URL path (for signup flows)
                if (!userType && typeof window !== 'undefined') {
                    const currentPath = window.location.pathname;
                    if (currentPath.includes('MusicLover')) {
                        userType = 'music_lover';
                        console.log(`[AuthProvider] User type determined from URL path: ${userType}`);
                    } else if (currentPath.includes('Organizer')) {
                        userType = 'organizer';
                        console.log(`[AuthProvider] User type determined from URL path: ${userType}`);
                    }
                }
                
                // Fallback 2: Check if we have existing profiles in the database
                if (!userType) {
                    console.log("[AuthProvider] User type still unknown, checking database profiles...");
                    try {
                        // Check for music lover profile
                        const { data: musicLoverData, error: musicLoverError } = await supabase
                            .from('music_lover_profiles')
                            .select('id')
                            .eq('user_id', userId)
                            .maybeSingle();
                        
                        if (!musicLoverError && musicLoverData) {
                            userType = 'music_lover';
                            console.log(`[AuthProvider] User type determined from existing music lover profile: ${userType}`);
                        } else {
                            // Check for organizer profile
                            const { data: organizerData, error: organizerError } = await supabase
                                .from('organizer_profiles')
                                .select('id')
                                .eq('user_id', userId)
                                .maybeSingle();
                            
                            if (!organizerError && organizerData) {
                                userType = 'organizer';
                                console.log(`[AuthProvider] User type determined from existing organizer profile: ${userType}`);
                            }
                        }
                    } catch (profileCheckError) {
                        console.error("[AuthProvider] Error checking existing profiles:", profileCheckError);
                    }
                }
                
                // Fallback 3: Check the public.users table
                if (!userType) {
                    console.log("[AuthProvider] User type still unknown, checking public.users table...");
                    try {
                        const { data: userData, error: userError } = await supabase
                            .from('users')
                            .select('user_type')
                            .eq('id', userId)
                            .maybeSingle();
                        
                        if (!userError && userData?.user_type) {
                            userType = userData.user_type as UserTypes;
                            console.log(`[AuthProvider] User type determined from public.users table: ${userType}`);
                        }
                    } catch (userTableError) {
                        console.error("[AuthProvider] Error checking public.users table:", userTableError);
                    }
                }
                
                // Fallback 4: Default to music_lover (most common case)
                if (!userType) {
                    userType = 'music_lover';
                    console.log(`[AuthProvider] ⚠️ User type was still undefined, defaulting to: ${userType}`);
                    
                    // Update the user metadata to persist this choice
                    try {
                        await supabase.auth.updateUser({
                            data: { user_type: userType }
                        });
                        console.log(`[AuthProvider] ✅ Updated user metadata with default user_type: ${userType}`);
                    } catch (metadataError) {
                        console.error("[AuthProvider] ❌ Failed to update user metadata:", metadataError);
                    }
                }
                
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

                console.log(`[AuthProvider] Final user type determined: ${userType}`);

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
                                   id: profileData.id.toString(),
                                   userId: profileData.user_id,
                                   firstName: profileData.first_name ?? '',
                                   lastName: profileData.last_name ?? '',
                                   username: profileData.username ?? '',
                                   email: profileData.email,
                                   age: profileData.age ?? undefined,
                                   profilePicture: profileData.profile_picture ?? undefined,
                                   bio: profileData.bio ?? undefined,
                                   country: profileData.country ?? undefined,
                                   city: profileData.city ?? undefined,
                                   isPremium: profileData.is_premium,
                                   musicData: profileData.music_data,
                                   selectedStreamingService: profileData.selected_streaming_service ?? undefined,
                                   termsAccepted: profileData.terms_accepted,
                                   secondary_streaming_services: profileData.secondary_streaming_services ?? undefined,
                                   favorite_artists: profileData.favorite_artists ?? undefined,
                                   favorite_albums: profileData.favorite_albums ?? undefined,
                                   favorite_songs: profileData.favorite_songs ?? undefined,
                                   stripe_customer_id: profileData.stripe_customer_id ?? undefined,
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
                                .maybeSingle();

                            if (profileError) {
                                console.error("[AuthProvider] Error fetching organizer profile:", profileError);
                            } else if (profileData) {
                                 console.log("[AuthProvider] Organizer profile fetched successfully.", profileData.id);
                                 const { data: avgRatingData } = await supabase.rpc('get_organizer_average_rating', { p_organizer_id: userId });

                                 const fullProfile: OrganizerProfile = {
                                   id: profileData.id.toString(),
                                   user_id: profileData.user_id,
                                   company_name: profileData.company_name,
                                   email: profileData.email,
                                   phone_number: profileData.phone_number ?? undefined,
                                   business_type: profileData.business_type ?? undefined,
                                   bio: profileData.bio ?? undefined,
                                   website: profileData.website ?? undefined,
                                   logo: profileData.logo ?? undefined,
                                   created_at: profileData.created_at,
                                   updated_at: profileData.updated_at,
                                   average_rating: avgRatingData ?? undefined,
                                   stripe_connect_account_id: profileData.stripe_connect_account_id ?? undefined,
                                   stripe_customer_id: profileData.stripe_customer_id ?? undefined,
                                   capacity: profileData.capacity ?? undefined,
                                   opening_hours: profileData.opening_hours ?? undefined,
                                   companyName: profileData.company_name,
                                   age: profileData.age ?? undefined,
                                   unavailable_dates: profileData.unavailable_dates ?? undefined,
                                 };
                                 setOrganizerProfile(fullProfile);
                                 if (currentSession) currentSession.organizerProfile = fullProfile;
                            } else {
                                console.log("[AuthProvider] No organizer profile found for this user.");
                            }
                        } else {
                            console.warn("[AuthProvider] User type is null or unrecognized, cannot fetch profile.");
                            // If we still don't have a userType, try to determine it from existing data
                            console.log("[AuthProvider] Attempting to determine user type from any existing profile...");
                            
                            // Check both profile tables to see if the user has any existing profile
                            try {
                                const [musicLoverResult, organizerResult] = await Promise.all([
                                    supabase.from('music_lover_profiles').select('id').eq('user_id', userId).maybeSingle(),
                                    supabase.from('organizer_profiles').select('id').eq('user_id', userId).maybeSingle()
                                ]);
                                
                                if (!musicLoverResult.error && musicLoverResult.data) {
                                    console.log("[AuthProvider] Found existing music lover profile, setting userType and fetching profile...");
                                    userType = 'music_lover';
                                    if (currentSession) currentSession.userType = userType;
                                    // Recursively call to fetch the profile
                                    return await _fetchProfileData(user, userType);
                                } else if (!organizerResult.error && organizerResult.data) {
                                    console.log("[AuthProvider] Found existing organizer profile, setting userType and fetching profile...");
                                    userType = 'organizer';
                                    if (currentSession) currentSession.userType = userType;
                                    // Recursively call to fetch the profile
                                    return await _fetchProfileData(user, userType);
                                } else {
                                    console.log("[AuthProvider] No existing profiles found, user needs to complete signup.");
                                }
                            } catch (profileSearchError) {
                                console.error("[AuthProvider] Error searching for existing profiles:", profileSearchError);
                            }
                        }

                        // Set organizer mode based on fetched profile
                        if (currentSession?.organizerProfile) {
                            setIsOrganizerMode(true);
                            console.log("[AuthProvider] Setting Organizer Mode ON based on profile.");
                        } else {
                            setIsOrganizerMode(false);
                            console.log("[AuthProvider] Setting Organizer Mode OFF (no organizer profile).");
                        }

                        // --- Register for push notifications after successful profile fetch ---
                        try {
                            if (currentSession && (currentSession.musicLoverProfile || currentSession.organizerProfile)) {
                                console.log("[AuthProvider] Registering for push notifications...");
                                const token = await NotificationService.registerForPushNotifications(userId);
                                if (token) {
                                    console.log("[AuthProvider] Push notification registration successful");
                                } else {
                                    console.log("[AuthProvider] Push notification registration failed or not supported");
                                }
                                
                                // Setup notification listeners
                                NotificationService.addNotificationReceivedListener((notification) => {
                                    console.log('[AuthProvider] Notification received while app is open:', notification);
                                    // You can handle in-app notifications here if needed
                                });

                                NotificationService.addNotificationResponseReceivedListener((response) => {
                                    console.log('[AuthProvider] Notification tapped:', response);
                                    
                                    // Handle navigation based on notification data
                                    const data = response.notification.request.content.data as any;
                                    if (data?.screen && navigationRef.current?.isReady()) {
                                        if (data.screen === 'MatchesScreen') {
                                            // Navigate to matches screen
                                            (navigationRef.current as any)?.navigate('MainApp', { 
                                                screen: 'MatchesScreen' 
                                            });
                                        } else if (data.screen === 'IndividualChatScreen' && data.matchUserId) {
                                            // Navigate to specific chat
                                            (navigationRef.current as any)?.navigate('MainApp', { 
                                                screen: 'IndividualChatScreen',
                                                params: { 
                                                    matchUserId: data.matchUserId,
                                                    matchName: data.senderName || data.matchName,
                                                    isFirstInteractionFromMatches: false
                                                }
                                            });
                                        } else if (data.screen === 'GroupChatScreen' && data.groupId) {
                                            // Navigate to group chat
                                            (navigationRef.current as any)?.navigate('MainApp', { 
                                                screen: 'GroupChatScreen',
                                                params: { groupId: data.groupId }
                                            });
                                        }
                                    }
                                });
                            }
                        } catch (notificationError) {
                            console.error("[AuthProvider] Error setting up notifications:", notificationError);
                            // Don't fail the whole login process if notifications fail
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
            
            // CRITICAL: Don't navigate during manual login/signup to prevent race conditions
            if (isManualAuthInProgress.current && _event === 'SIGNED_IN') {
                console.log("[AuthProvider] ⚠️ Manual auth in progress, skipping navigation for SIGNED_IN event");
                // Still update the session state, but don't navigate
                checkSession({ navigateToProfile: false });
                return;
            }
            
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

            // This check is a safeguard. The UI should prevent this state.
            const emailCheckResult = await checkEmailExists(email);
            if (emailCheckResult.exists) {
                console.error(`[AuthProvider] signUp: Email already exists. Message: ${emailCheckResult.error}`);
                return { error: new Error(emailCheckResult.error || 'This email is already registered.') };
            }
            if (emailCheckResult.error && !emailCheckResult.exists) { // Only fail if there was an actual error, not just an existence message
                console.error(`[AuthProvider] signUp: Error during pre-check for email. Message: ${emailCheckResult.error}`);
                return { error: new Error(emailCheckResult.error) };
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
            setLoading(false);
            return { error };
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
            const { userId, profilePictureUri, profilePictureMimeType, termsAccepted, bio, country, city, age, selectedStreamingService, website, capacity, openingHours, ...basicProfileData } = profileData;
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
                website: website,
                capacity: capacity,
                opening_hours: openingHours,
                 // Ensure all REQUIRED DB fields are present or have defaults
                // music_data: {} // Example default if required and not nullable
            };
            console.log('[AuthProvider] createMusicLoverProfile: Preparing to upsert profile data:', { ...profileToInsert, profile_picture: profileToInsert.profile_picture ? 'URL exists' : 'null' });

            // --- Upsert Profile in DB ---
            const client = supabaseAdmin || supabase; // Use admin client if available to bypass RLS
            const { data: upsertData, error: upsertError } = await client
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
            if (!profileData.userId || !profileData.companyName) {
                console.error("[AuthProvider] createOrganizerProfile: Missing required profile data.");
                return { error: new Error("Missing required profile information (company name).") };
            }

            // Get email from the authenticated session
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
                console.error("[AuthProvider] createOrganizerProfile: Error getting session:", sessionError);
                return { error: new Error("Failed to get user session.") };
            }
            
            const email = sessionData?.session?.user?.email || profileData.email;
            if (!email) {
                console.error("[AuthProvider] createOrganizerProfile: No email found in session or profile data.");
                return { error: new Error("Missing required email.") };
            }
            console.log('[AuthProvider] createOrganizerProfile: Using email from session:', email);

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
            const { userId, logoUri, logoMimeType, capacity, openingHours, ...basicOrgData } = profileData;
            const profileToInsert = {
                user_id: userId,
                company_name: basicOrgData.companyName,
                email: email, // Use email from session or fallback to provided email
                // Convert null or empty string to undefined for optional fields
                phone_number: basicOrgData.phoneNumber === null || basicOrgData.phoneNumber === '' ? undefined : basicOrgData.phoneNumber,
                // business_type is a specific enum or null, only check for null
                business_type: basicOrgData.businessType === null ? undefined : basicOrgData.businessType,
                bio: basicOrgData.bio === null || basicOrgData.bio === '' ? undefined : basicOrgData.bio,
                website: basicOrgData.website === null || basicOrgData.website === '' ? undefined : basicOrgData.website,
                logo: publicLogoUrl ?? undefined,
                capacity: capacity,
                opening_hours: openingHours,
                 // Ensure all REQUIRED DB fields are present or have defaults
            };
            console.log('[AuthProvider] createOrganizerProfile: Preparing to upsert profile data:', { ...profileToInsert, logo: profileToInsert.logo ? 'URL exists' : 'null' });

            // --- Upsert Profile in DB ---
            const client = supabaseAdmin || supabase; // Use admin client if available to bypass RLS
            const { data: upsertData, error: upsertError } = await client
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

    // --- Update Organizer Profile ---
    const updateOrganizerProfile = async (userId: string, profileData: Partial<CreateOrganizerProfileData>): Promise<{ error: any } | { success: boolean; logoUrl?: string | null }> => {
        console.log(`[AuthProvider] updateOrganizerProfile: START user: ${userId}`);
        setLoading(true);
        let publicLogoUrl: string | null = null;

        try {
            // --- Logo Upload ---
            if (profileData.logoUri && !profileData.logoUri.startsWith('http')) {
                console.log('[AuthProvider] updateOrganizerProfile: New logo provided, uploading...');
                publicLogoUrl = await _uploadImage(
                    userId,
                    profileData.logoUri,
                    'logos',
                    profileData.logoMimeType
                );
                if (publicLogoUrl === null) {
                     return { error: new Error("Logo upload failed. Profile was not updated.") };
                }
            } else {
                publicLogoUrl = profileData.logoUri ?? null; // Keep existing if not changed or if it's already a URL
            }

            // --- Prepare DB Data ---
            const { companyName, email, phoneNumber, businessType, bio, website, capacity, openingHours } = profileData;

            const profileToUpdate: { [key: string]: any } = {
                updated_at: new Date().toISOString(),
            };
            
            if (companyName) profileToUpdate.company_name = companyName;
            if (email) profileToUpdate.email = email;
            if (phoneNumber) profileToUpdate.phone_number = phoneNumber;
            if (businessType) profileToUpdate.business_type = businessType;
            if (bio) profileToUpdate.bio = bio;
            if (website) profileToUpdate.website = website;
            if (capacity) profileToUpdate.capacity = capacity;
            if (openingHours) profileToUpdate.opening_hours = openingHours;
            if (publicLogoUrl) profileToUpdate.logo = publicLogoUrl;

            console.log('[AuthProvider] updateOrganizerProfile: Preparing to update profile data with:', profileToUpdate);

            // --- Update Profile in DB ---
            const client = supabaseAdmin || supabase;
            const { error: updateError } = await client
                .from('organizer_profiles')
                .update(profileToUpdate)
                .eq('user_id', userId);

            if (updateError) {
                console.error('[AuthProvider] updateOrganizerProfile: Update FAILED:', JSON.stringify(updateError, null, 2));
                return { error: new Error(`Failed to update organizer profile: ${updateError.message}`) };
            }
            console.log('[AuthProvider] updateOrganizerProfile: Update SUCCESS.');

            // --- Refresh Session ---
            await refreshSessionData();

            return { success: true, logoUrl: publicLogoUrl };

        } catch (error: any) {
            console.error('[AuthProvider] updateOrganizerProfile: UNEXPECTED error:', error);
            return { error: new Error('An unexpected error occurred updating the organizer profile.') };
        } finally {
            setLoading(false);
        }
    };

    // --- Update Premium Status ---
    const updatePremiumStatus = async (userId: string, isPremium: boolean): Promise<{ error: any } | { success: boolean }> => {
        console.log(`[AuthProvider] updatePremiumStatus: Setting premium=${isPremium} for user ${userId}`);
        setLoading(true);
        try {
            console.log('[AuthPremium] Updating \'is_premium\' flag in music_lover_profiles for ' + userId + '...');
            
            // Use admin client if available to bypass RLS
            const client = supabaseAdmin || supabase;
            const { error: updateError } = await client
                .from('music_lover_profiles') // *** CHECK TABLE NAME ***
                .update({ is_premium: isPremium, updated_at: new Date().toISOString() })
                .eq('user_id', userId); // Use user_id

            if (updateError) {
                console.error('[AuthPremium] Error updating premium status:', updateError);
                return { error: new Error(`Failed to update premium status: ${updateError.message}`) };
            }

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
        
        // Set flag to prevent auth state change listener from navigating prematurely
        isManualAuthInProgress.current = true;
        
        try {
            const { email, username, password, userType } = credentials;
            
            // Validate required fields
            if ((!email && !username) || !password || !userType) {
                console.error('[AuthProvider] login: Missing required fields.');
                isManualAuthInProgress.current = false;
                return { error: new Error('Please enter email/username, password, and select account type.') };
            }

            // First try to authenticate with the provided input as email
            const loginInput = email || username;
            if (!loginInput) {
                console.error('[AuthProvider] login: No login input provided');
                isManualAuthInProgress.current = false;
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
                    isManualAuthInProgress.current = false;
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
                    isManualAuthInProgress.current = false;
                    return { error: { message: 'Invalid email/username or password.' } };
                }

                if (!retryLoginData?.user) {
                    console.error('[AuthProvider] login: Login successful but no user data returned.');
                    isManualAuthInProgress.current = false;
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
                    isManualAuthInProgress.current = false;
                    return { error: { message: 'Login failed: Could not verify account type. Please contact support.' } };
                }

                const dbUserType = typeData.type as UserTypes;
                console.log(`[AuthProvider] login: DB user type confirmed as: ${dbUserType}`);

                if (dbUserType !== userType) {
                    console.warn(`[AuthProvider] login: TYPE MISMATCH! User ${userId} tried logging in via ${userType} portal, but DB type is ${dbUserType}.`);
                    await logout();
                    setLoading(false);
                    isManualAuthInProgress.current = false;
                    return { error: { message: `Incorrect login portal. This account is registered as a ${dbUserType === 'music_lover' ? 'Music Lover' : 'Organizer'}. Please use the correct login page.` } };
                }

                console.log('[AuthProvider] login: User type verified. Updating user metadata and calling checkSession...');
                
                // CRITICAL: Update user metadata with the correct user type before checkSession
                try {
                    await supabase.auth.updateUser({
                        data: { user_type: dbUserType }
                    });
                    console.log(`[AuthProvider] login: ✅ Updated user metadata with user_type: ${dbUserType}`);
                } catch (metadataError) {
                    console.error("[AuthProvider] login: ❌ Failed to update user metadata:", metadataError);
                    // Don't fail the login if metadata update fails
                }
                
                setIsOrganizerMode(dbUserType === 'organizer');
                await checkSession({ navigateToProfile: true });
                
                // Clear the flag after successful login
                isManualAuthInProgress.current = false;
                return { user: retryLoginData.user };

            }

            // If we get here, the first email authentication attempt was successful
            if (!loginData?.user) {
                console.error('[AuthProvider] login: Login successful but no user data returned.');
                isManualAuthInProgress.current = false;
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
                isManualAuthInProgress.current = false;
                return { error: { message: 'Login failed: Could not verify account type. Please contact support.' } };
            }

            const dbUserType = typeData.type as UserTypes;
            console.log(`[AuthProvider] login: DB user type confirmed as: ${dbUserType}`);

            if (dbUserType !== userType) {
                console.warn(`[AuthProvider] login: TYPE MISMATCH! User ${userId} tried logging in via ${userType} portal, but DB type is ${dbUserType}.`);
                await logout();
                setLoading(false);
                isManualAuthInProgress.current = false;
                return { error: { message: `Incorrect login portal. This account is registered as a ${dbUserType === 'music_lover' ? 'Music Lover' : 'Organizer'}. Please use the correct login page.` } };
            }

            console.log('[AuthProvider] login: User type verified. Updating user metadata and calling checkSession...');
            
            // CRITICAL: Update user metadata with the correct user type before checkSession
            try {
                await supabase.auth.updateUser({
                    data: { user_type: dbUserType }
                });
                console.log(`[AuthProvider] login: ✅ Updated user metadata with user_type: ${dbUserType}`);
            } catch (metadataError) {
                console.error("[AuthProvider] login: ❌ Failed to update user metadata:", metadataError);
                // Don't fail the login if metadata update fails
            }
            
            setIsOrganizerMode(dbUserType === 'organizer');
            await checkSession({ navigateToProfile: true });
            
            // Clear the flag after successful login
            isManualAuthInProgress.current = false;
            return { user: loginData.user };

        } catch (error: any) {
            console.error('[AuthProvider] login: UNEXPECTED error:', error);
            setLoading(false);
            
            // Clear the flag on error
            isManualAuthInProgress.current = false;
            return { error: new Error('An unexpected error occurred during login.') };
        }
    };

    // --- Logout ---
    const logout = async () => {
        console.log('[AuthProvider] logout: Initiating logout...');
        setLoading(true);
        try {
            // Remove push tokens before logging out
            if (session?.user?.id) {
                try {
                    await NotificationService.removePushToken(session.user.id);
                    console.log('[AuthProvider] logout: Push tokens removed successfully');
                } catch (tokenError) {
                    console.error('[AuthProvider] logout: Error removing push tokens:', tokenError);
                }
            }

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
 
    // This function verifies if an email is real using the verify-email-api edge function
    const verifyEmailIsReal = async (email: string): Promise<{ isValid: boolean, error?: string }> => {
        console.log(`[AuthProvider] verifyEmailIsReal: Verifying if email "${email}" is real`);
        try {
            const { data, error } = await supabase.functions.invoke('verify-email-api', {
                body: { email: email.trim() }
            });

            if (error) {
                console.error('[AuthProvider] verifyEmailIsReal: Edge function error:', error);
                return { isValid: false, error: 'Could not verify email at this time.' };
            }

            return { isValid: !!data?.isValid, error: data?.error };
        } catch (e: any) {
            console.error('[AuthProvider] verifyEmailIsReal: Unexpected error:', e);
            return { isValid: false, error: 'An unexpected error occurred while verifying email.' };
        }
    };

    // This function checks both music_lover_profiles and organizer_profiles
    const checkEmailExists = async (email: string): Promise<{ exists: boolean, error?: string }> => {
        console.log(`[AuthProvider] checkEmailExists: Checking email "${email}" across all profiles`);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email.trim())) {
            return { exists: false, error: "Invalid email format." };
        }
        try {
            const trimmedEmail = email.trim();
 
            // 1. Check Music Lover profiles first
            const { count: mlCount, error: mlError } = await supabase
                .from('music_lover_profiles')
                .select('email', { count: 'exact', head: true })
                .eq('email', trimmedEmail);
 
            if (mlError) {
                console.error('[AuthProvider] Supabase error checking music_lover_profiles:', mlError);
                return { exists: false, error: `Error checking email: ${mlError.message}` };
            }
 
            if (mlCount !== null && mlCount > 0) {
                return { exists: true, error: 'Email is already in use by a Music Lover.' };
            }
 
            // 2. Then, check Organizer profiles
            const { count: orgCount, error: orgError } = await supabase
                .from('organizer_profiles')
                .select('email', { count: 'exact', head: true })
                .eq('email', trimmedEmail);
 
            if (orgError) {
                console.error('[AuthProvider] Supabase error checking organizer_profiles:', orgError);
                return { exists: false, error: `Error checking email: ${orgError.message}` };
            }
 
            if (orgCount !== null && orgCount > 0) {
                return { exists: true, error: 'Email is already in use by an Organizer.' };
            }
            
            // If we reach here, email is not in either table
            return { exists: false };
 
        } catch (e: any) {
            console.error('[AuthProvider] Unexpected error in checkEmailExists:', e);
            return { exists: false, error: 'An unexpected error occurred while checking email.' };
        }
    };

    // Function to verify Google authentication was completed successfully
    const verifyGoogleAuthCompleted = async (): Promise<boolean> => {
        if (!session) {
            console.log('[useAuth] No session available, Google authorization not complete');
            return false;
        }
        
        try {
            // Validate the token by making a request to Supabase to get the user
            const { data, error } = await supabase.auth.getUser();
            
            if (error) {
                console.error('[useAuth] Error validating Google auth token:', error);
                return false;
            }
            
            if (data?.user) {
                console.log('[useAuth] Google auth token validation successful');
                return true;
            }
            
            return false;
        } catch (err) {
            console.error('[useAuth] Error during Google auth verification:', err);
            return false;
        }
    };

    // Google Sign-In with native flow for mobile, OAuth for web
    const signInWithGoogle = async (): Promise<{ error: any } | { user: any }> => {
        setLoading(true);
        
        // Set flag to prevent auth state change listener from navigating prematurely
        isManualAuthInProgress.current = true;
        
        try {
            console.log('[useAuth] 🚀 Starting Google Sign-In...');
            console.log('[useAuth] 📱 Platform:', Platform.OS);
            console.log('[useAuth] 🌐 Current URL:', typeof window !== 'undefined' ? window.location.href : 'N/A');
            
            if (Platform.OS === 'web') {
                // For web, use Supabase's built-in OAuth with popup
                console.log('[useAuth] 🌐 Using web OAuth flow with popup');
                
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: window.location.origin,
                        queryParams: {
                            access_type: 'offline',
                            prompt: 'consent',
                        },
                        skipBrowserRedirect: true, // Skip redirect, we'll handle it manually
                    },
                });
                
                if (error) {
                    console.error('[useAuth] ❌ Google OAuth initiation error:', error);
                    setLoading(false);
                    return { error };
                }
                
                console.log('[useAuth] ✅ OAuth URL received:', data?.url ? data.url.substring(0, 100) + '...' : 'No URL');
                
                // Open popup manually with the OAuth URL
                let popup: Window | null = null;
                if (data?.url) {
                    console.log('[useAuth] 🪟 Opening OAuth popup...');
                    popup = window.open(
                        data.url, 
                        'google-oauth', 
                        'width=500,height=600,scrollbars=yes,resizable=yes'
                    );
                    
                    if (!popup) {
                        console.error('[useAuth] ❌ Popup blocked by browser');
                        setLoading(false);
                        return { error: { message: "Popup blocked. Please allow popups for this site." } };
                    }
                    console.log('[useAuth] ✅ Popup opened successfully');
                }
                
                // Wait for the authentication to complete by listening for session changes
                return new Promise((resolve) => {
                    let attempts = 0;
                    const maxAttempts = 120; // 60 seconds timeout
                    let resolved = false;
                    
                    console.log('[useAuth] 👂 Setting up auth state listener...');
                    
                    // Listen for auth state changes
                    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
                        if (resolved) return;
                        
                        console.log('[useAuth] 📡 Auth state change:', event, session?.user ? 'User present' : 'No user');
                        
                        if (event === 'SIGNED_IN' && session?.user) {
                            console.log('[useAuth] ✅ Google authentication successful via auth state change');
                            console.log('[useAuth] 👤 User ID:', session.user.id);
                            console.log('[useAuth] 📧 User email:', session.user.email);
                            console.log('[useAuth] 🔍 Full user object:', session.user);
                            
                            // CRITICAL: Verify the user actually exists in auth.users
                            console.log('[useAuth] 🔍 Verifying user exists in database...');
                            try {
                                const { data: userCheck, error: userCheckError } = await supabase.auth.getUser();
                                console.log('[useAuth] 📊 User verification result:', {
                                    hasUser: !!userCheck?.user,
                                    userId: userCheck?.user?.id,
                                    error: userCheckError
                                });
                                
                                if (userCheckError) {
                                    console.error('[useAuth] ❌ User verification failed:', userCheckError);
                                    
                                    // CRITICAL: Try to diagnose the issue
                                    console.log('[useAuth] 🔍 Diagnosing OAuth user creation issue...');
                                    
                                    // Check if we can see the user in public.users
                                    try {
                                        const { data: publicUserCheck, error: publicError } = await supabase
                                            .from('users')
                                            .select('id, email, user_type')
                                            .eq('id', session.user.id)
                                            .single();
                                        
                                        console.log('[useAuth] 📊 Public users check:', {
                                            found: !!publicUserCheck,
                                            error: publicError?.message
                                        });
                                    } catch (publicCheckError) {
                                        console.error('[useAuth] ❌ Could not check public.users:', publicCheckError);
                                    }
                                    
                                    // Try to manually create the user record
                                    console.log('[useAuth] 🔧 Attempting to manually create user record...');
                                    try {
                                        const currentPath = window.location.pathname;
                                        const userType = currentPath.includes('MusicLover') ? 'music_lover' : 'organizer';
                                        
                                        const { data: manualUserCreate, error: manualError } = await supabase
                                            .from('users')
                                            .insert({
                                                id: session.user.id,
                                                email: session.user.email,
                                                user_type: userType
                                            })
                                            .select()
                                            .single();
                                        
                                        console.log('[useAuth] 📊 Manual user creation result:', {
                                            success: !!manualUserCreate,
                                            error: manualError?.message
                                        });
                                        
                                        if (manualUserCreate) {
                                            console.log('[useAuth] ✅ Successfully created user record manually');
                                            // Continue with the flow
                                        } else {
                                            resolved = true;
                                            setLoading(false);
                                            if (popup) popup.close();
                                            authListener.subscription.unsubscribe();
                                            resolve({ error: { message: 'Failed to create user record: ' + (manualError?.message || 'Unknown error') } });
                                            return;
                                        }
                                    } catch (manualCreateError) {
                                        console.error('[useAuth] ❌ Manual user creation failed:', manualCreateError);
                                        resolved = true;
                                        setLoading(false);
                                        if (popup) popup.close();
                                        authListener.subscription.unsubscribe();
                                        resolve({ error: { message: 'User verification failed: ' + userCheckError.message } });
                                        return;
                                    }
                                }
                            } catch (verifyError) {
                                console.error('[useAuth] ❌ Error verifying user:', verifyError);
                            }
                            
                            resolved = true;
                            setLoading(false);
                            if (popup) {
                                try {
                                    popup.close();
                                    console.log('[useAuth] 🪟 Popup closed');
                                } catch (e) {
                                    console.log('[useAuth] 🪟 Could not close popup (expected with COOP)');
                                }
                            }
                            authListener.subscription.unsubscribe();
                            
                            // CRITICAL: Set user_type immediately in user metadata
                            // We need to determine if this is for music lover or organizer
                            // Check the current URL path to determine user type
                            const currentPath = window.location.pathname;
                            const userType = currentPath.includes('MusicLover') ? 'music_lover' : 'organizer';
                            
                            console.log('[useAuth] 🏷️ Setting user_type immediately:', userType, 'based on path:', currentPath);
                            try {
                                await supabase.auth.updateUser({
                                    data: { user_type: userType }
                                });
                                console.log('[useAuth] ✅ User type set successfully:', userType);
                            } catch (metaError) {
                                console.error('[useAuth] ❌ Error setting user_type:', metaError);
                                // Don't fail the whole process if metadata update fails
                            }
                            
                                                            // Clear the flag on success
                                isManualAuthInProgress.current = false;
                                resolve({ user: session.user });
                        } else if (event === 'SIGNED_OUT') {
                            console.log('[useAuth] ❌ Authentication was cancelled or failed');
                        }
                    });
                    
                    // Fallback polling mechanism - more reliable than popup.closed
                    const checkAuth = async () => {
                        if (resolved) return;
                        
                        attempts++;
                        console.log('[useAuth] 🔄 Polling attempt:', attempts, '/', maxAttempts);
                        
                        try {
                            const { data: sessionData } = await supabase.auth.getSession();
                            
                            if (sessionData?.session?.user) {
                                console.log('[useAuth] ✅ Google authentication successful via polling');
                                console.log('[useAuth] 👤 User ID:', sessionData.session.user.id);
                                console.log('[useAuth] 📧 User email:', sessionData.session.user.email);
                                console.log('[useAuth] 🔍 Full user object (polling):', sessionData.session.user);
                                
                                // CRITICAL: Verify the user actually exists in auth.users
                                console.log('[useAuth] 🔍 Verifying user exists in database (polling)...');
                                try {
                                    const { data: userCheck, error: userCheckError } = await supabase.auth.getUser();
                                    console.log('[useAuth] 📊 User verification result (polling):', {
                                        hasUser: !!userCheck?.user,
                                        userId: userCheck?.user?.id,
                                        error: userCheckError
                                    });
                                    
                                    if (userCheckError) {
                                        console.error('[useAuth] ❌ User verification failed (polling):', userCheckError);
                                        
                                        // CRITICAL: Try to diagnose the issue
                                        console.log('[useAuth] 🔍 Diagnosing OAuth user creation issue...');
                                        
                                        // Check if we can see the user in auth.users directly
                                        try {
                                            const { data: directUserCheck, error: directError } = await supabase
                                                .from('auth.users')
                                                .select('id, email, created_at')
                                                .eq('id', sessionData.session.user.id)
                                                .single();
                                            
                                            console.log('[useAuth] 📊 Direct auth.users check:', {
                                                found: !!directUserCheck,
                                                error: directError?.message
                                            });
                                        } catch (directCheckError) {
                                            console.error('[useAuth] ❌ Could not check auth.users directly:', directCheckError);
                                        }
                                        
                                        // Check if we can see the user in public.users
                                        try {
                                            const { data: publicUserCheck, error: publicError } = await supabase
                                                .from('users')
                                                .select('id, email, user_type')
                                                .eq('id', sessionData.session.user.id)
                                                .single();
                                            
                                            console.log('[useAuth] 📊 Public users check:', {
                                                found: !!publicUserCheck,
                                                error: publicError?.message
                                            });
                                        } catch (publicCheckError) {
                                            console.error('[useAuth] ❌ Could not check public.users:', publicCheckError);
                                        }
                                        
                                        // Try to manually create the user record
                                        console.log('[useAuth] 🔧 Attempting to manually create user record...');
                                        try {
                                            const { data: manualUserCreate, error: manualError } = await supabase
                                                .from('users')
                                                .insert({
                                                    id: sessionData.session.user.id,
                                                    email: sessionData.session.user.email,
                                                    user_type: userType
                                                })
                                                .select()
                                                .single();
                                            
                                            console.log('[useAuth] 📊 Manual user creation result:', {
                                                success: !!manualUserCreate,
                                                error: manualError?.message
                                            });
                                            
                                            if (manualUserCreate) {
                                                console.log('[useAuth] ✅ Successfully created user record manually');
                                                // Continue with the flow
                                            } else {
                                                resolved = true;
                                                setLoading(false);
                                                if (popup) popup.close();
                                                authListener.subscription.unsubscribe();
                                                resolve({ error: { message: 'Failed to create user record: ' + (manualError?.message || 'Unknown error') } });
                                                return;
                                            }
                                        } catch (manualCreateError) {
                                            console.error('[useAuth] ❌ Manual user creation failed:', manualCreateError);
                                            resolved = true;
                                            setLoading(false);
                                            if (popup) popup.close();
                                            authListener.subscription.unsubscribe();
                                            resolve({ error: { message: 'User verification failed: ' + userCheckError.message } });
                                            return;
                                        }
                                    }
                                } catch (verifyError) {
                                    console.error('[useAuth] ❌ Error verifying user (polling):', verifyError);
                                }
                                
                                resolved = true;
                                setLoading(false);
                                if (popup) {
                                    try {
                                        popup.close();
                                        console.log('[useAuth] 🪟 Popup closed');
                                    } catch (e) {
                                        console.log('[useAuth] 🪟 Could not close popup (expected with COOP)');
                                    }
                                }
                                authListener.subscription.unsubscribe();
                                
                                // CRITICAL: Set user_type immediately
                                const currentPath = window.location.pathname;
                                const userType = currentPath.includes('MusicLover') ? 'music_lover' : 'organizer';
                                
                                console.log('[useAuth] 🏷️ Setting user_type immediately (polling):', userType, 'based on path:', currentPath);
                                try {
                                    await supabase.auth.updateUser({
                                        data: { user_type: userType }
                                    });
                                    console.log('[useAuth] ✅ User type set successfully (polling):', userType);
                                } catch (metaError) {
                                    console.error('[useAuth] ❌ Error setting user_type (polling):', metaError);
                                    // Don't fail the whole process if metadata update fails
                                }
                                
                                // Clear the flag on success
                                isManualAuthInProgress.current = false;
                                resolve({ user: sessionData.session.user });
                                return;
                            }
                        } catch (err) {
                            console.error('[useAuth] ❌ Error checking session:', err);
                        }
                        
                        if (attempts >= maxAttempts) {
                            console.log('[useAuth] ⏰ Google authentication timeout');
                            resolved = true;
                            setLoading(false);
                            if (popup) {
                                try {
                                    popup.close();
                                    console.log('[useAuth] 🪟 Popup closed due to timeout');
                                } catch (e) {
                                    console.log('[useAuth] 🪟 Could not close popup (expected with COOP)');
                                }
                            }
                            authListener.subscription.unsubscribe();
                            resolve({ error: { message: "Authentication timeout. Please try again.", cancelled: true } });
                            return;
                        }
                        
                        // Check again in 500ms
                        setTimeout(checkAuth, 500);
                    };
                    
                    // Start monitoring after a brief delay
                    console.log('[useAuth] ⏱️ Starting polling in 2 seconds...');
                    setTimeout(checkAuth, 2000);
                });
            } else {
                // For mobile (Android/iOS), use browser-based OAuth flow similar to Spotify
                console.log('[useAuth] Using browser OAuth for mobile Google Sign-In');
                
                try {
                    // Create redirect URI for mobile OAuth
                    const redirectUri = `${Constants.expoConfig?.scheme || 'vybr'}://auth/callback`;
                    
                    console.log('[useAuth] Using OAuth redirect URI:', redirectUri);
                    
                    // Get the OAuth URL from Supabase
                    const { data, error } = await supabase.auth.signInWithOAuth({
                        provider: 'google',
                        options: {
                            redirectTo: redirectUri,
                            skipBrowserRedirect: true,
                            queryParams: {
                                prompt: 'select_account', // Force account selection screen
                                access_type: 'offline', // Get refresh token
                            },
                        },
                    });

                    if (error) {
                        console.error('[useAuth] Error getting OAuth URL:', error);
                        setLoading(false);
                        // Clear the flag on error
                        isManualAuthInProgress.current = false;
                        return { error };
                    }

                    if (!data?.url) {
                        console.error('[useAuth] No OAuth URL received from Supabase');
                        setLoading(false);
                        // Clear the flag on error
                        isManualAuthInProgress.current = false;
                        return { error: { message: 'Failed to get authentication URL' } };
                    }

                    console.log('[useAuth] Opening OAuth URL in browser:', data.url.substring(0, 100) + '...');

                    // Use WebBrowser for the OAuth flow (same as Spotify)
                    const result = await WebBrowser.openAuthSessionAsync(
                        data.url,
                        redirectUri
                    );

                    console.log('[useAuth] WebBrowser auth session result:', result);

                    if (result.type === 'success' && result.url) {
                        const parsedUrl = new URL(result.url);
                        
                        // Check for tokens in URL fragment (after #) - Supabase uses implicit flow
                        let code = parsedUrl.searchParams.get('code');
                        let accessToken = parsedUrl.searchParams.get('access_token');
                        let refreshToken = parsedUrl.searchParams.get('refresh_token');
                        
                        // If not found in query params, check URL fragment
                        if (!accessToken && !code && parsedUrl.hash) {
                            console.log('[useAuth] Checking URL fragment for tokens:', parsedUrl.hash);
                            const fragmentParams = new URLSearchParams(parsedUrl.hash.substring(1));
                            code = fragmentParams.get('code');
                            accessToken = fragmentParams.get('access_token');
                            refreshToken = fragmentParams.get('refresh_token');
                            console.log('[useAuth] Fragment parsing result - code:', !!code, 'accessToken:', !!accessToken, 'refreshToken:', !!refreshToken);
                        }
                        
                        if (code) {
                            console.log('[useAuth] Authorization code received, exchanging for session...');
                            
                            // Exchange the code for a session
                            const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
                            
                            if (sessionError) {
                                console.error('[useAuth] Error exchanging code for session:', sessionError);
                                setLoading(false);
                                // Clear the flag on error
                                isManualAuthInProgress.current = false;
                                return { error: sessionError };
                            }

                            if (sessionData?.user) {
                                console.log('[useAuth] Google OAuth authentication successful');
                                setLoading(false);
                                // Clear the flag on success
                                isManualAuthInProgress.current = false;
                                return { user: sessionData.user };
                            }
                        } else if (accessToken) {
                            console.log('[useAuth] Access token received, setting session...');
                            
                            // Set the session directly with the tokens
                            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                                access_token: accessToken,
                                refresh_token: refreshToken || '',
                            });
                            
                            if (sessionError) {
                                console.error('[useAuth] Error setting session:', sessionError);
                                setLoading(false);
                                // Clear the flag on error
                                isManualAuthInProgress.current = false;
                                return { error: sessionError };
                            }

                            if (sessionData?.user) {
                                console.log('[useAuth] Google OAuth authentication successful');
                                setLoading(false);
                                // Clear the flag on success
                                isManualAuthInProgress.current = false;
                                return { user: sessionData.user };
                            }
                        }
                        
                        console.error('[useAuth] No valid authentication data found in callback URL');
                        setLoading(false);
                        // Clear the flag on error
                        isManualAuthInProgress.current = false;
                        return { error: { message: 'Authentication failed - no valid data received' } };
                    } else if (result.type === 'cancel') {
                        console.log('[useAuth] User cancelled Google OAuth');
                        setLoading(false);
                        // Clear the flag on cancellation
                        isManualAuthInProgress.current = false;
                        return { error: { message: 'Sign-in was cancelled.', cancelled: true } };
                    } else {
                        console.error('[useAuth] Unexpected AuthSession result:', result);
                        setLoading(false);
                        // Clear the flag on error
                        isManualAuthInProgress.current = false;
                        return { error: { message: 'Authentication failed - unexpected result' } };
                    }
                    
                } catch (browserError: any) {
                    console.error('[useAuth] OAuth error:', browserError);
                    setLoading(false);
                    // Clear the flag on error
                    isManualAuthInProgress.current = false;
                    return { error: { message: browserError.message || 'Failed to complete authentication' } };
                }
            }
        } catch (err: any) {
            console.error('[useAuth] Error in signInWithGoogle:', err);
            setLoading(false);
            // Clear the flag on error
            isManualAuthInProgress.current = false;
            return { error: err };
        }
    };

    // Function to update user metadata with userType (needed for Google OAuth users)
    const updateUserMetadata = async (userType: UserTypes): Promise<{ error: any } | { success: boolean }> => {
        try {
            const { data, error } = await supabase.auth.updateUser({
                data: { user_type: userType }
            });

            if (error) {
                console.error('[useAuth] Error updating user metadata:', error);
                return { error };
            }

            console.log('[useAuth] User metadata updated successfully with user_type:', userType);
            return { success: true };
        } catch (err: any) {
            console.error('[useAuth] Error in updateUserMetadata:', err);
            return { error: err };
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
            updateOrganizerProfile,
            updatePremiumStatus,
            requestMediaLibraryPermissions,
            checkUsernameExists,
            checkEmailExists,
            verifyEmailIsReal,
            signInWithGoogle,
            verifyGoogleAuthCompleted,
            updateUserMetadata,
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