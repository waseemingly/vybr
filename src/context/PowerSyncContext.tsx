import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { getAuthToken, PowerSyncConnector } from '@/lib/powersync';
import Constants from 'expo-constants';

// Use React Native's Platform API for proper platform detection
const platform = Platform.OS;

// Access environment variables
const powersyncUrl = Constants.expoConfig?.extra?.POWERSYNC_URL;

if (!powersyncUrl) {
  console.error('❌ PowerSync: URL is missing. Please check your environment variables.');
  console.log('🔍 PowerSync: Available extra config:', Constants.expoConfig?.extra);
} else {
  console.log('✅ PowerSync: URL configured:', powersyncUrl);
}

interface PowerSyncContextType {
  db: any | null;
  isConnected: boolean;
  isSupported: boolean;
  isPowerSyncAvailable: boolean;
  isMobile: boolean;
  isWeb: boolean;
  connector: PowerSyncConnector | null;
  isOffline: boolean; // NEW: Track offline status separately
}

const PowerSyncContext = createContext<PowerSyncContextType>({
  db: null,
  isConnected: false,
  isSupported: false,
  isPowerSyncAvailable: false,
  isMobile: false,
  isWeb: false,
  connector: null,
  isOffline: false, // NEW: Track offline status separately
});

interface PowerSyncProviderProps {
  children: ReactNode;
}

export const PowerSyncProvider: React.FC<PowerSyncProviderProps> = ({ children }) => {
  const [db, setDb] = useState<any | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSupported] = useState(platform === 'ios' || platform === 'android'); // Only support mobile
  const [isMobile] = useState(platform === 'ios' || platform === 'android');
  const [isWeb] = useState(platform === 'web');
  const [connector] = useState(() => new PowerSyncConnector());
  const [isInitializing, setIsInitializing] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false); // NEW: Track offline status

  // Monitor connection status with better offline handling
  useEffect(() => {
    if (!db) return;

    const checkConnection = async () => {
      try {
        // Simple query to test connection - this should work even offline
        await db.getAll('SELECT 1 as test');
        
        // If we can query the database, we're not offline
        if (isOffline) {
          console.log('🔍 PowerSync: Back online, connection restored');
          setIsOffline(false);
        }
        
        // Only update connection status if we're not offline
        if (!isConnected && !isOffline) {
          console.log('🔍 PowerSync: Connection restored');
          setIsConnected(true);
          setConnectionError(null);
        }
      } catch (error) {
        console.warn('⚠️ PowerSync: Connection check failed:', error);
        
        // Check if this is a network-related error (offline)
        const errorMessage = error instanceof Error ? error.message : '';
        const isNetworkError = errorMessage.includes('network') || 
                              errorMessage.includes('fetch') || 
                              errorMessage.includes('timeout') ||
                              errorMessage.includes('ENOTFOUND') ||
                              errorMessage.includes('ECONNREFUSED');
        
        if (isNetworkError) {
          // Network error - mark as offline but keep database available
          if (!isOffline) {
            console.log('🔍 PowerSync: Network error detected, switching to offline mode');
            setIsOffline(true);
            setIsConnected(false);
            setConnectionError('Offline mode');
          }
        } else {
          // Other error - mark connection as lost
          if (isConnected) {
            setIsConnected(false);
            setConnectionError('Connection lost');
          }
        }
      }
    };

    // Check connection every 60 seconds instead of 30 for better performance
    const interval = setInterval(checkConnection, 60000);
    return () => clearInterval(interval);
  }, [db, isConnected, isOffline]);

  // Initialize PowerSync only when user logs in (not on mount)
  useEffect(() => {
    const handleAuthChange = async (event: string, session: any) => {
      console.log(`🔍 PowerSync: Auth state changed: ${event}`);
      
      if (event === 'SIGNED_IN' && session?.access_token) {
        console.log('🔍 PowerSync: User signed in, will initialize PowerSync later...');
        
        // Delay PowerSync initialization to avoid bundling during auth flow
        setTimeout(async () => {
          // Prevent multiple initialization attempts
          if (isInitializing || isConnected) {
            console.log('🔍 PowerSync: Already initializing or connected, skipping...');
            return;
          }
          
          setIsInitializing(true);
          setConnectionError(null);
          console.log('🔍 PowerSync: Starting delayed initialization...');
          
          // Check PowerSync URL configuration
          if (!powersyncUrl) {
            console.error('❌ PowerSync: URL not configured, skipping initialization');
            setConnectionError('PowerSync URL not configured');
            setIsInitializing(false);
            return;
          }
          
          // Only initialize if on mobile platform
          if (platform === 'ios' || platform === 'android') {
            try {
              console.log(`🔍 PowerSync: Initializing for ${platform} platform after auth...`);
              
              // Add timeout to prevent blocking auth flow
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('PowerSync initialization timeout')), 10000); // 10 second timeout
              });
              
              // Import and create platform-specific database with timeout
              const { createPowerSyncDatabase } = await import('@/lib/powersync');
              const databasePromise = createPowerSyncDatabase();
              const database = await Promise.race([databasePromise, timeoutPromise]) as any;
              
              if (!database) {
                console.error('❌ PowerSync: Failed to create database after auth');
                setConnectionError('Failed to create database');
                setIsInitializing(false);
                return;
              }

              console.log('✅ PowerSync: Database created successfully after auth');
              setDb(database);
              
              // Connect the database using the connector
              console.log('🔍 PowerSync: Connecting database with connector after auth...');
              await database.connect(connector);
              setIsConnected(true);
              setConnectionError(null);
              console.log(`✅ PowerSync: ${platform} database connected successfully after auth`);
              
            } catch (error) {
              console.error('❌ Failed to initialize PowerSync after auth:', error);
              console.log('⚠️ PowerSync: Continuing without PowerSync, using Supabase fallback');
              setDb(null);
              setIsConnected(false);
              setConnectionError(error instanceof Error ? error.message : 'Initialization failed');
            } finally {
              setIsInitializing(false);
            }
          } else {
            console.log('⚠️ PowerSync: Web platform not supported, using Supabase instead');
          }
        }, 1000); // 1 second delay instead of 2 to ensure auth flow is complete
        
      } else if (event === 'SIGNED_OUT') {
        console.log('🔍 PowerSync: User signed out, cleaning up PowerSync...');
        setDb(null);
        setIsConnected(false);
        setConnectionError(null);
      }
    };

    // Set up auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);
    
    return () => {
      subscription.unsubscribe();
    };
  }, [connector, platform, powersyncUrl, isInitializing, isConnected]);

  // Determine if PowerSync is available for use (both platforms now)
  // Modified to allow offline access to local database
  const isPowerSyncAvailable = isSupported && db !== null && (isConnected || isOffline) && !connectionError;

  const value: PowerSyncContextType = {
    db,
    isConnected,
    isSupported,
    isPowerSyncAvailable,
    isMobile,
    isWeb,
    connector,
    isOffline, // NEW: Track offline status separately
  };

  // Only log context value changes, not on every render
  useEffect(() => {
    console.log('🔍 PowerSync: Context value:', {
      isConnected,
      isSupported,
      isPowerSyncAvailable,
      isMobile,
      isWeb,
      hasDb: !!db,
      platform,
      connectionError,
      isOffline // NEW: Log offline status
    });
  }, [isConnected, isSupported, isPowerSyncAvailable, isMobile, isWeb, db, platform, connectionError, isOffline]);

  return (
    <PowerSyncContext.Provider value={value}>
      {children}
    </PowerSyncContext.Provider>
  );
};

export const usePowerSync = () => {
  const context = useContext(PowerSyncContext);
  if (context === undefined) {
    throw new Error('usePowerSync must be used within a PowerSyncProvider');
  }
  return context;
}; 