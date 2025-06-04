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
const stripePromiseWeb = Platform.OS === 'web' ? loadStripe(STRIPE_PUBLISHABLE_KEY_WEB) : null;

type RequiredPaymentNavigationProp = NavigationProp<RootStackParamList>;

const StripeSetupFormWebRequired = ({ clientSecret, onSetupSuccess, onSetupError }: {
    clientSecret: string;
    onSetupSuccess: (setupIntentId: string) => void;
    onSetupError: (errorMsg: string) => void;
}) => {
    const stripe = useWebStripe();
    const elements = useElements();
    const [isProcessingWebPayment, setIsProcessingWebPayment] = useState(false);
    const [errorMessageWeb, setErrorMessageWeb] = useState<string | null>(null);
    const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);

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
        const returnUrl = `${window.location.origin}/payment-method-setup-complete`;

        try {
            const result = await stripe.confirmSetup({
                elements,
                confirmParams: { return_url: returnUrl },
            });

            if (result.error) {
                console.error('[StripeSetupFormWebRequired] stripe.confirmSetup error:', result.error);
                setErrorMessageWeb(result.error.message || 'Failed to save card.');
                onSetupError(result.error.message || 'Failed to save card.');
            } else {
                // Success case - result has setupIntent when no error
                const setupIntent = (result as any).setupIntent;
                if (setupIntent?.status === 'succeeded') {
                    onSetupSuccess(setupIntent.id);
                } else if (setupIntent?.status === 'requires_action' || setupIntent?.status === 'requires_confirmation') {
                    // Redirect is handled by Stripe.js
                } else {
                    const msg = `Setup failed. Status: ${setupIntent?.status || 'Unknown'}.`;
                    setErrorMessageWeb(msg);
                    onSetupError(msg);
                }
            }
        } catch (error: any) {
            console.error('[StripeSetupFormWebRequired] Unexpected error:', error);
            setErrorMessageWeb('An unexpected error occurred.');
            onSetupError('An unexpected error occurred.');
        }
        
        setIsProcessingWebPayment(false);
    };

    return (
        <View style={styles.webFormContainer}>
            <Text style={styles.inputLabel}>Securely Add Your Card</Text>
            {!isPaymentElementReady && (
                <View style={styles.loadingMessageContainer}>
                    <ActivityIndicator />
                    <Text style={styles.loadingTextUi}>Loading payment form...</Text>
                </View>
            )}
            <View style={{ display: isPaymentElementReady ? 'flex' : 'none' }}>
                <PaymentElement
                    onReady={() => {
                        console.log('%c[StripeSetupFormWebRequired] PaymentElement onReady FIRED!', 'color: green; font-weight: bold;');
                        setIsPaymentElementReady(true);
                    }}
                    onChange={(event) => {
                        if (event.complete === false && event.value?.type) {
                            setErrorMessageWeb(null);
                        }
                    }}
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

const RequiredPaymentScreen: React.FC = () => {
    const navigation = useNavigation<RequiredPaymentNavigationProp>();
    const { session, loading: authLoading, refreshUserProfile, musicLoverProfile, organizerProfile } = useAuth();
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

    const [setupIntentParams, setSetupIntentParams] = useState<{ clientSecret: string; customerId: string; ephemeralKey: string } | null>(null);
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

    // Additional effect to monitor for profile changes and redirect if payment method is added elsewhere
    useEffect(() => {
        if (isPaymentMethodRequired && hasValidPaymentMethod) {
            console.log("[RequiredPayment] Payment method detected, navigating to main app");
            // Payment method was added, navigate to main app
            if (isOrganizer) {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'MainApp', params: { screen: 'OrganizerTabs' } }],
                });
            } else if (isPremiumUser) {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'MainApp', params: { screen: 'UserTabs' } }],
                });
            }
        }
    }, [hasValidPaymentMethod, isPaymentMethodRequired, isOrganizer, isPremiumUser, navigation]);

    const loadSetupIntentData = useCallback(async () => {
        console.log(`[RequiredPayment] loadSetupIntentData CALLED.`);

        if (!userId || !userEmail) {
            setError("User details missing. Please ensure you are logged in.");
            setIsLoadingData(false);
            return;
        }

        setIsLoadingData(true);
        setError(null);
        setSetupIntentParams(null);

        try {
            console.log('[RequiredPayment] Fetching/Creating SetupIntent params...');
            const { data: siData, error: siError } = await supabase.functions.invoke('create-organizer-setup-intent', {
                body: JSON.stringify({
                    userId: userId,
                    email: userEmail,
                    userType: userType,
                    companyName: isOrganizer ? (currentProfile as any)?.companyName || '' : (currentProfile as any)?.displayName || '',
                }),
            });
            console.log('[RequiredPayment] "create-organizer-setup-intent" RAW RESPONSE: data=', JSON.stringify(siData), 'siError=', siError);

            if (siError) throw new Error(siError.message || "Function invocation error for SetupIntent.");
            if (siData && siData.error) throw new Error(siData.error || "Backend failed to prepare payment setup.");
            if (!siData?.clientSecret || !siData?.customerId) throw new Error("Invalid setup details from server (missing clientSecret or customerId).");

            setSetupIntentParams({
                clientSecret: siData.clientSecret,
                customerId: siData.customerId,
                ephemeralKey: siData.ephemeralKey,
            });
            console.log('[RequiredPayment] Successfully set setupIntentParams.');

        } catch (e: any) {
            console.error("[RequiredPayment] CRITICAL ERROR in loadSetupIntentData:", e.message, e);
            setError(e.message);
        } finally {
            setIsLoadingData(false);
        }
    }, [userId, userEmail, currentProfile, userType, isOrganizer]);

    // Enhanced focus effect to ensure data is always fresh when screen is accessed
    useFocusEffect(
        useCallback(() => {
            console.log("[RequiredPayment] Screen focused, checking requirements...");
            
            if (userId && userEmail) {
                // Double-check that payment is still required
                if (isPaymentMethodRequired && !hasValidPaymentMethod) {
                    console.log("[RequiredPayment] Payment still required, loading setup data...");
                    loadSetupIntentData();
                } else {
                    console.log("[RequiredPayment] Payment no longer required, should redirect...");
                }
            } else if (!authLoading) {
                setError("User details not fully loaded.");
                setIsLoadingData(false);
            }
        }, [loadSetupIntentData, userId, userEmail, authLoading, isPaymentMethodRequired, hasValidPaymentMethod])
    );

    const handleCardSavedSuccessfully = async () => {
        Alert.alert("Success!", "Your payment method has been saved.", [
            {
                text: "Continue",
                onPress: async () => {
                    if (refreshUserProfile) {
                        console.log("[RequiredPayment] Card saved, calling refreshUserProfile...");
                        await refreshUserProfile();
                        console.log("[RequiredPayment] refreshUserProfile completed.");
                    }

                    // Set the payment method as default automatically
                    try {
                        if (currentStripeCustomerId && setupIntentParams?.customerId) {
                            console.log("[RequiredPayment] Setting payment method as default...");
                            // Get the latest payment methods to find the new one
                            const { data, error } = await supabase.functions.invoke('list-organizer-payment-methods', {
                                body: JSON.stringify({
                                    customerId: currentStripeCustomerId
                                })
                            });

                            if (!error && data?.paymentMethods && data.paymentMethods.length > 0) {
                                // Set the first (newest) payment method as default
                                const newestPaymentMethod = data.paymentMethods[0];
                                await supabase.functions.invoke('set-default-payment-method', {
                                    body: JSON.stringify({
                                        customerId: currentStripeCustomerId,
                                        paymentMethodId: newestPaymentMethod.id
                                    })
                                });
                                console.log("[RequiredPayment] Payment method set as default successfully.");
                            }
                        }
                    } catch (error) {
                        console.error("[RequiredPayment] Error setting default payment method:", error);
                        // Don't block navigation on this error
                    }

                    // Navigate to the appropriate screen based on user type
                    if (isOrganizer) {
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'MainApp', params: { screen: 'OrganizerTabs' } }],
                        });
                    } else if (isPremiumUser) {
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'MainApp', params: { screen: 'UserTabs' } }],
                        });
                    }
                }
            }
        ]);
    };

    const handleMobileAddCard = async () => {
        if (!setupIntentParams?.clientSecret || !setupIntentParams?.customerId || !setupIntentParams?.ephemeralKey) {
            Alert.alert("Error", "Payment setup details are not ready. Please try refreshing.");
            return;
        }
        setIsStripeActionActive(true);
        try {
            const merchantName = isOrganizer ? 'VYBR Organizer' : 'VYBR Premium';
            const { error: initError } = await initPaymentSheet({
                merchantDisplayName: merchantName,
                customerId: setupIntentParams.customerId,
                customerEphemeralKeySecret: setupIntentParams.ephemeralKey,
                setupIntentClientSecret: setupIntentParams.clientSecret,
                allowsDelayedPaymentMethods: true,
                returnURL: `vybr://stripe-redirect-payment-setup`,
            });
            if (initError) throw new Error(`Init Error: ${initError.message} (Code: ${initError.code})`);

            const result = await presentPaymentSheet();
            console.log('[RequiredPayment Mobile] presentPaymentSheet Response:', JSON.stringify(result));

            if (result.error) {
                if (result.error.code !== 'Canceled') {
                    throw new Error(`Present Error: ${result.error.message} (Code: ${result.error.code})`);
                } else {
                    Alert.alert("Canceled", "Payment method setup canceled.");
                }
            } else {
                // Success case - payment sheet completed successfully
                await handleCardSavedSuccessfully();
            }
        } catch (e: any) {
            Alert.alert("Error", `Payment method setup failed: ${e.message}`);
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
                        <Text style={styles.title}>Add Payment Method</Text>
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
                    {setupIntentParams?.clientSecret && (
                        <View style={styles.formSection}>
                            {Platform.OS === 'web' ? (
                                stripePromiseWeb ? (
                                    <Elements stripe={stripePromiseWeb} options={{ 
                                        clientSecret: setupIntentParams.clientSecret, 
                                        appearance: { theme: 'stripe' } 
                                    }}>
                                        <StripeSetupFormWebRequired
                                            clientSecret={setupIntentParams.clientSecret}
                                            onSetupSuccess={handleCardSavedSuccessfully}
                                            onSetupError={(errMsg) => {
                                                Alert.alert("Save Card Error", `Failed to save card: ${errMsg}. Please check details or try another card.`);
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
                                    onPress={handleMobileAddCard}
                                    disabled={isStripeActionActive || isLoadingData}
                                >
                                    {(isStripeActionActive || isLoadingData) ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.buttonText}>Add Payment Method</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                            <Text style={styles.securityText}>
                                🔒 Your payment information is securely processed by Stripe and encrypted end-to-end.
                            </Text>
                        </View>
                    )}

                    {!setupIntentParams?.clientSecret && !error && !isLoadingData && (
                        <View style={styles.formSection}>
                            <TouchableOpacity style={styles.button} onPress={loadSetupIntentData}>
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