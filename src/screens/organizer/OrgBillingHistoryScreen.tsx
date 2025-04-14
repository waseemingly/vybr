import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { APP_CONSTANTS } from '../../config/constants'; // Adjust path if needed

// Sample data structure for a billing item
interface BillingItem {
    id: string;
    date: string; // Or Date object
    description: string;
    amount: string; // Formatted amount
    status: 'Paid' | 'Pending' | 'Failed';
    // Add invoice URL or details link if available
}

// Basic placeholder screen
const OrgBillingHistoryScreen: React.FC = () => {
    const navigation = useNavigation();

    // Placeholder data - Replace with actual data fetching logic
    const billingHistory: BillingItem[] = [
        // { id: '1', date: '2023-10-26', description: 'Monthly Subscription', amount: '$19.99', status: 'Paid' },
        // { id: '2', date: '2023-09-26', description: 'Monthly Subscription', amount: '$19.99', status: 'Paid' },
    ];

     const renderItem = ({ item }: { item: BillingItem }) => (
        <View style={styles.itemContainer}>
            <View style={styles.itemDetails}>
                <Text style={styles.itemDescription}>{item.description}</Text>
                <Text style={styles.itemDate}>{item.date}</Text>
            </View>
            <View style={styles.itemAmountStatus}>
                 <Text style={styles.itemAmount}>{item.amount}</Text>
                 <Text style={[styles.itemStatus, styles[`status${item.status}`]]}>{item.status}</Text>
            </View>
            {/* Optionally add a button/link to view invoice */}
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Billing History</Text>
                <View style={{ width: 32 }} />
            </View>

            {/* Content */}
            {billingHistory.length > 0 ? (
                <FlatList
                    data={billingHistory}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    style={styles.list}
                />
            ) : (
                <View style={styles.emptyContainer}>
                    <Feather name="file-text" size={60} color={APP_CONSTANTS.COLORS.DISABLED} />
                    <Text style={styles.emptyText}>No billing history found.</Text>
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: 'white',
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
    list: {
        flex: 1,
    },
    itemContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: 'white',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#F3F4F6',
    },
     itemDetails: {
        flex: 1,
        marginRight: 10,
    },
    itemDescription: {
        fontSize: 15,
        fontWeight: '500',
        color: '#1F2937',
        marginBottom: 3,
    },
    itemDate: {
        fontSize: 13,
        color: '#6B7280',
    },
    itemAmountStatus: {
        alignItems: 'flex-end',
    },
    itemAmount: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 4,
    },
    itemStatus: {
        fontSize: 12,
        fontWeight: '500',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
        overflow: 'hidden', // Ensures background color respects radius
    },
    statusPaid: {
        backgroundColor: `${APP_CONSTANTS.COLORS.SUCCESS}33`,
        color: APP_CONSTANTS.COLORS.SUCCESS,
    },
     statusPending: {
        backgroundColor: `${APP_CONSTANTS.COLORS.WARNING}33`,
        color: APP_CONSTANTS.COLORS.WARNING,
    },
     statusFailed: {
        backgroundColor: `${APP_CONSTANTS.COLORS.ERROR}33`,
        color: APP_CONSTANTS.COLORS.ERROR,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        fontSize: 16,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        marginTop: 15,
        textAlign: 'center',
    },
});

export default OrgBillingHistoryScreen; 