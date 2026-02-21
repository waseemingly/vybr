import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.12.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const IMPRESSION_USAGE_PRICE_ID = (Deno.env.get('STRIPE_IMPRESSION_USAGE_PRICE_ID') ?? Deno.env.get('stripe_impression_price') ?? '').trim();

if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !IMPRESSION_USAGE_PRICE_ID) {
  const missing = [
    !STRIPE_SECRET_KEY && 'STRIPE_SECRET_KEY',
    !SUPABASE_URL && 'SUPABASE_URL',
    !SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
    !IMPRESSION_USAGE_PRICE_ID && 'STRIPE_IMPRESSION_USAGE_PRICE_ID or stripe_impression_price'
  ].filter(Boolean).join(', ');
  console.error(`[ConfigError] Missing environment variables: ${missing}`);
  throw new Error(`Server configuration error: ${missing}`);
}

if (IMPRESSION_USAGE_PRICE_ID.startsWith('sub_')) {
  console.error('[ConfigError] STRIPE_IMPRESSION_USAGE_PRICE_ID must be a Price ID (price_xxx), not a Subscription ID (sub_xxx).');
  throw new Error('STRIPE_IMPRESSION_USAGE_PRICE_ID must be a Price ID. Create a metered Price in Stripe Dashboard → Products.');
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient()
});

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const userSupabaseClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization') ?? ''
        }
      }
    });

    const { data: { user: authUser }, error: authError } = await userSupabaseClient.auth.getUser();
    if (authError || !authUser) {
      console.warn('[AuthError] Unauthorized or error fetching user:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Could not verify user session.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authUser.id;
    const userEmail = authUser.email ?? '';
    console.log(`[ImpressionSub] Request for user: ${userId}, email: ${userEmail}`);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('organizer_profiles')
      .select('id, stripe_customer_id, company_name')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      const errMsg = profileError?.message ?? 'Organizer profile not found';
      throw new Error(`Failed to fetch organizer profile: ${errMsg}`);
    }

    let stripeCustomerId = profile.stripe_customer_id;
    const companyName = profile.company_name ?? undefined;

    if (!stripeCustomerId) {
      console.log(`[ImpressionSub] No Stripe Customer ID for user ${userId}. Creating one.`);
      const customer = await stripe.customers.create({
        email: userEmail,
        name: companyName ?? `Organizer ${userId}`,
        metadata: {
          supabase_user_id: userId,
          organizer_profile_id: profile.id,
          app_user_type: 'organizer'
        }
      });
      stripeCustomerId = customer.id;
      const { error: updateError } = await supabaseAdmin
        .from('organizer_profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('user_id', userId);
      if (updateError) {
        throw new Error(`Failed to save Stripe Customer ID to profile: ${updateError.message}`);
      }
    } else {
      console.log(`[ImpressionSub] Found existing Stripe Customer ID: ${stripeCustomerId}`);
    }

    const { data: existingImpressionSub, error: existingSubQueryError } = await supabaseAdmin
      .from('organizer_billing_subscriptions')
      .select('*')
      .eq('organizer_id', userId)
      .eq('subscription_type', 'IMPRESSION_USAGE')
      .in('status', ['active', 'trialing', 'past_due'])
      .maybeSingle();

    if (!existingSubQueryError && existingImpressionSub) {
      console.log('[ImpressionSub] Organizer already has active impression usage subscription.');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Already subscribed to impression usage billing.',
          subscriptionId: existingImpressionSub.stripe_subscription_id,
          status: existingImpressionSub.status
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const billingCycleAnchorTimestamp = Math.floor(startOfNextMonth.getTime() / 1000);

    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: IMPRESSION_USAGE_PRICE_ID }],
      billing_cycle_anchor: billingCycleAnchorTimestamp,
      proration_behavior: 'none',
      collection_method: 'charge_automatically',
      metadata: {
        organizer_id: userId,
        subscription_type: 'IMPRESSION_USAGE',
        billing_type: 'CALENDAR_MONTH'
      }
    });

    const subscriptionItemId = subscription.items.data[0]?.id ?? null;
    console.log(`[ImpressionSub] Created subscription: ${subscription.id}, item: ${subscriptionItemId}`);

    const { error: insertSubError } = await supabaseAdmin
      .from('organizer_billing_subscriptions')
      .insert({
        organizer_id: userId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        stripe_subscription_item_id: subscriptionItemId,
        subscription_type: 'IMPRESSION_USAGE',
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        billing_cycle_anchor: new Date(billingCycleAnchorTimestamp * 1000).toISOString(),
        price_per_unit: 0.0075,
        currency: 'sgd',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (insertSubError) {
      console.error(`[ImpressionSub] Failed to save subscription ${subscription.id}: ${insertSubError.message}`);
      try {
        await stripe.subscriptions.cancel(subscription.id);
        console.warn(`[ImpressionSub] Canceled subscription ${subscription.id} due to DB insert error.`);
      } catch (cancelError: unknown) {
        console.error(`[ImpressionSub] Failed to cancel orphaned subscription:`, cancelError);
      }
      throw new Error(`Failed to save impression subscription details to database: ${insertSubError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully subscribed to impression billing.',
        customerId: stripeCustomerId,
        subscriptionId: subscription.id,
        subscriptionItemId,
        status: subscription.status,
        nextBillingDate: new Date(subscription.current_period_end * 1000).toISOString(),
        billingCycleAnchor: new Date(billingCycleAnchorTimestamp * 1000).toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[ImpressionSub] Unhandled error in function:', message);
    return new Response(
      JSON.stringify({ error: `Server error: ${message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
