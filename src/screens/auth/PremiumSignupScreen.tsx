import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Platform, GestureResponderEvent
} from 'react-native';
import { usePlatformStripe } from '@/hooks/useStripe';
import { useStripe as useNativeStripe } from '@stripe/stripe-react-native';

// WEB Stripe
import { loadStripe, StripeElementsOptions, Appearance } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

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
const PREMIUM_PLAN_PRICE_ID = 'price_1SjiYFDz14cfDAXkFrVys2hD'; // Premium subscription price
// Replace with your actual Stripe Publishable Key for WEB
const STRIPE_PUBLISHABLE_KEY_WEB = 'pk_test_51RDGZeDz14cfDAXkmWK8eowRamZEWD7wAr1Mjae9QjhtBGRZ0VFXGDQxS9Q8XQfX1Gkoy4PlTcNWIz2E54Y6n7Yw00wY8abUlU'; // Matching key for new account

const stripePromise = Platform.OS === 'web' ? loadStripe(STRIPE_PUBLISHABLE_KEY_WEB) : null;

// Updated payment params interface to handle SetupIntent for premium subscription
interface PaymentParams {
    setupIntentClientSecret: string;
    customerId: string;
    ephemeralKey: string;
}

// Web component for SetupIntent (card saving) 
const StripeSetupFormWeb = ({ clientSecret, onSetupSuccess, onSetupError }: {
    clientSecret: string;
    onSetupSuccess: (setupIntentId: string, paymentMethodId?: string) => void;
    onSetupError: (errorMsg: string) => void;
}) => {
    const stripe = useStripe(); // Use direct Stripe hook instead of usePlatformStripe
    const elements = useElements(); // Use direct Elements hook instead of usePlatformStripe
    const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);
    const [isProcessingWebPayment, setIsProcessingWebPayment] = useState(false);
    const [errorMessageWeb, setErrorMessageWeb] = useState<string | null>(null);

    const handleSubmitWeb = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements || !isPaymentElementReady) {
            const msg = !stripe || !elements ? 'Payment system (Stripe/Elements) not loaded.' : 'Payment form not ready.';
            onSetupError(msg);
            return;
        }
        setIsProcessingWebPayment(true);
        setErrorMessageWeb(null);

        try {
            const { error, setupIntent } = await stripe.confirmSetup({
                elements,
                confirmParams: {
                    return_url: window.location.origin,
                },
                redirect: 'if_required',
            });

            if (error) {
                console.error('[StripeSetupFormWeb] Setup confirmation error:', error);
                setErrorMessageWeb(error.message || 'Payment setup failed');
                onSetupError(error.message || 'Payment setup failed');
            } else if (setupIntent) {
                console.log('[StripeSetupFormWeb] Setup Intent confirmed:', setupIntent);
                // Extract payment method ID from setup intent
                const paymentMethodId = setupIntent.payment_method as string;
                onSetupSuccess(setupIntent.id, paymentMethodId);
            }
        } catch (error: any) {
            console.error('[StripeSetupFormWeb] Setup confirmation exception:', error);
            setErrorMessageWeb('An unexpected error occurred');
            onSetupError('An unexpected error occurred');
        } finally {
            setIsProcessingWebPayment(false);
        }
    };

    return (
        <form onSubmit={handleSubmitWeb} style={{ width: '100%', maxWidth: '500px', margin: '0 auto' }}>
            <PaymentElement 
                onReady={() => {
                    console.log('[StripeSetupFormWeb] PaymentElement is ready');
                    setIsPaymentElementReady(true);
                }}
                options={{
                    layout: 'tabs'
                }}
            />
            {errorMessageWeb && (
                <div style={{ color: 'rgb(220, 38, 38)', textAlign: 'center', marginTop: '12px', fontSize: '14px' }}>
                    {errorMessageWeb}
                </div>
            )}
            <button
                disabled={!isPaymentElementReady || isProcessingWebPayment}
                style={{
                    backgroundColor: !isPaymentElementReady || isProcessingWebPayment ? '#9CA3AF' : APP_CONSTANTS.COLORS.PRIMARY,
                    color: '#fff',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    width: '100%',
                    marginTop: '20px',
                    opacity: !isPaymentElementReady || isProcessingWebPayment ? 0.7 : 1,
                }}
            >
                {isProcessingWebPayment ? 'Processing...' : 'Complete Premium Subscription'}
            </button>
        </form>
    );
};

// Main Screen Component
const PremiumSignupScreen = () => {
    const [uiLoading, setUiLoading] = useState(true); // For fetching payment params initially
    const [isStripeActionActive, setIsStripeActionActive] = useState(false); // For mobile PaymentSheet active state
    const [paymentParams, setPaymentParams] = useState<PaymentParams | null>(null); // Stores SetupIntent params
    const [isLoadingData, setIsLoadingData] = useState(false); // For processing after setup

    const { initPaymentSheet, presentPaymentSheet } = usePlatformStripe();
    const nativeStripe = useNativeStripe();
    const navigation = useNavigation<PremiumSignupNavigationProp>();
    const route = useRoute<PremiumSignupScreenRouteProp>();
    const { userEmail, userId } = route.params;
    const { updatePremiumStatus } = useAuth(); // Assuming this hook is correctly set up

    // Helper function to set payment method as default (same as RequiredPaymentScreen)
    const setPaymentMethodAsDefault = async (paymentMethodId: string, customerId: string) => {
        try {
            console.log("[PremiumSignupScreen] Setting payment method as default:", paymentMethodId);
            console.log("[PremiumSignupScreen] Using customer ID:", customerId);
            
            if (!customerId) {
                throw new Error("Customer ID is missing");
            }
            
            const { data, error } = await supabase.functions.invoke('set-default-payment-method', {
                body: JSON.stringify({ 
                    customerId: customerId,
                    paymentMethodId: paymentMethodId 
                })
            });

            if (error) {
                throw error;
            }

            if (data?.error) {
                throw new Error(data.error);
            }

            console.log("[PremiumSignupScreen] Successfully set payment method as default:", data);
            return true;
        } catch (error: any) {
            console.error("[PremiumSignupScreen] Exception in setPaymentMethodAsDefault:", error);
            throw error;
        }
    };

    // This function is called after payment setup and subscription creation is successful
    const handlePaymentSuccess = async () => {
        Alert.alert('Payment Successful!', 'Your premium subscription is now active.');
        console.log('[PremiumSignupScreen] Payment successful. Updating premium status for user:', userId);
        try {
            // Update premium status
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

        // Navigate to MainApp
        navigation.reset({
            index: 0,
            routes: [{ name: 'MainApp' }],
        });
    };

    // Called when setup intent is successful - now proceed to subscription creation
    const handleSetupSuccess = async (setupIntentId: string, paymentMethodId?: string) => {
        console.log('[PremiumSignupScreen] Setup success - now proceeding to subscription creation...', { setupIntentId, paymentMethodId });
        
        try {
            setIsLoadingData(true);
            
            // First, set the payment method as default if we have the ID
            if (paymentMethodId && paymentParams) {
                console.log('[PremiumSignupScreen] Setting payment method as default before subscription creation:', paymentMethodId);
                await setPaymentMethodAsDefault(paymentMethodId, paymentParams.customerId);
            }

            // Now proceed with subscription creation using the saved payment method
            console.log('[PremiumSignupScreen] Creating and confirming subscription...');
            const { data: billingData, error: billingError } = await supabase.functions.invoke('create-premium-subscription', {
                body: JSON.stringify({
                    priceId: PREMIUM_PLAN_PRICE_ID,
                    userId,
                    userEmail,
                    paymentMethodId: paymentMethodId, // Pass the saved payment method ID
                }),
            });

            if (billingError) {
                console.error('[PremiumSignupScreen] Subscription creation error:', billingError);
                throw new Error(billingError.message || "Function invocation error for subscription creation.");
            }
            
            if (billingData && billingData.error) {
                console.error('[PremiumSignupScreen] Subscription creation data error:', billingData.error);
                throw new Error(billingData.error || "Backend failed to process subscription creation.");
            }

            // Check the subscription creation result
            if (billingData?.success) {
                console.log('[PremiumSignupScreen] Premium subscription created and confirmed successfully');
                await handlePaymentSuccess();
            } else if (billingData?.requires_action && billingData?.client_secret) {
                // Payment requires additional action (like 3D Secure)
                console.log('[PremiumSignupScreen] Subscription requires additional authentication...');
                
                if (Platform.OS === 'web') {
                    // For web, handle 3D Secure authentication
                    const stripe = await stripePromise;
                    if (!stripe) throw new Error('Stripe not loaded');
                    
                    const { error, paymentIntent } = await stripe.confirmPayment({
                        clientSecret: billingData.client_secret,
                        confirmParams: {
                            return_url: `${window.location.origin}/payment-confirmation`,
                        },
                        redirect: 'if_required',
                    });

                    if (error) {
                        throw new Error(error.message || 'Payment authentication failed');
                    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
                        console.log('[PremiumSignupScreen] Web payment authenticated and confirmed successfully');
                        await handlePaymentSuccess();
                    } else {
                        throw new Error(`Payment authentication status: ${paymentIntent?.status || 'unknown'}`);
                    }
                } else {
                    // For mobile, use PaymentSheet for 3D Secure
                    console.log('[PremiumSignupScreen] Mobile - using PaymentSheet for authentication...');
                    
                    setIsStripeActionActive(true);
                    const { error: initError } = await initPaymentSheet({
                        merchantDisplayName: 'VYBR Premium',
                        customerId: billingData.customerId || paymentParams?.customerId,
                        customerEphemeralKeySecret: billingData.ephemeralKey,
                        paymentIntentClientSecret: billingData.client_secret,
                        allowsDelayedPaymentMethods: true,
                        returnURL: `vybr://stripe-redirect-premium-auth`,
                    });
                    
                    if (initError) {
                        throw new Error(`Init Error: ${initError.message} (Code: ${initError.code})`);
                    }

                    const result = await presentPaymentSheet();
                    console.log('[PremiumSignupScreen] Mobile auth presentPaymentSheet Response:', JSON.stringify(result));

                    if (result.error) {
                        if (result.error.code !== 'Canceled') {
                            throw new Error(`Present Error: ${result.error.message} (Code: ${result.error.code})`);
                        } else {
                            Alert.alert("Canceled", "Premium subscription authentication canceled.");
                            return;
                        }
                    } else {
                        // Success case - authentication completed successfully
                        console.log('[PremiumSignupScreen] Mobile authentication completed successfully');
                        await handlePaymentSuccess();
                    }
                }
            } else {
                throw new Error('Unexpected subscription response format');
            }

        } catch (error: any) {
            console.error('[PremiumSignupScreen] Error in handleSetupSuccess:', error);
            Alert.alert('Subscription Setup Error', `Failed to complete premium subscription: ${error.message}`);
        } finally {
            setIsStripeActionActive(false);
            setIsLoadingData(false);
        }
    };

    // Called on setup errors
    const handleSetupError = (errorMessage: string) => {
        console.error('[PremiumSignupScreen] handleSetupError called with:', errorMessage);
        Alert.alert('Payment Setup Error', errorMessage);
    };

    // Fetches SetupIntent parameters from backend
    const fetchAndSetupPayment = async () => {
        setUiLoading(true);
        setPaymentParams(null); // Reset previous params
        console.log('[PremiumSignupScreen] Fetching SetupIntent parameters...');
        try {
            // Use the same function as RequiredPaymentScreen to create SetupIntent
            const { data, error: invokeError } = await supabase.functions.invoke('create-organizer-setup-intent', {
                body: JSON.stringify({
                    userId: userId,
                    email: userEmail,
                    userType: 'music_lover', // Premium users are music lovers
                    companyName: '', // Not needed for music lovers
                }),
            });

            if (invokeError) {
                console.error('Supabase function error during fetch:', invokeError);
                console.error('Supabase function error details:', JSON.stringify(invokeError, null, 2));
                throw new Error(invokeError.message || 'Failed to create payment setup session. Please try again.');
            }
            
            // Log the response to see what we got
            console.log('[PremiumSignupScreen] Function response:', JSON.stringify(data, null, 2));

            if (!data || !data.clientSecret || !data.customerId || !data.ephemeralKey) {
                console.error('Invalid response from Supabase function (missing crucial keys):', data);
                // Check if there's an error message in the response
                if (data?.error) {
                    console.error('Backend error:', data.error);
                    throw new Error(`Backend error: ${data.error}`);
                }
                throw new Error('Invalid response from payment service. Crucial data missing.');
            }
            
            console.log('[PremiumSignupScreen] SetupIntent parameters received:', data);
            setPaymentParams({
                setupIntentClientSecret: data.clientSecret,
                customerId: data.customerId,
                ephemeralKey: data.ephemeralKey,
            });

            setUiLoading(false);
            console.log('[PremiumSignupScreen] SetupIntent params set. Ready for payment method setup.');

        } catch (err: any) {
            console.error('[PremiumSignupScreen] Error in fetchAndSetupPayment:', err);
            Alert.alert('Payment Setup Error', `Could not prepare payment: ${err.message || 'Unknown error'}. Please try again.`);
            setUiLoading(false);
            setPaymentParams(null); // Clear params on error to show setup failed UI
        }
    };

    // Handle mobile payment setup
    const handleMobilePayment = async () => {
        if (!paymentParams) {
            Alert.alert("Error", "Payment details not available. Please try refreshing.");
            return;
        }

        setIsStripeActionActive(true);
        try {
            // Quick preflight: verify the device can reach Stripe before opening PaymentSheet.
            // This helps distinguish "Stripe API unreachable" from configuration issues.
            try {
                const urls = [
                    'https://api.stripe.com',
                    'https://m.stripe.network',
                    'https://r.stripe.com',
                ];
                const failures: string[] = [];
                for (const url of urls) {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 7000);
                    try {
                        await fetch(url, { method: 'HEAD', signal: controller.signal });
                    } catch {
                        failures.push(url);
                    } finally {
                        clearTimeout(timeout);
                    }
                }

                if (failures.length > 0) {
                    Alert.alert(
                        "Network Issue",
                        `This device can’t reach Stripe services right now:\n\n${failures.join('\n')}\n\nPlease check Wi‑Fi/VPN/DNS and try again (or try cellular).`,
                    );
                    return;
                }
            } catch {
                Alert.alert(
                    "Network Issue",
                    "This device can’t reach Stripe right now. Please check Wi‑Fi/VPN/DNS and try again (or try cellular).",
                );
                return;
            }

            const { error: initError } = await initPaymentSheet({
                merchantDisplayName: 'VYBR Premium',
                customerId: paymentParams.customerId,
                customerEphemeralKeySecret: paymentParams.ephemeralKey,
                setupIntentClientSecret: paymentParams.setupIntentClientSecret,
                allowsDelayedPaymentMethods: true,
                returnURL: `vybr://stripe-redirect-premium-setup`,
            });
            
            if (initError) {
                throw new Error(`Init Error: ${initError.message} (Code: ${initError.code})`);
            }

            // SetupIntent initialized successfully

            const result = await presentPaymentSheet();
            if (__DEV__) {
                console.log('[PremiumSignupScreen Mobile] presentPaymentSheet Response:', JSON.stringify(result));
            }

            if (result.error) {
                if (result.error.code !== 'Canceled') {
                    throw new Error(`Present Error: ${result.error.message} (Code: ${result.error.code})`);
                } else {
                    Alert.alert("Canceled", "Premium subscription setup canceled.");
                    navigation.goBack();
                }
            } else {
                // Success case - payment method setup completed successfully
                console.log('[PremiumSignupScreen Mobile] Payment method setup completed successfully, proceeding to subscription...');
                await handleSetupSuccess('mobile_setup_success'); // No setup intent ID available on mobile
            }
        } catch (e: any) {
            console.error('[PremiumSignupScreen Mobile] Error:', e);
            const msg = `${e?.message || e}`;
            if (msg.includes('kCFErrorDomainCFNetwork') && msg.includes('-1001')) {
                Alert.alert(
                    "Network Timeout",
                    "The payment sheet timed out while contacting Stripe. Please check your connection and try again.",
                );
            } else {
                Alert.alert("Error", `Premium subscription setup failed: ${msg}`);
            }
        } finally {
            setIsStripeActionActive(false);
        }
    };

    useEffect(() => {
        fetchAndSetupPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount

    // Options for Stripe Elements on the Web
    const appearance: Appearance = { theme: 'stripe' };
    const elementsOptions: StripeElementsOptions | undefined =
        (Platform.OS === 'web' && paymentParams && paymentParams.setupIntentClientSecret) ? {
            clientSecret: paymentParams.setupIntentClientSecret,
            appearance,
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

    // 2. Mobile: Payment/Setup action is active
    if ((Platform.OS !== 'web') && (isStripeActionActive || isLoadingData)) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} /></TouchableOpacity>
                    <Text style={styles.headerTitle}>Premium Subscription</Text><View style={{ width: 32 }} />
                </View>
                <View style={styles.scrollContentCenter}>
                    <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
                    <Text style={styles.loadingText}>
                        {isStripeActionActive ? 'Setting up payment method...' : 'Creating subscription...'}
                    </Text>
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

    // 4. Web: Render Stripe Elements Setup Form
    if (Platform.OS === 'web') {
        if (!stripePromise || !elementsOptions) {
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
        // Render Web setup form
        return (
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} /></TouchableOpacity>
                    <Text style={styles.headerTitle}>Premium Subscription</Text><View style={{ width: 32 }} />
                </View>
                <ScrollView style={styles.content} contentContainerStyle={styles.scrollContentCenter}>
                    <Text style={styles.title}>Complete Your Premium Subscription</Text>
                    <Text style={styles.description}>Add your payment method and we'll create your premium subscription.</Text>
                    {isLoadingData && (
                        <View style={styles.loadingMessageContainer}>
                            <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
                            <Text style={styles.loadingText}>Creating your subscription...</Text>
                        </View>
                    )}
                    {!isLoadingData && (
                        <Elements stripe={stripePromise} options={elementsOptions}>
                            <StripeSetupFormWeb
                                clientSecret={elementsOptions.clientSecret!}
                                onSetupSuccess={handleSetupSuccess}
                                onSetupError={handleSetupError}
                            />
                        </Elements>
                    )}
                </ScrollView>
            </SafeAreaView>
        );
    }

    // 5. Mobile: Show button to trigger setup
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} /></TouchableOpacity>
                    <Text style={styles.headerTitle}>Premium Subscription</Text><View style={{ width: 32 }} />
                </View>
                <ScrollView style={styles.content} contentContainerStyle={styles.scrollContentCenter}>
                    <Text style={styles.title}>Premium Subscription</Text>
                    <Text style={styles.description}>Add your payment method and we'll create your premium subscription.</Text>
                    <TouchableOpacity
                        style={[styles.button, (isStripeActionActive || isLoadingData) && styles.buttonDisabled]}
                        onPress={handleMobilePayment}
                        disabled={isStripeActionActive || isLoadingData}
                    >
                        {(isStripeActionActive || isLoadingData) ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.buttonText}>Complete Premium Subscription</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // Default fallback
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