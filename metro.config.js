const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
/** @type {import('expo/metro-config').MetroConfig} */

// Configure web server port
config.server = {
  ...config.server,
  port: process.env.EXPO_WEB_PORT ? parseInt(process.env.EXPO_WEB_PORT) : (process.env.PORT ? parseInt(process.env.PORT) : 19006),
};

// Disable Hermes for web platform (causes iOS Safari stack overflow)
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

// Force JSC for web instead of Hermes
if (process.env.EXPO_PLATFORM === 'web' || process.env.PLATFORM === 'web') {
  config.transformer = {
    ...config.transformer,
    unstable_allowRequireContext: true,
  };
}

config.resolver.unstable_enablePackageExports = true;

// Add Node.js polyfills
config.resolver.extraNodeModules = {
  stream: require.resolve('stream-browserify'),
  'event-target-shim': require.resolve('event-target-shim'),
};

// Add custom resolver for platform-specific modules
config.resolver.resolveRequest = (context, moduleName, platform, realModuleName) => {
  // Handle PowerSync modules for web
  if (platform === 'web') {
    if (moduleName === '@powersync/react-native') {
      // For web, use the web SDK
      return context.resolveRequest(context, '@powersync/web', platform, realModuleName);
    }
    if (moduleName === '@stripe/stripe-react-native') {
      // For web, mock the module
      return {
        filePath: require.resolve('./ws-mock.js'),
        type: 'sourceFile',
      };
    }
  } else {
    // For mobile platforms (iOS/Android), exclude web-specific modules
    if (moduleName === '@powersync/web') {
      return {
        type: 'empty'
      };
    }
  }

  // For other modules, use the default resolver
  return context.resolveRequest(context, moduleName, platform, realModuleName);
};

module.exports = config;
