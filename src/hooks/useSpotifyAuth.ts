import React, { useState, useEffect, useCallback } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

// Ensures the browser closes correctly on mobile
WebBrowser.maybeCompleteAuthSession();

// Spotify API details - **Replace with your actual Client ID**
// It's highly recommended to store these in environment variables or a config file
const spotifyClientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || '7724af6090634c3db7c82fd54f1a0fff';
const tokenEndpoint = 'https://accounts.spotify.com/api/token';
const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: tokenEndpoint,
};

// Scopes determine what permissions your app requests
// See: https://developer.spotify.com/documentation/web-api/concepts/scopes
const scopes = [
  'user-read-email',
  'user-library-read',
  'user-read-recently-played',
  'user-top-read',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
];

// Key for storing the token securely
const SECURE_STORE_TOKEN_KEY = 'spotifyAuthToken';
const SECURE_STORE_REFRESH_KEY = 'spotifyRefreshToken';
const SECURE_STORE_EXPIRES_KEY = 'spotifyTokenExpiresAt'; // Renamed for clarity

// Define our own interface for the token data we want to manage
interface StoredSpotifyTokenInfo {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Store the absolute expiration timestamp (milliseconds since epoch)
  issuedAt: number; // Store when the token was issued (milliseconds since epoch)
  scope?: string; // Store the granted scopes
}

export const useSpotifyAuth = () => {
  const [tokenInfo, setTokenInfo] = useState<StoredSpotifyTokenInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const redirectUri = AuthSession.makeRedirectUri({
    preferLocalhost: true,
  });
  console.log("Using Spotify Redirect URI:", redirectUri);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: spotifyClientId,
      scopes: scopes,
      usePKCE: true,
      redirectUri: redirectUri,
    },
    discovery
  );

  // --- Load Token from Storage ---
  useEffect(() => {
    const loadToken = async () => {
      setIsLoading(true);
      try {
        const storedTokenJson = await SecureStore.getItemAsync(SECURE_STORE_TOKEN_KEY);

        if (storedTokenJson) {
          const storedTokenData: StoredSpotifyTokenInfo = JSON.parse(storedTokenJson);
          if (Date.now() < storedTokenData.expiresAt) {
            console.log("Found valid token in storage.");
            setTokenInfo(storedTokenData);
          } else {
            console.log("Token expired.");
            // TODO: Implement refresh token logic here using storedTokenData.refreshToken
            await clearAuthData(); // Clear expired data for now
          }
        } else {
          console.log("No token found in storage.");
        }
      } catch (e) {
        console.error("Failed to load token from storage", e);
        setError("Could not load authentication status.");
        await clearAuthData(); // Clear potentially corrupted data
      } finally {
        setIsLoading(false);
      }
    };
    loadToken();
  }, []);

  // --- Handle Auth Response ---
  useEffect(() => {
    const handleResponse = async () => {
      if (response) {
        console.log("Auth Response:", response.type);
        if (response.type === 'error') {
          setError(response.error?.message || response.params.error_description || 'Authentication failed.');
          setIsLoading(false);
        } else if (response.type === 'success') {
          const { code } = response.params;
          setIsLoading(true);
          try {
            const tokenResponse = await AuthSession.exchangeCodeAsync(
              {
                clientId: spotifyClientId,
                code: code,
                redirectUri: redirectUri,
                extraParams: {
                  code_verifier: request?.codeVerifier || '',
                },
              },
              discovery
            );

            console.log("Token exchange successful");
            const processedData = processTokenResponse(tokenResponse);
            await saveAuthData(processedData);
            setTokenInfo(processedData);
            setError(null);
          } catch (e: any) {
            console.error("Token exchange failed:", e);
            setError(e.message || 'Failed to get authentication token.');
          } finally {
            setIsLoading(false);
          }
        } else if (response.type === 'dismiss' || response.type === 'cancel') {
          // setError('Login dismissed.'); // Optional: Don't show error on dismiss
          setIsLoading(false);
        }
      }
    };

    if (request?.codeVerifier) { // Only run if PKCE verifier is ready
        handleResponse();
    }
  }, [response, request?.codeVerifier, redirectUri]);

  // --- Helper Functions ---
  const processTokenResponse = (tokenResponse: AuthSession.TokenResponse): StoredSpotifyTokenInfo => {
    const issuedAt = tokenResponse.issuedAt ? tokenResponse.issuedAt * 1000 : Date.now(); // Use provided issuedAt or now
    const expiresInSeconds = tokenResponse.expiresIn ?? 3600;
    const expiresAt = issuedAt + expiresInSeconds * 1000;

    return {
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      expiresAt: expiresAt,
      issuedAt: issuedAt,
      scope: tokenResponse.scope,
    };
  };

  const saveAuthData = async (data: StoredSpotifyTokenInfo) => {
    try {
      // Store the entire relevant token info object as a JSON string
      await SecureStore.setItemAsync(SECURE_STORE_TOKEN_KEY, JSON.stringify(data));
      // Keep separate keys for refresh/expiry for potential background refresh logic if needed
      // await SecureStore.setItemAsync(SECURE_STORE_REFRESH_KEY, data.refreshToken ?? '');
      // await SecureStore.setItemAsync(SECURE_STORE_EXPIRES_KEY, data.expiresAt.toString());
      console.log("Auth data saved securely.");
    } catch (e) {
      console.error("Failed to save auth data", e);
      setError("Failed to store authentication securely.");
    }
  };

  const clearAuthData = async () => {
    try {
      await SecureStore.deleteItemAsync(SECURE_STORE_TOKEN_KEY);
      // await SecureStore.deleteItemAsync(SECURE_STORE_REFRESH_KEY);
      // await SecureStore.deleteItemAsync(SECURE_STORE_EXPIRES_KEY);
      console.log("Auth data cleared.");
    } catch (e) {
      console.error("Failed to clear auth data", e);
    }
  };

  // --- Exposed Methods ---
  const login = useCallback(() => {
    if (!request) {
      setError("Authentication request not ready.");
      return;
    }
    setError(null);
    promptAsync();
  }, [request, promptAsync]);

  const logout = useCallback(async () => {
    setTokenInfo(null);
    setError(null);
    await clearAuthData();
    // Optional: Revoke token
    // Consider implementing token revocation on Spotify's side for enhanced security
    // This usually involves a POST request to 'https://accounts.spotify.com/api/token' with specific parameters.
    // Example using AuthSession (check library docs for specifics):
    // if (tokenInfo?.accessToken) {
    //   try {
    //     await AuthSession.revokeAsync({ token: tokenInfo.accessToken, clientId: spotifyClientId }, { revocationEndpoint: 'https://accounts.spotify.com/api/token' }); // Adjust endpoint if needed
    //     console.log("Token revoked successfully");
    //   } catch (revokeError) {
    //     console.error("Failed to revoke token", revokeError);
    //   }
    // }
  }, [tokenInfo]); // Add tokenInfo dependency if using it for revoke

  // Calculate isLoggedIn based on current tokenInfo state
  const isLoggedIn = !!tokenInfo?.accessToken && Date.now() < tokenInfo.expiresAt;

  return {
    tokenInfo, // The object containing accessToken, refreshToken, expiresAt, etc.
    login,
    logout,
    isLoading,
    error,
    isLoggedIn,
    accessToken: tokenInfo?.accessToken, // Convenience getter for the access token
  };
}; 