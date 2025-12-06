# CORS Error Fix for ngrok + Supabase

## Understanding the Error

You're seeing CORS errors because:

1. **Your app is running on ngrok**: `https://unmodern-sleeveless-ahmad.ngrok-free.dev`
2. **Supabase is blocking requests** from this origin because it's not in the allowed CORS origins list
3. **This affects**:
   - REST API calls (`/rest/v1/...`)
   - Edge Functions (`/functions/v1/...`)
   - WebSocket connections (`wss://...`)

## The Error Message

```
Access to fetch at 'https://fqfgueshwuhpckszyrsj.supabase.co/...' 
from origin 'https://unmodern-sleeveless-ahmad.ngrok-free.dev' 
has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Solution: Configure CORS in Supabase Dashboard

### Step 1: Go to Supabase Dashboard

1. Open your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project: `fqfgueshwuhpckszyrsj`

### Step 2: Navigate to API Settings

1. Click on **Settings** (gear icon) in the left sidebar
2. Click on **API** in the settings menu
3. Scroll down to **CORS Configuration** or **Additional Allowed Origins**

### Step 3: Add Your ngrok URL

1. In the **Additional Allowed Origins** field, add:
   ```
   https://unmodern-sleeveless-ahmad.ngrok-free.dev
   ```

2. If there are multiple origins, add them one per line or comma-separated (depending on the UI)

3. **Important**: If your ngrok URL changes (which it does on free tier), you'll need to update this

### Step 4: Save and Wait

1. Click **Save** or **Update**
2. Wait 1-2 minutes for changes to propagate
3. Refresh your app

## Alternative: Use Wildcard (Development Only)

⚠️ **Warning**: Only use this for development/testing, NOT production!

If you're constantly changing ngrok URLs, you can temporarily use:
```
https://*.ngrok-free.dev
https://*.ngrok.io
```

However, Supabase may not support wildcards. If not, you'll need to add each ngrok URL manually.

## Why This Happens

- **Same-Origin Policy**: Browsers block cross-origin requests by default
- **CORS**: Cross-Origin Resource Sharing allows servers to specify which origins can access them
- **Supabase REST API**: Controlled by Supabase infrastructure, requires dashboard configuration
- **Edge Functions**: Can handle CORS themselves (which they do via `corsHeaders`)
- **WebSocket**: Also requires CORS configuration for the initial handshake

## Testing the Fix

After adding the origin:

1. Open your browser's Developer Tools (F12)
2. Go to the **Network** tab
3. Refresh your app
4. Check if requests to Supabase are now successful (status 200 instead of CORS errors)

## Troubleshooting

### Still seeing errors?

1. **Clear browser cache** - Old CORS headers might be cached
2. **Wait 2-3 minutes** - Supabase changes can take time to propagate
3. **Check the exact URL** - Make sure there's no trailing slash or extra characters
4. **Check ngrok URL** - Free tier URLs change, verify you're using the current one

### ngrok URL Changed?

If your ngrok URL changes (free tier does this), you need to:
1. Get the new ngrok URL
2. Update it in Supabase dashboard
3. Wait for propagation

### Production Solution

For production, you should:
1. Use your own domain (not ngrok)
2. Add your production domain to Supabase CORS settings
3. Remove ngrok URLs from allowed origins

## Related Files

- `supabase/functions/_shared/cors.ts` - CORS headers for Edge Functions (already fixed)
- Edge Functions handle their own CORS, but REST API needs dashboard configuration

