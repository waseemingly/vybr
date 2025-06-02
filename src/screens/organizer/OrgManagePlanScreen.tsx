import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Alert,
    ActivityIndicator, Platform, ScrollView, Modal, BackHandler
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

        try {
            const result = await stripe.confirmSetup({
            elements,
            confirmParams: { return_url: returnUrl },
        });

            if (result.error) {
                console.error('[StripeSetupFormWebManage] stripe.confirmSetup error:', result.error);
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
            console.error('[StripeSetupFormWebManage] Unexpected error:', error);
            setErrorMessageWeb('An unexpected error occurred.');
            onSetupError('An unexpected error occurred.');
        }
        
        setIsProcessingWebPayment(false);
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

const OrgManagePlanScreen: React.FC = () => {
    const navigation = useNavigation<OrgManagePlanNavigationProp>();
    // IMPORTANT: Destructure organizerProfile directly here. It will re-render component if it changes.
    const { session, organizerProfile, loading: authLoading, refreshUserProfile } = useAuth();
    const { initPaymentSheet, presentPaymentSheet } = useNativeStripe();

    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isStripeActionActive, setIsStripeActionActive] = useState(false);
    const [setupIntentParams, setSetupIntentParams] = useState<{ clientSecret: string; customerId: string; ephemeralKey?: string; } | null>(null);
    const [currentPaymentMethod, setCurrentPaymentMethod] = useState<{ id?: string; brand: string; last4: string; expMonth: number; expYear: number } | null>(null);
    const [allPaymentMethods, setAllPaymentMethods] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [showAddUpdateForm, setShowAddUpdateForm] = useState(false);
    const [showUpdateOptions, setShowUpdateOptions] = useState(false);
    const [showPaymentMethodsModal, setShowPaymentMethodsModal] = useState(false);
    const [paymentMethodsModalMode, setPaymentMethodsModalMode] = useState<'default' | 'delete'>('default');
    const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [pendingDeletePaymentMethod, setPendingDeletePaymentMethod] = useState<{id: string, card: any} | null>(null);

    const organizerId = session?.user?.id;
    const organizerEmail = session?.user?.email; // Prefer session email as it's more direct

    // Handle back button press and navigation prevention
    const handleBackPress = useCallback(() => {
        if (!hasPaymentMethod && !isLoadingData) {
            Alert.alert(
                "Payment Method Required",
                "You must add at least one payment method before continuing. This is required for platform services.",
                [
                    {
                        text: "Add Payment Method",
                        onPress: () => {
                            if (setupIntentParams?.clientSecret) {
                                setShowAddUpdateForm(true);
                            }
                        }
                    }
                ]
            );
            return true; // Prevent default back action
        }
        return false; // Allow default back action
    }, [hasPaymentMethod, isLoadingData, setupIntentParams]);

    // Override hardware back button on Android
    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => handleBackPress();
            
            if (Platform.OS === 'android') {
                const backSubscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
                return () => backSubscription.remove();
            }
        }, [handleBackPress])
    );

    // Override navigation header back button
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (handleBackPress()) {
                e.preventDefault();
            }
        });

        return unsubscribe;
    }, [navigation, handleBackPress]);

    const loadData = useCallback(async (isRefreshAfterCardUpdate = false) => {
        console.log(`[OrgManagePlan] loadData CALLED. isRefreshAfterCardUpdate: ${isRefreshAfterCardUpdate}`);
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
            setHasPaymentMethod(false);
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
                if (pmData?.paymentMethod) {
                    setCurrentPaymentMethod(pmData.paymentMethod);
                    setHasPaymentMethod(true);
                } else {
                    setCurrentPaymentMethod(null);
                    setHasPaymentMethod(false);
                }

                // Also fetch ALL payment methods for the list
                console.log('[OrgManagePlan] Fetching ALL payment methods for customer:', currentStripeCustomerId);
                try {
                    const { data: allPmData, error: allPmError } = await supabase.functions.invoke('list-organizer-payment-methods', {
                        body: JSON.stringify({ customerId: currentStripeCustomerId })
                    });
                    if (allPmError) {
                        console.warn("Could not fetch all payment methods:", allPmError.message);
                        setAllPaymentMethods([]);
                    } else if (allPmData?.paymentMethods) {
                        console.log('[OrgManagePlan] All payment methods fetched:', allPmData.paymentMethods);
                        setAllPaymentMethods(allPmData.paymentMethods);
                        if (allPmData.paymentMethods.length > 0) {
                            setHasPaymentMethod(true);
                        }
                    } else {
                        setAllPaymentMethods([]);
                    }
                } catch (allPmError) {
                    console.warn("Error fetching all payment methods:", allPmError);
                    setAllPaymentMethods([]);
                }
            } else {
                console.log('[OrgManagePlan] No Stripe Customer ID on profile. Skipping PM details fetch.');
                setCurrentPaymentMethod(null);
                setAllPaymentMethods([]);
                setHasPaymentMethod(false);
            }

            console.log('[OrgManagePlan] Fetching/Creating SetupIntent params...');
            const { data: siData, error: siError } = await supabase.functions.invoke('create-organizer-setup-intent', {
                body: JSON.stringify({
                    userId: organizerId,
                    email: organizerEmail,
                    companyName: profileToUse?.companyName || '', // Fixed property name
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
            const { error: initError } = await initPaymentSheet({
                merchantDisplayName: 'VYBR Organizer',
                customerId: setupIntentParams.customerId,
                customerEphemeralKeySecret: setupIntentParams.ephemeralKey,
                setupIntentClientSecret: setupIntentParams.clientSecret,
                allowsDelayedPaymentMethods: true,
                returnURL: 'vybr://stripe-redirect-organizer-manage',
            });
            if (initError) throw new Error(`Init Error: ${initError.message} (Code: ${initError.code})`);

            const result = await presentPaymentSheet();
            console.log('[OrgManagePlan Mobile] presentPaymentSheet Response:', JSON.stringify(result));

            if (result.error) {
                if (result.error.code !== 'Canceled') throw new Error(`Present Error: ${result.error.message} (Code: ${result.error.code})`);
                else Alert.alert("Canceled", "Payment method setup canceled.");
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

    const handleShowUpdateOptions = () => {
        setShowUpdateOptions(true);
    };

    const handleAddNewCard = () => {
        setShowUpdateOptions(false);
        setShowAddUpdateForm(true);
    };

    const handleManageAllCards = async (mode: 'default' | 'delete' = 'default') => {
        console.log('[OrgManagePlan] handleManageAllCards called with mode:', mode);

        if (!organizerProfile?.stripe_customer_id) {
            console.error('[OrgManagePlan] Missing Stripe Customer ID in organizerProfile. Current profile:', organizerProfile);
            Alert.alert("Error", "Your billing account ID is missing. Please try refreshing or contacting support.");
            return;
        }
        console.log(`[OrgManagePlan] Stripe Customer ID: ${organizerProfile.stripe_customer_id}`);

        setShowUpdateOptions(false);
        setIsLoadingData(true);
        console.log('[OrgManagePlan] isLoadingData set to true.');

        try {
            console.log('[OrgManagePlan] Invoking supabase.functions.invoke(\'list-organizer-payment-methods\')...');
            const { data, error } = await supabase.functions.invoke('list-organizer-payment-methods', {
                body: JSON.stringify({
                    customerId: organizerProfile.stripe_customer_id
                })
            });

            console.log('[OrgManagePlan] supabase.functions.invoke RESPONSE:');
            console.log('[OrgManagePlan] Data:', JSON.stringify(data, null, 2));
            console.log('[OrgManagePlan] Error:', JSON.stringify(error, null, 2));

            if (error) {
                console.error('[OrgManagePlan] Error from Supabase function invocation:', error);
                throw error; // This will be caught by the catch block below
            }

            if (data?.paymentMethods && data.paymentMethods.length > 0) {
                console.log('[OrgManagePlan] Payment methods found:', data.paymentMethods);
                setAllPaymentMethods(data.paymentMethods);
                setPaymentMethodsModalMode(mode);
                setShowPaymentMethodsModal(true);
            } else {
                console.log('[OrgManagePlan] No payment methods found or data is malformed. Data:', data);
                Alert.alert("No Payment Methods", "No payment methods found for this account. If you have cards, try again shortly.");
            }
        } catch (e: any) {
            console.error('[OrgManagePlan] Catch block error in handleManageAllCards:', e);
            let errorMessage = "Failed to load payment methods.";
            if (e.message) {
                errorMessage += ` Details: ${e.message}`;
            }
            if (e.context?.body?.error) { // Supabase function error structure
                errorMessage += ` Server error: ${e.context.body.error}`;
            }
            Alert.alert("Error Loading Cards", errorMessage);
        } finally {
            setIsLoadingData(false);
            console.log('[OrgManagePlan] isLoadingData set to false in finally block.');
        }
    };

    const setPaymentMethodAsDefault = async (paymentMethodId: string) => {
        setIsLoadingData(true);
        try {
            const { error } = await supabase.functions.invoke('set-default-payment-method', {
                body: JSON.stringify({
                    customerId: organizerProfile?.stripe_customer_id,
                    paymentMethodId
                })
            });

            if (error) throw error;

            Alert.alert("Success", "Default payment method updated.");
            await loadData(true);
        } catch (e: any) {
            Alert.alert("Error", `Failed to set default payment method: ${e.message}`);
        } finally {
            setIsLoadingData(false);
        }
    };

    const removeSpecificPaymentMethod = async (paymentMethodId: string, card: any) => {
        console.log('[OrgManagePlan] removeSpecificPaymentMethod called with:', { paymentMethodId, card });
        
        console.log('[OrgManagePlan] Setting up custom confirmation modal...');
        setPendingDeletePaymentMethod({ id: paymentMethodId, card });
        setShowDeleteConfirmation(true);
        console.log('[OrgManagePlan] Custom confirmation modal should be displayed');
    };

    const confirmDeletePaymentMethod = async () => {
        if (!pendingDeletePaymentMethod) {
            console.error('[OrgManagePlan] No pending payment method to delete');
            return;
        }

        const { id: paymentMethodId, card } = pendingDeletePaymentMethod;
        
        console.log('[OrgManagePlan] User confirmed removal. Starting deletion process...');
        console.log('[OrgManagePlan] Target PM ID:', paymentMethodId, 'Customer ID:', organizerProfile?.stripe_customer_id);
        
        setShowDeleteConfirmation(false);
        setPendingDeletePaymentMethod(null);
        setIsLoadingData(true);
        setShowPaymentMethodsModal(false); // Close modal immediately

        try {
            const customerStripeId = organizerProfile?.stripe_customer_id;
            if (!customerStripeId) {
                throw new Error("Stripe Customer ID is missing. Cannot proceed.");
            }

            console.log('[OrgManagePlan] Invoking delete-payment-method with:', { paymentMethodId });
            console.log('[OrgManagePlan] ABOUT TO CALL SUPABASE FUNCTION...');
            console.log('[OrgManagePlan] Supabase instance:', !!supabase);
            console.log('[OrgManagePlan] Request payload:', { paymentMethodId });
            
            const { data, error } = await supabase.functions.invoke('delete-payment-method', {
                body: { paymentMethodId },
            });

            console.log('[OrgManagePlan] FUNCTION CALL COMPLETED!');
            console.log('[OrgManagePlan] delete-payment-method response data:', JSON.stringify(data, null, 2));
            console.log('[OrgManagePlan] delete-payment-method response error:', JSON.stringify(error, null, 2));

            if (error) {
                console.error('[OrgManagePlan] Invoke error object:', JSON.stringify(error, null, 2));
                throw new Error(`Network or function invocation error: ${error.message}`);
            }

            if (data?.error) {
                throw new Error(`Removal failed on server: ${data.error}`);
            }
            
            if (!data?.success) {
                console.warn('[OrgManagePlan] Removal response did not explicitly state success, but attempting refresh.', data);
                Alert.alert("Processing Update", "Payment method status updated. Refreshing list...");
            } else {
                console.log('[OrgManagePlan] Deletion successful, showing success message');
                Alert.alert("Success", data.message || "Payment method removed. Refreshing list...");

                // Optimistically update and check for auto-default
                const updatedPaymentMethods = allPaymentMethods.filter(pm => pm.id !== paymentMethodId);
                // No need to call setAllPaymentMethods here as finally block reloads data
                // but we use updatedPaymentMethods for the count check.

                if (updatedPaymentMethods.length === 1 && updatedPaymentMethods[0]?.id) {
                    console.log('[OrgManagePlan] Only one card remaining, attempting to set as default:', updatedPaymentMethods[0].id);
                    // We await this, but loadData in finally will still run. 
                    // setPaymentMethodAsDefault also calls loadData.
                    // This is acceptable for now, ensures state is correct.
                    await setPaymentMethodAsDefault(updatedPaymentMethods[0].id);
                     // Alert after default is set if successful (setPaymentMethodAsDefault handles its own alerts)
                } else if (updatedPaymentMethods.length === 0) {
                    setHasPaymentMethod(false); // Update hasPaymentMethod if all cards removed
                }
            }

        } catch (e: any) {
            console.error('[OrgManagePlan] Catch block in removeSpecificPaymentMethod:', JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
            console.error('[OrgManagePlan] Error name:', e.name);
            console.error('[OrgManagePlan] Error message:', e.message);
            console.error('[OrgManagePlan] Error stack:', e.stack);
            Alert.alert("Error", `Could not remove payment method: ${e.message}. The list will be refreshed.`);
        } finally {
            console.log('[OrgManagePlan] Forcing UI refresh and reloading data...');
            // Optimistic UI update for immediate feedback before loadData completes
            const newAllPaymentMethods = allPaymentMethods.filter(pm => pm.id !== paymentMethodId);
            setAllPaymentMethods(newAllPaymentMethods);
            if (newAllPaymentMethods.length === 0) {
                setHasPaymentMethod(false);
                setCurrentPaymentMethod(null); // Clear current PM if all are gone
            } else {
                 // If currentPaymentMethod was the one deleted, and others remain, 
                 // loadData will pick up the new default or one of the remaining ones.
                 // If the deleted one was not the current one, currentPaymentMethod remains valid until loadData.
                 if (currentPaymentMethod?.id === paymentMethodId) {
                    setCurrentPaymentMethod(null); // Clear it so UI doesn't show old default briefly
                 }
            }
            
            await loadData(true); // Always reload data to get the true state from the server
            setIsLoadingData(false);
            console.log('[OrgManagePlan] confirmDeletePaymentMethod action fully completed.');
        }
    };

    const cancelDeletePaymentMethod = () => {
        console.log('[OrgManagePlan] User canceled deletion');
        setShowDeleteConfirmation(false);
        setPendingDeletePaymentMethod(null);
    };

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
                <TouchableOpacity 
                    onPress={() => {
                        if (!handleBackPress()) {
                            navigation.goBack();
                        }
                    }} 
                    style={styles.backButton}
                >
                    <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Payment Method</Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Payment Method Required Notice */}
                {!hasPaymentMethod && !isLoadingData && !error && (
                    <View style={styles.requirementNotice}>
                        <Feather name="alert-circle" size={20} color="#F59E0B" />
                        <Text style={styles.requirementText}>
                            A payment method is required for platform services. Please add one to continue.
                        </Text>
                    </View>
                )}

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
                    </View>
                )}

                {!error && allPaymentMethods.length > 0 && !showAddUpdateForm && (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>All Payment Methods ({allPaymentMethods.length})</Text>
                        {allPaymentMethods.map((pm, index) => (
                            <View 
                                key={pm.id} 
                                style={[styles.paymentMethodItem, index > 0 && { marginTop: 10 }]}
                            >
                                <View style={styles.paymentMethodDetails}>
                                    <Feather name="credit-card" size={20} color={APP_CONSTANTS.COLORS.PRIMARY} />
                                    <View style={styles.cardTextContainer}>
                                        <Text style={styles.cardBrand}>{pm.card.brand.toUpperCase()}</Text>
                                        <Text style={styles.cardLast4}>**** **** **** {pm.card.last4}</Text>
                                    </View>
                                    <View style={styles.cardExpiryContainer}>
                                        <Text style={styles.cardExpiry}>Expires {String(pm.card.expMonth).padStart(2, '0')}/{pm.card.expYear.toString().slice(-2)}</Text>
                                        {pm.isDefault && <Text style={styles.defaultBadge}>DEFAULT</Text>}
                                    </View>
                                </View>
                            </View>
                        ))}
                        <TouchableOpacity style={[styles.button, { marginTop: 15 }]} onPress={handleShowUpdateOptions}>
                            <Text style={styles.buttonText}>Manage Card Payment Options</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {!error && !currentPaymentMethod && !showAddUpdateForm && (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>No Payment Method Saved</Text>
                        <Text style={styles.infoText}>Add a payment method for platform services.</Text>
                        {setupIntentParams?.clientSecret ? (
                            <TouchableOpacity style={[styles.button, { marginTop: 15 }]} onPress={handleShowUpdateOptions}>
                                <Text style={styles.buttonText}>Add First Payment Method</Text>
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
            </ScrollView>

            {/* Update Options Modal */}
            <Modal
                visible={showUpdateOptions}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowUpdateOptions(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Update Cards</Text>
                        <Text style={styles.modalSubtitle}>Choose an option:</Text>

                        <TouchableOpacity style={styles.modalButton} onPress={handleAddNewCard}>
                            <Feather name="plus" size={20} color={APP_CONSTANTS.COLORS.PRIMARY} />
                            <Text style={styles.modalButtonText}>Add New Card</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.modalButton} onPress={() => handleManageAllCards()}>
                            <Feather name="credit-card" size={20} color={APP_CONSTANTS.COLORS.PRIMARY} />
                            <Text style={styles.modalButtonText}>Change Default Payment Method</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.modalButton, styles.modalButtonDanger, (allPaymentMethods.length <= 1) && styles.buttonDisabled]} 
                            onPress={() => {
                                if (allPaymentMethods.length > 1) {
                                    handleManageAllCards('delete');
                                } else {
                                    Alert.alert("Cannot Delete", "You must have at least one payment method.");
                                }
                            }}
                            disabled={allPaymentMethods.length <= 1}
                        >
                            <Feather name="trash-2" size={20} color={allPaymentMethods.length <= 1 ? '#9CA3AF' : '#DC2626'} />
                            <Text style={[styles.modalButtonText, { color: allPaymentMethods.length <= 1 ? '#9CA3AF' : '#DC2626' }]}>Delete a Card</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.modalButton, styles.modalButtonCancel]} 
                            onPress={() => setShowUpdateOptions(false)}
                        >
                            <Text style={styles.modalButtonCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Payment Methods List Modal */}
            <Modal
                visible={showPaymentMethodsModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowPaymentMethodsModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>
                            {paymentMethodsModalMode === 'delete' ? 'Delete Payment Method' : 'Change Default Payment Method'}
                        </Text>
                        <Text style={styles.modalSubtitle}>
                            {paymentMethodsModalMode === 'delete' 
                                ? 'Select a payment method to delete:' 
                                : 'Select a payment method to set as default:'
                            }
                        </Text>

                        <ScrollView style={{ maxHeight: 300 }}>
                            {allPaymentMethods.map((pm, index) => (
                                <TouchableOpacity 
                                    key={pm.id}
                                    style={[
                                        styles.modalButton, 
                                        index > 0 && { marginTop: 8 },
                                        (paymentMethodsModalMode === 'delete' && allPaymentMethods.length <= 1) && styles.buttonDisabled
                                    ]}
                                    onPress={() => {
                                        if (paymentMethodsModalMode === 'delete' && allPaymentMethods.length <= 1) {
                                            Alert.alert("Cannot Delete", "You must have at least one payment method. Please add another card before deleting this one.");
                                            return;
                                        }
                                        console.log('[OrgManagePlan] MODAL BUTTON CLICKED! Mode:', paymentMethodsModalMode, 'PM ID:', pm.id);
                                        setShowPaymentMethodsModal(false);
                                        if (paymentMethodsModalMode === 'delete') {
                                            console.log('[OrgManagePlan] DELETE MODE - Calling removeSpecificPaymentMethod');
                                            removeSpecificPaymentMethod(pm.id, pm.card);
                                        } else {
                                            console.log('[OrgManagePlan] DEFAULT MODE - Setting default PM');
                                            if (!pm.isDefault) {
                                                setPaymentMethodAsDefault(pm.id);
                                            } else {
                                                Alert.alert("Already Default", "This payment method is already your default.");
                                            }
                                        }
                                    }}
                                >
                                    <Feather name="credit-card" size={20} color={APP_CONSTANTS.COLORS.PRIMARY} />
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={styles.modalButtonText}>
                                            {pm.card.brand.toUpperCase()} •••• {pm.card.last4}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: '#6B7280' }}>
                                            Expires {String(pm.card.expMonth).padStart(2, '0')}/{pm.card.expYear.toString().slice(-2)}
                                            {pm.isDefault && ' • DEFAULT'}
                                        </Text>
                                    </View>
                                    {paymentMethodsModalMode === 'delete' && (
                                        <Feather name="trash-2" size={16} color={(allPaymentMethods.length <= 1) ? '#9CA3AF' : '#DC2626'} />
                                    )}
                                    {paymentMethodsModalMode === 'default' && pm.isDefault && (
                                        <Feather name="check" size={16} color="#059669" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <TouchableOpacity 
                            style={[styles.modalButton, styles.modalButtonCancel, { marginTop: 16 }]} 
                            onPress={() => setShowPaymentMethodsModal(false)}
                        >
                            <Text style={styles.modalButtonCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                visible={showDeleteConfirmation}
                transparent={true}
                animationType="fade"
                onRequestClose={cancelDeletePaymentMethod}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={{ alignItems: 'center', marginBottom: 16 }}>
                            <Feather name="alert-triangle" size={48} color="#DC2626" />
                        </View>
                        <Text style={styles.modalTitle}>Remove Payment Method</Text>
                        <Text style={styles.modalSubtitle}>
                            {pendingDeletePaymentMethod && 
                                `Remove ${pendingDeletePaymentMethod.card.brand.toUpperCase()} ending in ${pendingDeletePaymentMethod.card.last4}?`
                            }
                        </Text>
                        <Text style={[styles.modalSubtitle, { fontSize: 12, color: '#9CA3AF', marginTop: 8 }]}>
                            This action cannot be undone.
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                            <TouchableOpacity 
                                style={[styles.modalButton, styles.modalButtonCancel, { flex: 1, marginTop: 0, marginBottom: 0 }]} 
                                onPress={cancelDeletePaymentMethod}
                            >
                                <Text style={styles.modalButtonCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                style={[styles.modalButton, styles.modalButtonDanger, { flex: 1, marginTop: 0, marginBottom: 0 }]} 
                                onPress={confirmDeletePaymentMethod}
                            >
                                <Feather name="trash-2" size={16} color="#DC2626" />
                                <Text style={[styles.modalButtonText, { color: "#DC2626", marginLeft: 8 }]}>Remove</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    webFormContainer: { marginTop: 10, paddingHorizontal: Platform.OS === 'web' ? 0 : 10, paddingVertical: 15, backgroundColor: '#FDFDFE', borderRadius: 8, borderWidth: 1, borderColor: '#EAF0F6' },
    errorTextWeb: { color: APP_CONSTANTS.COLORS.ERROR || 'red', textAlign: 'center', marginTop: 10, fontSize: 14 },
    errorBox: { backgroundColor: '#FFF1F2', padding: 15, borderRadius: 8, borderWidth:1, borderColor: '#FECDD3', marginBottom: 20, alignItems: 'center'}, // Softer red
    errorTextUi: { color: '#DC2626', fontSize: 15, textAlign: 'center'}, // Tailwind red-600
    loadingTextUi: { marginTop: 10, fontSize: 15, color: '#6B7280'}, // Tailwind gray-500
    inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10, alignSelf: 'flex-start'}, // Tailwind gray-700
    loadingMessageContainer: { alignItems: 'center', paddingVertical: 20, },

    // Requirement notice styles
    requirementNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    requirementText: {
        fontSize: 14,
        color: '#92400E',
        marginLeft: 12,
        flex: 1,
        fontWeight: '500',
    },

    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1A202C',
        textAlign: 'center',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#718096',
        textAlign: 'center',
        marginBottom: 24,
    },
    modalButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        backgroundColor: '#F7FAFC',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    modalButtonDanger: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
    },
    modalButtonCancel: {
        backgroundColor: '#F9FAFB',
        borderColor: '#D1D5DB',
        marginTop: 8,
    },
    modalButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#374151',
        marginLeft: 12,
    },
    modalButtonCancelText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#6B7280',
        textAlign: 'center',
        flex: 1,
    },

    // Payment method item styles
    paymentMethodItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F7FAFC',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardExpiryContainer: {
        alignItems: 'flex-end',
    },
    defaultBadge: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#059669',
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 2,
    },
});

export default OrgManagePlanScreen;