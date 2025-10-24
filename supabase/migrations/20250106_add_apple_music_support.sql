-- Add Apple Music support to user_streaming_data table
-- This migration ensures the table can handle Apple Music service_id

-- First, let's check if the user_streaming_data table exists and create it if it doesn't
CREATE TABLE IF NOT EXISTS public.user_streaming_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    service_id TEXT NOT NULL CHECK (service_id IN ('spotify', 'youtubemusic', 'apple_music')),
    snapshot_date DATE NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    top_artists JSONB DEFAULT '[]'::jsonb,
    top_tracks JSONB DEFAULT '[]'::jsonb,
    top_albums JSONB DEFAULT '[]'::jsonb,
    top_genres JSONB DEFAULT '[]'::jsonb,
    top_moods JSONB DEFAULT '[]'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, service_id, snapshot_date)
);

-- Enable RLS on user_streaming_data table
ALTER TABLE public.user_streaming_data ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_streaming_data table
CREATE POLICY "Users can view own streaming data" ON public.user_streaming_data
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own streaming data" ON public.user_streaming_data
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own streaming data" ON public.user_streaming_data
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own streaming data" ON public.user_streaming_data
    FOR DELETE USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_streaming_data_user_id ON public.user_streaming_data(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaming_data_service_id ON public.user_streaming_data(service_id);
CREATE INDEX IF NOT EXISTS idx_user_streaming_data_snapshot_date ON public.user_streaming_data(snapshot_date);

-- Create a table for API credentials (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.api_credentials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service TEXT NOT NULL UNIQUE,
    client_id TEXT,
    client_secret TEXT,
    team_id TEXT, -- For Apple Music
    key_id TEXT, -- For Apple Music
    private_key TEXT, -- For Apple Music (encrypted)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on api_credentials table
ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for api_credentials table (admin only)
CREATE POLICY "Only service role can access api_credentials" ON public.api_credentials
    FOR ALL USING (auth.role() = 'service_role');

-- Add comment to document the Apple Music integration
COMMENT ON TABLE public.user_streaming_data IS 'Stores user streaming data from various music services including Spotify, YouTube Music, and Apple Music';
COMMENT ON COLUMN public.user_streaming_data.service_id IS 'Music service identifier: spotify, youtubemusic, or apple_music';
COMMENT ON COLUMN public.user_streaming_data.top_artists IS 'JSONB array of top artists with id, name, genres, imageUrl';
COMMENT ON COLUMN public.user_streaming_data.top_tracks IS 'JSONB array of top tracks with id, name, artistNames, albumName, imageUrl, playCount';
COMMENT ON COLUMN public.user_streaming_data.top_albums IS 'JSONB array of top albums with id, name, artistNames, imageUrl';
COMMENT ON COLUMN public.user_streaming_data.top_genres IS 'JSONB array of top genres with name, count, score';
COMMENT ON COLUMN public.user_streaming_data.top_moods IS 'JSONB array of top moods with name, count, score';
COMMENT ON COLUMN public.user_streaming_data.raw_data IS 'JSONB object containing full raw data from the music service API';



