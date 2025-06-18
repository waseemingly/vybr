import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';

const OrganizerLoginScreen = () => {
  const navigation = useNavigation();
  const { signInWithGoogle, updateUserMetadata } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      console.log('[OrganizerLoginScreen] Starting Google Sign-In...');
      const result = await signInWithGoogle();
      
      if ('error' in result) {
        // Check for cancellation
        if ((result.error as any)?.cancelled) {
          console.log('[OrganizerLoginScreen] Google Sign-In was cancelled by the user.');
          return;
        }
        console.error('[OrganizerLoginScreen] Google Sign-In error:', result.error);
        setError(result.error.message || 'Failed to sign in with Google');
        Alert.alert('Sign-In Failed', result.error.message || 'Failed to sign in with Google');
        return;
      }
      
      if ('user' in result && result.user) {
        // Ensure user type is set to organizer
        await updateUserMetadata('organizer');
        console.log('[OrganizerLoginScreen] Google Sign-In successful, user type set to organizer');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['rgba(59, 130, 246, 0.05)', 'white']}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={24} color="#3B82F6" />
          </TouchableOpacity>

          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>vybr</Text>
            <Text style={styles.screenTitle}>Organiser Login</Text>
          </View>

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
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Signing in...</Text>
              </View>
            )}

            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('OrganizerSignUpFlow' as never)}>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
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
    backgroundColor: 'white',
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#3B82F6',
    fontFamily: 'SF Pro Display, Inter, sans-serif',
  },
  screenTitle: {
    fontSize: 22,
    color: '#0F172A',
    marginTop: 8,
    fontWeight: '600',
    fontFamily: 'Inter, sans-serif',
  },
  formContainer: {
    width: '100%',
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
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
    color: '#64748B',
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
    color: '#64748B',
    fontSize: 14,
    marginLeft: 10,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signupText: {
    color: '#64748B',
    fontSize: 16,
  },
  signupLink: {
    color: '#3B82F6',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default OrganizerLoginScreen; 