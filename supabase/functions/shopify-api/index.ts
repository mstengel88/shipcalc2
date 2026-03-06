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

  SHOPIFY_STORE_DOMAIN = SHOPIFY_STORE_DOMAIN
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .trim();

  const CLIENT_ID = Deno.env.get("SHOPIFY_CLIENT_ID");
  const CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET");
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return new Response(JSON.stringify({ error: "SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET required" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("Domain:", SHOPIFY_STORE_DOMAIN);
  console.log("Client ID:", CLIENT_ID.substring(0, 8) + "...");

  // Exchange client credentials for Admin API access token
  async function getAccessToken(): Promise<string> {
    const tokenUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`;
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "client_credentials",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Token exchange failed [${res.status}]: ${errText}`);
    }

    const json = await res.json();
    console.log("Got access token, prefix:", json.access_token?.substring(0, 10) + "...");
    return json.access_token;
  }

  const accessToken = await getAccessToken();
  const adminUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/graphql.json`;

  async function adminQuery(query: string, variables?: Record<string, unknown>) {
    const res = await fetch(adminUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Admin API failed [${res.status}]: ${errText}`);
    }

    const json = await res.json();
    if (json.errors) {
      throw new Error(`Admin GraphQL errors: ${JSON.stringify(json.errors)}`);
    }
    return json.data;
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    switch (action) {
      case "products": {
        const limit = parseInt(url.searchParams.get("limit") || "50", 10);
        const data = await adminQuery(`
          query Products($first: Int!) {
            products(first: $first) {
              edges {
                node {
                  id
                  title
                  productType
                  tags
                  variants(first: 100) {
                    edges {
                      node {
                        id
                        title
                        price
                        sku
                        inventoryItem {
                          measurement {
                            weight {
                              value
                              unit
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `, { first: Math.min(limit, 250) });

        // Transform GraphQL response to match our existing interface
        const products = data.products.edges.map((edge: any) => {
          const node = edge.node;
          return {
            id: extractGid(node.id),
            title: node.title,
            product_type: node.productType,
            tags: node.tags.join(", "),
            variants: node.variants.edges.map((ve: any) => {
              const w = ve.node.inventoryItem?.measurement?.weight;
              return {
                id: extractGid(ve.node.id),
                title: ve.node.title,
                price: ve.node.price,
                weight: w?.value || 0,
                weight_unit: (w?.unit || "POUNDS").toLowerCase(),
                sku: ve.node.sku || "",
              };
            }),
          };
        });

        return new Response(JSON.stringify({ products }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "product": {
        const productId = url.searchParams.get("product_id");
        if (!productId) {
          return new Response(JSON.stringify({ error: "product_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const gid = `gid://shopify/Product/${productId}`;
        const data = await adminQuery(`
          query Product($id: ID!) {
            product(id: $id) {
              id
              title
              productType
              tags
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    price
                    sku
                    inventoryItem {
                      measurement {
                        weight {
                          value
                          unit
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `, { id: gid });

        const node = data.product;
        const product = {
          id: extractGid(node.id),
          title: node.title,
          product_type: node.productType,
          tags: node.tags.join(", "),
          variants: node.variants.edges.map((ve: any) => {
            const w = ve.node.inventoryItem?.measurement?.weight;
            return {
              id: extractGid(ve.node.id),
              title: ve.node.title,
              price: ve.node.price,
              weight: w?.value || 0,
              weight_unit: (w?.unit || "POUNDS").toLowerCase(),
              sku: ve.node.sku || "",
            };
          }),
        };

        return new Response(JSON.stringify({ product }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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

        // Fetch variant weight via Admin API
        const gid = `gid://shopify/ProductVariant/${variant_id}`;
        const data = await adminQuery(`
          query Variant($id: ID!) {
            productVariant(id: $id) {
              id
              inventoryItem {
                measurement {
                  weight {
                    value
                    unit
                  }
                }
              }
            }
          }
        `, { id: gid });

        const w = data.productVariant?.inventoryItem?.measurement?.weight;
        const rawWeight = w?.value || 0;
        const weightUnit = (w?.unit || "POUNDS").toLowerCase();
        const weightLbs = weightUnit === "kilograms"
          ? rawWeight * 2.20462 * quantity
          : rawWeight * quantity;

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

      case "drive_time_quote": {
        if (req.method !== "POST") {
          return new Response(JSON.stringify({ error: "POST required for drive_time_quote" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
        if (!GOOGLE_MAPS_API_KEY) {
          return new Response(JSON.stringify({ error: "GOOGLE_MAPS_API_KEY not configured" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const ORIGIN_ADDRESS = "W185 N7487, Narrow Ln, Menomonee Falls, WI 53051";
        const RATE_PER_MINUTE = 2.08;

        const body = await req.json();
        const { destination } = body;

        if (!destination) {
          return new Response(JSON.stringify({ error: "destination address required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Call Google Maps Directions API
        const mapsUrl = new URL("https://maps.googleapis.com/maps/api/directions/json");
        mapsUrl.searchParams.set("origin", ORIGIN_ADDRESS);
        mapsUrl.searchParams.set("destination", destination);
        mapsUrl.searchParams.set("key", GOOGLE_MAPS_API_KEY);
        mapsUrl.searchParams.set("units", "imperial");

        const mapsRes = await fetch(mapsUrl.toString());
        const mapsData = await mapsRes.json();

        if (mapsData.status !== "OK" || !mapsData.routes?.length) {
          return new Response(
            JSON.stringify({ error: `Google Maps error: ${mapsData.status}`, details: mapsData.error_message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const leg = mapsData.routes[0].legs[0];
        const oneWaySeconds = leg.duration.value;
        const oneWayMiles = leg.distance.value / 1609.34;
        const roundTripMinutes = (oneWaySeconds * 2) / 60;
        const totalCost = roundTripMinutes * RATE_PER_MINUTE;

        return new Response(
          JSON.stringify({
            origin: ORIGIN_ADDRESS,
            destination: leg.end_address,
            one_way_distance_miles: Math.round(oneWayMiles * 10) / 10,
            one_way_duration_text: leg.duration.text,
            one_way_duration_minutes: Math.round(oneWaySeconds / 60 * 10) / 10,
            round_trip_minutes: Math.round(roundTripMinutes * 10) / 10,
            rate_per_minute: RATE_PER_MINUTE,
            total_cost: Math.round(totalCost * 100) / 100,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action. Use: products, product, shipping_quote" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("Shopify API error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/** Extract numeric ID from Shopify GID (e.g. "gid://shopify/Product/123" → "123") */
function extractGid(gid: string): number {
  const parts = gid.split("/");
  return parseInt(parts[parts.length - 1], 10);
}
