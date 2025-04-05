import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { NavigationContainerRef } from '@react-navigation/native';
// Adjust path as necessary
import { supabase, UserTypes, SignUpCredentials, LoginCredentials, UserSession, MusicLoverProfile as DbMusicLoverProfile, OrganizerProfile as DbOrganizerProfile, MusicLoverBio as SupabaseMusicLoverBio } from '../lib/supabase';
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

// Update MusicLoverProfile interface to include the new DB column
// Assuming DbMusicLoverProfile from supabase types might not have it yet
export interface MusicLoverProfile extends Omit<DbMusicLoverProfile, 'selected_streaming_service'> {
    termsAccepted?: boolean; // Keep this if not in base type
    selectedStreamingService?: string | null; // Add this field
}

// Data needed to create the profile (matches signup flow)
// Add profilePictureMimeType temporarily for passing data internally
export type CreateMusicLoverProfileData = Omit<DbMusicLoverProfile, 'id' | 'user_id' | 'is_premium' | 'created_at' | 'age' | 'music_data' | 'profile_picture' | 'bio' | 'country' | 'city' | 'terms_accepted' | 'selected_streaming_service'> & {
    userId: string;
    age?: number | null; // Optional from form
    profilePictureUri?: string; // Optional URI string from picker
    profilePictureMimeType?: string | null; // <<< ADDED for passing internally
    termsAccepted: boolean; // Required from form
    bio: MusicLoverBio; // Required from form
    country?: string; // Optional from form
    city?: string; // Optional from form
    selectedStreamingService: string; // Required from form
};

// Data for Organizer (Ensure DbOrganizerProfile is accurate)
export type CreateOrganizerProfileData = Omit<DbOrganizerProfile, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'logo'> & {
    userId: string;
    logoUri?: string; // Optional URI string from picker
    logoMimeType?: string | null; // <<< ADDED for passing internally
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
    // Adjust return type slightly if needed
    createMusicLoverProfile: (profileData: CreateMusicLoverProfileData) => Promise<{ error: any } | { success: boolean; profilePictureUrl?: string | null }>;
    createOrganizerProfile: (profileData: CreateOrganizerProfileData) => Promise<{ error: any } | { success: boolean; logoUrl?: string | null }>;
    updatePremiumStatus: (userId: string, isPremium: boolean) => Promise<{ error: any } | { success: boolean }>;
    requestMediaLibraryPermissions: () => Promise<boolean>; // Keep this for UI components
}>({
    session: null,
    loading: true,
    signUp: async () => ({ error: 'Not implemented' }),
    login: async () => ({ error: 'Not implemented' }),
    logout: async () => { },
    checkSession: async () => { },
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
                if (uploadError.message?.includes('policy') || uploadError.message?.includes('403') || uploadError.statusCode === '403') {
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


    // --- Check Session ---
    const checkSession = async (options?: { navigateToProfile?: boolean }) => {
        const navigateAfterProfileComplete = options?.navigateToProfile ?? false;
        const functionCallId = Date.now().toString().slice(-4);
        console.log(`[AuthProvider][${functionCallId}] checkSession: START (NavOnComplete: ${navigateAfterProfileComplete})`);
        const wasMusicLoverProfileComplete = !!previousSessionRef.current?.musicLoverProfile;
        const wasOrganizerProfileComplete = !!previousSessionRef.current?.organizerProfile;

        try {
            const { data: { session: authSession }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) { console.error(`[AuthProvider][${functionCallId}] Error getSession:`, sessionError); setSession(null); setLoading(false); return; }
            if (!authSession) { console.log(`[AuthProvider][${functionCallId}] No active session found.`); setSession(null); setLoading(false); return; }

            console.log(`[AuthProvider][${functionCallId}] Active session for user:`, authSession.user.id);

            // --- Determine User Type (Robust check) ---
            let userType: UserTypes | null = null;
            const { data: userTypeData, error: userTypeError } = await supabase
                .from('user_types').select('type').eq('user_id', authSession.user.id).maybeSingle();

            if (userTypeError) { console.error(`[AuthProvider][${functionCallId}] Error fetching user type from DB:`, userTypeError); }
            else if (userTypeData?.type) {
                userType = userTypeData.type as UserTypes;
                console.log(`[AuthProvider][${functionCallId}] User type from DB:`, userType);
            } else {
                console.log(`[AuthProvider][${functionCallId}] No type in DB, checking auth metadata...`);
                const metaUserType = authSession.user.user_metadata?.user_type as UserTypes;
                if (metaUserType && (metaUserType === 'music_lover' || metaUserType === 'organizer')) {
                    userType = metaUserType;
                    console.log(`[AuthProvider][${functionCallId}] User type from metadata:`, userType, '. Upserting to DB...');
                    supabase.from('user_types').upsert({ user_id: authSession.user.id, type: userType }, { onConflict: 'user_id' })
                        .then(({ error }) => { if (error) console.error(`[AuthProvider][${functionCallId}] Failed DB type upsert after metadata fallback:`, error); });
                } else {
                    console.error(`[AuthProvider][${functionCallId}] CRITICAL: No user type found in DB or valid metadata! Metadata:`, authSession.user.user_metadata);
                    await logout();
                    return;
                }
            }
            if (!userType) { console.error(`[AuthProvider][${functionCallId}] User type determination failed unexpectedly after all checks.`); await logout(); return; }
            console.log(`[AuthProvider][${functionCallId}] Determined User Type:`, userType);

            // --- Build Base Session ---
            let currentUserSession: UserSession = {
                user: { id: authSession.user.id, email: authSession.user.email! },
                userType: userType, musicLoverProfile: null, organizerProfile: null,
            };

            if ((userType === 'organizer') !== isOrganizerMode) {
                setIsOrganizerMode(userType === 'organizer');
                console.log(`[AuthProvider][${functionCallId}] Set Organizer Mode: ${userType === 'organizer'}`);
            }

            // --- Fetch Specific Profile ---
            let profileJustCompleted = false;
            if (userType === 'music_lover') {
                console.log(`[AuthProvider][${functionCallId}] Fetching Music Lover profile...`);
                const { data: profile, error: profileError } = await supabase
                    .from('music_lover_profiles') // *** CHECK TABLE NAME ***
                    .select('*, selected_streaming_service, profile_picture') // *** CHECK COLUMN NAMES ***
                    .eq('user_id', authSession.user.id) // *** Ensure user_id is the FK column ***
                    .maybeSingle();

                if (profileError) { console.error(`[AuthProvider][${functionCallId}] Error fetch ML profile:`, profileError); }
                else if (profile) {
                    console.log(`[AuthProvider][${functionCallId}] Music lover profile FOUND. User: ${profile.username}, PicURL: ${profile.profile_picture ? 'Yes' : 'No'}`);
                    currentUserSession.musicLoverProfile = {
                        id: profile.id, userId: profile.user_id, firstName: profile.first_name, lastName: profile.last_name,
                        username: profile.username, email: profile.email, age: profile.age,
                        profilePicture: profile.profile_picture, // Use the fetched URL
                        bio: profile.bio || {}, country: profile.country, city: profile.city,
                        termsAccepted: profile.terms_accepted ?? false, isPremium: profile.is_premium ?? false,
                        musicData: profile.music_data || {},
                        selectedStreamingService: profile.selected_streaming_service,
                    };
                    if (!wasMusicLoverProfileComplete && currentUserSession.musicLoverProfile) {
                        profileJustCompleted = true;
                        console.log(`[AuthProvider][${functionCallId}] Music Lover profile JUST COMPLETED.`);
                    }
                } else console.log(`[AuthProvider][${functionCallId}] No music lover profile found in DB yet.`);

            } else if (userType === 'organizer') {
                console.log(`[AuthProvider][${functionCallId}] Fetching Organizer profile...`);
                const { data: profile, error: profileError } = await supabase
                    .from('organizer_profiles') // *** CHECK TABLE NAME ***
                    .select('*, logo') // *** CHECK logo COLUMN NAME ***
                    .eq('user_id', authSession.user.id) // *** Ensure user_id is the FK column ***
                    .maybeSingle();

                if (profileError) { console.error(`[AuthProvider][${functionCallId}] Error fetch Org profile:`, profileError); }
                else if (profile) {
                    console.log(`[AuthProvider][${functionCallId}] Organizer profile FOUND. Company: ${profile.company_name}, LogoURL: ${profile.logo ? 'Yes' : 'No'}`);
                    currentUserSession.organizerProfile = {
                        id: profile.id, userId: profile.user_id, companyName: profile.company_name,
                        email: profile.email, phoneNumber: profile.phone_number, businessType: profile.business_type,
                        bio: profile.bio, website: profile.website, logo: profile.logo // Use the fetched logo URL
                    };
                    if (!wasOrganizerProfileComplete && currentUserSession.organizerProfile) {
                        profileJustCompleted = true;
                        console.log(`[AuthProvider][${functionCallId}] Organizer profile JUST COMPLETED.`);
                    }
                } else console.log(`[AuthProvider][${functionCallId}] No organizer profile found in DB yet.`);
            }

            // --- Update State ---
            console.log(`[AuthProvider][${functionCallId}] Updating session state. Profile Just Completed Flag: ${profileJustCompleted}`);
            setSession(currentUserSession);

            // --- Navigate on Profile Completion (if requested) ---
            if (profileJustCompleted && navigateAfterProfileComplete) {
                console.log(`[AuthProvider][${functionCallId}] Profile completed & navigation requested. Scheduling navigation check...`);
                setTimeout(() => {
                    if (navigationRef.current && navigationRef.current.isReady()) {
                        console.log(`[AuthProvider][${functionCallId}] Navigation ref ready. Triggering navigation reset...`);
                        const targetTab = currentUserSession.userType === 'music_lover' ? 'UserTabs' : 'OrganizerTabs';
                        const targetScreen = currentUserSession.userType === 'music_lover' ? 'Profile' : 'OrganizerProfile'; // *** CHECK SCREEN NAMES ***

                        try {
                            navigationRef.current.reset({
                                index: 0,
                                routes: [{ name: 'MainApp', state: { routes: [{ name: targetTab, state: { routes: [{ name: targetScreen }] } }] } }], // *** CHECK NAVIGATOR NAMES ***
                            });
                            console.log(`[AuthProvider][${functionCallId}] Navigation reset attempted to ${targetTab} -> ${targetScreen}`);
                        } catch (navError) {
                            console.error(`[AuthProvider][${functionCallId}] Navigation reset FAILED:`, navError);
                            console.error(`[AuthProvider][${functionCallId}] HINT: Double-check navigator/screen names in the reset config.`);
                        }
                    } else {
                        console.warn(`[AuthProvider][${functionCallId}] Profile completed, nav requested, but navigation ref NOT READY after delay. Navigation skipped.`);
                    }
                }, 250);
            } else {
                console.log(`[AuthProvider][${functionCallId}] Conditions for navigation not met (ProfileCompleted: ${profileJustCompleted}, NavRequested: ${navigateAfterProfileComplete})`);
            }

        } catch (error: any) {
            console.error(`[AuthProvider][${functionCallId}] UNEXPECTED error during checkSession:`, error);
            setSession(null); setIsOrganizerMode(false);
        } finally {
            if (loading) {
                setLoading(false);
                console.log(`[AuthProvider][${functionCallId}] FINISHED initial load. Set loading=false`);
            } else {
                console.log(`[AuthProvider][${functionCallId}] FINISHED subsequent check.`);
            }
        }
    };


    // --- Auth Listener ---
    useEffect(() => {
        console.log('[AuthProvider] Setting up onAuthStateChange listener.');
        // Initial check is important here if listener might miss INITIAL_SESSION
        if (loading) {
             console.log('[AuthProvider] Initial load: Calling checkSession from useEffect.');
             checkSession();
        }

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentAuthSession) => {
            console.log(`[AuthProvider] Auth State Change Event: ${event}`, currentAuthSession ? `User: ${currentAuthSession.user?.id}` : 'SIGNED_OUT or NULL');
            switch (event) {
                case 'SIGNED_IN':
                case 'INITIAL_SESSION': // Often triggers on startup
                case 'TOKEN_REFRESHED':
                case 'USER_UPDATED':
                case 'PASSWORD_RECOVERY':
                    console.log(`[AuthProvider] Auth Event (${event}): Calling checkSession...`);
                    await checkSession(); // No forced navigation here
                    break;
                case 'SIGNED_OUT':
                    console.log('[AuthProvider] Auth Event: SIGNED_OUT received.');
                    setSession(null);
                    setIsOrganizerMode(false);
                    if (loading) setLoading(false);
                    break;
                default:
                    console.log('[AuthProvider] Auth Event: Unhandled or less common:', event);
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
        setLoading(true);
        try {
            const { email, password, userType, firstName, lastName, username } = credentials;
            if (!email || !password || !userType) {
                console.error('[AuthProvider] signUp: Missing required fields.');
                return { error: new Error('Missing required fields (email, password, userType).') };
            }

            console.log('[AuthProvider] signUp: Calling Supabase auth.signUp...');
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email, password, options: { data: { user_type: userType, /* optional: first_name, last_name */ } }
            });
            if (authError || !authData?.user) {
                console.error('[AuthProvider] signUp: Supabase Auth Error:', JSON.stringify(authError, null, 2) || 'No user data returned');
                if (authError?.message.includes('User already registered')) return { error: new Error('Email already in use. Please try logging in.') };
                if (authError?.message.includes('Password should be')) return { error: new Error('Password is too weak. Please use a stronger one.') };
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
            const dbData: Omit<DbMusicLoverProfile, 'id' | 'created_at' | 'updated_at'> = { // *** CHECK TYPE vs DB ***
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
                profile_picture: publicImageUrl, // *** CHECK COLUMN NAME *** Use the URL from _uploadImage or null
                selected_streaming_service: profileData.selectedStreamingService, // *** CHECK COLUMN NAME ***
                music_data: {},
                is_premium: false,
            };
            console.log('[AuthProvider] createMusicLoverProfile: Preparing to upsert profile data:', { ...dbData, profile_picture: dbData.profile_picture ? 'URL exists' : 'null' });

            // --- Upsert Profile in DB ---
            const { data: upsertData, error: upsertError } = await supabase
                .from('music_lover_profiles') // *** CHECK TABLE NAME ***
                .upsert(dbData, { onConflict: 'user_id' })
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
            const organizerDbData: Omit<DbOrganizerProfile, 'id' | 'created_at' | 'updated_at'> = { // *** CHECK TYPE vs DB ***
                user_id: profileData.userId,
                company_name: profileData.companyName.trim(),
                email: profileData.email.trim(),
                phone_number: profileData.phoneNumber?.trim() || null,
                business_type: profileData.businessType || null,
                bio: profileData.bio?.trim() || null,
                website: profileData.website?.trim() || null,
                logo: publicLogoUrl, // *** CHECK COLUMN NAME *** Use the URL from _uploadImage or null
            };
            console.log('[AuthProvider] createOrganizerProfile: Preparing to upsert profile data:', { ...organizerDbData, logo: organizerDbData.logo ? 'URL exists' : 'null' });

            // --- Upsert Profile in DB ---
            const { data: upsertData, error: upsertError } = await supabase
                .from('organizer_profiles') // *** CHECK TABLE NAME ***
                .upsert(organizerDbData, { onConflict: 'user_id' })
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
        console.log(`[AuthProvider] login: Attempting login for Type: ${credentials.userType}, Email: ${credentials.email}`);
        setLoading(true);
        try {
            const { email, password, userType } = credentials;
            if (!email || !password || !userType) {
                console.error('[AuthProvider] login: Missing required fields.');
                return { error: new Error('Please enter email, password, and select account type.') };
            }

            console.log('[AuthProvider] login: Calling Supabase auth.signInWithPassword...');
            const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });

            if (loginError) {
                console.error("[AuthProvider] login: Supabase signIn Error:", loginError);
                if (loginError.message.includes('Invalid login credentials')) {
                    return { error: { message: 'Invalid email or password. Please check and try again.' } };
                }
                return { error: { message: `Login failed: ${loginError.message}` } };
            }
            if (!loginData?.user) {
                console.error('[AuthProvider] login: Login successful but no user data returned.');
                return { error: new Error('Login failed: Could not retrieve user data.') };
            }
            const userId = loginData.user.id;
            console.log('[AuthProvider] login: Sign in successful via Supabase Auth for user:', userId);

            // --- Verify User Type from DB ---
            console.log('[AuthProvider] login: Verifying user type from DB...');
            const { data: typeData, error: typeError } = await supabase
                .from('user_types') // *** CHECK TABLE NAME ***
                .select('type')
                .eq('user_id', userId)
                .single();

            if (typeError || !typeData) {
                console.error(`[AuthProvider] login: Failed to verify DB user type for ${userId}:`, typeError || 'No type data found');
                await logout();
                return { error: { message: 'Login failed: Could not verify account type. Please contact support.' } };
            }
            const dbUserType = typeData.type as UserTypes;
            console.log(`[AuthProvider] login: DB user type confirmed as: ${dbUserType}`);

            // --- Check Type Mismatch ---
            if (dbUserType !== userType) {
                console.warn(`[AuthProvider] login: TYPE MISMATCH! User ${userId} tried logging in via ${userType} portal, but DB type is ${dbUserType}. Signing out.`);
                await logout();
                return { error: { message: `Incorrect login portal. This email is registered as a ${dbUserType === 'music_lover' ? 'Music Lover' : 'Organizer'}. Please use the correct login page.` } };
            }
            console.log('[AuthProvider] login: User type verified successfully.');

            // --- Set Organizer Mode & Refresh Session ---
            setIsOrganizerMode(dbUserType === 'organizer');
            await checkSession(); // Refresh session data *without* forced navigation
            console.log('[AuthProvider] login: Session refreshed after successful login.');

            return { user: loginData.user }; // Let calling screen handle navigation

        } catch (error: any) {
            console.error('[AuthProvider] login: UNEXPECTED error:', error);
            return { error: new Error('An unexpected error occurred during login.') };
        } finally {
            setLoading(false);
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
            setIsOrganizerMode(false);
            setLoading(false);
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
}; // <<< End of AuthProvider

// Custom hook
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

