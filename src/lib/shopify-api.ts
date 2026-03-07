import { supabase } from "@/integrations/supabase/client";

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

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

async function callShopifyApi(action: string, params?: Record<string, string>, body?: unknown) {
  const queryParams = new URLSearchParams({ action, ...params });
  const url = `https://${PROJECT_ID}.supabase.co/functions/v1/shopify-api?${queryParams}`;
  
  const options: RequestInit = {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
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

export async function fetchShopifyProducts(limit = 50): Promise<ShopifyProduct[]> {
  const data = await callShopifyApi("products", { limit: String(limit) });
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
}

export async function getDriveTimeQuote(request: DriveTimeQuoteRequest): Promise<DriveTimeQuoteResponse> {
  return callShopifyApi("drive_time_quote", undefined, request);
}
