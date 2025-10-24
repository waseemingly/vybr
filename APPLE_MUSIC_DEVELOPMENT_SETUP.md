# 🍎 Apple Music Development Setup

## ✅ **What We've Completed:**
1. ✅ Installed `jsonwebtoken` dependency
2. ✅ Generated Apple Music client secret (JWT)
3. ✅ Created configuration files

## 🔧 **Next Steps for Development:**

### **Option 1: Use ngrok (Recommended)**
```bash
# 1. Sign up for ngrok (free): https://dashboard.ngrok.com/signup
# 2. Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken
# 3. Configure ngrok:
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE

# 4. Start ngrok:
ngrok http 19006

# 5. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
```

### **Option 2: Use Cloudflare Tunnel (Free Alternative)**
```bash
# Install cloudflared
npm install -g cloudflared

# Start tunnel
cloudflared tunnel --url http://localhost:19006
```

### **Option 3: Use Your Own Domain**
If you have a domain, you can use:
```
APPLE_MUSIC_REDIRECT_URI=https://yourdomain.com/apple-music-callback
```

## 📝 **Environment Variables Setup:**

Create a `.env.local` file in your project root:
```bash
APPLE_MUSIC_CLIENT_ID=com.vybr.musickit.oauth
APPLE_MUSIC_CLIENT_SECRET=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlVKWThaVU1VNEQifQ.eyJpYXQiOjE3NjExOTY0MTgsImV4cCI6MTc3Njc0ODQxOCwiaXNzIjoiUjhVVjQ0OVdSWSJ9.QLrZ5zyEMQ9R-o825RMtaf2aiK811s6c7bfSnKdYWTM9ns_vpOUQ1LiGPzE2u-R_R2eB8qVpImwASdtAsuS8fQ
APPLE_MUSIC_REDIRECT_URI=https://your-tunnel-url.ngrok.io/apple-music-callback
```

## 🍎 **Apple Developer Console Configuration:**

1. Go to your Services ID: `com.vybr.musickit.oauth`
2. Click "Configure" under "Sign in with Apple"
3. **Domains and Subdomains:** `ngrok.io` (or your domain)
4. **Return URLs:** `https://your-tunnel-url.ngrok.io/apple-music-callback`

## 🚀 **Testing the Flow:**

1. Start your app: `npm start`
2. Start your tunnel (ngrok/cloudflared)
3. Update the redirect URI in your environment
4. Test the signup flow
5. Select "Apple Music" - should redirect to Apple's login

## 🔍 **Troubleshooting:**

- **"Invalid redirect URI"**: Make sure the URL in Apple Developer Console matches exactly
- **"Authentication failed"**: Check your client secret (JWT) is correct
- **"Domain not allowed"**: Use HTTPS and a public domain (not localhost)

## 📋 **Current Status:**
- ✅ Apple Music auth hook created
- ✅ Database schema updated
- ✅ Signup flow integrated
- ✅ Client secret generated
- ⏳ Need tunnel setup for testing


