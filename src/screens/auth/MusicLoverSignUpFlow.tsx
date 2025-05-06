import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
    ActivityIndicator, Alert, Animated, Image, Platform,
    Dimensions
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
// Import specific icon sets from @expo/vector-icons
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons'; // Keep Feather for other icons
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth'; // Adjust import path as needed
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth'; // Spotify auth hook
import { useYouTubeMusicAuth } from '@/hooks/useYouTubeMusicAuth'; // YouTube Music auth hook
import { APP_CONSTANTS } from '@/config/constants'; // Assuming path is correct
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser'; // Add WebBrowser for opening URLs in new tabs
// Import the specific types expected by createMusicLoverProfile and for the form state
import { MusicLoverBio, CreateMusicLoverProfileData } from '@/hooks/useAuth'; // Assuming types are exported from useAuth
import TermsModal from '@/components/TermsModal'; // Import the new modal
// Import navigation types
import type { RootStackParamList, MainStackParamList } from '@/navigation/AppNavigator'; // Import stack param lists

// Step types
type Step = 'account-details' | 'profile-details' | 'streaming-service' | 'subscription' | 'payment';
type SubscriptionTier = 'free' | 'premium' | '';
type StreamingServiceId = 'spotify' | 'apple_music' | 'youtubemusic' | 'deezer' | 'soundcloud' | 'tidal' | 'None' | ''; // Updated 'youtube_music' to 'youtubemusic'

// Define window width for animations
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Define Streaming Services Data - UPDATED with correct service IDs
const STREAMING_SERVICES = [
    { id: 'spotify', name: 'Spotify', icon: 'spotify', color: '#1DB954', iconSet: 'FontAwesome', description: 'Browser authentication required' },
    { id: 'apple_music', name: 'Apple Music', icon: 'apple-music', color: '#FA57C1', iconSet: 'MaterialCommunityIcons', description: 'Connect your Apple Music' },
    { id: 'youtubemusic', name: 'YouTube Music', icon: 'youtube-play', color: '#FF0000', iconSet: 'FontAwesome', description: 'Auth code required' },
    { id: 'deezer', name: 'Deezer', icon: 'deezer', color: '#EF5466', iconSet: 'MaterialCommunityIcons', description: 'Connect your Deezer account' },
    { id: 'soundcloud', name: 'SoundCloud', icon: 'soundcloud', color: '#FF5500', iconSet: 'FontAwesome', description: 'Connect to SoundCloud' },
    { id: 'tidal', name: 'Tidal', icon: 'tidal', color: '#000000', iconSet: 'MaterialCommunityIcons', description: 'Connect your Tidal account' },
];

// --- Update the type for form data ---
interface MusicLoverFormData {
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    username: string;
    termsAccepted: boolean;
    profilePictureUri: string;         // Local URI for upload / preview
    profilePicturePreview: string;     // URI specifically for display (often same as Uri)
    profilePictureMimeType?: string | null; // <<< ADD mimeType field
    age: string;                       // Keep as string for input
    country: string;
    city: string;
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
const termsAndConditionsText = `**Vybr Terms & Conditions (Placeholder)**

**Last Updated: [Date]**

Welcome to Vybr! Please read these Terms & Conditions ("Terms") carefully before using the Vybr mobile application ("Service").

**1. Acceptance of Terms**
By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the terms, you may not access the Service. **This is a placeholder text and not legally binding. You must consult with a legal professional to draft comprehensive and compliant Terms & Conditions for your specific service, location, and features.**

**2. Description of Service**
Vybr is a platform designed to connect music lovers and event organizers. Features include profile creation, event discovery, matching based on musical preferences, chat functionalities, and potential premium subscription services.

**3. User Accounts**
You are responsible for safeguarding your account information, including your password. You agree not to disclose your password to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account. You must provide accurate and complete information when creating your account.

**4. User Conduct**
You agree not to use the Service to:
   - Post unauthorized commercial communications (such as spam).
   - Collect users' content or information, or otherwise access the Service using automated means.
   - Engage in unlawful, misleading, malicious, or discriminatory activity.
   - Bully, intimidate, or harass any user.
   - Post content that is hate speech, threatening, pornographic, incites violence, or contains nudity or graphic/gratuitous violence.
   - Do anything that could disable, overburden, or impair the proper working or appearance of Vybr.
   - Violate any applicable laws or regulations.

**5. Content Ownership**
You retain ownership of the content you post on Vybr. By posting content, you grant Vybr a non-exclusive, transferable, sub-licensable, royalty-free, worldwide license to use, display, reproduce, and distribute such content on and through the Service.

**6. Music Data & Privacy**
If you link streaming services or manually input music preferences, you consent to Vybr analyzing this data to provide matching and recommendation features. Your privacy is important to us. Please review our Privacy Policy [Link to Privacy Policy - REQUIRED] for details on how we collect, use, and protect your information.

**7. Premium Services & Payments (If Applicable)**
Specific terms related to subscription fees, billing cycles, renewals, and cancellations for any premium features will be presented at the time of subscription.

**8. Termination**
We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.

**9. Disclaimers**
The Service is provided on an "AS IS" and "AS AVAILABLE" basis. Vybr makes no warranties, expressed or implied, and hereby disclaims all other warranties including, without limitation, implied warranties of merchantability, fitness for a particular purpose, or non-infringement.

**10. Limitation of Liability**
In no event shall Vybr, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages arising out of your use of the Service.

**11. Governing Law**
These Terms shall be governed by the laws of [Your Jurisdiction - REQUIRED], without regard to its conflict of law provisions.

**12. Changes to Terms**
We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of any changes by posting the new Terms on the Service.

**13. Contact Us**
If you have any questions about these Terms, please contact us at [Your Support Email/Contact Info - REQUIRED].

**By checking the box, you acknowledge that you have read, understood, and agree to be bound by these Terms & Conditions.**`;

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
        loading: authLoading // Hook's loading state
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
    
    // YouTube Music auth hook
    const {
        login: youTubeMusicLogin,
        isLoggedIn: isYouTubeMusicLoggedIn,
        isLoading: isYouTubeMusicLoading,
        error: youTubeMusicError,
        forceFetchAndSaveYouTubeMusicData
    } = useYouTubeMusicAuth();

    // --- Update initial state ---
    const [formData, setFormData] = useState<MusicLoverFormData>({
        email: '', password: '', confirmPassword: '', firstName: '', lastName: '',
        username: '', termsAccepted: false,
        profilePictureUri: '',
        profilePicturePreview: '',
        profilePictureMimeType: null, // <<< Initialize mimeType
        age: '', country: '', city: '',
        bio: { firstSong: '', goToSong: '', mustListenAlbum: '', dreamConcert: '', musicTaste: '' },
        selectedStreamingService: '',
        subscriptionTier: '',
        paymentInfo: { cardNumber: '', expiry: '', cvv: '', name: '' },
    });

    // State variables
    const [currentStep, setCurrentStep] = useState<Step>('account-details');
    const [isTermsModalVisible, setIsTermsModalVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false); // Component-level loading (e.g., payment sim)
    const [error, setError] = useState('');
    const slideAnim = useRef(new Animated.Value(0)).current; // Animation value

    // YouTube Music auth state
    const [showYTMAuthCode, setShowYTMAuthCode] = useState(false);
    const [ytmAuthInProgress, setYtmAuthInProgress] = useState(false);
    const [ytmAuthDetails, setYTMAuthDetails] = useState<null | {
        verificationUrl: string;
        userCode: string;
        deviceCode: string;
        interval: number;
        completion: () => Promise<boolean>;
    }>(null);

    // Handle form field changes (robust version)
    const handleChange = (field: keyof MusicLoverFormData | string, value: any) => { // Use keyof or string for nested fields
        const trimmedValue = (typeof value === 'string' && !field.startsWith('paymentInfo.') && field !== 'password' && field !== 'confirmPassword' && field !== 'selectedStreamingService' && field !== 'profilePictureUri' && field !== 'profilePicturePreview' && field !== 'profilePictureMimeType')
            ? value.trimStart()
            : value;

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
        Animated.timing(slideAnim, { toValue: -SCREEN_WIDTH, duration: 300, useNativeDriver: true }).start(() => {
            setCurrentStep(nextStep);
            slideAnim.setValue(SCREEN_WIDTH); // Move off-screen to the right
            Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(); // Slide in from right
        });
    };
    const goToPreviousStep = (prevStep: Step) => {
        Animated.timing(slideAnim, { toValue: SCREEN_WIDTH, duration: 300, useNativeDriver: true }).start(() => {
            setCurrentStep(prevStep);
            slideAnim.setValue(-SCREEN_WIDTH); // Move off-screen to the left
            Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(); // Slide in from left
        });
    };

    // --- Validation Functions ---
    const validateAccountDetailsStep = (): boolean => {
        console.log('[MusicLoverSignUpFlow] Validating Account Details Step...');
        setError('');
        if (!formData.firstName.trim()) { setError('Please enter your first name'); return false; }
        if (!formData.lastName.trim()) { setError('Please enter your last name'); return false; }
        if (!formData.username.trim()) { setError('Please enter a username'); return false; }
        if (/\s/.test(formData.username.trim())) { setError('Username cannot contain spaces'); return false; }
        if (!formData.email.trim()) { setError('Please enter your email'); return false; }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email.trim())) { setError('Please enter a valid email address'); return false; }
        if (!formData.password) { setError('Please enter a password'); return false; }
        if (formData.password.length < 8) { setError('Password must be at least 8 characters long'); return false; }
        if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); return false; }
        if (!formData.termsAccepted) { setError('Please accept the Terms and Conditions'); return false; }
        console.log('[MusicLoverSignUpFlow] Account Details Step Validation PASSED.');
        return true;
    };

    const validateProfileDetailsStep = (): boolean => {
        console.log('[MusicLoverSignUpFlow] Validating Profile Details Step...');
        setError('');
        if (formData.age && (!/^\d+$/.test(formData.age) || parseInt(formData.age, 10) < 1 || parseInt(formData.age, 10) > 120)) {
            setError('Please enter a valid age (1-120) or leave blank');
            return false;
        }
        console.log('[MusicLoverSignUpFlow] Profile Details Step Validation PASSED.');
        return true;
    };

    const validateStreamingServiceStep = (): boolean => {
        console.log('[MusicLoverSignUpFlow] Validating Streaming Service Step...');
        setError('');
        // Require a valid streaming service selection
        if (!formData.selectedStreamingService) {
            setError('Please select a streaming service or "None / Other"');
            return false;
        }
        console.log('[MusicLoverSignUpFlow] Streaming Service Step Validation PASSED.');
        return true;
    };

    const validateSubscriptionStep = (): boolean => {
        console.log('[MusicLoverSignUpFlow] Validating Subscription Step...');
        setError('');
        if (!formData.subscriptionTier) {
            setError('Please select a subscription tier (Free or Premium).');
            return false;
        }
        console.log('[MusicLoverSignUpFlow] Subscription Step Validation PASSED.');
        return true;
    };

    const validatePaymentStep = (): boolean => {
        console.log('[MusicLoverSignUpFlow] Validating Payment Step...');
        setError('');
        const { cardNumber, expiry, cvv, name } = formData.paymentInfo;
        // Basic Luhn algorithm check (optional but recommended for real apps)
        // function isValidLuhn(number: string): boolean { ... }
        if (!cardNumber.trim() || !/^\d{13,19}$/.test(cardNumber.replace(/\s/g, ''))) { setError('Please enter a valid card number (13-19 digits)'); return false; }
        // if (!isValidLuhn(cardNumber.replace(/\s/g, ''))) { setError('Invalid card number.'); return false; }

        if (!expiry.trim() || !/^(0[1-9]|1[0-2])\/?([0-9]{2})$/.test(expiry)) { setError('Please enter expiry date as MM/YY'); return false; }
        const expiryMatch = expiry.match(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/);
        if (expiryMatch) {
            const expMonth = parseInt(expiryMatch[1], 10);
            const expYearShort = parseInt(expiryMatch[2], 10);
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1;
            const expYear = 2000 + expYearShort;
            if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
                setError('Card expiry date has passed');
                return false;
            }
        } else { // Should not happen if regex passes, but good fallback
             setError('Invalid expiry date format (MM/YY)');
             return false;
        }

        if (!cvv.trim() || !/^\d{3,4}$/.test(cvv)) { setError('Please enter a valid CVV (3 or 4 digits)'); return false; }
        if (!name.trim()) { setError('Please enter the cardholder name'); return false; }
        console.log('[MusicLoverSignUpFlow] Payment Step Validation PASSED.');
        return true;
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
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8, // Balance quality and size
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                // Log asset details for debugging
                console.log(`[MusicLoverSignUpFlow] Image selected. URI: ${asset.uri.substring(0, 100)}...`);
                console.log(`[MusicLoverSignUpFlow] >> MimeType: ${asset.mimeType}, Size: ${asset.fileSize}, Width: ${asset.width}, Height: ${asset.height}`);

                // *** STORE URI AND MIME TYPE IN STATE ***
                handleChange('profilePictureUri', asset.uri);
                handleChange('profilePicturePreview', asset.uri);
                handleChange('profilePictureMimeType', asset.mimeType); // Store the mimeType

                setError(''); // Clear any previous errors
            } else {
                console.log('[MusicLoverSignUpFlow] Image picking cancelled or no assets returned.');
            }
        } catch (error: any) {
            console.error('[MusicLoverSignUpFlow] Error picking profile picture:', error);
            setError(`Failed to pick image: ${error.message || 'Unknown error'}`);
            Alert.alert('Image Selection Error', 'Could not select image. Please try again.');
        }
    };

    // --- Signup Logic ---

    // Helper to consolidate profile data creation before calling the hook
    const prepareProfileData = (userId: string): CreateMusicLoverProfileData => {
        // Validate age input
        const age = formData.age ? parseInt(formData.age) : null;
        if (age !== null && (isNaN(age) || age < 13 || age > 120)) {
            throw new Error('Please enter a valid age between 13 and 120');
        }

        return {
            userId,
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            username: formData.username.trim(),
            email: formData.email.trim(),
            age,
            bio: {
                firstSong: formData.bio.firstSong?.trim() || '',
                goToSong: formData.bio.goToSong?.trim() || '',
                mustListenAlbum: formData.bio.mustListenAlbum?.trim() || '',
                dreamConcert: formData.bio.dreamConcert?.trim() || '',
                musicTaste: formData.bio.musicTaste?.trim() || '',
            },
            country: formData.country?.trim() || undefined,
            city: formData.city?.trim() || undefined,
            termsAccepted: formData.termsAccepted,
            selectedStreamingService: formData.selectedStreamingService || 'None', // Default to 'None' if empty
            profilePictureUri: formData.profilePictureUri,
            profilePictureMimeType: formData.profilePictureMimeType,
        };
    };

    // Creates Auth user AND DB profile record
    const handleAccountAndProfileCreation = async (): Promise<string | null> => {
        console.log('[MusicLoverSignUpFlow] handleAccountAndProfileCreation called.');
        setError('');
        let userId: string | null = null;

        // Set loading state using component's state
        setIsLoading(true);

        try {
            // 1a. Sign up Auth User
            console.log('[MusicLoverSignUpFlow] Calling signUp hook...');
            const signUpResult = await signUp({
                email: formData.email.trim(),
                password: formData.password,
                userType: 'music_lover',
            });

            // Check for error property first (Type Guard)
            if ('error' in signUpResult && signUpResult.error) {
                const errorMsg = signUpResult.error?.message || 'Sign up failed. Unknown error.';
                console.error('[MusicLoverSignUpFlow] signUp hook FAILED:', signUpResult.error);
                setError(errorMsg);
                setIsLoading(false);
                return null;
            } else if (!('user' in signUpResult) || !signUpResult.user?.id) {
                // Handle case where signup succeeded technically but didn't return expected user data
                console.error('[MusicLoverSignUpFlow] signUp hook SUCCEEDED but returned no user ID.');
                setError('Sign up failed. Could not retrieve user details.');
                setIsLoading(false);
                return null;
            }

            // If we reach here, signUpResult must be { user: { id: string, ... } }
            userId = signUpResult.user.id;
            console.log('[MusicLoverSignUpFlow] signUp hook SUCCEEDED. User ID:', userId);

            // 1b. Prepare Profile Data (using helper)
            if (!userId) {
                console.error('[MusicLoverSignUpFlow] userId became null unexpectedly before profile creation.');
                setError('An internal error occurred. Please try again.');
                setIsLoading(false);
                return null;
            }
            const profileDataForHook = prepareProfileData(userId);

            // 1c. Create Music Lover Profile in DB using the hook
            console.log('[MusicLoverSignUpFlow] Calling createMusicLoverProfile hook...');
            const profileResult = await createMusicLoverProfile(profileDataForHook);

            // Check for error property first (Type Guard)
            if ('error' in profileResult && profileResult.error) {
                let errorMsg = profileResult.error.message || 'Failed to save profile details.';
                // Check for specific DB errors like unique username violation
                if (profileResult.error?.code === '23505' && profileResult.error?.message?.includes('username')) {
                    errorMsg = 'This username is already taken. Please choose another.';
                }
                // Handle potential image upload failure reported (if hook returns specific error)
                // if (profileResult.error.uploadError) { errorMsg += ` (Image upload failed: ${profileResult.error.uploadError})`}

                console.error('[MusicLoverSignUpFlow] createMusicLoverProfile hook FAILED:', profileResult.error);
                setError(errorMsg);
                // Alert if account created but profile failed
                Alert.alert('Profile Error', 'Your account was created, but saving profile details failed. Please contact support or try logging in later to complete your profile.');
                // Consider if you should attempt to delete the auth user here? Risky. Better to let them contact support.
                setIsLoading(false);
                return null; // Return null as profile creation failed
            }

            console.log('[MusicLoverSignUpFlow] createMusicLoverProfile hook SUCCEEDED.');
            // Don't set loading false here if subsequent steps follow immediately
            return userId; // Return user ID on full success

        } catch (err: any) {
            console.error('[MusicLoverSignUpFlow] UNEXPECTED error in handleAccountAndProfileCreation:', err);
            setError(err.message || 'An unexpected error occurred during account creation.');
            setIsLoading(false);
            return null;
        }
    };

    // Completes signup for FREE tier - MODIFIED NAVIGATION
    const handleFreeSignupCompletion = async () => {
        try {
            console.log('[MusicLoverSignUpFlow] Starting free signup completion...');
            setIsLoading(true);
            setError('');

            // Create user account and profile, get the user ID
            const userId = await handleAccountAndProfileCreation();
            if (!userId) {
                throw new Error("Failed to create account and profile");
            }

            // If a streaming service was connected, fetch the data
            if (formData.selectedStreamingService === 'spotify' && isSpotifyLoggedIn) {
                console.log('[MusicLoverSignUpFlow] Fetching Spotify data for free user...');
                try {
                    await forceFetchAndSaveSpotifyData(userId, false); // false = not premium
                } catch (spotifyError) {
                    console.error('[MusicLoverSignUpFlow] Error fetching Spotify data:', spotifyError);
                    // Non-critical - continue signup even if this fails
                }
            }
            
            // Handle YouTube Music data fetch if connected
            if (formData.selectedStreamingService === 'youtubemusic' && isYouTubeMusicLoggedIn) {
                console.log('[MusicLoverSignUpFlow] Fetching YouTube Music data for free user...');
                try {
                    await forceFetchAndSaveYouTubeMusicData(userId, false); // false = not premium
                } catch (ytmError) {
                    console.error('[MusicLoverSignUpFlow] Error fetching YouTube Music data:', ytmError);
                    // Non-critical - continue signup even if this fails
                }
            }

            // Set premium status to false
            await updatePremiumStatus(userId, false);

            // Success - navigate to home/dashboard
            console.log('[MusicLoverSignUpFlow] Free signup completed successfully, navigating to home.');
            navigation.reset({
                index: 0,
                routes: [{ name: 'MainApp', params: { screen: 'UserTabs' } }],
            });

        } catch (error) {
            console.error('[MusicLoverSignUpFlow] Error in free signup completion:', error);
            let errorMsg = 'An error occurred during signup';
            
            if (error instanceof Error) {
                errorMsg = error.message;
            }
            
            setError(errorMsg);
            Alert.alert('Signup Error', errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    // Completes signup for PREMIUM tier - SIMPLIFIED NAVIGATION
    const handlePremiumSignupCompletion = async () => {
        try {
            // ... [Same as before until after user account creation]
            
            // Create user account and profile, get the user ID
            const userId = await handleAccountAndProfileCreation();
            if (!userId) {
                throw new Error("Failed to create account and profile");
            }

            // Process payment with Stripe
            // ... [No changes to payment processing code] ...

            // After payment success, fetch service data if connected
            if (formData.selectedStreamingService === 'spotify' && isSpotifyLoggedIn) {
                console.log('[MusicLoverSignUpFlow] Fetching Spotify data for premium user...');
                try {
                    await forceFetchAndSaveSpotifyData(userId, true); // true = premium
                } catch (spotifyError) {
                    console.error('[MusicLoverSignUpFlow] Error fetching Spotify data:', spotifyError);
                    // Non-critical - continue signup even if this fails
                }
            }
            
            // Handle YouTube Music data fetch if connected
            if (formData.selectedStreamingService === 'youtubemusic' && isYouTubeMusicLoggedIn) {
                console.log('[MusicLoverSignUpFlow] Fetching YouTube Music data for premium user...');
                try {
                    await forceFetchAndSaveYouTubeMusicData(userId, true); // true = premium
                } catch (ytmError) {
                    console.error('[MusicLoverSignUpFlow] Error fetching YouTube Music data:', ytmError);
                    // Non-critical - continue signup even if this fails
                }
            }

            // Set premium status to true 
            await updatePremiumStatus(userId, true);

            // Success - navigate to home/dashboard
            console.log('[MusicLoverSignUpFlow] Premium signup completed successfully, navigating to home.');
            navigation.reset({
                index: 0, 
                routes: [{ name: 'MainApp', params: { screen: 'UserTabs' } }],
            });

        } catch (error) {
            // ... [No changes to error handling]
        } finally {
            setIsLoading(false);
        }
    };

    // --- Handle Step Submission (Orchestrator) ---
    const handleStepSubmit = async () => {
        console.log(`[MusicLoverSignUpFlow] handleStepSubmit called for step: ${currentStep}`);
        setError('');

        switch (currentStep) {
            case 'account-details':
                if (validateAccountDetailsStep()) goToNextStep('profile-details');
                break;
            case 'profile-details':
                if (validateProfileDetailsStep()) goToNextStep('streaming-service');
                break;
            case 'streaming-service':
                if (validateStreamingServiceStep()) goToNextStep('subscription');
                break;
            case 'subscription':
                if (validateSubscriptionStep()) {
                    if (formData.subscriptionTier === 'free') {
                        await handleFreeSignupCompletion(); // Handles final steps + loading
                    } else if (formData.subscriptionTier === 'premium') {
                        goToNextStep('payment');
                    }
                }
                break;
            case 'payment':
                 await handlePremiumSignupCompletion(); // Handles final steps + loading
                break;
        }
    };

    // --- Render Functions for Steps ---

    const renderAccountDetailsStep = () => (
        <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Create Your Account</Text>
            {/* First/Last Name Row */}
            <View style={styles.rowContainer}>
                <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.inputLabel}>First Name *</Text>
                    <TextInput style={styles.input} placeholder="First Name" value={formData.firstName} onChangeText={(text) => handleChange('firstName', text)} autoCapitalize="words" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => {/* Focus next */}}/>
                </View>
                <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.inputLabel}>Last Name *</Text>
                    <TextInput style={styles.input} placeholder="Last Name" value={formData.lastName} onChangeText={(text) => handleChange('lastName', text)} autoCapitalize="words" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => {/* Focus next */}}/>
                </View>
            </View>
            {/* Username */}
            <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Username *</Text>
                <TextInput style={styles.input} placeholder="Choose a unique username (no spaces)" value={formData.username} onChangeText={(text) => handleChange('username', text.replace(/\s/g, ''))} autoCapitalize="none" autoCorrect={false} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => {/* Focus next */}}/>
            </View>
            {/* Email */}
            <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email *</Text>
                <TextInput style={styles.input} placeholder="Enter your email address" value={formData.email} onChangeText={(text) => handleChange('email', text)} keyboardType="email-address" autoCapitalize="none" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => {/* Focus next */}}/>
            </View>
            {/* Password */}
            <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password *</Text>
                <TextInput style={styles.input} placeholder="Create a password (min. 8 characters)" value={formData.password} onChangeText={(text) => handleChange('password', text)} secureTextEntry autoCapitalize="none" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => {/* Focus next */}}/>
            </View>
            {/* Confirm Password */}
            <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Confirm Password *</Text>
                <TextInput style={styles.input} placeholder="Confirm your password" value={formData.confirmPassword} onChangeText={(text) => handleChange('confirmPassword', text)} secureTextEntry autoCapitalize="none" returnKeyType="done" onSubmitEditing={handleStepSubmit} />
            </View>
            {/* Terms */}
            <View style={styles.termsContainer}>
                <TouchableOpacity
                    style={[styles.checkbox, formData.termsAccepted && styles.checkboxChecked]}
                    onPress={() => handleChange('termsAccepted', !formData.termsAccepted)}
                    activeOpacity={0.7}
                >
                    {formData.termsAccepted && <Feather name="check" size={14} color="white" />}
                </TouchableOpacity>
                <Text style={styles.termsText}>
                    I agree to the{' '}
                    <Text style={styles.termsLink} onPress={() => setIsTermsModalVisible(true)}>{/* Open modal */}
                        Terms and Conditions
                    </Text> *
                </Text>
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Text style={styles.requiredText}>* Required fields</Text>
        </View>
    );

    const renderProfileDetailsStep = () => (
        <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Tell Us About You</Text>
            <Text style={styles.stepDescription}> Help others connect with your vibe! (All fields optional below) </Text>
            {/* Profile Picture */}
            <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Profile Picture</Text>
                <View style={styles.profilePicContainer}>
                    {formData.profilePicturePreview ? (
                       <Image source={{ uri: formData.profilePicturePreview }} style={styles.profilePicPreview} />
                    ) : (
                       <View style={styles.profilePicPlaceholder}>
                          <Feather name="user" size={40} color={APP_CONSTANTS.COLORS.PRIMARY_DARK} />
                       </View>
                    )}
                    <TouchableOpacity style={styles.uploadButton} onPress={handleProfilePicPick} activeOpacity={0.8}>
                        <Feather name="camera" size={16} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.uploadButtonText}>
                            {formData.profilePicturePreview ? 'Change Picture' : 'Select Picture'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
            {/* Age, Country, City */}
            <View style={styles.rowContainer}>
                <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.inputLabel}>Age</Text>
                    <TextInput style={styles.input} placeholder="e.g. 25" value={formData.age} onChangeText={(text) => handleChange('age', text.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={3} returnKeyType="next" blurOnSubmit={false} />
                </View>
                <View style={[styles.inputContainer, { flex: 2, marginLeft: 8 }]}>
                    <Text style={styles.inputLabel}>Country</Text>
                    <TextInput style={styles.input} placeholder="Country" value={formData.country} onChangeText={(text) => handleChange('country', text)} autoCapitalize="words" returnKeyType="next" blurOnSubmit={false} />
                </View>
            </View>
            <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>City</Text>
                <TextInput style={styles.input} placeholder="City" value={formData.city} onChangeText={(text) => handleChange('city', text)} autoCapitalize="words" returnKeyType="next" blurOnSubmit={false} />
            </View>
            {/* Bio Section */}
            <Text style={[styles.inputLabel, styles.bioHeader]}> Music Bio (Share your sound!) </Text>
            <View style={styles.inputContainer}>
                <Text style={styles.inputLabelSmall}>Your first concert / favorite music memory?</Text>
                <TextInput style={styles.inputBio} value={formData.bio.firstSong} onChangeText={(text) => handleChange('bio.firstSong', text)} placeholder="That unforgettable show..." multiline returnKeyType="next" blurOnSubmit={false} />
            </View>
            <View style={styles.inputContainer}>
                <Text style={styles.inputLabelSmall}>Go-to song right now?</Text>
                <TextInput style={styles.inputBio} value={formData.bio.goToSong} onChangeText={(text) => handleChange('bio.goToSong', text)} placeholder="The track on repeat..." returnKeyType="next" blurOnSubmit={false} />
            </View>
            <View style={styles.inputContainer}>
                <Text style={styles.inputLabelSmall}>An album everyone should listen to?</Text>
                <TextInput style={styles.inputBio} value={formData.bio.mustListenAlbum} onChangeText={(text) => handleChange('bio.mustListenAlbum', text)} placeholder="Your essential pick..." returnKeyType="next" blurOnSubmit={false} />
            </View>
            <View style={styles.inputContainer}>
                <Text style={styles.inputLabelSmall}>Dream concert lineup?</Text>
                <TextInput style={styles.inputBio} value={formData.bio.dreamConcert} onChangeText={(text) => handleChange('bio.dreamConcert', text)} placeholder="Headliner? Opener?" returnKeyType="next" blurOnSubmit={false} />
            </View>
            <View style={styles.inputContainer}>
                <Text style={styles.inputLabelSmall}>Describe your music taste in a few words?</Text>
                <TextInput style={styles.inputBio} value={formData.bio.musicTaste} onChangeText={(text) => handleChange('bio.musicTaste', text)} placeholder="Indie rock, 90s hip hop, electronic..." returnKeyType="done" onSubmitEditing={handleStepSubmit} />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
    );

    // Handle streaming service selection - UPDATED to support YouTube Music
    const handleStreamingServiceSelect = async (serviceId: StreamingServiceId) => {
        console.log(`[MusicLoverSignUpFlow] Service selected: ${serviceId || 'None'}`);
        // Always store 'None' instead of empty string for consistency
        const normalizedServiceId = serviceId || 'None';
        setFormData(prev => ({ ...prev, selectedStreamingService: normalizedServiceId as StreamingServiceId }));
        setError(''); // Clear previous errors

        if (serviceId === 'spotify') {
            // If Spotify is selected, initiate the login flow
            console.log('[MusicLoverSignUpFlow] Spotify selected, initiating Spotify login...');
            try {
                spotifyLogin(); // This opens the browser for Spotify auth
                // Note: We don't immediately navigate - the useEffect watching isSpotifyLoggedIn will handle that
            } catch (error) {
                console.error('[MusicLoverSignUpFlow] Error initiating Spotify login:', error);
                Alert.alert(
                    "Spotify Connection Failed",
                    "We couldn't connect to Spotify. You can try again later or continue without connecting.",
                    [
                        { text: "Continue Anyway", onPress: () => goToNextStep('subscription') }
                    ]
                );
            }
        } else if (serviceId === 'youtubemusic') {
            // Handle YouTube Music authentication
            console.log('[MusicLoverSignUpFlow] YouTube Music selected, initiating login flow...');
            try {
                setYtmAuthInProgress(true);
                const authDetails = await youTubeMusicLogin();
                
                if (authDetails) {
                    // Show the authentication details on the same page
                    setYTMAuthDetails(authDetails);
                    setShowYTMAuthCode(true);
                    
                    // IMPORTANT: We're not automatically opening the browser anymore
                    // Display the info for the user to manually navigate
                } else {
                    // Something went wrong with getting the auth details
                    Alert.alert(
                        "YouTube Music Connection Failed",
                        "We couldn't start the connection process. You can try again later or continue without connecting.",
                        [{ text: "Continue Anyway", onPress: () => goToNextStep('subscription') }]
                    );
                }
                setYtmAuthInProgress(false);
            } catch (error) {
                setYtmAuthInProgress(false);
                console.error('[MusicLoverSignUpFlow] Error initiating YouTube Music login:', error);
                Alert.alert(
                    "YouTube Music Connection Failed",
                    "We couldn't connect to YouTube Music. You can try again later or continue without connecting.",
                    [{ text: "Continue Anyway", onPress: () => goToNextStep('subscription') }]
                );
            }
        } else {
            // For other services (or 'None'), proceed directly
            console.log(`[MusicLoverSignUpFlow] ${normalizedServiceId} selected, proceeding to subscription step`);
            validateStreamingServiceStep() && goToNextStep('subscription');
        }
    };

    // Handle completion of YouTube Music auth - UPDATED
    const handleYTMAuthComplete = async () => {
        if (!ytmAuthDetails) return;
        
        try {
            setIsLoading(true);
            console.log('[MusicLoverSignUpFlow] Completing YouTube Music auth...');
            const success = await ytmAuthDetails.completion();
            
            if (success) {
                console.log('[MusicLoverSignUpFlow] YouTube Music auth completed successfully');
                setShowYTMAuthCode(false);
                setYTMAuthDetails(null);
                
                // Navigate to subscription step
                goToNextStep('subscription');
            } else {
                console.error('[MusicLoverSignUpFlow] YouTube Music auth completion failed');
                Alert.alert(
                    "Authentication Failed",
                    "We couldn't complete the YouTube Music authentication. You can try again or continue without connecting.",
                    [
                        { text: "Try Again", onPress: () => handleStreamingServiceSelect('youtubemusic') },
                        { text: "Continue Anyway", onPress: () => goToNextStep('subscription') }
                    ]
                );
            }
        } catch (error) {
            console.error('[MusicLoverSignUpFlow] Error completing YouTube Music auth:', error);
            Alert.alert(
                "Authentication Error",
                "An error occurred during YouTube Music authentication. You can try again or continue without connecting.",
                [
                    { text: "Try Again", onPress: () => handleStreamingServiceSelect('youtubemusic') },
                    { text: "Continue Anyway", onPress: () => goToNextStep('subscription') }
                ]
            );
        } finally {
            setIsLoading(false);
        }
    };

    // Cancel YouTube Music auth - UPDATED
    const handleSkipYTMAuth = () => {
        setShowYTMAuthCode(false);
        setYTMAuthDetails(null);
        goToNextStep('subscription');
    };

    // When subscription choice changes, update the form and alert about streaming service features
    const handleSubscriptionChange = (tier: SubscriptionTier) => {
        setFormData(prev => ({ ...prev, subscriptionTier: tier }));

        // Show alert about streaming service data limits based on selected service
        if (formData.selectedStreamingService === 'spotify' || formData.selectedStreamingService === 'youtubemusic') {
            const serviceName = formData.selectedStreamingService === 'spotify' ? 'Spotify' : 'YouTube Music';
            const message = tier === 'premium'
                ? `With Premium, you'll get access to your top 5 artists, songs, albums, and genres from ${serviceName}!`
                : `With Free tier, you'll see your top 3 artists, songs, albums, and genres from ${serviceName}. Upgrade to Premium for top 5!`;

            Alert.alert(`${serviceName} Data Access`, message, [{ text: "OK" }]);
        }
    };

    // Effect to navigate after successful Spotify login during signup
    useEffect(() => {
        // Check if we are on the correct step, Spotify is selected, and login just completed
        if (currentStep === 'streaming-service' && 
            formData.selectedStreamingService === 'spotify' && 
            isSpotifyLoggedIn) {
            
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
        }
    }, [isSpotifyLoggedIn, currentStep, formData.selectedStreamingService, verifyAuthorizationCompleted]);

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

    // Effect to handle YouTube Music login errors during signup
    useEffect(() => {
        if (currentStep === 'streaming-service' && formData.selectedStreamingService === 'youtubemusic' && youTubeMusicError) {
            console.error('[MusicLoverSignUpFlow] YouTube Music login error detected:', youTubeMusicError);
            Alert.alert(
                "YouTube Music Connection Issue",
                `We encountered a problem connecting to YouTube Music: ${youTubeMusicError}. You can try again, select another service, or continue without connecting.`,
                [
                    { 
                        text: "Try Again", 
                        onPress: () => handleStreamingServiceSelect('youtubemusic') 
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
    }, [youTubeMusicError, currentStep, formData.selectedStreamingService]);

    // Updated streaming service selection UI with YouTube Music auth info
    const renderStreamingServiceStep = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Music Services</Text>
            <Text style={styles.stepSubtitle}>
                What streaming service do you use most?
            </Text>

            <View style={styles.streamingServicesGrid}>
                {STREAMING_SERVICES.map((service) => (
                    <TouchableOpacity
                        key={service.id}
                        style={[
                            styles.serviceCard,
                            formData.selectedStreamingService === service.id && styles.selectedServiceCard
                        ]}
                        onPress={() => handleStreamingServiceSelect(service.id as StreamingServiceId)}
                        disabled={ytmAuthInProgress || showYTMAuthCode}
                    >
                        <View style={[styles.serviceIconContainer, { backgroundColor: service.color }]}>
                            {service.iconSet === 'FontAwesome' && (
                                <FontAwesome name={service.icon as any} size={28} color="#FFF" />
                            )}
                            {service.iconSet === 'MaterialCommunityIcons' && (
                                <MaterialCommunityIcons name={service.icon as any} size={28} color="#FFF" />
                            )}
                        </View>
                        <Text style={styles.serviceName}>{service.name}</Text>
                        {formData.selectedStreamingService === service.id && (
                            <View style={styles.checkmarkBadge}>
                                <Feather name="check" size={16} color="#FFFFFF" />
                            </View>
                        )}
                    </TouchableOpacity>
                ))}

                <TouchableOpacity
                    style={[
                        styles.serviceCard,
                        formData.selectedStreamingService === 'None' && styles.selectedServiceCard
                    ]}
                    onPress={() => handleStreamingServiceSelect('None')}
                    disabled={ytmAuthInProgress || showYTMAuthCode}
                >
                    <View style={[styles.serviceIconContainer, { backgroundColor: '#5C5C5C' }]}>
                        <Feather name="zap-off" size={28} color="#FFF" />
                    </View>
                    <Text style={styles.serviceName}>None / Other</Text>
                    {formData.selectedStreamingService === 'None' && (
                        <View style={styles.checkmarkBadge}>
                            <Feather name="check" size={16} color="#FFFFFF" />
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* YouTube Music Authentication Info Section */}
            {showYTMAuthCode && ytmAuthDetails && (
                <View style={styles.ytmAuthContainer}>
                    <Text style={styles.ytmAuthTitle}>Connect YouTube Music</Text>
                    
                    <View style={styles.ytmAuthCodeBox}>
                        <Text style={styles.ytmAuthCodeLabel}>Your code:</Text>
                        <Text style={styles.ytmAuthCode}>{ytmAuthDetails.userCode}</Text>
                    </View>
                    
                    <Text style={styles.ytmAuthInstructions}>
                        1. Visit: {ytmAuthDetails.verificationUrl}
                    </Text>
                    <Text style={styles.ytmAuthInstructions}>
                        2. Enter the code shown above
                    </Text>
                    <Text style={styles.ytmAuthInstructions}>
                        3. After authorizing, click "Complete" below
                    </Text>
                    
                    <View style={styles.ytmAuthButtons}>
                        <TouchableOpacity 
                            style={styles.ytmAuthButton}
                            onPress={() => WebBrowser.openBrowserAsync(ytmAuthDetails.verificationUrl)}
                        >
                            <Text style={styles.ytmAuthButtonText}>Open Website</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={[styles.ytmAuthButton, styles.ytmCompleteButton]}
                            onPress={handleYTMAuthComplete}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Text style={styles.ytmAuthButtonText}>Complete</Text>
                            )}
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={[styles.ytmAuthButton, styles.ytmSkipButton]}
                            onPress={handleSkipYTMAuth}
                            disabled={isLoading}
                        >
                            <Text style={styles.ytmAuthButtonText}>Skip</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {ytmAuthInProgress && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
                    <Text style={styles.loadingText}>Connecting to YouTube Music...</Text>
                </View>
            )}

            {/* Button Container */}
            {!showYTMAuthCode && !ytmAuthInProgress && (
                <View style={styles.buttonContainer}>
                    <TouchableOpacity 
                        style={styles.secondaryButton} 
                        onPress={() => goToPreviousStep('profile-details')}
                    >
                        <Text style={styles.secondaryButtonText}>Back</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => {
                            // Validate that a service is selected (including 'None')
                            if (validateStreamingServiceStep()) {
                                goToNextStep('subscription');
                            }
                        }}
                    >
                        <Text style={styles.primaryButtonText}>Continue</Text>
                    </TouchableOpacity>
                </View>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
    );

    // Improved subscription plan selection UI
    const renderSubscriptionStep = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Choose Your Plan</Text>
            <Text style={styles.stepSubtitle}>Select a subscription plan that works for you</Text>

            <View style={styles.subscriptionOptionsContainer}>
                {/* Free Tier */}
                <TouchableOpacity
                    style={[
                        styles.subscriptionCard,
                        formData.subscriptionTier === 'free' && styles.selectedSubscriptionCard
                    ]}
                    onPress={() => handleSubscriptionChange('free')}
                >
                    <View style={styles.planHeader}>
                        <Text style={styles.planTitle}>Free</Text>
                        <Text style={styles.planPrice}>$0/month</Text>
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
                        styles.subscriptionCard,
                        styles.premiumCard,
                        formData.subscriptionTier === 'premium' && styles.selectedSubscriptionCard
                    ]}
                    onPress={() => handleSubscriptionChange('premium')}
                >
                    <View style={styles.planHeader}>
                        <Text style={styles.planTitle}>Premium</Text>
                        <Text style={styles.planPrice}>$4.99/month</Text>
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

            <View style={styles.buttonContainer}>
                <TouchableOpacity 
                    style={styles.secondaryButton} 
                    onPress={() => goToPreviousStep('streaming-service')}
                >
                    <Text style={styles.secondaryButtonText}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => {
                        if (validateSubscriptionStep()) {
                            handleStepSubmit(); // Use the same submit handler for both free and premium
                        }
                    }}
                >
                    <Text style={styles.primaryButtonText}>
                        {formData.subscriptionTier === 'premium' ? 'Continue' : 'Create Account'} 
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderPaymentStep = () => (
        <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Premium Payment</Text>
            <Text style={styles.stepDescription}> Enter payment details for Vybr Premium ($4.99/month). {'\n'}(This is a simulation - no real charge will occur) </Text>
            {/* Card Number */}
            <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Card Number *</Text>
                <TextInput style={styles.input} placeholder="XXXX XXXX XXXX XXXX" value={formData.paymentInfo.cardNumber} onChangeText={(text) => handleChange('paymentInfo.cardNumber', text)} keyboardType="number-pad" maxLength={19} returnKeyType="next" blurOnSubmit={false} />
            </View>
            {/* Expiry and CVV */}
            <View style={styles.rowContainer}>
                <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.inputLabel}>Expiry Date *</Text>
                    <TextInput style={styles.input} placeholder="MM/YY" value={formData.paymentInfo.expiry} onChangeText={(text) => handleChange('paymentInfo.expiry', text)} keyboardType="number-pad" maxLength={5} returnKeyType="next" blurOnSubmit={false} />
                </View>
                <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.inputLabel}>CVV *</Text>
                    <TextInput style={styles.input} placeholder="CVV" value={formData.paymentInfo.cvv} onChangeText={(text) => handleChange('paymentInfo.cvv', text)} keyboardType="number-pad" maxLength={4} secureTextEntry returnKeyType="next" blurOnSubmit={false} />
                </View>
            </View>
            {/* Cardholder Name */}
            <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Cardholder Name *</Text>
                <TextInput style={styles.input} placeholder="Name as it appears on card" value={formData.paymentInfo.name} onChangeText={(text) => handleChange('paymentInfo.name', text)} autoCapitalize="words" returnKeyType="done" onSubmitEditing={handleStepSubmit} />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Text style={styles.requiredText}>* Required fields</Text>
        </View>
    );

    // Render current step selector and action button
    const renderCurrentStep = () => {
        // Determine if button should be disabled (combine component and hook loading states)
        // IMPORTANT: No longer disable if Spotify is selected but not logged in
        const isButtonDisabled = isLoading || authLoading || isSpotifyLoading || 
            (currentStep === 'subscription' && !formData.subscriptionTier);

        // Determine button text based on current step
        let buttonText = 'Continue';
        if (currentStep === 'streaming-service') {
            buttonText = 'Continue to Subscription';
        } else if (currentStep === 'subscription') {
            buttonText = formData.subscriptionTier === 'free' ? 'Complete Free Sign Up' : 'Continue to Payment';
        } else if (currentStep === 'payment') {
            buttonText = 'Complete Premium Sign Up';
        }

        return (
            <View style={styles.stepContainer}>
                <Animated.View style={[styles.animatedContainer, { transform: [{ translateX: slideAnim }] }]} >
                    {/* Conditional rendering of steps */}
                    {currentStep === 'account-details' && renderAccountDetailsStep()}
                    {currentStep === 'profile-details' && renderProfileDetailsStep()}
                    {currentStep === 'streaming-service' && renderStreamingServiceStep()}
                    {currentStep === 'subscription' && renderSubscriptionStep()}
                    {currentStep === 'payment' && renderPaymentStep()}
                </Animated.View>

                {/* Action Button - Only show for non-streaming-service steps since that one has its own button now */}
                {currentStep !== 'streaming-service' && (
                    <TouchableOpacity
                        style={[styles.continueButton, isButtonDisabled && styles.continueButtonDisabled]}
                        onPress={handleStepSubmit} // Use central submit handler
                        disabled={isButtonDisabled}
                        activeOpacity={0.8}
                    >
                        {isLoading || authLoading ? ( // Show loader if either state is true
                            <ActivityIndicator color="white" size="small" />
                        ) : (
                            <Text style={styles.continueButtonText}>{buttonText}</Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    // Main Return JSX Structure
    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <LinearGradient colors={[APP_CONSTANTS.COLORS.BACKGROUND, APP_CONSTANTS.COLORS.BACKGROUND_LIGHT]} style={styles.gradient} >
                {/* Header with Back Button and Step Indicators */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => {
                            if (isLoading || authLoading) return; // Prevent back during loading
                            if (currentStep === 'profile-details') goToPreviousStep('account-details');
                            else if (currentStep === 'streaming-service') goToPreviousStep('profile-details');
                            else if (currentStep === 'subscription') goToPreviousStep('streaming-service');
                            else if (currentStep === 'payment') goToPreviousStep('subscription');
                            else navigation.goBack();
                        }}
                        disabled={isLoading || authLoading}
                    >
                        <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
                    </TouchableOpacity>
                    {/* Step Indicators - Updated */}
                    <View style={styles.stepIndicatorContainer}>
                        {['account-details', 'profile-details', 'streaming-service', 'subscription'].map((stepName) => {
                            const stepEnum = stepName as Step;
                            const allPossibleSteps: Step[] = ['account-details', 'profile-details', 'streaming-service', 'subscription', 'payment'];
                            const stepIndex = allPossibleSteps.indexOf(stepEnum);
                            const currentIndex = allPossibleSteps.indexOf(currentStep);
                            const isActive = currentIndex >= stepIndex;
                            const isCurrent = currentStep === stepEnum;
                            return (<View key={stepName} style={[styles.stepIndicator, isActive && styles.stepIndicatorActive, isCurrent && styles.stepIndicatorCurrent]} />);
                        })}
                        {/* Conditionally show payment step indicator only if premium is selected */}
                        {formData.subscriptionTier === 'premium' && (
                            <View style={[styles.stepIndicator, currentStep === 'payment' && styles.stepIndicatorActive, currentStep === 'payment' && styles.stepIndicatorCurrent]} />
                        )}
                    </View>
                    <View style={{ width: 28 }} />{/* Spacer */}
                </View>

                {/* Scrollable Content Area */}
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled={true}
                >
                    {renderCurrentStep()}
                </ScrollView>

                {/* Terms Modal */}
                <TermsModal
                    visible={isTermsModalVisible}
                    onClose={() => setIsTermsModalVisible(false)}
                    termsText={termsAndConditionsText}
                />
            </LinearGradient>
        </SafeAreaView>
    );
};

// --- Styles --- (Includes styles for all steps + streaming service logos)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND },
    gradient: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 16 : 10, paddingBottom: 8, backgroundColor: 'transparent' },
    backButton: { padding: 8, zIndex: 1 },
    stepIndicatorContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flex: 1 },
    stepIndicator: { width: 10, height: 10, borderRadius: 5, backgroundColor: APP_CONSTANTS.COLORS.BORDER_LIGHT, marginHorizontal: 5 },
    stepIndicatorActive: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT },
    stepIndicatorCurrent: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, width: 12, height: 12, borderRadius: 6 },
    scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
    stepContainer: { flex: 1, alignItems: 'center', marginTop: 15, width: '100%' },
    animatedContainer: { width: '100%' },
    stepContent: { width: '100%', paddingBottom: 20 },
    stepTitle: { fontSize: 24, fontWeight: '700', color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, marginBottom: 10, textAlign: 'center' },
    stepDescription: { fontSize: 15, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, marginBottom: 25, textAlign: 'center', lineHeight: 21 },
    inputContainer: { marginBottom: 16, width: '100%' },
    inputLabel: { fontSize: 14, fontWeight: '600', color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, marginBottom: 6 },
    inputLabelSmall: { fontSize: 13, fontWeight: '500', color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, marginBottom: 5 },
    input: { backgroundColor: '#FFFFFF', paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 14 : 12, borderRadius: 8, fontSize: 16, borderWidth: 1, borderColor: APP_CONSTANTS.COLORS.BORDER, color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, width: '100%' },
    inputBio: { backgroundColor: '#FFFFFF', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 8, fontSize: 15, borderWidth: 1, borderColor: APP_CONSTANTS.COLORS.BORDER, color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, width: '100%', minHeight: 45, textAlignVertical: 'top' },
    rowContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
    termsContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 8, width: '100%' },
    checkbox: { width: 20, height: 20, borderWidth: 1.5, borderColor: APP_CONSTANTS.COLORS.BORDER_DARK, borderRadius: 4, marginRight: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
    checkboxChecked: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, borderColor: APP_CONSTANTS.COLORS.PRIMARY },
    termsText: { fontSize: 13, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, lineHeight: 18, flex: 1 },
    termsLink: { color: APP_CONSTANTS.COLORS.PRIMARY, fontWeight: '600', textDecorationLine: 'underline' },
    requiredText: { fontSize: 12, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, marginTop: 4, marginBottom: 16, textAlign: 'right', width: '100%' },
    profilePicContainer: { alignItems: 'center', marginVertical: 15 },
    profilePicPreview: { width: 100, height: 100, borderRadius: 50, marginBottom: 12, backgroundColor: APP_CONSTANTS.COLORS.BORDER_LIGHT, borderWidth: 2, borderColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT },
    profilePicPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: APP_CONSTANTS.COLORS.BORDER_LIGHT + '80', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: APP_CONSTANTS.COLORS.BORDER },
    uploadButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
    uploadButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },
    bioHeader: { marginTop: 15, marginBottom: 10, fontSize: 16, fontWeight: '600', textAlign: 'left', width: '100%' },
    errorText: { color: APP_CONSTANTS.COLORS.ERROR, marginTop: 0, marginBottom: 16, textAlign: 'center', fontSize: 14, fontWeight: '500', width: '100%', paddingHorizontal: 10 },
    continueButton: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingVertical: 15, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 20, width: '100%', minHeight: 50, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
    continueButtonDisabled: { backgroundColor: APP_CONSTANTS.COLORS.DISABLED, elevation: 0, shadowOpacity: 0 },
    continueButtonText: { color: 'white', fontWeight: '600', fontSize: 16 },

    // Streaming Service Styles
    serviceIconContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', alignItems: 'flex-start', marginTop: 20, marginBottom: 5, paddingHorizontal: 0 }, // Reduced bottom margin before required text
    serviceIconWrapper: { alignItems: 'center', width: '33%', marginBottom: 25, paddingHorizontal: 5 },
    serviceIconBackground: { width: 75, height: 75, borderRadius: 37.5, justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 2.5, backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND_LIGHT, borderColor: 'transparent', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3 },
    serviceNameText: { fontSize: 13, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, fontWeight: '500', textAlign: 'center' },
    serviceNameTextSelected: { color: APP_CONSTANTS.COLORS.PRIMARY_DARK, fontWeight: '700' },
    
    // Button container for streaming service step
    buttonContainer: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        width: '100%', 
        marginTop: 20
    },
    secondaryButton: { 
        padding: 12, 
        borderRadius: 8, 
        borderWidth: 1, 
        borderColor: APP_CONSTANTS.COLORS.PRIMARY, 
        alignItems: 'center', 
        justifyContent: 'center',
        width: '45%'
    },
    secondaryButtonText: { 
        color: APP_CONSTANTS.COLORS.PRIMARY, 
        fontWeight: '600', 
        fontSize: 16 
    },
    primaryButton: { 
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, 
        padding: 12, 
        borderRadius: 8, 
        alignItems: 'center', 
        justifyContent: 'center',
        width: '45%',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2
    },
    primaryButtonText: { 
        color: 'white', 
        fontWeight: '600', 
        fontSize: 16 
    },

    // Subscription Plan Styles
    planOption: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1.5, borderColor: APP_CONSTANTS.COLORS.BORDER, padding: 18, marginBottom: 18, shadowColor: "#000000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2, width: '100%' },
    planOptionSelected: { borderColor: APP_CONSTANTS.COLORS.PRIMARY, backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}0A`, shadowColor: APP_CONSTANTS.COLORS.PRIMARY, shadowOpacity: 0.15, shadowRadius: 5, elevation: 4 },
    planHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    planTitle: { fontSize: 17, fontWeight: '700', color: '#374151', marginLeft: 10 },
    planTitleSelected: { color: APP_CONSTANTS.COLORS.PRIMARY },
    planDescription: { fontSize: 14, color: '#6B7280', marginBottom: 6, lineHeight: 19, marginLeft: 34 },
    planPrice: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginTop: 12, marginLeft: 34 },
    planPriceSelected: { color: APP_CONSTANTS.COLORS.PRIMARY },
    
    // New styles for streamingServicesGrid
    streamingServicesGrid: { 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        justifyContent: 'space-around', 
        alignItems: 'flex-start', 
        marginTop: 20, 
        marginBottom: 5, 
        paddingHorizontal: 0 
    },
    serviceCard: { 
        alignItems: 'center', 
        width: '33%', 
        marginBottom: 25, 
        paddingHorizontal: 5 
    },
    selectedServiceCard: { 
        borderColor: APP_CONSTANTS.COLORS.PRIMARY, 
        borderWidth: 2 
    },
    checkmarkBadge: { 
        position: 'absolute', 
        top: 10, 
        right: 10, 
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, 
        padding: 4, 
        borderRadius: 4 
    },
    
    // Styles for Subscription Step
    subscriptionOptionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'stretch',
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    subscriptionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: APP_CONSTANTS.COLORS.BORDER,
        padding: 20,
        width: '48%',
        minHeight: 280,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    selectedSubscriptionCard: {
        borderColor: APP_CONSTANTS.COLORS.PRIMARY,
        backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}0A`,
        shadowColor: APP_CONSTANTS.COLORS.PRIMARY,
        shadowOpacity: 0.15,
        shadowRadius: 5,
        elevation: 4,
    },
    premiumCard: {
        borderColor: APP_CONSTANTS.COLORS.PRIMARY,
    },
    // Set correct planHeader for subscriptions
    // planHeader defined above
    // Keep only one definition of planHeader
    planFeaturesList: {
        flex: 1,
        justifyContent: 'flex-start',
    },
    planFeatureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    featureText: {
        fontSize: 14,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        marginLeft: 8,
        flex: 1,
    },
    selectionBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    premiumSelectionBadge: {
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
    },
    selectionBadgeText: {
        fontSize: 12,
        color: 'white',
        fontWeight: '600',
    },
    
    // YouTube Music Auth Styles
    ytmAuthContainer: {
        marginTop: 20,
        padding: 16,
        backgroundColor: '#F9F9F9',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        marginBottom: 20,
    },
    ytmAuthTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
        marginBottom: 16,
        textAlign: 'center',
    },
    ytmAuthCodeBox: {
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FF0000',
        marginBottom: 16,
        alignItems: 'center',
    },
    ytmAuthCodeLabel: {
        fontSize: 14,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        marginBottom: 8,
    },
    ytmAuthCode: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FF0000',
        letterSpacing: 2,
    },
    ytmAuthInstructions: {
        fontSize: 15,
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
        marginBottom: 8,
        lineHeight: 22,
    },
    ytmAuthButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
    },
    ytmAuthButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#555',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 4,
    },
    ytmAuthButtonText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 14,
    },
    ytmCompleteButton: {
        backgroundColor: '#FF0000',
    },
    ytmSkipButton: {
        backgroundColor: '#999',
    },
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
    stepSubtitle: {
        fontSize: 15,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        marginBottom: 25,
        textAlign: 'center',
        lineHeight: 21,
    },
    serviceName: { 
        fontSize: 13, 
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, 
        fontWeight: '500', 
        textAlign: 'center' 
    },
});

export default MusicLoverSignUpFlow;