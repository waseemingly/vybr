import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Switch,
    Alert,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// --- ADJUST PATHS ---
import { useAuth } from '../hooks/useAuth';
import { useUserGuide } from '../hooks/useUserGuide';
import { APP_CONSTANTS } from '../config/constants';
import { supabase } from '../lib/supabase';
// --------------------

// Define Param List if navigating further *within* user settings
type UserSettingsStackParamList = {
    UserSettingsHome: undefined;
    EditUserProfile: undefined; // Example
    EditMusicPrefs: undefined; // Example
    UserManageSubscription: undefined; // Example
    ManagePlan: undefined;
    UserBlockedList: undefined; // Example
    UserMutedList: undefined; // Example
    LinkMusicServicesScreen: undefined; // <-- Add new screen route
    UserBillingHistoryScreen: undefined; // <-- Add Billing History screen route
    UpdateMusicFavoritesScreen: undefined; // <-- Add Update Music Favorites screen route
    // ... other user settings sub-screens
};

type UserSettingsScreenNavigationProp = NativeStackNavigationProp<UserSettingsStackParamList, 'UserSettingsHome'>;

// --- Reusable Components (Consider moving to a common components folder) ---

interface SettingsSectionProps {
    title: string;
    children: React.ReactNode;
    isPremiumFeature?: boolean;
    isPremiumUser?: boolean;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ title, children, isPremiumFeature = false, isPremiumUser = false }) => (
    <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
             <Text style={styles.sectionTitle}>{title}</Text>
             {isPremiumFeature && (
                <View style={[styles.premiumBadgePill, !isPremiumUser && styles.premiumBadgeLocked]}>
                    <Feather name="award" size={10} color={isPremiumUser ? "#FFD700" : "#A0A0A0"} />
                    <Text style={[styles.premiumTextPill, !isPremiumUser && styles.premiumTextLocked]}>
                        {isPremiumUser ? 'Premium' : 'Locked'}
                    </Text>
                </View>
             )}
        </View>
        {children}
    </View>
);

interface SettingsItemProps {
    label: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    value?: string;
    onPress?: () => void;
    toggleValue?: boolean;
    onToggleChange?: (newValue: boolean) => Promise<void>; // Make async for DB update
    isDestructive?: boolean;
    disabled?: boolean;
    isUpdating?: boolean; // Show loader for toggle
}

const SettingsItem: React.FC<SettingsItemProps> = ({
    label, icon, value, onPress, toggleValue, onToggleChange, isDestructive = false, disabled = false, isUpdating = false
}) => {
    const hasToggle = typeof toggleValue === 'boolean' && typeof onToggleChange === 'function';
    const canPress = !!onPress && !disabled && !hasToggle; // Don't allow press if it's a toggle

    return (
        <TouchableOpacity
            style={[styles.itemContainer, (disabled || isUpdating) && styles.itemDisabled]}
            onPress={canPress ? onPress : undefined}
            activeOpacity={canPress ? 0.7 : 1.0}
            disabled={disabled || isUpdating || !canPress && !hasToggle}
        >
            <Feather
                name={icon}
                size={20}
                color={isDestructive ? APP_CONSTANTS.COLORS.ERROR : (disabled || isUpdating ? '#CBD5E1' : '#6B7280')}
                style={styles.itemIcon}
            />
            <Text style={[
                styles.itemLabel,
                isDestructive && styles.itemLabelDestructive,
                (disabled || isUpdating) && styles.itemLabelDisabled,
            ]}>
                {label}
            </Text>
            {value && !hasToggle && <Text style={styles.itemValue}>{value}</Text>}
            {hasToggle && (
                isUpdating ? (
                    <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} style={styles.toggleLoader} />
                 ) : (
                    <Switch
                        trackColor={{ false: "#E5E7EB", true: APP_CONSTANTS.COLORS.PRIMARY_LIGHT }}
                        thumbColor={toggleValue ? APP_CONSTANTS.COLORS.PRIMARY : "#f4f3f4"}
                        ios_backgroundColor="#E5E7EB"
                        onValueChange={onToggleChange} // Directly call the async handler
                        value={toggleValue}
                        disabled={disabled || isUpdating}
                    />
                )
            )}
            {canPress && !hasToggle && (
                <Feather name="chevron-right" size={20} color={(disabled || isUpdating) ? '#CBD5E1' : '#9CA3AF'} />
            )}
        </TouchableOpacity>
    );
};


// --- Main User Settings Screen ---

const UserSettingsScreen: React.FC = () => {
    const navigation = useNavigation<UserSettingsScreenNavigationProp>();
    const { session, logout, loading: authLoading, musicLoverProfile } = useAuth(); // Use ML profile
    const { replay: replayTour } = useUserGuide();

    // State for notification toggles
    const [notifications, setNotifications] = useState<{
        notify_event_updates: boolean | null;
        notify_friend_requests: boolean | null;
        notify_new_messages: boolean | null;
        notify_new_matches: boolean | null; // Add new matches notification setting
    }> ({
        notify_event_updates: null, // Initialize as null to indicate loading/not fetched
        notify_friend_requests: null,
        notify_new_messages: null,
        notify_new_matches: null, // Add new matches notification setting
    });
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [updatingSetting, setUpdatingSetting] = useState<string | null>(null); // Track which toggle is updating
    const [isDeleting, setIsDeleting] = useState(false); // Add deleting state

    // State for music data sharing preference (Temporarily disabled until DB schema update)
    // const [showMusicProfile, setShowMusicProfile] = useState<boolean | null>(null); 

    const userId = session?.user?.id;
    const isPremiumUser = musicLoverProfile?.isPremium ?? false;

    // Fetch current settings on mount
    useEffect(() => {
        const fetchSettings = async () => {
            if (!userId) return;
            setLoadingSettings(true);
            try {
                const { data, error } = await supabase
                    .from('music_lover_profiles')
                    // Add notify_new_matches to the select query
                    .select('notify_event_updates, notify_friend_requests, notify_new_messages, notify_new_matches') 
                    .eq('user_id', userId)
                    .single();

                if (error) throw error;

                if (data) {
                    setNotifications({
                        notify_event_updates: data.notify_event_updates ?? true, 
                        notify_friend_requests: data.notify_friend_requests ?? true, 
                        notify_new_messages: data.notify_new_messages ?? true, 
                        notify_new_matches: data.notify_new_matches ?? true, // Add new matches with default true
                    });
                    // setShowMusicProfile(data.show_music_profile ?? true); // Temporarily disabled
                } else {
                    // Handle case where data is unexpectedly null (though .single() should prevent this)
                    Alert.alert("Error", "Could not load your settings profile.");
                    // Set defaults or indicate error state
                     setNotifications({
                        notify_event_updates: true,
                        notify_friend_requests: true,
                        notify_new_messages: true,
                        notify_new_matches: true, // Add new matches with default true
                    });
                    // setShowMusicProfile(true); // Temporarily disabled
                }
            } catch (error: any) {
                console.error("Error fetching user settings:", error);
                Alert.alert("Error", "Could not load your current settings.");
                 // Set defaults or indicate error state on catch
                 setNotifications({
                    notify_event_updates: true,
                    notify_friend_requests: true,
                    notify_new_messages: true,
                    notify_new_matches: true, // Add new matches with default true
                });
                // setShowMusicProfile(true); // Temporarily disabled
            } finally {
                setLoadingSettings(false);
            }
        };

        fetchSettings();
    }, [userId]);

    // Handle toggle changes and update DB
    const handleToggle = async (key: keyof Omit<typeof notifications, 'show_music_profile'>, value: boolean) => {
        if (!userId || updatingSetting || notifications[key] === null) return; // Don't update if initial value is null

        const previousValue = notifications[key];
        // Optimistically update UI
        setNotifications(prev => ({ ...prev, [key]: value }));
        setUpdatingSetting(key); // Set loading state for this specific toggle

        try {
            const { error } = await supabase
                .from('music_lover_profiles')
                .update({ [key]: value }) // Use computed property name
                .eq('user_id', userId);

            if (error) {
                throw error;
            }
            console.log(`Setting ${key} updated successfully to ${value}`);
            // Keep optimistic UI state

        } catch (error: any) {
            console.error(`Error updating setting ${key}:`, error);
            Alert.alert("Update Failed", `Could not save preference for ${key}. Please try again.`);
            // Revert UI on error
            setNotifications(prev => ({ ...prev, [key]: previousValue }));
        } finally {
             setUpdatingSetting(null); // Clear loading state for this toggle
        }
    };

    // Handle music profile visibility toggle (Temporarily disabled)
    /*
    const handleMusicProfileToggle = async (value: boolean) => {
        if (!userId || updatingSetting) return; // Simplified check
        setUpdatingSetting('show_music_profile');
        try {
             const { error } = await supabase
                .from('music_lover_profiles')
                .update({ show_music_profile: value })
                .eq('user_id', userId);
            if (error) throw error;
            console.log(`Setting show_music_profile updated successfully to ${value}`);
        } catch (error: any) {
            console.error(`Error updating setting show_music_profile:`, error);
            Alert.alert("Update Failed", `Could not save music profile visibility preference. Please try again.`);
        } finally {
            setUpdatingSetting(null);
        }
    };
    */

    // Placeholder Actions
    const handleLogout = async () => { await logout(); };
    const handleDownloadData = () => { /* ... */ };
    const handleLogoutAllDevices = async () => { /* ... */ };

    // --- Delete Account Handler ---
    const handleDeleteAccount = () => {
        if (!userId) return;

        const confirmDelete = async () => {
            setIsDeleting(true);
            try {
                console.log("[UserSettingsScreen] Starting account deletion process...", {
                    platform: Platform.OS,
                    userId,
                    isWeb: Platform.OS === 'web'
                });
                
                // 1. Delete the user's auth account using Edge function (must be done while still authenticated)
                console.log("Invoking Supabase Edge function 'delete-user-account'...");
                
                // Add request body logging - some functions might expect user_id or other params
                const requestBody = { user_id: userId };
                console.log("[UserSettingsScreen] Request body:", requestBody);
                
                const { data, error: functionError } = await supabase.functions.invoke('delete-user-account', {
                    body: requestBody
                });
                
                console.log("[UserSettingsScreen] Edge function delete-user-account response:", {
                    data,
                    error: functionError,
                    platform: Platform.OS,
                    userId
                });
                
                if (functionError) {
                    // Enhanced error logging to capture all possible error details
                    console.error("[UserSettingsScreen] Error calling delete function:", {
                        error: functionError,
                        errorMessage: functionError.message,
                        errorName: functionError.name,
                        errorStack: functionError.stack,
                        errorContext: (functionError as any).context,
                        platform: Platform.OS,
                        userId
                    });
                    
                    // Try to extract more specific error information
                    let errorMessage = functionError.message || 'Unknown function error';
                    
                    // Check if there's additional context in the error
                    if ((functionError as any).context?.body) {
                        const contextBody = (functionError as any).context.body;
                        console.error("[UserSettingsScreen] Function error context body:", contextBody);
                        if (typeof contextBody === 'string') {
                            try {
                                const parsedError = JSON.parse(contextBody);
                                errorMessage += ` - ${parsedError.error || parsedError.message || contextBody}`;
                            } catch {
                                errorMessage += ` - ${contextBody}`;
                            }
                        } else if (contextBody.error || contextBody.message) {
                            errorMessage += ` - ${contextBody.error || contextBody.message}`;
                        }
                    }
                    
                    throw new Error(`Failed to delete account: ${errorMessage}`);
                }

                // Check if the Edge function returned an error in the data
                if (data && typeof data === 'object' && (data as any).error) {
                    console.error("[UserSettingsScreen] Edge function returned error:", data);
                    throw new Error(`Account deletion failed: ${(data as any).error || (data as any).message || 'Unknown error from deletion function'}`);
                }

                // Log successful response for debugging
                console.log("[UserSettingsScreen] Account deletion successful", {
                    platform: Platform.OS,
                    userId,
                    functionResponse: data
                });

                // 2. Sign out after successful deletion
                const { error: signOutError } = await supabase.auth.signOut();
                if (signOutError) {
                    console.error("[UserSettingsScreen] Error signing out after deletion:", signOutError);
                    // Don't throw here, as the account is already deleted
                }

                // 3. Force logout to clear local state
                await logout();

            } catch (error: any) {
                console.error("[UserSettingsScreen] Error in account deletion process:", {
                    error,
                    errorMessage: error.message,
                    errorName: error.name,
                    errorStack: error.stack,
                    platform: Platform.OS,
                    userId
                });
                
                let userFriendlyMessage = error.message || 'Please try again later or contact support.';
                
                // Add specific guidance for common issues
                if (error.message?.includes('500') || error.message?.includes('Internal Server Error')) {
                    userFriendlyMessage += ' (Server error - this may be a temporary issue. Please try again in a few minutes.)';
                } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
                    userFriendlyMessage += ' (Network error - please check your connection and try again.)';
                }
                
                if (Platform.OS === 'web') {
                    window.alert(`Could not delete your account: ${userFriendlyMessage}`);
                } else {
                    Alert.alert(
                        "Deletion Failed", 
                        `Could not delete your account: ${userFriendlyMessage}`
                    );
                }
                setIsDeleting(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm("Are you absolutely sure? This action cannot be undone. All your data (profile, matches, chats, etc.) will be permanently deleted.")) {
                confirmDelete();
            }
        } else {
            Alert.alert(
                "Delete Account",
                "Are you absolutely sure? This action cannot be undone. All your data (profile, matches, chats, etc.) will be permanently deleted.",
                [
                    {
                        text: "Cancel",
                        style: "cancel"
                    },
                    {
                        text: "Delete My Account",
                        style: "destructive",
                        onPress: confirmDelete
                    }
                ]
            );
        }
    };
    // ---------------------------

    // --- Navigation Handlers ---
    const navigateToEditProfile = () => navigation.navigate('EditUserProfileScreen' as never); // Cast as never temporarily if types conflict
    const navigateToManageSubscription = () => {
        console.log('[DEBUG] Attempting to navigate to UserManageSubscriptionScreen');
        try {
            navigation.navigate('UserManageSubscriptionScreen' as never);
            console.log('[DEBUG] Navigation to UserManageSubscriptionScreen successful');
        } catch (error) {
            console.error('[DEBUG] Navigation error:', error);
        }
    };
    const navigateToManagePlan = () => navigation.navigate('ManagePlan' as never);
    const navigateToMutedList = () => navigation.navigate('UserMutedListScreen' as never);
    const navigateToBlockedList = () => navigation.navigate('UserBlockedListScreen' as never);
    const navigateToUpgrade = () => navigation.navigate('UpgradeScreen' as never);
    const navigateToLinkMusicServices = () => navigation.navigate('LinkMusicServicesScreen' as never);
    const navigateToBillingHistory = () => navigation.navigate('UserBillingHistoryScreen' as never); // <-- Add handler
    const navigateToUpdateMusicFavorites = () => navigation.navigate('UpdateMusicFavoritesScreen' as never); // Add new handler
    // -------------------------

    if (loadingSettings || authLoading) {
        return (
            <SafeAreaView style={styles.centeredLoader} edges={['top', 'bottom']}>
                <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
             <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="chevron-left" size={28} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                {/* Spacer */}
                <View style={{ width: 28 }} />
            </View>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
                <SettingsSection title="Profile Settings">
                    <SettingsItem label="Edit Profile" icon="edit-3" onPress={navigateToEditProfile} />
                    {/* COMMENTED OUT FOR SOFT LAUNCH */}
                    {/* <SettingsItem label="Change Profile Theme" icon="sun" onPress={() => Alert.alert("Theme", "TODO: Implement Theme Selection")} /> */}
                </SettingsSection>

                <SettingsSection title="Music Preferences">
                    <SettingsItem label="Update Favorites" icon="sliders" onPress={navigateToUpdateMusicFavorites} />
                    {/* COMMENTED OUT FOR SOFT LAUNCH */}
                    {/* <SettingsItem
                        label="Link Music Services"
                        icon="link"
                        value="Not available"
                        disabled
                    />
                    <SettingsItem
                        label="Show Music Profile to Friends"
                        icon="share-2"
                        value="(Coming Soon)"
                        disabled={true}
                    /> */}
                </SettingsSection>

                 <SettingsSection title="Privacy & Security">
                     {/* Temporarily remove value prop until counts are available */}
                     <SettingsItem label="Muted Users" icon="volume-x" onPress={navigateToMutedList} /* value={musicLoverProfile?.mutedUsersCount ? `${musicLoverProfile.mutedUsersCount} users` : "N/A"} */ />
                     <SettingsItem label="Blocked Users" icon="slash" onPress={navigateToBlockedList} /* value={musicLoverProfile?.blockedUsersCount ? `${musicLoverProfile.blockedUsersCount} users` : "N/A"} */ />
                     {/* COMMENTED OUT FOR SOFT LAUNCH */}
                     {/* <SettingsItem label="Active Sessions" icon="smartphone" onPress={() => Alert.alert("Not Implemented", "Listing sessions requires specific backend setup.")} value="Not available" disabled /> */}
                     {/* <SettingsItem label="Log Out Everywhere Else" icon="log-out" onPress={handleLogoutAllDevices} /> */}
                 </SettingsSection>

                {/* COMMENTED OUT FOR SOFT LAUNCH */}
                {/* <SettingsSection title="Notifications">
                    <SettingsItem label="New Matches" icon="heart" toggleValue={notifications.notify_new_matches ?? true} onToggleChange={(v) => handleToggle('notify_new_matches', v)} isUpdating={updatingSetting === 'notify_new_matches'} disabled={notifications.notify_new_matches === null}/>
                    <SettingsItem label="Event Updates & Invites" icon="calendar" toggleValue={notifications.notify_event_updates ?? true} onToggleChange={(v) => handleToggle('notify_event_updates', v)} isUpdating={updatingSetting === 'notify_event_updates'} disabled={notifications.notify_event_updates === null}/>
                    <SettingsItem label="Friend Requests / Followers" icon="user-plus" toggleValue={notifications.notify_friend_requests ?? true} onToggleChange={(v) => handleToggle('notify_friend_requests', v)} isUpdating={updatingSetting === 'notify_friend_requests'} disabled={notifications.notify_friend_requests === null}/>
                    <SettingsItem label="New Messages" icon="message-square" toggleValue={notifications.notify_new_messages ?? true} onToggleChange={(v) => handleToggle('notify_new_messages', v)} isUpdating={updatingSetting === 'notify_new_messages'} disabled={notifications.notify_new_messages === null}/>
                </SettingsSection> */}

                <SettingsSection title="Payment & Billing">
                    <SettingsItem 
                        label="Manage Payment Details" 
                        icon="credit-card" 
                        onPress={navigateToManagePlan} 
                        value={isPremiumUser ? "Premium account" : "Optional for free users"}
                    />
                    {/* COMMENTED OUT FOR SOFT LAUNCH */}
                    {/* <SettingsItem 
                        label="Billing History" 
                        icon="file-text" 
                        onPress={navigateToBillingHistory} 
                        value={isPremiumUser ? "View history" : "Not available"}
                        disabled={!isPremiumUser}
                    /> */}
                </SettingsSection>

                {isPremiumUser ? (
                     <SettingsSection title="Premium Subscription" isPremiumFeature isPremiumUser={isPremiumUser}>
                        {/* COMMENTED OUT FOR SOFT LAUNCH */}
                        {/* <SettingsItem
                            label="AI Radio"
                            icon="radio"
                            value="Coming soon"
                            disabled
                        /> */}
                        <SettingsItem label="Cancel Subscription" icon="x-circle" onPress={navigateToManageSubscription} />
                     </SettingsSection>
                 ) : (
                     <SettingsSection title="Upgrade to Premium">
                        <TouchableOpacity style={styles.upgradeButton} onPress={navigateToUpgrade}>
                            <Feather name="star" size={18} color="white" />
                            <Text style={styles.upgradeButtonText}>Unlock Premium Features</Text>
                        </TouchableOpacity>
                     </SettingsSection>
                 )}

                <SettingsSection title="Help">
                    <SettingsItem
                        label="Replay App Tour"
                        icon="help-circle"
                        onPress={async () => {
                            try {
                                await replayTour();
                                // Keep the user on this screen; the tour overlay will appear globally.
                            } catch (e: any) {
                                Alert.alert('Error', e?.message || 'Could not start the tour. Please try again.');
                            }
                        }}
                    />
                </SettingsSection>

                <SettingsSection title="Account Management">
                    {/* COMMENTED OUT FOR SOFT LAUNCH */}
                    {/* <SettingsItem label="Download My Data" icon="download" onPress={handleDownloadData} disabled={isDeleting} /> */}
                    <SettingsItem 
                        label="Delete Account" 
                        icon="trash-2" 
                        isDestructive 
                        onPress={handleDeleteAccount} 
                        disabled={!userId || isDeleting} // Disable if no user or deleting
                        isUpdating={isDeleting} // Show loader when deleting
                    />
                    <SettingsItem label="Log Out" icon="log-out" isDestructive onPress={handleLogout} disabled={isDeleting}/>
                </SettingsSection>
                <View style={{ height: 30 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

// --- Styles --- (Use the same styles defined previously for SettingsScreen)
const styles = StyleSheet.create({
    centeredLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
    container: { flex: 1, backgroundColor: '#F9FAFB', },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: { paddingBottom: 30 },
    sectionContainer: { marginTop: 12, backgroundColor: 'white', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E5E7EB', },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, },
    itemContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: 'white', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F3F4F6', minHeight: 50, },
    itemDisabled: { opacity: 0.6, },
    itemIcon: { marginRight: 16, width: 24, textAlign: 'center', },
    itemLabel: { flex: 1, fontSize: 16, color: '#1F2937', },
    itemLabelDestructive: { color: APP_CONSTANTS.COLORS.ERROR, },
    itemLabelDisabled: { color: '#9CA3AF', },
    itemValue: { fontSize: 15, color: '#6B7280', marginRight: 8, },
    toggleLoader: { marginRight: 10 }, // Style for loader replacing switch
    premiumBadgePill: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(59, 130, 246, 0.1)", paddingVertical: 3, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: "rgba(59, 130, 246, 0.3)", marginLeft: 8, },
    premiumBadgeLocked: { backgroundColor: "rgba(150, 150, 150, 0.1)", borderColor: "rgba(150, 150, 150, 0.3)", },
    premiumTextPill: { color: APP_CONSTANTS.COLORS.PRIMARY, fontSize: 9, fontWeight: "600", marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5, },
    premiumTextLocked: { color: '#A0A0A0', },
    upgradeButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#F59E0B", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, margin: 16, },
    upgradeButtonText: { color: "white", fontWeight: "600", fontSize: 16, marginLeft: 8, },
});

export default UserSettingsScreen;