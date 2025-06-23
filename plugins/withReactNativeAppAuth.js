const { withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');

const withReactNativeAppAuth = (config, { scheme = 'vybr' } = {}) => {
  // Configure Android
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    
    // Find the main activity
    const mainActivity = androidManifest.manifest.application[0].activity.find(
      (activity) => activity.$['android:name'] === '.MainActivity'
    );
    
    if (mainActivity) {
      // Add intent filter for app auth redirect
      const intentFilter = {
        $: {},
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        category: [
          { $: { 'android:name': 'android.intent.category.DEFAULT' } },
          { $: { 'android:name': 'android.intent.category.BROWSABLE' } }
        ],
        data: [{ $: { 'android:scheme': scheme } }]
      };
      
      if (!mainActivity['intent-filter']) {
        mainActivity['intent-filter'] = [];
      }
      
      // Check if this intent filter already exists
      const existingFilter = mainActivity['intent-filter'].find(filter => 
        filter.data && filter.data.some(data => data.$['android:scheme'] === scheme)
      );
      
      if (!existingFilter) {
        mainActivity['intent-filter'].push(intentFilter);
      }
    }
    
    return config;
  });

  // Configure iOS
  config = withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;
    
    // Add URL scheme for app auth
    if (!infoPlist.CFBundleURLTypes) {
      infoPlist.CFBundleURLTypes = [];
    }
    
    // Check if scheme already exists
    const existingScheme = infoPlist.CFBundleURLTypes.find(
      urlType => urlType.CFBundleURLSchemes && urlType.CFBundleURLSchemes.includes(scheme)
    );
    
    if (!existingScheme) {
      infoPlist.CFBundleURLTypes.push({
        CFBundleURLName: `${scheme}.auth`,
        CFBundleURLSchemes: [scheme]
      });
    }
    
    return config;
  });

  return config;
};

module.exports = withReactNativeAppAuth; 