import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { APP_CONSTANTS } from '@/config/constants';

const SignUpScreen = () => {
  const navigation = useNavigation();

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

  // Show privacy policy
  const showPrivacyPolicy = () => {
    Alert.alert(
      'Privacy Policy',
      'vybr is committed to protecting your privacy:\n\n' +
      '1. We collect data about your music preferences\n' +
      '2. We use this data to match you with compatible users\n' +
      '3. We do not sell your personal information\n' +
      '4. You can request deletion of your data at any time\n' +
      '5. We use industry-standard security measures\n\n' +
      'For the full privacy policy, please visit our website.'
    );
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
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
          </TouchableOpacity>

          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>vybr</Text>
            <Text style={styles.screenTitle}>Sign Up as Music Lover</Text>
          </View>

          <Text style={styles.welcomeText}>
            Welcome to vybr! Let's set up your profile and connect your music preferences.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.button}
              onPress={() => navigation.navigate('MusicLoverSignUpFlow' as never)}
            >
              <Feather name="chevron-right" size={22} color="white" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Start Sign Up Process</Text>
            </TouchableOpacity>
            
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('MusicLoverLogin' as never)}>
                <Text style={styles.loginLink}>Log In</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By signing up, you agree to our{' '}
              <Text style={styles.termsLink} onPress={showTermsAndConditions}>Terms of Service</Text> and{' '}
              <Text style={styles.termsLink} onPress={showPrivacyPolicy}>Privacy Policy</Text>.
            </Text>
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
    padding: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: APP_CONSTANTS.COLORS.PRIMARY,
    fontFamily: 'SF Pro Display, Inter, sans-serif',
  },
  screenTitle: {
    fontSize: 22,
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    marginTop: 8,
    fontWeight: '600',
    fontFamily: 'Inter, sans-serif',
  },
  welcomeText: {
    fontSize: 16,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 40,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  buttonIcon: {
    marginRight: 12,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginText: {
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    fontSize: 16,
  },
  loginLink: {
    color: APP_CONSTANTS.COLORS.PRIMARY,
    fontWeight: '600',
    fontSize: 16,
  },
  termsContainer: {
    marginTop: 'auto',
    paddingTop: 20,
    alignItems: 'center',
  },
  termsText: {
    fontSize: 14,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },
  termsLink: {
    color: APP_CONSTANTS.COLORS.PRIMARY,
    textDecorationLine: 'underline',
  },
});

export default SignUpScreen; 