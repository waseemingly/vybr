import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Image as RNImage, // Use RNImage alias
    FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView,
    Switch, Platform, Modal, Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ImageViewer from 'react-native-image-zoom-viewer';

// --- Adjust Paths ---
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { RootStackParamList } from "@/navigation/AppNavigator"; // Adjust path if needed
import { APP_CONSTANTS } from '@/config/constants';               // Adjust path if needed
// --- End Adjust Paths ---

// --- Types ---
type GroupInfoScreenRouteProp = RouteProp<RootStackParamList & {
    GroupInfoScreen: {
        groupId: string;
        groupName: string;
        groupImage: string | null;
        onCloseChat?: () => void; // Add onCloseChat for web chat panel
    }
}, 'GroupInfoScreen'>;
type GroupInfoScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GroupInfoScreen'>;

const DEFAULT_PROFILE_PIC = APP_CONSTANTS?.DEFAULT_PROFILE_PIC || 'https://via.placeholder.com/40';
const DEFAULT_GROUP_PIC = 'https://placehold.co/100x100/e2e8f0/64748b?text=G';

interface GroupDetails { id: string; group_name: string; group_image: string | null; created_by: string; can_members_add_others: boolean; can_members_edit_info: boolean; created_at: string; updated_at: string; }
interface ParticipantInfo { user_id: string; is_admin: boolean; joined_at: string; }
interface GroupMember extends ParticipantInfo { profile: { first_name: string | null; last_name: string | null; profile_picture: string | null; username?: string | null; }; }
interface MediaMessage { id: string; imageUrl: string | null; createdAt: string; }

// --- Component ---
const GroupInfoScreen = () => {
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
    const [imageViewerVisible, setImageViewerVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    // --- Fetch Group Details & Members ---
    const fetchGroupInfo = useCallback(async () => {
         if (!groupId || !currentUserId) { setError("Group/User ID missing."); setIsLoading(false); return; }
         setIsLoading(true); setError(null);
         try {
             const { data: groupData, error: rpcError } = await supabase.rpc('get_group_info', { group_id_input: groupId });
             if (rpcError) throw rpcError;
             if (!groupData?.group_details || !groupData?.participants) throw new Error("Incomplete data.");
             const details: GroupDetails = groupData.group_details; const participantsRaw: ParticipantInfo[] = groupData.participants;
             setGroupDetails(details);
             const currentUserParticipant = participantsRaw.find(p => p.user_id === currentUserId); setIsCurrentUserAdmin(currentUserParticipant?.is_admin ?? false);
             const participantUserIds = participantsRaw.map(p => p.user_id);
             let profilesMap = new Map<string, any>();
             if (participantUserIds.length > 0) {
                 const { data: profilesData, error: profileError } = await supabase.from('music_lover_profiles').select('user_id, first_name, last_name, username, profile_picture').in('user_id', participantUserIds);
                 if (profileError) { console.error("Error fetching profiles:", profileError); } else if (profilesData) { profilesData.forEach(p => profilesMap.set(p.user_id, p)); }
             }
             const combinedMembers: GroupMember[] = participantsRaw.map(p => ({ ...p, profile: profilesMap.get(p.user_id) || { first_name: null, last_name: null, profile_picture: null, username: `User (${p.user_id.substring(0, 4)})` } }));
             setMembers(combinedMembers);
         } catch (err: any) { console.error("Error fetching group info:", err); setError(`Failed load: ${err.message}`); setGroupDetails(null); setMembers([]); }
         finally { setIsLoading(false); }
    }, [groupId, currentUserId]);

    // --- Fetch Media Function ---
    const fetchMedia = useCallback(async () => {
         if (!groupId) return; setLoadingMedia(true);
         try {
             const { data, error } = await supabase.from('group_chat_messages').select('id, image_url, created_at').eq('group_id', groupId).not('image_url', 'is', null).order('created_at', { ascending: false }).limit(50);
             if (error) throw error;
             setMediaMessages(data?.map(m => ({ id: m.id, imageUrl: m.image_url, createdAt: m.created_at })) || []);
         } catch (err: any) { console.error("Error fetching media:", err); }
         finally { setLoadingMedia(false); }
    }, [groupId]);

    // Fetch data AND media on focus/mount
    useFocusEffect( useCallback(() => { fetchGroupInfo(); fetchMedia(); return () => {}; }, [fetchGroupInfo, fetchMedia]) );

    // Set up header configuration
    useEffect(() => {
        navigation.setOptions({
            headerShown: true,
            headerTitle: 'Group Info',
            headerTitleAlign: 'center',
            headerBackTitleVisible: false,
            headerLeft: () => (
                <TouchableOpacity 
                    onPress={() => {
                        // Check if we're in web chat panel mode and use appropriate navigation
                        if (Platform.OS === 'web' && route.params.onCloseChat) {
                            route.params.onCloseChat();
                        } else {
                            navigation.goBack();
                        }
                    }} 
                    style={{ marginLeft: Platform.OS === 'ios' ? 10 : 0, padding: 5 }}
                >
                    <Feather name="chevron-left" size={26} color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} />
                </TouchableOpacity>
            ),
            headerStyle: { backgroundColor: 'white' },
        });
    }, [navigation, route.params.onCloseChat]);

    // --- Image Update Logic ---
    const pickAndUpdateImage = async () => {
         if (!(isCurrentUserAdmin || groupDetails?.can_members_edit_info) || processingAction) return;
         try {
             const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permResult.granted) { Alert.alert("Permission Denied"); return; }
             let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: Platform.OS === 'web' });
             if (result.canceled || !result.assets || !result.assets[0].uri || !groupId) return;
             const imageUri = result.assets[0].uri; setProcessingAction('update_image'); let uploadedImageUrl: string | null = null;
             try {
                 let blob: Blob; let contentType: string;
                 if (Platform.OS === 'web' && result.assets[0].base64) { const base64=result.assets[0].base64;const bs=atob(base64);const ab=new ArrayBuffer(bs.length);const ia=new Uint8Array(ab);for(let i=0;i<bs.length;i++){ia[i]=bs.charCodeAt(i);} const mime=imageUri.match(/data:(.*?);base64/)?.[1]||'image/jpeg';blob=new Blob([ab],{type:mime});contentType=mime;}
                 else { const r=await fetch(imageUri); if(!r.ok)throw new Error(`Fetch failed: ${r.statusText}`);blob=await r.blob();contentType=blob.type;}
                 if (!blob) throw new Error('Blob creation failed.');
                 const fileExt = contentType.split('/')?.[1]||'jpg'; const path=`${groupId}/avatar.${Date.now()}.${fileExt}`;
                 const { data: uData, error: uError } = await supabase.storage.from('group-avatars').upload(path, blob, { upsert: true, contentType: contentType });
                 if (uError) throw new Error(`Storage Upload Error: ${uError.message}`); if (!uData?.path) throw new Error("Upload failed path.");
                 const { data: urlD } = supabase.storage.from('group-avatars').getPublicUrl(uData.path); uploadedImageUrl=urlD.publicUrl; if(!uploadedImageUrl) throw new Error("Failed URL.");
                 const { data: rpcRes, error: rpcErr } = await supabase.rpc('update_group_image', { group_id_input: groupId, image_url: uploadedImageUrl }); if (rpcErr) throw rpcErr; if (rpcRes === false) throw new Error("Update failed permission?");
                 setGroupDetails(prev => prev ? { ...prev, group_image: uploadedImageUrl } : null); Alert.alert("Success", "Group image updated.");
             } catch (err: any) { console.error("Error updating group image:", err); Alert.alert("Error", `Update fail: ${err.message}`); }
             finally { setProcessingAction(null); }
         } catch (pickerErr: any) { console.error("Picker error:", pickerErr); Alert.alert("Error", `Picker fail: ${pickerErr.message}`); }
     };

    // --- Real-time Subscriptions ---
    useEffect(() => { if(!groupId)return; const c=supabase.channel(`group_info_details_${groupId}`).on<GroupDetails>('postgres_changes',{event:'UPDATE',schema:'public',table:'group_chats',filter:`id=eq.${groupId}`},(p)=>{setGroupDetails(pr=>({...pr,...p.new}as GroupDetails));if(p.new.group_name&&p.new.group_name!==groupDetails?.group_name){navigation.setOptions({title:p.new.group_name,headerBackVisible:true});}}).on<any>('postgres_changes',{event:'DELETE',schema:'public',table:'group_chats',filter:`id=eq.${groupId}`},(p)=>{Alert.alert("Group Deleted","This group no longer exists.",[{text:"OK",onPress:()=>navigation.popToTop()}]);}).subscribe((s,e)=>{if(s==='SUBSCRIBED')console.log(`Sub GroupDetails ${groupId}`);if(e)console.error(`Sub error GroupDetails ${groupId}:`,e);}); return()=>{supabase.removeChannel(c);}; }, [groupId, navigation, groupDetails?.group_name]);
    useEffect(() => { if(!groupId)return; const pc=supabase.channel(`group_participants_${groupId}`).on('postgres_changes',{event:'*',schema:'public',table:'group_chat_participants',filter:`group_id=eq.${groupId}`},(p)=>{fetchGroupInfo();}).subscribe((s,e)=>{if(s==='SUBSCRIBED')console.log(`Sub Participants ${groupId}`);if(e)console.error(`Sub error Participants ${groupId}:`,e);}); return()=>{supabase.removeChannel(pc);}; }, [groupId, fetchGroupInfo]);

    // --- Actions ---
    const handleLeaveGroup = () => { if(!groupId||processingAction)return; if(isCurrentUserAdmin){const oA=members.filter(m=>m.is_admin&&m.user_id!==currentUserId);if(oA.length===0){setShowTransferModal(true);return;}} Alert.alert("Leave Group","Sure?",[{text:"Cancel",style:"cancel"},{text:"Leave",style:"destructive",onPress:async()=>{setProcessingAction('leave');try{const{error}=await supabase.rpc('leave_group',{group_id_input:groupId});if(error)throw error;Alert.alert("Success","Left.");navigation.popToTop();}catch(e:any){Alert.alert("Error",`Leave fail: ${e.message}`);}finally{setProcessingAction(null);}}}]); };
    const handleDeleteGroup = () => { if(!groupId||!isCurrentUserAdmin||processingAction)return;const pD=async()=>{setProcessingAction('delete');try{const{error}=await supabase.rpc('delete_group',{group_id_input:groupId});if(error)throw error;Alert.alert('Success','Deleted.');navigation.popToTop();}catch(e:any){Alert.alert('Error',`Delete fail: ${e.message}`);}finally{setProcessingAction(null);}};if(Platform.OS==='web'){if(window.confirm('Delete?'))pD();}else{Alert.alert('Delete Group','Permanently delete?',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:pD}]);} };
    const handleRemoveMember = (memberId: string, memberName: string) => { if (!groupId||!isCurrentUserAdmin||processingAction||memberId===currentUserId)return;const pR=async()=>{setProcessingAction(`remove_${memberId}`);try{const{error}=await supabase.rpc('remove_group_member',{group_id_input:groupId,member_to_remove_id:memberId});if(error)throw error;Alert.alert("Success",`${memberName} removed.`);fetchGroupInfo();}catch(e:any){Alert.alert("Error",`Remove fail: ${e.message}`);}finally{setProcessingAction(null);}};if(Platform.OS==='web'){if(window.confirm(`Remove ${memberName}?`))pR();}else{Alert.alert("Remove Member",`Remove ${memberName}?`,[{text:"Cancel",style:"cancel"},{text:"Remove",style:"destructive",onPress:pR}]);} };
    const handleSetAdminStatus = (memberId: string, memberName: string, makeAdmin: boolean) => { if (!groupId||!isCurrentUserAdmin||processingAction||memberId===currentUserId)return;const a=makeAdmin?"promote":"demote";const aT=makeAdmin?"Make Admin":"Remove Admin";const pAC=async()=>{setProcessingAction(`admin_${memberId}`);try{const{error}=await supabase.rpc('set_group_admin_status',{group_id_input:groupId,member_id:memberId,is_admin_status:makeAdmin});if(error)throw error;Alert.alert("Success",`Admin status updated.`);fetchGroupInfo();}catch(e:any){Alert.alert("Error",`Update fail: ${e.message}`);}finally{setProcessingAction(null);}};if(Platform.OS==='web'){if(window.confirm(`Sure ${a} ${memberName}?`))pAC();}else{Alert.alert(aT,`Sure ${a} ${memberName}?`,[{text:"Cancel",style:"cancel"},{text:aT,style:makeAdmin?"default":"destructive",onPress:pAC}]);} };
    const handleToggleAddPermission = async (newValue: boolean) => { if(!groupId||!isCurrentUserAdmin||processingAction)return;setProcessingAction('toggle_permission');try{const{error}=await supabase.rpc('set_group_add_permission',{group_id_input:groupId,allow_members_to_add:newValue});if(error)throw error;setGroupDetails(p=>p?{...p,can_members_add_others:newValue}:null);Alert.alert("Success","Permission updated.");}catch(e:any){Alert.alert("Error",`Update fail: ${e.message}`);setGroupDetails(p=>p?{...p,can_members_add_others:!newValue}:null);}finally{setProcessingAction(null);}};
    const handleToggleEditPermission = async (newValue: boolean) => { if (!groupId||!isCurrentUserAdmin||processingAction||!groupDetails)return;const oV=groupDetails.can_members_edit_info;setProcessingAction('toggle_edit_permission');setGroupDetails(p=>p?{...p,can_members_edit_info:newValue}:null);try{const{error}=await supabase.rpc('set_group_edit_permission',{group_id_input:groupId,allow_members_to_edit:newValue});if(error)throw error;Alert.alert("Success","Edit permission updated.");}catch(e:any){Alert.alert("Error",`Update fail: ${e.message}`);setGroupDetails(p=>p?{...p,can_members_edit_info:oV}:null);}finally{setProcessingAction(null);}};
    const confirmTransferAndLeave = async () => { if(!groupId||!transferAdminId)return;setShowTransferModal(false);setProcessingAction('leave');try{const{error:pE}=await supabase.rpc('set_group_admin_status',{group_id_input:groupId,member_id:transferAdminId,is_admin_status:true});if(pE)throw pE;const{error:lE}=await supabase.rpc('leave_group',{group_id_input:groupId});if(lE)throw lE;Alert.alert("Success","Transferred/Left.");navigation.popToTop();}catch(e:any){Alert.alert("Error",`Failed: ${e.message}`);}finally{setProcessingAction(null);setTransferAdminId(null);}};

    // --- Render Member Item ---
    const renderMemberItem = ({ item }: { item: GroupMember }) => {
        const name = `${item.profile.first_name || ''} ${item.profile.last_name || ''}`.trim() || item.profile.username || `User (${item.user_id.substring(0,4)})`; const isSelf = item.user_id === currentUserId; const handlePressMember = () => { 
            if (!isSelf) { 
                // Check if we're in web chat panel mode and use appropriate navigation
                if (Platform.OS === 'web' && route.params.onCloseChat) {
                    (navigation as any).navigate('OtherUserProfile', { userId: item.user_id });
                } else {
                    navigation.push('OtherUserProfileScreen', { userId: item.user_id }); 
                }
            } 
        };
        return ( <TouchableOpacity style={styles.memberItem} onPress={handlePressMember} disabled={isSelf} activeOpacity={isSelf ? 1 : 0.7}><RNImage source={{ uri: item.profile.profile_picture ?? DEFAULT_PROFILE_PIC }} style={styles.memberAvatar} /><View style={styles.memberInfo}><Text style={styles.memberName}>{name} {isSelf ? '(You)' : ''}</Text>{item.is_admin && <Text style={styles.adminBadge}>Admin</Text>}</View>{isCurrentUserAdmin && !isSelf && ( <View style={styles.memberActions}><TouchableOpacity style={styles.actionButton} onPress={() => { handleSetAdminStatus(item.user_id, name, !item.is_admin); }}><Feather name={item.is_admin ? "arrow-down-circle" : "arrow-up-circle"} size={20} color={item.is_admin ? "#F59E0B" : "#10B981"} /></TouchableOpacity><TouchableOpacity style={styles.actionButton} onPress={() => { handleRemoveMember(item.user_id, name); }}><Feather name="x-circle" size={20} color="#EF4444" /></TouchableOpacity></View> )}{processingAction === `remove_${item.user_id}` || processingAction === `admin_${item.user_id}` ? ( <ActivityIndicator size="small" color="#6B7280" style={styles.memberProcessingIndicator}/> ) : null}</TouchableOpacity> );
    };

    // --- Render Media Item ---
    const renderMediaItem = ({ item }: { item: MediaMessage }) => (
        <TouchableOpacity 
            style={styles.mediaItemContainer} 
            onPress={() => {
                if (item.imageUrl) {
                    setSelectedImage(item.imageUrl);
                    setImageViewerVisible(true);
                }
            }}
        >
            {item.imageUrl ? (
                <RNImage 
                    source={{ uri: item.imageUrl }} 
                    style={styles.mediaThumbnail} 
                    resizeMode="cover"
                />
            ) : (
                <View style={[styles.mediaThumbnail, styles.mediaThumbnailPlaceholder]}>
                    <Feather name="image" size={20} color="#9CA3AF"/>
                </View>
            )}
        </TouchableOpacity>
    );

    // Update the image press handler
    const handleImagePress = (imageUrl: string) => {
        const index = mediaMessages.findIndex(msg => msg.imageUrl === imageUrl);
        if (index !== -1) {
            setSelectedImageIndex(index);
            setSelectedImage(imageUrl);
            setImageViewerVisible(true);
        }
    };

    // Add handler for image index change
    const handleImageIndexChange = (index: number) => {
        setSelectedImageIndex(index);
        setSelectedImage(mediaMessages[index].imageUrl);
    };

    // --- Main Render ---
    if (isLoading) { return <View style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} /></View>; }
    if (error) { return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>; }
    if (!groupDetails) { return <View style={styles.centered}><Text style={styles.errorText}>Group not found.</Text></View>; }

    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
                {/* Group Header */}
                <View style={styles.headerContainer}>
                    <TouchableOpacity onPress={pickAndUpdateImage} disabled={!(isCurrentUserAdmin || groupDetails.can_members_edit_info) || !!processingAction}>
                        <RNImage source={{ uri: groupDetails.group_image ?? DEFAULT_GROUP_PIC }} style={styles.groupAvatar} />
                         {(isCurrentUserAdmin || groupDetails.can_members_edit_info) && ( <View style={styles.cameraIconOverlay}><Feather name="camera" size={18} color="white" /></View> )}
                          {processingAction === 'update_image' && <ActivityIndicator style={styles.imageLoadingIndicator} color="#FFF"/>}
                    </TouchableOpacity>
                    <Text style={styles.groupName}>{groupDetails.group_name}</Text>
                    <Text style={styles.memberCount}>{members.length} Member{members.length !== 1 ? 's' : ''}</Text>
                </View>

                 {/* Add Members Button */}
                 <TouchableOpacity style={styles.actionRow} onPress={() => {
                     // Check if we're in web chat panel mode and use appropriate navigation
                     if (Platform.OS === 'web' && route.params.onCloseChat) {
                         (navigation as any).navigate('AddGroupMembers', { 
                             groupId, 
                             groupName: groupDetails.group_name,
                             cameFromGroupInfo: true // Mark that we came from GroupInfoScreen
                         });
                     } else {
                         navigation.navigate('AddGroupMembersScreen', { 
                             groupId, 
                             groupName: groupDetails.group_name,
                             cameFromGroupInfo: true // Mark that we came from GroupInfoScreen
                         });
                     }
                 }} disabled={!isCurrentUserAdmin && !groupDetails.can_members_add_others} >
                     <Feather name="user-plus" size={22} color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'} style={styles.actionIcon} />
                     <Text style={styles.actionText}>Add Members</Text>
                     <Feather name="chevron-right" size={20} color="#9CA3AF" />
                 </TouchableOpacity>

                {/* Admin Settings */}
                {isCurrentUserAdmin && (
                    <View style={styles.settingsSection}>
                        <Text style={styles.sectionHeader}>Admin Settings</Text>
                        {/* Add Members Toggle */}
                        <View style={[styles.actionRow, styles.switchRow]}>
                             <Feather name="users" size={22} color="#6B7280" style={styles.actionIcon} /><Text style={[styles.actionText, styles.switchLabel]}>Allow members to add others</Text>
                            <Switch trackColor={{ false: "#E5E7EB", true: "#A5B4FC" }} thumbColor={groupDetails.can_members_add_others ? (APP_CONSTANTS.COLORS.PRIMARY || '#3B82F6') : "#f4f3f4"} ios_backgroundColor="#E5E7EB" onValueChange={handleToggleAddPermission} value={groupDetails.can_members_add_others} disabled={!!processingAction} />
                             {processingAction === 'toggle_permission' && <ActivityIndicator size="small" style={{marginLeft: 5}}/>}
                        </View>
                        {/* Edit Info Toggle */}
                        <View style={[styles.actionRow, styles.switchRow]}>
                            <Feather name="edit" size={22} color="#6B7280" style={styles.actionIcon} /><Text style={[styles.actionText, styles.switchLabel]}>Allow members to edit info</Text>
                           <Switch trackColor={{ false: "#E5E7EB", true: "#A5B4FC" }} thumbColor={groupDetails.can_members_edit_info ? (APP_CONSTANTS.COLORS.PRIMARY || '#3B82F6') : "#f4f3f4"} ios_backgroundColor="#E5E7EB" onValueChange={handleToggleEditPermission} value={groupDetails.can_members_edit_info} disabled={!!processingAction} />
                            {processingAction === 'toggle_edit_permission' && <ActivityIndicator size="small" style={{marginLeft: 5}}/>}
                       </View>
                    </View>
                )}

                {/* Members List */}
                <View style={styles.membersSection}>
                    <Text style={styles.sectionHeader}>Members</Text>
                    <FlatList data={members} renderItem={renderMemberItem} keyExtractor={(item) => item.user_id} scrollEnabled={false} ItemSeparatorComponent={() => <View style={styles.separator} />} />
                </View>

                {/* Danger Zone */}
                <View style={styles.dangerZone}>
                    <TouchableOpacity style={[styles.actionRow, styles.dangerActionRow]} onPress={handleLeaveGroup} disabled={!!processingAction} >
                        <Feather name="log-out" size={22} color="#EF4444" style={styles.actionIcon} />
                        <Text style={[styles.actionText, styles.dangerActionText]}>Leave Group</Text>
                        {processingAction === 'leave' && <ActivityIndicator size="small" color="#EF4444" style={styles.actionSpinner}/>}
                    </TouchableOpacity>
                    {(isCurrentUserAdmin) && (
                        <TouchableOpacity style={[styles.actionRow, styles.dangerActionRow]} onPress={handleDeleteGroup} disabled={!!processingAction} >
                            <Feather name="trash-2" size={22} color="#EF4444" style={styles.actionIcon} />
                            <Text style={[styles.actionText, styles.dangerActionText]}>Delete Group</Text>
                            {processingAction === 'delete' && <ActivityIndicator size="small" color="#EF4444" style={styles.actionSpinner}/>}
                        </TouchableOpacity>
                    )}
                </View>

                {/* Media Section */}
                <View style={styles.mediaSection}>
                    <Text style={styles.sectionHeader}>Shared Media</Text>
                    {loadingMedia ? (
                        <ActivityIndicator style={{ marginVertical: 20 }} color={APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6'}/>
                    ) : mediaMessages.length > 0 ? (
                        <View style={styles.mediaGrid}>
                            {mediaMessages.map((item) => (
                                <TouchableOpacity 
                                    key={item.id}
                                    style={styles.mediaGridItem}
                                    onPress={() => handleImagePress(item.imageUrl!)}
                                >
                                    <RNImage 
                                        source={{ uri: item.imageUrl || '' }} 
                                        style={styles.mediaGridImage} 
                                        resizeMode="cover"
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.noMediaText}>No photos or videos shared yet.</Text>
                    )}
                </View>

                {/* Transfer Modal */}
                <Modal visible={showTransferModal} transparent animationType="fade">
                    {/* *** CORRECTED MODAL STRUCTURE *** */}
                    <Pressable style={styles.modalOverlay} onPress={()=>setShowTransferModal(false)}>
                        <Pressable style={styles.modalContent} onPress={() => {}}> {/* Prevent closing on modal content press */}
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
                         {/* Closing </Pressable> for modalContent was here */}
                    </Pressable>
                    {/* *** The </View> was here - REMOVED *** */}
                </Modal>

                {imageViewerVisible && (
                    <ImageViewer
                        imageUrls={mediaMessages.map(msg => ({ url: msg.imageUrl! }))}
                        index={selectedImageIndex}
                        onClick={() => setImageViewerVisible(false)}
                        onSwipeDown={() => setImageViewerVisible(false)}
                        enableSwipeDown={true}
                        enableImageZoom={true}
                        onChange={(index) => {
                            if (typeof index === 'number') {
                                setSelectedImageIndex(index);
                            }
                        }}
                    />
                )}

            </ScrollView>
        </SafeAreaView>
    );
};


// --- Styles --- (Includes additions/modifications for Media Section)
const styles = StyleSheet.create({
    // ... include ALL previous styles ...
     safeArea: { flex: 1, backgroundColor: '#F9FAFB', },
     container: { flex: 1, },
     centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
     errorText: { color: '#DC2626', textAlign: 'center', fontSize: 16, },
     headerContainer: { alignItems: 'center', paddingVertical: 24, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 16, },
     groupAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#E5E7EB', marginBottom: 12, position: 'relative', },
     cameraIconOverlay: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0, 0, 0, 0.6)', padding: 6, borderRadius: 15, },
     imageLoadingIndicator: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: 50, justifyContent:'center', alignItems:'center'},
     groupName: { fontSize: 22, fontWeight: '600', color: '#1F2937', marginBottom: 4, },
     memberCount: { fontSize: 14, color: '#6B7280', },
     actionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB', minHeight: 50, },
     actionIcon: { marginRight: 16, width: 24, alignItems: 'center' },
     actionText: { flex: 1, fontSize: 16, color: '#1F2937', },
     sectionHeader: { paddingHorizontal: 16, paddingVertical: 8, paddingTop: 16, fontSize: 13, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, backgroundColor: '#F9FAFB', },
     settingsSection: { marginBottom: 8, backgroundColor: 'white', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', },
     switchRow: { justifyContent: 'space-between', },
     switchLabel: { flex: 0.8, },
     // --- Styles for Media Section ---
     mediaSection: {
         backgroundColor: 'white',
         borderTopWidth: StyleSheet.hairlineWidth,
         borderBottomWidth: StyleSheet.hairlineWidth,
         borderColor: '#E5E7EB',
         marginTop: 16,
         marginBottom: 16,
         padding: 16,
     },
     mediaGrid: {
         flexDirection: 'row',
         flexWrap: 'wrap',
         marginHorizontal: -4,
     },
     mediaGridItem: {
         width: '33.33%',
         padding: 4,
     },
     mediaGridImage: {
         width: '100%',
         aspectRatio: 1,
         borderRadius: 8,
         backgroundColor: '#F3F4F6',
     },
     mediaItemContainer: {
         marginRight: 10,
         borderRadius: 8,
         overflow: 'hidden',
         borderWidth: 1,
         borderColor: '#E5E7EB'
     },
     mediaThumbnail: {
         width: 80,
         height: 80,
         backgroundColor: '#F3F4F6',
         borderRadius: 7,
     },
     mediaThumbnailPlaceholder: {
         justifyContent: 'center',
         alignItems: 'center',
     },
     noMediaText: {
         textAlign: 'center',
         color: '#9CA3AF',
         fontStyle: 'italic',
         marginVertical: 20,
         paddingHorizontal: 16,
     },
     // --- End Media Section Styles ---
     membersSection: { backgroundColor: 'white', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB', marginBottom: 16, },
     memberItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, },
     memberAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: '#E5E7EB', },
     memberInfo: { flex: 1, justifyContent: 'center', },
     memberName: { fontSize: 15, fontWeight: '500', color: '#1F2937', },
     adminBadge: { fontSize: 11, fontWeight: '600', color: APP_CONSTANTS?.COLORS?.PRIMARY || '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: 'hidden', alignSelf: 'flex-start', marginTop: 2, },
     memberActions: { flexDirection: 'row', alignItems: 'center', },
     actionButton: { padding: 6, marginLeft: 8, justifyContent: 'center', alignItems: 'center'},
     memberProcessingIndicator: { marginLeft: 10, },
     separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E7EB', marginLeft: 68, },
     dangerZone: { marginTop: 16, marginBottom: 0, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: 'white', },
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
});

export default GroupInfoScreen;