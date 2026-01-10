import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer'
};

interface NotificationPayload {
  user_id: string;
  notification_id: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  image_url?: string;
  deep_link?: string;
}

interface PushMessage {
  to: string;
  sound: string;
  title: string;
  body: string;
  data?: any;
  priority?: string;
  channelId?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { notification_id, user_id, type, title, body, data, image_url, deep_link } = await req.json() as NotificationPayload;

    console.log('Processing push notification:', { notification_id, user_id, type, title });

    // Get user's push tokens
    const { data: pushTokens, error: tokensError } = await supabaseClient
      .from('user_push_tokens')
      .select('push_token, platform')
      .eq('user_id', user_id);

    if (tokensError) {
      console.error('Error fetching push tokens:', tokensError);
      return new Response(JSON.stringify({ error: 'Failed to fetch push tokens' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pushTokens || pushTokens.length === 0) {
      console.log('No push tokens found for user:', user_id);
      // Still mark as sent since there are no tokens
      await supabaseClient
        .from('notifications')
        .update({
          push_sent: true,
          push_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', notification_id);
      
      return new Response(JSON.stringify({ message: 'No push tokens found', sent: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check user's notification preferences
    const { data: preferences, error: prefError } = await supabaseClient
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (prefError && prefError.code !== 'PGRST116') {
      console.error('Error fetching notification preferences:', prefError);
    }

    // Check if push notifications are enabled for this type
    const pushEnabled = preferences?.push_enabled !== false;
    let typeEnabled = true;

    if (preferences) {
      switch (type) {
        case 'new_message':
        case 'new_group_message':
          typeEnabled = preferences.push_new_messages !== false;
          break;
        case 'new_match':
          typeEnabled = preferences.push_new_matches !== false;
          break;
        case 'event_alert':
        case 'booking_confirmation':
          typeEnabled = preferences.push_event_alerts !== false;
          break;
        case 'system_alert':
          typeEnabled = preferences.push_system_alerts !== false;
          break;
        case 'friend_request':
        case 'friend_accept':
          typeEnabled = preferences.push_new_matches !== false; // Use same preference as matches for now
          break;
      }
    }

    if (!pushEnabled || !typeEnabled) {
      console.log('Push notifications disabled for user or type:', { user_id, type, pushEnabled, typeEnabled });
      // Mark as sent even though we're not sending (user preference)
      await supabaseClient
        .from('notifications')
        .update({
          push_sent: true,
          push_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', notification_id);
      
      return new Response(JSON.stringify({ message: 'Push notifications disabled', sent: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check quiet hours
    if (preferences?.quiet_hours_enabled) {
      const now = new Date();
      const timezone = preferences.quiet_hours_timezone || 'UTC';
      const currentTime = now.toLocaleTimeString('en-US', { 
        timeZone: timezone, 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const quietStart = preferences.quiet_hours_start || '22:00';
      const quietEnd = preferences.quiet_hours_end || '08:00';
      
      // Simple quiet hours check (doesn't handle cross-midnight properly for all cases)
      if (quietStart > quietEnd) {
        // Quiet hours cross midnight
        if (currentTime >= quietStart || currentTime <= quietEnd) {
          console.log('Skipping notification due to quiet hours:', { currentTime, quietStart, quietEnd });
          // Mark as sent even though we're not sending (quiet hours)
          await supabaseClient
            .from('notifications')
            .update({
              push_sent: true,
              push_sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', notification_id);
          
          return new Response(JSON.stringify({ message: 'Quiet hours active', sent: false }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        // Quiet hours within same day
        if (currentTime >= quietStart && currentTime <= quietEnd) {
          console.log('Skipping notification due to quiet hours:', { currentTime, quietStart, quietEnd });
          // Mark as sent even though we're not sending (quiet hours)
          await supabaseClient
            .from('notifications')
            .update({
              push_sent: true,
              push_sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', notification_id);
          
          return new Response(JSON.stringify({ message: 'Quiet hours active', sent: false }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Prepare push messages
    const pushMessages: PushMessage[] = pushTokens.map(token => ({
      to: token.push_token,
      sound: 'default',
      title: title,
      body: body,
      data: {
        ...data,
        notification_id,
        deep_link,
        type,
      },
      priority: 'high',
      channelId: 'default',
    }));

    // Send to Expo Push API
    const expoPushUrl = 'https://exp.host/--/api/v2/push/send';
    const expoPushPromises = pushMessages.map(async (message) => {
      try {
        const response = await fetch(expoPushUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });

        const result = await response.json();
        console.log('Expo push result:', result);
        return { success: true, result };
      } catch (error) {
        console.error('Error sending push notification:', error);
        return { success: false, error: error.message };
      }
    });

    const results = await Promise.all(expoPushPromises);
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    // Update notification status
    const { error: updateError } = await supabaseClient
      .from('notifications')
      .update({
        push_sent: successCount > 0,
        push_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', notification_id);

    if (updateError) {
      console.error('Error updating notification status:', updateError);
    }

    console.log(`Push notifications sent: ${successCount}/${totalCount}`);

    return new Response(JSON.stringify({
      message: `Push notifications sent: ${successCount}/${totalCount}`,
      sent: successCount > 0,
      results: results,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-push-notifications:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

