import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useStripe, PaymentSheet } from '../../lib/stripe';
import { useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { APP_CONSTANTS } from '@/config/constants';
import { useAuth } from '@/hooks/useAuth';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { MainStackParamList, RootStackParamList } from '@/navigation/AppNavigator';

type PremiumSignupScreenRouteProp = RouteProp<MainStackParamList, 'PremiumSignupScreen'>;
type PremiumSignupNavigationProp = NavigationProp<RootStackParamList>;

const PREMIUM_PLAN_PRICE_ID = 'price_1ROtS1DHMm6OC3yQAkqDjUWd';

const PremiumSignupScreen = () => {
  const [loading, setLoading] = useState(false);
  const [paymentInProgress, setPaymentInProgress] = useState(false);

  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const navigation = useNavigation<PremiumSignupNavigationProp>();
  const route = useRoute<PremiumSignupScreenRouteProp>();
  const { userEmail, userId } = route.params;
  const { updatePremiumStatus } = useAuth();

  const fetchPaymentSheetParams = async () => {
    setLoading(true);
    console.log('[PremiumSignupScreen] Fetching payment sheet params...');
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: JSON.stringify({
          priceId: PREMIUM_PLAN_PRICE_ID,
          userId,
          userEmail,
        }),
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Failed to create payment session. Please try again.');
      }

      if (!data || !data.paymentIntentClientSecret || !data.ephemeralKey || !data.customerId) {
        console.error('Invalid response from Supabase function:', data);
        throw new Error('Invalid response from payment service. Please try again.');
      }
      console.log('[PremiumSignupScreen] Payment sheet params received:', data);
      return data;

    } catch (err: any) {
      console.error('Error in fetchPaymentSheetParams:', err);
      Alert.alert('Error', `Could not prepare payment: ${err.message}`);
      setLoading(false);
      return null;
    }
  };

  const initializeAndPresentPaymentSheet = async () => {
    const params = await fetchPaymentSheetParams();
    if (!params) {
      setLoading(false);
      return;
    }

    const { paymentIntentClientSecret, ephemeralKey, customerId } = params;

    const { error: initError } = await initPaymentSheet({
      merchantDisplayName: 'VYBR',
      customerId: customerId,
      customerEphemeralKeySecret: ephemeralKey,
      paymentIntentClientSecret: paymentIntentClientSecret,
      allowsDelayedPaymentMethods: true,
      returnURL: 'vybr://stripe-redirect',
    });

    setLoading(false);

    if (initError) {
      console.error('Payment sheet initialization error:', initError);
      Alert.alert('Error', `Failed to initialize payment: ${initError.message}. Please try again.`);
      return;
    }

    console.log('[PremiumSignupScreen] Payment sheet initialized. Presenting...');
    setPaymentInProgress(true);
    const { error: presentError } = await presentPaymentSheet();
    setPaymentInProgress(false);

    if (presentError) {
      if (presentError.code === 'Canceled') {
        Alert.alert('Payment Canceled', 'The payment process was canceled.');
      } else {
        console.error('Payment sheet presentation error:', presentError);
        Alert.alert('Payment Error', `Payment failed: ${presentError.message}. Please try again.`);
      }
    } else {
      Alert.alert('Payment Successful!', 'Your premium subscription is now active.');
      console.log('[PremiumSignupScreen] Payment successful. Updating premium status...');
      const result = await updatePremiumStatus(userId, true);
      if ('error' in result && result.error) {
        console.error('Premium status update error:', result.error);
        Alert.alert('Warning', 'Payment successful but there was an issue auto-updating your status. It will update shortly. If not, please contact support.');
      }

      navigation.reset({
        index: 0,
        routes: [{ name: 'MainApp', params: { screen: 'UserTabs', params: { screen: 'Profile', params: { paymentSuccess: true }} } }],
      });
    }
  };

  useEffect(() => {
    initializeAndPresentPaymentSheet();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Premium Subscription</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContentCenter}>
        {loading && (
          <>
            <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
            <Text style={styles.loadingText}>Preparing secure payment...</Text>
          </>
        )}
        {paymentInProgress && !loading && (
           <>
             <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
             <Text style={styles.loadingText}>Processing your payment...</Text>
           </>
        )}
        {!loading && !paymentInProgress && (
          <>
            <Feather name="alert-circle" size={48} color={APP_CONSTANTS.COLORS.WARNING} style={{marginBottom: 20}}/>
            <Text style={styles.title}>Payment Initialization Failed</Text>
            <Text style={styles.description}>
              We couldn't prepare the payment screen. This might be a temporary issue.
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={initializeAndPresentPaymentSheet}
            >
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => navigation.goBack()}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: APP_CONSTANTS.COLORS.BORDER_LIGHT,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
  },
  content: {
    flex: 1,
  },
  scrollContentCenter: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
  },
  button: {
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND_LIGHT,
    borderWidth: 1,
    borderColor: APP_CONSTANTS.COLORS.BORDER,
  },
  cancelButtonText: {
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
  },
});

export default PremiumSignupScreen;