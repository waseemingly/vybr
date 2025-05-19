export interface MoodDefinition {
  moodName: string;
  description: string;
  // Optional: Add specific feature targets if you want to guide Gemini more precisely
  // bpm_min?: number;
  // bpm_max?: number;
  // energy_min?: number;
  // energy_max?: number;
  // valence_min?: number;
  // valence_max?: number;
}

export const MUSIC_MOODS: MoodDefinition[] = [
  { "moodName": "Happy Energetic", "description": "Characterized by high BPM (e.g., 120-160 BPM), high energy, high valence (positive feeling), often in a major key." },
  { "moodName": "Chill Vibes", "description": "Characterized by low BPM (e.g., 60-90 BPM), low to moderate energy, often high acousticness or ambient textures." },
  { "moodName": "Workout Power", "description": "Very high BPM (e.g., 130-170+ BPM), very high energy, strong rhythmic drive, often electronic or rock." },
  { "moodName": "Melancholic Reflection", "description": "Low to moderate BPM (e.g., 70-100 BPM), low energy, low valence (sad or pensive), often acoustic or orchestral, minor key." },
  { "moodName": "Romantic Evening", "description": "Low BPM (e.g., 50-80 BPM), low energy, moderate to high valence, often features piano, strings, or smooth vocals." },
  { "moodName": "Party Starter", "description": "High BPM (e.g., 115-135 BPM), high energy, high danceability, positive valence, often pop, funk, or disco." },
  { "moodName": "Focused Study", "description": "Moderate BPM (e.g., 80-110 BPM), low to moderate energy, high instrumentalness, minimal vocals, ambient or classical." },
  { "moodName": "Road Trip Singalong", "description": "Moderate to high BPM (e.g., 100-150 BPM), moderate to high energy, high valence, catchy melodies, often rock or pop anthems." },
  { "moodName": "Aggressive Pump-Up", "description": "High BPM (e.g., 140-180+ BPM), very high energy, can have lower valence (aggressive tone), often metal, hard rock, or intense electronic." },
  { "moodName": "Peaceful Meditation", "description": "Very low BPM (e.g., 40-70 BPM), very low energy, high instrumentalness, ambient, drone, or nature sounds." },
  { "moodName": "Groovy Dance", "description": "Moderate BPM (e.g., 100-125 BPM), high energy, high danceability, often funk, soul, or house music." },
  { "moodName": "Dreamy Escape", "description": "Low to moderate BPM (e.g., 70-110 BPM), moderate energy, ethereal textures, high reverb, often dream pop or shoegaze." },
  { "moodName": "Uplifting Hopeful", "description": "Moderate BPM (e.g., 90-130 BPM), moderate to high energy, high valence, often soaring melodies, major key, inspirational lyrics." },
  { "moodName": "Dark & Brooding", "description": "Low BPM (e.g., 60-90 BPM), low energy, very low valence, minor key, often industrial, dark ambient, or gothic." },
  { "moodName": "Nostalgic Rewind", "description": "Varied BPM, evokes feelings of the past, often associated with specific decades or older genres." },
  { "moodName": "Experimental & Quirky", "description": "Unconventional rhythms and melodies, varied BPM and energy, often avant-garde or indie electronic." },
  { "moodName": "Sultry & Sensual", "description": "Low to moderate BPM (e.g., 70-100 BPM), moderate energy, often R&B, soul, or smooth jazz with expressive vocals." },
  { "moodName": "Empowering Anthem", "description": "Moderate to high BPM (e.g., 100-140 BPM), high energy, strong vocals, themes of strength and resilience." },
  { "moodName": "Mysterious & Eerie", "description": "Varied BPM, creates suspense or unease, often uses dissonance or unconventional instrumentation." },
  { "moodName": "Joyful Celebration", "description": "High BPM (e.g., 120-160 BPM), high energy, very high valence, often pop, gospel, or festive music." }
];

export interface SongForMoodAnalysis {
  title: string;
  artist: string;
  id?: string; // Optional: if you want to include Spotify track ID
}

export const generateGeminiMoodAnalysisPrompt = (songs: SongForMoodAnalysis[]): string => {
  const moodDefinitionsString = JSON.stringify(
    MUSIC_MOODS.map(mood => ({ moodName: mood.moodName, description: mood.description })),
    null,
    2
  );

  const songsString = JSON.stringify(
    songs.map(song => ({ title: song.title, artist: song.artist })), // Only pass title and artist
    null,
    2
  );

  return `You are an expert music mood categorizer. Your task is to analyze a list of songs and assign each song to one of the predefined music moods based on their likely audio characteristics.

Here are the available music moods and their general characteristics:
${moodDefinitionsString}

You will be given a list of songs below, each identified by its title and artist. For each song:
1. Estimate its likely audio features (BPM, energy, valence, acousticness, danceability, instrumentalness, mode).
2. Based on these features, determine which of the moods defined above it best fits.

Provide your response as a single JSON array. Each element in the array should be an object representing one song and its assigned mood, in the same order as the input songs.
Each object should have the following structure:
{
  "title": "song_title_here",
  "artist": "song_artist_here",
  "determinedMood": "assigned_mood_name_here"
}

Ensure that "determinedMood" is ONLY one of the exact moodName strings provided in the mood definitions.

Here is the list of songs to categorize:
${songsString}

Now, generate the JSON array with your mood categorizations for all the songs listed above.
  `;
};

// Example of how to request JSON output if the model supports it.
// This would typically be part of the API call setup, not the prompt itself.
// export const GEMINI_GENERATION_CONFIG = {
//   responseMimeType: "application/json",
// };

export interface GeminiMoodResponseItem {
  title: string;
  artist: string;
  determinedMood: string;
} 