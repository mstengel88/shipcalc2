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

  const clientId = Deno.env.get("SHOPIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("SHOPIFY_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: "SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET required" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("Domain:", SHOPIFY_STORE_DOMAIN);
  console.log("Client ID prefix:", clientId.substring(0, 10) + "...");

  // Exchange client credentials for access token
  let accessToken: string;
  try {
    const tokenRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Token exchange failed:", tokenRes.status, errText);
      return new Response(JSON.stringify({ error: `Token exchange failed: ${errText}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenData = await tokenRes.json();
    accessToken = tokenData.access_token;
    console.log("Got access token, scope:", tokenData.scope);
  } catch (err) {
    console.error("Token exchange error:", err);
    return new Response(JSON.stringify({ error: `Token exchange error: ${err}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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

        const ORIGIN_ADDRESS = await getActiveOriginAddress();
        const RATE_PER_MINUTE = 2.08;

        const body = await req.json();
        const { destination } = body;

        if (!destination) {
          return new Response(JSON.stringify({ error: "destination address required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Call Google Maps Distance Matrix API
        const mapsUrl = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
        mapsUrl.searchParams.set("origins", ORIGIN_ADDRESS);
        mapsUrl.searchParams.set("destinations", destination);
        mapsUrl.searchParams.set("key", GOOGLE_MAPS_API_KEY);
        mapsUrl.searchParams.set("units", "imperial");

        const mapsRes = await fetch(mapsUrl.toString());
        const mapsData = await mapsRes.json();

        if (mapsData.status !== "OK") {
          return new Response(
            JSON.stringify({ error: `Google Maps error: ${mapsData.status}`, details: mapsData.error_message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const element = mapsData.rows?.[0]?.elements?.[0];
        if (!element || element.status !== "OK") {
          return new Response(
            JSON.stringify({ error: `No route found: ${element?.status || "UNKNOWN"}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const oneWaySeconds = element.duration.value;
        const oneWayMiles = element.distance.value / 1609.34;
        const roundTripMinutes = (oneWaySeconds * 2) / 60;
        const totalCost = roundTripMinutes * RATE_PER_MINUTE;

        return new Response(
          JSON.stringify({
            origin: ORIGIN_ADDRESS,
            destination: mapsData.destination_addresses?.[0] || destination,
            one_way_distance_miles: Math.round(oneWayMiles * 10) / 10,
            one_way_duration_text: element.duration.text,
            one_way_duration_minutes: Math.round(oneWaySeconds / 60 * 10) / 10,
            round_trip_minutes: Math.round(roundTripMinutes * 10) / 10,
            rate_per_minute: RATE_PER_MINUTE,
            total_cost: Math.round(totalCost * 100) / 100,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "locations": {
        const data = await adminQuery(`
          query {
            locations(first: 50) {
              edges {
                node {
                  id
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
        `);

        const locations = data.locations.edges.map((edge: any) => {
          const n = edge.node;
          const a = n.address;
          const fullAddress = [a.address1, a.address2, a.city, a.province, a.zip, a.country].filter(Boolean).join(", ");
          return {
            id: extractGid(n.id),
            name: n.name,
            address: fullAddress,
          };
        });

        return new Response(JSON.stringify({ locations }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_origins": {
        const origins = await supabaseAdmin.from("origin_addresses").select("*").order("created_at");
        return new Response(JSON.stringify({ origins: origins.data || [] }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "save_origin": {
        if (req.method !== "POST") {
          return new Response(JSON.stringify({ error: "POST required" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const saveBody = await req.json();
        const adminPassword = Deno.env.get("ADMIN_PASSWORD");
        if (!adminPassword || saveBody.password !== adminPassword) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { label, address, is_active, id: originId } = saveBody;

        // If setting active, deactivate others first
        if (is_active) {
          await supabaseAdmin.from("origin_addresses").update({ is_active: false, updated_at: new Date().toISOString() }).neq("id", originId || "");
        }

        if (originId) {
          const { data, error: err } = await supabaseAdmin.from("origin_addresses")
            .update({ label, address, is_active, updated_at: new Date().toISOString() })
            .eq("id", originId)
            .select()
            .single();
          if (err) throw new Error(err.message);
          return new Response(JSON.stringify({ origin: data }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else {
          const { data, error: err } = await supabaseAdmin.from("origin_addresses")
            .insert({ label, address, is_active })
            .select()
            .single();
          if (err) throw new Error(err.message);
          return new Response(JSON.stringify({ origin: data }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      case "delete_origin": {
        if (req.method !== "POST") {
          return new Response(JSON.stringify({ error: "POST required" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const delBody = await req.json();
        const delPassword = Deno.env.get("ADMIN_PASSWORD");
        if (!delPassword || delBody.password !== delPassword) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        await supabaseAdmin.from("origin_addresses").delete().eq("id", delBody.id);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "verify_admin": {
        if (req.method !== "POST") {
          return new Response(JSON.stringify({ error: "POST required" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const verifyBody = await req.json();
        const pw = Deno.env.get("ADMIN_PASSWORD");
        if (!pw || verifyBody.password !== pw) {
          return new Response(JSON.stringify({ valid: false }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ valid: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "register_carrier": {
        const callbackUrl = url.searchParams.get("callback_url");
        if (!callbackUrl) {
          return new Response(JSON.stringify({ error: "callback_url required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const registerData = await adminQuery(`
          mutation carrierServiceCreate($input: DeliveryCarrierServiceCreateInput!) {
            carrierServiceCreate(input: $input) {
              carrierService {
                id
                name
                callbackUrl
                active
              }
              userErrors {
                field
                message
              }
            }
          }
        `, {
          input: {
            name: "GHS Delivery",
            callbackUrl: callbackUrl,
            active: true,
            supportsServiceDiscovery: false,
          },
        });

        const result = registerData.carrierServiceCreate;
        if (result.userErrors?.length > 0) {
          return new Response(JSON.stringify({ error: result.userErrors }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ carrier_service: result.carrierService }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action. Use: products, product, shipping_quote, register_carrier" }),
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
