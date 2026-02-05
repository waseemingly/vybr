/**
 * Stub for react-native/Libraries/Image/resolveAssetSource.
 * Used by Vite web build; returns empty for native asset resolution.
 */
export default function resolveAssetSource(source) {
  return source && typeof source === "object" && source.uri ? source : { uri: null, width: undefined, height: undefined };
}
