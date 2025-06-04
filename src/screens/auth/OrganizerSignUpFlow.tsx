// components/Auth/OrganizerSignUpFlow.tsx (or wherever it resides)
import React, { useState, useEffect, useRef } from 'react'; // Add useRef
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Animated, Image, Platform, Dimensions, Keyboard } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth'; // Correct path
import { APP_CONSTANTS } from '@/config/constants';
// Remove direct supabase import if not needed for other things
// import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import TermsModal from '@/components/TermsModal'; // Import the modal
import ImageCropper from '@/components/ImageCropper'; // Add ImageCropper

// Import the RootStackParamList to properly type the navigation
import type { RootStackParamList } from '@/navigation/AppNavigator'; // Adjust the import path as needed

// Define the navigation prop type
type OrganizerSignUpNavigationProp = NavigationProp<RootStackParamList>;

// --- Define types --- 
// type Step = 'account-details' | 'profile-details' | 'payment';
type BusinessType = 'venue' | 'promoter' | 'artist_management' | 'festival_organizer' | 'other' | '';
// Correct the Step type definition based on usage in the component
type Step = 'account-details' | 'profile-details';

// Define window width for animations (Assuming SCREEN_WIDTH is needed)
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- Placeholder Terms Text (Defined outside component) ---
const termsAndConditionsText = `**Vybr Organizer Terms & Conditions (Placeholder)**

**Last Updated: [Date]**

Welcome to Vybr for Organizers! Please read these Terms & Conditions ("Terms") carefully before using the Vybr mobile application ("Service") as an Event Organizer.

**1. Acceptance of Terms**
By accessing or using the Service as an Organizer, you agree to be bound by these Terms, in addition to the general Vybr Terms & Conditions applicable to all users. If you disagree with any part of these terms, you may not access the Service as an Organizer. **This is a placeholder text and not legally binding. You must consult with a legal professional to draft comprehensive and compliant Terms & Conditions.**

**2. Description of Service for Organizers**
Vybr allows verified Organizers to create event listings, manage event details, view attendee information (subject to privacy constraints), and potentially utilize promotional tools.

**3. Organizer Account & Verification**
You are responsible for maintaining the confidentiality of your Organizer account. You agree to provide accurate and verifiable information during the sign-up and verification process. Vybr reserves the right to approve or deny Organizer accounts.

**4. Event Listings & Content**
You are solely responsible for the accuracy, legality, and content of the events you list on Vybr. You warrant that you have all necessary rights and permissions to list and promote your events. You agree not to post misleading, fraudulent, or prohibited event content.

**5. User Data & Privacy**
You may receive access to limited information about users who interact with your events (e.g., attendees, followers). You agree to use this information solely for the purpose of managing your event and communicating relevant event information, in compliance with Vybr's Privacy Policy and all applicable data protection laws. Misuse of user data is strictly prohibited.

**6. Fees & Payments (If Applicable)**
Terms related to any listing fees, service charges, or payment processing for ticketed/paid events will be outlined in a separate Organizer Agreement or within the specific feature interface.

**7. Organizer Conduct**
You agree to conduct your activities on Vybr professionally and ethically. You will respond promptly to user inquiries related to your events. You will adhere to all general user conduct rules outlined in the main Vybr Terms & Conditions.

**8. Indemnification**
You agree to indemnify and hold harmless Vybr, its affiliates, officers, agents, and employees from any claim or demand made by any third party due to or arising out of your use of the Service as an Organizer, your violation of these Terms, or your violation of any rights of another.

**9. Disclaimers & Liability**
Refer to the main Vybr Terms & Conditions for general disclaimers and limitations of liability. Vybr is not responsible for the execution, quality, or safety of events listed by Organizers.

**10. Governing Law & Changes**
Refer to the main Vybr Terms & Conditions.

**11. Contact Us**
Refer to the main Vybr Terms & Conditions.

**By checking the box, you acknowledge that you have read, understood, and agree to be bound by these Organizer Terms & Conditions.**`;

const OrganizerSignUpFlow = () => {
  const navigation = useNavigation<OrganizerSignUpNavigationProp>();
  // Get new functions from useAuth
  const { signUp, createOrganizerProfile, requestMediaLibraryPermissions, loading: authLoading, checkOrganizerEmailExists } = useAuth();

  const [formData, setFormData] = useState({
    companyName: '',
    email: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false,
    phoneNumber: '',
    logoUri: '', // Store the local URI from the picker
    logoPreview: '', // Store URI for preview (can be same as logoUri)
    businessType: '' as BusinessType | '',
    website: '',
    bio: '',
    // Payment info remains - NOTE: This info isn't currently sent to supabase
    // You would need a backend function or further integration to process payments
    paymentInfo: {
      cardNumber: '',
      expiry: '',
      cvv: '',
      name: '',
    },
    logoMimeType: null as string | null, // Added for mobile mimeType storage
  });

  const [currentStep, setCurrentStep] = useState<Step>('account-details');
  // Use a local loading state, but consider authLoading for disabling actions during auth operations
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false); // Keep for logo upload UI feedback
  const [slideAnim] = useState(new Animated.Value(0));
  const [isTermsModalVisible, setIsTermsModalVisible] = useState(false);

  // Web cropping state
  const [showCropper, setShowCropper] = useState(false);
  const [tempImageUri, setTempImageUri] = useState<string | null>(null);

  // Email validation state
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid' | 'error'>('idle');
  const [emailFeedback, setEmailFeedback] = useState('');

  // Request permissions on mount
  useEffect(() => {
    requestMediaLibraryPermissions();
  }, [requestMediaLibraryPermissions]);


  const handleChange = (field: string, value: any) => {
    // Special handling for payment info nested object
    if (field.startsWith('paymentInfo.')) {
      const key = field.split('.')[1];
      setFormData(prev => ({
        ...prev,
        paymentInfo: { ...prev.paymentInfo, [key]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    
    // Reset email validation when email is changed
    if (field === 'email') {
      setEmailStatus('idle');
      setEmailFeedback('');
    }
    
    setError(''); // Clear error on any change
  };

  const showTermsAndConditions = () => {
     // ... (keep existing implementation)
    Alert.alert(
      'Terms and Conditions',
      'By using vybr as an organizer, you agree to:\n\n' +
      '1. Accurately represent your events and business\n' +
      '2. Provide timely payment for all transactions\n' +
      '3. Pay a 5% fee on all ticket sales and dinner reservations\n' +
      '4. Pay a 2% fee on all advertising impressions\n' +
      '5. Comply with all applicable laws and regulations\n' +
      '6. Respect user data and privacy\n' +
      '7. Maintain a professional standard in all communications\n\n' +
      'For the full terms and conditions, please visit our website.'
    );
  };

  const goToNextStep = (nextStep: Step) => {
    // ... (keep existing animation implementation)
    Animated.timing(slideAnim, {
      toValue: -400,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setCurrentStep(nextStep);
      slideAnim.setValue(400);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  };

  // Email validation handler
  const handleEmailBlur = async () => {
    const email = formData.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    console.log(`[OrganizerSignUpFlow] handleEmailBlur called with email: ${email}`);
    
    if (!email) {
      setEmailStatus('invalid');
      setEmailFeedback('Email is required.');
      console.log('[OrganizerSignUpFlow] Email is empty');
      return;
    }
    
    if (!emailRegex.test(email)) {
      setEmailStatus('invalid');
      setEmailFeedback('Please enter a valid email address.');
      console.log('[OrganizerSignUpFlow] Email format is invalid');
      return;
    }
    
    console.log('[OrganizerSignUpFlow] Checking email availability...');
    setEmailStatus('checking');
    setEmailFeedback('Checking availability...');
    
    try {
      console.log('[OrganizerSignUpFlow] Calling checkOrganizerEmailExists...');
      const result = await checkOrganizerEmailExists(email);
      console.log(`[OrganizerSignUpFlow] checkOrganizerEmailExists result:`, result);
      
      if (result.error) {
        setEmailStatus('error');
        setEmailFeedback(result.error || 'Could not verify email.');
        console.log(`[OrganizerSignUpFlow] Email check error: ${result.error}`);
      } else if (result.exists) {
        setEmailStatus('invalid');
        setEmailFeedback('Email is already in use by an Organizer.');
        console.log('[OrganizerSignUpFlow] Email already exists for an Organizer');
      } else {
        setEmailStatus('valid');
        setEmailFeedback('Email available!');
        console.log('[OrganizerSignUpFlow] Email is available for an Organizer');
      }
    } catch (e: any) {
      console.error('[OrganizerSignUpFlow] Error in email check:', e);
      setEmailStatus('error');
      setEmailFeedback('Error checking email.');
    }
  };

  // Validation functions (remain mostly the same)
  const validateAccountDetailsStep = () => {
    if (!formData.companyName.trim()) { setError('Please enter your company name'); return false; }
    if (!formData.email.trim()) { setError('Please enter your company email'); return false; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) { setError('Please enter a valid email address'); return false; }
    if (emailStatus !== 'valid') { 
      if (emailStatus !== 'invalid' || !emailFeedback) {
        setError('Please ensure your email is valid and available'); 
      }
      return false; 
    }
    if (!formData.password) { setError('Please enter a password'); return false; }
    if (formData.password.length < 8) { setError('Password must be at least 8 characters long'); return false; }
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); return false; }
    if (!formData.termsAccepted) { setError('Please accept the Terms and Conditions'); return false; }
    return true;
  };

  const validateProfileDetailsStep = () => {
    // ... (keep existing validation - logo is optional)
     if (!formData.businessType) { setError('Please select your business type'); return false; }
    return true;
  };

  // Handle logo picking (not uploading directly here anymore)
  const handleLogoPick = async () => {
    // Ensure permissions are granted first
    const hasPermission = await requestMediaLibraryPermissions();
    if (!hasPermission) {
        return; // Exit if permissions denied
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: Platform.OS !== 'web', // Only use built-in editing on mobile
        aspect: Platform.OS !== 'web' ? [4, 5] : undefined, // Enforce 4:5 aspect ratio for cropping on mobile
        quality: 0.8, // Reduce quality slightly for faster uploads
        base64: Platform.OS === 'web', // Request base64 on web for cropping
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
         const asset = result.assets[0];
         const uri = asset.uri;
         console.log('Image selected URI:', uri);
         console.log('Image mimeType:', asset.mimeType);
         
         if (Platform.OS === 'web') {
           // On web, show cropper first
           setTempImageUri(uri);
           setShowCropper(true);
         } else {
           // On mobile, use the cropped result directly and store mimeType
           setFormData(prev => ({ 
             ...prev, 
             logoUri: uri, 
             logoPreview: uri,
             logoMimeType: asset.mimeType ?? null // Handle undefined mimeType
           }));
           setError(''); // Clear any previous errors
         }
      }
    } catch (error) {
      console.error('Error picking logo:', error);
      setError('Failed to pick logo. Please try again.');
       Alert.alert('Error', 'Could not select image. Please ensure you have granted gallery permissions.');
    }
  };

  // Handle cropped image from web cropper
  const handleCroppedImage = (croppedImageUri: string, croppedBase64: string) => {
    setFormData(prev => ({ 
      ...prev, 
      logoUri: croppedImageUri, 
      logoPreview: croppedImageUri,
      logoMimeType: 'image/jpeg' // Cropper outputs JPEG
    }));
    setShowCropper(false);
    setTempImageUri(null);
    setError(''); // Clear any previous errors
  };

  // Handle cropper cancel
  const handleCropperCancel = () => {
    setShowCropper(false);
    setTempImageUri(null);
  };

  // Complete signup process - Updated Flow
  const handleCompleteSignup = async () => {
    setIsLoading(true);
    setError(''); // Clear previous errors

    try {
      // Step 1: Sign up the user (Auth + User Type)
      console.log('Attempting sign up with email:', formData.email);
      const signUpResult = await signUp({
        email: formData.email,
        password: formData.password,
        userType: 'organizer',
         // Pass only essential data for signUp
         // companyName: formData.companyName, // Not needed here anymore
      });

       // Check for sign up errors
      if ('error' in signUpResult && signUpResult.error) {
        console.error('Sign up failed:', signUpResult.error);
        setError(signUpResult.error.message || 'Sign up failed. Please check your details.');
        setIsLoading(false);
        return;
      }

      // Ensure we have a user object and ID
      if (!('user' in signUpResult) || !signUpResult.user || !signUpResult.user.id) {
         console.error('Sign up succeeded but returned invalid user data.');
        setError('An unexpected error occurred during sign up.');
        setIsLoading(false);
        return;
      }

       const userId = signUpResult.user.id;
       console.log('Sign up successful, User ID:', userId);

      // Step 2: Create the Organizer Profile (including potential logo upload handled by the hook)
      console.log('Attempting to create organizer profile with data:', { ...formData, userId });
      const profileResult = await createOrganizerProfile({
        userId: userId,
        companyName: formData.companyName,
        email: formData.email, // Use the confirmed email
        logoUri: formData.logoUri, // Pass the local URI, hook handles upload
        logoMimeType: formData.logoMimeType, // Pass the mimeType for upload
        phoneNumber: formData.phoneNumber,
        businessType: formData.businessType || undefined, // Ensure it's string or undefined
        bio: formData.bio,
        website: formData.website,
      });

      // Check for profile creation errors
      if ('error' in profileResult && profileResult.error) {
        console.error('Profile creation failed:', profileResult.error);
        // Dilemma: Auth user exists, but profile failed.
        // Might need manual intervention or a retry mechanism.
        setError(profileResult.error.message || 'Failed to save profile details. Please try editing later.');
        // Don't stop loading immediately, maybe navigate somewhere? Or show error prominently.
         // For now, just show error and stop loading. User is technically signed up.
         setIsLoading(false);
         // Consider navigating to a "complete profile" screen or dashboard with an error message.
        return;
      }

       console.log('Organizer profile created/updated successfully.');

      // Step 3: Signup and Profile creation successful!
      // Redirect to RequiredPaymentScreen - the AppNavigator will handle the detection
      console.log('Organizer sign up flow complete. The app will automatically redirect to payment setup.');
      
      // Force a re-render by resetting to MainApp, which will trigger the payment check
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainApp' }],
      });

    } catch (err: any) {
      console.error('Error completing signup process:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false); // Ensure loading indicator stops
    }
  };

  // Handle submission of each step
  const handleStepSubmit = async () => {
    setError(''); // Clear error before validation/action

    switch (currentStep) {
      case 'account-details':
        if (formData.email.trim() && emailStatus === 'idle') {
          await handleEmailBlur();
          if (!validateAccountDetailsStep()) {
            return;
          }
        } else if (!validateAccountDetailsStep()) {
          return;
        }
        
        goToNextStep('profile-details');
        break;

      case 'profile-details':
        if (validateProfileDetailsStep()) {
          // Final step - trigger the complete signup process
          await handleCompleteSignup();
        }
        break;
    }
  };

  // Render company details step (Update with email validation UI)
  const renderAccountDetailsStep = () => (
      <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Company Details</Text>

          <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Company Name</Text>
              <TextInput
                  style={styles.input}
                  placeholder="Enter your company name"
                  value={formData.companyName}
                  onChangeText={(text) => handleChange('companyName', text)}
              />
          </View>

          <View style={styles.inputContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Company Email</Text>
                {emailStatus === 'checking' && <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} style={styles.inlineLoader} />}
              </View>
              <TextInput
                  style={[
                    styles.input,
                    emailStatus === 'invalid' && styles.inputError,
                    emailStatus === 'valid' && styles.inputValid,
                  ]}
                  placeholder="Enter your company email"
                  value={formData.email}
                  onChangeText={(text) => handleChange('email', text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onBlur={() => {
                    console.log('[OrganizerSignUpFlow] Email input onBlur triggered');
                    handleEmailBlur();
                  }}
              />
              {emailFeedback ? (
                <Text style={[
                  styles.feedbackText, 
                  emailStatus === 'valid' && styles.feedbackTextValid,
                  (emailStatus === 'invalid' || emailStatus === 'error') && styles.feedbackTextError,
                ]}>
                  {emailFeedback}
                </Text>
              ) : null}
          </View>

          <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                  style={styles.input}
                  placeholder="Create a password (min. 8 characters)"
                  value={formData.password}
                  onChangeText={(text) => handleChange('password', text)}
                  secureTextEntry
                  autoCapitalize="none"
              />
          </View>

          <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <TextInput
                  style={styles.input}
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChangeText={(text) => handleChange('confirmPassword', text)}
                  secureTextEntry
                  autoCapitalize="none"
              />
          </View>

          <View style={styles.termsContainer}>
              <TouchableOpacity
                  style={[
                      styles.checkbox,
                      formData.termsAccepted && styles.checkboxChecked
                  ]}
                  onPress={() => handleChange('termsAccepted', !formData.termsAccepted)}
              >
                  {formData.termsAccepted && (
                      <Feather name="check" size={14} color="white" />
                  )}
              </TouchableOpacity>
              <Text style={styles.termsText}>
                  I agree to the{' '}
                  <Text style={styles.termsLink} onPress={() => setIsTermsModalVisible(true)}>
                      Organizer Terms and Conditions
                  </Text> *
              </Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
  );

  // Render contact and branding step (Update Logo Upload)
  const renderProfileDetailsStep = () => (
      <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Contact & Branding</Text>

          <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Phone Number (Optional)</Text>
              <TextInput
                  style={styles.input}
                  placeholder="Enter your phone number"
                  value={formData.phoneNumber}
                  onChangeText={(text) => handleChange('phoneNumber', text)}
                  keyboardType="phone-pad"
              />
          </View>

          <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Business Type</Text>
              <View style={styles.businessTypeContainer}>
                  {(['venue', 'promoter', 'artist_management', 'festival_organizer', 'other'] as BusinessType[]).map((type) => (
                      <TouchableOpacity
                          key={type}
                          style={[
                              styles.businessTypeOption,
                              formData.businessType === type && styles.businessTypeSelected
                          ]}
                          onPress={() => handleChange('businessType', type)}
                      >
                          <Text style={[
                              styles.businessTypeText,
                              formData.businessType === type && styles.businessTypeTextSelected
                          ]}>
                              {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Text>
                      </TouchableOpacity>
                  ))}
              </View>
          </View>

          <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Website (Optional)</Text>
              <TextInput
                  style={styles.input}
                  placeholder="Enter your website URL"
                  value={formData.website}
                  onChangeText={(text) => handleChange('website', text)}
                  keyboardType="url"
                  autoCapitalize="none"
              />
          </View>

          <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Bio (Optional)</Text>
              <TextInput
                  style={[styles.input, styles.bioInput]}
                  placeholder="Tell us about your organization (max 500 chars)"
                  value={formData.bio}
                  onChangeText={(text) => handleChange('bio', text)}
                  multiline
                  numberOfLines={4}
                  maxLength={500} // Add a reasonable limit
                  textAlignVertical="top" // Ensure text starts at the top
              />
          </View>

          {/* --- Updated Logo Section --- */}
          <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Logo (Optional)</Text>
              <View style={styles.logoContainer}>
                  {/* Use logoPreview which holds the local URI */}
                  {formData.logoPreview ? (
                      <Image source={{ uri: formData.logoPreview }} style={styles.logoPreview} />
                  ) : (
                      <View style={styles.logoPlaceholder}>
                          <Feather name="image" size={40} color={APP_CONSTANTS.COLORS.PRIMARY} />
                      </View>
                  )}

                  <TouchableOpacity
                      style={styles.uploadButton}
                      onPress={handleLogoPick} // Changed to pick, not upload directly
                      disabled={uploading} // Keep disabled state if needed for visual feedback during pick? (optional)
                  >
                      {/* Text changes based on whether a logo is selected */}
                      <Text style={styles.uploadButtonText}>
                          {formData.logoPreview ? 'Change Logo' : 'Select Logo'}
                      </Text>
                  </TouchableOpacity>
              </View>
          </View>
          {/* --- End Updated Logo Section --- */}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
  );

  // Render current step with appropriate button action/text
  const renderCurrentStep = () => {
     // Determine if the main action button should be disabled
      const isButtonDisabled = isLoading || authLoading || 
        (currentStep === 'account-details' && emailStatus === 'checking');

      // Determine button text
      let buttonText = 'Continue';
      if (currentStep === 'profile-details') {
          buttonText = 'Complete Sign Up';
      }

      // Determine which function the button calls
      const buttonAction = handleStepSubmit;

    switch (currentStep) {
      case 'account-details':
      case 'profile-details':
        return (
          <View style={styles.stepContainer}>
            {currentStep === 'account-details' && renderAccountDetailsStep()}
            {currentStep === 'profile-details' && renderProfileDetailsStep()}

            <TouchableOpacity
              style={[
                styles.continueButton,
                isButtonDisabled && styles.continueButtonDisabled // Use combined loading state
              ]}
              onPress={buttonAction} // Use the determined action
              disabled={isButtonDisabled} // Use combined loading state
            >
              {isButtonDisabled ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.continueButtonText}>{buttonText}</Text> // Use dynamic text
              )}
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  const goToPreviousStep = (prevStep: Step) => {
    // Prevent back during loading
    if (isLoading || authLoading) return;

    Animated.timing(slideAnim, { toValue: SCREEN_WIDTH, duration: 300, useNativeDriver: true }).start(() => {
      setCurrentStep(prevStep);
      slideAnim.setValue(-SCREEN_WIDTH); // Move off-screen to the left
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[`${APP_CONSTANTS.COLORS.PRIMARY}05`, 'white']}
        style={styles.gradient}
      >
        {/* Header with updated back button navigation */}
        <View style={styles.header}>
            <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                    if (currentStep === 'account-details') {
                        // Navigate back to landing page from first step
                        navigation.goBack(); // Use goBack instead of navigate to specific screen
                    } else {
                        const steps: Step[] = ['account-details', 'profile-details'];
                        const currentIndex = steps.indexOf(currentStep);
                        if (currentIndex > 0) {
                            // Go back to previous step with animation
                            goToPreviousStep(steps[currentIndex - 1]);
                        } else {
                            // Fallback if already on first step
                            navigation.goBack(); // Use goBack instead of navigate
                        }
                    }
                }}
            >
                <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
            </TouchableOpacity>
            <View style={styles.stepIndicatorContainer}>
                <View style={[styles.stepIndicator, currentStep === 'account-details' ? styles.stepIndicatorActive : {}]} />
                <View style={[styles.stepIndicator, currentStep === 'profile-details' ? styles.stepIndicatorActive : {}]} />
            </View>
            {/* Add a placeholder view to balance the header if needed */}
            <View style={{ width: 28 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled" // Dismiss keyboard on tap outside inputs
        >
          <Animated.View
            style={[
              styles.animatedContainer,
              { transform: [{ translateX: slideAnim }] }
            ]}
          >
            {renderCurrentStep()}
          </Animated.View>
        </ScrollView>

        {/* Terms Modal */}
        <TermsModal
            visible={isTermsModalVisible}
            onClose={() => setIsTermsModalVisible(false)}
            termsText={termsAndConditionsText} // Uses the organizer-specific text
            title="Organizer Terms & Conditions"
        />
        
        {/* Web Image Cropper */}
        {Platform.OS === 'web' && (
            <ImageCropper
                visible={showCropper}
                imageUri={tempImageUri || ''}
                aspectRatio={[4, 5]} // 4:5 aspect ratio for logo
                onCrop={handleCroppedImage}
                onCancel={handleCropperCancel}
            />
        )}
      </LinearGradient>
    </SafeAreaView>
  );
};

// Styles (minor adjustments might be needed for logo preview, but mostly the same)
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND,
    },
    gradient: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between', // Ensure back button and indicators are spaced
        paddingHorizontal: 16, // Adjust padding as needed
        paddingTop: Platform.OS === 'android' ? 16 : 10, // Adjust for status bar
        paddingBottom: 8,
    },
    backButton: {
        padding: 8, // Increase tap area
    },
    stepIndicatorContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1, // Allow it to take available space
    },
    stepIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: APP_CONSTANTS.COLORS.BORDER,
        marginHorizontal: 4,
    },
    stepIndicatorActive: {
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
        width: 20, // Make active step more prominent
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingBottom: 40, // Ensure space below button
    },
    animatedContainer: {
        flex: 1,
        // alignItems: 'center', // Let content align naturally
        // justifyContent: 'center', // Let ScrollView handle positioning
        width: '100%',
    },
    stepContainer: {
        width: '100%',
        marginTop: 24, // Reduce top margin slightly
    },
    stepContent: {
        width: '100%',
    },
    stepTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
        marginBottom: 24,
        textAlign: 'center',
    },
    stepDescription: {
        fontSize: 14, // Slightly smaller description
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        marginBottom: 24,
        textAlign: 'center',
        lineHeight: 20,
    },
    inputContainer: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14, // Slightly smaller label
        fontWeight: '600', // Make label bolder
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
        marginBottom: 8,
    },
    input: {
        backgroundColor: 'white',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: APP_CONSTANTS.COLORS.BORDER,
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    },
    bioInput: {
        height: 100,
        textAlignVertical: 'top', // Important for multiline
    },
    termsContainer: {
        flexDirection: 'row',
        alignItems: 'center', // Align checkbox and text vertically
        marginBottom: 24,
        marginTop: 8,
    },
    checkbox: {
        width: 22, // Slightly smaller checkbox
        height: 22,
        borderWidth: 1.5, // Slightly thicker border
        borderColor: APP_CONSTANTS.COLORS.BORDER,
        borderRadius: 4,
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
        borderColor: APP_CONSTANTS.COLORS.PRIMARY,
    },
    termsText: {
        fontSize: 14,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        lineHeight: 20,
        flex: 1, // Allow text to wrap
    },
    termsLink: {
        color: APP_CONSTANTS.COLORS.PRIMARY,
        fontWeight: '600',
        textDecorationLine: 'underline', // Make link clearer
    },
    businessTypeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 10, // Add margin below container
    },
    businessTypeOption: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: APP_CONSTANTS.COLORS.BORDER,
        marginRight: 10,
        marginBottom: 10,
    },
    businessTypeSelected: {
        backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}20`, // Lighter background for selected
        borderColor: APP_CONSTANTS.COLORS.PRIMARY,
    },
    businessTypeText: {
        fontSize: 14,
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
        fontWeight: '500',
    },
    businessTypeTextSelected: {
        color: APP_CONSTANTS.COLORS.PRIMARY, // Keep text color primary
        fontWeight: '600',
    },
    logoContainer: {
        alignItems: 'center',
        marginVertical: 16,
    },
    logoPreview: {
        width: 100, 
        height: 125, // 4:5 aspect ratio (100 * 5/4)
        borderRadius: 12, // Rounded rectangle
        marginBottom: 16,
        backgroundColor: '#e0e0e0', 
    },
    logoPlaceholder: {
        width: 100,
        height: 125, // 4:5 aspect ratio
        borderRadius: 12, // Rounded rectangle
        backgroundColor: APP_CONSTANTS.COLORS.BORDER + '30', 
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadButton: {
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    uploadButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    rowContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    errorText: {
        color: APP_CONSTANTS.COLORS.ERROR,
        marginBottom: 16,
        textAlign: 'center',
        fontSize: 14,
    },
    continueButton: {
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 24, // Ensure spacing above button
        marginBottom: 20, // Add space below button
    },
    continueButtonDisabled: {
        backgroundColor: APP_CONSTANTS.COLORS.DISABLED,
    },
    continueButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
    inputValid: {
        borderColor: APP_CONSTANTS.COLORS.SUCCESS || '#28a745', // Add fallback in case SUCCESS is not defined
    },
    inputError: {
        borderColor: APP_CONSTANTS.COLORS.ERROR,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 8,
    },
    inlineLoader: {
        marginLeft: 8,
    },
    feedbackText: {
        fontSize: 12,
        marginTop: 4,
        paddingLeft: 2,
    },
    feedbackTextValid: {
        color: APP_CONSTANTS.COLORS.SUCCESS || '#28a745', // Add fallback
    },
    feedbackTextError: {
        color: APP_CONSTANTS.COLORS.ERROR,
    },
});

export default OrganizerSignUpFlow;