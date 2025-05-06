import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth';
import { useAuth } from '@/hooks/useAuth';
import { APP_CONSTANTS } from '@/config/constants';
import { useStreamingData } from '@/hooks/useStreamingData';

const StreamingDataTestScreen = () => {
  const { session, musicLoverProfile } = useAuth();
  const { 
    login, 
    logout, 
    isLoggedIn, 
    isLoading, 
    error, 
    fetchAndSaveSpotifyData,
    userData
  } = useSpotifyAuth();
  
  const { streamingData, loading: dataLoading } = useStreamingData(session?.user?.id, {
    isSpotifyLoggedIn: isLoggedIn,
    isYouTubeMusicLoggedIn: false
  });
  
  const [testMessage, setTestMessage] = useState<string>('');
  const [isPremium, setIsPremium] = useState<boolean>(false);
  
  // Check if user is premium
  useEffect(() => {
    if (musicLoverProfile?.isPremium) {
      setIsPremium(true);
    }
  }, [musicLoverProfile]);
  
  // Function to handle login
  const handleLogin = async () => {
    setTestMessage('Attempting to login...');
    try {
      await login();
      setTestMessage('Login initiated. When the browser popup appears, please sign in with your Spotify account and authorize the app. This window will update once authentication is complete.');
    } catch (err: any) {
      setTestMessage(`Error: ${err.message}`);
    }
  };
  
  // Function to handle logout
  const handleLogout = async () => {
    setTestMessage('Logging out...');
    try {
      await logout();
      setTestMessage('Logged out successfully');
    } catch (err: any) {
      setTestMessage(`Error: ${err.message}`);
    }
  };
  
  // Function to fetch and save data
  const handleFetchData = async () => {
    setTestMessage('Fetching data...');
    try {
      const success = await fetchAndSaveSpotifyData(isPremium);
      if (success) {
        setTestMessage(`Data fetched and saved successfully. User has ${isPremium ? 'PREMIUM' : 'FREE'} access.`);
      } else {
        setTestMessage('Failed to fetch data');
      }
    } catch (err: any) {
      setTestMessage(`Error: ${err.message}`);
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Streaming Data Test</Text>
        
        {/* Status */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Login Status:</Text>
          <Text style={[
            styles.statusValue,
            isLoggedIn ? styles.statusSuccess : styles.statusError
          ]}>
            {isLoggedIn ? 'Logged In' : 'Not Logged In'}
          </Text>
        </View>
        
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Premium Status:</Text>
          <Text style={[
            styles.statusValue,
            isPremium ? styles.statusSuccess : styles.statusWarning
          ]}>
            {isPremium ? 'Premium' : 'Free'}
          </Text>
        </View>
        
        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Error:</Text>
            <Text style={styles.errorMessage}>{error}</Text>
          </View>
        )}
        
        {/* Test Message */}
        {testMessage && (
          <View style={styles.testMessageContainer}>
            <Text style={styles.testMessageTitle}>Test Result:</Text>
            <Text style={styles.testMessage}>{testMessage}</Text>
          </View>
        )}
        
        {/* User Data */}
        {userData && (
          <View style={styles.userDataContainer}>
            <Text style={styles.sectionTitle}>User Data:</Text>
            <Text style={styles.userDataText}>ID: {userData.id}</Text>
            <Text style={styles.userDataText}>Display Name: {userData.display_name}</Text>
            <Text style={styles.userDataText}>Email: {userData.email}</Text>
            <Text style={styles.userDataText}>Country: {userData.country}</Text>
            <Text style={styles.userDataText}>Product: {userData.product}</Text>
          </View>
        )}
        
        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {!isLoggedIn ? (
            <TouchableOpacity 
              style={[styles.button, styles.primaryButton]} 
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>Login with Spotify</Text>
              )}
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity 
                style={[styles.button, styles.actionButton]} 
                onPress={handleFetchData}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.buttonText}>
                    Fetch & Save {isPremium ? 'Top 5' : 'Top 3'} Data
                  </Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, styles.warningButton]} 
                onPress={handleLogout}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>Logout</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        
        {/* Authentication Flow Information */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
            <Text style={styles.loadingText}>
              {isLoggedIn 
                ? 'Processing your Spotify data...' 
                : 'Authenticating with Spotify...'}
            </Text>
            <Text style={styles.loadingSubText}>
              {isLoggedIn 
                ? 'This may take a moment while we fetch your listening history.'
                : 'If a browser window opened, please complete authentication there.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_CONSTANTS.COLORS.BACKGROUND,
  },
  scrollContainer: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    marginBottom: 20,
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 8,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    marginRight: 10,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  statusSuccess: {
    color: APP_CONSTANTS.COLORS.SUCCESS,
  },
  statusWarning: {
    color: APP_CONSTANTS.COLORS.WARNING,
  },
  statusError: {
    color: APP_CONSTANTS.COLORS.ERROR,
  },
  errorContainer: {
    backgroundColor: `${APP_CONSTANTS.COLORS.ERROR}20`,
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONSTANTS.COLORS.ERROR,
    marginBottom: 5,
  },
  errorMessage: {
    fontSize: 14,
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
  },
  testMessageContainer: {
    backgroundColor: `${APP_CONSTANTS.COLORS.PRIMARY}10`,
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
  },
  testMessageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONSTANTS.COLORS.PRIMARY,
    marginBottom: 5,
  },
  testMessage: {
    fontSize: 14,
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
  },
  userDataContainer: {
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 8,
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    marginBottom: 12,
  },
  userDataText: {
    fontSize: 14,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
    marginBottom: 8,
  },
  actionContainer: {
    marginTop: 20,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  primaryButton: {
    backgroundColor: APP_CONSTANTS.COLORS.PRIMARY,
  },
  actionButton: {
    backgroundColor: APP_CONSTANTS.COLORS.SUCCESS,
  },
  warningButton: {
    backgroundColor: APP_CONSTANTS.COLORS.WARNING,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: APP_CONSTANTS.COLORS.TEXT_PRIMARY,
    marginBottom: 10,
  },
  loadingSubText: {
    fontSize: 14,
    color: APP_CONSTANTS.COLORS.TEXT_SECONDARY,
  },
});

export default StreamingDataTestScreen; 