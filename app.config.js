export default {
  expo: {
    name: "vybr",
    slug: "vybr",
    version: "1.0.0",
    orientation: "portrait",
    newArchEnabled: false,
    userInterfaceStyle: "light",
    splash: {
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.vybr.app"
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#ffffff"
      },
      package: "com.vybr.app",
      intentFilters: [
        {
          action: "VIEW",
          data: [
            {
              scheme: "vybr"
            }
          ],
          category: [
            "BROWSABLE",
            "DEFAULT"
          ]
        }
      ]
    },
    web: {},
    scheme: "vybr",
    plugins: [
      "expo-dev-client",
      "expo-secure-store",
      "expo-font",
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme: "com.googleusercontent.apps.830574548321-doit0a0ik7iv6321svdm1bt5r2batcat"
        }
      ],
      [
        "./plugins/withReactNativeAppAuth.js",
        {
          scheme: "vybr"
        }
      ],
      [
        "./plugins/withAppAuth.js",
        {
          scheme: "vybr"
        }
      ]
    ],
    extra: {
      SUPABASE_URL: "https://fqfgueshwuhpckszyrsj.supabase.co",
      SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxZmd1ZXNod3VocGNrc3p5cnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMyNjQ1NzcsImV4cCI6MjA1ODg0MDU3N30.URSa8s4NeNpGJjD29i-UBAn_PZ4d3Xumhk4Iqz6fKkQ",
      SPOTIFY_CLIENT_ID: "7724af6090634c3db7c82fd54f1a0fff",
      SPOTIFY_CLIENT_SECRET: "your-spotify-client-secret",
      SPOTIFY_REDIRECT_URI: "http://127.0.0.1:19006/callback",
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: "830574548321-doit0a0ik7iv6321svdm1bt5r2batcat.apps.googleusercontent.com",
      eas: {
        projectId: "2e4e657f-20f5-468b-87ee-ebf78ca2a0cc"
      }
    }
  }
}; 