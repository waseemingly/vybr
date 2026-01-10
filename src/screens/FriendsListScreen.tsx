import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Image, ActivityIndicator, RefreshControl, ScrollView, Alert, Dimensions
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
    status?: 'pending' | 'accepted';
}

type ActiveTab = 'friends' | 'requests';

const FriendsListScreen: React.FC = () => {
    const navigation = useNavigation<FriendsListNavigationProp>();
    const { session } = useAuth();
    const [friends, setFriends] = useState<Friend[]>([]);
    const [friendRequests, setFriendRequests] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<ActiveTab>('friends');
    const [acceptingRequests, setAcceptingRequests] = useState<Set<string>>(new Set());
    const [decliningRequests, setDecliningRequests] = useState<Set<string>>(new Set());

    const currentUserId = session?.user?.id;

    const fetchFriendsAndRequests = useCallback(async (isRefresh = false) => {
        if (!currentUserId) {
            setError("Not logged in"); setLoading(false); setRefreshing(false); return;
        }
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        console.log(`[FriendsListScreen] Fetching for tab: ${activeTab}...`);

        try {
            if (activeTab === 'friends') {
                const { data: friendRelations, error: relationError } = await supabase
                    .from('friends').select('user_id_1, user_id_2')
                    .or(`user_id_1.eq.${currentUserId},user_id_2.eq.${currentUserId}`)
                    .eq('status', 'accepted');

                if (relationError) throw relationError;
                if (!friendRelations || friendRelations.length === 0) { setFriends([]); console.log("[FriendsListScreen] No friend relations found."); return; }

                const friendUserIds = friendRelations.map(rel => rel.user_id_1 === currentUserId ? rel.user_id_2 : rel.user_id_1).filter(id => !!id);
                if (friendUserIds.length === 0) { setFriends([]); console.log("[FriendsListScreen] No valid friend IDs extracted for friends tab."); return; }
                console.log("[FriendsListScreen] Found friend IDs for friends tab:", friendUserIds);

                const { data: friendProfiles, error: profileError } = await supabase
                    .from('music_lover_profiles').select('id, user_id, first_name, last_name, username, profile_picture')
                    .in('user_id', friendUserIds);
                if (profileError) throw profileError;

                const friendData = friendProfiles?.map(p => ({
                    userId: p.user_id,
                    profileId: p.id,
                    firstName: p.first_name,
                    lastName: p.last_name,
                    username: p.username,
                    profilePicture: p.profile_picture,
                    status: 'accepted' as 'accepted'
                })) ?? [];
                console.log(`[FriendsListScreen] Fetched ${friendData.length} friend profiles.`);
                setFriends(friendData);
            } else {
                const { data: requestRelations, error: requestError } = await supabase
                    .from('friends')
                    .select('user_id_1, user_id_2, status, requester_id')
                    .eq('user_id_2', currentUserId)
                    .eq('status', 'pending');

                if (requestError) throw requestError;
                if (!requestRelations || requestRelations.length === 0) { setFriendRequests([]); console.log("[FriendsListScreen] No pending friend requests found."); return; }

                const requesterUserIds = requestRelations.map(req => req.user_id_1).filter(id => !!id);
                if (requesterUserIds.length === 0) { setFriendRequests([]); console.log("[FriendsListScreen] No valid requester IDs extracted."); return; }
                console.log("[FriendsListScreen] Found requester IDs:", requesterUserIds);

                const { data: requesterProfiles, error: profileError } = await supabase
                    .from('music_lover_profiles').select('id, user_id, first_name, last_name, username, profile_picture')
                    .in('user_id', requesterUserIds);
                if (profileError) throw profileError;

                const requestData = requesterProfiles?.map(p => ({
                    userId: p.user_id,
                    profileId: p.id,
                    firstName: p.first_name,
                    lastName: p.last_name,
                    username: p.username,
                    profilePicture: p.profile_picture,
                    status: 'pending' as 'pending'
                })) ?? [];
                console.log(`[FriendsListScreen] Fetched ${requestData.length} friend requests.`);
                setFriendRequests(requestData);
            }
        } catch (err: any) { console.error(`[FriendsListScreen] Error fetching for tab ${activeTab}:`, err); setError(`Could not load ${activeTab}.`); setFriends([]); setFriendRequests([]); }
        finally { setLoading(false); setRefreshing(false); }
    }, [currentUserId, activeTab]);

    useEffect(() => {
        fetchFriendsAndRequests();
    }, [activeTab, fetchFriendsAndRequests]);

    useFocusEffect( useCallback(() => { fetchFriendsAndRequests(); }, [fetchFriendsAndRequests]) );

    const onRefresh = () => { fetchFriendsAndRequests(true); };

    const handleAcceptRequest = async (requesterId: string) => {
        if (!currentUserId || acceptingRequests.has(requesterId)) return;

        setAcceptingRequests(prev => new Set(prev).add(requesterId));

        try {
            const { error } = await supabase.rpc('accept_friend_request', {
                p_requester_id: requesterId,
                p_current_user_id: currentUserId
            });

            if (error) throw error;

            // Update UI immediately
            const acceptedRequest = friendRequests.find(req => req.userId === requesterId);
            if (acceptedRequest) {
                setFriendRequests(prevRequests => prevRequests.filter(req => req.userId !== requesterId));
                setFriends(prevFriends => [...prevFriends, { ...acceptedRequest, status: 'accepted' }]);
            }
            console.log('[FriendsListScreen] Friend request accepted successfully');

            // Send notification to the requester that their request was accepted
            try {
                const UnifiedNotificationService = (await import('@/services/UnifiedNotificationService')).default;
                const { data: currentUserProfile } = await supabase
                    .from('music_lover_profiles')
                    .select('first_name, last_name, profile_picture')
                    .eq('id', currentUserId)
                    .single();
                
                const accepterName = currentUserProfile?.first_name 
                    ? `${currentUserProfile.first_name} ${currentUserProfile.last_name || ''}`.trim()
                    : 'Someone';
                
                await UnifiedNotificationService.notifyFriendAccept({
                    user_id: requesterId, // The person who sent the request
                    friend_id: currentUserId, // The person who accepted
                    friend_name: accepterName,
                    friend_image: currentUserProfile?.profile_picture || undefined,
                });
            } catch (notificationError) {
                console.error("Failed to send friend accept notification:", notificationError);
            }
        } catch (error: any) {
            console.error('Error accepting friend request:', error);
            Alert.alert('Error', 'Failed to accept friend request. Please try again.');
        } finally {
            setAcceptingRequests(prev => {
                const newSet = new Set(prev);
                newSet.delete(requesterId);
                return newSet;
            });
        }
    };

    const handleDeclineRequest = async (requesterId: string) => {
        if (!currentUserId || decliningRequests.has(requesterId)) return;

        setDecliningRequests(prev => new Set(prev).add(requesterId));

        try {
            const { error } = await supabase.rpc('decline_friend_request', {
                p_requester_id: requesterId,
                p_current_user_id: currentUserId
            });

            if (error) throw error;

            // Update UI immediately
            setFriendRequests(prevRequests => prevRequests.filter(req => req.userId !== requesterId));
            console.log('[FriendsListScreen] Friend request declined successfully');
        } catch (error: any) {
            console.error('Error declining friend request:', error);
            Alert.alert('Error', 'Failed to decline friend request. Please try again.');
        } finally {
            setDecliningRequests(prev => {
                const newSet = new Set(prev);
                newSet.delete(requesterId);
                return newSet;
            });
        }
    };

    const renderFriendItem = ({ item }: { item: Friend }) => (
        <TouchableOpacity 
            style={styles.itemContainer} 
            onPress={() => navigation.push('OtherUserProfileScreen', { 
                userId: item.userId,
            })} 
        >
            <Image source={{ uri: item.profilePicture ?? DEFAULT_PROFILE_PIC }} style={styles.avatar} />
            <View style={styles.itemTextContainer}>
                <Text style={styles.itemName} numberOfLines={1}>{`${item.firstName} ${item.lastName}`.trim() || item.username}</Text>
                {item.username && <Text style={styles.itemUsername}>@{item.username}</Text>}
            </View>
            {activeTab === 'friends' && (
                <Feather name="chevron-right" size={20} color={APP_CONSTANTS.COLORS.DISABLED} />
            )}
            {activeTab === 'requests' && item.status === 'pending' && (
                <View style={styles.requestActionsContainer}>
                    <TouchableOpacity style={styles.acceptButton} onPress={() => handleAcceptRequest(item.userId)}>
                        <Feather name="check" size={18} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.declineButton} onPress={() => handleDeclineRequest(item.userId)}>
                        <Feather name="x" size={18} color="white" />
                    </TouchableOpacity>
                </View>
            )}
        </TouchableOpacity>
    );

    const renderContent = () => {
        if (loading && !refreshing) { return <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} /></View>; }
        if (error) { return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>; }
        if (friends.length === 0 && friendRequests.length === 0) {
            const emptyMessage = activeTab === 'friends' 
                ? "No friends yet. Find matches and start connecting!" 
                : "No pending friend requests.";
            const emptySubMessage = activeTab === 'friends' ? "" : "";

            return (
                <ScrollView 
                    contentContainerStyle={styles.emptyContainer} 
                    refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[APP_CONSTANTS.COLORS.PRIMARY]} /> } 
                >
                    <Feather name={activeTab === 'friends' ? "users" : "user-plus"} size={60} color={APP_CONSTANTS.COLORS.DISABLED} />
                    <Text style={styles.emptyText}>{emptyMessage}</Text>
                    {emptySubMessage && <Text style={styles.emptySubText}>{emptySubMessage}</Text>}
                </ScrollView>
            );
        }
        return (
            <FlatList data={activeTab === 'friends' ? friends : friendRequests} renderItem={renderFriendItem} keyExtractor={(item) => item.userId} style={styles.list} ItemSeparatorComponent={() => <View style={styles.separator} />} refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[APP_CONSTANTS.COLORS.PRIMARY]} tintColor={APP_CONSTANTS.COLORS.PRIMARY} /> } />
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="chevron-left" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Friends List</Text>
            </View>
            <View style={styles.tabContainer}>
                <TouchableOpacity 
                    style={[styles.tabButton, activeTab === 'friends' && styles.activeTabButton]}
                    onPress={() => setActiveTab('friends')}
                >
                    <Text style={[styles.tabButtonText, activeTab === 'friends' && styles.activeTabButtonText]}>Friends</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tabButton, activeTab === 'requests' && styles.activeTabButton]}
                    onPress={() => setActiveTab('requests')}
                >
                    <Text style={[styles.tabButtonText, activeTab === 'requests' && styles.activeTabButtonText]}>Requests</Text>
                </TouchableOpacity>
            </View>
            {renderContent()}
        </SafeAreaView>
    );
};

const { width } = Dimensions.get('window');

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
    tabContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: 'white',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    tabButton: {
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
    },
    activeTabButton: {
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT,
    },
    tabButtonText: {
        fontSize: 15,
        fontWeight: '500',
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    },
    activeTabButtonText: {
        color: APP_CONSTANTS.COLORS.PRIMARY,
        fontWeight: '600',
    },
    requestActionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    acceptButton: {
        backgroundColor: APP_CONSTANTS.COLORS.SUCCESS,
        padding: 8,
        borderRadius: 15,
        marginRight: 10,
    },
    declineButton: {
        backgroundColor: APP_CONSTANTS.COLORS.ERROR,
        padding: 8,
        borderRadius: 15,
    },
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
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.PRIMARY,
        marginLeft: 10,
    },
});

export default FriendsListScreen;