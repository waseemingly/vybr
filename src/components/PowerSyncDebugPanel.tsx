import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { usePowerSync } from '@/context/PowerSyncContext';
import { PowerSyncChatFunctions } from '@/lib/powersync/chatFunctions';
import { useAuth } from '@/hooks/useAuth';

export const PowerSyncDebugPanel: React.FC = () => {
  const { db, isPowerSyncAvailable, isConnected, isOffline, isMobile } = usePowerSync();
  const { session } = useAuth();
  const [debugResults, setDebugResults] = useState<string[]>([]);

  const addDebugResult = (message: string) => {
    setDebugResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runDebugChecks = async () => {
    setDebugResults([]);
    addDebugResult('Starting PowerSync debug checks...');
    
    addDebugResult(`Platform: ${isMobile ? 'Mobile' : 'Web'}`);
    addDebugResult(`PowerSync Available: ${isPowerSyncAvailable}`);
    addDebugResult(`Connected: ${isConnected}`);
    addDebugResult(`Offline: ${isOffline}`);
    addDebugResult(`Database: ${db ? 'Available' : 'Not Available'}`);
    addDebugResult(`User ID: ${session?.user?.id || 'Not logged in'}`);

    if (!db || !session?.user?.id) {
      addDebugResult('❌ Cannot run debug checks - missing database or user');
      return;
    }

    try {
      // Check tables
      await PowerSyncChatFunctions.debugTables(db);
      addDebugResult('✅ Table check completed');
      
      // Check message tables
      await PowerSyncChatFunctions.debugMessageTables(db);
      addDebugResult('✅ Message table check completed');
      
      // Check chat data
      await PowerSyncChatFunctions.debugChatData(db, session.user.id);
      addDebugResult('✅ Chat data check completed');
      
    } catch (error) {
      addDebugResult(`❌ Debug check failed: ${error}`);
    }
  };

  const clearDebugResults = () => {
    setDebugResults([]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PowerSync Debug Panel</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>Status:</Text>
        <Text style={[styles.statusText, { color: isPowerSyncAvailable ? 'green' : 'red' }]}>
          {isPowerSyncAvailable ? 'Available' : 'Not Available'}
        </Text>
        <Text style={[styles.statusText, { color: isConnected ? 'green' : 'red' }]}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </Text>
        <Text style={[styles.statusText, { color: isOffline ? 'orange' : 'green' }]}>
          {isOffline ? 'Offline' : 'Online'}
        </Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={runDebugChecks}>
        <Text style={styles.buttonText}>Run Debug Checks</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.clearButton]} onPress={clearDebugResults}>
        <Text style={styles.buttonText}>Clear Results</Text>
      </TouchableOpacity>

      <ScrollView style={styles.resultsContainer}>
        {debugResults.map((result, index) => (
          <Text key={index} style={styles.resultText}>{result}</Text>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    padding: 10,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  clearButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  resultText: {
    fontSize: 12,
    marginBottom: 5,
    fontFamily: 'monospace',
  },
});
