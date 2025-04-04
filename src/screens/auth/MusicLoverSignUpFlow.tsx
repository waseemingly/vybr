import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Animated, Image, Platform,
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
// Import specific icon sets from @expo/vector-icons
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons'; // Keep Feather for other icons
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth'; // Adjust import path as needed
import { APP_CONSTANTS } from '@/config/constants'; // Assuming path is correct
import * as ImagePicker from 'expo-image-picker';
// Import the specific types expected by createMusicLoverProfile and for the form state
import { MusicLoverBio, CreateMusicLoverProfileData } from '@/hooks/useAuth'; // Assuming types are exported from useAuth

// Step types
type Step = 'account-details' | 'profile-details' | 'streaming-service' | 'subscription' | 'payment';
type SubscriptionTier = 'free' | 'premium' | '';
type StreamingServiceId = 'spotify' | 'apple_music' | 'youtube_music' | 'deezer' | 'soundcloud' | 'tidal' | ''; // Add '' for initial state

// Define window width for animations
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Define Streaming Services Data - UPDATED with correct icons/sets
const STREAMING_SERVICES = [
  { id: 'spotify', name: 'Spotify', icon: 'spotify', color: '#1DB954', iconSet: 'FontAwesome' },
  { id: 'apple_music', name: 'Apple Music', icon: 'apple-music', color: '#FA57C1', iconSet: 'MaterialCommunityIcons' },
  { id: 'youtube_music', name: 'YouTube Music', icon: 'youtube-play', color: '#FF0000', iconSet: 'FontAwesome' },
  { id: 'deezer', name: 'Deezer', icon: 'deezer', color: '#EF5466', iconSet: 'MaterialCommunityIcons' },
  { id: 'soundcloud', name: 'SoundCloud', icon: 'soundcloud', color: '#FF5500', iconSet: 'FontAwesome' },
  { id: 'tidal', name: 'Tidal', icon: 'tidal', color: '#000000', iconSet: 'MaterialCommunityIcons' },
];

const MusicLoverSignUpFlow = () => {
  const navigation = useNavigation();
  const { signUp, createMusicLoverProfile, updatePremiumStatus, requestMediaLibraryPermissions, loading: authLoading } = useAuth();

  // State for form data - including selectedStreamingService
  const [formData, setFormData] = useState<{
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    username: string;
    termsAccepted: boolean;
    profilePictureUri: string;
    profilePicturePreview: string;
    age: string;
    country: string;
    city: string;
    bio: MusicLoverBio;
    selectedStreamingService: StreamingServiceId; // <-- Added
    subscriptionTier: SubscriptionTier;
    paymentInfo: {
      cardNumber: string;
      expiry: string;
      cvv: string;
      name: string;
    };
  }>({
    email: '', password: '', confirmPassword: '', firstName: '', lastName: '',
    username: '', termsAccepted: false,
    profilePictureUri: '', profilePicturePreview: '',
    age: '', country: '', city: '',
    bio: { firstSong: '', goToSong: '', mustListenAlbum: '', dreamConcert: '', musicTaste: '' },
    selectedStreamingService: '', // <-- Initialized
    subscriptionTier: '',
    paymentInfo: { cardNumber: '', expiry: '', cvv: '', name: '' },
  });

  // State variables
  const [currentStep, setCurrentStep] = useState<Step>('account-details');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const slideAnim = useRef(new Animated.Value(0)).current; // Animation value

  // Request permissions on mount
  useEffect(() => {
    requestMediaLibraryPermissions();
  }, [requestMediaLibraryPermissions]); // Dependency array ensures it runs once


  // Handle form field changes (robust version)
  const handleChange = (field: string, value: any) => {
    const trimmedValue = (typeof value === 'string' && !field.startsWith('paymentInfo.') && field !== 'password' && field !== 'confirmPassword' && field !== 'selectedStreamingService') // Don't trim service ID
        ? value.trimStart()
        : value;

    if (field.startsWith('bio.')) {
        const bioField = field.split('.')[1] as keyof MusicLoverBio;
        const trimmedBioValue = typeof trimmedValue === 'string' ? trimmedValue.trimStart() : trimmedValue;
        setFormData(prev => ({ ...prev, bio: { ...prev.bio, [bioField]: trimmedBioValue } }));
    } else if (field.startsWith('paymentInfo.')) {
        const key = field.split('.')[1];
        let processedValue = typeof value === 'string' ? value.trim() : value;
        if (key === 'cardNumber') processedValue = processedValue.replace(/\D/g, '');
        if (key === 'expiry') {
             processedValue = processedValue.replace(/\D/g, '');
             const currentExpiry = formData.paymentInfo.expiry;
             if (processedValue.length >= 2 && !currentExpiry.includes('/') && processedValue.length <= 4) { // Improved expiry formatting
                 processedValue = processedValue.slice(0, 2) + '/' + processedValue.slice(2);
             }
             processedValue = processedValue.slice(0, 5); // Max length MM/YY
        }
        if (key === 'cvv') processedValue = processedValue.replace(/\D/g, '').slice(0, 4);
        setFormData(prev => ({ ...prev, paymentInfo: { ...prev.paymentInfo, [key]: processedValue } }));
    } else {
        const key = field as keyof typeof formData;
        setFormData(prev => ({ ...prev, [key]: trimmedValue }));
    }
    if (error) setError('');
  };


  // Show terms and conditions alert
  const showTermsAndConditions = () => {
     Alert.alert(
        "Terms and Conditions",
        "By creating an account, you agree to Vybr's Terms of Service and Privacy Policy. We collect information like your email, name, chosen username, optional profile details (age, location, bio, picture), selected streaming service, and subscription status. If you choose Premium, we (or our payment processor) collect payment info. We use this data to provide the service, personalize your experience, facilitate connections, and communicate with you. Your profile information (excluding email unless you share it) may be visible to other users. You control your optional profile data. See our full Privacy Policy for details.",
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
    if (/\s/.test(formData.username.trim())) { setError('Username cannot contain spaces'); return false;}
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
    if (formData.age && (!/^\d+$/.test(formData.age) || parseInt(formData.age, 10) < 1 || parseInt(formData.age, 10) > 120 )) {
      setError('Please enter a valid age (1-120) or leave blank');
      return false;
    }
    // Add other optional field validations if needed (e.g., country format)
    console.log('[MusicLoverSignUpFlow] Profile Details Step Validation PASSED.');
    return true;
  };

  // NEW: Validation for Streaming Service Step
  const validateStreamingServiceStep = (): boolean => {
    console.log('[MusicLoverSignUpFlow] Validating Streaming Service Step...');
    setError('');
    if (!formData.selectedStreamingService) {
        setError('Please select your primary streaming service.');
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
      if (!cardNumber.trim() || !/^\d{15,19}$/.test(cardNumber.replace(/\s/g, ''))) { setError('Please enter a valid card number (15-19 digits)'); return false; }

      if (!expiry.trim() || !/^(0[1-9]|1[0-2])\/?([0-9]{2})$/.test(expiry)) { setError('Please enter expiry date as MM/YY'); return false; }
        const expiryMatch = expiry.match(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/);
        if (expiryMatch) {
            const expMonth = parseInt(expiryMatch[1], 10);
            const expYearShort = parseInt(expiryMatch[2], 10);
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1; // Date months are 0-indexed
            const expYear = 2000 + expYearShort;
            if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
                setError('Card expiry date has passed');
                return false;
            }
        } else {
            setError('Invalid expiry date format (MM/YY)'); // Should be caught by regex, but good fallback
            return false;
        }

      if (!cvv.trim() || !/^\d{3,4}$/.test(cvv)) { setError('Please enter a valid CVV (3 or 4 digits)'); return false; }
      if (!name.trim()) { setError('Please enter the cardholder name'); return false; }
      console.log('[MusicLoverSignUpFlow] Payment Step Validation PASSED.');
      return true;
  };

  // Handle Profile Picture Picking
  const handleProfilePicPick = async () => {
    console.log('[MusicLoverSignUpFlow] handleProfilePicPick called.');
    const hasPermission = await requestMediaLibraryPermissions();
    if (!hasPermission) {
        console.log('[MusicLoverSignUpFlow] Permission denied for media library.');
        Alert.alert('Permission Required', 'Please grant access to your photos to select a profile picture.');
        return;
    }
    try {
      console.log('[MusicLoverSignUpFlow] Launching image picker...');
      const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images, // Use correct enum
          allowsEditing: true,
          aspect: [1, 1], // Square aspect ratio
          quality: 0.7, // Compress image slightly
       });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        console.log(`[MusicLoverSignUpFlow] Image selected. URI: ${asset.uri.substring(0,100)}..., Type: ${asset.mimeType}, Size: ${asset.fileSize}`);
        setFormData(prev => ({
          ...prev,
          profilePictureUri: asset.uri, // URI for upload
          profilePicturePreview: asset.uri // URI for display
        }));
        setError('');
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
  // Creates Auth user and DB profile record (including streaming service)
  const handleAccountAndProfileCreation = async (): Promise<string | null> => {
    console.log('[MusicLoverSignUpFlow] handleAccountAndProfileCreation called.');
    setError('');
    let userId: string | null = null;

    try {
      // 1a. Sign up Auth User
      console.log('[MusicLoverSignUpFlow] Calling signUp hook...');
      const signUpResult = await signUp({
        email: formData.email.trim(),
        password: formData.password,
        userType: 'music_lover',
        firstName: formData.firstName.trim(), // Pass optional data if signUp hook uses it
        lastName: formData.lastName.trim(),
        username: formData.username.trim(),
      });

      if ('error' in signUpResult || !signUpResult.user?.id) {
        const errorMsg = signUpResult.error?.message || 'Sign up failed. This username or email might already be taken.';
        console.error('[MusicLoverSignUpFlow] signUp hook FAILED:', signUpResult.error || 'No user ID returned');
        setError(errorMsg);
        return null;
      }
      userId = signUpResult.user.id;
      console.log('[MusicLoverSignUpFlow] signUp hook SUCCEEDED. User ID:', userId);

      // 1b. Prepare Profile Data (including streaming service)
      const ageValue = formData.age && /^\d+$/.test(formData.age) ? parseInt(formData.age, 10) : null;
      const profileDataForHook: CreateMusicLoverProfileData = {
        userId: userId,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        username: formData.username.trim(),
        email: formData.email.trim(), // Pass email again for profile table
        termsAccepted: formData.termsAccepted,
        profilePictureUri: formData.profilePictureUri || undefined,
        age: ageValue,
        country: formData.country.trim() || undefined,
        city: formData.city.trim() || undefined,
        bio: { // Ensure all bio fields are passed, even if empty
          firstSong: formData.bio.firstSong?.trim() || '',
          goToSong: formData.bio.goToSong?.trim() || '',
          mustListenAlbum: formData.bio.mustListenAlbum?.trim() || '',
          dreamConcert: formData.bio.dreamConcert?.trim() || '',
          musicTaste: formData.bio.musicTaste?.trim() || '',
        },
        selectedStreamingService: formData.selectedStreamingService, // Pass the selected service ID
      };

      // 1c. Create Music Lover Profile in DB
      console.log('[MusicLoverSignUpFlow] Calling createMusicLoverProfile hook...');
      const profileResult = await createMusicLoverProfile(profileDataForHook);

      if ('error' in profileResult) {
        let errorMsg = profileResult.error.message || 'Failed to save profile details.';
        // Check for specific DB errors like unique username violation
        if (profileResult.error?.code === '23505' && profileResult.error?.message?.includes('username')) {
            errorMsg = 'This username is already taken. Please choose another.';
        }
        console.error('[MusicLoverSignUpFlow] createMusicLoverProfile hook FAILED:', profileResult.error);
        setError(errorMsg);
        // Alert if account created but profile failed
        Alert.alert('Profile Error', 'Your account was created, but saving profile details failed. Please contact support or try logging in later to complete your profile.');
        // Consider if you should attempt to delete the auth user here? Risky.
        return null; // Return null as profile creation failed
      }

      console.log('[MusicLoverSignUpFlow] createMusicLoverProfile hook SUCCEEDED.');
      return userId; // Return user ID on full success

    } catch (err: any) {
      console.error('[MusicLoverSignUpFlow] UNEXPECTED error in handleAccountAndProfileCreation:', err);
      setError(err.message || 'An unexpected error occurred during account creation.');
      return null;
    }
  };

  // Completes signup for FREE tier
  const handleFreeSignupCompletion = async () => {
    console.log('[MusicLoverSignUpFlow] handleFreeSignupCompletion called.');
    setIsLoading(true);
    setError('');

    // Create account and profile first (includes streaming service)
    const userId = await handleAccountAndProfileCreation();

    if (!userId) {
      console.error('[MusicLoverSignUpFlow] Account/Profile creation failed within handleFreeSignupCompletion.');
      setIsLoading(false); // Stop loading if creation failed
      return; // Error is already set by handleAccountAndProfileCreation
    }
    console.log(`[MusicLoverSignUpFlow] User ${userId} and profile created successfully. Proceeding with free status update.`);

    try {
      console.log('[MusicLoverSignUpFlow] Calling updatePremiumStatus(false) hook...');
      // This call now also triggers navigation via checkSession({ navigateToProfile: true }) inside useAuth
      const updateResult = await updatePremiumStatus(userId, false);

      if ('error' in updateResult) {
        console.error('[MusicLoverSignUpFlow] updatePremiumStatus(false) hook FAILED:', updateResult.error);
        setError('Account created, but failed to set final status.');
        Alert.alert('Status Error', 'Your account is set up, but there was an issue finalizing the status. You will have free tier access.');
        setIsLoading(false); // Stop loading on error
      } else {
        console.log('[MusicLoverSignUpFlow] updatePremiumStatus(false) hook SUCCEEDED. Waiting for AuthProvider navigation...');
        // DO NOT set isLoading = false here. Let AuthProvider's checkSession handle navigation and state updates.
        // Add a timeout as a fallback safety net
         setTimeout(() => {
           if (isLoading) { // Check if still loading after 5s
             console.warn('[MusicLoverSignUpFlow] Navigation timeout after free signup - forcing loading state to false');
             setIsLoading(false);
           }
         }, 5000);
      }
    } catch (err: any) {
      console.error('[MusicLoverSignUpFlow] UNEXPECTED error during updatePremiumStatus(false) call:', err);
      setError('An unexpected error occurred finalizing account status.');
      setIsLoading(false);
    }
  };

  // Completes signup for PREMIUM tier
  const handlePremiumSignupCompletion = async () => {
    console.log('[MusicLoverSignUpFlow] handlePremiumSignupCompletion called.');
    if (!validatePaymentStep()) return; // Validate payment details first

    setIsLoading(true);
    setError('');
    let userId: string | null = null;

    try {
        // --- SIMULATED PAYMENT ---
        console.log('[MusicLoverSignUpFlow] Simulating payment processing...');
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
        const paymentSuccess = true; // Assume success for simulation
        console.log('[MusicLoverSignUpFlow] Simulated payment result: SUCCESS');
        // --- End Simulation ---

        if (!paymentSuccess) {
             setError('Simulated payment failed.'); // Or handle real payment failure
             setIsLoading(false);
             return;
        }

        console.log('[MusicLoverSignUpFlow] Payment successful. Creating account/profile...');
        // Create account and profile (includes streaming service)
        userId = await handleAccountAndProfileCreation();

        if (!userId) {
          console.error('[MusicLoverSignUpFlow] Account/Profile creation failed AFTER successful payment simulation.');
          // Potentially needs manual intervention (refund? support contact?)
          Alert.alert('Account Error', 'Payment was processed (simulated), but creating your account profile failed. Please contact support.');
          setIsLoading(false); // Stop loading as process failed
          return;
        }
        console.log(`[MusicLoverSignUpFlow] User ${userId} and profile created. Proceeding with premium status update.`);

        // Update status to premium (this now triggers navigation via checkSession in useAuth)
        console.log('[MusicLoverSignUpFlow] Calling updatePremiumStatus(true) hook...');
        const updateResult = await updatePremiumStatus(userId, true);

        if ('error' in updateResult) {
            console.error('[MusicLoverSignUpFlow] updatePremiumStatus(true) hook FAILED:', updateResult.error);
            setError('Payment succeeded but failed to activate premium status.');
            Alert.alert('Activation Error', 'Payment succeeded and account created, but premium status could not be activated automatically. Please contact support.');
            setIsLoading(false); // Stop loading ONLY on error after account creation
        } else {
            console.log('[MusicLoverSignUpFlow] updatePremiumStatus(true) hook SUCCEEDED. Waiting for AuthProvider navigation...');
            // DO NOT set isLoading = false here. Let AuthProvider handle navigation.
             // Add a timeout as a fallback safety net
             setTimeout(() => {
               if (isLoading) { // Check if still loading after 5s
                 console.warn('[MusicLoverSignUpFlow] Navigation timeout after premium signup - forcing loading state to false');
                 setIsLoading(false);
               }
             }, 5000);
        }
    } catch (err: any) {
        console.error('[MusicLoverSignUpFlow] UNEXPECTED error in handlePremiumSignupCompletion:', err);
        setError('An unexpected error occurred during premium signup.');
        setIsLoading(false);
    }
  };


  // --- Handle Step Submission (Orchestrator) ---
  const handleStepSubmit = async () => {
    console.log(`[MusicLoverSignUpFlow] handleStepSubmit called for step: ${currentStep}`);
    setError(''); // Clear previous errors

    switch (currentStep) {
      case 'account-details':
        if (validateAccountDetailsStep()) goToNextStep('profile-details');
        break;
      case 'profile-details':
        if (validateProfileDetailsStep()) goToNextStep('streaming-service'); // Go to NEW step
        break;
      case 'streaming-service': // Handle NEW step
        if (validateStreamingServiceStep()) goToNextStep('subscription'); // Go to subscription
        break;
      case 'subscription':
        if (validateSubscriptionStep()) {
          // Based on choice, either complete free signup or move to payment
          if (formData.subscriptionTier === 'free') {
            await handleFreeSignupCompletion(); // This function handles the final steps
          } else if (formData.subscriptionTier === 'premium') {
            goToNextStep('payment');
          }
        }
        break;
      case 'payment':
        await handlePremiumSignupCompletion(); // This function handles the final steps
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
          <TextInput style={styles.input} placeholder="First Name" value={formData.firstName} onChangeText={(text) => handleChange('firstName', text)} autoCapitalize="words" returnKeyType="next" blurOnSubmit={false} />
        </View>
        <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.inputLabel}>Last Name *</Text>
          <TextInput style={styles.input} placeholder="Last Name" value={formData.lastName} onChangeText={(text) => handleChange('lastName', text)} autoCapitalize="words" returnKeyType="next" blurOnSubmit={false} />
        </View>
      </View>
      {/* Username */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Username *</Text>
        <TextInput style={styles.input} placeholder="Choose a unique username (no spaces)" value={formData.username} onChangeText={(text) => handleChange('username', text.replace(/\s/g, ''))} autoCapitalize="none" autoCorrect={false} returnKeyType="next" blurOnSubmit={false} />
      </View>
      {/* Email */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Email *</Text>
        <TextInput style={styles.input} placeholder="Enter your email address" value={formData.email} onChangeText={(text) => handleChange('email', text)} keyboardType="email-address" autoCapitalize="none" returnKeyType="next" blurOnSubmit={false} />
      </View>
      {/* Password */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Password *</Text>
        <TextInput style={styles.input} placeholder="Create a password (min. 8 characters)" value={formData.password} onChangeText={(text) => handleChange('password', text)} secureTextEntry autoCapitalize="none" returnKeyType="next" blurOnSubmit={false} />
      </View>
      {/* Confirm Password */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Confirm Password *</Text>
        <TextInput style={styles.input} placeholder="Confirm your password" value={formData.confirmPassword} onChangeText={(text) => handleChange('confirmPassword', text)} secureTextEntry autoCapitalize="none" returnKeyType="done" onSubmitEditing={handleStepSubmit}/>
      </View>
      {/* Terms */}
      <View style={styles.termsContainer}>
        <TouchableOpacity style={[styles.checkbox, formData.termsAccepted && styles.checkboxChecked]} onPress={() => handleChange('termsAccepted', !formData.termsAccepted)} activeOpacity={0.7}>
          {formData.termsAccepted && <Feather name="check" size={14} color="white" />}
        </TouchableOpacity>
        <Text style={styles.termsText} onPress={showTermsAndConditions}>
            I agree to the <Text style={styles.termsLink}>Terms and Conditions</Text> *
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
          {formData.profilePicturePreview ? (<Image source={{ uri: formData.profilePicturePreview }} style={styles.profilePicPreview} />) : (<View style={styles.profilePicPlaceholder}><Feather name="user" size={40} color={APP_CONSTANTS.COLORS.PRIMARY_DARK} /></View>)}
          <TouchableOpacity style={styles.uploadButton} onPress={handleProfilePicPick} activeOpacity={0.8}>
             <Feather name="camera" size={16} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.uploadButtonText}> {formData.profilePicturePreview ? 'Change Picture' : 'Select Picture'} </Text>
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
            <TextInput style={styles.inputBio} value={formData.bio.firstSong} onChangeText={(text) => handleChange('bio.firstSong', text)} placeholder="That unforgettable show..." multiline returnKeyType="next" blurOnSubmit={false}/>
        </View>
        <View style={styles.inputContainer}>
            <Text style={styles.inputLabelSmall}>Go-to song right now?</Text>
            <TextInput style={styles.inputBio} value={formData.bio.goToSong} onChangeText={(text) => handleChange('bio.goToSong', text)} placeholder="The track on repeat..." returnKeyType="next" blurOnSubmit={false}/>
        </View>
         <View style={styles.inputContainer}>
            <Text style={styles.inputLabelSmall}>An album everyone should listen to?</Text>
            <TextInput style={styles.inputBio} value={formData.bio.mustListenAlbum} onChangeText={(text) => handleChange('bio.mustListenAlbum', text)} placeholder="Your essential pick..." returnKeyType="next" blurOnSubmit={false}/>
        </View>
        <View style={styles.inputContainer}>
            <Text style={styles.inputLabelSmall}>Dream concert lineup?</Text>
            <TextInput style={styles.inputBio} value={formData.bio.dreamConcert} onChangeText={(text) => handleChange('bio.dreamConcert', text)} placeholder="Headliner? Opener?" returnKeyType="next" blurOnSubmit={false}/>
        </View>
        <View style={styles.inputContainer}>
            <Text style={styles.inputLabelSmall}>Describe your music taste in a few words?</Text>
            <TextInput style={styles.inputBio} value={formData.bio.musicTaste} onChangeText={(text) => handleChange('bio.musicTaste', text)} placeholder="Indie rock, 90s hip hop, electronic..." returnKeyType="done" onSubmitEditing={handleStepSubmit}/>
        </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );

  // UPDATED: Render function for Streaming Service Step with actual icons
  const renderStreamingServiceStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Connect Your Music *</Text>
      <Text style={styles.stepDescription}>
        Select your primary streaming service. This helps us understand your taste!
      </Text>

      <View style={styles.serviceIconContainer}>
        {STREAMING_SERVICES.map((service) => {
          const isSelected = formData.selectedStreamingService === service.id;

          // Dynamic Icon Component Selection
          let IconComponent: React.ComponentType<any>;
          switch (service.iconSet) {
            case 'FontAwesome': IconComponent = FontAwesome; break;
            case 'MaterialCommunityIcons': IconComponent = MaterialCommunityIcons; break;
            default: IconComponent = Feather; // Fallback
          }

          return (
            <TouchableOpacity
              key={service.id}
              style={styles.serviceIconWrapper}
              onPress={() => handleChange('selectedStreamingService', service.id)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.serviceIconBackground,
                { backgroundColor: isSelected ? service.color : APP_CONSTANTS.COLORS.BACKGROUND_LIGHT },
                isSelected && { borderColor: APP_CONSTANTS.COLORS.PRIMARY_DARK }
              ]}>
                 <IconComponent
                    name={service.icon}
                    size={35}
                    color={isSelected ? '#FFFFFF' : service.color}
                 />
              </View>
              <Text style={[
                styles.serviceNameText,
                isSelected && styles.serviceNameTextSelected
              ]}>
                {service.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <Text style={styles.requiredText}>* Required field</Text>
    </View>
  );

  const renderSubscriptionStep = () => (
    <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Choose Your Plan *</Text>
        <Text style={styles.stepDescription}> Unlock the full Vybr experience or start with the basics. </Text>
        {/* Free Tier Option */}
        <TouchableOpacity style={[ styles.planOption, formData.subscriptionTier === 'free' && styles.planOptionSelected ]} onPress={() => handleChange('subscriptionTier', 'free')} activeOpacity={0.8} >
            <View style={styles.planHeader}>
                <Feather name="coffee" size={24} color={formData.subscriptionTier === 'free' ? APP_CONSTANTS.COLORS.PRIMARY : "#6B7280"} />
                <Text style={[styles.planTitle, formData.subscriptionTier === 'free' && styles.planTitleSelected]}>Free Tier</Text>
            </View>
            <Text style={styles.planDescription}>- Basic profile features</Text>
            <Text style={styles.planDescription}>- Discover events & profiles</Text>
            <Text style={styles.planDescription}>- Limited song/artist matching</Text>
            <Text style={[styles.planPrice, formData.subscriptionTier === 'free' && styles.planPriceSelected]}>$0 / month</Text>
        </TouchableOpacity>
        {/* Premium Tier Option */}
        <TouchableOpacity style={[ styles.planOption, formData.subscriptionTier === 'premium' && styles.planOptionSelected ]} onPress={() => handleChange('subscriptionTier', 'premium')} activeOpacity={0.8} >
            <View style={styles.planHeader}>
                <Feather name="award" size={24} color={formData.subscriptionTier === 'premium' ? APP_CONSTANTS.COLORS.PRIMARY : "#6B7280"}/>
                <Text style={[styles.planTitle, formData.subscriptionTier === 'premium' && styles.planTitleSelected]}>Premium Tier</Text>
            </View>
            <Text style={styles.planDescription}>- All Free features PLUS:</Text>
            <Text style={styles.planDescription}>- Advanced music taste analytics</Text>
            <Text style={styles.planDescription}>- Unlimited matching & Match Radio</Text>
            <Text style={styles.planDescription}>- See who likes your profile</Text>
            <Text style={[styles.planPrice, formData.subscriptionTier === 'premium' && styles.planPriceSelected]}>$4.99 / month</Text>
        </TouchableOpacity>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Text style={styles.requiredText}>* Required field</Text>
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
    // Determine if button should be disabled
    const isButtonDisabled = isLoading || authLoading ||
        (currentStep === 'streaming-service' && !formData.selectedStreamingService) || // Check streaming service step
        (currentStep === 'subscription' && !formData.subscriptionTier); // Check subscription step

    // Determine button text based on current step
    let buttonText = 'Continue';
    if (currentStep === 'streaming-service') {
        buttonText = 'Continue to Subscription';
    } else if (currentStep === 'subscription') {
        buttonText = formData.subscriptionTier === 'free' ? 'Complete Free Sign Up' : 'Continue to Payment';
    } else if (currentStep === 'payment') {
        buttonText = 'Complete Premium Sign Up';
    }

    const buttonAction = handleStepSubmit; // Central handler

    return (
      <View style={styles.stepContainer}>
        <Animated.View style={[ styles.animatedContainer, { transform: [{ translateX: slideAnim }] } ]} >
          {/* Conditional rendering of steps */}
          {currentStep === 'account-details' && renderAccountDetailsStep()}
          {currentStep === 'profile-details' && renderProfileDetailsStep()}
          {currentStep === 'streaming-service' && renderStreamingServiceStep()}
          {currentStep === 'subscription' && renderSubscriptionStep()}
          {currentStep === 'payment' && renderPaymentStep()}
        </Animated.View>

        {/* Action Button */}
        <TouchableOpacity
            style={[styles.continueButton, isButtonDisabled && styles.continueButtonDisabled]}
            onPress={buttonAction}
            disabled={isButtonDisabled}
            activeOpacity={0.8}
        >
          {isLoading || authLoading ? (
              <ActivityIndicator color="white" size="small" />
          ) : (
              <Text style={styles.continueButtonText}>{buttonText}</Text>
          )}
        </TouchableOpacity>
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
                // Handle back navigation between steps including the new one
                if (currentStep === 'profile-details') goToPreviousStep('account-details');
                else if (currentStep === 'streaming-service') goToPreviousStep('profile-details');
                else if (currentStep === 'subscription') goToPreviousStep('streaming-service');
                else if (currentStep === 'payment') goToPreviousStep('subscription');
                else navigation.goBack(); // Go back to previous screen if on first step
            }}
            disabled={isLoading || authLoading} // Disable back button while loading
          >
            <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
          </TouchableOpacity>
          {/* Step Indicators - Updated */}
          <View style={styles.stepIndicatorContainer}>
             {/* Base steps always potentially visible */}
             {['account-details', 'profile-details', 'streaming-service', 'subscription'].map((stepName) => {
                 const stepEnum = stepName as Step;
                 const allPossibleSteps: Step[] = ['account-details', 'profile-details', 'streaming-service', 'subscription', 'payment'];
                 const stepIndex = allPossibleSteps.indexOf(stepEnum);
                 const currentIndex = allPossibleSteps.indexOf(currentStep);
                 const isActive = currentIndex >= stepIndex;
                 const isCurrent = currentStep === stepEnum;
                 return ( <View key={stepName} style={[ styles.stepIndicator, isActive && styles.stepIndicatorActive, isCurrent && styles.stepIndicatorCurrent ]} /> );
             })}
            {/* Conditionally show payment step indicator only if premium is selected */}
            {formData.subscriptionTier === 'premium' && (
                <View style={[ styles.stepIndicator, currentStep === 'payment' && styles.stepIndicatorActive, currentStep === 'payment' && styles.stepIndicatorCurrent ]} />
            )}
          </View>
          <View style={{ width: 28 }} />{/* Spacer to balance header */}
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

      </LinearGradient>
    </SafeAreaView>
  );
};

// --- Styles --- (Includes styles for all steps + streaming service logos)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND }, // Base background
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

  // Subscription Plan Styles
  planOption: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1.5, borderColor: APP_CONSTANTS.COLORS.BORDER, padding: 18, marginBottom: 18, shadowColor: "#000000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2, width: '100%' },
  planOptionSelected: { borderColor: APP_CONSTANTS.COLORS.PRIMARY, backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}0A`, shadowColor: APP_CONSTANTS.COLORS.PRIMARY, shadowOpacity: 0.15, shadowRadius: 5, elevation: 4 },
  planHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  planTitle: { fontSize: 17, fontWeight: '700', color: '#374151', marginLeft: 10 },
  planTitleSelected: { color: APP_CONSTANTS.COLORS.PRIMARY },
  planDescription: { fontSize: 14, color: '#6B7280', marginBottom: 6, lineHeight: 19, marginLeft: 34 },
  planPrice: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginTop: 12, marginLeft: 34 },
  planPriceSelected: { color: APP_CONSTANTS.COLORS.PRIMARY },
});

export default MusicLoverSignUpFlow;