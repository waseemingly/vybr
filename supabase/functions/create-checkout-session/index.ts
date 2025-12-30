// // supabase/functions/create-checkout-session/index.ts
// import { serve } from "std/http/server.ts";
// import { createClient } from "@supabase/supabase-js";
// import Stripe from "stripe";

// // These environment variables are set in Supabase Dashboard > Project Settings > Edge Functions
// const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
// const supabaseUrl = Deno.env.get('SUPABASE_URL')
// const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
//   throw new Error('Missing required environment variables')
// }

// const stripe = new Stripe(stripeSecretKey, {
//   apiVersion: '2023-10-16',
// })

// const supabaseClient = createClient(
//   supabaseUrl,
//   supabaseServiceKey
// )

// serve(async (req) => {
//   try {
//     const { priceId, userId, userEmail, cardDetails } = await req.json()

//     if (!priceId || !userId || !userEmail) {
//       return new Response(
//         JSON.stringify({ error: 'Missing required parameters' }),
//         { status: 400, headers: { 'Content-Type': 'application/json' } }
//       )
//     }

//     // Create or retrieve Stripe customer
//     const { data: existingCustomer } = await supabaseClient
//       .from('subscriptions')
//       .select('stripe_customer_id')
//       .eq('user_id', userId)
//       .single()

//     let customerId = existingCustomer?.stripe_customer_id

//     if (!customerId) {
//       const customer = await stripe.customers.create({
//         email: userEmail,
//         metadata: {
//           userId: userId,
//         },
//       })
//       customerId = customer.id

//       // Store the customer ID in your database
//       await supabaseClient
//         .from('subscriptions')
//         .insert({
//           user_id: userId,
//           stripe_customer_id: customerId,
//           status: 'incomplete',
//         })
//     }

//     // Create a payment intent instead of a checkout session
//     const paymentIntent = await stripe.paymentIntents.create({
//       amount: 499, // $4.99 in cents
//       currency: 'usd',
//       customer: customerId,
//       payment_method_types: ['card'],
//       metadata: {
//         userId: userId,
//       },
//     })

//     // Create an ephemeral key for the customer
//     const ephemeralKey = await stripe.ephemeralKeys.create(
//       { customer: customerId },
//       { apiVersion: '2023-10-16' }
//     )

//     return new Response(
//       JSON.stringify({
//         sessionId: paymentIntent.client_secret,
//         ephemeralKey: ephemeralKey.secret,
//         customerId: customerId,
//       }),
//       {
//         headers: { 'Content-Type': 'application/json' },
//         status: 200,
//       }
//     )
//   } catch (error) {
//     console.error('Error:', error)
//     return new Response(
//       JSON.stringify({ error: error.message }),
//       {
//         headers: { 'Content-Type': 'application/json' },
//         status: 400,
//       }
//     )
//   }
// })
// supabase/functions/create-checkout-session/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Use a Deno-targeted Stripe build that does not rely on deprecated Deno.core APIs
import Stripe from "https://esm.sh/stripe@14.12.0?target=deno";
import { corsHeaders } from '../_shared/cors.ts'; // Make sure you have this for CORS

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  throw new Error('Missing required environment variables');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16', // Use a consistent API version
  httpClient: Stripe.createFetchHttpClient(), // Recommended for Deno
});

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Ensure you parse the body correctly, especially if stringified on the client
    let payload;
    const contentType = req.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        payload = await req.json();
    } else {
        // Fallback or error if content type is not JSON
        return new Response(JSON.stringify({ error: "Invalid content type, expected application/json" }), {
            status: 415, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    const { priceId, userId, userEmail } = payload;


    if (!priceId || !userId || !userEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: priceId, userId, or userEmail' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing request for userId: ${userId}, email: ${userEmail}, priceId: ${priceId}`);

    // 1. Get or Create Stripe Customer
    // It's better to store stripe_customer_id on your main user profiles table
    // Assuming 'profiles' table has 'id' (UUID matching auth.users.id) and 'stripe_customer_id' (text)
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles') // ADJUST TABLE NAME IF DIFFERENT
      .select('stripe_customer_id')
      .eq('id', userId) // Assuming 'id' in profiles is the user_id
      .single();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Error fetching profile for stripe_customer_id:', profileError);
      throw new Error('Could not fetch user profile to get Stripe customer ID.');
    }

    let customerId = userProfile?.stripe_customer_id;

    if (!customerId) {
      console.log(`No Stripe customer ID found for user ${userId}. Creating new Stripe customer.`);
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { app_user_id: userId }, // Link Supabase user ID
      });
      customerId = customer.id;
      console.log(`Created Stripe customer ${customerId} for user ${userId}.`);

      // Store the new Stripe customer ID on the user's profile
      const { error: updateProfileError } = await supabaseAdmin
        .from('profiles') // ADJUST TABLE NAME
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);

      if (updateProfileError) {
        console.error('Error updating profile with Stripe customer ID:', updateProfileError);
        // Non-fatal for this flow, but needs monitoring
      }
    } else {
      console.log(`Found existing Stripe customer ID ${customerId} for user ${userId}.`);
    }

    // 2. Create an Ephemeral Key for the Customer on the frontend
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2023-10-16' }
    );
    console.log(`Created ephemeral key for customer ${customerId}.`);

    // 3. Create a Subscription
    // This will attempt to charge the customer immediately if there's no trial
    // and will create a PaymentIntent for the first invoice.
    console.log(`Creating Stripe subscription for customer ${customerId} with price ${priceId}.`);
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete_if_customer_has_no_payment_method', // Allows PaymentSheet to collect payment
      payment_settings: {
        save_default_payment_method: 'on_subscription', // Good for renewals
      },
      expand: ['latest_invoice.payment_intent', 'pending_setup_intent'], // Crucial for getting client secrets
      // trial_period_days: 7, // Uncomment to add a 7-day trial
    });
    console.log(`Created Stripe subscription ${subscription.id}. Status: ${subscription.status}`);

    let clientSecret: string | null = null;

    if (subscription.pending_setup_intent && typeof subscription.pending_setup_intent === 'object') {
      clientSecret = subscription.pending_setup_intent.client_secret;
      console.log(`Using SetupIntent client secret: ${clientSecret}`);
    } else if (subscription.latest_invoice && typeof subscription.latest_invoice === 'object' &&
               subscription.latest_invoice.payment_intent && typeof subscription.latest_invoice.payment_intent === 'object') {
      clientSecret = subscription.latest_invoice.payment_intent.client_secret;
      console.log(`Using PaymentIntent client secret: ${clientSecret}`);
    }

    if (!clientSecret) {
      // This case might happen if e.g. a subscription is already active and paid, or some other edge case.
      // For a new subscription, one of the above should provide a client_secret.
      console.error('Could not extract client_secret from subscription. Subscription object:', JSON.stringify(subscription, null, 2));
      throw new Error('Failed to initialize payment for the subscription. No client secret found.');
    }

    // You might want to insert a record into your 'subscriptions' table here
    // with the subscription.id, customerId, status (e.g., subscription.status), etc.
    // This is often better handled by a webhook for reliability.
    // For now, we'll rely on the frontend updating status and webhook for the rest.

    console.log('Successfully prepared data for PaymentSheet.');
    return new Response(
      JSON.stringify({
        paymentIntentClientSecret: clientSecret, // Key name expected by frontend
        ephemeralKey: ephemeralKey.secret,
        customerId: customerId,
        subscriptionId: subscription.id, // Useful for client/webhooks
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Unhandled error in create-checkout-session:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An internal server error occurred.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500, // Use 500 for actual server errors
      }
    );
  }
});