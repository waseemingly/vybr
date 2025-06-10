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
import { APP_CONSTANTS } from '../config/constants'; // Adjust path if needed

// Sample data structure for a blocked user
interface BlockedUser {
    id: string;
    name: string;
    // Add other relevant details
}

// Basic placeholder screen
const UserBlockedListScreen: React.FC = () => {
    const navigation = useNavigation();

    // Placeholder data - Replace with actual data fetching logic
    const blockedUsers: BlockedUser[] = [
        // { id: '1', name: 'Blocked User 1' },
    ];

    const renderItem = ({ item }: { item: BlockedUser }) => (
        <View style={styles.itemContainer}>
            <Text style={styles.itemName}>{item.name}</Text>
            <TouchableOpacity style={styles.unblockButton} onPress={() => {/* TODO: Implement unblock logic */} }>
                <Text style={styles.unblockButtonText}>Unblock</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="chevron-left" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Blocked Users</Text>
            </View>

            {/* Content */}
            {blockedUsers.length > 0 ? (
                <FlatList
                    data={blockedUsers}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    style={styles.list}
                />
            ) : (
                <View style={styles.emptyContainer}>
                    <Feather name="slash" size={60} color={APP_CONSTANTS.COLORS.DISABLED} />
                    <Text style={styles.emptyText}>You haven't blocked anyone.</Text>
                </View>
            )}
        </SafeAreaView>
    );
};

// Reusing similar styles from Muted List screen, adjust as needed
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 10,
        color: '#1F2937',
    },
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
    itemName: {
        fontSize: 16,
        color: '#1F2937',
    },
    unblockButton: { // Changed style name for clarity
        backgroundColor: `${APP_CONSTANTS.COLORS.ERROR}33`, // Use error color scheme with alpha
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    unblockButtonText: { // Changed style name for clarity
        color: APP_CONSTANTS.COLORS.ERROR,
        fontWeight: '500',
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

export default UserBlockedListScreen; 