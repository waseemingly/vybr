import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList, // Use FlatList for potentially long lists
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { APP_CONSTANTS } from '../config/constants'; // Adjust path if needed

// Sample data structure for a muted user
interface MutedUser {
    id: string;
    name: string;
    // Add other relevant details like profile picture URL if available
}

// Basic placeholder screen
const UserMutedListScreen: React.FC = () => {
    const navigation = useNavigation();

    // Placeholder data - Replace with actual data fetching logic
    const mutedUsers: MutedUser[] = [
        // { id: '1', name: 'Muted User 1' },
        // { id: '2', name: 'Muted User 2' },
    ];

    const renderItem = ({ item }: { item: MutedUser }) => (
        <View style={styles.itemContainer}>
            <Text style={styles.itemName}>{item.name}</Text>
            <TouchableOpacity style={styles.unmuteButton} onPress={() => {/* TODO: Implement unmute logic */} }>
                <Text style={styles.unmuteButtonText}>Unmute</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Muted Users</Text>
                <View style={{ width: 32 }} />
            </View>

            {/* Content */}
            {mutedUsers.length > 0 ? (
                <FlatList
                    data={mutedUsers}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    style={styles.list}
                />
            ) : (
                <View style={styles.emptyContainer}>
                    <Feather name="volume-x" size={60} color={APP_CONSTANTS.COLORS.DISABLED} />
                    <Text style={styles.emptyText}>You haven't muted anyone.</Text>
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
    itemName: {
        fontSize: 16,
        color: '#1F2937',
    },
    unmuteButton: {
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    unmuteButtonText: {
        color: APP_CONSTANTS.COLORS.PRIMARY,
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

export default UserMutedListScreen; 