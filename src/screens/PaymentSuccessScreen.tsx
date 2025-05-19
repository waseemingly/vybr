// src/screens/PaymentSuccessScreen.tsx
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { APP_CONSTANTS } from '@/config/constants';

const PaymentSuccessScreen = () => {
  const navigation = useNavigation();

  useEffect(() => {
    // Automatically navigate to matches screen after 3 seconds
    const timer = setTimeout(() => {
      navigation.navigate('MatchesScreen');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment Successful!</Text>
      <Text style={styles.description}>
        Welcome to VYBR Premium! You now have access to all premium features.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('MatchesScreen')}
      >
        <Text style={styles.buttonText}>Continue to Matches</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000000',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666666',
  },
  button: {
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PaymentSuccessScreen;