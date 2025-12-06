/**
 * Vybr Apple Music Module - Native Implementation (iOS)
 *
 * This file provides the native bridge to the iOS MusicKit implementation.
 * Metro bundler should automatically resolve index.web.ts for web platform.
 * This file is used for iOS native platform only.
 *
 * Features:
 * - User authorization via MusicKit
 * - Fetch recently played tracks
 * - Fetch heavy rotation items
 * - Fetch catalog data (for genres)
 * - Fetch comprehensive user music data
 */

// ========================================
// = OLD IMPLEMENTATION (COMMENTED OUT)
// ========================================
/*
// Metro bundler should automatically resolve index.web.ts for web
// This file is for native platforms only
import { requireNativeModule } from 'expo-modules-core';

const VybrAppleMusic = requireNativeModule('VybrAppleMusic');

export async function authorize(): Promise<string> {
  return await VybrAppleMusic.authorize();
}

export async function getHeavyRotation(limit: number = 20): Promise<any> {
  return await VybrAppleMusic.getHeavyRotation(limit);
}

export async function getRecentlyPlayed(limit: number = 20): Promise<any> {
  return await VybrAppleMusic.getRecentlyPlayed(limit);
}

export function setTokens(_developerToken: string, _userToken: string) {
  // No-op on native, tokens are handled by the system
}
*/
// ========================================
// = END OF OLD IMPLEMENTATION
// ========================================

// ========================================
// = NEW UNIFIED IMPLEMENTATION
// ========================================

import { requireNativeModule } from 'expo-modules-core';

const VybrAppleMusic = requireNativeModule('VybrAppleMusic');

// --- Type Definitions (matching web implementation) ---
export interface AppleMusicArtist {
  id: string;
  name: string;
  genres: string[];
  images: { url: string; height: number; width: number }[];
  popularity: number;
  uri: string;
}

export interface AppleMusicTrack {
  id: string;
  name: string;
  uri: string;
  album: {
    id: string;
    name: string;
    images: { url: string; height: number; width: number }[];
  };
  artists: { id: string; name: string }[];
  popularity: number;
  genreNames?: string[];
}

export interface AppleMusicAlbum {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  images: { url: string; height: number; width: number }[];
  uri: string;
}

export interface AppleMusicGenre {
  name: string;
  count: number;
  score: number;
}

// --- Authorization ---
/**
 * Request authorization to access Apple Music.
 * On iOS, this uses MusicKit native authorization.
 * The developerToken config is ignored on native (handled by the system).
 * 
 * @returns Promise resolving to authorization status:
 *          "authorized", "denied", "notDetermined", "restricted", or "unknown"
 */
export async function authorize(config?: { developerToken: string }): Promise<string> {
  // Note: developerToken is used on web, ignored on native
  return await VybrAppleMusic.authorize();
}

// --- Token Management ---
/**
 * Set tokens manually (only used for web).
 * On native, this is a no-op since tokens are managed by MusicKit.
 */
export function setTokens(_developerToken: string, _userToken: string) {
  // No-op on native, tokens are handled by the system
}

/**
 * Get current tokens (only returns values on web).
 * On native, returns null values since tokens are managed by MusicKit.
 */
export function getTokens(): { developerToken: string | null; userToken: string | null } {
  return { developerToken: null, userToken: null };
}

/**
 * Check if the user is authorized.
 * On native, we can't easily check without triggering a prompt,
 * so we rely on the last authorization result.
 */
export function isAuthorized(): boolean {
  // On native, we don't track authorization state in JS
  // The caller should use the authorize() function and check the result
  return false;
}

// --- Heavy Rotation ---
/**
 * Fetch the user's heavy rotation items.
 * These are albums, playlists, and artists the user plays frequently.
 * 
 * @param limit Maximum number of items to return (default: 20)
 * @returns Promise resolving to Apple Music API response with heavy rotation data
 */
export async function getHeavyRotation(limit: number = 20): Promise<any> {
  return await VybrAppleMusic.getHeavyRotation(limit);
}

// --- Recently Played ---
/**
 * Fetch the user's recently played tracks.
 * 
 * @param limit Maximum number of tracks to return (default: 20)
 * @returns Promise resolving to Apple Music API response with recently played tracks
 */
export async function getRecentlyPlayed(limit: number = 20): Promise<any> {
  return await VybrAppleMusic.getRecentlyPlayed(limit);
}

// --- Catalog Data ---
/**
 * Fetch catalog data for songs (includes genre information).
 * 
 * @param songIds Array of song IDs to look up
 * @returns Promise resolving to Apple Music API response with catalog song data
 */
export async function getCatalogSongs(songIds: string[]): Promise<any> {
  return await VybrAppleMusic.getCatalogSongs(songIds);
}

/**
 * Fetch catalog data for artists (includes genre information).
 * 
 * @param artistIds Array of artist IDs to look up
 * @returns Promise resolving to Apple Music API response with catalog artist data
 */
export async function getCatalogArtists(artistIds: string[]): Promise<any> {
  return await VybrAppleMusic.getCatalogArtists(artistIds);
}

// --- User Storefront ---
/**
 * Get the user's storefront (region).
 * 
 * @returns Promise resolving to the user's storefront ID (e.g., "us", "gb")
 */
export async function getUserStorefront(): Promise<string> {
  return await VybrAppleMusic.getUserStorefront();
}

// --- Unified Data Fetching ---
/**
 * Fetch comprehensive user music data including tracks, artists, and albums.
 * This is an optimized endpoint that fetches all data in one call.
 * 
 * @param options Configuration options
 * @param options.includeGenres Whether to fetch genre data from catalog (default: true)
 * @param options.limit Maximum number of items to fetch (default: 50)
 * @returns Promise resolving to object with tracks, artists, and albums arrays
 */
export async function fetchUserMusicData(options?: { 
  includeGenres?: boolean;
  limit?: number;
}): Promise<{
  tracks: AppleMusicTrack[];
  artists: AppleMusicArtist[];
  albums: AppleMusicAlbum[];
}> {
  const result = await VybrAppleMusic.fetchUserMusicData(options || {});
  
  // Ensure proper typing of the response
  return {
    tracks: (result.tracks || []) as AppleMusicTrack[],
    artists: (result.artists || []) as AppleMusicArtist[],
    albums: (result.albums || []) as AppleMusicAlbum[]
  };
}

// --- Genre Calculation ---
/**
 * Calculate top genres from tracks and artists.
 * This is a utility function that can be used on both platforms.
 * 
 * @param tracks Array of tracks with genreNames
 * @param artists Array of artists with genres
 * @returns Array of genres sorted by score (descending)
 */
export function calculateTopGenres(tracks: AppleMusicTrack[], artists: AppleMusicArtist[]): AppleMusicGenre[] {
  const genreMap = new Map<string, { count: number; score: number }>();
  
  // Count genres from tracks
  tracks.forEach(track => {
    const genres = track.genreNames || [];
    genres.forEach(genre => {
      const existing = genreMap.get(genre) || { count: 0, score: 0 };
      existing.count += 1;
      existing.score += 1;
      genreMap.set(genre, existing);
    });
  });
  
  // Count genres from artists (weighted higher)
  artists.forEach(artist => {
    const genres = artist.genres || [];
    genres.forEach(genre => {
      const existing = genreMap.get(genre) || { count: 0, score: 0 };
      existing.count += 1;
      existing.score += 2;
      genreMap.set(genre, existing);
    });
  });
  
  // Convert to array and sort by score
  const topGenres: AppleMusicGenre[] = Array.from(genreMap.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      score: data.score
    }))
    .sort((a, b) => b.score - a.score);
  
  return topGenres;
}

// --- Parse Helpers (for backward compatibility with existing code) ---
/**
 * Parse tracks from Apple Music API response.
 * This provides compatibility with the existing parseArtistsAndTracks function.
 */
export function parseTracksFromResponse(resources: any[]): AppleMusicTrack[] {
  const tracks: AppleMusicTrack[] = [];
  
  resources.forEach((resource: any) => {
    if (resource.type === 'songs' || resource.type === 'library-songs') {
      const attributes = resource.attributes || {};
      const artwork = attributes.artwork;
      
      tracks.push({
        id: resource.id,
        name: attributes.name || 'Unknown Track',
        uri: `apple-music:song:${resource.id}`,
        album: {
          id: resource.relationships?.albums?.data?.[0]?.id || '',
          name: attributes.albumName || '',
          images: artwork ? [{
            url: artwork.url?.replace('{w}', '300').replace('{h}', '300') || '',
            height: 300,
            width: 300
          }] : []
        },
        artists: attributes.artistName ? [{
          id: resource.relationships?.artists?.data?.[0]?.id || '',
          name: attributes.artistName
        }] : [],
        popularity: 0,
        genreNames: attributes.genreNames || []
      });
    }
  });
  
  return tracks;
}

/**
 * Parse artists from Apple Music API response.
 */
export function parseArtistsFromResponse(resources: any[]): AppleMusicArtist[] {
  const artists: AppleMusicArtist[] = [];
  
  resources.forEach((resource: any) => {
    if (resource.type === 'artists' || resource.type === 'library-artists') {
      const attributes = resource.attributes || {};
      const artwork = attributes.artwork;
      
      artists.push({
        id: resource.id,
        name: attributes.name || 'Unknown Artist',
        genres: attributes.genreNames || [],
        images: artwork ? [{
          url: artwork.url?.replace('{w}', '300').replace('{h}', '300') || '',
          height: 300,
          width: 300
        }] : [],
        popularity: 0,
        uri: `apple-music:artist:${resource.id}`
      });
    }
  });
  
  return artists;
}
