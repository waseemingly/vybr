import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useAppleMusicAuth } from '@/hooks/useAppleMusicAuth';
import { useStreamingData } from '@/hooks/useStreamingData';
import { useAuth } from '@/hooks/useAuth';

interface AppleMusicIntegrationProps {
  onDataUpdated?: () => void;
}

export const AppleMusicIntegration: React.FC<AppleMusicIntegrationProps> = ({ onDataUpdated }) => {
  const { session } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  
  const {
    isLoggedIn,
    isLoading,
    error,
    login,
    logout,
    fetchAndSaveAppleMusicData,
    credentialsLoaded,
    developerToken
  } = useAppleMusicAuth();

  const {
    loading: dataLoading,
    error: dataError,
    hasData,
    topArtists,
    topTracks,
    topGenres,
    topMoods
  } = useStreamingData(session?.user?.id, {
    isAppleMusicLoggedIn: isLoggedIn
  });

  // Check if user has Apple Music data
  useEffect(() => {
    if (session?.user?.id) {
      // This would check if the user has Apple Music data in the database
      // Implementation depends on your existing data fetching logic
      setIsConnected(hasData);
    }
  }, [session?.user?.id, hasData]);

  const handleLogin = async () => {
    try {
      await login();
      if (onDataUpdated) {
        onDataUpdated();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to connect to Apple Music');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsConnected(false);
      if (onDataUpdated) {
        onDataUpdated();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to disconnect from Apple Music');
    }
  };

  const handleRefreshData = async () => {
    try {
      const success = await fetchAndSaveAppleMusicData();
      if (success) {
        Alert.alert('Success', 'Apple Music data refreshed successfully');
        if (onDataUpdated) {
          onDataUpdated();
        }
      } else {
        Alert.alert('Error', 'Failed to refresh Apple Music data');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to refresh Apple Music data');
    }
  };

  if (!credentialsLoaded) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>Loading Apple Music credentials...</Text>
      </View>
    );
  }

  if (!developerToken) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Apple Music developer token not available. Please configure Apple Music API credentials.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Apple Music Integration</Text>
      
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
      
      {dataError && (
        <Text style={styles.errorText}>Data Error: {dataError}</Text>
      )}

      {!isLoggedIn ? (
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleLogin}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Connecting...' : 'Connect Apple Music'}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.connectedContainer}>
          <Text style={styles.connectedText}>✅ Connected to Apple Music</Text>
          
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={handleRefreshData}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Refreshing...' : 'Refresh Music Data'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
            disabled={isLoading}
          >
            <Text style={styles.logoutButtonText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      )}

      {isConnected && (
        <View style={styles.dataContainer}>
          <Text style={styles.dataTitle}>Your Apple Music Data:</Text>
          <Text style={styles.dataText}>Artists: {topArtists.length}</Text>
          <Text style={styles.dataText}>Tracks: {topTracks.length}</Text>
          <Text style={styles.dataText}>Genres: {topGenres.length}</Text>
          <Text style={styles.dataText}>Moods: {topMoods.length}</Text>
        </View>
      )}
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
  },
  statusText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
  },
  errorText: {
    fontSize: 14,
    color: '#ff4444',
    textAlign: 'center',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  connectedContainer: {
    alignItems: 'center',
  },
  connectedText: {
    fontSize: 16,
    color: '#4CAF50',
    marginBottom: 15,
    fontWeight: '600',
  },
  refreshButton: {
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
    minWidth: 150,
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
  dataContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dataTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  dataText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
});

export default AppleMusicIntegration;



