// @ts-ignore - Deno types not available in workspace TypeScript config
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore - Deno import paths
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore - Deno import paths
import Stripe from 'https://esm.sh/stripe@14.12.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    // @ts-ignore - Deno global available at runtime
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, email, companyName } = await req.json();

    console.log(`[create-organizer-ticket-usage-subscription] Received request for userId: ${userId}, email: ${email}`);

    if (!userId || !email) {
      console.error('[create-organizer-ticket-usage-subscription] Missing required fields');
      return new Response(JSON.stringify({
        error: 'userId and email are required'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }

    // Fetch organizer profile
    const { data: profile, error: profileError } = await supabase
      .from('organizer_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      console.error('[create-organizer-ticket-usage-subscription] Error fetching organizer profile:', profileError);
      return new Response(JSON.stringify({
        error: `Failed to fetch organizer profile: ${profileError.message}`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }

    // @ts-ignore - Deno global available at runtime
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient()
    });

    let customerId = profile.stripe_customer_id;

    // Create Stripe customer if not exists
    if (!customerId) {
      console.log('[create-organizer-ticket-usage-subscription] Creating new Stripe customer for organizer');
      const customer = await stripe.customers.create({
        email: email,
        name: companyName || undefined,
        metadata: {
          supabase_user_id: userId,
          user_type: 'organizer',
          profile_id: profile.id
        }
      });

      customerId = customer.id;

      // Update profile with new customer ID
      const { error: updateError } = await supabase
        .from('organizer_profiles')
        .update({
          stripe_customer_id: customerId
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('[create-organizer-ticket-usage-subscription] Error updating organizer profile:', updateError);
        throw new Error(`Failed to save customer ID: ${updateError.message}`);
      }
    }

    // Check if already has ticket usage subscription
    const { data: existingSubscription, error: subQueryError } = await supabase
      .from('organizer_billing_subscriptions')
      .select('*')
      .eq('organizer_id', userId)
      .eq('subscription_type', 'TICKET_USAGE')
      .in('status', ['active', 'trialing', 'past_due'])
      .maybeSingle();

    if (existingSubscription && !subQueryError) {
      console.log('[create-organizer-ticket-usage-subscription] Organizer already has active ticket usage subscription');
      return new Response(JSON.stringify({
        success: true,
        message: 'Already subscribed to ticket usage billing',
        subscriptionId: existingSubscription.stripe_subscription_id,
        status: existingSubscription.status
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Get the next 1st of the month for billing anchor
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const billingCycleAnchor = Math.floor(nextMonth.getTime() / 1000);

    // Create the usage-based subscription
    // @ts-ignore - Deno global available at runtime
    const TICKET_USAGE_PRICE_ID = (Deno.env.get('STRIPE_TICKET_USAGE_PRICE_ID') ?? '').trim();

    if (!TICKET_USAGE_PRICE_ID) {
      throw new Error('STRIPE_TICKET_USAGE_PRICE_ID environment variable not set');
    }
    // Stripe expects a Price ID (price_xxx), not a Subscription ID (sub_xxx)
    if (TICKET_USAGE_PRICE_ID.startsWith('sub_')) {
      throw new Error(
        'STRIPE_TICKET_USAGE_PRICE_ID must be a Price ID (starts with price_), not a Subscription ID (sub_). ' +
        'Create a metered Price in Stripe Dashboard → Billing → Products, then set the env to that Price ID.'
      );
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: TICKET_USAGE_PRICE_ID
        }
      ],
      billing_cycle_anchor: billingCycleAnchor,
      proration_behavior: 'none',
      collection_method: 'charge_automatically',
      metadata: {
        organizer_id: userId,
        subscription_type: 'TICKET_USAGE',
        billing_type: 'CALENDAR_MONTH'
      }
    });

    console.log(`[create-organizer-ticket-usage-subscription] Created subscription: ${subscription.id}`);

    // Get the subscription item ID for future reference
    const subscriptionItemId = subscription.items.data[0]?.id || null;

    // Save subscription to database
    const { error: insertError } = await supabase
      .from('organizer_billing_subscriptions')
      .insert({
        organizer_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_subscription_item_id: subscriptionItemId, // Store this for meter events
        subscription_type: 'TICKET_USAGE',
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        billing_cycle_anchor: new Date(billingCycleAnchor * 1000).toISOString(),
        price_per_unit: 0.50,
        currency: 'sgd',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('[create-organizer-ticket-usage-subscription] Error saving subscription:', insertError);
      // Cancel the Stripe subscription if DB save fails
      await stripe.subscriptions.cancel(subscription.id);
      throw new Error(`Failed to save subscription: ${insertError.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      customerId: customerId,
      subscriptionId: subscription.id,
      subscriptionItemId: subscriptionItemId,
      status: subscription.status,
      nextBillingDate: new Date(subscription.current_period_end * 1000).toISOString(),
      pricePerUnit: 0.50,
      currency: 'SGD',
      billingCycleAnchor: new Date(billingCycleAnchor * 1000).toISOString()
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error: any) {
    console.error('[create-organizer-ticket-usage-subscription] Unexpected error:', error);
    return new Response(JSON.stringify({
      error: `Server error: ${error.message}`
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});

