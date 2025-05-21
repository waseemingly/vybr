import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp, NavigationProp } from '@react-navigation/native';
import { loadStripe } from '@stripe/stripe-js';
import { APP_CONSTANTS } from '@/config/constants';
import { useAuth } from '@/hooks/useAuth';
import { Feather } from '@expo/vector-icons';
import type { RootStackParamList } from '@/navigation/AppNavigator';

const STRIPE_PUBLISHABLE_KEY_WEB = 'pk_test_51RDGZpDHMm6OC3yQwI460w1bESyWDQoSdNLBU9TOhciyc7NlbJ5upgCTJsP6OAuYt8cUeywcbkwQGCBI7VDCMNuz00qld2OSdN';
const stripePromise = Platform.OS === 'web' ? loadStripe(STRIPE_PUBLISHABLE_KEY_WEB) : null;

type PaymentConfirmationScreenRouteProp = RouteProp<RootStackParamList, 'PaymentConfirmationScreen'>;
type PaymentConfirmationScreenNavigationProp = NavigationProp<RootStackParamList>;

const PaymentConfirmationScreen = () => {
  const navigation = useNavigation<PaymentConfirmationScreenNavigationProp>();
  const [status, setStatus] = useState<'loading' | 'succeeded' | 'failed' | 'processing'>('loading');
  const [message, setMessage] = useState('Processing your payment...');
  const { updatePremiumStatus, session } = useAuth();

  useEffect(() => {
    if (Platform.OS !== 'web' || !stripePromise) {
      setMessage('Error: Invalid platform for this confirmation screen.');
      setStatus('failed');
      return;
    }

    const processPaymentIntent = async () => {
      const stripe = await stripePromise;
      if (!stripe) {
        setMessage('Stripe.js not loaded.');
        setStatus('failed');
        return;
      }

      const clientSecret = new URLSearchParams(window.location.search).get(
        'payment_intent_client_secret'
      );

      const paymentIntentId = new URLSearchParams(window.location.search).get(
        'payment_intent'
      );

      if (!clientSecret && !paymentIntentId) {
        setMessage('Payment information not found in URL. Please contact support if payment was made.');
        setStatus('failed');
        return;
      }

      let intentClientSecret = clientSecret;
      if(!intentClientSecret && paymentIntentId) {
        console.warn("payment_intent_client_secret not found directly, only payment_intent ID. Status check might be limited.");
      }

      if (!intentClientSecret) {
         setMessage('Required payment identifier (client_secret) not found.');
         setStatus('failed');
         return;
      }

      setStatus('processing');
      console.log('[PaymentConfirmationScreen] Retrieving PaymentIntent with clientSecret:', intentClientSecret);
      const { error, paymentIntent } = await stripe.retrievePaymentIntent(intentClientSecret);

      if (error) {
        console.error('[PaymentConfirmationScreen] Error retrieving PaymentIntent:', error);
        setMessage(error.message || 'Error retrieving payment status.');
        setStatus('failed');
      } else if (paymentIntent) {
        console.log('[PaymentConfirmationScreen] Retrieved PaymentIntent. Status:', paymentIntent.status);
        switch (paymentIntent.status) {
          case 'succeeded':
            setMessage('Payment successful! Your subscription is being activated.');
            setStatus('succeeded');
            const userId = session?.user?.id;
            if (userId) {
              console.log('[PaymentConfirmationScreen] Updating premium status for user:', userId);
              try {
                  const result = await updatePremiumStatus(userId, true, { preventAutomaticNavigation: true });
                  if ('error' in result && result.error) {
                      console.error('[PaymentConfirmationScreen] Client-side premium update error:', result.error);
                      setMessage('Payment successful! Status update pending. Your access will be granted shortly.');
                  } else {
                      console.log('[PaymentConfirmationScreen] Client-side premium status updated.');
                  }
              } catch (e) {
                  console.error('[PaymentConfirmationScreen] Exception during client-side premium status update:', e);
                  setMessage('Payment successful! Status update error. Your access will be granted shortly.');
              }
            } else {
              console.warn('[PaymentConfirmationScreen] User ID not found in session. Cannot update premium status client-side. Webhook must handle this.');
              setMessage('Payment successful! Account update will process in the background.');
            }
            setTimeout(() => {
              navigation.reset({ index: 0, routes: [{ name: 'MainApp', params: { screen: 'UserTabs', params: { screen: 'Profile' } } }] });
            }, 3000);
            break;
          case 'processing':
            setMessage('Your payment is processing. We will update you shortly.');
            setStatus('processing');
            break;
          case 'requires_payment_method':
             setMessage('Payment failed. Please try a different payment method.');
             setStatus('failed');
             break;
          default:
            setMessage(`Payment status: ${paymentIntent.status}. Please contact support.`);
            setStatus('failed');
            break;
        }
      } else {
        setMessage('Could not retrieve payment details. Please contact support.');
        setStatus('failed');
      }
    };

    processPaymentIntent();
  }, [stripePromise, session, navigation]);

  return (
    <View style={styles.container}>
      {status === 'loading' || status === 'processing' ? (
        <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
      ) : status === 'succeeded' ? (
        <Feather name="check-circle" size={64} color="green" />
      ) : (
        <Feather name="x-circle" size={64} color="red" />
      )}
      <Text style={styles.messageText}>{message}</Text>
      {status === 'failed' && (
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.replace('PremiumSignupScreen', { userId: session?.user?.id, userEmail: session?.user?.email } as any)}
        >
          <Text style={styles.buttonText}>Try Payment Again</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainApp', params: { screen: 'UserTabs', params: { screen: 'Profile' } } }] })}
      >
        <Text style={[styles.buttonText, styles.secondaryButtonText]}>Go to My Profile</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f7f7f7',
  },
  messageText: {
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 20,
    color: '#333',
  },
  button: {
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
    minWidth: 200,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#e0e0e0',
  },
  secondaryButtonText: {
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
  },
});

export default PaymentConfirmationScreen; 