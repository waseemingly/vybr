import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ScrollView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from '../lib/supabase'; // Adjust path if needed
import { useAuth } from '../hooks/useAuth'; // Adjust path if needed

// --- Stripe Web Imports ---
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe as useWebStripe, useElements } from '@stripe/react-stripe-js';

// --- Stripe Configuration ---
// IMPORTANT: Replace with your actual publishable key from the Stripe Dashboard
const STRIPE_PUBLISHABLE_KEY_WEB = "pk_test_51RDGZpDHMm6OC3yQwI460w1bESyWDQoSdNLBU9TOhciyc7NlbJ5upgCTJsP6OAuYt8cUeywcbkwQGCBI7VDCMNuz00qld2OSdN"; 
const stripePromiseWeb = Platform.OS === 'web' ? loadStripe(STRIPE_PUBLISHABLE_KEY_WEB) : null;

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

// --- Web Payment Form Component ---
// This component renders the Stripe PaymentElement for web payments.

type WebPaymentFormProps = {
    onPaymentSuccess: () => void;
    onPaymentError: (message: string) => void;
    totalPriceDisplay: string;
};

const WebPaymentForm: React.FC<WebPaymentFormProps> = ({ onPaymentSuccess, onPaymentError, totalPriceDisplay }) => {
    const stripe = useWebStripe();
    const elements = useElements();
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
    const { initPaymentSheet, presentPaymentSheet } = useStripe(); // This is for mobile

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
        maxReservations
    } = route.params;

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
        try {
            // --- 1. Availability Check (do this before creating payment intent) ---
            const { data: currentBookingsData, error: countError } = await supabase
                .from('event_bookings')
                .select('quantity')
                .eq('event_id', eventId)
                .eq('status', 'CONFIRMED');

            if (countError) throw new Error("Could not check event availability.");

            const currentBookingsTotalQuantity = currentBookingsData?.reduce((sum, row) => sum + (row.quantity || 0), 0) ?? 0;
            const limit = maxTickets;
            const availableSpots = (limit === null || limit === 0) ? Infinity : limit - currentBookingsTotalQuantity;

            if (availableSpots < quantity) {
                if (limit !== null && limit > 0) {
                   throw new Error(`Sorry, only ${availableSpots} ${actionTextLower}(s) remaining.`);
                } else {
                   throw new Error(`Sorry, tickets for this event are currently unavailable.`);
                }
            }

            // --- 2. Create Payment Intent by calling our Edge Function ---
            const { data, error: functionError } = await supabase.functions.invoke('create-payment-intent-for-booking', {
                body: { eventId, quantity },
            });

            if (functionError) throw new Error(`Could not initiate payment: ${functionError.message}`);
            const { clientSecret } = data;
            if (!clientSecret) throw new Error("Failed to get payment client secret.");

            // --- 3. Branch for Web vs. Mobile ---
            if (Platform.OS === 'web') {
                setWebClientSecret(clientSecret);
                // The main component will now re-render to show the web payment form.
                // The parent handleConfirm function will set isConfirming to false.
            } else {
                // --- MOBILE FLOW ---
                const { error: initError } = await initPaymentSheet({
                    merchantDisplayName: 'Vybr', // Your company name
                    paymentIntentClientSecret: clientSecret,
                    // You can pre-fill customer data if you have it
                    // customerId: stripeCustomerId, 
                    // customerEphemeralKeySecret: ephemeralKey,
                    allowsDelayedPaymentMethods: true,
                });

                if (initError) throw new Error(`Could not initialize payment sheet: ${initError.message}`);

                // --- 4. Present the Payment Sheet to the user ---
                const { error: paymentError } = await presentPaymentSheet();
                
                if (paymentError) {
                    // If the user cancels, paymentError.code will be 'Canceled'
                    if (paymentError.code === 'Canceled') {
                        showAlert('Payment Canceled', 'You have not been charged.');
                    } else {
                        throw new Error(`Payment failed: ${paymentError.message}`);
                    }
                    return; // Stop execution if payment failed or was canceled
                }

                // --- 5. Payment Succeeded! ---
                // The webhook will handle creating the booking record in the database.
                showAlert(
                    'Payment Successful!',
                    `Your ${actionTextLower}(s) for "${eventTitle}" are confirmed! Check your profile for details.`,
                    [{ text: 'OK', onPress: () => navigation.navigate('Events') }]
                );
            }

        } catch (error: any) {
            console.error('[handlePaidBooking] Error:', error); // Detailed log
            showAlert(`${actionTextProper} Failed`, `Could not complete: ${error.message}`);
        }
    };

    // This contains the original logic for free bookings/reservations
    const handleFreeBooking = async () => {
         try {
            if (!session?.user) {
                showAlert("Authentication Error", "You must be logged in to complete this action.");
                setIsConfirming(false); // Release the button
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
            
            // --- Insert Booking Record ---
            const { data: newBooking, error: bookingError } = await supabase
                .from('event_bookings')
                .insert({
                    event_id: eventId,
                    user_id: session.user.id,
                    quantity: quantity,
                    price_paid_per_item: rawPricePerItem,
                    total_price_paid: rawTotalPrice,
                    booking_fee_paid: rawFeePaid,
                    status: 'CONFIRMED'
                })
                .select()
                .single();

            if (bookingError) {
                if (bookingError.code === '23505') { // unique_user_event_booking constraint
                   showAlert("Already Registered", `You already have a ${actionTextLower} for this event.`);
                   navigation.goBack();
                } else {
                     throw bookingError;
                }
            } else if (newBooking) {
                showAlert(`${actionTextProper} Confirmed!`, `Your ${actionTextLower}(s) for "${eventTitle}" are confirmed!`);
                navigation.navigate('Events');
            } else {
                 throw new Error("Booking completed but no confirmation data received.");
            }
        } catch (error: any) {
            console.error('[handleFreeBooking] Error:', error); // Detailed log
            showAlert(`${actionTextProper} Failed`, `Could not complete: ${error.message}`);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.eventTitle}>{eventTitle}</Text>

                {webClientSecret && stripePromiseWeb ? (
                    // --- RENDER WEB PAYMENT FORM ---
                    <Elements stripe={stripePromiseWeb} options={{ clientSecret: webClientSecret, appearance: { theme: 'stripe' } }}>
                        <WebPaymentForm
                            totalPriceDisplay={totalPriceDisplay}
                            onPaymentSuccess={() => {
                                showAlert(
                                    'Payment Successful!',
                                    `Your ${actionTextLower}(s) for "${eventTitle}" are confirmed! Check your profile for details.`,
                                    [{ text: 'OK', onPress: () => navigation.navigate('Events') }]
                                );
                            }}
                            onPaymentError={(message: string) => {
                                showAlert(`${actionTextProper} Failed`, `Could not complete: ${message}`);
                                // Reset to allow user to try again
                                setWebClientSecret(null);
                            }}
                        />
                    </Elements>
                ) : (
                    // --- RENDER ORDER SUMMARY ---
                    <>
                        <View style={styles.summaryBox}>
                            <Text style={styles.summaryTitle}>Order Summary</Text>

                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>{actionTextProper}(s)</Text>
                                <Text style={styles.summaryValue}>{quantity}</Text>
                            </View>

                            {bookingType === 'TICKETED' && (
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>Price per Ticket</Text>
                                    <Text style={styles.summaryValue}>{pricePerItemDisplay}</Text>
                                </View>
                            )}

                            <View style={styles.divider} />

                            <View style={[styles.summaryItem, styles.totalItem]}>
                                <Text style={styles.summaryLabelTotal}>Total</Text>
                                <Text style={styles.summaryValueTotal}>{totalPriceDisplay}</Text>
                            </View>
                            {rawFeePaid !== null && rawFeePaid > 0 && bookingType === 'TICKETED' &&(
                                <Text style={styles.feeText}>(Includes ${rawFeePaid.toFixed(2)} processing fee)</Text>
                            )}
                        </View>

                        <Text style={styles.confirmationText}>
                            Please review your {actionTextLower} details before confirming.
                            {isPaidBooking ? ' Your payment method will be charged.' : ''}
                        </Text>
                        
                        <TouchableOpacity
                            style={[styles.confirmButton, isConfirming && styles.disabledButton]}
                            onPress={handleConfirm}
                            disabled={isConfirming}
                        >
                            {isConfirming ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Feather name="check-circle" size={20} color="#fff" />
                            )}
                            <Text style={styles.confirmButtonText}>
                                {isConfirming ? 'Processing...' : isPaidBooking ? `Pay ${totalPriceDisplay}` : `Confirm ${actionTextProper}`}
                            </Text>
                        </TouchableOpacity>
                    </>
                )}

                <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                        if (webClientSecret) {
                            // If web payment form is showing, cancel returns to summary
                            setWebClientSecret(null);
                        } else {
                            navigation.goBack();
                        }
                    }}
                    disabled={isConfirming && !webClientSecret} // Disable only during initial confirmation
                >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
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
});

export default BookingConfirmationScreen;