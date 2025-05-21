import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth, MusicLoverBio } from "@/hooks/useAuth";
import { APP_CONSTANTS } from '../config/constants'; // Adjust path if needed

// Basic placeholder screen for upgrading to premium
const UpgradeScreen: React.FC = () => {
    const { session, loading: authLoading, logout, musicLoverProfile, refreshUserProfile } = useAuth();
    const userId = session?.user?.id;
    const navigation = useNavigation();

    const premiumFeatures = [
        { icon: 'bar-chart-2', text: 'Detailed Music Taste Analytics' },
        { icon: 'radio', text: 'AI-Generated Match Radio Playlists' },
        { icon: 'zap', text: 'Enhanced Matching Algorithm' },
        { icon: 'award', text: 'Exclusive Profile Badge' },
        { icon: 'ad', text: 'Ad-Free Experience' }, // Example, if ads exist
    ];

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
             {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="x" size={24} color={APP_CONSTANTS.COLORS.TEXT_PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Unlock Premium</Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <LinearGradient
                    colors={[APP_CONSTANTS.COLORS.PRIMARY_LIGHT, APP_CONSTANTS.COLORS.PRIMARY]}
                    style={styles.gradientBackground}
                >
                    <Feather name="star" size={80} color="#FFD700" style={styles.starIcon} />
                    <Text style={styles.mainTitle}>Go Premium</Text>
                    <Text style={styles.subtitle}>Unlock exclusive features and enhance your experience!</Text>
                </LinearGradient>

                <View style={styles.featuresSection}>
                    <Text style={styles.featuresTitle}>Premium Features Include:</Text>
                    {premiumFeatures.map((feature, index) => (
                        <View key={index} style={styles.featureItem}>
                            <Feather name={feature.icon as any} size={20} color={APP_CONSTANTS.COLORS.PRIMARY} style={styles.featureIcon} />
                            <Text style={styles.featureText}>{feature.text}</Text>
                        </View>
                    ))}
                </View>

                {/* Placeholder for pricing/purchase options */}
                <View style={styles.pricingSection}>
                     <TouchableOpacity style={styles.upgradeButton} onPress={() => {
                            if (userId && musicLoverProfile?.email) {
                                console.log(`[ProfileScreen] Navigating to PremiumSignupScreen for user: ${userId}, email: ${musicLoverProfile.email}`);
                                navigation.navigate('PremiumSignupScreen', {
                                    userId: userId,
                                    userEmail: musicLoverProfile.email,
                                });
                            } else {
                                console.warn('[ProfileScreen] Cannot navigate to PremiumSignupScreen: userId or email missing.', { userId, email: musicLoverProfile?.email });
                                Alert.alert("Error", "Could not initiate premium upgrade. User details are missing. Please try logging out and back in.");
                            }
                        }}>
                        <Text style={styles.upgradeButtonText}>Upgrade Now - $4.99/month</Text>
                    </TouchableOpacity>
                    <Text style={styles.disclaimer}>Billing recurs monthly. Cancel anytime.</Text>
                 </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
    scrollContent: {
        paddingBottom: 40,
    },
    gradientBackground: {
        paddingVertical: 40,
        paddingHorizontal: 20,
        alignItems: 'center',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    starIcon: {
        marginBottom: 15,
    },
    mainTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.85)',
        textAlign: 'center',
        lineHeight: 24,
    },
    featuresSection: {
        padding: 25,
        backgroundColor: 'white',
        margin: 15,
        borderRadius: 12,
        marginTop: -30, // Overlap the gradient
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 3,

    },
    featuresTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
        marginBottom: 20,
        textAlign: 'center',
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    featureIcon: {
        marginRight: 15,
        width: 24, // Ensure alignment
        textAlign: 'center',
    },
    featureText: {
        fontSize: 15,
        color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
        flex: 1, // Allow text to wrap
        lineHeight: 22,
    },
    pricingSection: {
        marginTop: 20,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    upgradeButton: {
        backgroundColor: '#F59E0B', // Gold/Premium color
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 10,
        width: '100%',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    upgradeButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    disclaimer: {
        fontSize: 12,
        color: APP_CONSTANTS.COLORS.TEXT_TERTIARY,
        marginTop: 15,
        textAlign: 'center',
    },
});

export default UpgradeScreen; 