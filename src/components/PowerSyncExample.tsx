import React from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { usePowerSyncData, usePowerSyncDataWatcher } from '@/hooks/usePowerSyncData';
import { usePowerSync } from '@/context/PowerSyncContext';

export const PowerSyncExample: React.FC = () => {
  const { isPowerSyncAvailable, isConnected, isMobile, isWeb } = usePowerSync();

  // Example: Get all events
  const { data: events, loading: eventsLoading, error: eventsError } = usePowerSyncData(
    'SELECT * FROM events ORDER BY start_date DESC LIMIT 10'
  );

  // Example: Get user profile (watched query for real-time updates)
  const { data: profiles, loading: profilesLoading, error: profilesError } = usePowerSyncDataWatcher(
    'SELECT * FROM musicLoverProfiles LIMIT 5'
  );

  return (
    <ScrollView style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        PowerSync Integration Status
      </Text>
      
      {/* Platform Information */}
      <View style={{ marginBottom: 20, padding: 15, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          Platform Information
        </Text>
        <Text>Platform: {isMobile ? '🟢 Mobile (iOS/Android)' : isWeb ? '🔵 Web' : '❓ Unknown'}</Text>
        <Text>PowerSync Available: {isPowerSyncAvailable ? '✅ Yes' : '❌ No'}</Text>
        <Text>Connected: {isConnected ? '✅ Yes' : '❌ No'}</Text>
        <Text>Status: {isPowerSyncAvailable ? '🟢 Full PowerSync Support' : isWeb ? '🟡 Supabase Fallback' : '🔴 Not Available'}</Text>
      </View>

      {/* Feature Status */}
      <View style={{ marginBottom: 20, padding: 15, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          Feature Support
        </Text>
        <Text>✅ Real-time Sync: {isPowerSyncAvailable ? 'Available' : 'Limited (Supabase)'}</Text>
        <Text>✅ Offline Support: {isMobile || isWeb ? 'Available' : 'Limited'}</Text>
        <Text>✅ Local SQLite: {isMobile ? 'Full' : isWeb ? 'Limited' : 'None'}</Text>
        <Text>✅ Conflict Resolution: {isPowerSyncAvailable ? 'Automatic' : 'Manual'}</Text>
        <Text>✅ Reactive UI: {isPowerSyncAvailable ? 'Available' : 'Limited'}</Text>
      </View>

      {/* Data Examples */}
      {isPowerSyncAvailable ? (
        <>
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
              Events (Static Query)
            </Text>
            {eventsLoading ? (
              <ActivityIndicator size="small" />
            ) : eventsError ? (
              <Text style={{ color: 'red' }}>Error: {eventsError}</Text>
            ) : (
              <Text>Found {events.length} events</Text>
            )}
          </View>

          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
              Profiles (Real-time Updates)
            </Text>
            {profilesLoading ? (
              <ActivityIndicator size="small" />
            ) : profilesError ? (
              <Text style={{ color: 'red' }}>Error: {profilesError}</Text>
            ) : (
              <Text>Found {profiles.length} profiles (updates in real-time)</Text>
            )}
          </View>
        </>
      ) : (
        <View style={{ marginBottom: 20, padding: 15, backgroundColor: '#fff3cd', borderRadius: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#856404', marginBottom: 10 }}>
            PowerSync Not Available
          </Text>
          <Text style={{ color: '#856404' }}>
            {isWeb 
              ? 'Web platform is using Supabase fallback. PowerSync web support may require additional configuration.'
              : 'PowerSync is not available on this platform.'
            }
          </Text>
        </View>
      )}

      {/* Platform-specific Notes */}
      {isWeb && (
        <View style={{ marginBottom: 20, padding: 15, backgroundColor: '#d1ecf1', borderRadius: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0c5460', marginBottom: 10 }}>
            Web Platform Notes
          </Text>
          <Text style={{ color: '#0c5460' }}>
            • PowerSync Web requires additional setup for full functionality{'\n'}
            • Currently using Supabase as fallback{'\n'}
            • Real-time sync may be limited{'\n'}
            • Offline support may be restricted
          </Text>
        </View>
      )}

      {isMobile && (
        <View style={{ marginBottom: 20, padding: 15, backgroundColor: '#d4edda', borderRadius: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#155724', marginBottom: 10 }}>
            Mobile Platform Notes
          </Text>
          <Text style={{ color: '#155724' }}>
            • Full PowerSync functionality available{'\n'}
            • Real-time synchronization{'\n'}
            • Offline-first with SQLite{'\n'}
            • Automatic conflict resolution
          </Text>
        </View>
      )}
    </ScrollView>
  );
}; 