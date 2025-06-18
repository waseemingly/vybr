import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome, MaterialCommunityIcons, Feather } from '@expo/vector-icons'; // Import necessary icon sets
import { useAuth } from '@/hooks/useAuth';
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth'; // Import the Spotify hook
import { APP_CONSTANTS } from '@/config/constants';
import { supabase } from '@/lib/supabase'; // <-- IMPORT supabase client
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '@/navigation/AppNavigator'; // Assuming types are here
import { useStreamingData } from '@/hooks/useStreamingData';

// --- Define Streaming Services Data (Consider moving to a shared file) ---
// Copied from MusicLoverSignUpFlow for now
type StreamingServiceId = 'spotify' | 'apple_music' | 'youtube_music' | 'deezer' | 'soundcloud' | 'tidal';
const STREAMING_SERVICES: { id: StreamingServiceId, name: string, icon: string, color: string, iconSet: 'FontAwesome' | 'MaterialCommunityIcons' }[] = [
    { id: 'spotify', name: 'Spotify', icon: 'spotify', color: '#1DB954', iconSet: 'FontAwesome' },
    { id: 'apple_music', name: 'Apple Music', icon: 'apple-music', color: '#FA57C1', iconSet: 'MaterialCommunityIcons' },
    { id: 'youtube_music', name: 'YouTube Music', icon: 'youtube-play', color: '#FF0000', iconSet: 'FontAwesome' },
    { id: 'deezer', name: 'Deezer', icon: 'deezer', color: '#EF5466', iconSet: 'MaterialCommunityIcons' },
    { id: 'soundcloud', name: 'SoundCloud', icon: 'soundcloud', color: '#FF5500', iconSet: 'FontAwesome' },
    { id: 'tidal', name: 'Tidal', icon: 'tidal', color: '#000000', iconSet: 'MaterialCommunityIcons' },
];

// --- Screen Props ---
type Props = NativeStackScreenProps<MainStackParamList, 'LinkMusicServicesScreen'>;

// --- Component ---
const LinkMusicServicesScreen: React.FC<Props> = ({ navigation, route }) => {
    const { musicLoverProfile, loading: authLoading, session, refreshUserProfile } = useAuth();
    const { 
        login: spotifyLogin, 
        isLoggedIn: isSpotifyLoggedIn, 
        isUpdatingListeningData: isSpotifyUpdating, 
        forceFetchAndSaveSpotifyData 
    } = useSpotifyAuth();
    const [updating, setUpdating] = useState(false); // Use this state for the Supabase update
    const [analyzingServiceId, setAnalyzingServiceId] = useState<StreamingServiceId | null>(null); // Track analyzing state
    const [fetchingSpotifyData, setFetchingSpotifyData] = useState(false);
    
    // NEW: Check for autoLinkSpotify parameter from route
    const autoLinkSpotify = route.params?.autoLinkSpotify ?? false;

    // *** ADD this log to see the profile on render ***
    console.log("[LinkMusicServicesScreen] Rendering with musicLoverProfile:", JSON.stringify(musicLoverProfile, null, 2));
    console.log("[LinkMusicServicesScreen] Route params:", JSON.stringify(route.params, null, 2));

    const userId = session?.user?.id;
    const primaryServiceId = musicLoverProfile?.selectedStreamingService;
    // Get linked services, default to empty array if null/undefined
    const linkedServices = musicLoverProfile?.secondary_streaming_services ?? [];

    // *** ADD this log to see the derived linkedServices ***
    console.log("[LinkMusicServicesScreen] Derived linkedServices:", linkedServices);

    const { isLoggedIn: isYouTubeMusicLoggedIn } = useYouTubeMusicAuth();

    const { 
        isServiceConnected, 
        loading: streamingDataLoading,
        hasData
    } = useStreamingData(session?.user?.id, {
        isSpotifyLoggedIn,
        isYouTubeMusicLoggedIn
    });

    // Effect to auto-initiate Spotify authentication if flag is set
    useEffect(() => {
        if (autoLinkSpotify && userId && !isSpotifyLoggedIn && !analyzingServiceId && !fetchingSpotifyData) {
            console.log("[LinkMusicServicesScreen] Auto-linking Spotify detected. Initiating Spotify authentication...");
            handleSpotifyLinking();
        }
    }, [autoLinkSpotify, userId, isSpotifyLoggedIn, analyzingServiceId, fetchingSpotifyData]);

    // Helper function to check premium status
    const checkPremiumStatus = async (): Promise<boolean> => {
        if (!userId) return false;
        try {
            const { data, error } = await supabase
                .from('music_lover_profiles')
                .select('is_premium')
                .eq('user_id', userId)
                .single();
            
            if (error) throw error;
            console.log("[checkPremiumStatus] Premium status:", data?.is_premium);
            return data?.is_premium ?? false;
        } catch (err) {
            console.error("Error checking premium status:", err);
            return false;
        }
    };

    // Helper function to update Spotify link status in profile
    const updateSpotifyLinkStatus = async (userId: string, isLinked: boolean): Promise<void> => {
        try {
            // Fetch current profile first
            const { data: currentProfile, error: fetchError } = await supabase
                .from('music_lover_profiles')
                .select('secondary_streaming_services')
                .eq('user_id', userId)
                .single();

            if (fetchError) throw fetchError;

            // Update the services array
            const currentServices = currentProfile?.secondary_streaming_services ?? [];
            let updatedServices = [...currentServices];
            
            if (isLinked && !updatedServices.includes('spotify')) {
                updatedServices.push('spotify');
            } else if (!isLinked) {
                updatedServices = updatedServices.filter(s => s !== 'spotify');
            }
            
            // Only update if there's a change
            if (JSON.stringify(currentServices) !== JSON.stringify(updatedServices)) {
                const { error: updateError } = await supabase
                    .from('music_lover_profiles')
                    .update({ secondary_streaming_services: updatedServices })
                    .eq('user_id', userId);
                
                if (updateError) throw updateError;
                console.log(`Spotify link status updated to: ${isLinked ? 'linked' : 'unlinked'}`);
            } else {
                console.log("No change to Spotify link status needed");
            }
        } catch (error) {
            console.error("Error updating Spotify link status:", error);
            // Don't throw - handle gracefully
        }
    };

    const handleServicePress = async (serviceId: StreamingServiceId) => {
        if (serviceId === primaryServiceId) {
            Alert.alert("Primary Service", "This is your primary service selected during sign-up. Changing it isn't supported here.");
            return;
        }
        // Check if already linked
        if (linkedServices.includes(serviceId)) {
             Alert.alert("Already Linked", "This service is already linked to your profile.");
             return;
        }

        if (analyzingServiceId || updating || !userId) return; // Don't run if busy or no user ID

        // Special handling for Spotify service
        if (serviceId === 'spotify') {
            await handleSpotifyLinking();
            return;
        }

        setAnalyzingServiceId(serviceId);
        setUpdating(true); // Indicate network activity for DB update

        // Simulate analysis visually for 1.5s, then update DB
        setTimeout(async () => {
            try {
                console.log(`Attempting to link service: ${serviceId} for user: ${userId}`);

                 // Fetch the current linked services array from DB first to avoid race conditions
                const { data: currentProfile, error: fetchError } = await supabase
                    .from('music_lover_profiles')
                    .select('secondary_streaming_services')
                    .eq('user_id', userId)
                    .single();

                if (fetchError) throw fetchError;

                // Ensure the array exists and doesn't already contain the service
                const currentLinked = currentProfile?.secondary_streaming_services ?? [];
                if (currentLinked.includes(serviceId)) {
                    console.warn(`Service ${serviceId} already linked in DB. Skipping update.`);
                     // Optionally refetch to ensure UI consistency if needed
                     // await refetchUserProfile?.();
                     Alert.alert("Already Linked", "This service was already linked.");
                     return; // Exit without error
                }

                // Add the new service ID to the array
                const updatedLinkedServices = [...currentLinked, serviceId];

                // Update the profile in Supabase
                const { error: updateError } = await supabase
                    .from('music_lover_profiles')
                    .update({ secondary_streaming_services: updatedLinkedServices })
                    .eq('user_id', userId);

                if (updateError) {
                    throw updateError;
                }

                console.log(`Successfully linked service: ${serviceId}`);
                Alert.alert("Service Linked", `${STREAMING_SERVICES.find(s => s.id === serviceId)?.name} has been linked.`);

                // Refetch the profile data to update the UI
                await refreshUserProfile?.();

            } catch (error: any) {
                console.error("Error linking streaming service:", error);
                Alert.alert("Linking Failed", `Could not link ${STREAMING_SERVICES.find(s => s.id === serviceId)?.name}. ${error.message || 'Please try again.'}`);
            } finally {
                setAnalyzingServiceId(null);
                setUpdating(false);
                // Navigate to Matches screen after successful link & refetch
                navigation.navigate('UserTabs', { screen: 'Matches' }); // <<< NAVIGATE TO MATCHES
            }
        }, 10000); // Delay matches the visual "analyzing" time
    };

    // Enhanced function to handle Spotify linking process with better error tracking
    const handleSpotifyLinking = async () => {
        if (!userId) {
            Alert.alert("Error", "User profile not found. Please try again later.");
            return;
        }

        console.log("[LinkMusicServicesScreen] Starting Spotify linking process...");
        // Log the version of the app and other important information
        console.log("[LinkMusicServicesScreen] Development mode:", __DEV__ ? "Yes" : "No");
        console.log("[LinkMusicServicesScreen] Expected Redirect URI: http://127.0.0.1:19006/callback");
        
        setAnalyzingServiceId('spotify');
        setFetchingSpotifyData(true);

        try {
            // 1. First initiate the Spotify login flow
            console.log("[LinkMusicServicesScreen] Initiating Spotify login...");
            Alert.alert(
                "Connecting to Spotify",
                "You'll be redirected to authorize the app. " + 
                (__DEV__ ? "NOTE: In development mode, your Spotify account must be added as an authorized test user in the Spotify Dashboard." : "Make sure to allow the connection."),
                [{ text: "OK", onPress: () => spotifyLogin() }]
            );
        } catch (error) {
            console.error("Error during Spotify linking:", error);
            Alert.alert("Error", "Failed to link Spotify. Please try again.");
            setAnalyzingServiceId(null);
            setFetchingSpotifyData(false);
        }
    };

    // Effect to monitor Spotify login state and proceed with linking if logged in
    useEffect(() => {
        // If Spotify auth completed while we were analyzing
        if (isSpotifyLoggedIn && analyzingServiceId === 'spotify') {
            console.log("[LinkMusicServicesScreen] Spotify authentication completed. Proceeding to data fetching...");
            
            // Only continue if we're not already fetching data (avoid duplicate processing)
            if (!fetchingSpotifyData) {
                setFetchingSpotifyData(true);
                
                const completeSpotifyLinking = async () => {
                    try {
                        // Check premium status first
                        const isPremium = await checkPremiumStatus();
                        console.log(`[LinkMusicServicesScreen] User premium status: ${isPremium ? 'Premium' : 'Free'}`);
                        
                        // Get userId from context
                        if (!userId) {
                            throw new Error("User ID not found. Please log in again.");
                        }
                        
                        // Update the profile to show Spotify is linked
                        await updateSpotifyLinkStatus(userId, true);
                        
                        // Fetch streaming data from Spotify
                        console.log("[LinkMusicServicesScreen] Initiating fetch of Spotify data...");
                        const success = await forceFetchAndSaveSpotifyData(userId, isPremium);
                        
                        if (success) {
                            console.log("[LinkMusicServicesScreen] Successfully fetched and saved Spotify data!");
                            Alert.alert(
                                "Success!",
                                "Spotify has been linked to your account and your music data has been imported.",
                                [{ text: "OK", onPress: () => {
                                    // Navigate back to Profile screen
                                    navigation.navigate('UserTabs', { screen: 'Profile' });
                                }}]
                            );
                        } else {
                            console.warn("[LinkMusicServicesScreen] Successfully linked Spotify but could not fetch data");
                            Alert.alert(
                                "Partially Complete",
                                "Spotify has been linked to your account, but we couldn't fetch your music data. You can try refreshing from your profile.",
                                [{ text: "OK", onPress: () => {
                                    // Navigate back to Profile screen
                                    navigation.navigate('UserTabs', { screen: 'Profile' });
                                }}]
                            );
                        }
                        
                        // Update the UI by refreshing the profile
                        await refreshUserProfile?.();
                        
                    } catch (error: any) {
                        console.error("[LinkMusicServicesScreen] Error in Spotify linking process:", error);
                        
                        // Check if this might be a 403 error (common in development mode)
                        if (error.message && (
                            error.message.includes("403") || 
                            error.message.includes("Forbidden") || 
                            error.message.includes("test user")
                        )) {
                            Alert.alert(
                                "Spotify Development Mode Restriction",
                                "This account needs to be added as an authorized test user in the Spotify Developer Dashboard. In development mode, only pre-approved Spotify accounts can use the app.",
                                [{ text: "OK" }]
                            );
                        } else {
                            Alert.alert(
                                "Error",
                                "There was a problem linking your Spotify account. Please try again.",
                                [{ text: "OK" }]
                            );
                        }
                    } finally {
                        setAnalyzingServiceId(null);
                        setFetchingSpotifyData(false);
                    }
                };
                
                // Slight delay for UX
                setTimeout(completeSpotifyLinking, 1000);
            }
        }
    }, [isSpotifyLoggedIn, analyzingServiceId, fetchingSpotifyData, userId, forceFetchAndSaveSpotifyData, refreshUserProfile, navigation]);

    if (authLoading) {
        return (
            <SafeAreaView style={styles.centeredLoader} edges={['top', 'bottom']}>
                <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
            </SafeAreaView>
        );
    }

    if (!musicLoverProfile) {
         return (
            <SafeAreaView style={styles.centeredLoader} edges={['top', 'bottom']}>
                <Text style={styles.errorText}>Could not load profile information.</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
             <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.title}>Linked Music Services</Text>
                <Text style={styles.description}>
                    Your primary service helps us understand your taste. You can link other services you use below.
                </Text>

                <View style={styles.serviceIconContainer}>
                    {STREAMING_SERVICES.map((service) => {
                        const isPrimary = primaryServiceId === service.id;
                        // Check if the service is in the linkedServices array
                        const isLinked = linkedServices.includes(service.id);

                        // Determine Icon Component
                        let IconComponent: React.ComponentType<any>;
                        switch (service.iconSet) {
                            case 'FontAwesome': IconComponent = FontAwesome; break;
                            case 'MaterialCommunityIcons': IconComponent = MaterialCommunityIcons; break;
                            default: IconComponent = Feather; // Fallback unlikely
                        }

                        const isAnalyzing = analyzingServiceId === service.id;

                        return (
                            <TouchableOpacity
                                key={service.id}
                                style={styles.serviceIconWrapper}
                                onPress={() => handleServicePress(service.id)}
                                activeOpacity={(isPrimary || isLinked) ? 1.0 : 0.7} // No feedback if primary or linked
                                disabled={isPrimary || isLinked || !!analyzingServiceId || updating} // Disable if primary, linked, analyzing, or updating
                            >
                                <View style={[
                                    styles.serviceIconBackground,
                                    (isPrimary || isLinked) ? styles.disabledServiceBackground : styles.otherServiceBackground,
                                    (isPrimary || isLinked || isAnalyzing) && { opacity: 0.6 } // Grey out primary, linked, or analyzing
                                ]}>
                                    {isAnalyzing ? (
                                        <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
                                    ) : (
                                        <IconComponent
                                            name={service.icon}
                                            size={35}
                                            color={(isPrimary || isLinked) ? '#A0A0A0' : service.color} // Greyed icon if primary or linked
                                        />
                                    )}
                                </View>
                                <Text style={[
                                    styles.serviceNameText,
                                    (isPrimary || isLinked) && styles.disabledServiceNameText, // Style primary/linked name differently
                                    isAnalyzing && styles.analyzingServiceNameText // Style analyzing text
                                ]}>
                                    {isAnalyzing ? "Linking..." : service.name}
                                    {isPrimary && !isAnalyzing && " (Primary)"}
                                    {isLinked && !isPrimary && !isAnalyzing && " (Linked)"}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Placeholder for Save button if needed later */}
                {/*
                <TouchableOpacity style={styles.saveButton} onPress={() => {}} disabled={updating}>
                    {updating ? <ActivityIndicator color="white" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
                </TouchableOpacity>
                */}
            </ScrollView>
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    centeredLoader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND_LIGHT,
    },
    container: {
        flex: 1,
        backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingVertical: 20,
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
        marginBottom: 8,
        textAlign: 'center',
    },
    description: {
        fontSize: 15,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        marginBottom: 30,
        textAlign: 'center',
        lineHeight: 21,
    },
    serviceIconContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-around',
        alignItems: 'flex-start',
        width: '100%',
    },
    serviceIconWrapper: {
        alignItems: 'center',
        width: '33%', // 3 items per row
        marginBottom: 25,
        paddingHorizontal: 5,
    },
    serviceIconBackground: {
        width: 75,
        height: 75,
        borderRadius: 37.5, // Make it circular
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        borderWidth: 2,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
    },
    primaryServiceBackground: { // RENAMED for clarity
        backgroundColor: APP_CONSTANTS.COLORS.BORDER_LIGHT, // Grey background for primary
        borderColor: APP_CONSTANTS.COLORS.BORDER_DARK,
    },
    disabledServiceBackground: { // NEW style for primary OR linked
        backgroundColor: APP_CONSTANTS.COLORS.BORDER_LIGHT,
        borderColor: APP_CONSTANTS.COLORS.BORDER_DARK,
    },
    otherServiceBackground: {
        backgroundColor: '#FFFFFF', // White background for others
        borderColor: APP_CONSTANTS.COLORS.BORDER,
    },
    serviceNameText: {
        fontSize: 13,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        fontWeight: '500',
        textAlign: 'center',
    },
    primaryServiceNameText: { // RENAMED for clarity
        color: '#A0A0A0', // Grey text for primary
        fontWeight: '600',
    },
    disabledServiceNameText: { // NEW style for primary OR linked text
        color: '#A0A0A0',
        fontWeight: '600',
    },
    errorText: {
        fontSize: 16,
        color: APP_CONSTANTS.COLORS.ERROR,
        textAlign: 'center',
        padding: 20,
    },
    saveButton: {
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 30,
        width: '90%',
        minHeight: 50,
        elevation: 3,
    },
    saveButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
    analyzingServiceNameText: { // Style for text when analyzing
        color: APP_CONSTANTS.COLORS.PRIMARY,
        fontStyle: 'italic',
        fontWeight: '600', // Make linking text bolder
    },
});

export default LinkMusicServicesScreen; 