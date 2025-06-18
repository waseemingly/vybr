import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';
import { APP_CONSTANTS } from '@/config/constants';

// Props for login screen - can be music lover or organizer
interface LoginScreenProps {
  userType: 'music_lover' | 'organizer';
}

const LoginScreen: React.FC<LoginScreenProps> = ({ userType }) => {
  const navigation = useNavigation();
  const { signInWithGoogle, updateUserMetadata } = useAuth();
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    try {
      setError('');
      setIsLoading(true);
      
      console.log(`[LoginScreen] Starting Google Sign-In for ${userType}...`);
      const result = await signInWithGoogle();
      
      if ('error' in result) {
        // Check for cancellation
        if ((result.error as any)?.cancelled) {
          console.log('[LoginScreen] Google Sign-In was cancelled by the user.');
          return;
        }
        console.error('[LoginScreen] Google Sign-In error:', result.error);
        setError(result.error.message || 'Failed to sign in with Google');
        return;
      }
      
      if ('user' in result && result.user) {
        // Ensure user type is set correctly
        await updateUserMetadata(userType);
        console.log(`[LoginScreen] Google Sign-In successful, user type set to ${userType}`);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const getTitle = () => {
    return userType === 'music_lover' ? 'Music Lover Login' : 'Organizer Login';
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[`${APP_CONSTANTS.COLORS.PRIMARY}05`, 'white']}
        style={styles.gradient}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>vybr</Text>
          </View>
          
          <View style={styles.contentContainer}>
            <Text style={styles.title}>{getTitle()}</Text>
            
            <View style={styles.formContainer}>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              
              <TouchableOpacity
                style={styles.googleSignInButton}
                onPress={handleGoogleSignIn}
                disabled={isLoading}
              >
                <View style={styles.googleButtonContent}>
                  <Feather name="mail" size={20} color="#4285F4" style={styles.googleIcon} />
                  <Text style={styles.googleSignInText}>Sign in with Google</Text>
                </View>
              </TouchableOpacity>
              
              <Text style={styles.infoText}>
                We use Google for secure authentication. Your email will be used to create your account and for important notifications.
              </Text>
              
              {isLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
                  <Text style={styles.loadingText}>Signing in...</Text>
                </View>
              )}
              
              <View style={styles.signupContainer}>
                <Text style={styles.signupText}>Don't have an account? </Text>
                <TouchableOpacity
                  onPress={() => {
                    if (userType === 'music_lover') {
                      navigation.navigate('MusicLoverSignUpFlow' as never);
                    } else {
                      navigation.navigate('OrganizerSignUpFlow' as never);
                    }
                  }}
                >
                  <Text style={styles.signupLink}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backButton: {
    padding: 4,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: APP_CONSTANTS.COLORS.PRIMARY,
    fontFamily: 'SF Pro Display, Inter, sans-serif',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    marginBottom: 32,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    alignItems: 'center',
  },
  errorText: {
    color: APP_CONSTANTS.COLORS.ERROR,
    marginBottom: 16,
    textAlign: 'center',
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
    width: '100%',
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
  infoText: {
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    fontSize: 14,
    marginTop: 10,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  loadingText: {
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    fontSize: 14,
    marginLeft: 10,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signupText: {
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    fontSize: 14,
  },
  signupLink: {
    color: APP_CONSTANTS.COLORS.PRIMARY,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LoginScreen; 