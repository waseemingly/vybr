import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
    ActivityIndicator, Alert, Animated, Image, Platform,
    Dimensions, Keyboard, Easing
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
// Import specific icon sets from @expo/vector-icons
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons'; // Keep Feather for other icons
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth'; // Adjust import path as needed
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth'; // Spotify auth hook
import { useAppleMusicAuth } from '@/hooks/useAppleMusicAuth'; // Apple Music auth hook
import { APP_CONSTANTS } from '@/config/constants'; // Assuming path is correct
import { supabase } from '@/lib/supabase'; // Add supabase import
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser'; // Add WebBrowser for opening URLs in new tabs
// Import location selectors
import { Picker } from '@react-native-picker/picker';
import { Country, State, City } from 'country-state-city';
// Import the specific types expected by createMusicLoverProfile and for the form state
import { MusicLoverBio, CreateMusicLoverProfileData } from '@/hooks/useAuth'; // Assuming types are exported from useAuth
import TermsModal from '@/components/TermsModal'; // Import the new modal
import ImageCropper from '@/components/ImageCropper'; // Add ImageCropper
// Import navigation types
import type { RootStackParamList, MainStackParamList } from '@/navigation/AppNavigator'; // Import stack param lists
import { authStyles } from '@/styles/authStyles'; // Import authStyles

// Define window width for animations
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

// Step types
type Step = 'username' | 'profile-details' | 'streaming-service' | 'subscription';
type SubscriptionTier = 'free' | 'premium' | '';
type StreamingServiceId = 'spotify' | 'apple_music' | 'youtubemusic' | 'deezer' | 'soundcloud' | 'tidal' | 'None' | ''; // Updated 'youtube_music' to 'youtubemusic'

// Define Streaming Services Data - UPDATED with correct service IDs
const STREAMING_SERVICES = [
    { id: 'spotify', name: 'Spotify', icon: 'spotify', color: '#1DB954', iconSet: 'FontAwesome', description: 'Browser authentication required' },
    { id: 'apple_music', name: 'Apple Music', icon: 'apple', color: '#FA57C1', iconSet: 'FontAwesome', description: 'Connect your Apple Music' },
    { id: 'youtubemusic', name: 'YouTube Music', icon: 'youtube-play', color: '#FF0000', iconSet: 'FontAwesome', description: 'Data synced externally' }, // Updated description
    { id: 'deezer', name: 'Deezer', icon: 'deezer', color: '#EF5466', iconSet: 'MaterialCommunityIcons', description: 'Connect your Deezer account' },
    { id: 'soundcloud', name: 'SoundCloud', icon: 'soundcloud', color: '#FF5500', iconSet: 'FontAwesome', description: 'Connect to SoundCloud' },
    { id: 'tidal', name: 'Tidal', icon: 'headphones', color: '#000000', iconSet: 'Feather', description: 'Connect your Tidal account' },
];

// --- Update the type for form data ---
interface MusicLoverFormData {
    firstName: string;
    lastName: string;
    username: string;
    termsAccepted: boolean;
    profilePictureUri: string;         // Local URI for upload / preview
    profilePicturePreview: string;     // URI specifically for display (often same as Uri)
    profilePictureMimeType?: string | null; // <<< ADD mimeType field
    age: string;                       // Keep as string for input
    // Updated location fields
    countryCode: string;              // Store ISO code
    country: string;                  // Store country name
    stateCode: string;                // Store state code 
    state: string;                    // Store state name
    cityName: string;                 // Store city name
    bio: MusicLoverBio;
    selectedStreamingService: StreamingServiceId;
    subscriptionTier: SubscriptionTier;
    paymentInfo: {
        cardNumber: string;
        expiry: string;
        cvv: string;
        name: string;
    };
}

// --- Placeholder Terms Text (Replace with actual legal text) ---
const termsAndConditionsText = `Vybr Terms & Conditions (Placeholder)

Last Updated: [Date]

Welcome to Vybr! Please read these Terms & Conditions ("Terms") carefully before using the Vybr mobile application ("Service").

1. Acceptance of Terms
By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the terms, you may not access the Service. This is a placeholder text and not legally binding. You must consult with a legal professional to draft comprehensive and compliant Terms & Conditions for your specific service, location, and features.

2. Description of Service
Vybr is a platform designed to connect music lovers and event organizers. Features include profile creation, event discovery, matching based on musical preferences, chat functionalities, and potential premium subscription services.

3. User Accounts
You are responsible for safeguarding your account information, including your password. You agree not to disclose your password to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account. You must provide accurate and complete information when creating your account.

4. User Conduct
You agree not to use the Service to:
   - Post unauthorized commercial communications (such as spam).
   - Collect users' content or information, or otherwise access the Service using automated means.
   - Engage in unlawful, misleading, malicious, or discriminatory activity.
   - Bully, intimidate, or harass any user.
   - Post content that is hate speech, threatening, pornographic, incites violence, or contains nudity or graphic/gratuitous violence.
   - Do anything that could disable, overburden, or impair the proper working or appearance of Vybr.
   - Violate any applicable laws or regulations.

5. Content Ownership
You retain ownership of the content you post on Vybr. By posting content, you grant Vybr a non-exclusive, transferable, sub-licensable, royalty-free, worldwide license to use, display, reproduce, and distribute such content on and through the Service.

6. Music Data & Privacy
If you link streaming services or manually input music preferences, you consent to Vybr analyzing this data to provide matching and recommendation features. Your privacy is important to us. Please review our Privacy Policy [Link to Privacy Policy - REQUIRED] for details on how we collect, use, and protect your information.

7. Premium Services & Payments (If Applicable)
Specific terms related to subscription fees, billing cycles, renewals, and cancellations for any premium features will be presented at the time of subscription.

8. Termination
We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.

9. Disclaimers
The Service is provided on an "AS IS" and "AS AVAILABLE" basis. Vybr makes no warranties, expressed or implied, and hereby disclaims all other warranties including, without limitation, implied warranties of merchantability, fitness for a particular purpose, or non-infringement.

10. Limitation of Liability
In no event shall Vybr, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages arising out of your use of the Service.

11. Governing Law
These Terms shall be governed by the laws of [Your Jurisdiction - REQUIRED], without regard to its conflict of law provisions.

12. Changes to Terms
We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of any changes by posting the new Terms on the Service.

13. Contact Us
If you have any questions about these Terms, please contact us at [Your Support Email/Contact Info - REQUIRED].

By checking the box, you acknowledge that you have read, understood, and agree to be bound by these Terms & Conditions.`;

// Define the specific navigation prop type for this screen
type MusicLoverSignUpNavigationProp = NavigationProp<RootStackParamList & MainStackParamList>;

const MusicLoverSignUpFlow = () => {
    const navigation = useNavigation<MusicLoverSignUpNavigationProp>(); // Use the specific type
    // Use functions from useAuth hook
    const {
        signUp,
        createMusicLoverProfile,
        updatePremiumStatus,
        requestMediaLibraryPermissions, // Use this before picking
        loading: authLoading, // Hook's loading state
        checkUsernameExists, // Use these real functions from useAuth
        checkEmailExists,     // Use these real functions from useAuth 
        // verifyEmailIsReal,    // Removed email verification function
        signInWithGoogle,     // Add Google Sign-In function
        verifyGoogleAuthCompleted, // Add new function
        updateUserMetadata,   // Add function to update user metadata
        setSetupInProgress,   // Add function to prevent navigation bouncing
    } = useAuth();
    
    // Spotify auth hook
    const {
        login: spotifyLogin,
        isLoggedIn: isSpotifyLoggedIn,
        isLoading: isSpotifyLoading,
        error: spotifyError,
        forceFetchAndSaveSpotifyData,
        verifyAuthorizationCompleted
    } = useSpotifyAuth();
    
    // Apple Music auth hook
    const {
        login: appleMusicLogin,
        isLoggedIn: isAppleMusicLoggedIn,
        isLoading: isAppleMusicLoading,
        error: appleMusicError,
        forceFetchAndSaveAppleMusicData,
        verifyAuthorizationCompleted: verifyAppleMusicAuthorizationCompleted
    } = useAppleMusicAuth();
    
    // --- Update initial state ---
    const [formData, setFormData] = useState<MusicLoverFormData>({
        firstName: '',
        lastName: '',
        username: '',
        termsAccepted: false,
        profilePictureUri: '',
        profilePicturePreview: '',
        profilePictureMimeType: null,
        age: '',
        countryCode: '',
        country: '',
        stateCode: '',
        state: '',
        cityName: '',
        bio: { firstSong: '', goToSong: '', mustListenAlbum: '', dreamConcert: '', musicTaste: '' },
        selectedStreamingService: '',
        subscriptionTier: '',
        paymentInfo: { cardNumber: '', expiry: '', cvv: '', name: '' },
    });

    // State variables
    const [currentStep, setCurrentStep] = useState<Step>('username');
    const [isTermsModalVisible, setIsTermsModalVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false); // Component-level loading (e.g., payment sim)
    const [error, setError] = useState('');
    const slideAnim = useRef(new Animated.Value(0)).current; // Animation value
    const fadeAnim = useRef(new Animated.Value(1)).current; // Fade animation value

    // Add state to hold Google User ID
    const [googleUserId, setGoogleUserId] = useState<string | null>(null);

    // Navigation state to prevent auto-navigation after manual back navigation
    const [isManualBackNavigation, setIsManualBackNavigation] = useState(false);

    // Debug function to check current authentication state
    const debugAuthState = async () => {
        console.log('[MusicLoverSignUpFlow] 🔍 DEBUG: Checking authentication state...');
        
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            console.log('[MusicLoverSignUpFlow] 📊 Session debug:', {
                hasSession: !!session,
                sessionError: error,
                userId: session?.user?.id,
                userEmail: session?.user?.email,
                userMetadata: session?.user?.user_metadata,
                accessToken: session?.access_token ? 'Present' : 'Missing',
                refreshToken: session?.refresh_token ? 'Present' : 'Missing',
                expiresAt: session?.expires_at,
                tokenType: session?.token_type
            });

            // Check if we can query the database
            const { data: profileData, error: profileError } = await supabase
                .from('music_lover_profiles')
                .select('*')
                .eq('user_id', session?.user?.id)
                .single();

            console.log('[MusicLoverSignUpFlow] 🗄️ Profile query result:', {
                hasProfile: !!profileData,
                profileError: profileError,
                profileId: profileData?.id
            });

        } catch (error) {
            console.error('[MusicLoverSignUpFlow] ❌ Error in debug auth state:', error);
        }
    };

    // Debug function to check OAuth user creation issue
    const diagnoseOAuthUserCreation = async () => {
        console.log('[MusicLoverSignUpFlow] 🔍 Diagnosing OAuth user creation...');
        
        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            if (!session?.user) {
                console.log('[MusicLoverSignUpFlow] ❌ No session found');
                return;
            }
            
            const userId = session.user.id;
            console.log('[MusicLoverSignUpFlow] 👤 Checking user:', userId);
            
            // Check auth.users table (we can't directly query this, but we can check via getUser)
            try {
                const { data: authUser, error: authError } = await supabase.auth.getUser();
                console.log('[MusicLoverSignUpFlow] 📊 Auth user check:', {
                    found: !!authUser?.user,
                    error: authError?.message
                });
            } catch (authCheckError) {
                console.error('[MusicLoverSignUpFlow] ❌ Auth user check failed:', authCheckError);
            }
            
            // Check public.users table
            try {
                const { data: publicUser, error: publicError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', userId)
                    .single();
                
                console.log('[MusicLoverSignUpFlow] 📊 Public user check:', {
                    found: !!publicUser,
                    data: publicUser,
                    error: publicError?.message
                });
                
                if (!publicUser && !publicError) {
                    console.log('[MusicLoverSignUpFlow] 🔧 User not found in public.users, attempting to create...');
                    
                    const { data: createUser, error: createError } = await supabase
                        .from('users')
                        .insert({
                            id: userId,
                            email: session.user.email,
                            user_type: 'music_lover'
                        })
                        .select()
                        .single();
                    
                    console.log('[MusicLoverSignUpFlow] 📊 Manual user creation:', {
                        success: !!createUser,
                        data: createUser,
                        error: createError?.message
                    });
                }
            } catch (publicCheckError) {
                console.error('[MusicLoverSignUpFlow] ❌ Public user check failed:', publicCheckError);
            }
            
            // Check music_lover_profiles table
            try {
                const { data: profileCheck, error: profileError } = await supabase
                    .from('music_lover_profiles')
                    .select('*')
                    .eq('user_id', userId)
                    .single();
                
                console.log('[MusicLoverSignUpFlow] 📊 Profile check:', {
                    found: !!profileCheck,
                    error: profileError?.message
                });
            } catch (profileCheckError) {
                console.error('[MusicLoverSignUpFlow] ❌ Profile check failed:', profileCheckError);
            }
            
        } catch (error) {
            console.error('[MusicLoverSignUpFlow] ❌ Error in OAuth diagnosis:', error);
        }
    };

    // Web cropping state
    const [showCropper, setShowCropper] = useState(false);
    const [tempImageUri, setTempImageUri] = useState<string | null>(null);

    // Input Refs for focus management
    const lastNameInputRef = useRef<TextInput>(null);
    const usernameInputRef = useRef<TextInput>(null);

    // Username and Email validation state
    const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid' | 'error'>('idle');

    // Debug effect to monitor authentication state
    useEffect(() => {
        console.log('[MusicLoverSignUpFlow] 🔄 Component mounted, checking auth state...');
        debugAuthState();
    }, []);

    // Debug effect to monitor Google user ID changes
    useEffect(() => {
        if (googleUserId) {
            console.log('[MusicLoverSignUpFlow] 🔄 Google user ID changed:', googleUserId);
            debugAuthState();
        }
    }, [googleUserId]);

    // Comprehensive debugging function
    const runFullDiagnostics = async () => {
        console.log('[MusicLoverSignUpFlow] 🔍 Running full diagnostics...');
        
        // 1. Check current session
        await debugAuthState();
        
        // 2. Check OAuth user creation
        await diagnoseOAuthUserCreation();
        
        // 3. Check database connectivity
        try {
            const { data: testQuery, error: testError } = await supabase
                .from('users')
                .select('count')
                .limit(1);
            
            console.log('[MusicLoverSignUpFlow] 📊 Database connectivity test:', {
                success: !testError,
                error: testError?.message
            });
        } catch (dbError) {
            console.error('[MusicLoverSignUpFlow] ❌ Database connectivity test failed:', dbError);
        }
        
        // 4. Check RLS policies
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: rlsTest, error: rlsError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', session.user.id);
                
                console.log('[MusicLoverSignUpFlow] 📊 RLS policy test:', {
                    success: !rlsError,
                    error: rlsError?.message,
                    canReadOwnRecord: !!rlsTest
                });
            }
        } catch (rlsError) {
            console.error('[MusicLoverSignUpFlow] ❌ RLS policy test failed:', rlsError);
        }
        
        // 5. Check foreign key constraints
        try {
            const { data: constraintCheck, error: constraintError } = await supabase
                .rpc('get_foreign_key_constraints', { table_name: 'music_lover_profiles' });
            
            console.log('[MusicLoverSignUpFlow] 📊 Foreign key constraints check:', {
                success: !constraintError,
                error: constraintError?.message,
                constraints: constraintCheck
            });
        } catch (constraintError) {
            console.error('[MusicLoverSignUpFlow] ❌ Foreign key constraints check failed:', constraintError);
        }
        
        console.log('[MusicLoverSignUpFlow] ✅ Full diagnostics completed');
    };
    const [usernameFeedback, setUsernameFeedback] = useState('');

    // Location data lists
    const [countries, setCountries] = useState<any[]>([]);
    const [states, setStates] = useState<any[]>([]);
    const [cities, setCities] = useState<any[]>([]);

    // Handle form field changes (robust version)
    const handleChange = (field: keyof MusicLoverFormData | string, value: any) => { // Use keyof or string for nested fields
        const trimmedValue = (typeof value === 'string' && !field.startsWith('paymentInfo.') && field !== 'password' && field !== 'confirmPassword' && field !== 'selectedStreamingService' && field !== 'profilePictureUri' && field !== 'profilePicturePreview' && field !== 'profilePictureMimeType')
            ? value.trimStart()
            : value;

        if (field === 'username') {
            setUsernameStatus('idle');
            setUsernameFeedback('');
        }

        if (field.startsWith('bio.')) {
            const bioField = field.split('.')[1] as keyof MusicLoverBio;
            const trimmedBioValue = typeof trimmedValue === 'string' ? trimmedValue.trimStart() : trimmedValue;
            setFormData(prev => ({ ...prev, bio: { ...prev.bio, [bioField]: trimmedBioValue } }));
        } else if (field.startsWith('paymentInfo.')) {
            const key = field.split('.')[1] as keyof MusicLoverFormData['paymentInfo'];
            let processedValue = typeof value === 'string' ? value.trim() : value;
            if (key === 'cardNumber') processedValue = processedValue.replace(/\D/g, '');
            if (key === 'expiry') {
                processedValue = processedValue.replace(/\D/g, '');
                const currentExpiry = formData.paymentInfo.expiry;
                // Improved expiry formatting MM/YY
                if (processedValue.length > currentExpiry.length && processedValue.length === 2 && !currentExpiry.includes('/')) {
                   processedValue = processedValue + '/';
                } else if (processedValue.length === 3 && currentExpiry.length === 4 && processedValue.charAt(2) !== '/') {
                    processedValue = processedValue.slice(0, 2) + '/' + processedValue.slice(2);
                } else if (processedValue.length === 2 && currentExpiry.length === 1) {
                     // Handle backspace from MM/
                    processedValue = processedValue.slice(0,2);
                }
                processedValue = processedValue.slice(0, 5); // Max length MM/YY
            }
            if (key === 'cvv') processedValue = processedValue.replace(/\D/g, '').slice(0, 4);
            setFormData(prev => ({ ...prev, paymentInfo: { ...prev.paymentInfo, [key]: processedValue } }));
        } else {
            // Handle top-level fields including profile picture related ones
            const key = field as keyof MusicLoverFormData;
            setFormData(prev => ({ ...prev, [key]: trimmedValue }));
        }
        if (error) setError(''); // Clear error on change
    };

    // Handle country selection
    const handleCountrySelect = (countryCode: string) => {
        if (countryCode === formData.countryCode) return;
        
        const selectedCountry = countries.find(c => c.isoCode === countryCode);
        handleChange('countryCode', countryCode);
        handleChange('country', selectedCountry?.name || '');
    };

    // Handle state selection
    const handleStateSelect = (stateCode: string) => {
        if (stateCode === formData.stateCode) return;
        
        const selectedState = states.find(s => s.isoCode === stateCode);
        handleChange('stateCode', stateCode);
        handleChange('state', selectedState?.name || '');
    };

    // Handle city selection
    const handleCitySelect = (cityName: string) => {
        if (cityName === formData.cityName) return;
        handleChange('cityName', cityName);
    };

    // Show terms and conditions alert
    const showTermsAndConditions = () => {
        Alert.alert(
            "Terms and Conditions",
            "By creating an account, you agree to Vybr's Terms of Service and Privacy Policy. We collect information like your email, name, chosen username, optional profile details (age, location, bio, picture, streaming service), and subscription status. If you choose Premium, payment info is processed securely. We use this data to provide the service, personalize your experience, facilitate connections, and communicate with you. Your profile information (excluding email unless shared) may be visible to others. See our full Privacy Policy for details.",
            [{ text: "OK" }]
        );
    };

    // Animation functions for step transitions
    const goToNextStep = (nextStep: Step) => {
        // Create a smooth transition sequence
        Animated.sequence([
            // Fade out current content
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true
            }),
            // Slide out to the left while fading
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: -SCREEN_WIDTH * 0.2,
                    duration: 250,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true
                }),
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 250,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true
                })
            ])
        ]).start(() => {
            setCurrentStep(nextStep);
            // Reset position and fade
            slideAnim.setValue(SCREEN_WIDTH * 0.2);
            fadeAnim.setValue(0);
            // Slide in from right with fade in
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 350,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 350,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true
                })
            ]).start();
        });
    };
    const goToPreviousStep = (prevStep: Step) => {
        console.log(`[MusicLoverSignUpFlow] Going to previous step: ${prevStep}`);
        
        // If going back to streaming-service, reset the selection so user can choose again
        if (prevStep === 'streaming-service') {
            console.log('[MusicLoverSignUpFlow] Resetting streaming service selection for fresh choice');
            setIsManualBackNavigation(true);
            handleChange('selectedStreamingService', ''); // Reset streaming service selection
            
            // Reset flag after a brief delay to allow normal flow later
            setTimeout(() => {
                setIsManualBackNavigation(false);
            }, 500);
        }
        
        setCurrentStep(prevStep); // Update state immediately
        
        // Create a smooth transition sequence for going back
        Animated.sequence([
            // Fade out current content
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true
            }),
            // Slide out to the right while fading
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: SCREEN_WIDTH * 0.2,
                    duration: 250,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true
                }),
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 250,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true
                })
            ])
        ]).start(() => {
            // Reset position and fade
            slideAnim.setValue(-SCREEN_WIDTH * 0.2);
            fadeAnim.setValue(0);
            // Slide in from left with fade in
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 350,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 350,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true
                })
            ]).start();
        });
    };

    // --- Validation Functions ---
    const validateUsernameStep = (): boolean => {
        console.log('[MusicLoverSignUpFlow] Validating Username Step...');
        
        // First name check
        if (!formData.firstName.trim()) return false;
        // Last name check  
        if (!formData.lastName.trim()) return false;
        // Username checks
        if (!formData.username.trim()) return false;
        if (/\s/.test(formData.username.trim())) return false;
        if (formData.username.trim().length < 3) return false;
        if (usernameStatus !== 'valid') return false; // Must be checked and valid
        if (!formData.termsAccepted) return false;
        
        console.log('[MusicLoverSignUpFlow] Username Step Validation PASSED.');
        return true;
    };
    
    // Get error message for username step
    const getUsernameError = (): string => {
        if (!formData.firstName.trim()) return 'Please enter your first name';
        if (!formData.lastName.trim()) return 'Please enter your last name';
        if (!formData.username.trim()) return 'Please enter a username';
        if (/\s/.test(formData.username.trim())) return 'Username cannot contain spaces';
        if (formData.username.trim().length < 3) return 'Username must be at least 3 characters';
        if (usernameStatus === 'error') return usernameFeedback;
        if (!formData.termsAccepted) return 'Please accept the Terms and Conditions';
        return '';
    };

    const validateProfileDetailsStep = (): boolean => {
        console.log('[MusicLoverSignUpFlow] Validating Profile Details Step...');
        
        // Don't set error state here
        if (formData.age && (!/^\d+$/.test(formData.age) || parseInt(formData.age, 10) < 1 || parseInt(formData.age, 10) > 120)) {
            return false;
        }
        
        console.log('[MusicLoverSignUpFlow] Profile Details Step Validation PASSED.');
        return true;
    };
    
    // Get error message without setting state
    const getProfileDetailsError = (): string => {
        if (formData.age && (!/^\d+$/.test(formData.age) || parseInt(formData.age, 10) < 1 || parseInt(formData.age, 10) > 120)) {
            return 'Please enter a valid age (1-120) or leave blank';
        }
        return '';
    };

    const validateStreamingServiceStep = (): boolean => {
        console.log('[MusicLoverSignUpFlow] Validating Streaming Service Step...');
        
        // Don't set error state here
        if (!formData.selectedStreamingService) {
            return false;
        }
        
        console.log('[MusicLoverSignUpFlow] Streaming Service Step Validation PASSED.');
        return true;
    };
    
    // Get error message without setting state
    const getStreamingServiceError = (): string => {
        if (!formData.selectedStreamingService) {
            return 'Please select a streaming service or "None / Other"';
        }
        return '';
    };

    const validateSubscriptionStep = (): boolean => {
        console.log('[MusicLoverSignUpFlow] Validating Subscription Step...');
        
        // Don't set error state here
        if (!formData.subscriptionTier) {
            return false;
        }
        
        console.log('[MusicLoverSignUpFlow] Subscription Step Validation PASSED.');
        return true;
    };
    
    // Get error message without setting state
    const getSubscriptionError = (): string => {
        if (!formData.subscriptionTier) {
            return 'Please select a subscription tier (Free or Premium).';
        }
        return '';
    };

    // --- Modify handleProfilePicPick to store mimeType ---
    const handleProfilePicPick = async () => {
        console.log('[MusicLoverSignUpFlow] handleProfilePicPick called.');
        // Request permissions first using the hook's function
        const hasPermission = await requestMediaLibraryPermissions();
        if (!hasPermission) {
            console.log('[MusicLoverSignUpFlow] Permission was denied.');
            // Alert is shown in requestMediaLibraryPermissions if denied
            return;
        }

        try {
            console.log('[MusicLoverSignUpFlow] Launching image picker...');
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: Platform.OS !== 'web', // Only use built-in editing on mobile
                aspect: Platform.OS !== 'web' ? [4, 5] : undefined, // Enforce 4:5 aspect ratio for cropping on mobile
                quality: 0.8, // Balance quality and size
                base64: Platform.OS === 'web', // Request base64 on web for cropping
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                // Log asset details for debugging
                console.log(`[MusicLoverSignUpFlow] Image selected. URI: ${asset.uri.substring(0, 100)}...`);
                console.log(`[MusicLoverSignUpFlow] >> MimeType: ${asset.mimeType}, Size: ${asset.fileSize}, Width: ${asset.width}, Height: ${asset.height}`);

                if (Platform.OS === 'web') {
                    // On web, show cropper first
                    setTempImageUri(asset.uri);
                    setShowCropper(true);
                } else {
                    // On mobile, use the cropped result directly
                    // *** STORE URI AND MIME TYPE IN STATE ***
                    handleChange('profilePictureUri', asset.uri);
                    handleChange('profilePicturePreview', asset.uri);
                    handleChange('profilePictureMimeType', asset.mimeType); // Store the mimeType

                    setError(''); // Clear any previous errors
                }
            } else {
                console.log('[MusicLoverSignUpFlow] Image picking cancelled or no assets returned.');
            }
        } catch (error: any) {
            console.error('[MusicLoverSignUpFlow] Error picking profile picture:', error);
            setError(`Failed to pick image: ${error.message || 'Unknown error'}`);
            Alert.alert('Image Selection Error', 'Could not select image. Please try again.');
        }
    };

    // Handle cropped image from web cropper
    const handleCroppedImage = (croppedImageUri: string, croppedBase64: string) => {
        handleChange('profilePictureUri', croppedImageUri);
        handleChange('profilePicturePreview', croppedImageUri);
        handleChange('profilePictureMimeType', 'image/jpeg'); // Cropper outputs JPEG
        setShowCropper(false);
        setTempImageUri(null);
        setError(''); // Clear any previous errors
    };

    // Handle cropper cancel
    const handleCropperCancel = () => {
        setShowCropper(false);
        setTempImageUri(null);
    };

    // --- Signup Logic ---

    // Helper to consolidate profile data creation before calling the hook
    const prepareProfileData = async (userId: string): Promise<CreateMusicLoverProfileData> => {
        // Validate age input
        const age = formData.age ? parseInt(formData.age) : null;
        if (formData.age && (age === null || isNaN(age) || age < 1 || age > 120)) {
             Alert.alert('Invalid Age', 'Please enter a valid age between 1 and 120, or leave it blank.');
             throw new Error('Invalid age provided.');
        }

        // Get email from the authenticated user session
        let email = '';
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user?.email) {
            email = sessionData.session.user.email;
            console.log('[MusicLoverSignUpFlow] Got email from authenticated session:', email);
        }

        if (!email) {
            console.error('[MusicLoverSignUpFlow] Could not retrieve email from session.');
            throw new Error('Could not retrieve email from your Google account.');
        }

        // Create a basic profile data object with known properties
        const profileData: any = {
            userId,
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            username: formData.username.trim(),
            email: email,
            age,
            bio: {
                firstSong: formData.bio.firstSong?.trim() || '',
                goToSong: formData.bio.goToSong?.trim() || '',
                mustListenAlbum: formData.bio.mustListenAlbum?.trim() || '',
                dreamConcert: formData.bio.dreamConcert?.trim() || '',
                musicTaste: formData.bio.musicTaste?.trim() || '',
            },
            termsAccepted: formData.termsAccepted,
            selectedStreamingService: formData.selectedStreamingService || 'None',
            profilePictureUri: formData.profilePictureUri,
            profilePictureMimeType: formData.profilePictureMimeType,
        };

        // Add only the location text fields needed for the database
        profileData.country = formData.country || undefined;
        profileData.state = formData.state || undefined;
        profileData.city = formData.cityName || undefined;

        console.log('[MusicLoverSignUpFlow] Prepared profile data:', {
            email: profileData.email,
            username: profileData.username,
        });

        return profileData as CreateMusicLoverProfileData;
    };

    // Completes signup for FREE tier - MODIFIED for Google OAuth
    const handleFreeSignupCompletion = async () => {
        try {
            console.log('[MusicLoverSignUpFlow] 🆓 Starting free signup completion...');
            setIsLoading(true);
            setError('');

            console.log('[MusicLoverSignUpFlow] 🔍 Getting current session...');
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;

            console.log('[MusicLoverSignUpFlow] 📊 Session data:', {
                hasSession: !!session,
                userId: userId,
                userEmail: session?.user?.email,
                userMetadata: session?.user?.user_metadata
            });

            if (!userId) {
                console.error('[MusicLoverSignUpFlow] ❌ No user ID found in session');
                throw new Error("Could not determine user ID from session. Please sign in again.");
            }

            // Add a small delay to ensure user is properly created in auth.users
            console.log('[MusicLoverSignUpFlow] ⏳ Waiting 2 seconds for user creation to complete...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Verify user exists in auth.users before proceeding
            console.log('[MusicLoverSignUpFlow] 🔍 Verifying user exists in database...');
            try {
                const { data: userCheck, error: userCheckError } = await supabase.auth.getUser();
                console.log('[MusicLoverSignUpFlow] 📊 User verification result:', {
                    hasUser: !!userCheck?.user,
                    userId: userCheck?.user?.id,
                    error: userCheckError
                });
                
                if (userCheckError) {
                    console.error('[MusicLoverSignUpFlow] ❌ User verification failed:', userCheckError);
                    throw new Error('User verification failed: ' + userCheckError.message);
                }
                
                if (!userCheck?.user) {
                    console.error('[MusicLoverSignUpFlow] ❌ User not found in database');
                    throw new Error('User not found in database. Please try signing in again.');
                }
            } catch (verifyError) {
                console.error('[MusicLoverSignUpFlow] ❌ Error verifying user:', verifyError);
                throw verifyError;
            }

            // Create the profile for Google OAuth user
            console.log('[MusicLoverSignUpFlow] 🔧 Preparing profile data...');
            const profileData = await prepareProfileData(userId);
            console.log('[MusicLoverSignUpFlow] 📝 Profile data prepared:', {
                userId: profileData.userId,
                firstName: profileData.firstName,
                lastName: profileData.lastName,
                username: profileData.username,
                email: profileData.email,
                selectedStreamingService: profileData.selectedStreamingService,
                termsAccepted: profileData.termsAccepted
            });
            
            console.log('[MusicLoverSignUpFlow] 🚀 Creating music lover profile...');
            const profileResult = await createMusicLoverProfile(profileData);
            
            if ('error' in profileResult && profileResult.error) {
                console.error('[MusicLoverSignUpFlow] ❌ Profile creation error:', profileResult.error);
                throw new Error(profileResult.error.message || 'Failed to create profile');
            }

            console.log('[MusicLoverSignUpFlow] ✅ Profile created successfully');

            // Set premium status to false
            console.log('[MusicLoverSignUpFlow] 🔧 Setting premium status to false...');
            const premiumResult = await updatePremiumStatus(userId, false);
            if ('error' in premiumResult) {
                console.error('[MusicLoverSignUpFlow] ❌ Error updating premium status:', premiumResult.error);
            } else {
                console.log('[MusicLoverSignUpFlow] ✅ Premium status updated successfully');
            }

            // Fetch streaming data if applicable
            if (formData.selectedStreamingService && formData.selectedStreamingService !== 'None') {
                if (formData.selectedStreamingService === 'spotify' && isSpotifyLoggedIn) {
                    console.log('[MusicLoverSignUpFlow] 🎵 Fetching Spotify data...');
                    try {
                        await forceFetchAndSaveSpotifyData(userId, false);
                        console.log('[MusicLoverSignUpFlow] ✅ Spotify data fetched successfully');
                    } catch (spotifyError) {
                        console.error('[MusicLoverSignUpFlow] ❌ Error fetching Spotify data:', spotifyError);
                    }
                } else if (formData.selectedStreamingService === 'apple_music' && isAppleMusicLoggedIn) {
                    console.log('[MusicLoverSignUpFlow] 🎵 Fetching Apple Music data...');
                    try {
                        await forceFetchAndSaveAppleMusicData(userId, false);
                        console.log('[MusicLoverSignUpFlow] ✅ Apple Music data fetched successfully');
                    } catch (appleMusicError) {
                        console.error('[MusicLoverSignUpFlow] ❌ Error fetching Apple Music data:', appleMusicError);
                    }
                } else {
                    console.log('[MusicLoverSignUpFlow] ⏭️ Skipping streaming data fetch:', {
                        selectedStreamingService: formData.selectedStreamingService,
                        isSpotifyLoggedIn: isSpotifyLoggedIn,
                        isAppleMusicLoggedIn: isAppleMusicLoggedIn
                    });
                }
            }

            // Success - navigate to home/dashboard
            console.log('[MusicLoverSignUpFlow] 🎉 Free signup completed successfully, navigating to home.');
            navigation.reset({
                index: 0,
                routes: [{ name: 'MainApp', params: { screen: 'UserTabs' } }],
            });

        } catch (error: any) {
            console.error('[MusicLoverSignUpFlow] ❌ Error in free signup completion:', error);
            console.error('[MusicLoverSignUpFlow] 🔍 Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            setError(error.message || 'An error occurred during signup');
            Alert.alert('Signup Error', error.message || 'An error occurred during signup');
        } finally {
            setIsLoading(false);
        }
    };

    // Completes signup for PREMIUM tier - MODIFIED for Google OAuth
    // Note: handlePremiumSignupCompletion function removed - premium users now go directly to PremiumSignupScreen

    // --- Handle Step Submission (Orchestrator) ---
    const handleStepSubmit = async () => {
        console.log(`[MusicLoverSignUpFlow] handleStepSubmit called for step: ${currentStep}`);
        
        let currentStepIsValid = true;
        let stepErrorMessage = '';

        switch (currentStep) {
            case 'username':
                if (formData.username.trim() && usernameStatus === 'idle') {
                    await handleUsernameBlur(); // await to ensure status updates
                }
                currentStepIsValid = validateUsernameStep();
                if (!currentStepIsValid) {
                    stepErrorMessage = getUsernameError();
                }
                break;
            case 'profile-details':
                currentStepIsValid = validateProfileDetailsStep();
                if (!currentStepIsValid) {
                    stepErrorMessage = getProfileDetailsError();
                }
                break;
            case 'streaming-service':
                currentStepIsValid = validateStreamingServiceStep();
                if (!currentStepIsValid) {
                    stepErrorMessage = getStreamingServiceError();
                }
                break;
            case 'subscription':
                currentStepIsValid = validateSubscriptionStep();
                if (!currentStepIsValid) {
                    stepErrorMessage = getSubscriptionError();
                }
                break;
        }
        
        // Set error if any from non-username/email issues
        setError(stepErrorMessage);
        
        // Only proceed if no errors AND current step specific validation passed
        if (stepErrorMessage || !currentStepIsValid) {
            if (!stepErrorMessage && !currentStepIsValid && (usernameStatus === 'invalid')) {
                // This case means validation failed due to username, and inline feedback is shown.
            } else if (!stepErrorMessage && !currentStepIsValid) {
                 setError("Please complete all required fields and correct any errors."); // Generic fallback
            }
            return;
        }

        switch (currentStep) {
            case 'username':
                goToNextStep('profile-details');
                break;
            case 'profile-details':
                goToNextStep('streaming-service');
                break;
            case 'streaming-service':
                goToNextStep('subscription');
                break;
            case 'subscription':
                // Handle based on subscription tier
                if (formData.subscriptionTier === 'free') {
                    // Free users complete signup immediately
                    console.log('[MusicLoverSignUpFlow] 🆓 Free user selected - completing signup...');
                    await handleFreeSignupCompletion();
                } else if (formData.subscriptionTier === 'premium') {
                    // Premium users need to create profile first, then go to payment
                    console.log('[MusicLoverSignUpFlow] 💎 Premium user selected - creating profile then redirecting to payment...');
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.user) {
                        await handleCreateProfileForPayment(session.user.id);
                        // Navigate to PaymentRequired stack for payment setup
                        (navigation as any).reset({
                            index: 0,
                            routes: [{ name: 'PaymentRequired' }],
                        });
                    } else {
                        setError('You must be signed in to create a premium account. Please sign in first.');
                    }
                }
                break;
        }
    };

    // --- Render Functions for Steps ---

    const renderUsernameStep = () => (
        <View style={[authStyles.signupStepContent, !isWeb && { paddingTop: 20 }]}>
            {/* Header Section */}
            <View style={!isWeb && { alignItems: 'center', marginBottom: 32 }}>
                <Text style={[authStyles.signupStepTitle, !isWeb && { marginBottom: 16, textAlign: 'center' }]}>Create Your Account</Text>
                <Text style={[authStyles.signupStepDescription, !isWeb && { marginBottom: 0, textAlign: 'center' }]}>Let's start with your basic information</Text>
            </View>
            
            {/* Unregistered Email Notice */}
            <View style={{
                backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}10`,
                borderWidth: 1,
                borderColor: `${APP_CONSTANTS.COLORS.PRIMARY}30`,
                borderRadius: isWeb ? 12 : 10,
                padding: isWeb ? 16 : 12,
                marginBottom: isWeb ? 24 : 20,
                alignItems: 'center'
            }}>
                <Feather name="info" size={20} color={APP_CONSTANTS.COLORS.PRIMARY} style={{ marginBottom: 8 }} />
                <Text style={{
                    fontSize: isWeb ? 14 : 13,
                    color: APP_CONSTANTS.COLORS.PRIMARY,
                    fontWeight: '600',
                    textAlign: 'center',
                    marginBottom: 4,
                    fontFamily: 'Inter, sans-serif'
                }}>
                    Email Not Registered
                </Text>
                <Text style={{
                    fontSize: isWeb ? 13 : 12,
                    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
                    textAlign: 'center',
                    lineHeight: isWeb ? 18 : 16,
                    fontFamily: 'Inter, sans-serif'
                }}>
                    Your email address is not registered. Please complete your profile to create your account.
                </Text>
            </View>
            
            {/* Form Section */}
            <View style={!isWeb && { width: '100%' }}>
                {/* First/Last Name Row */}
                <View style={[authStyles.signupRowContainer, !isWeb && { marginBottom: 24 }]}>
                    <View style={[authStyles.signupInputContainer, { 
                        width: isWeb ? '48%' : '48%', 
                        marginRight: isWeb ? 8 : 6, 
                        marginBottom: 0 
                    }]}>
                        <Text style={authStyles.signupInputLabel}>First Name *</Text>
                        <TextInput 
                            style={authStyles.signupInput} 
                            placeholder="First Name" 
                            value={formData.firstName} 
                            onChangeText={(text) => handleChange('firstName', text)} 
                            autoCapitalize="words" 
                            returnKeyType="next" 
                            blurOnSubmit={false} 
                            onSubmitEditing={() => lastNameInputRef.current?.focus()}
                        />
                    </View>
                    <View style={[authStyles.signupInputContainer, { 
                        width: isWeb ? '48%' : '48%', 
                        marginLeft: isWeb ? 8 : 6, 
                        marginBottom: 0 
                    }]}>
                        <Text style={authStyles.signupInputLabel}>Last Name *</Text>
                        <TextInput 
                            ref={lastNameInputRef}
                            style={authStyles.signupInput} 
                            placeholder="Last Name" 
                            value={formData.lastName} 
                            onChangeText={(text) => handleChange('lastName', text)} 
                            autoCapitalize="words" 
                            returnKeyType="next" 
                            blurOnSubmit={false} 
                            onSubmitEditing={() => usernameInputRef.current?.focus()}
                        />
                    </View>
                </View>
                
                {/* Username */}
                <View style={[authStyles.signupInputContainer, !isWeb && { marginBottom: 28 }, isWeb && { marginTop: 24 }]}>
                    <View style={authStyles.signupLabelRow}>
                        <Text style={authStyles.signupInputLabel}>Username *</Text>
                        {usernameStatus === 'checking' && <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} style={authStyles.signupInlineLoader} />}
                    </View>
                    <TextInput 
                        ref={usernameInputRef}
                        style={[
                            authStyles.signupInput,
                            usernameStatus === 'invalid' && authStyles.signupInputError,
                            usernameStatus === 'valid' && authStyles.signupInputValid,
                        ]}
                        placeholder="Choose a unique username (no spaces)" 
                        value={formData.username} 
                        onChangeText={(text) => handleChange('username', text.replace(/\s/g, ''))} 
                        autoCapitalize="none" 
                        autoCorrect={false} 
                        returnKeyType="done" 
                        onBlur={handleUsernameBlur}
                    />
                    {usernameFeedback ? <Text style={[
                        authStyles.signupFeedbackText, 
                        usernameStatus === 'valid' && authStyles.signupFeedbackTextValid,
                        (usernameStatus === 'invalid' || usernameStatus === 'error') && authStyles.signupFeedbackTextError,
                    ]}>{usernameFeedback}</Text> : null}
                </View>

                {/* Terms and Conditions */}
                <View style={[authStyles.signupTermsContainer, !isWeb && { marginBottom: 20, marginTop: 16 }]}>
                    <TouchableOpacity
                        style={[authStyles.signupCheckbox, formData.termsAccepted && authStyles.signupCheckboxChecked]}
                        onPress={() => handleChange('termsAccepted', !formData.termsAccepted)}
                        activeOpacity={0.7}
                    >
                        {formData.termsAccepted && <Feather name="check" size={14} color="white" />}
                    </TouchableOpacity>
                    <Text style={authStyles.signupTermsText}>
                        I agree to the{' '}
                        <Text style={authStyles.signupTermsLink} onPress={() => setIsTermsModalVisible(true)}>
                            Terms and Conditions
                        </Text> *
                    </Text>
                </View>
                
                {error ? <Text style={authStyles.signupErrorText}>{error}</Text> : null}
                <Text style={[authStyles.signupRequiredText, !isWeb && { marginBottom: 32, textAlign: 'center' }]}>* Required fields</Text>
            </View>
            
            {/* Button Section - Centered for mobile */}
            <TouchableOpacity
                style={[
                    authStyles.signupContinueButton,
                    (isLoading || authLoading || usernameStatus !== 'valid') && authStyles.signupContinueButtonDisabled
                ]}
                onPress={async () => {
                    Keyboard.dismiss();
                    await new Promise(resolve => setTimeout(resolve, 100));
                    handleStepSubmit();
                }}
                disabled={isLoading || authLoading || usernameStatus !== 'valid'}
                activeOpacity={0.8}
            >
                {isLoading || authLoading ? (
                    <ActivityIndicator color="white" size="small" />
                ) : (
                    <Text style={authStyles.signupContinueButtonText}>Continue</Text>
                )}
            </TouchableOpacity>
        </View>
    );

    const renderProfileDetailsStep = () => (
        <View style={[authStyles.signupStepContent, !isWeb && { alignItems: 'stretch' }]}>
            <Text style={authStyles.signupStepTitle}>Tell Us About You</Text>
            {/* Profile Picture */}
            {isWeb ? (
                <View style={authStyles.signupInputContainer}>
                    <Text style={[authStyles.signupInputLabel, !isWeb && { textAlign: 'center', alignSelf: 'center', width: '100%' }]}>Profile Picture</Text>
                    <View style={authStyles.signupProfilePicContainer}>
                        {formData.profilePicturePreview ? (
                            <Image source={{ uri: formData.profilePicturePreview }} style={authStyles.signupProfilePicPreview} />
                        ) : (
                            <View style={authStyles.signupProfilePicPlaceholder}>
                                <Feather name="user" size={40} color={APP_CONSTANTS.COLORS.PRIMARY_DARK} />
                            </View>
                        )}
                        <TouchableOpacity style={authStyles.signupUploadButton} onPress={handleProfilePicPick} activeOpacity={0.8}>
                            <Feather name="camera" size={16} color="white" style={{ marginRight: 8 }} />
                            <Text style={authStyles.signupUploadButtonText}>
                                {formData.profilePicturePreview ? 'Change Picture' : 'Select Picture'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'center' }}>
                    <View style={authStyles.signupProfilePicSectionMobile}>
                        <Text style={[authStyles.signupInputLabel, { textAlign: 'center', alignSelf: 'center', width: '100%' }]}>Profile Picture</Text>
                        <View style={authStyles.signupProfilePicContainer}>
                            {formData.profilePicturePreview ? (
                                <Image source={{ uri: formData.profilePicturePreview }} style={authStyles.signupProfilePicPreview} />
                            ) : (
                                <View style={authStyles.signupProfilePicPlaceholder}>
                                    <Feather name="user" size={40} color={APP_CONSTANTS.COLORS.PRIMARY_DARK} />
                                </View>
                            )}
                            <TouchableOpacity style={authStyles.signupUploadButton} onPress={handleProfilePicPick} activeOpacity={0.8}>
                                <Feather name="camera" size={16} color="white" style={{ marginRight: 8 }} />
                                <Text style={authStyles.signupUploadButtonText}>
                                    {formData.profilePicturePreview ? 'Change Picture' : 'Select Picture'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
            
            <View style={!isWeb && { paddingHorizontal: 16 }}>
                {/* Age */}
                <View style={authStyles.signupInputContainer}>
                    <Text style={authStyles.signupInputLabel}>Age</Text>
                    <TextInput 
                        style={authStyles.signupInput} 
                        placeholder="e.g. 25" 
                        value={formData.age} 
                        onChangeText={(text) => handleChange('age', text.replace(/\D/g, ''))} 
                        keyboardType="number-pad" 
                        maxLength={3} 
                        returnKeyType="next" 
                        blurOnSubmit={false} 
                    />
                </View>
                
                {/* Location Section - Country Dropdown */}
                <View style={authStyles.signupInputContainer}>
                    <Text style={authStyles.signupInputLabel}>Country</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={formData.countryCode}
                            onValueChange={handleCountrySelect}
                            style={styles.picker}
                        >
                            <Picker.Item label="Select a country..." value="" />
                            {countries.map((country) => (
                                <Picker.Item 
                                    key={country.isoCode} 
                                    label={country.name} 
                                    value={country.isoCode} 
                                />
                            ))}
                        </Picker>
                    </View>
                </View>
                
                {/* State/Province Dropdown - Only show if country is selected and not Singapore */}
                {formData.countryCode && formData.countryCode !== 'SG' && (
                    <View style={authStyles.signupInputContainer}>
                        <Text style={authStyles.signupInputLabel}>State/Province</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={formData.stateCode}
                                onValueChange={handleStateSelect}
                                style={styles.picker}
                                enabled={states.length > 0}
                            >
                                <Picker.Item label="Select a state..." value="" />
                                {states.map((state) => (
                                    <Picker.Item 
                                        key={state.isoCode} 
                                        label={state.name} 
                                        value={state.isoCode} 
                                    />
                                ))}
                            </Picker>
                        </View>
                    </View>
                )}
                
                {/* City Dropdown - Only show if state is selected */}
                {formData.stateCode && (
                    <View style={authStyles.signupInputContainer}>
                        <Text style={authStyles.signupInputLabel}>City</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={formData.cityName}
                                onValueChange={handleCitySelect}
                                style={styles.picker}
                                enabled={cities.length > 0}
                            >
                                <Picker.Item label="Select a city..." value="" />
                                {cities.map((city) => (
                                    <Picker.Item 
                                        key={city.name} 
                                        label={city.name} 
                                        value={city.name} 
                                    />
                                ))}
                            </Picker>
                        </View>
                    </View>
                )}
                
                {/* Bio Section */}
                <Text style={[authStyles.signupInputLabel, authStyles.signupBioHeader]}>Music Bio (Share your sound!)</Text>
                <View style={[authStyles.signupInputContainer, !isWeb && authStyles.signupBioInputContainerMobile]}>
                    <Text style={[authStyles.signupInputLabelSmall, !isWeb && authStyles.signupBioLabelMobile]}>Your first concert / favorite music memory?</Text>
                    <TextInput style={[authStyles.signupInputBio, !isWeb && authStyles.signupBioInputMobile]} value={formData.bio.firstSong} onChangeText={(text) => handleChange('bio.firstSong', text)} placeholder="That unforgettable show..." multiline returnKeyType="next" blurOnSubmit={false} />
                </View>
                <View style={[authStyles.signupInputContainer, !isWeb && authStyles.signupBioInputContainerMobile]}>
                    <Text style={[authStyles.signupInputLabelSmall, !isWeb && authStyles.signupBioLabelMobile]}>Go-to song right now?</Text>
                    <TextInput style={[authStyles.signupInputBio, !isWeb && authStyles.signupBioInputMobile]} value={formData.bio.goToSong} onChangeText={(text) => handleChange('bio.goToSong', text)} placeholder="The track on repeat..." returnKeyType="next" blurOnSubmit={false} />
                </View>
                <View style={[authStyles.signupInputContainer, !isWeb && authStyles.signupBioInputContainerMobile]}>
                    <Text style={[authStyles.signupInputLabelSmall, !isWeb && authStyles.signupBioLabelMobile]}>An album everyone should listen to?</Text>
                    <TextInput style={[authStyles.signupInputBio, !isWeb && authStyles.signupBioInputMobile]} value={formData.bio.mustListenAlbum} onChangeText={(text) => handleChange('bio.mustListenAlbum', text)} placeholder="Your essential pick..." returnKeyType="next" blurOnSubmit={false} />
                </View>
                <View style={[authStyles.signupInputContainer, !isWeb && authStyles.signupBioInputContainerMobile]}>
                    <Text style={[authStyles.signupInputLabelSmall, !isWeb && authStyles.signupBioLabelMobile]}>Dream concert lineup?</Text>
                    <TextInput style={[authStyles.signupInputBio, !isWeb && authStyles.signupBioInputMobile]} value={formData.bio.dreamConcert} onChangeText={(text) => handleChange('bio.dreamConcert', text)} placeholder="Headliner? Opener?" returnKeyType="next" blurOnSubmit={false} />
                </View>
                <View style={[authStyles.signupInputContainer, !isWeb && authStyles.signupBioInputContainerMobile]}>
                    <Text style={[authStyles.signupInputLabelSmall, !isWeb && authStyles.signupBioLabelMobile]}>Describe your music taste in a few words?</Text>
                    <TextInput style={[authStyles.signupInputBio, !isWeb && authStyles.signupBioInputMobile]} value={formData.bio.musicTaste} onChangeText={(text) => handleChange('bio.musicTaste', text)} placeholder="Indie rock, 90s hip hop, electronic..." returnKeyType="done" onSubmitEditing={handleStepSubmit} />
                </View>
                {error ? <Text style={authStyles.signupErrorText}>{error}</Text> : null}
                
                {/* Back/Continue Buttons */}
                <View style={authStyles.signupButtonContainer}>
                    <TouchableOpacity 
                        style={authStyles.signupSecondaryButton} 
                        onPress={() => goToPreviousStep('username')}
                    >
                        <Text style={authStyles.signupSecondaryButtonText}>Back</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            authStyles.signupPrimaryButton,
                            (isLoading || authLoading) && authStyles.signupPrimaryButtonDisabled
                        ]}
                        onPress={handleStepSubmit}
                        disabled={isLoading || authLoading}
                    >
                        <Text style={authStyles.signupPrimaryButtonText}>Continue</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    // --- Updated Streaming Service Handling ---
    const handleStreamingServiceSelect = async (serviceId: StreamingServiceId) => {
        setError(''); // Clear previous errors
        setFormData(prev => ({ ...prev, selectedStreamingService: serviceId }));

        if (serviceId === 'spotify') {
            // Existing Spotify login logic remains
            console.log('[SignUpFlow] Spotify selected. Initiating login...');
            spotifyLogin(); 
        } else if (serviceId === 'apple_music') {
            // Apple Music login logic
            console.log('[SignUpFlow] Apple Music selected. Initiating login...');
            console.log('[SignUpFlow] Apple Music hook state:', { isAppleMusicLoggedIn, isAppleMusicLoading, appleMusicError });
            appleMusicLogin();
        } else if (serviceId === 'youtubemusic') {
            // YouTube Music selected - NO LONGER triggers UI connection
            // The user just selects it, data is assumed to be synced by the external Python script.
            console.log('[SignUpFlow] YouTube Music selected. Data sync is handled externally.');
            // Removed: setShowYTMCookieInput(true);
        } else if (serviceId !== 'None' && serviceId !== '') {
            Alert.alert(
                "Connection Not Available",
                `Connecting to ${STREAMING_SERVICES.find(s => s.id === serviceId)?.name || serviceId} is not yet implemented in the app. You can select it, but data won't be synced automatically through the app.`
            );
        }
    };

    // When subscription choice changes, update the form and alert about streaming service features
    const handleSubscriptionChange = (tier: SubscriptionTier) => {
        setFormData(prev => ({ ...prev, subscriptionTier: tier }));

        // Show alert about streaming service data limits based on selected service
        if (formData.selectedStreamingService === 'spotify' || formData.selectedStreamingService === 'youtubemusic' || formData.selectedStreamingService === 'apple_music') {
            const serviceName = formData.selectedStreamingService === 'spotify' ? 'Spotify' : 
                               formData.selectedStreamingService === 'apple_music' ? 'Apple Music' : 'YouTube Music';
            const message = tier === 'premium'
                ? `With Premium, you'll get access to your top 5 artists, songs, albums, and genres from ${serviceName}!`
                : `With Free tier, you'll see your top 3 artists, songs, albums, and genres from ${serviceName}. Upgrade to Premium for top 5!`;

            Alert.alert(`${serviceName} Data Access`, message, [{ text: "OK" }]);
        }
    };

    // Effect to navigate after successful Spotify login during signup
    useEffect(() => {
        // Check if we are on the correct step, Spotify is selected, and login just completed
        // Also prevent auto-navigation if user just navigated back manually
        if (currentStep === 'streaming-service' && 
            formData.selectedStreamingService === 'spotify' && 
            isSpotifyLoggedIn && 
            !isManualBackNavigation) {
            
            // Before navigating, verify the authorization was actually completed
            const verifyAuth = async () => {
                const isAuthComplete = await verifyAuthorizationCompleted();
                
                if (isAuthComplete) {
                    console.log('[MusicLoverSignUpFlow] Spotify authorization verified successfully, navigating to subscription step.');
                    goToNextStep('subscription');
                } else {
                    console.log('[MusicLoverSignUpFlow] Spotify authorization reported but not verified. Waiting for completion.');
                    // Don't navigate - the user probably hasn't actually completed the authorization yet
                }
            };
            
            verifyAuth();
        } else if (isManualBackNavigation) {
            console.log('[MusicLoverSignUpFlow] Auto-navigation to subscription prevented due to manual back navigation.');
        }
    }, [isSpotifyLoggedIn, currentStep, formData.selectedStreamingService, verifyAuthorizationCompleted, isManualBackNavigation]);

    // Effect to navigate after successful Apple Music login during signup
    useEffect(() => {
        // Check if we are on the correct step, Apple Music is selected, and login just completed
        // Also prevent auto-navigation if user just navigated back manually
        if (currentStep === 'streaming-service' && 
            formData.selectedStreamingService === 'apple_music' && 
            isAppleMusicLoggedIn && 
            !isManualBackNavigation) {
            
            // Before navigating, verify the authorization was actually completed
            const verifyAuth = async () => {
                const isAuthComplete = await verifyAppleMusicAuthorizationCompleted();
                
                if (isAuthComplete) {
                    console.log('[MusicLoverSignUpFlow] Apple Music authorization verified successfully, navigating to subscription step.');
                    goToNextStep('subscription');
                } else {
                    console.log('[MusicLoverSignUpFlow] Apple Music authorization reported but not verified. Waiting for completion.');
                    // Don't navigate - the user probably hasn't actually completed the authorization yet
                }
            };
            
            verifyAuth();
        } else if (isManualBackNavigation) {
            console.log('[MusicLoverSignUpFlow] Auto-navigation to subscription prevented due to manual back navigation.');
        }
    }, [isAppleMusicLoggedIn, currentStep, formData.selectedStreamingService, verifyAppleMusicAuthorizationCompleted, isManualBackNavigation]);

    // Effect to handle Apple Music login errors during signup
    useEffect(() => {
        if (currentStep === 'streaming-service' && formData.selectedStreamingService === 'apple_music' && appleMusicError) {
            console.error('[MusicLoverSignUpFlow] Apple Music login error detected:', appleMusicError);
            Alert.alert(
                'Apple Music Connection Error',
                appleMusicError || 'Failed to connect to Apple Music. Please try again.',
                [{ text: 'OK' }]
            );
        }
    }, [appleMusicError, currentStep, formData.selectedStreamingService]);

    // Effect to handle Spotify login errors during signup
    useEffect(() => {
        if (currentStep === 'streaming-service' && formData.selectedStreamingService === 'spotify' && spotifyError) {
            console.error('[MusicLoverSignUpFlow] Spotify login error detected:', spotifyError);
            
            // Check for development mode restriction errors
            const isDevelopmentModeError = 
                spotifyError.toString().includes('403') || 
                spotifyError.toString().includes('Forbidden') || 
                spotifyError.toString().includes('not be registered') ||
                spotifyError.toString().includes('test user');
                
            // Changed from setError to Alert to make it less blocking
            Alert.alert(
                isDevelopmentModeError ? "Spotify Development Mode Restriction" : "Spotify Connection Issue",
                isDevelopmentModeError 
                    ? "Your Spotify account needs to be added as a test user in the Spotify Developer Dashboard. In development mode, only pre-approved Spotify accounts can use the app."
                    : `We encountered a problem connecting to Spotify: ${spotifyError}. You can try again, select another service, or continue without connecting.`,
                [
                    { 
                        text: "Try Again", 
                        onPress: () => spotifyLogin() 
                    },
                    { 
                        text: "Continue Anyway", 
                        onPress: () => {
                            // Allow user to continue to subscription step despite error
                            goToNextStep('subscription');
                        }
                    }
                ]
            );
        }
    }, [spotifyError, currentStep, formData.selectedStreamingService]);

    // Load countries on component mount
    useEffect(() => {
        const allCountries = Country.getAllCountries();
        setCountries(allCountries);
    }, []);

    // Load states when country changes
    useEffect(() => {
        if (formData.countryCode) {
            // Special handling for Singapore (no states/provinces)
            if (formData.countryCode === 'SG') {
                setStates([]);
                // For Singapore, set stateCode to a placeholder value
                handleChange('stateCode', 'SG-01');
                handleChange('state', 'Singapore'); // Use country name as state
                return;
            }
            
            const countryStates = State.getStatesOfCountry(formData.countryCode);
            setStates(countryStates);
            
            // If previously selected state is not in new country, reset state and city
            const stateExists = countryStates.some(s => s.isoCode === formData.stateCode);
            if (!stateExists) {
                handleChange('stateCode', '');
                handleChange('state', '');
                handleChange('cityName', '');
            }
        } else {
            setStates([]);
            handleChange('stateCode', '');
            handleChange('state', '');
            handleChange('cityName', '');
        }
    }, [formData.countryCode]);

    // Load cities when state changes
    useEffect(() => {
        if (formData.countryCode && formData.stateCode) {
            const stateCities = City.getCitiesOfState(formData.countryCode, formData.stateCode);
            setCities(stateCities);
            
            // If previously selected city is not in new state, reset city
            const cityExists = stateCities.some(c => c.name === formData.cityName);
            if (!cityExists) {
                handleChange('cityName', '');
            }
        } else {
            setCities([]);
            handleChange('cityName', '');
        }
    }, [formData.countryCode, formData.stateCode]);

    // --- Username and Email Blur Handlers ---
    const handleUsernameBlur = async () => {
        const username = formData.username.trim();
        if (!username) {
            setUsernameStatus('invalid');
            setUsernameFeedback('Username is required.');
            return;
        }
        if (/\s/.test(username)) {
            setUsernameStatus('invalid');
            setUsernameFeedback('Username cannot contain spaces.');
            return;
        }
        if (username.length < 3) {
            setUsernameStatus('invalid');
            setUsernameFeedback('Username must be at least 3 characters.');
            return;
        }

        setUsernameStatus('checking');
        setUsernameFeedback('Checking availability...');
        try {
            // TODO: Replace with: const result = await auth.checkUsernameExists(username);
            const result = await checkUsernameExists(username); 
            if (result.error) {
                setUsernameStatus('error');
                setUsernameFeedback(result.error || 'Could not verify username.');
            } else if (result.exists) {
                setUsernameStatus('invalid');
                setUsernameFeedback('Username is already taken.');
            } else {
                setUsernameStatus('valid');
                setUsernameFeedback('Username available!');
            }
        } catch (e: any) {
            setUsernameStatus('error');
            setUsernameFeedback('Error checking username.');
        }
    };

    const handleEmailBlur = async () => {
        // This function is no longer needed as email is handled by Google OAuth
    };

    // --- Handle Google Sign-In ---
    const handleGoogleSignIn = async () => {
        try {
            setIsLoading(true);
            setError('');
            
            console.log('[MusicLoverSignUpFlow] 🚀 Starting Google Sign-In...');
            console.log('[MusicLoverSignUpFlow] 📊 Current form data state:', {
                subscriptionTier: formData.subscriptionTier,
                selectedStreamingService: formData.selectedStreamingService,
                firstName: formData.firstName,
                lastName: formData.lastName,
                username: formData.username,
                termsAccepted: formData.termsAccepted,
                currentStep: currentStep
            });
            
            const result = await signInWithGoogle();

            if ('error' in result) {
                if ((result.error as any)?.cancelled) {
                    console.log('[MusicLoverSignUpFlow] ❌ Google Sign-In was cancelled by the user.');
                    return; 
                }
                console.error('[MusicLoverSignUpFlow] ❌ Google Sign-In error:', result.error);
                setError(result.error.message || 'Failed to sign in with Google');
                return;
            }
            
            if ('user' in result && result.user) {
                console.log('[MusicLoverSignUpFlow] ✅ Google Sign-In successful!');
                console.log('[MusicLoverSignUpFlow] 👤 User ID:', result.user.id);
                console.log('[MusicLoverSignUpFlow] 📧 User email:', result.user.email);
                console.log('[MusicLoverSignUpFlow] 🏷️ User metadata:', result.user.user_metadata);
                
                // Store Google user ID for reference
                setGoogleUserId(result.user.id);
                
                // Ensure user type is set to music_lover
                console.log('[MusicLoverSignUpFlow] 🔧 Setting user metadata to music_lover...');
                try {
                    await updateUserMetadata('music_lover');
                    console.log('[MusicLoverSignUpFlow] ✅ User metadata updated successfully');
                } catch (metaError) {
                    console.error('[MusicLoverSignUpFlow] ❌ Failed to update user metadata:', metaError);
                }
                
                // CRITICAL: Set setup in progress flag to prevent AppNavigator from routing
                console.log('[MusicLoverSignUpFlow] 🔒 Setting setup in progress - preventing navigation bouncing...');
                setSetupInProgress(true);
                
                // For premium users, create profile with premium status
                if (formData.subscriptionTier === 'premium') {
                    console.log('[MusicLoverSignUpFlow] 💎 Premium user - creating profile...');
                    await handleCreateProfileForPayment(result.user.id);
                    console.log('[MusicLoverSignUpFlow] 💎 Premium profile created - AppNavigator will handle routing to payment...');
                } else if (formData.subscriptionTier === 'free') {
                    console.log('[MusicLoverSignUpFlow] 🆓 Free user - creating profile...');
                    await handleCreateProfileForFree(result.user.id);
                    console.log('[MusicLoverSignUpFlow] 🆓 Free profile created - AppNavigator will handle routing to main app...');
                } else {
                    console.error('[MusicLoverSignUpFlow] ❌ No subscription tier selected when Google sign-in completed');
                    console.log('[MusicLoverSignUpFlow] 🔍 Available subscription tiers: free, premium');
                    console.log('[MusicLoverSignUpFlow] 📊 Current subscription tier:', formData.subscriptionTier);
                    setError('Please select a subscription tier first');
                    setSetupInProgress(false);
                    return;
                }
                
                // Add a small delay to ensure all auth state updates have propagated
                console.log('[MusicLoverSignUpFlow] ⏳ Waiting for auth state to stabilize...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                console.log('[MusicLoverSignUpFlow] ✅ Profile creation complete - releasing setup in progress flag...');
                setSetupInProgress(false);
            } else {
                console.error('[MusicLoverSignUpFlow] ❌ Google Sign-In result missing user data:', result);
                setError('Authentication completed but user data is missing');
            }
        } catch (error: any) {
            console.error('[MusicLoverSignUpFlow] ❌ Google sign-in error:', error);
            console.error('[MusicLoverSignUpFlow] 🔍 Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            
            // Run diagnosis to understand the issue
            await diagnoseOAuthUserCreation();
            
            setError(error.message || 'Failed to sign in with Google');
            setSetupInProgress(false);
        } finally {
            // Only release loading state after everything is complete
            setIsLoading(false);
        }
    };

    // New function to create profile without setting premium status (for premium users going to payment)
    const handleCreateProfileForPayment = async (userId: string) => {
        try {
            console.log('[MusicLoverSignUpFlow] 🔧 Creating profile for payment flow...');
            
            // Add a small delay to ensure user is properly created in auth.users
            console.log('[MusicLoverSignUpFlow] ⏳ Waiting 2 seconds for user creation to complete...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Verify user exists in auth.users before proceeding
            console.log('[MusicLoverSignUpFlow] 🔍 Verifying user exists in database...');
            const { data: userCheck, error: userCheckError } = await supabase.auth.getUser();
            
            if (userCheckError) {
                console.error('[MusicLoverSignUpFlow] ❌ User verification failed:', userCheckError);
                throw new Error('User verification failed: ' + userCheckError.message);
            }
            
            if (!userCheck?.user) {
                console.error('[MusicLoverSignUpFlow] ❌ User not found in database');
                throw new Error('User not found in database. Please try signing in again.');
            }

            // Create the profile for Google OAuth user (but don't set premium status yet)
            console.log('[MusicLoverSignUpFlow] 🔧 Preparing profile data...');
            const profileData = await prepareProfileData(userId);
            
            console.log('[MusicLoverSignUpFlow] 🚀 Creating music lover profile (premium tier)...');
            const profileResult = await createMusicLoverProfile(profileData);
            
            if ('error' in profileResult && profileResult.error) {
                console.error('[MusicLoverSignUpFlow] ❌ Profile creation error:', profileResult.error);
                throw new Error(profileResult.error.message || 'Failed to create profile');
            }

            console.log('[MusicLoverSignUpFlow] ✅ Profile created successfully (premium tier)');

            // Set premium status to true for premium users so AppNavigator routes them to payment
            console.log('[MusicLoverSignUpFlow] 🔧 Setting premium status to true for premium user...');
            const premiumResult = await updatePremiumStatus(userId, true);
            if ('error' in premiumResult) {
                console.error('[MusicLoverSignUpFlow] ❌ Error updating premium status:', premiumResult.error);
            } else {
                console.log('[MusicLoverSignUpFlow] ✅ Premium status set to true for premium user');
            }

            // Fetch streaming data if applicable
            if (formData.selectedStreamingService && formData.selectedStreamingService !== 'None' && isSpotifyLoggedIn) {
                console.log('[MusicLoverSignUpFlow] 🎵 Fetching Spotify data...');
                try {
                    await forceFetchAndSaveSpotifyData(userId, false);
                    console.log('[MusicLoverSignUpFlow] ✅ Spotify data fetched successfully');
                } catch (spotifyError) {
                    console.error('[MusicLoverSignUpFlow] ❌ Error fetching Spotify data:', spotifyError);
                }
            }

            console.log('[MusicLoverSignUpFlow] 🎉 Profile created successfully for payment flow');
            
        } catch (error: any) {
            console.error('[MusicLoverSignUpFlow] ❌ Error creating profile for payment:', error);
            throw error;
        }
    };

    // New function to create profile for free users and complete signup
    const handleCreateProfileForFree = async (userId: string) => {
        try {
            console.log('[MusicLoverSignUpFlow] 🔧 Creating profile for free user...');
            
            // Add a small delay to ensure user is properly created in auth.users
            console.log('[MusicLoverSignUpFlow] ⏳ Waiting 2 seconds for user creation to complete...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Verify user exists in auth.users before proceeding
            console.log('[MusicLoverSignUpFlow] 🔍 Verifying user exists in database...');
            const { data: userCheck, error: userCheckError } = await supabase.auth.getUser();
            
            if (userCheckError) {
                console.error('[MusicLoverSignUpFlow] ❌ User verification failed:', userCheckError);
                throw new Error('User verification failed: ' + userCheckError.message);
            }
            
            if (!userCheck?.user) {
                console.error('[MusicLoverSignUpFlow] ❌ User not found in database');
                throw new Error('User not found in database. Please try signing in again.');
            }

            // Create the profile for Google OAuth user
            console.log('[MusicLoverSignUpFlow] 🔧 Preparing profile data...');
            const profileData = await prepareProfileData(userId);
            
            console.log('[MusicLoverSignUpFlow] 🚀 Creating music lover profile (free tier)...');
            const profileResult = await createMusicLoverProfile(profileData);
            
            if ('error' in profileResult && profileResult.error) {
                console.error('[MusicLoverSignUpFlow] ❌ Profile creation error:', profileResult.error);
                throw new Error(profileResult.error.message || 'Failed to create profile');
            }

            console.log('[MusicLoverSignUpFlow] ✅ Profile created successfully (free tier)');

            // Set premium status to false for free users
            console.log('[MusicLoverSignUpFlow] 🔧 Setting premium status to false for free user...');
            const premiumResult = await updatePremiumStatus(userId, false);
            if ('error' in premiumResult) {
                console.error('[MusicLoverSignUpFlow] ❌ Error updating premium status:', premiumResult.error);
            } else {
                console.log('[MusicLoverSignUpFlow] ✅ Premium status set to false for free user');
            }

            // Fetch streaming data if applicable
            if (formData.selectedStreamingService && formData.selectedStreamingService !== 'None') {
                if (formData.selectedStreamingService === 'spotify' && isSpotifyLoggedIn) {
                    console.log('[MusicLoverSignUpFlow] 🎵 Fetching Spotify data...');
                    try {
                        await forceFetchAndSaveSpotifyData(userId, false);
                        console.log('[MusicLoverSignUpFlow] ✅ Spotify data fetched successfully');
                    } catch (spotifyError) {
                        console.error('[MusicLoverSignUpFlow] ❌ Error fetching Spotify data:', spotifyError);
                    }
                } else if (formData.selectedStreamingService === 'apple_music' && isAppleMusicLoggedIn) {
                    console.log('[MusicLoverSignUpFlow] 🎵 Fetching Apple Music data...');
                    try {
                        await forceFetchAndSaveAppleMusicData(userId, false);
                        console.log('[MusicLoverSignUpFlow] ✅ Apple Music data fetched successfully');
                    } catch (appleMusicError) {
                        console.error('[MusicLoverSignUpFlow] ❌ Error fetching Apple Music data:', appleMusicError);
                    }
                } else {
                    console.log('[MusicLoverSignUpFlow] ⏭️ Skipping streaming data fetch:', {
                        selectedStreamingService: formData.selectedStreamingService,
                        isSpotifyLoggedIn: isSpotifyLoggedIn,
                        isAppleMusicLoggedIn: isAppleMusicLoggedIn
                    });
                }
            }

            console.log('[MusicLoverSignUpFlow] 🎉 Free user profile created successfully');
            
        } catch (error: any) {
            console.error('[MusicLoverSignUpFlow] ❌ Error creating profile for free user:', error);
            throw error;
        }
    };

    // --- Render Functions for Steps ---

    const renderStreamingServiceStep = () => (
        <View style={authStyles.signupStepContent}>
            <Text style={authStyles.signupStepTitle}>Music Services</Text>
            <Text style={authStyles.signupStepSubtitle}>What streaming service do you use most?</Text>
            
            {/* Create a proper 2-column grid */}
            <View style={{ 
                width: '100%', 
                flexDirection: 'row', 
                flexWrap: 'wrap', 
                justifyContent: 'space-between',
                marginBottom: isWeb ? 24 : 20
            }}>
                {STREAMING_SERVICES.map((service) => (
                    <TouchableOpacity 
                        key={service.id} 
                        style={[
                            {
                                width: '48%',
                                aspectRatio: 1,
                                borderRadius: isWeb ? 16 : 12,
                                borderWidth: 1.5,
                                borderColor: formData.selectedStreamingService === service.id ? APP_CONSTANTS.COLORS.PRIMARY : APP_CONSTANTS.COLORS.BORDER,
                                padding: isWeb ? 16 : 12,
                                marginBottom: isWeb ? 20 : 16,
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                elevation: 2,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: isWeb ? 4 : 2 },
                                shadowOpacity: 0.08,
                                shadowRadius: isWeb ? 8 : 4,
                                backgroundColor: formData.selectedStreamingService === service.id ? `${APP_CONSTANTS.COLORS.PRIMARY}10` : 'white',
                            }
                        ]} 
                        onPress={() => handleStreamingServiceSelect(service.id as StreamingServiceId)}
                        >
                        <View style={[{
                            width: isWeb ? 72 : 60,
                            height: isWeb ? 72 : 60,
                            borderRadius: isWeb ? 36 : 30,
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: isWeb ? 16 : 12,
                            elevation: 3,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: isWeb ? 4 : 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: isWeb ? 8 : 4,
                            backgroundColor: service.color
                        }]}>
                            {service.iconSet === 'FontAwesome' && (
                                <FontAwesome name={service.icon as any} size={28} color="#FFF" />
                            )}
                            {service.iconSet === 'MaterialCommunityIcons' && (
                                <MaterialCommunityIcons name={service.icon as any} size={28} color="#FFF" />
                            )}
                            {service.iconSet === 'Feather' && (
                                <Feather name={service.icon as any} size={28} color="#FFF" />
                            )}
                        </View>
                        <Text style={{
                            fontSize: isWeb ? 14 : 13,
                            color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
                            fontWeight: '500',
                            textAlign: 'center',
                            fontFamily: 'Inter, sans-serif',
                        }}>{service.name}</Text>
                        {formData.selectedStreamingService === service.id && (
                            <View style={{
                                position: 'absolute',
                                top: isWeb ? 12 : 8,
                                right: isWeb ? 12 : 8,
                                backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
                                borderRadius: isWeb ? 16 : 12,
                                width: isWeb ? 32 : 24,
                                height: isWeb ? 32 : 24,
                                alignItems: 'center',
                                justifyContent: 'center',
                                elevation: 4,
                                shadowColor: APP_CONSTANTS.COLORS.PRIMARY,
                                shadowOffset: { width: 0, height: isWeb ? 4 : 2 },
                                shadowOpacity: 0.3,
                                shadowRadius: isWeb ? 8 : 4,
                            }}>
                                <Feather name="check" size={16} color="#FFFFFF" />
                            </View>
                        )}
                    </TouchableOpacity>
                ))}

                <TouchableOpacity 
                    style={[
                        {
                            width: '48%',
                            aspectRatio: 1,
                            borderRadius: isWeb ? 16 : 12,
                            borderWidth: 1.5,
                            borderColor: formData.selectedStreamingService === 'None' ? APP_CONSTANTS.COLORS.PRIMARY : APP_CONSTANTS.COLORS.BORDER,
                            padding: isWeb ? 16 : 12,
                            marginBottom: isWeb ? 20 : 16,
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            elevation: 2,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: isWeb ? 4 : 2 },
                            shadowOpacity: 0.08,
                            shadowRadius: isWeb ? 8 : 4,
                            backgroundColor: formData.selectedStreamingService === 'None' ? `${APP_CONSTANTS.COLORS.PRIMARY}10` : 'white',
                        }
                    ]} 
                    onPress={() => handleStreamingServiceSelect('None')}
                    >
                    <View style={[{
                        width: isWeb ? 72 : 60,
                        height: isWeb ? 72 : 60,
                        borderRadius: isWeb ? 36 : 30,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: isWeb ? 16 : 12,
                        elevation: 3,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: isWeb ? 4 : 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: isWeb ? 8 : 4,
                        backgroundColor: '#5C5C5C'
                    }]}>
                        <Feather name="zap-off" size={28} color="#FFF" />
                    </View>
                    <Text style={{
                        fontSize: isWeb ? 14 : 13,
                        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
                        fontWeight: '500',
                        textAlign: 'center',
                        fontFamily: 'Inter, sans-serif',
                    }}>None / Other</Text>
                    {formData.selectedStreamingService === 'None' && (
                        <View style={{
                            position: 'absolute',
                            top: isWeb ? 12 : 8,
                            right: isWeb ? 12 : 8,
                            backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
                            borderRadius: isWeb ? 16 : 12,
                            width: isWeb ? 32 : 24,
                            height: isWeb ? 32 : 24,
                            alignItems: 'center',
                            justifyContent: 'center',
                            elevation: 4,
                            shadowColor: APP_CONSTANTS.COLORS.PRIMARY,
                            shadowOffset: { width: 0, height: isWeb ? 4 : 2 },
                            shadowOpacity: 0.3,
                            shadowRadius: isWeb ? 8 : 4,
                        }}>
                            <Feather name="check" size={16} color="#FFFFFF" />
                        </View>
                    )}
                </TouchableOpacity>
            </View>
            
            {/* Spotify specific UI feedback */}
            {isSpotifyLoading && formData.selectedStreamingService === 'spotify' && (
                <View style={authStyles.loadingContainer}>
                    <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
                    <Text style={authStyles.loadingText}>Connecting to Spotify...</Text>
                </View>
            )}
            {spotifyError && formData.selectedStreamingService === 'spotify' && (
                 <Text style={[authStyles.signupErrorText, { marginTop: 10 }]}>{spotifyError}</Text>
            )}
            {isSpotifyLoggedIn && formData.selectedStreamingService === 'spotify' && (
                <View style={styles.successMessageContainer}>
                    <FontAwesome name="check-circle" size={20} color="#1DB954" />
                    <Text style={styles.successMessageText}>Successfully connected to Spotify!</Text>
                </View>
            )}

            {/* Apple Music specific UI feedback */}
            {isAppleMusicLoading && formData.selectedStreamingService === 'apple_music' && (
                <View style={authStyles.loadingContainer}>
                    <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
                    <Text style={authStyles.loadingText}>Connecting to Apple Music...</Text>
                </View>
            )}
            {appleMusicError && formData.selectedStreamingService === 'apple_music' && (
                 <Text style={[authStyles.signupErrorText, { marginTop: 10 }]}>{appleMusicError}</Text>
            )}
            {isAppleMusicLoggedIn && formData.selectedStreamingService === 'apple_music' && (
                <View style={styles.successMessageContainer}>
                    <FontAwesome name="check-circle" size={20} color="#FA57C1" />
                    <Text style={styles.successMessageText}>Successfully connected to Apple Music!</Text>
                </View>
            )}

            {/* General error display */}
            {error && !spotifyError && <Text style={[authStyles.signupErrorText, { marginTop: 10 }]}>{error}</Text>} 

            {/* Main Back/Continue Buttons */}
            <View style={authStyles.signupButtonContainer}> 
                <TouchableOpacity 
                    style={authStyles.signupSecondaryButton} 
                    onPress={() => goToPreviousStep('profile-details')}
                >
                    <Text style={authStyles.signupSecondaryButtonText}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        authStyles.signupPrimaryButton,
                        (!formData.selectedStreamingService) && authStyles.signupPrimaryButtonDisabled
                    ]}
                    onPress={() => {
                        if (validateStreamingServiceStep()) {
                            goToNextStep('subscription');
                        }
                    }}
                    disabled={!formData.selectedStreamingService}
                >
                    <Text style={authStyles.signupPrimaryButtonText}>Continue</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    // Improved subscription plan selection UI
    const renderSubscriptionStep = () => (
        <View style={authStyles.signupStepContainer}>
            <Text style={authStyles.signupStepTitle}>Choose Your Plan</Text>
            <Text style={authStyles.signupStepSubtitle}>Select a subscription plan that works for you</Text>

            <View style={authStyles.signupSubscriptionOptionsContainer}>
                {/* Free Tier */}
                <TouchableOpacity
                    style={[
                        authStyles.signupSubscriptionCard,
                        formData.subscriptionTier === 'free' && authStyles.signupSelectedSubscriptionCard
                    ]}
                    onPress={() => handleSubscriptionChange('free')}
                >
                    <View style={authStyles.signupPlanHeader}>
                        <Text style={authStyles.signupPlanTitle}>Free</Text>
                        <Text style={authStyles.signupPlanPrice}>$0/month</Text>
                    </View>
                    
                    <View style={styles.planFeaturesList}>
                        <View style={styles.planFeatureItem}>
                            <Feather name="check" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                            <Text style={styles.featureText}>Limited Profiles</Text>
                        </View>
                        <View style={styles.planFeatureItem}>
                            <Feather name="check" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                            <Text style={styles.featureText}>Basic Music Matches</Text>
                        </View>
                        <View style={styles.planFeatureItem}>
                            <Feather name="check" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                            <Text style={styles.featureText}>Top 3 Streaming Data</Text>
                        </View>
                    </View>
                    
                    {formData.subscriptionTier === 'free' && (
                        <View style={styles.selectionBadge}>
                            <Text style={styles.selectionBadgeText}>Selected</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Premium Tier */}
                <TouchableOpacity
                    style={[
                        authStyles.signupSubscriptionCard,
                        styles.premiumCard,
                        formData.subscriptionTier === 'premium' && authStyles.signupSelectedSubscriptionCard
                    ]}
                    onPress={() => handleSubscriptionChange('premium')}
                >
                    <View style={authStyles.signupPlanHeader}>
                        <Text style={authStyles.signupPlanTitle}>Premium</Text>
                        <Text style={authStyles.signupPlanPrice}>$4.99/month</Text>
                    </View>
                    
                    <View style={styles.planFeaturesList}>
                        <View style={styles.planFeatureItem}>
                            <Feather name="check" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                            <Text style={styles.featureText}>Unlimited Profiles</Text>
                        </View>
                        <View style={styles.planFeatureItem}>
                            <Feather name="check" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                            <Text style={styles.featureText}>Advanced Matching</Text>
                        </View>
                        <View style={styles.planFeatureItem}>
                            <Feather name="check" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                            <Text style={styles.featureText}>Top 10 Streaming Data</Text>
                        </View>
                        <View style={styles.planFeatureItem}>
                            <Feather name="check" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                            <Text style={styles.featureText}>Music Analytics</Text>
                        </View>
                    </View>
                    
                    {formData.subscriptionTier === 'premium' && (
                        <View style={[styles.selectionBadge, styles.premiumSelectionBadge]}>
                            <Text style={styles.selectionBadgeText}>Selected</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <View style={authStyles.signupButtonContainer}>
                <TouchableOpacity 
                    style={authStyles.signupSecondaryButton} 
                    onPress={() => goToPreviousStep('streaming-service')}
                >
                    <Text style={authStyles.signupSecondaryButtonText}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        authStyles.signupPrimaryButton,
                        (!formData.subscriptionTier || isLoading) && authStyles.signupPrimaryButtonDisabled
                    ]}
                    onPress={handleStepSubmit}
                    disabled={!formData.subscriptionTier || isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={authStyles.signupPrimaryButtonText}>
                            {formData.subscriptionTier === 'free' ? 'Complete Sign Up' : 'Continue to Payment'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            {error ? <Text style={authStyles.signupErrorText}>{error}</Text> : null}
        </View>
    );

    // --- Render Functions for Steps ---

    const renderCurrentStep = () => {
        return (
            <View style={authStyles.signupStepContainer}>
                {currentStep === 'username' && renderUsernameStep()}
                {currentStep === 'profile-details' && renderProfileDetailsStep()}
                {currentStep === 'streaming-service' && renderStreamingServiceStep()}
                {currentStep === 'subscription' && renderSubscriptionStep()}
            </View>
        );
    };

    // Main Return JSX Structure - web: wide form; mobile: as before
    return (
        <SafeAreaView style={authStyles.signupContainer} edges={['top', 'bottom']}>
            <LinearGradient 
                colors={[
                    `${APP_CONSTANTS.COLORS.PRIMARY}08`,
                    `${APP_CONSTANTS.COLORS.PRIMARY}03`,
                    'white'
                ]} 
                style={authStyles.signupGradient}
            >
                {/* Decorative background elements */}
                <View style={authStyles.decorativeCircle1} />
                <View style={authStyles.decorativeCircle2} />
                <View style={authStyles.decorativeCircle3} />
                {isWeb && <View style={authStyles.decorativeCircle4} />}
                {isWeb && <View style={authStyles.decorativeCircle5} />}

                <View style={authStyles.signupHeader}>
                    {/* Add back button to header */}
                    <TouchableOpacity
                        style={authStyles.signupBackButton}
                        onPress={() => {
                            if (currentStep === 'username') {
                                // Clear session and let auth flow handle navigation
                                supabase.auth.signOut().then(() => {
                                    // After sign out, the auth flow will automatically navigate to Landing
                                });
                            } else {
                                const steps: Step[] = ['username', 'profile-details', 'streaming-service', 'subscription'];
                                const currentIndex = steps.indexOf(currentStep);
                                if (currentIndex > 0) {
                                    goToPreviousStep(steps[currentIndex - 1]);
                                }
                            }
                        }}
                    >
                        <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
                    </TouchableOpacity>
                    <View style={authStyles.signupStepIndicatorContainer}>
                        <View style={[
                            authStyles.signupStepIndicator, 
                            currentStep === 'username' ? authStyles.signupStepIndicatorCurrent : 
                            (currentStep === 'profile-details' || currentStep === 'streaming-service' || 
                            currentStep === 'subscription') ? authStyles.signupStepIndicatorActive : {}
                        ]} />
                        <View style={[
                            authStyles.signupStepIndicator, 
                            currentStep === 'profile-details' ? authStyles.signupStepIndicatorCurrent : 
                            (currentStep === 'streaming-service' || currentStep === 'subscription') ? authStyles.signupStepIndicatorActive : {}
                        ]} />
                        <View style={[
                            authStyles.signupStepIndicator, 
                            currentStep === 'streaming-service' ? authStyles.signupStepIndicatorCurrent : 
                            currentStep === 'subscription' ? authStyles.signupStepIndicatorActive : {}
                        ]} />
                        <View style={[
                            authStyles.signupStepIndicator, 
                            currentStep === 'subscription' ? authStyles.signupStepIndicatorCurrent : {}
                        ]} />
                    </View>
                    <View style={{ width: 24 }} />
                </View>

                {/* Web: wide form wrapper; Mobile: as before */}
                <View style={isWeb ? authStyles.formWrapperWeb : undefined}>
                    <ScrollView 
                        contentContainerStyle={authStyles.signupScrollContentContainer} 
                        style={{ width: '100%' }}
                        showsVerticalScrollIndicator={false}
                    >
                        <Animated.View 
                            style={[
                                authStyles.signupStepsSlider, 
                                { 
                                    transform: [{ translateX: slideAnim }],
                                    opacity: fadeAnim,
                                    width: '100%',
                                    minHeight: '100%'
                                }
                            ]}
                        >
                            {renderCurrentStep()}
                        </Animated.View>
                    </ScrollView>
                </View>

                <TermsModal visible={isTermsModalVisible} onClose={() => setIsTermsModalVisible(false)} termsText={termsAndConditionsText} />
                {/* Web Image Cropper */}
                {Platform.OS === 'web' && (
                    <ImageCropper
                        visible={showCropper}
                        imageUri={tempImageUri || ''}
                        aspectRatio={[4, 5]}
                        onCrop={handleCroppedImage}
                        onCancel={handleCropperCancel}
                    />
                )}
            </LinearGradient>
        </SafeAreaView>
    );
};

// --- Styles --- 
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND },
    gradient: { flex: 1 },
    header: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        paddingHorizontal: 16, 
        paddingTop: Platform.OS === 'android' ? 16 : 10, 
        paddingBottom: 8, 
        backgroundColor: 'transparent' 
    },
    backButton: { 
        padding: 8,
        zIndex: 1
    },
    stepIndicatorContainer: { 
        flexDirection: 'row', 
        justifyContent: 'center', 
        alignItems: 'center',
        flex: 1
    },
    stepIndicator: { width: 10, height: 10, borderRadius: 5, backgroundColor: APP_CONSTANTS.COLORS.BORDER_LIGHT, marginHorizontal: 4 },
    stepIndicatorActive: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT },
    stepIndicatorCurrent: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, width: 12, height: 12, borderRadius: 6 },
    scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
    stepContainer: { flex: 1, alignItems: 'center', marginTop: 15, width: '100%' },
    animatedContainer: { width: '100%' },
    stepContent: { width: '100%', paddingBottom: 20 },
    stepTitle: { fontSize: 24, fontWeight: '700', color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, marginBottom: 10, textAlign: 'center' },
    stepDescription: { fontSize: 15, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, marginBottom: 25, textAlign: 'center', lineHeight: 21 },
    stepSubtitle: { fontSize: 15, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, marginBottom: 25, textAlign: 'center', lineHeight: 21 }, // Added stepSubtitle
    inputContainer: { marginBottom: 16, width: '100%' },
    inputLabel: { fontSize: 14, fontWeight: '600', color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, marginBottom: 6 },
    inputLabelSmall: { fontSize: 13, fontWeight: '500', color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, marginBottom: 5 },
    input: { backgroundColor: '#FFFFFF', paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 14 : 12, borderRadius: 8, fontSize: 16, borderWidth: 1, borderColor: APP_CONSTANTS.COLORS.BORDER, color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, width: '100%' },
    inputError: { borderColor: APP_CONSTANTS.COLORS.ERROR },
    inputValid: { borderColor: APP_CONSTANTS.COLORS.SUCCESS }, // Assuming you have a SUCCESS color
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    inlineLoader: { marginLeft: 8 },
    feedbackText: { fontSize: 12, marginTop: 4, paddingLeft: 2 },
    feedbackTextValid: { color: APP_CONSTANTS.COLORS.SUCCESS || 'green' }, // Provide fallback
    feedbackTextError: { color: APP_CONSTANTS.COLORS.ERROR },
    inputBio: { backgroundColor: '#FFFFFF', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 8, fontSize: 15, borderWidth: 1, borderColor: APP_CONSTANTS.COLORS.BORDER, color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, width: '100%', minHeight: 45, textAlignVertical: 'top' },
    rowContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
    termsContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 8, width: '100%' },
    checkbox: { width: 20, height: 20, borderWidth: 1.5, borderColor: APP_CONSTANTS.COLORS.BORDER_DARK, borderRadius: 4, marginRight: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
    checkboxChecked: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, borderColor: APP_CONSTANTS.COLORS.PRIMARY },
    termsText: { fontSize: 13, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, lineHeight: 18, flex: 1 },
    termsLink: { color: APP_CONSTANTS.COLORS.PRIMARY, fontWeight: '600', textDecorationLine: 'underline' },
    requiredText: { fontSize: 12, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, marginTop: 4, marginBottom: 16, textAlign: 'right', width: '100%' },
    profilePicContainer: { alignItems: 'center', marginVertical: 15 },
    profilePicPreview: {
        width: 100,
        height: 125, // 4:5 aspect ratio (100 * 5/4)
        borderRadius: 12, // Rounded rectangle
        marginBottom: 12,
        backgroundColor: APP_CONSTANTS.COLORS.BORDER_LIGHT,
        borderWidth: 2,
        borderColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT
    },
    profilePicPlaceholder: {
        width: 100,
        height: 125, // 4:5 aspect ratio
        borderRadius: 12, // Rounded rectangle
        backgroundColor: APP_CONSTANTS.COLORS.BORDER_LIGHT + '80',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: APP_CONSTANTS.COLORS.BORDER
    },
    uploadButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
    uploadButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },
    bioHeader: { marginTop: 15, marginBottom: 10, fontSize: 16, fontWeight: '600', textAlign: 'left', width: '100%' },
    // Original continueButton for steps other than streaming service
    continueButton: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingVertical: 15, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 20, width: '100%', minHeight: 50, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
    continueButtonDisabled: { backgroundColor: APP_CONSTANTS.COLORS.DISABLED, elevation: 0, shadowOpacity: 0 },
    continueButtonText: { color: 'white', fontWeight: '600', fontSize: 16 },
    
    // --- Combined and corrected button styles ---
    buttonContainer: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        width: '100%', 
        marginTop: 20,
        gap: 16, // Added gap for spacing between buttons
    },
    primaryButton: { 
        flex: 1, // Make buttons flexible
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, 
        paddingVertical: 16, // Consistent padding
        borderRadius: 12, // Consistent radius 
        alignItems: 'center', 
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2
    },
     primaryButtonDisabled: {
        backgroundColor: APP_CONSTANTS.COLORS.DISABLED,
        elevation: 0,
        shadowOpacity: 0,
    },
    primaryButtonText: { 
        color: 'white', 
        fontWeight: '600', 
        fontSize: 16 
    },
    secondaryButton: { 
        flex: 1, // Make buttons flexible
        backgroundColor: 'white', // Make secondary distinct
        paddingVertical: 16, // Consistent padding 
        borderRadius: 12, // Consistent radius 
        alignItems: 'center', 
        justifyContent: 'center',
        borderWidth: 1, 
        borderColor: APP_CONSTANTS.COLORS.BORDER, 
    },
    secondaryButtonText: { 
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, // Use primary text color
        fontWeight: '600', 
        fontSize: 16 
    },
    errorText: {
        color: APP_CONSTANTS.COLORS.ERROR,
        marginTop: 0, // Adjust as needed
        marginBottom: 16,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '500',
        width: '100%',
        paddingHorizontal: 10
    },

    // --- Styles for Streaming Service Step (Fixing missing) ---
    streamingServicesGrid: { 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        justifyContent: 'space-around', 
        width: '100%', 
        marginBottom: 20, 
        // paddingHorizontal: -8 // Removed negative margin attempt
    },
    serviceCard: {
        width: '45%', // Adjust width for 2 columns with gap
        aspectRatio: 1, // Make cards square-ish
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: APP_CONSTANTS.COLORS.BORDER,
        padding: 10,
        marginBottom: 16,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    selectedServiceCard: {
        borderColor: APP_CONSTANTS.COLORS.PRIMARY,
        backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}10`, // Light primary background
        elevation: 3,
    },
    serviceIconContainer: {
        width: 60, // Adjust size
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        elevation: 2,
    },
    serviceName: { 
        fontSize: 13, 
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, 
        fontWeight: '500', 
        textAlign: 'center' 
    },
    checkmarkBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
        borderRadius: 12,
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
    },

    // --- Styles for Subscription Step (Fixing missing) ---
    subscriptionOptionsContainer: {
        width: '100%',
        marginTop: 10,
        marginBottom: 20,
        gap: 16,
    },
    subscriptionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: APP_CONSTANTS.COLORS.BORDER,
        padding: 20,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
        width: '100%',
        position: 'relative', // For badge positioning
    },
    selectedSubscriptionCard: {
        borderColor: APP_CONSTANTS.COLORS.PRIMARY,
        backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}0A`,
        shadowColor: APP_CONSTANTS.COLORS.PRIMARY,
        shadowOpacity: 0.15,
        shadowRadius: 5,
        elevation: 4,
    },
    premiumCard: { // Specific styling for premium card if needed
        // Example: borderStyle: 'dashed'
    },
    planHeader: { 
        marginBottom: 16, 
    },
    planTitle: { 
        fontSize: 20, // Adjusted size 
        fontWeight: '700', 
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, 
        marginBottom: 4, 
    },
    planPrice: { 
        fontSize: 16, // Adjusted size
        fontWeight: '500', 
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, 
    },
    planFeaturesList: { 
        gap: 10, // Adjusted gap
    },
    planFeatureItem: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 10, // Adjusted gap
    },
    featureText: { 
        fontSize: 14, 
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, 
        flex: 1, 
    },
    selectionBadge: { 
        position: 'absolute', 
        top: 12, 
        right: 12, 
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, 
        paddingHorizontal: 10, // Adjusted padding
        paddingVertical: 4,
        borderRadius: 12, 
    },
    premiumSelectionBadge: { 
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY_DARK, // Example: Darker for premium
    },
    selectionBadgeText: { 
        color: 'white', 
        fontSize: 11, // Adjusted size
        fontWeight: '600', 
    },
    
    // --- YouTube Music Cookie Input Styles --- 
    ytmCookieInputContainer: {
        width: '100%',
        marginTop: 15,
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        marginBottom: 20,
    },
    ytmInputTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
        marginBottom: 10,
        textAlign: 'center',
    },
    ytmInputInstructions: {
        fontSize: 13,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        marginBottom: 16,
        textAlign: 'center',
        lineHeight: 18,
    },
    cookieInput: {
        minHeight: 80, // Allow space for multiline cookie
        textAlignVertical: 'top',
    },
    ytmInputButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
        gap: 12,
    },
    ytmButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ytmButtonText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 14,
    },
    ytmConnectButton: {
        backgroundColor: '#FF0000', // YouTube Red
    },
    ytmSkipButton: {
        backgroundColor: '#999', // Grey for skip/cancel
    },
     ytmButtonDisabled: {
        backgroundColor: APP_CONSTANTS.COLORS.DISABLED,
    },
    
    // Loading state for YTM connection
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 14,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    },
    
    // Picker styles
    pickerContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8, 
        borderWidth: 1,
        borderColor: APP_CONSTANTS.COLORS.BORDER,
        marginBottom: 10,
        overflow: 'hidden', // Helps contain picker on some platforms
    },
    picker: {
        width: '100%',
        height: Platform.OS === 'ios' ? 180 : 50, // Adjust height for platform
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    },

    // Remove duplicate definitions from below if they exist
    // (The previously added duplicate blocks should be removed entirely)
    successMessageContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F0FFF0',
        padding: 10,
        borderRadius: 8,
        marginTop: 10,
        marginBottom: 10,
    },
    successMessageText: {
        color: APP_CONSTANTS.COLORS.PRIMARY,
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '500',
    },
    stickyButtonContainer: {
        width: '100%',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: APP_CONSTANTS.COLORS.BORDER_LIGHT,
        backgroundColor: 'white',
    },
    scrollContentContainer: {
        flexGrow: 1,
        paddingHorizontal: 20,
    },
    stepsSlider: {
        width: '100%',
    },
    googleSignInButton: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.5,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    googleButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    googleIcon: {
        marginRight: 10,
    },
    googleSignInText: {
        color: '#444',
        fontSize: 16,
        fontWeight: '600',
    },
    orDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: APP_CONSTANTS.COLORS.BORDER,
    },
    orText: {
        marginHorizontal: 15,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        fontWeight: '600',
    },
    secureNote: {
        fontSize: 12,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        marginTop: 10,
        textAlign: 'center',
    },
});

export default MusicLoverSignUpFlow;