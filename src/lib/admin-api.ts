const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY",
  );
}

const BASE = `${SUPABASE_URL}/functions/v1/shopify-api`;
const HEADERS = {
  "Content-Type": "application/json",
  apikey: SUPABASE_PUBLISHABLE_KEY,
};

export interface OriginAddress {
  id: string;
  label: string;
  address: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShopifyLocation {
  id: number;
  name: string;
  address: string;
}

export interface AppSetting {
  key: string;
  value: string;
  label: string;
  description: string;
  updated_at: string;
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const res = await fetch(`${BASE}?action=verify_admin`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  return data.valid === true;
}

export async function fetchOrigins(): Promise<OriginAddress[]> {
  const res = await fetch(`${BASE}?action=get_origins`, { headers: HEADERS });
  const data = await res.json();
  return data.origins || [];
}

export async function saveOrigin(
  password: string,
  origin: { id?: string; label: string; address: string; is_active: boolean }
): Promise<OriginAddress> {
  const res = await fetch(`${BASE}?action=save_origin`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ password, ...origin }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
  const data = await res.json();
  return data.origin;
}

export async function deleteOrigin(password: string, id: string): Promise<void> {
  const res = await fetch(`${BASE}?action=delete_origin`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ password, id }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to delete");
}

export async function fetchShopifyLocations(): Promise<ShopifyLocation[]> {
  const res = await fetch(`${BASE}?action=locations`, { headers: HEADERS });
  const data = await res.json();
  return data.locations || [];
}

export async function fetchSettings(): Promise<AppSetting[]> {
  const res = await fetch(`${BASE}?action=get_settings`, { headers: HEADERS });
  const data = await res.json();
  return data.settings || [];
}

export async function saveSetting(
  password: string,
  key: string,
  value: string
): Promise<AppSetting> {
  const res = await fetch(`${BASE}?action=save_setting`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ password, key, value }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to save setting");
  const data = await res.json();
  return data.setting;
}
