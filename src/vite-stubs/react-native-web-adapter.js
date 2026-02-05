/**
 * Re-exports react-native-web and stubs for RN-only APIs (TurboModuleRegistry, DrawerLayoutAndroid).
 */
export * from "react-native-web";

export const TurboModuleRegistry = {
  getEnforcing: () => ({}),
};

export const DrawerLayoutAndroid = () => null;
DrawerLayoutAndroid.positions = { Left: 0, Right: 1 };
