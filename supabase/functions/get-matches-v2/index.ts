// supabase/functions/get-matches-v2/index.ts

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// --- Interfaces (Define data structures) ---
interface UserBio {
    musicTaste?: string | null;
    firstSong?: string | null;
    goToSong?: string | null;
    mustListenAlbum?: string | null;
    dreamConcert?: string | null;
    [key: string]: string | null | undefined;
}

interface MusicData {
    genres?: string[] | null;
    artists?: string[] | null;
    songs?: { title?: string; artist?: string }[] | null;
    albums?: { title?: string; artist?: string; year?: string | number }[] | null;
}

interface PotentialMatchData {
    user_id: string;
    profile_id: string; // The primary key of the music_lover_profiles table
    bio: UserBio | null;
    music_data: MusicData | null;
}

// Structure returned to the frontend for each match
interface MatchResult {
    userId: string; // Matched user's auth ID
    profileId: string; // Matched user's profile table ID
    firstName: string;
    lastName: string;
    profilePicture: string | null;
    compatibilityScore: number; // The calculated word match percentage (0-100)
    isPremium: boolean;
}

// --- Helper Function: Extract Words ---
function extractWords(bio: UserBio | null, musicData: MusicData | null): Set<string> {
    const words = new Set<string>();
    const bioFieldsToExtract: (keyof UserBio)[] = ['firstSong', 'goToSong', 'mustListenAlbum', 'dreamConcert'];

    if (bio) {
        for (const field of bioFieldsToExtract) {
            const value = bio[field];
            if (value && typeof value === 'string') {
                value.toLowerCase().split(/[^a-z0-9]+/).forEach(word => {
                    if (word.length > 1) words.add(word);
                });
            }
        }
    }

    if (musicData) {
        musicData.genres?.forEach(g => g.toLowerCase().split(/[^a-z0-9]+/).forEach(w => { if (w.length > 1) words.add(w); }));
        musicData.artists?.forEach(a => a.toLowerCase().split(/[^a-z0-9]+/).forEach(w => { if (w.length > 1) words.add(w); }));
        musicData.songs?.forEach(s => {
            s.title?.toLowerCase().split(/[^a-z0-9]+/).forEach(w => { if (w.length > 1) words.add(w); });
            s.artist?.toLowerCase().split(/[^a-z0-9]+/).forEach(w => { if (w.length > 1) words.add(w); });
        });
        musicData.albums?.forEach(a => {
            a.title?.toLowerCase().split(/[^a-z0-9]+/).forEach(w => { if (w.length > 1) words.add(w); });
            a.artist?.toLowerCase().split(/[^a-z0-9]+/).forEach(w => { if (w.length > 1) words.add(w); });
        });
    }
    return words;
}

// --- Helper: Calculate Jaccard Index ---
function calculateJaccardIndex(setA: Set<string>, setB: Set<string>): number {
    if (setA.size === 0 && setB.size === 0) return 1.0;
    if (setA.size === 0 || setB.size === 0) return 0.0;

    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
}

console.log("Get Matches V2 Function Initialized");

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { userId: currentUserId } = await req.json();
        if (!currentUserId) throw new Error("User ID is required.");
        console.log("V2: Processing request for user:", currentUserId);

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase env vars missing.");

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
           auth: { persistSession: false }
        });
        console.log("V2: Supabase admin client created.");

        // 1. Fetch Current User's Profile
        const { data: currentUserProfileData, error: profileError } = await supabaseAdmin
            .from('music_lover_profiles')
            .select('id, user_id, country, bio, music_data')
            .eq('user_id', currentUserId)
            .single();

        if (profileError || !currentUserProfileData) throw new Error(`Could not find profile for user ${currentUserId}. ${profileError?.message || ''}`);
        const currentUser = currentUserProfileData as { id: string, user_id: string, country: string | null, bio: UserBio | null, music_data: MusicData | null };
        console.log("V2: Current user profile fetched:", currentUser.id);

        const targetCountry = currentUser.country;
        const targetMusicTaste = currentUser.bio?.musicTaste;

        if (!targetCountry || !targetMusicTaste) {
            console.warn("V2: Current user missing country or music taste. No matches possible.");
            return new Response(JSON.stringify({ matches: [] }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
            });
        }
        console.log(`V2: Matching criteria: Country=${targetCountry}, MusicTaste=${targetMusicTaste}`);

        // 2. Query Potential Matches based on mandatory criteria
        const { data: potentialMatchesData, error: matchesError } = await supabaseAdmin
            .from('music_lover_profiles')
            .select('id, user_id, first_name, last_name, bio, music_data, profile_picture, is_premium')
            .neq('user_id', currentUserId)
            .eq('country', targetCountry)
            .eq('bio->>musicTaste', targetMusicTaste)
            .limit(200); // Limit initial fetch

        if (matchesError) throw new Error(`Database error fetching potential matches: ${matchesError.message}`);
        console.log(`V2: Found ${potentialMatchesData?.length ?? 0} potential matches based on country/taste.`);

        const potentialMatches: (PotentialMatchData & { first_name: string | null, last_name: string | null, profile_picture: string | null, is_premium: boolean })[] = (potentialMatchesData || []).map(p => ({
            ...p,
            profile_id: p.id
        }));

        // 3. Calculate Word Overlap and Filter
        const currentUserWords = extractWords(currentUser.bio, currentUser.music_data);
        const finalMatches: MatchResult[] = [];
        const WORD_MATCH_THRESHOLD = 60; // 60%

        for (const match of potentialMatches) {
            const potentialMatchWords = extractWords(match.bio, match.music_data);
            const jaccardIndex = calculateJaccardIndex(currentUserWords, potentialMatchWords);
            const wordMatchPercentage = Math.round(jaccardIndex * 100);

            console.log(`V2: Comparing with ${match.profile_id}. Word Match: ${wordMatchPercentage}%`);

            if (wordMatchPercentage >= WORD_MATCH_THRESHOLD) {
                finalMatches.push({
                    userId: match.user_id,
                    profileId: match.profile_id,
                    firstName: match.first_name ?? '',
                    lastName: match.last_name ?? '',
                    profilePicture: match.profile_picture,
                    compatibilityScore: wordMatchPercentage,
                    isPremium: match.is_premium,
                });
            }
        }

        // 4. Sort by Score
        finalMatches.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

        console.log(`V2: Returning ${finalMatches.length} matches after word overlap check.`);

        // 5. Return Response
        return new Response(JSON.stringify({ matches: finalMatches }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error("V2: Error in get-matches-v2 function:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});