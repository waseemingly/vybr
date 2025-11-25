# Apple Music with ngrok Setup

## Important: Access Your App via ngrok URL

Apple Music requires HTTPS, so you need to access your app through the ngrok URL, not localhost.

## Setup Steps

### 1. Start ngrok (if not already running)

```bash
ngrok http 19006
```

This will give you a URL like: `https://unmodern-sleeveless-ahmad.ngrok-free.dev`

### 2. Access Your App via ngrok

**Don't use:** `http://127.0.0.1:19006/MusicLoverSignUpFlow`

**Use instead:** `https://unmodern-sleeveless-ahmad.ngrok-free.dev/MusicLoverSignUpFlow`

### 3. Register Redirect URI in Apple Developer Portal

1. Go to: https://developer.apple.com/account/resources/identifiers/list
2. Find your MusicKit service identifier
3. Add the redirect URI: `https://unmodern-sleeveless-ahmad.ngrok-free.dev/apple-music-callback`

**Note:** The actual callback path might be handled automatically by MusicKit JS, but it's good to register it.

### 4. Test Apple Music Authentication

1. Start your app: `npx expo start --clear --port 19006`
2. **Access via ngrok URL**: `https://unmodern-sleeveless-ahmad.ngrok-free.dev/MusicLoverSignUpFlow`
3. Select Apple Music as streaming service
4. Click Connect
5. MusicKit authorization should work!

## How It Works

- **Spotify**: Uses `http://127.0.0.1:19006/callback` (HTTP is fine for Spotify)
- **Apple Music**: Uses `https://unmodern-sleeveless-ahmad.ngrok-free.dev/apple-music-callback` (HTTPS required)

MusicKit JS automatically detects the current domain (`window.location.origin`) and uses it for authorization. As long as you access the app via the ngrok URL, it will work correctly.

## Troubleshooting

### "Authorization failed" error
- Make sure you're accessing the app via the ngrok HTTPS URL, not localhost
- Verify ngrok is running: `ngrok http 19006`
- Check that the ngrok URL matches what's registered in Apple Developer Portal

### "Domain not registered" error
- Add your ngrok domain to Apple Developer Portal
- Make sure the domain matches exactly (including https://)

### ngrok URL changed?
- If ngrok gives you a new URL, update:
  1. `src/hooks/useAppleMusicAuth.ts` - Update `REGISTERED_WEB_REDIRECT_URI`
  2. Apple Developer Portal - Update the redirect URI

## Notes

- Spotify continues to work with localhost (no changes needed)
- Apple Music requires HTTPS, so ngrok is necessary for local development
- In production, use your actual domain instead of ngrok

