import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAppleMusicAuth } from '@/hooks/useAppleMusicAuth';

export const AppleMusicTest: React.FC = () => {
  const {
    isLoggedIn,
    isLoading,
    error,
    credentialsLoaded,
    developerToken,
    appleMusicTeamId,
    appleMusicKeyId,
    login,
    logout
  } = useAppleMusicAuth();

  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    const results = [];
    
    if (credentialsLoaded) {
      results.push('✅ Credentials loaded from database');
    } else {
      results.push('❌ Credentials not loaded');
    }

    if (appleMusicTeamId) {
      results.push(`✅ Team ID: ${appleMusicTeamId}`);
    } else {
      results.push('❌ Team ID missing');
    }

    if (appleMusicKeyId) {
      results.push(`✅ Key ID: ${appleMusicKeyId}`);
    } else {
      results.push('❌ Key ID missing');
    }

    if (developerToken) {
      results.push('✅ Developer token generated');
    } else {
      results.push('❌ Developer token not generated');
    }

    setTestResults(results);
  }, [credentialsLoaded, appleMusicTeamId, appleMusicKeyId, developerToken]);

  const handleTestConnection = async () => {
    try {
      if (!isLoggedIn) {
        await login();
      } else {
        Alert.alert('Already Connected', 'You are already connected to Apple Music');
      }
    } catch (err) {
      Alert.alert('Connection Error', 'Failed to connect to Apple Music');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Apple Music Integration Test</Text>
      
      {error && (
        <Text style={styles.errorText}>Error: {error}</Text>
      )}

      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>Configuration Status:</Text>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.statusText}>{result}</Text>
        ))}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, isLoggedIn && styles.connectedButton]} 
          onPress={handleTestConnection}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Loading...' : 
             isLoggedIn ? 'Connected to Apple Music' : 
             'Test Apple Music Connection'}
          </Text>
        </TouchableOpacity>

        {isLoggedIn && (
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={logout}
            disabled={isLoading}
          >
            <Text style={styles.logoutButtonText}>Disconnect</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Expected Results:</Text>
        <Text style={styles.infoText}>• All status items should show ✅</Text>
        <Text style={styles.infoText}>• Team ID should be: R8UV449WRY</Text>
        <Text style={styles.infoText}>• Key ID should be: UJY8ZUMU4D</Text>
        <Text style={styles.infoText}>• Developer token should be generated</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    margin: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  errorText: {
    fontSize: 14,
    color: '#ff4444',
    textAlign: 'center',
    marginBottom: 15,
    backgroundColor: '#ffe6e6',
    padding: 10,
    borderRadius: 5,
  },
  statusContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  statusText: {
    fontSize: 14,
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  buttonContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 200,
    marginBottom: 10,
  },
  connectedButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: 'transparent',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff4444',
    minWidth: 150,
  },
  logoutButtonText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    backgroundColor: '#e8f4fd',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#007AFF',
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
});

export default AppleMusicTest;



