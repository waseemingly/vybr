# MusicKit JS 403 Error - Developer Token Works But Authorization Fails

## Your Situation

✅ **Developer token works** - REST API calls succeed (catalog search returns 200)  
❌ **MusicKit JS fails** - `authorize()` returns 403 from `play.itunes.apple.com`  
⚠️ **Instance shows** - `"musicKitId": "not set"` even though configured

## What This Means

Your developer token is **valid and working**, but MusicKit JS can't authorize because:
1. The MusicKit identifier `media.com.vybr.musickit` may not be properly registered
2. OR the domain `unmodern-sleeveless-ahmad.ngrok-free.dev` needs to be whitelisted
3. OR there's a configuration mismatch

## Fix Steps (In Order)

### Step 1: Verify MusicKit Identifier Exists and is Enabled

1. Go to: https://developer.apple.com/account/resources/identifiers/list
2. Search for: `media.com.vybr.musickit`
3. Click on it to open details
4. **Verify:**
   - ✅ Identifier exists
   - ✅ **MusicKit service shows "Enabled"** (green checkmark)
   - ✅ Format is exactly: `media.com.vybr.musickit` (no typos)

**If it doesn't exist:**
1. Click "+" button
2. Select **"Services IDs"** (NOT App IDs)
3. Enter identifier: `media.com.vybr.musickit`
4. Check **"MusicKit"** service
5. Click "Continue" and "Register"
6. **Wait 5-10 minutes** for Apple's systems to update

### Step 2: Check Domain/Redirect URI Configuration

1. In the MusicKit identifier page, look for:
   - **Domain** field
   - **Redirect URIs** section
   - **Return URLs** section
   - **Allowed Domains** section

2. If any of these exist, add:
   - Domain: `unmodern-sleeveless-ahmad.ngrok-free.dev`
   - Redirect URI: `https://unmodern-sleeveless-ahmad.ngrok-free.dev/apple-music-auth.html`
   - Or: `https://unmodern-sleeveless-ahmad.ngrok-free.dev/*` (if wildcards allowed)

3. Save changes

**Note:** If your ngrok URL changes, you'll need to update this.

### Step 3: Verify Team ID Matches

1. Go to: https://developer.apple.com/account
2. Check your Team ID (top right or membership section)
3. Verify it matches: `R8UV449WRY`
4. If different, update `APPLE_MUSIC_TEAM_ID` in Supabase and redeploy

### Step 4: Test Again

After making changes:
1. **Wait 5-10 minutes** for Apple's systems to update
2. Clear browser cache
3. Try authorization again
4. Check logs - you should see:
   - `"musicKitId": "media.com.vybr.musickit"` (not "not set")
   - No 403 errors from `play.itunes.apple.com`

## Common Issues

### Issue: "musicKitId" shows "not set"

**Cause:** MusicKit identifier not properly registered or enabled

**Fix:** Follow Step 1 above - ensure identifier exists and MusicKit is enabled

### Issue: Still getting 403 after verifying identifier

**Possible causes:**
1. **Domain not whitelisted** - Follow Step 2
2. **Apple's systems haven't updated** - Wait 10-15 minutes and try again
3. **Team ID mismatch** - Follow Step 3
4. **Identifier format typo** - Double-check it's exactly `media.com.vybr.musickit`

### Issue: ngrok URL changes frequently

**Solution:** 
- Use a static ngrok domain (paid plan) OR
- Update the domain in Apple Developer Portal each time ngrok restarts OR
- Use a wildcard pattern if supported: `*.ngrok-free.dev`

## Verification Checklist

After fixing, verify:
- [ ] MusicKit identifier `media.com.vybr.musickit` exists
- [ ] MusicKit service is **Enabled** (green checkmark)
- [ ] Domain is registered (if required)
- [ ] Team ID matches `R8UV449WRY`
- [ ] Waited 5-10 minutes after changes
- [ ] Cleared browser cache
- [ ] Logs show `"musicKitId": "media.com.vybr.musickit"` (not "not set")
- [ ] No 403 errors from `play.itunes.apple.com`

## Still Not Working?

If you've verified everything above and still get 403:

1. **Check Apple Developer Portal Status:**
   - Ensure your Apple Developer account is active
   - Verify MusicKit API access is enabled for your account
   - Check if there are any account-level restrictions

2. **Try a Different Browser:**
   - Sometimes browser extensions or settings can interfere
   - Try incognito/private mode
   - Try a different browser

3. **Contact Apple Developer Support:**
   - If everything looks correct, there may be an account-level issue
   - Provide them with:
     - Team ID: `R8UV449WRY`
     - Key ID: `55272UR5Y5`
     - MusicKit Identifier: `media.com.vybr.musickit`
     - Domain: `unmodern-sleeveless-ahmad.ngrok-free.dev`
     - Error: 403 from `play.itunes.apple.com` during `authorize()`

