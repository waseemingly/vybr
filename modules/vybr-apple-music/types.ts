/**
 * Vybr Apple Music Module - Type Definitions
 * 
 * Shared type definitions for Apple Music integration.
 * These types are compatible with the useStreamingData hook types.
 */

// --- Artist Type ---
export interface AppleMusicArtist {
  /** Unique identifier for the artist */
  id: string;
  /** Artist name */
  name: string;
  /** Array of genre names associated with this artist */
  genres: string[];
  /** Artist artwork images */
  images: AppleMusicImage[];
  /** Popularity score (0-100, normalized from Apple Music data) */
  popularity: number;
  /** Apple Music URI (e.g., "apple-music:artist:123456") */
  uri: string;
}

// --- Track Type ---
export interface AppleMusicTrack {
  /** Unique identifier for the track */
  id: string;
  /** Track name */
  name: string;
  /** Apple Music URI (e.g., "apple-music:song:123456") */
  uri: string;
  /** Album information */
  album: {
    id: string;
    name: string;
    images: AppleMusicImage[];
  };
  /** Array of artists on this track */
  artists: AppleMusicSimpleArtist[];
  /** Popularity score (0-100, normalized from Apple Music data) */
  popularity: number;
  /** Genre names from catalog data (may be empty if not enriched) */
  genreNames?: string[];
}

// --- Album Type ---
export interface AppleMusicAlbum {
  /** Unique identifier for the album */
  id: string;
  /** Album name */
  name: string;
  /** Array of artists on this album */
  artists: AppleMusicSimpleArtist[];
  /** Album artwork images */
  images: AppleMusicImage[];
  /** Apple Music URI (e.g., "apple-music:album:123456") */
  uri: string;
}

// --- Genre Type ---
export interface AppleMusicGenre {
  /** Genre name */
  name: string;
  /** Number of occurrences in user's library/history */
  count: number;
  /** Weighted score based on frequency and relevance */
  score: number;
}

// --- Simple Artist (for track/album references) ---
export interface AppleMusicSimpleArtist {
  /** Artist ID (may be empty for some API responses) */
  id: string;
  /** Artist name */
  name: string;
}

// --- Image Type ---
export interface AppleMusicImage {
  /** Image URL */
  url: string;
  /** Image height in pixels */
  height: number;
  /** Image width in pixels */
  width: number;
}

// --- API Response Types ---
export interface AppleMusicAPIResponse<T = any> {
  /** Array of data items */
  data?: T[];
  /** Next page URL (for pagination) */
  next?: string;
  /** Metadata about the response */
  meta?: {
    total?: number;
  };
  /** Error information */
  errors?: AppleMusicAPIError[];
}

export interface AppleMusicAPIError {
  /** Error ID */
  id: string;
  /** Error title */
  title: string;
  /** Error detail message */
  detail: string;
  /** HTTP status code */
  status: string;
  /** Error code */
  code: string;
}

// --- Resource Types from Apple Music API ---
export interface AppleMusicResource {
  /** Resource ID */
  id: string;
  /** Resource type (e.g., "songs", "artists", "albums") */
  type: AppleMusicResourceType;
  /** Resource attributes */
  attributes?: Record<string, any>;
  /** Resource relationships */
  relationships?: Record<string, any>;
}

export type AppleMusicResourceType = 
  | 'songs'
  | 'library-songs'
  | 'artists'
  | 'library-artists'
  | 'albums'
  | 'library-albums'
  | 'playlists'
  | 'library-playlists'
  | 'music-videos'
  | 'stations';

// --- Authorization Types ---
export type AppleMusicAuthorizationStatus = 
  | 'authorized'
  | 'denied'
  | 'notDetermined'
  | 'restricted'
  | 'unknown';

// --- Fetch Options ---
export interface FetchUserMusicDataOptions {
  /** Whether to fetch genre data from catalog (default: true) */
  includeGenres?: boolean;
  /** Maximum number of items to fetch (default: 50) */
  limit?: number;
}

// --- Fetch Result ---
export interface FetchUserMusicDataResult {
  /** Array of tracks from user's history */
  tracks: AppleMusicTrack[];
  /** Array of artists from user's history */
  artists: AppleMusicArtist[];
  /** Array of albums from user's history */
  albums: AppleMusicAlbum[];
}

// --- Module Configuration ---
export interface AppleMusicModuleConfig {
  /** Apple Music Developer Token (required for web) */
  developerToken?: string;
}

// --- Export all types ---
export type {
  AppleMusicArtist as Artist,
  AppleMusicTrack as Track,
  AppleMusicAlbum as Album,
  AppleMusicGenre as Genre,
  AppleMusicImage as Image,
};

