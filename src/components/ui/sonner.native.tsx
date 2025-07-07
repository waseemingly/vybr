import * as React from 'react';
import { View } from 'react-native';

// Native stub: On iOS/Android we don't render the web-based Sonner toaster.
// This prevents web-only libraries (sonner, next-themes) from breaking the native bundle.
export const Toaster: React.FC = () => <View />; 