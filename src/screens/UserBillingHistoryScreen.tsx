import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '../hooks/useAuth';
import { APP_CONSTANTS } from '../config/constants';
import { supabase } from '../lib/supabase'; // Assuming supabase client is here

// Define the structure of a billing item
interface BillingItem {
    id: string;
    date: string; // Or Date object
    description: string;
    amount: string; // Formatted amount with currency
    status: 'Paid' | 'Pending' | 'Failed' | 'Refunded';
    invoiceUrl?: string; // Optional link to an invoice PDF
}

const UserBillingHistoryScreen: React.FC = () => {
    const navigation = useNavigation();
    const { session, loading: authLoading } = useAuth();
    const [billingHistory, setBillingHistory] = useState<BillingItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const userId = session?.user?.id;

    useEffect(() => {
        const fetchBillingHistory = async () => {
            if (!userId) {
                setIsLoading(false);
                setError("User not found.")
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                // --- TODO: Replace with your actual billing history fetching logic ---
                // This likely involves querying a 'billing_history' table linked to the user,
                // or potentially calling your payment provider's API (e.g., Stripe).

                // Example simulated data:
                await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
                const mockHistory: BillingItem[] = [
                    { id: 'inv_1', date: '2024-07-15', description: 'Vybr Premium (Monthly)', amount: '$9.99', status: 'Paid' },
                    { id: 'inv_2', date: '2024-06-15', description: 'Vybr Premium (Monthly)', amount: '$9.99', status: 'Paid' },
                    { id: 'inv_3', date: '2024-05-15', description: 'Vybr Premium (Monthly)', amount: '$9.99', status: 'Paid' },
                    // { id: 'inv_4', date: '2024-04-15', description: 'Vybr Premium (Monthly)', amount: '$9.99', status: 'Failed' },
                ];
                setBillingHistory(mockHistory);
                // --- End of placeholder logic ---

            } catch (err: any) {
                console.error("Error fetching billing history:", err);
                setError("Could not load billing history. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchBillingHistory();
    }, [userId]);

    const renderBillingItem = ({ item }: { item: BillingItem }) => (
        <View style={styles.itemContainer}>
            <View style={styles.itemDetails}>
                <Text style={styles.itemDate}>{new Date(item.date).toLocaleDateString()}</Text>
                <Text style={styles.itemDescription}>{item.description}</Text>
                <Text style={[
                    styles.itemStatus,
                    item.status === 'Paid' ? styles.status_paid :
                    item.status === 'Pending' ? styles.status_pending :
                    item.status === 'Failed' ? styles.status_failed :
                    item.status === 'Refunded' ? styles.status_refunded :
                    null // Fallback style if needed
                ]}>
                    {item.status}
                </Text>
            </View>
            <View style={styles.itemAmountContainer}>
                <Text style={styles.itemAmount}>{item.amount}</Text>
                {item.invoiceUrl && (
                    <TouchableOpacity onPress={() => Alert.alert("Invoice", "TODO: Open Invoice URL")}>
                        <Feather name="download" size={18} color={APP_CONSTANTS.COLORS.PRIMARY} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    const ListEmptyComponent = () => (
        <View style={styles.emptyContainer}>
             <Feather name="file-text" size={40} color="#CBD5E1" />
             <Text style={styles.emptyText}>No billing history found.</Text>
             <Text style={styles.emptySubText}>Your past transactions will appear here.</Text>
         </View>
    );

     const ErrorComponent = () => (
        <View style={styles.emptyContainer}>
            <Feather name="alert-circle" size={40} color={APP_CONSTANTS.COLORS.ERROR} />
            <Text style={[styles.emptyText, styles.errorText]}>Error Loading History</Text>
            <Text style={styles.emptySubText}>{error}</Text>
        </View>
    );

    if (authLoading) {
         return (
             <SafeAreaView style={styles.centeredLoader} edges={['top', 'bottom']}>
                 <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
             </SafeAreaView>
         );
     }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="chevron-left" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Billing History</Text>
            </View>
            {isLoading ? (
                <View style={styles.centeredLoader} >
                     <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
                </View>
            ) : error ? (
                <ErrorComponent />
            ) : (
                <FlatList
                    data={billingHistory}
                    renderItem={renderBillingItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={ListEmptyComponent}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB', },
    centeredLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
    listContent: { paddingVertical: 10, paddingHorizontal: 16, },
    itemContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB', },
    itemDetails: { flex: 1, marginRight: 10, },
    itemDate: { fontSize: 13, color: '#6B7280', marginBottom: 2, },
    itemDescription: { fontSize: 15, fontWeight: '500', color: '#1F2937', marginBottom: 3, },
    itemStatus: { fontSize: 12, fontWeight: '500', textTransform: 'capitalize', },
    itemAmountContainer: { alignItems: 'flex-end', },
    itemAmount: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 5, },
    status_paid: { color: '#10B981' }, // Green
    status_pending: { color: '#F59E0B' }, // Amber
    status_failed: { color: APP_CONSTANTS.COLORS.ERROR }, // Red
    status_refunded: { color: '#6B7280' }, // Gray
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, marginTop: 50, },
    emptyText: { fontSize: 17, fontWeight: '600', color: '#6B7280', marginTop: 15, textAlign: 'center', },
    emptySubText: { fontSize: 14, color: '#9CA3AF', marginTop: 8, textAlign: 'center', },
    errorText: { color: APP_CONSTANTS.COLORS.ERROR, },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 10,
    },
});

export default UserBillingHistoryScreen; 