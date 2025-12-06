// Deno types - these are available at runtime, TypeScript just needs to know about them
// @ts-ignore - Deno is available in Edge Functions runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore - djwt is available in Deno runtime
import { create } from "https://deno.land/x/djwt@v2.8/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer'
}

// JWT generation for Apple Music Developer Token
// This requires: Team ID, Key ID, and Private Key from Apple Developer account

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // @ts-ignore - Deno.env is available in Edge Functions runtime
    const teamId = Deno.env.get('APPLE_MUSIC_TEAM_ID')
    // @ts-ignore - Deno.env is available in Edge Functions runtime
    const keyId = Deno.env.get('APPLE_MUSIC_KEY_ID')
    // @ts-ignore - Deno.env is available in Edge Functions runtime
    const rawPrivateKey = Deno.env.get('APPLE_MUSIC_PRIVATE_KEY')

    if (!teamId || !keyId || !rawPrivateKey) {
      throw new Error('Missing configuration: Check Team ID, Key ID, and Private Key secrets.')
    }

    // --- KEY CLEANING LOGIC ---
    // This handles:
    // 1. "Just the Body" (Base64 only) - preferred format, no headers needed
    // 2. "Full PEM" (with headers/footers) - also works
    // 3. Unbalanced/missing padding - auto-fixed
    console.log('[DEBUG] Raw private key info:', {
      length: rawPrivateKey.length,
      hasBeginHeader: rawPrivateKey.includes('-----BEGIN'),
      hasEndHeader: rawPrivateKey.includes('-----END'),
      firstChars: rawPrivateKey.substring(0, 30),
      lastChars: rawPrivateKey.substring(rawPrivateKey.length - 30)
    });
    
    // Remove PEM headers/footers if present (but they're optional - base64 only is fine)
    let keyBody = rawPrivateKey
      .replace(/-----BEGIN PRIVATE KEY-----/gi, '')
      .replace(/-----END PRIVATE KEY-----/gi, '')
      .replace(/-----BEGIN EC PRIVATE KEY-----/gi, '')
      .replace(/-----END EC PRIVATE KEY-----/gi, '')
      .replace(/\s+/g, '')  // Removes all spaces and newlines
      .replace(/\\n/g, '')  // Removes literal "\n" characters from Supabase secrets
      .trim(); // Remove any leading/trailing whitespace

    console.log('[DEBUG] After cleaning:', {
      length: keyBody.length,
      firstChars: keyBody.substring(0, 20),
      lastChars: keyBody.substring(keyBody.length - 20),
      isBase64: /^[A-Za-z0-9+/=]+$/.test(keyBody),
      note: 'Key should be base64 only (no BEGIN/END headers needed)'
    });
    
    // Validate it's base64
    if (!/^[A-Za-z0-9+/=]+$/.test(keyBody)) {
      throw new Error('Private key contains invalid characters. It should be base64 only (A-Z, a-z, 0-9, +, /, =). You can paste just the base64 content without the BEGIN/END headers.');
    }

    // Fix Base64 padding
    const originalLength = keyBody.length;
    while (keyBody.length % 4 !== 0) {
      keyBody += '=';
    }
    if (keyBody.length !== originalLength) {
      console.log('[DEBUG] Added padding:', keyBody.length - originalLength, 'characters');
    }

    // JWT header
    const header = {
      alg: 'ES256',
      kid: keyId
    }

    // JWT payload
    // Using current system time with a small backdate buffer to handle clock skew
    const now = Math.floor(Date.now() / 1000);
    const iat = now - 60; // Backdate by 60 seconds

    const payload = {
      iss: teamId,
      iat: iat,
      exp: now + (30 * 24 * 60 * 60) // Expires 30 days later
    }

    console.log(`[DEBUG] Token generation info:`);
    console.log(`[DEBUG] Team ID: ${teamId}`);
    console.log(`[DEBUG] Key ID: ${keyId}`);
    console.log(`[DEBUG] Key (clean) length: ${keyBody.length}`);
    console.log(`[DEBUG] Key (clean) prefix: ${keyBody.substring(0, 15)}...`);
    console.log(`[DEBUG] iat: ${iat} (${new Date(iat * 1000).toISOString()})`);
    console.log(`[DEBUG] exp: ${payload.exp} (${new Date(payload.exp * 1000).toISOString()})`);

    // Generate JWT
    // We pass the clean keyBody directly to the helper
    const jwt = await generateJWT(header, payload, keyBody)

    if (!jwt) {
      const errorMsg = `Failed to generate JWT token. This usually means:
1. The private key format is incorrect
2. The private key doesn't match Key ID: ${keyId}
3. The key is corrupted or incomplete

Please verify:
- APPLE_MUSIC_KEY_ID matches the Key ID from Apple Developer Portal
- APPLE_MUSIC_PRIVATE_KEY is the complete key (can be just the base64 body or full PEM)
- APPLE_MUSIC_TEAM_ID matches your Apple Team ID

Check the Supabase Edge Function logs for detailed error information.`;
      throw new Error(errorMsg);
    }

    // Validate token format
    const tokenParts = jwt.split('.');
    if (tokenParts.length !== 3) {
      throw new Error(`Generated token has invalid format. Expected 3 parts, got ${tokenParts.length}`);
    }

    console.log('[DEBUG] Token generated and validated successfully');
    console.log('[DEBUG] Token parts: header, payload, signature');
    console.log('[DEBUG] Token ready to use with Apple Music API');
    console.log('[DEBUG] ⚠️ IMPORTANT: If Apple returns 403 Forbidden, it means:');
    console.log('[DEBUG]   1. The private key does NOT match Key ID:', keyId);
    console.log('[DEBUG]   2. OR the MusicKit identifier is not registered/enabled');
    console.log('[DEBUG]   3. OR the Team ID does not match your Apple Developer account');
    console.log('[DEBUG]   → Check Supabase Edge Function logs for key import/signature test results');
    console.log('[DEBUG]   → Verify the .p8 file matches Key ID', keyId, 'in Apple Developer Portal');
    
    // Decode token for debug info (only in response, not in logs for security)
    let debugInfo = null;
    try {
      const tokenParts = jwt.split('.');
      if (tokenParts.length === 3) {
        const decodedHeader = JSON.parse(atob(tokenParts[0]));
        const decodedPayload = JSON.parse(atob(tokenParts[1]));
        debugInfo = {
          header: decodedHeader,
          payload: {
            iss: decodedPayload.iss,
            iat: decodedPayload.iat,
            exp: decodedPayload.exp,
            iatDate: new Date(decodedPayload.iat * 1000).toISOString(),
            expDate: new Date(decodedPayload.exp * 1000).toISOString()
          },
          keyInfo: {
            keyId: keyId,
            teamId: teamId,
            keyLength: keyBody.length
          }
        };
      }
    } catch (_e) {
      // Ignore decode errors for debug info
    }
    
    // Add diagnostic message about 403 errors
    const diagnosticMessage = {
      note: 'If you receive a 403 Forbidden error from Apple Music API, check these in order:',
      priority: [
        {
          issue: 'Private Key Mismatch (MOST COMMON)',
          description: 'The private key does not match Key ID ' + keyId,
          solution: [
            '1. Go to https://developer.apple.com/account/resources/authkeys/list',
            '2. Find the key with ID: ' + keyId,
            '3. If you don\'t have the .p8 file, you CANNOT download it again (Apple only allows one download)',
            '4. If you have the .p8 file, open it in a text editor',
            '5. Copy JUST the base64 content (the long string between the headers)',
            '   - You can skip the "-----BEGIN PRIVATE KEY-----" and "-----END PRIVATE KEY-----" lines',
            '   - Just copy the base64 string (A-Z, a-z, 0-9, +, /, = characters)',
            '6. Paste into Supabase secret: APPLE_MUSIC_PRIVATE_KEY',
            '7. Redeploy the Edge Function'
          ],
          warning: 'If you lost the .p8 file, you MUST create a new key in Apple Developer Portal',
          note: 'The code automatically handles keys with or without BEGIN/END headers, but base64-only is preferred'
        },
        {
          issue: 'MusicKit Identifier Not Registered',
          description: 'The identifier "media.com.vybr.musickit" may not be registered or enabled',
          solution: [
            '1. Go to https://developer.apple.com/account/resources/identifiers/list',
            '2. Search for "media.com.vybr.musickit"',
            '3. Verify it exists and MusicKit service is enabled',
            '4. If it doesn\'t exist, create a new MusicKit service identifier',
            '5. The identifier format should be: media.com.vybr.musickit'
          ]
        },
        {
          issue: 'Team ID Mismatch',
          description: 'Team ID ' + teamId + ' may not match your Apple Developer account',
          solution: [
            '1. Go to https://developer.apple.com/account',
            '2. Check your Team ID in the top right or membership section',
            '3. Verify it matches: ' + teamId,
            '4. Update APPLE_MUSIC_TEAM_ID in Supabase if different'
          ]
        },
        {
          issue: 'Domain Not Registered',
          description: 'The domain may need to be registered in Apple Developer Portal',
          solution: [
            '1. Check if your domain needs to be whitelisted',
            '2. Some MusicKit configurations require domain registration',
            '3. Check the MusicKit identifier configuration for domain requirements'
          ]
        }
      ],
      tokenInfo: {
        teamId: teamId,
        keyId: keyId,
        algorithm: 'ES256',
        tokenGenerated: true,
        signatureTestPassed: true
      }
    };
    
    return new Response(
      JSON.stringify({ 
        token: jwt,
        debug: debugInfo, // Include debug info in response for client-side logging
        diagnostics: diagnosticMessage // Include troubleshooting info
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    
    // Collect debug information for error response
    const errorDebug: {
      message: string;
      stack?: string;
      timestamp: string;
      config?: {
        hasTeamId: boolean;
        hasKeyId: boolean;
        hasPrivateKey: boolean;
        keyId: string;
        teamId: string;
        privateKeyLength: number;
      };
    } = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    };
    
    // Try to include configuration info (without sensitive data)
    try {
      const teamId = Deno.env.get('APPLE_MUSIC_TEAM_ID');
      const keyId = Deno.env.get('APPLE_MUSIC_KEY_ID');
      const rawPrivateKey = Deno.env.get('APPLE_MUSIC_PRIVATE_KEY');
      
      errorDebug.config = {
        hasTeamId: !!teamId,
        hasKeyId: !!keyId,
        hasPrivateKey: !!rawPrivateKey,
        keyId: keyId || 'NOT SET',
        teamId: teamId || 'NOT SET',
        privateKeyLength: rawPrivateKey ? rawPrivateKey.length : 0
      };
    } catch (_e) {
      // Ignore errors getting config
    }
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        debug: errorDebug
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Helper function to generate JWT token using djwt library
async function generateJWT(header: { alg: string; kid: string }, payload: { iss: string; iat: number; exp: number }, cleanKeyBody: string): Promise<string | null> {
  try {
    console.log('[DEBUG] Starting JWT generation...');
    console.log('[DEBUG] Key body length:', cleanKeyBody.length);
    console.log('[DEBUG] Key body first 20 chars:', cleanKeyBody.substring(0, 20));
    
    // 1. Decode base64 to get the key bytes
    let binaryString: string;
    let keyBuffer: Uint8Array;
    
    try {
      binaryString = atob(cleanKeyBody);
      keyBuffer = Uint8Array.from(binaryString, c => c.charCodeAt(0));
      console.log('[DEBUG] Key decoded successfully. Buffer length:', keyBuffer.length);
      console.log('[DEBUG] First 10 bytes (hex):', Array.from(keyBuffer.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    } catch (decodeError) {
      console.error('[DEBUG] Base64 decode error:', decodeError);
      throw new Error(`Failed to decode base64 key: ${decodeError instanceof Error ? decodeError.message : 'Unknown error'}`);
    }
    
    // 2. Validate key format before importing
    // PKCS#8 private keys should start with specific ASN.1 sequence bytes
    // For EC private keys, the first byte is typically 0x30 (SEQUENCE)
    if (keyBuffer.length < 50) {
      throw new Error(`Private key appears too short (${keyBuffer.length} bytes). Expected at least 50 bytes for a valid EC private key.`);
    }
    
    const firstByte = keyBuffer[0];
    const secondByte = keyBuffer[1];
    console.log('[DEBUG] Key format check:', {
      firstByte: `0x${firstByte.toString(16).padStart(2, '0')}`,
      secondByte: `0x${secondByte.toString(16).padStart(2, '0')}`,
      expectedFirstByte: '0x30 (SEQUENCE)',
      keyLength: keyBuffer.length
    });
    
    // PKCS#8 keys should start with 0x30 (SEQUENCE tag)
    if (firstByte !== 0x30) {
      console.warn('[DEBUG] ⚠️ Key may not be in PKCS#8 format. First byte is', `0x${firstByte.toString(16)}`, 'expected 0x30');
      console.warn('[DEBUG] This might indicate the key is in a different format (e.g., SEC1) or corrupted.');
    }
    
    // 3. Import the key
    // Create a new ArrayBuffer to ensure proper type
    const keyArrayBuffer = new Uint8Array(keyBuffer).buffer;
    
    let cryptoKey: CryptoKey;
    try {
      cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        keyArrayBuffer,
        {
          name: 'ECDSA',
          namedCurve: 'P-256'
        },
        false,
        ['sign']
      );
      console.log('[DEBUG] Key imported successfully');
      
      // Get key algorithm details
      const keyAlgorithm = cryptoKey.algorithm as EcKeyAlgorithm;
      console.log('[DEBUG] Imported key details:', {
        name: keyAlgorithm.name,
        namedCurve: keyAlgorithm.namedCurve,
        extractable: cryptoKey.extractable,
        usages: cryptoKey.usages
      });
    } catch (importError) {
      console.error('[DEBUG] Key import error:', importError);
      console.error('[DEBUG] Key import error details:', {
        message: importError instanceof Error ? importError.message : 'Unknown',
        name: importError instanceof Error ? importError.name : 'Unknown',
        stack: importError instanceof Error ? importError.stack : undefined
      });
      
      // Provide more specific error messages
      const errorMsg = importError instanceof Error ? importError.message : 'Unknown error';
      if (errorMsg.includes('not a valid key') || errorMsg.includes('Invalid key')) {
        throw new Error(`Private key format is invalid. The key may be corrupted, in the wrong format, or doesn't match Key ID ${header.kid}. Please verify:\n1. The key file downloaded from Apple Developer Portal\n2. The Key ID matches the key file\n3. The entire key (including headers) was copied to Supabase`);
      } else if (errorMsg.includes('not supported') || errorMsg.includes('unsupported')) {
        throw new Error(`Key format not supported. Expected PKCS#8 format EC private key for ES256. Error: ${errorMsg}`);
      } else {
        throw new Error(`Failed to import private key. This usually means:\n1. The key format is incorrect\n2. The key doesn't match Key ID: ${header.kid}\n3. The key is corrupted or incomplete\n\nError: ${errorMsg}`);
      }
    }
    
    // 4. Test that the key can sign data (verify key is valid)
    try {
      const testData = new TextEncoder().encode('test-signature-verification');
      const signature = await crypto.subtle.sign(
        {
          name: 'ECDSA',
          hash: 'SHA-256'
        },
        cryptoKey,
        testData
      );
      console.log('[DEBUG] Key signature test passed. Signature length:', signature.byteLength);
      if (signature.byteLength !== 64) {
        console.warn('[DEBUG] ⚠️ Signature length is not 64 bytes (expected for ES256). Got:', signature.byteLength);
      }
    } catch (signTestError) {
      console.error('[DEBUG] Key signature test failed:', signTestError);
      throw new Error(`Private key cannot sign data. This indicates the key is invalid or corrupted. Error: ${signTestError instanceof Error ? signTestError.message : 'Unknown error'}`);
    }
    
    // 4. Create JWT
    let token: string;
    try {
      token = await create(
        { alg: header.alg, typ: 'JWT', kid: header.kid },
        payload,
        cryptoKey
      );
      console.log('[DEBUG] JWT created successfully');
      console.log('[DEBUG] JWT length:', token.length);
      console.log('[DEBUG] JWT preview (first 50 chars):', token.substring(0, 50) + '...');
      
      // Decode and validate the token
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        try {
          const decodedHeader = JSON.parse(atob(tokenParts[0]));
          const decodedPayload = JSON.parse(atob(tokenParts[1]));
          const signaturePart = tokenParts[2];
          
          console.log('[DEBUG] Decoded JWT header:', decodedHeader);
          console.log('[DEBUG] Decoded JWT payload:', {
            iss: decodedPayload.iss,
            iat: decodedPayload.iat,
            exp: decodedPayload.exp,
            iatDate: new Date(decodedPayload.iat * 1000).toISOString(),
            expDate: new Date(decodedPayload.exp * 1000).toISOString()
          });
          console.log('[DEBUG] JWT signature length:', signaturePart.length, 'characters');
          
          // Verify header contains required fields
          if (decodedHeader.alg !== 'ES256') {
            throw new Error(`Invalid algorithm in JWT header. Expected ES256, got ${decodedHeader.alg}`);
          }
          if (decodedHeader.kid !== header.kid) {
            throw new Error(`Key ID mismatch. Expected ${header.kid}, got ${decodedHeader.kid}`);
          }
          if (decodedHeader.typ !== 'JWT') {
            throw new Error(`Invalid type in JWT header. Expected JWT, got ${decodedHeader.typ}`);
          }
          
          // Verify payload contains required fields
          if (decodedPayload.iss !== payload.iss) {
            throw new Error(`Team ID mismatch. Expected ${payload.iss}, got ${decodedPayload.iss}`);
          }
          if (decodedPayload.iat !== payload.iat) {
            console.warn('[DEBUG] ⚠️ iat mismatch. Expected:', payload.iat, 'Got:', decodedPayload.iat);
          }
          if (decodedPayload.exp !== payload.exp) {
            console.warn('[DEBUG] ⚠️ exp mismatch. Expected:', payload.exp, 'Got:', decodedPayload.exp);
          }
          
          console.log('[DEBUG] ✓ JWT structure validation passed');
        } catch (e) {
          console.warn('[DEBUG] Could not decode JWT for validation:', e);
          throw e; // Re-throw if it's a validation error
        }
      } else {
        throw new Error(`Invalid JWT format. Expected 3 parts, got ${tokenParts.length}`);
      }
      
      return token;
    } catch (createError) {
      console.error('[DEBUG] JWT creation error:', createError);
      throw new Error(`Failed to create JWT: ${createError instanceof Error ? createError.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error('[DEBUG] JWT generation error:', error);
    console.error('[DEBUG] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return null
  }
}

// // Deno types - these are available at runtime, TypeScript just needs to know about them
// // @ts-ignore - Deno is available in Edge Functions runtime
// import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// // @ts-ignore - djwt is available in Deno runtime
// import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts"

// const corsHeaders = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Methods': 'POST, OPTIONS',
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer'
// }

// // JWT generation for Apple Music Developer Token
// // This requires: Team ID, Key ID, and Private Key from Apple Developer account

// serve(async (req) => {
//   // Handle CORS
//   if (req.method === 'OPTIONS') {
//     return new Response('ok', { headers: corsHeaders })
//   }

//   try {
//     // Fetch Apple Music credentials from environment variables (set in Supabase Dashboard)
//     // These are set as secrets in the Edge Function configuration
//     // @ts-ignore - Deno.env is available in Edge Functions runtime
//     const teamId = Deno.env.get('APPLE_MUSIC_TEAM_ID')
//     // @ts-ignore - Deno.env is available in Edge Functions runtime
//     const keyId = Deno.env.get('APPLE_MUSIC_KEY_ID')
//     // @ts-ignore - Deno.env is available in Edge Functions runtime
//     const privateKey = Deno.env.get('APPLE_MUSIC_PRIVATE_KEY')

//     if (!teamId) {
//       console.error('Error: APPLE_MUSIC_TEAM_ID not configured')
//       return new Response(
//         JSON.stringify({ error: 'Apple Music Team ID not configured. Please set APPLE_MUSIC_TEAM_ID as a secret in Edge Function settings.' }),
//         { 
//           status: 500,
//           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//         }
//       )
//     }

//     if (!keyId) {
//       console.error('Error: APPLE_MUSIC_KEY_ID not configured')
//       return new Response(
//         JSON.stringify({ error: 'Apple Music Key ID not configured. Please set APPLE_MUSIC_KEY_ID as a secret in Edge Function settings.' }),
//         { 
//           status: 500,
//           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//         }
//       )
//     }

//     if (!privateKey) {
//       console.error('Error: APPLE_MUSIC_PRIVATE_KEY not configured')
//       return new Response(
//         JSON.stringify({ error: 'Apple Music Private Key not configured. Please set APPLE_MUSIC_PRIVATE_KEY as a secret in Edge Function settings.' }),
//         { 
//           status: 500,
//           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//         }
//       )
//     }

//     // Generate JWT token for Apple Music API
//     // JWT header
//     const header = {
//       alg: 'ES256',
//       kid: keyId
//     }

//     // JWT payload
//     const now = getNumericDate(new Date())
//     const payload = {
//       iss: teamId,
//       iat: now,
//       exp: now + (6 * 30 * 24 * 60 * 60) // 6 months
//     }

//     // Generate JWT token using djwt library
//     const jwt = await generateJWT(header, payload, privateKey)

//     if (!jwt) {
//       return new Response(
//         JSON.stringify({ error: 'Failed to generate JWT token' }),
//         { 
//           status: 500,
//           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//         }
//       )
//     }

//     console.log('Apple Music developer token generated successfully')
    
//     return new Response(
//       JSON.stringify({ token: jwt }),
//       { 
//         status: 200,
//         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//       }
//     )

//   } catch (error) {
//     console.error('Function error:', error)
//     return new Response(
//       JSON.stringify({ error: error.message }),
//       { 
//         status: 500,
//         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//       }
//     )
//   }
// })

// // Helper function to generate JWT token using djwt library
// async function generateJWT(header: any, payload: any, privateKey: string): Promise<string | null> {
//   try {
//     // Parse the PEM private key
//     // Remove headers and whitespace
//     const keyData = privateKey
//       .replace(/-----BEGIN PRIVATE KEY-----/, '')
//       .replace(/-----END PRIVATE KEY-----/, '')
//       .replace(/\s/g, '')
    
//     // Decode base64 to get the key bytes
//     const keyBuffer = Uint8Array.from(atob(keyData), c => c.charCodeAt(0))
    
//     // Import the key for ECDSA signing with P-256 curve
//     const cryptoKey = await crypto.subtle.importKey(
//       'pkcs8',
//       keyBuffer.buffer,
//       {
//         name: 'ECDSA',
//         namedCurve: 'P-256'
//       },
//       false,
//       ['sign']
//     )
    
//     // Create JWT token with djwt
//     // djwt expects the header to include 'alg' and 'typ', and optionally 'kid'
//     const token = await create(
//       { 
//         alg: header.alg, 
//         typ: 'JWT',
//         kid: header.kid 
//       },
//       payload,
//       cryptoKey
//     )
    
//     return token
//   } catch (error) {
//     console.error('JWT generation error:', error)
//     console.error('Error details:', error.message, error.stack)
//     return null
//   }
// }
