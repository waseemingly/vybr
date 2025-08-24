import React from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { usePowerSyncData, usePowerSyncDataWatcher } from '@/hooks/usePowerSyncData';
import { usePowerSync } from '@/context/PowerSyncContext';

export const PowerSyncExample: React.FC = () => {
  const { isPowerSyncAvailable, isConnected, isMobile, isWeb, isOffline } = usePowerSync();

  // Example: Get all events
  const { data: events, loading: eventsLoading, error: eventsError } = usePowerSyncData(
    'SELECT * FROM events ORDER BY start_date DESC LIMIT 10'
  );

  // Example: Get user profile (watched query for real-time updates)
  const { data: profiles, loading: profilesLoading, error: profilesError } = usePowerSyncDataWatcher(
    'SELECT * FROM musicLoverProfiles LIMIT 5'
  );

  // Example: Get messages (for offline testing)
  const { data: messages, loading: messagesLoading, error: messagesError } = usePowerSyncDataWatcher(
    'SELECT * FROM messages ORDER BY created_at DESC LIMIT 10'
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
        <Text>Offline Mode: {isOffline ? '🟡 Yes (Offline)' : '🟢 No (Online)'}</Text>
        <Text>Status: {isPowerSyncAvailable ? (isOffline ? '🟡 Offline Mode (Local Data)' : '🟢 Full PowerSync Support') : isWeb ? '🟡 Supabase Fallback' : '🔴 Not Available'}</Text>
      </View>

      {/* Connection Status */}
      <View style={{ marginBottom: 20, padding: 15, backgroundColor: isOffline ? '#fff3cd' : '#d4edda', borderRadius: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          Connection Status
        </Text>
        <Text>Online: {!isOffline ? '✅ Yes' : '❌ No'}</Text>
        <Text>Offline: {isOffline ? '✅ Yes' : '❌ No'}</Text>
        <Text>Local Database: {isPowerSyncAvailable ? '✅ Available' : '❌ Not Available'}</Text>
        <Text style={{ marginTop: 10, fontStyle: 'italic', color: isOffline ? '#856404' : '#155724' }}>
          {isOffline ? '📱 Working in offline mode with local data' : '🌐 Connected to PowerSync server'}
        </Text>
      </View>

      {/* Data Examples */}
      <View style={{ marginBottom: 20, padding: 15, backgroundColor: '#e2e3e5', borderRadius: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          Data Examples
        </Text>
        
        {/* Events */}
        <View style={{ marginBottom: 15 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Events ({events?.length || 0})</Text>
          {eventsLoading ? (
            <ActivityIndicator size="small" />
          ) : eventsError ? (
            <Text style={{ color: 'red' }}>Error: {eventsError}</Text>
          ) : (
            <Text>✅ Events loaded successfully</Text>
          )}
        </View>

        {/* Profiles */}
        <View style={{ marginBottom: 15 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Profiles ({profiles?.length || 0})</Text>
          {profilesLoading ? (
            <ActivityIndicator size="small" />
          ) : profilesError ? (
            <Text style={{ color: 'red' }}>Error: {profilesError}</Text>
          ) : (
            <Text>✅ Profiles loaded successfully</Text>
          )}
        </View>

        {/* Messages */}
        <View style={{ marginBottom: 15 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Messages ({messages?.length || 0})</Text>
          {messagesLoading ? (
            <ActivityIndicator size="small" />
          ) : messagesError ? (
            <Text style={{ color: 'red' }}>Error: {messagesError}</Text>
          ) : (
            <Text>✅ Messages loaded successfully</Text>
          )}
        </View>
      </View>

      {/* Offline Testing Instructions */}
      {isMobile && isPowerSyncAvailable && (
        <View style={{ marginBottom: 20, padding: 15, backgroundColor: '#d1ecf1', borderRadius: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
            Offline Testing
          </Text>
          <Text style={{ marginBottom: 5 }}>1. Turn off WiFi/Mobile data</Text>
          <Text style={{ marginBottom: 5 }}>2. Check if data still loads</Text>
          <Text style={{ marginBottom: 5 }}>3. Status should show "Offline Mode"</Text>
          <Text style={{ marginBottom: 5 }}>4. Data should still be accessible</Text>
          <Text style={{ marginTop: 10, fontStyle: 'italic', color: '#0c5460' }}>
            💡 PowerSync should work offline with cached data
          </Text>
        </View>
      )}

      {/* Debug Information */}
      <View style={{ marginBottom: 20, padding: 15, backgroundColor: '#f8f9fa', borderRadius: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          Debug Information
        </Text>
        <Text>PowerSync Available: {String(isPowerSyncAvailable)}</Text>
        <Text>Is Connected: {String(isConnected)}</Text>
        <Text>Is Offline: {String(isOffline)}</Text>
        <Text>Is Mobile: {String(isMobile)}</Text>
        <Text>Is Web: {String(isWeb)}</Text>
      </View>
    </ScrollView>
  );
}; 