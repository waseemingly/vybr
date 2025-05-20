
// // src/screens/PremiumSignupScreen.tsx
// import React, { useState, useEffect } from 'react';
// import {
//   View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Platform, GestureResponderEvent
// } from 'react-native';
// // NATIVE Stripe
// import { useStripe as useNativeStripe } from '@stripe/stripe-react-native';

// // WEB Stripe
// import { loadStripe, StripeElementsOptions, Appearance } from '@stripe/stripe-js';
// import { Elements, PaymentElement, useStripe as useWebStripe, useElements } from '@stripe/react-stripe-js';

// import { useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';
// import { supabase } from '@/lib/supabase';
// import { APP_CONSTANTS } from '@/config/constants';
// import { useAuth } from '@/hooks/useAuth';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { Feather } from '@expo/vector-icons';
// import type { MainStackParamList, RootStackParamList } from '@/navigation/AppNavigator';

// type PremiumSignupScreenRouteProp = RouteProp<MainStackParamList, 'PremiumSignupScreen'>;
// type PremiumSignupNavigationProp = NavigationProp<RootStackParamList>;

// const PREMIUM_PLAN_PRICE_ID = 'price_1ROtS1DHMm6OC3yQAkqDjUWd';
// const STRIPE_PUBLISHABLE_KEY_WEB = 'pk_test_51RDGZpDHMm6OC3yQwI460w1bESyWDQoSdNLBU9TOhciyc7NlbJ5upgCTJsP6OAuYt8cUeywcbkwQGCBI7VDCMNuz00qld2OSdN'; // Your actual key

// const stripePromise = Platform.OS === 'web' ? loadStripe(STRIPE_PUBLISHABLE_KEY_WEB) : null;

// // Separate component for Web Payment Form
// const StripePaymentFormWeb = ({ clientSecret, onPaymentSuccess, onPaymentError }: { clientSecret: string, onPaymentSuccess: () => void, onPaymentError: (errorMsg: string) => void }) => {
//   const stripe = useWebStripe();
//   const elements = useElements();
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [errorMessage, setErrorMessage] = useState<string | null>(null);
//   const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);

//   const handleSubmit = async (event?: React.FormEvent | GestureResponderEvent) => { // Optional event
//     if (event && typeof (event as React.FormEvent).preventDefault === 'function') {
//       (event as React.FormEvent).preventDefault();
//     }
//     console.log('[StripePaymentFormWeb] handleSubmit called.');

//     if (!stripe || !elements) {
//       console.error('[StripePaymentFormWeb] Stripe.js or Elements not loaded yet.');
//       setErrorMessage('Payment system not ready. Please wait and try again.');
//       onPaymentError('Payment system not ready.');
//       return;
//     }

//     setIsProcessing(true);
//     setErrorMessage(null);
//     console.log('[StripePaymentFormWeb] Attempting stripe.confirmPayment...');

//     try {
//       const { error, paymentIntent } = await stripe.confirmPayment({
//         elements,
//         confirmParams: {
//           return_url: `${window.location.origin}/payment-confirmation`, // CRUCIAL: This page MUST handle the redirect
//         },
//         // redirect: 'if_required', // Default behavior
//       });

//       if (error) {
//         // This type of error usually means something went wrong before Stripe could attempt the payment or redirect.
//         // E.g., invalid card details if client-side validation wasn't complete, or a network issue.
//         console.error('[StripePaymentFormWeb] confirmPayment immediate error:', error);
//         setErrorMessage(error.message || 'An unexpected error occurred during payment confirmation.');
//         onPaymentError(error.message || 'An unexpected error occurred during payment confirmation.');
//       } else if (paymentIntent) {
//         // This block is hit if confirmPayment completes WITHOUT a redirect OR if a redirect happened
//         // and Stripe.js was ableto pick up the result (less common for this to be the final success point post-redirect).
//         // The primary success/failure handling after a redirect should be on the return_url page.
//         console.log('[StripePaymentFormWeb] confirmPayment returned paymentIntent. Status:', paymentIntent.status);
//         if (paymentIntent.status === 'succeeded') {
//           console.log('[StripePaymentFormWeb] Payment Succeeded directly (no redirect, or handled by Stripe.js post-redirect if possible). Calling onPaymentSuccess.');
//           onPaymentSuccess();
//         } else if (paymentIntent.status === 'requires_action' || paymentIntent.status === 'requires_confirmation') {
//           // Stripe is handling the redirect (or has already redirected and this is a re-check).
//           // User will land on return_url. The return_url handler will take over.
//           console.log('[StripePaymentFormWeb] Payment requires action/confirmation. Stripe will redirect or has redirected.');
//           // No explicit client action here as the redirect or return_url page handles it.
//           // setIsProcessing will be set to false in finally.
//         } else {
//           // Other statuses like 'requires_payment_method', 'canceled'
//           console.warn(`[StripePaymentFormWeb] PaymentIntent status: ${paymentIntent.status}`);
//           setErrorMessage(`Payment status: ${paymentIntent.status}. Please try again or use a different payment method.`);
//           onPaymentError(`Payment status: ${paymentIntent.status}`);
//         }
//       } else {
//         // This case implies Stripe did redirect, and no `paymentIntent` object was immediately returned
//         // to this client-side promise resolution. The outcome must be handled by the `return_url`.
//         console.log('[StripePaymentFormWeb] Stripe likely redirected. Outcome must be handled on return_url.');
//       }
//     } catch (e: any) {
//       console.error('[StripePaymentFormWeb] Exception during confirmPayment:', e);
//       setErrorMessage(e.message || 'An unexpected client-side error occurred.');
//       onPaymentError(e.message || 'An unexpected client-side error occurred.');
//     } finally {
//       setIsProcessing(false);
//       console.log('[StripePaymentFormWeb] setIsProcessing(false) in finally block.');
//     }
//   };

//   return (
//     <View style={styles.webFormContainer}>
//       <Text style={styles.inputLabel}>Card Details</Text>
//       <PaymentElement
//         onReady={() => {
//           console.log('[StripePaymentFormWeb] PaymentElement is ready.');
//           setIsPaymentElementReady(true);
//         }}
//         onChange={(event) => {
//           if (event.error) {
//             setErrorMessage(event.error.message || null);
//           } else {
//             setErrorMessage(null);
//           }
//         }}
//       />
//       <TouchableOpacity
//         style={[styles.button, { marginTop: 30 }, (isProcessing || !isPaymentElementReady) && styles.buttonDisabled]}
//         onPress={handleSubmit}
//         disabled={!stripe || !elements || isProcessing || !isPaymentElementReady}
//       >
//         {isProcessing ? (
//           <ActivityIndicator color="#FFFFFF" />
//         ) : (
//           <Text style={styles.buttonText}>Pay $4.99</Text>
//         )}
//       </TouchableOpacity>
//       {errorMessage && <Text style={styles.errorTextWeb}>{errorMessage}</Text>}
//       {!isPaymentElementReady && !errorMessage && (
//          <View style={{alignItems: 'center', marginTop: 10}}>
//              <ActivityIndicator color={APP_CONSTANTS.COLORS.PRIMARY} />
//              <Text style={styles.loadingText}>Loading payment form...</Text>
//          </View>
//       )}
//     </View>
//   );
// };


// const PremiumSignupScreen = () => {
//   const [uiLoading, setUiLoading] = useState(true);
//   const [paymentInProgressMobile, setPaymentInProgressMobile] = useState(false);
//   const [paymentParams, setPaymentParams] = useState<any>(null);

//   const { initPaymentSheet, presentPaymentSheet } = useNativeStripe();
//   const navigation = useNavigation<PremiumSignupNavigationProp>();
//   const route = useRoute<PremiumSignupScreenRouteProp>();
//   const { userEmail, userId } = route.params;
//   const { updatePremiumStatus } = useAuth();

//   const handlePaymentSuccess = async () => {
//     // This function is called by:
//     // 1. Mobile flow: directly after presentPaymentSheet succeeds.
//     // 2. Web flow: by StripePaymentFormWeb's onPaymentSuccess IF payment succeeds without redirect.
//     //    (Primary web success handling is on /payment-confirmation page)
//     Alert.alert('Payment Successful!', 'Your premium subscription is now active.');
//     console.log('[PremiumSignupScreen] Payment successful. Updating premium status for user:', userId);
//     try {
//       // Pass preventAutomaticNavigation to stop AuthProvider from redirecting too soon
//       const result = await updatePremiumStatus(userId, true, { preventAutomaticNavigation: true });
//       if ('error' in result && result.error) {
//         console.error('[PremiumSignupScreen] Premium status update client-side error:', result.error);
//         Alert.alert('Warning', 'Payment confirmed, but there was an issue with the immediate status update. Your access will be granted shortly. Please check your profile or contact support if needed.');
//       } else {
//         console.log('[PremiumSignupScreen] Premium status updated client-side.');
//       }
//     } catch (e: any) {
//         console.error('[PremiumSignupScreen] Exception during client-side premium status update:', e);
//         Alert.alert('Warning', 'Payment confirmed, but an error occurred during the immediate status update. Your access will be granted shortly.');
//     }

//     navigation.reset({
//       index: 0,
//       routes: [{ name: 'MainApp', params: { screen: 'UserTabs', params: { screen: 'Profile', params: { paymentSuccess: true } } } }],
//     });
//   };

//   const handlePaymentError = (errorMessage: string) => {
//     console.error('[PremiumSignupScreen] handlePaymentError called with:', errorMessage);
//     Alert.alert('Payment Error', errorMessage);
//     // Potentially navigate back or offer retry, depending on the error context
//   };


//   const fetchAndSetupPayment = async () => {
//     setUiLoading(true);
//     setPaymentParams(null);
//     console.log('[PremiumSignupScreen] Fetching payment sheet/intent params...');
//     try {
//       const { data, error: invokeError } = await supabase.functions.invoke('create-checkout-session', {
//         body: JSON.stringify({
//           priceId: PREMIUM_PLAN_PRICE_ID,
//           userId,
//           userEmail,
//         }),
//       });

//       if (invokeError) {
//         console.error('Supabase function error:', invokeError);
//         throw new Error(invokeError.message || 'Failed to create payment session. Please try again.');
//       }

//       if (!data || !data.paymentIntentClientSecret || !data.ephemeralKey || !data.customerId) {
//         console.error('Invalid response from Supabase function:', data);
//         throw new Error('Invalid response from payment service. Please try again.');
//       }
//       console.log('[PremiumSignupScreen] Payment params received:', data);

//       setPaymentParams(data);

//       if (Platform.OS !== 'web') {
//         const { error: initError } = await initPaymentSheet({
//           merchantDisplayName: 'VYBR',
//           customerId: data.customerId,
//           customerEphemeralKeySecret: data.ephemeralKey,
//           paymentIntentClientSecret: data.paymentIntentClientSecret,
//           allowsDelayedPaymentMethods: true,
//           returnURL: 'vybr://stripe-redirect', // For mobile app deep linking
//         });

//         if (initError) {
//           console.error('[PremiumSignupScreen] initPaymentSheet error:', initError);
//           throw initError;
//         }
//         setUiLoading(false); // Initial setup done for mobile
//         console.log('[PremiumSignupScreen] Mobile Payment sheet initialized. Presenting...');
//         setPaymentInProgressMobile(true);
//         const { error: presentError } = await presentPaymentSheet();
//         setPaymentInProgressMobile(false);

//         if (presentError) {
//           if (presentError.code === 'Canceled') {
//             Alert.alert('Payment Canceled', 'The payment process was canceled.');
//             navigation.goBack();
//           } else {
//             console.error('[PremiumSignupScreen] presentPaymentSheet error:', presentError);
//             throw presentError;
//           }
//         } else {
//           // Mobile payment succeeded
//           await handlePaymentSuccess();
//         }
//       } else {
//         // For web, paymentParams are set. UI will re-render with Elements provider.
//         setUiLoading(false);
//       }

//     } catch (err: any) {
//       console.error('[PremiumSignupScreen] Error in fetchAndSetupPayment:', err);
//       Alert.alert('Error', `Could not prepare payment: ${err.message || 'Unknown error'}. Please try again.`);
//       setUiLoading(false);
//       setPaymentParams(null);
//     }
//   };

//   useEffect(() => {
//     fetchAndSetupPayment();
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   const appearance: Appearance = { theme: 'stripe' };
//   const options: StripeElementsOptions | undefined =
//     (Platform.OS === 'web' && paymentParams && paymentParams.paymentIntentClientSecret) ? {
//       clientSecret: paymentParams.paymentIntentClientSecret,
//       appearance,
//     } : undefined;

//   if (uiLoading) {
//     return (
//       <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
//         <View style={styles.header}>
//             <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
//                 <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} />
//             </TouchableOpacity>
//             <Text style={styles.headerTitle}>Premium Subscription</Text>
//             <View style={{ width: 32 }} />
//         </View>
//         <View style={styles.scrollContentCenter}>
//           <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
//           <Text style={styles.loadingText}>Preparing secure payment...</Text>
//         </View>
//       </SafeAreaView>
//     );
//   }

//   if (Platform.OS !== 'web' && paymentInProgressMobile) {
//      return (
//       <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
//         <View style={styles.header}>
//             <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
//                 <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} />
//             </TouchableOpacity>
//             <Text style={styles.headerTitle}>Premium Subscription</Text>
//             <View style={{ width: 32 }} />
//         </View>
//         <View style={styles.scrollContentCenter}>
//           <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
//           <Text style={styles.loadingText}>Processing your payment...</Text>
//         </View>
//       </SafeAreaView>
//     );
//   }

//   if ((!paymentParams && !uiLoading)) { // Simpler condition for setup failure
//     return (
//       <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
//         <View style={styles.header}>
//           <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
//             <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} />
//           </TouchableOpacity>
//           <Text style={styles.headerTitle}>Premium Subscription</Text>
//           <View style={{ width: 32 }} />
//         </View>
//         <ScrollView style={styles.content} contentContainerStyle={styles.scrollContentCenter}>
//           <Feather name="alert-circle" size={48} color={APP_CONSTANTS.COLORS.WARNING} style={{marginBottom: 20}}/>
//           <Text style={styles.title}>Payment Setup Failed</Text>
//           <Text style={styles.description}>
//             We couldn't prepare the payment screen. This might be a temporary issue or missing configuration.
//           </Text>
//           <TouchableOpacity style={styles.button} onPress={fetchAndSetupPayment}>
//             <Text style={styles.buttonText}>Try Again</Text>
//           </TouchableOpacity>
//           <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => navigation.goBack()}>
//             <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
//           </TouchableOpacity>
//         </ScrollView>
//       </SafeAreaView>
//     );
//   }

//   if (Platform.OS === 'web') {
//     if (!stripePromise || !options) { // If still loading or params failed for web after uiLoading is false
//         return (
//              <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
//                 <View style={styles.header}>
//                     <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
//                         <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} />
//                     </TouchableOpacity>
//                     <Text style={styles.headerTitle}>Premium Subscription</Text>
//                     <View style={{ width: 32 }} />
//                 </View>
//                 <ScrollView style={styles.content} contentContainerStyle={styles.scrollContentCenter}>
//                     <Feather name="alert-circle" size={48} color={APP_CONSTANTS.COLORS.WARNING} style={{marginBottom: 20}}/>
//                     <Text style={styles.title}>Payment Form Error</Text>
//                     <Text style={styles.description}>
//                         The payment form could not be loaded. Please ensure Stripe is configured correctly.
//                     </Text>
//                     <TouchableOpacity style={styles.button} onPress={fetchAndSetupPayment}><Text style={styles.buttonText}>Retry Setup</Text></TouchableOpacity>
//                     <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => navigation.goBack()}><Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text></TouchableOpacity>
//                 </ScrollView>
//             </SafeAreaView>
//         );
//     }
//     // Render Web payment form
//     return (
//       <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
//         <View style={styles.header}>
//           <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
//             <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} />
//           </TouchableOpacity>
//           <Text style={styles.headerTitle}>Premium Subscription</Text>
//            <View style={{ width: 32 }} />
//         </View>
//         <ScrollView style={styles.content} contentContainerStyle={styles.scrollContentCenter}>
//             <Text style={styles.title}>Complete Your Payment</Text>
//             <Text style={styles.description}>
//             Enter your card details below. Your payment is securely processed by Stripe.
//             </Text>
//             <Elements stripe={stripePromise} options={options}>
//               <StripePaymentFormWeb
//                 clientSecret={options.clientSecret!}
//                 onPaymentSuccess={handlePaymentSuccess}
//                 onPaymentError={handlePaymentError}
//               />
//             </Elements>
//         </ScrollView>
//       </SafeAreaView>
//     );
//   }

//   // Fallback for mobile if somehow uiLoading is false, paymentParams are set, but not in paymentInProgressMobile state
//   // This state should ideally not be reached if mobile logic is correct.
//   if (Platform.OS !== 'web' && paymentParams && !paymentInProgressMobile && !uiLoading) {
//       return (
//            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
//                <View style={styles.header}>
//                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} /></TouchableOpacity>
//                    <Text style={styles.headerTitle}>Premium Subscription</Text>
//                    <View style={{ width: 32 }} />
//                </View>
//                <ScrollView style={styles.content} contentContainerStyle={styles.scrollContentCenter}>
//                    <Text style={styles.title}>Ready for Payment</Text>
//                    <Text style={styles.description}>An unexpected error occurred. Please try initializing payment again.</Text>
//                    <TouchableOpacity style={styles.button} onPress={fetchAndSetupPayment}><Text style={styles.buttonText}>Initialize Payment</Text></TouchableOpacity>
//                </ScrollView>
//            </SafeAreaView>
//       );
//   }

//   // Default fallback (should ideally not be reached)
//   return (
//     <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
//         <View style={styles.header}>
//             <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} /></TouchableOpacity>
//             <Text style={styles.headerTitle}>Error</Text>
//             <View style={{ width: 32 }} />
//         </View>
//         <View style={styles.scrollContentCenter}>
//             <Text>An unexpected error occurred. Please go back and try again.</Text>
//         </View>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   webFormContainer: {
//     width: '100%',
//     maxWidth: 400,
//     padding: 20,
//     backgroundColor: '#fff',
//     borderRadius: 8,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 1 },
//     shadowOpacity: 0.22,
//     shadowRadius: 2.22,
//     elevation: 3,
//     marginBottom: 20, // Added margin to separate from description
//   },
//   errorTextWeb: {
//     color: 'red',
//     textAlign: 'center',
//     marginTop: 10,
//   },
//    container: {
//     flex: 1,
//     backgroundColor: '#f7f7f7',
//   },
//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     borderBottomWidth: 1,
//     backgroundColor: '#FFFFFF',
//     borderBottomColor: APP_CONSTANTS.COLORS.BORDER_LIGHT,
//   },
//   backButton: {
//     padding: 8,
//   },
//   headerTitle: {
//     fontSize: 18,
//     fontWeight: '600',
//     color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
//   },
//   content: {
//     flex: 1,
//   },
//   scrollContentCenter: {
//     flexGrow: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: Platform.OS === 'web' ? 40 : 20,
//   },
//   title: {
//     fontSize: Platform.OS === 'web' ? 28 : 22,
//     fontWeight: 'bold',
//     marginBottom: 15,
//     color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
//     textAlign: 'center',
//   },
//   description: {
//     fontSize: Platform.OS === 'web' ? 18 : 16,
//     textAlign: 'center',
//     marginBottom: 30,
//     color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
//     maxWidth: 500,
//   },
//   loadingText: {
//     marginTop: 15,
//     fontSize: 16,
//     color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
//   },
//   button: {
//     backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
//     paddingVertical: 16,
//     borderRadius: 12,
//     alignItems: 'center',
//     marginTop: 20,
//     width: '100%',
//     maxWidth: 400,
//   },
//   buttonDisabled: {
//     opacity: 0.5,
//   },
//   buttonText: {
//     color: '#FFFFFF',
//     fontSize: 16,
//     fontWeight: 'bold',
//   },
//   cancelButton: {
//     backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND_LIGHT,
//     borderWidth: 1,
//     borderColor: APP_CONSTANTS.COLORS.BORDER,
//   },
//   cancelButtonText: {
//     color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
//   },
//   inputLabel: { // Added for StripePaymentFormWeb
//     fontSize: 14,
//     fontWeight: '600',
//     color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
//     marginBottom: 8,
//     alignSelf: 'flex-start', // Align label to the start of the form container
//   }
// });

// export default PremiumSignupScreen;

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
  const stripe = useWebStripe(); // from @stripe/react-stripe-js
  const elements = useElements(); // from @stripe/react-stripe-js
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);

  const handleSubmit = async (event?: React.FormEvent | GestureResponderEvent) => {
    if (event && typeof (event as React.FormEvent).preventDefault === 'function') {
      (event as React.FormEvent).preventDefault();
    }
    console.log('[StripePaymentFormWeb] handleSubmit called.');

    if (!stripe || !elements) {
      console.error('[StripePaymentFormWeb] Stripe.js or Elements not loaded yet.');
      setErrorMessage('Payment system not ready. Please wait and try again.');
      onPaymentError('Payment system not ready.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    console.log('[StripePaymentFormWeb] Attempting stripe.confirmPayment...');

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // THIS IS CRUCIAL: Stripe WILL redirect here if needed (e.g., 3D Secure)
          // Your PaymentConfirmationScreen MUST handle this route.
          return_url: `${window.location.origin}/payment-confirmation`,
        },
        // redirect: 'if_required', // This is the default behavior
      });

      if (error) {
        // This error typically occurs if the payment fails before any redirect
        // (e.g., card declined outright by Stripe, network issue, invalid card details not caught by Element validation).
        console.error('[StripePaymentFormWeb] confirmPayment immediate error:', error);
        setErrorMessage(error.message || 'An unexpected error occurred.');
        onPaymentError(error.message || 'An unexpected error occurred.');
      } else if (paymentIntent) {
        // This block is hit if confirmPayment resolves WITHOUT an immediate redirect from Stripe.js,
        // OR if Stripe.js handles a quick redirect (like a modal) and then resolves.
        console.log('[StripePaymentFormWeb] confirmPayment returned paymentIntent. Status:', paymentIntent.status);
        if (paymentIntent.status === 'succeeded') {
          // Payment succeeded without needing a full page redirect by Stripe for authentication.
          console.log('[StripePaymentFormWeb] Payment Succeeded directly. Calling onPaymentSuccess.');
          onPaymentSuccess(); // Trigger the main screen's success handler
        } else if (paymentIntent.status === 'requires_action' || paymentIntent.status === 'requires_confirmation') {
          // Stripe is handling a redirect (or has already started one) to an external page or the return_url.
          // The user will land on `return_url` handled by PaymentConfirmationScreen.
          console.log('[StripePaymentFormWeb] Payment requires further action. Stripe should handle redirect.');
        } else {
          // Other statuses like 'requires_payment_method', 'canceled'.
          console.warn(`[StripePaymentFormWeb] PaymentIntent status: ${paymentIntent.status}`);
          setErrorMessage(`Payment status: ${paymentIntent.status}. Please try again.`);
          onPaymentError(`Payment status: ${paymentIntent.status}`);
        }
      } else {
        // This case implies Stripe.js initiated a redirect and the promise resolved without a paymentIntent object.
        // The final outcome will be determined on the `return_url` page.
        console.log('[StripePaymentFormWeb] Stripe likely redirected. Outcome to be handled on return_url.');
      }
    } catch (e: any) {
      console.error('[StripePaymentFormWeb] Exception during confirmPayment:', e);
      setErrorMessage(e.message || 'An unexpected client-side error occurred.');
      onPaymentError(e.message || 'An unexpected client-side error occurred.');
    } finally {
      // Ensure isProcessing is set to false regardless of outcome,
      // unless a redirect is definitely happening and this component will unmount.
      // However, Stripe.js might not always make it clear if a redirect is about to happen from the promise resolution.
      // It's safer to set it here. If a redirect happens, this component unmounts anyway.
      setIsProcessing(false);
      console.log('[StripePaymentFormWeb] setIsProcessing(false) in finally block.');
    }
  };

  return (
    <View style={styles.webFormContainer}>
      <Text style={styles.inputLabel}>Payment Details</Text>
      <PaymentElement
        onReady={() => {
          console.log('[StripePaymentFormWeb] PaymentElement is ready.');
          setIsPaymentElementReady(true);
        }}
        onChange={(event) => { // To display real-time validation errors from the Element
          if (event.error) {
            setErrorMessage(event.error.message || null);
          } else {
            setErrorMessage(null);
          }
        }}
      />
      <TouchableOpacity
        style={[styles.button, { marginTop: 30 }, (isProcessing || !isPaymentElementReady) && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!stripe || !elements || isProcessing || !isPaymentElementReady}
      >
        {isProcessing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Pay $4.99</Text> // TODO: Make amount dynamic if needed
        )}
      </TouchableOpacity>
      {errorMessage && <Text style={styles.errorTextWeb}>{errorMessage}</Text>}
      {!isPaymentElementReady && !errorMessage && (
         <View style={styles.loadingMessageContainer}>
             <ActivityIndicator color={APP_CONSTANTS.COLORS.PRIMARY} />
             <Text style={styles.loadingText}>Loading payment form...</Text>
         </View>
      )}
    </View>
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
      // Pass preventAutomaticNavigation if your AuthProvider might navigate prematurely
      const result = await updatePremiumStatus(userId, true, { preventAutomaticNavigation: true });
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

    // Navigate to a generic success screen or directly to the app
    // PaymentSuccessScreen itself can handle redirecting to MainApp after a delay
    navigation.reset({
      index: 0,
      routes: [{ name: 'PaymentSuccessScreen' }], // Let PaymentSuccessScreen show its message then redirect
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
  if (Platform.OS !== 'web' && paymentParams && !paymentInProgressMobile && !uiLoading) {
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
                            if (presentError) { /* ... handle error ... */ } else { await handlePaymentSuccess(); }
                        }}
                    >
                        <Text style={styles.buttonText}>Proceed to Payment</Text>
                    </TouchableOpacity>
               </ScrollView>
           </SafeAreaView>
      );
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