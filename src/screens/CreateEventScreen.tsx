import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Image,
  Alert, Platform, ActivityIndicator, Switch, KeyboardAvoidingView
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as FileSystem from "expo-file-system";
import { Buffer } from "buffer";
import { Picker } from '@react-native-picker/picker';
import { supabase } from "../lib/supabase"; // Using common path convention
import { useAuth } from "../hooks/useAuth";   // Using common path convention
import { useNavigation } from "@react-navigation/native";
import { decode } from 'base64-arraybuffer'; // Add import for base64 decoding
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import ImageCropper from '../components/ImageCropper'; // Add ImageCropper
import { getCurrencyForCountry, getCurrencySymbol } from '../utils/currencyUtils'; // Add currency utilities

// Navigation Type definitions
type OrganizerTabParamList = { Posts: undefined; Create: undefined; OrganizerProfile: undefined; };
type CreateEventNavigationProp = NativeStackNavigationProp<OrganizerTabParamList, 'Create'>;

// When country is Singapore, city is always Singapore (like MusicLoverSignUpFlow — even after expanding to other countries)
const SINGAPORE_OPTION = { isoCode: 'SG', name: 'Singapore' };

// Event Type Definitions
const eventTypeOptions = [ { label: 'Select Event Type...', value: '', color: '#9CA3AF' }, { label: 'Party', value: 'PARTY' }, { label: 'Live Band (Restaurant)', value: 'LIVE_BAND_RESTAURANT' }, { label: 'DJ Set (Restaurant)', value: 'DJ_SET_RESTAURANT' }, { label: 'DJ Set (Event)', value: 'DJ_SET_EVENT' }, { label: 'Club', value: 'CLUB' }, { label: 'Dance Performance', value: 'DANCE_PERFORMANCE' }, { label: 'Dance Class', value: 'DANCE_CLASS' }, { label: 'Music Performance', value: 'MUSIC_PERFORMANCE' }, { label: 'Orchestra', value: 'ORCHESTRA' }, { label: 'Advertisement Only', value: 'ADVERTISEMENT_ONLY' }, ] as const;
type EventTypeValue = typeof eventTypeOptions[number]['value'];
const TICKETED_EVENT_TYPES: EventTypeValue[] = ['PARTY', 'DJ_SET_EVENT', 'DANCE_PERFORMANCE', 'DANCE_CLASS', 'MUSIC_PERFORMANCE', 'ORCHESTRA'];
const RESERVATION_EVENT_TYPES: EventTypeValue[] = ['LIVE_BAND_RESTAURANT', 'DJ_SET_RESTAURANT', 'CLUB'];

// Component State Interfaces
interface FormState {
    title: string;
    description: string;
    location: string; // Detailed address input by organizer
    artists: string;
    songs: string;
    genres: string;
    eventType: EventTypeValue;
    bookingMode: 'yes' | 'no';
    maxTickets: string;
    maxReservations: string;
    ticketPrice: string;
    passFeeToUser: boolean;
    // New structured location fields for pickers and filtering
    countryCode: string;
    countryName: string;
    stateCode: string;
    stateName: string;
    cityName: string;
}
interface ImageAsset { uri: string; mimeType?: string; fileName?: string; }

// Helper function to get a clean, single image MIME type
const getCleanImageMimeType = (rawMimeType?: string): string | undefined => {
  if (!rawMimeType || typeof rawMimeType !== 'string') return undefined;

  const knownSimpleTypes = ['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'];
  
  // First, check if rawMimeType is already one of the known simple types
  if (knownSimpleTypes.includes(rawMimeType)) {
    return rawMimeType;
  }

  // If it's a compound string, try to extract one of the known types
  for (const type of knownSimpleTypes) {
    if (rawMimeType.includes(type)) {
      return type; // Return the first known type found
    }
  }
  
  // Fallback for simple image types not in the known list but correctly formatted
  // This part is less critical if the above extraction works for known types.
  if (rawMimeType.startsWith('image/') && !rawMimeType.includes(',')) {
      // For now, we rely on the knownSimpleTypes for robust extraction from compound strings.
      // If it's a simple 'image/customtype' not in our list, it might not be caught here
      // unless it was an exact match at the beginning.
  }

  return undefined; // If no known type is found or extracted
};

const CreateEventScreen: React.FC = () => {
  const navigation = useNavigation<CreateEventNavigationProp>();
  const { session, organizerProfile, loading: authIsLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState<FormState>({
    title: "",
    description: "",
    location: "", // User typed location
    artists: "",
    songs: "",
    genres: "",
    eventType: '',
    bookingMode: 'yes',
    maxTickets: '',
    maxReservations: '',
    ticketPrice: '',
    passFeeToUser: true,
    // Default to Singapore for launch (Singapore-only); when country is Singapore, city is Singapore
    countryCode: 'SG',
    countryName: 'Singapore',
    stateCode: 'SG-01',
    stateName: 'Singapore',
    cityName: 'Singapore',
  });
  const [eventDate, setEventDate] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(19, 0, 0, 0); return d; });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [imageAssets, setImageAssets] = useState<ImageAsset[]>([]);

  // Web cropping state
  const [showCropper, setShowCropper] = useState(false);
  const [tempImageUri, setTempImageUri] = useState<string | null>(null);

  // Location: when country is SG, city is always Singapore (no city dropdown). Other countries use cities list when we expand.
  const [countries, setCountries] = useState<any[]>([SINGAPORE_OPTION]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);

  // Pre-fill capacity for F&B organizers
  useEffect(() => {
    if (organizerProfile && organizerProfile.business_type === 'F&B' && organizerProfile.capacity) {
      // Determine if it should be tickets or reservations based on a default or initial eventType
      const bookingType = derivedBookingType();
      if (bookingType === 'RESERVATION') {
          setFormState(prev => ({
              ...prev,
              maxReservations: organizerProfile.capacity!.toString(),
          }));
      }
      // Keep maxTickets empty unless a ticketed event type is selected.
    }
  }, [organizerProfile]);

  const derivedBookingType = useCallback((): 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null => { if (formState.bookingMode === 'no' || formState.eventType === 'ADVERTISEMENT_ONLY') return 'INFO_ONLY'; if (TICKETED_EVENT_TYPES.includes(formState.eventType)) return 'TICKETED'; if (RESERVATION_EVENT_TYPES.includes(formState.eventType)) return 'RESERVATION'; return null; }, [formState.eventType, formState.bookingMode]);
  
  // Updated handleChange to handle new location fields indirectly via specific handlers
  const handleChange = (name: keyof Omit<FormState, 'countryCode' | 'countryName' | 'stateCode' | 'stateName' | 'cityName'>, value: string | boolean | EventTypeValue) => {
    setFormState((prev) => ({ ...prev, [name]: value }));
    if (name === 'eventType') {
      const newEventType = value as EventTypeValue;
      const newBookingMode = newEventType === 'ADVERTISEMENT_ONLY' ? 'no' : 'yes';
      setFormState(prev => ({
        ...prev,
        eventType: newEventType,
        bookingMode: newBookingMode,
        // Pre-fill capacity when an F&B user selects a relevant event type
        maxTickets: TICKETED_EVENT_TYPES.includes(newEventType) ? (organizerProfile?.capacity?.toString() ?? '') : '',
        maxReservations: RESERVATION_EVENT_TYPES.includes(newEventType) ? (organizerProfile?.capacity?.toString() ?? '') : '',
        ticketPrice: TICKETED_EVENT_TYPES.includes(newEventType) ? prev.ticketPrice : '',
      }));
    }
    if (name === 'bookingMode' && value === 'no') {
      setFormState(prev => ({
        ...prev,
        bookingMode: 'no',
        // Clear booking details if booking is disabled
        maxTickets: '',
        maxReservations: '',
        ticketPrice: '',
      }));
    }
  };

  // Location Picker Handlers
  const handleCountrySelect = (countryCode: string) => {
    if (countryCode === formState.countryCode) return;
    const selectedCountry = countries.find(c => c.isoCode === countryCode);
    const isSingapore = countryCode === 'SG';
    setFormState(prev => ({
      ...prev,
      countryCode: countryCode,
      countryName: selectedCountry?.name || '',
      stateCode: isSingapore ? 'SG-01' : '',
      stateName: isSingapore ? 'Singapore' : '',
      cityName: isSingapore ? 'Singapore' : '' // When country is Singapore, city is always Singapore (even after expanding)
    }));
  };

  const handleStateSelect = (stateCode: string) => {
    if (stateCode === formState.stateCode) return;
    const selectedState = states.find(s => s.isoCode === stateCode);
    setFormState(prev => ({
      ...prev,
      stateCode: stateCode,
      stateName: selectedState?.name || '',
      cityName: '' // Reset city
    }));
  };

  const handleCitySelect = (cityName: string) => {
    if (cityName === formState.cityName) return;
    setFormState(prev => ({ ...prev, cityName: cityName }));
  };

  // --- Singapore-only launch: no country-state-city loaded. Uncomment below when expanding to other countries. ---
  // useEffect(() => {
  //   let cancelled = false;
  //   getCountryStateCity().then(({ Country }) => {
  //     if (!cancelled) setCountries(Country.getAllCountries());
  //   });
  //   return () => { cancelled = true; };
  // }, []);

  useEffect(() => {
    if (formState.countryCode === 'SG') {
      setStates([]);
      setCities([]); // When country is Singapore, city is always Singapore — no dropdown (like MusicLoverSignUpFlow)
      setFormState(prev => ({ ...prev, stateCode: 'SG-01', stateName: 'Singapore', cityName: 'Singapore' }));
      return;
    }
    // When expanding to other countries: load states/cities from getCountryStateCity()
  }, [formState.countryCode]);

  useEffect(() => {
    if (formState.countryCode === 'SG' && formState.stateCode === 'SG-01') {
      setFormState(prev => (prev.cityName === 'Singapore' ? prev : { ...prev, cityName: 'Singapore' }));
    }
    // When expanding: load cities from getCountryStateCity() for non-SG countries
  }, [formState.countryCode, formState.stateCode]);


  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date | undefined) => {
    if (Platform.OS === 'web') {
      if (selectedDate) {
        const newEventDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 
          eventDate.getHours(), eventDate.getMinutes(), 0, 0);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Compare against the start of today

        if (new Date(newEventDate.setHours(0, 0, 0, 0)) >= today) {
          setEventDate(newEventDate);
        } else {
          Alert.alert("Invalid Date", "The selected date cannot be in the past.");
        }
      }
      // For web, don't hide picker. User clicks "Done".
      return;
    }

    // Mobile implementation
    const currentDate = selectedDate || eventDate;
    setShowDatePicker(Platform.OS === 'ios');
    if (event.type === 'set' && selectedDate) {
      setShowDatePicker(false);
      const newEventDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(),
        eventDate.getHours(), eventDate.getMinutes(), 0, 0);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Compare against the start of today

      if (new Date(newEventDate.setHours(0, 0, 0, 0)) >= today) {
        setEventDate(newEventDate);
      } else {
        Alert.alert("Invalid Date", "The selected date cannot be in the past.");
      }
    } else if (event.type === 'dismissed') {
      setShowDatePicker(false);
    }
  };

  const onTimeChange = (event: DateTimePickerEvent, selectedTime?: Date | undefined) => { 
    if (Platform.OS === 'web') {
      // On web, only update the time when user changes the input; close picker only when they tap "Done"
      if (selectedTime) {
        const newEventDate = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), 
          selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
        if (newEventDate > new Date()) {
          setEventDate(newEventDate);
        } else {
          Alert.alert("Invalid Time", "The selected time must be in the future for the chosen date.");
        }
      }
      return;
    }

    // Mobile implementation
    const currentTime = selectedTime || eventDate; 
    setShowTimePicker(Platform.OS === 'ios'); 
    if (event.type === 'set' && selectedTime) { 
      setShowTimePicker(false); 
      const newEventDate = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), 
        selectedTime.getHours(), selectedTime.getMinutes(), 0, 0); 
      if (newEventDate > new Date()) { 
        setEventDate(newEventDate); 
      } else { 
        Alert.alert("Invalid Time", "The selected time must be in the future for the chosen date."); 
      } 
    } else if (event.type === 'dismissed') { 
      setShowTimePicker(false); 
    } 
  };

  const formatDate = (date: Date): string => date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const formatTime = (date: Date): string => date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true });

   const pickImages = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert("Permission Required", "Permission to access photos is needed."); return; }
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: Platform.OS !== 'web', // Only use built-in editing on mobile
                aspect: Platform.OS !== 'web' ? [1, 1] : undefined, // Enforce 1:1 aspect ratio for cropping on mobile
                quality: 0.7,
                allowsMultipleSelection: Platform.OS !== 'web', // Only allow multiple on mobile for now
                base64: true, // Request base64 on BOTH web and mobile for consistent handling
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                if (Platform.OS === 'web') {
                    // On web, show cropper for the first image
                    const asset = result.assets[0];
                    setTempImageUri(asset.uri);
                    setShowCropper(true);
                } else {
                    // On mobile, use the cropped results directly
                    const maxToAdd = 3 - imageAssets.length;
                    const newAssets = result.assets.slice(0, maxToAdd);
                    if (result.assets.length > maxToAdd) { Alert.alert("Limit Reached",`Added ${newAssets.length} image(s). Max 3 total.`); }
                    const assetsToAdd: ImageAsset[] = newAssets.map(a => {
                        const cleanMimeType = getCleanImageMimeType(a.mimeType);

                        // Use base64 to construct data URI for BOTH web and mobile
                        const uri = (a as any).base64 && cleanMimeType
                            ? `data:${cleanMimeType};base64,${(a as any).base64}`
                            : a.uri;
                        
                        // The mimeType for the ImageAsset should be the one uploadSingleImage will use.
                        // If cleanMimeType is undefined (meaning original was complex/unknown), 
                        // uploadSingleImage will rely on 'ext' from the original a.uri.
                        // So, we pass cleanMimeType if available, otherwise the original a.mimeType.
                        const effectiveMimeType = cleanMimeType || a.mimeType;

                        // Make sure fileName is either string or undefined, not null
                        const fileName = a.fileName || `image-${Date.now()}`;
                        return { uri, mimeType: effectiveMimeType, fileName };
                    });
                    setImageAssets(p => [...p, ...assetsToAdd]);
                }
            }
        } catch (e) { console.error("Image pick error:", e); Alert.alert("Image Error","Could not select images."); }
    };

    // Handle cropped image from web cropper
    const handleCroppedImage = (croppedImageUri: string, croppedBase64: string) => {
        if (imageAssets.length >= 3) {
            Alert.alert("Limit Reached", "You can only have up to 3 images.");
            setShowCropper(false);
            setTempImageUri(null);
            return;
        }

        const newAsset: ImageAsset = {
            uri: croppedImageUri,
            mimeType: 'image/jpeg', // Cropper outputs JPEG
            fileName: `image-${Date.now()}.jpg`,
        };
        
        setImageAssets(p => [...p, newAsset]);
        setShowCropper(false);
        setTempImageUri(null);
    };

    // Handle cropper cancel
    const handleCropperCancel = () => {
        setShowCropper(false);
        setTempImageUri(null);
    };
   const removeImage = (index: number) => { setImageAssets(p => { const n = [...p]; n.splice(index, 1); return n; }); };
   const base64ToArrayBuffer = (base64: string): ArrayBuffer => { 
     try { 
       // For React Native, use a more robust base64 to ArrayBuffer conversion
       const binaryString = atob(base64);
       const bytes = new Uint8Array(binaryString.length);
       for (let i = 0; i < binaryString.length; i++) {
         bytes[i] = binaryString.charCodeAt(i);
       }
       return bytes.buffer;
     } catch(e) { 
       console.error("Base64 Err:", e); 
       throw new Error("Failed image process."); 
     } 
   };
   const uploadSingleImage = async (userId: string, asset: ImageAsset): Promise<string | null> => { 
     const { uri, mimeType: assetMimeTypeFromPicker, fileName: originalFileName } = asset; 
     try { 
       let extHint = uri.split('.').pop()?.toLowerCase().split('?')[0];
       if (extHint && (extHint.length > 5 || !/^[a-zA-Z0-9]+$/.test(extHint))) {
           extHint = undefined;
       }
       if (extHint === 'jpg') extHint = 'jpeg';

       let finalMimeType = getCleanImageMimeType(assetMimeTypeFromPicker);
       if (!finalMimeType && extHint) {
           finalMimeType = getCleanImageMimeType(`image/${extHint}`);
       }
       if (!finalMimeType) {
           finalMimeType = 'image/jpeg';
           console.warn(`[ImageUpload] Could not determine clean MIME type for URI ${uri.substring(0,100)}. Defaulting to ${finalMimeType}. Picker provided: ${assetMimeTypeFromPicker}`);
       }

       let finalFileExtension = 'jpg';
       const typeParts = finalMimeType.split('/');
       if (typeParts.length === 2 && typeParts[0] === 'image' && typeParts[1]) {
           finalFileExtension = typeParts[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
       }
       
       const cleanOriginalFileName = originalFileName ? originalFileName.split('.')[0].replace(/[^a-zA-Z0-9-]/g, '_') : 'event-image';
       const fileName = `${cleanOriginalFileName}-${Date.now()}.${finalFileExtension}`;
       const filePath = `${userId}/${fileName}`; 
       
       let arrayBuffer: ArrayBuffer;
       let actualMimeTypeForUpload = finalMimeType;

       if (Platform.OS === 'web') { 
         if (uri.startsWith('data:')) {
           const base64Data = uri.split(',')[1];
           if (!base64Data) throw new Error("Invalid data URI format for web upload.");
           arrayBuffer = base64ToArrayBuffer(base64Data);
           const dataUriMimeType = uri.match(/data:(.*?);base64/)?.[1];
           if (dataUriMimeType) {
                const cleanedDataUriMimeType = getCleanImageMimeType(dataUriMimeType);
                if (cleanedDataUriMimeType) actualMimeTypeForUpload = cleanedDataUriMimeType;
           }
         } else {
           const response = await fetch(uri);
           if (!response.ok) throw new Error(`Failed to fetch web URI: ${response.status} ${response.statusText}`);
           arrayBuffer = await response.arrayBuffer();
           const contentTypeHeader = response.headers.get('content-type');
           if (contentTypeHeader) {
                const cleanedHeaderMimeType = getCleanImageMimeType(contentTypeHeader);
                if (cleanedHeaderMimeType) actualMimeTypeForUpload = cleanedHeaderMimeType;
           }
         }
         
         if (!arrayBuffer || arrayBuffer.byteLength === 0) throw new Error("Image data is empty for web upload.");
         if (!actualMimeTypeForUpload) actualMimeTypeForUpload = 'image/jpeg';
         
         const fileToUpload = new File([arrayBuffer], fileName, { type: actualMimeTypeForUpload });
         console.log(`[ImageUpload WEB] Path: ${filePath}, FileObject Type: ${fileToUpload.type}`);

         // New strategy: Use signed URL for web uploads
         const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from("event_posters")
            .createSignedUploadUrl(filePath);

        if (signedUrlError) {
            console.error("[ImageUpload WEB] Supabase Signed URL Error:", signedUrlError);
            throw new Error(`Supabase signed URL error: ${signedUrlError.message}`);
        }
        if (!signedUrlData?.signedUrl) throw new Error("No signed URL returned (WEB).");

        const uploadResponse = await fetch(signedUrlData.signedUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': fileToUpload.type, // Explicitly set Content-Type from File object
            },
            body: fileToUpload,
        });

        if (!uploadResponse.ok) {
            const errorBody = await uploadResponse.text();
            console.error("[ImageUpload WEB] Manual Fetch Upload Error:", uploadResponse.status, errorBody);
            throw new Error(`Manual fetch upload failed: ${uploadResponse.status} ${errorBody}`);
        }
        
        const { data: urlData } = supabase.storage.from("event_posters").getPublicUrl(filePath);
        return urlData?.publicUrl ?? null;

       } else { // Native
         // For mobile, use the same data URI approach as web for consistency
         console.log(`[ImageUpload NATIVE] Using data URI approach for mobile upload`);
         
         if (uri.startsWith('data:')) {
           // Handle data URI (same as web)
           const base64Data = uri.split(',')[1];
           if (!base64Data) throw new Error("Invalid data URI format for mobile upload.");
           arrayBuffer = base64ToArrayBuffer(base64Data);
           const dataUriMimeType = uri.match(/data:(.*?);base64/)?.[1];
           if (dataUriMimeType) {
                const cleanedDataUriMimeType = getCleanImageMimeType(dataUriMimeType);
                if (cleanedDataUriMimeType) actualMimeTypeForUpload = cleanedDataUriMimeType;
           }
         } else {
           // Fallback to fetch approach for non-data URIs
           const response = await fetch(uri);
           if (!response.ok) throw new Error(`Failed to fetch mobile URI: ${response.status} ${response.statusText}`);
           arrayBuffer = await response.arrayBuffer();
           const contentTypeHeader = response.headers.get('content-type');
           if (contentTypeHeader) {
                const cleanedHeaderMimeType = getCleanImageMimeType(contentTypeHeader);
                if (cleanedHeaderMimeType) actualMimeTypeForUpload = cleanedHeaderMimeType;
           }
         }
         
         if (arrayBuffer.byteLength === 0) throw new Error("Image data is empty for native upload.");
         if (!actualMimeTypeForUpload) actualMimeTypeForUpload = 'image/jpeg';

         console.log(`[ImageUpload NATIVE] ArrayBuffer size: ${arrayBuffer.byteLength} bytes`);
         console.log(`[ImageUpload NATIVE] Original MIME type from picker: ${assetMimeTypeFromPicker}`);
         console.log(`[ImageUpload NATIVE] Final MIME type for upload: ${actualMimeTypeForUpload}`);

         // Get signed URL for upload
         const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from("event_posters")
            .createSignedUploadUrl(filePath);

         if (signedUrlError) {
             console.error("[ImageUpload NATIVE] Supabase Signed URL Error:", signedUrlError);
             throw new Error(`Supabase signed URL error: ${signedUrlError.message}`);
         }
         if (!signedUrlData?.signedUrl) throw new Error("No signed URL returned (NATIVE).");

         // Upload using signed URL with ArrayBuffer directly (React Native compatible)
         const uploadResponse = await fetch(signedUrlData.signedUrl, {
             method: 'PUT',
             headers: {
                 'Content-Type': actualMimeTypeForUpload,
             },
             body: arrayBuffer,
         });

         if (!uploadResponse.ok) {
             const errorBody = await uploadResponse.text();
             console.error("[ImageUpload NATIVE] Manual Fetch Upload Error:", uploadResponse.status, errorBody);
             throw new Error(`Manual fetch upload failed: ${uploadResponse.status} ${errorBody}`);
         }
         
         const { data: urlData } = supabase.storage.from("event_posters").getPublicUrl(filePath);
         return urlData?.publicUrl ?? null;
       }
     } catch (e: any) { 
       console.error(`[ImageUpload] Error for URI ${uri.substring(0,100)}:`, e); 
       return null; 
     } 
   };
   const uploadImages = async (userId: string, assets: ImageAsset[]): Promise<string[]> => { if (!assets || assets.length === 0) return []; console.log(`Uploading ${assets.length} images...`); const uploadPromises = assets.map(asset => uploadSingleImage(userId, asset)); try { const results = await Promise.all(uploadPromises); const successfulUrls = results.filter((url): url is string => url !== null); if (successfulUrls.length < assets.length) { Alert.alert("Partial Upload Failed", `Could not upload ${assets.length - successfulUrls.length} image(s).`); } console.log(`Uploaded ${successfulUrls.length} images successfully.`); return successfulUrls; } catch (error) { console.error("Image upload batch error:", error); Alert.alert("Upload Error", "An error occurred uploading images."); return []; } };


  const validateForm = (): boolean => {
      if (!session?.user) { Alert.alert("Authentication Error", "Please log in."); return false; }
      if (!formState.title.trim()) { Alert.alert("Missing Information", "Event title is required."); return false; }
      if (eventDate <= new Date()) { Alert.alert("Invalid Date", "Event date and time must be in the future."); return false; }
      if (imageAssets.length === 0) { Alert.alert("Missing Information", "At least one event image is required."); return false; }
      if (!formState.eventType) { Alert.alert("Missing Information", "Please select an event type."); return false; }
      const currentBookingType = derivedBookingType();
      if (formState.bookingMode === 'yes') {
          if (currentBookingType === 'TICKETED') {
              // Allow 0 for unlimited tickets now
              if (!formState.maxTickets.trim() || !/^\d+$/.test(formState.maxTickets) || parseInt(formState.maxTickets, 10) < 0) {
                  Alert.alert("Invalid Input", "Enter a valid number of tickets (0 for unlimited)."); return false;
              }
              if (!formState.ticketPrice.trim() || !/^\d+(\.\d{1,2})?$/.test(formState.ticketPrice) || parseFloat(formState.ticketPrice) < 0) {
                  Alert.alert("Invalid Input", "Enter a valid ticket price (e.g., 10.00 or 0 for free)."); return false;
              }
          } else if (currentBookingType === 'RESERVATION') {
               // Allow 0 for unlimited reservations
              if (!formState.maxReservations.trim() || !/^\d+$/.test(formState.maxReservations) || parseInt(formState.maxReservations, 10) < 0) {
                  Alert.alert("Invalid Input", "Enter a valid number of reservations (0 for unlimited)."); return false;
              }
          }
      }
      return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !session?.user) return;
    const userId = session.user.id;
    setIsSubmitting(true);
    try {
      const posterUrls = await uploadImages(userId, imageAssets);
      if (posterUrls.length !== imageAssets.length && imageAssets.length > 0) {
        // Keep the alert, but consider if behavior should change if some uploads fail criticaly
        Alert.alert("Upload Issue", "Some images failed to upload. Please check and try again if needed.");
        // Depending on requirements, you might want to stop submission if posterUrls.length === 0 and imageAssets.length > 0
        if (posterUrls.length === 0 && imageAssets.length > 0) {
            setIsSubmitting(false);
            return; // Stop if no images were successfully uploaded but some were attempted
        }
      }
      const processTags = (tagString: string): string[] => { // Return string[]
        if (!tagString?.trim()) return []; // Return empty array
        const tags = tagString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0 && tag.length <= 50);
        return tags; // Return tags array (could be empty)
      };
      const finalGenres = processTags(formState.genres);
      const finalArtists = processTags(formState.artists);
      const finalSongs = processTags(formState.songs);
      const currentBookingType = derivedBookingType();
      
      const maxTicketsValue = currentBookingType === 'TICKETED' && formState.bookingMode === 'yes' ? parseInt(formState.maxTickets, 10) : null;
      const maxReservationsValue = currentBookingType === 'RESERVATION' && formState.bookingMode === 'yes' ? parseInt(formState.maxReservations, 10) : null;

      const eventData = {
        organizer_id: userId,
        title: formState.title.trim(),
        description: formState.description.trim() || null,
        event_datetime: eventDate.toISOString(),
        location_text: formState.location.trim() || null, // Keep this for detailed address
        // Add structured location data for filtering/display
        country: formState.countryName || null,
        state: formState.stateName || null,
        city: formState.cityName || null,
        poster_urls: posterUrls,
        tags_genres: finalGenres,
        tags_artists: finalArtists,
        tags_songs: finalSongs,
        event_type: formState.eventType || null,
        booking_type: currentBookingType,
        max_tickets: maxTicketsValue === 0 ? null : maxTicketsValue,
        max_reservations: maxReservationsValue === 0 ? null : maxReservationsValue,
        ticket_price: currentBookingType === 'TICKETED' && formState.bookingMode === 'yes' ? parseFloat(formState.ticketPrice) : null,
        pass_fee_to_user: currentBookingType === 'TICKETED' && formState.bookingMode === 'yes' ? formState.passFeeToUser : true,
      };
      console.log("Submitting Event Data:", eventData);
      const { data, error } = await supabase.from("events").insert(eventData).select().single();
      if (error) { throw error; }
      Alert.alert("Success!", "Your event has been created.");
      setFormState({
        title: "", description: "", location: "", artists: "", songs: "", genres: "",
        eventType: '', bookingMode: 'yes', maxTickets: '', maxReservations: '', ticketPrice: '', passFeeToUser: true,
        countryCode: '', countryName: '', stateCode: '', stateName: '', cityName: '' // Reset location fields
      });
      setImageAssets([]);
      setEventDate(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(19, 0, 0, 0); return d; });
      navigation.navigate('Posts');
    } catch (e: any) {
      console.error("Event Creation Failed:", e);
      Alert.alert("Error Creating Event", `An unexpected error occurred: ${e.message || 'Unknown error'}. Please try again.`);
    } finally { // Ensure isSubmitting is reset
      setIsSubmitting(false);
    }
  };


  // --- Render Logic ---
  if (authIsLoading) { return ( <SafeAreaView style={styles.loadingContainer}><ActivityIndicator size="large" /><Text>Loading...</Text></SafeAreaView> ); }
  if (!session) { return ( <SafeAreaView style={styles.loadingContainer}><Feather name="alert-circle" size={40} color="#F87171" /><Text style={styles.authErrorText}>Please Log In</Text><Text style={styles.authErrorSubText}>Log in as an organizer to create events.</Text></SafeAreaView> ); }

  const currentBookingType = derivedBookingType();
  const showTicketFields = formState.bookingMode === 'yes' && currentBookingType === 'TICKETED';
  const showReservationFields = formState.bookingMode === 'yes' && currentBookingType === 'RESERVATION';
  const Label = ({ children }: { children: React.ReactNode }) => ( <Text style={styles.label}>{children}</Text> );

  // Get currency info for the selected country
  const eventCurrency = formState.countryName ? getCurrencyForCountry(formState.countryName) : 'USD';
  const currencySymbol = getCurrencySymbol(eventCurrency);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <LinearGradient colors={["rgba(59, 130, 246, 0.05)", "white"]} style={styles.background}>
       <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0} >
          <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                  <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Go back"><Feather name="arrow-left" size={24} color="#3B82F6" /></TouchableOpacity>
                  <View style={styles.titleContainer}><Feather name="plus-circle" size={22} color="#60A5FA" style={styles.headerIcon} /><Text style={styles.title}>Create Event</Text></View>
                  <View style={{ width: 40 }} />
              </View>
              <Text style={styles.subtitle}>Fill in the details to host your event</Text>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.formContainer} showsVerticalScrollIndicator={false} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled" >
              <View style={styles.formGroup}><Label>Event Images (Max 3) *</Label><ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesRow}>{imageAssets.map((asset, index)=>(<View key={index} style={styles.imagePreviewContainer}><Image source={{ uri: asset.uri }} style={styles.imagePreview} accessibilityLabel={`Event image ${index + 1}`} /><TouchableOpacity style={styles.removeImageButton} onPress={() => removeImage(index)} accessibilityLabel={`Remove image ${index + 1}`}><Feather name="x-circle" size={20} color="#FFF" /></TouchableOpacity></View>))}{imageAssets.length < 3 && (<TouchableOpacity style={styles.addImageButton} onPress={pickImages} disabled={isSubmitting} accessibilityLabel="Add event image"><Feather name="image" size={24} color="#9CA3AF" /><Text style={styles.addImageText}>Add Image</Text></TouchableOpacity>)}</ScrollView>{imageAssets.length === 0 && (<Text style={styles.errorText}>Please add at least one image.</Text>)}</View>

              <View style={styles.formGroup}><Label>Event Title *</Label><TextInput style={styles.input} placeholder="Give your event a catchy name" value={formState.title} onChangeText={(text)=>handleChange("title",text)} maxLength={100} accessibilityLabel="Event Title Input"/>{!formState.title.trim() && (<Text style={styles.errorText}>Event title is required.</Text>)}</View>

              <View style={styles.formGroup}><Label>Description</Label><TextInput style={[styles.input, styles.textArea]} placeholder="What's this event about? (Lineup, details, etc.)" value={formState.description} onChangeText={(text)=>handleChange("description",text)} multiline numberOfLines={5} textAlignVertical="top" maxLength={5000} accessibilityLabel="Event Description Input"/></View>

              <View style={styles.formRow}>
                  <View style={[styles.formGroup,{flex:1,marginRight:8, marginBottom: 0}]}><Label>Date *</Label><TouchableOpacity style={styles.inputWithIconTouchable} onPress={()=>setShowDatePicker(true)} accessibilityLabel="Select Event Date" accessibilityHint={`Current date: ${formatDate(eventDate)}`} ><Feather name="calendar" size={16} color="#9CA3AF" style={styles.inputIcon} /><Text style={styles.pickerText}>{formatDate(eventDate)}</Text></TouchableOpacity></View>
                  <View style={[styles.formGroup,{flex:1,marginLeft:8, marginBottom: 0}]}><Label>Time *</Label><TouchableOpacity style={styles.inputWithIconTouchable} onPress={()=>setShowTimePicker(true)} accessibilityLabel="Select Event Time" accessibilityHint={`Current time: ${formatTime(eventDate)}`} ><Feather name="clock" size={16} color="#9CA3AF" style={styles.inputIcon} /><Text style={styles.pickerText}>{formatTime(eventDate)}</Text></TouchableOpacity></View>
              </View>
              {showDatePicker && (
                Platform.OS === 'web' ? (
                  <View style={styles.webPickerContainer}>
                    <input
                      type="date"
                      value={`${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`}
                      onChange={(e) => {
                        const dateValue = e.target.value; // YYYY-MM-DD
                        if (!dateValue) return;

                        // Manually parse to avoid timezone issues. new Date("YYYY-MM-DD") is UTC.
                        const parts = dateValue.split('-').map(Number);
                        const year = parts[0];
                        const month = parts[1] - 1; // month is 0-indexed
                        const day = parts[2];
                        const selectedDate = new Date(year, month, day);

                        onDateChange({ type: 'set' } as DateTimePickerEvent, selectedDate);
                      }}
                      style={{
                        padding: 10,
                        border: '1px solid #D1D5DB',
                        borderRadius: 8,
                        fontSize: 16,
                        width: '100%',
                        marginBottom: 10
                      }}
                    />
                    <TouchableOpacity 
                      style={{alignSelf: 'flex-end', marginTop: 5}} 
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Text style={{color: '#3B82F6', fontWeight: '500'}}>Done</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <DateTimePicker
                    testID="datePicker"
                    value={eventDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                    minimumDate={new Date()}
                  />
                )
              )}

              {showTimePicker && (
                Platform.OS === 'web' ? (
                  <View style={styles.webPickerContainer}>
                    <input
                      type="time"
                      value={`${eventDate.getHours().toString().padStart(2, '0')}:${eventDate.getMinutes().toString().padStart(2, '0')}`}
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(':').map(Number);
                        const selectedTime = new Date();
                        selectedTime.setHours(hours, minutes, 0, 0);
                        onTimeChange({ type: 'set' } as DateTimePickerEvent, selectedTime);
                      }}
                      style={{
                        padding: 10,
                        border: '1px solid #D1D5DB',
                        borderRadius: 8,
                        fontSize: 16,
                        width: '100%',
                        marginBottom: 10
                      }}
                    />
                    <TouchableOpacity 
                      style={{alignSelf: 'flex-end', marginTop: 5}} 
                      onPress={() => setShowTimePicker(false)}
                    >
                      <Text style={{color: '#3B82F6', fontWeight: '500'}}>Done</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <DateTimePicker
                    testID="timePicker"
                    value={eventDate}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onTimeChange}
                  />
                )
              )}
              {eventDate <= new Date() && (<Text style={[styles.errorText,{ marginTop: 4, marginBottom: 10 }]}>Date/Time must be in the future.</Text>)}

              <View style={styles.formGroup}><Label>Location (Street Address, Venue Name)</Label><View style={styles.inputWithIcon}><Feather name="map-pin" size={16} color="#9CA3AF" style={styles.inputIcon} /><TextInput style={styles.iconInput} placeholder="e.g., 123 Music Lane, The Grand Hall" value={formState.location} onChangeText={(text)=>handleChange("location",text)} accessibilityLabel="Event Location Input"/></View></View>
              
              {/* Country Picker */}
              <View style={styles.formGroup}>
                  <Label>Country *</Label>
                  <View style={styles.pickerContainer}>
                      <Picker
                          selectedValue={formState.countryCode}
                          onValueChange={(itemValue) => handleCountrySelect(itemValue)}
                          style={styles.picker}
                          itemStyle={styles.pickerItem}
                          accessibilityLabel="Select Country Picker"
                          prompt="Select Country"
                      >
                          <Picker.Item label="Select a country..." value="" color="#9CA3AF" />
                          {countries.map((country) => (
                              <Picker.Item key={country.isoCode} label={country.name} value={country.isoCode} />
                          ))}
                      </Picker>
                      {Platform.OS === 'ios' && formState.countryName && (
                          <View style={styles.iosPickerValueDisplayWrapper} pointerEvents="none">
                              <Text style={styles.iosPickerValueDisplayText}>Selected: {formState.countryName}</Text>
                          </View>
                      )}
                  </View>
                  {!formState.countryCode && (<Text style={styles.errorText}>Country is required.</Text>)}
              </View>

              {/* State Picker - Only show if country is selected and has states */}
              {formState.countryCode && formState.countryCode !== 'SG' && states.length > 0 && (
                  <View style={styles.formGroup}>
                      <Label>State/Province *</Label>
                      <View style={styles.pickerContainer}>
                          <Picker
                              selectedValue={formState.stateCode}
                              onValueChange={(itemValue) => handleStateSelect(itemValue)}
                              style={styles.picker}
                              itemStyle={styles.pickerItem}
                              enabled={states.length > 0}
                              accessibilityLabel="Select State/Province Picker"
                              prompt="Select State/Province"
                          >
                              <Picker.Item label="Select a state/province..." value="" color="#9CA3AF" />
                              {states.map((state) => (
                                  <Picker.Item key={state.isoCode} label={state.name} value={state.isoCode} />
                              ))}
                          </Picker>
                          {Platform.OS === 'ios' && formState.stateName && (
                              <View style={styles.iosPickerValueDisplayWrapper} pointerEvents="none">
                                  <Text style={styles.iosPickerValueDisplayText}>Selected: {formState.stateName}</Text>
                              </View>
                          )}
                      </View>
                      {!formState.stateCode && (<Text style={styles.errorText}>State/Province is required.</Text>)}
                  </View>
              )}
              
              {/* City: when country is Singapore, city is always Singapore (read-only). Otherwise show picker. */}
              {formState.countryCode === 'SG' && (
                  <View style={styles.formGroup}>
                      <Label>City *</Label>
                      <View style={styles.inputWithIcon}>
                          <Feather name="map-pin" size={16} color="#9CA3AF" style={styles.inputIcon} />
                          <TextInput
                              style={[styles.iconInput, { opacity: 0.9 }]}
                              value="Singapore"
                              editable={false}
                              accessibilityLabel="City (Singapore)"
                          />
                      </View>
                  </View>
              )}
              {formState.stateCode && formState.countryCode !== 'SG' && cities.length > 0 && (
                  <View style={styles.formGroup}>
                      <Label>City *</Label>
                      <View style={styles.pickerContainer}>
                          <Picker
                              selectedValue={formState.cityName}
                              onValueChange={(itemValue) => handleCitySelect(itemValue)}
                              style={styles.picker}
                              itemStyle={styles.pickerItem}
                              enabled={cities.length > 0}
                              accessibilityLabel="Select City Picker"
                              prompt="Select City"
                          >
                              <Picker.Item label="Select a city..." value="" color="#9CA3AF" />
                              {cities.map((city) => (
                                  <Picker.Item key={city.name} label={city.name} value={city.name} />
                              ))}
                          </Picker>
                          {Platform.OS === 'ios' && formState.cityName && (
                              <View style={styles.iosPickerValueDisplayWrapper} pointerEvents="none">
                                  <Text style={styles.iosPickerValueDisplayText}>Selected: {formState.cityName}</Text>
                              </View>
                          )}
                      </View>
                      {!formState.cityName && (<Text style={styles.errorText}>City is required.</Text>)}
                  </View>
              )}

              <View style={styles.formGroup}><Label>Event Type *</Label><View style={styles.pickerContainer}><Picker selectedValue={formState.eventType} onValueChange={(itemValue) => handleChange('eventType', itemValue as EventTypeValue)} style={styles.picker} itemStyle={styles.pickerItem} accessibilityLabel="Select Event Type Picker" prompt="Select Event Type">{eventTypeOptions.map(o=>(<Picker.Item key={o.value} label={o.label} value={o.value} enabled={o.value!==''} color={o.value === '' ? '#9CA3AF' : undefined}/>))}</Picker>{Platform.OS === 'ios' && formState.eventType && eventTypeOptions.find(o => o.value === formState.eventType) && ( 
                 <View style={styles.iosPickerValueDisplayWrapper} pointerEvents="none">
                     <Text style={styles.iosPickerValueDisplayText}>Selected: {eventTypeOptions.find(o => o.value === formState.eventType)?.label}</Text> 
                 </View>
              )}</View>{!formState.eventType && (<Text style={styles.errorText}>Please select an event type.</Text>)}</View>

              {formState.eventType && formState.eventType !== 'ADVERTISEMENT_ONLY' && (<View style={styles.formGroup}><Label>{currentBookingType==='TICKETED'?'Enable Ticket Sales?':'Enable Reservations?'}</Label><View style={styles.switchContainer}><Text style={styles.switchLabel}>{formState.bookingMode==='yes'?'Yes':'No (Info Only)'}</Text><Switch trackColor={{false:"#E5E7EB",true:"#60A5FA"}} thumbColor={formState.bookingMode==='yes'?"#3B82F6":"#f4f3f4"} ios_backgroundColor="#E5E7EB" onValueChange={(v)=>handleChange('bookingMode',v?'yes':'no')} value={formState.bookingMode==='yes'} accessibilityLabel={currentBookingType === 'TICKETED' ? 'Enable Ticket Sales Switch' : 'Enable Reservations Switch'} accessibilityHint={formState.bookingMode === 'yes' ? 'Booking enabled' : 'Booking disabled'}/></View></View>)}

              {showTicketFields && (<><View style={styles.formGroup}><Label>Number of Tickets Available *</Label><TextInput style={styles.input} placeholder="e.g., 100 (0 for unlimited)" value={formState.maxTickets} onChangeText={(t)=>handleChange("maxTickets",t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" accessibilityLabel="Number of Tickets Input"/>{(!/^\d+$/.test(formState.maxTickets)&&formState.maxTickets!==''&&(<Text style={styles.errorText}>Enter valid number (0 = unlimited).</Text>))}</View><View style={styles.formGroup}><Label>Ticket Price ({currencySymbol}) *</Label><TextInput style={styles.input} placeholder={`e.g., 25.50 (0 for free) - in ${eventCurrency}`} value={formState.ticketPrice} onChangeText={(t)=>handleChange("ticketPrice",t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" accessibilityLabel="Ticket Price Input"/>{(!/^\d+(\.\d{1,2})?$/.test(formState.ticketPrice)&&formState.ticketPrice!==''&&(<Text style={styles.errorText}>Enter valid price in {eventCurrency}.</Text>))}</View><View style={styles.formGroup}><Label>Pass $0.50 Processing Fee to User?</Label><View style={styles.switchContainer}><Text style={styles.switchLabel}>{formState.passFeeToUser?'Yes (User pays total)':'No (You absorb fee)'}</Text><Switch trackColor={{false:"#E5E7EB",true:"#60A5FA"}} thumbColor={formState.passFeeToUser?"#3B82F6":"#f4f3f4"} ios_backgroundColor="#E5E7EB" onValueChange={(v)=>handleChange('passFeeToUser',v)} value={formState.passFeeToUser} accessibilityLabel="Pass fee switch" accessibilityHint={formState.passFeeToUser ? 'User pays fee' : 'You absorb fee'}/></View></View></>)}

              {showReservationFields && (<View style={styles.formGroup}><Label>Number of Reservations Available *</Label><TextInput style={styles.input} placeholder="e.g., 50 (0 for unlimited)" value={formState.maxReservations} onChangeText={(t)=>handleChange("maxReservations",t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" accessibilityLabel="Number of Reservations Input"/>{(!/^\d+$/.test(formState.maxReservations)&&formState.maxReservations!==''&&(<Text style={styles.errorText}>Enter valid number (0 = unlimited).</Text>))}</View>)}

              <View style={styles.formGroup}><Label>Music Genres (Comma-separated)</Label><TextInput style={styles.input} placeholder="e.g., House, Techno, Disco" value={formState.genres} onChangeText={(text) => handleChange("genres", text)} accessibilityLabel="Music Genres Input" autoCapitalize="none"/></View>
              <View style={styles.formGroup}><Label>Featured Artists (Comma-separated)</Label><TextInput style={styles.input} placeholder="e.g., Daft Punk, Purple Disco Machine" value={formState.artists} onChangeText={(text) => handleChange("artists", text)} accessibilityLabel="Featured Artists Input" autoCapitalize="words"/></View>
              <View style={styles.formGroup}><Label>Featured Songs (Comma-separated)</Label><TextInput style={styles.input} placeholder="e.g., One More Time, Around the World" value={formState.songs} onChangeText={(text) => handleChange("songs", text)} accessibilityLabel="Featured Songs Input" autoCapitalize="sentences"/></View>

              <TouchableOpacity style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={isSubmitting} accessibilityLabel="Create Event Button" >{isSubmitting ? (<ActivityIndicator size="small" color="#fff" />) : (<><Feather name="check-circle" size={18} color="#fff" /><Text style={styles.submitButtonText}>Create Event</Text></>)}</TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
        
        {/* Web Image Cropper */}
        {Platform.OS === 'web' && (
            <ImageCropper
                visible={showCropper}
                imageUri={tempImageUri || ''}
                aspectRatio={[1, 1]} // 1:1 aspect ratio for event images
                onCrop={handleCroppedImage}
                onCancel={handleCropperCancel}
            />
        )}
      </LinearGradient>
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "white" },
    background: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'white' },
    authErrorText: { fontSize: 18, fontWeight: '600', color: '#DC2626', marginTop: 10, textAlign: 'center' },
    authErrorSubText: { fontSize: 14, color: '#6B7280', marginTop: 5, textAlign: 'center' },
    header: { paddingTop: Platform.OS === 'android' ? 16 : 8, paddingBottom: 12, paddingHorizontal: 16 },
    headerTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    backButton: { padding: 8 },
    titleContainer: { flexDirection: "row", alignItems: "center", flex: 1, justifyContent: 'center' },
    headerIcon: { marginRight: 8 },
    title: { fontSize: 22, fontWeight: "bold", color: "#3B82F6" },
    subtitle: { fontSize: 14, color: "#6B7280", marginTop: 4, textAlign: 'center' },
    content: { flex: 1 },
    formContainer: { paddingHorizontal: 16, paddingBottom: 80 },
    formGroup: { marginBottom: 20 },
    formRow: { flexDirection: "row", justifyContent: 'space-between', marginBottom: 20 }, // Added marginBottom
    label: { fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 8 },
    input: { borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 8, paddingHorizontal: 12, fontSize: 16, backgroundColor: "white", height: 48, color: '#1F2937' },
    textArea: { height: 120, paddingTop: 12, textAlignVertical: "top" },
    inputWithIcon: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 8, backgroundColor: "white", paddingHorizontal: 12, height: 48 },
    inputWithIconTouchable: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 8, backgroundColor: "white", paddingHorizontal: 12, height: 48, justifyContent: 'flex-start' },
    inputIcon: { marginRight: 8 },
    iconInput: { flex: 1, fontSize: 16, height: '100%', color: '#1F2937' },
    pickerText: { flex: 1, fontSize: 16, color: '#1F2937', paddingVertical: 10 },
    imagesRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 4 },
    imagePreviewContainer: { position: 'relative', marginRight: 12 },
    imagePreview: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#F3F4F6' },
    removeImageButton: { position: 'absolute', top: -8, right: -8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 15, padding: 4 },
    addImageButton: { width: 100, height: 100, borderWidth: 1, borderColor: "#D1D5DB", borderStyle: "dashed", borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#F9FAFB" },
    addImageText: { fontSize: 12, color: "#6B7280", marginTop: 8, textAlign: 'center' },
    submitButton: { backgroundColor: "#3B82F6", borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 24, height: 52 },
    submitButtonDisabled: { backgroundColor: "#9CA3AF" },
    submitButtonText: { color: "white", fontSize: 16, fontWeight: "600", marginLeft: 8 },
    errorText: { color: '#EF4444', fontSize: 12, marginTop: 4 },
    pickerContainer: { borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 8, backgroundColor: "white", height: Platform.OS === 'ios' ? undefined : 48, justifyContent: 'center', paddingHorizontal: Platform.OS === 'ios' ? 10 : 0, },
    picker: { height: Platform.OS === 'ios' ? 180 : 48, },
    pickerItem: {},
    iosPickerValueDisplayWrapper: {
        position: 'absolute',
        left: 10,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        paddingHorizontal: 12, // Same horizontal padding as input
        zIndex: -1, // Place behind the actual picker
    },
    iosPickerValueDisplayText: {
        fontSize: 16,
        color: '#1F2937',
    },
    switchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, height: 48 },
    switchLabel: { fontSize: 16, color: '#374151', marginRight: 10, flexShrink: 1 },
    webPickerContainer: {
      backgroundColor: 'white',
      padding: 15,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#D1D5DB',
      marginTop: 5,
      marginBottom: 15,
      // Add shadow for better visibility
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
});

export default CreateEventScreen;