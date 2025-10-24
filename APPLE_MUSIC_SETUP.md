# Apple Music OAuth Setup Guide

## 🚀 **Quick Setup for Development**

### **Step 1: Install Dependencies**
```bash
npm install jsonwebtoken
```

### **Step 2: Generate Client Secret**
```bash
# Copy your .p8 file to the project root
cp ~/Downloads/AuthKey_UJY8ZUMU4D.p8 ./

# Generate the client secret
npm run generate-apple-secret
```

### **Step 3: Set Up ngrok for Development**
```bash
# Install ngrok
npm install -g ngrok

# Start your app
npm start

# In another terminal, start ngrok
ngrok http 19006
```

### **Step 4: Configure Apple Developer Console**

**Domains and Subdomains:**
```
ngrok.io
```

**Return URLs:**
```
https://your-ngrok-url.ngrok.io/apple-music-callback
```

### **Step 5: Update Environment Variables**

Create a `.env.local` file:
```bash
APPLE_MUSIC_CLIENT_ID=com.vybr.musickit.oauth
APPLE_MUSIC_CLIENT_SECRET=your_generated_jwt_token_here
APPLE_MUSIC_REDIRECT_URI=https://your-ngrok-url.ngrok.io/apple-music-callback
```

### **Step 6: Test the OAuth Flow**

1. Start your app with ngrok
2. Go through signup
3. Select "Apple Music"
4. Should redirect to Apple's login page

## 🔧 **Production Setup**

For production, use your actual domain:
```
APPLE_MUSIC_REDIRECT_URI=https://yourdomain.com/apple-music-callback
```

## 📝 **Important Notes**

- Apple requires HTTPS for OAuth
- localhost is not allowed
- Use ngrok for development
- Client secret is a JWT token, not a simple string
- The JWT expires in 6 months, so you'll need to regenerate it


