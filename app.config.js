export default {
  expo: {
    name: "vybr",
    slug: "vybr",
    version: "1.0.0",
    orientation: "portrait",
    newArchEnabled: false,
    userInterfaceStyle: "light",
    // Use stable asset paths (avoid spaces/parentheses) for native build tooling.
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.vybr.music",
      buildNumber: "25",
      associatedDomains: ["applinks:vybr.app"],
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSPhotoLibraryUsageDescription: "This app needs access to your photo library to let you select and share profile pictures and event images.",
        NSPhotoLibraryAddUsageDescription: "This app needs access to save photos to your photo library.",
        NSCameraUsageDescription: "This app needs access to your camera to let you take photos for your profile and events.",
        NSMicrophoneUsageDescription: "This app needs access to your microphone for voice features and audio recording.",
        NSLocationWhenInUseUsageDescription: "This app needs access to your location to show nearby events and venues."
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.vybr.app",
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "vybr"
            },
            {
              scheme: "https",
              host: "vybr.app"
            }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    web: {
      bundler: "metro"
    },
    scheme: "vybr",
    plugins: [
      "expo-dev-client",
      "expo-secure-store",
      "expo-font",
      "expo-image-picker",
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#ffffff",
          sounds: [],
          mode: "production"
        }
      ],
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme: "com.googleusercontent.apps.830574548321-h59962oi42k7sjuhkefud8tbooo18j",
          iosClientId: "830574548321-h59962oi42k7sjuhkefud8tbooo18j.apps.googleusercontent.com",
          androidClientId: "830574548321-1tm2a4o9ibib5ss4qk3370ufc16vu4jr.apps.googleusercontent.com"
        }
      ]
    ],
    extra: {
      SUPABASE_URL: "https://fqfgueshwuhpckszyrsj.supabase.co",
      SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxZmd1ZXNod3VocGNrc3p5cnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMyNjQ1NzcsImV4cCI6MjA1ODg0MDU3N30.URSa8s4NeNpGJjD29i-UBAn_PZ4d3Xumhk4Iqz6fKkQ",
      SUPABASE_REDIRECT_URL: "vybr://auth/callback",
      SPOTIFY_CLIENT_ID: "7724af6090634c3db7c82fd54f1a0fff",
      SPOTIFY_CLIENT_SECRET: "your-spotify-client-secret",
      SPOTIFY_REDIRECT_URI: "http://127.0.0.1:19006/callback",
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: "830574548321-h59962oi42ok7tejuhkefud8tbooo18j.apps.googleusercontent.com",
      EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: "830574548321-1tm2a4o9ibib5ss4qk3370ufc16vu4jr.apps.googleusercontent.com",
      POWERSYNC_URL: "https://68961d41fd729385fadb5576.powersync.journeyapps.com",
      eas: {
        projectId: "2e4e657f-20f5-468b-87ee-ebf78ca2a0cc"
      }
    }
  }
}; 