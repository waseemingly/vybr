import { supabase } from '@/lib/supabase';
import { getYTMToken } from './YoutubeMusicAuthUtils';
import { Platform } from 'react-native';

// ----- YouTube Music Data Types -----
interface YTMArtist {
  id: string;
  name: string;
  thumbnails?: Array<{url: string, width: number, height: number}>;
  subscribers?: string;
  external_url?: string;
  popularity?: number;
}

interface YTMAlbum {
  id: string;
  name: string;
  artists?: YTMArtist[];
  year?: string;
  thumbnails?: Array<{url: string, width: number, height: number}>;
}

interface YTMTrack {
  videoId: string;
  title: string;
  artists: YTMArtist[];
  album?: YTMAlbum;
  thumbnails?: Array<{url: string, width: number, height: number}>;
  isExplicit?: boolean;
  duration?: string;
  playCount?: number;
}

interface HistoryItem {
  videoId: string;
  title: string;
  artists: YTMArtist[];
  album?: {
    name: string;
    id: string;
  };
  thumbnails: Array<{url: string; width: number; height: number}>;
  played: string; // ISO date string
}

// ----- Helper functions -----

// Fetch history from YouTube Music API directly
const getHistory = async (): Promise<HistoryItem[]> => {
  try {
    console.log('[YoutubeMusicDataUtils] Fetching history...');
    
    // Get the token info
    const tokenInfo = await getYTMToken();
    if (!tokenInfo || !tokenInfo.token) {
      throw new Error('Not logged in to YouTube Music');
    }
    
    // Make a direct API call to YouTube Music
    const response = await fetch('https://music.youtube.com/youtubei/v1/history/get_history?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenInfo.token}`,
        'Content-Type': 'application/json',
        'X-Goog-Request-Time': Date.now().toString(),
        'X-Origin': 'https://music.youtube.com'
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB_REMIX",
            clientVersion: "1.20230831.01.00"
          }
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const historyItems = data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicShelfRenderer?.contents || [];
    
    // Process history items
    if (!Array.isArray(historyItems) || historyItems.length === 0) {
      console.log('[YoutubeMusicDataUtils] No history items found');
      return [];
    }
    
    console.log(`[YoutubeMusicDataUtils] Fetched ${historyItems.length} history items`);
    
    // Calculate the date 28 days ago
    const daysAgo28 = new Date();
    daysAgo28.setDate(daysAgo28.getDate() - 28);
    
    // Extract data from history items
    const processedItems = historyItems.map((item: any) => {
      const videoId = item.videoId || 
        item?.musicResponsiveListItemRenderer?.playlistItemData?.videoId || 
        item?.musicResponsiveListItemRenderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;
      
      const title = item.title?.runs?.[0]?.text || 
        item?.musicResponsiveListItemRenderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
      
      const artistName = (item.subtitles?.[0]?.runs?.[0]?.text) || 
        item?.musicResponsiveListItemRenderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
      
      const albumName = (item.subtitles?.[1]?.runs?.[0]?.text) || 
        item?.musicResponsiveListItemRenderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[2]?.text;
        
      const thumbnails = item.thumbnails || 
        item?.musicResponsiveListItemRenderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
        
      const playedDate = item.played?.text || 
        item?.musicResponsiveListItemRenderer?.flexColumns?.[4]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || 
        new Date().toISOString();
        
      return {
        videoId: videoId || '',
        title: title || 'Unknown Title',
        artists: [{ 
          id: '', 
          name: artistName || 'Unknown Artist' 
        }],
        album: albumName ? {
          name: albumName,
          id: ''
        } : undefined,
        thumbnails: thumbnails,
        played: playedDate
      };
    }).filter((item: any) => item.videoId && item.title);
    
    // Filter for recent items
    const recentItems = processedItems.filter((item: any) => {
      const playedDate = new Date(item.played);
      return !isNaN(playedDate.getTime()) && playedDate >= daysAgo28;
    });
    
    console.log(`[YoutubeMusicDataUtils] Found ${recentItems.length} items from the last 28 days`);
    return recentItems;
  } catch (err: any) {
    console.error('[YoutubeMusicDataUtils] Error fetching history:', err);
    throw new Error(`Failed to fetch YouTube Music history: ${err.message}`);
  }
};

// Calculate top songs from history
const calculateTopSongs = (historyItems: HistoryItem[], limit: number): YTMTrack[] => {
  // Count occurrences of each song
  const songMap = new Map<string, YTMTrack & { playCount: number }>();
  
  historyItems.forEach(item => {
    const songId = item.videoId;
    
    if (songMap.has(songId)) {
      // Increment play count
      const existing = songMap.get(songId)!;
      existing.playCount = (existing.playCount || 0) + 1;
      songMap.set(songId, existing);
    } else {
      // Add new song with play count 1
      songMap.set(songId, {
        videoId: item.videoId,
        title: item.title,
        artists: item.artists,
        album: item.album,
        thumbnails: item.thumbnails,
        playCount: 1
      });
    }
  });
  
  // Convert to array and sort by play count
  const topSongs = Array.from(songMap.values())
    .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
    .slice(0, limit);
  
  console.log(`[YoutubeMusicDataUtils] Calculated top ${topSongs.length} songs`);
  return topSongs;
};

// Calculate top artists from history
const calculateTopArtists = (historyItems: HistoryItem[], limit: number): YTMArtist[] => {
  // Count occurrences of each artist
  const artistMap = new Map<string, { artist: YTMArtist, count: number }>();
  
  historyItems.forEach(item => {
    item.artists.forEach(artist => {
      const artistName = artist.name;
      
      if (artistMap.has(artistName)) {
        // Increment count
        const existing = artistMap.get(artistName)!;
        existing.count += 1;
        artistMap.set(artistName, existing);
      } else {
        // Add new artist with count 1
        artistMap.set(artistName, {
          artist: artist,
          count: 1
        });
      }
    });
  });
  
  // Convert to array and sort by count
  const topArtists = Array.from(artistMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(item => ({
      ...item.artist,
      popularity: item.count // Add popularity for compatibility with Spotify format
    }));
  
  console.log(`[YoutubeMusicDataUtils] Calculated top ${topArtists.length} artists`);
  return topArtists;
};

// Fetch Spotify genre data for artists
const fetchGenresForArtists = async (artists: YTMArtist[]): Promise<string[]> => {
  if (artists.length === 0) return [];
  
  try {
    console.log(`[YoutubeMusicDataUtils] Fetching genre data for ${artists.length} artists`);
    
    // For each artist name, query Spotify's artist info from our database
    const artistGenres: string[] = [];
    
    for (const artist of artists) {
      // Query supabase for artist genres
      const { data, error } = await supabase
        .from('spotify_artists_metadata')
        .select('genres')
        .ilike('name', artist.name)
        .limit(1);
      
      if (error) {
        console.error(`[YoutubeMusicDataUtils] Error fetching genre for ${artist.name}:`, error);
        continue;
      }
      
      if (data && data.length > 0 && data[0].genres) {
        // Add all genres from this artist
        if (Array.isArray(data[0].genres)) {
          artistGenres.push(...data[0].genres);
        }
      }
    }
    
    console.log(`[YoutubeMusicDataUtils] Found ${artistGenres.length} total genres`);
    return artistGenres;
  } catch (err: any) {
    console.error('[YoutubeMusicDataUtils] Error fetching genres:', err);
    return [];
  }
};

// Calculate top genres from artist genres
const calculateTopGenres = (genres: string[], limit: number): { name: string, count: number }[] => {
  // Count occurrences of each genre
  const genreMap = new Map<string, number>();
  
  genres.forEach(genre => {
    const count = genreMap.get(genre) || 0;
    genreMap.set(genre, count + 1);
  });
  
  // Convert to array and sort by count
  const topGenres = Array.from(genreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
  
  console.log(`[YoutubeMusicDataUtils] Calculated top ${topGenres.length} genres`);
  return topGenres;
};

// Main function to fetch and save YouTube Music data without hooks
export const fetchAndSaveYouTubeMusicData = async (
  userId: string,
  isPremium: boolean
): Promise<boolean> => {
  console.log(`[YoutubeMusicDataUtils] Starting data fetch for user ${userId}, premium: ${isPremium}`);

  try {
    // First, verify that the token exists and is valid
    const tokenInfo = await getYTMToken();
    if (!tokenInfo || !tokenInfo.token) {
      console.error('[YoutubeMusicDataUtils] Not logged in to YouTube Music');
      return false;
    }
    
    // Determine the limit based on premium status
    const limit = isPremium ? 5 : 3;
    
    // 1. Get user history
    const historyItems = await getHistory();
    if (!historyItems.length) {
      console.warn('[YoutubeMusicDataUtils] No history items found');
      return false;
    }
    
    // 2. Calculate top songs and artists
    const topSongs = calculateTopSongs(historyItems, limit);
    const topArtists = calculateTopArtists(historyItems, limit);
    
    // 3. Get genres for artists and calculate top genres
    const artistGenres = await fetchGenresForArtists(topArtists);
    const topGenres = calculateTopGenres(artistGenres, limit);
    
    // 4. Format data for storage in database
    const formattedData = {
      top_tracks: topSongs.map(song => ({
        id: song.videoId,
        name: song.title,
        uri: `https://music.youtube.com/watch?v=${song.videoId}`,
        album: {
          id: song.album?.id || '',
          name: song.album?.name || 'Unknown Album',
          images: song.thumbnails?.map(t => ({
            url: t.url,
            height: t.height,
            width: t.width
          })) || []
        },
        artists: song.artists.map(a => ({ id: a.id || '', name: a.name })),
        popularity: song.playCount || 0
      })),
      top_artists: topArtists.map(artist => ({
        id: artist.id || `ytm-artist-${artist.name.replace(/\s+/g, '-').toLowerCase()}`,
        name: artist.name,
        genres: [], // We'll use the separate genres list
        images: artist.thumbnails?.map(t => ({
          url: t.url,
          height: t.height,
          width: t.width
        })) || [],
        popularity: artist.popularity || 50,
        uri: artist.external_url || `https://music.youtube.com/channel/${artist.id}`
      })),
      top_genres: topGenres.map(genre => ({
        name: genre.name,
        count: genre.count,
        score: genre.count * 10 // Simple score calculation
      })),
      top_albums: [] // YouTube Music doesn't easily provide top albums data
    };
    
    // 5. Save to Supabase using existing schema
    const snapshotDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const { error } = await supabase
      .from('user_streaming_data')
      .upsert({
        user_id: userId,
        service_id: 'youtubemusic',
        snapshot_date: snapshotDate,
        last_updated: new Date().toISOString(),
        top_artists: formattedData.top_artists,
        top_tracks: formattedData.top_tracks,
        top_genres: formattedData.top_genres,
        top_albums: formattedData.top_albums,
        raw_data: {
          history_count: historyItems.length,
          full_artists: formattedData.top_artists,
          full_tracks: formattedData.top_tracks,
          full_genres: formattedData.top_genres
        }
      }, {
        onConflict: 'user_id,service_id,snapshot_date'
      });
    
    if (error) {
      console.error('[YoutubeMusicDataUtils] Error saving to Supabase:', error);
      throw new Error(`Failed to save YouTube Music data: ${error.message}`);
    }
    
    console.log(`[YoutubeMusicDataUtils] Successfully saved data for user ${userId}`);
    return true;
  } catch (err: any) {
    console.error('[YoutubeMusicDataUtils] Error in fetchAndSaveYouTubeMusicData:', err);
    return false;
  }
};

// Make sure this utility function is properly exported
export default {
  fetchAndSaveYouTubeMusicData
}; 