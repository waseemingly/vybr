const { withAndroidManifest } = require('@expo/config-plugins');

const withAppAuth = (config, { scheme = 'vybr' } = {}) => {
  return withAndroidManifest(config, (config) => {
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
    
    // Add meta-data for app auth redirect scheme
    if (!androidManifest.manifest.application[0]['meta-data']) {
      androidManifest.manifest.application[0]['meta-data'] = [];
    }
    
    const existingMetaData = androidManifest.manifest.application[0]['meta-data'].find(
      meta => meta.$['android:name'] === 'appAuthRedirectScheme'
    );
    
    if (!existingMetaData) {
      androidManifest.manifest.application[0]['meta-data'].push({
        $: {
          'android:name': 'appAuthRedirectScheme',
          'android:value': scheme
        }
      });
    }
    
    return config;
  });
};

module.exports = withAppAuth; 