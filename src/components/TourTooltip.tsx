import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  title: string;
  description: string;
  stepLabel: string;
  canGoBack: boolean;
  isLast: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
  containerStyle?: StyleProp<ViewStyle>;
};

export function TourTooltip({
  title,
  description,
  stepLabel,
  canGoBack,
  isLast,
  onPrev,
  onNext,
  onSkip,
  containerStyle,
}: Props) {
  return (
    <View style={[styles.wrapper, containerStyle]} pointerEvents="box-none">
      <View style={styles.card}>
        <Text style={styles.stepLabel}>{stepLabel}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>

        <View style={styles.actionsRow}>
          <View style={styles.leftActions}>
            {canGoBack ? (
              <TouchableOpacity onPress={onPrev} style={[styles.button, styles.secondaryButton]}>
                <Text style={[styles.buttonText, styles.secondaryText]}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}
          </View>

          <View style={styles.rightActions}>
            <TouchableOpacity onPress={onSkip} style={[styles.button, styles.ghostButton]}>
              <Text style={[styles.buttonText, styles.ghostText]}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onNext} style={[styles.button, styles.primaryButton]}>
              <Text style={[styles.buttonText, styles.primaryText]}>{isLast ? 'Done' : 'Next'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    ...(Platform.OS === 'web' ? ({ maxWidth: 520, alignSelf: 'center', width: '100%' } as any) : null),
  },
  stepLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#F1F5F9',
  },
  secondaryText: {
    color: '#0F172A',
  },
  ghostButton: {
    backgroundColor: 'transparent',
  },
  ghostText: {
    color: '#64748B',
  },
});


