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
import { useAuth } from '../../hooks/useAuth';
import { APP_CONSTANTS } from '../../config/constants';
import { supabase } from '../../lib/supabase';
// --------------------

// Define Param List if navigating further *within* organizer settings
type OrganizerSettingsStackParamList = {
    OrganizerSettingsHome: undefined;
    EditOrganizerProfileScreen: undefined; // Use actual screen name
    ManagePlanScreen: undefined;      // Use actual screen name
    OrgBillingHistoryScreen: undefined;   // Use actual screen name
    // ... other organizer settings sub-screens
};

type OrganizerSettingsScreenNavigationProp = NativeStackNavigationProp<OrganizerSettingsStackParamList, 'OrganizerSettingsHome'>;


// --- Reusable Components (Same as User Settings - Consider moving to common) ---

interface SettingsSectionProps { title: string; children: React.ReactNode; }

const SettingsSection: React.FC<SettingsSectionProps> = ({ title, children }) => (
    <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
             <Text style={styles.sectionTitle}>{title}</Text>
             {/* No premium badge concept here for now */}
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
    onToggleChange?: (newValue: boolean) => Promise<void>;
    isDestructive?: boolean;
    disabled?: boolean;
    isUpdating?: boolean;
}

const SettingsItem: React.FC<SettingsItemProps> = ({
    label, icon, value, onPress, toggleValue, onToggleChange, isDestructive = false, disabled = false, isUpdating = false
}) => {
    const hasToggle = typeof toggleValue === 'boolean' && typeof onToggleChange === 'function';
    const canPress = !!onPress && !disabled && !hasToggle;

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
            <Text style={[ styles.itemLabel, isDestructive && styles.itemLabelDestructive, (disabled || isUpdating) && styles.itemLabelDisabled ]}>
                {label}
            </Text>
            {value && !hasToggle && <Text style={styles.itemValue}>{value}</Text>}
            {hasToggle && (
                isUpdating ? (
                    <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} style={styles.toggleLoader}/>
                 ) : (
                    <Switch
                        trackColor={{ false: "#E5E7EB", true: APP_CONSTANTS.COLORS.PRIMARY_LIGHT }}
                        thumbColor={toggleValue ? APP_CONSTANTS.COLORS.PRIMARY : "#f4f3f4"}
                        ios_backgroundColor="#E5E7EB"
                        onValueChange={onToggleChange}
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


// --- Main Organizer Settings Screen ---

const OrganizerSettingsScreen: React.FC = () => {
    const navigation = useNavigation<OrganizerSettingsScreenNavigationProp>();
    const { session, logout, loading: authLoading, organizerProfile } = useAuth(); // Use Org profile

    // State for notification toggles - Initialize with null
    const [notifications, setNotifications] = useState<{
        notify_new_followers: boolean | null;
        notify_event_engagement: boolean | null;
        notify_app_updates: boolean | null;
    }> ({
        notify_new_followers: null,
        notify_event_engagement: null,
        notify_app_updates: null,
    });
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [updatingSetting, setUpdatingSetting] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false); // Add deleting state

    const userId = session?.user?.id;
    // const isPremiumOrganizer = organizerProfile?.isPremium ?? false; // Add premium logic if needed

    // Fetch current settings on mount
    useEffect(() => {
        const fetchSettings = async () => {
            if (!userId) return;
            setLoadingSettings(true);
            try {
                const { data, error } = await supabase
                    .from('organizer_profiles')
                    .select('notify_new_followers, notify_event_engagement, notify_app_updates')
                    .eq('user_id', userId)
                    .single();

                if (error) throw error;

                if (data) {
                    setNotifications({
                        notify_new_followers: data.notify_new_followers ?? true,
                        notify_event_engagement: data.notify_event_engagement ?? true,
                        notify_app_updates: data.notify_app_updates ?? true,
                    });
                } else {
                    // Handle case where data is unexpectedly null
                    Alert.alert("Error", "Could not load your organizer settings.");
                    setNotifications({ notify_new_followers: true, notify_event_engagement: true, notify_app_updates: true });
                }
            } catch (error: any) {
                console.error("Error fetching organizer settings:", error);
                Alert.alert("Error", "Could not load your current settings.");
                // Set defaults on catch
                setNotifications({ notify_new_followers: true, notify_event_engagement: true, notify_app_updates: true });
            } finally {
                setLoadingSettings(false);
            }
        };

        fetchSettings();
    }, [userId]);

    // Handle toggle changes and update DB
     const handleToggle = async (key: keyof typeof notifications, value: boolean) => {
        // Prevent update if initial value is null (still loading/fetch failed)
        if (!userId || updatingSetting || notifications[key] === null) return;

        const previousValue = notifications[key];
        setNotifications(prev => ({ ...prev, [key]: value }));
        setUpdatingSetting(key);

        try {
            const { error } = await supabase
                .from('organizer_profiles')
                .update({ [key]: value })
                .eq('user_id', userId);
            if (error) throw error;
            console.log(`Organizer setting ${key} updated successfully to ${value}`);
        } catch (error: any) {
            console.error(`Error updating organizer setting ${key}:`, error);
            Alert.alert("Update Failed", `Could not save preference for ${key}. Please try again.`);
            setNotifications(prev => ({ ...prev, [key]: previousValue }));
        } finally {
             setUpdatingSetting(null);
        }
    };

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
                console.log("[OrganizerSettingsScreen] Starting account deletion process...", {
                    platform: Platform.OS,
                    userId,
                    isWeb: Platform.OS === 'web'
                });
                
                // 1. Delete the user's auth account using Edge function (must be done while still authenticated)
                console.log("Invoking Supabase Edge function 'delete-user-account'...");
                const { data, error: functionError } = await supabase.functions.invoke('delete-user-account');
                
                console.log("[OrganizerSettingsScreen] Edge function delete-user-account response:", {
                    data,
                    error: functionError,
                    platform: Platform.OS,
                    userId
                });
                
                if (functionError) {
                    console.error("[OrganizerSettingsScreen] Error calling delete function:", {
                        error: functionError,
                        platform: Platform.OS,
                        userId
                    });
                    throw new Error(`Failed to delete account: ${functionError.message}`);
                }

                // Check if the Edge function returned an error in the data
                if (data && typeof data === 'object' && data.error) {
                    console.error("[OrganizerSettingsScreen] Edge function returned error:", data);
                    throw new Error(`Account deletion failed: ${data.error || data.message || 'Unknown error from deletion function'}`);
                }

                console.log("[OrganizerSettingsScreen] Account deletion successful", {
                    platform: Platform.OS,
                    userId,
                    functionResponse: data
                });

                // 2. Sign out after successful deletion
                const { error: signOutError } = await supabase.auth.signOut();
                if (signOutError) {
                    console.error("[OrganizerSettingsScreen] Error signing out after deletion:", signOutError);
                    // Don't throw here, as the account is already deleted
                }

                // 3. Force logout to clear local state
                await logout();

            } catch (error: any) {
                console.error("[OrganizerSettingsScreen] Error in account deletion process:", {
                    error,
                    platform: Platform.OS,
                    userId
                });
                if (Platform.OS === 'web') {
                    window.alert(`Could not delete your account: ${error.message || 'Please try again later or contact support.'}`);
                } else {
                    Alert.alert(
                        "Deletion Failed", 
                        `Could not delete your account: ${error.message || 'Please try again later or contact support.'}`
                    );
                }
                setIsDeleting(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm("Are you absolutely sure? This action cannot be undone. All your organizer data (profile, events, etc.) will be permanently deleted.")) {
                confirmDelete();
            }
        } else {
            Alert.alert(
                "Delete Account",
                "Are you absolutely sure? This action cannot be undone. All your organizer data (profile, events, etc.) will be permanently deleted.",
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
    const navigateToEditProfile = () => navigation.navigate('EditOrganizerProfileScreen');
    const navigateToManagePlan = () => navigation.navigate('ManagePlanScreen');
    const navigateToBillingHistory = () => navigation.navigate('OrgBillingHistoryScreen');
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
                {/* Account Section */}
                <SettingsSection title="Account">
                    <SettingsItem
                        label="Edit Profile"
                        icon="user"
                        onPress={navigateToEditProfile}
                        disabled={authLoading}
                    />
                    <SettingsItem
                        label="Manage Plan"
                        icon="credit-card"
                        onPress={navigateToManagePlan}
                        disabled={authLoading}
                    />
                     <SettingsItem
                        label="Billing History"
                        icon="clock"
                        onPress={navigateToBillingHistory}
                        disabled={authLoading}
                    />
                </SettingsSection>

                {/* Notifications Section */}
                <SettingsSection title="Notifications">
                    {loadingSettings ? (
                        <ActivityIndicator style={{ marginVertical: 20 }} color={APP_CONSTANTS.COLORS.PRIMARY}/>
                    ) : (
                        <>
                            <SettingsItem
                                label="New Followers"
                                icon="user-plus"
                                toggleValue={notifications.notify_new_followers ?? false}
                                onToggleChange={(val) => handleToggle('notify_new_followers', val)}
                                isUpdating={updatingSetting === 'notify_new_followers'}
                                disabled={notifications.notify_new_followers === null}
                            />
                            <SettingsItem
                                label="Event Engagement"
                                icon="message-square"
                                toggleValue={notifications.notify_event_engagement ?? false}
                                onToggleChange={(val) => handleToggle('notify_event_engagement', val)}
                                isUpdating={updatingSetting === 'notify_event_engagement'}
                                disabled={notifications.notify_event_engagement === null}
                            />
                            <SettingsItem
                                label="App Updates & News"
                                icon="bell"
                                toggleValue={notifications.notify_app_updates ?? false}
                                onToggleChange={(val) => handleToggle('notify_app_updates', val)}
                                isUpdating={updatingSetting === 'notify_app_updates'}
                                disabled={notifications.notify_app_updates === null}
                            />
                        </>
                    )}
                </SettingsSection>

                {/* Privacy & Security Section */}
                <SettingsSection title="Privacy & Security">
                    <SettingsItem
                        label="Download Your Data"
                        icon="download-cloud"
                        onPress={handleDownloadData}
                        disabled // Not implemented
                    />
                    <SettingsItem
                        label="Logout on All Devices"
                        icon="log-out"
                        onPress={handleLogoutAllDevices}
                        disabled // Not implemented
                    />
                </SettingsSection>
                
                {/* Actions Section */}
                 <SettingsSection title="Actions">
                    <SettingsItem
                        label="Logout"
                        icon="log-out"
                        onPress={handleLogout}
                        isDestructive={false} // Logout is not "destructive" in the sense of data loss
                        disabled={authLoading}
                    />
                    <SettingsItem
                        label="Delete Account"
                        icon="trash-2"
                        onPress={() => {
                            const confirmDelete = async () => {
                                if (!userId) return;
                                setIsDeleting(true);
                                try {
                                    console.log("[OrganizerSettingsScreen] Starting account deletion process...", {
                                        platform: Platform.OS,
                                        userId,
                                        isWeb: Platform.OS === 'web'
                                    });
                                    
                                    // 1. Delete the user's auth account using Edge function
                                    const { data, error: functionError } = await supabase.functions.invoke('delete-user-account');
                                    
                                    if (functionError) {
                                        throw new Error(`Failed to delete account: ${functionError.message}`);
                                    }
                        
                                    if (data && typeof data === 'object' && (data as any).error) {
                                        throw new Error(`Account deletion failed: ${(data as any).error || (data as any).message || 'Unknown error from deletion function'}`);
                                    }
                        
                                    // 2. Sign out & force clear state
                                    await logout();
                        
                                } catch (err: any) {
                                    console.error("[OrganizerSettingsScreen] Account deletion failed:", err);
                                    Alert.alert("Deletion Failed", err.message || "An unexpected error occurred. Please try again or contact support.");
                                } finally {
                                    setIsDeleting(false);
                                }
                            };

                            Alert.alert(
                                'Delete Account',
                                'This is irreversible and will permanently delete all your data. Are you sure?',
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Delete', style: 'destructive', onPress: confirmDelete }
                                ]
                            );
                        }}
                        isDestructive={true}
                        disabled={isDeleting}
                        isUpdating={isDeleting} // Show loader when deleting
                    />
                </SettingsSection>
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
    contentContainer: {
        padding: 16,
    },
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
    toggleLoader: { marginRight: 10 },
});

export default OrganizerSettingsScreen;