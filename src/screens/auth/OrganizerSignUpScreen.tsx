import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { APP_CONSTANTS } from '@/config/constants';

const OrganizerSignUpScreen = () => {
  const navigation = useNavigation();

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
            <Text style={styles.screenTitle}>Sign Up as Event Organizer</Text>
          </View>

          <Text style={styles.welcomeText}>
            Join vybr to promote your events, venues, and connect with music lovers in your area.
          </Text>

          <View style={styles.infoContainer}>
            <View style={styles.infoItem}>
              <Feather name="dollar-sign" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} style={styles.infoIcon} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>Ticket Sales</Text>
                <Text style={styles.infoDescription}>
                  {APP_CONSTANTS.BUSINESS.TICKET_COST_PERCENTAGE}% fee on all ticket sales
                </Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <Feather name="users" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} style={styles.infoIcon} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>Dinner Reservations</Text>
                <Text style={styles.infoDescription}>
                  ${APP_CONSTANTS.BUSINESS.DINER_COST_FIXED} fee per diner
                </Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <Feather name="trending-up" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} style={styles.infoIcon} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>Advertising Impressions</Text>
                <Text style={styles.infoDescription}>
                  ${APP_CONSTANTS.BUSINESS.ADVERTISING_COST_PER_IMPRESSION} per impression
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.button}
              onPress={() => navigation.navigate('OrganizerSignUpFlow' as never)}
            >
              <Feather name="chevron-right" size={22} color="white" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Start Sign Up Process</Text>
            </TouchableOpacity>
            
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('OrganizerLogin' as never)}>
                <Text style={styles.loginLink}>Log In</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By signing up, you agree to our{' '}
              <Text 
                style={styles.termsLink}
                onPress={showTermsAndConditions}
              >
                Terms of Service
              </Text>
              {' '}including payment and fee agreements.
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
    marginBottom: 30,
  },
  infoContainer: {
    width: '100%',
    marginBottom: 30,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  infoIcon: {
    marginRight: 16,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 14,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
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

export default OrganizerSignUpScreen; 