import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
};

const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const BATCH_SIZE = 300; // Expo allows up to 1000 per request; keep conservative

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Find notifications sent in the last 24h that have ticket IDs stored in data._ticket_ids.
    // Expo clears receipts after 24h, so older ones are irrelevant.
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const minAge = new Date(Date.now() - 15 * 60 * 1000).toISOString(); // at least 15 min old

    const { data: notifications, error: fetchError } = await supabaseClient
      .from('notifications')
      .select('id, user_id, data')
      .eq('push_sent', true)
      .gte('push_sent_at', cutoff)
      .lte('push_sent_at', minAge)
      .not('data->_ticket_ids', 'is', null)
      .limit(500);

    if (fetchError) {
      console.error('Error fetching notifications for receipt check:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!notifications || notifications.length === 0) {
      return new Response(JSON.stringify({ message: 'No notifications to check', checked: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Collect all ticket IDs with a back-reference to their notification + user
    const ticketMap: Map<string, { notificationId: string; userId: string }> = new Map();
    for (const n of notifications) {
      const ids: string[] = n.data?._ticket_ids ?? [];
      for (const tid of ids) {
        if (tid) ticketMap.set(tid, { notificationId: n.id, userId: n.user_id });
      }
    }

    const allTicketIds = Array.from(ticketMap.keys());
    if (allTicketIds.length === 0) {
      return new Response(JSON.stringify({ message: 'No ticket IDs to check', checked: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Checking ${allTicketIds.length} push receipts...`);

    let totalOk = 0;
    let totalError = 0;
    const staleTokenUserIds: Set<string> = new Set();
    const checkedNotificationIds: Set<string> = new Set();

    // Process in batches
    for (let i = 0; i < allTicketIds.length; i += BATCH_SIZE) {
      const batch = allTicketIds.slice(i, i + BATCH_SIZE);

      try {
        const res = await fetch(EXPO_RECEIPTS_URL, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ids: batch }),
        });

        if (!res.ok) {
          console.error(`Expo receipts API returned ${res.status}`);
          continue;
        }

        const body = await res.json();
        const receipts = body.data ?? {};

        for (const [ticketId, receipt] of Object.entries(receipts) as [string, any][]) {
          const ref = ticketMap.get(ticketId);
          if (!ref) continue;

          checkedNotificationIds.add(ref.notificationId);

          if (receipt.status === 'ok') {
            totalOk++;
          } else if (receipt.status === 'error') {
            totalError++;
            console.warn(`Receipt error for ticket ${ticketId}:`, receipt.message, receipt.details);

            if (receipt.details?.error === 'DeviceNotRegistered') {
              staleTokenUserIds.add(ref.userId);
            }
          }
        }
      } catch (batchError) {
        console.error('Error fetching receipt batch:', batchError);
      }
    }

    // Remove stale tokens for users whose devices are no longer registered
    if (staleTokenUserIds.size > 0) {
      console.log(`Removing stale push tokens for ${staleTokenUserIds.size} user(s)`);
      for (const userId of staleTokenUserIds) {
        const { error: delError } = await supabaseClient
          .from('user_push_tokens')
          .delete()
          .eq('user_id', userId);

        if (delError) {
          console.error(`Failed to delete stale tokens for user ${userId}:`, delError);
        }
      }
    }

    // Clear _ticket_ids from checked notifications so they aren't re-processed
    for (const nid of checkedNotificationIds) {
      const notif = notifications.find(n => n.id === nid);
      if (!notif) continue;
      const cleanedData = { ...(notif.data || {}) };
      delete cleanedData._ticket_ids;

      await supabaseClient
        .from('notifications')
        .update({ data: cleanedData, updated_at: new Date().toISOString() })
        .eq('id', nid);
    }

    const summary = {
      message: 'Receipt check complete',
      checked: allTicketIds.length,
      ok: totalOk,
      errors: totalError,
      staleTokensRemoved: staleTokenUserIds.size,
    };
    console.log('Receipt check summary:', summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in check-push-receipts:', error);
    return new Response(JSON.stringify({ error: (error as any).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
