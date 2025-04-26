import React, { useState } from 'react';
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
import { APP_CONSTANTS } from '@/config/constants';
import { supabase } from '@/lib/supabase'; // <-- IMPORT supabase client
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '@/navigation/AppNavigator'; // Assuming types are here

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
const LinkMusicServicesScreen: React.FC<Props> = ({ navigation }) => {
    const { musicLoverProfile, loading: authLoading, session, refetchUserProfile } = useAuth();
    const [updating, setUpdating] = useState(false); // Use this state for the Supabase update
    const [analyzingServiceId, setAnalyzingServiceId] = useState<StreamingServiceId | null>(null); // Track analyzing state

    // *** ADD this log to see the profile on render ***
    console.log("[LinkMusicServicesScreen] Rendering with musicLoverProfile:", JSON.stringify(musicLoverProfile, null, 2));

    const userId = session?.user?.id;
    const primaryServiceId = musicLoverProfile?.selectedStreamingService;
    // Get linked services, default to empty array if null/undefined
    const linkedServices = musicLoverProfile?.secondary_streaming_services ?? [];

    // *** ADD this log to see the derived linkedServices ***
    console.log("[LinkMusicServicesScreen] Derived linkedServices:", linkedServices);

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
                await refetchUserProfile?.(); // Use the function from useAuth if available

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
                    Your primary service helps us understand your taste. You can link other services you use below (linking functionality coming soon!).
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