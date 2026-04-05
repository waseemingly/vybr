import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing authorization' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID')
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    console.error('[spotify-token-exchange] SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET not set')
    return new Response(JSON.stringify({ ok: false, error: 'Spotify is not configured on the server' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: {
    grant_type?: string
    code?: string
    redirect_uri?: string
    refresh_token?: string
  }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON body' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const grantType = body.grant_type
  const params = new URLSearchParams()
  params.append('client_id', clientId)
  params.append('client_secret', clientSecret)

  if (grantType === 'authorization_code') {
    if (!body.code || !body.redirect_uri) {
      return new Response(JSON.stringify({ ok: false, error: 'code and redirect_uri required' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    params.append('grant_type', 'authorization_code')
    params.append('code', body.code)
    params.append('redirect_uri', body.redirect_uri)
  } else if (grantType === 'refresh_token') {
    if (!body.refresh_token) {
      return new Response(JSON.stringify({ ok: false, error: 'refresh_token required' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    params.append('grant_type', 'refresh_token')
    params.append('refresh_token', body.refresh_token)
  } else {
    return new Response(JSON.stringify({ ok: false, error: 'Unsupported grant_type' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let spotifyRes: Response
  try {
    spotifyRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
  } catch (e) {
    console.error('[spotify-token-exchange] fetch error:', e)
    return new Response(JSON.stringify({ ok: false, error: 'Failed to reach Spotify' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const rawText = await spotifyRes.text()
  let spotifyJson: Record<string, unknown>
  try {
    spotifyJson = JSON.parse(rawText) as Record<string, unknown>
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid Spotify response', details: rawText.slice(0, 500) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!spotifyRes.ok) {
    const desc = typeof spotifyJson.error_description === 'string'
      ? spotifyJson.error_description
      : typeof spotifyJson.error === 'string'
      ? spotifyJson.error
      : 'Spotify token request failed'
    return new Response(JSON.stringify({ ok: false, error: desc, details: spotifyJson }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, ...spotifyJson }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
