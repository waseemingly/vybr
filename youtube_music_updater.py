# youtube_music_updater.py
import os
import argparse
import json
from datetime import datetime
from collections import Counter
from ytmusicapi import YTMusic, setup_oauth, OAuthCredentials
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables (for Supabase credentials)
load_dotenv()

# --- Supabase Configuration ---
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") # Use service key for backend script

# --- YouTube Music OAuth Configuration ---
# These need to be obtained from Google Cloud Console for the YouTube Data API
# See: https://ytmusicapi.readthedocs.io/en/stable/setup/oauth.html
YTM_OAUTH_CLIENT_ID = os.environ.get("YTM_OAUTH_CLIENT_ID")
YTM_OAUTH_CLIENT_SECRET = os.environ.get("YTM_OAUTH_CLIENT_SECRET")
OAUTH_FILE = 'oauth.json' # File to store OAuth credentials

# --- Helper Functions ---

def calculate_top_items(items, key_func, limit):
    """Calculates top items based on frequency."""
    counts = Counter(key_func(item) for item in items if key_func(item))
    # Get items sorted by frequency, then take top 'limit'
    # We need the original item associated with the key
    item_map = {key_func(item): item for item in reversed(items)} # Keep the most recent item instance
    
    most_common_keys = [key for key, count in counts.most_common(limit)]
    
    top_items_with_count = []
    for key in most_common_keys:
        if key in item_map:
             # Find original item and add count
            original_item = item_map[key]
            original_item['playCount'] = counts[key] # Add playCount directly
            top_items_with_count.append(original_item)
        else:
            print(f"Warning: Key {key} not found in item_map during top item calculation.")

    # Fallback sort if items retrieved aren't enough, ensure correct limit
    return sorted(top_items_with_count, key=lambda x: x['playCount'], reverse=True)[:limit]

def format_track_for_supabase(track_data):
    """Formats YTMusic API track data to match TopSong structure."""
    # Note: TopSong uses 'artistNames' (string array) and 'albumName'
    artists = track_data.get('artists', [])
    artist_names = [artist.get('name', 'Unknown Artist') for artist in artists]
    album = track_data.get('album')
    
    # Try to get a thumbnail URL
    thumbnails = track_data.get('thumbnails', [])
    image_url = thumbnails[0].get('url') if thumbnails else None

    return {
        "id": track_data.get('videoId', ''),
        "name": track_data.get('title', 'Unknown Title'),
        "artistNames": artist_names,
        "albumName": album.get('name', 'Unknown Album') if album else 'Unknown Album',
        "imageUrl": image_url,
        "playCount": track_data.get('playCount', 0), # Added by calculate_top_items
         # Add other fields if they match TopSong and are available
        "uri": f"https://music.youtube.com/watch?v={track_data.get('videoId', '')}", 
        # duration_ms, explicit, playedAt not directly available from history items easily
    }

def format_artist_for_supabase(artist_data):
    """Formats YTMusic API artist data to match TopArtist structure."""
    # Note: TopArtist just needs id, name, genres (empty), imageUrl (optional)
    
    # YTMusicAPI history doesn't give artist thumbnails directly
    # We could try a get_artist call but that adds complexity/API calls
    
    # Use artist ID if available, fallback to a generated ID based on name
    artist_id = artist_data.get('artist', {}).get('id')
    artist_name = artist_data.get('artist', {}).get('name', 'Unknown Artist')
    if not artist_id:
        safe_name = ''.join(e for e in artist_name if e.isalnum() or e in [' ']).replace(' ', '-').lower()
        artist_id = f"ytm-artist-{safe_name}" if safe_name else f"ytm-artist-unknown"

    return {
        "id": artist_id,
        "name": artist_name,
        "genres": [], # Genres fetched separately by frontend from Spotify data
        "imageUrl": None, # Not available from history artists easily
        "popularity": artist_data.get('count', 0) # Using count as popularity metric
    }

# --- Main Function ---
def main(user_id: str, is_premium: bool):
    print(f"Starting YouTube Music update for User ID: {user_id} (Premium: {is_premium})")

    # --- 1. Authenticate with YTMusic ---
    if not os.path.exists(OAUTH_FILE):
        print(f"OAuth file '{OAUTH_FILE}' not found.")
        if not YTM_OAUTH_CLIENT_ID or not YTM_OAUTH_CLIENT_SECRET:
             print("Error: YTM_OAUTH_CLIENT_ID and YTM_OAUTH_CLIENT_SECRET environment variables must be set for initial setup.")
             return
        print("Attempting OAuth setup...")
        try:
            # Note: setup_oauth requires user interaction in the terminal
            setup_oauth(OAUTH_FILE, client_id=YTM_OAUTH_CLIENT_ID, client_secret=YTM_OAUTH_CLIENT_SECRET)
            print(f"OAuth setup complete. Credentials saved to {OAUTH_FILE}. Please re-run the script.")
            return # Exit after setup, requires re-run
        except Exception as e:
            print(f"Error during OAuth setup: {e}")
            return

    try:
        print(f"Initializing YTMusic with OAuth file: {OAUTH_FILE}")
        # If setup was done, client_id/secret might be needed here too depending on ytmusicapi version/flow
        oauth_creds = None
        if YTM_OAUTH_CLIENT_ID and YTM_OAUTH_CLIENT_SECRET:
             oauth_creds = OAuthCredentials(client_id=YTM_OAUTH_CLIENT_ID, client_secret=YTM_OAUTH_CLIENT_SECRET)
             
        yt = YTMusic(OAUTH_FILE, oauth_credentials=oauth_creds)
        print("YTMusic initialized successfully.")
    except Exception as e:
        print(f"Error initializing YTMusic: {e}")
        if "invalid_grant" in str(e).lower():
             print("OAuth token might be expired or invalid. Try removing oauth.json and re-running setup.")
        return

    # --- 2. Fetch History ---
    history_limit = 150 # Fetch a bit more history for better top item calculation
    try:
        print(f"Fetching last {history_limit} history items...")
        history = yt.get_history(limit=history_limit) # ytmusicapi fetches *all* history then limits locally
        if not history:
            print("No history items found.")
            # Decide whether to save empty data or just exit
            # Saving empty data will clear previous snapshot
            top_tracks_db = []
            top_artists_db = []
            history_items_count = 0
        else:
             history_items_count = len(history)
             print(f"Fetched {history_items_count} history items.")
             # ytmusicapi history items already contain 'videoId', 'title', 'artists' etc.

             # --- 3. Calculate Top Items ---
             limit = 5 if is_premium else 3
             print(f"Calculating top {limit} tracks and artists...")

             # Top Tracks
             top_tracks_raw = calculate_top_items(history, lambda item: item.get('videoId'), limit)
             top_tracks_db = [format_track_for_supabase(track) for track in top_tracks_raw]
             print(f"Top {len(top_tracks_db)} tracks calculated.")

             # Top Artists
             # Need a unique key for artists, use ID if available, else name.
             def artist_key(item):
                  artists = item.get('artists')
                  if artists and len(artists) > 0:
                       # Prioritize ID, fallback to name for the *first* artist listed
                       return artists[0].get('id') or artists[0].get('name')
                  return None
                  
             # To count artists properly, we need to flatten the list first
             all_artists_in_history = []
             for item in history:
                  if item.get('artists'):
                      for artist in item['artists']:
                           # We need the count associated with the artist later for formatting
                           all_artists_in_history.append({"artist": artist}) 
                           
             artist_counts = Counter(a['artist'].get('id') or a['artist'].get('name') for a in all_artists_in_history if (a['artist'].get('id') or a['artist'].get('name')))
             
             # Get the top artist identifiers (ID or name)
             top_artist_keys = [key for key, count in artist_counts.most_common(limit)]

             # Create the final list including the count and the artist object
             top_artists_raw = []
             processed_keys = set()
             # Iterate through the *original* flattened list to get the artist object
             for artist_entry in reversed(all_artists_in_history): # Find most recent instance
                  key = artist_entry['artist'].get('id') or artist_entry['artist'].get('name')
                  if key in top_artist_keys and key not in processed_keys:
                       artist_obj = artist_entry['artist']
                       artist_obj['count'] = artist_counts[key] # Add the count
                       top_artists_raw.append({'artist': artist_obj, 'count': artist_counts[key]})
                       processed_keys.add(key)

             # Sort just in case (should already be sorted by count implicitly)
             top_artists_raw.sort(key=lambda x: x['count'], reverse=True)
             
             top_artists_db = [format_artist_for_supabase(artist_data) for artist_data in top_artists_raw]
             print(f"Top {len(top_artists_db)} artists calculated.")

    except Exception as e:
        print(f"Error fetching or processing YouTube Music data: {e}")
        if "credentials" in str(e).lower() or "auth" in str(e).lower():
             print("Authentication might have failed. Check oauth.json or credentials.")
        # Optionally exit or try to save empty data
        return # Exit on error

    # --- 4. Save to Supabase ---
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set.")
        return

    try:
        print("Connecting to Supabase...")
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("Connected to Supabase.")

        snapshot_date = datetime.utcnow().strftime('%Y-%m-%d')
        last_updated = datetime.utcnow().isoformat()

        # Prepare data - Note: genres are NOT updated by this script
        # The frontend/useStreamingData hook handles merging/displaying genres
        data_to_upsert = {
            "user_id": user_id,
            "service_id": "youtubemusic",
            "snapshot_date": snapshot_date,
            "last_updated": last_updated,
            "top_artists": top_artists_db,
            "top_tracks": top_tracks_db,
            # "top_genres" is intentionally omitted - let frontend handle/merge
            # "top_albums" is omitted as it's hard to get from history
            # Keep raw_data consistent if needed, or simplify/remove
            "raw_data": {
                 "history_fetched_count": history_items_count,
                 "calculated_artists_count": len(top_artists_db),
                 "calculated_tracks_count": len(top_tracks_db),
            }
        }

        print(f"Upserting data for {user_id} on {snapshot_date}...")
        response = supabase.table('user_streaming_data').upsert(
             data_to_upsert,
             on_conflict='user_id,service_id,snapshot_date'
        ).execute()

        # Check response (supabase-py v1 vs v2 differs slightly)
        # Basic check: no exception means likely success in v2+
        # In older versions check response.data, response.error
        # print(f"Supabase response: {response}") # For debugging

        print(f"Successfully updated Supabase for user {user_id}.")

    except Exception as e:
        print(f"Error updating Supabase: {e}")
        # print(f"Data attempted to upsert: {json.dumps(data_to_upsert, indent=2)}") # Debug data

# --- Script Execution ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Update YouTube Music data for a user in Supabase.")
    parser.add_argument("user_id", help="The Supabase User ID to update.")
    parser.add_argument("--premium", action="store_true", help="Flag if the user is a premium user (sets limit to 5, else 3).")

    args = parser.parse_args()

    main(args.user_id, args.premium) 