import crypto from "node:crypto";
import express from "express";
import { pool, initializeDatabase, getSettings, getActiveOrigin, findOriginByLabel } from "./db.mjs";
import { adminQuery, extractGid, mapProduct, productFields } from "./shopify.mjs";
import { calculateShippingCost, getZoneByDistance, TRUCK_TYPES } from "./shipping-calc.mjs";

const app = express();
const port = Number.parseInt(process.env.PORT || "8080", 10);
const fallbackOrigin = "W185 N7487, Narrow Ln, Menomonee Falls, WI 53051";

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

function safeEqual(value, expected) {
  if (!value || !expected) return false;
  const a = Buffer.from(String(value));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireAdmin(body) {
  if (!safeEqual(body?.password, process.env.ADMIN_PASSWORD)) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }
}

async function settingsMap(keys) {
  return Object.fromEntries((await getSettings(keys)).map(({ key, value }) => [key, value]));
}

async function routeQuote(origin, destination, ratePerMinute) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origin);
  url.searchParams.set("destinations", destination);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("units", "imperial");
  const response = await fetch(url);
  const data = await response.json();
  if (data.status !== "OK") throw new Error(`Google Maps error: ${data.status}`);
  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") throw new Error(`No route found: ${element?.status || "UNKNOWN"}`);
  const oneWayMiles = element.distance.value / 1609.34;
  const roundTripMinutes = (element.duration.value * 2) / 60;
  return {
    destination: data.destination_addresses?.[0] || destination,
    oneWayMiles,
    oneWayMinutes: element.duration.value / 60,
    durationText: element.duration.text,
    roundTripMinutes,
    costDollars: roundTripMinutes * ratePerMinute,
  };
}

async function vendorOrigin(variantId) {
  if (!variantId) return null;
  const data = await adminQuery(`query ($id: ID!) { productVariant(id: $id) { product { vendor } } }`, {
    id: `gid://shopify/ProductVariant/${variantId}`,
  });
  const vendor = data.productVariant?.product?.vendor;
  return vendor ? findOriginByLabel(vendor) : null;
}

async function healthHandler(_request, response) {
  try {
    await pool.query("SELECT 1");
    response.json({ status: "ok", database: "ok" });
  } catch {
    response.status(503).json({ status: "degraded", database: "unavailable" });
  }
}

app.get("/healthz", healthHandler);
app.get("/api/healthz", healthHandler);

app.get("/api/public-config", async (_request, response, next) => {
  try {
    const [origin, settings] = await Promise.all([getActiveOrigin(), getSettings()]);
    response.json({ origin, settings });
  } catch (error) { next(error); }
});

app.all("/api/shopify", async (request, response, next) => {
  try {
    const action = request.query.action;
    if (action === "products") {
      const products = [];
      let after = null;
      do {
        const data = await adminQuery(`query ($after: String) { products(first: 250, after: $after) { pageInfo { hasNextPage endCursor } edges { node { ${productFields} } } } }`, { after });
        products.push(...data.products.edges.map(({ node }) => mapProduct(node)));
        after = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
      } while (after);
      return response.json({ products });
    }

    if (action === "product") {
      if (!request.query.product_id) return response.status(400).json({ error: "product_id required" });
      const data = await adminQuery(`query ($id: ID!) { product(id: $id) { ${productFields} } }`, { id: `gid://shopify/Product/${request.query.product_id}` });
      return response.json({ product: mapProduct(data.product) });
    }

    if (action === "shipping_quote") {
      const { product_id, variant_id, quantity, distance_miles, truck_type } = request.body;
      const data = await adminQuery(`query ($id: ID!) { productVariant(id: $id) { inventoryItem { measurement { weight { value unit } } } } }`, {
        id: `gid://shopify/ProductVariant/${variant_id}`,
      });
      const weight = data.productVariant?.inventoryItem?.measurement?.weight;
      const rawWeight = Number(weight?.value || 0);
      const weightLbs = (String(weight?.unit || "POUNDS").toUpperCase() === "KILOGRAMS" ? rawWeight * 2.20462 : rawWeight) * Number(quantity || 1);
      const truck = TRUCK_TYPES.find(({ id }) => id === truck_type) || TRUCK_TYPES[1];
      return response.json({
        product_id, variant_id, quantity,
        weight_lbs: Math.round(weightLbs * 100) / 100,
        distance_miles,
        truck: { id: truck.id, name: truck.name },
        zone: getZoneByDistance(Number(distance_miles)).name,
        ...calculateShippingCost(Number(distance_miles), truck),
      });
    }

    if (action === "drive_time_quote") {
      const { destination, variant_id: variantId } = request.body;
      if (!destination) return response.status(400).json({ error: "destination address required" });
      const config = await settingsMap(["rate_per_minute", "max_miles"]);
      const rate = Number.parseFloat(config.rate_per_minute || "2.08");
      const maxMiles = Number.parseFloat(config.max_miles || "50");
      const active = await getActiveOrigin();
      const origin = (variantId ? await vendorOrigin(variantId).catch(() => null) : null) || active?.address || fallbackOrigin;
      const route = await routeQuote(origin, destination, rate);
      const beyondLimit = route.oneWayMiles > maxMiles;
      return response.json({
        origin,
        destination: route.destination,
        one_way_distance_miles: Math.round(route.oneWayMiles * 10) / 10,
        one_way_duration_text: route.durationText,
        one_way_duration_minutes: Math.round(route.oneWayMinutes * 10) / 10,
        round_trip_minutes: Math.round(route.roundTripMinutes * 10) / 10,
        rate_per_minute: rate,
        total_cost: beyondLimit ? 0 : Math.round(route.costDollars * 100) / 100,
        beyond_mileage_limit: beyondLimit,
        max_miles: maxMiles,
      });
    }

    if (action === "locations") {
      try {
        const data = await adminQuery(`query { locations(first: 50) { edges { node { id name address { address1 address2 city province zip country } } } } }`);
        return response.json({ locations: data.locations.edges.map(({ node }) => ({
          id: extractGid(node.id), name: node.name,
          address: Object.values(node.address || {}).filter(Boolean).join(", "),
        })) });
      } catch {
        return response.json({ locations: [], warning: "Shopify locations unavailable" });
      }
    }

    if (action === "get_origins") {
      const { rows } = await pool.query("SELECT * FROM origin_addresses ORDER BY created_at");
      return response.json({ origins: rows });
    }

    if (action === "save_origin") {
      requireAdmin(request.body);
      const { id, label, address, is_active: isActive } = request.body;
      if (!label?.trim() || !address?.trim()) return response.status(400).json({ error: "Label and address are required" });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        if (isActive) await client.query("UPDATE origin_addresses SET is_active = false, updated_at = now() WHERE id <> COALESCE($1::uuid, gen_random_uuid())", [id || null]);
        const result = id
          ? await client.query("UPDATE origin_addresses SET label=$2, address=$3, is_active=$4, updated_at=now() WHERE id=$1 RETURNING *", [id, label.trim(), address.trim(), Boolean(isActive)])
          : await client.query("INSERT INTO origin_addresses(label,address,is_active) VALUES($1,$2,$3) RETURNING *", [label.trim(), address.trim(), Boolean(isActive)]);
        await client.query("COMMIT");
        return response.json({ origin: result.rows[0] });
      } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    }

    if (action === "delete_origin") {
      requireAdmin(request.body);
      await pool.query("DELETE FROM origin_addresses WHERE id=$1", [request.body.id]);
      return response.json({ success: true });
    }

    if (action === "get_settings") return response.json({ settings: await getSettings() });

    if (action === "save_setting") {
      requireAdmin(request.body);
      const { rows } = await pool.query("UPDATE app_settings SET value=$2, updated_at=now() WHERE key=$1 RETURNING *", [request.body.key, String(request.body.value)]);
      if (!rows[0]) return response.status(404).json({ error: "Setting not found" });
      return response.json({ setting: rows[0] });
    }

    if (action === "verify_admin") return response.json({ valid: safeEqual(request.body?.password, process.env.ADMIN_PASSWORD) });

    if (action === "register_carrier") {
      requireAdmin(request.body);
      const callbackUrl = request.query.callback_url;
      if (!callbackUrl) return response.status(400).json({ error: "callback_url required" });
      const data = await adminQuery(`mutation ($input: DeliveryCarrierServiceCreateInput!) { carrierServiceCreate(input:$input) { carrierService { id name callbackUrl active } userErrors { field message } } }`, {
        input: { name: "GHS Delivery", callbackUrl, active: true, supportsServiceDiscovery: false },
      });
      const result = data.carrierServiceCreate;
      return result.userErrors?.length ? response.status(400).json({ error: result.userErrors }) : response.json({ carrier_service: result.carrierService });
    }

    return response.status(400).json({ error: "Unknown action" });
  } catch (error) { next(error); }
});

app.post("/api/carrier-service", async (request, response) => {
  try {
    const rateRequest = request.body?.rate;
    const destination = rateRequest?.destination;
    if (!destination) return response.json({ rates: [] });
    const destinationAddress = [destination.address1, destination.address2, destination.city, destination.province, destination.postal_code, destination.country].filter(Boolean).join(", ");
    const config = await settingsMap(["max_qty_per_truck", "rate_per_minute", "max_miles", "default_origin"]);
    const maxQty = Number.parseInt(config.max_qty_per_truck || "22", 10);
    const rate = Number.parseFloat(config.rate_per_minute || "2.08");
    const maxMiles = Number.parseFloat(config.max_miles || "50");
    const active = await getActiveOrigin();
    const defaultOrigin = active?.address || config.default_origin || fallbackOrigin;
    const cache = new Map();
    let totalCents = 0;
    let trucks = 0;

    for (const item of rateRequest.items || []) {
      const origin = (item.variant_id ? await vendorOrigin(item.variant_id).catch(() => null) : null) || defaultOrigin;
      const key = `${origin}|${destinationAddress}`;
      const route = cache.get(key) || await routeQuote(origin, destinationAddress, rate);
      cache.set(key, route);
      if (route.oneWayMiles > maxMiles) return response.json({ rates: [] });
      const loads = Math.max(1, Math.ceil(Number(item.quantity || 1) / maxQty));
      totalCents += Math.round(route.costDollars * loads * 100);
      trucks += loads;
    }
    if (!trucks) {
      const route = await routeQuote(defaultOrigin, destinationAddress, rate);
      if (route.oneWayMiles > maxMiles) return response.json({ rates: [] });
      totalCents = Math.round(route.costDollars * 100);
      trucks = 1;
    }
    return response.json({ rates: [{
      service_name: "GHS Delivery", service_code: "ghs_delivery", total_price: String(totalCents),
      description: trucks > 1 ? `Delivery (${trucks} loads required)` : "GHS Delivery",
      currency: rateRequest.currency || "USD", min_delivery_date: null, max_delivery_date: null,
    }] });
  } catch (error) {
    console.error("Carrier quote failed:", error.message);
    return response.json({ rates: [] });
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(error.status || 500).json({ error: error.status ? error.message : "Server operation failed" });
});

await initializeDatabase();
app.listen(port, "0.0.0.0", () => console.log(`ShipCalc API listening on ${port}`));
