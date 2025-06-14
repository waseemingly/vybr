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
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker'; // For logo upload
import * as FileSystem from 'expo-file-system'; // Add FileSystem import for mobile base64 conversion

// --- ADJUST PATHS ---
import { useAuth } from '../../hooks/useAuth';
import { APP_CONSTANTS } from '../../config/constants';
import { supabase } from '../../lib/supabase';
import { decode } from 'base64-arraybuffer'; // For image upload
import ImageCropper from '../../components/ImageCropper'; // Add ImageCropper
import OpeningHoursEditor from '../../components/OpeningHoursEditor'; // <-- ADD
import type { OpeningHours } from '../../hooks/useAuth'; // <-- ADD
// --------------------

// Helper function to get a clean, single image MIME type (copied from other screens)
const getCleanImageMimeType = (rawMimeType?: string): string | undefined => {
  if (!rawMimeType) return undefined;
  if (rawMimeType.includes('image/webp')) return 'image/webp';
  if (rawMimeType.includes('image/jpeg')) return 'image/jpeg';
  if (rawMimeType.includes('image/png')) return 'image/png';
  if (rawMimeType.includes('image/gif')) return 'image/gif';
  if (rawMimeType.includes('image/svg+xml')) return 'image/svg+xml';
  if (rawMimeType.startsWith('image/') && !rawMimeType.includes(',')) {
    const knownSimpleTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (knownSimpleTypes.includes(rawMimeType)) return rawMimeType;
  }
  return undefined;
};

// Define Param List if needed
type EditOrganizerProfileStackParamList = {
    EditOrganizerProfileHome: undefined;
};

type EditOrganizerProfileScreenNavigationProp = NativeStackNavigationProp<EditOrganizerProfileStackParamList, 'EditOrganizerProfileHome'>;

const DEFAULT_ORGANIZER_LOGO = 'https://via.placeholder.com/150/BFDBFE/1E40AF?text=Logo';

const EditOrganizerProfileScreen: React.FC = () => {
    const navigation = useNavigation<EditOrganizerProfileScreenNavigationProp>();
    const { 
        session, 
        loading: authLoading, 
        organizerProfile, 
        updateOrganizerProfile, // <-- ADD
        refreshSessionData 
    } = useAuth();

    // --- State --- 
    const [companyName, setCompanyName] = useState(organizerProfile?.companyName ?? '');
    const [bio, setBio] = useState(organizerProfile?.bio ?? '');
    const [email, setEmail] = useState(organizerProfile?.email ?? '');
    const [phoneNumber, setPhoneNumber] = useState(organizerProfile?.phone_number ?? '');
    const [website, setWebsite] = useState(organizerProfile?.website ?? '');
    const [businessType, setBusinessType] = useState(organizerProfile?.business_type ?? ''); // TODO: Consider a Picker component?
    const [capacity, setCapacity] = useState(organizerProfile?.capacity?.toString() ?? ''); // <-- ADD
    const [openingHours, setOpeningHours] = useState<OpeningHours | null>(organizerProfile?.opening_hours ?? null); // <-- ADD
    const [logoUrl, setLogoUrl] = useState(organizerProfile?.logo ?? null);
    const [newLogoUri, setNewLogoUri] = useState<string | null>(null); // Store local URI of selected new logo
    const [pickedImageBase64, setPickedImageBase64] = useState<string | null>(null); // State for base64 data
    const [pickedImageMimeType, setPickedImageMimeType] = useState<string | null>(null); // State for picked image mimeType

    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Web cropping state
    const [showCropper, setShowCropper] = useState(false);
    const [tempImageUri, setTempImageUri] = useState<string | null>(null);

    const userId = session?.user?.id;

    // Effect to update state from profile
    useEffect(() => {
        if (organizerProfile) {
            setCompanyName(organizerProfile.companyName ?? '');
            setBio(organizerProfile.bio ?? '');
            setEmail(organizerProfile.email ?? '');
            setPhoneNumber(organizerProfile.phone_number ?? '');
            setWebsite(organizerProfile.website ?? '');
            setBusinessType(organizerProfile.business_type ?? '');
            setCapacity(organizerProfile.capacity?.toString() ?? ''); // <-- ADD
            setOpeningHours(organizerProfile.opening_hours ?? null); // <-- ADD
            setLogoUrl(organizerProfile.logo ?? null);
            setIsLoading(false);
        } else if (!authLoading) {
             setIsLoading(false);
             Alert.alert("Error", "Could not load organizer profile to edit.");
             navigation.goBack();
        }
    }, [organizerProfile, authLoading, navigation]);

    // --- Logo Picker --- 
    const pickImage = async () => {
        // Request permissions if needed (optional, depends on platform/expo config)
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            Alert.alert("Permission Required", "You need to allow access to your photos to change the logo.");
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: Platform.OS !== 'web', // Only use built-in editing on mobile
            aspect: Platform.OS !== 'web' ? [4, 5] : undefined, // Match signup aspect ratio
            quality: 0.7,
            base64: Platform.OS === 'web', // Request base64 on web for cropping
        });

        if (!result.canceled && result.assets && result.assets[0]) {
            const asset = result.assets[0];
            
            if (Platform.OS === 'web') {
                // On web, show cropper first
                setTempImageUri(asset.uri);
                setShowCropper(true);
            } else {
                // On mobile, just set the local URI and mimeType
                setNewLogoUri(asset.uri);
                setLogoUrl(asset.uri); // Update display image immediately
                setPickedImageMimeType(asset.mimeType ?? null); // Store the mimeType
            }
        } else {
            // Reset if cancelled or error
            setNewLogoUri(null);
            setPickedImageBase64(null);
            setPickedImageMimeType(null); // Reset mimeType
        }
    };

    // Handle cropped image from web cropper
    const handleCroppedImage = (croppedImageUri: string, croppedBase64: string) => {
        // For web, the cropped URI is often a blob or base64 data url, which is what we need
        setNewLogoUri(croppedImageUri);
        setLogoUrl(croppedImageUri); // Update preview
        setPickedImageMimeType('image/jpeg'); // Cropper outputs JPEG
        setShowCropper(false);
        setTempImageUri(null);
    };

    // Handle cropper cancel
    const handleCropperCancel = () => {
        setShowCropper(false);
        setTempImageUri(null);
    };

    // --- Save Handler --- 
    const handleSave = async () => {
        if (!userId || isSaving) return;
        setIsSaving(true);

        try {
            // 1. Prepare the data payload
            const profileData: Parameters<typeof updateOrganizerProfile>[1] = {
                companyName: companyName.trim(),
                bio: bio.trim(),
                email: email.trim().toLowerCase(),
                phoneNumber: phoneNumber.trim(),
                website: website.trim(),
                businessType: businessType as any, // Cast because state is just string for now
                capacity: businessType === 'F&B' ? parseInt(capacity, 10) || 0 : undefined,
                openingHours: businessType === 'F&B' ? (openingHours ?? undefined) : undefined,
                logoUri: (newLogoUri || logoUrl) ?? undefined, // Pass new URI if set, otherwise existing URL
                logoMimeType: pickedImageMimeType,
            };

            // 2. Call the update function from the hook
            const result = await updateOrganizerProfile(userId, profileData);

            if (result && 'error' in result && result.error) {
                throw result.error;
            }

            // 3. Success
            Alert.alert("Success", "Your profile has been updated.");
            await refreshSessionData(); // Refresh data to get the latest profile
            navigation.goBack();

        } catch (error: any) {
            console.error("Error saving profile:", error);
            Alert.alert("Save Failed", error.message || "Could not save your profile. Please try again.");
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

    const displayLogo = newLogoUri || logoUrl || DEFAULT_ORGANIZER_LOGO;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                 <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="x" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Organizer Profile</Text>
                 <TouchableOpacity onPress={handleSave} disabled={isSaving || isUploading} style={styles.saveButton}>
                    {isSaving ? (
                        <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} />
                    ) : (
                        <Text style={styles.saveButtonText}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Logo Section */}
                <View style={styles.logoSection}>
                     <Image source={{ uri: displayLogo }} style={styles.logo} />
                     <TouchableOpacity style={styles.changeLogoButton} onPress={pickImage} disabled={isUploading || isSaving}>
                        <Feather name="edit-2" size={14} color={APP_CONSTANTS.COLORS.PRIMARY} style={{ marginRight: 5 }} />
                        <Text style={styles.changeLogoText}>Change Logo</Text>
                    </TouchableOpacity>
                    {isUploading && <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} style={{ marginTop: 5 }}/>}
                </View>

                <Text style={styles.sectionTitle}>Company Information</Text>
                <TextInput style={styles.input} placeholder="Company Name" value={companyName} onChangeText={setCompanyName} placeholderTextColor="#9CA3AF" />
                <TextInput style={[styles.input, styles.textArea]} placeholder="Bio / Description" value={bio} onChangeText={setBio} multiline placeholderTextColor="#9CA3AF" />
                <TextInput style={styles.input} placeholder="Business Type (e.g., Venue, Promoter)" value={businessType} onChangeText={setBusinessType} placeholderTextColor="#9CA3AF" />

                <Text style={styles.sectionTitle}>Contact Details</Text>
                <TextInput style={styles.input} placeholder="Contact Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#9CA3AF" />
                <TextInput style={styles.input} placeholder="Phone Number" value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" placeholderTextColor="#9CA3AF" />
                <TextInput style={styles.input} placeholder="Website (optional)" value={website} onChangeText={setWebsite} keyboardType="url" autoCapitalize="none" placeholderTextColor="#9CA3AF" />

                {/* --- ADDED Capacity and Opening Hours --- */}
                {businessType === 'F&B' && (
                    <>
                        <Text style={styles.sectionTitle}>Venue Details</Text>
                        <TextInput style={styles.input} placeholder="Venue Capacity" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" placeholderTextColor="#9CA3AF" />
                        <OpeningHoursEditor 
                            openingHours={openingHours}
                            onOpeningHoursChange={setOpeningHours}
                        />
                    </>
                )}

                 <View style={{ height: 40 }} />
            </ScrollView>
            
            {/* Web Image Cropper */}
            {Platform.OS === 'web' && (
                <ImageCropper
                    visible={showCropper}
                    imageUri={tempImageUri || ''}
                    aspectRatio={[4, 5]} // Match signup aspect ratio
                    onCrop={handleCroppedImage}
                    onCancel={handleCropperCancel}
                />
            )}
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
    logoSection: {
        alignItems: 'center',
        marginBottom: 20,
    },
    logo: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#E5E7EB',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    changeLogoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT,
    },
    changeLogoText: {
        color: APP_CONSTANTS.COLORS.PRIMARY,
        fontWeight: '500',
        fontSize: 14,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4B5563',
        marginBottom: 16,
        marginTop: 15,
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
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
});

export default EditOrganizerProfileScreen; 