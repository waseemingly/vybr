// // src/screens/PremiumSignupScreen.tsx
// import React, { useState } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   ActivityIndicator,
//   Alert,
//   TextInput,
//   ScrollView,
// } from 'react-native';
// import { useStripe } from '@stripe/stripe-react-native';
// import { useNavigation, useRoute } from '@react-navigation/native';
// import { supabase } from '@/lib/supabase';
// import { APP_CONSTANTS } from '@/config/constants';
// import { useAuth } from '@/hooks/useAuth';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { Feather } from '@expo/vector-icons';

// const PremiumSignupScreen = () => {
//   const [loading, setLoading] = useState(false);
//   const [cardDetails, setCardDetails] = useState({
//     cardNumber: '',
//     expiry: '',
//     cvv: '',
//     name: '',
//   });
//   const { initPaymentSheet, presentPaymentSheet } = useStripe();
//   const navigation = useNavigation();
//   const route = useRoute();
//   const { userEmail, userId } = route.params;
//   const { updatePremiumStatus } = useAuth();

//   const handleCardNumberChange = (text: string) => {
//     // Remove non-digits and format with spaces
//     const cleaned = text.replace(/\D/g, '');
//     const formatted = cleaned.replace(/(\d{4})/g, '$1 ').trim();
//     setCardDetails(prev => ({ ...prev, cardNumber: formatted }));
//   };

//   const handleExpiryChange = (text: string) => {
//     // Format as MM/YY
//     const cleaned = text.replace(/\D/g, '');
//     let formatted = cleaned;
//     if (cleaned.length > 2) {
//       formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
//     }
//     setCardDetails(prev => ({ ...prev, expiry: formatted }));
//   };

//   const handleCVVChange = (text: string) => {
//     // Only allow digits, max 4 characters
//     const cleaned = text.replace(/\D/g, '').slice(0, 4);
//     setCardDetails(prev => ({ ...prev, cvv: cleaned }));
//   };

//   const handlePayment = async () => {
//     try {
//       setLoading(true);

//       // Validate card details
//       if (!cardDetails.cardNumber.replace(/\s/g, '').match(/^\d{13,19}$/)) {
//         throw new Error('Please enter a valid card number');
//       }
//       if (!cardDetails.expiry.match(/^(0[1-9]|1[0-2])\/([0-9]{2})$/)) {
//         throw new Error('Please enter a valid expiry date (MM/YY)');
//       }
//       if (!cardDetails.cvv.match(/^\d{3,4}$/)) {
//         throw new Error('Please enter a valid CVV');
//       }
//       if (!cardDetails.name.trim()) {
//         throw new Error('Please enter the cardholder name');
//       }

//       // Call your Supabase Edge Function to create a payment session
//       const { data, error } = await supabase.functions.invoke('create-checkout-session', {
//         body: {
//           priceId: 'price_1ROtS1DHMm6OC3yQAkqDjUWd',
//           userId,
//           userEmail,
//           cardDetails,
//         },
//       });

//       if (error) {
//         console.error('Supabase function error:', error);
//         throw new Error('Failed to create payment session. Please try again.');
//       }

//       if (!data || !data.sessionId || !data.ephemeralKey || !data.customerId) {
//         console.error('Invalid response from Supabase function:', data);
//         throw new Error('Invalid response from payment service. Please try again.');
//       }

//       // Initialize the payment sheet
//       const { error: initError } = await initPaymentSheet({
//         merchantDisplayName: 'VYBR',
//         customerId: data.customerId,
//         customerEphemeralKeySecret: data.ephemeralKey,
//         paymentIntentClientSecret: data.sessionId,
//         allowsDelayedPaymentMethods: true,
//       });

//       if (initError) {
//         console.error('Payment sheet initialization error:', initError);
//         Alert.alert('Error', 'Failed to initialize payment. Please try again.');
//         return;
//       }

//       // Present the payment sheet
//       const { error: presentError } = await presentPaymentSheet();

//       if (presentError) {
//         console.error('Payment sheet presentation error:', presentError);
//         Alert.alert('Error', 'Payment failed. Please try again.');
//       } else {
//         // Payment successful - update premium status
//         const result = await updatePremiumStatus(userId, true);
//         if ('error' in result && result.error) {
//           console.error('Premium status update error:', result.error);
//           Alert.alert('Error', 'Payment successful but failed to update premium status. Please contact support.');
//           return;
//         }
        
//         // Navigate to success screen
//         navigation.reset({
//           index: 0,
//           routes: [{ name: 'PaymentSuccessScreen' }],
//         });
//       }
//     } catch (error) {
//       console.error('Payment process error:', error);
//       Alert.alert('Error', error.message || 'An unexpected error occurred. Please try again.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
//       <View style={styles.header}>
//         <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
//           <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} />
//         </TouchableOpacity>
//         <Text style={styles.headerTitle}>Payment Details</Text>
//         <View style={{ width: 32 }} />
//       </View>

//       <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
//         <Text style={styles.title}>Enter Payment Details</Text>
//         <Text style={styles.description}>
//           Complete your premium subscription payment
//         </Text>

//         <View style={styles.priceContainer}>
//           <Text style={styles.price}>$4.99</Text>
//           <Text style={styles.period}>per month</Text>
//         </View>

//         <View style={styles.cardInputContainer}>
//           <Text style={styles.inputLabel}>Card Number</Text>
//           <TextInput
//             style={styles.input}
//             placeholder="XXXX XXXX XXXX XXXX"
//             value={cardDetails.cardNumber}
//             onChangeText={handleCardNumberChange}
//             keyboardType="number-pad"
//             maxLength={19}
//           />
//         </View>

//         <View style={styles.rowContainer}>
//           <View style={[styles.cardInputContainer, { flex: 1, marginRight: 8 }]}>
//             <Text style={styles.inputLabel}>Expiry Date</Text>
//             <TextInput
//               style={styles.input}
//               placeholder="MM/YY"
//               value={cardDetails.expiry}
//               onChangeText={handleExpiryChange}
//               keyboardType="number-pad"
//               maxLength={5}
//             />
//           </View>

//           <View style={[styles.cardInputContainer, { flex: 1, marginLeft: 8 }]}>
//             <Text style={styles.inputLabel}>CVV</Text>
//             <TextInput
//               style={styles.input}
//               placeholder="CVV"
//               value={cardDetails.cvv}
//               onChangeText={handleCVVChange}
//               keyboardType="number-pad"
//               maxLength={4}
//               secureTextEntry
//             />
//           </View>
//         </View>

//         <View style={styles.cardInputContainer}>
//           <Text style={styles.inputLabel}>Cardholder Name</Text>
//           <TextInput
//             style={styles.input}
//             placeholder="Name as it appears on card"
//             value={cardDetails.name}
//             onChangeText={(text) => setCardDetails(prev => ({ ...prev, name: text }))}
//             autoCapitalize="words"
//           />
//         </View>

//         <TouchableOpacity
//           style={[styles.button, loading && styles.buttonDisabled]}
//           onPress={handlePayment}
//           disabled={loading}
//         >
//           {loading ? (
//             <ActivityIndicator color="#FFFFFF" />
//           ) : (
//             <Text style={styles.buttonText}>Complete Payment</Text>
//           )}
//         </TouchableOpacity>
//       </ScrollView>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#FFFFFF',
//   },
//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     borderBottomWidth: 1,
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
//   scrollContent: {
//     padding: 20,
//   },
//   title: {
//     fontSize: 24,
//     fontWeight: 'bold',
//     marginBottom: 10,
//     color: '#000000',
//     textAlign: 'center',
//   },
//   description: {
//     fontSize: 16,
//     textAlign: 'center',
//     marginBottom: 30,
//     color: '#666666',
//   },
//   priceContainer: {
//     alignItems: 'center',
//     marginBottom: 30,
//   },
//   price: {
//     fontSize: 48,
//     fontWeight: 'bold',
//     color: APP_CONSTANTS.COLORS.PRIMARY,
//   },
//   period: {
//     fontSize: 16,
//     color: '#666666',
//   },
//   cardInputContainer: {
//     marginBottom: 20,
//   },
//   inputLabel: {
//     fontSize: 14,
//     fontWeight: '600',
//     color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
//     marginBottom: 8,
//   },
//   input: {
//     backgroundColor: '#FFFFFF',
//     paddingHorizontal: 15,
//     paddingVertical: 12,
//     borderRadius: 8,
//     fontSize: 16,
//     borderWidth: 1,
//     borderColor: APP_CONSTANTS.COLORS.BORDER,
//     color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
//   },
//   rowContainer: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//   },
//   button: {
//     backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
//     paddingVertical: 16,
//     borderRadius: 12,
//     alignItems: 'center',
//     marginTop: 20,
//   },
//   buttonDisabled: {
//     opacity: 0.7,
//   },
//   buttonText: {
//     color: '#FFFFFF',
//     fontSize: 16,
//     fontWeight: 'bold',
//   },
// });

// export default PremiumSignupScreen;


import React, { useState, useEffect } from 'react'; // Added useEffect
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView, // Keep ScrollView if you have other content
} from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native'; // Import types
import { supabase } from '@/lib/supabase';
import { APP_CONSTANTS } from '@/config/constants';
import { useAuth } from '@/hooks/useAuth';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { MainStackParamList } from '@/navigation/AppNavigator'; // Adjust to your types

type PremiumSignupScreenRouteProp = RouteProp<MainStackParamList, 'PremiumSignupScreen'>;
type PremiumSignupNavigationProp = NavigationProp<MainStackParamList>;

// --- Get your Stripe Price ID ---
// This is the ID of the "Premium Monthly" (or yearly) price you created in the Stripe Dashboard
// Example: price_1PeLFaLg12345678abcdefgh
const PREMIUM_PLAN_PRICE_ID = 'price_1ROtS1DHMm6OC3yQAkqDjUWd'; // Your actual Price ID

const PremiumSignupScreen = () => {
  const [loading, setLoading] = useState(false); // For overall process
  const [paymentInProgress, setPaymentInProgress] = useState(false); // For when payment sheet is active

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
        body: JSON.stringify({ // Ensure body is stringified if your function expects raw JSON
          priceId: PREMIUM_PLAN_PRICE_ID, // Use the constant
          userId,
          userEmail,
          // DO NOT SEND cardDetails
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
      return data; // Expects { paymentIntentClientSecret, ephemeralKey, customerId, publishableKey (optional) }

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
      returnURL: 'vybr://stripe-redirect', // Make sure this URL scheme is configured
    });

    setLoading(false); // Done with initial loading

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
      // Payment successful - update premium status (your backend webhook should ideally do this robustly)
      const result = await updatePremiumStatus(userId, true); // Pass true to indicate it's not part of initial signup flow that redirects
      if ('error' in result && result.error) {
        console.error('Premium status update error:', result.error);
        Alert.alert('Warning', 'Payment successful but there was an issue auto-updating your status. It will update shortly. If not, please contact support.');
      }

      // Navigate to success screen or main app
      navigation.reset({
        index: 0,
        // routes: [{ name: 'PaymentSuccessScreen' }], // Or back to a relevant part of your app
        routes: [{ name: 'MainApp', params: { screen: 'UserTabs', params: { screen: 'Profile', params: { paymentSuccess: true }} } }], // Example
      });
    }
  };


  // Use useEffect to initialize payment when the screen loads
  useEffect(() => {
    initializeAndPresentPaymentSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              onPress={initializeAndPresentPaymentSheet} // Retry button
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
  // ... (Keep existing styles for header, container, button, etc.)
  content: {
    flex: 1,
  },
  scrollContentCenter: { // For centering loading/error states
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
    backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND_LIGHT, // Lighter background
    borderWidth: 1,
    borderColor: APP_CONSTANTS.COLORS.BORDER,
  },
  cancelButtonText: {
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
  },
  // Remove styles related to card input fields if no other content is on the screen
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
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Or your app's background
  },
});

export default PremiumSignupScreen;