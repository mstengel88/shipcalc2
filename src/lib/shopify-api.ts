export interface ShopifyProduct {
  id: number;
  title: string;
  vendor: string;
  product_type: string;
  tags: string;
  variants: ShopifyVariant[];
}

export interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  weight: number;
  weight_unit: string;
  sku: string;
}

export interface ShippingQuoteRequest {
  product_id: number;
  variant_id: number;
  quantity: number;
  distance_miles: number;
  truck_type: string;
}

export interface ShippingQuoteResponse {
  product_id: number;
  variant_id: number;
  quantity: number;
  weight_lbs: number;
  distance_miles: number;
  truck: { id: string; name: string };
  zone: string;
  baseCost: number;
  fuelSurcharge: number;
  total: number;
}

const API_BASE = (import.meta.env.VITE_SHIPCALC_API_URL || "/api").replace(/\/+$/, "");

async function callShopifyApi(action: string, params?: Record<string, string>, body?: unknown) {
  const queryParams = new URLSearchParams({ action, ...params });
  const url = `${API_BASE}/shopify?${queryParams}`;
  
  const options: RequestInit = {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `API call failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchShopifyProducts(): Promise<ShopifyProduct[]> {
  const data = await callShopifyApi("products");
  return data.products || [];
}

export async function fetchShopifyProduct(productId: number): Promise<ShopifyProduct> {
  const data = await callShopifyApi("product", { product_id: String(productId) });
  return data.product;
}

export async function getShippingQuote(request: ShippingQuoteRequest): Promise<ShippingQuoteResponse> {
  return callShopifyApi("shipping_quote", undefined, request);
}

export interface DriveTimeQuoteRequest {
  destination: string;
  variant_id?: number;
}

export interface DriveTimeQuoteResponse {
  origin: string;
  destination: string;
  one_way_distance_miles: number;
  one_way_duration_text: string;
  one_way_duration_minutes: number;
  round_trip_minutes: number;
  rate_per_minute: number;
  total_cost: number;
  beyond_mileage_limit?: boolean;
  max_miles?: number;
}

export async function getDriveTimeQuote(request: DriveTimeQuoteRequest): Promise<DriveTimeQuoteResponse> {
  return callShopifyApi("drive_time_quote", undefined, request);
}

export interface PublicConfig {
  origin: { label: string; address: string } | null;
  settings: Array<{ key: string; value: string }>;
}

export async function fetchPublicConfig(): Promise<PublicConfig> {
  const response = await fetch(`${API_BASE}/public-config`);
  if (!response.ok) throw new Error("Unable to load calculator configuration");
  return response.json();
}
