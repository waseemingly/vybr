// Deno types - these are available at runtime, TypeScript just needs to know about them
// @ts-ignore - Deno is available in Edge Functions runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore - djwt is available in Deno runtime
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts"

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
    // Fetch Apple Music credentials from environment variables (set in Supabase Dashboard)
    // These are set as secrets in the Edge Function configuration
    // @ts-ignore - Deno.env is available in Edge Functions runtime
    const teamId = Deno.env.get('APPLE_MUSIC_TEAM_ID')
    // @ts-ignore - Deno.env is available in Edge Functions runtime
    const keyId = Deno.env.get('APPLE_MUSIC_KEY_ID')
    // @ts-ignore - Deno.env is available in Edge Functions runtime
    const privateKey = Deno.env.get('APPLE_MUSIC_PRIVATE_KEY')

    if (!teamId) {
      console.error('Error: APPLE_MUSIC_TEAM_ID not configured')
      return new Response(
        JSON.stringify({ error: 'Apple Music Team ID not configured. Please set APPLE_MUSIC_TEAM_ID as a secret in Edge Function settings.' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!keyId) {
      console.error('Error: APPLE_MUSIC_KEY_ID not configured')
      return new Response(
        JSON.stringify({ error: 'Apple Music Key ID not configured. Please set APPLE_MUSIC_KEY_ID as a secret in Edge Function settings.' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!privateKey) {
      console.error('Error: APPLE_MUSIC_PRIVATE_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Apple Music Private Key not configured. Please set APPLE_MUSIC_PRIVATE_KEY as a secret in Edge Function settings.' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Generate JWT token for Apple Music API
    // JWT header
    const header = {
      alg: 'ES256',
      kid: keyId
    }

    // JWT payload
    const now = getNumericDate(new Date())
    const payload = {
      iss: teamId,
      iat: now,
      exp: now + (6 * 30 * 24 * 60 * 60) // 6 months
    }

    // Generate JWT token using djwt library
    const jwt = await generateJWT(header, payload, privateKey)

    if (!jwt) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate JWT token' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Apple Music developer token generated successfully')
    
    return new Response(
      JSON.stringify({ token: jwt }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Helper function to generate JWT token using djwt library
async function generateJWT(header: any, payload: any, privateKey: string): Promise<string | null> {
  try {
    // Parse the PEM private key
    // Remove headers and whitespace
    const keyData = privateKey
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '')
    
    // Decode base64 to get the key bytes
    const keyBuffer = Uint8Array.from(atob(keyData), c => c.charCodeAt(0))
    
    // Import the key for ECDSA signing with P-256 curve
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      keyBuffer.buffer,
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      false,
      ['sign']
    )
    
    // Create JWT token with djwt
    // djwt expects the header to include 'alg' and 'typ', and optionally 'kid'
    const token = await create(
      { 
        alg: header.alg, 
        typ: 'JWT',
        kid: header.kid 
      },
      payload,
      cryptoKey
    )
    
    return token
  } catch (error) {
    console.error('JWT generation error:', error)
    console.error('Error details:', error.message, error.stack)
    return null
  }
}
