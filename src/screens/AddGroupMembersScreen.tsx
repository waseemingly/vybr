// src/screens/AddGroupMembersScreen.tsx
// Contains the fix using the new RPC function and improved empty state logic.

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Image, ActivityIndicator, Alert, TextInput, Platform, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { RootStackParamList } from "@/navigation/AppNavigator";
import { APP_CONSTANTS } from '@/config/constants';

interface SelectableFriend {
    user_id: string;
    profile_id: string;
    first_name: string | null;
    last_name: string | null;
    profile_picture: string | null;
    username?: string | null;
}

const DEFAULT_PROFILE_PIC = APP_CONSTANTS.DEFAULT_PROFILE_PIC;

type AddMembersRouteProp = RouteProp<RootStackParamList & {
    AddGroupMembersScreen: {
        groupId: string;
        groupName?: string | null;
        onCloseChat?: () => void; // Add onCloseChat for web chat panel
        cameFromGroupInfo?: boolean; // Track if we came from GroupInfoScreen
    }
}, 'AddGroupMembersScreen'>;
type AddMembersNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AddGroupMembersScreen = () => {
    const navigation = useNavigation<AddMembersNavigationProp>();
    const route = useRoute<AddMembersRouteProp>();
    const { session } = useAuth();
    const currentUserId = session?.user?.id;
    const { groupId, groupName } = route.params;

    // State
    const [potentialMembers, setPotentialMembers] = useState<SelectableFriend[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [noEligibleFriends, setNoEligibleFriends] = useState(false); // State for empty message

    // Fetch potential members
    const fetchPotentialMembers = useCallback(async () => {
        if (!currentUserId || !groupId) {
            setError("Authentication or group information missing."); setIsLoading(false); return;
        }
        setIsLoading(true); setError(null); setNoEligibleFriends(false);
        console.log(`[AddMembers] Fetching potential members for group ${groupId}`);

        let existingMemberIds = new Set<string>();

        try {
            // Step 1: Get group info including participants using the correct RPC
            console.log(`[AddMembers] Calling RPC get_group_info for group ${groupId}`);
            const { data: groupInfoData, error: groupInfoError } = await supabase
                .rpc('get_group_info', { group_id_input: groupId });

            if (groupInfoError) {
                throw new Error(`Failed to get group info: ${groupInfoError.message}`);
            }
            if (!groupInfoData?.participants) {
                throw new Error("Incomplete group data received from get_group_info.");
            }

            // Extract existing member IDs from the participants array
            const participantsRaw: { user_id: string, is_admin: boolean, joined_at: string }[] = groupInfoData.participants;
            existingMemberIds = new Set(participantsRaw.map(p => p.user_id));
            console.log("[AddMembers] Existing member IDs from get_group_info:", Array.from(existingMemberIds));

            // Step 2: Get accepted friends
            const { data: friendRelations, error: friendsError } = await supabase.from('friends')
                .select('user_id_1, user_id_2').or(`user_id_1.eq.${currentUserId},user_id_2.eq.${currentUserId}`).eq('status', 'accepted');
            if (friendsError) throw friendsError;
            const friendUserIds = (friendRelations || []).map(rel => (rel.user_id_1 === currentUserId ? rel.user_id_2 : rel.user_id_1)).filter(id => !!id);
             console.log("[AddMembers] Accepted friends:", friendUserIds);

            // Step 3: Filter friends
            const eligibleFriendIds = friendUserIds.filter(id => !existingMemberIds.has(id) && id !== currentUserId);
            console.log("[AddMembers] Eligible friends to add:", eligibleFriendIds);
            if (eligibleFriendIds.length === 0) {
                setPotentialMembers([]); setNoEligibleFriends(true); setIsLoading(false); return;
            }

            // Step 4: Fetch profiles
            const { data: friendProfiles, error: profileError } = await supabase.from('music_lover_profiles') // Adjust if needed
                .select('id, user_id, first_name, last_name, username, profile_picture') // Adjust if needed
                .in('user_id', eligibleFriendIds);
            if (profileError) throw profileError;
            const selectableFriends: SelectableFriend[] = (friendProfiles || []).map(profile => ({
                user_id: profile.user_id, profile_id: profile.id, first_name: profile.first_name,
                last_name: profile.last_name, profile_picture: profile.profile_picture, username: profile.username,
            }));
            setPotentialMembers(selectableFriends);

        } catch (err: any) {
            console.error("[AddMembers] Error fetching potential members:", err);
            setError(`Failed to load users. ${err.message}`);
            setPotentialMembers([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentUserId, groupId]);

    // Fetch on focus
    useFocusEffect(useCallback(() => { fetchPotentialMembers(); }, [fetchPotentialMembers]));

    // Set up header configuration - hide navigation header and use custom header
    useEffect(() => {
        navigation.setOptions({
            headerShown: false,
        });
    }, [navigation]);

    // Toggle selection
    const toggleUserSelection = (userId: string) => { setSelectedUsers(prev => { const n = new Set(prev); if (n.has(userId)) n.delete(userId); else n.add(userId); return n; }); };

    // Filter based on search
    const filteredUsers = potentialMembers.filter(user => {
        const name = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase(); const username = user.username?.toLowerCase() || ''; const query = searchQuery.toLowerCase();
        return name.includes(query) || username.includes(query);
    });

    // Add members using RPC
    const handleAddMembers = async () => {
        if (selectedUsers.size === 0) { Alert.alert("No Selection", "Please select at least one friend to add."); return; }
        if (!currentUserId || !groupId) { Alert.alert("Error", "Missing user or group information."); return; }
        Keyboard.dismiss(); setIsAdding(true); setError(null);
        const membersToAdd = Array.from(selectedUsers);
        try {
            const { error: rpcError } = await supabase.rpc('add_members_to_group_chat', { group_id_input: groupId, new_member_ids: membersToAdd });
            if (rpcError) throw rpcError;
            Alert.alert("Success", `Added ${selectedUsers.size} member(s) to the group.`);
            setSelectedUsers(new Set()); fetchPotentialMembers(); // Refresh list
        } catch (err: any) { Alert.alert("Error Adding Members", `Could not add members: ${err.message}`); }
        finally { setIsAdding(false); }
    };

    // Render list item
    const renderUserItem = ({ item }: { item: SelectableFriend }) => {
        const isSelected = selectedUsers.has(item.user_id); const name = `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.username || 'Friend';
        return (
            <TouchableOpacity style={[styles.userItem, isSelected && styles.userItemSelected]} onPress={() => toggleUserSelection(item.user_id)} activeOpacity={0.7}>
                <Image source={{ uri: item.profile_picture ?? DEFAULT_PROFILE_PIC }} style={styles.avatar} />
                 <View style={styles.userNameContainer}>
                     <Text style={styles.userName} numberOfLines={1}>{name}</Text>{item.username && <Text style={styles.userUsername}>@{item.username}</Text>}
                 </View>
                <Feather name={isSelected ? "check-circle" : "circle"} size={22} color={isSelected ? APP_CONSTANTS.COLORS.PRIMARY : '#CBD5E1'}/>
            </TouchableOpacity>
        );
    };

    // Render Empty List Component
    const renderEmptyListComponent = () => {
        if (isLoading || error) return null; // Handled by main indicators
        let message = "No matching friends found.";
        if (potentialMembers.length === 0 && !searchQuery && noEligibleFriends) message = "All eligible friends are already in this group.";
        else if (potentialMembers.length === 0 && !searchQuery && !noEligibleFriends) message = "No friends available to add.";
        return (<View style={styles.centered}><Text style={styles.emptyText}>{message}</Text></View>);
    };

    // --- Render Component ---
    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
            {/* Custom Header */}
            <View style={styles.header}>
                <TouchableOpacity 
                    onPress={() => {
                        // Check if we're in web chat panel mode
                        if (Platform.OS === 'web' && route.params.onCloseChat) {
                            // If we came from GroupInfoScreen, go back to GroupInfo
                            if (route.params.cameFromGroupInfo) {
                                (navigation as any).navigate('GroupInfo', {
                                    groupId,
                                    groupName: groupName || 'Group',
                                    groupImage: null
                                });
                            } else {
                                // Otherwise go back to GroupChat
                                (navigation as any).navigate('GroupChat', {
                                    groupId,
                                    groupName: groupName || 'Group',
                                    groupImage: null
                                });
                            }
                        } else {
                            navigation.goBack();
                        }
                    }} 
                    style={styles.backButton}
                >
                    <Feather name="chevron-left" size={24} color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add Members</Text>
            </View>
            {/* Search Input */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputWrapper}>
                    <Feather name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
                    <TextInput style={styles.searchInput} placeholder="Search friends to add..." placeholderTextColor="#9CA3AF" value={searchQuery} onChangeText={setSearchQuery} returnKeyType="search" autoCapitalize="none" autoCorrect={false}/>
                    {searchQuery.length > 0 && (<TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}><Feather name="x-circle" size={18} color="#9CA3AF" /></TouchableOpacity>)}
                </View>
            </View>
            {/* Header */}
            <Text style={styles.listHeader}>Select Friends to Add ({selectedUsers.size} selected)</Text>
            {/* List Area */}
            {isLoading ? (<View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} /></View>)
             : error ? (<View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>)
             : (<FlatList data={filteredUsers} renderItem={renderUserItem} keyExtractor={(item) => item.user_id} contentContainerStyle={styles.listContent} ListEmptyComponent={renderEmptyListComponent} keyboardShouldPersistTaps="handled"/>)
            }
            {/* Footer Button */}
            <View style={styles.footer}>
                <TouchableOpacity style={[styles.addButton, (selectedUsers.size === 0 || isAdding || isLoading) && styles.addButtonDisabled]} onPress={handleAddMembers} disabled={selectedUsers.size === 0 || isAdding || isLoading}>
                    {isAdding ? (<ActivityIndicator color="#FFF" size="small" />) : (<Text style={styles.addButtonText}>Add {selectedUsers.size} Member(s)</Text>)}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

// Styles
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6',
        marginLeft: 10,
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    errorText: { color: APP_CONSTANTS.COLORS.ERROR || '#DC2626', textAlign: 'center', fontSize: 15 }, // Fallback color
    emptyText: { textAlign: 'center', color: '#6B7280', marginTop: 40, fontSize: 15 },
    searchContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    searchInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, height: 40 },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 15, color: '#1F2937' },
    clearButton: { padding: 4, marginLeft: 4 },
    listHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, fontSize: 13, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, backgroundColor: '#F9FAFB' },
    listContent: { paddingBottom: 8, flexGrow: 1 }, // Added flexGrow
    userItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'white', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EFF1F3' },
    userItemSelected: { backgroundColor: 'rgba(59, 130, 246, 0.08)' },
    avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: '#E5E7EB' },
     userNameContainer: { flex: 1, marginRight: 10, justifyContent: 'center' },
    userName: { fontSize: 16, color: '#1F2937', fontWeight: '500', marginBottom: 1 },
    userUsername: { fontSize: 13, color: '#6B7280', },
    footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: 'rgba(255,255,255,0.9)', paddingBottom: Platform.OS === 'ios' ? 25 : 16 },
    addButton: { backgroundColor: APP_CONSTANTS.COLORS.PRIMARY || '#3B82F6', paddingVertical: 14, borderRadius: 10, alignItems: 'center' }, // Fallback color
    addButtonDisabled: { backgroundColor: '#A5B4FC' },
    addButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});

export default AddGroupMembersScreen;