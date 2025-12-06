# MusicKit JS 403 - Domain Configuration Fix

## Current Status
✅ MusicKit identifier exists: `media.com.vybr.musickit`  
✅ MusicKit service is enabled  
✅ Developer token works for REST API  
❌ MusicKit JS `authorize()` returns 403 from `play.itunes.apple.com`

## The Issue

MusicKit JS requires the domain to be registered, but the configuration page might not show this option clearly. Here are the steps to fix it:

## Solution 1: Check for Hidden Domain Fields

1. Go to: https://developer.apple.com/account/resources/identifiers/list
2. Click on `media.com.vybr.musickit`
3. **Scroll down** on the page - domain fields might be below the services list
4. Look for any editable fields related to:
   - Domain
   - Website URL
   - Redirect URI
   - Return URL

## Solution 2: Check Separate MusicKit Configuration

1. In Apple Developer Portal, go to: **Certificates, Identifiers & Profiles**
2. Look for a separate **"MusicKit"** section (not under Identifiers)
3. If it exists, click on it
4. Add your domain: `unmodern-sleeveless-ahmad.ngrok-free.dev`

## Solution 3: Try Without Domain Registration (ngrok limitation)

If domain registration isn't available or doesn't work with ngrok:

### Option A: Use a Static Domain
- Upgrade to ngrok paid plan for a static domain
- Register that static domain in Apple Developer Portal

### Option B: Test with Production Domain
- If you have a production domain (e.g., `vybr.com`), register that
- Test authorization on the production domain

### Option C: Use Apple's Test Environment
- Some configurations work differently in development
- Check if there's a "Development" vs "Production" toggle

## Solution 4: Verify MusicKit JS Configuration

Make sure your code is using the correct identifier:

```javascript
const config = {
  developerToken: developerToken,
  musicKitId: 'media.com.vybr.musickit', // Must match exactly
  app: {
    name: 'Vybr',
    build: '1.0.0'
  }
};
```

## Solution 5: Wait and Retry

Sometimes Apple's systems take time to propagate:
1. Wait **15-30 minutes** after any changes
2. Clear browser cache completely
3. Try in incognito/private mode
4. Try a different browser

## Solution 6: Check Browser Console in Popup

When the authorization popup opens:
1. Right-click in the popup → Inspect
2. Go to Network tab
3. Filter by "apple.com"
4. Look for the failed request to `play.itunes.apple.com`
5. Check the Response tab for error details
6. Check the Request Headers - verify the domain being sent

## Solution 7: Contact Apple Developer Support

If none of the above works:
1. Go to: https://developer.apple.com/contact/
2. Select "App Store Connect" or "Developer Account"
3. Explain:
   - Team ID: `R8UV449WRY`
   - Key ID: `55272UR5Y5`
   - MusicKit Identifier: `media.com.vybr.musickit`
   - Domain: `unmodern-sleeveless-ahmad.ngrok-free.dev`
   - Error: 403 from `play.itunes.apple.com` during `authorize()`
   - Note: Developer token works for REST API, but MusicKit JS fails

## Quick Test

After making any changes:
1. Wait 10-15 minutes
2. Clear browser cache
3. Try authorization again
4. Check logs - should see `"musicKitId": "media.com.vybr.musickit"` (not "not set")

