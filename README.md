# Vybr - Connect through music

Vybr is a mobile application that connects music lovers with event organizers based on musical taste and preferences. This app provides personalized event recommendations using Spotify integration and offers organizers insights to create more targeted events.

## Features

### For Music Lovers:
- Spotify integration to analyze musical preferences
- Personalized event recommendations
- User profile with musical taste visualization
- Event discovery and ticket purchases
- In-app communication with other users and organizers

### For Organizers:
- Event creation and management
- Analytics dashboard for audience insights
- Targeted advertising to relevant music lovers
- Revenue tracking for tickets and reservations
- Business profile with upcoming and past events

## Tech Stack

- **Frontend**: React Native, Expo
- **Backend**: Supabase
- **Authentication**: Supabase Auth
- **Database**: PostgreSQL (via Supabase)
- **API Integration**: Spotify API

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Expo CLI
- Supabase account
- Spotify Developer account

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/vybr.git
cd vybr
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Configure environment variables
   Edit `app.json` and update the `extra` section with your API keys:
   ```json
   "extra": {
     "SUPABASE_URL": "your-supabase-url",
     "SUPABASE_SERVICE_ROLE_KEY": "your-supabase-anon-key",
     "SPOTIFY_CLIENT_ID": "your-spotify-client-id",
     "SPOTIFY_CLIENT_SECRET": "your-spotify-client-secret"
   }
   ```

4. Start the development server
```bash
expo start
```

## Project Structure

```
vybr/
├── assets/             # Images, fonts, etc.
├── src/
│   ├── components/     # Reusable UI components
│   ├── config/         # Configuration files and constants
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Library code and API clients
│   ├── navigation/     # Navigation configuration
│   ├── screens/        # Screen components
│   │   ├── auth/       # Authentication screens
│   │   ├── organizer/  # Organizer-specific screens
│   │   └── ...         # Other screens
│   └── services/       # External service integrations
├── App.tsx             # App entry point
└── app.json            # Expo configuration
```

## Authentication Flow

The app provides authentication for two user types:
1. **Music Lovers** - Can connect their Spotify accounts and receive personalized recommendations
2. **Organizers** - Can create events and manage their business profiles

Both user types follow a multi-step signup flow with verification.

## Environment Variables

The application uses the following environment variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Your Supabase anonymous key
- `SPOTIFY_CLIENT_ID`: Your Spotify API client ID
- `SPOTIFY_CLIENT_SECRET`: Your Spotify API client secret

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Spotify API for music data
- Supabase for backend services
- Expo for making React Native development easier
