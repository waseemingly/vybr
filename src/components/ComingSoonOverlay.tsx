import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { APP_CONSTANTS } from '@/config/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

type Props = {
  visible: boolean;
  onDismiss?: () => void;
  /** Optional subtitle below "Coming soon" */
  subtitle?: string;
  /** Show a back/dismiss button (e.g. when used as full-screen gate). */
  showDismissButton?: boolean;
  /** Dismiss button label */
  dismissLabel?: string;
};

export function ComingSoonOverlay({
  visible,
  onDismiss,
  subtitle = "We're working on something special. Stay tuned.",
  showDismissButton = true,
  dismissLabel = 'Go back',
}: Props) {
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    scaleAnim.setValue(0.92);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 65,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <LinearGradient
        colors={[
          '#0f172a',
          '#1e293b',
          '#334155',
          '#1e293b',
        ]}
        style={styles.gradient}
      >
        <View style={styles.overlay} />
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.card,
              {
                opacity: opacityAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Animated.View style={[styles.iconRing, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.iconCircle}>
                <Feather name="zap" size={42} color="#fbbf24" />
              </View>
            </Animated.View>
            <Text style={styles.title}>Coming soon</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            <View style={styles.divider} />
            <Text style={styles.teaser}>
              Events, payments & organizer tools are on the way. We can’t wait to share them with you.
            </Text>
            {showDismissButton && onDismiss && (
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={onDismiss}
                activeOpacity={0.85}
              >
                <Text style={styles.dismissLabel}>{dismissLabel}</Text>
                <Feather name="arrow-left" size={18} color="#0f172a" />
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>
      </LinearGradient>
    </Modal>
  );
}

/** Full-screen gate: when flag is false, shows Coming Soon overlay on top of children; otherwise renders only children. */
export function ComingSoonGate({
  children,
  subtitle,
  showDismissButton = true,
  dismissLabel = 'Go back',
  onDismiss,
}: {
  children: React.ReactNode;
  subtitle?: string;
  showDismissButton?: boolean;
  dismissLabel?: string;
  onDismiss?: () => void;
}) {
  const { PAYMENTS_AND_ORGANIZERS_ENABLED } = require('@/config/featureFlags').FEATURE_FLAGS;

  if (PAYMENTS_AND_ORGANIZERS_ENABLED) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <ComingSoonOverlay
        visible={true}
        onDismiss={onDismiss}
        subtitle={subtitle}
        showDismissButton={showDismissButton}
        dismissLabel={dismissLabel}
      />
    </>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: isWeb ? 32 : 24,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(251, 191, 36, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: isWeb ? 32 : 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: isWeb ? 16 : 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  divider: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
    opacity: 0.8,
    marginBottom: 20,
  },
  teaser: {
    fontSize: isWeb ? 14 : 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  dismissButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fbbf24',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    minWidth: 160,
  },
  dismissLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
});

/** Popup for "Coming soon" that hypes users up — use when an option is visible but not yet selectable. */
export type ComingSoonHypeModalProps = {
  visible: boolean;
  onDismiss: () => void;
  headline: string;
  message: string;
  buttonLabel?: string;
  /** Show X at top right to close (popup style). Default true. */
  showCloseButton?: boolean;
};

export function ComingSoonHypeModal({
  visible,
  onDismiss,
  headline,
  message,
  buttonLabel = "Can't wait!",
  showCloseButton = true,
}: ComingSoonHypeModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scaleAnim.setValue(0.9);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <TouchableOpacity
        activeOpacity={1}
        style={hypeStyles.backdrop}
        onPress={onDismiss}
      >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <Animated.View style={[hypeStyles.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
            {showCloseButton && (
              <TouchableOpacity
                style={hypeStyles.closeButton}
                onPress={onDismiss}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Close"
              >
                <Feather name="x" size={22} color="#64748b" />
              </TouchableOpacity>
            )}
            <View style={hypeStyles.iconWrap}>
              <Feather name="zap" size={32} color="#f59e0b" />
            </View>
            <Text style={hypeStyles.headline}>{headline}</Text>
            <Text style={hypeStyles.message}>{message}</Text>
            <TouchableOpacity style={hypeStyles.cta} onPress={onDismiss} activeOpacity={0.85}>
              <Text style={hypeStyles.ctaText}>{buttonLabel}</Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const hypeStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headline: {
    fontSize: isWeb ? 24 : 22,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: isWeb ? 15 : 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    minWidth: 160,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default ComingSoonOverlay;
