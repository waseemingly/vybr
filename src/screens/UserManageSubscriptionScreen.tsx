// screens/UserManageSubscriptionScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, ScrollView, Alert, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { RootStackParamList, MainStackParamList } from '@/navigation/AppNavigator';
import { APP_CONSTANTS } from '@/config/constants';

console.log('[DEBUG] UserManageSubscriptionScreen module loaded');

// Define navigation prop type for this screen
type ManageSubscriptionNavigationProp = NativeStackNavigationProp<RootStackParamList & MainStackParamList, 'UserManageSubscriptionScreen'>;

interface PlanDetailProps {
    label: string;
    value: string;
}

const PlanDetail: React.FC<PlanDetailProps> = ({ label, value }) => {
    console.log('[DEBUG] PlanDetail render:', { label, value, valueType: typeof value });
    return (
        <View style={styles.planDetailItem}>
            <Text style={styles.planDetailLabel}>{label}:</Text>
            <Text style={styles.planDetailValue}>{value}</Text>
        </View>
    );
};

const UserManageSubscriptionScreen: React.FC = () => {
    const navigation = useNavigation<ManageSubscriptionNavigationProp>();
    const { session, musicLoverProfile, loading: authLoading, refreshUserProfile } = useAuth();
    const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
    const [planName, setPlanName] = useState<string>('Free Tier');
    const [renewalDate, setRenewalDate] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCanceling, setIsCanceling] = useState(false);

    const userId = session?.user?.id;
    const isPremium = musicLoverProfile?.isPremium ?? false;

    console.log('[DEBUG] UserManageSubscriptionScreen render - State:', {
        subscriptionStatus,
        planName,
        renewalDate,
        isLoading,
        isCanceling,
        userId,
        isPremium,
        authLoading
    });

    useEffect(() => {
        const fetchSubscriptionDetails = async () => {
            if (!userId) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            try {
                // --- TODO: Replace with your actual subscription fetching logic ---
                // This might involve querying a 'subscriptions' table or checking
                // the music_lover_profiles table for status and renewal dates.
                // Example simulation:
                if (isPremium) {
                    // Fetch details for premium user
                    // const { data, error } = await supabase.from('subscriptions')...
                    setSubscriptionStatus('active');
                    setPlanName('Vybr Premium');
                    // Simulate fetching a renewal date
                    const nextMonth = new Date();
                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                    setRenewalDate(nextMonth.toLocaleDateString());
                } else {
                    setSubscriptionStatus('free');
                    setPlanName('Free Tier');
                    setRenewalDate(null);
                }
                // --- End of placeholder logic ---

            } catch (error: unknown) {
                console.error("Error fetching subscription details:", error);
                Alert.alert("Error", "Could not load your subscription details.");
                setSubscriptionStatus('error'); // Indicate an error state
            } finally {
                setIsLoading(false);
            }
        };

        fetchSubscriptionDetails();
    }, [userId, isPremium]); // Re-run if userId or premium status changes

    const handleCancelSubscription = () => {
        if (!userId || !isPremium || subscriptionStatus !== 'active') return;

        Alert.alert(
            "Cancel Subscription",
            "Are you sure you want to cancel your Premium subscription? This will immediately downgrade your account to the Free Tier.",
            [
                { text: "Keep Subscription", style: "cancel" },
                {
                    text: "Confirm Cancellation",
                    style: "destructive",
                    onPress: async () => {
                        setIsCanceling(true);
                        // Ensure session and user ID exist before proceeding
                        if (!session?.user?.id) {
                            Alert.alert("Error", "User session is invalid. Cannot update.");
                            console.error("Cancellation failed: userId is missing from session.", session);
                            setIsCanceling(false);
                            return;
                        }
                        const currentUserId = session.user.id;
                        console.log(`Attempting downgrade for userId: ${currentUserId}`);

                        try {
                            
                            const { error: updateError } = await supabase
                                .from('music_lover_profiles')
                                .update({ 'is_premium': false })
                                .eq('user_id', currentUserId); // Use currentUserId directly, ensure 'user_id' matches your DB column

                            if (updateError) {
                                console.error('Supabase update error:', updateError);
                                // Throw the specific error to be caught below
                                throw new Error(`Supabase Error: ${updateError.message} (Code: ${updateError.code})`); 
                            }

                            // --- Update UI state immediately ---
                            console.log('Supabase update successful, updating UI state.');
                            setSubscriptionStatus('free');
                            setPlanName('Free Tier');
                            setRenewalDate(null);
                            
                            // Refresh user profile data to reflect the change
                            await refreshUserProfile();
                            
                            Alert.alert(
                                "Subscription Cancelled", 
                                "Your subscription has been cancelled and your account has been downgraded to Free Tier.",
                                [
                                    {
                                        text: "Go to Matches",
                                        onPress: () => {
                                            // Navigate back to the main app and go to profile tab
                                            navigation.navigate('MainApp' as never, { screen: 'Profile' } as never);
                                        }
                                    }
                                ]
                            );

                        } catch (error: unknown) {
                            console.error("Detailed error canceling subscription:", error);
                            // Show the specific error message in the alert
                            const errorMessage = error instanceof Error ? error.message : 'Unknown error. Please contact support.';
                            Alert.alert("Cancellation Failed", `Could not update your subscription status. Reason: ${errorMessage}`);
                        } finally {
                            setIsCanceling(false);
                        }
                    }
                }
            ]
        );
    };

    const navigateToUpgrade = () => {
        // Navigate to the screen where users can purchase/upgrade
        navigation.navigate('UpgradeScreen' as never);
    };

    if (authLoading || isLoading) {
        return (
            <SafeAreaView style={styles.centeredLoader} edges={['top', 'bottom']}>
                <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
            </SafeAreaView>
        );
    }

    if (!userId || subscriptionStatus === 'error') {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <View style={styles.centeredMessage}>
                     <Feather name="alert-circle" size={40} color={APP_CONSTANTS.COLORS.ERROR} />
                     <Text style={styles.errorMessage}>Could not load subscription details.</Text>
                     <Text style={styles.errorSubMessage}>Please try again later.</Text>
                </View>
             </SafeAreaView>
         );
    }

    // Helper function to get status text with proper styling
    const getStatusText = () => {
        if (!subscriptionStatus) return 'Loading...';
        return subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1);
    };

    const getStatusStyle = () => {
        switch (subscriptionStatus) {
            case 'active':
                return styles.status_active;
            case 'canceled':
                return styles.status_canceled;
            case 'free':
                return styles.status_free;
            default:
                return styles.status_free;
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Current Plan</Text>
                    <View style={styles.card}>
                        <PlanDetail label="Plan" value={planName} />
                        {subscriptionStatus === 'active' && renewalDate && (
                            <PlanDetail label="Renews on" value={renewalDate} />
                        )}
                        {subscriptionStatus === 'canceled' && renewalDate && (
                             <PlanDetail label="Access ends on" value={renewalDate} /> // Assuming renewal date becomes expiry date
                        )}
                        <View style={styles.planDetailItem}>
                            <Text style={styles.planDetailLabel}>Status:</Text>
                            <Text style={[styles.statusText, getStatusStyle()]}>
                                {getStatusText()}
                            </Text>
                        </View>
                    </View>
                </View>

                {subscriptionStatus === 'active' && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Manage</Text>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton, isCanceling && styles.buttonDisabled]}
                            onPress={handleCancelSubscription}
                            disabled={isCanceling}
                        >
                            {isCanceling ? (
                                <ActivityIndicator color="#FFFFFF" size="small" style={styles.buttonLoader} />
                            ) : (
                                <Feather name="x-circle" size={18} color="#FFFFFF" style={styles.buttonIcon} />
                            )}
                            <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
                        </TouchableOpacity>
                         <Text style={styles.cancelNote}>Cancellation is effective at the end of the current billing cycle.</Text>
                    </View>
                )}

                {subscriptionStatus === 'free' && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Upgrade</Text>
                        <TouchableOpacity style={styles.button} onPress={navigateToUpgrade}>
                            <Feather name="star" size={18} color="#FFFFFF" style={styles.buttonIcon} />
                            <Text style={styles.buttonText}>Upgrade to Premium</Text>
                        </TouchableOpacity>
                        <Text style={styles.upgradeNote}>Unlock exclusive features by upgrading your plan.</Text>
                    </View>
                )}

                 {subscriptionStatus === 'canceled' && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Reactivate</Text>
                         <TouchableOpacity style={styles.button} onPress={navigateToUpgrade}>
                            <Feather name="refresh-cw" size={18} color="#FFFFFF" style={styles.buttonIcon} />
                            <Text style={styles.buttonText}>Reactivate Premium</Text>
                        </TouchableOpacity>
                        <Text style={styles.upgradeNote}>You can reactivate your premium subscription anytime.</Text>
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    scrollContent: { paddingVertical: 20, paddingHorizontal: 16, },
    centeredLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
    centeredMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F9FAFB' },
    errorMessage: { fontSize: 18, fontWeight: '600', color: APP_CONSTANTS.COLORS.ERROR, marginTop: 15, textAlign: 'center', },
    errorSubMessage: { fontSize: 14, color: '#6B7280', marginTop: 5, textAlign: 'center', },
    section: { marginBottom: 25, },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, paddingHorizontal: 4, },
    card: { backgroundColor: 'white', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: "#000", shadowOffset: { width: 0, height: 1, }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1, },
    planDetailItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, },
    planDetailLabel: { fontSize: 15, color: '#4B5563', fontWeight: '500', },
    planDetailValue: { fontSize: 15, color: '#1F2937', fontWeight: '600', },
    statusText: { fontSize: 15, fontWeight: 'bold', textTransform: 'capitalize', },
    status_active: { color: '#10B981' }, // Green
    status_canceled: { color: APP_CONSTANTS.COLORS.ERROR }, // Red
    status_free: { color: '#6B7280' }, // Gray
    button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, marginTop: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2, }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2, },
    buttonText: { color: 'white', fontWeight: '600', fontSize: 16, marginLeft: 8, },
    buttonIcon: { marginRight: 8, },
    cancelButton: { backgroundColor: APP_CONSTANTS.COLORS.ERROR, },
    cancelButtonText: { color: 'white', fontWeight: '600', fontSize: 16, marginLeft: 8, },
    cancelNote: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 10, },
    upgradeNote: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 10, },
    buttonDisabled: { opacity: 0.7, },
    buttonLoader: { marginRight: 8, },
});

export default UserManageSubscriptionScreen;