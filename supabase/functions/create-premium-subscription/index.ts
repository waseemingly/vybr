// @ts-ignore - Deno types not available in workspace TypeScript config
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
// @ts-ignore - Deno import paths
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore - Deno import paths
import Stripe from "https://esm.sh/stripe@14.12.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const STRIPE_API_VERSION = "2023-10-16";

// @ts-ignore - Deno global available at runtime
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
// @ts-ignore - Deno global available at runtime
const supabaseUrl = Deno.env.get("SUPABASE_URL");
// @ts-ignore - Deno global available at runtime
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const missingEnv: string[] = [];
if (!stripeSecretKey) missingEnv.push("STRIPE_SECRET_KEY");
if (!supabaseUrl) missingEnv.push("SUPABASE_URL");
if (!supabaseServiceKey) missingEnv.push("SUPABASE_SERVICE_ROLE_KEY");

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
      httpClient: Stripe.createFetchHttpClient(),
    })
  : null;

const supabaseAdmin =
  supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type ReqBody = {
  priceId: string;
  userId: string;
  userEmail: string;
  paymentMethodId?: string;
  userType?: "music_lover" | "organizer";
};

async function tryGetExistingCustomerId(userId: string, userType?: string): Promise<string | null> {
  if (!supabaseAdmin) return null;

  const table = userType === "organizer" ? "organizer_profiles" : "music_lover_profiles";
  try {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.warn(`[create-premium-subscription] Could not read stripe_customer_id from ${table}:`, error);
      return null;
    }

    const anyData = data as { stripe_customer_id?: string | null } | null;
    return anyData?.stripe_customer_id ?? null;
  } catch (e) {
    console.warn(`[create-premium-subscription] Best-effort customer lookup failed for ${table}:`, e);
    return null;
  }
}

async function tryPersistCustomerId(userId: string, userType: string | undefined, customerId: string) {
  if (!supabaseAdmin) return;
  const table = userType === "organizer" ? "organizer_profiles" : "music_lover_profiles";
  try {
    const { error } = await supabaseAdmin
      .from(table)
      .update({ stripe_customer_id: customerId })
      .eq("user_id", userId);
    if (error) {
      console.warn(`[create-premium-subscription] Could not persist stripe_customer_id to ${table}:`, error);
    }
  } catch (e) {
    console.warn(`[create-premium-subscription] Best-effort persist failed for ${table}:`, e);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!stripe || !supabaseAdmin || missingEnv.length > 0) {
      return json(
        {
          error:
            "Server payment configuration is missing. Please contact support (missing Stripe/Supabase env vars).",
          missingEnv,
        },
        500,
      );
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return json({ error: "Invalid content type, expected application/json" }, 415);
    }

    const body = (await req.json()) as Partial<ReqBody>;
    const priceId = (body.priceId ?? "").trim();
    const userId = (body.userId ?? "").trim();
    const userEmail = (body.userEmail ?? "").trim();
    const paymentMethodId = (body.paymentMethodId ?? "").trim();
    const userType = body.userType ?? "music_lover";

    if (!priceId || !userId || !userEmail) {
      return json({ error: "Missing required parameters: priceId, userId, userEmail" }, 400);
    }

    // 1) Find or create customer
    let customerId: string = await tryGetExistingCustomerId(userId, userType) || "";
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { app_user_id: userId, user_type: userType },
      });
      customerId = customer.id;
      await tryPersistCustomerId(userId, userType, customerId);
    }

    // 2) If we have a payment method, attach and set as default for invoices
    if (paymentMethodId) {
      try {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
      } catch (e) {
        console.warn("[create-premium-subscription] attach warning (continuing):", e);
      }
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    }

    // Ephemeral key for any mobile PaymentSheet follow-ups (e.g., 3DS)
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: STRIPE_API_VERSION },
    );

    // 3) Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
      metadata: { app_user_id: userId },
    });

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null;
    const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent | null;

    if (!paymentIntent?.client_secret) {
      // If we can't get a client secret, we can't complete on mobile.
      return json(
        {
          error: "Failed to initialize payment for the subscription (missing client secret).",
        },
        500,
      );
    }

    // Success / next steps
    if (paymentIntent.status === "succeeded" || subscription.status === "active") {
      return json({
        success: true,
        customerId,
      });
    }

    if (paymentIntent.status === "requires_action" || paymentIntent.status === "requires_confirmation") {
      return json({
        requires_action: true,
        client_secret: paymentIntent.client_secret,
        customerId,
        ephemeralKey: ephemeralKey.secret,
      });
    }

    if (paymentIntent.status === "requires_payment_method") {
      return json(
        {
          error:
            "Payment method was declined or not available. Please try another card.",
          payment_intent_status: paymentIntent.status,
        },
        402,
      );
    }

    // Fallback
    return json({
      requires_action: true,
      client_secret: paymentIntent.client_secret,
      customerId,
      ephemeralKey: ephemeralKey.secret,
      payment_intent_status: paymentIntent.status,
    });
  } catch (e) {
    console.error("[create-premium-subscription] Unhandled error:", e);
    return json({ error: (e as Error)?.message ?? "Unknown error" }, 500);
  }
});


