// src/types/streamingData.ts

// --- Apple Music API Interfaces ---
export interface AppleMusicTrack {
  id: string;
  type: 'songs';
  attributes: {
    name: string;
    artistName: string;
    albumName: string;
    durationInMillis: number;
    genreNames: string[];
    artwork: {
      url: string;
      width: number;
      height: number;
    };
    playParams?: {
      id: string;
      kind: string;
    };
  };
  relationships?: {
    artists: {
      data: AppleMusicArtist[];
    };
    albums: {
      data: AppleMusicAlbum[];
    };
  };
}

export interface AppleMusicArtist {
  id: string;
  type: 'artists';
  attributes: {
    name: string;
    genreNames: string[];
    artwork?: {
      url: string;
      width: number;
      height: number;
    };
  };
}

export interface AppleMusicAlbum {
  id: string;
  type: 'albums';
  attributes: {
    name: string;
    artistName: string;
    artwork: {
      url: string;
      height: number;
      width: number;
    };
  };
}

export interface AppleMusicPlayHistory {
  id: string;
  type: 'play-history';
  attributes: {
    playDate: string;
    song: AppleMusicTrack;
  };
}

// --- Spotify API Interfaces ---
// Basic structure for Spotify Artist from API
export interface SpotifyApiArtistSimple {
    id: string;
    name: string;
    uri: string;
}

export interface SpotifyApiArtistFull extends SpotifyApiArtistSimple {
    genres?: string[]; // Genres are available on the full Artist object or top artists endpoint
    images?: { url: string; height: number; width: number }[];
    popularity?: number;
}

// Basic structure for Spotify Track from API
export interface SpotifyApiTrack {
    id: string;
    name: string;
    uri: string;
    duration_ms: number;
    explicit: boolean;
    popularity?: number;
    preview_url?: string | null;
    artists: SpotifyApiArtistSimple[];
    album: {
        id: string;
        name: string;
        uri: string;
        images?: { url: string; height: number; width: number }[];
    };
}

// Structure for item in Recently Played API response
export interface SpotifyApiPlayHistoryObject {
    track: SpotifyApiTrack;
    played_at: string; // ISO 8601 format timestamp
    context?: {
        type: string; // e.g., "artist", "playlist", "album", "show"
        uri: string;
    } | null;
}

// --- Processed Data Structures ---

export interface TopArtist {
    id: string;
    name: string;
    genres: string[]; // Keep genres here for reference
    imageUrl?: string; // Optional image URL
}

export interface TopGenre {
    name: string;
    count: number; // How many top artists contributed to this genre count
}

export interface TopSong {
    id: string;
    name: string;
    artistNames: string[];
    albumName: string;
    imageUrl?: string; // Optional image URL
    playCount: number;
    playedAt?: string; // Optionally store the last played time
}

// Combined processed data structure
export interface ProcessedStreamingData {
    topArtists: TopArtist[];
    topGenres: TopGenre[];
    topSongs: TopSong[];
}

// Structure for data stored in Supabase
export interface UserStreamingDataDB {
    user_id: string;
    service_id: 'spotify' | 'youtubemusic' | 'apple_music' | string; // Extend as needed
    snapshot_date: string; // YYYY-MM-DD
    last_updated?: string; // ISO timestamp
    top_artists: TopArtist[]; // Stored as JSONB
    top_tracks: TopSong[]; // Stored as JSONB (renamed from top_songs for consistency)
    top_genres: TopGenre[]; // Stored as JSONB
    // raw_data could be added if needed
}