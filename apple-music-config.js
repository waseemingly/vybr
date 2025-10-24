// Apple Music OAuth Configuration
// Copy this to your .env.local file

module.exports = {
  APPLE_MUSIC_CLIENT_ID: 'com.vybr.musickit.oauth',
  APPLE_MUSIC_CLIENT_SECRET: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlVKWThaVU1VNEQifQ.eyJpYXQiOjE3NjExOTY0MTgsImV4cCI6MTc3Njc0ODQxOCwiaXNzIjoiUjhVVjQ0OVdSWSJ9.QLrZ5zyEMQ9R-o825RMtaf2aiK811s6c7bfSnKdYWTM9ns_vpOUQ1LiGPzE2u-R_R2eB8qVpImwASdtAsuS8fQ',
  APPLE_MUSIC_REDIRECT_URI: 'https://unmodern-sleeveless-ahmad.ngrok-free.dev/apple-music-callback'
};

// Instructions:
// 1. Run 'ngrok http 19006' to get your ngrok URL
// 2. Replace 'your-ngrok-url' with your actual ngrok URL
// 3. Copy these values to your .env.local file
