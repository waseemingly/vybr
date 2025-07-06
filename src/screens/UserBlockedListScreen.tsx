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
import { APP_CONSTANTS } from '../config/constants';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { MainStackParamList } from '../navigation/AppNavigator';

// Data structure for a blocked user
interface BlockedUser {
    id: string;
    name: string;
}

const UserBlockedListScreen: React.FC = () => {
    type UserBlockedListNavigationProp = NativeStackNavigationProp<MainStackParamList, 'UserBlockedListScreen'>;
    const navigation = useNavigation<UserBlockedListNavigationProp>();
    
    const { session } = useAuth();
    const currentUserId = session?.user?.id;
    const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchBlockedUsers = async () => {
            if (!currentUserId) {
                setBlockedUsers([]);
                setLoading(false);
                return;
            }
            try {
                // 1. Fetch the IDs of users blocked by the current user
                const { data: blocks, error: blockError } = await supabase
                    .from('blocks')
                    .select('blocked_id')
                    .eq('blocker_id', currentUserId);

                if (blockError) throw blockError;

                const blockedIds = (blocks || []).map((b: any) => b.blocked_id);

                if (blockedIds.length === 0) {
                    setBlockedUsers([]);
                    setLoading(false);
                    return;
                }

                // 2. Fetch the profiles for the blocked IDs
                const { data: profiles, error: profileError } = await supabase
                    .from('music_lover_profiles')
                    .select('user_id, first_name, last_name, username')
                    .in('user_id', blockedIds);

                if (profileError) throw profileError;

                // 3. Map the profiles to the BlockedUser format
                const usersMapped = blockedIds.map(id => {
                    const profile = (profiles || []).find((p: any) => p.user_id === id);
                    const name = profile
                        ? `${profile.first_name?.trim() || ''} ${profile.last_name?.trim() || ''}`.trim() || profile.username || 'User'
                        : 'Blocked User';
                    return { id, name };
                });

                setBlockedUsers(usersMapped);
            } catch (err) {
                console.error('[UserBlockedListScreen] Error fetching blocked users:', err);
                Alert.alert('Error', 'Could not load blocked users. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchBlockedUsers();

        // Realtime subscription for unblocks
        const blockChannel = supabase
            .channel(`public:blocks:blocker_id=eq.${currentUserId}`)
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'blocks',
                    filter: `blocker_id=eq.${currentUserId}`,
                },
                (payload) => {
                    console.log('[UserBlockedListScreen] Unblock detected in realtime:', payload);
                    const unblockedUserId = payload.old?.blocked_id;
                    if (unblockedUserId) {
                        setBlockedUsers((prev) => prev.filter((user) => user.id !== unblockedUserId));
                    } else {
                        // Fallback if old data is not available, refetch the whole list
                        fetchBlockedUsers();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(blockChannel);
        };

    }, [currentUserId]);

    const handleUnblock = async (userIdToUnblock: string) => {
        if (!currentUserId) return;
        try {
            const { error } = await supabase
                .from('blocks')
                .delete()
                .eq('blocker_id', currentUserId)
                .eq('blocked_id', userIdToUnblock);

            if (error) throw error;

            // Optimistically remove from local state.
            // The realtime listener will also handle this, but this provides a faster UI update.
            setBlockedUsers(prev => prev.filter(u => u.id !== userIdToUnblock));

        } catch (err) {
            console.error('[UserBlockedListScreen] Error unblocking user:', err);
            Alert.alert('Error', 'Could not unblock the user. Please try again.');
        }
    };

    const renderItem = ({ item }: { item: BlockedUser }) => (
        <View style={styles.itemContainer}>
            {/* The profile is blocked, so navigation to it is disabled. */}
            <Text style={styles.itemName}>{item.name}</Text>
            <TouchableOpacity style={styles.unblockButton} onPress={() => handleUnblock(item.id)}>
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
            {loading ? (
                <View style={styles.emptyContainer}>
                    <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
                </View>
            ) : blockedUsers.length > 0 ? (
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