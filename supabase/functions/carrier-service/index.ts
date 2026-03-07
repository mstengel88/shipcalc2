import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function getActiveOriginAddress(): Promise<string> {
  const { data } = await supabaseAdmin
    .from("origin_addresses")
    .select("address")
    .eq("is_active", true)
    .limit(1)
    .single();
  return data?.address || "W185 N7487, Narrow Ln, Menomonee Falls, WI 53051";
}

async function getShopifyAccessToken(): Promise<string | null> {
  const domain = Deno.env.get("SHOPIFY_STORE_DOMAIN")?.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
  const clientId = Deno.env.get("SHOPIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("SHOPIFY_CLIENT_SECRET");
  if (!domain || !clientId || !clientSecret) return null;

  try {
    const tokenRes = await fetch(`https://${domain}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
    });
    if (!tokenRes.ok) return null;
    const tokenData = await tokenRes.json();
    return tokenData.access_token;
  } catch {
    return null;
  }
}

async function getOriginFromProductInventory(variantId: number): Promise<string | null> {
  const domain = Deno.env.get("SHOPIFY_STORE_DOMAIN")?.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
  const accessToken = await getShopifyAccessToken();
  if (!accessToken || !domain) return null;

  try {
    const gid = `gid://shopify/ProductVariant/${variantId}`;
    const res = await fetch(`https://${domain}/admin/api/2024-10/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: `query VariantLocation($id: ID!) {
          productVariant(id: $id) {
            inventoryItem {
              inventoryLevels(first: 1) {
                edges {
                  node {
                    location {
                      name
                      address {
                        address1
                        address2
                        city
                        province
                        zip
                        country
                      }
                    }
                  }
                }
              }
            }
          }
        }`,
        variables: { id: gid },
      }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const loc = json.data?.productVariant?.inventoryItem?.inventoryLevels?.edges?.[0]?.node?.location;
    if (!loc) return null;

    const a = loc.address;
    const fullAddress = [a.address1, a.address2, a.city, a.province, a.zip, a.country].filter(Boolean).join(", ");
    console.log(`Resolved inventory location for variant ${variantId}: ${loc.name} — ${fullAddress}`);
    return fullAddress || null;
  } catch (err) {
    console.error("Failed to fetch inventory location:", err);
    return null;
  }
}

const RATE_PER_MINUTE = 2.08;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ rates: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const rateRequest = body.rate;

    if (!rateRequest) {
      console.error("No rate object in request body");
      return new Response(JSON.stringify({ rates: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dest = rateRequest.destination;
    if (!dest) {
      console.error("No destination in rate request");
      return new Response(JSON.stringify({ rates: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build destination address string
    const destParts = [
      dest.address1,
      dest.address2,
      dest.city,
      dest.province,
      dest.postal_code,
      dest.country,
    ].filter(Boolean);
    const destinationAddress = destParts.join(", ");

    console.log("Carrier service request for destination:", destinationAddress);

    // Try to resolve origin from the first item's inventory location in Shopify
    let ORIGIN_ADDRESS: string | null = null;
    const items = rateRequest.items;
    if (items && items.length > 0) {
      const firstVariantId = items[0].variant_id;
      if (firstVariantId) {
        ORIGIN_ADDRESS = await getOriginFromProductInventory(firstVariantId);
      }
    }

    // Fall back to active origin from DB
    if (!ORIGIN_ADDRESS) {
      ORIGIN_ADDRESS = await getActiveOriginAddress();
    }

    console.log("Using origin address:", ORIGIN_ADDRESS);
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!GOOGLE_MAPS_API_KEY) {
      console.error("GOOGLE_MAPS_API_KEY not configured");
      return new Response(JSON.stringify({ rates: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Google Maps Distance Matrix API
    const mapsUrl = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    mapsUrl.searchParams.set("origins", ORIGIN_ADDRESS);
    mapsUrl.searchParams.set("destinations", destinationAddress);
    mapsUrl.searchParams.set("key", GOOGLE_MAPS_API_KEY);
    mapsUrl.searchParams.set("units", "imperial");

    const mapsRes = await fetch(mapsUrl.toString());
    const mapsData = await mapsRes.json();

    if (mapsData.status !== "OK") {
      console.error("Google Maps error:", mapsData.status, mapsData.error_message);
      return new Response(JSON.stringify({ rates: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const element = mapsData.rows?.[0]?.elements?.[0];
    if (!element || element.status !== "OK") {
      console.error("No route found:", element?.status);
      return new Response(JSON.stringify({ rates: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const oneWaySeconds = element.duration.value;
    const roundTripMinutes = (oneWaySeconds * 2) / 60;
    const totalCostDollars = roundTripMinutes * RATE_PER_MINUTE;
    const totalPriceCents = Math.round(totalCostDollars * 100);

    const oneWayMiles = Math.round(element.distance.value / 1609.34 * 10) / 10;

    console.log(`Route: ${oneWayMiles} mi one-way, ${Math.round(roundTripMinutes)} min round-trip, $${totalCostDollars.toFixed(2)}`);

    const rates = [
      {
        service_name: "GHS Delivery",
        service_code: "ghs_delivery",
        total_price: String(totalPriceCents),
        description: `Delivery (${oneWayMiles} mi, ~${element.duration.text} one-way)`,
        currency: rateRequest.currency || "USD",
        min_delivery_date: null,
        max_delivery_date: null,
      },
    ];

    return new Response(JSON.stringify({ rates }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Carrier service error:", error);
    return new Response(JSON.stringify({ rates: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
