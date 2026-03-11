import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { APP_CONSTANTS } from '@/config/constants';
import { authStyles } from '@/styles/authStyles';
import { ComingSoonHypeModal } from '@/components/ComingSoonOverlay';
import { FEATURE_FLAGS } from '@/config/featureFlags';

const { height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const PHONE_WEB_BREAKPOINT = 600;

const ORGANIZER_HYPE_HEADLINE = "We're building something huge for organizers.";
const ORGANIZER_HYPE_MESSAGE = "Create events, sell tickets, and grow your community — all in one place. We're putting the finishing touches on. You'll be first to know when it drops. 🎉";

const LandingScreen = () => {
  const navigation = useNavigation<any>();
  const { width: windowWidth } = useWindowDimensions();
  const isPhoneWeb = isWeb && windowWidth < PHONE_WEB_BREAKPOINT;
  const [showOrganizerHype, setShowOrganizerHype] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const contentPaddingHorizontal = isPhoneWeb ? 24 : (isWeb ? 40 : 20);
  const buttonsPaddingHorizontal = isPhoneWeb ? 16 : (isWeb ? 0 : 12);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={authStyles.container}>
      <LinearGradient
        colors={[
          `${APP_CONSTANTS.COLORS.PRIMARY}08`,
          `${APP_CONSTANTS.COLORS.PRIMARY}03`,
          'white'
        ]}
        style={[authStyles.gradient, isPhoneWeb && { paddingHorizontal: 16 }]}
      >
        {/* Decorative background elements */}
        <View style={authStyles.decorativeCircle1} />
        <View style={authStyles.decorativeCircle2} />
        <View style={authStyles.decorativeCircle3} />
        {isWeb && <View style={authStyles.decorativeCircle4} />}
        {isWeb && <View style={authStyles.decorativeCircle5} />}

        {/* Main content container - centered like login screen; scrollable on phone web */}
        <ScrollView
          style={{ flex: 1, maxWidth: '100%' }}
          contentContainerStyle={
            isPhoneWeb
              ? {
                  paddingHorizontal: contentPaddingHorizontal,
                  paddingTop: 20,
                  paddingBottom: 24,
                  alignItems: 'center',
                }
              : {
                  flexGrow: 1,
                  justifyContent: 'center',
                  paddingHorizontal: contentPaddingHorizontal,
                  paddingVertical: isWeb ? 60 : 16,
                  alignItems: 'center',
                }
          }
          showsVerticalScrollIndicator={isPhoneWeb}
        >
          <Animated.View
            style={[
              isPhoneWeb
                ? {
                    width: '100%',
                    maxWidth: '100%',
                    alignItems: 'center',
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  }
                : {
                    flex: 1,
                    width: '100%',
                    maxWidth: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
            ]}
          >
          {/* Logo Section - positioned at same location as login screen */}
          <Animated.View 
            style={[
              {
                alignItems: 'center',
                marginBottom: isPhoneWeb ? 20 : (isWeb ? 48 : 28),
                marginTop: isPhoneWeb ? 0 : (isWeb ? 40 : 0),
                transform: [{ scale: scaleAnim }]
              }
            ]}
          >
            <View style={authStyles.logoBackground}>
              <Text style={authStyles.logoText}>vybr</Text>
            </View>
            <Text style={authStyles.tagline}>Where music meets connection</Text>
          </Animated.View>
          
          {/* Content - centered and properly spaced */}
          <View style={{ 
            width: '100%', 
            maxWidth: '100%',
            alignItems: 'center',
            paddingHorizontal: isPhoneWeb ? 8 : 0,
          }}>
            {/* Main Description */}
            <Text style={[
              authStyles.description,
              {
                marginBottom: isPhoneWeb ? 16 : (isWeb ? 32 : 20),
              }
            ]}>
              Discover events, connect with music lovers, and experience unforgettable moments together
            </Text>

            {/* Action Buttons */}
            <View style={{ width: '100%', alignItems: 'center', paddingHorizontal: buttonsPaddingHorizontal }}>
              <TouchableOpacity 
                style={[
                  authStyles.button,
                  {
                    backgroundColor: 'white',
                    borderWidth: 1,
                    borderColor: APP_CONSTANTS.COLORS.BORDER_LIGHT,
                    marginBottom: isPhoneWeb ? 12 : (isWeb ? 20 : 16),
                  }
                ]}
                onPress={() => navigation.navigate('MusicLoverLogin')}
                activeOpacity={0.8}
              >
                <View style={authStyles.buttonContent}>
                  <View style={authStyles.buttonIconContainer}>
                    <Feather 
                      name="music" 
                      size={24} 
                      color={APP_CONSTANTS.COLORS.PRIMARY} 
                    />
                  </View>
                  <View style={[authStyles.buttonTextContainer, { flex: 1, minWidth: 0 }]}>
                    <Text style={authStyles.buttonTitle} numberOfLines={1}>Music Lover</Text>
                    <Text style={authStyles.buttonSubtitle} numberOfLines={isPhoneWeb ? 2 : 1}>Login / Sign up with Google</Text>
                  </View>
                  <Feather 
                    name="chevron-right" 
                    size={20} 
                    color={APP_CONSTANTS.COLORS.TEXT_SECONDARY} 
                  />
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  authStyles.button,
                  {
                    backgroundColor: 'white',
                    borderWidth: 1,
                    borderColor: APP_CONSTANTS.COLORS.BORDER_LIGHT,
                    marginBottom: isPhoneWeb ? 0 : (isWeb ? 20 : 16),
                  }
                ]}
                onPress={() => {
                  if (FEATURE_FLAGS.PAYMENTS_AND_ORGANIZERS_ENABLED) {
                    navigation.navigate('OrganizerLogin');
                  } else {
                    setShowOrganizerHype(true);
                  }
                }}
                activeOpacity={0.8}
              >
                <View style={authStyles.buttonContent}>
                  <View style={authStyles.buttonIconContainer}>
                    <Feather 
                      name="calendar" 
                      size={24} 
                      color={APP_CONSTANTS.COLORS.PRIMARY} 
                    />
                  </View>
                  <View style={[authStyles.buttonTextContainer, { flex: 1, minWidth: 0 }]}>
                    <Text style={authStyles.buttonTitle} numberOfLines={1}>Event Organizer</Text>
                    <Text style={authStyles.buttonSubtitle} numberOfLines={isPhoneWeb ? 2 : 1}>
                      {FEATURE_FLAGS.PAYMENTS_AND_ORGANIZERS_ENABLED ? 'Login / Sign up with Google' : 'Coming soon - tap to see what’s ahead'}
                    </Text>
                  </View>
                  <Feather 
                    name="chevron-right" 
                    size={20} 
                    color={APP_CONSTANTS.COLORS.TEXT_SECONDARY} 
                  />
                </View>
              </TouchableOpacity>

              <ComingSoonHypeModal
                visible={showOrganizerHype}
                onDismiss={() => setShowOrganizerHype(false)}
                headline={ORGANIZER_HYPE_HEADLINE}
                message={ORGANIZER_HYPE_MESSAGE}
                buttonLabel="Can't wait!"
              />
            </View>
          </View>
        </Animated.View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

export default LandingScreen; 