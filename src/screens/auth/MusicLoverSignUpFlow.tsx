import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Animated, Image, Platform,
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth'; // Adjust import path as needed
import { APP_CONSTANTS } from '@/config/constants'; // Assuming path is correct
import * as ImagePicker from 'expo-image-picker';
// Import the specific types expected by createMusicLoverProfile and for the form state
import { MusicLoverBio, CreateMusicLoverProfileData } from '@/hooks/useAuth'; // Assuming types are exported from useAuth

// Step types
type Step = 'account-details' | 'profile-details' | 'subscription' | 'payment';
type SubscriptionTier = 'free' | 'premium' | '';

// Define window width for animations
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MusicLoverSignUpFlow = () => {
  const navigation = useNavigation();
  const { signUp, createMusicLoverProfile, updatePremiumStatus, requestMediaLibraryPermissions, loading: authLoading } = useAuth();

  // State for form data
  const [formData, setFormData] = useState<{
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    username: string;
    termsAccepted: boolean;
    profilePictureUri: string; // Local URI for upload
    profilePicturePreview: string; // Local URI for display
    age: string; // Keep as string from input
    country: string;
    city: string;
    bio: MusicLoverBio;
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
    subscriptionTier: '',
    paymentInfo: { cardNumber: '', expiry: '', cvv: '', name: '' },
  });

  // State variables
  const [currentStep, setCurrentStep] = useState<Step>('account-details');
  const [isLoading, setIsLoading] = useState(false); // Local loading state for button feedback
  const [error, setError] = useState('');
  const slideAnim = useRef(new Animated.Value(0)).current; // Animation value

  // Request permissions on mount
  useEffect(() => {
    requestMediaLibraryPermissions();
  }, [requestMediaLibraryPermissions]); // Dependency array ensures it runs once


  // Handle form field changes
  const handleChange = (field: string, value: any) => {
    const trimmedValue = typeof value === 'string' ? value.trimStart() : value;

    if (field.startsWith('bio.')) {
        const bioField = field.split('.')[1] as keyof MusicLoverBio;
        setFormData(prev => ({ ...prev, bio: { ...prev.bio, [bioField]: trimmedValue } }));
    } else if (field.startsWith('paymentInfo.')) {
        const key = field.split('.')[1];
        let processedValue = typeof value === 'string' ? value.trim() : value;
        if (key === 'cardNumber') processedValue = processedValue.replace(/\D/g, '');
        if (key === 'expiry') {
             processedValue = processedValue.replace(/\D/g, '');
             // Use existing value for comparison to prevent loop
             if (processedValue.length > 2 && !formData.paymentInfo.expiry.includes('/')) {
                 processedValue = processedValue.slice(0, 2) + '/' + processedValue.slice(2);
             }
             processedValue = processedValue.slice(0, 5); // Limit MM/YY
        }
        if (key === 'cvv') processedValue = processedValue.replace(/\D/g, '').slice(0, 4);
        setFormData(prev => ({ ...prev, paymentInfo: { ...prev.paymentInfo, [key]: processedValue } }));
    } else {
        const key = field as keyof typeof formData;
        // Trim start for most fields, but not passwords
        setFormData(prev => ({ ...prev, [key]: typeof value === 'string' && key !== 'password' && key !== 'confirmPassword' ? value.trimStart() : value }));
    }
    if (error) setError(''); // Clear error on change
  };


  // Show terms and conditions alert
  const showTermsAndConditions = () => {
     Alert.alert(
        "Terms and Conditions",
        "By signing up, you agree to Vybr's terms of service and privacy policy. Please be respectful towards other users and use the platform responsibly. Your data security is important to us. (Replace with actual terms or link)",
        [{ text: "OK" }]
     );
  };

  // Animation functions for step transitions
  const goToNextStep = (nextStep: Step) => {
    console.log(`[MusicLoverSignUpFlow] Navigating from ${currentStep} to step: ${nextStep}`);
    Animated.timing(slideAnim, { toValue: -SCREEN_WIDTH, duration: 300, useNativeDriver: true }).start(() => {
      setCurrentStep(nextStep);
      slideAnim.setValue(SCREEN_WIDTH); // Position off-screen right
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    });
  };
  const goToPreviousStep = (prevStep: Step) => {
    console.log(`[MusicLoverSignUpFlow] Navigating back from ${currentStep} to step: ${prevStep}`);
    Animated.timing(slideAnim, { toValue: SCREEN_WIDTH, duration: 300, useNativeDriver: true }).start(() => {
        setCurrentStep(prevStep);
        slideAnim.setValue(-SCREEN_WIDTH); // Position off-screen left
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    });
  };


  // --- Validation Functions --- (Keep existing implementations)
  const validateAccountDetailsStep = () => {
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
  const validateProfileDetailsStep = () => {
     console.log('[MusicLoverSignUpFlow] Validating Profile Details Step...');
    setError('');
    if (formData.age && (!/^\d+$/.test(formData.age) || parseInt(formData.age, 10) < 1 || parseInt(formData.age, 10) > 120 )) {
      setError('Please enter a valid age');
      return false;
    }
    console.log('[MusicLoverSignUpFlow] Profile Details Step Validation PASSED.');
    return true;
  };
  const validateSubscriptionStep = () => {
      console.log('[MusicLoverSignUpFlow] Validating Subscription Step...');
      setError('');
      if (!formData.subscriptionTier) {
          setError('Please select a subscription tier.');
          return false;
      }
      console.log('[MusicLoverSignUpFlow] Subscription Step Validation PASSED.');
      return true;
  };
  const validatePaymentStep = () => {
      console.log('[MusicLoverSignUpFlow] Validating Payment Step...');
      setError('');
      const { cardNumber, expiry, cvv, name } = formData.paymentInfo;
      if (!cardNumber.trim() || !/^\d{15,19}$/.test(cardNumber.replace(/\s/g, ''))) { setError('Please enter a valid card number (15-19 digits)'); return false; }
      if (!expiry.trim() || !/^(0[1-9]|1[0-2])\/?([0-9]{2})$/.test(expiry)) { setError('Please enter expiry date as MM/YY'); return false; }
        const [expMonth, expYearShort] = expiry.split('/');
        if (expMonth && expYearShort) {
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1;
            const expYear = parseInt(`20${expYearShort}`, 10);
            const expMonthNum = parseInt(expMonth, 10);
            if (expYear < currentYear || (expYear === currentYear && expMonthNum < currentMonth)) {
                setError('Card expiry date has passed');
                return false;
            }
        } else { setError('Invalid expiry date format'); return false; }
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
        // Alert already shown in hook if denied first time
        return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images, // Deprecated: Use ImagePicker.MediaType.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
       });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.uri;
        console.log(`[MusicLoverSignUpFlow] Image selected. URI: ${uri.substring(0,100)}... Type: ${asset.mimeType ?? 'N/A'}, Size: ${asset.fileSize ?? 'N/A'}`);
        setFormData(prev => ({ ...prev, profilePictureUri: uri, profilePicturePreview: uri }));
        setError('');
      } else {
         console.log('[MusicLoverSignUpFlow] Image picking cancelled or no assets returned.');
      }
    } catch (error: any) {
       console.error('[MusicLoverSignUpFlow] Error picking profile picture:', error);
       setError(`Failed to pick image: ${error.message || 'Unknown error'}`);
       Alert.alert('Error', 'Could not select image. Please try again.');
    }
  };

  // --- Signup Logic ---

  // Step 1 & 2: Create Auth User and Basic Profile (Handles Core Creation Logic)
  const handleAccountAndProfileCreation = async (
    currentFormData: typeof formData
  ): Promise<string | null> => {
    console.log('[MusicLoverSignUpFlow] handleAccountAndProfileCreation called.');
    setError('');
    let userId: string | null = null;

    try {
      // 1a. Sign up Auth User
      console.log('[MusicLoverSignUpFlow] Calling signUp hook...');
      const signUpResult = await signUp({
        email: currentFormData.email.trim(),
        password: currentFormData.password,
        userType: 'music_lover',
        firstName: currentFormData.firstName.trim(),
        lastName: currentFormData.lastName.trim(),
        username: currentFormData.username.trim(),
      });

      if ('error' in signUpResult || !signUpResult.user?.id) {
        console.error('[MusicLoverSignUpFlow] signUp hook FAILED:', signUpResult.error || 'No user ID returned');
        setError(signUpResult.error?.message || 'Sign up failed. This username or email might already be taken.');
        return null;
      }
      userId = signUpResult.user.id;
      console.log('[MusicLoverSignUpFlow] signUp hook SUCCEEDED. User ID:', userId);

      // 1b. Prepare Profile Data
      const profileDataForHook: CreateMusicLoverProfileData = {
        userId: userId,
        firstName: currentFormData.firstName.trim(),
        lastName: currentFormData.lastName.trim(),
        username: currentFormData.username.trim(),
        email: currentFormData.email.trim(),
        termsAccepted: currentFormData.termsAccepted,
        profilePictureUri: currentFormData.profilePictureUri || undefined,
        age: currentFormData.age && /^\d+$/.test(currentFormData.age) ? parseInt(currentFormData.age, 10) : null,
        country: currentFormData.country.trim() || undefined,
        city: currentFormData.city.trim() || undefined,
        bio: {
          firstSong: currentFormData.bio.firstSong?.trim() || '',
          goToSong: currentFormData.bio.goToSong?.trim() || '',
          mustListenAlbum: currentFormData.bio.mustListenAlbum?.trim() || '',
          dreamConcert: currentFormData.bio.dreamConcert?.trim() || '',
          musicTaste: currentFormData.bio.musicTaste?.trim() || '',
        },
      };

      console.log('[MusicLoverSignUpFlow] Calling createMusicLoverProfile hook with data:', JSON.stringify(profileDataForHook, null, 2));
      const profileResult = await createMusicLoverProfile(profileDataForHook);

      if ('error' in profileResult) {
        console.error('[MusicLoverSignUpFlow] createMusicLoverProfile hook FAILED:', profileResult.error);
        setError(profileResult.error.message || 'Failed to save profile details.');
        Alert.alert('Profile Error', 'Your account was created, but saving profile details failed. Please contact support or try logging in later to complete your profile.');
        return null;
      }
      console.log('[MusicLoverSignUpFlow] createMusicLoverProfile hook SUCCEEDED.');
      return userId;

    } catch (err: any) {
      console.error('[MusicLoverSignUpFlow] UNEXPECTED error in handleAccountAndProfileCreation:', err);
      setError(err.message || 'An unexpected error occurred during account creation.');
      return null;
    }
  };

  // Step 3a: Finalize Free Signup
  const handleFreeSignupCompletion = async () => {
    console.log('[MusicLoverSignUpFlow] handleFreeSignupCompletion called.');
    setIsLoading(true);
    setError('');

    const userId = await handleAccountAndProfileCreation(formData);

    if (!userId) {
      console.error('[MusicLoverSignUpFlow] Account/Profile creation failed within handleFreeSignupCompletion. Aborting status update.');
      setIsLoading(false);
      return;
    }
    console.log(`[MusicLoverSignUpFlow] User ${userId} and profile created successfully. Proceeding with free status update.`);

    try {
      console.log('[MusicLoverSignUpFlow] Calling updatePremiumStatus(false) hook...');
      const updateResult = await updatePremiumStatus(userId, false);

      if ('error' in updateResult) {
         console.error('[MusicLoverSignUpFlow] updatePremiumStatus(false) hook FAILED:', updateResult.error);
         setError('Account created, but failed to set final status.');
         Alert.alert('Status Error', 'Your account is set up, but there was an issue finalizing the status. You will have free tier access.');
         // Keep isLoading=true, let AuthProvider handle potential navigation/state update
      } else {
          console.log('[MusicLoverSignUpFlow] updatePremiumStatus(false) hook SUCCEEDED.');
          console.log('[MusicLoverSignUpFlow] Free signup flow complete. Waiting for AuthProvider state update and navigation...');
          // IMPORTANT: Do NOT set isLoading = false here. Success means navigation will happen.
      }
    } catch (err: any) {
       console.error('[MusicLoverSignUpFlow] UNEXPECTED error during updatePremiumStatus call:', err);
       setError('An unexpected error occurred finalizing account status.');
       setIsLoading(false); // Stop loading on unexpected error
    }
  };

  // Step 3b & 4: Handle Premium Signup
  const handlePremiumSignupCompletion = async () => {
    console.log('[MusicLoverSignUpFlow] handlePremiumSignupCompletion called.');
    if (!validatePaymentStep()) return;

    setIsLoading(true);
    setError('');
    let userId: string | null = null;

    try {
        // --- SIMULATED PAYMENT ---
        console.log('[MusicLoverSignUpFlow] Simulating payment processing...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        const paymentSuccess = true; // Simulate success
        console.log('[MusicLoverSignUpFlow] Simulated payment result: SUCCESS');
        // --- END ---

        if (!paymentSuccess) { /* Handle real payment failure */ }

        console.log('[MusicLoverSignUpFlow] Payment successful. Proceeding with account creation...');
        userId = await handleAccountAndProfileCreation(formData);

        if (!userId) {
          console.error('[MusicLoverSignUpFlow] Account/Profile creation failed AFTER payment. Critical error.');
          setIsLoading(false);
          // Alert is handled in creation function
          return;
        }
        console.log(`[MusicLoverSignUpFlow] User ${userId} and profile created successfully after payment. Proceeding with premium status update.`);

        console.log('[MusicLoverSignUpFlow] Calling updatePremiumStatus(true) hook...');
        const updateResult = await updatePremiumStatus(userId, true);

        if ('error' in updateResult) {
            console.error('[MusicLoverSignUpFlow] updatePremiumStatus(true) hook FAILED:', updateResult.error);
            setError('Payment succeeded but failed to activate premium status.');
            Alert.alert('Activation Error', 'Payment succeeded and account created, but premium status could not be activated automatically. Please contact support.');
            // Keep isLoading=true, let AuthProvider handle potential navigation/state update
        } else {
            console.log('[MusicLoverSignUpFlow] updatePremiumStatus(true) hook SUCCEEDED.');
            console.log('[MusicLoverSignUpFlow] Premium signup flow complete. Waiting for AuthProvider state update and navigation...');
            // IMPORTANT: Do NOT set isLoading = false here. Success means navigation will happen.
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
    setError('');

    switch (currentStep) {
      case 'account-details':
        if (validateAccountDetailsStep()) goToNextStep('profile-details');
        break;
      case 'profile-details':
        if (validateProfileDetailsStep()) goToNextStep('subscription');
        break;
      case 'subscription':
        if (validateSubscriptionStep()) {
          if (formData.subscriptionTier === 'free') await handleFreeSignupCompletion();
          else if (formData.subscriptionTier === 'premium') goToNextStep('payment');
        }
        break;
      case 'payment':
        await handlePremiumSignupCompletion();
        break;
    }
  };


  // --- Render Functions for Steps ---

  const renderAccountDetailsStep = () => (
     <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Create Your Account</Text>
      {/* Row for First/Last Name */}
      <View style={styles.rowContainer}>
        <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.inputLabel}>First Name</Text>
          <TextInput style={styles.input} placeholder="First Name" value={formData.firstName} onChangeText={(text) => handleChange('firstName', text)} autoCapitalize="words" returnKeyType="next" blurOnSubmit={false} />
        </View>
        <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.inputLabel}>Last Name</Text>
          <TextInput style={styles.input} placeholder="Last Name" value={formData.lastName} onChangeText={(text) => handleChange('lastName', text)} autoCapitalize="words" returnKeyType="next" blurOnSubmit={false} />
        </View>
      </View>
      {/* Username */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Username</Text>
        <TextInput style={styles.input} placeholder="Choose a unique username (no spaces)" value={formData.username} onChangeText={(text) => handleChange('username', text.replace(/\s/g, ''))} autoCapitalize="none" autoCorrect={false} returnKeyType="next" blurOnSubmit={false} />
      </View>
      {/* Email */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Email</Text>
        <TextInput style={styles.input} placeholder="Enter your email address" value={formData.email} onChangeText={(text) => handleChange('email', text)} keyboardType="email-address" autoCapitalize="none" returnKeyType="next" blurOnSubmit={false} />
      </View>
      {/* Password */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Password</Text>
        <TextInput style={styles.input} placeholder="Create a password (min. 8 characters)" value={formData.password} onChangeText={(text) => handleChange('password', text)} secureTextEntry autoCapitalize="none" returnKeyType="next" blurOnSubmit={false} />
      </View>
      {/* Confirm Password */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Confirm Password</Text>
        <TextInput style={styles.input} placeholder="Confirm your password" value={formData.confirmPassword} onChangeText={(text) => handleChange('confirmPassword', text)} secureTextEntry autoCapitalize="none" returnKeyType="done" />
      </View>
      {/* Terms */}
      <View style={styles.termsContainer}>
        <TouchableOpacity style={[styles.checkbox, formData.termsAccepted && styles.checkboxChecked]} onPress={() => handleChange('termsAccepted', !formData.termsAccepted)} activeOpacity={0.7}>
          {formData.termsAccepted && <Feather name="check" size={14} color="white" />}
        </TouchableOpacity>
        <Text style={styles.termsText}>
            <Text>I agree to the </Text>{/* Explicitly wrap */}
            <Text style={styles.termsLink} onPress={showTermsAndConditions}> Terms and Conditions </Text>
        </Text>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );

  const renderProfileDetailsStep = () => (
     <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Tell Us About You</Text>
      <Text style={styles.stepDescription}> Help others connect with your vibe! (All fields optional) </Text>
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
          <TextInput style={styles.input} placeholder="Your age" value={formData.age} onChangeText={(text) => handleChange('age', text.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={3} returnKeyType="next" blurOnSubmit={false} />
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
            <TextInput style={styles.inputBio} value={formData.bio.musicTaste} onChangeText={(text) => handleChange('bio.musicTaste', text)} placeholder="Indie rock, 90s hip hop, electronic..." returnKeyType="done"/>
        </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );

  const renderSubscriptionStep = () => (
    // Added Fragment wrappers inside TouchableOpacity just to be safe, though often not needed
    <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Choose Your Plan</Text>
        <Text style={styles.stepDescription}> Unlock the full Vybr experience or start with the basics. </Text>
        {/* Free Tier Option */}
        <TouchableOpacity style={[ styles.planOption, formData.subscriptionTier === 'free' && styles.planOptionSelected ]} onPress={() => handleChange('subscriptionTier', 'free')} activeOpacity={0.8} >
            <>
                <View style={styles.planHeader}>
                    <Feather name="coffee" size={24} color={formData.subscriptionTier === 'free' ? APP_CONSTANTS.COLORS.PRIMARY : "#6B7280"} />
                    <Text style={[styles.planTitle, formData.subscriptionTier === 'free' && styles.planTitleSelected]}>Free Tier</Text>
                </View>
                <Text style={styles.planDescription}>- Basic profile features</Text>
                <Text style={styles.planDescription}>- Discover events & profiles</Text>
                <Text style={styles.planDescription}>- Limited song/artist matching</Text>
                <Text style={[styles.planPrice, formData.subscriptionTier === 'free' && styles.planPriceSelected]}>$0 / month</Text>
            </>
        </TouchableOpacity>
        {/* Premium Tier Option */}
        <TouchableOpacity style={[ styles.planOption, formData.subscriptionTier === 'premium' && styles.planOptionSelected ]} onPress={() => handleChange('subscriptionTier', 'premium')} activeOpacity={0.8} >
            <>
                <View style={styles.planHeader}>
                    <Feather name="award" size={24} color={formData.subscriptionTier === 'premium' ? APP_CONSTANTS.COLORS.PRIMARY : "#6B7280"}/>
                    <Text style={[styles.planTitle, formData.subscriptionTier === 'premium' && styles.planTitleSelected]}>Premium Tier</Text>
                </View>
                <Text style={styles.planDescription}>- All Free features PLUS:</Text>
                <Text style={styles.planDescription}>- Advanced music taste analytics</Text>
                <Text style={styles.planDescription}>- Unlimited matching & Match Radio</Text>
                <Text style={styles.planDescription}>- See who likes your profile</Text>
                <Text style={[styles.planPrice, formData.subscriptionTier === 'premium' && styles.planPriceSelected]}>$4.99 / month</Text>
            </>
        </TouchableOpacity>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );

  const renderPaymentStep = () => (
      <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Premium Payment</Text>
      <Text style={styles.stepDescription}> Enter payment details for Vybr Premium ($4.99/month). {'\n'}(This is a simulation - no real charge will occur) </Text>
      {/* Card Number */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Card Number</Text>
        <TextInput style={styles.input} placeholder="XXXX XXXX XXXX XXXX" value={formData.paymentInfo.cardNumber} onChangeText={(text) => handleChange('paymentInfo.cardNumber', text)} keyboardType="number-pad" maxLength={19} returnKeyType="next" blurOnSubmit={false} />
      </View>
      {/* Expiry and CVV */}
      <View style={styles.rowContainer}>
        <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.inputLabel}>Expiry Date</Text>
          <TextInput style={styles.input} placeholder="MM/YY" value={formData.paymentInfo.expiry} onChangeText={(text) => handleChange('paymentInfo.expiry', text)} keyboardType="number-pad" maxLength={5} returnKeyType="next" blurOnSubmit={false} />
        </View>
        <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.inputLabel}>CVV</Text>
          <TextInput style={styles.input} placeholder="CVV" value={formData.paymentInfo.cvv} onChangeText={(text) => handleChange('paymentInfo.cvv', text)} keyboardType="number-pad" maxLength={4} secureTextEntry returnKeyType="next" blurOnSubmit={false} />
        </View>
      </View>
      {/* Cardholder Name */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Cardholder Name</Text>
        <TextInput style={styles.input} placeholder="Name as it appears on card" value={formData.paymentInfo.name} onChangeText={(text) => handleChange('paymentInfo.name', text)} autoCapitalize="words" returnKeyType="done" onSubmitEditing={handleStepSubmit} />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );

   // Render current step selector
  const renderCurrentStep = () => {
    const isButtonDisabled = isLoading || authLoading || (currentStep === 'subscription' && !formData.subscriptionTier);
    let buttonText = 'Continue';
    switch (currentStep) { /* ... logic ... */ }

    return (
      <View style={styles.stepContainer}>
        <Animated.View style={[ styles.animatedContainer, { transform: [{ translateX: slideAnim }] } ]} >
          {currentStep === 'account-details' && renderAccountDetailsStep()}
          {currentStep === 'profile-details' && renderProfileDetailsStep()}
          {currentStep === 'subscription' && renderSubscriptionStep()}
          {currentStep === 'payment' && renderPaymentStep()}
        </Animated.View>
        <TouchableOpacity style={[styles.continueButton, isButtonDisabled && styles.continueButtonDisabled]} onPress={handleStepSubmit} disabled={isButtonDisabled} activeOpacity={0.8} >
          {isLoading || authLoading ? (<ActivityIndicator color="white" size="small" />) : (<Text style={styles.continueButtonText}>{buttonText}</Text>)}
        </TouchableOpacity>
      </View>
    );
  };


  // Main Return JSX Structure
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient colors={['#FFFFFF', '#F9FAFB']} style={styles.gradient} >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => { /* ... back logic ... */ }} disabled={isLoading || authLoading} >
            <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
          </TouchableOpacity>
          {/* Step Indicators */}
          <View style={styles.stepIndicatorContainer}>
             {['account-details', 'profile-details', 'subscription'].map((stepName) => {
                 const stepEnum = stepName as Step;
                 const isActive = (stepEnum === 'account-details' && ['account-details','profile-details', 'subscription', 'payment'].includes(currentStep)) || (stepEnum === 'profile-details' && ['profile-details', 'subscription', 'payment'].includes(currentStep)) || (stepEnum === 'subscription' && ['subscription', 'payment'].includes(currentStep));
                 const isCurrent = currentStep === stepEnum;
                 return ( <View key={stepName} style={[ styles.stepIndicator, isActive && styles.stepIndicatorActive, isCurrent && styles.stepIndicatorCurrent ]} /> );
             })}
            {(formData.subscriptionTier === 'premium' || currentStep === 'payment') && ( <View style={[ styles.stepIndicator, currentStep === 'payment' && styles.stepIndicatorActive, currentStep === 'payment' && styles.stepIndicatorCurrent ]} /> )}
          </View>
          <View style={{ width: 28 }} />{/* Spacer */}
        </View>
        {/* Scrollable Content Area */}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" nestedScrollEnabled={true} >
          {renderCurrentStep()}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  gradient: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 16 : 10, paddingBottom: 8, backgroundColor: 'transparent' },
  backButton: { padding: 8, zIndex: 1 },
  stepIndicatorContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flex: 1 },
  stepIndicator: { width: 10, height: 10, borderRadius: 5, backgroundColor: APP_CONSTANTS.COLORS.BORDER_LIGHT, marginHorizontal: 6 },
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
  termsContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, marginTop: 8, width: '100%' },
  checkbox: { width: 20, height: 20, borderWidth: 1.5, borderColor: APP_CONSTANTS.COLORS.BORDER_DARK, borderRadius: 4, marginRight: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  checkboxChecked: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, borderColor: APP_CONSTANTS.COLORS.PRIMARY },
  termsText: { fontSize: 13, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, lineHeight: 18, flex: 1 },
  termsLink: { color: APP_CONSTANTS.COLORS.PRIMARY, fontWeight: '600', textDecorationLine: 'underline' },
  profilePicContainer: { alignItems: 'center', marginVertical: 15 },
  profilePicPreview: { width: 100, height: 100, borderRadius: 50, marginBottom: 12, backgroundColor: '#e0e0e0', borderWidth: 2, borderColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT },
  profilePicPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: APP_CONSTANTS.COLORS.BORDER_LIGHT + '80', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: APP_CONSTANTS.COLORS.BORDER },
  uploadButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  uploadButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },
  bioHeader: { marginTop: 15, marginBottom: 10, fontSize: 16, fontWeight: '600', textAlign: 'left', width: '100%' },
  errorText: { color: APP_CONSTANTS.COLORS.ERROR, marginTop: 8, marginBottom: 16, textAlign: 'center', fontSize: 14, fontWeight: '500', width: '100%' },
  continueButton: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingVertical: 15, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 'auto', paddingTop: 15, marginBottom: 20, width: '100%', minHeight: 50, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
  continueButtonDisabled: { backgroundColor: APP_CONSTANTS.COLORS.DISABLED, elevation: 0, shadowOpacity: 0 },
  continueButtonText: { color: 'white', fontWeight: '600', fontSize: 16 },
  planOption: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1.5, borderColor: APP_CONSTANTS.COLORS.BORDER, padding: 18, marginBottom: 18, shadowColor: "#000000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2, width: '100%' },
  planOptionSelected: { borderColor: APP_CONSTANTS.COLORS.PRIMARY, backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}0A`, shadowColor: APP_CONSTANTS.COLORS.PRIMARY, shadowOpacity: 0.15, shadowRadius: 5, elevation: 4 },
  planHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  planTitle: { fontSize: 17, fontWeight: '700', color: '#374151', marginLeft: 10 },
  planTitleSelected: { color: APP_CONSTANTS.COLORS.PRIMARY },
  planDescription: { fontSize: 14, color: '#6B7280', marginBottom: 6, lineHeight: 19, marginLeft: 34 },
  planPrice: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginTop: 12, marginLeft: 34 },
  planPriceSelected: { color: APP_CONSTANTS.COLORS.PRIMARY },
  planTrial: { fontSize: 13, fontWeight: '500', color: '#10B981', marginTop: 5, marginLeft: 34 },
});

export default MusicLoverSignUpFlow;