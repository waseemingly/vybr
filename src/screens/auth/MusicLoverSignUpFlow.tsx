import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';
import { authorizeSpotify, generateMusicProfile } from '@/services/spotify';
import { APP_CONSTANTS } from '@/config/constants';
import { EMAIL_CONFIG, formatEmailDetails } from '@/lib/supabase';

// Step types for the signup flow
type Step = 
  | 'name' 
  | 'username-email' 
  | 'password' 
  | 'verification' 
  | 'profile-picture' 
  | 'age' 
  | 'location' 
  | 'connect-music' 
  | 'ai-analysis' 
  | 'bio' 
  | 'premium';

const MusicLoverSignUpFlow = () => {
  const navigation = useNavigation();
  const { signUp, checkEmailVerification, resendVerificationEmail } = useAuth();
  
  // State for all form data across steps
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false,
    profilePicture: '',
    age: '',
    country: '',
    city: '',
    bio: '',
    isPremium: false,
    musicData: null,
  });
  
  // New state for verification
  const [userId, setUserId] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'failed'>('pending');
  const [resendLoading, setResendLoading] = useState(false);
  const [verificationCheckInterval, setVerificationCheckInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Current step state
  const [currentStep, setCurrentStep] = useState<Step>('name');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Animation value for transitions
  const [slideAnim] = useState(new Animated.Value(0));
  
  // Handle form field changes
  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
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
  
  // Check for validation errors in the name step
  const validateNameStep = () => {
    if (!formData.firstName || !formData.lastName) {
      setError('Please enter both your first and last name');
      return false;
    }
    return true;
  };
  
  // Check for validation errors in the username-email step
  const validateUsernameEmailStep = () => {
    if (!formData.username) {
      setError('Please enter a username');
      return false;
    }
    
    if (!formData.email) {
      setError('Please enter your email address');
      return false;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    
    return true;
  };
  
  // Validate password step
  const validatePasswordStep = () => {
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

  // Show terms and conditions
  const showTermsAndConditions = () => {
    Alert.alert(
      'Terms and Conditions',
      'By using vybr, you agree to:\n\n' +
      '1. Respect other users and their privacy\n' +
      '2. Not post inappropriate or offensive content\n' +
      '3. Allow us to analyze your music preferences\n' +
      '4. Allow vybr to collect data to improve recommendations\n' +
      '5. Allow us to share anonymized data for research\n' +
      '6. Accept our privacy policy regarding personal information\n' +
      '7. Respect other users\' intellectual property rights\n\n' +
      'For the full terms and conditions, please visit our website.'
    );
  };
  
  // Check verification status
  const checkVerification = async (userId: string) => {
    try {
      const isVerified = await checkEmailVerification(userId);
      
      if (isVerified) {
        setVerificationStatus('verified');
        // Clear any existing interval
        if (verificationCheckInterval) {
          clearInterval(verificationCheckInterval);
          setVerificationCheckInterval(null);
        }
        // Automatically continue after verification is confirmed
        setTimeout(() => {
          handleContinueAfterVerification();
        }, 1500);
      } else {
        setVerificationStatus('pending');
        Alert.alert(
          'Not Verified',
          'Your email has not been verified yet. Please check your email and click the verification link.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error checking verification:', error);
      setVerificationStatus('failed');
    }
  };
  
  // Start automatic verification checking
  const startVerificationChecking = (userId: string) => {
    // Clear any existing interval first
    if (verificationCheckInterval) {
      clearInterval(verificationCheckInterval);
    }
    
    // Check immediately
    checkVerification(userId);
    
    // Set up periodic checking (every 15 seconds)
    const interval = setInterval(() => {
      checkVerification(userId);
    }, 15000);
    
    setVerificationCheckInterval(interval);
  };
  
  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (verificationCheckInterval) {
        clearInterval(verificationCheckInterval);
      }
    };
  }, [verificationCheckInterval]);
  
  // Handle continuing after verification
  const handleContinueAfterVerification = () => {
    // Navigate to the login screen after successful verification
    Alert.alert(
      'Verification Complete', 
      'Your email has been verified successfully! You can now log in to your account.',
      [
        { 
          text: 'Continue to Login', 
          onPress: () => navigation.navigate('MusicLoverLogin' as never)
        }
      ]
    );
  };
  
  // Handle resending verification email
  const handleResendVerification = async () => {
    if (!formData.email) return;
    
    setResendLoading(true);
    
    try {
      const result = await resendVerificationEmail(formData.email);
      
      if ('error' in result && result.error) {
        Alert.alert('Error', `Failed to resend verification email: ${result.error.message}`);
      } else {
        Alert.alert('Verification Email', 'A new verification email has been sent to your inbox from vybr.connect@gmail.com.');
      }
    } catch (error) {
      console.error('Error resending verification:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };
  
  // Handle submission of each step
  const handleStepSubmit = () => {
    setError('');
    
    switch (currentStep) {
      case 'name':
        if (validateNameStep()) {
          goToNextStep('username-email');
        }
        break;
        
      case 'username-email':
        if (validateUsernameEmailStep()) {
          goToNextStep('password');
        }
        break;
    
      case 'password':
        if (validatePasswordStep()) {
          setIsLoading(true);
          signUp({
            email: formData.email,
            password: formData.password,
            firstName: formData.firstName,
            lastName: formData.lastName,
            username: formData.username,
            userType: 'music_lover',
          })
          .then(result => {
            setIsLoading(false);
            if ('error' in result && result.error) {
              setError(result.error.message);
            } else if ('user' in result && result.user) {
              // Store user ID for verification checks
              if (result.user.id) {
                setUserId(result.user.id);
                
                // Start periodic verification checking
                startVerificationChecking(result.user.id);
              }
              
              goToNextStep('verification');
            }
          })
          .catch(err => {
            setIsLoading(false);
            setError('An error occurred during signup. Please try again.');
            console.error(err);
          });
        }
        break;
        
      case 'verification':
        // Manually trigger verification check if user is waiting
        if (userId && verificationStatus === 'pending') {
          checkVerification(userId);
        }
        break;
    }
  };
  
  // Render the name entry step
  const renderNameStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What's your name?</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>First Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your first name"
          value={formData.firstName}
          onChangeText={(text) => handleChange('firstName', text)}
          autoCapitalize="words"
        />
      </View>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Last Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your last name"
          value={formData.lastName}
          onChangeText={(text) => handleChange('lastName', text)}
          autoCapitalize="words"
        />
      </View>
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      
      <TouchableOpacity
        style={[
          styles.continueButton,
          (!formData.firstName || !formData.lastName) && styles.continueButtonDisabled
        ]}
        onPress={handleStepSubmit}
        disabled={!formData.firstName || !formData.lastName}
      >
        <Text style={styles.continueButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
  
  // Render the username and email step
  const renderUsernameEmailStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Create your identity</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Username</Text>
        <TextInput
          style={styles.input}
          placeholder="Choose a unique username"
          value={formData.username}
          onChangeText={(text) => handleChange('username', text)}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Email Address</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your email address"
          value={formData.email}
          onChangeText={(text) => handleChange('email', text)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      
      <TouchableOpacity
        style={[
          styles.continueButton,
          (!formData.username || !formData.email) && styles.continueButtonDisabled
        ]}
        onPress={handleStepSubmit}
        disabled={!formData.username || !formData.email}
      >
        <Text style={styles.continueButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
  
  // Render the password step
  const renderPasswordStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Create a secure password</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Enter your password"
            value={formData.password}
            onChangeText={(text) => handleChange('password', text)}
            secureTextEntry={true}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Confirm Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Confirm your password"
            value={formData.confirmPassword}
            onChangeText={(text) => handleChange('confirmPassword', text)}
            secureTextEntry={true}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>
      
      <View style={styles.termsContainer}>
        <TouchableOpacity 
          style={styles.checkbox}
          onPress={() => handleChange('termsAccepted', !formData.termsAccepted)}
        >
          {formData.termsAccepted ? (
            <Feather name="check" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
          ) : null}
        </TouchableOpacity>
        <View style={styles.termsTextContainer}>
          <Text style={styles.termsText}>
            I agree to the{' '}
            <Text 
              style={styles.termsLink}
              onPress={showTermsAndConditions}
            >
              Terms and Conditions
            </Text>
          </Text>
        </View>
      </View>
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      
      <TouchableOpacity
        style={[
          styles.continueButton,
          (
            !formData.password || 
            !formData.confirmPassword || 
            !formData.termsAccepted ||
            isLoading
          ) && styles.continueButtonDisabled
        ]}
        onPress={handleStepSubmit}
        disabled={!formData.password || !formData.confirmPassword || !formData.termsAccepted || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.continueButtonText}>Sign Up</Text>
        )}
      </TouchableOpacity>
    </View>
  );
  
  // Render the verification step
  const renderVerificationStep = () => {
    // Helper to determine if verification is completed
    const isVerified = verificationStatus === 'verified';
    
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Email Verification</Text>
        
        {isVerified ? (
          // Verified state
          <View style={styles.verificationSuccess}>
            <Text style={styles.verificationSuccessText}>Email successfully verified!</Text>
            <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} />
            <Text style={styles.redirectingText}>Taking you to the login screen...</Text>
          </View>
        ) : (
          // Pending or failed verification
          <>
            <Text style={styles.verificationText}>
              We've sent a verification email to <Text style={styles.emailHighlight}>{formData.email}</Text>
            </Text>
            
            <View style={styles.verificationInstructions}>
              <Text style={styles.instructionTitle}>Please follow these steps:</Text>
              <Text style={styles.instructionStep}>1. Open your email app</Text>
              <Text style={styles.instructionStep}>2. Look for an email from {EMAIL_CONFIG.SENDER_NAME} ({EMAIL_CONFIG.SENDER_EMAIL})</Text>
              <Text style={styles.instructionStep}>3. Subject: {EMAIL_CONFIG.EMAIL_SUBJECTS.VERIFICATION}</Text>
              <Text style={styles.instructionStep}>4. Click the verification link in the email</Text>
              <Text style={styles.instructionStep}>5. Return to this app</Text>
            </View>
            
            <Text style={styles.verificationStatusText}>
              Status: {verificationStatus === 'pending' ? 'Waiting for verification' : 'Verification failed'}
              {verificationStatus === 'pending' && (
                <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} style={styles.inlineLoader} />
              )}
            </Text>
            
            <View style={styles.verificationActionsContainer}>
              <TouchableOpacity 
                style={styles.verificationButton}
                onPress={() => userId && checkVerification(userId)}
                disabled={!userId || isVerified}
              >
                <Text style={styles.verificationButtonText}>Check Verification Status</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.resendButton}
                onPress={handleResendVerification}
                disabled={resendLoading || !userId}
              >
                {resendLoading ? (
                  <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.WHITE} />
                ) : (
                  <Text style={styles.resendButtonText}>Resend Verification Email</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  };
  
  // Update the renderCurrentStep to include verification step
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'name':
        return renderNameStep();
      case 'username-email':
        return renderUsernameEmailStep();
      case 'password':
        return renderPasswordStep();
      case 'verification':
        return renderVerificationStep();
      // Additional cases will be added for other steps
      default:
        return null;
    }
  };
  
  // Render continue button
  const renderContinueButton = () => {
    // Helper for checking verified status
    const isVerified = verificationStatus === 'verified';
    
    return (
      <TouchableOpacity
        style={[styles.continueButton, (isLoading || (currentStep === 'verification' && isVerified)) && styles.continueButtonDisabled]}
        onPress={handleStepSubmit}
        disabled={isLoading || (currentStep === 'verification' && isVerified)}
      >
        {isLoading ? (
          <ActivityIndicator color={APP_CONSTANTS.COLORS.WHITE} size="small" />
        ) : (
          <Text style={styles.continueButtonText}>
            {currentStep === 'verification' ? 'Check Verification' : 'Continue'}
          </Text>
        )}
      </TouchableOpacity>
    );
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
              if (currentStep === 'name') {
                navigation.goBack();
              } else {
                // Go back to previous step (logic to be implemented)
                setCurrentStep('name');
              }
            }}
          >
            <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
          </TouchableOpacity>
          
          <View style={styles.stepIndicatorContainer}>
            <View 
              style={[
                styles.stepIndicator, 
                styles.stepIndicatorActive
              ]} 
            />
            <View 
              style={[
                styles.stepIndicator, 
                currentStep !== 'name' ? styles.stepIndicatorActive : {}
              ]} 
            />
            <View 
              style={[
                styles.stepIndicator, 
                currentStep === 'password' || currentStep === 'verification' ? styles.stepIndicatorActive : {}
              ]} 
            />
            <View 
              style={[
                styles.stepIndicator, 
                currentStep === 'verification' ? styles.stepIndicatorActive : {}
              ]} 
            />
            <View style={styles.stepIndicator} />
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
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
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
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: APP_CONSTANTS.COLORS.BORDER,
    width: '100%',
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
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
  termsTextContainer: {
    flex: 1,
  },
  termsText: {
    fontSize: 14,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    lineHeight: 20,
  },
  termsLink: {
    color: APP_CONSTANTS.COLORS.PRIMARY,
    fontWeight: '500',
    textDecorationLine: 'underline',
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
    color: APP_CONSTANTS.COLORS.WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  verificationContainer: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  verificationIcon: {
    marginBottom: 24,
  },
  verificationTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    marginBottom: 8,
  },
  verificationEmail: {
    fontSize: 16,
    fontWeight: '500',
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    marginBottom: 24,
  },
  verificationInstructionsContainer: {
    width: '100%',
    marginBottom: 16,
  },
  verificationSuccess: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    padding: 20,
    backgroundColor: '#e6f7ef',
    borderRadius: 8,
  },
  verificationSuccessText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2a9d8f',
    marginBottom: 15,
  },
  redirectingText: {
    marginTop: 10,
    fontSize: 14,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
  },
  verificationText: {
    fontSize: 16,
    fontWeight: '500',
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    marginBottom: 10,
  },
  verificationInstructions: {
    marginVertical: 20,
    padding: 15,
    backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND_LIGHT,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: APP_CONSTANTS.COLORS.PRIMARY,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
  },
  instructionStep: {
    fontSize: 14,
    lineHeight: 22,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    marginBottom: 5,
  },
  emailHighlight: {
    fontWeight: 'bold',
    color: APP_CONSTANTS.COLORS.PRIMARY,
  },
  verificationStatusText: {
    flexDirection: 'row',
    alignItems: 'center',
    fontSize: 14,
    marginBottom: 20,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
  },
  inlineLoader: {
    marginLeft: 10,
  },
  verificationActionsContainer: {
    marginTop: 10,
  },
  verificationButton: {
    backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND_LIGHT,
    borderWidth: 1,
    borderColor: APP_CONSTANTS.COLORS.PRIMARY,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  verificationButtonText: {
    color: APP_CONSTANTS.COLORS.PRIMARY,
    fontWeight: '600',
  },
  resendButton: {
    backgroundColor: APP_CONSTANTS.COLORS.SECONDARY,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  resendButtonText: {
    color: APP_CONSTANTS.COLORS.WHITE,
    fontWeight: '600',
  },
});

export default MusicLoverSignUpFlow; 