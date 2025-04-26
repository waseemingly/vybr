import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../navigation/AppNavigator';
import { APP_CONSTANTS } from '../config/constants'; // Adjust path if needed
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

// Sample data structure for a muted user
interface MutedUser {
    id: string;
    name: string;
    // Add other relevant details like profile picture URL if available
}

// Basic placeholder screen
const UserMutedListScreen: React.FC = () => {
    // Navigation prop for MainStack screens
    type UserMutedListScreenNavigationProp = NativeStackNavigationProp<MainStackParamList, 'UserMutedListScreen'>;
    const navigation = useNavigation<UserMutedListScreenNavigationProp>();

    // Get current user and manage muted users state
    const { session } = useAuth();
    const currentUserId = session?.user?.id;
    const [mutedUsers, setMutedUsers] = useState<MutedUser[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Fetch muted users from Supabase on mount or when user changes
    useEffect(() => {
        const fetchMutedUsers = async () => {
            if (!currentUserId) {
                setMutedUsers([]);
                setLoading(false);
                return;
            }
            try {
                const { data: mutes, error: muteError } = await supabase
                    .from('muted_users')
                    .select('muted_id')
                    .eq('muter_id', currentUserId);
                if (muteError) throw muteError;
                const mutedIds = (mutes || []).map((m: any) => m.muted_id);
                if (mutedIds.length === 0) {
                    setMutedUsers([]);
                    setLoading(false);
                    return;
                }
                const { data: profiles, error: profileError } = await supabase
                    .from('music_lover_profiles')
                    .select('user_id, first_name, last_name, username')
                    .in('user_id', mutedIds);
                if (profileError) throw profileError;
                const usersMapped = mutedIds.map(id => {
                    const profile = (profiles || []).find((p: any) => p.user_id === id);
                    const name = profile
                        ? `${profile.first_name?.trim() || ''} ${profile.last_name?.trim() || ''}`.trim() || profile.username || 'User'
                        : 'User';
                    return { id, name };
                });
                setMutedUsers(usersMapped);
            } catch (err) {
                console.error('[UserMutedListScreen] Error fetching muted users:', err);
                Alert.alert('Error', 'Could not load muted users. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        fetchMutedUsers();
    }, [currentUserId]);

    // Unmute handler
    const handleUnmute = async (userIdToUnmute: string) => {
        if (!currentUserId) return;
        try {
            const { error } = await supabase
                .from('muted_users')
                .delete()
                .eq('muter_id', currentUserId)
                .eq('muted_id', userIdToUnmute);
            if (error) throw error;
            // Remove from local state
            setMutedUsers(prev => prev.filter(u => u.id !== userIdToUnmute));
        } catch (err) {
            console.error('[UserMutedListScreen] Error unmuting user:', err);
            Alert.alert('Error', 'Could not unmute the user. Please try again.');
        }
    };

    const renderItem = ({ item }: { item: MutedUser }) => (
        <View style={styles.itemContainer}>
            <TouchableOpacity onPress={() => {
                // Navigate to OtherUserProfileScreen on root navigator
                const rootNav = navigation.getParent();
                if (rootNav) {
                    (rootNav as any).navigate('OtherUserProfileScreen', { userId: item.id });
                }
            }}>
                <Text style={styles.itemName}>{item.name}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.unmuteButton} onPress={() => handleUnmute(item.id)}>
                <Text style={styles.unmuteButtonText}>Unmute</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header Removed */}

            {/* Content */}
            {loading ? (
                <View style={styles.emptyContainer}>
                    <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
                </View>
            ) : mutedUsers.length > 0 ? (
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