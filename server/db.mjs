import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number.parseInt(process.env.DATABASE_POOL_SIZE || "10", 10),
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

export async function initializeDatabase() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS origin_addresses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      label text NOT NULL DEFAULT 'Default',
      address text NOT NULL,
      is_active boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS origin_addresses_one_active
      ON origin_addresses (is_active) WHERE is_active = true;

    CREATE TABLE IF NOT EXISTS app_settings (
      key text PRIMARY KEY,
      value text NOT NULL,
      label text NOT NULL DEFAULT '',
      description text NOT NULL DEFAULT '',
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    INSERT INTO origin_addresses (label, address, is_active)
    SELECT 'Menomonee Falls', 'W185 N7487, Narrow Ln, Menomonee Falls, WI 53051', true
    WHERE NOT EXISTS (SELECT 1 FROM origin_addresses);
  `);

  const settings = [
    ["rate_per_minute", "2.08", "Rate Per Minute", "Dollar rate charged per minute of round-trip drive time"],
    ["max_qty_per_truck", "22", "Max Qty Per Truck", "Maximum quantity of items per truck load"],
    ["max_miles", "50", "Max Delivery Miles", "Maximum one-way delivery distance in miles"],
    ["phone_number", "(262) 345-4001", "Contact Phone", "Phone number shown when delivery is outside service area"],
    ["default_origin", "W185 N7487, Narrow Ln, Menomonee Falls, WI 53051", "Default Origin Address", "Fallback origin address when no active origin is set"],
    ["show_origin", "true", "Show Origin Address", "Display the origin address below the delivery address input"],
    ["show_distance", "true", "Show Distance", "Display the distance in the quote results"],
    ["show_destination", "true", "Show Destination", "Display the destination address in the quote results"],
    ["show_drive_time", "false", "Show Drive Time", "Display the one-way drive time"],
    ["show_rate_breakdown", "false", "Show Rate Breakdown", "Display the rate and round-trip minutes"],
    ["style_font", "Space Grotesk", "Font Family", "Google Font name for the calculator UI"],
    ["style_bg_color", "#ffffff", "Background Color", "Background color of the calculator card"],
    ["style_text_color", "#1a1a2e", "Text Color", "Main text color in the calculator"],
    ["style_button_color", "#e85d04", "Button Color", "Background color of the calculate button"],
    ["style_button_text_color", "#ffffff", "Button Text Color", "Text color on the calculate button"],
    ["style_accent_color", "#e85d04", "Accent Color", "Color for highlights and the total price"],
  ];

  for (const [key, value, label, description] of settings) {
    await pool.query(
      `INSERT INTO app_settings (key, value, label, description)
       VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO NOTHING`,
      [key, value, label, description],
    );
  }
}

export async function getSettings(keys) {
  const result = keys?.length
    ? await pool.query("SELECT key, value, label, description, updated_at FROM app_settings WHERE key = ANY($1) ORDER BY key", [keys])
    : await pool.query("SELECT key, value, label, description, updated_at FROM app_settings ORDER BY key");
  return result.rows;
}

export async function getActiveOrigin() {
  const { rows } = await pool.query(
    "SELECT id, label, address, is_active, created_at, updated_at FROM origin_addresses WHERE is_active = true LIMIT 1",
  );
  return rows[0] || null;
}

export async function findOriginByLabel(label) {
  const { rows } = await pool.query(
    "SELECT address FROM origin_addresses WHERE lower(label) = lower($1) LIMIT 1",
    [label],
  );
  return rows[0]?.address || null;
}
