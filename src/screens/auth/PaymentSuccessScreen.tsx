import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { APP_CONSTANTS } from '@/config/constants';

const PaymentSuccessScreen = () => {
  const navigation = useNavigation();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainApp', params: { screen: 'UserTabs' } }],
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment Successful!</Text>
      <Text style={styles.message}>
        Thank you for upgrading to Premium. Your account has been activated.
      </Text>
      <Text style={styles.subMessage}>
        Redirecting you to the app...
      </Text>
      <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} style={styles.loader} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: APP_CONSTANTS.COLORS.PRIMARY,
    marginBottom: 20,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 10,
  },
  subMessage: {
    fontSize: 14,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 30,
  },
  loader: {
    marginTop: 20,
  },
});

export default PaymentSuccessScreen; 