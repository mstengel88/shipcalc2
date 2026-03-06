import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let SHOPIFY_STORE_DOMAIN = Deno.env.get("SHOPIFY_STORE_DOMAIN");
  if (!SHOPIFY_STORE_DOMAIN) {
    return new Response(JSON.stringify({ error: "SHOPIFY_STORE_DOMAIN not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Clean domain: strip protocol, trailing slashes, /admin paths
  SHOPIFY_STORE_DOMAIN = SHOPIFY_STORE_DOMAIN
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .trim();

  const SHOPIFY_ADMIN_ACCESS_TOKEN = Deno.env.get("SHOPIFY_ADMIN_ACCESS_TOKEN");
  if (!SHOPIFY_ADMIN_ACCESS_TOKEN) {
    return new Response(JSON.stringify({ error: "SHOPIFY_ADMIN_ACCESS_TOKEN not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Debug logging (check edge function logs)
  console.log("Shopify domain:", SHOPIFY_STORE_DOMAIN);
  console.log("Token prefix:", SHOPIFY_ADMIN_ACCESS_TOKEN.substring(0, 8) + "...");
  console.log("Token length:", SHOPIFY_ADMIN_ACCESS_TOKEN.length);

  const shopifyBase = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2026-01`;

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    let shopifyUrl: string;
    let method = "GET";
    let body: string | undefined;

    switch (action) {
      case "products": {
        const limit = url.searchParams.get("limit") || "50";
        const fields = "id,title,variants,product_type,tags";
        shopifyUrl = `${shopifyBase}/products.json?limit=${limit}&fields=${fields}`;
        break;
      }

      case "product": {
        const productId = url.searchParams.get("product_id");
        if (!productId) {
          return new Response(JSON.stringify({ error: "product_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        shopifyUrl = `${shopifyBase}/products/${productId}.json`;
        break;
      }

      case "shipping_zones": {
        shopifyUrl = `${shopifyBase}/shipping_zones.json`;
        break;
      }

      case "shipping_quote": {
        if (req.method !== "POST") {
          return new Response(JSON.stringify({ error: "POST required for shipping_quote" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const quoteBody = await req.json();
        const { product_id, variant_id, quantity, distance_miles, truck_type } = quoteBody;

        // Fetch variant weight from Shopify
        const variantRes = await fetch(
          `${shopifyBase}/variants/${variant_id}.json`,
          {
            headers: {
              "X-Shopify-Access-Token": SHOPIFY_ADMIN_ACCESS_TOKEN,
              "Content-Type": "application/json",
            },
          }
        );

        if (!variantRes.ok) {
          const errText = await variantRes.text();
          throw new Error(`Shopify variant fetch failed [${variantRes.status}]: ${errText}`);
        }

        const variantData = await variantRes.json();
        const variant = variantData.variant;
        const weightLbs = variant.weight_unit === "lb"
          ? variant.weight * quantity
          : variant.weight_unit === "kg"
          ? variant.weight * 2.20462 * quantity
          : variant.weight * quantity;

        // Calculate shipping using our logic
        const { calculateShippingCost, getZoneByDistance, TRUCK_TYPES } = await import("./shipping-calc.ts");
        const truck = TRUCK_TYPES.find((t: { id: string }) => t.id === truck_type) || TRUCK_TYPES[1];
        const costs = calculateShippingCost(distance_miles, weightLbs, truck);
        const zone = getZoneByDistance(distance_miles);

        return new Response(
          JSON.stringify({
            product_id,
            variant_id,
            quantity,
            weight_lbs: Math.round(weightLbs * 100) / 100,
            distance_miles,
            truck: { id: truck.id, name: truck.name },
            zone: zone.name,
            ...costs,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action. Use: products, product, shipping_zones, shipping_quote" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Execute Shopify API call
    const shopifyRes = await fetch(shopifyUrl, {
      method,
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ADMIN_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      body,
    });

    if (!shopifyRes.ok) {
      const errText = await shopifyRes.text();
      throw new Error(`Shopify API call failed [${shopifyRes.status}]: ${errText}`);
    }

    const data = await shopifyRes.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Shopify API error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
