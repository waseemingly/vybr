import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Alert,
    ActivityIndicator, Platform, ScrollView, BackHandler
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, NavigationProp, useFocusEffect } from '@react-navigation/native';
import { APP_CONSTANTS } from '@/config/constants';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

// --- Stripe Imports ---
import { useStripe as useNativeStripe } from '@stripe/stripe-react-native';
import { loadStripe, StripeElementsOptions, Appearance } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe as useWebStripe, useElements } from '@stripe/react-stripe-js';

import type { RootStackParamList } from '@/navigation/AppNavigator';

// --- Stripe Configuration ---
const STRIPE_PUBLISHABLE_KEY_NATIVE = "pk_test_51RDGZpDHMm6OC3yQwI460w1bESyWDQoSdNLBU9TOhciyc7NlbJ5upgCTJsP6OAuYt8cUeywcbkwQGCBI7VDCMNuz00qld2OSdN";
const STRIPE_PUBLISHABLE_KEY_WEB = "pk_test_51RDGZpDHMm6OC3yQwI460w1bESyWDQoSdNLBU9TOhciyc7NlbJ5upgCTJsP6OAuYt8cUeywcbkwQGCBI7VDCMNuz00qld2OSdN";
const PREMIUM_PLAN_PRICE_ID = 'price_1ROtS1DHMm6OC3yQAkqDjUWd'; // Premium plan price ID
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

const StripeSetupFormWebRequired = ({ clientSecret, onSetupSuccess, onSetupError }: {
    clientSecret: string;
    onSetupSuccess: (setupIntentId: string, paymentMethodId?: string) => void;
    onSetupError: (errorMsg: string) => void;
}) => {
    const stripe = useWebStripe();
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
                    return_url: window.location.origin,
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
            <PaymentElement 
                onReady={() => {
                    console.log('[StripeSetupFormWebRequired] PaymentElement is ready');
                    setIsPaymentElementReady(true);
                }}
                options={{
                    layout: 'tabs'
                }}
            />
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
    const stripe = useWebStripe();
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
                    return_url: `${window.location.origin}/payment-confirmation`,
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
            <PaymentElement 
                onReady={() => {
                    console.log('[StripePaymentFormWebRequired] PaymentElement is ready');
                    setIsPaymentElementReady(true);
                }}
                options={{
                    layout: 'tabs'
                }}
            />
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

const RequiredPaymentScreen: React.FC = () => {
    const navigation = useNavigation<RequiredPaymentNavigationProp>();
    const { session, loading: authLoading, refreshUserProfile, musicLoverProfile, organizerProfile, updatePremiumStatus } = useAuth();
    const { initPaymentSheet, presentPaymentSheet } = useNativeStripe();

    const userId = session?.user?.id;
    const userEmail = session?.user?.email;
    const userType = session?.userType;
    const isOrganizer = userType === 'organizer';
    const isPremiumUser = musicLoverProfile?.isPremium ?? false;
    const currentProfile = isOrganizer ? organizerProfile : musicLoverProfile;
    const currentStripeCustomerId = isOrganizer 
        ? (organizerProfile as any)?.stripe_customer_id 
        : (musicLoverProfile as any)?.stripe_customer_id;
    
    // Enhanced payment requirement validation
    const isPaymentMethodRequired = isOrganizer || (userType === 'music_lover' && isPremiumUser);
    const hasValidPaymentMethod = Boolean(currentStripeCustomerId && currentStripeCustomerId.trim() !== '');
    
    // Enhanced logging for debugging
    console.log("[RequiredPayment] =========================");
    console.log("[RequiredPayment] Component mounted/rendered");
    console.log("[RequiredPayment] User ID:", userId);
    console.log("[RequiredPayment] User Type:", userType);
    console.log("[RequiredPayment] Is Organizer:", isOrganizer);
    console.log("[RequiredPayment] Is Premium User:", isPremiumUser);
    console.log("[RequiredPayment] Payment Required:", isPaymentMethodRequired);
    console.log("[RequiredPayment] Stripe Customer ID:", currentStripeCustomerId ? `${currentStripeCustomerId.substring(0, 10)}...` : 'None');
    console.log("[RequiredPayment] Has Valid Payment Method:", hasValidPaymentMethod);
    console.log("[RequiredPayment] Should Show Payment Screen:", isPaymentMethodRequired && !hasValidPaymentMethod);
    console.log("[RequiredPayment] =========================");

    const [paymentParams, setPaymentParams] = useState<PaymentParams | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isStripeActionActive, setIsStripeActionActive] = useState(false);

    // Enhanced back button handling - prevent ANY navigation away from this screen
    const handleBackPress = useCallback(() => {
        console.log("[RequiredPayment] Back press detected - preventing navigation");
        
        // Show alert explaining why they can't go back
        if (isPaymentMethodRequired && !hasValidPaymentMethod) {
            Alert.alert(
                "Payment Required",
                isOrganizer 
                    ? "As an organizer, you must add a payment method to continue using the app. This ensures you can process payments and manage your events properly."
                    : "As a premium user, you must add a payment method to continue using premium features. Please complete the payment setup to proceed.",
                [{ text: "OK" }]
            );
            return true; // Prevent default back action
        }
        return false; // Allow default back action
    }, [isPaymentMethodRequired, hasValidPaymentMethod, isOrganizer]);

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
            // CRITICAL: Refresh user profile to update the AppNavigator
            console.log('[RequiredPaymentScreen] Refreshing user profile to update AppNavigator...');
            await refreshUserProfile();
            
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
            const { data: billingData, error: billingError } = await supabase.functions.invoke('create-premium-subscription', {
                body: JSON.stringify({
                    priceId: PREMIUM_PLAN_PRICE_ID,
                    userId,
                    userEmail,
                    paymentMethodId: paymentMethodId, // Pass the saved payment method ID
                }),
            });

            if (billingError) {
                console.error('[RequiredPaymentScreen] Billing error:', billingError);
                throw new Error(billingError.message || "Function invocation error for premium billing.");
            }
            
            if (billingData && billingData.error) {
                console.error('[RequiredPaymentScreen] Billing data error:', billingData.error);
                throw new Error(billingData.error || "Backend failed to process premium billing.");
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
                            return_url: `${window.location.origin}/payment-confirmation`,
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
                    
                    setIsStripeActionActive(true);
                    const { error: initError } = await initPaymentSheet({
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

                    const result = await presentPaymentSheet();
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

            // For premium users, we'll start with SetupIntent to save the payment method
            // Then use the saved payment method for billing in handlePremiumSetupSuccess
            if (userType === 'music_lover' && isPremiumUser) {
                console.log('[RequiredPayment] Premium user detected - creating SetupIntent for card saving first...');
                
                const { data: siData, error: siError } = await supabase.functions.invoke('create-organizer-setup-intent', {
                    body: JSON.stringify({
                        userId: userId,
                        email: userEmail,
                        userType: userType,
                        companyName: (currentProfile as any)?.displayName || '',
                    }),
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
                    body: JSON.stringify({
                        userId: userId,
                        email: userEmail,
                        userType: userType,
                        companyName: isOrganizer ? (currentProfile as any)?.companyName || '' : (currentProfile as any)?.displayName || '',
                    }),
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

    // Simplified focus effect - only loads data when needed, no redirect logic
    useFocusEffect(
        useCallback(() => {
            console.log("[RequiredPayment] Screen focused, loading payment data...");
            
            if (userId && userEmail) {
                loadPaymentData();
            } else if (!authLoading) {
                setError("User details not fully loaded.");
                setIsLoadingData(false);
            }
        }, [loadPaymentData, userId, userEmail, authLoading])
    );

    const handleCardSavedSuccessfully = async (paymentMethodId?: string) => {
        console.log('[RequiredPaymentScreen] Card saved successfully, paymentMethodId:', paymentMethodId);
        setError('');
        setIsLoadingData(true);

        try {
            const customerId = paymentParams?.setupIntent?.customerId || paymentParams?.paymentIntent?.customerId;
            
            if (!customerId) {
                throw new Error('Customer ID not found in payment parameters');
            }

            // Set payment method as default if paymentMethodId is provided
            if (paymentMethodId) {
                console.log('[RequiredPaymentScreen] Setting payment method as default:', paymentMethodId);
                await setPaymentMethodAsDefault(paymentMethodId, customerId);
            } else {
                console.log('[RequiredPaymentScreen] No paymentMethodId provided, checking existing payment methods...');
                
                // Fallback: Fetch payment methods and set the first one as default
                const { data, error } = await supabase.functions.invoke('list-organizer-payment-methods', {
                    body: JSON.stringify({
                        customerId: customerId
                    })
                });

                if (error) {
                    console.error('[RequiredPaymentScreen] Error fetching payment methods for fallback:', error);
                    throw new Error(`Failed to fetch payment methods: ${error.message}`);
                }

                const paymentMethods = data?.paymentMethods || [];
                if (paymentMethods.length > 0) {
                    const firstPaymentMethod = paymentMethods[0];
                    console.log('[RequiredPaymentScreen] Setting first payment method as default:', firstPaymentMethod.id);
                    await setPaymentMethodAsDefault(firstPaymentMethod.id, customerId);
                } else {
                    console.warn('[RequiredPaymentScreen] No payment methods found after successful card save!');
                    throw new Error('No payment methods found after card save');
                }
            }

            // CRITICAL: Refresh user profile to update the AppNavigator
            console.log('[RequiredPaymentScreen] Refreshing user profile to update AppNavigator...');
            await refreshUserProfile();
            
            console.log('[RequiredPaymentScreen] Payment method setup completed successfully!');
            
            // Let the AppNavigator handle the navigation based on the refreshed profile
            // No manual navigation here - AppNavigator will detect the payment method change

        } catch (error: any) {
            console.error('[RequiredPaymentScreen] Error in handleCardSavedSuccessfully:', error);
            setError(error.message || 'Payment setup failed. Please try again.');
        } finally {
            setIsLoadingData(false);
        }
    };

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
            const merchantName = isPremiumUser ? 'VYBR Premium' : (isOrganizer ? 'VYBR Organizer' : 'VYBR');
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
                console.log('[RequiredPayment Mobile] Payment method setup completed successfully, processing...');
                
                if (isPremiumUser) {
                    // For premium users, this will trigger billing after card save
                    await handlePremiumSetupSuccess('mobile_setup_success'); // No setup intent ID available on mobile
                } else {
                    // For organizers, just save the card
                    await handleCardSavedSuccessfully(); // No payment method ID available on mobile
                }
            }
        } catch (e: any) {
            console.error('[RequiredPayment Mobile] Error:', e);
            Alert.alert("Error", `${isPremiumUser ? 'Premium subscription' : 'Payment method'} setup failed: ${e.message}`);
        } finally {
            setIsStripeActionActive(false);
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
                <Text style={styles.loadingTextUi}>Setting up payment form...</Text>
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
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Payment Method Required</Text>
                </View>
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
                        </View>
                    )}

                    {/* Payment Form */}
                    {paymentParams && paymentParams.setupIntent && (
                        <View style={styles.formSection}>
                            {Platform.OS === 'web' ? (
                                stripePromiseWeb ? (
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
                                ) : (
                                    <View style={styles.centeredMessage}>
                                        <ActivityIndicator />
                                        <Text style={styles.loadingTextUi}>Loading web payment form...</Text>
                                    </View>
                                )
                            ) : (
                                <TouchableOpacity
                                    style={[styles.button, (isStripeActionActive || isLoadingData) && styles.buttonDisabled]}
                                    onPress={handleMobilePayment}
                                    disabled={isStripeActionActive || isLoadingData}
                                >
                                    {(isStripeActionActive || isLoadingData) ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.buttonText}>
                                            {isPremiumUser ? 'Complete Premium Subscription' : 'Add Payment Method'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            )}
                            <Text style={styles.securityText}>
                                🔒 Your payment information is securely processed by Stripe and encrypted end-to-end.
                            </Text>
                        </View>
                    )}

                    {!paymentParams && !error && !isLoadingData && (
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
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: APP_CONSTANTS.COLORS.BORDER,
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    headerContent: {
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
});

export default RequiredPaymentScreen; 