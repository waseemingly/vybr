import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer'
};

interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: any;
  image_url?: string;
  deep_link?: string;
  push_sent: boolean;
  web_delivered: boolean;
  created_at: string;
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

    console.log('Processing notification queue...');

    // Get pending notifications (not sent via push yet)
    const { data: pendingNotifications, error: fetchError } = await supabaseClient
      .from('notifications')
      .select('*')
      .eq('push_sent', false)
      .order('created_at', { ascending: true })
      .limit(50); // Process in batches

    if (fetchError) {
      console.error('Error fetching pending notifications:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch notifications' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      console.log('No pending notifications found');
      return new Response(JSON.stringify({ message: 'No pending notifications', processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${pendingNotifications.length} pending notifications`);

    // Process each notification
    const processPromises = pendingNotifications.map(async (notification: NotificationRecord) => {
      try {
        // Call the push notification function
        const pushResponse = await supabaseClient.functions.invoke('send-push-notifications', {
          body: {
            notification_id: notification.id,
            user_id: notification.user_id,
            type: notification.type,
            title: notification.title,
            body: notification.body,
            data: notification.data,
            image_url: notification.image_url,
            deep_link: notification.deep_link,
          },
        });

        if (pushResponse.error) {
          console.error('Error sending push notification:', pushResponse.error);
          return { success: false, notification_id: notification.id, error: pushResponse.error };
        }

        // Send real-time notification for web clients
        const recipientChannel = `user:${notification.user_id}`;
        await supabaseClient
          .channel(recipientChannel)
          .send({
            type: 'broadcast',
            event: 'new_notification',
            payload: {
              user_id: notification.user_id,
              notification_id: notification.id,
              type: notification.type,
              title: notification.title,
              body: notification.body,
              data: notification.data,
              image_url: notification.image_url,
              deep_link: notification.deep_link,
              created_at: notification.created_at,
            },
          });

        // Mark as web delivered
        await supabaseClient
          .from('notifications')
          .update({
            web_delivered: true,
            web_delivered_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', notification.id);

        console.log(`Processed notification ${notification.id} for user ${notification.user_id}`);
        return { success: true, notification_id: notification.id };

      } catch (error) {
        console.error(`Error processing notification ${notification.id}:`, error);
        return { success: false, notification_id: notification.id, error: error.message };
      }
    });

    const results = await Promise.all(processPromises);
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    console.log(`Processed ${successCount}/${totalCount} notifications`);

    // Clean up old notifications (call cleanup function if it exists)
    try {
      await supabaseClient.rpc('cleanup_old_notifications');
    } catch (cleanupError) {
      console.warn('Error cleaning up old notifications:', cleanupError);
    }

    return new Response(JSON.stringify({
      message: `Processed ${successCount}/${totalCount} notifications`,
      processed: successCount,
      total: totalCount,
      results: results,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-notification-queue:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

