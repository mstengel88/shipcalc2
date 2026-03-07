import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("fetch products with vendor field", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/shopify-api?action=products&limit=3`, {
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
  });
  assertEquals(res.status, 200);
  const data = await res.json();
  console.log(
    "Products:",
    JSON.stringify(
      data.products?.map((p: any) => ({
        id: p.id,
        title: p.title,
        vendor: p.vendor,
        variant_id: p.variants?.[0]?.id,
      })),
      null,
      2
    )
  );
  // Verify vendor field is present
  if (data.products?.length > 0) {
    console.log("First product vendor:", data.products[0].vendor);
  }
});

Deno.test("carrier-service resolves vendor-based origin", async () => {
  // Get a real variant_id
  const prodRes = await fetch(`${SUPABASE_URL}/functions/v1/shopify-api?action=products&limit=1`, {
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
  });
  const prodData = await prodRes.json();
  const variantId = prodData.products?.[0]?.variants?.[0]?.id;
  const vendor = prodData.products?.[0]?.vendor;
  console.log("Using variant_id:", variantId, "vendor:", vendor);

  if (!variantId) {
    console.log("No products found, skipping");
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/carrier-service`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({
      rate: {
        destination: {
          address1: "123 Main St",
          city: "Milwaukee",
          province: "WI",
          postal_code: "53202",
          country: "US",
        },
        items: [{ variant_id: variantId, quantity: 1 }],
        currency: "USD",
      },
    }),
  });
  assertEquals(res.status, 200);
  const data = await res.json();
  console.log("Carrier response:", JSON.stringify(data, null, 2));
  assertEquals(Array.isArray(data.rates), true);
});
