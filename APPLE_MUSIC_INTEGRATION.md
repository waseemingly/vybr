# Apple Music API Integration

This document outlines the implementation of Apple Music API integration for the Vybr app, following the same pattern as the existing Spotify integration.

## Overview

The Apple Music integration allows users to connect their Apple Music accounts and sync their listening data for music matching and recommendations. The implementation follows the same data structure as Spotify to ensure compatibility with the existing matching system.

## Architecture

### 1. Authentication Hook (`useAppleMusicAuth.ts`)

The `useAppleMusicAuth` hook handles:
- Apple Music OAuth authentication
- Token management and refresh
- API credential management
- Data fetching from Apple Music API
- Data processing to match Spotify format

### 2. Data Structure

The integration uses the same `user_streaming_data` table structure as Spotify:
- `service_id`: Set to `'apple_music'`
- `top_artists`: JSONB array of top artists
- `top_tracks`: JSONB array of top tracks  
- `top_albums`: JSONB array of top albums
- `top_genres`: JSONB array of top genres
- `top_moods`: JSONB array of top moods
- `raw_data`: JSONB object with full API response

### 3. API Endpoints Used

- **User Library**: `/me/library/songs` - Get user's saved songs
- **Heavy Rotation**: `/me/history/heavy-rotation` - Get recently played tracks
- **Catalog Search**: `/catalog/{storefront}/search` - Search for tracks/artists

## Setup Requirements

### 1. Apple Developer Account

You need:
- **Apple Developer Account** (paid membership required)
- **MusicKit identifier** created in Apple Developer portal
- **Private key (.p8 file)** for JWT signing
- **Team ID** from your Apple Developer account

### 2. Database Configuration

Add Apple Music credentials to the `api_credentials` table:

```sql
INSERT INTO public.api_credentials (service, team_id, key_id, private_key)
VALUES ('apple_music', 'YOUR_TEAM_ID', 'YOUR_KEY_ID', 'YOUR_PRIVATE_KEY');
```

### 3. Environment Variables

The following credentials need to be stored securely:
- `APPLE_MUSIC_TEAM_ID`: Your Apple Developer Team ID
- `APPLE_MUSIC_KEY_ID`: Your MusicKit key ID
- `APPLE_MUSIC_PRIVATE_KEY`: Your private key content

## Implementation Details

### 1. Authentication Flow

```typescript
// Initialize Apple Music auth
const {
  isLoggedIn,
  isLoading,
  error,
  login,
  logout,
  fetchAndSaveAppleMusicData
} = useAppleMusicAuth();

// Connect to Apple Music
await login();

// Fetch and save user data
const success = await fetchAndSaveAppleMusicData();
```

### 2. Data Processing

The hook processes Apple Music data to match Spotify's format:

```typescript
// Apple Music track → Spotify format
const processedTrack = {
  id: track.id,
  name: track.attributes.name,
  artistNames: [track.attributes.artistName],
  albumName: track.attributes.albumName,
  imageUrl: track.attributes.artwork?.url,
  playCount: 1,
  playedAt: new Date().toISOString()
};
```

### 3. Database Storage

Data is stored in the same format as Spotify:

```typescript
await supabase
  .from('user_streaming_data')
  .upsert({
    user_id: session.user.id,
    service_id: 'apple_music',
    snapshot_date: snapshotDate,
    top_artists: processedArtists,
    top_tracks: processedTracks,
    top_albums: processedAlbums,
    top_genres: calculatedGenres,
    top_moods: calculatedMoods,
    raw_data: { /* full API response */ }
  });
```

## Usage in Components

### 1. Basic Integration

```typescript
import { AppleMusicIntegration } from '@/components/AppleMusicIntegration';

<AppleMusicIntegration 
  onDataUpdated={() => {
    // Handle data update
    console.log('Apple Music data updated');
  }}
/>
```

### 2. Custom Implementation

```typescript
import { useAppleMusicAuth } from '@/hooks/useAppleMusicAuth';

const MyComponent = () => {
  const {
    isLoggedIn,
    login,
    fetchAndSaveAppleMusicData
  } = useAppleMusicAuth();

  const handleConnect = async () => {
    if (!isLoggedIn) {
      await login();
    } else {
      await fetchAndSaveAppleMusicData();
    }
  };

  return (
    <TouchableOpacity onPress={handleConnect}>
      <Text>Connect Apple Music</Text>
    </TouchableOpacity>
  );
};
```

## Data Compatibility

### 1. Matching System

The Apple Music integration is designed to work seamlessly with the existing matching system:

- **Same data structure** as Spotify
- **Same genre calculation** logic
- **Same mood analysis** using Gemini AI
- **Same matching algorithms**

### 2. Cross-Platform Matching

Users can match with others regardless of their music service:
- Spotify ↔ Apple Music
- Apple Music ↔ YouTube Music
- All combinations supported

## Security Considerations

### 1. Credential Storage

- Apple Music credentials are stored in Supabase `api_credentials` table
- Private keys should be encrypted at rest
- Access is restricted to service role only

### 2. Token Management

- User tokens are stored in AsyncStorage
- Tokens are automatically refreshed when expired
- Tokens are cleared on logout

## Error Handling

### 1. Common Issues

- **Missing credentials**: Check `api_credentials` table
- **Invalid tokens**: Re-authenticate user
- **API rate limits**: Implement exponential backoff
- **Network errors**: Retry with backoff

### 2. User Feedback

```typescript
if (error) {
  Alert.alert('Apple Music Error', error);
}

if (isLoading) {
  // Show loading indicator
}
```

## Testing

### 1. Unit Tests

```typescript
// Test authentication
expect(appleMusicAuth.isLoggedIn).toBe(false);
await appleMusicAuth.login();
expect(appleMusicAuth.isLoggedIn).toBe(true);

// Test data fetching
const success = await appleMusicAuth.fetchAndSaveAppleMusicData();
expect(success).toBe(true);
```

### 2. Integration Tests

```typescript
// Test database storage
const { data } = await supabase
  .from('user_streaming_data')
  .select('*')
  .eq('service_id', 'apple_music');

expect(data).toBeDefined();
expect(data[0].top_artists).toBeDefined();
```

## Troubleshooting

### 1. Authentication Issues

- Verify Apple Developer account setup
- Check MusicKit identifier configuration
- Ensure private key is valid
- Verify Team ID is correct

### 2. Data Issues

- Check if user has Apple Music subscription
- Verify user has music in their library
- Check API rate limits
- Verify network connectivity

### 3. Database Issues

- Check RLS policies
- Verify user permissions
- Check database connection
- Verify table schema

## Future Enhancements

### 1. Additional Data Sources

- Playlist data
- Recently played tracks
- Heavy rotation data
- User's music library

### 2. Performance Optimizations

- Caching strategies
- Batch processing
- Background sync
- Offline support

### 3. User Experience

- Progress indicators
- Error recovery
- Data visualization
- Comparison tools

## Conclusion

The Apple Music integration provides a seamless way for users to connect their Apple Music accounts and sync their listening data. The implementation follows the same patterns as Spotify to ensure compatibility with the existing matching system.

For questions or issues, please refer to the Apple Music API documentation or contact the development team.



