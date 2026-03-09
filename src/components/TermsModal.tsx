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
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.header}>
                            <Text style={styles.title}>{title}</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Feather name="x" size={24} color={APP_CONSTANTS.COLORS.TEXT_SECONDARY} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.scrollWrapper}>
                            <ScrollView
                                style={styles.scrollView}
                                contentContainerStyle={styles.scrollContent}
                                showsVerticalScrollIndicator={true}
                            >
                                <Markdown style={markdownStyles}>{termsText}</Markdown>
                            </ScrollView>
                        </View>

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
        fontSize: Platform.OS === 'web' ? 15 : 15,
        lineHeight: Platform.OS === 'web' ? 24 : 24,
        color: '#1a1a1a',
    },
    text: {
        fontSize: 15,
        lineHeight: 24,
        color: '#1a1a1a',
    },
    strong: {
        fontWeight: '700' as const,
        color: '#1a1a1a',
    },
    em: {
        fontStyle: 'italic' as const,
    },
    heading1: {
        fontSize: 22,
        fontWeight: '700' as const,
        marginTop: 0,
        marginBottom: 12,
        color: '#111',
        lineHeight: 28,
    },
    heading2: {
        fontSize: 17,
        fontWeight: '700' as const,
        marginTop: 20,
        marginBottom: 10,
        color: '#111',
        lineHeight: 22,
    },
    heading3: {
        fontSize: 16,
        fontWeight: '600' as const,
        marginTop: 12,
        marginBottom: 6,
        color: '#1a1a1a',
    },
    paragraph: {
        marginTop: 0,
        marginBottom: 12,
        lineHeight: 24,
        color: '#1a1a1a',
    },
    bullet_list: {
        marginBottom: 12,
    },
    bullet_list_icon: {
        color: APP_CONSTANTS.COLORS.PRIMARY,
        fontSize: 18,
        lineHeight: 24,
    },
    list_item: {
        marginBottom: 6,
        paddingLeft: 4,
        lineHeight: 24,
        color: '#1a1a1a',
    },
    hr: {
        backgroundColor: APP_CONSTANTS.COLORS.BORDER_LIGHT,
        marginVertical: 16,
        height: 1,
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
        padding: Platform.OS === 'web' ? 8 : 12,
        borderRadius: Platform.OS === 'web' ? 4 : 8,
    },
    scrollWrapper: {
        flex: 1,
        minHeight: 0,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: Platform.OS === 'web' ? 24 : 20,
        paddingTop: 8,
        paddingBottom: 32,
    },
    termsBody: {
        fontSize: 15,
        lineHeight: 24,
        color: '#1a1a1a',
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