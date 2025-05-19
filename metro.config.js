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

// Add custom resolver for @stripe/stripe-react-native on web
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform, realModuleName) => {
  if (platform === 'web' && moduleName === '@stripe/stripe-react-native') {
    // For web, mock the module by returning an empty object or a path to a mock file.
    // This example returns an empty module.
    return {
      filePath: require.resolve('./ws-mock.js'), // Path to an empty or mock module
      type: 'sourceFile',
    };
  }

  // For other modules or platforms, use the default resolver
  // Check if originalResolveRequest is a function before calling
  if (typeof originalResolveRequest === 'function') {
    return originalResolveRequest(context, moduleName, platform, realModuleName);
  }
  // Fallback if originalResolveRequest is not a function (e.g. not set)
  // This might delegate to Metro's default internal resolution.
  return context.resolveRequest(context, moduleName, platform, realModuleName);
};

module.exports = config;
