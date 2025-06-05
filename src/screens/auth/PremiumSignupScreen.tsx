import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Platform, GestureResponderEvent
} from 'react-native';
// NATIVE Stripe
import { useStripe as useNativeStripe } from '@stripe/stripe-react-native';

// WEB Stripe
import { loadStripe, StripeElementsOptions, Appearance } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe as useWebStripe, useElements } from '@stripe/react-stripe-js';

import { useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';
import { supabase } from '@/lib/supabase'; // Assuming this is your initialized Supabase client
import { APP_CONSTANTS } from '@/config/constants';
import { useAuth } from '@/hooks/useAuth';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { MainStackParamList, RootStackParamList } from '@/navigation/AppNavigator'; // Adjust paths as needed

type PremiumSignupScreenRouteProp = RouteProp<MainStackParamList, 'PremiumSignupScreen'>;
type PremiumSignupNavigationProp = NavigationProp<RootStackParamList>;

// Replace with your actual Stripe Price ID for the premium plan
const PREMIUM_PLAN_PRICE_ID = 'price_1ROtS1DHMm6OC3yQAkqDjUWd'; // EXAMPLE - USE YOUR ACTUAL PRICE ID
// Replace with your actual Stripe Publishable Key for WEB
const STRIPE_PUBLISHABLE_KEY_WEB = 'pk_test_51RDGZpDHMm6OC3yQwI460w1bESyWDQoSdNLBU9TOhciyc7NlbJ5upgCTJsP6OAuYt8cUeywcbkwQGCBI7VDCMNuz00qld2OSdN'; // EXAMPLE - USE YOUR ACTUAL WEB PUBLISHABLE KEY

const stripePromise = Platform.OS === 'web' ? loadStripe(STRIPE_PUBLISHABLE_KEY_WEB) : null;

// Internal Component for Web Payment Form using Stripe Elements
const StripePaymentFormWeb = ({ clientSecret, onPaymentSuccess, onPaymentError }: { clientSecret: string, onPaymentSuccess: () => void, onPaymentError: (errorMsg: string) => void }) => {
  const stripe = useWebStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[StripePaymentFormWeb] handleSubmit called.');

    if (!stripe || !elements) {
      console.error('[StripePaymentFormWeb] Stripe.js or Elements not loaded yet.');
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    console.log('[StripePaymentFormWeb] Attempting stripe.confirmPayment...');
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-confirmation`,
        },
        redirect: 'if_required',
      });

      if (error) {
        console.error('[StripePaymentFormWeb] confirmPayment immediate error:', error);
        setMessage(error.message || 'An error occurred during payment.');
        onPaymentError(error.message || 'Payment failed');
      } else if (paymentIntent) {
        console.log('[StripePaymentFormWeb] confirmPayment returned paymentIntent. Status:', paymentIntent.status);
        if (paymentIntent.status === 'succeeded') {
          console.log('[StripePaymentFormWeb] Payment Succeeded directly. Calling onPaymentSuccess.');
          onPaymentSuccess();
        } else if (paymentIntent.status === 'requires_action' || paymentIntent.status === 'requires_confirmation') {
          console.log('[StripePaymentFormWeb] Payment requires further action. Stripe should handle redirect.');
          // Stripe will handle the redirect
        } else {
          console.warn(`[StripePaymentFormWeb] PaymentIntent status: ${paymentIntent.status}`);
          setMessage(`Payment status: ${paymentIntent.status}`);
        }
      } else {
        console.log('[StripePaymentFormWeb] Stripe likely redirected. Outcome to be handled on return_url.');
        // Stripe has initiated a redirect, the outcome will be handled on the return_url page
      }
    } catch (e) {
      console.error('[StripePaymentFormWeb] Exception during confirmPayment:', e);
      setMessage('An unexpected error occurred.');
      onPaymentError('An unexpected error occurred');
    } finally {
      setIsProcessing(false);
      console.log('[StripePaymentFormWeb] setIsProcessing(false) in finally block.');
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '500px', margin: '0 auto' }}>
      <PaymentElement
        id="payment-element"
        options={{
          layout: 'tabs',
          defaultValues: {
            billingDetails: {
              name: 'Auto-filled name',
            },
          },
        }}
        onChange={(e) => {
          console.log('[StripePaymentFormWeb] PaymentElement is ready.');
        }}
      />
      <button
        disabled={isProcessing || !stripe || !elements}
        id="submit"
        style={{
          backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '8px',
          border: 'none',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          width: '100%',
          marginTop: '20px',
          opacity: isProcessing ? 0.7 : 1,
        }}
      >
        <span id="button-text">
          {isProcessing ? 'Processing...' : 'Pay now'}
        </span>
      </button>
      {message && (
        <div
          id="payment-message"
          style={{
            color: 'rgb(105, 115, 134)',
            textAlign: 'center',
            fontSize: '16px',
            lineHeight: '20px',
            paddingTop: '12px',
          }}
        >
          {message}
        </div>
      )}
    </form>
  );
};


// Main Screen Component
const PremiumSignupScreen = () => {
  const [uiLoading, setUiLoading] = useState(true); // For fetching payment params initially
  const [paymentInProgressMobile, setPaymentInProgressMobile] = useState(false); // For mobile PaymentSheet active state
  const [paymentParams, setPaymentParams] = useState<any>(null); // Stores { paymentIntentClientSecret, ephemeralKey, customerId }

  const { initPaymentSheet, presentPaymentSheet } = useNativeStripe();
  const navigation = useNavigation<PremiumSignupNavigationProp>();
  const route = useRoute<PremiumSignupScreenRouteProp>();
  const { userEmail, userId } = route.params;
  const { updatePremiumStatus } = useAuth(); // Assuming this hook is correctly set up

  // This function is called after payment is confirmed to be successful
  // - On mobile: after presentPaymentSheet succeeds.
  // - On web (no redirect): after stripe.confirmPayment succeeds directly.
  // - On web (with redirect): THIS FUNCTION IS NOT CALLED HERE. PaymentConfirmationScreen handles it.
  const handlePaymentSuccess = async () => {
    Alert.alert('Payment Successful!', 'Your premium subscription is now active.');
    console.log('[PremiumSignupScreen] Payment successful. Updating premium status for user:', userId);
    try {
      // Update premium status without the third parameter
      const result = await updatePremiumStatus(userId, true);
      if ('error' in result && result.error) {
        console.error('[PremiumSignupScreen] Premium status update client-side error:', result.error);
        Alert.alert('Warning', 'Payment confirmed, but there was an issue with the immediate status update. Your access will be granted shortly. Please check your profile or contact support if needed.');
      } else {
        console.log('[PremiumSignupScreen] Premium status updated client-side.');
      }
    } catch (e: any) {
        console.error('[PremiumSignupScreen] Exception during client-side premium status update:', e);
        Alert.alert('Warning', 'Payment confirmed, but an error occurred during the immediate status update. Your access will be granted shortly.');
    }

    // Navigate to MainApp instead of PaymentSuccessScreen since it's not in RootStackParamList
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainApp' }],
    });
  };

  // Called on payment errors from either mobile or web (non-redirect case)
  const handlePaymentError = (errorMessage: string) => {
    console.error('[PremiumSignupScreen] handlePaymentError called with:', errorMessage);
    Alert.alert('Payment Error', errorMessage);
    // Consider UI changes, like re-enabling a button or showing error inline
  };

  // Fetches parameters from backend and initializes payment UI
  const fetchAndSetupPayment = async () => {
    setUiLoading(true);
    setPaymentParams(null); // Reset previous params
    console.log('[PremiumSignupScreen] Fetching payment parameters...');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('create-checkout-session', {
        body: JSON.stringify({ // Ensure body is stringified if your function expects raw JSON string
          priceId: PREMIUM_PLAN_PRICE_ID,
          userId,
          userEmail,
        }),
      });

      if (invokeError) {
        console.error('Supabase function error during fetch:', invokeError);
        throw new Error(invokeError.message || 'Failed to create payment session. Please try again.');
      }

      if (!data || !data.paymentIntentClientSecret || !data.ephemeralKey || !data.customerId) {
        console.error('Invalid response from Supabase function (missing crucial keys):', data);
        throw new Error('Invalid response from payment service. Crucial data missing.');
      }
      console.log('[PremiumSignupScreen] Payment parameters received:', data);
      setPaymentParams(data); // Store params for both web and mobile

      if (Platform.OS !== 'web') {
        // Mobile Native Payment Sheet Flow
        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: 'VYBR', // Your app/company name
          customerId: data.customerId,
          customerEphemeralKeySecret: data.ephemeralKey,
          paymentIntentClientSecret: data.paymentIntentClientSecret,
          allowsDelayedPaymentMethods: true,
          returnURL: 'vybr://stripe-redirect', // Your app's custom URL scheme for mobile
        });

        if (initError) {
          console.error('[PremiumSignupScreen] initPaymentSheet error:', initError);
          throw initError; // Caught by catch block below
        }
        setUiLoading(false); // Params fetched, sheet initialized for mobile
        console.log('[PremiumSignupScreen] Mobile PaymentSheet initialized. Presenting...');
        setPaymentInProgressMobile(true);
        const { error: presentError } = await presentPaymentSheet();
        setPaymentInProgressMobile(false);

        if (presentError) {
          if (presentError.code === 'Canceled') {
            Alert.alert('Payment Canceled', 'The payment process was canceled by you.');
            navigation.goBack(); // Go back if canceled
          } else {
            console.error('[PremiumSignupScreen] presentPaymentSheet error:', presentError);
            throw presentError; // Caught by catch block
          }
        } else {
          // Mobile payment successful
          console.log('[PremiumSignupScreen] Mobile payment successful via PaymentSheet.');
          await handlePaymentSuccess();
        }
      } else {
        // Web flow: params are set. The UI will re-render with <Elements>
        setUiLoading(false);
        console.log('[PremiumSignupScreen] Payment params set for web. Elements will render.');
      }

    } catch (err: any) {
      console.error('[PremiumSignupScreen] Error in fetchAndSetupPayment:', err);
      Alert.alert('Payment Setup Error', `Could not prepare payment: ${err.message || 'Unknown error'}. Please try again.`);
      setUiLoading(false);
      setPaymentParams(null); // Clear params on error to show setup failed UI
    }
  };

  useEffect(() => {
    fetchAndSetupPayment();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Options for Stripe Elements on the Web
  const appearance: Appearance = { theme: 'stripe' /* or 'night', 'flat', etc. */ };
  const elementsOptions: StripeElementsOptions | undefined =
    (Platform.OS === 'web' && paymentParams && paymentParams.paymentIntentClientSecret) ? {
      clientSecret: paymentParams.paymentIntentClientSecret,
      appearance,
      // loader: 'always', // You can control Stripe's built-in loader for Elements
    } : undefined;


  // --- Render Logic ---

  // 1. Initial Loading State (while fetching params)
  if (uiLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} /></TouchableOpacity>
            <Text style={styles.headerTitle}>Premium Subscription</Text><View style={{ width: 32 }} />
        </View>
        <View style={styles.scrollContentCenter}>
          <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Preparing secure payment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 2. Mobile: Payment Sheet is active
  if (Platform.OS !== 'web' && paymentInProgressMobile) {
     return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} /></TouchableOpacity>
            <Text style={styles.headerTitle}>Premium Subscription</Text><View style={{ width: 32 }} />
        </View>
        <View style={styles.scrollContentCenter}>
          <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Processing your payment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 3. Setup Failed State (if paymentParams are still null after uiLoading is false)
  if (!paymentParams) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Premium Subscription</Text><View style={{ width: 32 }} />
        </View>
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContentCenter}>
          <Feather name="alert-circle" size={48} color={APP_CONSTANTS.COLORS.WARNING} style={{marginBottom: 20}}/>
          <Text style={styles.title}>Payment Setup Failed</Text>
          <Text style={styles.description}>
            We couldn't prepare the payment screen. This might be a temporary issue or a configuration problem.
          </Text>
          <TouchableOpacity style={styles.button} onPress={fetchAndSetupPayment}><Text style={styles.buttonText}>Try Again</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => navigation.goBack()}><Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text></TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 4. Web: Render Stripe Elements Form
  if (Platform.OS === 'web') {
    if (!stripePromise || !elementsOptions) { // Should not happen if paymentParams are set
        return (
             <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} /></TouchableOpacity>
                    <Text style={styles.headerTitle}>Premium Subscription</Text><View style={{ width: 32 }} />
                </View>
                <ScrollView style={styles.content} contentContainerStyle={styles.scrollContentCenter}>
                    <Feather name="alert-circle" size={48} color={APP_CONSTANTS.COLORS.WARNING} style={{marginBottom: 20}}/>
                    <Text style={styles.title}>Payment Form Error</Text>
                    <Text style={styles.description}>The payment form could not be loaded. Please ensure Stripe is configured correctly or try again.</Text>
                    <TouchableOpacity style={styles.button} onPress={fetchAndSetupPayment}><Text style={styles.buttonText}>Retry Setup</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => navigation.goBack()}><Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text></TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        );
    }
    // Render Web payment form
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Premium Subscription</Text><View style={{ width: 32 }} />
        </View>
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContentCenter}>
            <Text style={styles.title}>Complete Your Payment</Text>
            <Text style={styles.description}>Your payment is securely processed by Stripe.</Text>
            <Elements stripe={stripePromise} options={elementsOptions}>
              <StripePaymentFormWeb
                clientSecret={elementsOptions.clientSecret!} // Assert non-null as elementsOptions is checked
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={handlePaymentError}
              />
            </Elements>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 5. Mobile: Fallback if PaymentSheet isn't active but params are loaded (e.g., if presentPaymentSheet was not auto-called)
  // This state is less likely to be hit with the current auto-present logic for mobile.
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    if (paymentParams && !paymentInProgressMobile && !uiLoading) {
      return (
           <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
               <View style={styles.header}>
                   <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} /></TouchableOpacity>
                   <Text style={styles.headerTitle}>Premium Subscription</Text><View style={{ width: 32 }} />
               </View>
               <ScrollView style={styles.content} contentContainerStyle={styles.scrollContentCenter}>
                   <Text style={styles.title}>Ready for Payment</Text>
                   <Text style={styles.description}>Press the button below to open the secure payment form.</Text>
                   {/* You could add a button here to manually re-trigger presentPaymentSheet if needed */}
                   <TouchableOpacity
                        style={styles.button}
                        onPress={async () => { // Manually present sheet
                            setPaymentInProgressMobile(true);
                            const { error: presentError } = await presentPaymentSheet();
                            setPaymentInProgressMobile(false);
                            if (presentError && presentError.code !== 'Canceled') { 
                                Alert.alert('Payment Error', `Payment failed: ${presentError.message}`);
                            } else if (!presentError) { 
                                await handlePaymentSuccess(); 
                            }
                        }}
                    >
                        <Text style={styles.buttonText}>Proceed to Payment</Text>
                    </TouchableOpacity>
               </ScrollView>
           </SafeAreaView>
      );
    }
  }

  // Default fallback (should ideally not be reached if all states are handled)
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} /></TouchableOpacity>
            <Text style={styles.headerTitle}>Error</Text><View style={{ width: 32 }} />
        </View>
        <View style={styles.scrollContentCenter}>
            <Text>An unexpected error occurred. Please go back and try again.</Text>
        </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  webFormContainer: {
    width: '100%',
    maxWidth: 400,
    paddingHorizontal: Platform.OS === 'web' ? 0 : 20, // No extra padding inside for web
    paddingVertical: 20,
    backgroundColor: Platform.OS === 'web' ? '#fff' : 'transparent', // Web has white box
    borderRadius: Platform.OS === 'web' ? 8 : 0,
    shadowColor: Platform.OS === 'web' ? "#000" : undefined,
    shadowOffset: Platform.OS === 'web' ? { width: 0, height: 1 } : undefined,
    shadowOpacity: Platform.OS === 'web' ? 0.22 : undefined,
    shadowRadius: Platform.OS === 'web' ? 2.22 : undefined,
    elevation: Platform.OS === 'web' ? 3 : undefined,
    marginBottom: 20,
  },
  errorTextWeb: {
    color: 'red',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
  },
   container: {
    flex: 1,
    backgroundColor: Platform.OS === 'web' ? '#f7f7f7' : '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    backgroundColor: '#FFFFFF',
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
    padding: Platform.OS === 'web' ? 40 : 20,
  },
  title: {
    fontSize: Platform.OS === 'web' ? 26 : 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    textAlign: 'center',
  },
  description: {
    fontSize: Platform.OS === 'web' ? 17 : 16,
    textAlign: 'center',
    marginBottom: 30,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    maxWidth: 500,
    lineHeight: Platform.OS === 'web' ? 24 : 22,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
  },
  loadingMessageContainer: { // For PaymentElement loading message
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 10,
  },
  button: {
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
    paddingVertical: 15, // Slightly reduced padding
    borderRadius: 10, // Slightly reduced radius
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
    maxWidth: 380, // Adjusted max width
  },
  buttonDisabled: {
    opacity: 0.6, // Adjusted opacity for disabled state
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600', // Adjusted weight
  },
  cancelButton: {
    backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND_LIGHT,
    borderWidth: 1,
    borderColor: APP_CONSTANTS.COLORS.BORDER,
  },
  cancelButtonText: {
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    marginBottom: 10, // Increased margin
    alignSelf: 'flex-start',
    paddingHorizontal: Platform.OS === 'web' ? 0 : 0, // No extra padding for label within form box
  }
});

export default PremiumSignupScreen;