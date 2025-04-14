import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { APP_CONSTANTS } from '../config/constants'; // Adjust path if needed

// Basic placeholder screen
const UserManageSubscriptionScreen: React.FC = () => {
    const navigation = useNavigation();

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Manage Subscription</Text>
                <View style={{ width: 32 }} />
            </View>

            {/* Content */}
            <View style={styles.content}>
                <Feather name="credit-card" size={60} color={APP_CONSTANTS.COLORS.PRIMARY_LIGHT} />
                <Text style={styles.placeholderTitle}>Subscription Management</Text>
                <Text style={styles.placeholderText}>
                    This is where users will manage their premium subscription plan.
                    (Billing portal integration, plan details, cancellation, etc.)
                </Text>
                {/* Add specific components for subscription management here */}
            </View>
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
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    placeholderTitle: {
        fontSize: 22,
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
        marginTop: 20,
        marginBottom: 10,
        textAlign: 'center',
    },
    placeholderText: {
        fontSize: 16,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        textAlign: 'center',
        lineHeight: 24,
    },
});

export default UserManageSubscriptionScreen; 