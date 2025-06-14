import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { OpeningHours, DayOpeningHours, TimeSlot } from '@/hooks/useAuth'; // Adjust path as needed
import { APP_CONSTANTS } from '@/config/constants';

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const initialOpeningHours: OpeningHours = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
};

interface OpeningHoursEditorProps {
    openingHours: OpeningHours | null;
    onOpeningHoursChange: (hours: OpeningHours) => void;
}

const OpeningHoursEditor: React.FC<OpeningHoursEditorProps> = ({ openingHours: initialHours, onOpeningHoursChange }) => {
    const [hours, setHours] = useState<OpeningHours>(initialHours || initialOpeningHours);

    useEffect(() => {
        onOpeningHoursChange(hours);
    }, [hours, onOpeningHoursChange]);

    const handleAddTimeSlot = (day: keyof OpeningHours) => {
        const newTimeSlot: TimeSlot = { open: '09:00', close: '17:00' };
        setHours(prev => ({
            ...prev,
            [day]: [...prev[day], newTimeSlot],
        }));
    };

    const handleRemoveTimeSlot = (day: keyof OpeningHours, index: number) => {
        setHours(prev => ({
            ...prev,
            [day]: prev[day].filter((_, i) => i !== index),
        }));
    };

    const handleTimeChange = (day: keyof OpeningHours, index: number, field: 'open' | 'close', value: string) => {
        // Basic validation for time format HH:MM
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(value) && value !== '') {
            // Allow empty string to clear input, but don't update state with invalid format
            // Or you can add inline error messages
        }

        const newDayHours = [...hours[day]];
        newDayHours[index] = { ...newDayHours[index], [field]: value };
        setHours(prev => ({
            ...prev,
            [day]: newDayHours,
        }));
    };
    
    const renderDayRow = (day: keyof OpeningHours) => {
        const dayHours = hours[day] || [];
        return (
            <View key={day} style={styles.dayContainer}>
                <Text style={styles.dayLabel}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
                <View style={styles.slotsContainer}>
                    {dayHours.map((slot, index) => (
                        <View key={index} style={styles.slotRow}>
                            <TextInput
                                style={styles.timeInput}
                                value={slot.open}
                                placeholder="HH:MM"
                                onChangeText={(text) => handleTimeChange(day, index, 'open', text)}
                                maxLength={5}
                            />
                            <Text style={styles.separator}>-</Text>
                            <TextInput
                                style={styles.timeInput}
                                value={slot.close}
                                placeholder="HH:MM"
                                onChangeText={(text) => handleTimeChange(day, index, 'close', text)}
                                maxLength={5}
                            />
                            <TouchableOpacity onPress={() => handleRemoveTimeSlot(day, index)} style={styles.removeButton}>
                                <Feather name="x" size={18} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    ))}
                    <TouchableOpacity onPress={() => handleAddTimeSlot(day)} style={styles.addButton}>
                        <Feather name="plus" size={18} color={APP_CONSTANTS.COLORS.PRIMARY} />
                        <Text style={styles.addButtonText}>Add Hours</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Opening Hours</Text>
            <Text style={styles.subtitle}>Set the times your venue is open for reservations.</Text>
            <ScrollView>
                {DAYS_OF_WEEK.map(day => renderDayRow(day))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginTop: 10,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: APP_CONSTANTS.COLORS.BORDER,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    },
    subtitle: {
        fontSize: 13,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        marginBottom: 16,
    },
    dayContainer: {
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: APP_CONSTANTS.COLORS.BORDER,
        paddingBottom: 12,
    },
    dayLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
        marginBottom: 8,
        textTransform: 'capitalize',
    },
    slotsContainer: {
        paddingLeft: 10,
    },
    slotRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    timeInput: {
        borderWidth: 1,
        borderColor: APP_CONSTANTS.COLORS.BORDER,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        width: 70,
        textAlign: 'center',
        backgroundColor: 'white',
    },
    separator: {
        marginHorizontal: 8,
        fontSize: 16,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    },
    removeButton: {
        marginLeft: 'auto',
        padding: 4,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 6,
        backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}1A`,
        alignSelf: 'flex-start',
    },
    addButtonText: {
        marginLeft: 6,
        color: APP_CONSTANTS.COLORS.PRIMARY,
        fontWeight: '500',
        fontSize: 13,
    }
});

export default OpeningHoursEditor; 