let tokenCache = { token: null, expiresAt: 0 };

export function shopifyDomain() {
  return (process.env.SHOPIFY_STORE_DOMAIN || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .trim();
}

export async function getShopifyAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  const domain = shopifyDomain();
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!domain || !clientId || !clientSecret) throw new Error("Shopify credentials are not configured");

  const response = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
  });
  if (!response.ok) throw new Error(`Shopify token exchange failed (${response.status})`);
  const data = await response.json();
  tokenCache = { token: data.access_token, expiresAt: Date.now() + Math.max(60, (data.expires_in || 3600) - 120) * 1000 };
  return tokenCache.token;
}

export async function adminQuery(query, variables = {}) {
  const domain = shopifyDomain();
  const token = await getShopifyAccessToken();
  const response = await fetch(`https://${domain}/admin/api/2026-07/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`Shopify Admin API failed (${response.status})`);
  const body = await response.json();
  if (body.errors) throw new Error(`Shopify GraphQL error: ${JSON.stringify(body.errors)}`);
  return body.data;
}

export function extractGid(gid) {
  return Number.parseInt(gid.split("/").at(-1), 10);
}

export function mapProduct(node) {
  return {
    id: extractGid(node.id),
    title: node.title,
    vendor: node.vendor || "",
    product_type: node.productType || "",
    tags: (node.tags || []).join(", "),
    variants: node.variants.edges.map(({ node: variant }) => {
      const weight = variant.inventoryItem?.measurement?.weight;
      return {
        id: extractGid(variant.id),
        title: variant.title,
        price: variant.price,
        weight: weight?.value || 0,
        weight_unit: (weight?.unit || "POUNDS").toLowerCase(),
        sku: variant.sku || "",
      };
    }),
  };
}

export const productFields = `
  id title vendor productType tags
  variants(first: 100) { edges { node { id title price sku inventoryItem { measurement { weight { value unit } } } } } }
`;
