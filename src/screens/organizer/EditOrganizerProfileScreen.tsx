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

// --- ADJUST PATHS ---
import { useAuth } from '../../hooks/useAuth';
import { APP_CONSTANTS } from '../../config/constants';
import { supabase } from '../../lib/supabase';
import { decode } from 'base64-arraybuffer'; // For image upload
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
    const { session, loading: authLoading, organizerProfile, refreshSessionData } = useAuth(); // Assume refreshSessionData exists

    // --- State --- 
    const [companyName, setCompanyName] = useState(organizerProfile?.companyName ?? '');
    const [bio, setBio] = useState(organizerProfile?.bio ?? '');
    const [email, setEmail] = useState(organizerProfile?.email ?? '');
    const [phoneNumber, setPhoneNumber] = useState(organizerProfile?.phoneNumber ?? '');
    const [website, setWebsite] = useState(organizerProfile?.website ?? '');
    const [businessType, setBusinessType] = useState(organizerProfile?.businessType ?? ''); // TODO: Consider a Picker component?
    const [logoUrl, setLogoUrl] = useState(organizerProfile?.logo ?? null);
    const [newLogoUri, setNewLogoUri] = useState<string | null>(null); // Store local URI of selected new logo
    const [pickedImageBase64, setPickedImageBase64] = useState<string | null>(null); // State for base64 data
    const [pickedImageMimeType, setPickedImageMimeType] = useState<string | null>(null); // State for picked image mimeType

    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const userId = session?.user?.id;

    // Effect to update state from profile
    useEffect(() => {
        if (organizerProfile) {
            setCompanyName(organizerProfile.companyName ?? '');
            setBio(organizerProfile.bio ?? '');
            setEmail(organizerProfile.email ?? '');
            setPhoneNumber(organizerProfile.phoneNumber ?? '');
            setWebsite(organizerProfile.website ?? '');
            setBusinessType(organizerProfile.businessType ?? '');
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
            allowsEditing: true,
            aspect: [1, 1], // Square aspect ratio for logo
            quality: 0.6, // Compress image slightly
            base64: true, // Request base64 encoding
        });

        if (!result.canceled && result.assets && result.assets[0]) {
            const asset = result.assets[0];
            setNewLogoUri(asset.uri); // Keep local URI for display
            setPickedImageBase64(asset.base64 ?? null); // Store base64 in state
            setLogoUrl(asset.uri); // Update display image immediately
            setPickedImageMimeType(asset.mimeType ?? null); // Store the mimeType
        } else {
            // Reset if cancelled or error
            setNewLogoUri(null);
            setPickedImageBase64(null);
            setPickedImageMimeType(null); // Reset mimeType
        }
    };

    // --- Save Handler --- 
    const handleSave = async () => {
        if (!userId || isSaving || isUploading) return;
        setIsSaving(true);
        let uploadedLogoPath: string | null = organizerProfile?.logo ?? null; // Start with existing logo

        // 1. Upload new logo if base64 data exists in state
        if (pickedImageBase64 && newLogoUri) { // Ensure newLogoUri is also present for extension hint
            setIsUploading(true);
            try {
                const base64 = pickedImageBase64;

                let extHint = newLogoUri.split('.').pop()?.toLowerCase().split('?')[0];
                if (extHint && (extHint.length > 5 || !/^[a-zA-Z0-9]+$/.test(extHint))) {
                    extHint = undefined;
                }
                if (extHint === 'jpg') extHint = 'jpeg';

                let finalMimeType = getCleanImageMimeType(pickedImageMimeType || undefined);
                if (!finalMimeType && extHint) {
                    finalMimeType = getCleanImageMimeType(`image/${extHint}`);
                }
                if (!finalMimeType) {
                    finalMimeType = 'image/png'; // Default for logos if all else fails
                    console.warn(`[EditOrganizerProfile] Could not determine clean MIME for logo. Defaulting to ${finalMimeType}. Picker: ${pickedImageMimeType}, URI: ${newLogoUri.substring(0,100)}`);
                }

                let finalFileExtension = 'png';
                const typeParts = finalMimeType.split('/');
                if (typeParts.length === 2 && typeParts[0] === 'image' && typeParts[1]) {
                    finalFileExtension = typeParts[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
                }

                const filePath = `${userId}/${Date.now()}.${finalFileExtension}`;
                const actualMimeTypeForUpload = finalMimeType; // finalMimeType should be good here

                console.log(`[EditOrganizerProfile] Uploading logo. Path: ${filePath}, ContentType: ${actualMimeTypeForUpload}`);

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('organizer-logos') 
                    .upload(filePath, decode(base64), { contentType: actualMimeTypeForUpload });

                if (uploadError) {
                    console.error("[EditOrganizerProfile] Supabase Logo Upload Error:", uploadError);
                    throw uploadError;
                }

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('organizer-logos')
                    .getPublicUrl(filePath);

                uploadedLogoPath = urlData.publicUrl;
                setNewLogoUri(null); 
                setPickedImageBase64(null); 
                setPickedImageMimeType(null); // Clear picked mimeType

            } catch (error: any) {
                 console.error("Error uploading logo:", error);
                 Alert.alert("Upload Failed", "Could not upload the new logo. Please try again.");
                 setIsUploading(false);
                 setIsSaving(false);
                 return; // Stop saving process
            } finally {
                setIsUploading(false);
            }
        } else if (!newLogoUri && logoUrl !== organizerProfile?.logo) {
             // Handle case where user picked an image but then cleared it maybe?
             // Or if logoUrl was somehow changed without picking new base64
             // For safety, if there's no base64 but the displayed logo URI 
             // isn't the original one, perhaps don't change the logo path.
             // uploadedLogoPath = organizerProfile?.logo ?? null;
             // OR - if you allow *removing* a logo, set uploadedLogoPath = null here
        }

        // 2. Update profile data in the database
        try {
            const updates = {
                company_name: companyName.trim() || null,
                bio: bio.trim() || null,
                email: email.trim().toLowerCase() || null,
                phone_number: phoneNumber.trim() || null,
                website: website.trim() || null,
                business_type: businessType.trim() || null,
                logo: uploadedLogoPath, // Use new or existing path
            };

            const { error } = await supabase
                .from('organizer_profiles')
                .update(updates)
                .eq('user_id', userId);

            if (error) throw error;

            Alert.alert("Success", "Organizer profile updated successfully!");
            await refreshSessionData?.(); // Refresh session data
            navigation.goBack();

        } catch (error: any) {
            console.error("Error updating organizer profile:", error);
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