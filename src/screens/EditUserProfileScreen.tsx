import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// --- ADJUST PATHS ---
import { useAuth, MusicLoverBio } from '../hooks/useAuth';
import { APP_CONSTANTS } from '../config/constants';
import { supabase } from '../lib/supabase';
// --------------------

// Define Param List if navigating further *from* here (if needed)
type EditUserProfileStackParamList = {
    EditUserProfileHome: undefined;
    // ... other potential sub-screens
};

type EditUserProfileScreenNavigationProp = NativeStackNavigationProp<EditUserProfileStackParamList, 'EditUserProfileHome'>;

// Labels for Bio Details (Reuse or define here)
const bioDetailLabels: Record<keyof MusicLoverBio, string> = {
    firstSong: "First Concert / Memory",
    goToSong: "Go-To Song Right Now",
    mustListenAlbum: "Must-Listen Album",
    dreamConcert: "Dream Concert Lineup",
    musicTaste: "Music Taste Description",
};

const EditUserProfileScreen: React.FC = () => {
    const navigation = useNavigation<EditUserProfileScreenNavigationProp>();
    const { session, loading: authLoading, musicLoverProfile, refreshSessionData } = useAuth(); // Assume refreshSessionData exists

    const [firstName, setFirstName] = useState(musicLoverProfile?.firstName ?? '');
    const [lastName, setLastName] = useState(musicLoverProfile?.lastName ?? '');
    const [city, setCity] = useState(musicLoverProfile?.city ?? '');
    const [country, setCountry] = useState(musicLoverProfile?.country ?? '');
    // Bio fields
    const [bioDetails, setBioDetails] = useState<MusicLoverBio>(
        musicLoverProfile?.bio ?? {
            firstSong: '',
            goToSong: '',
            mustListenAlbum: '',
            dreamConcert: '',
            musicTaste: '',
        }
    );

    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const userId = session?.user?.id;

    // Effect to update state if profile data becomes available after initial render
    useEffect(() => {
        if (musicLoverProfile) {
            setFirstName(musicLoverProfile.firstName ?? '');
            setLastName(musicLoverProfile.lastName ?? '');
            setCity(musicLoverProfile.city ?? '');
            setCountry(musicLoverProfile.country ?? '');
            setBioDetails(musicLoverProfile.bio ?? {
                firstSong: '', goToSong: '', mustListenAlbum: '', dreamConcert: '', musicTaste: '',
            });
            setIsLoading(false);
        } else if (!authLoading) {
             // Handle case where profile is missing even after auth loading finishes
             setIsLoading(false);
             Alert.alert("Error", "Could not load profile data to edit.");
             navigation.goBack();
        }
    }, [musicLoverProfile, authLoading, navigation]);

    const handleBioChange = (key: keyof MusicLoverBio, value: string) => {
        setBioDetails(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        if (!userId || isSaving) return;
        setIsSaving(true);

        // Simple validation example (add more as needed)
        if (!firstName.trim() || !lastName.trim()) {
            Alert.alert("Missing Info", "First and Last Name are required.");
            setIsSaving(false);
            return;
        }

        try {
            const updates = {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                city: city.trim() || null, // Store empty as null
                country: country.trim() || null, // Store empty as null
                bio: bioDetails,
            };

            const { error } = await supabase
                .from('music_lover_profiles')
                .update(updates)
                .eq('user_id', userId);

            if (error) throw error;

            Alert.alert("Success", "Profile updated successfully!");
            await refreshSessionData?.(); // Refresh session to get updated profile in context
            navigation.goBack();

        } catch (error: any) {
            console.error("Error updating profile:", error);
            Alert.alert("Error", "Could not save profile changes. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || authLoading) {
        return (
            <SafeAreaView style={styles.centeredLoader} edges={['top', 'bottom']}>
                <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="x" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <TouchableOpacity onPress={handleSave} disabled={isSaving} style={styles.saveButton}>
                    {isSaving ? (
                        <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} />
                    ) : (
                        <Text style={styles.saveButtonText}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <Text style={styles.sectionTitle}>Basic Information</Text>
                <TextInput
                    style={styles.input}
                    placeholder="First Name"
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                />
                <TextInput
                    style={styles.input}
                    placeholder="Last Name"
                    value={lastName}
                    onChangeText={setLastName}
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                />
                 <TextInput
                    style={styles.input}
                    placeholder="City (Optional)"
                    value={city}
                    onChangeText={setCity}
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                />
                 <TextInput
                    style={styles.input}
                    placeholder="Country (Optional)"
                    value={country}
                    onChangeText={setCountry}
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                />

                <Text style={styles.sectionTitle}>About Me</Text>
                {Object.entries(bioDetailLabels).map(([key, label]) => (
                     <View key={key} style={styles.bioInputContainer}>
                        <Text style={styles.bioLabel}>{label}</Text>
                        <TextInput
                            style={[styles.input, styles.bioInput]}
                            placeholder={`Your ${label.toLowerCase()}...`}
                            value={bioDetails[key as keyof MusicLoverBio] ?? ''}
                            onChangeText={(text) => handleBioChange(key as keyof MusicLoverBio, text)}
                            placeholderTextColor="#9CA3AF"
                            multiline
                        />
                    </View>
                ))}

                 <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    centeredLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: 'white',
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
    saveButton: { paddingVertical: 4, paddingHorizontal: 8 },
    saveButtonText: { fontSize: 16, fontWeight: '600', color: APP_CONSTANTS.COLORS.PRIMARY },
    scrollView: { flex: 1 },
    scrollContent: { padding: 20 },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4B5563',
        marginBottom: 16,
        marginTop: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingBottom: 8,
    },
    input: {
        backgroundColor: 'white',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        fontSize: 16,
        color: '#1F2937',
        marginBottom: 16,
    },
     bioInputContainer: {
        marginBottom: 20,
    },
    bioLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6B7280',
        marginBottom: 8,
    },
    bioInput: {
        minHeight: 60, // Allow for multiple lines
        textAlignVertical: 'top', // Align text to top for multiline
        marginBottom: 0, // Remove default bottom margin from input style
    },
});

export default EditUserProfileScreen; 