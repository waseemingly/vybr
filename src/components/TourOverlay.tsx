import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

export type SpotlightRect = { x: number; y: number; width: number; height: number; radius?: number };

type Props = {
  visible: boolean;
  spotlight?: SpotlightRect | null;
  onRequestClose?: () => void;
  children?: React.ReactNode;
};

export function TourOverlay({ visible, spotlight, onRequestClose, children }: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <View style={styles.root}>
        {/* Tap outside to do nothing (we usually don't want accidental closes) */}
        <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} />

        {/* Dimmer + spotlight cut-out */}
        <Svg width={screenW} height={screenH} style={StyleSheet.absoluteFill}>
          <Defs>
            <Mask id="spotlightMask">
              <Rect x="0" y="0" width={screenW} height={screenH} fill="white" />
              {spotlight ? (
                <Rect
                  x={spotlight.x}
                  y={spotlight.y}
                  width={spotlight.width}
                  height={spotlight.height}
                  rx={spotlight.radius ?? 14}
                  ry={spotlight.radius ?? 14}
                  fill="black"
                />
              ) : null}
            </Mask>
          </Defs>
          <Rect
            x="0"
            y="0"
            width={screenW}
            height={screenH}
            fill="rgba(0,0,0,0.55)"
            mask="url(#spotlightMask)"
          />
        </Svg>

        {/* Content (tooltip) */}
        <View pointerEvents="box-none" style={styles.content}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? ({ cursor: 'default' } as any) : null),
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
  },
});


