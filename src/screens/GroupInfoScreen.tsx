// src/screens/GroupInfoScreen.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, Image as RNImage, // Use RNImage alias
    FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView,
    Switch, Platform, Modal, Pressable, Dimensions // Import Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ImageView from "react-native-image-viewing"; // *** IMPORT IMAGE VIEWER ***

// --- Adjust Paths ---
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { RootStackParamList } from "@/navigation/AppNavigator"; // Adjust path if needed
import { APP_CONSTANTS } from '@/config/constants';               // Adjust path if needed
// --- End Adjust Paths ---

// --- Types ---
type GroupInfoScreenRouteProp = RouteProp<RootStackParamList, 'GroupInfoScreen'>;
type GroupInfoScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GroupInfoScreen'>;

const DEFAULT_PROFILE_PIC = APP_CONSTANTS?.DEFAULT_PROFILE_PIC || 'https://via.placeholder.com/40';
const DEFAULT_GROUP_PIC = 'https://placehold.co/100x100/e2e8f0/64748b?text=G';

// From get_group_info RPC and 'group_chats' table
interface GroupDetails { id: string; group_name: string; group_image: string | null; created_by: string; can_members_add_others: boolean; can_members_edit_info: boolean; created_at: string; updated_at: string; }
// From get_group_info RPC
interface ParticipantInfo { user_id: string; is_admin: boolean; joined_at: string; }
// From music_lover_profiles or similar
interface BaseUserProfile { first_name: string | null; last_name: string | null; profile_picture: string | null; username?: string | null; }
// Combined structure used in state
interface GroupMember extends ParticipantInfo { profile: BaseUserProfile; }
// Derived from group_chat_messages
interface MediaMessage { id: string; imageUrl: string | null; createdAt: string; }

// --- Calculate Media Item Size ---
const { width: screenWidth } = Dimensions.get('window');
// Adjust calculation based on desired number of columns and padding
const NUM_MEDIA_COLUMNS = 3; // You can change this to 4 if you prefer
const MEDIA_GRID_HORIZONTAL_PADDING = 16 * 2; // Total horizontal padding of the ScrollView/container
const MEDIA_ITEM_GAP = 8; // The gap you want between images
const availableWidth = screenWidth - MEDIA_GRID_HORIZONTAL_PADDING;
const mediaItemSize = (availableWidth - (MEDIA_ITEM_GAP * (NUM_MEDIA_COLUMNS - 1))) / NUM_MEDIA_COLUMNS;


// --- Component ---
const GroupInfoScreen: React.FC = () => {
    const route = useRoute<GroupInfoScreenRouteProp>();
    const navigation = useNavigation<GroupInfoScreenNavigationProp>();
    const { session } = useAuth();
    const currentUserId = session?.user?.id;
    const { groupId } = route.params;

    // --- State ---
    const [groupDetails, setGroupDetails] = useState<GroupDetails | null>(null);
    const [members, setMembers] = useState<GroupMember[]>([]);
    const [mediaMessages, setMediaMessages] = useState<MediaMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMedia, setLoadingMedia] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
    const [processingAction, setProcessingAction] = useState<string | null>(null);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferAdminId, setTransferAdminId] = useState<string | null>(null);
    // *** State for Image Viewer ***
    const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
    const [imageViewerIndex, setImageViewerIndex] = useState(0);


    // --- Fetch Group Details & Members (No View Needed) ---
    const fetchGroupInfo = useCallback(async () => {
         if (!groupId || !currentUserId) { setError("Group/User ID missing."); setIsLoading(false); return; }
         setIsLoading(true); setError(null);
         try {
             const { data: groupData, error: rpcError } = await supabase.rpc('get_group_info', { group_id_input: groupId });
             if (rpcError) { if (rpcError.message.includes('User is not a member')) { Alert.alert("Access Denied", "You are not a member of this group.", [{ text: "OK", onPress: () => navigation.goBack() }]); setError("Not a member."); setGroupDetails(null); setMembers([]); setIsLoading(false); return; } throw rpcError; }
             if (!groupData?.group_details || !groupData?.participants) throw new Error("Incomplete data from get_group_info RPC.");

             const details: GroupDetails = groupData.group_details; const participantsRaw: ParticipantInfo[] = groupData.participants; setGroupDetails(details);
             const currentUserParticipant = participantsRaw.find(p => p.user_id === currentUserId);
             if (!currentUserParticipant) { Alert.alert("Error", "Could not verify membership.", [{ text: "OK", onPress: () => navigation.goBack() }]); throw new Error("Current user not found in participant list."); }
             setIsCurrentUserAdmin(currentUserParticipant.is_admin ?? false);

             const participantUserIds = participantsRaw.map(p => p.user_id); let profilesMap = new Map<string, BaseUserProfile>();
             if (participantUserIds.length > 0) {
                 const { data: profilesData, error: profileError } = await supabase.from('music_lover_profiles').select('user_id, first_name, last_name, username, profile_picture').in('user_id', participantUserIds);
                 if (profileError) { console.error("Error fetching member profiles:", profileError); } else if (profilesData) { profilesData.forEach(p => profilesMap.set(p.user_id, p)); }
             }
             const combinedMembers: GroupMember[] = participantsRaw.map(p => ({ userId: p.user_id, isAdmin: p.is_admin, joinedAt: p.joined_at, profile: profilesMap.get(p.user_id) || { first_name: null, last_name: null, profile_picture: null, username: `User (${p.user_id.substring(0, 4)})` } }));
             setMembers(combinedMembers);
         } catch (err: any) { console.error("Error fetching group info/members:", err); setError(`Failed load: ${err.message}`); setGroupDetails(null); setMembers([]); }
         finally { setIsLoading(false); }
    }, [groupId, currentUserId, navigation]); // Added navigation

    // --- Fetch Media Function ---
    const fetchMedia = useCallback(async () => {
         if (!groupId) return; setLoadingMedia(true);
         try {
             const { data, error } = await supabase.from('group_chat_messages').select('id, image_url, created_at').eq('group_id', groupId).not('image_url', 'is', null).order('created_at', { ascending: false }).limit(50); // Fetch more if needed
             if (error) throw error;
             setMediaMessages(data?.map(m => ({ id: m.id, imageUrl: m.image_url, createdAt: m.created_at })) || []);
         } catch (err: any) { console.error("Error fetching media:", err); setError(prev => prev ? `${prev}\nFailed to load media.` : 'Failed to load media.'); } // Append error or set new one
         finally { setLoadingMedia(false); }
    }, [groupId]);

    // Fetch data AND media on focus/mount
    useFocusEffect( useCallback(() => { console.log("GroupInfoScreen focused"); fetchGroupInfo(); fetchMedia(); return () => { console.log("GroupInfoScreen blurred"); }; }, [fetchGroupInfo, fetchMedia]) );

    // --- Image Update Logic (For Group Avatar - Keep as before) ---
    const pickAndUpdateImage = async () => { /* ... same logic ... */ };

    // --- Real-time Subscriptions (Keep as before, check dependencies) ---
    useEffect(() => { /* ... group details subscription ... */ }, [groupId, navigation, groupDetails?.group_name]); // Added groupDetails?.group_name dep
    useEffect(() => { /* ... participants subscription - refetches info */ }, [groupId, fetchGroupInfo]); // Depend on fetchGroupInfo

    // --- Actions (Keep as before) ---
    const handleLeaveGroup = () => { /* ... same logic ... */ };
    const handleDeleteGroup = () => { /* ... same logic ... */ };
    const handleRemoveMember = (memberId: string, memberName: string) => { /* ... same logic ... */ };
    const handleSetAdminStatus = (memberId: string, memberName: string, makeAdmin: boolean) => { /* ... same logic ... */ };
    const handleToggleAddPermission = async (newValue: boolean) => { /* ... same logic ... */ };
    const handleToggleEditPermission = async (newValue: boolean) => { /* ... same logic ... */ };
    const confirmTransferAndLeave = async () => { /* ... same logic ... */ };

    // --- Image Viewer Logic ---
    // Prepare URIs for the image viewer from the fetched mediaMessages
    const imageViewerUris = useMemo(() => {
        // Filter out items without a valid URL and map to the required format
        return mediaMessages
               .filter(item => typeof item.imageUrl === 'string' && item.imageUrl.length > 0)
               .map(item => ({ uri: item.imageUrl! })); // Assert non-null because of filter
    }, [mediaMessages]); // Re-calculate when mediaMessages changes

    // Function called when a media thumbnail is pressed
    const openImageViewer = (tappedImageUrl: string | null) => {
        if (!tappedImageUrl) {
             console.warn("Attempted to open image viewer with null URL.");
             return; // Do nothing if URL is null/invalid
        }
        // Find the index based on the VALID URIs prepared for the viewer
        const imageIndex = imageViewerUris.findIndex(img => img.uri === tappedImageUrl);
        if (imageIndex !== -1) {
            console.log(`Opening shared media viewer at index: ${imageIndex}`);
            setImageViewerIndex(imageIndex); // Set the starting index
            setIsImageViewerVisible(true);   // Show the modal
        } else {
            console.warn("Tapped shared image URL not found in current viewer list:", tappedImageUrl);
            Alert.alert("Error", "Could not find this image. The list might have updated.");
        }
    };
    // --- End Image Viewer Logic ---


    // --- Render Member Item ---
    const renderMemberItem = ({ item }: { item: GroupMember }) => {
        const name = `${item.profile.first_name || ''} ${item.profile.last_name || ''}`.trim() || item.profile.username || `User (${item.userId.substring(0,4)})`;
        const isSelf = item.userId === currentUserId;
        // TODO: Add navigation to OtherUserProfileScreen if it exists
        const handlePressMember = () => { if (!isSelf) { Alert.alert("Navigate", `Go to profile ${name}`); /* navigation.push('OtherUserProfileScreen', { userId: item.userId }); */ } };
        return (
            <TouchableOpacity style={styles.memberItem} onPress={handlePressMember} disabled={isSelf} activeOpacity={isSelf ? 1 : 0.7}>
                <RNImage source={{ uri: item.profile.profile_picture ?? DEFAULT_PROFILE_PIC }} style={styles.memberAvatar} />
                <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{name} {isSelf ? <Text style={styles.youTag}>(You)</Text> : ''}</Text>
                    {item.isAdmin && <Text style={styles.adminBadge}>Admin</Text>}
                </View>
                {/* Admin Actions */}
                {isCurrentUserAdmin && !isSelf && (
                    <View style={styles.memberActions}>
                        <TouchableOpacity style={styles.actionButtonMember} onPress={() => handleSetAdminStatus(item.userId, name, !item.isAdmin)}>
                            <Feather name={item.isAdmin ? "arrow-down-circle" : "arrow-up-circle"} size={20} color={item.isAdmin ? "#F59E0B" : "#10B981"} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButtonMember} onPress={() => handleRemoveMember(item.userId, name)}>
                            <Feather name="x-circle" size={20} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                )}
                 {/* Loading indicator for member actions */}
                {(processingAction === `remove_${item.userId}` || processingAction === `admin_${item.userId}`) && (
                    <ActivityIndicator size="small" color="#6B7280" style={styles.memberProcessingIndicator}/>
                 )}
            </TouchableOpacity>
        );
    };

    // --- Render Media Item (Connects to Image Viewer) ---
     const renderMediaItem = ({ item }: { item: MediaMessage }) => (
         <TouchableOpacity
             style={styles.mediaItemContainer}
             // *** Call openImageViewer with the image URL ***
             onPress={()=> openImageViewer(item.imageUrl)}
             disabled={!item.imageUrl} // Disable if no URL
         >
             {item.imageUrl ? (
                 <RNImage
                    source={{ uri: item.imageUrl }}
                    style={styles.mediaThumbnail}
                    resizeMode="cover"
                    onError={(e) => console.warn(`Grid Img Load Fail ${item.id}`, e.nativeEvent.error)}
                 />
              ) : (
                // Placeholder if URL is somehow null but item exists
                 <View style={[styles.mediaThumbnail, styles.mediaThumbnailPlaceholder]}>
                     <Feather name="image" size={20} color="#9CA3AF"/>
                 </View>
              )}
         </TouchableOpacity>
     );

    // --- Set Header Title Dynamically ---
     useEffect(() => {
        navigation.setOptions({ title: groupDetails?.group_name || 'Group Info' });
     }, [navigation, groupDetails?.group_name]);

    // --- Main Render ---
    if (isLoading) { return <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} /></View>; }
    if (error && !groupDetails) { return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>; } // Show error only if groupDetails failed completely
    if (!groupDetails || !currentUserId) { return <View style={styles.centered}><Text style={styles.errorText}>Group not found or user invalid.</Text></View>; }

    // Use derived values after checks
    const canEditGroupInfo = isCurrentUserAdmin || groupDetails.can_members_edit_info;
    const canAddMembers = isCurrentUserAdmin || groupDetails.can_members_add_others;

    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
                {/* Group Header */}
                <View style={styles.headerContainer}>
                    <TouchableOpacity onPress={pickAndUpdateImage} disabled={!canEditGroupInfo || !!processingAction}>
                        <RNImage source={{ uri: groupDetails.group_image ?? DEFAULT_GROUP_PIC }} style={styles.groupAvatar} />
                         {canEditGroupInfo && ( <View style={styles.cameraIconOverlay}><Feather name="camera" size={18} color="white" /></View> )}
                         {processingAction === 'update_image' && <ActivityIndicator style={styles.imageLoadingIndicator} color="#FFF"/>}
                    </TouchableOpacity>
                    <Text style={styles.groupName}>{groupDetails.group_name}</Text>
                    <Text style={styles.memberCount}>{members.length} Member{members.length !== 1 ? 's' : ''}</Text>
                </View>

                 {/* Add Members Button */}
                 <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('AddGroupMembersScreen', { groupId, groupName: groupDetails.group_name })} disabled={!canAddMembers || !!processingAction} >
                     <Feather name="user-plus" size={22} color={!canAddMembers ? '#9CA3AF' : (APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6')} style={styles.actionIcon} />
                     <Text style={[styles.actionText, !canAddMembers && styles.disabledText]}>Add Members</Text>
                     {!canAddMembers && <View style={{width: 20}} />}
                     {canAddMembers && <Feather name="chevron-right" size={20} color="#9CA3AF" />}
                 </TouchableOpacity>

                {/* Admin Settings Section */}
                 {isCurrentUserAdmin && (
                    <View style={styles.settingsSection}>
                        <Text style={styles.sectionHeader}>Admin Settings</Text>
                        {/* Add Members Toggle */}
                        <View style={[styles.actionRow, styles.switchRow]}>
                             <Feather name="users" size={22} color="#6B7280" style={styles.actionIcon} />
                             <Text style={[styles.actionText, styles.switchLabel]}>Allow members to add others</Text>
                             {(processingAction === 'toggle_add') && <ActivityIndicator size="small" style={{marginRight: 10}}/>}
                             <Switch
                                 trackColor={{ false: "#E5E7EB", true: "#A5B4FC" }}
                                 thumbColor={groupDetails.can_members_add_others ? (APP_CONSTANTS.COLORS.PRIMARY || '#3B82F6') : "#f4f3f4"}
                                 ios_backgroundColor="#E5E7EB"
                                 onValueChange={handleToggleAddPermission}
                                 value={groupDetails.can_members_add_others}
                                 disabled={!!processingAction}
                            />
                        </View>
                        {/* Edit Info Toggle */}
                        <View style={[styles.actionRow, styles.switchRow]}>
                            <Feather name="edit" size={22} color="#6B7280" style={styles.actionIcon} />
                            <Text style={[styles.actionText, styles.switchLabel]}>Allow members to edit info</Text>
                            {(processingAction === 'toggle_edit') && <ActivityIndicator size="small" style={{marginRight: 10}}/>}
                           <Switch
                                trackColor={{ false: "#E5E7EB", true: "#A5B4FC" }}
                                thumbColor={groupDetails.can_members_edit_info ? (APP_CONSTANTS.COLORS.PRIMARY || '#3B82F6') : "#f4f3f4"}
                                ios_backgroundColor="#E5E7EB"
                                onValueChange={handleToggleEditPermission}
                                value={groupDetails.can_members_edit_info}
                                disabled={!!processingAction}
                            />
                       </View>
                    </View>
                 )}

                 {/* Media Section */}
                 <View style={styles.mediaSection}>
                     <Text style={styles.sectionHeader}>Shared Media</Text>
                     {loadingMedia ? ( <ActivityIndicator style={{ marginVertical: 20 }}/> )
                      : mediaMessages.length > 0 ? (
                         <FlatList
                             data={mediaMessages}
                             renderItem={renderMediaItem} // *** Uses updated renderMediaItem ***
                             keyExtractor={(item) => item.id}
                             numColumns={NUM_MEDIA_COLUMNS} // Grid layout
                             contentContainerStyle={styles.mediaGridContainer}
                             scrollEnabled={false} // Grid shouldn't scroll vertically inside ScrollView
                         />
                      ) : ( <Text style={styles.noMediaText}>No photos or videos shared yet.</Text> )}
                 </View>

                {/* Members List */}
                 <View style={styles.membersSection}>
                    <Text style={styles.sectionHeader}>Members ({members.length})</Text>
                    <FlatList data={members} renderItem={renderMemberItem} keyExtractor={(item) => item.user_id} scrollEnabled={false} ItemSeparatorComponent={() => <View style={styles.separator} />} />
                </View>

                {/* Danger Zone */}
                <View style={styles.dangerZone}>
                     <TouchableOpacity style={[styles.actionRow, styles.dangerActionRow]} onPress={handleLeaveGroup} disabled={!!processingAction} >
                         <Feather name="log-out" size={22} color="#EF4444" style={styles.actionIcon} /><Text style={[styles.actionText, styles.dangerActionText]}>Leave Group</Text>{processingAction === 'leave' && <ActivityIndicator size="small" color="#EF4444" style={styles.actionSpinner}/>}
                     </TouchableOpacity>
                    {(isCurrentUserAdmin) && (
                        <TouchableOpacity style={[styles.actionRow, styles.dangerActionRow]} onPress={handleDeleteGroup} disabled={!!processingAction} >
                            <Feather name="trash-2" size={22} color="#EF4444" style={styles.actionIcon} /><Text style={[styles.actionText, styles.dangerActionText]}>Delete Group</Text>{processingAction === 'delete' && <ActivityIndicator size="small" color="#EF4444" style={styles.actionSpinner}/>}
                        </TouchableOpacity>
                    )}
                </View>

                 {/* Transfer Modal (Keep as before) */}
                 <Modal visible={showTransferModal} /* ... */ >
                    <Pressable style={styles.modalOverlay} onPress={()=>setShowTransferModal(false)}>
                         <Pressable style={styles.modalContent} onPress={() => {}}>
                             <Text style={styles.modalTitle}>Transfer Admin Rights</Text>
                             <Text style={styles.modalSubtitle}>Select a member to promote:</Text>
                             <ScrollView style={{ maxHeight: 200 }}>
                                 {members.filter(m => m.user_id !== currentUserId).map(m => (
                                     <Pressable key={m.user_id} style={[styles.transferOption, transferAdminId===m.user_id && styles.transferOptionSelected]} onPress={() => setTransferAdminId(m.user_id)}>
                                         <Text style={[styles.transferText, transferAdminId === m.user_id && styles.transferTextSelected]}>
                                             {(m.profile.first_name || m.profile.last_name) ? `${m.profile.first_name || ''} ${m.profile.last_name || ''}`.trim() : m.profile.username || `User (${m.user_id.substring(0,4)})`}
                                         </Text>
                                     </Pressable>
                                 ))}
                             </ScrollView>
                             <View style={styles.modalActions}>
                                 <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => setShowTransferModal(false)}>
                                     <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                                 </TouchableOpacity>
                                 <TouchableOpacity style={[styles.modalButton, styles.modalSubmitButton, !transferAdminId && styles.modalDisabled]} onPress={confirmTransferAndLeave} disabled={!transferAdminId}>
                                     <Text style={styles.modalSubmitButtonText}>Confirm</Text>
                                 </TouchableOpacity>
                             </View>
                         </Pressable>
                     </Pressable>
                 </Modal>

            </ScrollView>

            {/* --- Image Viewer Modal (Connects to openImageViewer) --- */}
            <ImageView
                images={imageViewerUris}
                imageIndex={imageViewerIndex}
                visible={isImageViewerVisible}
                onRequestClose={() => setIsImageViewerVisible(false)}
                footerContainerStyle={styles.imageViewerFooter}
                renderFooter={(currentIndex) => (
                    <View style={styles.imageViewerFooterContent}>
                        <Text style={styles.imageViewerFooterText}>
                            {/* Show 1-based index */}
                            {`${imageViewerUris.length > 0 ? currentIndex + 1 : 0} / ${imageViewerUris.length}`}
                        </Text>
                    </View>
                )}
            />
            {/* --- End Image Viewer Modal --- */}

        </SafeAreaView>
    );
};


// --- Styles ---
// Includes specific styles for the media grid
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F9FAFB', },
    container: { flex: 1, },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
    errorText: { color: '#DC2626', textAlign: 'center', fontSize: 16, paddingHorizontal: 20 },
    headerContainer: { alignItems: 'center', paddingVertical: 24, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 16, },
    groupAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#E5E7EB', marginBottom: 12, position: 'relative', },
    cameraIconOverlay: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0, 0, 0, 0.6)', padding: 6, borderRadius: 15, },
    imageLoadingIndicator: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: 50, justifyContent:'center', alignItems:'center'},
    groupName: { fontSize: 22, fontWeight: '600', color: '#1F2937', marginBottom: 4, },
    memberCount: { fontSize: 14, color: '#6B7280', },
    actionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB', minHeight: 50, },
    actionIcon: { marginRight: 16, width: 24, alignItems: 'center' },
    actionText: { flex: 1, fontSize: 16, color: '#1F2937', },
    disabledText: { color: '#9CA3AF' },
    sectionHeader: { paddingHorizontal: 16, paddingVertical: 8, paddingTop: 16, fontSize: 13, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, backgroundColor: '#F9FAFB', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB', },
    settingsSection: { marginBottom: 8, backgroundColor: 'white', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', },
    switchRow: { justifyContent: 'space-between', },
    switchLabel: { flex: 0.8, marginRight: 5 },
    // --- Styles for Media Section (Grid) ---
    mediaSection: { backgroundColor: 'white', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', marginTop: 8, marginBottom: 16, paddingTop: 0 /* Remove top padding, header has it */, paddingBottom: 12 },
    mediaGridContainer: {
        paddingHorizontal: 16 - (MEDIA_ITEM_GAP / 2), // Adjust for outer gap
        paddingTop: 12, // Add padding above grid
    },
    mediaItemContainer: {
        width: mediaItemSize,
        height: mediaItemSize,
        padding: MEDIA_ITEM_GAP / 2, // Creates the gap between items
    },
    mediaThumbnail: {
        flex: 1, // Fill the padded container
        width: '100%',
        height: '100%',
        borderRadius: 6,
        backgroundColor: '#F3F4F6', // Placeholder background
    },
    mediaThumbnailPlaceholder: { justifyContent: 'center', alignItems: 'center', },
    noMediaText: { textAlign: 'center', color: '#9CA3AF', fontStyle: 'italic', marginVertical: 20, paddingHorizontal: 16, },
    // --- End Media Section Styles ---
    membersSection: { backgroundColor: 'white', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB', marginBottom: 16, paddingTop: 0 },
    memberItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, },
    memberAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: '#E5E7EB', },
    memberInfo: { flex: 1, justifyContent: 'center', },
    memberName: { fontSize: 15, fontWeight: '500', color: '#1F2937', },
    youTag: { color: '#6B7280', fontSize: 13, fontWeight: 'normal' },
    adminBadge: { fontSize: 11, fontWeight: '600', color: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: 'hidden', alignSelf: 'flex-start', marginTop: 2, },
    memberActions: { flexDirection: 'row', alignItems: 'center', },
    actionButtonMember: { padding: 6, marginLeft: 8, },
    memberProcessingIndicator: { marginLeft: 10, },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E7EB', marginLeft: 68, }, // For member list
    dangerZone: { marginTop: 8, marginBottom: 0, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: 'white', },
    dangerActionRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB', },
    dangerActionText: { color: '#EF4444', },
    actionSpinner: { marginLeft: 'auto', paddingLeft: 10 },
    // --- Modal Styles ---
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)',},
    modalContent: { backgroundColor: 'white', padding: 20, borderRadius: 10, width: '85%', maxHeight: '60%',},
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center'},
    modalSubtitle: { fontSize: 14, marginBottom: 20, textAlign: 'center', color: '#6B7280'},
    transferOption: { paddingVertical: 12, paddingHorizontal: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB', },
    transferOptionSelected: { backgroundColor: 'rgba(59, 130, 246, 0.1)', },
    transferText: { fontSize: 16, textAlign: 'center' },
    transferTextSelected: { fontWeight: 'bold', color: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6' },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB'},
    modalButton: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 5, flex: 0.45, alignItems: 'center'},
    modalButtonCancel: { backgroundColor: '#E5E7EB', },
    modalButtonTextCancel: { fontSize: 16, fontWeight: '500', color: '#4B5563', },
    modalSubmitButton: { backgroundColor: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', },
    modalDisabled: { backgroundColor: '#D1D5DB', },
    modalSubmitButtonText: { fontSize: 16, fontWeight: '600', color: 'white', },
    // --- Image Viewer Footer Styles ---
    imageViewerFooter: { backgroundColor: 'transparent' }, // Make footer transparent if desired
    imageViewerFooterContent: { paddingBottom: Platform.OS === 'ios' ? 35 : 20, paddingTop: 10, alignItems: 'center', },
    imageViewerFooterText: { color: 'white', fontSize: 16, fontWeight: 'bold', textShadowColor: 'rgba(0, 0, 0, 0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2, },
});

export default GroupInfoScreen;