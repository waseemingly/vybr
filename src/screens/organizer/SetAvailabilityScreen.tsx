import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Calendar, DateData } from 'react-native-calendars';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { APP_CONSTANTS } from '../../config/constants';

type MarkedDates = {
    [date: string]: {
        selected: boolean;
        selectedColor: string;
        disableTouchEvent?: boolean;
    };
};

const SetAvailabilityScreen = () => {
    const navigation = useNavigation();
    const { session, organizerProfile } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
    const [markedDates, setMarkedDates] = useState<MarkedDates>({});
    
    const today = new Date().toISOString().split('T')[0];

    useEffect(() => {
        if (organizerProfile?.unavailable_dates) {
            const initialDates = organizerProfile.unavailable_dates || [];
            setUnavailableDates(initialDates);
            const marked = initialDates.reduce((acc: MarkedDates, date: string) => {
                acc[date] = { selected: true, selectedColor: APP_CONSTANTS.COLORS.ERROR };
                return acc;
            }, {} as MarkedDates);
            setMarkedDates(marked);
        }
        setIsLoading(false);
    }, [organizerProfile]);

    const onDayPress = useCallback((day: DateData) => {
        const { dateString } = day;
        setMarkedDates(prevMarked => {
            const newMarked = { ...prevMarked };
            if (newMarked[dateString]) {
                delete newMarked[dateString];
            } else {
                newMarked[dateString] = { selected: true, selectedColor: APP_CONSTANTS.COLORS.ERROR };
            }
            setUnavailableDates(Object.keys(newMarked));
            return newMarked;
        });
    }, []);

    const handleSaveChanges = async () => {
        if (!session?.user?.id) {
            Alert.alert('Error', 'You must be logged in to save changes.');
            return;
        }
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('organizer_profiles')
                .update({ unavailable_dates: unavailableDates })
                .eq('user_id', session.user.id);

            if (error) throw error;
            Alert.alert('Success', 'Your availability has been updated.');
            navigation.goBack();
        } catch (error: any) {
            console.error("Error saving availability:", error);
            Alert.alert('Error', 'Failed to save your availability. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.centeredLoader} edges={['top', 'bottom']}>
                <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
            </SafeAreaView>
        );
    }
    
    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="chevron-left" size={28} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Set Availability</Text>
                <TouchableOpacity onPress={handleSaveChanges} style={styles.saveButton} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveButtonText}>Save</Text>}
                </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.contentContainer}>
                <Text style={styles.instructions}>Select the dates your venue is closed. These dates will be blocked for reservations. Tap a date again to mark it as available.</Text>
                <Calendar
                    minDate={today}
                    onDayPress={onDayPress}
                    markedDates={markedDates}
                    theme={{
                        selectedDayBackgroundColor: APP_CONSTANTS.COLORS.ERROR,
                        selectedDayTextColor: '#ffffff',
                        todayTextColor: APP_CONSTANTS.COLORS.PRIMARY,
                        arrowColor: APP_CONSTANTS.COLORS.PRIMARY,
                    }}
                />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    centeredLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
    saveButton: { 
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    saveButtonText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
    contentContainer: { padding: 16 },
    instructions: {
        fontSize: 15,
        color: '#4B5563',
        marginBottom: 20,
        textAlign: 'center',
        lineHeight: 22,
    },
});

export default SetAvailabilityScreen; 