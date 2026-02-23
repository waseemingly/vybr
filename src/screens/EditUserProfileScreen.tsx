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
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

// Import location data from country-state-city
import { Country, State, City } from 'country-state-city';

// --- ADJUST PATHS ---
import { useAuth, MusicLoverBio } from '../hooks/useAuth';
import { APP_CONSTANTS } from '../config/constants';
import { supabase } from '../lib/supabase';
import ImageCropper from '../components/ImageCropper';
// --------------------

// Helper function to get a clean, single image MIME type (copied from CreateEventScreen)
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
    const { session, loading: authLoading, musicLoverProfile, refreshSessionData, requestMediaLibraryPermissions, checkUsernameExists } = useAuth();

    // Basic info states
    const [firstName, setFirstName] = useState(musicLoverProfile?.firstName ?? '');
    const [lastName, setLastName] = useState(musicLoverProfile?.lastName ?? '');
    const [username, setUsername] = useState(musicLoverProfile?.username ?? '');
    const [age, setAge] = useState(musicLoverProfile?.age?.toString() ?? '');
    
    // Profile picture states
    const [profilePictureUri, setProfilePictureUri] = useState(musicLoverProfile?.profilePicture ?? '');
    const [profilePictureMimeType, setProfilePictureMimeType] = useState<string | null>(null);
    const [profilePictureBase64, setProfilePictureBase64] = useState<string | null>(null);
    const [isProfilePictureChanged, setIsProfilePictureChanged] = useState(false);
    
    // Location states - use optional chaining for safety
    const [countryCode, setCountryCode] = useState<string>('');
    const [stateCode, setStateCode] = useState<string>('');
    const [cityCode, setCityCode] = useState<string>('');
    
    // Derived location display values - don't reference profile directly to avoid type errors
    const [country, setCountry] = useState('');
    const [state, setState] = useState('');
    const [city, setCity] = useState('');

    // Location data lists
    const [countries, setCountries] = useState<any[]>([]);
    const [states, setStates] = useState<any[]>([]);
    const [cities, setCities] = useState<any[]>([]);
    
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

    // Web cropping state
    const [showCropper, setShowCropper] = useState(false);
    const [tempImageUri, setTempImageUri] = useState<string | null>(null);

    const userId = session?.user?.id;

    // Load countries on component mount
    useEffect(() => {
        const allCountries = Country.getAllCountries();
        setCountries(allCountries);
    }, []);

    // Load states when country changes
    useEffect(() => {
        if (countryCode) {
            // Special handling for Singapore (no states/provinces)
            if (countryCode === 'SG') {
                setStates([]);
                // For Singapore, set stateCode to a placeholder value
                setStateCode('SG-01');
                setState('Singapore'); // Use country name as state
                return;
            }
            
            const countryStates = State.getStatesOfCountry(countryCode);
            setStates(countryStates);
            
            // If previously selected state is not in new country, reset state and city
            const stateExists = countryStates.some(s => s.isoCode === stateCode);
            if (!stateExists) {
                setStateCode('');
                setState('');
                setCityCode('');
                setCity('');
            }
        } else {
            setStates([]);
            setStateCode('');
            setState('');
            setCityCode('');
            setCity('');
        }
    }, [countryCode]);

    // Load cities when state changes
    useEffect(() => {
        if (countryCode && stateCode) {
            const stateCities = City.getCitiesOfState(countryCode, stateCode);
            setCities(stateCities);
            
            // If previously selected city is not in new state, reset city
            const cityExists = stateCities.some(c => c.name === cityCode);
            if (!cityExists) {
                setCityCode('');
                setCity('');
            }
        } else {
            setCities([]);
            setCityCode('');
            setCity('');
        }
    }, [countryCode, stateCode]);

    // Effect to update state if profile data becomes available after initial render
    useEffect(() => {
        if (musicLoverProfile) {
            setFirstName(musicLoverProfile.firstName ?? '');
            setLastName(musicLoverProfile.lastName ?? '');
            setUsername(musicLoverProfile.username ?? '');
            setAge(musicLoverProfile.age?.toString() ?? '');
            setProfilePictureUri(musicLoverProfile.profilePicture ?? '');
            
            // Set location data if available - using optional chaining for type safety
            // Only store the display values in the profile, not the codes
            const countryValue = musicLoverProfile.country || '';
            const stateValue = (musicLoverProfile as any).state || '';
            const cityValue = musicLoverProfile.city || '';
            
            setCountry(countryValue);
            setState(stateValue);
            setCity(cityValue);
            
            // Find the country code based on the country name
            if (countryValue) {
                const matchedCountry = Country.getAllCountries().find(c => c.name === countryValue);
                if (matchedCountry) {
                    setCountryCode(matchedCountry.isoCode);
                    
                    // If we have a state and country code, find the state code
                    if (stateValue && matchedCountry.isoCode) {
                        const matchedState = State.getStatesOfCountry(matchedCountry.isoCode)
                            .find(s => s.name === stateValue);
                        if (matchedState) {
                            setStateCode(matchedState.isoCode);
                        }
                    }
                }
            }
            
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

    const handleCountryChange = (countryCode: string) => {
        const selectedCountry = countries.find(c => c.isoCode === countryCode);
        setCountryCode(countryCode);
        setCountry(selectedCountry?.name ?? '');
    };

    const handleStateChange = (stateCode: string) => {
        const selectedState = states.find(s => s.isoCode === stateCode);
        setStateCode(stateCode);
        setState(selectedState?.name ?? '');
    };

    const handleCityChange = (cityName: string) => {
        setCityCode(cityName);
        setCity(cityName);
    };

    const handleProfilePicPick = async () => {
        // Request permissions first
        const hasPermission = await requestMediaLibraryPermissions();
        if (!hasPermission) {
            return; // Permission denied
        }

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: Platform.OS !== 'web', // Only use built-in editing on mobile
                aspect: Platform.OS !== 'web' ? [4, 5] : undefined, // Enforce 4:5 aspect ratio for cropping on mobile
                quality: 0.8,
                base64: Platform.OS === 'web', // Request base64 on web for cropping
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                
                if (Platform.OS === 'web') {
                    // On web, show cropper first
                    setTempImageUri(asset.uri);
                    setShowCropper(true);
                } else {
                    // On mobile, use the cropped result directly
                    setProfilePictureUri(asset.uri);
                    setProfilePictureMimeType(asset.mimeType || 'image/jpeg');
                    if ((asset as any).base64) {
                        setProfilePictureBase64((asset as any).base64);
                    } else {
                        setProfilePictureBase64(null);
                    }
                    setIsProfilePictureChanged(true);
                }
            }
        } catch (error: any) {
            console.error('Error picking profile picture:', error);
            Alert.alert('Image Selection Error', 'Could not select image. Please try again.');
        }
    };

    // Handle cropped image from web cropper
    const handleCroppedImage = (croppedImageUri: string, croppedBase64: string) => {
        setProfilePictureUri(croppedImageUri);
        setProfilePictureMimeType('image/jpeg'); // Cropper outputs JPEG
        setProfilePictureBase64(croppedBase64);
        setIsProfilePictureChanged(true);
        setShowCropper(false);
        setTempImageUri(null);
    };

    // Handle cropper cancel
    const handleCropperCancel = () => {
        setShowCropper(false);
        setTempImageUri(null);
    };

    const handleSave = async () => {
        if (!userId || isSaving) return;
        setIsSaving(true);

        // Simple validation
        if (!firstName.trim() || !lastName.trim() || !username.trim()) {
            Alert.alert("Missing Info", "First Name, Last Name, and Username are required.");
            setIsSaving(false);
            return;
        }

        // Username validation
        if (username.trim() !== musicLoverProfile?.username) {
            // Only check if username has changed
            if (/\s/.test(username.trim())) {
                Alert.alert("Invalid Username", "Username cannot contain spaces.");
                setIsSaving(false);
                return;
            }

            // Check if username already exists
            try {
                const { exists, error } = await checkUsernameExists(username.trim());
                if (error) {
                    Alert.alert("Error", "Could not validate username. Please try again.");
                    setIsSaving(false);
                    return;
                }
                if (exists) {
                    Alert.alert("Username Taken", "This username is already taken. Please choose another.");
                    setIsSaving(false);
                    return;
                }
            } catch (error) {
                Alert.alert("Error", "Could not validate username. Please try again.");
                setIsSaving(false);
                return;
            }
        }

        try {
            // Process age if provided
            const ageNumber = age ? parseInt(age) : null;
            if (ageNumber !== null && (isNaN(ageNumber) || ageNumber < 1 || ageNumber > 120)) {
                Alert.alert("Invalid Age", "Please enter a valid age between 1 and 120.");
                setIsSaving(false);
                return;
            }

            // Prepare the update object with only the text fields for location
            // as required by the database schema
            const updates = {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                username: username.trim(),
                age: ageNumber,
                // Only save the text values for locations
                country: country || null,
                state: state || null,
                city: city || null,
                // Bio data
                bio: bioDetails,
            };

            console.log('[EditUserProfile] Attempting to save profile (non-image data) with data:', JSON.stringify(updates));

            // Update profile in the database
            const { error: initialProfileUpdateError } = await supabase
                .from('music_lover_profiles')
                .update(updates)
                .eq('user_id', userId);

            if (initialProfileUpdateError) {
                console.error("[EditUserProfile] Error during initial profile update (non-image data):", initialProfileUpdateError);
                throw initialProfileUpdateError; // Re-throw to be caught by the main try-catch
            }
            console.log("[EditUserProfile] Initial profile update (non-image data) successful.");

            // If profile picture was changed, upload it
            if (isProfilePictureChanged && profilePictureUri) {
                try {
                    // Determine extension for the filename path in Supabase
                    let extHint = profilePictureUri.split('.').pop()?.toLowerCase().split('?')[0];
                    if (extHint && (extHint.length > 5 || !/^[a-zA-Z0-9]+$/.test(extHint))) {
                        extHint = undefined; // Unreliable extension
                    }
                    if (extHint === 'jpg') extHint = 'jpeg';

                    let finalMimeType = getCleanImageMimeType(profilePictureMimeType || undefined); // Mime type from picker
                    if (!finalMimeType && extHint) { // Fallback to extension if picker mimeType is bad
                        finalMimeType = getCleanImageMimeType(`image/${extHint}`);
                    }
                    if (!finalMimeType) { // Absolute fallback
                        finalMimeType = 'image/jpeg';
                        console.warn(`[EditUserProfile] Could not determine clean MIME for profile pic. Defaulting to ${finalMimeType}. Picker: ${profilePictureMimeType}, URI: ${profilePictureUri.substring(0,100)}`);
                    }

                    let finalFileExtension = 'jpg';
                    const typeParts = finalMimeType.split('/');
                    if (typeParts.length === 2 && typeParts[0] === 'image' && typeParts[1]) {
                        finalFileExtension = typeParts[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
                    }

                    const cleanFileName = `${userId}-profile-${Date.now()}`.replace(/[^a-zA-Z0-9-]/g, '_');
                    const finalFileName = `${cleanFileName}.${finalFileExtension}`;
                    const filePath = `profiles/${finalFileName}`;

                    let fileDataArrayBuffer: ArrayBuffer;
                    let actualMimeTypeForUpload = finalMimeType;

                    if (Platform.OS === 'web') {
                        console.log(`[EditUserProfile WEB] Processing URI: ${profilePictureUri.substring(0,100)}...`);
                        if (profilePictureBase64) {
                            fileDataArrayBuffer = decode(profilePictureBase64);
                            // The profilePictureMimeType from picker should be used if base64 is present
                            const cleanedPickerMimeType = getCleanImageMimeType(profilePictureMimeType || undefined);
                            if (cleanedPickerMimeType) actualMimeTypeForUpload = cleanedPickerMimeType;

                        } else if (profilePictureUri.startsWith('data:')) { 
                            const base64Data = profilePictureUri.split(',')[1];
                            if (!base64Data) throw new Error("Invalid data URI format for web upload (no data).");
                            fileDataArrayBuffer = decode(base64Data);
                            const dataUriMimeType = profilePictureUri.match(/data:(.*?);base64/)?.[1];
                            if (dataUriMimeType) {
                                const cleanedDataUriMimeType = getCleanImageMimeType(dataUriMimeType);
                                if (cleanedDataUriMimeType) actualMimeTypeForUpload = cleanedDataUriMimeType;
                            }
                        } else if (profilePictureUri) { 
                            console.warn("[EditUserProfile WEB] Base64 not available, attempting to fetch URI for web.");
                            const response = await fetch(profilePictureUri);
                            if (!response.ok) throw new Error(`Failed to fetch profile picture URI for web: ${response.statusText}`);
                            fileDataArrayBuffer = await response.arrayBuffer();
                            const contentTypeHeader = response.headers.get('content-type');
                            if (contentTypeHeader) {
                                const cleanedHeaderMimeType = getCleanImageMimeType(contentTypeHeader);
                                if (cleanedHeaderMimeType) actualMimeTypeForUpload = cleanedHeaderMimeType;
                            }
                        } else {
                            throw new Error('Web image data is missing (no base64 or URI).');
                        }
                    } else { // Native
                        console.log(`[EditUserProfile NATIVE] Processing URI: ${profilePictureUri}`);
                        const fileBase64 = await FileSystem.readAsStringAsync(profilePictureUri, {
                            encoding: FileSystem.EncodingType.Base64,
                        });
                        if (!fileBase64) throw new Error ('Failed to read image as base64 (Native).');
                        fileDataArrayBuffer = decode(fileBase64);
                        // For native, trust the picker's mime type more directly
                        const cleanedNativePickerMimeType = getCleanImageMimeType(profilePictureMimeType || undefined);
                        if (cleanedNativePickerMimeType) {
                            actualMimeTypeForUpload = cleanedNativePickerMimeType;
                        } else {
                            actualMimeTypeForUpload = finalMimeType; // fallback to URI derived if picker was bad
                        }
                    }

                    if (!fileDataArrayBuffer || fileDataArrayBuffer.byteLength === 0) {
                        throw new Error('Image data is empty or invalid after processing.');
                    }
                    
                    if (!actualMimeTypeForUpload) actualMimeTypeForUpload = 'image/jpeg'; // Final safety net

                    // Upload to storage
                    console.log(`[EditUserProfile] Uploading to Supabase path: ${filePath}, contentType: ${actualMimeTypeForUpload}`);
                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('profile-pictures')
                        .upload(filePath, fileDataArrayBuffer, {
                            contentType: actualMimeTypeForUpload,
                            cacheControl: '3600',
                            upsert: false,
                        });

                    if (uploadError) {
                        console.error('[EditUserProfile] Error uploading profile picture:', uploadError);
                        Alert.alert("Image Upload Warning", "Profile saved but image upload failed. You can try updating your picture later.");
                    } else if (uploadData?.path) {
                        // Get public URL
                        const { data: urlData } = supabase.storage
                            .from('profile-pictures')
                            .getPublicUrl(uploadData.path);
                        
                        const publicUrl = urlData?.publicUrl;

                        if (publicUrl) {
                            // Update the profile with the new image URL
                            const { error: updateError } = await supabase
                                .from('music_lover_profiles')
                                .update({ profile_picture: publicUrl }) // Store the public URL
                                .eq('user_id', userId);
                                
                            if (updateError) {
                                console.error('[EditUserProfile] Error updating profile with new image URL:', updateError);
                            }
                        } else {
                             console.error('[EditUserProfile] Failed to get public URL for uploaded image.');
                             Alert.alert("Image Upload Warning", "Image uploaded, but could not retrieve its URL. Profile picture may not update immediately.");
                        }
                    } else {
                        console.error('[EditUserProfile] Upload succeeded but no path returned from Supabase.');
                        Alert.alert("Image Upload Warning", "Image uploaded, but path was not returned. Profile picture may not update.");
                    }
                } catch (imageError: any) {
                    console.error('[EditUserProfile] Error processing image:', imageError);
                    Alert.alert("Image Processing Error", `Could not process image for upload: ${imageError.message}`);
                }
            }

            Alert.alert("Success", "Profile updated successfully!");
            await refreshSessionData?.(); // Refresh session to get updated profile in context
            navigation.goBack();

        } catch (error: any) {
            console.error("[EditUserProfile] Error updating profile:", error);
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
            {/* Header with save button */}
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Feather name="arrow-left" size={24} color={APP_CONSTANTS.COLORS.PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <TouchableOpacity 
                    style={styles.saveButton}
                    onPress={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>
            
            {/* Content */}
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Profile Picture Section */}
                <View style={styles.profilePicSection}>
                    {profilePictureUri ? (
                        <Image 
                            source={{ uri: profilePictureUri }} 
                            style={styles.profilePicture} 
                        />
                    ) : (
                        <View style={styles.profilePicPlaceholder}>
                            <Feather name="user" size={40} color={APP_CONSTANTS.COLORS.PRIMARY_DARK} />
                        </View>
                    )}
                    <TouchableOpacity 
                        style={styles.changePhotoButton}
                        onPress={handleProfilePicPick}
                    >
                        <Feather name="camera" size={16} color="white" style={styles.buttonIcon} />
                        <Text style={styles.changePhotoText}>
                            {profilePictureUri ? 'Change Photo' : 'Add Photo'}
                        </Text>
                    </TouchableOpacity>
                </View>
                
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
                    placeholder="Username"
                    value={username}
                    onChangeText={setUsername}
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <TextInput
                    style={styles.input}
                    placeholder="Age (Optional)"
                    value={age}
                    onChangeText={(text) => setAge(text.replace(/\D/g, ''))}
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={3}
                />
                
                <Text style={styles.sectionTitle}>Location</Text>
                
                {/* Country Picker */}
                <Text style={styles.pickerLabel}>Country</Text>
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={countryCode}
                        onValueChange={handleCountryChange}
                        style={styles.picker}
                    >
                        <Picker.Item label="Select a country..." value="" />
                        {countries.map((country) => (
                            <Picker.Item 
                                key={country.isoCode} 
                                label={country.name} 
                                value={country.isoCode} 
                            />
                        ))}
                    </Picker>
                </View>
                
                {/* State Picker - Only show if country is selected and not Singapore */}
                {countryCode && countryCode !== 'SG' && (
                    <>
                        <Text style={styles.pickerLabel}>State/Province</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={stateCode}
                                onValueChange={handleStateChange}
                                style={styles.picker}
                                enabled={states.length > 0}
                            >
                                <Picker.Item label="Select a state..." value="" />
                                {states.map((state) => (
                                    <Picker.Item 
                                        key={state.isoCode} 
                                        label={state.name} 
                                        value={state.isoCode} 
                                    />
                                ))}
                            </Picker>
                        </View>
                    </>
                )}
                
                {/* City Picker - Only show if state is selected */}
                {stateCode && (
                    <>
                        <Text style={styles.pickerLabel}>City</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={cityCode}
                                onValueChange={handleCityChange}
                                style={styles.picker}
                                enabled={cities.length > 0}
                            >
                                <Picker.Item label="Select a city..." value="" />
                                {cities.map((city) => (
                                    <Picker.Item 
                                        key={city.name} 
                                        label={city.name} 
                                        value={city.name} 
                                    />
                                ))}
                            </Picker>
                        </View>
                    </>
                )}

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
            
            {/* Web Image Cropper */}
            {Platform.OS === 'web' && (
                <ImageCropper
                    visible={showCropper}
                    imageUri={tempImageUri || ''}
                    aspectRatio={[4, 5]} // 4:5 aspect ratio for profile picture
                    onCrop={handleCroppedImage}
                    onCancel={handleCropperCancel}
                />
            )}
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    centeredLoader: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#F9FAFB' 
    },
    container: { 
        flex: 1, 
        backgroundColor: '#F9FAFB' 
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
    },
    backButton: {
        padding: 8,
    },
    saveButton: {
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    scrollView: { 
        flex: 1 
    },
    scrollContent: { 
        padding: 20 
    },
    profilePicSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    profilePicture: {
        width: 100,
        height: 125,
        borderRadius: 12,
        marginBottom: 12,
        backgroundColor: APP_CONSTANTS.COLORS.BORDER_LIGHT,
        borderWidth: 2,
        borderColor: APP_CONSTANTS.COLORS.PRIMARY_LIGHT,
    },
    profilePicPlaceholder: {
        width: 100,
        height: 125,
        borderRadius: 12,
        backgroundColor: APP_CONSTANTS.COLORS.BORDER_LIGHT + '80',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: APP_CONSTANTS.COLORS.BORDER,
    },
    changePhotoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    buttonIcon: {
        marginRight: 8,
    },
    changePhotoText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
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
    pickerLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6B7280',
        marginBottom: 8,
    },
    pickerContainer: {
        backgroundColor: 'white',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        marginBottom: 16,
        overflow: 'hidden',
    },
    picker: {
        width: '100%',
        height: Platform.OS === 'ios' ? 180 : 50,
        color: '#1F2937',
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