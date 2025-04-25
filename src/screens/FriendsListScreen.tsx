import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Image, ActivityIndicator, RefreshControl, ScrollView // Added ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { APP_CONSTANTS } from '@/config/constants';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type FriendsListNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const DEFAULT_PROFILE_PIC = APP_CONSTANTS.DEFAULT_PROFILE_PIC;

interface Friend {
    userId: string;
    profileId: string;
    firstName: string;
    lastName: string;
    profilePicture: string | null;
    username: string;
}

const FriendsListScreen: React.FC = () => {
    const navigation = useNavigation<FriendsListNavigationProp>();
    const { session } = useAuth();
    const [friends, setFriends] = useState<Friend[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentUserId = session?.user?.id;

    const fetchFriends = useCallback(async (refreshing = false) => {
        if (!currentUserId) {
            setError("Not logged in"); setIsLoading(false); setIsRefreshing(false); return;
        }
        if (!refreshing) setIsLoading(true); else setIsRefreshing(true);
        setError(null);
        console.log("[FriendsListScreen] Fetching friends...");

        try {
            const { data: friendRelations, error: relationError } = await supabase
                .from('friends').select('user_id_1, user_id_2')
                .or(`user_id_1.eq.${currentUserId},user_id_2.eq.${currentUserId}`).eq('status', 'accepted');

            if (relationError) throw relationError;
            if (!friendRelations || friendRelations.length === 0) { setFriends([]); console.log("[FriendsListScreen] No friend relations found."); return; }

            const friendUserIds = friendRelations.map(rel => rel.user_id_1 === currentUserId ? rel.user_id_2 : rel.user_id_1).filter(id => !!id);
            if (friendUserIds.length === 0) { setFriends([]); console.log("[FriendsListScreen] No valid friend IDs extracted."); return; }
            console.log("[FriendsListScreen] Found friend IDs:", friendUserIds);

            const { data: friendProfiles, error: profileError } = await supabase
                .from('music_lover_profiles').select('id, user_id, first_name, last_name, username, profile_picture')
                .in('user_id', friendUserIds);
            if (profileError) throw profileError;

            const friendData = friendProfiles?.map(p => ({ userId: p.user_id, profileId: p.id, firstName: p.first_name, lastName: p.last_name, username: p.username, profilePicture: p.profile_picture, })) ?? [];
            console.log(`[FriendsListScreen] Fetched ${friendData.length} friend profiles.`);
            setFriends(friendData);

        } catch (err: any) { console.error("[FriendsListScreen] Error fetching friends list:", err); setError("Could not load friends list."); setFriends([]); }
        finally { setIsLoading(false); setIsRefreshing(false); }
    }, [currentUserId]);

    useFocusEffect( useCallback(() => { fetchFriends(); }, [fetchFriends]) );

    const onRefresh = () => { fetchFriends(true); };

    const renderFriendItem = ({ item }: { item: Friend }) => (
        <TouchableOpacity style={styles.itemContainer} onPress={() => navigation.push('OtherUserProfileScreen', { userId: item.userId })} >
            <Image source={{ uri: item.profilePicture ?? DEFAULT_PROFILE_PIC }} style={styles.avatar} />
            <View style={styles.itemTextContainer}>
                <Text style={styles.itemName} numberOfLines={1}>{`${item.firstName} ${item.lastName}`.trim() || item.username}</Text>
                {item.username && <Text style={styles.itemUsername}>@{item.username}</Text>}
            </View>
            <Feather name="chevron-right" size={20} color={APP_CONSTANTS.COLORS.DISABLED} />
        </TouchableOpacity>
    );

    const renderContent = () => {
        if (isLoading && !isRefreshing) { return <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} /></View>; }
        if (error) { return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>; }
        if (friends.length === 0) {
            return (
                <ScrollView contentContainerStyle={styles.emptyContainer} refreshControl={ <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[APP_CONSTANTS.COLORS.PRIMARY]} /> } >
                    <Feather name="users" size={60} color={APP_CONSTANTS.COLORS.DISABLED} />
                    <Text style={styles.emptyText}>No friends yet.</Text>
                    <Text style={styles.emptySubText}>Find matches and start connecting!</Text>
                </ScrollView>
            );
        }
        return (
            <FlatList data={friends} renderItem={renderFriendItem} keyExtractor={(item) => item.userId} style={styles.list} ItemSeparatorComponent={() => <View style={styles.separator} />} refreshControl={ <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[APP_CONSTANTS.COLORS.PRIMARY]} tintColor={APP_CONSTANTS.COLORS.PRIMARY} /> } />
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
            {renderContent()}
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    errorText: { color: APP_CONSTANTS.COLORS.ERROR, fontSize: 16, textAlign: 'center' },
    list: { flex: 1, backgroundColor: 'white' },
    itemContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white', },
    avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: '#E5E7EB', },
    itemTextContainer: { flex: 1, justifyContent: 'center', marginRight: 10, },
    itemName: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 2, },
    itemUsername: { fontSize: 13, color: '#6B7280', },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E7EB', marginLeft: 81, },
    emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
    emptyText: { fontSize: 18, fontWeight: '600', color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, marginTop: 15, textAlign: 'center', },
     emptySubText: { fontSize: 14, color: APP_CONSTANTS.COLORS.DISABLED, marginTop: 8, textAlign: 'center', },
});

export default FriendsListScreen;