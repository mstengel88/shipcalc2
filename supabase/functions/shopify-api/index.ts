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

  const STOREFRONT_TOKEN = Deno.env.get("SHOPIFY_STOREFRONT_ACCESS_TOKEN");
  if (!STOREFRONT_TOKEN) {
    return new Response(JSON.stringify({ error: "SHOPIFY_STOREFRONT_ACCESS_TOKEN not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("Domain:", SHOPIFY_STORE_DOMAIN);
  console.log("Token prefix:", STOREFRONT_TOKEN.substring(0, 10) + "...");

  const storefrontUrl = `https://${SHOPIFY_STORE_DOMAIN}/api/2024-10/graphql.json`;

  async function adminQuery(query: string, variables?: Record<string, unknown>) {
    const res = await fetch(storefrontUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Shopify-Storefront-Private-Token": STOREFRONT_TOKEN!,
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
                        price {
                          amount
                          currencyCode
                        }
                        weight
                        weightUnit
                        sku
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
            variants: node.variants.edges.map((ve: any) => ({
              id: extractGid(ve.node.id),
              title: ve.node.title,
              price: ve.node.price.amount,
              weight: ve.node.weight || 0,
              weight_unit: (ve.node.weightUnit || "POUNDS").toLowerCase(),
              sku: ve.node.sku || "",
            })),
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
                    price {
                      amount
                      currencyCode
                    }
                    weight
                    weightUnit
                    sku
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
          variants: node.variants.edges.map((ve: any) => ({
            id: extractGid(ve.node.id),
            title: ve.node.title,
            price: ve.node.price.amount,
            weight: ve.node.weight || 0,
            weight_unit: (ve.node.weightUnit || "POUNDS").toLowerCase(),
            sku: ve.node.sku || "",
          })),
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

        // Fetch variant weight via Storefront API
        const gid = `gid://shopify/ProductVariant/${variant_id}`;
        const data = await adminQuery(`
          query Variant($id: ID!) {
            node(id: $id) {
              ... on ProductVariant {
                id
                weight
                weightUnit
              }
            }
          }
        `, { id: gid });

        const variantNode = data.node;
        const rawWeight = variantNode?.weight || 0;
        const weightUnit = (variantNode?.weightUnit || "POUNDS").toLowerCase();
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
