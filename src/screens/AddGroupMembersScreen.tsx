// src/screens/AddGroupMembersScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput, Platform, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

// --- Adjust Imports ---
import { supabase } from '@/lib/supabase';         // Adjust path
import { useAuth } from '@/hooks/useAuth';         // Adjust path
import type { RootStackParamList } from "@/navigation/AppNavigator"; // Adjust path
import { APP_CONSTANTS } from '@/config/constants'; // Adjust path
// --- End Adjustments ---

// Type for users selectable in the list
interface SelectableUser {
    user_id: string;
    profile_id: string; // Assuming profiles table primary key is useful
    first_name: string | null;
    last_name: string | null;
    profile_picture: string | null;
}
const DEFAULT_PROFILE_PIC = 'https://via.placeholder.com/150/CCCCCC/808080?text=No+Image';

type AddGroupMembersRouteProp = RouteProp<RootStackParamList, 'AddGroupMembersScreen'>;
type AddGroupMembersNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AddGroupMembersScreen'>;

const AddGroupMembersScreen = () => {
    const navigation = useNavigation<AddGroupMembersNavigationProp>();
    const route = useRoute<AddGroupMembersRouteProp>();
    const { session } = useAuth();
    const currentUserId = session?.user?.id;
    const { groupId, groupName } = route.params; // Group ID passed from GroupChatScreen

    // State
    const [potentialMembers, setPotentialMembers] = useState<SelectableUser[]>([]); // Users who *can* be added
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());    // IDs of users selected
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch users who are matches BUT NOT already in the group
    const fetchPotentialMembers = useCallback(async () => {
        if (!currentUserId || !groupId) {
            setError("Missing user or group information.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        console.log(`Fetching potential members to add to group ${groupId}...`);

        try {
             // 1. Get IDs of users already in the group
             const { data: currentMembersData, error: currentMembersError } = await supabase
                .from('group_chat_participants')
                .select('user_id')
                .eq('group_id', groupId);
             if (currentMembersError) throw currentMembersError;
             const currentMemberIds = new Set(currentMembersData?.map(m => m.user_id) || []);
             console.log(`Group ${groupId} currently has members:`, Array.from(currentMemberIds));


             // *******************************************************************
             // *** STEP 6 - CRITICAL: Fetch ACTUAL MATCHED Users Logic HERE ***
             // *******************************************************************
             // You need to replace this placeholder with your real logic.
             // How do you know who the current user is matched with?
             // Possibility A: Query a 'matches' table
             // Possibility B: Call an RPC function 'get_matches(currentUserId)'
             // Possibility C: Use the same source as MatchesScreen (if suitable)

             // --- Placeholder using get_chat_list (REMOVE THIS) ---
             console.warn("Using placeholder (get_chat_list) for fetching matches. Implement Step 6!");
             const { data: chatListData, error: rpcError } = await supabase.rpc('get_chat_list');
             if (rpcError) throw rpcError;
             const allMatchedUsers_PLACEHOLDER: SelectableUser[] = (chatListData || []).map((chatItem: any) => ({
                user_id: chatItem.partner_user_id,
                profile_id: chatItem.partner_profile_id || chatItem.partner_user_id,
                first_name: chatItem.partner_first_name,
                last_name: chatItem.partner_last_name,
                profile_picture: chatItem.partner_profile_picture,
             }));
             // --- End of Placeholder ---

             // *** Replace 'allMatchedUsers_PLACEHOLDER' with your actual fetched matches ***
             const actualFetchedMatches: SelectableUser[] = allMatchedUsers_PLACEHOLDER; // <-- Replace this line
             // *******************************************************************


             // 3. Filter out users already in the group
             const availableUsers = actualFetchedMatches.filter(user => !currentMemberIds.has(user.user_id));
             setPotentialMembers(availableUsers);
             console.log(`Found ${availableUsers.length} potential members to add.`);

        } catch (err: any) {
            console.error("Error fetching potential members:", err);
            setError(`Failed to load users: ${err.message}`);
            setPotentialMembers([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentUserId, groupId]);

    useEffect(() => {
        fetchPotentialMembers();
    }, [fetchPotentialMembers]);

    // Toggle selection
    const toggleUserSelection = (userId: string) => {
        setSelectedUsers(prevSelected => {
            const newSelected = new Set(prevSelected);
            if (newSelected.has(userId)) { newSelected.delete(userId); }
            else { newSelected.add(userId); }
            return newSelected;
        });
     };

    // Filter users based on search query
    const filteredUsers = potentialMembers.filter(user => {
        const name = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
        return name.includes(searchQuery.toLowerCase());
     });

    // Handle adding selected members
    const handleAddMembers = async () => {
        if (selectedUsers.size === 0) {
            Alert.alert("Select Members", "Please select at least one person to add.");
            return;
        }
        if (!currentUserId || !groupId) return;

        Keyboard.dismiss();
        setIsAdding(true);
        setError(null);
        const membersToAdd = Array.from(selectedUsers);

        try {
             console.log(`Calling RPC 'add_group_members' for group ${groupId} with members:`, membersToAdd);
             const { error: rpcError } = await supabase.rpc(
                 'add_group_members',
                 {
                     group_id_input: groupId,
                     new_member_ids: membersToAdd
                 }
             );

             if (rpcError) throw new Error(rpcError.message || "Database error adding members.");

             console.log("Members added successfully via RPC");
             Alert.alert("Members Added", `Successfully added ${membersToAdd.length} user(s) to the group.`);
             setSelectedUsers(new Set()); // Clear selection
             // Optionally refresh potential members list or just navigate back
             // fetchPotentialMembers(); // Re-fetch to update list shown (removes added users)
             navigation.goBack(); // Go back to the group chat screen

        } catch (err: any) {
            console.error("Error adding members:", err);
            Alert.alert("Error", `Could not add members: ${err.message}`);
            setError(`Could not add members: ${err.message}`);
            setIsAdding(false); // Set false only on error
        }
        // Don't set isAdding false on success because we navigate away
    };

    // Render item in the list
    const renderUserItem = ({ item }: { item: SelectableUser }) => {
         const isSelected = selectedUsers.has(item.user_id);
         const name = `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'User';
         return (
            <TouchableOpacity
                style={[styles.userItem, isSelected && styles.userItemSelected]}
                onPress={() => toggleUserSelection(item.user_id)}
                activeOpacity={0.7}
                >
                <Image source={{ uri: item.profile_picture ?? DEFAULT_PROFILE_PIC }} style={styles.avatar} />
                <Text style={styles.userName} numberOfLines={1}>{name}</Text>
                <Feather
                    name={isSelected ? "check-circle" : "circle"}
                    size={22}
                    color={isSelected ? (APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6') : '#CBD5E1'}
                />
            </TouchableOpacity>
         );
     };

    // --- Render Component ---
    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            {/* Search Input */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputWrapper}>
                     <Feather name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search matches to add..."
                        placeholderTextColor="#9CA3AF"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        returnKeyType="search"
                    />
                     {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                            <Feather name="x-circle" size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                 </View>
            </View>

            {/* Header for list */}
             <Text style={styles.listHeader}>Select Matches to Add ({selectedUsers.size} selected)</Text>

            {/* User List */}
            {isLoading ? (
                <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} /></View>
            ) : error ? (
                <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>
            ) : (
                <FlatList
                    data={filteredUsers}
                    renderItem={renderUserItem}
                    keyExtractor={(item) => item.user_id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={<Text style={styles.emptyText}>No more matches available to add.</Text>}
                    keyboardShouldPersistTaps="handled"
                />
            )}

            {/* Footer Action Button */}
            <View style={styles.footer}>
                 <TouchableOpacity
                     style={[styles.addButton, (selectedUsers.size === 0 || isAdding || isLoading) && styles.addButtonDisabled]}
                     onPress={handleAddMembers}
                     disabled={selectedUsers.size === 0 || isAdding || isLoading}
                 >
                     {isAdding ? (
                        <ActivityIndicator color="#FFF" size="small"/>
                     ) : (
                        <Text style={styles.addButtonText}>
                             Add {selectedUsers.size} Member{selectedUsers.size !== 1 ? 's' : ''}
                        </Text>
                     )}
                 </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

// --- Styles --- (Similar to Create Group)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB', },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
    errorText: { color: '#DC2626', textAlign: 'center', fontSize: 15, },
    emptyText: { textAlign: 'center', color: '#6B7280', marginTop: 40, fontSize: 15, },
    searchContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom:12, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', },
    searchInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, height: 40, },
    searchIcon: { marginRight: 8, },
    searchInput: { flex: 1, fontSize: 15, color: '#1F2937', },
    clearButton: { padding: 4, marginLeft: 4, },
    listHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, fontSize: 13, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, backgroundColor: '#F9FAFB', },
    listContent: { paddingBottom: 8, },
    userItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'white', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EFF1F3', },
    userItemSelected: { backgroundColor: 'rgba(59, 130, 246, 0.08)', },
    avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: '#E5E7EB'},
    userName: { flex: 1, fontSize: 16, color: '#1F2937', fontWeight: '500', },
    footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: 'rgba(255,255,255,0.9)', paddingBottom: Platform.OS === 'ios' ? 25 : 16 },
    addButton: { backgroundColor: APP_CONSTANTS?.COLORS?.SUCCESS || '#10B981', paddingVertical: 14, borderRadius: 10, alignItems: 'center', },
    addButtonDisabled: { backgroundColor: '#A7F3D0', },
    addButtonText: { color: 'white', fontSize: 16, fontWeight: '600', },
});

export default AddGroupMembersScreen;