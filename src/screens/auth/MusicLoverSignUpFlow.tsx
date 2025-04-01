import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
    ActivityIndicator, Alert, Animated, Image, Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/hooks/useAuth'; // Adjust path if necessary
import { APP_CONSTANTS } from '@/config/constants'; // Adjust path if necessary
import { supabase } from '@/lib/supabase'; // Adjust path if necessary
import * as ImagePicker from 'expo-image-picker';

// Step types
type Step =
  | 'name' | 'username-email' | 'password' | 'profile-picture' | 'age'
  | 'location' | 'connect-music' | 'ai-analysis' | 'bio' | 'premium';

// Navigation targets
const PAYMENT_SCREEN_NAME = 'PaymentScreen'; // Placeholder
const MAIN_APP_SCREEN_NAME = 'UserTabs'; // Main app screen

// AsyncStorage keys
const SIGNUP_STEP_KEY = '@music_lover_signup_step';
const SIGNUP_USER_ID_KEY = '@music_lover_signup_user_id';

const MusicLoverSignUpFlow = () => {
  const navigation = useNavigation();
  const { session, loading: authLoading, signUp } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', username: '', email: '', password: '',
    confirmPassword: '', termsAccepted: false, profilePicture: '', age: '',
    country: '', city: '', useLocation: false, musicPlatform: '',
    bio: { firstSong: '', goToSong: '', mustListenAlbum: '', dreamConcert: '', musicTaste: '' },
    isPremium: false,
  });

  // Component state
  const [currentStep, setCurrentStep] = useState<Step>('name');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [tempUserId, setTempUserId] = useState<string | null>(null);

  // Animation state
  const [slideAnim] = useState(new Animated.Value(0));
  const [fadeAnim] = useState(new Animated.Value(1));

  // --- State Loading Effect ---
  useEffect(() => {
    const loadState = async () => {
        console.log('[SignUpFlow] LoadState Effect: Start');
        setIsLoading(true);
        let loadedStep: Step = 'name';
        let loadedUserId: string | null = null;

        try {
            const savedStep = await AsyncStorage.getItem(SIGNUP_STEP_KEY);
            const savedUserId = await AsyncStorage.getItem(SIGNUP_USER_ID_KEY);
            console.log(`[SignUpFlow] LoadState: Saved Step = ${savedStep}, Saved UserID = ${savedUserId}`);
            loadedUserId = savedUserId;
            if(savedUserId) setTempUserId(savedUserId);

            const validSteps: Step[] = ['name', 'username-email', 'password', 'profile-picture', 'age', 'location', 'connect-music', 'ai-analysis', 'bio', 'premium'];
            if (savedStep && validSteps.includes(savedStep as Step)) {
                loadedStep = savedStep as Step;
            } else if (savedStep) {
                 await AsyncStorage.removeItem(SIGNUP_STEP_KEY);
            }
        } catch (e) { console.error("[SignUpFlow] LoadState: Failed AsyncStorage read", e); }

        if (!authLoading) {
            console.log(`[SignUpFlow] LoadState: Auth determined (loading=${authLoading}, session=${session ? 'yes' : 'no'})`);
            if (session?.user?.id) {
                const liveUserId = session.user.id;
                 console.log(`[SignUpFlow] LoadState: User Authenticated (ID: ${liveUserId})`);
                 setTempUserId(liveUserId);
                 try { await AsyncStorage.setItem(SIGNUP_USER_ID_KEY, liveUserId); } catch(e){}

                 if (['name', 'username-email', 'password'].includes(loadedStep)) {
                     console.warn(`[SignUpFlow] LoadState: Auth ON, pre-auth step (${loadedStep}). Resetting to 'profile-picture'.`);
                     loadedStep = 'profile-picture';
                     try { await AsyncStorage.setItem(SIGNUP_STEP_KEY, loadedStep); } catch(e){}
                 } else if (!await AsyncStorage.getItem(SIGNUP_STEP_KEY)) {
                     console.log('[SignUpFlow] LoadState: Auth ON, no saved step. Setting to profile-picture.');
                     loadedStep = 'profile-picture';
                     try { await AsyncStorage.setItem(SIGNUP_STEP_KEY, loadedStep); } catch(e){}
                 }
            } else {
                console.log('[SignUpFlow] LoadState: User Not Authenticated.');
                setTempUserId(null);
                 try { await AsyncStorage.removeItem(SIGNUP_USER_ID_KEY); } catch(e){}
                 if (!['name', 'username-email', 'password'].includes(loadedStep)) {
                    console.warn(`[SignUpFlow] LoadState: Auth OFF, post-auth step (${loadedStep}). Resetting to 'name'.`);
                    loadedStep = 'name';
                    try { await AsyncStorage.removeItem(SIGNUP_STEP_KEY); } catch(e){}
                 }
            }
            console.log(`[SignUpFlow] LoadState: Final step to set: ${loadedStep}`);
            // Only update state if it's different to avoid unnecessary re-renders
            if (loadedStep !== currentStep) {
                 setCurrentStep(loadedStep);
                 slideAnim.setValue(0);
                 fadeAnim.setValue(1);
            }
        } else { console.log('[SignUpFlow] LoadState: Auth loading...'); }

        setIsLoading(false);
        console.log('[SignUpFlow] LoadState Effect: End');
    };
    loadState();
  }, [session, authLoading]);

  // --- Helper Functions ---
  const getCurrentUserId = async (): Promise<string | null> => {
    if (session?.user?.id) {
        if (!tempUserId || tempUserId !== session.user.id) {
            setTempUserId(session.user.id);
            try { await AsyncStorage.setItem(SIGNUP_USER_ID_KEY, session.user.id); } catch(e){}
        }
        return session.user.id;
    }
    if (tempUserId) return tempUserId;
    try {
        const storedId = await AsyncStorage.getItem(SIGNUP_USER_ID_KEY);
        if (storedId) { setTempUserId(storedId); return storedId; }
    } catch (e) {}
    console.error('[getCurrentUserId] Could not determine User ID.');
    return null;
  };

  const handleChange = (field: keyof typeof formData, value: any) => {
      if (field === 'bio') { setFormData(prev => ({ ...prev, bio: { ...prev.bio, ...value } })); }
      else { setFormData(prev => ({ ...prev, [field]: value })); }
      setError('');
  };

 const clearSignupState = async () => {
    console.log('[SignUpFlow] Clearing saved state.');
    try { await AsyncStorage.multiRemove([SIGNUP_STEP_KEY, SIGNUP_USER_ID_KEY]); setTempUserId(null); }
    catch(e){ console.error("Failed clear state", e); }
 };

 // --- Navigation & Step Updates ---
 const goToStep = async (targetStep: Step, direction: 'forward' | 'backward') => {
    console.log(`[SignUpFlow] goToStep: Target=${targetStep}`);
    try { await AsyncStorage.setItem(SIGNUP_STEP_KEY, targetStep); }
    catch (e) { console.error("Failed save step", e); }
    setCurrentStep(targetStep);
    const startValue = direction === 'forward' ? 300 : -300;
    fadeAnim.setValue(0); slideAnim.setValue(startValue);
    Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
 };

 const handleGoBack = async () => {
    const steps: Step[] = ['name', 'username-email', 'password', 'profile-picture', 'age', 'location', 'connect-music', 'ai-analysis', 'bio', 'premium'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) { goToStep(steps[currentIndex - 1], 'backward'); }
    else { await clearSignupState(); if (navigation.canGoBack()) { navigation.goBack(); } }
 };

 // --- Validation Functions ---
 const validateNameStep = () => { if (!formData.firstName || !formData.lastName) {setError('Please enter both first and last name.'); return false;} return true; };
 const validateUsernameEmailStep = () => { if (!formData.username) {setError('Please enter a username.'); return false;} if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {setError('Please enter a valid email address.'); return false;} return true; };
 const validatePasswordStep = () => { if (!formData.password) {setError('Please enter a password.'); return false;} if (formData.password.length < 8) {setError('Password must be at least 8 characters long.'); return false;} if (formData.password !== formData.confirmPassword) {setError('Passwords do not match.'); return false;} if (!formData.termsAccepted) {setError('Please accept the Terms and Conditions.'); return false;} return true; };
 const validateAgeStep = () => { const age = parseInt(formData.age); if (isNaN(age) || age < 18) {setError('You must be 18 or older.'); return false;} return true; };
 const validateLocationStep = () => { if (!formData.country || !formData.city) {setError('Please enter country and city.'); return false;} return true; };
 const validateConnectMusicStep = () => { if (!formData.musicPlatform) {setError('Please select a music platform.'); return false;} return true; };

 // --- Action Handlers ---
 const showTermsAndConditions = () => Alert.alert('Terms and Conditions', '...');
 const handleProfilePictureUpload = async () => { /* ... keep existing logic ... */ };
 const updateProfileData = async (dataToUpdate: object): Promise<boolean> => {
    const userId = await getCurrentUserId();
    if (!userId) { setError('Session error. Please restart.'); return false; }
    console.log(`[updateProfileData] User: ${userId}, Data:`, dataToUpdate);
    try {
        const { error: updateError } = await supabase.from('music_lover_profiles').update(dataToUpdate).eq('user_id', userId);
        if (updateError) { console.error('Update Profile Error:', updateError); setError(`Save failed: ${updateError.message}`); return false; }
        console.log(`Profile updated for step ${currentStep}`);
        return true;
    } catch (err: any) { console.error(`Update Exception:`, err); setError(`Unexpected error: ${err.message}`); return false; }
 };

 // --- Main Step Submission Logic ---
 const handleStepSubmit = async () => {
    setError(''); setIsLoading(true);
    let success = false;
    const steps: Step[] = ['name', 'username-email', 'password', 'profile-picture', 'age', 'location', 'connect-music', 'ai-analysis', 'bio', 'premium'];
    const currentIndex = steps.indexOf(currentStep);
    let nextStepToGo: Step | null = currentIndex < steps.length - 1 ? steps[currentIndex + 1] : null;

    switch (currentStep) {
      case 'name': success = validateNameStep(); break;
      case 'username-email': success = validateUsernameEmailStep(); break;
      case 'password':
        if (validatePasswordStep()) {
          console.log('[SignUpFlow] Calling signUp...');
          try {
            const result = await signUp({ email: formData.email, password: formData.password, userType: 'music_lover', firstName: formData.firstName, lastName: formData.lastName, username: formData.username });
            if ('error' in result && result.error) { setError(result.error.message || 'Sign up failed.'); console.error('SignUp error:', result.error); }
            else if ('user' in result && result.user) { console.log('SignUp successful, ID:', result.user.id); setTempUserId(result.user.id); try { await AsyncStorage.setItem(SIGNUP_USER_ID_KEY, result.user.id); } catch(e){} success = true; }
            else { setError('Unexpected signup issue.'); }
          } catch (error: any) { console.error('SignUp exception:', error); setError(error.message || 'Error.'); }
        }
        break;
       case 'profile-picture': if (formData.profilePicture) { success = await updateProfileData({ profile_picture: formData.profilePicture }); } else { success = true; } break;
       case 'age': if (validateAgeStep()) { success = await updateProfileData({ age: parseInt(formData.age) }); } break;
       case 'location': if (validateLocationStep()) { success = await updateProfileData({ country: formData.country, city: formData.city }); } break;
       case 'connect-music': if (validateConnectMusicStep()) { success = true; /* Add DB update later */ } break;
       case 'ai-analysis': console.log('AI Step'); success = true; await new Promise(resolve => setTimeout(resolve, 1000)); break;
       case 'bio': const filledBio = Object.fromEntries(Object.entries(formData.bio).filter(([_, v]) => v && v.trim())); success = await updateProfileData({ bio: filledBio }); break;
       case 'premium':
         success = await updateProfileData({ is_premium: formData.isPremium });
         if (success) {
            console.log('Final step success. Navigating out.'); setIsLoading(false);
            setTimeout(async () => {
                await clearSignupState();
                navigation.reset({ index: 0, routes: [{ name: MAIN_APP_SCREEN_NAME as never }] });
             }, 50);
             return; // Exit early
         }
         break;
      default: console.warn("Unhandled step:", currentStep); success = true;
    }
    setIsLoading(false);
    if (success && nextStepToGo) { goToStep(nextStepToGo, 'forward'); }
    else if (!success) { console.log(`Step ${currentStep} failed.`); }
  };

 // --- ============================================ ---
 // --- START: Full Render Functions Implementation ---
 // --- ============================================ ---

 const renderNameStep_Full = () => (
    <View style={styles.stepContentContainer}>
      <Text style={styles.stepTitle}>What's your name?</Text>
       <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>First Name</Text>
        <TextInput style={styles.input} placeholder="Enter your first name" value={formData.firstName} onChangeText={(text) => handleChange('firstName', text)} autoCapitalize="words" returnKeyType="next"/>
      </View>
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Last Name</Text>
        <TextInput style={styles.input} placeholder="Enter your last name" value={formData.lastName} onChangeText={(text) => handleChange('lastName', text)} autoCapitalize="words" returnKeyType="done"/>
      </View>
    </View>
  );

 const renderUsernameEmailStep_Full = () => (
    <View style={styles.stepContentContainer}>
    <Text style={styles.stepTitle}>Create your identity</Text>
        <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Username</Text>
        <TextInput style={styles.input} placeholder="Choose a unique username" value={formData.username} onChangeText={(text) => handleChange('username', text)} autoCapitalize="none" autoCorrect={false} returnKeyType="next"/>
    </View>
    <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Email Address</Text>
        <TextInput style={styles.input} placeholder="Enter your email address" value={formData.email} onChangeText={(text) => handleChange('email', text)} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="done"/>
    </View>
    </View>
 );

 const renderPasswordStep_Full = () => (
    <View style={styles.stepContentContainer}>
    <Text style={styles.stepTitle}>Create a secure password</Text>
    <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Password</Text>
        <View style={styles.passwordContainer}>
        <TextInput style={styles.passwordInput} placeholder="Enter your password (min 8 characters)" value={formData.password} onChangeText={(text) => handleChange('password', text)} secureTextEntry={true} autoCapitalize="none" autoCorrect={false} returnKeyType="next"/>
        </View>
    </View>
    <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Confirm Password</Text>
        <View style={styles.passwordContainer}>
        <TextInput style={styles.passwordInput} placeholder="Confirm your password" value={formData.confirmPassword} onChangeText={(text) => handleChange('confirmPassword', text)} secureTextEntry={true} autoCapitalize="none" autoCorrect={false} returnKeyType="done"/>
        </View>
    </View>
    <View style={styles.termsContainer}>
        <TouchableOpacity style={[styles.checkbox, formData.termsAccepted ? styles.checkboxChecked : null]} onPress={() => handleChange('termsAccepted', !formData.termsAccepted)} accessibilityLabel="Accept Terms and Conditions checkbox" accessibilityState={{ checked: formData.termsAccepted }}>
        {formData.termsAccepted ? (<Feather name="check" size={16} color={APP_CONSTANTS.COLORS.WHITE} />) : null}
        </TouchableOpacity>
        <View style={styles.termsTextContainer}>
        <Text style={styles.termsText}> I agree to the{' '} <Text style={styles.termsLink} onPress={showTermsAndConditions}> Terms and Conditions </Text> </Text>
        </View>
    </View>
    </View>
 );

 const renderProfilePictureStep_Full = () => (
    <View style={styles.stepContentContainer}>
        <Text style={styles.stepTitle}>Profile Picture</Text>
        <Text style={styles.stepDescription}>Add a picture to help others recognise you (optional)</Text>
        <View style={styles.profilePictureContainer}>
            {formData.profilePicture ? (<Image source={{ uri: formData.profilePicture }} style={styles.profilePicture} accessibilityLabel="Current profile picture"/>)
            : (<View style={styles.profilePicturePlaceholder} accessibilityLabel="Profile picture placeholder"><MaterialIcons name="person" size={60} color={APP_CONSTANTS.COLORS.PRIMARY_LIGHT} /></View>)}
            <TouchableOpacity style={[styles.uploadButton, uploading ? styles.continueButtonDisabled : null]} onPress={handleProfilePictureUpload} disabled={uploading} accessibilityLabel={formData.profilePicture ? "Change profile picture" : "Upload profile picture"}>
                {uploading ? (<ActivityIndicator color={APP_CONSTANTS.COLORS.WHITE} />) : (<Text style={styles.uploadButtonText}> {formData.profilePicture ? 'Change Picture' : 'Upload Picture'} </Text>)}
            </TouchableOpacity>
        </View>
        {/* Specific error for upload if needed */}
        {/* {error && currentStep === 'profile-picture' ? <Text style={styles.errorText}>{error}</Text> : null} */}
    </View>
 );

 const renderAgeStep_Full = () => (
    <View style={styles.stepContentContainer}>
    <Text style={styles.stepTitle}>Verify Your Age</Text>
    <Text style={styles.stepDescription}>Please confirm you are 18 or older.</Text>
    <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Age</Text>
        <TextInput style={styles.input} placeholder="Enter your age" keyboardType="numeric" value={formData.age} onChangeText={(text) => handleChange('age', text.replace(/[^0-9]/g, ''))} maxLength={2} returnKeyType="done"/>
    </View>
    <View style={styles.singpassPlaceholder}>
        <TouchableOpacity style={styles.singpassButton} onPress={() => Alert.alert("Singpass Verification", "Singpass integration is not yet implemented.")} accessibilityLabel="Verify using Singpass (Not implemented)">
            <Text style={styles.singpassButtonText}>Verify using Singpass</Text>
        </TouchableOpacity>
        <Text style={styles.singpassInfo}> (Singpass verification is currently unavailable.) </Text>
    </View>
    </View>
 );

 const renderLocationStep_Full = () => (
    <View style={styles.stepContentContainer}>
    <Text style={styles.stepTitle}>Location Details</Text>
    <Text style={styles.stepDescription}>Help us connect you with local events (optional)</Text>
    <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Country</Text>
        <TextInput style={styles.input} placeholder="Enter your country" value={formData.country} onChangeText={(text) => handleChange('country', text)} returnKeyType="next"/>
    </View>
    <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>City</Text>
        <TextInput style={styles.input} placeholder="Enter your city" value={formData.city} onChangeText={(text) => handleChange('city', text)} returnKeyType="done"/>
    </View>
    <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>Use Current Location?</Text>
        <TouchableOpacity style={[styles.checkbox, formData.useLocation ? styles.checkboxChecked : null]} onPress={() => { const newValue = !formData.useLocation; handleChange('useLocation', newValue); if (newValue) { Alert.alert("Location Access", "Automatic location detection not implemented."); } }} accessibilityLabel="Allow location access toggle" accessibilityState={{ checked: formData.useLocation }}>
            {formData.useLocation ? <Feather name="check" size={16} color={APP_CONSTANTS.COLORS.WHITE} /> : null}
        </TouchableOpacity>
    </View>
    </View>
 );

 const renderConnectMusicStep_Full = () => (
    <View style={styles.stepContentContainer}>
    <Text style={styles.stepTitle}>Connect Music Services</Text>
    <Text style={styles.stepDescription}>Select your primary music platform</Text>
    <Text style={styles.infoText}>You can connect more services later.</Text>
    <View style={styles.musicPlatformsContainer}>
        {['Spotify', 'Apple Music', 'Tidal', 'Bandcamp', 'YouTube Music', 'SoundCloud'].map((platform) => (
        <TouchableOpacity key={platform} style={[styles.platformButton, formData.musicPlatform === platform && styles.platformButtonSelected]} onPress={() => handleChange('musicPlatform', platform)} accessibilityLabel={`Select ${platform}`} accessibilityState={{ selected: formData.musicPlatform === platform }}>
            <Text style={[styles.platformButtonText, formData.musicPlatform === platform && styles.platformButtonTextSelected]}> {platform} </Text>
        </TouchableOpacity>
        ))}
    </View>
    </View>
 );

 const renderAiAnalysisStep_Full = () => (
    <View style={[styles.stepContentContainer, styles.centeredContent]}>
        <Text style={styles.stepTitle}>Analysing Your Music Taste</Text>
        <Text style={styles.stepDescription}>Please wait...</Text>
        <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} style={{ marginVertical: 30 }} />
        <Text style={styles.infoText}>(Placeholder for AI analysis)</Text>
    </View>
 );

 const renderBioStep_Full = () => (
    <View style={styles.stepContentContainer}>
    <Text style={styles.stepTitle}>About Your Music Taste</Text>
    <Text style={styles.stepDescription}>Answer a few questions (optional)</Text>
    <ScrollView style={styles.bioScrollView} nestedScrollEnabled={true}>
        {[ { key: 'firstSong', q: 'First song you remember loving?' }, { key: 'goToSong', q: 'Go-to song when feeling down?' }, { key: 'mustListenAlbum', q: 'Must-listen album?' }, { key: 'dreamConcert', q: 'Dream concert to attend?' }, { key: 'musicTaste', q: 'Describe your music taste?' }, ].map(({ key, q }) => (
            <View style={styles.bioQuestionContainer} key={key}>
                <Text style={styles.bioQuestion}>{q}</Text>
                <TextInput style={styles.bioInput} value={formData.bio[key as keyof typeof formData.bio]} onChangeText={(text) => handleChange('bio', { [key]: text })} placeholder="Your answer..." multiline={true} textAlignVertical="top"/>
            </View>
        ))}
    </ScrollView>
    </View>
 );

 const renderPremiumStep_Full = () => (
    <View style={styles.stepContentContainer}>
    <Text style={styles.stepTitle}>Choose Your Plan</Text>
    <Text style={styles.stepDescription}>Select a plan to complete registration</Text>
    <View style={styles.premiumOptionsContainer}>
        <TouchableOpacity style={[styles.premiumOption, !formData.isPremium && styles.premiumOptionSelected]} onPress={() => handleChange('isPremium', false)} accessibilityLabel="Select Free plan" accessibilityState={{ selected: !formData.isPremium }}>
        <View style={styles.premiumHeader}>
            <Text style={[styles.premiumOptionTitle, !formData.isPremium && styles.premiumTitleSelected]}>Free</Text>
            {!formData.isPremium && <Feather name="check-circle" size={24} color={APP_CONSTANTS.COLORS.WHITE} /> }
        </View>
        <Text style={[styles.premiumOptionDescription, !formData.isPremium && styles.premiumDescSelected]}> Basic features, connect, explore. </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.premiumOption, formData.isPremium && styles.premiumOptionSelected]} onPress={() => handleChange('isPremium', true)} accessibilityLabel="Select Premium plan" accessibilityState={{ selected: formData.isPremium }}>
        <View style={styles.premiumHeader}>
            <Text style={[styles.premiumOptionTitle, formData.isPremium && styles.premiumTitleSelected]}>Premium</Text>
            {formData.isPremium && <Feather name="check-circle" size={24} color={APP_CONSTANTS.COLORS.WHITE} /> }
        </View>
        <Text style={[styles.premiumOptionDescription, formData.isPremium && styles.premiumDescSelected]}> Enhanced discovery, AI insights, ad-free. (Payment Required) </Text>
        </TouchableOpacity>
    </View>
    </View>
 );

 // --- ========================================== ---
 // --- END: Full Render Functions Implementation ---
 // --- ========================================== ---


 // --- Component Render Logic ---

  const renderCurrentStepComponent = () => {
    if (isLoading) {
        // Show loading indicator ONLY if it's truly the initial load
        // Check if step is still the default 'name' AND no session AND loading IS true
        if (currentStep === 'name' && !session && isLoading) {
             return <View style={styles.centeredContent}><ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} /></View>;
        }
        // Otherwise, if loading is true but we HAVE determined a step, render the step (it might have internal loading indicators)
        // This prevents flicker when navigating between steps while something background loads.
    }

    switch (currentStep) {
      // *** THESE MUST CALL THE _FULL FUNCTIONS DEFINED ABOVE ***
      case 'name': return renderNameStep_Full();
      case 'username-email': return renderUsernameEmailStep_Full();
      case 'password': return renderPasswordStep_Full();
      case 'profile-picture': return renderProfilePictureStep_Full();
      case 'age': return renderAgeStep_Full();
      case 'location': return renderLocationStep_Full();
      case 'connect-music': return renderConnectMusicStep_Full();
      case 'ai-analysis': return renderAiAnalysisStep_Full();
      case 'bio': return renderBioStep_Full();
      case 'premium': return renderPremiumStep_Full();
      default:
          console.error("Reached default case in renderCurrentStepComponent for step:", currentStep);
          return <View style={styles.centeredContent}><Text>Loading...</Text></View>; // Fallback
    }
  };

  // Button disabled logic
  const isContinueDisabled = () => isLoading || uploading || authLoading; // Keep it simple: disable if any loading is happening

  // Button text logic
  const getButtonText = () => {
    switch (currentStep) {
        case 'password': return 'Verify & Create Account';
        case 'premium': return formData.isPremium ? 'Continue to Payment' : 'Complete Registration';
        default: return 'Continue';
    }
  };

  // --- Main Return JSX ---
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={[`${APP_CONSTANTS.COLORS.BACKGROUND_LIGHT}50`, APP_CONSTANTS.COLORS.WHITE]} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
           <TouchableOpacity style={styles.backButton} onPress={handleGoBack} disabled={isLoading} accessibilityLabel="Go back">
             <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} />
           </TouchableOpacity>
           <View style={styles.stepIndicatorContainer}>
               {['name', 'username-email', 'password', 'profile-picture', 'age', 'location', 'connect-music', 'ai-analysis', 'bio', 'premium'].map((step, index) => {
                   const stepsArray: Step[] = ['name', 'username-email', 'password', 'profile-picture', 'age', 'location', 'connect-music', 'ai-analysis', 'bio', 'premium'];
                   const currentIndex = stepsArray.indexOf(currentStep);
                   return <View key={step} style={[ styles.stepIndicator, index < currentIndex ? styles.stepIndicatorCompleted : {}, index === currentIndex ? styles.stepIndicatorActive : {} ]} />;
               })}
           </View>
            <View style={{ width: 30 }} />
         </View>

        {/* Scrollable Content Area */}
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
           {error ? <Text style={styles.errorTextGlobal}>{error}</Text> : null}
           <Animated.View style={[ styles.animatedContainer, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] } ]}>
             {renderCurrentStepComponent()}
           </Animated.View>
           {/* Extra space at bottom needed because footer is absolute */}
           <View style={{ height: 120 }} />
         </ScrollView>

         {/* Fixed Footer Button */}
         <View style={styles.footer}>
             <TouchableOpacity
                 style={[ styles.continueButton, isContinueDisabled() && styles.continueButtonDisabled ]}
                 onPress={handleStepSubmit}
                 disabled={isContinueDisabled()}
                 accessibilityLabel={getButtonText()}
             >
                 {/* Show loader inside button ONLY if general isLoading is true */}
                 {isLoading ? (
                     <ActivityIndicator color={APP_CONSTANTS.COLORS.WHITE} size="small" />
                 ) : (
                     <Text style={styles.continueButtonText}>{getButtonText()}</Text>
                 )}
             </TouchableOpacity>
         </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

// --- Styles ---
// PASTE THE FULL STYLES OBJECT HERE
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: APP_CONSTANTS.COLORS.WHITE, }, gradient: { flex: 1, },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 16 : 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: APP_CONSTANTS.COLORS.BORDER_LIGHT, },
    backButton: { padding: 8, zIndex: 1, },
    stepIndicatorContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flex: 1, },
    stepIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: APP_CONSTANTS.COLORS.BORDER, marginHorizontal: 5, },
    stepIndicatorCompleted: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT, }, stepIndicatorActive: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, width: 12, height: 12, borderRadius: 6, },
    scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 100, }, // Increased paddingBottom
    animatedContainer: { flex: 1, paddingTop: 30, width: '100%', minHeight: 400 }, // Added minHeight
    stepContentContainer: { width: '100%', alignItems: 'center', }, centeredContent: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 300 }, // Added minHeight for centering loader
    stepTitle: { fontSize: 26, fontWeight: '700', color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, marginBottom: 16, textAlign: 'center', },
    stepDescription: { fontSize: 16, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, marginBottom: 30, textAlign: 'center', lineHeight: 22, },
    infoText: { fontSize: 14, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, textAlign: 'center', marginTop: 10, marginBottom: 15, },
    inputContainer: { marginBottom: 20, width: '100%', }, inputLabel: { fontSize: 14, fontWeight: '600', color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, marginBottom: 8, marginLeft: 4, },
    input: { backgroundColor: APP_CONSTANTS.COLORS.WHITE, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 16 : 14, borderRadius: 10, fontSize: 16, borderWidth: 1, borderColor: APP_CONSTANTS.COLORS.BORDER, color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, width: '100%', },
    passwordContainer: { position: 'relative', width: '100%', }, passwordInput: { backgroundColor: APP_CONSTANTS.COLORS.WHITE, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 16 : 14, borderRadius: 10, fontSize: 16, borderWidth: 1, borderColor: APP_CONSTANTS.COLORS.BORDER, color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, width: '100%', },
    termsContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 25, width: '100%', paddingHorizontal: 4, },
    toggleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15, marginBottom: 25, width: '100%', paddingHorizontal: 4, },
    toggleLabel: { fontSize: 16, color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, fontWeight: '500', flex: 1, marginRight: 10, },
    checkbox: { width: 22, height: 22, borderWidth: 1.5, borderColor: APP_CONSTANTS.COLORS.BORDER_DARK, borderRadius: 4, marginRight: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: APP_CONSTANTS.COLORS.WHITE, },
    checkboxChecked: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, borderColor: APP_CONSTANTS.COLORS.PRIMARY, }, termsTextContainer: { flex: 1, }, termsText: { fontSize: 14, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, lineHeight: 20, }, termsLink: { color: APP_CONSTANTS.COLORS.PRIMARY, fontWeight: '600', textDecorationLine: 'underline', },
    errorTextGlobal: { color: APP_CONSTANTS.COLORS.ERROR, textAlign: 'center', marginVertical: 10, fontSize: 14, fontWeight: '500', paddingHorizontal: 10, }, errorText: { color: APP_CONSTANTS.COLORS.ERROR, marginTop: 10, textAlign: 'center', fontSize: 14, },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 30 : 20, paddingTop: 15, backgroundColor: APP_CONSTANTS.COLORS.WHITE, borderTopWidth: 1, borderTopColor: APP_CONSTANTS.COLORS.BORDER_LIGHT, }, // Adjusted padding
    continueButton: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 50, }, continueButtonDisabled: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT, opacity: 0.8, }, continueButtonText: { color: APP_CONSTANTS.COLORS.WHITE, fontSize: 16, fontWeight: '600', },
    profilePictureContainer: { alignItems: 'center', marginBottom: 30, }, profilePicture: { width: 140, height: 140, borderRadius: 70, marginBottom: 20, backgroundColor: APP_CONSTANTS.COLORS.BORDER_LIGHT, }, profilePicturePlaceholder: { width: 140, height: 140, borderRadius: 70, backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND_LIGHT, justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: APP_CONSTANTS.COLORS.BORDER, },
    uploadButton: { backgroundColor: APP_CONSTANTS.COLORS.SECONDARY, paddingHorizontal: 25, paddingVertical: 12, borderRadius: 25, }, uploadButtonText: { color: APP_CONSTANTS.COLORS.WHITE, fontSize: 15, fontWeight: '600', },
    singpassPlaceholder: { marginTop: 30, alignItems: 'center', width: '100%', paddingHorizontal: 10, }, singpassButton: { backgroundColor: '#E50914', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8, flexDirection: 'row', alignItems: 'center', marginBottom: 10, opacity: 0.6, }, singpassButtonText: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 8, }, singpassInfo: { fontSize: 12, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, textAlign: 'center', },
    musicPlatformsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 15, marginTop: 20, marginBottom: 20, }, platformButton: { width: 100, height: 100, borderRadius: 50, backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND_LIGHT, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: APP_CONSTANTS.COLORS.BORDER, }, platformButtonSelected: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT, borderColor: APP_CONSTANTS.COLORS.PRIMARY, borderWidth: 2, }, platformButtonText: { color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, fontSize: 13, fontWeight: '500', textAlign: 'center', paddingHorizontal: 5, }, platformButtonTextSelected: { color: APP_CONSTANTS.COLORS.PRIMARY, fontWeight: '600', },
    bioScrollView: { maxHeight: 400, width: '100%', marginTop: 10, }, bioQuestionContainer: { marginBottom: 25, }, bioQuestion: { fontSize: 16, fontWeight: '600', color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, marginBottom: 10, }, bioInput: { backgroundColor: APP_CONSTANTS.COLORS.WHITE, borderWidth: 1, borderColor: APP_CONSTANTS.COLORS.BORDER, borderRadius: 8, padding: 15, fontSize: 16, minHeight: 80, textAlignVertical: 'top', lineHeight: 22, color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, },
    premiumOptionsContainer: { marginTop: 10, gap: 20, width: '100%', }, premiumOption: { padding: 20, borderRadius: 12, backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND_LIGHT, borderWidth: 2, borderColor: APP_CONSTANTS.COLORS.BORDER, }, premiumOptionSelected: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT, borderColor: APP_CONSTANTS.COLORS.PRIMARY, }, premiumHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, }, premiumOptionTitle: { fontSize: 20, fontWeight: '700', color: APP_CONSTANTS.COLORS.TEXT_PRIMARY, }, premiumTitleSelected: { color: APP_CONSTANTS.COLORS.PRIMARY, }, premiumOptionDescription: { fontSize: 14, color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, lineHeight: 20, }, premiumDescSelected: { color: APP_CONSTANTS.COLORS.PRIMARY, },
});

export default MusicLoverSignUpFlow;