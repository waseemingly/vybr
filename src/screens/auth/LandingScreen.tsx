import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { APP_CONSTANTS } from '@/config/constants';

const LandingScreen = () => {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[`${APP_CONSTANTS.COLORS.PRIMARY}05`, 'white']}
        style={styles.gradient}
      >
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>vybr</Text>
        </View>

        <Text style={styles.subtitle}>{APP_CONSTANTS.CONFIG.APP_SLOGAN}</Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.button}
            onPress={() => navigation.navigate('MusicLoverLogin')}
          >
            <Feather 
              name="music" 
              size={24} 
              color={APP_CONSTANTS.COLORS.PRIMARY} 
              style={styles.buttonIcon} 
            />
            <Text style={styles.buttonText}>Log in as Music Lover</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.button}
            onPress={() => navigation.navigate('OrganizerLogin')}
          >
            <Feather 
              name="calendar" 
              size={24} 
              color={APP_CONSTANTS.COLORS.PRIMARY} 
              style={styles.buttonIcon} 
            />
            <Text style={styles.buttonText}>Log in as Organiser</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.signupLinksContainer}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('MusicLoverSignUp')}
          >
            <Text style={styles.signupLink}>Sign up as music lover</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => navigation.navigate('OrganizerSignUp')}
          >
            <Text style={styles.signupLink}>Sign up as organiser</Text>
          </TouchableOpacity>
        </View>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  logoText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: APP_CONSTANTS.COLORS.PRIMARY,
    marginTop: 10,
    fontFamily: 'SF Pro Display, Inter, sans-serif',
  },
  subtitle: {
    fontSize: 18,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    marginBottom: 60,
    fontFamily: 'Inter, sans-serif',
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
    backgroundColor: 'white',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
  },
  buttonIcon: {
    marginRight: 12,
  },
  signupLinksContainer: {
    alignItems: 'center',
  },
  signupLink: {
    fontSize: 16,
    color: APP_CONSTANTS.COLORS.PRIMARY,
    textDecorationLine: 'underline',
    marginBottom: 12,
    fontWeight: '500',
  },
});

export default LandingScreen; 