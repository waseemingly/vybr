import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Image, FlatList, TouchableOpacity,
    ActivityIndicator, Alert, ScrollView, Switch, Platform, Modal, Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { RootStackParamList } from "@/navigation/AppNavigator";
import { APP_CONSTANTS } from '@/config/constants';

// --- Types ---
type GroupInfoScreenRouteProp = RouteProp<RootStackParamList, 'GroupInfoScreen'>;
type GroupInfoScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GroupInfoScreen'>;

const DEFAULT_PROFILE_PIC = APP_CONSTANTS.DEFAULT_PROFILE_PIC;
const DEFAULT_GROUP_PIC = 'https://placehold.co/100x100/e2e8f0/64748b?text=Group'; // Larger placeholder

interface GroupDetails {
    id: string;
    group_name: string;
    group_image: string | null;
    created_by: string;
    can_members_add_others: boolean;
    can_members_edit_info: boolean;
    created_at: string;
    updated_at: string;
}

interface ParticipantInfo {
    user_id: string;
    is_admin: boolean;
    joined_at: string;
}

// Combined type for rendering member list
interface GroupMember extends ParticipantInfo {
    profile: { // Nested profile info
        first_name: string | null;
        last_name: string | null;
        profile_picture: string | null;
        username?: string | null;
    };
}

// --- Component ---
const GroupInfoScreen = () => {
    const route = useRoute<GroupInfoScreenRouteProp>();
    const navigation = useNavigation<GroupInfoScreenNavigationProp>();
    const { session } = useAuth();
    const currentUserId = session?.user?.id;
    const { groupId } = route.params;

    const [groupDetails, setGroupDetails] = useState<GroupDetails | null>(null);
    const [members, setMembers] = useState<GroupMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
    const [processingAction, setProcessingAction] = useState<string | null>(null); // e.g., 'leave', 'delete', 'remove_USERID', 'admin_USERID'
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferAdminId, setTransferAdminId] = useState<string | null>(null);

    const fetchGroupInfo = useCallback(async () => {
        if (!groupId || !currentUserId) {
            setError("Group ID or User ID missing.");
            setIsLoading(false);
            return;
        }
        console.log(`[GroupInfoScreen] Fetching info for group: ${groupId}`);
        setIsLoading(true);
        setError(null);

        try {
            // 1. Fetch group details and participant IDs/admin status using RPC
            const { data: groupData, error: rpcError } = await supabase
                .rpc('get_group_info', { group_id_input: groupId });

            if (rpcError) throw rpcError;
            if (!groupData?.group_details || !groupData?.participants) {
                throw new Error("Incomplete group data received.");
            }

            const details: GroupDetails = groupData.group_details;
            const participantsRaw: ParticipantInfo[] = groupData.participants;

            setGroupDetails(details);

            // Find current user's admin status
            const currentUserParticipant = participantsRaw.find(p => p.user_id === currentUserId);
            setIsCurrentUserAdmin(currentUserParticipant?.is_admin ?? false);

            // 2. Fetch profiles for all participants
            const participantUserIds = participantsRaw.map(p => p.user_id);
            let profilesMap = new Map<string, any>(); // Use 'any' temporarily or define profile type

            if (participantUserIds.length > 0) {
                const { data: profilesData, error: profileError } = await supabase
                    .from('music_lover_profiles') // Adjust table name if needed
                    .select('user_id, first_name, last_name, username, profile_picture')
                    .in('user_id', participantUserIds);

                if (profileError) {
                    console.error("[GroupInfoScreen] Error fetching profiles:", profileError);
                    // Proceed without profiles, maybe show placeholders
                } else if (profilesData) {
                    profilesData.forEach(p => profilesMap.set(p.user_id, p));
                }
            }

            // 3. Combine participant info with profiles
            const combinedMembers: GroupMember[] = participantsRaw.map(p => ({
                ...p,
                profile: profilesMap.get(p.user_id) || { // Provide default profile structure if fetch failed
                    first_name: null,
                    last_name: null,
                    profile_picture: null,
                    username: `User (${p.user_id.substring(0, 4)})`
                }
            }));

            setMembers(combinedMembers);

        } catch (err: any) {
            console.error("[GroupInfoScreen] Error fetching group info:", err);
            setError(`Failed to load group information: ${err.message}`);
            setGroupDetails(null);
            setMembers([]);
        } finally {
            setIsLoading(false);
        }
    }, [groupId, currentUserId]);

    // Fetch data on focus/mount
    useFocusEffect(
        useCallback(() => {
            fetchGroupInfo();
            // Optional cleanup on blur
            return () => {
                // console.log('[GroupInfoScreen] Screen blurred/unfocused');
            };
        }, [fetchGroupInfo])
    );

     // --- Image Handling ---
    const pickAndUpdateImage = async () => {
        if (!(isCurrentUserAdmin || groupDetails?.can_members_edit_info) || processingAction) return;

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [1, 1], quality: 0.6,
        });

        if (!result.canceled && result.assets && result.assets[0].uri && groupId) {
            const imageUri = result.assets[0].uri;
            setProcessingAction('update_image');
            let uploadedImageUrl: string | null = null;
            try {
                 // Re-use upload logic (could be extracted to a helper)
                 const imageResponse = await fetch(imageUri);
                 if (!imageResponse.ok) {
                     throw new Error(`Failed to fetch image URI: ${imageResponse.statusText}`);
                 }
                 const blob = await imageResponse.blob();

                 if (!blob) {
                     throw new Error('Could not create blob from image URI.');
                 }

                 const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
                 const path = `${groupId}/avatar.${Date.now()}.${fileExt}`;

                 console.log(`[GroupInfoScreen] Uploading image to path: ${path}, content type: ${blob.type}`);

                 const { data: uploadData, error: uploadError } = await supabase.storage
                     .from('group-avatars')
                     .upload(path, blob, {
                         upsert: true,
                         contentType: blob.type, // Explicitly set content type
                     });

                 if (uploadError) throw new Error(`Storage Upload Error: ${uploadError.message}`);
                 if (!uploadData?.path) throw new Error("Image uploaded but failed to get path.");

                 const { data: urlData } = supabase.storage.from('group-avatars').getPublicUrl(uploadData.path);
                 uploadedImageUrl = urlData.publicUrl;

                 // Call RPC to update the group image URL
                 const { error: rpcError } = await supabase.rpc('update_group_image', {
                     group_id_input: groupId,
                     new_image_url: uploadedImageUrl
                 });
                 if (rpcError) throw rpcError;

                 // Optimistic UI update (or rely on subscription below)
                 setGroupDetails(prev => prev ? { ...prev, group_image: uploadedImageUrl } : null);
                 Alert.alert("Success", "Group image updated.");

            } catch (err: any) {
                console.error("Error updating group image:", err);
                Alert.alert("Error", `Could not update group image: ${err.message}`);
            } finally {
                setProcessingAction(null);
            }
        }
    };


    // --- Real-time Subscription for Group Details ---
    useEffect(() => {
        if (!groupId) return;
        const channel = supabase.channel(`group_info_details_${groupId}`)
            .on<GroupDetails>(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'group_chats', filter: `id=eq.${groupId}` },
                (payload) => {
                    console.log('[GroupInfoScreen] Realtime GroupDetails Update:', payload.new);
                    setGroupDetails(prev => ({ ...prev, ...payload.new } as GroupDetails));
                    // Update header title if needed
                     if (payload.new.group_name && payload.new.group_name !== groupDetails?.group_name) {
                         navigation.setOptions({ title: payload.new.group_name });
                     }
                }
            )
            .on<any>( // Listen for DELETE event too
                 'postgres_changes',
                 { event: 'DELETE', schema: 'public', table: 'group_chats', filter: `id=eq.${groupId}` },
                 (payload) => {
                     console.log('[GroupInfoScreen] Group deleted remotely.');
                     Alert.alert("Group Deleted", "This group no longer exists.", [
                         { text: "OK", onPress: () => navigation.popToTop() } // Go back to chat list
                     ]);
                 }
             )
            .subscribe((status, err) => {
                 if (status === 'SUBSCRIBED') console.log(`[GroupInfoScreen] Subscribed to GroupDetails ${groupId}`);
                 if (err) console.error(`[GroupInfoScreen] Subscription error GroupDetails ${groupId}:`, err);
            });

        return () => { console.log(`[GroupInfoScreen] Unsubscribing GroupDetails ${groupId}`); supabase.removeChannel(channel); };
    }, [groupId, navigation, groupDetails?.group_name]); // Add groupDetails.group_name dependency


    // --- Real-time Subscription for Participants ---
     useEffect(() => {
         if (!groupId) return;
         const participantsChannel = supabase
             .channel(`group_participants_${groupId}`)
             .on(
                 'postgres_changes',
                 { event: '*', schema: 'public', table: 'group_chat_participants', filter: `group_id=eq.${groupId}` },
                 (payload) => {
                     console.log('[GroupInfoScreen] Realtime Participants Change:', payload);
                     // Refetch all info on any change for simplicity
                     // More granular updates possible but complex
                     fetchGroupInfo();
                 }
             )
             .subscribe((status, err) => {
                  if (status === 'SUBSCRIBED') console.log(`[GroupInfoScreen] Subscribed to Participants ${groupId}`);
                  if (err) console.error(`[GroupInfoScreen] Subscription error Participants ${groupId}:`, err);
             });

         return () => { console.log(`[GroupInfoScreen] Unsubscribing Participants ${groupId}`); supabase.removeChannel(participantsChannel); };
     }, [groupId, fetchGroupInfo]); // fetchGroupInfo is stable due to useCallback


    // --- Actions ---

    const handleLeaveGroup = () => {
        if (!groupId || processingAction) return;
        // If current user is admin
        if (isCurrentUserAdmin) {
            const adminMembers = members.filter(m => m.is_admin && m.user_id !== currentUserId);
            if (adminMembers.length === 0) {
                // No other admins: require transfer
                setShowTransferModal(true);
                return;
            }
        }
        // Proceed with existing leave logic
        Alert.alert(
            "Leave Group",
            "Are you sure you want to leave this group?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Leave", style: "destructive", onPress: async () => {
                    setProcessingAction('leave');
                    try {
                        const { error } = await supabase.rpc('leave_group', { group_id_input: groupId });
                        if (error) throw error;
                        Alert.alert("Success", "You have left the group.");
                        navigation.popToTop();
                    } catch (err: any) {
                        console.error("Error leaving group:", err);
                        Alert.alert("Error", `Could not leave group: ${err.message}`);
                    } finally {
                        setProcessingAction(null);
                    }
                }}
            ]
        );
    };

    // Delete group action, using web confirm on web
    const handleDeleteGroup = () => {
        if (!groupId || !isCurrentUserAdmin || processingAction) return;
        const performDelete = async () => {
            setProcessingAction('delete');
            try {
                console.log('[GroupInfoScreen] Calling delete_group RPC for', groupId);
                const { data, error } = await supabase.rpc('delete_group', { group_id_input: groupId });
                console.log('[GroupInfoScreen] delete_group RPC returned:', { data, error });
                if (error) throw error;
                Alert.alert('Success', 'Group deleted.');
                navigation.popToTop();
            } catch (err: any) {
                console.error('Error deleting group:', err);
                Alert.alert('Error', `Could not delete group: ${err.message}`);
            } finally {
                setProcessingAction(null);
            }
        };
        if (Platform.OS === 'web') {
            if (window.confirm('Permanently delete this group for everyone? This cannot be undone.')) {
                performDelete();
            }
        } else {
            Alert.alert(
                'Delete Group',
                'Are you sure you want to permanently delete this group for everyone? This action cannot be undone.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: performDelete }
                ]
            );
        }
    };

    const handleRemoveMember = (memberId: string, memberName: string) => {
        if (!groupId || !isCurrentUserAdmin || processingAction || memberId === currentUserId) return;

        const performRemoval = async () => {
            setProcessingAction(`remove_${memberId}`);
            try {
                console.debug(`[GroupInfoScreen] Attempting remove_group_member RPC for groupId=${groupId}, memberId=${memberId}`);
                const { data, error } = await supabase.rpc('remove_group_member', {
                    group_id_input: groupId,
                    member_to_remove_id: memberId
                });
                console.debug("[GroupInfoScreen] remove_group_member RPC returned:", { data, error });
                if (error) throw error;
                Alert.alert("Success", `${memberName} removed.`);
                fetchGroupInfo();
            } catch (err: any) {
                console.error(`Error removing member ${memberId}:`, err);
                Alert.alert("Error", `Could not remove member: ${err.message}`);
            } finally {
                setProcessingAction(null);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Remove ${memberName} from the group?`)) {
                performRemoval();
            }
        } else {
            Alert.alert(
                "Remove Member",
                `Are you sure you want to remove ${memberName} from the group?`,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Remove", style: "destructive", onPress: performRemoval }
                ]
            );
        }
    };

    const handleSetAdminStatus = (memberId: string, memberName: string, makeAdmin: boolean) => {
        if (!groupId || !isCurrentUserAdmin || processingAction || memberId === currentUserId) return;
        const action = makeAdmin ? "promote" : "demote";
        const actionText = makeAdmin ? "Make Admin" : "Remove Admin";

        const performAdminChange = async () => {
            setProcessingAction(`admin_${memberId}`);
            try {
                console.debug(`[GroupInfoScreen] Attempting set_group_admin_status RPC for groupId=${groupId}, memberId=${memberId}, isAdmin=${makeAdmin}`);
                const { data, error } = await supabase.rpc('set_group_admin_status', {
                    group_id_input: groupId,
                    member_id: memberId,
                    is_admin_status: makeAdmin
                });
                console.debug("[GroupInfoScreen] set_group_admin_status RPC returned:", { data, error });
                if (error) throw error;
                Alert.alert("Success", `Admin status updated for ${memberName}.`);
                fetchGroupInfo();
            } catch (err: any) {
                console.error(`Error setting admin status for ${memberId}:`, err);
                Alert.alert("Error", `Could not update admin status: ${err.message}`);
            } finally {
                setProcessingAction(null);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Are you sure you want to ${action} ${memberName}?`)) {
                performAdminChange();
            }
        } else {
            Alert.alert(
                actionText,
                `Are you sure you want to ${action} ${memberName}?`,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: actionText, style: makeAdmin ? "default" : "destructive", onPress: performAdminChange }
                ]
            );
        }
    };

    const handleToggleAddPermission = async (newValue: boolean) => {
         if (!groupId || !isCurrentUserAdmin || processingAction) return;
          setProcessingAction('toggle_permission');
          try {
              const { error } = await supabase.rpc('set_group_add_permission', {
                  group_id_input: groupId,
                  allow_members_to_add: newValue
              });
              if (error) throw error;
              // Optimistic update (or rely on subscription)
              setGroupDetails(prev => prev ? { ...prev, can_members_add_others: newValue } : null);
              Alert.alert("Success", "Permission updated.");
          } catch (err: any)              {
              console.error("Error toggling add permission:", err);
              Alert.alert("Error", `Could not update permission: ${err.message}`);
              // Revert optimistic update if needed
               setGroupDetails(prev => prev ? { ...prev, can_members_add_others: !newValue } : null);
          } finally {
               setProcessingAction(null);
          }
    };


    // --- NEW: Handler for Toggling Edit Permission ---
    const handleToggleEditPermission = async (newValue: boolean) => {
        if (!groupId || !isCurrentUserAdmin || processingAction || !groupDetails) return;
        const originalValue = groupDetails.can_members_edit_info;
        setProcessingAction('toggle_edit_permission');
        // Optimistic update
        setGroupDetails(prev => prev ? { ...prev, can_members_edit_info: newValue } : null);

        try {
            const { error } = await supabase.rpc('set_group_edit_permission', {
                group_id_input: groupId,
                allow_members_to_edit: newValue
            });
            if (error) throw error;
            Alert.alert("Success", "Edit permission updated.");
        } catch (err: any)              {
            console.error("Error toggling edit permission:", err);
            Alert.alert("Error", `Could not update edit permission: ${err.message}`);
            // Revert optimistic update on error
             setGroupDetails(prev => prev ? { ...prev, can_members_edit_info: originalValue } : null);
        } finally {
             setProcessingAction(null);
        }
   };

    // --- Render Member Item ---
    const renderMemberItem = ({ item }: { item: GroupMember }) => {
        const name = `${item.profile.first_name || ''} ${item.profile.last_name || ''}`.trim() || item.profile.username || `User (${item.user_id.substring(0,4)})`;
        const isSelf = item.user_id === currentUserId;

        // Navigate to the OtherUserProfileScreen when the item is pressed (except for self)
        const handlePressMember = () => {
            if (!isSelf) {
                navigation.push('OtherUserProfileScreen', { userId: item.user_id });
            } else {
                // Optional: Navigate to current user's own profile screen if desired
                console.log("Cannot navigate to own profile from here.");
            }
        };

        return (
            <TouchableOpacity
                style={styles.memberItem}
                onPress={handlePressMember}
                disabled={isSelf} // Optionally disable touch for self
                activeOpacity={isSelf ? 1 : 0.7} // Reduce visual feedback for self if not navigating
            >
                <Image source={{ uri: item.profile.profile_picture ?? DEFAULT_PROFILE_PIC }} style={styles.memberAvatar} />
                <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{name} {isSelf ? '(You)' : ''}</Text>
                    {item.is_admin && <Text style={styles.adminBadge}>Admin</Text>}
                </View>
                {isCurrentUserAdmin && !isSelf && ( // Show admin actions only to admins, and not for themselves
                    <View style={styles.memberActions}>
                        {/* Promote/Demote Button */}
                        <TouchableOpacity
                            style={[styles.actionButton, styles.adminActionButton]}
                            onPress={() => {
                                console.log('Admin button pressed for', item.user_id);
                                handleSetAdminStatus(item.user_id, name, !item.is_admin);
                            }}
                            activeOpacity={0.7}
                        >
                             <Feather name={item.is_admin ? "arrow-down-circle" : "arrow-up-circle"} size={20} color={item.is_admin ? "#F59E0B" : "#10B981"} />
                        </TouchableOpacity>
                         {/* Remove Button */}
                        <TouchableOpacity
                            style={[styles.actionButton, styles.removeActionButton]}
                            onPress={() => {
                                console.log('Remove button pressed for', item.user_id);
                                handleRemoveMember(item.user_id, name);
                            }}
                            activeOpacity={0.7}
                        >
                            <Feather name="x-circle" size={20} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                )}
                 {processingAction === `remove_${item.user_id}` || processingAction === `admin_${item.user_id}` ? (
                     <ActivityIndicator size="small" color="#6B7280" style={styles.memberProcessingIndicator}/>
                 ) : null}
            </TouchableOpacity>
        );
    };

    // New handler: after transfer selection
    const confirmTransferAndLeave = async () => {
        if (!groupId || !transferAdminId) return;
        setShowTransferModal(false);
        setProcessingAction('leave');
        try {
            // Promote selected user
            const { error: promoteError } = await supabase.rpc('set_group_admin_status', {
                group_id_input: groupId,
                member_id: transferAdminId,
                is_admin_status: true
            });
            if (promoteError) throw promoteError;
            // Now leave
            const { error: leaveError } = await supabase.rpc('leave_group', { group_id_input: groupId });
            if (leaveError) throw leaveError;
            Alert.alert("Success", "You have transferred admin and left the group.");
            navigation.popToTop();
        } catch (err: any) {
            console.error("Error transfer/admin leave:", err);
            Alert.alert("Error", `Could not complete transfer/leave: ${err.message}`);
        } finally {
            setProcessingAction(null);
            setTransferAdminId(null);
        }
    };

    // --- Main Render ---
    if (isLoading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} /></View>;
    }

    if (error) {
        return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
    }

    if (!groupDetails) {
         return <View style={styles.centered}><Text style={styles.errorText}>Group not found.</Text></View>;
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
            <ScrollView style={styles.container}>
                {/* Group Header Info */}
                <View style={styles.headerContainer}>
                    <TouchableOpacity onPress={pickAndUpdateImage} disabled={!(isCurrentUserAdmin || groupDetails?.can_members_edit_info) || !!processingAction}>
                        <Image
                            source={{ uri: groupDetails.group_image ?? DEFAULT_GROUP_PIC }}
                            style={styles.groupAvatar}
                        />
                         {(isCurrentUserAdmin || groupDetails?.can_members_edit_info) && (
                             <View style={styles.cameraIconOverlay}>
                                 <Feather name="camera" size={18} color="white" />
                             </View>
                         )}
                          {processingAction === 'update_image' && <ActivityIndicator style={styles.imageLoadingIndicator} color="#FFF"/>}
                    </TouchableOpacity>
                    <Text style={styles.groupName}>{groupDetails.group_name}</Text>
                    <Text style={styles.memberCount}>{members.length} Member{members.length !== 1 ? 's' : ''}</Text>
                </View>

                 {/* Add Members Button */}
                 <TouchableOpacity
                     style={styles.actionRow}
                     onPress={() => navigation.navigate('AddGroupMembersScreen', { groupId, groupName: groupDetails.group_name })}
                     disabled={!isCurrentUserAdmin && !groupDetails.can_members_add_others} // Disable if user not admin AND members cannot add
                 >
                     <Feather name="user-plus" size={22} color={APP_CONSTANTS.COLORS.PRIMARY} style={styles.actionIcon} />
                     <Text style={styles.actionText}>Add Members</Text>
                     <Feather name="chevron-right" size={20} color="#9CA3AF" />
                 </TouchableOpacity>

                {/* Settings Section (Admin Only) */}
                {isCurrentUserAdmin && (
                    <View style={styles.settingsSection}>
                        <Text style={styles.sectionHeader}>Admin Settings</Text>
                        <View style={[styles.actionRow, styles.switchRow]}>
                             <Feather name="users" size={22} color="#6B7280" style={styles.actionIcon} />
                             <Text style={[styles.actionText, styles.switchLabel]}>Allow members to add others</Text>
                            <Switch
                                trackColor={{ false: "#E5E7EB", true: "#A5B4FC" }} // Adjusted colors
                                thumbColor={groupDetails.can_members_add_others ? APP_CONSTANTS.COLORS.PRIMARY : "#f4f3f4"}
                                ios_backgroundColor="#E5E7EB"
                                onValueChange={handleToggleAddPermission}
                                value={groupDetails.can_members_add_others}
                                disabled={!!processingAction}
                            />
                             {processingAction === 'toggle_permission' && <ActivityIndicator size="small" style={{marginLeft: 5}}/>}
                        </View>

                        {/* --- NEW: Edit Info Permission --- */}
                        <View style={[styles.actionRow, styles.switchRow]}>
                            <Feather name="edit" size={22} color="#6B7280" style={styles.actionIcon} />
                            <Text style={[styles.actionText, styles.switchLabel]}>Allow members to edit info</Text>
                           <Switch
                               trackColor={{ false: "#E5E7EB", true: "#A5B4FC" }}
                               thumbColor={groupDetails.can_members_edit_info ? APP_CONSTANTS.COLORS.PRIMARY : "#f4f3f4"}
                               ios_backgroundColor="#E5E7EB"
                               onValueChange={handleToggleEditPermission} // <-- Use new handler
                               value={groupDetails.can_members_edit_info} // <-- Use new state field
                               disabled={!!processingAction}
                           />
                            {processingAction === 'toggle_edit_permission' && <ActivityIndicator size="small" style={{marginLeft: 5}}/>}
                       </View>
                       {/* --- END: Edit Info Permission --- */}

                    </View>
                )}


                {/* Members List */}
                <View style={styles.membersSection}>
                    <Text style={styles.sectionHeader}>Members</Text>
                    <FlatList
                        data={members}
                        renderItem={renderMemberItem}
                        keyExtractor={(item) => item.user_id}
                        scrollEnabled={false} // Disable scrolling as it's inside a ScrollView
                        ItemSeparatorComponent={() => <View style={styles.separator} />}
                    />
                </View>

                {/* Danger Zone */}
                <View style={styles.dangerZone}>
                     <TouchableOpacity
                         style={[styles.actionRow, styles.dangerActionRow]}
                         onPress={handleLeaveGroup}
                         disabled={!!processingAction}
                     >
                         <Feather name="log-out" size={22} color="#EF4444" style={styles.actionIcon} />
                         <Text style={[styles.actionText, styles.dangerActionText]}>Leave Group</Text>
                          {processingAction === 'leave' && <ActivityIndicator size="small" color="#EF4444" />}
                     </TouchableOpacity>

                    {(isCurrentUserAdmin /* || groupDetails.created_by === currentUserId */) && ( // Show Delete only to admin (or creator)
                        <TouchableOpacity
                            style={[styles.actionRow, styles.dangerActionRow]}
                            onPress={handleDeleteGroup}
                             disabled={!!processingAction}
                        >
                            <Feather name="trash-2" size={22} color="#EF4444" style={styles.actionIcon} />
                            <Text style={[styles.actionText, styles.dangerActionText]}>Delete Group</Text>
                             {processingAction === 'delete' && <ActivityIndicator size="small" color="#EF4444" />}
                        </TouchableOpacity>
                    )}
                </View>

                {/* Transfer Modal */}
                <Modal visible={showTransferModal} transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Transfer Admin Rights</Text>
                            <Text style={styles.modalSubtitle}>Select a member to promote before leaving:</Text>
                            <ScrollView style={{ maxHeight: 200 }}>
                                {members.filter(m => m.user_id !== currentUserId).map(m => (
                                    <Pressable key={m.user_id} style={styles.transferOption} onPress={() => setTransferAdminId(m.user_id)}>
                                        <Text style={[styles.transferText, transferAdminId === m.user_id && styles.transferTextSelected]}>
                                            {(m.profile.first_name || m.profile.username) ?? m.user_id}
                                        </Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowTransferModal(false)}>
                                    <Text style={styles.modalCancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalSubmitButton, !transferAdminId && styles.modalDisabled]}
                                    onPress={confirmTransferAndLeave}
                                    disabled={!transferAdminId}
                                >
                                    <Text style={styles.modalSubmitButtonText}>Confirm</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

            </ScrollView>
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F9FAFB', // Light grey background
    },
    container: {
        flex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        color: '#DC2626',
        textAlign: 'center',
        fontSize: 16,
    },
    headerContainer: {
        alignItems: 'center',
        paddingVertical: 24,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        marginBottom: 16,
    },
    groupAvatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#E5E7EB',
        marginBottom: 12,
        position: 'relative',
    },
     cameraIconOverlay: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: 6,
        borderRadius: 15,
    },
    imageLoadingIndicator: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
         backgroundColor: 'rgba(0, 0, 0, 0.3)',
         borderRadius: 50,
    },
    groupName: {
        fontSize: 22,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 4,
    },
    memberCount: {
        fontSize: 14,
        color: '#6B7280',
    },
     actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E7EB',
    },
     actionIcon: {
        marginRight: 16,
    },
    actionText: {
        flex: 1,
        fontSize: 16,
        color: '#1F2937',
    },
    sectionHeader: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        backgroundColor: '#F9FAFB', // Match background
        marginTop: 16, // Space before sections
    },
     settingsSection: {
        marginBottom: 8, // Space after settings section
    },
    switchRow: {
         justifyContent: 'space-between', // Align items for switch
     },
     switchLabel: {
         flex: 0.8, // Give text slightly less space
     },
    membersSection: {
        backgroundColor: 'white',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E5E7EB',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E7EB',
        marginBottom: 16,
    },
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    memberAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
        backgroundColor: '#E5E7EB',
    },
    memberInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    memberName: {
        fontSize: 15,
        fontWeight: '500',
        color: '#1F2937',
    },
    adminBadge: {
        fontSize: 11,
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.PRIMARY, // Or a specific admin color
        backgroundColor: 'rgba(59, 130, 246, 0.1)', // Light blue background
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        overflow: 'hidden', // Ensure background respects border radius on Android
        alignSelf: 'flex-start', // Prevent badge from taking full width
        marginTop: 2,
    },
     memberActions: {
         flexDirection: 'row',
         alignItems: 'center',
     },
     actionButton: {
        padding: 6,
        marginLeft: 8,
        justifyContent: 'center',
        alignItems: 'center'
     },
     adminActionButton: {
        //backgroundColor: 'rgba(34, 197, 94, 0.1)', // Light green
        // borderRadius: 15,
     },
     removeActionButton: {
        // backgroundColor: 'rgba(239, 68, 68, 0.1)', // Light red
        // borderRadius: 15,
     },
     actionButtonText: { // If using text instead of icons
         fontSize: 12,
         fontWeight: '500',
     },
    memberProcessingIndicator: {
         marginLeft: 8,
     },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#E5E7EB',
        marginLeft: 68, // Indent separator (avatar width + margin)
    },
    dangerZone: {
        marginTop: 24,
        marginBottom: 30, // Extra space at bottom
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    dangerActionRow: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E7EB',
    },
    dangerActionText: {
        color: '#EF4444', // Red text for danger actions
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
        width: '80%',
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    modalSubtitle: {
        fontSize: 14,
        marginBottom: 20,
    },
    transferOption: {
        padding: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E7EB',
    },
    transferText: {
        fontSize: 16,
    },
    transferTextSelected: {
        fontWeight: 'bold',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
    },
    modalCancelButton: {
        padding: 10,
        backgroundColor: '#EF4444',
        borderRadius: 5,
    },
    modalCancelButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'white',
    },
    modalSubmitButton: {
        padding: 10,
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
        borderRadius: 5,
    },
    modalDisabled: {
        backgroundColor: '#E5E7EB',
    },
    modalSubmitButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'white',
    },
});

export default GroupInfoScreen;