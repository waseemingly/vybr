import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Animated, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';
import { APP_CONSTANTS } from '@/config/constants';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';

// Step types for the signup flow - removed verification step
type Step = 'company-details' | 'contact-branding' | 'payment';

// Business type options
type BusinessType = 'venue' | 'promoter' | 'artist_management' | 'festival_organizer' | 'other';

const OrganizerSignUpFlow = () => {
  const navigation = useNavigation();
  const { signUp, createOrganizerProfile } = useAuth();
  
  // State for all form data across steps
  const [formData, setFormData] = useState({
    companyName: '',
    email: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false,
    phoneNumber: '',
    logo: '',
    businessType: '' as BusinessType | '',
    website: '',
    bio: '',
    paymentInfo: {
      cardNumber: '',
      expiry: '',
      cvv: '',
      name: '',
    },
  });
  
  // Current step state
  const [currentStep, setCurrentStep] = useState<Step>('company-details');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  
  // Animation value for transitions
  const [slideAnim] = useState(new Animated.Value(0));
  
  // Handle form field changes
  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };
  
  // Show terms and conditions
  const showTermsAndConditions = () => {
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
  
  // Move to next step with animation
  const goToNextStep = (nextStep: Step) => {
    // Slide out current step
    Animated.timing(slideAnim, {
      toValue: -400,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      // Change step and reset animation
      setCurrentStep(nextStep);
      slideAnim.setValue(400);
      
      // Slide in new step
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  };
  
  // Validation functions
  const validateCompanyDetailsStep = () => {
    if (!formData.companyName.trim()) {
      setError('Please enter your company name');
      return false;
    }
    
    if (!formData.email.trim()) {
      setError('Please enter your company email');
      return false;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    
    if (!formData.password) {
      setError('Please enter a password');
      return false;
    }
    
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    
    if (!formData.termsAccepted) {
      setError('Please accept the Terms and Conditions to continue');
      return false;
    }
    
    return true;
  };
  
  // Validate contact and branding step
  const validateContactBrandingStep = () => {
    // Phone number is optional, so we don't validate it
    
    if (!formData.businessType) {
      setError('Please select your business type');
      return false;
    }
    
    // Bio and website are optional
    
    return true;
  };
  
  // Validate payment step
  const validatePaymentStep = () => {
    const { cardNumber, expiry, cvv, name } = formData.paymentInfo;
    
    if (!cardNumber.trim()) {
      setError('Please enter your card number');
      return false;
    }
    
    if (!expiry.trim()) {
      setError('Please enter the card expiry date');
      return false;
    }
    
    if (!cvv.trim()) {
      setError('Please enter the CVV');
      return false;
    }
    
    if (!name.trim()) {
      setError('Please enter the cardholder name');
      return false;
    }
    
    return true;
  };

  // Handle logo upload
  const handleLogoUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setUploading(true);
        const file = result.assets[0];
        const fileExt = file.uri.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const response = await fetch(file.uri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('profile-pictures')
          .upload(filePath, blob);

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('profile-pictures')
          .getPublicUrl(filePath);

        setFormData(prev => ({ ...prev, logo: publicUrl }));
        setUploading(false);
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      setError('Failed to upload logo. Please try again.');
      setUploading(false);
    }
  };
  
  // Complete signup process
  const handleCompleteSignup = async () => {
    setIsLoading(true);
    try {
      // Sign up with Supabase
      const result = await signUp({
        email: formData.email,
        password: formData.password,
        userType: 'organizer',
        companyName: formData.companyName,
      });

      if ('error' in result && result.error) {
        setError(result.error.message);
        setIsLoading(false);
        return;
      }

      if (!('user' in result) || !result.user) {
        setError('Failed to create user account.');
        setIsLoading(false);
        return;
      }

      // Create organizer profile
      const profileResult = await createOrganizerProfile({
        userId: result.user.id,
        companyName: formData.companyName,
        email: formData.email,
        logo: formData.logo,
        phoneNumber: formData.phoneNumber,
        businessType: formData.businessType,
        bio: formData.bio,
        website: formData.website,
      });

      if ('error' in profileResult && profileResult.error) {
        setError(profileResult.error.message);
        setIsLoading(false);
        return;
      }

      // Log in the user to complete the signup flow
      await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      // Navigate to dashboard
      navigation.navigate('OrganizerTabs' as never);
    } catch (err) {
      console.error('Error completing signup:', err);
      setError('An error occurred while completing signup. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle submission of each step
  const handleStepSubmit = async () => {
    setError('');
    
    switch (currentStep) {
      case 'company-details':
        if (validateCompanyDetailsStep()) {
          goToNextStep('contact-branding');
        }
        break;
      
      case 'contact-branding':
        if (validateContactBrandingStep()) {
          goToNextStep('payment');
        }
        break;
        
      case 'payment':
        if (validatePaymentStep()) {
          await handleCompleteSignup();
        }
        break;
    }
  };
  
  // Render company details step
  const renderCompanyDetailsStep = () => (
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
        <Text style={styles.inputLabel}>Company Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your company email"
          value={formData.email}
          onChangeText={(text) => handleChange('email', text)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
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
          <Text style={styles.termsLink} onPress={showTermsAndConditions}>
            Terms and Conditions
          </Text>
        </Text>
      </View>
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
  
  // Render contact and branding step
  const renderContactBrandingStep = () => (
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
          {['venue', 'promoter', 'artist_management', 'festival_organizer', 'other'].map((type) => (
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
                {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
          placeholder="Tell us about your organization"
          value={formData.bio}
          onChangeText={(text) => handleChange('bio', text)}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Logo (Optional)</Text>
        <View style={styles.logoContainer}>
          {formData.logo ? (
            <Image source={{ uri: formData.logo }} style={styles.logoPreview} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Feather name="image" size={40} color={APP_CONSTANTS.COLORS.PRIMARY} />
            </View>
          )}
          
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handleLogoUpload}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.uploadButtonText}>Upload Logo</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
  
  // Render payment step
  const renderPaymentStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Payment Information</Text>
      <Text style={styles.stepDescription}>
        For a monthly subscription of $29.99, get access to premium features.
      </Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Card Number</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your card number"
          value={formData.paymentInfo.cardNumber}
          onChangeText={(text) => setFormData(prev => ({
            ...prev,
            paymentInfo: { ...prev.paymentInfo, cardNumber: text }
          }))}
          keyboardType="number-pad"
          maxLength={16}
        />
      </View>
      
      <View style={styles.rowContainer}>
        <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.inputLabel}>Expiry Date</Text>
          <TextInput
            style={styles.input}
            placeholder="MM/YY"
            value={formData.paymentInfo.expiry}
            onChangeText={(text) => setFormData(prev => ({
              ...prev,
              paymentInfo: { ...prev.paymentInfo, expiry: text }
            }))}
            keyboardType="number-pad"
            maxLength={5}
          />
        </View>
        
        <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.inputLabel}>CVV</Text>
          <TextInput
            style={styles.input}
            placeholder="CVV"
            value={formData.paymentInfo.cvv}
            onChangeText={(text) => setFormData(prev => ({
              ...prev,
              paymentInfo: { ...prev.paymentInfo, cvv: text }
            }))}
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>
      </View>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Cardholder Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter cardholder name"
          value={formData.paymentInfo.name}
          onChangeText={(text) => setFormData(prev => ({
            ...prev,
            paymentInfo: { ...prev.paymentInfo, name: text }
          }))}
        />
      </View>
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
  
  // Render current step
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'company-details':
        return (
          <View style={styles.stepContainer}>
            {renderCompanyDetailsStep()}
            <TouchableOpacity
              style={[
                styles.continueButton,
                (isLoading) && styles.continueButtonDisabled
              ]}
              onPress={handleStepSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.continueButtonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        );
        
      case 'contact-branding':
        return (
          <View style={styles.stepContainer}>
            {renderContactBrandingStep()}
            <TouchableOpacity
              style={[
                styles.continueButton,
                (isLoading) && styles.continueButtonDisabled
              ]}
              onPress={handleStepSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.continueButtonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        );
        
      case 'payment':
        return (
          <View style={styles.stepContainer}>
            {renderPaymentStep()}
            <TouchableOpacity
              style={[
                styles.continueButton,
                (isLoading) && styles.continueButtonDisabled
              ]}
              onPress={handleStepSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.continueButtonText}>Complete Sign Up</Text>
              )}
            </TouchableOpacity>
          </View>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[`${APP_CONSTANTS.COLORS.PRIMARY}05`, 'white']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              if (currentStep === 'company-details') {
                navigation.goBack();
              } else {
                // Go back to previous step
                const steps: Step[] = ['company-details', 'contact-branding', 'payment'];
                const currentIndex = steps.indexOf(currentStep);
                if (currentIndex > 0) {
                  setCurrentStep(steps[currentIndex - 1]);
                }
              }
            }}
          >
            <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
          </TouchableOpacity>
          
          <View style={styles.stepIndicatorContainer}>
            <View 
              style={[
                styles.stepIndicator, 
                currentStep === 'company-details' ? styles.stepIndicatorActive : {}
              ]} 
            />
            <View 
              style={[
                styles.stepIndicator, 
                currentStep === 'contact-branding' ? styles.stepIndicatorActive : {}
              ]} 
            />
            <View 
              style={[
                styles.stepIndicator, 
                currentStep === 'payment' ? styles.stepIndicatorActive : {}
              ]} 
            />
          </View>
        </View>
        
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
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
      </LinearGradient>
    </SafeAreaView>
  );
};

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
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backButton: {
    padding: 4,
  },
  stepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
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
    width: 20,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  animatedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  stepContainer: {
    width: '100%',
    marginTop: 32,
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
    fontSize: 16,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
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
    textAlignVertical: 'top',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
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
    flex: 1,
  },
  termsLink: {
    color: APP_CONSTANTS.COLORS.PRIMARY,
    fontWeight: '600',
  },
  businessTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8,
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
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
    borderColor: APP_CONSTANTS.COLORS.PRIMARY,
  },
  businessTypeText: {
    fontSize: 14,
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
  },
  businessTypeTextSelected: {
    color: 'white',
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  logoPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: APP_CONSTANTS.COLORS.BORDER + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  uploadButton: {
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  uploadButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  errorText: {
    color: APP_CONSTANTS.COLORS.ERROR,
    marginBottom: 16,
  },
  continueButton: {
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  continueButtonDisabled: {
    backgroundColor: APP_CONSTANTS.COLORS.DISABLED,
  },
  continueButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default OrganizerSignUpFlow; 