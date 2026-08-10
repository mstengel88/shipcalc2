import { initializeDatabase, pool } from "./db.mjs";

const cloudUrl = process.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const cloudKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!cloudUrl || !cloudKey) throw new Error("Cloud Supabase URL and publishable key are required for one-time import");

async function read(table) {
  const response = await fetch(`${cloudUrl}/rest/v1/${table}?select=*`, { headers: { apikey: cloudKey } });
  if (!response.ok) throw new Error(`Cloud export of ${table} failed (${response.status})`);
  return response.json();
}

await initializeDatabase();
const [origins, settings] = await Promise.all([read("origin_addresses"), read("app_settings")]);
const client = await pool.connect();
try {
  await client.query("BEGIN");
  if (origins.length) {
    await client.query("DELETE FROM origin_addresses");
    for (const row of origins) {
      await client.query(
        "INSERT INTO origin_addresses(id,label,address,is_active,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6)",
        [row.id, row.label, row.address, row.is_active, row.created_at, row.updated_at],
      );
    }
  }
  for (const row of settings) {
    await client.query(
      `INSERT INTO app_settings(key,value,label,description,updated_at) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value,label=excluded.label,description=excluded.description,updated_at=excluded.updated_at`,
      [row.key, row.value, row.label, row.description, row.updated_at],
    );
  }
  await client.query("COMMIT");
  console.log(`Imported ${origins.length} origins and ${settings.length} settings`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
