import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { APP_CONSTANTS } from '@/config/constants';
import { useAuth } from '@/hooks/useAuth';
import type { MainStackParamList } from '@/navigation/AppNavigator';

type SubscriptionConfirmationRouteProp = RouteProp<MainStackParamList, 'SubscriptionConfirmation'>;

const SubscriptionConfirmationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<SubscriptionConfirmationRouteProp>();
  const { status, session_id } = route.params || {};
  const [isLoading, setIsLoading] = useState(true);
  const { session } = useAuth();

  useEffect(() => {
    // Verify subscription status
    const checkSubscription = async () => {
      try {
        setIsLoading(true);
        
        // Wait briefly to ensure webhook has processed
        setTimeout(() => {
          setIsLoading(false);
        }, 2000);
        
      } catch (error) {
        console.error('[SubscriptionConfirmation] Error:', error);
        setIsLoading(false);
      }
    };

    checkSubscription();
  }, [status, session_id]);

  const handleContinue = () => {
    // Navigate to the main app
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainApp', params: { screen: 'UserTabs' } }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Confirming your subscription...</Text>
        </View>
      ) : status === 'success' ? (
        <View style={styles.contentContainer}>
          <View style={styles.iconContainer}>
            <Feather name="check-circle" size={80} color={APP_CONSTANTS.COLORS.SUCCESS} />
          </View>
          <Text style={styles.title}>Subscription Confirmed!</Text>
          <Text style={styles.message}>
            Thank you for subscribing to Vybr Premium! Your account has been upgraded.
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleContinue}>
            <Text style={styles.buttonText}>Continue to App</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.contentContainer}>
          <View style={styles.iconContainer}>
            <Feather name="alert-circle" size={80} color={APP_CONSTANTS.COLORS.WARNING} />
          </View>
          <Text style={styles.title}>Subscription Incomplete</Text>
          <Text style={styles.message}>
            Your subscription process wasn't completed. You can try again later from your profile.
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleContinue}>
            <Text style={styles.buttonText}>Continue to App</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  button: {
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SubscriptionConfirmationScreen;