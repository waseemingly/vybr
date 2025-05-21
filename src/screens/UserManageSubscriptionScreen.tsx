// import React, { useState, useEffect } from 'react';
// import {
//     View,
//     Text,
//     StyleSheet,
//     TouchableOpacity,
//     ScrollView,
//     Alert,
//     ActivityIndicator
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { Feather } from '@expo/vector-icons';
// import { useNavigation } from '@react-navigation/native';
// import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// import { useAuth } from '../hooks/useAuth';
// import { APP_CONSTANTS } from '../config/constants'; // Adjust path if needed
// import { supabase } from '../lib/supabase'; // Assuming supabase client is here
// // Import your navigation types if needed, e.g., for navigating to UpgradeScreen
// // import type { MainStackParamList } from '../navigation/AppNavigator';

// // Define navigation prop type for this screen if needed
// // type ManageSubscriptionNavigationProp = NativeStackNavigationProp<MainStackParamList, 'UserManageSubscriptionScreen'>;

// interface PlanDetailProps {
//     label: string;
//     value: string | React.ReactNode;
// }

// const PlanDetail: React.FC<PlanDetailProps> = ({ label, value }) => (
//     <View style={styles.planDetailItem}>
//         <Text style={styles.planDetailLabel}>{label}:</Text>
//         {typeof value === 'string' ? <Text style={styles.planDetailValue}>{value}</Text> : value}
//     </View>
// );

// const UserManageSubscriptionScreen: React.FC = () => {
//     // const navigation = useNavigation<ManageSubscriptionNavigationProp>();
//     const navigation = useNavigation(); // Use basic navigation type for now
//     const { session, musicLoverProfile, loading: authLoading } = useAuth();
//     const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null); // e.g., 'active', 'canceled', 'free'
//     const [planName, setPlanName] = useState<string>('Free Tier');
//     const [renewalDate, setRenewalDate] = useState<string | null>(null);
//     const [isLoading, setIsLoading] = useState(true);
//     const [isCanceling, setIsCanceling] = useState(false);

//     const userId = session?.user?.id;
//     const isPremium = musicLoverProfile?.isPremium ?? false; // Assuming isPremium is reliable

//     useEffect(() => {
//         const fetchSubscriptionDetails = async () => {
//             if (!userId) {
//                 setIsLoading(false);
//                 return;
//             }
//             setIsLoading(true);
//             try {
//                 // --- TODO: Replace with your actual subscription fetching logic ---
//                 // This might involve querying a 'subscriptions' table or checking
//                 // the music_lover_profiles table for status and renewal dates.
//                 // Example simulation:
//                 if (isPremium) {
//                     // Fetch details for premium user
//                     // const { data, error } = await supabase.from('subscriptions')...
//                     setSubscriptionStatus('active');
//                     setPlanName('Vybr Premium');
//                     // Simulate fetching a renewal date
//                     const nextMonth = new Date();
//                     nextMonth.setMonth(nextMonth.getMonth() + 1);
//                     setRenewalDate(nextMonth.toLocaleDateString());
//                 } else {
//                     setSubscriptionStatus('free');
//                     setPlanName('Free Tier');
//                     setRenewalDate(null);
//                 }
//                 // --- End of placeholder logic ---

//             } catch (error: any) {
//                 console.error("Error fetching subscription details:", error);
//                 Alert.alert("Error", "Could not load your subscription details.");
//                 setSubscriptionStatus('error'); // Indicate an error state
//             } finally {
//                 setIsLoading(false);
//             }
//         };

//         fetchSubscriptionDetails();
//     }, [userId, isPremium]); // Re-run if userId or premium status changes

//     const handleCancelSubscription = () => {
//         if (!userId || !isPremium || subscriptionStatus !== 'active') return;

//         Alert.alert(
//             "Cancel Subscription",
//             "Are you sure you want to cancel your Premium subscription? This will immediately downgrade your account to the Free Tier.",
//             [
//                 { text: "Keep Subscription", style: "cancel" },
//                 {
//                     text: "Confirm Cancellation",
//                     style: "destructive",
//                     onPress: async () => {
//                         setIsCanceling(true);
//                         // Ensure session and user ID exist before proceeding
//                         if (!session?.user?.id) {
//                              Alert.alert("Error", "User session is invalid. Cannot update.");
//                              console.error("Cancellation failed: userId is missing from session.", session);
//                              setIsCanceling(false);
//                              return;
//                         }
//                         const currentUserId = session.user.id;
//                         console.log(`Attempting downgrade for userId: ${currentUserId}`);

//                         try {
                            
//                             const { error: updateError } = await supabase
//                                 .from('music_lover_profiles')
//                                 .update({ 'is_premium': false })
//                                 .eq('user_id', currentUserId); // Use currentUserId directly, ensure 'user_id' matches your DB column

//                             if (updateError) {
//                                 console.error('Supabase update error:', updateError);
//                                 // Throw the specific error to be caught below
//                                 throw new Error(`Supabase Error: ${updateError.message} (Code: ${updateError.code})`); 
//                             }

//                             // --- Update UI state immediately ---
//                             console.log('Supabase update successful, updating UI state.');
//                             setSubscriptionStatus('free');
//                             setPlanName('Free Tier');
//                             setRenewalDate(null);
//                             Alert.alert("Success", "Your subscription has been cancelled and your account downgraded.");

//                         } catch (error: any) {
//                             console.error("Detailed error canceling subscription:", error);
//                             // Show the specific error message in the alert
//                             Alert.alert("Cancellation Failed", `Could not update your subscription status. Reason: ${error?.message || 'Unknown error. Please contact support.'}`);
//                         } finally {
//                             setIsCanceling(false);
//                         }
//                     }
//                 }
//             ]
//         );
//     };

//     const navigateToUpgrade = () => {
//         // Navigate to the screen where users can purchase/upgrade
//         navigation.navigate('UpgradeScreen' as never);
//     };

//     if (authLoading || isLoading) {
//         return (
//             <SafeAreaView style={styles.centeredLoader} edges={['top', 'bottom']}>
//                 <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
//             </SafeAreaView>
//         );
//     }

//     if (!userId || subscriptionStatus === 'error') {
//          return (
//             <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
//                 <View style={styles.centeredMessage}>
//                      <Feather name="alert-circle" size={40} color={APP_CONSTANTS.COLORS.ERROR} />
//                      <Text style={styles.errorMessage}>Could not load subscription details.</Text>
//                      <Text style={styles.errorSubMessage}>Please try again later.</Text>
//                 </View>
//              </SafeAreaView>
//          );
//     }

//     return (
//         <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
//             <ScrollView contentContainerStyle={styles.scrollContent}>
//                 <View style={styles.section}>
//                     <Text style={styles.sectionTitle}>Current Plan</Text>
//                     <View style={styles.card}>
//                         <PlanDetail label="Plan" value={planName} />
//                         {subscriptionStatus === 'active' && renewalDate && (
//                             <PlanDetail label="Renews on" value={renewalDate} />
//                         )}
//                         {subscriptionStatus === 'canceled' && renewalDate && (
//                              <PlanDetail label="Access ends on" value={renewalDate} /> // Assuming renewal date becomes expiry date
//                         )}
//                         <PlanDetail label="Status" value={
//                              <Text style={[
//                                  styles.statusText,
//                                  subscriptionStatus === 'active' ? styles.status_active :
//                                  subscriptionStatus === 'canceled' ? styles.status_canceled :
//                                  styles.status_free // Default or specific style for 'free'
//                              ]}>
//                                  {subscriptionStatus?.charAt(0).toUpperCase() + (subscriptionStatus?.slice(1) || '')}
//                              </Text>
//                          } />
//                     </View>
//                 </View>

//                 {subscriptionStatus === 'active' && (
//                     <View style={styles.section}>
//                         <Text style={styles.sectionTitle}>Manage</Text>
//                         <TouchableOpacity
//                             style={[styles.button, styles.cancelButton, isCanceling && styles.buttonDisabled]}
//                             onPress={handleCancelSubscription}
//                             disabled={isCanceling}
//                         >
//                             {isCanceling ? (
//                                 <ActivityIndicator color="#FFFFFF" size="small" style={styles.buttonLoader} />
//                             ) : (
//                                 <Feather name="x-circle" size={18} color="#FFFFFF" style={styles.buttonIcon} />
//                             )}
//                             <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
//                         </TouchableOpacity>
//                          <Text style={styles.cancelNote}>Cancellation is effective at the end of the current billing cycle.</Text>
//                     </View>
//                 )}

//                 {subscriptionStatus === 'free' && (
//                     <View style={styles.section}>
//                         <Text style={styles.sectionTitle}>Upgrade</Text>
//                         <TouchableOpacity style={styles.button} onPress={navigateToUpgrade}>
//                             <Feather name="star" size={18} color="#FFFFFF" style={styles.buttonIcon} />
//                             <Text style={styles.buttonText}>Upgrade to Premium</Text>
//                         </TouchableOpacity>
//                         <Text style={styles.upgradeNote}>Unlock exclusive features by upgrading your plan.</Text>
//                     </View>
//                 )}

//                  {subscriptionStatus === 'canceled' && (
//                     <View style={styles.section}>
//                         <Text style={styles.sectionTitle}>Reactivate</Text>
//                          <TouchableOpacity style={styles.button} onPress={navigateToUpgrade}>
//                             <Feather name="refresh-cw" size={18} color="#FFFFFF" style={styles.buttonIcon} />
//                             <Text style={styles.buttonText}>Reactivate Premium</Text>
//                         </TouchableOpacity>
//                         <Text style={styles.upgradeNote}>You can reactivate your premium subscription anytime.</Text>
//                     </View>
//                 )}

//             </ScrollView>
//         </SafeAreaView>
//     );
// };

// const styles = StyleSheet.create({
//     container: { flex: 1, backgroundColor: '#F9FAFB' },
//     scrollContent: { paddingVertical: 20, paddingHorizontal: 16, },
//     centeredLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
//     centeredMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F9FAFB' },
//     errorMessage: { fontSize: 18, fontWeight: '600', color: APP_CONSTANTS.COLORS.ERROR, marginTop: 15, textAlign: 'center', },
//     errorSubMessage: { fontSize: 14, color: '#6B7280', marginTop: 5, textAlign: 'center', },
//     section: { marginBottom: 25, },
//     sectionTitle: { fontSize: 14, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, paddingHorizontal: 4, },
//     card: { backgroundColor: 'white', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: "#000", shadowOffset: { width: 0, height: 1, }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1, },
//     planDetailItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, },
//     planDetailLabel: { fontSize: 15, color: '#4B5563', fontWeight: '500', },
//     planDetailValue: { fontSize: 15, color: '#1F2937', fontWeight: '600', },
//     statusText: { fontSize: 15, fontWeight: 'bold', textTransform: 'capitalize', },
//     status_active: { color: '#10B981' }, // Green
//     status_canceled: { color: APP_CONSTANTS.COLORS.ERROR }, // Red
//     status_free: { color: '#6B7280' }, // Gray
//     button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, marginTop: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2, }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2, },
//     buttonText: { color: 'white', fontWeight: '600', fontSize: 16, marginLeft: 8, },
//     buttonIcon: { marginRight: 8, },
//     cancelButton: { backgroundColor: APP_CONSTANTS.COLORS.ERROR, },
//     cancelButtonText: { color: 'white', fontWeight: '600', fontSize: 16, marginLeft: 8, },
//     cancelNote: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 10, },
//     upgradeNote: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 10, },
//     buttonDisabled: { opacity: 0.7, },
//     buttonLoader: { marginRight: 8, },
// });

// export default UserManageSubscriptionScreen; 

// UserManageSubscriptionScreen.tsx

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    Platform // Added Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../hooks/useAuth';
import { APP_CONSTANTS } from '../config/constants';
import { supabase } from '../lib/supabase';
// Assuming UpgradeScreen is in MainStackParamList. If not, adjust the type.
import type { MainStackParamList, RootStackParamList } from '../navigation/AppNavigator'; // Adjust paths

// Use a more specific type that includes UpgradeScreen if it's the target
type ManageSubscriptionNavigationProp = NativeStackNavigationProp<RootStackParamList & MainStackParamList, 'UserManageSubscriptionScreen'>;


interface PlanDetailProps {
    label: string;
    value: string | React.ReactNode;
}

const PlanDetail: React.FC<PlanDetailProps> = ({ label, value }) => (
    <View style={styles.planDetailItem}>
        <Text style={styles.planDetailLabel}>{label}:</Text>
        {typeof value === 'string' ? <Text style={styles.planDetailValue}>{value}</Text> : value}
    </View>
);

const UserManageSubscriptionScreen: React.FC = () => {
    const navigation = useNavigation<ManageSubscriptionNavigationProp>();
    const { session, musicLoverProfile, loading: authLoading, refreshUserProfile } = useAuth(); // <-- Added refreshUserProfile
    const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
    const [planName, setPlanName] = useState<string>('Free Tier');
    const [renewalDate, setRenewalDate] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCanceling, setIsCanceling] = useState(false);

    const userId = session?.user?.id;
    // Derive isPremium from musicLoverProfile AFTER it's potentially refreshed
    const isPremium = musicLoverProfile?.isPremium ?? false;

    const fetchSubscriptionDetails = async () => {
        console.log('[ManageSubscription] fetchSubscriptionDetails called. userId:', userId, 'isPremium (from profile):', musicLoverProfile?.isPremium);
        if (!userId) {
            setSubscriptionStatus('free'); // Default to free if no user
            setPlanName('Free Tier');
            setRenewalDate(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            // Now, base the local state directly on the possibly refreshed musicLoverProfile.isPremium
            if (musicLoverProfile?.isPremium) {
                setSubscriptionStatus('active');
                setPlanName('Vybr Premium');
                // TODO: Fetch actual renewal date from your 'subscriptions' table using userId
                // For now, simulating based on profile status
                const { data: subData, error: subError } = await supabase
                    .from('subscriptions')
                    .select('current_period_end')
                    .eq('user_id', userId)
                    .eq('status', 'active') // Ensure we get an active subscription's date
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (subError && subError.code !== 'PGRST116') { // PGRST116: No rows found
                    console.error("Error fetching subscription renewal date:", subError);
                }
                if (subData?.current_period_end) {
                    setRenewalDate(new Date(subData.current_period_end).toLocaleDateString());
                } else {
                    // Fallback if no specific renewal date found for an active premium user
                    const nextMonth = new Date();
                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                    setRenewalDate(nextMonth.toLocaleDateString());
                     console.warn("No specific renewal date found for active premium user, simulating next month.");
                }

            } else {
                setSubscriptionStatus('free');
                setPlanName('Free Tier');
                setRenewalDate(null);
            }
        } catch (error: any) {
            console.error("Error fetching subscription details:", error);
            Alert.alert("Error", "Could not load your subscription details.");
            setSubscriptionStatus('error');
        } finally {
            setIsLoading(false);
        }
    };


    useEffect(() => {
        // This effect now primarily reacts to changes in musicLoverProfile (especially musicLoverProfile.isPremium)
        // or when the component mounts with a valid userId.
        if (userId) { // Only run if userId is available
            fetchSubscriptionDetails();
        } else if (!authLoading) { // If not auth loading and no userId, set to free state
            setSubscriptionStatus('free');
            setPlanName('Free Tier');
            setRenewalDate(null);
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, musicLoverProfile?.isPremium, authLoading]); // Re-run if userId or the profile's premium status changes, or authLoading completes

    const handleCancelSubscription = () => {
        console.log('--- handleCancelSubscription: START ---');
        // Use the derived isPremium from the latest musicLoverProfile state
        if (!userId || !musicLoverProfile?.isPremium || subscriptionStatus !== 'active') {
            console.log("Cancellation attempt blocked: Conditions not met.", { userId, isPremium: musicLoverProfile?.isPremium, subscriptionStatus });
            return;
        }

        const confirmCancellation = async () => {
            setIsCanceling(true);
            if (!session?.user?.id) {
                if (Platform.OS === 'web') {
                    window.alert("Error: User session is invalid. Cannot update.");
                } else {
                    Alert.alert("Error", "User session is invalid. Cannot update.");
                }
                console.error("Cancellation failed: userId is missing from session.", session);
                setIsCanceling(false);
                return;
            }
            const currentUserId = session.user.id;
            console.log(`Attempting downgrade for userId: ${currentUserId}`);

            try {
                // 1. Update the database
                const { error: updateError } = await supabase
                    .from('music_lover_profiles')
                    .update({ is_premium: false })
                    .eq('user_id', currentUserId);

                if (updateError) {
                    console.error('Supabase update error during cancellation:', updateError);
                    throw new Error(`Database Update Failed: ${updateError.message}`);
                }
                console.log('Supabase profile update successful (is_premium: false).');

                // 2. Refresh the user profile from useAuth
                if (refreshUserProfile) {
                    console.log('Refreshing user profile state...');
                    await refreshUserProfile();
                    console.log('User profile refresh attempt complete.');
                } else {
                    console.warn('refreshUserProfile function not available in useAuth. UI might not update immediately without a manual refresh.');
                    setSubscriptionStatus('free');
                    setPlanName('Free Tier');
                    setRenewalDate(null);
                }

                if (Platform.OS === 'web') {
                    window.alert("Success: Your subscription has been cancelled and your account downgraded.");
                } else {
                    Alert.alert("Success", "Your subscription has been cancelled and your account downgraded.");
                }

            } catch (error: any) {
                console.error("Detailed error canceling subscription:", error);
                if (Platform.OS === 'web') {
                    window.alert(`Cancellation Failed: Could not update your subscription. Reason: ${error?.message || 'Unknown error.'}`);
                } else {
                    Alert.alert("Cancellation Failed", `Could not update your subscription. Reason: ${error?.message || 'Unknown error.'}`);
                }
            } finally {
                setIsCanceling(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm("Are you sure you want to cancel your Premium subscription? This will immediately downgrade your account to the Free Tier.")) {
                confirmCancellation();
            }
        } else {
            Alert.alert(
                "Cancel Subscription",
                "Are you sure you want to cancel your Premium subscription? This will immediately downgrade your account to the Free Tier.",
                [
                    { text: "Keep Subscription", style: "cancel" },
                    {
                        text: "Confirm Cancellation",
                        style: "destructive",
                        onPress: confirmCancellation
                    }
                ]
            );
        }
    };

    const navigateToUpgrade = () => {
        // Navigate to the screen where users can purchase/upgrade
        // Ensure 'PremiumSignupScreen' is the correct name and is in MainStackParamList or RootStackParamList
        // and that ManageSubscriptionNavigationProp can navigate to it.
        if (userId && musicLoverProfile?.email) {
            navigation.navigate('PremiumSignupScreen', {
                userId: userId,
                userEmail: musicLoverProfile.email,
            });
        } else {
            Alert.alert("Error", "User details missing. Cannot proceed to upgrade.");
            console.warn("Upgrade navigation blocked: User details missing", { userId, email: musicLoverProfile?.email });
        }
    };

    if (authLoading || (isLoading && userId)) { // Show loader if auth is loading OR if we are loading subscription details for a known user
        return (
            <SafeAreaView style={styles.centeredLoader} edges={['top', 'bottom']}>
                <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
                <Text style={styles.loadingText}>Loading Subscription...</Text>
            </SafeAreaView>
        );
    }

    if (!userId && !authLoading) { // If no user and auth is done loading, show login/error state
         return (
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <View style={styles.centeredMessage}>
                     <Feather name="user-x" size={40} color={APP_CONSTANTS.COLORS.TEXT_SECONDARY} />
                     <Text style={styles.errorMessage}>Not Logged In</Text>
                     <Text style={styles.errorSubMessage}>Please log in to manage your subscription.</Text>
                     {/* Optionally, add a login button */}
                </View>
             </SafeAreaView>
         );
    }
    if (subscriptionStatus === 'error') {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <View style={styles.centeredMessage}>
                     <Feather name="alert-circle" size={40} color={APP_CONSTANTS.COLORS.ERROR} />
                     <Text style={styles.errorMessage}>Could not load subscription details.</Text>
                     <Text style={styles.errorSubMessage}>Please try again later or contact support.</Text>
                </View>
             </SafeAreaView>
        )
    }


    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>My Subscription</Text>
                    <View style={{ width: 24 }} /> {/* Spacer */}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Current Plan</Text>
                    <View style={styles.card}>
                        <PlanDetail label="Plan" value={planName} />
                        {subscriptionStatus === 'active' && renewalDate && (
                            <PlanDetail label="Renews on" value={renewalDate} />
                        )}
                        {subscriptionStatus === 'canceled' && renewalDate && ( // Assuming you implement logic to show when access ends
                             <PlanDetail label="Access ends on" value={renewalDate} />
                        )}
                        <PlanDetail label="Status" value={
                             <Text style={[
                                 styles.statusText,
                                 subscriptionStatus === 'active' ? styles.statusActive :
                                 subscriptionStatus === 'canceled' ? styles.statusCanceled :
                                 styles.statusFree
                             ]}>
                                 {subscriptionStatus?.charAt(0).toUpperCase() + (subscriptionStatus?.slice(1) || '')}
                             </Text>
                         } />
                    </View>
                </View>

                {subscriptionStatus === 'active' && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Manage Your Subscription</Text>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton, isCanceling && styles.buttonDisabled]}
                            onPress={handleCancelSubscription}
                            disabled={isCanceling}
                        >
                            {isCanceling ? (
                                <ActivityIndicator color="#FFFFFF" size="small" style={styles.buttonLoader} />
                            ) : (
                                <Feather name="x-circle" size={18} color="#FFFFFF" />
                            )}
                            <Text style={styles.buttonText}>Cancel Premium</Text>
                        </TouchableOpacity>
                         <Text style={styles.cancelNote}>
                            If you cancel, your premium benefits will continue until the end of your current billing period ({renewalDate || 'N/A'}). After that, you'll be on the Free Tier.
                        </Text>
                    </View>
                )}

                {(subscriptionStatus === 'free' || subscriptionStatus === 'canceled') && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            {subscriptionStatus === 'free' ? 'Upgrade to Premium' : 'Reactivate Premium'}
                        </Text>
                        <TouchableOpacity style={[styles.button, styles.upgradeButton]} onPress={navigateToUpgrade}>
                            <Feather name="star" size={18} color="#FFFFFF" />
                            <Text style={styles.buttonText}>
                                {subscriptionStatus === 'free' ? 'Upgrade to Premium' : 'Reactivate Premium'}
                            </Text>
                        </TouchableOpacity>
                        <Text style={styles.upgradeNote}>Unlock exclusive features and enhance your Vybr experience!</Text>
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' }, // Consistent background
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? 16 : 10, // Adjust for platform
        paddingBottom: 12,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 8, // Easier to tap
        marginLeft: -8, // Align icon visually
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    },
    scrollContent: {
        paddingVertical: 24, // More vertical padding
        paddingHorizontal: 16,
    },
    centeredLoader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
    },
    loadingText: { // Added style for loading text
        marginTop: 10,
        fontSize: 15,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    },
    centeredMessage: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#F9FAFB',
    },
    errorMessage: {
        fontSize: 18,
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.ERROR,
        marginTop: 16, // More space from icon
        textAlign: 'center',
    },
    errorSubMessage: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 20,
    },
    section: {
        marginBottom: 30, // Increased spacing between sections
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4B5563', // Slightly darker for better contrast
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
        paddingHorizontal: 0, // Remove if not needed
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 12, // More rounded
        padding: 20, // More padding
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: "#4B5563", // Softer shadow color
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08, // Subtler shadow
        shadowRadius: 6,
        elevation: 3, // Consistent elevation
    },
    planDetailItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10, // Add vertical padding for each item
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6', // Light separator
    },
    planDetailItemLast: { // Style to remove border for the last item
        borderBottomWidth: 0,
    },
    planDetailLabel: {
        fontSize: 15,
        color: '#374151', // Darker label
        fontWeight: '500',
    },
    planDetailValue: {
        fontSize: 15,
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
        fontWeight: '600',
        textAlign: 'right',
    },
    statusText: {
        fontSize: 15,
        fontWeight: '700', // Bolder status
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12, // Pill shape
        overflow: 'hidden', // For borderRadius to work with background
        textAlign: 'center',
    },
    statusActive: { color: '#057A55', backgroundColor: '#DEF7EC' }, // Green
    statusCanceled: { color: '#B91C1C', backgroundColor: '#FEE2E2' }, // Red
    statusFree: { color: '#5E6A7C', backgroundColor: '#F3F4F6' }, // Gray
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14, // Slightly more padding
        paddingHorizontal: 20,
        borderRadius: 10, // More rounded
        marginTop: 8, // Consistent top margin
        shadowColor: "#4B5563",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    buttonText: { color: 'white', fontWeight: '600', fontSize: 16 }, // Removed marginLeft if icon handles spacing
    // buttonIcon: { // Removed, icon is inline now
    //     marginRight: 8,
    // },
    upgradeButton: { // Specific style for upgrade button
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
    },
    cancelButton: {
        backgroundColor: APP_CONSTANTS.COLORS.ERROR,
    },
    // cancelButtonText: { color: 'white', fontWeight: '600', fontSize: 16, marginLeft: 8 }, // Redundant
    cancelNote: {
        fontSize: 13, // Slightly larger
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 12, // More space
        lineHeight: 18,
    },
    upgradeNote: {
        fontSize: 13,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 18,
    },
    buttonDisabled: {
        opacity: 0.6, // Softer disabled state
    },
    buttonLoader: { // No specific style needed if just using ActivityIndicator inline
        // marginRight: 8,
    },
});

export default UserManageSubscriptionScreen;