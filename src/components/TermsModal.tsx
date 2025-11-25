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
import Markdown from 'react-native-markdown-display';

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
                        <View style={{flex: 1}}>
                            <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 20}}>
                                <Text style={{color: 'black', fontSize: 16, lineHeight: 22}}>{termsText}</Text>
                            </ScrollView>
                        </View>

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

const markdownStyles = {
    body: {
        fontSize: Platform.OS === 'web' ? 14 : 15,
        lineHeight: Platform.OS === 'web' ? 20 : 22,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    },
    text: {
        fontSize: Platform.OS === 'web' ? 14 : 15,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    },
    strong: {
        fontWeight: '700',
    },
    em: {
        fontStyle: 'italic',
    },
    heading1: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
    },
    heading2: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 6,
    },
    heading3: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    paragraph: {
        marginBottom: 8,
    },
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)', // Apply overlay color to safe area
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Platform.OS === 'web' ? 0 : 16,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    modalContent: {
        width: Platform.OS === 'web' ? '90%' : '100%',
        maxWidth: 500,
        height: Platform.OS === 'web' ? undefined : 400,
        maxHeight: Platform.OS === 'web' ? '85%' : undefined, // Responsive height for web
        backgroundColor: 'white',
        borderRadius: Platform.OS === 'web' ? 12 : 16,
        overflow: 'hidden', // Important for border radius on children
        shadowColor: '#000',
        shadowOffset: { width: 0, height: Platform.OS === 'web' ? 3 : 4 },
        shadowOpacity: Platform.OS === 'web' ? 0.2 : 0.3,
        shadowRadius: Platform.OS === 'web' ? 5 : 8,
        elevation: Platform.OS === 'web' ? 5 : 8,
        display: 'flex', // Ensure flexbox layout
        flexDirection: 'column', // Stack children vertically
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Platform.OS === 'web' ? 16 : 20,
        paddingVertical: Platform.OS === 'web' ? 12 : 16,
        borderBottomWidth: 1,
        borderBottomColor: APP_CONSTANTS.COLORS.BORDER_LIGHT,
        backgroundColor: 'white',
    },
    title: {
        fontSize: Platform.OS === 'web' ? 18 : 20,
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
        flex: 1, // Allow title to take available space
        marginRight: 10, // Space before close button
    },
    closeButton: {
        padding: Platform.OS === 'web' ? 8 : 12, // Increase tap area on mobile
        borderRadius: Platform.OS === 'web' ? 4 : 8,
    },
    scrollView: {
        flex: 1, // Allow scroll view to take remaining space
    },
    scrollContent: {
        padding: Platform.OS === 'web' ? 16 : 20,
    },
    termsBody: {
        fontSize: Platform.OS === 'web' ? 14 : 15,
        lineHeight: Platform.OS === 'web' ? 20 : 22,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    },
    footerButton: {
        backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
        paddingVertical: Platform.OS === 'web' ? 14 : 16,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: APP_CONSTANTS.COLORS.BORDER_LIGHT,
    },
    footerButtonText: {
        color: 'white',
        fontSize: Platform.OS === 'web' ? 16 : 17,
        fontWeight: '600',
    },
});

export default TermsModal; 