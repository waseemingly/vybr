# How to Test Your Apple Music Developer Token

## Method 1: Using curl (Command Line) ⚡ Quickest

### Test 1: Catalog Search (No User Token Required)
This endpoint only requires the developer token:

```bash
curl -X GET "https://api.music.apple.com/v1/catalog/us/search?term=Taylor+Swift&types=songs&limit=1" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Replace `YOUR_TOKEN_HERE` with your actual token:**
```bash
curl -X GET "https://api.music.apple.com/v1/catalog/us/search?term=Taylor+Swift&types=songs&limit=1" \
  -H "Authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjU1MjcyVVI1WTUifQ.eyJpc3MiOiJSOFVWNDQ5V1JZIiwiaWF0IjoxNzY0OTg2MzA2LCJleHAiOjE3Njc1NzgzNjZ9.RAmGxiDXbgbKLyH4HgxFKuPditjvlfR31Act0YiwXcKbLtLzrKJyj4d9kNWk3TySWde3CjgJEpkhIvY-xDn09g" \
  -H "Content-Type: application/json"
```

**Expected Results:**
- ✅ **200 OK** → Token is valid! The 403 error is fixed.
- ❌ **401 Unauthorized** → Token format issue
- ❌ **403 Forbidden** → Token still doesn't match Key ID (check other issues)

### Test 2: Get a Song by ID
```bash
curl -X GET "https://api.music.apple.com/v1/catalog/us/songs/203709340" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

## Method 2: Using Browser Console (JavaScript) 🌐

Open your browser's Developer Console (F12) and paste this:

```javascript
// Replace with your actual token
const token = "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjU1MjcyVVI1WTUifQ.eyJpc3MiOiJSOFVWNDQ5V1JZIiwiaWF0IjoxNzY0OTg2MzA2LCJleHAiOjE3Njc1NzgzNjZ9.RAmGxiDXbgbKLyH4HgxFKuPditjvlfR31Act0YiwXcKbLtLzrKJyj4d9kNWk3TySWde3CjgJEpkhIvY-xDn09g";

// Test catalog search
fetch('https://api.music.apple.com/v1/catalog/us/search?term=Taylor+Swift&types=songs&limit=1', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log('Status:', response.status, response.statusText);
  if (response.ok) {
    console.log('✅ SUCCESS! Token is valid!');
    return response.json();
  } else {
    console.error('❌ ERROR:', response.status);
    return response.text();
  }
})
.then(data => {
  console.log('Response:', data);
})
.catch(error => {
  console.error('Request failed:', error);
});
```

## Method 3: Using PowerShell (Windows) 💻

```powershell
$token = "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjU1MjcyVVI1WTUifQ.eyJpc3MiOiJSOFVWNDQ5V1JZIiwiaWF0IjoxNzY0OTg2MzA2LCJleHAiOjE3Njc1NzgzNjZ9.RAmGxiDXbgbKLyH4HgxFKuPditjvlfR31Act0YiwXcKbLtLzrKJyj4d9kNWk3TySWde3CjgJEpkhIvY-xDn09g"

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$response = Invoke-RestMethod -Uri "https://api.music.apple.com/v1/catalog/us/search?term=Taylor+Swift&types=songs&limit=1" -Method Get -Headers $headers

Write-Host "Status: SUCCESS" -ForegroundColor Green
$response | ConvertTo-Json -Depth 10
```

## Method 4: Test in Your App 🚀

The easiest way is to test directly in your application:

1. **Open your app** where Apple Music authentication happens
2. **Try to authorize** with Apple Music
3. **Check the browser console** for errors
4. **Look for:**
   - ✅ No 403 errors → Token is working!
   - ❌ Still getting 403 → Check MusicKit identifier and Team ID

## Understanding the Results

### ✅ Success (200 OK)
```
Status: 200 OK
Response: { "results": { "songs": { "data": [...] } } }
```
**Meaning:** Your token is valid! The 403 error is fixed. 🎉

### ❌ 401 Unauthorized
```
Status: 401 Unauthorized
```
**Meaning:** Token format issue or expired. Check:
- Token is complete (not truncated)
- Token hasn't expired (check `exp` date in payload)

### ❌ 403 Forbidden
```
Status: 403 Forbidden
```
**Meaning:** Token is valid but rejected. Check:
1. **MusicKit Identifier** - Verify `media.com.vybr.musickit` exists and MusicKit is enabled
2. **Team ID** - Verify `R8UV449WRY` matches your Apple Developer account
3. **Key ID** - Verify `55272UR5Y5` exists in your Apple Developer Portal

### ❌ 404 Not Found
```
Status: 404 Not Found
```
**Meaning:** Endpoint issue, not token issue. Try a different endpoint.

## Quick Test Script

Save this as `test-token.sh` (or `test-token.ps1` for PowerShell):

```bash
#!/bin/bash
TOKEN="YOUR_TOKEN_HERE"

echo "Testing Apple Music Developer Token..."
echo ""

response=$(curl -s -w "\n%{http_code}" -X GET \
  "https://api.music.apple.com/v1/catalog/us/search?term=test&types=songs&limit=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "HTTP Status: $http_code"
echo ""

if [ "$http_code" -eq 200 ]; then
  echo "✅ SUCCESS! Token is valid!"
  echo "$body" | jq .
elif [ "$http_code" -eq 403 ]; then
  echo "❌ 403 Forbidden - Token rejected by Apple"
  echo "Check: MusicKit identifier, Team ID, or Key ID"
else
  echo "❌ Error: $http_code"
  echo "$body"
fi
```

## Next Steps

1. **Run one of the tests above** with your token
2. **Check the HTTP status code:**
   - 200 = ✅ Success! Token works!
   - 403 = ❌ Still an issue (check MusicKit identifier, Team ID)
   - 401 = ❌ Token format/expiry issue
3. **If still 403**, verify:
   - MusicKit identifier `media.com.vybr.musickit` exists and is enabled
   - Team ID `R8UV449WRY` matches your Apple Developer account
   - Key ID `55272UR5Y5` exists in Apple Developer Portal

