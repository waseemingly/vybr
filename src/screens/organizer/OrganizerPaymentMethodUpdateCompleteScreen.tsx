// src/screens/OrganizerPaymentMethodUpdateCompleteScreen.tsx
// This component is very similar to the one for signup flow.
// It handles the redirect back from Stripe after a web-based card setup/update attempt.
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { loadStripe } from '@stripe/stripe-js';
import { APP_CONSTANTS } from '../../config/constants';
import { useAuth } from '../../hooks/useAuth';
import { Feather } from '@expo/vector-icons';
import type { RootStackParamList } from '../../navigation/AppNavigator'; // Adjust path

const STRIPE_PUBLISHABLE_KEY_WEB = "pk_test_51RDGZpDHMm6OC3yQwI460w1bESyWDQoSdNLBU9TOhciyc7NlbJ5upgCTJsP6OAuYt8cUeywcbkwQGCBI7VDCMNuz00qld2OSdN"; // Same as before
const stripePromise = Platform.OS === 'web' ? loadStripe(STRIPE_PUBLISHABLE_KEY_WEB) : null;

type NavProp = NavigationProp<RootStackParamList>;

const OrganizerPaymentMethodUpdateCompleteScreen = () => {
  const navigation = useNavigation<NavProp>();
  const [status, setStatus] = useState<'loading' | 'succeeded' | 'failed' | 'processing'>('loading');
  const [message, setMessage] = useState('Processing payment method update...');
  const { refreshUserProfile } = useAuth();

  useEffect(() => {
    if (Platform.OS !== 'web' || !stripePromise) return;

    const processSetupIntent = async () => {
      const stripe = await stripePromise;
      if (!stripe) { /* ... handle Stripe.js not loaded ... */ return; }

      const clientSecret = new URLSearchParams(window.location.search).get('setup_intent_client_secret');
      if (!clientSecret) { /* ... handle missing clientSecret ... */ return; }

      setStatus('processing');
      const { error, setupIntent } = await stripe.retrieveSetupIntent(clientSecret);

      if (error) {
        setMessage(error.message || 'Error retrieving setup status.');
        setStatus('failed');
      } else if (setupIntent) {
        switch (setupIntent.status) {
          case 'succeeded':
            setMessage('Payment method updated successfully!');
            setStatus('succeeded');
            if (refreshUserProfile) await refreshUserProfile(); // Refresh auth state
            setTimeout(() => {
              // Navigate back to manage plan screen or profile
              navigation.navigate('ManagePlanScreen' as never); // Or your manage plan screen name
            }, 2000);
            break;
          // ... other cases similar to OrganizerPaymentSetupCompleteScreen ...
          default:
            setMessage(`Update status: ${setupIntent.status}.`);
            setStatus('failed');
            break;
        }
      } else { /* ... handle no setupIntent ... */ }
    };
    processSetupIntent();
  }, [stripePromise, navigation, refreshUserProfile]);

  return (
    <View style={styles.container}>
      {/* ... UI similar to OrganizerPaymentSetupCompleteScreen ... */}
      <ActivityIndicator size="large" animating={status === 'loading' || status === 'processing'} />
      <Text style={styles.messageText}>{message}</Text>
      <TouchableOpacity onPress={() => navigation.navigate('ManagePlanScreen' as never)}>
          <Text>Back to Manage Plan</Text>
      </TouchableOpacity>
    </View>
  );
};
const styles = StyleSheet.create({ /* ... (Styles similar to other confirmation screens) ... */
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    messageText: { fontSize: 18, textAlign: 'center', marginVertical: 20 },
});
export default OrganizerPaymentMethodUpdateCompleteScreen;