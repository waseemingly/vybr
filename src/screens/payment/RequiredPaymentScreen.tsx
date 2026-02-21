import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Alert,
    ActivityIndicator, Platform, ScrollView, BackHandler
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, NavigationProp, useFocusEffect } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { APP_CONSTANTS } from '@/config/constants';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { usePlatformStripe } from '@/hooks/useStripe';

// --- Stripe Imports ---
import { loadStripe, StripeElementsOptions, Appearance } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

import type { RootStackParamList } from '@/navigation/AppNavigator';

// --- Stripe Configuration ---
const STRIPE_PUBLISHABLE_KEY_NATIVE = "pk_test_51RDGZpDHMm6OC3yQwI460w1bESyWDQoSdNLBU9TOhciyc7NlbJ5upgCTJsP6OAuYt8cUeywcbkwQGCBI7VDCMNuz00qld2OSdN";
const STRIPE_PUBLISHABLE_KEY_WEB = "pk_test_51RDGZpDHMm6OC3yQwI460w1bESyWDQoSdNLBU9TOhciyc7NlbJ5upgCTJsP6OAuYt8cUeywcbkwQGCBI7VDCMNuz00qld2OSdN";
const PREMIUM_PLAN_PRODUCT_ID = 'prod_SJWVfLaGA6zw1r'; // Premium subscription product ID
const stripePromiseWeb = Platform.OS === 'web' ? loadStripe(STRIPE_PUBLISHABLE_KEY_WEB) : null;

type RequiredPaymentNavigationProp = NavigationProp<RootStackParamList>;

// Combined payment params interface to handle both SetupIntent and PaymentIntent
interface PaymentParams {
    // For saving payment method (SetupIntent)
    setupIntent?: {
        clientSecret: string;
        customerId: string;
        ephemeralKey: string;
    };
    // For billing premium users (PaymentIntent)
    paymentIntent?: {
        paymentIntentClientSecret: string;
        customerId: string;
        ephemeralKey: string;
    };
}

// Web-compatible container component for PaymentElement
const PaymentElementContainer = ({ children }: { children: React.ReactNode }) => {
    if (Platform.OS === 'web') {
        // Use React.createElement to create a native div element on web
        return React.createElement('div', {
            id: 'stripe-payment-element-container',
            style: { width: '100%', minHeight: '200px', marginBottom: '20px' }
        }, children) as any;
    }
    return <View style={{ width: '100%', minHeight: 200, marginBottom: 20 }}>{children}</View>;
};

// Web-specific components using Stripe Elements
const StripeSetupFormWebRequired = ({ clientSecret, onSetupSuccess, onSetupError }: {
    clientSecret: string;
    onSetupSuccess: (setupIntentId: string, paymentMethodId?: string) => void;
    onSetupError: (errorMsg: string) => void;
}) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);
    const [isProcessingWebPayment, setIsProcessingWebPayment] = useState(false);
    const [errorMessageWeb, setErrorMessageWeb] = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (!isPaymentElementReady && stripe && elements) {
                console.warn('[StripeSetupFormWebRequired] PaymentElement onReady has not fired after 7 seconds. Stripe/Elements loaded:', !!stripe, !!elements, 'Client Secret passed:', clientSecret ? 'Exists' : 'MISSING/NULL');
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

        try {
            const { error, setupIntent } = await stripe.confirmSetup({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/organizer/dashboard?stripe_onboarding_complete=true`,
                },
                redirect: 'if_required',
            });

            if (error) {
                console.error('[StripeSetupFormWebRequired] Setup confirmation error:', error);
                setErrorMessageWeb(error.message || 'Payment setup failed');
                onSetupError(error.message || 'Payment setup failed');
            } else if (setupIntent) {
                console.log('[StripeSetupFormWebRequired] Setup Intent confirmed:', setupIntent);
                // Extract payment method ID from setup intent
                const paymentMethodId = setupIntent.payment_method as string;
                onSetupSuccess(setupIntent.id, paymentMethodId);
            }
        } catch (error: any) {
            console.error('[StripeSetupFormWebRequired] Setup confirmation exception:', error);
            setErrorMessageWeb('An unexpected error occurred');
            onSetupError('An unexpected error occurred');
        } finally {
            setIsProcessingWebPayment(false);
        }
    };

    return (
        <View style={styles.webFormContainer}>
            <PaymentElementContainer>
                <PaymentElement 
                    onReady={() => {
                        console.log('[StripeSetupFormWebRequired] PaymentElement is ready');
                        setIsPaymentElementReady(true);
                    }}
                    options={{
                        layout: 'tabs'
                    }}
                />
            </PaymentElementContainer>
            {errorMessageWeb && (
                <Text style={styles.errorText}>{errorMessageWeb}</Text>
            )}
            <TouchableOpacity
                style={[
                    styles.submitButton,
                    (!isPaymentElementReady || isProcessingWebPayment) && styles.submitButtonDisabled
                ]}
                onPress={handleSubmitWeb}
                disabled={!isPaymentElementReady || isProcessingWebPayment}
            >
                {isProcessingWebPayment ? (
                    <ActivityIndicator color="white" size="small" />
                ) : (
                    <Text style={styles.submitButtonText}>Add Payment Method</Text>
                )}
            </TouchableOpacity>
        </View>
    );
};

// Web component for handling both payment and setup (premium users)
const StripePaymentFormWebRequired = ({ paymentClientSecret, onPaymentSuccess, onPaymentError }: {
    paymentClientSecret: string;
    onPaymentSuccess: () => void;
    onPaymentError: (errorMsg: string) => void;
}) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);
    const [isProcessingWebPayment, setIsProcessingWebPayment] = useState(false);
    const [errorMessageWeb, setErrorMessageWeb] = useState<string | null>(null);

    const handleSubmitWeb = async () => {
        if (!stripe || !elements || !isPaymentElementReady) {
            const msg = !stripe || !elements ? 'Payment system (Stripe/Elements) not loaded.' : 'Payment form not ready.';
            onPaymentError(msg);
            return;
        }
        setIsProcessingWebPayment(true);
        setErrorMessageWeb(null);

        try {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/organizer/dashboard?stripe_onboarding_complete=true`,
                },
                redirect: 'if_required',
            });

            if (error) {
                console.error('[StripePaymentFormWebRequired] Payment confirmation error:', error);
                setErrorMessageWeb(error.message || 'Payment failed');
                onPaymentError(error.message || 'Payment failed');
            } else if (paymentIntent) {
                console.log('[StripePaymentFormWebRequired] Payment Intent confirmed:', paymentIntent);
                if (paymentIntent.status === 'succeeded') {
                    onPaymentSuccess();
                } else {
                    console.warn(`[StripePaymentFormWebRequired] PaymentIntent status: ${paymentIntent.status}`);
                    setErrorMessageWeb(`Payment status: ${paymentIntent.status}`);
                }
            }
        } catch (error: any) {
            console.error('[StripePaymentFormWebRequired] Payment confirmation exception:', error);
            setErrorMessageWeb('An unexpected error occurred');
            onPaymentError('An unexpected error occurred');
        } finally {
            setIsProcessingWebPayment(false);
        }
    };

    return (
        <View style={styles.webFormContainer}>
            <PaymentElementContainer>
                <PaymentElement 
                    onReady={() => {
                        console.log('[StripePaymentFormWebRequired] PaymentElement is ready');
                        setIsPaymentElementReady(true);
                    }}
                    options={{
                        layout: 'tabs'
                    }}
                />
            </PaymentElementContainer>
            {errorMessageWeb && (
                <Text style={styles.errorText}>{errorMessageWeb}</Text>
            )}
            <TouchableOpacity
                style={[
                    styles.submitButton,
                    (!isPaymentElementReady || isProcessingWebPayment) && styles.submitButtonDisabled
                ]}
                onPress={handleSubmitWeb}
                disabled={!isPaymentElementReady || isProcessingWebPayment}
            >
                {isProcessingWebPayment ? (
                    <ActivityIndicator color="white" size="small" />
                ) : (
                    <Text style={styles.submitButtonText}>Complete Payment & Subscription</Text>
                )}
            </TouchableOpacity>
        </View>
    );
};

// Web-specific component that uses Stripe Elements
const WebPaymentHandler = ({ 
    paymentParams, 
    isPremiumUser, 
    handlePremiumSetupSuccess, 
    handleCardSavedSuccessfully 
}: {
    paymentParams: PaymentParams | null;
    isPremiumUser: boolean;
    handlePremiumSetupSuccess: (setupIntentId: string, paymentMethodId?: string) => Promise<void>;
    handleCardSavedSuccessfully: (paymentMethodId?: string) => Promise<void>;
}) => {
    if (!paymentParams?.setupIntent?.clientSecret) {
        return (
            <View style={styles.centeredMessage}>
                <ActivityIndicator />
                <Text style={styles.loadingTextUi}>Loading web payment form...</Text>
            </View>
        );
    }

    return (
        <Elements stripe={stripePromiseWeb} options={{ 
            clientSecret: paymentParams.setupIntent.clientSecret, 
            appearance: { theme: 'stripe' } 
        }}>
            <StripeSetupFormWebRequired
                clientSecret={paymentParams.setupIntent.clientSecret}
                onSetupSuccess={(setupIntentId: string, paymentMethodId?: string) => {
                    console.log('[RequiredPayment] Web form success:', { setupIntentId, paymentMethodId });
                    if (isPremiumUser) {
                        handlePremiumSetupSuccess(setupIntentId, paymentMethodId);
                    } else {
                        handleCardSavedSuccessfully(paymentMethodId);
                    }
                }}
                onSetupError={(errMsg) => {
                    Alert.alert("Setup Error", `Failed to setup payment: ${errMsg}. Please check details or try another card.`);
                }}
            />
        </Elements>
    );
};

// Native-specific component that uses usePlatformStripe
const NativePaymentHandlerImpl = ({ 
    paymentParams, 
    isPremiumUser, 
    handlePremiumSetupSuccess, 
    handleCardSavedSuccessfully 
}: {
    paymentParams: PaymentParams | null;
    isPremiumUser: boolean;
    handlePremiumSetupSuccess: (setupIntentId: string, paymentMethodId?: string) => Promise<void>;
    handleCardSavedSuccessfully: (paymentMethodId?: string) => Promise<void>;
}) => {
    const { initPaymentSheet, presentPaymentSheet } = usePlatformStripe();
    const [isStripeActionActive, setIsStripeActionActive] = useState(false);

    const handleMobilePayment = async () => {
        const setupIntentParams = paymentParams?.setupIntent;
        
        if (!setupIntentParams) {
            Alert.alert("Error", "Payment details not available. Please try refreshing.");
            return;
        }
        
        if (!setupIntentParams.clientSecret || !setupIntentParams.customerId || !setupIntentParams.ephemeralKey) {
            Alert.alert("Error", "Payment setup details are not ready. Please try refreshing.");
            return;
        }

        setIsStripeActionActive(true);
        try {
            const merchantName = isPremiumUser ? 'VYBR Premium' : 'VYBR Organizer';
            const { error: initError } = await initPaymentSheet({
                merchantDisplayName: merchantName,
                customerId: setupIntentParams.customerId,
                customerEphemeralKeySecret: setupIntentParams.ephemeralKey,
                setupIntentClientSecret: setupIntentParams.clientSecret,
                allowsDelayedPaymentMethods: true,
                returnURL: `vybr://stripe-redirect-payment-setup`,
            });

            if (initError) {
                throw new Error(`Init Error: ${initError.message} (Code: ${initError.code})`);
            }

            const result = await presentPaymentSheet();
            console.log('[RequiredPayment Mobile] presentPaymentSheet Response:', JSON.stringify(result));

            if (result.error) {
                if (result.error.code !== 'Canceled') {
                    throw new Error(`Present Error: ${result.error.message} (Code: ${result.error.code})`);
                } else {
                    Alert.alert("Canceled", `${isPremiumUser ? 'Premium subscription' : 'Payment method'} setup canceled.`);
                }
            } else {
                // Success case - payment sheet completed successfully
                console.log('[RequiredPayment Mobile] Payment method setup completed successfully, fetching payment method ID...');
                
                // Fetch the payment method ID that was just saved
                // Add a small delay to ensure Stripe has processed the payment method
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                let paymentMethodId: string | undefined;
                const customerId = setupIntentParams.customerId;
                
                try {
                    console.log('[RequiredPayment Mobile] Fetching payment methods for customer:', customerId);
                    
                    const { data, error: listError } = await supabase.functions.invoke('list-organizer-payment-methods', {
                        body: { customerId: customerId }
                    });
                    
                    if (listError) {
                        console.warn('[RequiredPayment Mobile] Failed to fetch payment methods:', listError);
                        throw new Error(`Failed to fetch payment methods: ${listError.message}`);
                    } else {
                        const paymentMethods = data?.paymentMethods || [];
                        if (paymentMethods.length > 0) {
                            // Get the most recently added payment method (usually the last one)
                            // Payment methods are typically returned in reverse chronological order
                            paymentMethodId = paymentMethods[paymentMethods.length - 1].id;
                            console.log('[RequiredPayment Mobile] Found payment method ID:', paymentMethodId);
                            console.log('[RequiredPayment Mobile] Total payment methods:', paymentMethods.length);
                        } else {
                            console.warn('[RequiredPayment Mobile] No payment methods found after setup');
                            throw new Error('No payment methods found after card setup. Please try again.');
                        }
                    }
                } catch (fetchError: any) {
                    console.error('[RequiredPayment Mobile] Error fetching payment method ID:', fetchError);
                    // For premium users, we need the payment method ID, so throw the error
                    if (isPremiumUser) {
                        throw new Error(`Failed to retrieve payment method: ${fetchError.message || 'Unknown error'}. Please try again.`);
                    }
                    // For organizers, we can continue but log the warning
                    console.warn('[RequiredPayment Mobile] Proceeding without payment method ID for organizer');
                }
                
                if (isPremiumUser) {
                    // For premium users, this will trigger billing after card save
                    // We need the payment method ID for billing
                    if (!paymentMethodId) {
                        throw new Error('Payment method ID is required for premium subscription. Please try again.');
                    }
                    await handlePremiumSetupSuccess('mobile_setup_success', paymentMethodId);
                } else {
                    // For organizers, just save the card
                    await handleCardSavedSuccessfully(paymentMethodId);
                }
            }
        } catch (e: any) {
            console.error('[RequiredPayment Mobile] Error:', e);
            Alert.alert("Error", `${isPremiumUser ? 'Premium subscription' : 'Payment method'} setup failed: ${e.message}`);
        } finally {
            setIsStripeActionActive(false);
        }
    };

    return (
        <TouchableOpacity
            style={[styles.button, isStripeActionActive && styles.buttonDisabled]}
            onPress={handleMobilePayment}
            disabled={isStripeActionActive}
        >
            {isStripeActionActive ? (
                <ActivityIndicator color="#FFFFFF" />
            ) : (
                <Text style={styles.buttonText}>
                    {isPremiumUser ? 'Complete Premium Subscription' : 'Add Payment Method'}
                </Text>
            )}
        </TouchableOpacity>
    );
};

// Platform-agnostic wrapper that renders the appropriate component
const PaymentHandler = (props: {
    paymentParams: PaymentParams | null;
    isPremiumUser: boolean;
    handlePremiumSetupSuccess: (setupIntentId: string, paymentMethodId?: string) => Promise<void>;
    handleCardSavedSuccessfully: (paymentMethodId?: string) => Promise<void>;
}) => {
    return Platform.OS === 'web' 
        ? <WebPaymentHandler {...props} /> 
        : <NativePaymentHandlerImpl {...props} />;
};

const RequiredPaymentScreen: React.FC = () => {
    const navigation = useNavigation<RequiredPaymentNavigationProp>();
    const { session, loading: authLoading, refreshUserProfile, musicLoverProfile, organizerProfile, updatePremiumStatus, logout, setRequestedBackToOrganizerSignUp } = useAuth();
    
    // Get Stripe hooks at component level (for mobile 3D Secure handling)
    const { initPaymentSheet: initPaymentSheetHook, presentPaymentSheet: presentPaymentSheetHook } = usePlatformStripe();

    const userId = session?.user?.id;
    const userEmail = session?.user?.email;
    const userType = session?.userType;
    const isOrganizer = userType === 'organizer';
    const isPremiumUser = musicLoverProfile?.isPremium ?? false;
    const currentProfile = isOrganizer ? organizerProfile : musicLoverProfile;
    const currentStripeCustomerId = isOrganizer 
        ? (organizerProfile as any)?.stripe_customer_id 
        : (musicLoverProfile as any)?.stripe_customer_id;
    
    // This state will now track the entire setup process
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [statusMessage, setStatusMessage] = useState('Verifying account status...');

    const [paymentParams, setPaymentParams] = useState<PaymentParams | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isStripeActionActive, setIsStripeActionActive] = useState(false);

    // New state to manage the multi-step UI
    const [showConnectOnboarding, setShowConnectOnboarding] = useState(false);
    const [isCreatingConnectLink, setIsCreatingConnectLink] = useState(false);

    // --- FUNCTION DECLARATIONS ---
    // Moved declarations before their usage to fix linter errors.

    const loadPaymentData = useCallback(async () => {
        console.log(`[RequiredPayment] loadPaymentData CALLED.`);

        if (!userId || !userEmail) {
            setError("User details missing. Please ensure you are logged in.");
            setIsLoadingData(false);
            return;
        }

        setIsLoadingData(true);
        setError(null);
        setPaymentParams(null);

        try {
            const newPaymentParams: PaymentParams = {};

            if (userType === 'music_lover' && isPremiumUser) {
                console.log('[RequiredPayment] Premium user detected - creating SetupIntent for card saving first...');
                
                const { data: siData, error: siError } = await supabase.functions.invoke('create-organizer-setup-intent', {
                    body: {
                        userId: userId,
                        email: userEmail,
                        userType: userType,
                        companyName: (currentProfile as any)?.displayName || '',
                    },
                });

                if (siError) throw new Error(siError.message || "Function invocation error for SetupIntent.");
                if (siData && siData.error) throw new Error(siData.error || "Backend failed to prepare payment setup.");
                if (!siData?.clientSecret || !siData?.customerId) throw new Error("Invalid setup details from server (missing clientSecret or customerId).");

                newPaymentParams.setupIntent = {
                    clientSecret: siData.clientSecret,
                    customerId: siData.customerId,
                    ephemeralKey: siData.ephemeralKey,
                };

                console.log('[RequiredPayment] SetupIntent created successfully for premium user. Billing will happen after card save.');
            } else {
                // For organizers, only create SetupIntent to save payment method
                console.log('[RequiredPayment] Organizer detected - creating SetupIntent only...');
                const { data: siData, error: siError } = await supabase.functions.invoke('create-organizer-setup-intent', {
                    body: {
                        userId: userId,
                        email: userEmail,
                        userType: userType,
                        companyName: isOrganizer ? (currentProfile as any)?.companyName || '' : (currentProfile as any)?.displayName || '',
                    },
                });

                if (siError) throw new Error(siError.message || "Function invocation error for SetupIntent.");
                if (siData && siData.error) throw new Error(siData.error || "Backend failed to prepare payment setup.");
                if (!siData?.clientSecret || !siData?.customerId) throw new Error("Invalid setup details from server (missing clientSecret or customerId).");

                newPaymentParams.setupIntent = {
                    clientSecret: siData.clientSecret,
                    customerId: siData.customerId,
                    ephemeralKey: siData.ephemeralKey,
                };

                console.log('[RequiredPayment] SetupIntent created successfully for organizer.');
            }

            setPaymentParams(newPaymentParams);

        } catch (e: any) {
            console.error("[RequiredPayment] CRITICAL ERROR in loadPaymentData:", e.message, e);
            setError(e.message);
        } finally {
            setIsLoadingData(false);
        }
    }, [userId, userEmail, currentProfile, userType, isOrganizer, isPremiumUser]);

    // This function will now be the single entry point for ensuring organizer setup
    const handleConnectStripe = useCallback(async () => {
        if (isCreatingConnectLink) return;
        setIsCreatingConnectLink(true);
        setError(null);

        try {
            const { data, error } = await supabase.functions.invoke('create-connect-account-link');

            console.log('[RequiredPayment] Connect link response - data:', data);
            console.log('[RequiredPayment] Connect link response - error:', error);
            
            if (error) {
                // Try to get the actual error message from the response
                let errorMessage = error.message || 'Unknown error';
                if (error.context && typeof error.context === 'object') {
                    const ctx = error.context as any;
                    // Try to read the response body
                    if (ctx._bodyBlob || ctx._bodyInit) {
                        console.error('[RequiredPayment] Function returned 500. Check Supabase logs for details.');
                        errorMessage = 'Backend error - check Supabase function logs';
                    }
                }
                console.error('[RequiredPayment] Invoke error:', errorMessage);
                throw new Error(errorMessage);
            }
            if (data?.error) {
                console.error('[RequiredPayment] Data error:', data.error);
                throw new Error(data.error);
            }
            if (!data?.url) {
                console.error('[RequiredPayment] No URL in response:', data);
                throw new Error("Could not get Stripe onboarding URL.");
            }

            console.log('[RequiredPayment] Redirecting to Stripe onboarding...');
            // Redirect to Stripe
            if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
                window.location.href = data.url;
            } else {
                await Linking.openURL(data.url);
            }
        } catch (e: any) {
            console.error("Failed to create Stripe Connect link:", e);
            console.error("Error details:", e.message, e.code, e.context);
            setError(`Could not connect to Stripe: ${e.message || 'Unknown error'}`);
        } finally {
            setIsCreatingConnectLink(false);
        }
    }, [isCreatingConnectLink]);

    const verifyAndSetupOrganizer = useCallback(async () => {
        if (!isOrganizer || !userId || !userEmail) return;
    
        console.log('[RequiredPayment] Running full organizer verification...');
        setIsLoadingData(true);
        setError(null);
        setShowConnectOnboarding(false);
    
        const profile = organizerProfile;
    
        // --- DEV BYPASS: Skip payment method requirement on simulator ---
        if (__DEV__ && Platform.OS === 'ios') {
            console.warn('[RequiredPayment] DEV MODE: Skipping payment requirement for iOS simulator');
            setStatusMessage('Setup complete! (Dev bypass active)');
            setIsLoadingData(false);
            // Mark as complete so navigator lets them through
            return;
        }
    
        // --- Step 1: Check for Payment Method (for platform fees) ---
        if (!profile?.stripe_customer_id) {
            console.log('[Verify] Step 1 FAILED: Stripe Customer ID is missing.');
            setStatusMessage('Please add a payment method to cover platform fees.');
            await loadPaymentData(); // This prepares the SetupIntent form
            setIsLoadingData(false);
            return;
        }
        console.log('[Verify] Step 1 PASSED: Payment method (customer ID) exists.');
    
        // --- Step 2: Check for Payout Account (Stripe Connect) ---
        if (!(profile as any)?.stripe_connect_account_id) {
            console.log('[Verify] Step 2: Stripe Connect not configured - showing setup prompt.');
            setStatusMessage('Please set up your payout account to receive ticket sales.');
            setShowConnectOnboarding(true);
            setIsLoadingData(false);
            return; // Show the Connect onboarding UI
        } else {
            console.log('[Verify] Step 2 PASSED: Payout account is connected.');
        }
    
        // --- Step 3: Check for Usage-Based Subscription - NOW OPTIONAL ---
        setStatusMessage('Verifying billing subscription...');
        console.log('[Verify] Step 3: Checking usage-based subscriptions (optional)...');
        try {
            const { data, error: invokeError } = await supabase.functions.invoke('create-organizer-ticket-usage-subscription', {
                body: {
                    userId: userId,
                    email: userEmail,
                    companyName: (profile as any)?.companyName || ''
                }
            });
    
            if (invokeError) {
                console.warn('[Verify] Step 3: Usage subscription function not available (skipping)');
            } else if (data?.error) {
                console.warn('[Verify] Step 3: Usage subscription error (skipping):', data.error);
            } else {
                console.log('[Verify] Ticket usage subscription is active.');

                // Call the impression subscription function right after the ticket one
                const { data: impressionData, error: impressionError } = await supabase.functions.invoke('create-organizer-impression-subscription', {
                    body: {
                        userId: userId,
                        email: userEmail,
                        companyName: (profile as any)?.companyName || ''
                    }
                });

                if (impressionError) {
                    console.warn('[Verify] Impression subscription not available (skipping)');
                } else if (impressionData?.error) {
                    console.warn('[Verify] Impression subscription error (skipping):', impressionData.error);
                } else {
                    console.log('[Verify] Impression usage subscription is active.');
                }
            }
        } catch (e: any) {
            console.warn('[Verify] Step 3: Subscription check failed (continuing anyway):', e.message);
            // Don't block organizer signup - they can set up billing later
        }

        // NOTE: Tour is enabled in handleCardSavedSuccessfully when the organizer first adds their payment method
        // We do NOT enable it here because verifyAndSetupOrganizer runs on every visit to RequiredPaymentScreen
        // and would reset the tour flag even after the organizer has already completed the tour
        
        console.log('[RequiredPayment] All verifications passed. Setup is complete.');
        setStatusMessage('Setup complete! Redirecting...');
        setIsLoadingData(false);
    }, [isOrganizer, userId, userEmail, organizerProfile, loadPaymentData, refreshUserProfile, handleConnectStripe]);

    // Handle return from Stripe Connect onboarding
    useEffect(() => {
        const checkStripeOnboardingReturn = async () => {
            if (Platform.OS === 'web') {
                const url = new URL(typeof window !== 'undefined' && window.location ? window.location.href : 'https://vybr.app');
                const onboardingComplete = url.searchParams.get('stripe_onboarding_complete');
                if (onboardingComplete === 'true') {
                    console.log('[RequiredPayment] Stripe Connect onboarding completed - refreshing profile...');
                    await refreshUserProfile();
                    // Re-run verification to check if Connect account is now set up
                    verifyAndSetupOrganizer();
                    // Clean URL
                    if (typeof window !== 'undefined' && window.location) {
                        const cleanUrl = window.location.pathname + window.location.hash;
                        window.history.replaceState({}, document.title, cleanUrl);
                    }
                }
            } else {
                // For mobile, check deep link
                const checkInitialURL = async () => {
                    const initialURL = await Linking.getInitialURL();
                    if (initialURL?.includes('stripe_onboarding_complete=true')) {
                        console.log('[RequiredPayment] Stripe Connect onboarding completed (mobile) - refreshing profile...');
                        await refreshUserProfile();
                        verifyAndSetupOrganizer();
                    }
                };
                checkInitialURL();
                
                // Also listen for deep links while app is running
                const subscription = Linking.addEventListener('url', async (event) => {
                    if (event.url.includes('stripe_onboarding_complete=true')) {
                        console.log('[RequiredPayment] Stripe Connect onboarding completed (deep link) - refreshing profile...');
                        await refreshUserProfile();
                        verifyAndSetupOrganizer();
                    }
                });
                
                return () => subscription.remove();
            }
        };
        
        checkStripeOnboardingReturn();
    }, [refreshUserProfile, verifyAndSetupOrganizer]);

    // Back button handling: organizers have 2 sub-steps (add payment → Connect payouts); back goes to previous sub-step then to signup
    const handleBackPress = useCallback(() => {
        const isPaymentMethodRequired = isOrganizer || (userType === 'music_lover' && isPremiumUser);
        const hasValidPaymentMethod = Boolean(currentStripeCustomerId && currentStripeCustomerId.trim() !== '');

        // Organizer: sub-step 2 (Connect payouts) → back to sub-step 1 (add payment); sub-step 1 → back to OrganizerSignUpFlow
        if (isOrganizer) {
            if (showConnectOnboarding) {
                console.log("[RequiredPayment] Back press - organizer returning to add payment method step");
                setShowConnectOnboarding(false);
                return true;
            }
            console.log("[RequiredPayment] Back press - organizer returning to signup flow");
            setRequestedBackToOrganizerSignUp(true);
            return true; // AppNavigator will re-render and show OrganizerSignUpFlow
        }

        // Premium user without payment method: block and show alert
        if (isPaymentMethodRequired && !hasValidPaymentMethod) {
            console.log("[RequiredPayment] Back press detected - preventing navigation (premium user)");
            Alert.alert(
                "Payment Required",
                "As a premium user, you must add a payment method to continue using premium features. Please complete the payment setup to proceed.",
                [{ text: "OK" }]
            );
            return true; // Prevent default back action
        }
        return false; // Allow default back action
    }, [isOrganizer, userType, isPremiumUser, currentStripeCustomerId, showConnectOnboarding, setRequestedBackToOrganizerSignUp]);

    // Override hardware back button on Android with enhanced prevention
    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                console.log("[RequiredPayment] Hardware back button pressed");
                return handleBackPress();
            };
            
            if (Platform.OS === 'android') {
                const backSubscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
                return () => backSubscription.remove();
            }
        }, [handleBackPress])
    );

    // Override navigation header back button with enhanced prevention
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            console.log("[RequiredPayment] Navigation beforeRemove event triggered");
            if (handleBackPress()) {
                console.log("[RequiredPayment] Preventing navigation away from RequiredPaymentScreen");
                e.preventDefault();
            }
        });

        return unsubscribe;
    }, [navigation, handleBackPress]);

    // Helper function to set payment method as default (using supabase.functions.invoke like ManagePlanScreen)
    const setPaymentMethodAsDefault = async (paymentMethodId: string, customerId: string) => {
        try {
            console.log("[RequiredPayment] Setting payment method as default:", paymentMethodId);
            console.log("[RequiredPayment] Using customer ID:", customerId);
            
            if (!customerId) {
                throw new Error("Customer ID is missing");
            }
            
            const { data, error } = await supabase.functions.invoke('set-default-payment-method', {
                body: { 
                    customerId: customerId,
                    paymentMethodId: paymentMethodId 
                }
            });

            if (error) {
                throw error;
            }

            if (data?.error) {
                throw new Error(data.error);
            }

            console.log("[RequiredPayment] Successfully set payment method as default:", data);
            return true;
        } catch (error: any) {
            console.error("[RequiredPayment] Exception in setPaymentMethodAsDefault:", error);
            throw error;
        }
    };

    const handlePaymentSuccess = async () => {
        console.log('[RequiredPaymentScreen] Payment successful. Updating premium status for user:', userId);
        try {
            // Update premium status
            const result = await updatePremiumStatus(userId!, true);
            if ('error' in result && result.error) {
                console.error('[RequiredPaymentScreen] Premium status update client-side error:', result.error);
                Alert.alert('Warning', 'Payment confirmed, but there was an issue with the immediate status update. Your access will be granted shortly. Please check your profile or contact support if needed.');
            } else {
                console.log('[RequiredPaymentScreen] Premium status updated client-side.');
            }
        } catch (e: any) {
            console.error('[RequiredPaymentScreen] Exception during client-side premium status update:', e);
            Alert.alert('Warning', 'Payment confirmed, but an error occurred during the immediate status update. Your access will be granted shortly.');
        }

        // For premium users, refresh profile after successful billing
        await refreshProfileAfterPaymentSuccess();
    };

    const refreshProfileAfterPaymentSuccess = async () => {
        try {
            // Enable app tour for premium users and organizers after payment completes
            // Do this BEFORE refreshing so the refresh picks up the new value
            console.log('[RequiredPaymentScreen] 🎯 Enabling app tour after payment completion...');
            try {
                const table = isOrganizer ? 'organizer_profiles' : 'music_lover_profiles';
                await supabase
                    .from(table)
                    .update({ has_completed_tour: false })
                    .eq('user_id', userId!);
                console.log('[RequiredPaymentScreen] ✅ App tour enabled in database');
            } catch (tourError) {
                console.error('[RequiredPaymentScreen] ⚠️ Error enabling app tour:', tourError);
                // Don't block navigation if tour setup fails
            }
            
            // CRITICAL: Refresh user profile to update the AppNavigator and pick up the tour flag
            console.log('[RequiredPaymentScreen] Refreshing user profile to update AppNavigator...');
            await refreshUserProfile();
            console.log('[RequiredPaymentScreen] ✅ Profile refreshed with tour flag');
            
            console.log('[RequiredPaymentScreen] Payment and setup completed successfully!');
            
            // Let the AppNavigator handle the navigation based on the refreshed profile
            // No manual navigation here - AppNavigator will detect the payment method change

        } catch (error: any) {
            console.error('[RequiredPaymentScreen] Error in refreshProfileAfterPaymentSuccess:', error);
            setError(error.message || 'Profile refresh failed. Please restart the app.');
        } finally {
            setIsLoadingData(false);
        }
    };

    const handlePremiumSetupSuccess = async (setupIntentId: string, paymentMethodId?: string) => {
        console.log('[RequiredPaymentScreen] Premium setup success - now proceeding to billing...', { setupIntentId, paymentMethodId });
        
        try {
            setIsLoadingData(true);
            
            // First, set the payment method as default if we have the ID
            if (paymentMethodId) {
                const customerId = paymentParams?.setupIntent?.customerId;
                if (customerId) {
                    console.log('[RequiredPaymentScreen] Setting payment method as default before billing:', paymentMethodId);
                    await setPaymentMethodAsDefault(paymentMethodId, customerId);
                }
            }

            // Now proceed with billing the premium subscription using the saved payment method
            // We'll create a server-side function that handles both creation and confirmation
            console.log('[RequiredPaymentScreen] Creating and confirming subscription for premium billing...');
            console.log('[RequiredPaymentScreen] Request payload:', {
                productId: PREMIUM_PLAN_PRODUCT_ID,
                userId,
                userEmail,
                paymentMethodId: paymentMethodId,
            });
            
            const { data: billingData, error: billingError } = await supabase.functions.invoke('create-premium-subscription', {
                body: {
                    productId: PREMIUM_PLAN_PRODUCT_ID,
                    userId,
                    userEmail,
                    paymentMethodId: paymentMethodId, // Pass the saved payment method ID
                },
            });

            // Log full response for debugging
            console.log('[RequiredPaymentScreen] Billing response:', { billingData, billingError });

            // Handle error from Supabase function invocation
            if (billingError) {
                console.error('[RequiredPaymentScreen] Billing error:', billingError);
                
                // Try to extract error message from multiple sources
                let errorMessage = billingError.message || "Function invocation error for premium billing.";
                let statusCode: number | undefined;
                
                // Check if error has context with response body
                if (billingError.context) {
                    console.error('[RequiredPaymentScreen] Error context:', billingError.context);
                    const context = billingError.context as any;
                    statusCode = context.status;
                    
                    // Try to read the response body from the blob
                    if (context._bodyBlob || context._bodyInit) {
                        try {
                            const bodyBlob = context._bodyBlob || context._bodyInit;
                            // Try to read the blob as text
                            if (bodyBlob) {
                                let bodyText: string | null = null;
                                
                                // Try different methods to read the blob
                                if (typeof bodyBlob.text === 'function') {
                                    bodyText = await bodyBlob.text();
                                } else if (typeof bodyBlob.json === 'function') {
                                    const parsed = await bodyBlob.json();
                                    if (parsed?.error) {
                                        errorMessage = parsed.error;
                                        console.log('[RequiredPaymentScreen] Extracted error from blob JSON:', errorMessage);
                                    }
                                    bodyText = null; // Already parsed
                                } else if (bodyBlob._data?.blobId) {
                                    // For React Native, the blob might be structured differently
                                    console.log('[RequiredPaymentScreen] Blob structure detected, attempting to read...');
                                }
                                
                                if (bodyText) {
                                    try {
                                        const parsedBody = JSON.parse(bodyText);
                                        if (parsedBody?.error) {
                                            errorMessage = parsedBody.error;
                                            console.log('[RequiredPaymentScreen] Extracted error from response body:', errorMessage);
                                        }
                                    } catch (parseError) {
                                        console.warn('[RequiredPaymentScreen] Could not parse body text as JSON:', parseError);
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('[RequiredPaymentScreen] Could not read error body from blob:', e);
                            // Try alternative method - read as JSON directly if available
                            try {
                                if (context.body && typeof context.body === 'string') {
                                    const parsedBody = JSON.parse(context.body);
                                    if (parsedBody?.error) {
                                        errorMessage = parsedBody.error;
                                        console.log('[RequiredPaymentScreen] Extracted error from context.body:', errorMessage);
                                    }
                                }
                            } catch (e2) {
                                console.warn('[RequiredPaymentScreen] Could not parse error body from context.body:', e2);
                            }
                        }
                    }
                }
                
                // Check status code for user-friendly messages if we couldn't extract from body
                if (statusCode === 402) {
                    errorMessage = errorMessage.includes('declined') || errorMessage.includes('not available') 
                        ? errorMessage 
                        : "Payment method was declined or not available. Please try another card or contact your bank.";
                } else if (statusCode === 400) {
                    errorMessage = errorMessage || "Invalid payment information. Please check your details and try again.";
                } else if (statusCode === 500) {
                    errorMessage = errorMessage || "Server error. Please try again later or contact support.";
                }
                
                // If we have data despite error, check for error message in data
                if (billingData && typeof billingData === 'object' && 'error' in billingData) {
                    errorMessage = (billingData as any).error || errorMessage;
                }
                
                console.error('[RequiredPaymentScreen] Final error message:', errorMessage, 'Status:', statusCode);
                throw new Error(errorMessage);
            }
            
            // Handle error in response data
            if (billingData && typeof billingData === 'object' && 'error' in billingData) {
                const errorData = billingData as { error: string; [key: string]: any };
                console.error('[RequiredPaymentScreen] Billing data error:', errorData);
                throw new Error(errorData.error || "Backend failed to process premium billing.");
            }

            // Check the billing result
            if (billingData?.success) {
                console.log('[RequiredPaymentScreen] Premium subscription created and confirmed successfully');
                await handlePaymentSuccess();
            } else if (billingData?.requires_action && billingData?.client_secret) {
                // Payment requires additional action (like 3D Secure)
                console.log('[RequiredPaymentScreen] Payment requires additional authentication...');
                
                if (Platform.OS === 'web') {
                    // For web, handle 3D Secure authentication
                    const stripe = await stripePromiseWeb;
                    if (!stripe) throw new Error('Stripe not loaded');
                    
                    const { error, paymentIntent } = await stripe.confirmPayment({
                        clientSecret: billingData.client_secret,
                        confirmParams: {
                            return_url: `${window.location.origin}/organizer/dashboard?stripe_onboarding_complete=true`,
                        },
                        redirect: 'if_required',
                    });

                    if (error) {
                        throw new Error(error.message || 'Payment authentication failed');
                    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
                        console.log('[RequiredPaymentScreen] Web payment authenticated and confirmed successfully');
                        await handlePaymentSuccess();
                    } else {
                        throw new Error(`Payment authentication status: ${paymentIntent?.status || 'unknown'}`);
                    }
                } else {
                    // For mobile, use PaymentSheet for 3D Secure
                    console.log('[RequiredPaymentScreen] Mobile - using PaymentSheet for authentication...');
                    
                    // For mobile, use the platform-specific Stripe hooks from component level
                    if (Platform.OS === 'ios' || Platform.OS === 'android') {
                        if (!initPaymentSheetHook || !presentPaymentSheetHook) {
                            throw new Error('Payment system not available');
                        }
                        
                        setIsStripeActionActive(true);
                        const { error: initError } = await initPaymentSheetHook({
                            merchantDisplayName: 'VYBR Premium',
                            customerId: billingData.customerId || paymentParams?.setupIntent?.customerId,
                            customerEphemeralKeySecret: billingData.ephemeralKey,
                            paymentIntentClientSecret: billingData.client_secret,
                            allowsDelayedPaymentMethods: true,
                            returnURL: `vybr://stripe-redirect-premium-auth`,
                        });
                        
                        if (initError) {
                            throw new Error(`Init Error: ${initError.message} (Code: ${initError.code})`);
                        }

                        const result = await presentPaymentSheetHook();
                        console.log('[RequiredPaymentScreen] Mobile auth presentPaymentSheet Response:', JSON.stringify(result));

                        if (result.error) {
                            if (result.error.code !== 'Canceled') {
                                throw new Error(`Present Error: ${result.error.message} (Code: ${result.error.code})`);
                            } else {
                                Alert.alert("Canceled", "Premium subscription authentication canceled.");
                                return;
                            }
                        } else {
                            // Success case - authentication completed successfully
                            console.log('[RequiredPaymentScreen] Mobile authentication completed successfully');
                            await handlePaymentSuccess();
                        }
                    } else {
                        throw new Error('Mobile payment sheet not available on web platform');
                    }
                }
            } else {
                throw new Error('Unexpected billing response format');
            }

        } catch (error: any) {
            console.error('[RequiredPaymentScreen] Error in handlePremiumSetupSuccess:', error);
            Alert.alert('Premium Setup Error', `Failed to complete premium subscription: ${error.message}`);
            setError(error.message || 'Premium subscription setup failed');
        } finally {
            setIsStripeActionActive(false);
            setIsLoadingData(false);
        }
    };

    // Simplified focus effect - only loads data when needed, no redirect logic
    useFocusEffect(
        useCallback(() => {
            if (isOrganizer) {
                console.log("[RequiredPayment] Screen focused, running organizer verification.");
                verifyAndSetupOrganizer();
            } else if (isPremiumUser) {
                // This logic remains for premium music lovers
                if (userId && userEmail) {
                    loadPaymentData();
                }
            } else {
                setIsLoadingData(false);
            }
        }, [isOrganizer, isPremiumUser, userId, userEmail, verifyAndSetupOrganizer, loadPaymentData])
    );

    const handleCardSavedSuccessfully = async (paymentMethodId?: string) => {
        console.log('[RequiredPaymentScreen] Card saved successfully. Setting as default and refreshing profile...');
        setError(null);
        setIsLoadingData(true);
        setStatusMessage('Saving payment details...');
    
        try {
            const customerId = paymentParams?.setupIntent?.customerId;
            if (!customerId) throw new Error('Customer ID not found after card save.');
    
            // Set the new card as the default for future charges
            if (paymentMethodId) {
                await setPaymentMethodAsDefault(paymentMethodId, customerId);
            } else {
                // Fallback for mobile if ID is not returned
                const { data, error } = await supabase.functions.invoke('list-organizer-payment-methods', {
                    body: { customerId: customerId }
                });
                if (error) throw new Error(`Failed to fetch payment methods: ${error.message}`);
                const paymentMethods = data?.paymentMethods || [];
                if (paymentMethods.length > 0) {
                    await setPaymentMethodAsDefault(paymentMethods[0].id, customerId);
                } else {
                    throw new Error('No payment methods found after card save.');
                }
            }
            
            // Enable app tour for organizers after payment method is saved
            // Do this BEFORE refreshing so the refresh picks up the new value
            if (isOrganizer && userId) {
                console.log('[RequiredPaymentScreen] 🎯 Enabling app tour for organizer...');
                try {
                    await supabase
                        .from('organizer_profiles')
                        .update({ has_completed_tour: false })
                        .eq('user_id', userId);
                    console.log('[RequiredPaymentScreen] ✅ App tour enabled in database for organizer');
                } catch (tourError) {
                    console.error('[RequiredPaymentScreen] ⚠️ Error enabling app tour:', tourError);
                    // Don't block flow if tour setup fails
                }
            }
            
            console.log('[RequiredPaymentScreen] Payment method saved. Refreshing profile to continue setup.');
            // This refresh is CRITICAL. It updates the `organizerProfile` in the auth context.
            // The useFocusEffect will then re-run `verifyAndSetupOrganizer`, which will now pass Step 1.
            await refreshUserProfile();
    
        } catch (error: any) {
            console.error('[RequiredPaymentScreen] Error in handleCardSavedSuccessfully:', error);
            setError(error.message || 'Failed to save payment method. Please try again.');
            setIsLoadingData(false); // Stop loading on error
        }
    };

    // Render logic
    if (authLoading && !currentProfile) {
        return (
            <SafeAreaView style={styles.centeredMessage}>
                <ActivityIndicator size="large" />
                <Text style={styles.loadingTextUi}>Loading user data...</Text>
            </SafeAreaView>
        );
    }

    if (!userId && !authLoading) {
        return (
            <SafeAreaView style={styles.centeredMessage}>
                <Text style={styles.infoText}>Please log in to continue.</Text>
            </SafeAreaView>
        );
    }

    if (isLoadingData && !error) {
        return (
            <SafeAreaView style={styles.centeredMessage}>
                <ActivityIndicator size="large" />
                <Text style={styles.loadingTextUi}>{statusMessage}</Text>
            </SafeAreaView>
        );
    }

    const userTypeText = isOrganizer ? 'Organizer' : 'Premium';
    const description = isOrganizer 
        ? 'As an organizer, a payment method is required to manage transactions and fees.'
        : 'As a premium user, a payment method is required for your subscription.';

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity 
                    onPress={() => {
                        // Organizer: handleBackPress sets flag and AppNavigator shows OrganizerSignUpFlow
                        // Premium without payment: handleBackPress shows alert and blocks
                        if (handleBackPress()) return;
                        // Optional dev-only: offer sign out when back is allowed (e.g. future cases)
                        if (__DEV__) {
                            Alert.alert(
                                "Exit Payment Setup?",
                                "Sign out and return to the login screen?",
                                [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Sign Out", style: "destructive", onPress: () => logout() }
                                ]
                            );
                        }
                    }} 
                    style={styles.backButton}
                >
                    <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Payment Method Required</Text>
                </View>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                <View style={styles.mainCard}>
                    {/* Header Section */}
                    <View style={styles.headerSection}>
                        <View style={styles.iconContainer}>
                            <Feather name="credit-card" size={32} color={APP_CONSTANTS.COLORS.PRIMARY} />
                        </View>
                        <Text style={styles.title}>
                            {isPremiumUser ? 'Complete Premium Subscription' : 'Add Payment Method'}
                        </Text>
                        <Text style={styles.subtitle}>{userTypeText} Account</Text>
                        <Text style={styles.description}>{description}</Text>
                    </View>

                    {/* Error Display */}
                    {error && (
                        <View style={styles.errorContainer}>
                            <Feather name="alert-circle" size={20} color={APP_CONSTANTS.COLORS.ERROR} />
                            <Text style={styles.errorText}>{error}</Text>
                            {!(showConnectOnboarding && isOrganizer) && (
                                <TouchableOpacity style={styles.retryButton} onPress={isOrganizer ? verifyAndSetupOrganizer : loadPaymentData}>
                                    <Text style={styles.retryButtonText}>Try Again</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* NEW: Stripe Connect Onboarding Step */}
                    {showConnectOnboarding && !isLoadingData && (
                        <View style={styles.onboardingStepContainer}>
                            <View style={styles.connectStepBadge}>
                                <Text style={styles.connectStepBadgeText}>Required step</Text>
                            </View>
                            <Feather name="link" size={52} color="#635BFF" />
                            <Text style={styles.onboardingTitle}>Set Up Payouts</Text>
                            <Text style={styles.onboardingSubtitle}>Connect a Stripe account to receive payments from your ticket sales</Text>
                            <Text style={styles.onboardingDescription}>
                                You'll be redirected to Stripe to complete setup. This takes about 2 minutes.
                            </Text>
                            <Text style={styles.connectCtaLabel}>Click the button below to continue</Text>
                            <TouchableOpacity
                                style={[styles.connectButton, isCreatingConnectLink && styles.buttonDisabled]}
                                onPress={handleConnectStripe}
                                disabled={isCreatingConnectLink}
                                activeOpacity={0.85}
                            >
                                {isCreatingConnectLink ? (
                                    <ActivityIndicator color="#FFFFFF" size="large" />
                                ) : (
                                    <>
                                        <Feather name="external-link" size={22} color="white" style={{ marginRight: 12 }} />
                                        <Text style={styles.connectButtonText}>Connect with Stripe</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Payment Form (hide if showing connect step) */}
                    {!showConnectOnboarding && paymentParams && paymentParams.setupIntent && !isLoadingData && (
                        <View style={styles.formSection}>
                            <PaymentHandler
                                paymentParams={paymentParams}
                                isPremiumUser={isPremiumUser}
                                handlePremiumSetupSuccess={handlePremiumSetupSuccess}
                                handleCardSavedSuccessfully={handleCardSavedSuccessfully}
                            />
                            <Text style={styles.securityText}>
                                🔒 Your payment information is securely processed by Stripe and encrypted end-to-end.
                            </Text>
                        </View>
                    )}

                    {!paymentParams && !error && !isLoadingData && !showConnectOnboarding && (
                        <View style={styles.formSection}>
                            <TouchableOpacity style={styles.button} onPress={loadPaymentData}>
                                <Text style={styles.buttonText}>Try Again</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: APP_CONSTANTS.COLORS.BORDER,
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    backButton: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerContent: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: 20,
    },
    mainCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    headerSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}10`,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.PRIMARY,
        marginBottom: 12,
    },
    description: {
        fontSize: 14,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        textAlign: 'center',
        lineHeight: 20,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${APP_CONSTANTS.COLORS.ERROR}10`,
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
    },
    errorText: {
        color: APP_CONSTANTS.COLORS.ERROR,
        fontSize: 14,
        marginLeft: 8,
        flex: 1,
    },
    retryButton: {
        marginLeft: 16,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: `${APP_CONSTANTS.COLORS.ERROR}20`,
        borderRadius: 8,
    },
    retryButtonText: {
        color: APP_CONSTANTS.COLORS.ERROR,
        fontWeight: '600',
        fontSize: 14,
    },
    formSection: {
        width: '100%',
    },
    webFormContainer: {
        width: '100%',
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
        marginBottom: 16,
        textAlign: 'center',
    },
    loadingMessageContainer: {
        alignItems: 'center',
        padding: 20,
    },
    loadingTextUi: {
        marginTop: 12,
        fontSize: 14,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        textAlign: 'center',
    },
    button: {
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    buttonDisabled: {
        backgroundColor: APP_CONSTANTS.COLORS.DISABLED,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    errorTextWeb: {
        color: APP_CONSTANTS.COLORS.ERROR,
        fontSize: 14,
        textAlign: 'center',
        marginTop: 12,
    },
    securityText: {
        fontSize: 12,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        textAlign: 'center',
        lineHeight: 16,
    },
    submitButton: {
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
    },
    submitButtonDisabled: {
        backgroundColor: APP_CONSTANTS.COLORS.DISABLED,
    },
    submitButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    centeredMessage: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    infoText: {
        fontSize: 16,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        textAlign: 'center',
    },
    onboardingStepContainer: {
        alignItems: 'center',
        paddingVertical: 28,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderTopColor: APP_CONSTANTS.COLORS.BORDER,
        marginTop: 24,
        backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND_LIGHT || '#F9FAFB',
        borderRadius: 16,
        marginHorizontal: 4,
    },
    connectStepBadge: {
        backgroundColor: '#635BFF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 16,
    },
    connectStepBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: 'white',
        letterSpacing: 0.3,
    },
    onboardingTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
        marginTop: 4,
        marginBottom: 4,
        textAlign: 'center',
    },
    onboardingSubtitle: {
        fontSize: 16,
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        marginBottom: 12,
        textAlign: 'center',
    },
    onboardingDescription: {
        fontSize: 15,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 16,
        maxWidth: '100%',
    },
    connectCtaLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
        marginBottom: 12,
        textAlign: 'center',
    },
    connectButton: {
        flexDirection: 'row',
        backgroundColor: '#635BFF',
        paddingVertical: 20,
        paddingHorizontal: 32,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'stretch',
        minHeight: 60,
        shadowColor: '#635BFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    connectButtonText: {
        fontSize: 20,
        fontWeight: '800',
        color: 'white',
        letterSpacing: 0.3,
    },
});

export default RequiredPaymentScreen;