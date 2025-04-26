import React from 'react';
import {
    Modal,
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { APP_CONSTANTS } from '@/config/constants'; // Adjust path as necessary

interface TermsModalProps {
    visible: boolean;
    onClose: () => void;
    termsText: string;
    title?: string;
}

const TermsModal: React.FC<TermsModalProps> = ({
    visible,
    onClose,
    termsText,
    title = "Terms & Conditions",
}) => {
    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose} // Handle back button on Android
        >
            <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.title}>{title}</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Feather name="x" size={24} color={APP_CONSTANTS.COLORS.TEXT_SECONDARY} />
                            </TouchableOpacity>
                        </View>

                        {/* Terms Content */}
                        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                            <Text style={styles.termsBody}>{termsText}</Text>
                        </ScrollView>

                        {/* Footer Close Button */}
                        <TouchableOpacity style={styles.footerButton} onPress={onClose}>
                            <Text style={styles.footerButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)', // Apply overlay color to safe area
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    modalContent: {
        width: '90%',
        maxWidth: 500,
        maxHeight: '85%', // Limit height
        backgroundColor: 'white',
        borderRadius: 12,
        overflow: 'hidden', // Important for border radius on children
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
        display: 'flex', // Ensure flexbox layout
        flexDirection: 'column', // Stack children vertically
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: APP_CONSTANTS.COLORS.BORDER_LIGHT,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
        flex: 1, // Allow title to take available space
        marginRight: 10, // Space before close button
    },
    closeButton: {
        padding: 8, // Increase tap area
    },
    scrollView: {
        flex: 1, // Allow scroll view to take remaining space
    },
    scrollContent: {
        padding: 16,
    },
    termsBody: {
        fontSize: 14,
        lineHeight: 20,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    },
    footerButton: {
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
        paddingVertical: 14,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: APP_CONSTANTS.COLORS.BORDER_LIGHT,
    },
    footerButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default TermsModal; 