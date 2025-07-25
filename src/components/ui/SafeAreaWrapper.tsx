import React from 'react';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { StyleSheet, ViewStyle } from 'react-native';

interface SafeAreaWrapperProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
  backgroundColor?: string;
}

/**
 * A wrapper component that provides consistent safe area handling across the app.
 * This ensures that content doesn't overlap with the status bar, notches, or other system UI elements.
 * 
 * @param children - The content to render inside the safe area
 * @param style - Additional styles to apply to the container
 * @param edges - Which edges to apply safe area insets to (default: all edges)
 * @param backgroundColor - Background color for the safe area (default: white)
 */
const SafeAreaWrapper: React.FC<SafeAreaWrapperProps> = ({
  children,
  style,
  edges = ['top', 'bottom', 'left', 'right'],
  backgroundColor = '#FFFFFF'
}) => {
  return (
    <SafeAreaView 
      style={[
        styles.container,
        { backgroundColor },
        style
      ]} 
      edges={edges}
    >
      {children}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default SafeAreaWrapper; 