const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
/** @type {import('expo/metro-config').MetroConfig} */

config.resolver.unstable_enablePackageExports = false;

// Add Node.js polyfills
config.resolver.extraNodeModules = {
  stream: require.resolve('stream-browserify'),
  'event-target-shim': require.resolve('event-target-shim'),
  // Add other polyfills as needed:
  // crypto: require.resolve('crypto-browserify'),
  // http: require.resolve('stream-http'),
  // https: require.resolve('https-browserify'),
  // net: require.resolve('react-native-tcp'),
  // tls: require.resolve('react-native-tcp'),
  // fs: require.resolve('react-native-fs'),
  // path: require.resolve('path-browserify'),
};

module.exports = config;
