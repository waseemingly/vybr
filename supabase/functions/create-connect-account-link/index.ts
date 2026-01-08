import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
} 

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const missingEnv: string[] = [];
if (!stripeSecretKey) missingEnv.push("STRIPE_SECRET_KEY");
if (!supabaseUrl) missingEnv.push("SUPABASE_URL");
if (!supabaseServiceKey) missingEnv.push("SUPABASE_SERVICE_ROLE_KEY");

if (missingEnv.length > 0) {
  console.error("[create-connect-account-link] Missing required env vars:", missingEnv);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getValidReturnUrl(origin: string | null): string {
  // Try to use the origin if it's a valid HTTPS URL
  if (origin) {
    try {
      const url = new URL(origin);
      // Only accept http/https protocols
      if (url.protocol === 'https:' || url.protocol === 'http:') {
    return origin;
  }
  } catch (_e) {
      // Invalid URL, fall through to default
    }
  }

  // Fallback: construct from supabaseUrl or use a default
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      // Use the same domain but ensure HTTPS
      return `${url.protocol === 'https:' ? 'https' : 'https'}://${url.host}`;
    } catch (_e) {
      // If supabaseUrl is invalid, use a default
    }
  }
  
  // Last resort: use a default HTTPS URL (you may want to set this as an env var)
  const defaultUrl = Deno.env.get("STRIPE_RETURN_URL_BASE") || "https://vybr.app";
  return defaultUrl;
}

async function supabaseRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      'apikey': supabaseServiceKey!,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase API error: ${error}`);
  }
  
  return await response.json();
}

async function getUser(token: string) {
  return await supabaseRequest('/auth/v1/user', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}

async function getOrganizerProfile(userId: string) {
  const response = await supabaseRequest(
    `/rest/v1/organizer_profiles?user_id=eq.${userId}&select=stripe_connect_account_id,company_name,email`,
    {
      headers: {
        'Prefer': 'return=representation',
      },
    }
  );
  
  return response[0] || null;
}

async function updateOrganizerProfile(userId: string, accountId: string) {
  return await supabaseRequest(
    `/rest/v1/organizer_profiles?user_id=eq.${userId}`,
    {
      method: 'PATCH',
      headers: {
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ stripe_connect_account_id: accountId }),
    }
  );
}

async function createStripeConnectAccount(email: string, userId: string, companyName: string) {
  const response = await fetch("https://api.stripe.com/v1/accounts", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      type: "express",
      email: email,
      business_type: "individual",
      "metadata[user_id]": userId,
      "metadata[company_name]": companyName,
      "capabilities[card_payments][requested]": "true",
      "capabilities[transfers][requested]": "true",
    }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Stripe API error: ${error}`);
  }
  return await response.json();
}

async function createStripeAccountLink(accountId: string, origin: string | null) {
  const baseUrl = getValidReturnUrl(origin);
  
  const refreshUrl = `${baseUrl}?stripe_onboarding_return=true`;
  const returnUrl = `${baseUrl}?stripe_onboarding_complete=true`;
  
  console.log("[create-connect-account-link] Using return URLs:", { refreshUrl, returnUrl });
  
  const response = await fetch("https://api.stripe.com/v1/account_links", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Stripe API error: ${error}`);
  }
  return await response.json();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (missingEnv.length > 0) {
      return json(
        {
          error: "Server configuration missing. Please contact support.",
          missingEnv,
        },
        500
      );
    }

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization header" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    
    let user;
    try {
      user = await getUser(token);
    } catch (e) {
      console.error("[create-connect-account-link] Auth error:", e);
      return json({ error: "Unauthorized" }, 401);
    }

    const userId = user.id;

    // Check if organizer already has a Connect account
    let profile;
    try {
      profile = await getOrganizerProfile(userId);
    } catch (e) {
      console.error("[create-connect-account-link] Profile fetch error:", e);
      return json({ error: "Could not fetch organizer profile" }, 400);
    }

    if (!profile) {
      return json({ error: "Organizer profile not found" }, 404);
    }

    let accountId = profile.stripe_connect_account_id;

    // Create Connect account if it doesn't exist
    if (!accountId) {
      console.log("[create-connect-account-link] Creating new Connect account for user:", userId);
      
      const account = await createStripeConnectAccount(
        profile.email || user.email || "",
        userId,
        profile.company_name || ""
      );
      accountId = account.id;

      // Save the Connect account ID
      try {
        await updateOrganizerProfile(userId, accountId);
      } catch (e) {
        console.error("[create-connect-account-link] Failed to save Connect account ID:", e);
        // Continue anyway - they can retry
      }
    }

    // Create account link for onboarding
    const origin = req.headers.get("origin");
    const accountLink = await createStripeAccountLink(
      accountId,
      origin
    );

    console.log("[create-connect-account-link] Account link created successfully");

    return json({
      url: accountLink.url,
      accountId,
    });
  } catch (e) {
    console.error("[create-connect-account-link] Unhandled error:", e);
    return json(
      {
        error: `Failed to create Connect account link: ${(e as Error)?.message || "Unknown error"}`,
      },
      500
    );
  }
});

