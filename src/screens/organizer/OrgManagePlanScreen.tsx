

// import React, { useState, useEffect, useCallback } from 'react';
// import {
//     View, Text, StyleSheet, TouchableOpacity, Alert,
//     ActivityIndicator, Platform, ScrollView, Linking // Added Linking
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { Feather } from '@expo/vector-icons';
// import { useNavigation, NavigationProp, useFocusEffect } from '@react-navigation/native'; // Added useFocusEffect
// import { APP_CONSTANTS } from '../../config/constants';
// import { useAuth } from '../../hooks/useAuth';
// import { supabase } from '../../lib/supabase';

// // --- Stripe Imports ---
// import { useStripe as useNativeStripe } from '@stripe/stripe-react-native';
// import { loadStripe, StripeElementsOptions, Appearance } from '@stripe/stripe-js';
// import { Elements, PaymentElement, useStripe as useWebStripe, useElements } from '@stripe/react-stripe-js';

// import type { RootStackParamList } from '../../navigation/AppNavigator';

// // --- Stripe Configuration ---
// // IMPORTANT: REPLACE WITH YOUR ACTUAL KEYS
// const STRIPE_PUBLISHABLE_KEY_NATIVE = "pk_test_51RDGZpDHMm6OC3yQwI460w1bESyWDQoSdNLBU9TOhciyc7NlbJ5upgCTJsP6OAuYt8cUeywcbkwQGCBI7VDCMNuz00qld2OSdN"
// const STRIPE_PUBLISHABLE_KEY_WEB = "pk_test_51RDGZpDHMm6OC3yQwI460w1bESyWDQoSdNLBU9TOhciyc7NlbJ5upgCTJsP6OAuYt8cUeywcbkwQGCBI7VDCMNuz00qld2OSdN";
// const stripePromiseWeb = Platform.OS === 'web' ? loadStripe(STRIPE_PUBLISHABLE_KEY_WEB) : null;

// type OrgManagePlanNavigationProp = NavigationProp<RootStackParamList>;

// // --- Internal Web SetupIntent Form ---
// const StripeSetupFormWebManage = ({ clientSecret, onSetupSuccess, onSetupError, currentCardExists }: {
//     clientSecret: string;
//     onSetupSuccess: (setupIntentId: string) => void;
//     onSetupError: (errorMsg: string) => void;
//     currentCardExists: boolean;
// }) => {
//     const stripe = useWebStripe();
//     const elements = useElements();
//     const [isProcessingWebPayment, setIsProcessingWebPayment] = useState(false);
//     const [errorMessageWeb, setErrorMessageWeb] = useState<string | null>(null);
//     const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);

//     useEffect(() => {
//         // Log if PaymentElement doesn't fire onReady for a while
//         const timer = setTimeout(() => {
//             if (!isPaymentElementReady) {
//                 console.warn('[StripeSetupFormWebManage] PaymentElement onReady has not fired after 5 seconds. Check clientSecret and network.');
//             }
//         }, 5000);
//         return () => clearTimeout(timer);
//     }, [isPaymentElementReady]);


//     const handleSubmitWeb = async () => {
//         if (!stripe || !elements || !isPaymentElementReady) {
//             onSetupError('Payment system not ready or still loading. Please wait.');
//             return;
//         }
//         setIsProcessingWebPayment(true);
//         setErrorMessageWeb(null);
//         console.log('[StripeSetupFormWebManage] handleSubmitWeb called');

//         // For web, ensure your app can handle this redirect URL path
//         const returnUrl = `${window.location.origin}/organizer-payment-method-update-complete`;
//         console.log('[StripeSetupFormWebManage] Using return_url:', returnUrl);


//         const { error, setupIntent } = await stripe.confirmSetup({
//             elements,
//             confirmParams: { return_url: returnUrl },
//         });

//         if (error) {
//             console.error('[StripeSetupFormWebManage] stripe.confirmSetup immediate error:', error);
//             setErrorMessageWeb(error.message || 'An error occurred while saving your card.');
//             onSetupError(error.message || 'An error occurred.');
//             setIsProcessingWebPayment(false);
//         } else if (setupIntent) {
//             console.log('[StripeSetupFormWebManage] stripe.confirmSetup returned setupIntent. Status:', setupIntent.status);
//             if (setupIntent.status === 'succeeded') {
//                 console.log('[StripeSetupFormWebManage] Payment method setup Succeeded directly.');
//                 onSetupSuccess(setupIntent.id);
//             } else if (setupIntent.status === 'requires_action' || setupIntent.status === 'requires_confirmation') {
//                 console.log('[StripeSetupFormWebManage] Payment method setup requires further action. Stripe should handle redirect.');
//                 // setIsProcessingWebPayment(false) will be handled if redirect doesn't occur, or component unmounts
//             } else {
//                 setErrorMessageWeb(`Setup failed. Status: ${setupIntent.status}. Please try again or use a different card.`);
//                 onSetupError(`Setup status: ${setupIntent.status}`);
//                 setIsProcessingWebPayment(false);
//             }
//         } else {
//             console.log('[StripeSetupFormWebManage] Stripe likely redirected. Outcome to be handled on return_url page.');
//             // setIsProcessingWebPayment(false) will be handled if redirect doesn't occur, or component unmounts
//         }
//         // If not redirecting and setupIntent didn't succeed immediately, allow retry
//         if (!error && setupIntent && setupIntent.status !== 'succeeded' && setupIntent.status !== 'requires_action' && setupIntent.status !== 'requires_confirmation') {
//              setIsProcessingWebPayment(false);
//         }
//     };

//     return (
//         <View style={styles.webFormContainer}>
//             {/* Title changes based on whether a card exists */}
//             <Text style={styles.inputLabel}>{currentCardExists ? 'Enter New Card Details' : 'Securely Add Your Card'}</Text>
//             {!isPaymentElementReady && (
//                 <View style={styles.loadingMessageContainer}><ActivityIndicator /><Text style={styles.loadingTextUi}>Loading payment form...</Text></View>
//             )}
//             <View style={{ display: isPaymentElementReady ? 'flex' : 'none' }}> {/* Hide PaymentElement until ready */}
//                 <PaymentElement
//                     onReady={() => {
//                         console.log('%c[StripeSetupFormWebManage] PaymentElement onReady FIRED!', 'color: green; font-weight: bold;');
//                         setIsPaymentElementReady(true);
//                     }}
//                     onChange={(event) => setErrorMessageWeb(event.error ? event.error.message : null)}
//                 />
//             </View>
//             <TouchableOpacity
//                 style={[styles.button, { marginTop: 20 }, (isProcessingWebPayment || !isPaymentElementReady) && styles.buttonDisabled]}
//                 onPress={handleSubmitWeb}
//                 disabled={!stripe || !elements || isProcessingWebPayment || !isPaymentElementReady}
//             >
//                 {isProcessingWebPayment ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Save Card</Text>}
//             </TouchableOpacity>
//             {errorMessageWeb && <Text style={styles.errorTextWeb}>{errorMessageWeb}</Text>}
//         </View>
//     );
// };

// const OrgManagePlanScreen: React.FC = () => {
//     const navigation = useNavigation<OrgManagePlanNavigationProp>();
//     const { session, organizerProfile, loading: authLoading, refreshUserProfile } = useAuth();
//     const { initPaymentSheet, presentPaymentSheet } = useNativeStripe();

//     const [isLoadingData, setIsLoadingData] = useState(true); // Combined loading for initial data and SI params
//     const [isStripeActionActive, setIsStripeActionActive] = useState(false);
//     const [setupIntentParams, setSetupIntentParams] = useState<{ clientSecret: string; customerId: string; ephemeralKey?: string; } | null>(null);
//     const [currentPaymentMethod, setCurrentPaymentMethod] = useState<{ brand: string; last4: string; expMonth: number; expYear: number } | null>(null);
//     const [error, setError] = useState<string | null>(null);
//     const [showAddUpdateForm, setShowAddUpdateForm] = useState(false); // To toggle Stripe form visibility

//     const organizerId = session?.user?.id;
//     const organizerEmail = session?.user?.email || organizerProfile?.email; // Prioritize session email

//     // const loadData = useCallback(async () => {
//     //     if (!organizerId || !organizerEmail) {
//     //         setError("Organizer details not found. Please ensure you are logged in.");
//     //         setIsLoadingData(false);
//     //         return;
//     //     }
//     //     setIsLoadingData(true);
//     //     setError(null);
//     //     setCurrentPaymentMethod(null); // Reset
//     //     setSetupIntentParams(null);    // Reset

//     //     try {
//     //         console.log(`[OrgManagePlan] loadData for user: ${organizerId}`);

//     //         // Fetch current payment method details FIRST
//     //         if (organizerProfile?.stripe_customer_id) {
//     //             console.log('[OrgManagePlan] Fetching current payment method for customer:', organizerProfile.stripe_customer_id);
//     //             const { data: pmData, error: pmError } = await supabase.functions.invoke('get-organizer-payment-method-details', {
//     //                 body: JSON.stringify({ customerId: organizerProfile.stripe_customer_id })
//     //             });
//     //             if (pmError) {
//     //                 console.warn("Could not fetch current payment method details:", pmError.message);
//     //                 // Don't throw, allow user to add a new one
//     //             }
//     //             if (pmData?.paymentMethod) {
//     //                 setCurrentPaymentMethod(pmData.paymentMethod);
//     //                 console.log('[OrgManagePlan] Current payment method found:', pmData.paymentMethod);
//     //             } else {
//     //                 console.log('[OrgManagePlan] No default payment method found.');
//     //             }
//     //         } else {
//     //             console.log('[OrgManagePlan] No Stripe Customer ID on profile yet.');
//     //         }

//     //         // Fetch/Create SetupIntent for adding/updating
//     //         console.log('[OrgManagePlan] Fetching SetupIntent params...');
//     //         const { data: siData, error: siError } = await supabase.functions.invoke('create-organizer-setup-intent', {
//     //             body: JSON.stringify({
//     //                 userId: organizerId,
//     //                 email: organizerEmail,
//     //                 companyName: organizerProfile?.company_name || '',
//     //             }),
//     //         });

//     //         if (siError) throw new Error(siError.message || "Failed to prepare payment method setup.");
//     //         if (!siData?.clientSecret || !siData?.customerId) throw new Error("Invalid setup details from server for SetupIntent.");

//     //         setSetupIntentParams({
//     //             clientSecret: siData.clientSecret,
//     //             customerId: siData.customerId,
//     //             ephemeralKey: siData.ephemeralKey,
//     //         });
//     //         console.log('[OrgManagePlan] SetupIntent params received and set.');

//     //     } catch (e: any) {
//     //         console.error("Error in loadData:", e);
//     //         setError(e.message || "An error occurred while loading payment settings.");
//     //         Alert.alert("Loading Error", `Could not load payment settings: ${e.message}`);
//     //     } finally {
//     //         setIsLoadingData(false);
//     //     }
//     // }, [organizerId, organizerEmail, organizerProfile?.stripe_customer_id, organizerProfile?.company_name]); // Dependencies

//     // useFocusEffect(
//     //     useCallback(() => {
//     //         console.log("[OrgManagePlan] Screen focused. Reloading data.");
//     //         loadData();
//     //     }, [loadData])
//     // );

//     // OrgManagePlanScreen.tsx

//     const loadData = useCallback(async () => {
//         console.log('[OrgManagePlan] loadData CALLED.');

//         if (!session?.user?.id || !session?.user?.email) { // Check session directly first
//             setError("User session not available. Please re-login.");
//             setIsLoadingData(false);
//             return;
//         }
//         const currentUserId = session.user.id;
//         const currentUserEmail = session.user.email;

//         setIsLoadingData(true);
//         setError(null);
//         setCurrentPaymentMethod(null);
//         setSetupIntentParams(null);

//         try {
//             console.log(`[OrgManagePlan] loadData starting for user: ${currentUserId}`);

//             // --- Step 1: Ensure we have the LATEST organizerProfile ---
//             let freshOrganizerProfile = organizerProfile; // Start with what context provides
//             // Condition to refresh: if profile is missing, or if stripe_customer_id is missing but we expect it
//             // Or, more simply, always refresh if refreshUserProfile is available
//             // if (refreshUserProfile) {
//             //     console.log('[OrgManagePlan] Attempting to refresh organizerProfile from useAuth...');
//             //     await refreshUserProfile(); // This should update the 'organizerProfile' from useAuth()
//             //     // After refresh, get the latest profile from the hook.
//             //     // This assumes useAuth() re-renders this component with the new profile.
//             //     // For direct access within this useCallback, you might need to get it from a ref or re-fetch.
//             //     // However, if useAuth state updates properly, the 'organizerProfile' variable at the top
//             //     // of OrgManagePlanScreen will be new in the next render cycle.
//             //     // For THIS execution of loadData, we might still be using the one from before refresh.
//             //     // This is tricky. A better pattern is that useAuth manages its freshness.
//             //     // For now, let's log what we have *after* the call.
//             //     // The next time loadData runs due to dependency changes (like organizerProfile changing), it will have the fresh one.
//             // }
//             // Re-access organizerProfile from the hook after the refresh attempt.
//             // This is problematic because `organizerProfile` variable inside this `useCallback`
//             // is from the closure when `loadData` was defined.
//             // The most reliable way is to have `refreshUserProfile` return the new profile, or make
//             // `loadData` depend on a `refreshCounter` state that `refreshUserProfile` increments.

//             // Let's assume for now refreshUserProfile updates the context, and this component re-renders,
//             // then loadData runs again via useFocusEffect if organizerProfile reference changed.
//             // So, the organizerProfile used below SHOULD be the latest if things work ideally.

//             console.log('[OrgManagePlan] Using organizerProfile for Stripe checks:', JSON.stringify(organizerProfile, null, 2)); // Check this one

//             const currentStripeCustomerId = organizerProfile?.stripe_customer_id;

//             if (currentStripeCustomerId) {
//                 console.log('[OrgManagePlan] Stripe Customer ID found on profile:', currentStripeCustomerId, '. Fetching current PM details.');
//                 // ... (call get-organizer-payment-method-details) ...
//                 const { data: pmData, error: pmError } = await supabase.functions.invoke('get-organizer-payment-method-details', {
//                     body: JSON.stringify({ customerId: currentStripeCustomerId })
//                 });
//                 console.log('[OrgManagePlan] Response from get-organizer-payment-method-details: pmData=', JSON.stringify(pmData), 'pmError=', pmError);
//                 if (pmError) console.warn("Could not fetch current PM details:", pmError.message);
//                 if (pmData?.paymentMethod) setCurrentPaymentMethod(pmData.paymentMethod);
//                 else setCurrentPaymentMethod(null);
//             } else {
//                 console.log('[OrgManagePlan] No Stripe Customer ID found on current organizerProfile. Skipping fetch of current PM.');
//                 setCurrentPaymentMethod(null);
//             }

//             // ... (Fetch/Create SetupIntent - this part seems to be working in terms of getting a response) ...
//             console.log('[OrgManagePlan] Fetching/Creating SetupIntent params...');
//             const { data: siData, error: siError } = await supabase.functions.invoke('create-organizer-setup-intent', {
//                 body: JSON.stringify({
//                     userId: currentUserId, // Use ID from session
//                     email: currentUserEmail, // Use email from session
//                     companyName: organizerProfile?.company_name || '',
//                 }),
//             });
//             // ... (handle siData, siError, setSetupIntentParams) ...
//             if (siError) throw new Error(siError.message || "Function invocation error for SetupIntent.");
//             if (siData && siData.error) throw new Error(siData.error || "Backend failed to prepare payment setup.");
//             if (!siData?.clientSecret || !siData?.customerId) throw new Error("Invalid setup details from server (missing clientSecret or customerId).");

//             setSetupIntentParams({
//                 clientSecret: siData.clientSecret,
//                 customerId: siData.customerId,
//                 ephemeralKey: siData.ephemeralKey,
//             });
//             console.log('[OrgManagePlan] Successfully set setupIntentParams.');


//         } catch (e: any) {
//             // ... (error handling) ...
//         } finally {
//             setIsLoadingData(false);
//         }
//     // Make loadData depend on the organizerProfile object reference from useAuth
//     }, [session?.user?.id, session?.user?.email, organizerProfile, refreshUserProfile]); // Added session details to ensure they are stable when used

//     useFocusEffect(
//         useCallback(() => {
//             if (session?.user?.id && session?.user?.email) {
//                 console.log("[OrgManagePlan] Screen focused. Calling loadData.");
//                 loadData();
//             } else if (!authLoading) {
//                 console.warn("[OrgManagePlan] Screen focused, but user session details missing. Auth loading:", authLoading);
//                 setError("User details are not fully loaded. Please try again or re-login.");
//                 setIsLoadingData(false);
//             }
//         }, [loadData, session?.user?.id, session?.user?.email, authLoading])
//     );

//     const handleMobileAddOrUpdateCard = async () => {
//         if (!setupIntentParams?.clientSecret || !setupIntentParams?.customerId || !setupIntentParams?.ephemeralKey) {
//             Alert.alert("Error", "Payment setup details are not ready. Please try refreshing.");
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
//                 returnURL: 'vybr://stripe-redirect-organizer-manage',
//             });
//             if (initError) throw new Error(`Init Error: ${initError.message} (Code: ${initError.code})`);

//             const { error: presentError, setupIntent } = await presentPaymentSheet();
//             if (presentError) {
//                 if (presentError.code !== 'Canceled') throw new Error(`Present Error: ${presentError.message} (Code: ${presentError.code})`);
//                 else Alert.alert("Canceled", "Payment method setup canceled.");
//             } else if (setupIntent?.status === 'succeeded') { // Lowercase 's'
//                 Alert.alert("Success!", "Your payment method has been saved.");
//                 if (refreshUserProfile) await refreshUserProfile(); // Refresh profile which might update stripe_customer_id
//                 await loadData(); // Re-fetch all data to show new card and get fresh SI
//                 setShowAddUpdateForm(false); // Hide form after success
//             } else {
//                 Alert.alert("Notice", `Setup status: ${setupIntent?.status || 'Unknown'}. Please try again.`);
//             }
//         } catch (e: any) {
//             Alert.alert("Error", `Payment method setup failed: ${e.message}`);
//         } finally {
//             setIsStripeActionActive(false);
//         }
//     };

//     const handleOpenStripeBillingPortal = async () => {
//         // ... (keep your existing handleOpenStripeBillingPortal logic)
//          if (!organizerProfile?.stripe_customer_id) {
//             Alert.alert("Billing Account Not Found", "Please add a payment method first to access the billing portal.");
//             return;
//         }
//         setIsLoadingData(true); // Use general loading
//         try {
//             const { data, error } = await supabase.functions.invoke('create-stripe-portal-session-organizer', {
//                 body: JSON.stringify({
//                     stripeCustomerId: organizerProfile.stripe_customer_id,
//                     returnUrl: Platform.OS === 'web' ? `${window.location.origin}/org-settings/payment` : 'vybr://org-settings/payment' // Example return URL
//                 })
//             });
//             if (error) throw error;
//             if (data?.url) {
//                 if (Platform.OS === 'web') {
//                     window.location.href = data.url;
//                 } else {
//                     const supported = await Linking.canOpenURL(data.url);
//                     if (supported) {
//                         await Linking.openURL(data.url);
//                     } else {
//                         Alert.alert("Error", "Cannot open URL. Please ensure you have a web browser installed.");
//                     }
//                 }
//             } else {
//                 throw new Error("Could not retrieve billing portal URL.");
//             }
//         } catch (e: any) {
//             Alert.alert("Portal Error", `Could not open billing portal: ${e.message}`);
//         } finally {
//             setIsLoadingData(false);
//         }
//     };

//     // --- RENDER LOGIC ---
//     if (authLoading) {
//         return <SafeAreaView style={styles.centeredMessage}><ActivityIndicator size="large" /><Text style={styles.loadingTextUi}>Loading user data...</Text></SafeAreaView>;
//     }
//     if (!organizerId && !authLoading) {
//          return <SafeAreaView style={styles.centeredMessage}><Text style={styles.infoText}>Please log in to manage your payment method.</Text></SafeAreaView>;
//     }
//     if (isLoadingData && !currentPaymentMethod && !setupIntentParams) { // Initial full load
//         return <SafeAreaView style={styles.centeredMessage}><ActivityIndicator size="large" /><Text style={styles.loadingTextUi}>Loading payment settings...</Text></SafeAreaView>;
//     }

//     const displayStripeForm = showAddUpdateForm && setupIntentParams?.clientSecret;

//     return (
//         <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
//             <View style={styles.header}>
//                 <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-left" size={24} /></TouchableOpacity>
//                 <Text style={styles.headerTitle}>Payment Method</Text>
//                 <View style={{ width: 32 }} />{/* Spacer */}
//             </View>

//             <ScrollView contentContainerStyle={styles.scrollContent}>
//                 {/* Display Error if initial data load failed */}
//                 {error && !isLoadingData && (
//                     <View style={styles.errorBox}><Text style={styles.errorTextUi}>{error}</Text>
//                      <TouchableOpacity style={[styles.button, {backgroundColor: APP_CONSTANTS.COLORS.WARNING, marginTop:10}]} onPress={loadData}>
//                             <Text style={styles.buttonText}>Retry Loading</Text>
//                         </TouchableOpacity>
//                     </View>
//                 )}

//                 {/* Section to display current payment method */}
//                 {!isLoadingData && currentPaymentMethod && (
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
//                         {!showAddUpdateForm && (
//                              <TouchableOpacity style={[styles.button, { marginTop: 15 }]} onPress={() => setShowAddUpdateForm(true)}>
//                                 <Text style={styles.buttonText}>Update Card</Text>
//                             </TouchableOpacity>
//                         )}
//                     </View>
//                 )}

//                 {/* Section if no payment method is saved */}
//                 {!isLoadingData && !currentPaymentMethod && !error && (
//                     <View style={styles.card}>
//                         <Text style={styles.sectionTitle}>No Payment Method Saved</Text>
//                         <Text style={styles.infoText}>Add a payment method to enable billing for platform services like ad impressions and ticket commissions.</Text>
//                         {!showAddUpdateForm && setupIntentParams && ( // Only show "Add Card" if form isn't already visible and params are ready
//                             <TouchableOpacity style={[styles.button, { marginTop: 15 }]} onPress={() => setShowAddUpdateForm(true)}>
//                                 <Text style={styles.buttonText}>Add Payment Method</Text>
//                             </TouchableOpacity>
//                         )}
//                          {!setupIntentParams && !error && ( // If SI params are still loading or failed
//                             <View style={styles.centeredMessage}><ActivityIndicator /><Text style={styles.loadingTextUi}>Preparing form...</Text></View>
//                         )}
//                     </View>
//                 )}

//                 {/* Stripe UI form - shown when showAddUpdateForm is true and SI params are ready */}
//                 {displayStripeForm && (
//                     <View style={[styles.card, { marginTop: 20 }]}>
//                         <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
//                             <Text style={styles.sectionTitle}>
//                                 {currentPaymentMethod ? 'Enter New Card Details' : 'Add Your Card'}
//                             </Text>
//                             <TouchableOpacity onPress={() => setShowAddUpdateForm(false)} style={{padding: 5}}>
//                                 <Feather name="x" size={20} color={APP_CONSTANTS.COLORS.TEXT_SECONDARY} />
//                             </TouchableOpacity>
//                         </View>

//                         {Platform.OS !== 'web' ? (
//                             <TouchableOpacity
//                                 style={[styles.button, isStripeActionActive && styles.buttonDisabled]}
//                                 onPress={handleMobileAddOrUpdateCard}
//                                 disabled={isStripeActionActive || isLoadingData} // Disable if main data is loading too
//                             >
//                                 {isStripeActionActive || isLoadingData ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Save Card Securely</Text>}
//                             </TouchableOpacity>
//                         ) : stripePromiseWeb && setupIntentParams.clientSecret ? (
//                             <Elements stripe={stripePromiseWeb} options={{ clientSecret: setupIntentParams.clientSecret, appearance: { theme: 'stripe' } }}>
//                                 <StripeSetupFormWebManage
//                                     clientSecret={setupIntentParams.clientSecret}
//                                     currentCardExists={!!currentPaymentMethod}
//                                     onSetupSuccess={async (setupIntentId) => {
//                                         Alert.alert("Success!", "Payment method has been saved.");
//                                         setShowAddUpdateForm(false);
//                                         if (refreshUserProfile) await refreshUserProfile();
//                                         await loadData(); // Refresh all data
//                                     }}
//                                     onSetupError={(errMsg) => {
//                                         Alert.alert("Save Card Error", `Failed to save card: ${errMsg}`);
//                                         // Optionally keep the form open for retry by not calling setShowAddUpdateForm(false)
//                                     }}
//                                 />
//                             </Elements>
//                         ) : (
//                             <View style={styles.centeredMessage}><Text style={styles.loadingTextUi}>Loading web payment form...</Text></View>
//                         )}
//                         <Text style={styles.infoText}>Your card details are securely processed and stored by Stripe.</Text>
//                     </View>
//                 )}

//                 {/* Stripe Customer Portal Button - always show if stripe_customer_id exists */}
//                 {!isLoadingData && organizerProfile?.stripe_customer_id && (
//                      <View style={[styles.card, {marginTop: displayStripeForm ? 10 : 20, backgroundColor: '#F9FAFB'}]}>
//                          <Text style={styles.sectionTitle}>Manage Billing</Text>
//                         <TouchableOpacity style={[styles.button, styles.manageButton]} onPress={handleOpenStripeBillingPortal} disabled={isLoadingData}>
//                             {isLoadingData ? <ActivityIndicator color="#FFFFFF"/> : <Text style={styles.buttonText}>Open Stripe Billing Portal</Text> }
//                         </TouchableOpacity>
//                         <Text style={styles.infoText}>Use the Stripe portal to see all saved payment methods, manage subscriptions (if any), and view your billing history.</Text>
//                     </View>
//                 )}

//             </ScrollView>
//         </SafeAreaView>
//     );
// };

// // --- STYLES --- (Keep your existing styles, ensure these are present or merged)
// const styles = StyleSheet.create({
//     container: { flex: 1, backgroundColor: '#F4F7FC' },
//     header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: 'white' },
//     backButton: { padding: 4 },
//     headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A202C' },
//     scrollContent: { padding: 16, flexGrow: 1, paddingBottom: 40 },
//     card: { backgroundColor: 'white', borderRadius: 12, padding: 20, marginBottom: 20, shadowColor: "#9CA3AF", shadowOffset: { width: 0, height: 3, }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4, },
//     sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#2D3748', marginBottom: 16, },
//     infoText: { fontSize: 13, color: '#718096', lineHeight: 18, marginTop: 12, textAlign: 'center' },
//     button: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10, flexDirection: 'row' },
//     buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
//     buttonDisabled: { opacity: 0.6 },
//     centeredMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, minHeight: 150 },
//     paymentMethodDetails: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7FAFC', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
//     cardTextContainer: { flex: 1, marginLeft: 15 },
//     cardBrand: { fontSize: 16, fontWeight: 'bold', color: '#2D3748', textTransform: 'capitalize' },
//     cardLast4: { fontSize: 15, color: '#4A5568', letterSpacing: 1 },
//     cardExpiry: { fontSize: 14, color: '#718096' },
//     manageButton: { backgroundColor: '#4A5568' }, // A secondary color for manage portal
//     webFormContainer: { marginTop: 10, paddingHorizontal: Platform.OS === 'web' ? 0 : 10, paddingVertical: 15, backgroundColor: '#FDFDFE', borderRadius: 8, borderWidth: 1, borderColor: '#EAF0F6' },
//     errorTextWeb: { color: APP_CONSTANTS.COLORS.ERROR, textAlign: 'center', marginTop: 10, fontSize: 14 },
//     errorBox: { backgroundColor: '#FFF5F5', padding: 15, borderRadius: 8, borderWidth:1, borderColor: '#FED7D7', marginBottom: 20, alignItems: 'center'},
//     errorTextUi: { color: '#C53030', fontSize: 15, textAlign: 'center'},
//     loadingTextUi: { marginTop: 10, fontSize: 15, color: '#718096'},
//     inputLabel: { fontSize: 14, fontWeight: '600', color: '#2D3748', marginBottom: 8, alignSelf: 'flex-start'}, // For web form title
//     loadingMessageContainer: { alignItems: 'center', paddingVertical: 20, } // For web form element loading
// });

// export default OrgManagePlanScreen;

// src/screens/OrgManagePlanScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Alert,
    ActivityIndicator, Platform, ScrollView, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, NavigationProp, useFocusEffect } from '@react-navigation/native';
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
const STRIPE_PUBLISHABLE_KEY_NATIVE = "pk_test_51RDGZpDHMm6OC3yQwI460w1bESyWDQoSdNLBU9TOhciyc7NlbJ5upgCTJsP6OAuYt8cUeywcbkwQGCBI7VDCMNuz00qld2OSdN";
const STRIPE_PUBLISHABLE_KEY_WEB = "pk_test_51RDGZpDHMm6OC3yQwI460w1bESyWDQoSdNLBU9TOhciyc7NlbJ5upgCTJsP6OAuYt8cUeywcbkwQGCBI7VDCMNuz00qld2OSdN";
const stripePromiseWeb = Platform.OS === 'web' ? loadStripe(STRIPE_PUBLISHABLE_KEY_WEB) : null;

type OrgManagePlanNavigationProp = NavigationProp<RootStackParamList>;

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
        const timer = setTimeout(() => {
            if (!isPaymentElementReady && stripe && elements) {
                console.warn('[StripeSetupFormWebManage] PaymentElement onReady has not fired after 7 seconds. Stripe/Elements loaded:', !!stripe, !!elements, 'Client Secret passed:', clientSecret ? 'Exists' : 'MISSING/NULL');
            }
        }, 7000);
        return () => clearTimeout(timer);
    }, [isPaymentElementReady, stripe, elements, clientSecret]);

    const handleSubmitWeb = async () => {
        if (!stripe || !elements || !isPaymentElementReady) {
            const msg = !stripe || !elements ? 'Payment system (Stripe/Elements) not loaded.' : 'Payment form not ready.';
            onSetupError(msg);
            return;
        }
        setIsProcessingWebPayment(true);
        setErrorMessageWeb(null);
        const returnUrl = `${window.location.origin}/organizer-payment-method-update-complete`;

        const { error, setupIntent } = await stripe.confirmSetup({
            elements,
            confirmParams: { return_url: returnUrl },
        });

        if (error) {
            console.error('[StripeSetupFormWebManage] stripe.confirmSetup error:', error);
            setErrorMessageWeb(error.message || 'Failed to save card.');
            onSetupError(error.message || 'Failed to save card.');
        } else if (setupIntent?.status === 'succeeded') {
            onSetupSuccess(setupIntent.id);
        } else if (setupIntent?.status === 'requires_action' || setupIntent?.status === 'requires_confirmation') {
            // Redirect is handled by Stripe.js
        } else {
            const msg = `Setup failed. Status: ${setupIntent?.status || 'Unknown'}.`;
            setErrorMessageWeb(msg);
            onSetupError(msg);
        }
        setIsProcessingWebPayment(false); // Only set if not redirecting or already failed/succeeded
    };

    return (
        <View style={styles.webFormContainer}>
            <Text style={styles.inputLabel}>{currentCardExists ? 'Enter New Card Details' : 'Securely Add Your Card'}</Text>
            {!isPaymentElementReady && (
                <View style={styles.loadingMessageContainer}><ActivityIndicator /><Text style={styles.loadingTextUi}>Loading payment form...</Text></View>
            )}
            <View style={{ display: isPaymentElementReady ? 'flex' : 'none' }}>
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
    // IMPORTANT: Destructure organizerProfile directly here. It will re-render component if it changes.
    const { session, organizerProfile, loading: authLoading, refreshUserProfile } = useAuth();
    const { initPaymentSheet, presentPaymentSheet } = useNativeStripe();

    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isStripeActionActive, setIsStripeActionActive] = useState(false);
    const [setupIntentParams, setSetupIntentParams] = useState<{ clientSecret: string; customerId: string; ephemeralKey?: string; } | null>(null);
    const [currentPaymentMethod, setCurrentPaymentMethod] = useState<{ brand: string; last4: string; expMonth: number; expYear: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showAddUpdateForm, setShowAddUpdateForm] = useState(false);

    const organizerId = session?.user?.id;
    const organizerEmail = session?.user?.email; // Prefer session email as it's more direct

    const loadData = useCallback(async (isRefreshAfterCardUpdate = false) => {
        console.log(`[OrgManagePlan] loadData CALLED. isRefreshAfterCardUpdate: ${isRefreshAfterCardUpdate}`);
        // This 'organizerProfile' is from the closure of this useCallback.
        // If called via useFocusEffect, it's from the render when useFocusEffect's deps last changed.
        // If called explicitly after refreshUserProfile, we hope the context provided a new one.
        console.log('[OrgManagePlan] organizerProfile at start of loadData:', JSON.stringify(organizerProfile, null, 2));

        if (!organizerId || !organizerEmail) {
            setError("Organizer details missing. Please ensure you are logged in.");
            setIsLoadingData(false);
            return;
        }

        setIsLoadingData(true);
        setError(null);
        if (!isRefreshAfterCardUpdate) { // Don't clear current PM if we are just refreshing SI for form
            setCurrentPaymentMethod(null);
        }
        setSetupIntentParams(null);

        try {
            // Use the organizerProfile from the hook, which should be the latest if refreshUserProfile worked
            const profileToUse = organizerProfile; // This comes from the component's scope via useAuth()
            const currentStripeCustomerId = profileToUse?.stripe_customer_id;

            console.log(`[OrgManagePlan] Using stripe_customer_id: ${currentStripeCustomerId} from profile for fetching PM details.`);

            if (currentStripeCustomerId) {
                console.log('[OrgManagePlan] Attempting to fetch current PM details for customer:', currentStripeCustomerId);
                const { data: pmData, error: pmError } = await supabase.functions.invoke('get-organizer-payment-method-details', {
                    body: JSON.stringify({ customerId: currentStripeCustomerId })
                });
                console.log('[OrgManagePlan] Response from get-organizer-payment-method-details: pmData=', JSON.stringify(pmData), 'pmError=', pmError);
                if (pmError) console.warn("Could not fetch current PM details:", pmError.message);
                if (pmData?.paymentMethod) setCurrentPaymentMethod(pmData.paymentMethod);
                else setCurrentPaymentMethod(null); // Explicitly set if no PM found
            } else {
                console.log('[OrgManagePlan] No Stripe Customer ID on profile. Skipping PM details fetch.');
                setCurrentPaymentMethod(null);
            }

            console.log('[OrgManagePlan] Fetching/Creating SetupIntent params...');
            const { data: siData, error: siError } = await supabase.functions.invoke('create-organizer-setup-intent', {
                body: JSON.stringify({
                    userId: organizerId,
                    email: organizerEmail,
                    companyName: profileToUse?.company_name || '',
                }),
            });
            console.log('[OrgManagePlan] "create-organizer-setup-intent" RAW RESPONSE: data=', JSON.stringify(siData), 'siError=', siError);

            if (siError) throw new Error(siError.message || "Function invocation error for SetupIntent.");
            if (siData && siData.error) throw new Error(siData.error || "Backend failed to prepare payment setup.");
            if (!siData?.clientSecret || !siData?.customerId) throw new Error("Invalid setup details from server (missing clientSecret or customerId).");

            setSetupIntentParams({
                clientSecret: siData.clientSecret,
                customerId: siData.customerId,
                ephemeralKey: siData.ephemeralKey,
            });
            console.log('[OrgManagePlan] Successfully set setupIntentParams.');

        } catch (e: any) {
            console.error("[OrgManagePlan] CRITICAL ERROR in loadData:", e.message, e);
            setError(e.message);
        } finally {
            setIsLoadingData(false);
        }
    // Dependencies: When these change, `loadData` function is re-created.
    // `organizerProfile` object reference from `useAuth` is key.
    }, [organizerId, organizerEmail, organizerProfile, refreshUserProfile]);

    useFocusEffect(
        useCallback(() => {
            if (organizerId && organizerEmail) {
                console.log("[OrgManagePlan] Screen focused. Calling loadData.");
                loadData();
            } else if (!authLoading) {
                setError("User details not fully loaded.");
                setIsLoadingData(false);
            }
        // `loadData` is a dependency here. If `loadData` is re-created (due to its own deps changing), this effect re-runs.
        }, [loadData, organizerId, organizerEmail, authLoading])
    );

    const handleCardSavedSuccessfully = async () => {
        Alert.alert("Success!", "Your payment method has been saved.");
        setShowAddUpdateForm(false); // Hide the Stripe form
        if (refreshUserProfile) {
            console.log("[OrgManagePlan] Card saved, calling refreshUserProfile...");
            await refreshUserProfile(); // This MUST update the organizerProfile in AuthContext
            console.log("[OrgManagePlan] refreshUserProfile completed. Explicitly calling loadData again...");
            // After profile is refreshed, call loadData again to get latest PM details and a new SI
            await loadData(true); // Pass a flag to indicate this is a refresh post-update
        } else {
            console.warn("[OrgManagePlan] refreshUserProfile not available. Manually reloading data.");
            await loadData(true);
        }
    };

    const handleMobileAddOrUpdateCard = async () => {
        if (!setupIntentParams?.clientSecret || !setupIntentParams?.customerId || !setupIntentParams?.ephemeralKey) {
            Alert.alert("Error", "Payment setup details are not ready. Please try refreshing."); return;
        }
        setIsStripeActionActive(true);
        try {
            const { error: initError } = await initPaymentSheet({ /* ... as before ... */
                merchantDisplayName: 'VYBR Organizer',
                customerId: setupIntentParams.customerId,
                customerEphemeralKeySecret: setupIntentParams.ephemeralKey,
                setupIntentClientSecret: setupIntentParams.clientSecret,
                allowsDelayedPaymentMethods: true,
                returnURL: 'vybr://stripe-redirect-organizer-manage',
            });
            if (initError) throw new Error(`Init Error: ${initError.message} (Code: ${initError.code})`);

            const { error: presentError, setupIntent } = await presentPaymentSheet();
            console.log('[OrgManagePlan Mobile] presentPaymentSheet Response: setupIntent=', JSON.stringify(setupIntent), 'error=', presentError);

            if (presentError) {
                if (presentError.code !== 'Canceled') throw new Error(`Present Error: ${presentError.message} (Code: ${presentError.code})`);
                else Alert.alert("Canceled", "Payment method setup canceled.");
            } else if (setupIntent?.status === 'succeeded') { // Lowercase 's'
                await handleCardSavedSuccessfully();
            } else {
                Alert.alert("Notice", `Setup status: ${setupIntent?.status || 'Unknown'}. Please try again.`);
            }
        } catch (e: any) {
            Alert.alert("Error", `Payment method setup failed: ${e.message}`);
        } finally {
            setIsStripeActionActive(false);
        }
    };

    const handleOpenStripeBillingPortal = async () => { /* ... (keep as is) ... */ };

    // --- RENDER LOGIC ---
    if (authLoading && !organizerProfile) { // Show auth loading only if profile isn't available yet
        return <SafeAreaView style={styles.centeredMessage}><ActivityIndicator size="large" /><Text style={styles.loadingTextUi}>Loading user data...</Text></SafeAreaView>;
    }
    if (!organizerId && !authLoading) { // If auth is done, but still no organizerId (e.g. not logged in)
         return <SafeAreaView style={styles.centeredMessage}><Text style={styles.infoText}>Please log in to manage your payment method.</Text></SafeAreaView>;
    }
    // Initial data load for the screen itself
    if (isLoadingData && !error) { // If actively loading data and no overriding error displayed yet
        return <SafeAreaView style={styles.centeredMessage}><ActivityIndicator size="large" /><Text style={styles.loadingTextUi}>Loading payment settings...</Text></SafeAreaView>;
    }

    const displayStripeForm = showAddUpdateForm && setupIntentParams?.clientSecret;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} /></TouchableOpacity>
                <Text style={styles.headerTitle}>Payment Method</Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {error && ( // Display general error prominently if it exists
                    <View style={styles.errorBox}>
                        <Text style={styles.errorTextUi}>{error}</Text>
                        <TouchableOpacity style={[styles.button, {backgroundColor: APP_CONSTANTS.COLORS.WARNING, marginTop:10}]} onPress={() => loadData()}>
                            <Text style={styles.buttonText}>Retry Loading</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {!error && currentPaymentMethod && !showAddUpdateForm && (
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
                        <TouchableOpacity style={[styles.button, { marginTop: 15 }]} onPress={() => setShowAddUpdateForm(true)}>
                            <Text style={styles.buttonText}>Update Card</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {!error && !currentPaymentMethod && !showAddUpdateForm && (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>No Payment Method Saved</Text>
                        <Text style={styles.infoText}>Add a payment method for platform services.</Text>
                        {setupIntentParams?.clientSecret ? (
                            <TouchableOpacity style={[styles.button, { marginTop: 15 }]} onPress={() => setShowAddUpdateForm(true)}>
                                <Text style={styles.buttonText}>Add Payment Method</Text>
                            </TouchableOpacity>
                        ) : !error ? ( // If SI params not ready and no major error yet, show preparing form
                            <View style={styles.centeredMessage}><ActivityIndicator /><Text style={styles.loadingTextUi}>Preparing form...</Text></View>
                        ): null }
                    </View>
                )}

                {displayStripeForm && (
                    <View style={[styles.card, { marginTop: 20 }]}>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                            <Text style={styles.sectionTitle}>
                                {currentPaymentMethod ? 'Enter New Card Details' : 'Add Your Card'}
                            </Text>
                            <TouchableOpacity onPress={() => setShowAddUpdateForm(false)} style={{padding: 5}}>
                                <Feather name="x" size={20} color={APP_CONSTANTS.COLORS.TEXT_SECONDARY || '#666'} />
                            </TouchableOpacity>
                        </View>

                        {Platform.OS !== 'web' ? (
                            <TouchableOpacity
                                style={[styles.button, (isStripeActionActive || isLoadingData) && styles.buttonDisabled]}
                                onPress={handleMobileAddOrUpdateCard}
                                disabled={isStripeActionActive || isLoadingData}
                            >
                                {(isStripeActionActive || isLoadingData) ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Save Card Securely</Text>}
                            </TouchableOpacity>
                        ) : stripePromiseWeb && setupIntentParams.clientSecret ? (
                            <Elements stripe={stripePromiseWeb} options={{ clientSecret: setupIntentParams.clientSecret, appearance: { theme: 'stripe' } }}>
                                <StripeSetupFormWebManage
                                    clientSecret={setupIntentParams.clientSecret}
                                    currentCardExists={!!currentPaymentMethod}
                                    onSetupSuccess={handleCardSavedSuccessfully} // Use common handler
                                    onSetupError={(errMsg) => {
                                        Alert.alert("Save Card Error", `Failed to save card: ${errMsg}. Please check details or try another card.`);
                                    }}
                                />
                            </Elements>
                        ) : (
                            <View style={styles.centeredMessage}><ActivityIndicator /><Text style={styles.loadingTextUi}>Loading web payment form...</Text></View>
                        )}
                        <Text style={styles.infoText}>Your card details are securely processed by Stripe.</Text>
                    </View>
                )}

                {!isLoadingData && organizerProfile?.stripe_customer_id && (
                     <View style={[styles.card, {marginTop: displayStripeForm ? 10 : 20, backgroundColor: '#F9FAFB'}]}>
                        <Text style={styles.sectionTitle}>Manage Billing</Text>
                        <TouchableOpacity style={[styles.button, styles.manageButton]} onPress={handleOpenStripeBillingPortal} disabled={isLoadingData}>
                            {isLoadingData ? <ActivityIndicator color="#FFFFFF"/> : <Text style={styles.buttonText}>Open Stripe Billing Portal</Text> }
                        </TouchableOpacity>
                        <Text style={styles.infoText}>Use the Stripe portal for full payment method management and billing history.</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

// --- STYLES ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F4F7FC' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: 'white' },
    backButton: { padding: 8, marginRight: 8 }, // Added margin
    headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A202C', textAlign: 'center', flex:1 }, // Centered title
    scrollContent: { padding: 16, flexGrow: 1, paddingBottom: 40 },
    card: { backgroundColor: 'white', borderRadius: 12, padding: 20, marginBottom: 20, shadowColor: "#9CA3AF", shadowOffset: { width: 0, height: 2, }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 3, },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#2D3748', marginBottom: 16, },
    infoText: { fontSize: 13, color: '#718096', lineHeight: 18, marginTop: 12, textAlign: 'center' },
    button: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 10, flexDirection: 'row' },
    buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
    buttonDisabled: { opacity: 0.6 },
    centeredMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, minHeight: 100 },
    paymentMethodDetails: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7FAFC', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    cardTextContainer: { flex: 1, marginLeft: 15 },
    cardBrand: { fontSize: 16, fontWeight: 'bold', color: '#2D3748', textTransform: 'capitalize' },
    cardLast4: { fontSize: 15, color: '#4A5568', letterSpacing: 1 },
    cardExpiry: { fontSize: 14, color: '#718096' },
    manageButton: { backgroundColor: '#6B7280' }, // Darker gray for manage portal
    webFormContainer: { marginTop: 10, paddingHorizontal: Platform.OS === 'web' ? 0 : 10, paddingVertical: 15, backgroundColor: '#FDFDFE', borderRadius: 8, borderWidth: 1, borderColor: '#EAF0F6' },
    errorTextWeb: { color: APP_CONSTANTS.COLORS.ERROR || 'red', textAlign: 'center', marginTop: 10, fontSize: 14 },
    errorBox: { backgroundColor: '#FFF1F2', padding: 15, borderRadius: 8, borderWidth:1, borderColor: '#FECDD3', marginBottom: 20, alignItems: 'center'}, // Softer red
    errorTextUi: { color: '#DC2626', fontSize: 15, textAlign: 'center'}, // Tailwind red-600
    loadingTextUi: { marginTop: 10, fontSize: 15, color: '#6B7280'}, // Tailwind gray-500
    inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10, alignSelf: 'flex-start'}, // Tailwind gray-700
    loadingMessageContainer: { alignItems: 'center', paddingVertical: 20, }
});

export default OrgManagePlanScreen;