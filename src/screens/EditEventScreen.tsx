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
import { supabase } from "../lib/supabase"; // Adjust path if needed
import { useAuth } from "../hooks/useAuth";   // Adjust path if needed
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Country, State, City } from 'country-state-city'; // Added import
import { decode } from 'base64-arraybuffer'; // Added import

// Navigation Type definitions
type OrganizerStackParamList = {
    Posts: undefined;
    Create: undefined;
    OrganizerProfile: undefined;
    EventDetail: { eventId: string };
    EditEvent: { eventId: string }; // Screen parameter
};
type EditEventScreenRouteProp = RouteProp<OrganizerStackParamList, 'EditEvent'>;
type EditEventNavigationProp = NativeStackNavigationProp<OrganizerStackParamList, 'EditEvent'>;

// Event Type Definitions (Same as CreateEventScreen)
const eventTypeOptions = [ { label: 'Select Event Type...', value: '', color: '#9CA3AF' }, { label: 'Party', value: 'PARTY' }, { label: 'Live Band (Restaurant)', value: 'LIVE_BAND_RESTAURANT' }, { label: 'DJ Set (Restaurant)', value: 'DJ_SET_RESTAURANT' }, { label: 'DJ Set (Event)', value: 'DJ_SET_EVENT' }, { label: 'Club', value: 'CLUB' }, { label: 'Dance Performance', value: 'DANCE_PERFORMANCE' }, { label: 'Dance Class', value: 'DANCE_CLASS' }, { label: 'Music Performance', value: 'MUSIC_PERFORMANCE' }, { label: 'Orchestra', value: 'ORCHESTRA' }, { label: 'Advertisement Only', value: 'ADVERTISEMENT_ONLY' }, ] as const;
type EventTypeValue = typeof eventTypeOptions[number]['value'];
const TICKETED_EVENT_TYPES: EventTypeValue[] = ['PARTY', 'DJ_SET_EVENT', 'DANCE_PERFORMANCE', 'DANCE_CLASS', 'MUSIC_PERFORMANCE', 'ORCHESTRA'];
const RESERVATION_EVENT_TYPES: EventTypeValue[] = ['LIVE_BAND_RESTAURANT', 'DJ_SET_RESTAURANT', 'CLUB'];

// Component State Interfaces
interface FormState {
    title: string;
    description: string;
    location: string; // Detailed address
    artists: string;
    songs: string;
    genres: string;
    eventType: EventTypeValue;
    bookingMode: 'yes' | 'no';
    maxTickets: string;
    maxReservations: string;
    ticketPrice: string;
    passFeeToUser: boolean;
    // New location fields
    countryCode: string;
    countryName: string;
    stateCode: string;
    stateName: string;
    cityName: string;
}
interface ImageAsset { uri: string; mimeType?: string; fileName?: string; isNew?: boolean; existingUrl?: string; base64?: string | null; } // Added isNew, existingUrl, base64

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

// Existing Event Data Structure from Supabase - ensure it includes country, state, city if they exist
interface ExistingEventData {
  id: string; organizer_id: string; title: string; description: string | null;
  event_datetime: string; location_text: string | null; poster_urls: string[];
  tags_genres: string[] | null; tags_artists: string[] | null; tags_songs: string[] | null;
  event_type: EventTypeValue | null;
  booking_type: 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null;
  max_tickets: number | null; max_reservations: number | null;
  ticket_price: number | null; pass_fee_to_user: boolean | null;
  // Add these if they are in your Supabase table for events
  country?: string | null;
  state?: string | null;
  city?: string | null;
}

// Helper to determine event status
const getEventStatus = (isoString: string | null): "Upcoming" | "Completed" | "Ongoing" => { if(!isoString)return "Upcoming";try{return new Date(isoString)>new Date()?"Upcoming":"Completed";}catch(e){return "Upcoming";}};


const EditEventScreen: React.FC = () => {
  const navigation = useNavigation<EditEventNavigationProp>();
  const route = useRoute<EditEventScreenRouteProp>();
  const { eventId } = route.params;
  const { session, loading: authIsLoading } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [formState, setFormState] = useState<FormState>({
    title: "", description: "", location: "", artists: "", songs: "", genres: "",
    eventType: '', bookingMode: 'yes', maxTickets: '', maxReservations: '',
    ticketPrice: '', passFeeToUser: true,
    countryCode: '', countryName: '', stateCode: '', stateName: '', cityName: '' // Initialize new fields
  });
  const [eventDate, setEventDate] = useState<Date>(new Date()); // Initialize, will be overwritten
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [imageAssets, setImageAssets] = useState<ImageAsset[]>([]); // Holds existing and new images

  // Location picker states
  const [countries, setCountriesList] = useState<any[]>([]); // Renamed to avoid conflict
  const [states, setStatesList] = useState<any[]>([]); // Renamed to avoid conflict
  const [cities, setCitiesList] = useState<any[]>([]); // Renamed to avoid conflict

  // Fetch Existing Event Data
  const fetchEvent = useCallback(async () => {
    if (!eventId || !session?.user) {
      setFetchError("Invalid request or not logged in.");
      setIsLoadingEvent(false);
      return;
    }
    setIsLoadingEvent(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*, country, state, city') // Ensure these are selected if they exist in your table
        .eq('id', eventId)
        .eq('organizer_id', session.user.id)
        .single();

      if (error) {
          if (error.code === 'PGRST116') {
               throw new Error("Event not found or you don't have permission to edit it.");
          }
          throw error;
      }

      const eventData = data as ExistingEventData;
      const allCountries = Country.getAllCountries();
      setCountriesList(allCountries);

      let initialCountryCode = '';
      let initialCountryName = eventData.country || '';
      if (eventData.country) {
          const foundCountry = allCountries.find(c => c.name === eventData.country);
          if (foundCountry) initialCountryCode = foundCountry.isoCode;
      }

      let initialStates: any[] = [];
      let initialStateCode = '';
      let initialStateName = eventData.state || '';
      if (initialCountryCode && eventData.state) {
          initialStates = State.getStatesOfCountry(initialCountryCode);
          setStatesList(initialStates);
          const foundState = initialStates.find(s => s.name === eventData.state);
          if (foundState) initialStateCode = foundState.isoCode;
          else if (initialCountryCode === 'SG') { // Handle SG case for pre-fill
            initialStateCode = 'SG-01';
            initialStateName = 'Singapore';
          }
      }

      let initialCities: any[] = [];
      let initialCityName = eventData.city || '';
      if (initialCountryCode && initialStateCode && eventData.city) {
          initialCities = City.getCitiesOfState(initialCountryCode, initialStateCode);
          setCitiesList(initialCities);
          // City name is directly used, no code lookup needed for pre-fill typically
      }

      setFormState({
        title: eventData.title,
        description: eventData.description ?? "",
        location: eventData.location_text ?? "",
        artists: eventData.tags_artists?.join(', ') ?? "",
        songs: eventData.tags_songs?.join(', ') ?? "",
        genres: eventData.tags_genres?.join(', ') ?? "",
        eventType: eventData.event_type ?? '',
        bookingMode: eventData.booking_type === 'INFO_ONLY' ? 'no' : 'yes',
        maxTickets: eventData.booking_type === 'TICKETED' ? (eventData.max_tickets?.toString() ?? '0') : '',
        maxReservations: eventData.booking_type === 'RESERVATION' ? (eventData.max_reservations?.toString() ?? '0') : '',
        ticketPrice: eventData.booking_type === 'TICKETED' ? (eventData.ticket_price?.toFixed(2) ?? '') : '',
        passFeeToUser: eventData.pass_fee_to_user ?? true,
        countryCode: initialCountryCode,
        countryName: initialCountryName,
        stateCode: initialStateCode,
        stateName: initialStateName,
        cityName: initialCityName,
      });

      setEventDate(new Date(eventData.event_datetime));
      setImageAssets(eventData.poster_urls.map(url => ({ uri: url, existingUrl: url, isNew: false })));

    } catch (e: any) {
      console.error("Fetch Event Error:", e);
      setFetchError(`Failed to load event: ${e.message}`);
    } finally {
      setIsLoadingEvent(false);
    }
  }, [eventId, session]);

  useFocusEffect(
    useCallback(() => {
      fetchEvent();
    }, [fetchEvent])
  );

  // --- Logic copied/adapted from CreateEventScreen ---
  const derivedBookingType = useCallback((): 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null => { if (formState.bookingMode === 'no' || formState.eventType === 'ADVERTISEMENT_ONLY') return 'INFO_ONLY'; if (TICKETED_EVENT_TYPES.includes(formState.eventType)) return 'TICKETED'; if (RESERVATION_EVENT_TYPES.includes(formState.eventType)) return 'RESERVATION'; return null; }, [formState.eventType, formState.bookingMode]);
  const handleChange = (name: keyof Omit<FormState, 'countryCode' | 'countryName' | 'stateCode' | 'stateName' | 'cityName'>, value: string | boolean | EventTypeValue) => {
    setFormState((prev) => ({ ...prev, [name]: value }));
    if (name === 'eventType') {
      const newEventType = value as EventTypeValue;
      const newBookingMode = newEventType === 'ADVERTISEMENT_ONLY' ? 'no' : 'yes';
      setFormState(prev => ({
        ...prev,
        eventType: newEventType,
        bookingMode: newBookingMode,
        maxTickets: TICKETED_EVENT_TYPES.includes(newEventType) ? prev.maxTickets : '',
        maxReservations: RESERVATION_EVENT_TYPES.includes(newEventType) ? prev.maxReservations : '',
        ticketPrice: TICKETED_EVENT_TYPES.includes(newEventType) ? prev.ticketPrice : '',
      }));
    }
    if (name === 'bookingMode' && value === 'no') {
      setFormState(prev => ({
        ...prev,
        bookingMode: 'no',
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
    setFormState(prev => ({
      ...prev,
      countryCode: countryCode,
      countryName: selectedCountry?.name || '',
      stateCode: '', 
      stateName: '',
      cityName: ''
    }));
  };

  const handleStateSelect = (stateCode: string) => {
    if (stateCode === formState.stateCode) return;
    const selectedState = states.find(s => s.isoCode === stateCode);
    setFormState(prev => ({
      ...prev,
      stateCode: stateCode,
      stateName: selectedState?.name || '',
      cityName: '' 
    }));
  };

  const handleCitySelect = (cityName: string) => {
    if (cityName === formState.cityName) return;
    setFormState(prev => ({ ...prev, cityName: cityName }));
  };

  // useEffects for location data - load all countries initially in fetchEvent
  // useEffect(() => {
  //   setCountriesList(Country.getAllCountries()); 
  // }, []);

  useEffect(() => {
    if (formState.countryCode) {
      if (formState.countryCode === 'SG') {
        setStatesList([]);
        // No need to setFormState here if already handled in handleCountrySelect or fetchEvent for initial load
        if (formState.stateCode !== 'SG-01') { // only update if not already set by fetchEvent
            setFormState(prev => ({ ...prev, stateCode: 'SG-01', stateName: 'Singapore'}));
        }
        return;
      }
      const countryStates = State.getStatesOfCountry(formState.countryCode);
      setStatesList(countryStates);
      // Don't reset state if it's already populated from fetched data and valid
      if (!countryStates.some(s => s.isoCode === formState.stateCode)) {
          setFormState(prev => ({ ...prev, stateCode: '', stateName: '', cityName: '' }));
      }
    } else {
      setStatesList([]);
      if (formState.stateCode || formState.cityName) { // only update if not already clear
        setFormState(prev => ({ ...prev, stateCode: '', stateName: '', cityName: '' }));
      }
    }
  }, [formState.countryCode, formState.stateCode]); // Added formState.stateCode to dependencies

  useEffect(() => {
    if (formState.countryCode && formState.stateCode) {
      const stateCities = City.getCitiesOfState(formState.countryCode, formState.stateCode);
      setCitiesList(stateCities);
      // Don't reset city if already populated and valid
      if (!stateCities.some(c => c.name === formState.cityName)) {
        setFormState(prev => ({ ...prev, cityName: '' }));
      }
    } else {
      setCitiesList([]);
      if (formState.cityName) { // only update if not already clear
        setFormState(prev => ({ ...prev, cityName: '' }));
      }
    }
  }, [formState.countryCode, formState.stateCode, formState.cityName]); // Added formState.cityName


  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date | undefined) => { 
    if (Platform.OS === 'web') {
      if (selectedDate) {
        const newEventDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 
          eventDate.getHours(), eventDate.getMinutes(), 0, 0);
        setEventDate(newEventDate);
      }
      setShowDatePicker(false);
      return;
    }

    // Mobile implementation
    setShowDatePicker(Platform.OS === 'ios');
    if (event.type === 'set' && selectedDate) {
      setShowDatePicker(false);
      const newEventDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(),
        eventDate.getHours(), eventDate.getMinutes(), 0, 0);
      setEventDate(newEventDate);
    } else if (event.type === 'dismissed') {
      setShowDatePicker(false);
    }
  };

  const onTimeChange = (event: DateTimePickerEvent, selectedTime?: Date | undefined) => { 
    if (Platform.OS === 'web') {
      if (selectedTime) {
        const newEventDate = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), 
          selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
        setEventDate(newEventDate);
      }
      setShowTimePicker(false);
      return;
    }

    // Mobile implementation
    setShowTimePicker(Platform.OS === 'ios');
    if (event.type === 'set' && selectedTime) {
      setShowTimePicker(false);
      const newEventDate = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(),
        selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      setEventDate(newEventDate);
    } else if (event.type === 'dismissed') {
      setShowTimePicker(false);
    }
  };

  const formatDate = (date: Date): string => date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const formatTime = (date: Date): string => date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true });

   const pickImages = async () => {
        if (imageAssets.length >= 3) {
            Alert.alert("Limit Reached", "You can only have up to 3 images.");
            return;
        }
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert("Permission Required", "Permission to access photos is needed."); return; }
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1], // Enforce 1:1 aspect ratio for cropping
                quality: 0.7,
                allowsMultipleSelection: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const assetsToAdd: ImageAsset[] = result.assets.map(a => {
                    const uri = a.uri; 
                    // Store the raw mimeType from the picker, or fallback. Crucial for web base64 uploads.
                    const assetMimeType = a.mimeType || 'image/jpeg'; 
                    const fileName = a.fileName || `image-${Date.now()}`;
                    const base64 = Platform.OS === 'web' ? (a as any).base64 : null;

                    return { uri, mimeType: assetMimeType, fileName, isNew: true, base64 };
                });
                setImageAssets(p => [...p, ...assetsToAdd]);
            }
        } catch (e) { console.error("Image pick error:", e); Alert.alert("Image Error","Could not select images."); }
    };
   const removeImage = (index: number) => {
       const imageToRemove = imageAssets[index];
       if (!imageToRemove.isNew && imageToRemove.existingUrl) {
           console.warn("Deletion of existing image from storage not implemented in this example. URL:", imageToRemove.existingUrl);
       }
       setImageAssets(p => p.filter((_, i) => i !== index)); // Correct way to remove item
   };
   const uploadSingleImage = async (userId: string, asset: ImageAsset): Promise<string | null> => {
        if (!asset.isNew || !asset.uri) return asset.existingUrl ?? null;
        
        const { uri, mimeType: assetMimeTypeFromPicker, fileName: originalFileName, base64: assetBase64 } = asset; 
        try { 
            let extHint = uri.split('.').pop()?.toLowerCase().split('?')[0];
            if (extHint && (extHint.length > 5 || !/^[a-zA-Z0-9]+$/.test(extHint))) {
                extHint = undefined;
            }
            if (extHint === 'jpg') extHint = 'jpeg'; // Normalize

            let finalMimeType = getCleanImageMimeType(assetMimeTypeFromPicker);
            if (!finalMimeType && extHint) {
                finalMimeType = getCleanImageMimeType(`image/${extHint}`);
            }
            if (!finalMimeType) {
                finalMimeType = 'image/jpeg'; 
                console.warn(`[EditEvent - ImageUpload] Could not determine clean MIME type for URI ${uri.substring(0,100)}. Defaulting to ${finalMimeType}. Picker: ${assetMimeTypeFromPicker}`);
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
                console.log(`[EditEvent WEB] Processing URI: ${uri.substring(0,100)}...`);
                if (assetBase64) {
                    arrayBuffer = decode(assetBase64);
                    const cleanedPickerMimeType = getCleanImageMimeType(assetMimeTypeFromPicker);
                    if (cleanedPickerMimeType) actualMimeTypeForUpload = cleanedPickerMimeType;
                } else if (uri.startsWith('data:')) {
                    const base64Data = uri.split(',')[1];
                    if (!base64Data) throw new Error("Invalid data URI format (WEB).");
                    arrayBuffer = decode(base64Data);
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
                if (!arrayBuffer || arrayBuffer.byteLength === 0) throw new Error("Image data empty or invalid after processing (WEB).");
                if (!actualMimeTypeForUpload) actualMimeTypeForUpload = 'image/jpeg';
                
                const fileToUpload = new File([arrayBuffer], fileName, { type: actualMimeTypeForUpload });
                console.log(`[EditEvent - ImageUpload WEB] Path: ${filePath}, FileObject Type: ${fileToUpload.type}`);

                // New strategy: Use signed URL for web uploads
                const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                    .from("event_posters")
                    .createSignedUploadUrl(filePath);

                if (signedUrlError) {
                    console.error("[EditEvent - ImageUpload WEB] Supabase Signed URL Error:", signedUrlError);
                    throw new Error(`Supabase signed URL error: ${signedUrlError.message}`);
                }
                if (!signedUrlData?.signedUrl) throw new Error("No signed URL returned (WEB).");

                const uploadResponse = await fetch(signedUrlData.signedUrl, {
                    method: 'PUT',
                    headers: {
                        // 'Authorization': `Bearer ${signedUrlData.token}`, // Token usually part of signedUrl query params for PUT
                        'Content-Type': fileToUpload.type, // Explicitly set Content-Type from File object
                    },
                    body: fileToUpload,
                });

                if (!uploadResponse.ok) {
                    const errorBody = await uploadResponse.text();
                    console.error("[EditEvent - ImageUpload WEB] Manual Fetch Upload Error:", uploadResponse.status, errorBody);
                    throw new Error(`Manual fetch upload failed: ${uploadResponse.status} ${errorBody}`);
                }
                
                // If upload is successful, get the public URL
                const { data: urlData } = supabase.storage.from("event_posters").getPublicUrl(filePath); // Use filePath used for signed URL
                return urlData?.publicUrl ?? null;

            } else { // Native
                console.log(`[EditEvent NATIVE] Processing URI: ${uri}`);
                const fileBase64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }); 
                if (!fileBase64) throw new Error("Failed to read image as base64 (Native)."); 
                arrayBuffer = decode(fileBase64); 
                if (!arrayBuffer || arrayBuffer.byteLength === 0) throw new Error("Image data empty or invalid after processing (Native)."); 

                const cleanedNativeMimeType = getCleanImageMimeType(assetMimeTypeFromPicker);
                if (cleanedNativeMimeType) {
                    actualMimeTypeForUpload = cleanedNativeMimeType;
                } else {
                    actualMimeTypeForUpload = finalMimeType; // Fallback
                }
                if (!actualMimeTypeForUpload) actualMimeTypeForUpload = 'image/jpeg'; // Final safety net

                console.log(`[EditEvent - ImageUpload NATIVE] Path: ${filePath}, ContentType: ${actualMimeTypeForUpload}`);

                const { data: uploadData, error: uploadError } = await supabase.storage.from("event_posters").upload(
                    filePath, 
                    arrayBuffer, 
                    { cacheControl: "3600", upsert: false, contentType: actualMimeTypeForUpload }
                ); 
                if (uploadError) {
                    console.error("[EditEvent - ImageUpload NATIVE] Supabase Error:", uploadError);
                    throw new Error(`Supabase upload error: ${uploadError.message}`);
                }
                if (!uploadData?.path) throw new Error("Upload succeeded but no path returned (NATIVE)."); 
                const { data: urlData } = supabase.storage.from("event_posters").getPublicUrl(uploadData.path); 
                return urlData?.publicUrl ?? null;
            }
        } catch (e: any) { 
            console.error(`[EditEvent - ImageUpload] Error for URI ${uri.substring(0,100)}:`, e); 
            return null; 
        }
    };
   const uploadImages = async (userId: string, assets: ImageAsset[]): Promise<string[]> => {
       if (!assets || assets.length === 0) return [];
       console.log(`Processing ${assets.length} images for update...`);
       const uploadPromises = assets.map(asset => uploadSingleImage(userId, asset));
       try {
           const results = await Promise.all(uploadPromises);
           const finalUrls = results.filter((url): url is string => url !== null);
           
           // Differentiate between new uploads and existing URLs that were kept
           let newImagesAttempted = 0;
           let newImagesSuccessfullyUploaded = 0;
           let existingImagesKept = 0;

           assets.forEach(asset => {
               if (asset.isNew) {
                   newImagesAttempted++;
                   // Check if the original URI (if it was a placeholder or local URI for a new image)
                   // resulted in a new public URL being generated and included in finalUrls.
                   // This is a bit tricky as direct mapping from asset.uri to finalUrl isn't straightforward
                   // if multiple uploads happen. A simpler check is just on counts if all succeed.
               }
           });

           // A more robust way to count successful *new* uploads would require tagging or mapping
           // the asset through the uploadSingleImage promise to its result.
           // For now, we compare total new assets vs. the increase in URL count beyond existing ones.

           const existingUrlsAmongFinal = finalUrls.filter(url => assets.some(a => !a.isNew && a.existingUrl === url)).length;
           newImagesSuccessfullyUploaded = finalUrls.length - existingUrlsAmongFinal;
           
           // A simpler alert if new uploads were attempted but not all were successful
           if (newImagesAttempted > 0 && newImagesSuccessfullyUploaded < newImagesAttempted) {
               Alert.alert("Partial Upload Failed", `Could not upload ${newImagesAttempted - newImagesSuccessfullyUploaded} new image(s). Existing images and any successful new uploads were kept.`);
           }

           console.log(`Finished image processing. Final URLs: ${finalUrls.length}, New uploads successful: ${newImagesSuccessfullyUploaded}/${newImagesAttempted}`);
           return finalUrls;
       } catch (error) { 
           console.error("Image update batch error:", error); 
           Alert.alert("Upload Error", "An error occurred uploading images."); 
           // Fallback to only existing URLs if batch fails
           return assets.filter(a => !a.isNew && a.existingUrl).map(a => a.existingUrl!);
       }
   };

   const validateForm = (): boolean => {
    if (!session?.user) { Alert.alert("Authentication Error", "Please log in."); return false; }
    if (!formState.title.trim()) { Alert.alert("Missing Information", "Event title is required."); return false; }
    if (eventDate <= new Date() && getEventStatus(eventDate.toISOString()) === 'Completed') {
        console.warn("Editing event date/time but it remains in the past.");
    }
    if (imageAssets.length === 0) { Alert.alert("Missing Information", "At least one event image is required."); return false; }
    if (!formState.eventType) { Alert.alert("Missing Information", "Please select an event type."); return false; }
    const currentBookingType = derivedBookingType();
    if (formState.bookingMode === 'yes') {
        if (currentBookingType === 'TICKETED') {
            if (!formState.maxTickets.trim() || !/^\d+$/.test(formState.maxTickets) || parseInt(formState.maxTickets, 10) < 0) {
                Alert.alert("Invalid Input", "Enter a valid number of tickets (0 for unlimited)."); return false;
            }
            if (!formState.ticketPrice.trim() || !/^\d+(\.\d{1,2})?$/.test(formState.ticketPrice) || parseFloat(formState.ticketPrice) < 0) {
                Alert.alert("Invalid Input", "Enter a valid ticket price (e.g., 10.00 or 0 for free)."); return false;
            }
        } else if (currentBookingType === 'RESERVATION') {
            if (!formState.maxReservations.trim() || !/^\d+$/.test(formState.maxReservations) || parseInt(formState.maxReservations, 10) < 0) {
                Alert.alert("Invalid Input", "Enter a valid number of reservations (0 for unlimited)."); return false;
            }
        }
    }
    return true;
};

   const handleSubmit = async () => {
      if (!validateForm() || !session?.user || !eventId) return;
      const userId = session.user.id;
      setIsSubmitting(true);
      try {
          const finalPosterUrls = await uploadImages(userId, imageAssets);
          if (finalPosterUrls.length === 0) { // Need at least one image
              Alert.alert("Image Error", "No images could be saved. Please add at least one image.");
              setIsSubmitting(false);
              return;
          }

          const processTags = (tagString: string): string[] => {
            if (!tagString?.trim()) return [];
            const tags = tagString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0 && tag.length <= 50);
            return tags;
          };
          const finalGenres = processTags(formState.genres);
          const finalArtists = processTags(formState.artists);
          const finalSongs = processTags(formState.songs);
          const currentBookingType = derivedBookingType();
          const maxTicketsValue = currentBookingType === 'TICKETED' && formState.bookingMode === 'yes' ? parseInt(formState.maxTickets, 10) : null;
          const maxReservationsValue = currentBookingType === 'RESERVATION' && formState.bookingMode === 'yes' ? parseInt(formState.maxReservations, 10) : null;

          const eventUpdateData = {
              title: formState.title.trim(),
              description: formState.description.trim() || null,
              event_datetime: eventDate.toISOString(),
              location_text: formState.location.trim() || null,
              // Add structured location data
              country: formState.countryName || null,
              state: formState.stateName || null,
              city: formState.cityName || null,
              poster_urls: finalPosterUrls,
              tags_genres: finalGenres,
              tags_artists: finalArtists,
              tags_songs: finalSongs,
              event_type: formState.eventType || null,
              booking_type: currentBookingType,
              max_tickets: maxTicketsValue === 0 ? null : maxTicketsValue,
              max_reservations: maxReservationsValue === 0 ? null : maxReservationsValue,
              ticket_price: currentBookingType === 'TICKETED' && formState.bookingMode === 'yes' ? parseFloat(formState.ticketPrice) : null,
              pass_fee_to_user: currentBookingType === 'TICKETED' && formState.bookingMode === 'yes' ? formState.passFeeToUser : true,
              updated_at: new Date().toISOString(),
          };

          console.log("Updating Event Data:", eventUpdateData);
          const { data, error } = await supabase
              .from("events")
              .update(eventUpdateData)
              .eq('id', eventId)
              .eq('organizer_id', userId)
              .select()
              .single();

          if (error) { throw error; }

          Alert.alert("Success!", "Your event has been updated.");
          navigation.navigate('EventDetail', { eventId: eventId });

      } catch (e: any) {
          console.error("Event Update Failed:", e);
          Alert.alert("Error Updating Event", `An unexpected error occurred: ${e.message || 'Unknown error'}. Please try again.`);
      } finally {
           setIsSubmitting(false);
      }
  };


  // --- Render Logic ---
  if (authIsLoading || isLoadingEvent) { return ( <SafeAreaView style={styles.loadingContainer}><ActivityIndicator size="large" /><Text>Loading Event...</Text></SafeAreaView> ); }
  if (fetchError) { return ( <SafeAreaView style={styles.loadingContainer}><Feather name="alert-circle" size={40} color="#F87171" /><Text style={styles.authErrorText}>Error Loading Event</Text><Text style={styles.authErrorSubText}>{fetchError}</Text><TouchableOpacity style={styles.retryButton} onPress={fetchEvent}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity></SafeAreaView> ); }
  if (!session) { return ( <SafeAreaView style={styles.loadingContainer}><Feather name="alert-circle" size={40} color="#F87171" /><Text style={styles.authErrorText}>Please Log In</Text><Text style={styles.authErrorSubText}>Log in as an organizer to edit events.</Text></SafeAreaView> ); }

  const currentBookingType = derivedBookingType();
  const showTicketFields = formState.bookingMode === 'yes' && currentBookingType === 'TICKETED';
  const showReservationFields = formState.bookingMode === 'yes' && currentBookingType === 'RESERVATION';
  const Label = ({ children }: { children: React.ReactNode }) => ( <Text style={styles.label}>{children}</Text> );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <LinearGradient colors={["rgba(59, 130, 246, 0.05)", "white"]} style={styles.background}>
       <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0} >
          <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                  <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Go back"><Feather name="arrow-left" size={24} color="#3B82F6" /></TouchableOpacity>
                  <View style={styles.titleContainer}><Feather name="edit" size={22} color="#60A5FA" style={styles.headerIcon} /><Text style={styles.title}>Edit Event</Text></View>
                  <View style={{ width: 40 }} />
              </View>
              <Text style={styles.subtitle}>Update the details for your event</Text>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.formContainer} showsVerticalScrollIndicator={false} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled" >
              {/* Event Images */}
              <View style={styles.formGroup}><Label>Event Images (Max 3) *</Label><ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesRow}>{imageAssets.map((asset, index)=>(<View key={asset.uri || index} style={styles.imagePreviewContainer}><Image source={{ uri: asset.uri }} style={styles.imagePreview} accessibilityLabel={`Event image ${index + 1}`} /><TouchableOpacity style={styles.removeImageButton} onPress={() => removeImage(index)} accessibilityLabel={`Remove image ${index + 1}`}><Feather name="x-circle" size={20} color="#FFF" /></TouchableOpacity></View>))}{imageAssets.length < 3 && (<TouchableOpacity style={styles.addImageButton} onPress={pickImages} disabled={isSubmitting} accessibilityLabel="Add event image"><Feather name="image" size={24} color="#9CA3AF" /><Text style={styles.addImageText}>Add Image</Text></TouchableOpacity>)}</ScrollView>{imageAssets.length === 0 && (<Text style={styles.errorText}>Please add at least one image.</Text>)}</View>

              {/* Title */}
              <View style={styles.formGroup}><Label>Event Title *</Label><TextInput style={styles.input} placeholder="Give your event a catchy name" value={formState.title} onChangeText={(text)=>handleChange("title",text)} maxLength={100} accessibilityLabel="Event Title Input"/>{!formState.title.trim() && (<Text style={styles.errorText}>Event title is required.</Text>)}</View>

              {/* Description */}
              <View style={styles.formGroup}><Label>Description</Label><TextInput style={[styles.input, styles.textArea]} placeholder="What's this event about? (Lineup, details, etc.)" value={formState.description} onChangeText={(text)=>handleChange("description",text)} multiline numberOfLines={5} textAlignVertical="top" maxLength={5000} accessibilityLabel="Event Description Input"/></View>

              {/* Date & Time */}
              <View style={styles.formRow}>
                  <View style={[styles.formGroup,{flex:1,marginRight:8, marginBottom: 0}]}>
                      <Label>Date *</Label>
                      <TouchableOpacity style={styles.inputWithIconTouchable} onPress={()=>setShowDatePicker(true)} accessibilityLabel="Select Event Date" accessibilityHint={`Current date: ${formatDate(eventDate)}`} >
                          <Feather name="calendar" size={16} color="#9CA3AF" style={styles.inputIcon} />
                          <Text style={styles.pickerText}>{formatDate(eventDate)}</Text>
                      </TouchableOpacity>
                  </View>
                  <View style={[styles.formGroup,{flex:1,marginLeft:8, marginBottom: 0}]}>
                      <Label>Time *</Label>
                      <TouchableOpacity style={styles.inputWithIconTouchable} onPress={()=>setShowTimePicker(true)} accessibilityLabel="Select Event Time" accessibilityHint={`Current time: ${formatTime(eventDate)}`} >
                          <Feather name="clock" size={16} color="#9CA3AF" style={styles.inputIcon} />
                          <Text style={styles.pickerText}>{formatTime(eventDate)}</Text>
                      </TouchableOpacity>
                  </View>
              </View>

              {showDatePicker && (
                  Platform.OS === 'web' ? (
                      <View style={styles.webPickerContainer}>
                          <input
                              type="date"
                              value={eventDate.toISOString().split('T')[0]}
                              onChange={(e) => {
                                  const selectedDate = new Date(e.target.value);
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

              {eventDate <= new Date() && (
                  <Text style={[styles.warningText,{ marginTop: 4, marginBottom: 10 }]}>
                      Warning: Date/Time is in the past.
                  </Text>
              )}

              {/* Location - Detailed Address */}
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

              {/* State Picker */}
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
              
              {/* City Picker */}
              {formState.stateCode && cities.length > 0 && (
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

              {/* Event Type */}
              <View style={styles.formGroup}><Label>Event Type *</Label><View style={styles.pickerContainer}><Picker selectedValue={formState.eventType} onValueChange={(itemValue) => handleChange('eventType', itemValue as EventTypeValue)} style={styles.picker} itemStyle={styles.pickerItem} accessibilityLabel="Select Event Type Picker" prompt="Select Event Type">{eventTypeOptions.map(o=>(<Picker.Item key={o.value} label={o.label} value={o.value} enabled={o.value!==''} color={o.value === '' ? '#9CA3AF' : undefined}/>))}</Picker>{Platform.OS === 'ios' && formState.eventType && eventTypeOptions.find(o => o.value === formState.eventType) && (
                <View style={styles.iosPickerValueDisplayWrapper} pointerEvents="none">
                    <Text style={styles.iosPickerValueDisplayText}>Selected: {eventTypeOptions.find(o => o.value === formState.eventType)?.label}</Text>
                </View>
              )}</View>{!formState.eventType && (<Text style={styles.errorText}>Please select an event type.</Text>)}</View>

              {/* Booking Mode Switch */}
              {formState.eventType && formState.eventType !== 'ADVERTISEMENT_ONLY' && (<View style={styles.formGroup}><Label>{currentBookingType==='TICKETED'?'Enable Ticket Sales?':'Enable Reservations?'}</Label><View style={styles.switchContainer}><Text style={styles.switchLabel}>{formState.bookingMode==='yes'?'Yes':'No (Info Only)'}</Text><Switch trackColor={{false:"#E5E7EB",true:"#60A5FA"}} thumbColor={formState.bookingMode==='yes'?"#3B82F6":"#f4f3f4"} ios_backgroundColor="#E5E7EB" onValueChange={(v)=>handleChange('bookingMode',v?'yes':'no')} value={formState.bookingMode==='yes'} accessibilityLabel={currentBookingType === 'TICKETED' ? 'Enable Ticket Sales Switch' : 'Enable Reservations Switch'} accessibilityHint={formState.bookingMode === 'yes' ? 'Booking enabled' : 'Booking disabled'}/></View></View>)}

              {/* Ticket Fields */}
              {showTicketFields && (<><View style={styles.formGroup}><Label>Number of Tickets Available *</Label><TextInput style={styles.input} placeholder="e.g., 100 (0 for unlimited)" value={formState.maxTickets} onChangeText={(t)=>handleChange("maxTickets",t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" accessibilityLabel="Number of Tickets Input"/>{(!/^\d+$/.test(formState.maxTickets)&&formState.maxTickets!==''&&(<Text style={styles.errorText}>Enter valid number (0 = unlimited).</Text>))}</View><View style={styles.formGroup}><Label>Ticket Price ($) *</Label><TextInput style={styles.input} placeholder="e.g., 25.50 (0 for free)" value={formState.ticketPrice} onChangeText={(t)=>handleChange("ticketPrice",t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" accessibilityLabel="Ticket Price Input"/>{(!/^\d+(\.\d{1,2})?$/.test(formState.ticketPrice)&&formState.ticketPrice!==''&&(<Text style={styles.errorText}>Enter valid price.</Text>))}</View><View style={styles.formGroup}><Label>Pass $0.50 Processing Fee to User?</Label><View style={styles.switchContainer}><Text style={styles.switchLabel}>{formState.passFeeToUser?'Yes (User pays total)':'No (You absorb fee)'}</Text><Switch trackColor={{false:"#E5E7EB",true:"#60A5FA"}} thumbColor={formState.passFeeToUser?"#3B82F6":"#f4f3f4"} ios_backgroundColor="#E5E7EB" onValueChange={(v)=>handleChange('passFeeToUser',v)} value={formState.passFeeToUser} accessibilityLabel="Pass fee switch" accessibilityHint={formState.passFeeToUser ? 'User pays fee' : 'You absorb fee'}/></View></View></>)}

              {/* Reservation Fields */}
              {showReservationFields && (<View style={styles.formGroup}><Label>Number of Reservations Available *</Label><TextInput style={styles.input} placeholder="e.g., 50 (0 for unlimited)" value={formState.maxReservations} onChangeText={(t)=>handleChange("maxReservations",t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" accessibilityLabel="Number of Reservations Input"/>{(!/^\d+$/.test(formState.maxReservations)&&formState.maxReservations!==''&&(<Text style={styles.errorText}>Enter valid number (0 = unlimited).</Text>))}</View>)}

              {/* Simplified Tag Inputs */}
              <View style={styles.formGroup}><Label>Music Genres (Comma-separated)</Label><TextInput style={styles.input} placeholder="e.g., House, Techno, Disco" value={formState.genres} onChangeText={(text) => handleChange("genres", text)} accessibilityLabel="Music Genres Input" autoCapitalize="none"/></View>
              <View style={styles.formGroup}><Label>Featured Artists (Comma-separated)</Label><TextInput style={styles.input} placeholder="e.g., Daft Punk, Purple Disco Machine" value={formState.artists} onChangeText={(text) => handleChange("artists", text)} accessibilityLabel="Featured Artists Input" autoCapitalize="words"/></View>
              <View style={styles.formGroup}><Label>Featured Songs (Comma-separated)</Label><TextInput style={styles.input} placeholder="e.g., One More Time, Around the World" value={formState.songs} onChangeText={(text) => handleChange("songs", text)} accessibilityLabel="Featured Songs Input" autoCapitalize="sentences"/></View>

              {/* Submit Button */}
              <TouchableOpacity style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={isSubmitting} accessibilityLabel="Update Event Button" >{isSubmitting ? (<ActivityIndicator size="small" color="#fff" />) : (<><Feather name="check-circle" size={18} color="#fff" /><Text style={styles.submitButtonText}>Update Event</Text></>)}</TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
};

// --- Styles --- (Same as CreateEventScreen, added warningText)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "white" },
    background: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'white' },
    authErrorText: { fontSize: 18, fontWeight: '600', color: '#DC2626', marginTop: 10, textAlign: 'center' },
    authErrorSubText: { fontSize: 14, color: '#6B7280', marginTop: 5, textAlign: 'center' },
    retryButton: { backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginTop: 15, },
    retryButtonText: { color: '#FFF', fontWeight: '600', },
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
    formRow: { flexDirection: "row", justifyContent: 'space-between', marginBottom: 20 },
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
    warningText: { color: '#F59E0B', fontSize: 12, marginTop: 4 }, // Warning color
    pickerContainer: { borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 8, backgroundColor: "white", height: Platform.OS === 'ios' ? undefined : 48, justifyContent: 'center', paddingHorizontal: Platform.OS === 'ios' ? 10 : 0, },
    picker: { height: Platform.OS === 'ios' ? 180 : 48, },
    pickerItem: {},
    iosPickerValueDisplayWrapper: {
        position: 'absolute',
        left: 10,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        paddingHorizontal: 12,
        zIndex: -1,
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

export default EditEventScreen;