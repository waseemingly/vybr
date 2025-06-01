
// import React, { useState, useEffect } from 'react';
// import {
//     View, Text, StyleSheet, TouchableOpacity, Alert,
//     ActivityIndicator, Platform, ScrollView
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { Feather } from '@expo/vector-icons';
// import { useNavigation, NavigationProp } from '@react-navigation/native';
// import { APP_CONSTANTS } from '../../config/constants';
// import { useAuth } from '../../hooks/useAuth'; // To get organizerId and email
// import { supabase } from '../../lib/supabase'; // To call Supabase functions

// // --- Stripe Imports ---
// import { useStripe as useNativeStripe } from '@stripe/stripe-react-native';
// import { loadStripe, StripeElementsOptions, Appearance } from '@stripe/stripe-js';
// import { Elements, PaymentElement, useStripe as useWebStripe, useElements } from '@stripe/react-stripe-js';

// import type { RootStackParamList } from '../../navigation/AppNavigator'; // Adjust path

// // --- Stripe Configuration ---
// const STRIPE_PUBLISHABLE_KEY_NATIVE = 'pk_test_YOUR_NATIVE_PUBLISHABLE_KEY_HERE'; // REPLACE
// const STRIPE_PUBLISHABLE_KEY_WEB = 'pk_test_YOUR_WEB_PUBLISHABLE_KEY_HERE';       // REPLACE
// const stripePromiseWeb = Platform.OS === 'web' ? loadStripe(STRIPE_PUBLISHABLE_KEY_WEB) : null;

// type OrgManagePlanNavigationProp = NavigationProp<RootStackParamList>;

// // --- Internal Web SetupIntent Form ---
// const StripeSetupFormWebManage = ({ clientSecret, onSetupSuccess, onSetupError }: {
//     clientSecret: string;
//     onSetupSuccess: (setupIntentId: string) => void;
//     onSetupError: (errorMsg: string) => void;
// }) => {
//     const stripe = useWebStripe();
//     const elements = useElements();
//     const [isProcessingWebPayment, setIsProcessingWebPayment] = useState(false);
//     const [errorMessageWeb, setErrorMessageWeb] = useState<string | null>(null);
//     const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);

//     const handleSubmitWeb = async () => {
//         if (!stripe || !elements) {
//             onSetupError('Payment system not ready.');
//             return;
//         }
//         setIsProcessingWebPayment(true);
//         setErrorMessageWeb(null);

//         const returnUrl = `${window.location.origin}/organizer-payment-method-update-complete`; // Specific return URL

//         const { error, setupIntent } = await stripe.confirmSetup({
//             elements,
//             confirmParams: { return_url: returnUrl },
//         });

//         if (error) {
//             setErrorMessageWeb(error.message || 'An error occurred.');
//             onSetupError(error.message || 'An error occurred.');
//             setIsProcessingWebPayment(false);
//         } else if (setupIntent) {
//             if (setupIntent.status === 'succeeded') {
//                 onSetupSuccess(setupIntent.id);
//             } else if (setupIntent.status === 'requires_action' || setupIntent.status === 'requires_confirmation') {
//                 // Stripe handles redirect
//             } else {
//                 setErrorMessageWeb(`Setup failed: ${setupIntent.status}`);
//                 onSetupError(`Setup failed: ${setupIntent.status}`);
//                 setIsProcessingWebPayment(false);
//             }
//         } else { /* Stripe likely redirected */ }
//         // If not redirecting & not succeeded immediately
//         if (!error && setupIntent && setupIntent.status !== 'succeeded' && setupIntent.status !== 'requires_action' && setupIntent.status !== 'requires_confirmation') {
//             setIsProcessingWebPayment(false);
//        }
//     };

//     return (
//         <View style={styles.webFormContainer}>
//             <Text style={styles.inputLabel}>Update Payment Method</Text>
//             <PaymentElement
//                 onReady={() => setIsPaymentElementReady(true)}
//                 onChange={(event) => setErrorMessageWeb(event.error ? event.error.message : null)}
//             />
//             <TouchableOpacity
//                 style={[styles.button, { marginTop: 20 }, (isProcessingWebPayment || !isPaymentElementReady) && styles.buttonDisabled]}
//                 onPress={handleSubmitWeb}
//                 disabled={!stripe || !elements || isProcessingWebPayment || !isPaymentElementReady}
//             >
//                 {isProcessingWebPayment ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Save New Card</Text>}
//             </TouchableOpacity>
//             {errorMessageWeb && <Text style={styles.errorTextWeb}>{errorMessageWeb}</Text>}
//             {!isPaymentElementReady && !errorMessageWeb && (
//                 <View style={styles.loadingMessageContainer}><ActivityIndicator /><Text style={styles.loadingTextUi}>Loading form...</Text></View>
//             )}
//         </View>
//     );
// };


// const OrgManagePlanScreen: React.FC = () => {
//     const navigation = useNavigation<OrgManagePlanNavigationProp>();
//     const { session, organizerProfile, loading: authLoading, refreshUserProfile } = useAuth(); // Use organizerProfile
//     const { initPaymentSheet, presentPaymentSheet } = useNativeStripe();

//     const [isLoadingUI, setIsLoadingUI] = useState(false); // For fetching SI params, etc.
//     const [isStripeActionActive, setIsStripeActionActive] = useState(false); // For when Stripe's UI is active
//     const [setupIntentParams, setSetupIntentParams] = useState<{ clientSecret: string; customerId: string; ephemeralKey?: string; } | null>(null);
//     const [currentPaymentMethod, setCurrentPaymentMethod] = useState<{ brand: string; last4: string; expMonth: number; expYear: number } | null>(null);
//     const [error, setError] = useState<string|null>(null);

//     const organizerId = session?.user?.id;
//     const organizerEmail = session?.user?.email; // Or organizerProfile?.email if more reliable

//     // Fetch current default payment method and prepare for adding a new one
//     const loadInitialDataAndPrepareSetup = async () => {
//         if (!organizerId || !organizerEmail) {
//             Alert.alert("Error", "Organizer details not found. Please re-login.");
//             setError("User details missing.");
//             return;
//         }
//         setIsLoadingUI(true);
//         setError(null);
//         setSetupIntentParams(null);

//         try {
//             // 1. Fetch/Create SetupIntent (backend creates/retrieves Stripe Customer)
//             console.log('[OrgManagePlan] Fetching SetupIntent for user:', organizerId);
//             const { data: siData, error: siError } = await supabase.functions.invoke('create-organizer-setup-intent', {
//                 body: JSON.stringify({
//                     userId: organizerId,
//                     email: organizerEmail,
//                     companyName: organizerProfile?.company_name || '', // Pass company name
//                 }),
//             });

//             if (siError) throw new Error(siError.message || "Failed to prepare payment method setup.");
//             if (!siData?.clientSecret || !siData?.customerId) throw new Error("Invalid setup details from server.");

//             setSetupIntentParams({
//                 clientSecret: siData.clientSecret,
//                 customerId: siData.customerId,
//                 ephemeralKey: siData.ephemeralKey,
//             });
//             console.log('[OrgManagePlan] SetupIntent params received:', siData);

//             // 2. (Optional but good UX) Fetch current default payment method for display
//             // Your backend 'create-organizer-setup-intent' could also return this if customer exists.
//             // Or create a new function: 'get-organizer-default-payment-method'
//             if (organizerProfile?.stripe_customer_id) {
//                  console.log('[OrgManagePlan] Fetching current payment method for customer:', organizerProfile.stripe_customer_id);
//                 const { data: pmData, error: pmError } = await supabase.functions.invoke('get-organizer-payment-method-details', {
//                     body: JSON.stringify({ customerId: organizerProfile.stripe_customer_id })
//                 });
//                 if (pmError) console.warn("Could not fetch current payment method:", pmError.message);
//                 if (pmData?.paymentMethod) {
//                     setCurrentPaymentMethod(pmData.paymentMethod);
//                     console.log('[OrgManagePlan] Current payment method:', pmData.paymentMethod);
//                 } else {
//                     console.log('[OrgManagePlan] No default payment method found or returned.');
//                     setCurrentPaymentMethod(null);
//                 }
//             }

//         } catch (e: any) {
//             console.error("Error in loadInitialDataAndPrepareSetup:", e);
//             setError(e.message);
//             Alert.alert("Error", `Could not load payment setup: ${e.message}`);
//         } finally {
//             setIsLoadingUI(false);
//         }
//     };

//     useEffect(() => {
//         loadInitialDataAndPrepareSetup();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//     }, [organizerId, organizerEmail]); // Re-fetch if user changes

//     const handleMobileSetupPaymentMethod = async () => {
//         if (!setupIntentParams?.clientSecret || !setupIntentParams?.customerId || !setupIntentParams?.ephemeralKey) {
//             Alert.alert("Error", "Payment setup details are not ready. Please try again.");
//             return;
//         }
//         setIsStripeActionActive(true);
//         try {
//             const { error: initError } = await initPaymentSheet({
//                 merchantDisplayName: 'VYBR Organizer',
//                 customerId: setupIntentParams.customerId,
//                 customerEphemeralKeySecret: setupIntentParams.ephemeralKey,
//                 setupIntentClientSecret: setupIntentParams.clientSecret,
//                 allowsDelayedPaymentMethods: true,
//                 returnURL: 'vybr://stripe-redirect-organizer-manage', // Specific return URL
//             });
//             if (initError) throw new Error(`Init Error: ${initError.message}`);

//             const { error: presentError, setupIntent } = await presentPaymentSheet();
//             if (presentError) {
//                 if (presentError.code !== 'Canceled') throw new Error(`Present Error: ${presentError.message}`);
//                 else Alert.alert("Canceled", "Payment method setup canceled.");
//             } else if (setupIntent?.status === 'Succeeded') {
//                 Alert.alert("Success!", "Your payment method has been saved.");
//                 // Refresh user profile to get updated Stripe customer details (like new default PM)
//                 if(refreshUserProfile) await refreshUserProfile();
//                 await loadInitialDataAndPrepareSetup(); // Re-fetch to display new card
//             } else {
//                 Alert.alert("Notice", `Setup status: ${setupIntent?.status}.`);
//             }
//         } catch (e: any) {
//             Alert.alert("Error", `Payment method setup failed: ${e.message}`);
//         } finally {
//             setIsStripeActionActive(false);
//         }
//     };

//     // For Stripe Customer Portal to manage ALL saved methods, billing history etc.
//     const handleOpenStripeBillingPortal = async () => {
//         if (!organizerProfile?.stripe_customer_id) {
//             Alert.alert("Not Available", "No billing account found. Please add a payment method first.");
//             return;
//         }
//         setIsLoadingUI(true);
//         try {
//             const { data, error } = await supabase.functions.invoke('create-stripe-portal-session-organizer', {
//                 body: JSON.stringify({
//                     stripeCustomerId: organizerProfile.stripe_customer_id,
//                     // Your app's URL where user returns after portal session
//                     returnUrl: Platform.OS === 'web' ? window.location.href : 'vybr://org-profile/settings'
//                 })
//             });
//             if (error) throw error;
//             if (data?.url) {
//                 // For web, redirect. For mobile, open in WebView or InAppBrowser.
//                 if (Platform.OS === 'web') {
//                     window.location.href = data.url;
//                 } else {
//                     // Consider using InAppBrowser for mobile
//                     Alert.alert("Redirecting to Stripe...", "You will be redirected to Stripe to manage your billing information.", [{text: "OK", onPress: () => Linking.openURL(data.url)}]);
//                 }
//             } else {
//                 throw new Error("Could not open billing portal.");
//             }
//         } catch (e: any) {
//             Alert.alert("Error", `Could not open billing portal: ${e.message}`);
//         } finally {
//             setIsLoadingUI(false);
//         }
//     };


//     // --- RENDER ---
//     if (authLoading || (!organizerId && !isLoadingUI)) {
//         return <SafeAreaView style={styles.centeredMessage}><ActivityIndicator size="large" /><Text>Loading user...</Text></SafeAreaView>;
//     }
//     if (!organizerId && !authLoading) {
//          return <SafeAreaView style={styles.centeredMessage}><Text>Please log in to manage payment methods.</Text></SafeAreaView>;
//     }


//     return (
//         <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
//             <View style={styles.header}>
//                 <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-left" size={24} /></TouchableOpacity>
//                 <Text style={styles.headerTitle}>Payment Method</Text>
//                 <View style={{ width: 32 }} />
//             </View>

//             <ScrollView contentContainerStyle={styles.scrollContent}>
//                 {isLoadingUI && !setupIntentParams && ( // Show loader only when fetching SI params
//                     <View style={styles.centeredMessage}><ActivityIndicator size="large" /><Text style={styles.loadingTextUi}>Loading payment settings...</Text></View>
//                 )}

//                 {error && !isLoadingUI && (
//                      <View style={styles.errorBox}><Text style={styles.errorTextUi}>{error}</Text></View>
//                 )}

//                 {!isLoadingUI && currentPaymentMethod && (
//                     <View style={styles.card}>
//                         <Text style={styles.sectionTitle}>Current Payment Method</Text>
//                         <View style={styles.paymentMethodDetails}>
//                             <Feather name="credit-card" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
//                             <View style={styles.cardTextContainer}>
//                                 <Text style={styles.cardBrand}>{currentPaymentMethod.brand.toUpperCase()}</Text>
//                                 <Text style={styles.cardLast4}>**** **** **** {currentPaymentMethod.last4}</Text>
//                             </View>
//                             <Text style={styles.cardExpiry}>Expires {String(currentPaymentMethod.expMonth).padStart(2, '0')}/{currentPaymentMethod.expYear.toString().slice(-2)}</Text>
//                         </View>
//                         <TouchableOpacity style={[styles.button, styles.manageButton]} onPress={handleOpenStripeBillingPortal}>
//                             <Text style={styles.buttonText}>Manage All Payment Methods</Text>
//                         </TouchableOpacity>
//                          <Text style={styles.infoText}>Use the portal to update, remove, or view billing history.</Text>
//                     </View>
//                 )}

//                 {!isLoadingUI && !currentPaymentMethod && !error && (
//                     <View style={styles.card}>
//                          <Text style={styles.sectionTitle}>No Payment Method</Text>
//                          <Text style={styles.infoText}>You don't have a payment method saved yet. Add one to enable billing for services like ad impressions and ticket commissions.</Text>
//                     </View>
//                 )}


//                 {/* Stripe UI for adding/updating card (only if SI params are loaded) */}
//                 {!isLoadingUI && setupIntentParams?.clientSecret && (
//                     <View style={[styles.card, {marginTop: 20}]}>
//                         <Text style={styles.sectionTitle}>
//                             {currentPaymentMethod ? 'Update Payment Method' : 'Add Payment Method'}
//                         </Text>
//                         {Platform.OS !== 'web' ? (
//                             <TouchableOpacity
//                                 style={[styles.button, isStripeActionActive && styles.buttonDisabled]}
//                                 onPress={handleMobileSetupPaymentMethod}
//                                 disabled={isStripeActionActive}
//                             >
//                                 {isStripeActionActive ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{currentPaymentMethod ? 'Update Card' : 'Add Card via Stripe'}</Text>}
//                             </TouchableOpacity>
//                         ) : stripePromiseWeb && setupIntentParams.clientSecret ? (
//                             <Elements stripe={stripePromiseWeb} options={{ clientSecret: setupIntentParams.clientSecret, appearance: {theme: 'stripe'} }}>
//                                 <StripeSetupFormWebManage
//                                     clientSecret={setupIntentParams.clientSecret}
//                                     onSetupSuccess={async (setupIntentId) => {
//                                         Alert.alert("Success!", "Payment method saved.");
//                                         if(refreshUserProfile) await refreshUserProfile();
//                                         await loadInitialDataAndPrepareSetup(); // Refresh to show new card
//                                     }}
//                                     onSetupError={(errMsg) => Alert.alert("Error", `Failed to save card: ${errMsg}`)}
//                                 />
//                             </Elements>
//                         ) : (
//                             <Text>Loading web payment form...</Text>
//                         )}
//                          <Text style={styles.infoText}>Your card details are securely handled by Stripe.</Text>
//                     </View>
//                 )}
//                 {/* Error display if SI params failed to load */}
//                  {!isLoadingUI && !setupIntentParams && error && (
//                     <View style={styles.card}>
//                         <Text style={styles.sectionTitle}>Setup Failed</Text>
//                         <Text style={styles.infoText}>Could not prepare payment setup. Please try refreshing the page or contact support if the issue persists.</Text>
//                         <TouchableOpacity style={[styles.button, {backgroundColor: APP_CONSTANTS.COLORS.WARNING}]} onPress={loadInitialDataAndPrepareSetup}>
//                             <Text style={styles.buttonText}>Retry Setup</Text>
//                         </TouchableOpacity>
//                     </View>
//                 )}

//             </ScrollView>
//         </SafeAreaView>
//     );
// };

// const styles = StyleSheet.create({
//     container: { flex: 1, backgroundColor: '#F4F7FC' },
//     header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: 'white' },
//     backButton: { padding: 4 },
//     headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A202C' },
//     scrollContent: { padding: 16, flexGrow: 1 },
//     card: { backgroundColor: 'white', borderRadius: 12, padding: 20, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2, }, shadowOpacity: 0.08, shadowRadius: 5, elevation: 3, },
//     sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#2D3748', marginBottom: 16, },
//     infoText: { fontSize: 14, color: '#718096', lineHeight: 20, marginTop: 12, textAlign: 'center' },
//     button: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10, flexDirection: 'row' },
//     buttonText: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: Platform.OS === 'android' ? 8 : 0 },
//     buttonDisabled: { opacity: 0.7 },
//     centeredMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
//     paymentMethodDetails: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EDF2F7', padding: 15, borderRadius: 8, marginBottom: 15, },
//     cardTextContainer: { flex: 1, marginLeft: 15 },
//     cardBrand: { fontSize: 16, fontWeight: 'bold', color: '#2D3748' },
//     cardLast4: { fontSize: 15, color: '#4A5568' },
//     cardExpiry: { fontSize: 14, color: '#718096' },
//     manageButton: { backgroundColor: '#4A5568' },
//     webFormContainer: { marginTop: 10, padding: 10, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
//     errorTextWeb: { color: 'red', textAlign: 'center', marginTop: 10, fontSize: 14 },
//     errorBox: { backgroundColor: '#FFF5F5', padding: 15, borderRadius: 8, borderWidth:1, borderColor: '#FED7D7', marginBottom: 20, alignItems: 'center'},
//     errorTextUi: { color: '#C53030', fontSize: 15, textAlign: 'center'},
//     loadingTextUi: { marginTop: 10, fontSize: 15, color: '#718096'},
//     inputLabel: { fontSize: 14, fontWeight: '600', color: '#2D3748', marginBottom: 8, alignSelf: 'flex-start'},
//     loadingMessageContainer: { alignItems: 'center', paddingVertical: 10, }
// });

// export default OrgManagePlanScreen;

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Alert,
    ActivityIndicator, Platform, ScrollView, Linking // Added Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, NavigationProp, useFocusEffect } from '@react-navigation/native'; // Added useFocusEffect
import { APP_CONSTANTS } from '../../config/constants';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

// --- Stripe Imports ---
import { useStripe as useNativeStripe } from '@stripe/stripe-react-native';
import { loadStripe, StripeElementsOptions, Appearance } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe as useWebStripe, useElements } from '@stripe/react-stripe-js';

import type { RootStackParamList } from '../../navigation/AppNavigator';

// --- Stripe Configuration ---
// IMPORTANT: REPLACE WITH YOUR ACTUAL KEYS
const STRIPE_PUBLISHABLE_KEY_NATIVE = "pk_test_51RDGZpDHMm6OC3yQwI460w1bESyWDQoSdNLBU9TOhciyc7NlbJ5upgCTJsP6OAuYt8cUeywcbkwQGCBI7VDCMNuz00qld2OSdN"
const STRIPE_PUBLISHABLE_KEY_WEB = "pk_test_51RDGZpDHMm6OC3yQwI460w1bESyWDQoSdNLBU9TOhciyc7NlbJ5upgCTJsP6OAuYt8cUeywcbkwQGCBI7VDCMNuz00qld2OSdN";
const stripePromiseWeb = Platform.OS === 'web' ? loadStripe(STRIPE_PUBLISHABLE_KEY_WEB) : null;

type OrgManagePlanNavigationProp = NavigationProp<RootStackParamList>;

// --- Internal Web SetupIntent Form ---
const StripeSetupFormWebManage = ({ clientSecret, onSetupSuccess, onSetupError, currentCardExists }: {
    clientSecret: string;
    onSetupSuccess: (setupIntentId: string) => void;
    onSetupError: (errorMsg: string) => void;
    currentCardExists: boolean;
}) => {
    const stripe = useWebStripe();
    const elements = useElements();
    const [isProcessingWebPayment, setIsProcessingWebPayment] = useState(false);
    const [errorMessageWeb, setErrorMessageWeb] = useState<string | null>(null);
    const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);

    useEffect(() => {
        // Log if PaymentElement doesn't fire onReady for a while
        const timer = setTimeout(() => {
            if (!isPaymentElementReady) {
                console.warn('[StripeSetupFormWebManage] PaymentElement onReady has not fired after 5 seconds. Check clientSecret and network.');
            }
        }, 5000);
        return () => clearTimeout(timer);
    }, [isPaymentElementReady]);


    const handleSubmitWeb = async () => {
        if (!stripe || !elements || !isPaymentElementReady) {
            onSetupError('Payment system not ready or still loading. Please wait.');
            return;
        }
        setIsProcessingWebPayment(true);
        setErrorMessageWeb(null);
        console.log('[StripeSetupFormWebManage] handleSubmitWeb called');

        // For web, ensure your app can handle this redirect URL path
        const returnUrl = `${window.location.origin}/organizer-payment-method-update-complete`;
        console.log('[StripeSetupFormWebManage] Using return_url:', returnUrl);


        const { error, setupIntent } = await stripe.confirmSetup({
            elements,
            confirmParams: { return_url: returnUrl },
        });

        if (error) {
            console.error('[StripeSetupFormWebManage] stripe.confirmSetup immediate error:', error);
            setErrorMessageWeb(error.message || 'An error occurred while saving your card.');
            onSetupError(error.message || 'An error occurred.');
            setIsProcessingWebPayment(false);
        } else if (setupIntent) {
            console.log('[StripeSetupFormWebManage] stripe.confirmSetup returned setupIntent. Status:', setupIntent.status);
            if (setupIntent.status === 'succeeded') {
                console.log('[StripeSetupFormWebManage] Payment method setup Succeeded directly.');
                onSetupSuccess(setupIntent.id);
            } else if (setupIntent.status === 'requires_action' || setupIntent.status === 'requires_confirmation') {
                console.log('[StripeSetupFormWebManage] Payment method setup requires further action. Stripe should handle redirect.');
                // setIsProcessingWebPayment(false) will be handled if redirect doesn't occur, or component unmounts
            } else {
                setErrorMessageWeb(`Setup failed. Status: ${setupIntent.status}. Please try again or use a different card.`);
                onSetupError(`Setup status: ${setupIntent.status}`);
                setIsProcessingWebPayment(false);
            }
        } else {
            console.log('[StripeSetupFormWebManage] Stripe likely redirected. Outcome to be handled on return_url page.');
            // setIsProcessingWebPayment(false) will be handled if redirect doesn't occur, or component unmounts
        }
        // If not redirecting and setupIntent didn't succeed immediately, allow retry
        if (!error && setupIntent && setupIntent.status !== 'succeeded' && setupIntent.status !== 'requires_action' && setupIntent.status !== 'requires_confirmation') {
             setIsProcessingWebPayment(false);
        }
    };

    return (
        <View style={styles.webFormContainer}>
            {/* Title changes based on whether a card exists */}
            <Text style={styles.inputLabel}>{currentCardExists ? 'Enter New Card Details' : 'Securely Add Your Card'}</Text>
            {!isPaymentElementReady && (
                <View style={styles.loadingMessageContainer}><ActivityIndicator /><Text style={styles.loadingTextUi}>Loading payment form...</Text></View>
            )}
            <View style={{ display: isPaymentElementReady ? 'flex' : 'none' }}> {/* Hide PaymentElement until ready */}
                <PaymentElement
                    onReady={() => {
                        console.log('%c[StripeSetupFormWebManage] PaymentElement onReady FIRED!', 'color: green; font-weight: bold;');
                        setIsPaymentElementReady(true);
                    }}
                    onChange={(event) => setErrorMessageWeb(event.error ? event.error.message : null)}
                />
            </View>
            <TouchableOpacity
                style={[styles.button, { marginTop: 20 }, (isProcessingWebPayment || !isPaymentElementReady) && styles.buttonDisabled]}
                onPress={handleSubmitWeb}
                disabled={!stripe || !elements || isProcessingWebPayment || !isPaymentElementReady}
            >
                {isProcessingWebPayment ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Save Card</Text>}
            </TouchableOpacity>
            {errorMessageWeb && <Text style={styles.errorTextWeb}>{errorMessageWeb}</Text>}
        </View>
    );
};

const OrgManagePlanScreen: React.FC = () => {
    const navigation = useNavigation<OrgManagePlanNavigationProp>();
    const { session, organizerProfile, loading: authLoading, refreshUserProfile } = useAuth();
    const { initPaymentSheet, presentPaymentSheet } = useNativeStripe();

    const [isLoadingData, setIsLoadingData] = useState(true); // Combined loading for initial data and SI params
    const [isStripeActionActive, setIsStripeActionActive] = useState(false);
    const [setupIntentParams, setSetupIntentParams] = useState<{ clientSecret: string; customerId: string; ephemeralKey?: string; } | null>(null);
    const [currentPaymentMethod, setCurrentPaymentMethod] = useState<{ brand: string; last4: string; expMonth: number; expYear: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showAddUpdateForm, setShowAddUpdateForm] = useState(false); // To toggle Stripe form visibility

    const organizerId = session?.user?.id;
    const organizerEmail = session?.user?.email || organizerProfile?.email; // Prioritize session email

    const loadData = useCallback(async () => {
        if (!organizerId || !organizerEmail) {
            setError("Organizer details not found. Please ensure you are logged in.");
            setIsLoadingData(false);
            return;
        }
        setIsLoadingData(true);
        setError(null);
        setCurrentPaymentMethod(null); // Reset
        setSetupIntentParams(null);    // Reset

        try {
            console.log(`[OrgManagePlan] loadData for user: ${organizerId}`);

            // Fetch current payment method details FIRST
            if (organizerProfile?.stripe_customer_id) {
                console.log('[OrgManagePlan] Fetching current payment method for customer:', organizerProfile.stripe_customer_id);
                const { data: pmData, error: pmError } = await supabase.functions.invoke('get-organizer-payment-method-details', {
                    body: JSON.stringify({ customerId: organizerProfile.stripe_customer_id })
                });
                if (pmError) {
                    console.warn("Could not fetch current payment method details:", pmError.message);
                    // Don't throw, allow user to add a new one
                }
                if (pmData?.paymentMethod) {
                    setCurrentPaymentMethod(pmData.paymentMethod);
                    console.log('[OrgManagePlan] Current payment method found:', pmData.paymentMethod);
                } else {
                    console.log('[OrgManagePlan] No default payment method found.');
                }
            } else {
                console.log('[OrgManagePlan] No Stripe Customer ID on profile yet.');
            }

            // Fetch/Create SetupIntent for adding/updating
            console.log('[OrgManagePlan] Fetching SetupIntent params...');
            const { data: siData, error: siError } = await supabase.functions.invoke('create-organizer-setup-intent', {
                body: JSON.stringify({
                    userId: organizerId,
                    email: organizerEmail,
                    companyName: organizerProfile?.company_name || '',
                }),
            });

            if (siError) throw new Error(siError.message || "Failed to prepare payment method setup.");
            if (!siData?.clientSecret || !siData?.customerId) throw new Error("Invalid setup details from server for SetupIntent.");

            setSetupIntentParams({
                clientSecret: siData.clientSecret,
                customerId: siData.customerId,
                ephemeralKey: siData.ephemeralKey,
            });
            console.log('[OrgManagePlan] SetupIntent params received and set.');

        } catch (e: any) {
            console.error("Error in loadData:", e);
            setError(e.message || "An error occurred while loading payment settings.");
            Alert.alert("Loading Error", `Could not load payment settings: ${e.message}`);
        } finally {
            setIsLoadingData(false);
        }
    }, [organizerId, organizerEmail, organizerProfile?.stripe_customer_id, organizerProfile?.company_name]); // Dependencies

    useFocusEffect(
        useCallback(() => {
            console.log("[OrgManagePlan] Screen focused. Reloading data.");
            loadData();
        }, [loadData])
    );

    const handleMobileAddOrUpdateCard = async () => {
        if (!setupIntentParams?.clientSecret || !setupIntentParams?.customerId || !setupIntentParams?.ephemeralKey) {
            Alert.alert("Error", "Payment setup details are not ready. Please try refreshing.");
            return;
        }
        setIsStripeActionActive(true);
        try {
            const { error: initError } = await initPaymentSheet({
                merchantDisplayName: 'VYBR Organizer',
                customerId: setupIntentParams.customerId,
                customerEphemeralKeySecret: setupIntentParams.ephemeralKey,
                setupIntentClientSecret: setupIntentParams.clientSecret,
                allowsDelayedPaymentMethods: true,
                returnURL: 'vybr://stripe-redirect-organizer-manage',
            });
            if (initError) throw new Error(`Init Error: ${initError.message} (Code: ${initError.code})`);

            const { error: presentError, setupIntent } = await presentPaymentSheet();
            if (presentError) {
                if (presentError.code !== 'Canceled') throw new Error(`Present Error: ${presentError.message} (Code: ${presentError.code})`);
                else Alert.alert("Canceled", "Payment method setup canceled.");
            } else if (setupIntent?.status === 'succeeded') { // Lowercase 's'
                Alert.alert("Success!", "Your payment method has been saved.");
                if (refreshUserProfile) await refreshUserProfile(); // Refresh profile which might update stripe_customer_id
                await loadData(); // Re-fetch all data to show new card and get fresh SI
                setShowAddUpdateForm(false); // Hide form after success
            } else {
                Alert.alert("Notice", `Setup status: ${setupIntent?.status || 'Unknown'}. Please try again.`);
            }
        } catch (e: any) {
            Alert.alert("Error", `Payment method setup failed: ${e.message}`);
        } finally {
            setIsStripeActionActive(false);
        }
    };

    const handleOpenStripeBillingPortal = async () => {
        // ... (keep your existing handleOpenStripeBillingPortal logic)
         if (!organizerProfile?.stripe_customer_id) {
            Alert.alert("Billing Account Not Found", "Please add a payment method first to access the billing portal.");
            return;
        }
        setIsLoadingData(true); // Use general loading
        try {
            const { data, error } = await supabase.functions.invoke('create-stripe-portal-session-organizer', {
                body: JSON.stringify({
                    stripeCustomerId: organizerProfile.stripe_customer_id,
                    returnUrl: Platform.OS === 'web' ? `${window.location.origin}/org-settings/payment` : 'vybr://org-settings/payment' // Example return URL
                })
            });
            if (error) throw error;
            if (data?.url) {
                if (Platform.OS === 'web') {
                    window.location.href = data.url;
                } else {
                    const supported = await Linking.canOpenURL(data.url);
                    if (supported) {
                        await Linking.openURL(data.url);
                    } else {
                        Alert.alert("Error", "Cannot open URL. Please ensure you have a web browser installed.");
                    }
                }
            } else {
                throw new Error("Could not retrieve billing portal URL.");
            }
        } catch (e: any) {
            Alert.alert("Portal Error", `Could not open billing portal: ${e.message}`);
        } finally {
            setIsLoadingData(false);
        }
    };

    // --- RENDER LOGIC ---
    if (authLoading) {
        return <SafeAreaView style={styles.centeredMessage}><ActivityIndicator size="large" /><Text style={styles.loadingTextUi}>Loading user data...</Text></SafeAreaView>;
    }
    if (!organizerId && !authLoading) {
         return <SafeAreaView style={styles.centeredMessage}><Text style={styles.infoText}>Please log in to manage your payment method.</Text></SafeAreaView>;
    }
    if (isLoadingData && !currentPaymentMethod && !setupIntentParams) { // Initial full load
        return <SafeAreaView style={styles.centeredMessage}><ActivityIndicator size="large" /><Text style={styles.loadingTextUi}>Loading payment settings...</Text></SafeAreaView>;
    }

    const displayStripeForm = showAddUpdateForm && setupIntentParams?.clientSecret;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-left" size={24} /></TouchableOpacity>
                <Text style={styles.headerTitle}>Payment Method</Text>
                <View style={{ width: 32 }} />{/* Spacer */}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Display Error if initial data load failed */}
                {error && !isLoadingData && (
                    <View style={styles.errorBox}><Text style={styles.errorTextUi}>{error}</Text>
                     <TouchableOpacity style={[styles.button, {backgroundColor: APP_CONSTANTS.COLORS.WARNING, marginTop:10}]} onPress={loadData}>
                            <Text style={styles.buttonText}>Retry Loading</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Section to display current payment method */}
                {!isLoadingData && currentPaymentMethod && (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Current Payment Method</Text>
                        <View style={styles.paymentMethodDetails}>
                            <Feather name="credit-card" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
                            <View style={styles.cardTextContainer}>
                                <Text style={styles.cardBrand}>{currentPaymentMethod.brand.toUpperCase()}</Text>
                                <Text style={styles.cardLast4}>**** **** **** {currentPaymentMethod.last4}</Text>
                            </View>
                            <Text style={styles.cardExpiry}>Expires {String(currentPaymentMethod.expMonth).padStart(2, '0')}/{currentPaymentMethod.expYear.toString().slice(-2)}</Text>
                        </View>
                        {!showAddUpdateForm && (
                             <TouchableOpacity style={[styles.button, { marginTop: 15 }]} onPress={() => setShowAddUpdateForm(true)}>
                                <Text style={styles.buttonText}>Update Card</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Section if no payment method is saved */}
                {!isLoadingData && !currentPaymentMethod && !error && (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>No Payment Method Saved</Text>
                        <Text style={styles.infoText}>Add a payment method to enable billing for platform services like ad impressions and ticket commissions.</Text>
                        {!showAddUpdateForm && setupIntentParams && ( // Only show "Add Card" if form isn't already visible and params are ready
                            <TouchableOpacity style={[styles.button, { marginTop: 15 }]} onPress={() => setShowAddUpdateForm(true)}>
                                <Text style={styles.buttonText}>Add Payment Method</Text>
                            </TouchableOpacity>
                        )}
                         {!setupIntentParams && !error && ( // If SI params are still loading or failed
                            <View style={styles.centeredMessage}><ActivityIndicator /><Text style={styles.loadingTextUi}>Preparing form...</Text></View>
                        )}
                    </View>
                )}

                {/* Stripe UI form - shown when showAddUpdateForm is true and SI params are ready */}
                {displayStripeForm && (
                    <View style={[styles.card, { marginTop: 20 }]}>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                            <Text style={styles.sectionTitle}>
                                {currentPaymentMethod ? 'Enter New Card Details' : 'Add Your Card'}
                            </Text>
                            <TouchableOpacity onPress={() => setShowAddUpdateForm(false)} style={{padding: 5}}>
                                <Feather name="x" size={20} color={APP_CONSTANTS.COLORS.TEXT_SECONDARY} />
                            </TouchableOpacity>
                        </View>

                        {Platform.OS !== 'web' ? (
                            <TouchableOpacity
                                style={[styles.button, isStripeActionActive && styles.buttonDisabled]}
                                onPress={handleMobileAddOrUpdateCard}
                                disabled={isStripeActionActive || isLoadingData} // Disable if main data is loading too
                            >
                                {isStripeActionActive || isLoadingData ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Save Card Securely</Text>}
                            </TouchableOpacity>
                        ) : stripePromiseWeb && setupIntentParams.clientSecret ? (
                            <Elements stripe={stripePromiseWeb} options={{ clientSecret: setupIntentParams.clientSecret, appearance: { theme: 'stripe' } }}>
                                <StripeSetupFormWebManage
                                    clientSecret={setupIntentParams.clientSecret}
                                    currentCardExists={!!currentPaymentMethod}
                                    onSetupSuccess={async (setupIntentId) => {
                                        Alert.alert("Success!", "Payment method has been saved.");
                                        setShowAddUpdateForm(false);
                                        if (refreshUserProfile) await refreshUserProfile();
                                        await loadData(); // Refresh all data
                                    }}
                                    onSetupError={(errMsg) => {
                                        Alert.alert("Save Card Error", `Failed to save card: ${errMsg}`);
                                        // Optionally keep the form open for retry by not calling setShowAddUpdateForm(false)
                                    }}
                                />
                            </Elements>
                        ) : (
                            <View style={styles.centeredMessage}><Text style={styles.loadingTextUi}>Loading web payment form...</Text></View>
                        )}
                        <Text style={styles.infoText}>Your card details are securely processed and stored by Stripe.</Text>
                    </View>
                )}

                {/* Stripe Customer Portal Button - always show if stripe_customer_id exists */}
                {!isLoadingData && organizerProfile?.stripe_customer_id && (
                     <View style={[styles.card, {marginTop: displayStripeForm ? 10 : 20, backgroundColor: '#F9FAFB'}]}>
                         <Text style={styles.sectionTitle}>Manage Billing</Text>
                        <TouchableOpacity style={[styles.button, styles.manageButton]} onPress={handleOpenStripeBillingPortal} disabled={isLoadingData}>
                            {isLoadingData ? <ActivityIndicator color="#FFFFFF"/> : <Text style={styles.buttonText}>Open Stripe Billing Portal</Text> }
                        </TouchableOpacity>
                        <Text style={styles.infoText}>Use the Stripe portal to see all saved payment methods, manage subscriptions (if any), and view your billing history.</Text>
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
};

// --- STYLES --- (Keep your existing styles, ensure these are present or merged)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F4F7FC' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: 'white' },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A202C' },
    scrollContent: { padding: 16, flexGrow: 1, paddingBottom: 40 },
    card: { backgroundColor: 'white', borderRadius: 12, padding: 20, marginBottom: 20, shadowColor: "#9CA3AF", shadowOffset: { width: 0, height: 3, }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4, },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#2D3748', marginBottom: 16, },
    infoText: { fontSize: 13, color: '#718096', lineHeight: 18, marginTop: 12, textAlign: 'center' },
    button: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10, flexDirection: 'row' },
    buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
    buttonDisabled: { opacity: 0.6 },
    centeredMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, minHeight: 150 },
    paymentMethodDetails: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7FAFC', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    cardTextContainer: { flex: 1, marginLeft: 15 },
    cardBrand: { fontSize: 16, fontWeight: 'bold', color: '#2D3748', textTransform: 'capitalize' },
    cardLast4: { fontSize: 15, color: '#4A5568', letterSpacing: 1 },
    cardExpiry: { fontSize: 14, color: '#718096' },
    manageButton: { backgroundColor: '#4A5568' }, // A secondary color for manage portal
    webFormContainer: { marginTop: 10, paddingHorizontal: Platform.OS === 'web' ? 0 : 10, paddingVertical: 15, backgroundColor: '#FDFDFE', borderRadius: 8, borderWidth: 1, borderColor: '#EAF0F6' },
    errorTextWeb: { color: APP_CONSTANTS.COLORS.ERROR, textAlign: 'center', marginTop: 10, fontSize: 14 },
    errorBox: { backgroundColor: '#FFF5F5', padding: 15, borderRadius: 8, borderWidth:1, borderColor: '#FED7D7', marginBottom: 20, alignItems: 'center'},
    errorTextUi: { color: '#C53030', fontSize: 15, textAlign: 'center'},
    loadingTextUi: { marginTop: 10, fontSize: 15, color: '#718096'},
    inputLabel: { fontSize: 14, fontWeight: '600', color: '#2D3748', marginBottom: 8, alignSelf: 'flex-start'}, // For web form title
    loadingMessageContainer: { alignItems: 'center', paddingVertical: 20, } // For web form element loading
});

export default OrgManagePlanScreen;