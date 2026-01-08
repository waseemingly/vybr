import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@15.12.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// --- Environment Variables ---
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const METER_EVENT_NAME = Deno.env.get('STRIPE_TICKET_METER_EVENT_NAME') || 'tickets_and_reservations';

if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  const missing = [
    "STRIPE_SECRET_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY"
  ].filter((k) => !Deno.env.get(k)).join(", ");
  console.error(`[ConfigError-RBU] CRITICAL: Missing env vars: ${missing}.`);
  throw new Error(`Server config error (RBU): ${missing}`);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2023-10-16'
});

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log(`[FunctionInit] report-booking-usage initialized. Meter Event Name: ${METER_EVENT_NAME}`);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    let payload;
    const contentType = req.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        payload = await req.json();
      } catch (e) {
        console.error("[RequestError-RBU] Failed to parse JSON body:", e.message);
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
      console.warn("[RequestError-RBU] Invalid content type, expected application/json. Received:", contentType);
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

    const { eventId, quantity } = payload;

    if (!eventId || !quantity) {
      console.warn("[InputValidation-RBU] Missing eventId or quantity in payload:", payload);
      return new Response(JSON.stringify({
        error: 'Missing required parameter: eventId or quantity'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log(`[RecordBookingUsage] Processing booking usage for event_id: ${eventId}, quantity: ${quantity}`);

    // 1. Get the organizer_id (Supabase Auth User ID) from the 'events' table
    const { data: eventData, error: eventError } = await supabaseAdmin
      .from('events')
      .select('organizer_id')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData?.organizer_id) {
      console.error(`[DBError-RBU] Event ${eventId} not found or no organizer_id. Error:`, eventError?.message);
      return new Response(JSON.stringify({
        success: false,
        message: `Event ${eventId} not found or not linked to an organizer.`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      }); // 200 so trigger doesn't retry for missing event
    }

    const organizerAuthUserId = eventData.organizer_id;

    // 2. Get the organizer's active TICKET_USAGE subscription details,
    //    including their stripe_customer_id, stripe_subscription_id and stripe_subscription_item_id
    console.log(`[DBQuery-RBU] Fetching active 'TICKET_USAGE' sub for organizer_auth_user_id: ${organizerAuthUserId}`);
    const { data: activeSubData, error: activeSubError } = await supabaseAdmin
      .from('organizer_billing_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, stripe_subscription_item_id')
      .eq('organizer_id', organizerAuthUserId) // This is the Supabase Auth User ID
      .eq('subscription_type', 'TICKET_USAGE')
      .in('status', ['active', 'trialing', 'past_due'])
      .maybeSingle(); // Expect one active ticket usage subscription

    if (activeSubError) {
      console.error(`[DBError-RBU] Error fetching active ticket usage subscription for organizer_id ${organizerAuthUserId}:`, activeSubError.message);
      throw new Error(`DB error fetching active ticket usage subscription for org ${organizerAuthUserId}.`);
    }

    if (!activeSubData) {
      console.warn(`[SubscriptionCheck-RBU] Org ${organizerAuthUserId} has no active 'TICKET_USAGE' subscription.`);
      return new Response(JSON.stringify({
        success: true,
        message: 'Organizer not actively subscribed to ticket usage billing. Usage not reported to Stripe.'
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
      console.warn(`[StripeInfo-RBU] Org ${organizerAuthUserId} has active sub but subscription record missing Stripe Customer ID. Sub data:`, activeSubData);
      return new Response(JSON.stringify({
        success: true,
        message: 'Organizer subscribed but Stripe Customer ID missing in subscription record. Usage not reported to Stripe.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }

    // 3. Get the subscription item ID (required for subscription-based meters)
    let subscriptionItemId: string | null = activeSubData.stripe_subscription_item_id || null;
    
    if (!subscriptionItemId) {
      console.log(`[StripeInfo-RBU] Subscription item ID not in database, fetching from Stripe...`);
      try {
        const subscription = await stripe.subscriptions.retrieve(activeSubData.stripe_subscription_id, {
          expand: ['items.data.price.product']
        });
        
        // Get the first subscription item (should be the ticket usage item)
        if (subscription.items.data.length > 0) {
          subscriptionItemId = subscription.items.data[0].id;
          console.log(`[StripeInfo-RBU] Found subscription item ID from Stripe: ${subscriptionItemId}`);
          
          // Update database with subscription item ID for future use
          await supabaseAdmin
            .from('organizer_billing_subscriptions')
            .update({ stripe_subscription_item_id: subscriptionItemId })
            .eq('stripe_subscription_id', activeSubData.stripe_subscription_id);
        } else {
          throw new Error('No subscription items found');
        }
      } catch (stripeError: any) {
        console.error(`[StripeInfo-RBU] Error retrieving subscription: ${stripeError.message}`);
        throw new Error(`Failed to retrieve subscription details: ${stripeError.message}`);
      }
    }

    if (!subscriptionItemId) {
      console.warn(`[StripeInfo-RBU] Org ${organizerAuthUserId} has active sub but could not get subscription item ID. Sub data:`, activeSubData);
      return new Response(JSON.stringify({
        success: true,
        message: 'Organizer subscribed but subscription item ID missing. Usage not reported to Stripe.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }

    console.log(`[DataCheck-RBU] Found active sub for org ${organizerAuthUserId}, Stripe Customer ID: ${stripeCustomerId}, Subscription Item ID: ${subscriptionItemId}`);

    // 4. Report usage to Stripe using Meter Events API
    const reportTimestamp = Math.floor(Date.now() / 1000);
    const usageValue = quantity.toString(); // Convert to string like impression function

    console.log(`[StripeCall-RBU] Reporting to meter '${METER_EVENT_NAME}' for customer ${stripeCustomerId}, subscription item ${subscriptionItemId}, value: ${usageValue}, eventId: ${eventId}`);

    await stripe.billing.meterEvents.create({
      event_name: METER_EVENT_NAME,
      payload: {
        stripe_customer_id: stripeCustomerId, // Required: Customer ID must be in payload
        identifier: subscriptionItemId, // For subscription-based meters, use subscription item ID as identifier
        value: usageValue,
        supabase_event_id: eventId
      },
      timestamp: reportTimestamp
    });

    console.log(`[Success-RBU] Stripe Meter Event sent for event ${eventId}, org ${organizerAuthUserId}, cust ${stripeCustomerId}, subscription item ${subscriptionItemId}.`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Booking usage reported to Stripe Meter.'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });

  } catch (error) {
    console.error('[UnhandledError-RBU] Unexpected error in report-booking-usage:', error.message, error.stack);
    return new Response(JSON.stringify({
      error: `Server error: ${error.message}`
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

