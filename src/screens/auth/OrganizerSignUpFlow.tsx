// components/Auth/OrganizerSignUpFlow.tsx (or wherever it resides)
import React, { useState, useEffect, useRef } from 'react'; // Add useRef
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Animated, Image, Platform, Dimensions, Keyboard, Easing } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth'; // Correct path
import { APP_CONSTANTS } from '@/config/constants';
// Import supabase
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import TermsModal from '@/components/TermsModal'; // Import the modal
import ImageCropper from '@/components/ImageCropper'; // Add ImageCropper
import OpeningHoursEditor from '@/components/OpeningHoursEditor'; // <-- ADD THIS
import type { OpeningHours } from '@/hooks/useAuth'; // <-- ADD THIS

// Import the RootStackParamList to properly type the navigation
import type { RootStackParamList } from '@/navigation/AppNavigator'; // Adjust the import path as needed

// Import shared auth styles
import { authStyles } from '@/styles/authStyles';

// Define the navigation prop type
type OrganizerSignUpNavigationProp = NavigationProp<RootStackParamList>;

// --- Define types --- 
// type Step = 'account-details' | 'profile-details' | 'payment';
type BusinessType = 'venue' | 'promoter' | 'artist_management' | 'festival_organizer' | 'other' | 'F&B' | 'club' | 'party' | '';
// Correct the Step type definition based on usage in the component
type Step = 'company-name' | 'profile-details';

// Define window width for animations (Assuming SCREEN_WIDTH is needed)
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

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
  const { 
    createOrganizerProfile, 
    requestMediaLibraryPermissions, 
    loading: authLoading, 
    // Remove unused functions: signUp, checkEmailExists, signInWithGoogle, verifyGoogleAuthCompleted, updateUserMetadata
  } = useAuth();

  const [formData, setFormData] = useState({
    companyName: '',
    termsAccepted: false,
    phoneNumber: '',
    logoUri: '', // Store the local URI from the picker
    logoPreview: '', // Store URI for preview (can be same as logoUri)
    businessType: '' as BusinessType | '',
    website: '',
    bio: '',
    capacity: '', // Add capacity
    openingHours: null as OpeningHours | null, // <-- ADD THIS
    logoMimeType: null as string | null, // Added for mobile mimeType storage
  });

  const [currentStep, setCurrentStep] = useState<Step>('company-name');
  // Use a local loading state, but consider authLoading for disabling actions during auth operations
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false); // Keep for logo upload UI feedback
  const [slideAnim] = useState(new Animated.Value(0));
  const [fadeAnim] = useState(new Animated.Value(1));
  const [isTermsModalVisible, setIsTermsModalVisible] = useState(false);

  // Web cropping state
  const [showCropper, setShowCropper] = useState(false);
  const [tempImageUri, setTempImageUri] = useState<string | null>(null);

  // Remove email validation state since authentication happens in LoginScreen

  // Request permissions on mount
  useEffect(() => {
    requestMediaLibraryPermissions();
  }, [requestMediaLibraryPermissions]);

  const handleChange = (field: string, value: any) => {
    // Update formData with the new value
    setFormData(prev => ({ ...prev, [field]: value }));
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
    // Enhanced animation with fade and slide effect
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -SCREEN_WIDTH,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start(() => {
      setCurrentStep(nextStep);
      slideAnim.setValue(SCREEN_WIDTH);
      fadeAnim.setValue(0);
      
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start();
    });
  };

  // Validation functions
  const validateCompanyNameStep = () => {
    if (!formData.companyName.trim()) { 
      setError('Please enter your company name'); 
      return false; 
    }
    if (!formData.termsAccepted) { 
      setError('Please accept the Terms and Conditions'); 
      return false; 
    }
    return true;
  };

  const validateProfileDetailsStep = () => {
    // ... (keep existing validation - logo is optional)
     if (!formData.businessType) { setError('Please select your business type'); return false; }
     if (formData.businessType === 'F&B') {
      if (!formData.capacity.trim()) {
          setError('Please enter your venue capacity');
          return false;
      }
      if (!/^\d+$/.test(formData.capacity) || parseInt(formData.capacity, 10) <= 0) {
          setError('Please enter a valid capacity (must be a positive number)');
          return false;
      }
    }
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

  // Remove handleGoogleSignIn function - authentication happens in LoginScreen

  // Complete signup process - Updated Flow
  const handleCompleteSignup = async () => {
    setIsLoading(true);
    setError(''); // Clear previous errors

    try {
      // Get the current authenticated user from session
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user?.id) {
        console.error('[OrganizerSignUpFlow] No authenticated user found');
        setError('You must be signed in to create an organizer account. Please sign in first.');
        setIsLoading(false);
        return;
      }

      const userId = sessionData.session.user.id;
      console.log('[OrganizerSignUpFlow] Using authenticated user ID:', userId);

      // Get email from the authenticated user session
      if (!sessionData.session.user.email) {
        console.error('[OrganizerSignUpFlow] Could not get email from session');
        throw new Error("Could not retrieve your email from Google. Please try again.");
      }
      
      const email = sessionData.session.user.email;
      console.log('[OrganizerSignUpFlow] Got email from authenticated session:', email);

      // Step 2: Create the Organizer Profile (including potential logo upload handled by the hook)
      console.log('Attempting to create organizer profile with data:', { ...formData, userId });
      const profileData = {
        userId: userId,
        companyName: formData.companyName,
        // No need to pass email as it will be fetched from the authenticated session
        logoUri: formData.logoUri,
        logoMimeType: formData.logoMimeType,
        phoneNumber: formData.phoneNumber,
        businessType: formData.businessType || undefined,
        bio: formData.bio,
        website: formData.website,
        capacity: formData.businessType === 'F&B' ? parseInt(formData.capacity, 10) : undefined,
        openingHours: formData.businessType === 'F&B' ? (formData.openingHours ?? undefined) : undefined,
      };
      console.log('[OrganizerSignUpFlow] Creating profile for authenticated user:', profileData);
      const profileResult = await createOrganizerProfile(profileData);
      if ('error' in profileResult && profileResult.error) {
        console.error('[OrganizerSignUpFlow] Profile creation error:', profileResult.error);
        throw new Error(profileResult.error.message || 'Failed to create organizer profile');
      }

       console.log('Organizer profile created/updated successfully.');

      // Step 3: Signup and Profile creation successful!
      // Redirect to RequiredPaymentScreen - the AppNavigator will handle the detection
      console.log('Organizer sign up flow complete. Redirecting to payment setup.');
      
      // Navigate to PaymentRequired stack for payment setup
      (navigation as any).reset({
        index: 0,
        routes: [{ name: 'PaymentRequired' }],
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
      case 'company-name':
        if (validateCompanyNameStep()) {
          goToNextStep('profile-details');
        }
        break;
      
      case 'profile-details':
        if (validateProfileDetailsStep()) {
          // Create organizer profile and then navigate to payment
          console.log('[OrganizerSignUpFlow] 🏢 Organizer profile validation passed - creating profile...');
          await handleCompleteSignup();
        }
        break;
    }
  };

  // Render company name step
  const renderCompanyNameStep = () => (
    <View style={[authStyles.signupStepContent, !isWeb && { paddingTop: 10, paddingHorizontal: 0, alignItems: 'center', justifyContent: 'flex-start' }]}> 
      {/* Header Section */}
      <View style={!isWeb && { alignItems: 'center', marginBottom: 18, width: '100%' }}>
        <Text style={[authStyles.signupStepTitle, !isWeb && { marginBottom: 8, textAlign: 'center', fontSize: 24 }]}>Company Name</Text>
        <Text style={[authStyles.signupStepDescription, !isWeb && { marginBottom: 0, textAlign: 'center', fontSize: 14 }]}>Let's start with your company's name</Text>
      </View>
      
      {/* Unregistered Email Notice */}
      <View style={{
        backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}10`,
        borderWidth: 1,
        borderColor: `${APP_CONSTANTS.COLORS.PRIMARY}30`,
        borderRadius: isWeb ? 12 : 10,
        padding: isWeb ? 16 : 12,
        marginBottom: isWeb ? 24 : 20,
        alignItems: 'center',
        width: isWeb ? '100%' : '90%'
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
          Your email address is not registered. Please complete your profile to create your organizer account.
        </Text>
      </View>

      {/* Form Section */}
      <View style={!isWeb && { width: '100%', alignItems: 'center' }}>
        <View style={[authStyles.signupInputContainer, !isWeb && { marginBottom: 16, width: '90%' }]}> 
          <Text style={[authStyles.signupInputLabel, !isWeb && { fontSize: 15 }]}>Company Name</Text>
          <TextInput
            style={[authStyles.signupInput, !isWeb && { fontSize: 15, paddingVertical: 14, borderRadius: 10 }]}
            placeholder="Enter your company name"
            value={formData.companyName}
            onChangeText={(text) => handleChange('companyName', text)}
            returnKeyType="done"
          />
        </View>

        {/* Terms and Conditions */}
        <View style={[authStyles.signupTermsContainer, !isWeb && { marginBottom: 20, marginTop: 16 }]}> 
          <TouchableOpacity
            style={[
              authStyles.signupCheckbox,
              formData.termsAccepted && authStyles.signupCheckboxChecked
            ]}
            onPress={() => handleChange('termsAccepted', !formData.termsAccepted)}
            activeOpacity={0.7}
          >
            {formData.termsAccepted && (
              <Feather name="check" size={14} color="white" />
            )}
          </TouchableOpacity>
          <Text style={authStyles.signupTermsText}> 
            I agree to the{' '}
            <Text style={authStyles.signupTermsLink} onPress={() => setIsTermsModalVisible(true)}>
              Organizer Terms and Conditions
            </Text> *
          </Text>
        </View>

        <Text style={[authStyles.signupRequiredText, !isWeb && { fontSize: 11, marginTop: 0, marginBottom: 8, textAlign: 'left', alignSelf: 'flex-start', paddingLeft: 6 }]}>* Required fields</Text>
        {error ? <Text style={[authStyles.signupErrorText, !isWeb && { marginTop: 2, marginBottom: 8, fontSize: 13 }]}>{error}</Text> : null}

        <TouchableOpacity
          style={[
            authStyles.signupContinueButton,
            !isWeb && { marginTop: 10, marginBottom: 0, width: '90%', minHeight: 44, borderRadius: 10 },
            (isLoading || authLoading) && authStyles.signupContinueButtonDisabled
          ]}
          onPress={handleStepSubmit}
          disabled={isLoading || authLoading}
        >
          {(isLoading || authLoading) ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={[authStyles.signupContinueButtonText, !isWeb && { fontSize: 16 }]}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render account details step with Google Sign-In only
  const renderProfileDetailsStep = () => (
    <View style={[authStyles.signupStepContent, !isWeb && { paddingHorizontal: 16 }]}>
      <Text style={[
        authStyles.signupStepTitle, 
        !isWeb && authStyles.signupMobileContactBrandingTitle
      ]}>Contact & Branding</Text>

      {/* --- Logo Section moved to top --- */}
      {isWeb ? (
        <View style={authStyles.signupInputContainer}>
          <Text style={authStyles.signupInputLabel}>Logo (Optional)</Text>
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
              onPress={handleLogoPick}
              disabled={uploading}
            >
              <Text style={styles.uploadButtonText}>
                {formData.logoPreview ? 'Change Logo' : 'Select Logo'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'center' }}>
          <View style={authStyles.signupProfilePicSectionMobile}>
            <Text style={[authStyles.signupInputLabel, { textAlign: 'center', alignSelf: 'center', width: '100%' }]}>Logo (Optional)</Text>
            <View style={authStyles.signupProfilePicContainer}>
              {formData.logoPreview ? (
                <Image source={{ uri: formData.logoPreview }} style={authStyles.signupProfilePicPreview} />
              ) : (
                <View style={authStyles.signupProfilePicPlaceholder}>
                  <Feather name="image" size={40} color={APP_CONSTANTS.COLORS.PRIMARY} />
                </View>
              )}
              <TouchableOpacity
                style={authStyles.signupUploadButton}
                onPress={handleLogoPick}
                disabled={uploading}
              >
                <Text style={authStyles.signupUploadButtonText}>
                  {formData.logoPreview ? 'Change Logo' : 'Select Logo'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      {/* --- End Logo Section --- */}

      <View style={[authStyles.signupInputContainer, !isWeb && authStyles.signupMobileFormField]}>
          <Text style={[authStyles.signupInputLabel, !isWeb && authStyles.signupMobileSectionTitle]}>Phone Number (Optional)</Text>
          <TextInput
              style={[authStyles.signupInput, !isWeb && authStyles.signupMobileInput]}
              placeholder="Enter your phone number"
              value={formData.phoneNumber}
              onChangeText={(text) => handleChange('phoneNumber', text)}
              keyboardType="phone-pad"
          />
      </View>

      <View style={[authStyles.signupInputContainer, !isWeb && authStyles.signupMobileFormField]}>
          <Text style={[authStyles.signupInputLabel, !isWeb && authStyles.signupMobileSectionTitle]}>Business Type</Text>
          {/* Create a proper 2-column grid for business types */}
          <View style={[
            isWeb ? {
                width: '100%', 
                flexDirection: 'row', 
                flexWrap: 'wrap', 
                justifyContent: 'space-between',
                marginBottom: 24
            } : authStyles.signupMobileBusinessTypeContainer
          ]}> 
              {(['venue', 'promoter', 'F&B', 'festival_organizer', 'club','party','other'] as BusinessType[]).map((type) => (
                  <TouchableOpacity
                      key={type}
                      style={[
                          isWeb ? {
                              width: '48%',
                              paddingHorizontal: 20,
                              paddingVertical: 12,
                              borderRadius: 24,
                              borderWidth: 1,
                              borderColor: formData.businessType === type ? APP_CONSTANTS.COLORS.PRIMARY : APP_CONSTANTS.COLORS.BORDER,
                              backgroundColor: formData.businessType === type ? `${APP_CONSTANTS.COLORS.PRIMARY}20` : 'white',
                              marginBottom: 16,
                              alignItems: 'center',
                              justifyContent: 'center',
                              elevation: formData.businessType === type ? 2 : 1,
                              shadowColor: formData.businessType === type ? APP_CONSTANTS.COLORS.PRIMARY : '#000',
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: formData.businessType === type ? 0.15 : 0.05,
                              shadowRadius: 8,
                          } : [
                              authStyles.signupMobileBusinessTypeOption,
                              formData.businessType === type && {
                                  borderColor: APP_CONSTANTS.COLORS.PRIMARY,
                                  backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}20`,
                                  elevation: 2,
                                  shadowColor: APP_CONSTANTS.COLORS.PRIMARY,
                                  shadowOpacity: 0.15,
                                  shadowRadius: 8,
                              }
                          ]
                      ]}
                      onPress={() => handleChange('businessType', type)}
                  >
                      <Text style={[
                          isWeb ? {
                              fontSize: 15,
                              color: formData.businessType === type ? APP_CONSTANTS.COLORS.PRIMARY : APP_CONSTANTS.COLORS.TEXT_PRIMARY,
                              fontWeight: formData.businessType === type ? '600' : '500',
                              fontFamily: 'Inter, sans-serif',
                              textAlign: 'center',
                          } : {
                              fontSize: 14,
                              color: formData.businessType === type ? APP_CONSTANTS.COLORS.PRIMARY : APP_CONSTANTS.COLORS.TEXT_PRIMARY,
                              fontWeight: formData.businessType === type ? '600' : '500',
                              fontFamily: 'Inter, sans-serif',
                              textAlign: 'center',
                          }
                      ]}>
                          {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Text>
                  </TouchableOpacity>
              ))}
          </View>
      </View>

      {formData.businessType === 'F&B' && (
          <View style={[authStyles.signupInputContainer, !isWeb && authStyles.signupMobileFormField]}>
              <Text style={[authStyles.signupInputLabel, !isWeb && authStyles.signupMobileSectionTitle]}>Venue Capacity</Text>
              <TextInput
                  style={[authStyles.signupInput, !isWeb && authStyles.signupMobileInput]}
                  placeholder="Enter total capacity"
                  value={formData.capacity}
                  onChangeText={(text) => handleChange('capacity', text)}
                  keyboardType="number-pad"
              />
          </View>
      )}

      {formData.businessType === 'F&B' && (
         <OpeningHoursEditor
              openingHours={formData.openingHours}
              onOpeningHoursChange={(hours) => handleChange('openingHours', hours)}
          />
      )}

      <View style={[authStyles.signupInputContainer, !isWeb && authStyles.signupMobileFormField]}>
          <Text style={[authStyles.signupInputLabel, !isWeb && authStyles.signupMobileSectionTitle]}>Website (Optional)</Text>
          <TextInput
              style={[authStyles.signupInput, !isWeb && authStyles.signupMobileInput]}
              placeholder="Enter your website URL"
              value={formData.website}
              onChangeText={(text) => handleChange('website', text)}
              keyboardType="url"
              autoCapitalize="none"
          />
      </View>

      <View style={[authStyles.signupInputContainer, !isWeb && authStyles.signupMobileFormField]}>
          <Text style={[authStyles.signupInputLabel, !isWeb && authStyles.signupMobileSectionTitle]}>Bio (Optional)</Text>
          <TextInput
              style={[
                authStyles.signupInputBio, 
                !isWeb && [authStyles.signupMobileInput, authStyles.signupMobileBioInput]
              ]}
              placeholder="Tell us about your organization (max 500 chars)"
              value={formData.bio}
              onChangeText={(text) => handleChange('bio', text)}
              multiline
              numberOfLines={4}
              maxLength={500} // Add a reasonable limit
              textAlignVertical="top" // Ensure text starts at the top
          />
      </View>

      {error ? <Text style={authStyles.signupErrorText}>{error}</Text> : null}
    </View>
  );

  // Render current step with appropriate button action/text
  const renderCurrentStep = () => {
    // Determine if the main action button should be disabled
    const isButtonDisabled = isLoading || authLoading;

    // Determine button text
    let buttonText = 'Continue';
    if (currentStep === 'company-name') buttonText = 'Continue';
    if (currentStep === 'profile-details') buttonText = 'Continue to Payment';

    // Determine which function the button calls
    const buttonAction = handleStepSubmit;

    switch (currentStep) {
      case 'company-name':
        // Only render the company name step (button is inside the step for mobile)
        return (
          <View style={authStyles.signupStepContainer}>
            {renderCompanyNameStep()}
          </View>
        );
      case 'profile-details':
        return (
          <View style={authStyles.signupStepContainer}>
            {renderProfileDetailsStep()}
            <TouchableOpacity
              style={[
                authStyles.signupContinueButton,
                isButtonDisabled && authStyles.signupContinueButtonDisabled // Use combined loading state
              ]}
              onPress={buttonAction} // Use the determined action
              disabled={isButtonDisabled} // Use combined loading state
            >
              {isButtonDisabled ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={authStyles.signupContinueButtonText}>{buttonText}</Text> // Use dynamic text
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

    // Enhanced animation with fade and slide effect
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start(() => {
      setCurrentStep(prevStep);
      slideAnim.setValue(-SCREEN_WIDTH);
      fadeAnim.setValue(0);
      
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start();
    });
  };

  return (
    <SafeAreaView style={authStyles.signupContainer}>
      <LinearGradient
        colors={[`${APP_CONSTANTS.COLORS.PRIMARY}05`, 'white']}
        style={authStyles.signupGradient}
      >
        {/* Header with updated back button navigation */}
        <View style={authStyles.signupHeader}>
            <TouchableOpacity
                style={authStyles.signupBackButton}
                onPress={() => {
                    if (currentStep === 'company-name') {
                        // Clear session and let auth flow handle navigation
                        supabase.auth.signOut().then(() => {
                            // After sign out, the auth flow will automatically navigate to Landing
                        });
                    } else {
                        const steps: Step[] = ['company-name', 'profile-details'];
                        const currentIndex = steps.indexOf(currentStep);
                        if (currentIndex > 0) {
                            // Go back to previous step with animation
                            goToPreviousStep(steps[currentIndex - 1]);
                        }
                    }
                }}
            >
                <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
            </TouchableOpacity>
            <View style={authStyles.signupStepIndicatorContainer}>
                <View style={[authStyles.signupStepIndicator, currentStep === 'company-name' ? authStyles.signupStepIndicatorCurrent : {}]} />
                <View style={[authStyles.signupStepIndicator, currentStep === 'profile-details' ? authStyles.signupStepIndicatorCurrent : {}]} />
            </View>
            {/* Add a placeholder view to balance the header */}
            <View style={{ width: 28 }} />
        </View>

        <ScrollView
          contentContainerStyle={authStyles.signupScrollContentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled" // Dismiss keyboard on tap outside inputs
        >
          <Animated.View
            style={[
              authStyles.signupAnimatedContainer,
              { 
                transform: [{ translateX: slideAnim }],
                opacity: fadeAnim
              }
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

// Local styles for organizer-specific elements
const styles = {
    logoContainer: {
        alignItems: 'center' as const,
        marginVertical: isWeb ? 20 : 16,
    },
    logoPreview: {
        width: isWeb ? 120 : 100, 
        height: isWeb ? 150 : 125, // 4:5 aspect ratio
        borderRadius: isWeb ? 16 : 12,
        marginBottom: isWeb ? 20 : 16,
        backgroundColor: '#e0e0e0', 
    },
    logoPlaceholder: {
        width: isWeb ? 120 : 100,
        height: isWeb ? 150 : 125, // 4:5 aspect ratio
        borderRadius: isWeb ? 16 : 12,
        backgroundColor: APP_CONSTANTS.COLORS.BORDER + '30', 
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
    },
    uploadButton: {
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
        paddingHorizontal: isWeb ? 24 : 20,
        paddingVertical: isWeb ? 14 : 10,
        borderRadius: isWeb ? 20 : 16,
        elevation: 3,
        shadowColor: APP_CONSTANTS.COLORS.PRIMARY,
        shadowOffset: { width: 0, height: isWeb ? 6 : 4 },
        shadowOpacity: 0.2,
        shadowRadius: isWeb ? 12 : 8,
    },
    uploadButtonText: {
        color: 'white',
        fontWeight: '600' as const,
        fontSize: isWeb ? 15 : 14,
        fontFamily: 'Inter, sans-serif',
    },
    successMessageContainer: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: `${APP_CONSTANTS.COLORS.SUCCESS || '#28a745'}20`,
        paddingHorizontal: isWeb ? 16 : 12,
        paddingVertical: isWeb ? 12 : 10,
        borderRadius: isWeb ? 8 : 6,
        marginTop: isWeb ? 16 : 12,
    },
    successMessageText: {
        color: APP_CONSTANTS.COLORS.SUCCESS || '#28a745',
        fontWeight: '600' as const,
        fontSize: isWeb ? 14 : 13,
        marginLeft: isWeb ? 8 : 6,
        fontFamily: 'Inter, sans-serif',
    },
};

export default OrganizerSignUpFlow;