// Apple Music Client Secret Generator
// Run this script to generate your Apple Music client secret

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Your Apple Music credentials
const TEAM_ID = 'R8UV449WRY';
const KEY_ID = 'UJY8ZUMU4D';
const PRIVATE_KEY_PATH = path.join(__dirname, 'AuthKey_UJY8ZUMU4D.p8');

try {
  // Read the private key
  const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
  
  // Generate JWT client secret
  const clientSecret = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: '180d', // 6 months
    issuer: TEAM_ID,
    header: {
      alg: 'ES256',
      kid: KEY_ID
    }
  });
  
  console.log('🍎 Apple Music Client Secret Generated:');
  console.log('=====================================');
  console.log(clientSecret);
  console.log('=====================================');
  console.log('');
  console.log('📝 Add this to your environment variables:');
  console.log('APPLE_MUSIC_CLIENT_SECRET=' + clientSecret);
  console.log('');
  console.log('🌐 For development, you can use ngrok:');
  console.log('1. Install ngrok: npm install -g ngrok');
  console.log('2. Run: ngrok http 19006');
  console.log('3. Use the ngrok URL as your redirect URI');
  
} catch (error) {
  console.error('❌ Error generating client secret:', error.message);
  console.log('');
  console.log('🔧 Make sure:');
  console.log('1. The AuthKey_UJY8ZUMU4D.p8 file is in the project root');
  console.log('2. You have the jsonwebtoken package installed: npm install jsonwebtoken');
}


