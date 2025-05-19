// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // IMPORTANT: For production, replace * with your app's domain
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
} 