import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Animated, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';
import { authorizeSpotify, generateMusicProfile } from '@/services/spotify';
import { APP_CONSTANTS } from '@/config/constants';
import { EMAIL_CONFIG, formatEmailDetails } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';

// Step types for the signup flow
type Step = 
  | 'name' 
  | 'username-email' 
  | 'password' 
  | 'profile-picture'
  | 'age'
  | 'connect-music'
  | 'bio'
  | 'premium';

const MusicLoverSignUpFlow = () => {
  const navigation = useNavigation();
  const { signUp, createMusicLoverProfile } = useAuth();
  
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
    musicPlatform: '',
    bio: {
      firstSong: '',
      goToSong: '',
      mustListenAlbum: '',
      dreamConcert: '',
      musicTaste: ''
    },
    isPremium: false,
  });
  
  // Current step state
  const [currentStep, setCurrentStep] = useState<Step>('name');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  
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
  
  // Validation functions
  const validateNameStep = () => {
    if (!formData.firstName || !formData.lastName) {
      setError('Please enter both your first and last name');
      return false;
    }
    return true;
  };
  
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
  
  // Handle profile picture upload
  const handleProfilePictureUpload = async () => {
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

        setFormData(prev => ({ ...prev, profilePicture: publicUrl }));
        setUploading(false);
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      setError('Failed to upload profile picture. Please try again.');
      setUploading(false);
    }
  };
  
  // Handle submission of each step
  const handleStepSubmit = async () => {
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
          try {
            const result = await signUp({
              email: formData.email,
              password: formData.password,
              firstName: formData.firstName,
              lastName: formData.lastName,
              username: formData.username,
              userType: 'music_lover',
            });

            if ('error' in result && result.error) {
              setError(result.error.message);
            } else if ('user' in result && result.user) {
              // After successful signup, proceed to profile setup
              setCurrentStep('profile-picture');
            }
          } catch (err) {
            setError('An error occurred during signup. Please try again.');
            console.error(err);
          } finally {
            setIsLoading(false);
          }
        }
        break;

      case 'profile-picture':
        goToNextStep('age');
        break;

      case 'age':
        if (formData.age && parseInt(formData.age) >= 18) {
          goToNextStep('connect-music');
        } else {
          setError('You must be 18 or older to use this app.');
        }
        break;

      case 'connect-music':
        if (formData.musicPlatform) {
          goToNextStep('bio');
        } else {
          setError('Please select a music platform.');
        }
        break;

      case 'bio':
        // Bio is optional, so we can proceed without validation
        goToNextStep('premium');
        break;

      case 'premium':
        setIsLoading(true);
        try {
          // Get the current user's ID
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            throw new Error('No user found');
          }

          // Create the music lover profile
          const result = await createMusicLoverProfile({
            userId: user.id,
            firstName: formData.firstName,
            lastName: formData.lastName,
            username: formData.username,
            email: formData.email,
            age: formData.age,
            profilePicture: formData.profilePicture,
            musicPlatform: formData.musicPlatform,
            bio: formData.bio,
            isPremium: formData.isPremium
          });

          if ('error' in result && result.error) {
            setError(result.error.message);
          } else if ('success' in result && result.success) {
            // Navigate based on premium choice
            if (formData.isPremium) {
              navigation.navigate('Transaction' as never);
            } else {
              navigation.navigate('MusicLoverDashboard' as never);
            }
          }
        } catch (err) {
          setError('An error occurred while creating your profile. Please try again.');
          console.error(err);
        } finally {
          setIsLoading(false);
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
  
  // Render profile picture step
  const renderProfilePictureStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Profile Picture</Text>
      <Text style={styles.stepDescription}>Add a profile picture to help others recognize you</Text>
      
      <View style={styles.profilePictureContainer}>
        {formData.profilePicture ? (
          <Image 
            source={{ uri: formData.profilePicture }} 
            style={styles.profilePicture}
          />
        ) : (
          <View style={styles.profilePicturePlaceholder}>
            <MaterialIcons name="person" size={50} color={APP_CONSTANTS.COLORS.PRIMARY} />
          </View>
        )}
        
        <TouchableOpacity 
          style={styles.uploadButton}
          onPress={handleProfilePictureUpload}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color={APP_CONSTANTS.COLORS.WHITE} />
          ) : (
            <Text style={styles.uploadButtonText}>Upload Picture</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render age verification step
  const renderAgeStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Age Verification</Text>
      <Text style={styles.stepDescription}>Please enter your age to verify you're 18 or older</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Enter your age"
        keyboardType="numeric"
        value={formData.age}
        onChangeText={(text) => setFormData(prev => ({ ...prev, age: text }))}
        maxLength={2}
      />
    </View>
  );

  // Render music platform selection step
  const renderConnectMusicStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Connect Music Services</Text>
      <Text style={styles.stepDescription}>Select your preferred music platform</Text>
      
      <View style={styles.musicPlatformsContainer}>
        {['Spotify', 'Apple Music', 'Tidal', 'Bandcamp', 'YouTube Music', 'SoundCloud'].map((platform) => (
          <TouchableOpacity
            key={platform}
            style={[
              styles.platformButton,
              formData.musicPlatform === platform && styles.platformButtonSelected
            ]}
            onPress={() => setFormData(prev => ({ ...prev, musicPlatform: platform }))}
          >
            <Text style={[
              styles.platformButtonText,
              formData.musicPlatform === platform && styles.platformButtonTextSelected
            ]}>
              {platform}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Render bio step
  const renderBioStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Tell Us About Your Music Taste</Text>
      <Text style={styles.stepDescription}>Answer these questions to help us understand your music preferences</Text>
      
      <ScrollView style={styles.bioScrollView}>
        <View style={styles.bioQuestionContainer}>
          <Text style={styles.bioQuestion}>What was the first song you remember loving?</Text>
          <TextInput
            style={styles.bioInput}
            value={formData.bio.firstSong}
            onChangeText={(text) => setFormData(prev => ({
              ...prev,
              bio: { ...prev.bio, firstSong: text }
            }))}
            placeholder="Your answer..."
          />
        </View>

        <View style={styles.bioQuestionContainer}>
          <Text style={styles.bioQuestion}>What's your go-to song when you're feeling down?</Text>
          <TextInput
            style={styles.bioInput}
            value={formData.bio.goToSong}
            onChangeText={(text) => setFormData(prev => ({
              ...prev,
              bio: { ...prev.bio, goToSong: text }
            }))}
            placeholder="Your answer..."
          />
        </View>

        <View style={styles.bioQuestionContainer}>
          <Text style={styles.bioQuestion}>What's one album you think everyone should listen to at least once?</Text>
          <TextInput
            style={styles.bioInput}
            value={formData.bio.mustListenAlbum}
            onChangeText={(text) => setFormData(prev => ({
              ...prev,
              bio: { ...prev.bio, mustListenAlbum: text }
            }))}
            placeholder="Your answer..."
          />
        </View>

        <View style={styles.bioQuestionContainer}>
          <Text style={styles.bioQuestion}>If you could attend any concert in history, which would it be?</Text>
          <TextInput
            style={styles.bioInput}
            value={formData.bio.dreamConcert}
            onChangeText={(text) => setFormData(prev => ({
              ...prev,
              bio: { ...prev.bio, dreamConcert: text }
            }))}
            placeholder="Your answer..."
          />
        </View>

        <View style={styles.bioQuestionContainer}>
          <Text style={styles.bioQuestion}>Describe your music taste in one sentence.</Text>
          <TextInput
            style={styles.bioInput}
            value={formData.bio.musicTaste}
            onChangeText={(text) => setFormData(prev => ({
              ...prev,
              bio: { ...prev.bio, musicTaste: text }
            }))}
            placeholder="Your answer..."
          />
        </View>
      </ScrollView>
    </View>
  );

  // Render premium choice step
  const renderPremiumStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Choose Your Plan</Text>
      <Text style={styles.stepDescription}>Select a plan that best suits your needs</Text>
      
      <View style={styles.premiumOptionsContainer}>
        <TouchableOpacity
          style={[
            styles.premiumOption,
            !formData.isPremium && styles.premiumOptionSelected
          ]}
          onPress={() => setFormData(prev => ({ ...prev, isPremium: false }))}
        >
          <Text style={styles.premiumOptionTitle}>Free</Text>
          <Text style={styles.premiumOptionDescription}>Basic features for music lovers</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.premiumOption,
            formData.isPremium && styles.premiumOptionSelected
          ]}
          onPress={() => setFormData(prev => ({ ...prev, isPremium: true }))}
        >
          <Text style={styles.premiumOptionTitle}>Premium</Text>
          <Text style={styles.premiumOptionDescription}>Enhanced features and exclusive content</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
  // Update the renderCurrentStep to include all steps
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'name':
        return renderNameStep();
      case 'username-email':
        return renderUsernameEmailStep();
      case 'password':
        return renderPasswordStep();
      case 'profile-picture':
        return (
          <View style={styles.stepContainer}>
            {renderProfilePictureStep()}
            <TouchableOpacity
              style={[styles.continueButton, isLoading && styles.continueButtonDisabled]}
              onPress={handleStepSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={APP_CONSTANTS.COLORS.WHITE} size="small" />
              ) : (
                <Text style={styles.continueButtonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      case 'age':
        return (
          <View style={styles.stepContainer}>
            {renderAgeStep()}
            <TouchableOpacity
              style={[styles.continueButton, isLoading && styles.continueButtonDisabled]}
              onPress={handleStepSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={APP_CONSTANTS.COLORS.WHITE} size="small" />
              ) : (
                <Text style={styles.continueButtonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      case 'connect-music':
        return (
          <View style={styles.stepContainer}>
            {renderConnectMusicStep()}
            <TouchableOpacity
              style={[styles.continueButton, isLoading && styles.continueButtonDisabled]}
              onPress={handleStepSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={APP_CONSTANTS.COLORS.WHITE} size="small" />
              ) : (
                <Text style={styles.continueButtonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      case 'bio':
        return (
          <View style={styles.stepContainer}>
            {renderBioStep()}
            <TouchableOpacity
              style={[styles.continueButton, isLoading && styles.continueButtonDisabled]}
              onPress={handleStepSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={APP_CONSTANTS.COLORS.WHITE} size="small" />
              ) : (
                <Text style={styles.continueButtonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      case 'premium':
        return (
          <View style={styles.stepContainer}>
            {renderPremiumStep()}
            <TouchableOpacity
              style={[styles.continueButton, isLoading && styles.continueButtonDisabled]}
              onPress={handleStepSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={APP_CONSTANTS.COLORS.WHITE} size="small" />
              ) : (
                <Text style={styles.continueButtonText}>Complete Profile</Text>
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
              if (currentStep === 'name') {
                navigation.goBack();
              } else {
                // Go back to previous step
                const steps: Step[] = ['name', 'username-email', 'password', 'profile-picture', 'age', 'connect-music', 'bio', 'premium'];
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
                currentStep === 'password' ? styles.stepIndicatorActive : {}
              ]} 
            />
            <View 
              style={[
                styles.stepIndicator, 
                currentStep === 'profile-picture' ? styles.stepIndicatorActive : {}
              ]} 
            />
            <View 
              style={[
                styles.stepIndicator, 
                currentStep === 'age' ? styles.stepIndicatorActive : {}
              ]} 
            />
            <View 
              style={[
                styles.stepIndicator, 
                currentStep === 'connect-music' ? styles.stepIndicatorActive : {}
              ]} 
            />
            <View 
              style={[
                styles.stepIndicator, 
                currentStep === 'bio' ? styles.stepIndicatorActive : {}
              ]} 
            />
            <View 
              style={[
                styles.stepIndicator, 
                currentStep === 'premium' ? styles.stepIndicatorActive : {}
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
  profilePictureContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  profilePicture: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 20,
  },
  profilePicturePlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadButton: {
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  uploadButtonText: {
    color: APP_CONSTANTS.COLORS.WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  musicPlatformsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
  },
  platformButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}20`,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 5,
  },
  platformButtonSelected: {
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
  },
  platformButtonText: {
    color: APP_CONSTANTS.COLORS.PRIMARY,
    fontSize: 14,
    textAlign: 'center',
  },
  platformButtonTextSelected: {
    color: APP_CONSTANTS.COLORS.WHITE,
  },
  bioScrollView: {
    flex: 1,
    marginTop: 20,
  },
  bioQuestionContainer: {
    marginBottom: 20,
  },
  bioQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONSTANTS.COLORS.PRIMARY,
    marginBottom: 8,
  },
  bioInput: {
    borderWidth: 1,
    borderColor: `${APP_CONSTANTS.COLORS.PRIMARY}40`,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  premiumOptionsContainer: {
    marginTop: 20,
    gap: 15,
  },
  premiumOption: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}20`,
  },
  premiumOptionSelected: {
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
  },
  premiumOptionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: APP_CONSTANTS.COLORS.PRIMARY,
    marginBottom: 8,
  },
  premiumOptionDescription: {
    fontSize: 14,
    color: APP_CONSTANTS.COLORS.PRIMARY,
  },
  stepDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    marginBottom: 20,
  },
});

export default MusicLoverSignUpFlow; 