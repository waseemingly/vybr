import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Image, ActivityIndicator, RefreshControl, ScrollView
} from 'react-native';
import { StorageImage } from '@/components/StorageImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { useAuth, OrganizerProfile } from '@/hooks/useAuth';
import { APP_CONSTANTS } from '@/config/constants';
import type { RootStackParamList } from '@/navigation/AppNavigator';

type OrganizerListNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const DEFAULT_ORGANIZER_LOGO = APP_CONSTANTS.DEFAULT_ORGANIZER_LOGO;

interface FollowedOrganizer extends OrganizerProfile {
    // Inherits all fields from OrganizerProfile
}

const OrganizerListScreen: React.FC = () => {
    const navigation = useNavigation<OrganizerListNavigationProp>();
    const { session } = useAuth();
    const [followedOrganizers, setFollowedOrganizers] = useState<FollowedOrganizer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentUserId = session?.user?.id;

    const fetchFollowedOrganizers = useCallback(async (refreshing = false) => {
        if (!currentUserId) {
            setError("Not logged in"); setIsLoading(false); setIsRefreshing(false); return;
        }
        if (!refreshing) setIsLoading(true); else setIsRefreshing(true);
        setError(null);
        console.log("[OrganizerListScreen] Fetching followed organizers...");

        try {
            // 1. Get the IDs of organizers the user follows
            const { data: followRelations, error: followError } = await supabase
                .from('organizer_follows')
                .select('organizer_id')
                .eq('user_id', currentUserId);

            if (followError) throw followError;
            if (!followRelations || followRelations.length === 0) {
                setFollowedOrganizers([]);
                console.log("[OrganizerListScreen] No followed organizers found.");
                return;
            }

            const organizerUserIds = followRelations.map(rel => rel.organizer_id).filter(id => !!id);
            if (organizerUserIds.length === 0) {
                setFollowedOrganizers([]);
                console.log("[OrganizerListScreen] No valid organizer IDs extracted.");
                return;
            }
            console.log("[OrganizerListScreen] Found followed organizer IDs:", organizerUserIds);

            // 2. Fetch the profiles for those organizer IDs
            const { data: organizerProfiles, error: profileError } = await supabase
                .from('organizer_profiles') // Select from organizer_profiles table
                .select('*') // Select all columns defined in OrganizerProfile type
                .in('user_id', organizerUserIds);

            if (profileError) throw profileError;

            // Map the data, ensuring it matches the FollowedOrganizer interface
            const organizerData: FollowedOrganizer[] = organizerProfiles?.map(p => ({
                // Explicitly map fields to match OrganizerProfile type from useAuth
                id: p.id,
                userId: p.user_id,
                companyName: p.company_name,
                email: p.email,
                phoneNumber: p.phone_number,
                logo: p.logo,
                businessType: p.business_type,
                bio: p.bio,
                website: p.website,
                // Add any other fields required by OrganizerProfile if they exist in DB
            })) ?? [];

            console.log(`[OrganizerListScreen] Fetched ${organizerData.length} organizer profiles.`);
            setFollowedOrganizers(organizerData);

        } catch (err: any) {
            console.error("[OrganizerListScreen] Error fetching followed organizers:", err);
            setError("Could not load followed organizers.");
            setFollowedOrganizers([]);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [currentUserId]);

    useFocusEffect(useCallback(() => { fetchFollowedOrganizers(); }, [fetchFollowedOrganizers]));

    const onRefresh = () => { fetchFollowedOrganizers(true); };

    const renderOrganizerItem = ({ item }: { item: FollowedOrganizer }) => (
        <TouchableOpacity
            style={styles.itemContainer}
            onPress={() => navigation.push('ViewOrganizerProfileScreen', { organizerUserId: item.userId })}
        >
            {item.logo && item.logo !== DEFAULT_ORGANIZER_LOGO ? (
                <StorageImage sourceUri={item.logo} style={styles.avatar} resizeMode="cover" />
            ) : (
                <Image source={{ uri: DEFAULT_ORGANIZER_LOGO }} style={styles.avatar} />
            )}
            <View style={styles.itemTextContainer}>
                <Text style={styles.itemName} numberOfLines={1}>{item.companyName || 'Organizer'}</Text>
                {item.businessType && <Text style={styles.itemSubText}>{formatBusinessType(item.businessType)}</Text>}
            </View>
            <Feather name="chevron-right" size={20} color={APP_CONSTANTS.COLORS.DISABLED} />
        </TouchableOpacity>
    );

    const renderContent = () => {
        if (isLoading && !isRefreshing) { return <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} /></View>; }
        if (error) { return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>; }
        if (followedOrganizers.length === 0) {
            return (
                <ScrollView
                    contentContainerStyle={styles.emptyContainer}
                    refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[APP_CONSTANTS.COLORS.PRIMARY]} />}
                >
                    <Feather name="briefcase" size={60} color={APP_CONSTANTS.COLORS.DISABLED} />
                    <Text style={styles.emptyText}>Not following any organizers yet.</Text>
                    <Text style={styles.emptySubText}>Find organizers via events or search!</Text>
                </ScrollView>
            );
        }
        return (
            <FlatList
                data={followedOrganizers}
                renderItem={renderOrganizerItem}
                keyExtractor={(item) => item.userId}
                style={styles.list}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[APP_CONSTANTS.COLORS.PRIMARY]} tintColor={APP_CONSTANTS.COLORS.PRIMARY} />}
            />
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="chevron-left" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Followed Organizers</Text>
            </View>
            {renderContent()}
        </SafeAreaView>
    );
};

// Helper function (can be moved to a utils file)
const formatBusinessType = (type?: string | null): string | null => {
    if (!type) return null;
    return type.replace(/_/g, ' ').replace(/-/g, ' ')
               .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

// --- Styles (Adapted from FriendsListScreen) ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    errorText: { color: APP_CONSTANTS.COLORS.ERROR, fontSize: 16, textAlign: 'center' },
    list: { flex: 1, backgroundColor: 'white' },
    itemContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white', },
    avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: '#EBF5FF', // Lighter blue background for logo
              borderWidth: 1, borderColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT
            },
    itemTextContainer: { flex: 1, justifyContent: 'center', marginRight: 10, },
    itemName: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 2, },
    itemSubText: { fontSize: 13, color: '#6B7280', }, // Changed from itemUsername
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E7EB', marginLeft: 81, },
    emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
    emptyText: { fontSize: 18, fontWeight: '600', color: APP_CONSTANTS.COLORS.TEXT_SECONDARY, marginTop: 15, textAlign: 'center', },
    emptySubText: { fontSize: 14, color: APP_CONSTANTS.COLORS.DISABLED, marginTop: 8, textAlign: 'center', },
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

export default OrganizerListScreen; 