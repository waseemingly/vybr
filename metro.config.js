const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
/** @type {import('expo/metro-config').MetroConfig} */

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
