import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ScrollView,
    Platform,
    Button,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRoute, useNavigation, CommonActions } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase'; // Adjust path if needed
import { useAuth } from '../hooks/useAuth'; // Adjust path if needed
import { usePlatformStripe } from '../hooks/useStripe';
import { getEventCurrency } from '../utils/currencyUtils'; // Add currency utilities

// --- Stripe Web Imports ---
import { PaymentElement } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, useStripe, useElements } from '@stripe/react-stripe-js';

// Define Param List for the stack that includes this screen
// Assuming it's in the MainStack or a dedicated BookingStack
type MainStackParamList = {
    // ... other screens from AppNavigator
    Events: undefined; // Ensure Events screen is defined if navigating back to it
    BookingConfirmation: {
        eventId: string;
        eventTitle: string;
        quantity: number;
        pricePerItemDisplay: string; // Formatted price per item (e.g., "$10.50 each" or "Free")
        totalPriceDisplay: string; // Formatted total price (e.g., "$21.00")
        bookingType: 'TICKETED' | 'RESERVATION';
        // Raw values needed for insertion
        rawPricePerItem: number | null;
        rawTotalPrice: number | null;
        rawFeePaid: number | null;
        // Needed for availability check
        maxTickets: number | null;
        maxReservations: number | null;
        // Add currency information
        eventCurrency?: string;
        eventCountry?: string;
    };
    // ... other screens from AppNavigator
};

type BookingConfirmationRouteProp = RouteProp<MainStackParamList, 'BookingConfirmation'>;
type BookingConfirmationNavigationProp = NativeStackNavigationProp<MainStackParamList, 'BookingConfirmation'>;

// Helper function for platform-aware alerts
const showAlert = (title: string, message: string, buttons?: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' | 'default' }>) => {
    if (Platform.OS === 'web') {
        // Use browser's native alert
        window.alert(`${title}\n\n${message}`);
        // If there's an "OK" button with an action, try to find and execute it.
        const okButton = buttons?.find(b => b.text.toLowerCase() === 'ok');
        if (okButton?.onPress) {
            okButton.onPress();
        }
    } else {
        // Use React Native's Alert for mobile
        Alert.alert(title, message, buttons);
    }
};

// --- Stripe Configuration ---
const STRIPE_PUBLISHABLE_KEY = "pk_test_51RDGZpDHMm6OC3yQwI460w1bESyWDQoSdNLBU9TOhciyc7NlbJ5upgCTJsP6OAuYt8cUeywcbkwQGCBI7VDCMNuz00qld2OSdN"; 
const stripePromiseWeb = Platform.OS === 'web' ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

// --- Web Payment Form Component ---
// This component renders the Stripe PaymentElement for web payments.

type WebPaymentFormProps = {
    onPaymentSuccess: () => void;
    onPaymentError: (message: string) => void;
    totalPriceDisplay: string;
    eventCurrency: string; // Add currency prop
};

const WebPaymentForm: React.FC<WebPaymentFormProps> = ({ onPaymentSuccess, onPaymentError, totalPriceDisplay, eventCurrency }) => {
    const stripe = useStripe(); // Use direct Stripe hook instead of usePlatformStripe
    const elements = useElements(); // Use direct Elements hook instead of usePlatformStripe
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!stripe || !elements) {
            // Stripe.js has not yet loaded.
            return;
        }

        setIsProcessing(true);
        setErrorMessage(null);

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                // This is where the user will be redirected after 3D Secure authentication.
                // A dedicated success page is recommended for production.
                return_url: window.location.href.split('?')[0] + '?payment_success=true',
            },
            redirect: 'if_required', // Only redirect if required for authentication (e.g., 3D Secure).
        });

        if (error) {
            // This point will only be reached if there is an immediate error when
            // confirming the payment. Otherwise, your customer will be redirected to
            // your `return_url`.
            if (error.type === "card_error" || error.type === "validation_error") {
                setErrorMessage(error.message || 'An unexpected error occurred.');
            } else {
                onPaymentError(error.message || 'An unexpected error occurred.');
            }
        } else if (paymentIntent && paymentIntent.status === 'succeeded') {
            // Payment succeeded without a redirect.
            onPaymentSuccess();
        }
        
        setIsProcessing(false);
    };

    return (
        <View>
            <PaymentElement />
            {errorMessage && <Text style={styles.errorTextWeb}>{errorMessage}</Text>}
            <TouchableOpacity
                style={[styles.confirmButton, (!stripe || isProcessing) && styles.disabledButton, { marginTop: 20 }]}
                onPress={handleSubmit}
                disabled={!stripe || isProcessing}
            >
                {isProcessing ? (
                    <ActivityIndicator color="#fff" size="small" />
                ) : (
                    <Feather name="lock" size={20} color="#fff" />
                )}
                <Text style={styles.confirmButtonText}>
                    {isProcessing ? 'Processing...' : `Pay ${totalPriceDisplay}`}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const BookingConfirmationScreen: React.FC = () => {
    const route = useRoute<BookingConfirmationRouteProp>();
    const navigation = useNavigation<BookingConfirmationNavigationProp>();
    const { session } = useAuth();
    const [isConfirming, setIsConfirming] = useState(false);
    const [webClientSecret, setWebClientSecret] = useState<string | null>(null); // New state for web
    const [eventCurrency, setEventCurrency] = useState<string>('USD');
    const { initPaymentSheet, presentPaymentSheet } = usePlatformStripe(); // This is for mobile

    const {
        eventId,
        eventTitle,
        quantity,
        pricePerItemDisplay,
        totalPriceDisplay,
        bookingType,
        rawPricePerItem,
        rawTotalPrice,
        rawFeePaid,
        maxTickets,
        maxReservations,
        eventCurrency: passedEventCurrency,
        eventCountry
    } = route.params;

    // Initialize currency on mount
    useEffect(() => {
        const initializeCurrency = async () => {
            try {
                let currency = passedEventCurrency;
                if (!currency) {
                    currency = await getEventCurrency(eventId);
                }
                setEventCurrency(currency);
            } catch (error) {
                console.error('Error initializing currency:', error);
                setEventCurrency('USD'); // Fallback
            }
        };
        initializeCurrency();
    }, [eventId, passedEventCurrency]);

    const navigateToMyBookings = () => {
        navigation.dispatch(
            CommonActions.reset({
                index: 1,
                routes: [
                    { name: 'UserTabs', params: { screen: 'Profile' } },
                    { name: 'MyBookingsScreen' },
                ],
            })
        );
    };

    // --- NEW: Centralized function to create the booking record ---
    const createBookingRecord = async () => {
        if (!session?.user) throw new Error("User session not found for booking creation.");

        console.log(`[createBookingRecord] Creating booking for event ${eventId}, user ${session.user.id}`);

        // Generate a unique 6-digit booking code
        const bookingCode = Math.floor(100000 + Math.random() * 900000).toString();

        const { data: newBooking, error: bookingError } = await supabase
            .from('event_bookings')
            .insert({
                event_id: eventId,
                user_id: session.user.id,
                quantity: quantity,
                price_paid_per_item: rawPricePerItem || 0,
                total_price_paid: rawTotalPrice || 0,
                booking_fee_paid: rawFeePaid || 0,
                status: 'CONFIRMED',
                booking_code: bookingCode,
                checked_in: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select('id, booking_code')
            .single();

        if (bookingError) {
            console.error('[createBookingRecord] Error inserting booking:', bookingError);
            if (bookingError.code === '23505') {
                 throw new Error(`You already have a booking for this event.`);
            }
            // Since we removed the unique constraint, any other error here is a real problem.
            throw new Error(`Your payment was successful, but we failed to save your booking record. Please contact support with this Event ID: ${eventId}.`);
        }

        return newBooking; // Return the booking data
    };

    // --- NEW: Handle redirect from Stripe 3D Secure on web ---
    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const url = new URL(window.location.href);
        const paymentSuccess = url.searchParams.get('payment_success');
        const paymentIntentClientSecret = url.searchParams.get('payment_intent_client_secret');

        // Check for redirect parameters from Stripe
        if (paymentSuccess === 'true' && paymentIntentClientSecret) {
            console.log('[Stripe Redirect] Payment success detected via URL. Finalizing booking...');
            
            // Show loading state and hide payment form
            setIsConfirming(true);
            setWebClientSecret(null);
            
            const finalizeBooking = async () => {
                try {
                    await createBookingRecord();
                    showAlert(
                        'Payment Successful!',
                        `Your ${actionTextLower}(s) for "${eventTitle}" are confirmed! Check your profile for details.`,
                        [{ text: 'OK', onPress: navigateToMyBookings }]
                    );
                } catch (e: any) {
                    console.error('[Stripe Redirect] Error finalizing booking:', e);
                    showAlert('Booking Creation Failed', e.message);
                } finally {
                    setIsConfirming(false);
                }
            };

            finalizeBooking();

            // Clean the URL to prevent re-triggering on refresh
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);
        }
    }, [navigation, eventId, quantity]); // Rerun if these key identifiers change

    const actionTextLower = bookingType === 'TICKETED' ? 'ticket' : 'reservation';
    const actionTextProper = bookingType === 'TICKETED' ? 'Ticket' : 'Reservation';
    
    // Determine if this is a paid booking
    const isPaidBooking = bookingType === 'TICKETED' && rawTotalPrice !== null && rawTotalPrice > 0;

    const handleConfirm = async () => {
        if (!session?.user) {
            showAlert("Login Required", "Authentication session expired. Please log in again.");
            return;
        }
        if (isConfirming) return;

        setIsConfirming(true);

        // --- BRANCH LOGIC: PAID TICKET vs. FREE RESERVATION ---
        if (isPaidBooking) {
            await handlePaidBooking();
        } else {
            await handleFreeBooking();
        }

        // For mobile, or if web payment form is not shown, this resets the main button.
        // If web form is shown, this has no effect as isConfirming is already false.
        setIsConfirming(false);
    };
    
    // New function to handle the Stripe Payment Flow
    const handlePaidBooking = async () => {
        if (Platform.OS === 'web') {
            // On web, we trigger the API to get a client secret, then show the form.
            // The actual payment confirmation is handled inside WebPaymentForm.
            if (!webClientSecret) {
                fetchPaymentIntentClientSecret();
            }
            return; // Stop execution here for web, as payment is handled in the form
        }

        // --- Mobile Payment Flow ---
        setIsConfirming(true);
        try {
            // 1. Create payment intent on your server
            const clientSecret = await fetchPaymentIntentClientSecret();
            if (!clientSecret) return; // Error is handled inside the fetch function

            // 2. Initialize the Payment Sheet
            const initResult = await initPaymentSheet({
                merchantDisplayName: "Vibr",
                paymentIntentClientSecret: clientSecret,
                allowsDelayedPaymentMethods: false,
                returnURL: 'vybr://stripe-redirect', // your deep link
            });

            if (initResult && initResult.error) {
                console.error('Error initializing payment sheet:', initResult.error);
                showAlert('Error', `Could not initialize payment sheet: ${initResult.error.message}`);
                setIsConfirming(false);
                return;
            }

            // 3. Present the Payment Sheet
            const paymentResult = await presentPaymentSheet();
            const { error } = paymentResult;


            if (error) {
                if ('code' in error && error.code === 'Canceled') {
                    showAlert('Canceled', 'The payment was canceled.');
                } else {
                    showAlert('Payment Error', error.message || 'Payment failed');
                }
            } else {
                // 4. Create booking record on success
                await createBookingRecord();
                showAlert(
                    'Payment Successful!',
                    `Your ${actionTextLower}(s) for "${eventTitle}" are confirmed! Check your profile for details.`,
                    [{ text: 'OK', onPress: navigateToMyBookings }]
                );
            }
        } catch (e: any) {
            console.error("An unexpected error occurred during the booking process:", e);
            showAlert('Error', e.message || 'An unexpected error occurred.');
        } finally {
            setIsConfirming(false);
        }
    };

    // This contains the original logic for free bookings/reservations
    const handleFreeBooking = async () => {
         try {
            if (!session?.user) {
                showAlert("Authentication Error", "You must be logged in to complete this action.");
                return;
            }
            console.log(`Confirming ${actionTextLower} (qty: ${quantity}) for event ${eventId}, user ${session.user.id}`);

            // --- Availability Check ---
            const { data: currentBookingsData, error: countError } = await supabase
                .from('event_bookings')
                .select('quantity')
                .eq('event_id', eventId)
                .eq('status', 'CONFIRMED');

            if (countError) {
                console.error("Availability check error:", countError);
                throw new Error("Could not check event availability. Please try again.");
            }

            const currentBookingsTotalQuantity = currentBookingsData?.reduce((sum, row) => sum + (row.quantity || 0), 0) ?? 0;
            const limit = bookingType === 'TICKETED' ? maxTickets : maxReservations;
            const availableSpots = (limit === null || limit === 0) ? Infinity : limit - currentBookingsTotalQuantity;

            console.log(`Current bookings: ${currentBookingsTotalQuantity}, Limit: ${limit ?? 'Unlimited'}, Available: ${availableSpots}`);

            if (availableSpots < quantity) {
                if (limit !== null && limit > 0) {
                   throw new Error(`Sorry, only ${availableSpots} ${actionTextLower}(s) remaining.`);
                } else if (limit === 0) {
                    throw new Error(`Sorry, ${actionTextLower}s for this event are currently unavailable.`);
                }
            }
            
            // --- MODIFIED: Use the centralized booking creation function AND get result ---
            const newBooking = await createBookingRecord();

            if (newBooking) {
                console.log('[handleFreeBooking] Booking created successfully, reporting usage...');
                // --- NEW: Report usage directly after confirmation ---
                supabase.functions.invoke('report-booking-usage', {
                    body: { eventId: eventId, quantity: quantity },
                }).then(({ error }) => {
                    if (error) {
                        console.error('[Usage Report] Failed to report real-time usage:', error);
                        // Optional: Inform user or log to a monitoring service
                    } else {
                        console.log('[Usage Report] Real-time usage reported successfully.');
                    }
                });

                // The success alert will now be triggered after the record is created.
                showAlert(
                    `${actionTextProper} Confirmed!`,
                    `Your ${actionTextLower}(s) for "${eventTitle}" are confirmed! Check your profile for details.`,
                    [{ text: 'OK', onPress: navigateToMyBookings }]
                );
            } else {
                // This case should ideally not be reached if createBookingRecord throws on error
                throw new Error("Booking failed: No confirmation data was returned.");
            }

        } catch (error: any) {
            console.error('[handleFreeBooking] Error:', error); // Detailed log
            showAlert(`${actionTextProper} Failed`, `Could not complete: ${error.message}`);
        } finally {
            setIsConfirming(false); // Release the button in all cases
        }
    };

    // --- Payment success handler ---
    const handlePaymentSuccess = async () => {
        try {
            await createBookingRecord();
            const actionTextLower = bookingType === 'TICKETED' ? 'ticket' : 'reservation';
            showAlert(
                'Payment Successful!',
                `Your ${actionTextLower}(s) for "${eventTitle}" are confirmed! Check your profile for details.`,
                [{ text: 'OK', onPress: navigateToMyBookings }]
            );
        } catch (e: any) {
            console.error('Error finalizing booking:', e);
            showAlert('Booking Creation Failed', e.message);
        }
    };

    // --- Payment error handler ---
    const handlePaymentError = (message: string) => {
        showAlert('Payment Failed', message);
    };

    // --- Render booking summary ---
    const renderSummary = () => {
        const actionTextProper = bookingType === 'TICKETED' ? 'Ticket' : 'Reservation';
        
        return (
            <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Booking Summary</Text>
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Event</Text>
                    <Text style={styles.summaryValue}>{eventTitle}</Text>
                </View>
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Quantity</Text>
                    <Text style={styles.summaryValue}>{quantity} {actionTextProper}(s)</Text>
                </View>
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Price per {actionTextProper}</Text>
                    <Text style={styles.summaryValue}>{pricePerItemDisplay}</Text>
                </View>
                {eventCountry && (
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Location</Text>
                        <Text style={styles.summaryValue}>{eventCountry}</Text>
                    </View>
                )}
                {rawFeePaid && rawFeePaid > 0 && (
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Booking Fee</Text>
                        <Text style={styles.summaryValue}>${rawFeePaid.toFixed(2)}</Text>
                    </View>
                )}
                <View style={styles.divider} />
                <View style={[styles.summaryItem, styles.totalItem]}>
                    <Text style={styles.summaryLabelTotal}>Total</Text>
                    <Text style={styles.summaryValueTotal}>{totalPriceDisplay}</Text>
                </View>
            </View>
        );
    };

    // --- Function to fetch payment intent client secret ---
    const fetchPaymentIntentClientSecret = async (): Promise<string | null> => {
        try {
            const { data, error } = await supabase.functions.invoke('create-payment-intent-for-booking', {
                body: {
                    eventId,
                    quantity,
                    currency: eventCurrency, // Pass the event currency
                    totalAmount: rawTotalPrice, // Pass the raw amount in event currency
                    userId: session?.user?.id,
                },
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            if (!data?.clientSecret) throw new Error('No client secret received');

            if (Platform.OS === 'web') {
                setWebClientSecret(data.clientSecret);
            }

            return data.clientSecret;
        } catch (e: any) {
            console.error('Error fetching payment intent:', e);
            showAlert('Payment Error', `Failed to initialize payment: ${e.message}`);
            return null;
        }
    };

    const renderContent = () => {
        if (isConfirming && Platform.OS !== 'web') {
            return (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#0277BD" />
                    <Text style={styles.loadingText}>Confirming your booking...</Text>
                </View>
            );
        }

        if (Platform.OS === 'web' && webClientSecret && stripePromiseWeb) {
            return (
                <View>
                    {renderSummary()}
                    <View style={styles.divider} />
                    <Text style={styles.paymentHeader}>Enter Payment Details</Text>
                     <Elements stripe={stripePromiseWeb} options={{ clientSecret: webClientSecret }}>
                        <WebPaymentForm
                            onPaymentSuccess={handlePaymentSuccess}
                            onPaymentError={handlePaymentError}
                            totalPriceDisplay={totalPriceDisplay}
                            eventCurrency={eventCurrency}
                        />
                    </Elements>
                </View>
            );
        }

        if (Platform.OS === 'web' && isConfirming) {
             return (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#0277BD" />
                    <Text style={styles.loadingText}>Finalizing booking...</Text>
                </View>
            );
        }


        // Default view for mobile and initial web view
        return (
            <>
                {renderSummary()}
                <TouchableOpacity
                    style={[styles.confirmButton, isConfirming && styles.disabledButton]}
                    onPress={handleConfirm}
                    disabled={isConfirming}
                >
                    {isConfirming ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Feather name="check-circle" size={24} color="#fff" />
                    )}
                    <Text style={styles.confirmButtonText}>
                        {isConfirming ? 'Processing...' : `Confirm ${bookingType === 'TICKETED' ? 'and Pay' : 'Reservation'}`}
                    </Text>
                </TouchableOpacity>
            </>
        );
    };


    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Feather name="arrow-left" size={28} color="#333" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Confirm Your Booking</Text>
                </View>

                {renderContent()}

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB', // Light background
    },
    content: {
        flexGrow: 1,
        padding: 24,
        paddingTop: 40, // Add some top padding since the header is gone
    },
    eventTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 24,
        textAlign: 'center',
    },
    summaryBox: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingBottom: 10,
    },
    summaryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    summaryLabel: {
        fontSize: 16,
        color: '#6B7280',
    },
    summaryValue: {
        fontSize: 16,
        color: '#1F2937',
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 12,
    },
    totalItem: {
        marginTop: 10,
    },
    summaryLabelTotal: {
        fontSize: 18,
        color: '#1F2937',
        fontWeight: 'bold',
    },
    summaryValueTotal: {
        fontSize: 18,
        color: '#3B82F6', // Highlight total price
        fontWeight: 'bold',
    },
    feeText: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'right',
        marginTop: -8,
        marginBottom: 8,
    },
    confirmationText: {
        fontSize: 14,
        color: '#4B5563',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 20,
    },
    confirmButton: {
        backgroundColor: '#3B82F6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        marginBottom: 16,
    },
    confirmButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    disabledButton: {
        backgroundColor: '#9CA3AF',
    },
    cancelButton: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#6B7280',
        fontSize: 15,
        fontWeight: '500',
    },
    errorTextWeb: {
        color: 'red',
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 10,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
    },
    paymentHeader: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 16,
        marginTop: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 8,
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        flex: 1,
    },
});

export default BookingConfirmationScreen;