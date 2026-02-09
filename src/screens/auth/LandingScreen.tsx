import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { APP_CONSTANTS } from '@/config/constants';
import { authStyles } from '@/styles/authStyles';

const { width, height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

const LandingScreen = () => {
  const navigation = useNavigation<any>();
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);
  const scaleAnim = new Animated.Value(0.8);

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
        style={authStyles.gradient}
      >
        {/* Decorative background elements */}
        <View style={authStyles.decorativeCircle1} />
        <View style={authStyles.decorativeCircle2} />
        <View style={authStyles.decorativeCircle3} />
        {isWeb && <View style={authStyles.decorativeCircle4} />}
        {isWeb && <View style={authStyles.decorativeCircle5} />}

        {/* Main content container - centered like login screen */}
        <Animated.View 
          style={[
            {
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: isWeb ? 40 : 20,
              paddingVertical: isWeb ? 60 : 16,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Logo Section - positioned at same location as login screen */}
          <Animated.View 
            style={[
              {
                alignItems: 'center',
                marginBottom: isWeb ? 48 : 28,
                marginTop: isWeb ? 40 : 0,
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
            alignItems: 'center',
            maxWidth: isWeb ? 600 : '100%',
          }}>
            {/* Main Description */}
            <Text style={[
              authStyles.description,
              {
                marginBottom: isWeb ? 32 : 20,
              }
            ]}>
              Discover events, connect with music lovers, and experience unforgettable moments together
            </Text>

            {/* Action Buttons */}
            <View style={{ width: '100%', alignItems: 'center', paddingHorizontal: isWeb ? 0 : 12 }}>
              <TouchableOpacity 
                style={[
                  authStyles.button,
                  {
                    backgroundColor: 'white',
                    borderWidth: 1,
                    borderColor: APP_CONSTANTS.COLORS.BORDER_LIGHT,
                    marginBottom: isWeb ? 20 : 16,
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
                    <Text style={authStyles.buttonSubtitle} numberOfLines={1}>Login / Sign up with Google</Text>
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
                    marginBottom: isWeb ? 20 : 16,
                  }
                ]}
                onPress={() => navigation.navigate('OrganizerLogin')}
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
                    <Text style={authStyles.buttonSubtitle} numberOfLines={1}>Login / Sign up with Google</Text>
                  </View>
                  <Feather 
                    name="chevron-right" 
                    size={20} 
                    color={APP_CONSTANTS.COLORS.TEXT_SECONDARY} 
                  />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </LinearGradient>
    </SafeAreaView>
  );
};

export default LandingScreen; 