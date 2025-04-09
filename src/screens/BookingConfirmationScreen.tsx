import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase'; // Adjust path if needed
import { useAuth } from '../hooks/useAuth'; // Adjust path if needed

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

const BookingConfirmationScreen: React.FC = () => {
    const route = useRoute<BookingConfirmationRouteProp>();
    const navigation = useNavigation<BookingConfirmationNavigationProp>();
    const { session } = useAuth();
    const [isConfirming, setIsConfirming] = useState(false);

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

    const handleConfirm = async () => {
        if (!session?.user) {
            Alert.alert("Login Required", "Authentication session expired. Please log in again.");
            // Optionally navigate to login
            // navigation.navigate('AuthFlow'); // If AuthFlow is defined in the stack
            return;
        }
        if (isConfirming) return;

        setIsConfirming(true);
        try {
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
            // Treat null or 0 as unlimited
            const availableSpots = (limit === null || limit === 0) ? Infinity : limit - currentBookingsTotalQuantity;

            console.log(`Current bookings: ${currentBookingsTotalQuantity}, Limit: ${limit ?? 'Unlimited'}, Available: ${availableSpots}`);

            if (availableSpots < quantity) {
                if (limit !== null && limit > 0) {
                   throw new Error(`Sorry, only ${availableSpots} ${actionTextLower}(s) remaining.`);
                } else if (limit === 0 && bookingType === 'TICKETED') { // 0 means explicitly unavailable for tickets
                   throw new Error(`Sorry, tickets for this event are currently unavailable.`);
                } else if (limit === 0 && bookingType === 'RESERVATION') { // 0 means explicitly unavailable for reservations
                    throw new Error(`Sorry, reservations for this event are currently unavailable.`);
                } else { // No limit set (null)
                    console.warn("Booking check passed for unlimited event.");
                }
            }
            // --- End Availability Check ---

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
                    status: 'CONFIRMED' // Default status
                })
                .select() // Select the inserted row
                .single();

            if (bookingError) {
                if (bookingError.code === '23505') { // unique_user_event_booking constraint violation
                   Alert.alert("Already Registered", `You already have a ${actionTextLower} for this event. Manage bookings in your profile.`);
                   navigation.goBack(); // Go back from confirmation
                } else {
                     throw bookingError; // Throw other DB errors
                }
            } else if (newBooking) {
                Alert.alert(`${actionTextProper} Confirmed!`, `Your ${actionTextLower}(s) for "${eventTitle}" are confirmed! Check your profile for details.`);
                // Navigate back to events list after successful booking
                navigation.navigate('Events'); // Make sure 'Events' is a valid screen name in your MainStackParamList
            } else {
                 throw new Error("Booking completed but no confirmation data received.");
            }
        } catch (error: any) {
            Alert.alert(`${actionTextProper} Failed`, `Could not complete: ${error.message}`);
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="x" size={24} color="#6B7280" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Confirm Your {actionTextProper}</Text>
                <View style={{width: 30}} /> {/* Spacer */}
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.eventTitle}>{eventTitle}</Text>

                <View style={styles.summaryBox}>
                    <Text style={styles.summaryTitle}>Order Summary</Text>

                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>{actionTextProper}(s)</Text>
                        <Text style={styles.summaryValue}>{quantity}</Text>
                    </View>

                    {bookingType === 'TICKETED' && (
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Price per Ticket</Text>
                            {/* Use the formatted display string passed in params */}
                            <Text style={styles.summaryValue}>{pricePerItemDisplay}</Text>
                        </View>
                    )}

                    <View style={styles.divider} />

                    <View style={[styles.summaryItem, styles.totalItem]}>
                        <Text style={styles.summaryLabelTotal}>Total</Text>
                         {/* Use the formatted display string passed in params */}
                        <Text style={styles.summaryValueTotal}>{totalPriceDisplay}</Text>
                    </View>
                     {rawFeePaid !== null && rawFeePaid > 0 && bookingType === 'TICKETED' &&(
                        <Text style={styles.feeText}>(Includes ${rawFeePaid.toFixed(2)} processing fee)</Text>
                     )}
                </View>

                <Text style={styles.confirmationText}>
                    Please review your {actionTextLower} details before confirming.
                    {bookingType === 'TICKETED' && rawTotalPrice && rawTotalPrice > 0 ? ' Your payment method will be charged.' : ''}
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
                        {isConfirming ? 'Processing...' : `Confirm ${actionTextProper}`}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => navigation.goBack()}
                    disabled={isConfirming}
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: 'white',
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
    },
    content: {
        flexGrow: 1,
        padding: 24,
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
});

export default BookingConfirmationScreen;