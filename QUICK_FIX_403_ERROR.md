# Quick Fix for 403 Error

## The Problem
Apple is rejecting your developer token with a 403 Forbidden error. This means the **private key doesn't match Key ID `55272UR5Y5`**.

## Immediate Solution

### Option 1: Verify You Have the Correct Key File

1. **Check if you have the `.p8` file for Key ID `55272UR5Y5`**:
   - Go to: https://developer.apple.com/account/resources/authkeys/list
   - Look for key with ID: `55272UR5Y5`
   - **If you don't have the `.p8` file**: You CANNOT download it again. Apple only allows one download.

2. **If you have the `.p8` file**:
   - Open it in a text editor
   - Copy JUST the base64 content (the long string, no BEGIN/END headers needed)
   - Go to Supabase Dashboard → Edge Functions → Secrets
   - Update `APPLE_MUSIC_PRIVATE_KEY` with the base64 content
   - **Redeploy the Edge Function** (very important!)

### Option 2: Create a New Key (If You Lost the .p8 File)

1. Go to: https://developer.apple.com/account/resources/authkeys/list
2. Click "+" to create a new key
3. Name it (e.g., "MusicKit Key 2")
4. Enable "MusicKit" service
5. Click "Continue" then "Register"
6. **IMPORTANT**: Download the `.p8` file immediately (you can only download once!)
7. Open the `.p8` file and copy JUST the base64 content
8. In Supabase:
   - Update `APPLE_MUSIC_KEY_ID` to the new Key ID
   - Update `APPLE_MUSIC_PRIVATE_KEY` with the base64 content
9. **Redeploy the Edge Function**

## Verify It's Working

After updating and redeploying:

1. Check Supabase Edge Function logs:
   - Go to Supabase Dashboard → Edge Functions → `generate-apple-music-token` → Logs
   - Look for: `[DEBUG] Key signature test passed`
   - If you see errors, the key format is wrong

2. Try authorizing again in your app
3. If still getting 403, the key still doesn't match - double-check the Key ID

## Common Mistakes

- ❌ Using a key file for a different Key ID
- ❌ Not redeploying the Edge Function after updating secrets
- ❌ Copying the key with extra spaces or line breaks
- ❌ Using an old/corrupted key file

## Still Not Working?

If you've verified:
- ✅ The `.p8` file matches Key ID `55272UR5Y5`
- ✅ The base64 content is pasted correctly in Supabase
- ✅ The Edge Function was redeployed
- ✅ The signature test passes in logs

Then check:
1. **MusicKit Identifier**: Verify `media.com.vybr.musickit` exists and MusicKit is enabled
2. **Team ID**: Verify `R8UV449WRY` matches your Apple Developer account
3. **Create a fresh key** as a last resort

