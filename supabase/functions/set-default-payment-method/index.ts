import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// Use a Deno-targeted Stripe build that does not rely on deprecated Deno.core APIs
import Stripe from "https://esm.sh/stripe@14.12.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";

const STRIPE_API_VERSION = "2023-10-16";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const missingEnv: string[] = [];
if (!stripeSecretKey) missingEnv.push("STRIPE_SECRET_KEY");

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
      httpClient: Stripe.createFetchHttpClient(),
    })
  : null;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type ReqBody = {
  customerId: string;
  paymentMethodId: string;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!stripe || missingEnv.length > 0) {
      return json(
        {
          error:
            "Server payment configuration is missing. Please contact support (missing Stripe env vars).",
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
    const customerId = (body.customerId ?? "").trim();
    const paymentMethodId = (body.paymentMethodId ?? "").trim();

    if (!customerId || !paymentMethodId) {
      return json({ error: "Missing required parameters: customerId, paymentMethodId" }, 400);
    }

    // Attach payment method to customer (idempotent-ish; Stripe will error if attached elsewhere).
    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    } catch (e) {
      // If already attached, Stripe can throw; we'll proceed to set default.
      console.warn("[set-default-payment-method] attach warning (continuing):", e);
    }

    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    return json({ success: true });
  } catch (e) {
    console.error("[set-default-payment-method] Unhandled error:", e);
    return json({ error: (e as Error)?.message ?? "Unknown error" }, 500);
  }
});


