import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Stripe SDK only for subscriptions.retrieve(); meter events sent via fetch to avoid Deno.core.runMicrotasks()
import Stripe from 'https://esm.sh/stripe@14.12.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// --- Environment Variables ---
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const IMPRESSION_METER_EVENT_NAME = Deno.env.get('STRIPE_IMPRESSION_METER_EVENT_NAME') || 'impression_usage';

if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  const missing = [
    "STRIPE_SECRET_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY"
  ].filter((k) => !Deno.env.get(k)).join(", ");
  console.error(`[ConfigError-RMI] CRITICAL: Missing env vars: ${missing}.`);
  throw new Error(`Server config error (RMI): ${missing}`);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2023-10-16'
});

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log(`[FunctionInit] report-monthly-impression-usage initialized. Meter Event Name: ${IMPRESSION_METER_EVENT_NAME}`);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    let payload: { eventId?: string; impressionTimestamp?: string };
    const contentType = req.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        payload = await req.json();
      } catch (e) {
        console.error("[RequestError-RMI] Failed to parse JSON body:", (e as Error).message);
        return new Response(JSON.stringify({
          error: "Invalid JSON payload"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    } else {
      console.warn("[RequestError-RMI] Invalid content type, expected application/json. Received:", contentType);
      return new Response(JSON.stringify({
        error: "Invalid content type, expected application/json"
      }), {
        status: 415,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const { eventId, impressionTimestamp } = payload;

    if (!eventId) {
      console.warn("[InputValidation-RMI] Missing eventId in payload:", payload);
      return new Response(JSON.stringify({
        error: 'Missing required parameter: eventId'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log(`[RecordImpressionEvent] Processing impression for event_id: ${eventId}`);

    // 1. Get the organizer_id (Supabase Auth User ID) from the 'events' table
    const { data: eventData, error: eventError } = await supabaseAdmin
      .from('events')
      .select('organizer_id')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData?.organizer_id) {
      console.error(`[DBError-RMI] Event ${eventId} not found or no organizer_id. Error:`, eventError?.message);
      return new Response(JSON.stringify({
        success: false,
        message: `Event ${eventId} not found or not linked to an organizer.`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }

    const organizerAuthUserId = eventData.organizer_id;

    // 2. Get the organizer's active IMPRESSION_USAGE subscription (limit(1) to avoid multiple-rows error)
    console.log(`[DBQuery-RMI] Fetching active 'IMPRESSION_USAGE' sub for organizer_auth_user_id: ${organizerAuthUserId}`);
    const { data: activeSubRows, error: activeSubError } = await supabaseAdmin
      .from('organizer_billing_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, stripe_subscription_item_id')
      .eq('organizer_id', organizerAuthUserId)
      .eq('subscription_type', 'IMPRESSION_USAGE')
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (activeSubError) {
      console.error(`[DBError-RMI] Error fetching active impression subscription for organizer_id ${organizerAuthUserId}:`, activeSubError.message);
      throw new Error(`DB error fetching active impression subscription for org ${organizerAuthUserId}.`);
    }

    const activeSubData = activeSubRows?.[0] ?? null;
    if (!activeSubData) {
      console.warn(`[SubscriptionCheck-RMI] Org ${organizerAuthUserId} has no active 'IMPRESSION_USAGE' subscription.`);
      return new Response(JSON.stringify({
        success: true,
        message: 'Organizer not actively subscribed to impression billing. Impression not reported to Stripe.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }

    const stripeCustomerId = activeSubData.stripe_customer_id;

    if (!stripeCustomerId) {
      console.warn(`[StripeInfo-RMI] Org ${organizerAuthUserId} has active sub but subscription record missing Stripe Customer ID. Sub data:`, activeSubData);
      return new Response(JSON.stringify({
        success: true,
        message: 'Organizer subscribed but Stripe Customer ID missing in subscription record. Impression not reported to Stripe.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }

    // 3. Resolve subscription item ID if meter is subscription-based (optional; some meters use customer only)
    let subscriptionItemId: string | null = activeSubData.stripe_subscription_item_id ?? null;
    if (!subscriptionItemId && activeSubData.stripe_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(activeSubData.stripe_subscription_id, {
          expand: ['items.data.price.product']
        });
        if (subscription.items.data.length > 0) {
          subscriptionItemId = subscription.items.data[0].id;
          await supabaseAdmin
            .from('organizer_billing_subscriptions')
            .update({ stripe_subscription_item_id: subscriptionItemId })
            .eq('stripe_subscription_id', activeSubData.stripe_subscription_id);
        }
      } catch (stripeErr: unknown) {
        console.warn("[StripeInfo-RMI] Could not resolve subscription item (meter may be customer-based):", (stripeErr as Error).message);
      }
    }

    console.log(`[DataCheck-RMI] Found active sub for org ${organizerAuthUserId}, Stripe Customer ID: ${stripeCustomerId}`);

    // 4. Report usage to Stripe Meter Events API via fetch (avoids stripe.billing + Deno.core.runMicrotasks())
    const reportTimestamp = impressionTimestamp
      ? Math.floor(new Date(impressionTimestamp).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    const meterEventBody = new URLSearchParams({
      event_name: IMPRESSION_METER_EVENT_NAME,
      'payload[stripe_customer_id]': stripeCustomerId,
      'payload[value]': '1',
      'payload[supabase_event_id]': eventId,
      timestamp: reportTimestamp.toString()
    });
    if (subscriptionItemId) {
      meterEventBody.set('payload[identifier]', subscriptionItemId);
    }

    console.log(`[StripeCall-RMI] Reporting to meter '${IMPRESSION_METER_EVENT_NAME}' for customer ${stripeCustomerId}, value: 1, eventId: ${eventId}`);

    const meterRes = await fetch('https://api.stripe.com/v1/billing/meter_events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: meterEventBody.toString()
    });
    if (!meterRes.ok) {
      const errText = await meterRes.text();
      console.error(`[StripeCall-RMI] Meter event failed ${meterRes.status}:`, errText);
      throw new Error(`Stripe meter event failed: ${meterRes.status} ${errText}`);
    }

    console.log(`[Success-RMI] Stripe Meter Event sent for event ${eventId}, org ${organizerAuthUserId}, cust ${stripeCustomerId}.`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Impression reported to Stripe Meter.'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('[UnhandledError-RMI] Unexpected error in report-monthly-impression-usage:', (error as Error).message, (error as Error).stack);
    return new Response(JSON.stringify({
      error: `Server error: ${(error as Error).message}`
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
