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
interface FormState { title: string; description: string; location: string; artists: string; songs: string; genres: string; eventType: EventTypeValue; bookingMode: 'yes' | 'no'; maxTickets: string; maxReservations: string; ticketPrice: string; passFeeToUser: boolean; }
interface ImageAsset { uri: string; mimeType?: string; fileName?: string; isNew?: boolean; existingUrl?: string; } // Added isNew, existingUrl

// Existing Event Data Structure from Supabase
interface ExistingEventData {
  id: string; organizer_id: string; title: string; description: string | null;
  event_datetime: string; location_text: string | null; poster_urls: string[];
  tags_genres: string[] | null; tags_artists: string[] | null; tags_songs: string[] | null;
  event_type: EventTypeValue | null;
  booking_type: 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null;
  max_tickets: number | null; max_reservations: number | null;
  ticket_price: number | null; pass_fee_to_user: boolean | null;
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

  const [formState, setFormState] = useState<FormState>({ title: "", description: "", location: "", artists: "", songs: "", genres: "", eventType: '', bookingMode: 'yes', maxTickets: '', maxReservations: '', ticketPrice: '', passFeeToUser: true, });
  const [eventDate, setEventDate] = useState<Date>(new Date()); // Initialize, will be overwritten
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [imageAssets, setImageAssets] = useState<ImageAsset[]>([]); // Holds existing and new images

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
        .select('*')
        .eq('id', eventId)
        .eq('organizer_id', session.user.id) // Ensure organizer owns the event
        .single();

      if (error) {
          if (error.code === 'PGRST116') { // Not found code
               throw new Error("Event not found or you don't have permission to edit it.");
          }
          throw error;
      }


      const eventData = data as ExistingEventData;

      // Populate Form State
      setFormState({
        title: eventData.title,
        description: eventData.description ?? "",
        location: eventData.location_text ?? "",
        artists: eventData.tags_artists?.join(', ') ?? "",
        songs: eventData.tags_songs?.join(', ') ?? "",
        genres: eventData.tags_genres?.join(', ') ?? "",
        eventType: eventData.event_type ?? '',
        bookingMode: eventData.booking_type === 'INFO_ONLY' ? 'no' : 'yes',
        // Handle null for unlimited: display 0 if null, otherwise the number
        maxTickets: eventData.booking_type === 'TICKETED' ? (eventData.max_tickets?.toString() ?? '0') : '',
        maxReservations: eventData.booking_type === 'RESERVATION' ? (eventData.max_reservations?.toString() ?? '0') : '',
        ticketPrice: eventData.booking_type === 'TICKETED' ? (eventData.ticket_price?.toFixed(2) ?? '') : '',
        passFeeToUser: eventData.pass_fee_to_user ?? true,
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

  useFocusEffect(fetchEvent);

  // --- Logic copied/adapted from CreateEventScreen ---
  const derivedBookingType = useCallback((): 'TICKETED' | 'RESERVATION' | 'INFO_ONLY' | null => { if (formState.bookingMode === 'no' || formState.eventType === 'ADVERTISEMENT_ONLY') return 'INFO_ONLY'; if (TICKETED_EVENT_TYPES.includes(formState.eventType)) return 'TICKETED'; if (RESERVATION_EVENT_TYPES.includes(formState.eventType)) return 'RESERVATION'; return null; }, [formState.eventType, formState.bookingMode]);
  const handleChange = (name: keyof FormState, value: string | boolean | EventTypeValue) => { setFormState((prev) => ({ ...prev, [name]: value })); if (name === 'eventType') { const newEventType = value as EventTypeValue; const newBookingMode = newEventType === 'ADVERTISEMENT_ONLY' ? 'no' : 'yes'; setFormState(prev => ({ ...prev, eventType: newEventType, bookingMode: newBookingMode, maxTickets: prev.maxTickets, maxReservations: prev.maxReservations, ticketPrice: prev.ticketPrice, passFeeToUser: prev.passFeeToUser, })); } if (name === 'bookingMode' && value === 'no') { setFormState(prev => ({ ...prev, bookingMode: 'no' })); }};

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date | undefined) => { const currentDate = selectedDate || eventDate; setShowDatePicker(Platform.OS === 'ios'); if (event.type === 'set' && selectedDate) { setShowDatePicker(false); const newEventDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), eventDate.getHours(), eventDate.getMinutes(), 0, 0); setEventDate(newEventDate); } else if (event.type === 'dismissed') { setShowDatePicker(false); } };
  const onTimeChange = (event: DateTimePickerEvent, selectedTime?: Date | undefined) => { const currentTime = selectedTime || eventDate; setShowTimePicker(Platform.OS === 'ios'); if (event.type === 'set' && selectedTime) { setShowTimePicker(false); const newEventDate = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), selectedTime.getHours(), selectedTime.getMinutes(), 0, 0); setEventDate(newEventDate); } else if (event.type === 'dismissed') { setShowTimePicker(false); } };
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
            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true, quality: 0.8,
                selectionLimit: 3 - imageAssets.length // Limit selection
            });
            if (!result.canceled && result.assets) {
                const assetsToAdd: ImageAsset[] = result.assets.map(a => ({ uri:a.uri, mimeType:a.mimeType, fileName:a.fileName, isNew: true }));
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
   const base64ToArrayBuffer = (base64: string): ArrayBuffer => { try{ const b = Buffer.from(base64, 'base64'); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } catch(e){ console.error("Base64 Err:",e); throw new Error("Failed image process."); } };
   const uploadSingleImage = async (userId: string, asset: ImageAsset): Promise<string | null> => {
        if (!asset.isNew || !asset.uri) return asset.existingUrl ?? null;
        const { uri, mimeType, fileName: originalFileName } = asset; try { let ext = uri.split('.').pop()?.toLowerCase().split('?')[0] || 'jpeg'; if (ext && (ext.length > 5 || !/^[a-z0-9]+$/.test(ext))) ext = 'jpeg'; if (!['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) ext = 'jpeg'; if (ext === 'jpg') ext = 'jpeg'; const fileName = `${originalFileName ? originalFileName.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_') : 'event-image'}-${Date.now()}.${ext}`; const filePath = `${userId}/${fileName}`; if (Platform.OS === 'web') { const response = await fetch(uri); if (!response.ok) throw new Error(`Failed to fetch web URI: ${response.status}`); const arrayBuffer = await response.arrayBuffer(); const webMimeType = response.headers.get('content-type') || mimeType || `image/${ext}`; if (arrayBuffer.byteLength === 0) throw new Error("Image data is empty."); const { data: uploadData, error: uploadError } = await supabase.storage.from("event_posters").upload(filePath, arrayBuffer, { cacheControl: "3600", upsert: false, contentType: webMimeType }); if (uploadError) throw new Error(`Supabase upload error: ${uploadError.message}`); if (!uploadData?.path) throw new Error("Upload succeeded but no path returned."); const { data: urlData } = supabase.storage.from("event_posters").getPublicUrl(uploadData.path); return urlData?.publicUrl ?? null; } else { const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }); if (!base64) throw new Error("Failed to read image file."); const arrayBuffer = base64ToArrayBuffer(base64); if (arrayBuffer.byteLength === 0) throw new Error("Image data is empty."); let contentType = mimeType || `image/${ext}`; if (ext === 'svg' && contentType !== 'image/svg+xml') contentType = 'image/svg+xml'; const { data: uploadData, error: uploadError } = await supabase.storage .from("event_posters") .upload(filePath, arrayBuffer, { cacheControl: "3600", upsert: false, contentType: contentType }); if (uploadError) throw new Error(`Supabase upload error: ${uploadError.message}`); if (!uploadData?.path) throw new Error("Upload succeeded but no path returned."); const { data: urlData } = supabase.storage.from("event_posters").getPublicUrl(uploadData.path); return urlData?.publicUrl ?? null; } } catch (e: any) { console.error(`[ImageUpload] Error for ${uri}:`, e); return null; }
   };
   const uploadImages = async (userId: string, assets: ImageAsset[]): Promise<string[]> => {
       if (!assets || assets.length === 0) return [];
       console.log(`Processing ${assets.length} images for update...`);
       const uploadPromises = assets.map(asset => uploadSingleImage(userId, asset));
       try {
           const results = await Promise.all(uploadPromises);
           const finalUrls = results.filter((url): url is string => url !== null);
           const newUploadCount = assets.filter(a => a.isNew).length;
           const successfulNewUploads = finalUrls.length - assets.filter(a => !a.isNew).length;
           if (newUploadCount > 0 && successfulNewUploads < newUploadCount) {
               Alert.alert("Partial Upload Failed", `Could not upload ${newUploadCount - successfulNewUploads} new image(s). Existing images were kept.`);
           }
           console.log(`Finished image processing. Final URLs: ${finalUrls.length}`);
           return finalUrls;
       } catch (error) { console.error("Image update batch error:", error); Alert.alert("Upload Error", "An error occurred uploading images."); return assets.filter(a => !a.isNew && a.existingUrl).map(a => a.existingUrl!);
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

          const processTags = (tagString: string): string[] | null => { if (!tagString?.trim()) return null; const tags = tagString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0 && tag.length <= 50); return tags.length > 0 ? tags : null; };
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
                  <View style={[styles.formGroup,{flex:1,marginRight:8, marginBottom: 0}]}><Label>Date *</Label><TouchableOpacity style={styles.inputWithIconTouchable} onPress={()=>setShowDatePicker(true)} accessibilityLabel="Select Event Date" accessibilityHint={`Current date: ${formatDate(eventDate)}`} ><Feather name="calendar" size={16} color="#9CA3AF" style={styles.inputIcon} /><Text style={styles.pickerText}>{formatDate(eventDate)}</Text></TouchableOpacity></View>
                  <View style={[styles.formGroup,{flex:1,marginLeft:8, marginBottom: 0}]}><Label>Time *</Label><TouchableOpacity style={styles.inputWithIconTouchable} onPress={()=>setShowTimePicker(true)} accessibilityLabel="Select Event Time" accessibilityHint={`Current time: ${formatTime(eventDate)}`} ><Feather name="clock" size={16} color="#9CA3AF" style={styles.inputIcon} /><Text style={styles.pickerText}>{formatTime(eventDate)}</Text></TouchableOpacity></View>
              </View>
              {showDatePicker && (<DateTimePicker testID="datePicker" value={eventDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onDateChange} /* No minimum date */ />)}
              {showTimePicker && (<DateTimePicker testID="timePicker" value={eventDate} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onTimeChange} />)}
              {eventDate <= new Date() && (<Text style={[styles.warningText,{ marginTop: 4, marginBottom: 10 }]}>Warning: Date/Time is in the past.</Text>)}

              {/* Location */}
              <View style={styles.formGroup}><Label>Location</Label><View style={styles.inputWithIcon}><Feather name="map-pin" size={16} color="#9CA3AF" style={styles.inputIcon} /><TextInput style={styles.iconInput} placeholder="e.g., The Fillmore, Online" value={formState.location} onChangeText={(text)=>handleChange("location",text)} accessibilityLabel="Event Location Input"/></View></View>

              {/* Event Type */}
              <View style={styles.formGroup}><Label>Event Type *</Label><View style={styles.pickerContainer}><Picker selectedValue={formState.eventType} onValueChange={(itemValue) => handleChange('eventType', itemValue as EventTypeValue)} style={styles.picker} itemStyle={styles.pickerItem} accessibilityLabel="Select Event Type Picker" prompt="Select Event Type">{eventTypeOptions.map(o=>(<Picker.Item key={o.value} label={o.label} value={o.value} enabled={o.value!==''} color={o.value === '' ? '#9CA3AF' : undefined}/>))}</Picker>{Platform.OS === 'ios' && formState.eventType && eventTypeOptions.find(o => o.value === formState.eventType) && ( <Text style={styles.iosPickerValueDisplay} pointerEvents="none">Selected: {eventTypeOptions.find(o => o.value === formState.eventType)?.label}</Text> )}</View>{!formState.eventType && (<Text style={styles.errorText}>Please select an event type.</Text>)}</View>

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
    iosPickerValueDisplay: { paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 14 : 0, fontSize: 16, color: '#1F2937', position: 'absolute', left: 10, top: 0, bottom: 0, zIndex: -1, textAlignVertical: 'center', },
    switchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, height: 48 },
    switchLabel: { fontSize: 16, color: '#374151', marginRight: 10, flexShrink: 1 },
});

export default EditEventScreen;