import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, StyleSheet } from 'react-native';

interface VybrLoadingAnimationProps {
    size?: number;
    duration?: number;
}

const VybrLoadingAnimation: React.FC<VybrLoadingAnimationProps> = ({ 
    size = 80, 
    duration = 2000 
}) => {
    // Simple zoom in animation
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Clean zoom in entrance animation
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 7,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: duration * 0.3,
                useNativeDriver: true,
            }),
        ]).start();

        return () => {
            scaleAnim.stopAnimation();
            opacityAnim.stopAnimation();
        };
    }, [scaleAnim, opacityAnim, duration]);

    // Interpolate animations
    const scale = scaleAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
    });

    return (
        <View style={styles.container}>
            {/* Main logo with simple zoom in effect */}
            <Animated.View
                style={[
                    styles.logoContainer,
                    {
                        opacity: opacityAnim,
                        transform: [{ scale }],
                    },
                ]}
            >
                <Image
                    source={require('../../logo/vyb__6_-removebg-preview.png')}
                    style={[
                        styles.logo,
                        {
                            width: size,
                            height: size,
                        },
                    ]}
                    resizeMode="contain"
                />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    logoContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    logo: {
        // The image will be sized by the size prop
    },
});

export default VybrLoadingAnimation;
