import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';
import { APP_CONSTANTS } from '@/config/constants';
import { authStyles } from '@/styles/authStyles';

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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={authStyles.container}>
      <LinearGradient
        colors={[
          `${APP_CONSTANTS.COLORS.PRIMARY}08`,
          `${APP_CONSTANTS.COLORS.PRIMARY}03`,
          'white'
        ]}
        style={authStyles.gradient}
      >
        {/* Decorative background elements */}
        <View style={authStyles.decorativeCircle1} />
        <View style={authStyles.decorativeCircle2} />
        <View style={authStyles.decorativeCircle3} />
        {Platform.OS === 'web' && <View style={authStyles.decorativeCircle4} />}
        {Platform.OS === 'web' && <View style={authStyles.decorativeCircle5} />}

        {/* Back button positioned outside main container */}
        <TouchableOpacity 
          style={{ 
            position: 'absolute',
            top: Platform.OS === 'web' ? 40 : 20,
            left: Platform.OS === 'web' ? 40 : 20,
            padding: Platform.OS === 'web' ? 12 : 10,
            borderRadius: Platform.OS === 'web' ? 12 : 10,
            backgroundColor: 'white',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: Platform.OS === 'web' ? 4 : 2 },
            shadowOpacity: 0.1,
            shadowRadius: Platform.OS === 'web' ? 8 : 4,
            elevation: 3,
            zIndex: 10,
            borderWidth: 1,
            borderColor: APP_CONSTANTS.COLORS.BORDER_LIGHT,
          }}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={Platform.OS === 'web' ? 24 : 20} color={APP_CONSTANTS.COLORS.PRIMARY} />
        </TouchableOpacity>

        {/* Main content container - centered like landing screen */}
        <View style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: Platform.OS === 'web' ? 40 : 20,
          paddingVertical: Platform.OS === 'web' ? 60 : 16,
        }}>
          {/* Logo Section - positioned at same location as landing screen */}
          <View style={{
            alignItems: 'center',
            marginBottom: Platform.OS === 'web' ? 48 : 28,
            marginTop: Platform.OS === 'web' ? 40 : 0,
          }}>
            <View style={authStyles.logoBackground}>
              <Text style={authStyles.logoText}>vybr</Text>
            </View>
            <Text style={authStyles.tagline}>Where music meets connection</Text>
          </View>

          {/* Content - centered and properly spaced */}
          <View style={{ 
            width: '100%', 
            alignItems: 'center',
            maxWidth: Platform.OS === 'web' ? 600 : '100%',
          }}>
            <Text style={authStyles.title}>Welcome Back</Text>
            <Text style={authStyles.subtitle}>Sign in to manage your events and connect with attendees</Text>
            
            {/* User Type Badge */}
            <View style={{
              backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}10`,
              paddingHorizontal: Platform.OS === 'web' ? 16 : 10,
              paddingVertical: Platform.OS === 'web' ? 6 : 3,
              borderRadius: Platform.OS === 'web' ? 16 : 10,
              marginBottom: Platform.OS === 'web' ? 32 : 20,
              borderWidth: 1,
              borderColor: `${APP_CONSTANTS.COLORS.PRIMARY}20`,
            }}>
              <Text style={{
                fontSize: Platform.OS === 'web' ? 12 : 9,
                fontWeight: '700',
                color: APP_CONSTANTS.COLORS.PRIMARY,
                fontFamily: 'Inter, sans-serif',
              }}>
                Event Organizer
              </Text>
            </View>
            
            <View style={{ width: '100%', alignItems: 'center', paddingHorizontal: Platform.OS === 'web' ? 0 : 12 }}>
              {error ? (
                <View style={{
                  backgroundColor: `${APP_CONSTANTS.COLORS.ERROR}10`,
                  borderWidth: 1,
                  borderColor: `${APP_CONSTANTS.COLORS.ERROR}20`,
                  borderRadius: Platform.OS === 'web' ? 10 : 8,
                  padding: Platform.OS === 'web' ? 12 : 10,
                  marginBottom: Platform.OS === 'web' ? 20 : 16,
                  width: '100%',
                }}>
                  <Text style={authStyles.errorText}>{error}</Text>
                </View>
              ) : null}
            
            <TouchableOpacity
                style={[
                  authStyles.button, 
                  isLoading && authStyles.disabledButton,
                  {
                    backgroundColor: 'white',
                    borderWidth: 1,
                    borderColor: APP_CONSTANTS.COLORS.BORDER_LIGHT,
                    marginBottom: Platform.OS === 'web' ? 20 : 16,
                  }
                ]}
              onPress={handleGoogleSignIn}
              disabled={isLoading}
                activeOpacity={0.8}
            >
                <View style={authStyles.buttonContent}>
                  <View style={authStyles.buttonIconContainer}>
                    <Feather name="mail" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
                  </View>
                  <View style={[authStyles.buttonTextContainer, { flex: 1, minWidth: 0 }]}>
                    <Text style={authStyles.buttonTitle} numberOfLines={1}>Continue with Google</Text>
                    <Text style={authStyles.buttonSubtitle} numberOfLines={1}>Secure authentication</Text>
                  </View>
                  <Feather 
                    name="chevron-right" 
                    size={20} 
                    color={APP_CONSTANTS.COLORS.TEXT_SECONDARY} 
                  />
              </View>
            </TouchableOpacity>
            
              <Text style={{
                color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
                fontSize: Platform.OS === 'web' ? 12 : 10,
                textAlign: 'center',
                paddingHorizontal: Platform.OS === 'web' ? 20 : 12,
                lineHeight: Platform.OS === 'web' ? 16 : 14,
                fontFamily: 'Inter, sans-serif',
                fontWeight: '400',
              }}>
              We use Google for secure authentication. Your email will be used to create your account and for important notifications.
            </Text>
            
            {isLoading && (
                <View style={authStyles.loadingContainer}>
                  <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
                  <Text style={authStyles.loadingText}>Signing in...</Text>
              </View>
            )}
            </View>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

export default OrganizerLoginScreen; 