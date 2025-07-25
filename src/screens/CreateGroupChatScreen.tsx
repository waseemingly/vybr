import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Alert,
    TextInput,
    Platform,
    Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker'; // Import image picker
import { decode } from 'base64-arraybuffer'; // Import decoder for upload

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { RootStackParamList } from "@/navigation/AppNavigator";
import { APP_CONSTANTS } from '@/config/constants';

// Type for a user that can be selected for a group (Friend)
interface SelectableUser {
    user_id: string;
    profile_id: string;
    first_name: string | null;
    last_name: string | null;
    profile_picture: string | null;
    username?: string | null;
}

const DEFAULT_PROFILE_PIC = APP_CONSTANTS.DEFAULT_PROFILE_PIC;
const GROUP_AVATAR_PLACEHOLDER = 'https://placehold.co/100x100/e2e8f0/64748b?text=Group'; // Placeholder

type CreateGroupNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CreateGroupChatScreen'>;

const CreateGroupChatScreen = () => {
    const navigation = useNavigation<CreateGroupNavigationProp>();
    const { session } = useAuth();
    const currentUserId = session?.user?.id;

    const [potentialMembers, setPotentialMembers] = useState<SelectableUser[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [groupName, setGroupName] = useState('');
    const [groupImageUri, setGroupImageUri] = useState<string | null>(null); // State for selected image URI
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Request Permissions (iOS requires this)
    useEffect(() => {
        (async () => {
            if (Platform.OS !== 'web') {
                const libraryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (libraryStatus.status !== 'granted') {
                    Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to make this work!');
                }
                // Optional: Add camera permission request if you want to allow taking photos
                // const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
                // if (cameraStatus.status !== 'granted') {
                //  Alert.alert('Permission Required', 'Sorry, we need camera permissions too!');
                // }
            }
        })();
    }, []);

    // Set up header configuration - hide navigation header and use custom header
    useEffect(() => {
        navigation.setOptions({
            headerShown: false,
        });
    }, [navigation]);

    // Function to pick image
    const pickAndUpdateImage = async () => {
        if (isCreating) return; // Don't allow picking while creating

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.6,
            // request base64 on web so we can build our own blob
            base64: Platform.OS === 'web',
        });

        if (result.canceled) return;
        const asset = result.assets[0];
        const extension = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
        let blob: Blob;

        if (Platform.OS === 'web') {
            // expo on web returns base64 if you asked for it
            if (!asset.base64) {
                throw new Error('Need base64 data on web');
            }
            const buffer = decode(asset.base64);
            blob = new Blob([buffer], { type: `image/${extension}` });
        } else {
            // native: fetch local URI to get a Blob
            const response = await fetch(asset.uri);
            blob = await response.blob();
        }

        // now you can call supabase.storage.from('group-avatars').upload(path, blob) safely
        // We'll handle the base64 upload later in handleCreateGroup
        setGroupImageUri(asset.uri); // Set the local URI for preview
    };

    // Function to fetch *accepted friends*
    const fetchSelectableUsers = useCallback(async () => {
        // ... (fetchSelectableUsers logic remains the same)
        if (!currentUserId) {
            setError("Authentication required."); setIsLoading(false); return;
        }
        setIsLoading(true); setError(null);
        console.log("[CreateGroupChat] Fetching accepted friends...");

        try {
            // Step 1: Fetch friend relationships where status is 'accepted'
            const { data: friendRelations, error: relationError } = await supabase
                .from('friends')
                .select('user_id_1, user_id_2')
                .or(`user_id_1.eq.${currentUserId},user_id_2.eq.${currentUserId}`)
                .eq('status', 'accepted');

            if (relationError) throw relationError;

            if (!friendRelations || friendRelations.length === 0) {
                console.log("[CreateGroupChat] No accepted friends found.");
                setPotentialMembers([]);
                setIsLoading(false);
                return;
            }

            // Step 2: Extract friend IDs (the ID that is *not* the current user)
            const friendUserIds = friendRelations
                .map(rel => (rel.user_id_1 === currentUserId ? rel.user_id_2 : rel.user_id_1))
                .filter(id => !!id); // Ensure IDs are valid

            if (friendUserIds.length === 0) {
                console.log("[CreateGroupChat] No valid friend IDs extracted.");
                setPotentialMembers([]);
                setIsLoading(false);
                return;
            }
            console.log("[CreateGroupChat] Found friend user IDs:", friendUserIds);

            // Step 3: Fetch profiles for these friend IDs
            const { data: friendProfiles, error: profileError } = await supabase
                .from('music_lover_profiles') // Assuming friends are music lovers
                .select('id, user_id, first_name, last_name, username, profile_picture')
                .in('user_id', friendUserIds);

            if (profileError) throw profileError;

            // Step 4: Map profile data to SelectableUser format
            const selectableFriends: SelectableUser[] = (friendProfiles || []).map(profile => ({
                user_id: profile.user_id,
                profile_id: profile.id, // Map the profile's primary key
                first_name: profile.first_name,
                last_name: profile.last_name,
                profile_picture: profile.profile_picture,
                username: profile.username,
            }));

            console.log(`[CreateGroupChat] Fetched ${selectableFriends.length} friend profiles.`);
            setPotentialMembers(selectableFriends);

        } catch (err: any) {
            console.error("[CreateGroupChat] Error fetching friends:", err);
            setError("Failed to load friends.");
            setPotentialMembers([]);
        } finally {
            setIsLoading(false);
        }
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

    // Filter users based on search query (name or username)
    const filteredUsers = potentialMembers.filter(user => {
        const name = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
        const username = user.username?.toLowerCase() || '';
        const query = searchQuery.toLowerCase();
        return name.includes(query) || username.includes(query);
    });

    // Upload Image Function
    const uploadGroupImage = async (groupId: string, imageUri: string): Promise<string | null> => {
        try {
            // Prepare blob differently on web vs native
            let blob: Blob;
            if (Platform.OS === 'web' && imageUri.startsWith('data:')) {
                // Data URI with base64
                const [meta, b64] = imageUri.split(',');
                const arrayBuffer = decode(b64);
                // Extract mime type
                const mime = meta.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
                blob = new Blob([arrayBuffer], { type: mime });
            } else {
                const response = await fetch(imageUri);
                if (!response.ok) throw new Error(`Failed to fetch image URI: ${response.statusText}`);
                blob = await response.blob();
            }

            // Extract file extension from blob type or URI
            let fileExt = blob.type.split('/')?.[1] || imageUri.split('.').pop()?.toLowerCase() || 'jpg';
            if (fileExt === 'jpeg') fileExt = 'jpg';
            const path = `${groupId}/avatar.${Date.now()}.${fileExt}`;
            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('group-avatars')
                .upload(path, blob, {
                    cacheControl: '3600', // Cache for 1 hour
                    upsert: true,
                    contentType: blob.type,
                });

            if (uploadError) {
                throw new Error(`Storage Upload Error: ${uploadError.message}`);
            }

            if (!uploadData?.path) throw new Error('Image uploaded but failed to get path.');

            // Get the public URL
            const { data: urlData } = supabase.storage.from('group-avatars').getPublicUrl(uploadData.path);

            console.log('[CreateGroupChat] Image uploaded, Public URL:', urlData.publicUrl);
            return urlData.publicUrl;

        } catch (err: any) {
            console.error('[CreateGroupChat] Error uploading group image:', err);
            Alert.alert('Image Upload Failed', `Could not upload the group image: ${err?.message || 'Please try again.'}`);
            return null;
        }
    };

    // Handle group creation (modified for image upload)
    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            Alert.alert("Group Name Required", "Please enter a name for the group.");
            return;
        }
        if (selectedUsers.size < 1) {
            Alert.alert("Select Members", "Please select at least one friend to create a group.");
            return;
        }
        if (!currentUserId) {
             Alert.alert("Error", "You must be logged in.");
             return;
        }

        Keyboard.dismiss();
        setIsCreating(true);
        setError(null);
        const membersToCreate = [currentUserId, ...Array.from(selectedUsers)];
        const groupNameInput = groupName.trim();
        let uploadedImageUrl: string | null = null;

        try {
            // Step 1: Call RPC to create the group record (without image URL initially)
             console.log(`Calling RPC 'create_group_chat' with name: ${groupNameInput}, members:`, membersToCreate);
             const { data: newGroupData, error: rpcError } = await supabase.rpc(
                 'create_group_chat', 
                 {
                     member_ids: membersToCreate,
                     group_name_input: groupNameInput,
                 }
             );

             if (rpcError) {
                 throw new Error(rpcError.message || "Database error during group creation.");
             }
             
             // Added safety check to better handle the response structure
             if (!newGroupData) throw new Error("Group creation failed - no data returned");
             
             // Extract the group_id safely with explicit type checking
             const newGroupId = typeof newGroupData === 'object' && newGroupData !== null ? 
                 (newGroupData.group_id || newGroupData.id || null) : null;
                 
             if (!newGroupId) throw new Error("Group created, but failed to retrieve group ID.");

             console.log("Group record created successfully via RPC, Group ID:", newGroupId);

             // Step 2: Upload image if selected
             if (groupImageUri) {
                 console.log("[CreateGroupChat] Attempting to upload image for new group...");
                 uploadedImageUrl = await uploadGroupImage(newGroupId, groupImageUri);

                 // Step 3: If upload successful, update the group record with the image URL
                 if (uploadedImageUrl) {
                      console.log("[CreateGroupChat] Updating group record with image URL:", uploadedImageUrl);
                     try {
                         const { error: updateError } = await supabase
                             .from('group_chats')
                             .update({ 
                                 group_image: uploadedImageUrl, 
                                 updated_at: new Date().toISOString() 
                             })
                             .eq('id', newGroupId);
    
                         if (updateError) {
                             console.warn("[CreateGroupChat] Failed to update group with image URL:", updateError.message);
                             Alert.alert("Warning", "Group created, but failed to save the group image. You can try adding it later.");
                         } else {
                             console.log("[CreateGroupChat] Group record updated with image URL.");
                         }
                     } catch (updateErr) {
                         // Handle any exception during the update
                         console.error("[CreateGroupChat] Exception during group image update:", updateErr);
                         Alert.alert("Warning", "Group created, but an error occurred saving the group image.");
                     }
                 }
             }

             // Get the final group name to use (from response or input)
             const finalGroupName = newGroupData.group_name || groupNameInput;
             
             // Step 4: Navigate to the new group chat screen
             navigation.replace('GroupChatScreen', {
                 groupId: newGroupId,
                 groupName: finalGroupName,
                 groupImage: uploadedImageUrl || null, // Explicitly set null if no upload
             });

        } catch (err: any) {
            console.error("Error handling group creation:", err);
            Alert.alert("Error Creating Group", `Could not create group: ${err.message}`);
            setError(`Could not create group: ${err.message}`);
            setIsCreating(false); // Only set creating to false on error
        }
        // No finally block needed here as success navigates away
    };

    // --- Render ---
    const renderUserItem = ({ item }: { item: SelectableUser }) => {
        const isSelected = selectedUsers.has(item.user_id);
        const name = `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.username || 'Friend';
        return (
            <TouchableOpacity
                style={[styles.userItem, isSelected && styles.userItemSelected]}
                onPress={() => toggleUserSelection(item.user_id)}
                activeOpacity={0.7}
            >
                <Image source={{ uri: item.profile_picture ?? DEFAULT_PROFILE_PIC }} style={styles.avatar} />
                <View style={styles.userNameContainer}>
                    <Text style={styles.userName} numberOfLines={1}>{name}</Text>
                    {item.username && <Text style={styles.userUsername}>@{item.username}</Text>}
                </View>
                <Feather
                    name={isSelected ? "check-circle" : "circle"}
                    size={22}
                    color={isSelected ? (APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6') : '#CBD5E1'}
                />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
            {/* Custom Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="chevron-left" size={24} color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Create Group</Text>
            </View>
            {/* Group Info Header (Image + Name Input) */}
            <View style={styles.groupInfoContainer}>
                 <TouchableOpacity onPress={pickAndUpdateImage} style={styles.imagePicker} disabled={isCreating}>
                     <Image
                         source={{ uri: groupImageUri ?? GROUP_AVATAR_PLACEHOLDER }}
                         style={styles.groupAvatar}
                     />
                     <View style={styles.cameraIconOverlay}>
                         <Feather name="camera" size={16} color="white" />
                     </View>
                 </TouchableOpacity>
                 <TextInput
                     style={styles.groupNameInput}
                     placeholder="Group Name"
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
                         placeholder="Search friends to add..."
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
              <Text style={styles.listHeader}>Select Friends ({selectedUsers.size} selected)</Text>

            {/* User List */}
            {isLoading ? ( <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} /></View> )
             : error ? ( <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View> )
             : ( <FlatList
                    data={filteredUsers}
                    renderItem={renderUserItem}
                    keyExtractor={(item) => item.user_id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                         <View style={styles.centered}>
                              <Text style={styles.emptyText}>
                                   {potentialMembers.length === 0
                                        ? "You haven't added any friends yet."
                                        : "No friends match your search."}
                                </Text>
                         </View>
                     }
                    keyboardShouldPersistTaps="handled"
                 />
                )}

            {/* Footer Action Button */}
            <View style={styles.footer}>
                 <TouchableOpacity
                     style={[styles.createButton, (!groupName.trim() || selectedUsers.size < 1 || isCreating || isLoading) && styles.createButtonDisabled]}
                     onPress={handleCreateGroup}
                     disabled={!groupName.trim() || selectedUsers.size < 1 || isCreating || isLoading}
                 >
                     {isCreating ? ( <ActivityIndicator color="#FFF" size="small"/> )
                      : ( <Text style={styles.createButtonText}> Create Group ({selectedUsers.size + 1}) </Text> )}
                 </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

// --- Styles --- (Added styles for image picker)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB', },
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
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
    errorText: { color: '#DC2626', textAlign: 'center', fontSize: 15, },
    emptyText: { textAlign: 'center', color: '#6B7280', marginTop: 40, fontSize: 15, },
    groupInfoContainer: { // Container for image + name input
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    imagePicker: {
        marginRight: 12,
        position: 'relative', // Needed for overlay
    },
    groupAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28, // Make it circular
        backgroundColor: '#E5E7EB',
    },
    cameraIconOverlay: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: 4,
        borderRadius: 12, // Circular background for icon
    },
    groupNameInput: { // Adjusted style
        flex: 1, // Take remaining space
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'ios' ? 12 : 10,
        fontSize: 16,
        fontWeight: '500',
        color: '#1F2937',
        height: 44, // Match avatar height roughly
        alignSelf: 'center',
    },
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
    userNameContainer: { flex: 1, marginRight: 10, justifyContent: 'center' },
    userName: { fontSize: 16, color: '#1F2937', fontWeight: '500', marginBottom: 1 },
    userUsername: { fontSize: 13, color: '#6B7280', },
    footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: 'rgba(255,255,255,0.9)', paddingBottom: Platform.OS === 'ios' ? 25 : 16 },
    createButton: { backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', paddingVertical: 14, borderRadius: 10, alignItems: 'center', },
    createButtonDisabled: { backgroundColor: '#A5B4FC', },
    createButtonText: { color: 'white', fontSize: 16, fontWeight: '600', },
});

export default CreateGroupChatScreen;