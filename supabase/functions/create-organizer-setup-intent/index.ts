import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Use a Deno-targeted Stripe build that does not rely on deprecated Deno.core APIs
import Stripe from "https://esm.sh/stripe@14.12.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";

const STRIPE_API_VERSION = "2023-10-16";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const missingEnv: string[] = [];
if (!stripeSecretKey) missingEnv.push("STRIPE_SECRET_KEY");
if (!supabaseUrl) missingEnv.push("SUPABASE_URL");
if (!supabaseServiceKey) missingEnv.push("SUPABASE_SERVICE_ROLE_KEY");

if (missingEnv.length > 0) {
  console.error("[create-organizer-setup-intent] Missing required env vars:", missingEnv);
}

// Debug logging (remove after testing)
console.log("[create-organizer-setup-intent] STRIPE_SECRET_KEY present:", !!stripeSecretKey);
if (stripeSecretKey) {
  console.log("[create-organizer-setup-intent] Key starts with:", stripeSecretKey.substring(0, 15));
  console.log("[create-organizer-setup-intent] Key mode:", stripeSecretKey.startsWith('sk_test') ? 'TEST' : stripeSecretKey.startsWith('sk_live') ? 'LIVE' : 'INVALID');
}

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
      httpClient: Stripe.createFetchHttpClient(),
    })
  : null;

const supabaseAdmin =
  supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

type ReqBody = {
  userId: string;
  email: string;
  userType?: "music_lover" | "organizer";
  companyName?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function tryGetExistingCustomerId(userId: string, userType?: string): Promise<string | null> {
  if (!supabaseAdmin) return null;

  // Prefer organizer_profiles for organizers; music_lover_profiles otherwise.
  // We intentionally "best-effort" this because schemas can drift between environments.
  const table =
    userType === "organizer" ? "organizer_profiles" : "music_lover_profiles";

  // organizer_profiles stores stripe_customer_id in current app types;
  // music_lover_profiles may or may not have it — we tolerate missing column/table.
  try {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.warn(`[create-organizer-setup-intent] Could not read stripe_customer_id from ${table}:`, error);
      return null;
    }

    const anyData = data as { stripe_customer_id?: string | null } | null;
    return anyData?.stripe_customer_id ?? null;
  } catch (e) {
    console.warn(`[create-organizer-setup-intent] Best-effort customer lookup failed for ${table}:`, e);
    return null;
  }
}

async function tryPersistCustomerId(userId: string, userType: string | undefined, customerId: string) {
  if (!supabaseAdmin) return;

  const table =
    userType === "organizer" ? "organizer_profiles" : "music_lover_profiles";

  try {
    const { error } = await supabaseAdmin
      .from(table)
      .update({ stripe_customer_id: customerId })
      .eq("user_id", userId);

    if (error) {
      console.warn(`[create-organizer-setup-intent] Could not persist stripe_customer_id to ${table}:`, error);
    }
  } catch (e) {
    console.warn(`[create-organizer-setup-intent] Best-effort persist failed for ${table}:`, e);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (missingEnv.length > 0 || !stripe || !supabaseAdmin) {
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
    const userId = (body.userId ?? "").trim();
    const email = (body.email ?? "").trim();
    const userType = body.userType;

    if (!userId || !email) {
      return json({ error: "Missing required parameters: userId, email" }, 400);
    }

    // 1) Find or create customer
    let customerId = await tryGetExistingCustomerId(userId, userType);
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          app_user_id: userId,
          user_type: userType ?? "unknown",
          company_name: body.companyName ?? "",
        },
      });
      customerId = customer.id;
      await tryPersistCustomerId(userId, userType, customerId);
    }

    // 2) Ephemeral key for mobile SDK
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: STRIPE_API_VERSION },
    );

    // 3) SetupIntent to save payment method
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        app_user_id: userId,
      },
    });

    if (!setupIntent.client_secret) {
      return json({ error: "Failed to create SetupIntent client secret." }, 500);
    }

    return json({
      clientSecret: setupIntent.client_secret,
      customerId,
      ephemeralKey: ephemeralKey.secret,
    });
  } catch (e) {
    console.error("[create-organizer-setup-intent] Unhandled error:", e);
    const errorMsg = (e as Error)?.message ?? "Unknown error";
    console.error("[create-organizer-setup-intent] Error details:", errorMsg);
    return json({ 
      error: `Payment setup failed: ${errorMsg}`,
      details: errorMsg 
    }, 500);
  }
});


