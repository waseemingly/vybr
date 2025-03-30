import { AuthConfiguration, authorize } from 'react-native-app-auth';
import Constants from 'expo-constants';
import { APP_CONSTANTS } from '@/config/constants';

// Spotify API configuration
const spotifyConfig: AuthConfiguration = {
  clientId: process.env.SPOTIFY_CLIENT_ID || Constants.expoConfig?.extra?.SPOTIFY_CLIENT_ID || '',
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET || Constants.expoConfig?.extra?.SPOTIFY_CLIENT_SECRET || '',
  redirectUrl: APP_CONSTANTS.API.SPOTIFY_AUTH_CALLBACK,
  scopes: [
    'user-read-email',
    'user-top-read',
    'user-read-recently-played',
    'user-library-read',
    'playlist-read-private'
  ],
  serviceConfiguration: {
    authorizationEndpoint: 'https://accounts.spotify.com/authorize',
    tokenEndpoint: 'https://accounts.spotify.com/api/token',
  },
};

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; release_date: string };
}

interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
}

// Authorize with Spotify
export const authorizeSpotify = async () => {
  try {
    return await authorize(spotifyConfig);
  } catch (error) {
    console.error('Spotify authorization error:', error);
    throw error;
  }
};

// Fetch user's top tracks
export const fetchTopTracks = async (accessToken: string, timeRange = 'medium_term', limit = 50) => {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Error fetching top tracks: ${response.status}`);
    }

    const data = await response.json();
    return data.items as SpotifyTrack[];
  } catch (error) {
    console.error('Error fetching top tracks:', error);
    throw error;
  }
};

// Fetch user's top artists
export const fetchTopArtists = async (accessToken: string, timeRange = 'medium_term', limit = 50) => {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/me/top/artists?time_range=${timeRange}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Error fetching top artists: ${response.status}`);
    }

    const data = await response.json();
    return data.items as SpotifyArtist[];
  } catch (error) {
    console.error('Error fetching top artists:', error);
    throw error;
  }
};

// Fetch user's saved albums
export const fetchSavedAlbums = async (accessToken: string, limit = 50) => {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/me/albums?limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Error fetching saved albums: ${response.status}`);
    }

    const data = await response.json();
    return data.items.map((item: any) => item.album);
  } catch (error) {
    console.error('Error fetching saved albums:', error);
    throw error;
  }
};

// Process user's music data to generate a profile
export const generateMusicProfile = async (accessToken: string) => {
  try {
    // Fetch data from Spotify
    const [topTracks, topArtists, savedAlbums] = await Promise.all([
      fetchTopTracks(accessToken),
      fetchTopArtists(accessToken),
      fetchSavedAlbums(accessToken),
    ]);

    // Extract genres from top artists
    const allGenres = topArtists.flatMap(artist => artist.genres);
    const genreCounts = allGenres.reduce((counts: Record<string, number>, genre) => {
      counts[genre] = (counts[genre] || 0) + 1;
      return counts;
    }, {});

    // Sort genres by frequency
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([genre]) => genre)
      .slice(0, 10);

    // Extract top artists
    const extractedArtists = topArtists.map(artist => artist.name).slice(0, 10);

    // Extract top tracks
    const extractedTracks = topTracks.map(track => ({
      title: track.name,
      artist: track.artists[0].name,
    })).slice(0, 10);

    // Extract albums
    const extractedAlbums = Array.from(
      new Set([
        ...topTracks.map(track => ({
          title: track.album.name,
          artist: track.artists[0].name,
          year: new Date(track.album.release_date).getFullYear(),
        })),
        ...savedAlbums.map((album: any) => ({
          title: album.name,
          artist: album.artists[0].name,
          year: new Date(album.release_date).getFullYear(),
        })),
      ])
    ).slice(0, 10);

    return {
      genres: topGenres,
      artists: extractedArtists,
      songs: extractedTracks,
      albums: extractedAlbums,
    };
  } catch (error) {
    console.error('Error generating music profile:', error);
    throw error;
  }
}; 