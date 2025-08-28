
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.3189b45524fd4fc8af63d0e4a63bad8b',
  appName: 'Vybr Web',
  webDir: 'dist',
  server: {
    url: 'https://3189b455-24fd-4fc8-af63-d0e4a63bad8b.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#ffffff",
      showSpinner: true,
      spinnerColor: "#3B82F6",
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
