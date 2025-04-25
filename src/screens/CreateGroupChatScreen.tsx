// src/screens/CreateGroupChatScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Alert, // **** Import Alert ****
    TextInput,
    Platform,
    Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

// --- Adjust Imports ---
import { supabase } from '@/lib/supabase'; // Adjust path
import { useAuth } from '@/hooks/useAuth'; // Adjust path
import type { RootStackParamList } from "@/navigation/AppNavigator"; // Adjust path
import { APP_CONSTANTS } from '@/config/constants'; // Adjust path
// --- End Adjustments ---

// Type for a user that can be selected for a group
interface SelectableUser {
    user_id: string;
    profile_id: string;
    first_name: string | null;
    last_name: string | null;
    profile_picture: string | null;
}

const DEFAULT_PROFILE_PIC = 'https://via.placeholder.com/150/CCCCCC/808080?text=No+Image';

type CreateGroupNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CreateGroupChatScreen'>;

const CreateGroupChatScreen = () => {
    const navigation = useNavigation<CreateGroupNavigationProp>();
    const { session } = useAuth();
    const currentUserId = session?.user?.id;

    const [potentialMembers, setPotentialMembers] = useState<SelectableUser[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [groupName, setGroupName] = useState(''); // State for group name input
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Function to fetch *matched* users (PLACEHOLDER - REPLACE THIS)
    const fetchSelectableUsers = useCallback(async () => {
        if (!currentUserId) return;
        setIsLoading(true); setError(null);
        console.log("Fetching potential members for group creation...");
        try {
            // **** REPLACE WITH YOUR ACTUAL MATCH FETCHING LOGIC ****
            console.warn("Using placeholder (get_chat_list) for fetching matches. Replace!");
            const { data, error: rpcError } = await supabase.rpc('get_chat_list');
            if (rpcError) throw rpcError;
            const users: SelectableUser[] = (data || []).map((chatItem: any) => ({ /* ... mapping ... */
                user_id: chatItem.partner_user_id, profile_id: chatItem.partner_profile_id || chatItem.partner_user_id, first_name: chatItem.partner_first_name, last_name: chatItem.partner_last_name, profile_picture: chatItem.partner_profile_picture,
             }));
            setPotentialMembers(users);
            // **** END REPLACE ****
        } catch (err: any) { /* ... error handling ... */
             console.error("Error fetching users for group:", err); setError("Failed to load users."); setPotentialMembers([]);
         } finally { setIsLoading(false); }
    }, [currentUserId]);

    useEffect(() => { fetchSelectableUsers(); }, [fetchSelectableUsers]);

    // Handle user selection toggle
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

    // Handle group creation
    const handleCreateGroup = async () => {
        // **** VALIDATION CHECKS ****
        if (!groupName.trim()) { // <-- Check if group name is empty or only whitespace
            Alert.alert("Group Name Required", "Please enter a name for the group.");
            return; // Stop execution if name is missing
        }
        if (selectedUsers.size < 1) {
            Alert.alert("Select Members", "Please select at least one other person to create a group.");
            return;
        }
        if (!currentUserId) {
             Alert.alert("Error", "You must be logged in.");
             return;
        }
        // **** END VALIDATION ****


        Keyboard.dismiss();
        setIsCreating(true);
        setError(null);
        const membersToCreate = [currentUserId, ...Array.from(selectedUsers)];
        // Use the validated, trimmed group name
        const groupNameInput = groupName.trim();

        try {
             console.log(`Calling RPC 'create_group_chat' with name: ${groupNameInput}, members:`, membersToCreate);
             const { data: newGroupData, error: rpcError } = await supabase.rpc(
                 'create_group_chat',
                 {
                     member_ids: membersToCreate,
                     group_name_input: groupNameInput // Pass the validated group name
                 }
             );

             if (rpcError) throw new Error(rpcError.message || "Database error during group creation.");
             if (!newGroupData?.group_id) throw new Error("Group created, but failed to retrieve details.");

             console.log("Group created successfully via RPC:", newGroupData);

             navigation.replace('GroupChatScreen', {
                 groupId: newGroupData.group_id,
                 groupName: newGroupData.group_name,
                 groupImage: newGroupData.group_image,
             });

        } catch (err: any) {
            console.error("Error handling group creation:", err);
            Alert.alert("Error Creating Group", `Could not create group: ${err.message}`);
            setError(`Could not create group: ${err.message}`);
             setIsCreating(false);
        }
    };

    // --- Render ---
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

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            {/* Group Name Input */}
            <View style={styles.groupNameContainer}>
                 <TextInput
                     style={styles.groupNameInput}
                     placeholder="Group Name" // Changed placeholder
                     placeholderTextColor="#9CA3AF"
                     value={groupName}
                     onChangeText={setGroupName}
                     maxLength={50}
                     returnKeyType="done"
                 />
             </View>

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
              <Text style={styles.listHeader}>Select Members ({selectedUsers.size} selected)</Text>

            {/* User List */}
            {isLoading ? ( <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} /></View> )
             : error ? ( <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View> )
             : ( <FlatList data={filteredUsers} renderItem={renderUserItem} keyExtractor={(item) => item.user_id} contentContainerStyle={styles.listContent} ListEmptyComponent={<Text style={styles.emptyText}>No matching users found.</Text>} keyboardShouldPersistTaps="handled" /> )}

            {/* Footer Action Button */}
            <View style={styles.footer}>
                 <TouchableOpacity
                     // Disable button if name is empty OR no members selected OR currently creating/loading
                     style={[styles.createButton, (!groupName.trim() || selectedUsers.size < 1 || isCreating || isLoading) && styles.createButtonDisabled]}
                     onPress={handleCreateGroup}
                     disabled={!groupName.trim() || selectedUsers.size < 1 || isCreating || isLoading}
                 >
                     {isCreating ? ( <ActivityIndicator color="#FFF" size="small"/> )
                      : ( <Text style={styles.createButtonText}> Create Group </Text> )}
                 </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB', },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
    errorText: { color: '#DC2626', textAlign: 'center', fontSize: 15, },
    emptyText: { textAlign: 'center', color: '#6B7280', marginTop: 40, fontSize: 15, },
    groupNameContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', },
    groupNameInput: { backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 10, fontSize: 16, fontWeight: '500', color: '#1F2937', },
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
    createButton: { backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', paddingVertical: 14, borderRadius: 10, alignItems: 'center', },
    // Apply disabled style if name is empty OR no users selected OR creating/loading
    createButtonDisabled: { backgroundColor: '#A5B4FC', },
    createButtonText: { color: 'white', fontSize: 16, fontWeight: '600', },
});

export default CreateGroupChatScreen;