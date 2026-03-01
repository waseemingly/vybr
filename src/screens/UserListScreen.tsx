import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Image, ActivityIndicator, RefreshControl, ScrollView
} from 'react-native';
import { StorageImage } from '@/components/StorageImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { useAuth, MusicLoverProfile } from '@/hooks/useAuth'; // Use MusicLoverProfile type
import { APP_CONSTANTS } from '@/config/constants';
import type { RootStackParamList, MainStackParamList } from '@/navigation/AppNavigator';

// Define Navigation and Route Types
type UserListRouteProp = RouteProp<MainStackParamList, 'UserListScreen'>; // Assuming UserListScreen is added to MainStackParamList
type UserListNavigationProp = NativeStackNavigationProp<RootStackParamList & MainStackParamList>;

const DEFAULT_PROFILE_PIC = APP_CONSTANTS.DEFAULT_PROFILE_PIC;

interface FollowerUser extends MusicLoverProfile {
    // Inherits all fields from MusicLoverProfile
}

const UserListScreen: React.FC = () => {
    const navigation = useNavigation<UserListNavigationProp>();
    const route = useRoute<UserListRouteProp>();
    // const { organizerUserId } = route.params; // Get organizer ID from route params if needed, or use session
    const { session } = useAuth();
    const [followers, setFollowers] = useState<FollowerUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const organizerUserId = session?.user?.id; // Assuming the logged-in user is the organizer

    const fetchFollowers = useCallback(async (refreshing = false) => {
        if (!organizerUserId) {
            setError("Not logged in as organizer"); setIsLoading(false); setIsRefreshing(false); return;
        }
        if (!refreshing) setIsLoading(true); else setIsRefreshing(true);
        setError(null);
        console.log(`[UserListScreen] Fetching followers for organizer: ${organizerUserId}...`);

        try {
            // 1. Get the IDs of users following this organizer
            const { data: followRelations, error: followError } = await supabase
                .from('organizer_follows')
                .select('user_id') // Select the user_id (the follower)
                .eq('organizer_id', organizerUserId);

            if (followError) throw followError;
            if (!followRelations || followRelations.length === 0) {
                setFollowers([]);
                console.log("[UserListScreen] No followers found.");
                return;
            }

            const followerUserIds = followRelations.map(rel => rel.user_id).filter(id => !!id);
            if (followerUserIds.length === 0) {
                setFollowers([]);
                console.log("[UserListScreen] No valid follower user IDs extracted.");
                return;
            }
            console.log("[UserListScreen] Found follower user IDs:", followerUserIds);

            // 2. Fetch the Music Lover profiles for those user IDs
            const { data: followerProfiles, error: profileError } = await supabase
                .from('music_lover_profiles') // Select from music_lover_profiles table
                .select('*') // Select all columns needed for MusicLoverProfile type
                .in('user_id', followerUserIds);

            if (profileError) throw profileError;

            // Map the data, ensuring it matches the FollowerUser interface
            const followerData: FollowerUser[] = followerProfiles?.map(p => ({
                // Explicitly map fields to match MusicLoverProfile type from useAuth
                id: p.id,
                userId: p.user_id,
                firstName: p.first_name,
                lastName: p.last_name,
                username: p.username,
                email: p.email, // May or may not be needed/wanted here
                profilePicture: p.profile_picture,
                age: p.age,
                bio: p.bio,
                city: p.city,
                country: p.country,
                isPremium: p.is_premium,
                musicData: p.music_data,
                selectedStreamingService: p.selected_streaming_service,
                termsAccepted: p.terms_accepted,
                // Add any other fields required by MusicLoverProfile
            })) ?? [];

            console.log(`[UserListScreen] Fetched ${followerData.length} follower profiles.`);
            setFollowers(followerData);

        } catch (err: any) {
            console.error("[UserListScreen] Error fetching followers:", err);
            setError("Could not load followers list.");
            setFollowers([]);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [organizerUserId]);

    useFocusEffect(useCallback(() => { fetchFollowers(); }, [fetchFollowers]));

    // Add this useEffect to ensure back button is visible
    useEffect(() => {
        navigation.setOptions({ headerBackVisible: true });
    }, [navigation]);

    const onRefresh = () => { fetchFollowers(true); };

    const renderFollowerItem = ({ item }: { item: FollowerUser }) => (
        <TouchableOpacity
            style={styles.itemContainer}
            // Organizers likely cannot view detailed profiles of users?
            // onPress={() => navigation.push('OtherUserProfileScreen', { userId: item.userId })}
            disabled={true} // Disable navigation for now
        >
            {item.profilePicture && item.profilePicture !== DEFAULT_PROFILE_PIC ? (
                <StorageImage sourceUri={item.profilePicture} style={styles.avatar} resizeMode="cover" />
            ) : (
                <Image source={{ uri: DEFAULT_PROFILE_PIC }} style={styles.avatar} />
            )}
            <View style={styles.itemTextContainer}>
                <Text style={styles.itemName} numberOfLines={1}>{`${item.firstName} ${item.lastName}`.trim() || item.username || 'User'}</Text>
                {item.username && <Text style={styles.itemUsername}>@{item.username}</Text>}
            </View>
            {/* Optional: Keep chevron or remove if not navigable */}
            {/* <Feather name="chevron-right" size={20} color={APP_CONSTANTS.COLORS.DISABLED} /> */}
        </TouchableOpacity>
    );

    const renderContent = () => {
        if (isLoading && !isRefreshing) { return <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} /></View>; }
        if (error) { return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>; }
        if (followers.length === 0) {
            return (
                <ScrollView
                    contentContainerStyle={styles.emptyContainer}
                    refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[APP_CONSTANTS.COLORS.PRIMARY]} />}
                >
                    <Feather name="users" size={60} color={APP_CONSTANTS.COLORS.DISABLED} />
                    <Text style={styles.emptyText}>No followers yet.</Text>
                    <Text style={styles.emptySubText}>Users can follow you from your profile or events.</Text>
                </ScrollView>
            );
        }
        return (
            <FlatList
                data={followers}
                renderItem={renderFollowerItem}
                keyExtractor={(item) => item.userId || `fallback-${Math.random()}`} // Provide a fallback key
                style={styles.list}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[APP_CONSTANTS.COLORS.PRIMARY]} tintColor={APP_CONSTANTS.COLORS.PRIMARY} />}
            />
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="chevron-left" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Followers</Text>
            </View>
            {renderContent()}
        </SafeAreaView>
    );
};

// --- Styles (Adapted from FriendsListScreen) ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 8,
        marginRight: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        flex: 1,
    },
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

export default UserListScreen; 