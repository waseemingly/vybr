// // src/screens/PaymentConfirmationScreen.tsx
// import React, { useEffect, useState } from 'react';
// import { View, Text, StyleSheet, ActivityIndicator, Platform, TouchableOpacity, Alert } from 'react-native';
// import { useNavigation, NavigationProp } from '@react-navigation/native';
// import { loadStripe } from '@stripe/stripe-js';
// import { APP_CONSTANTS } from '@/config/constants';
// import { useAuth } from '@/hooks/useAuth';
// import type { RootStackParamList } from '@/navigation/AppNavigator'; // Adjust path as needed
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { Feather } from '@expo/vector-icons';


// // Ensure this is the same key used in PremiumSignupScreen for `loadStripe`
// const STRIPE_PUBLISHABLE_KEY_WEB = 'pk_test_51RDGZeDz14cfDAXkmWK8eowRamZEWD7wAr1Mjae9QjhtBGRZ0VFXGDQxS9Q8XQfX1Gkoy4PlTcNWIz2E54Y6n7Yw00wY8abUlU'; // Your actual key
// const stripePromise = Platform.OS === 'web' ? loadStripe(STRIPE_PUBLISHABLE_KEY_WEB) : null;

// const PaymentConfirmationScreen = () => {
//   const navigation = useNavigation<NavigationProp<RootStackParamList>>();
//   const [status, setStatus] = useState<'loading' | 'succeeded' | 'processing' | 'failed' | 'error'>('loading');
//   const [message, setMessage] = useState('Verifying your payment...');
//   const { session, updatePremiumStatus } = useAuth();

//   useEffect(() => {
//     if (Platform.OS !== 'web') {
//       // This screen is primarily intended for web post-payment redirects.
//       // If somehow navigated to on mobile, it's likely an error in flow.
//       console.warn("[PaymentConfirmationScreen] Accessed on non-web platform. This shouldn't happen.");
//       setMessage('This page is intended for web payment confirmation.');
//       setStatus('error');
//       // Optionally navigate away or show a generic error for mobile.
//       // For now, just an error message.
//       return;
//     }

//     if (!stripePromise) {
//       console.error("[PaymentConfirmationScreen] Stripe.js promise not initialized.");
//       setMessage('Payment system (Stripe.js) is not available.');
//       setStatus('error');
//       return;
//     }

//     const clientSecret = new URLSearchParams(window.location.search).get(
//       'payment_intent_client_secret'
//     );
//     const paymentIntentId = new URLSearchParams(window.location.search).get(
//       'payment_intent'
//     );
//     const redirectStatus = new URLSearchParams(window.location.search).get(
//         'redirect_status'
//     );


//     if (!clientSecret || !paymentIntentId) {
//       console.error("[PaymentConfirmationScreen] Missing payment_intent_client_secret or payment_intent from URL.");
//       setMessage('Payment confirmation details are missing or incomplete. Please contact support if payment was made.');
//       setStatus('error');
//       return;
//     }

//     const currentUserId = session?.user?.id;
//     if (!currentUserId) {
//       console.error("[PaymentConfirmationScreen] User session not found. Cannot update premium status without userId.");
//       setMessage('Your session seems to have expired. Please log in again. If payment was made, contact support to activate your premium status.');
//       setStatus('error');
//       // Consider redirecting to login after a delay or providing a login button.
//       return;
//     }

//     const checkPaymentStatus = async () => {
//       const stripe = await stripePromise;
//       if (!stripe) {
//         console.error("[PaymentConfirmationScreen] Stripe.js failed to load after promise.");
//         setMessage('Stripe.js failed to load. Cannot verify payment.');
//         setStatus('error');
//         return;
//       }

//       try {
//         console.log(`[PaymentConfirmationScreen] Retrieving PaymentIntent with clientSecret: ${clientSecret}`);
//         const { paymentIntent, error: retrieveError } = await stripe.retrievePaymentIntent(clientSecret);

//         if (retrieveError) {
//             console.error("[PaymentConfirmationScreen] Error retrieving PaymentIntent:", retrieveError);
//             setMessage(`Error verifying payment: ${retrieveError.message}. Please contact support.`);
//             setStatus('error');
//             return;
//         }

//         if (!paymentIntent) {
//           console.error("[PaymentConfirmationScreen] Could not retrieve payment details from Stripe after redirect.");
//           setMessage('Could not retrieve payment details from Stripe. Please contact support.');
//           setStatus('error');
//           return;
//         }

//         console.log('[PaymentConfirmationScreen] Retrieved PaymentIntent status:', paymentIntent.status);

//         if (paymentIntent.status === 'succeeded' || redirectStatus === 'succeeded') {
//           setMessage('Payment Successful! Your premium subscription is being activated.');
//           setStatus('succeeded');
//           console.log('[PaymentConfirmationScreen] Web Payment Confirmed Succeeded. Updating premium status for user:', currentUserId);

//           try {
//             const updateResult = await updatePremiumStatus(currentUserId, true, { preventAutomaticNavigation: true });
//             if ('error' in updateResult && updateResult.error) {
//               console.error('[PaymentConfirmationScreen] Premium status update client-side error:', updateResult.error);
//               Alert.alert('Payment Confirmed', 'Your payment was successful, but there was a slight delay updating your account. It should reflect shortly. If not, please contact support.');
//             } else {
//               console.log('[PaymentConfirmationScreen] Premium status updated successfully client-side.');
//             }
//           } catch (e: any) {
//             console.error('[PaymentConfirmationScreen] Exception during client-side premium status update:', e);
//             Alert.alert('Payment Confirmed', 'Your payment was successful, but an error occurred during the immediate account update. It will be processed. Please contact support if your status doesn\'t change soon.');
//           }

//           // Navigate to your existing PaymentSuccessScreen or directly to the app
//           setTimeout(() => {
//             // Option 1: Navigate to your common PaymentSuccessScreen
//             // navigation.replace('PaymentSuccessScreen');

//             // Option 2: Directly reset to the app (PaymentSuccessScreen handles its own redirect)
//             // This assumes PaymentSuccessScreen will then redirect to MainApp.
//             // If PaymentSuccessScreen's only job is to show a message and redirect,
//             // you might just do the final navigation here.
//             // For consistency with your PaymentSuccessScreen:
//             navigation.reset({
//                 index: 0,
//                 routes: [{ name: 'PaymentSuccessScreen' }], // Let PaymentSuccessScreen handle the final redirect
//             });
//           }, 2500); // Give user time to read the message

//         } else if (paymentIntent.status === 'processing') {
//           setMessage("Your payment is still processing. We'll update your account once it's confirmed.");
//           setStatus('processing');
//           // Keep user on this page or navigate to a dedicated "pending payment" page.
//         } else {
//           // Includes 'requires_payment_method', 'canceled', etc.
//           console.warn(`[PaymentConfirmationScreen] PaymentIntent status: ${paymentIntent.status}, redirect_status: ${redirectStatus}`);
//           setMessage(`Payment was not successful (Status: ${paymentIntent.status || redirectStatus || 'unknown'}). Please try again or contact support.`);
//           setStatus('failed');
//         }
//       } catch (e: any) {
//         console.error('[PaymentConfirmationScreen] Critical error during payment status check:', e);
//         setMessage(`A critical error occurred while confirming your payment: ${e.message}. Please contact support.`);
//         setStatus('error');
//       }
//     };

//     checkPaymentStatus();
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [stripePromise, session]); // Removed navigation, updatePremiumStatus as direct dependencies, session is enough

//   const renderContent = () => {
//     switch (status) {
//       case 'loading':
//       case 'processing':
//         return (
//           <>
//             <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} style={{ marginBottom: 20 }}/>
//             <Text style={styles.title}>{status === 'processing' ? 'Payment Processing...' : 'Verifying Payment...'}</Text>
//             <Text style={styles.message}>{message}</Text>
//           </>
//         );
//       case 'succeeded':
//         return (
//           <>
//             <Feather name="check-circle" size={60} color={APP_CONSTANTS.COLORS.SUCCESS} style={{ marginBottom: 20 }} />
//             <Text style={styles.title}>Payment Confirmed!</Text>
//             <Text style={styles.message}>{message}</Text>
//           </>
//         );
//       case 'failed':
//       case 'error':
//         return (
//           <>
//             <Feather name="alert-circle" size={60} color={APP_CONSTANTS.COLORS.ERROR} style={{ marginBottom: 20 }} />
//             <Text style={styles.title}>Payment Issue</Text>
//             <Text style={styles.message}>{message}</Text>
//             <TouchableOpacity
//               style={styles.button}
//               onPress={() => navigation.navigate('PremiumSignupScreen')} // Navigate back to try again
//             >
//               <Text style={styles.buttonText}>Try Payment Again</Text>
//             </TouchableOpacity>
//             <TouchableOpacity
//               style={[styles.button, styles.outlineButton]}
//               onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainApp' }]})} // Go to home
//             >
//               <Text style={[styles.buttonText, styles.outlineButtonText]}>Go to App Home</Text>
//             </TouchableOpacity>
//           </>
//         );
//       default:
//         return null;
//     }
//   };

//   return (
//     <SafeAreaView style={styles.safeAreaContainer} edges={['top', 'bottom']}>
//       <View style={styles.container}>
//         {renderContent()}
//       </View>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   safeAreaContainer: {
//     flex: 1,
//     backgroundColor: '#FFFFFF',
//   },
//   container: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: 20,
//   },
//   title: {
//     fontSize: 24,
//     fontWeight: 'bold',
//     color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
//     marginBottom: 15,
//     textAlign: 'center',
//   },
//   message: {
//     fontSize: 16,
//     color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
//     textAlign: 'center',
//     marginBottom: 30,
//     lineHeight: 22,
//   },
//   button: {
//     backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
//     paddingVertical: 14,
//     paddingHorizontal: 30,
//     borderRadius: 8,
//     alignItems: 'center',
//     marginTop: 20,
//     width: '100%',
//     maxWidth: 300,
//   },
//   buttonText: {
//     color: '#FFFFFF',
//     fontSize: 16,
//     fontWeight: '600',
//   },
//   outlineButton: {
//     backgroundColor: 'transparent',
//     borderWidth: 1,
//     borderColor: APP_CONSTANTS.COLORS.PRIMARY,
//   },
//   outlineButtonText: {
//     color: APP_CONSTANTS.COLORS.PRIMARY,
//   },
// });

// export default PaymentConfirmationScreen;

// src/screens/PaymentConfirmationScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { loadStripe } from '@stripe/stripe-js';
import { APP_CONSTANTS } from '@/config/constants';
import { useAuth } from '@/hooks/useAuth';
import type { RootStackParamList } from '@/navigation/AppNavigator'; // Adjust path as needed
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';


// Ensure this is the same key used in PremiumSignupScreen for `loadStripe`
const STRIPE_PUBLISHABLE_KEY_WEB = 'pk_test_51RDGZeDz14cfDAXkmWK8eowRamZEWD7wAr1Mjae9QjhtBGRZ0VFXGDQxS9Q8XQfX1Gkoy4PlTcNWIz2E54Y6n7Yw00wY8abUlU'; // Your actual key
const stripePromise = Platform.OS === 'web' ? loadStripe(STRIPE_PUBLISHABLE_KEY_WEB) : null;

const PaymentConfirmationScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [status, setStatus] = useState<'loading' | 'succeeded' | 'processing' | 'failed' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your payment...');
  const { session, updatePremiumStatus } = useAuth();

  useEffect(() => {
    console.log("[PaymentConfirmationScreen] useEffect triggered.");

    if (Platform.OS !== 'web') {
      console.warn("[PaymentConfirmationScreen] Accessed on non-web platform. This shouldn't happen.");
      setMessage('This page is intended for web payment confirmation.');
      setStatus('error');
      return;
    }

    if (!stripePromise) {
      console.error("[PaymentConfirmationScreen] Stripe.js promise not initialized.");
      setMessage('Payment system (Stripe.js) is not available.');
      setStatus('error');
      return;
    }

    console.log("[PaymentConfirmationScreen] window.location.search:", window.location.search);
    const params = new URLSearchParams(window.location.search);
    const clientSecret = params.get('payment_intent_client_secret');
    const paymentIntentId = params.get('payment_intent');
    const redirectStatus = params.get('redirect_status');

    console.log(`[PaymentConfirmationScreen] Extracted from URL: 
      clientSecret: ${clientSecret}, 
      paymentIntentId: ${paymentIntentId}, 
      redirectStatus: ${redirectStatus}`);


    if (!clientSecret || !paymentIntentId) {
      console.error("[PaymentConfirmationScreen] Missing payment_intent_client_secret or payment_intent from URL.");
      setMessage('Payment confirmation details are missing or incomplete. Please contact support if payment was made.');
      setStatus('error');
      return;
    }

    // Log session state immediately to see what useAuth provides on page load
    console.log("[PaymentConfirmationScreen] Initial session state from useAuth:", JSON.stringify(session, null, 2));
    const currentUserId = session?.user?.id;

    // This check is crucial. If currentUserId is null here, the update won't happen.
    if (!currentUserId) {
      console.error("[PaymentConfirmationScreen] User session or user ID not found at the time of check. Cannot update premium status without userId. Session user:", session?.user);
      setMessage('Your session seems to have expired or user details are not yet available. Please log in again. If payment was made, contact support to activate your premium status.');
      setStatus('error');
      return;
    }
    console.log("[PaymentConfirmationScreen] currentUserId found:", currentUserId);


    const checkPaymentStatus = async () => {
      console.log("[PaymentConfirmationScreen] checkPaymentStatus called.");
      const stripe = await stripePromise;
      if (!stripe) {
        console.error("[PaymentConfirmationScreen] Stripe.js failed to load after promise within checkPaymentStatus.");
        setMessage('Stripe.js failed to load. Cannot verify payment.');
        setStatus('error');
        return;
      }

      try {
        console.log(`[PaymentConfirmationScreen] Retrieving PaymentIntent with clientSecret: ${clientSecret}`);
        const { paymentIntent, error: retrieveError } = await stripe.retrievePaymentIntent(clientSecret);

        if (retrieveError) {
            console.error("[PaymentConfirmationScreen] Error retrieving PaymentIntent:", retrieveError);
            setMessage(`Error verifying payment: ${retrieveError.message}. Please contact support.`);
            setStatus('error');
            return;
        }

        if (!paymentIntent) {
          console.error("[PaymentConfirmationScreen] Could not retrieve payment details (paymentIntent is null/undefined) from Stripe after redirect.");
          setMessage('Could not retrieve payment details from Stripe. Please contact support.');
          setStatus('error');
          return;
        }

        console.log('[PaymentConfirmationScreen] Retrieved PaymentIntent. ID:', paymentIntent.id, 'Status:', paymentIntent.status);

        if (paymentIntent.status === 'succeeded' || redirectStatus === 'succeeded') {
          setMessage('Payment Successful! Your premium subscription is being activated.');
          setStatus('succeeded');
          console.log('[PaymentConfirmationScreen] Web Payment Confirmed Succeeded. About to call updatePremiumStatus for user:', currentUserId);

          try {
            // Re-check currentUserId just before the call, in case session re-hydrated differently
            const finalUserId = session?.user?.id;
            if (!finalUserId) {
                console.error("[PaymentConfirmationScreen] User ID became null before updatePremiumStatus call. Session user:", session?.user);
                Alert.alert('Session Issue', 'Your session changed during payment confirmation. Please contact support to verify your premium status.');
                setStatus('error'); // Or handle appropriately
                return;
            }
            console.log('[PaymentConfirmationScreen] Calling updatePremiumStatus with finalUserId:', finalUserId);
            const updateResult = await updatePremiumStatus(finalUserId, true, { preventAutomaticNavigation: true });
            console.log('[PaymentConfirmationScreen] updatePremiumStatus call finished. Result:', JSON.stringify(updateResult, null, 2));

            if ('error' in updateResult && updateResult.error) {
              console.error('[PaymentConfirmationScreen] Premium status update client-side error:', updateResult.error);
              Alert.alert('Payment Confirmed', 'Your payment was successful, but there was a slight delay updating your account. It should reflect shortly. If not, please contact support.');
            } else {
              console.log('[PaymentConfirmationScreen] Premium status updated successfully client-side.');
            }
          } catch (e: any) {
            console.error('[PaymentConfirmationScreen] Exception during client-side premium status update:', e);
            Alert.alert('Payment Confirmed', 'Your payment was successful, but an error occurred during the immediate account update. It will be processed. Please contact support if your status doesn\'t change soon.');
          }

          console.log('[PaymentConfirmationScreen] Navigating to PaymentSuccessScreen in 2.5s...');
          setTimeout(() => {
            console.log('[PaymentConfirmationScreen] Timeout executed. Resetting navigation.');
            navigation.reset({
                index: 0,
                routes: [{ name: 'PaymentSuccessScreen' }],
            });
          }, 2500);

        } else if (paymentIntent.status === 'processing') {
          console.log('[PaymentConfirmationScreen] PaymentIntent status is "processing".');
          setMessage("Your payment is still processing. We'll update your account once it's confirmed.");
          setStatus('processing');
        } else {
          console.warn(`[PaymentConfirmationScreen] PaymentIntent status: ${paymentIntent.status}, redirect_status: ${redirectStatus}. Payment not successful.`);
          setMessage(`Payment was not successful (Status: ${paymentIntent.status || redirectStatus || 'unknown'}). Please try again or contact support.`);
          setStatus('failed');
        }
      } catch (e: any) {
        console.error('[PaymentConfirmationScreen] Critical error during payment status check (outer try-catch):', e);
        setMessage(`A critical error occurred while confirming your payment: ${e.message}. Please contact support.`);
        setStatus('error');
      }
    };

    // Only call checkPaymentStatus if currentUserId was initially found.
    // The !currentUserId case is handled above the checkPaymentStatus definition.
    if (currentUserId) {
        checkPaymentStatus();
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripePromise, session]); // Key dependency is session. stripePromise is stable.

  const renderContent = () => {
    switch (status) {
      case 'loading':
      case 'processing':
        return (
          <>
            <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} style={{ marginBottom: 20 }}/>
            <Text style={styles.title}>{status === 'processing' ? 'Payment Processing...' : 'Verifying Payment...'}</Text>
            <Text style={styles.message}>{message}</Text>
          </>
        );
      case 'succeeded':
        return (
          <>
            <Feather name="check-circle" size={60} color={APP_CONSTANTS.COLORS.SUCCESS} style={{ marginBottom: 20 }} />
            <Text style={styles.title}>Payment Confirmed!</Text>
            <Text style={styles.message}>{message}</Text>
          </>
        );
      case 'failed':
      case 'error':
        return (
          <>
            <Feather name="alert-circle" size={60} color={APP_CONSTANTS.COLORS.ERROR} style={{ marginBottom: 20 }} />
            <Text style={styles.title}>Payment Issue</Text>
            <Text style={styles.message}>{message}</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.navigate('PremiumSignupScreen')} // Navigate back to try again
            >
              <Text style={styles.buttonText}>Try Payment Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.outlineButton]}
              onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainApp' }]})} // Go to home
            >
              <Text style={[styles.buttonText, styles.outlineButtonText]}>Go to App Home</Text>
            </TouchableOpacity>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeAreaContainer} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeAreaContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    marginBottom: 15,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  button: {
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
    maxWidth: 300,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: APP_CONSTANTS.COLORS.PRIMARY,
  },
  outlineButtonText: {
    color: APP_CONSTANTS.COLORS.PRIMARY,
  },
});

export default PaymentConfirmationScreen;