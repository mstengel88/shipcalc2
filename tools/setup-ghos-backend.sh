#!/usr/bin/env bash
set -Eeuo pipefail

ghos_root="${GHOS_ROOT:-/opt/ghos}"
app_root="${SHIPCALC_ROOT:-/opt/ghos/apps/shipcalc2}"
ghos_env="$ghos_root/.env"
app_env="$app_root/.env"

[[ -r "$ghos_env" ]] || { echo "Missing $ghos_env" >&2; exit 1; }
[[ -f "$app_env" ]] || touch "$app_env"
chmod 600 "$app_env"

read_env() {
  local file="$1" key="$2" line value
  line="$(grep -m 1 -E "^${key}=" "$file" 2>/dev/null || true)"
  value="${line#*=}"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "$value"
}

POSTGRES_USER="$(read_env "$ghos_env" POSTGRES_USER)"
POSTGRES_DB="$(read_env "$ghos_env" POSTGRES_DB)"
POSTGRES_PASSWORD="$(read_env "$ghos_env" POSTGRES_PASSWORD)"
SHOPIFY_STORE_DOMAIN="$(read_env "$ghos_env" SHOPIFY_STORE_DOMAIN)"
SHOPIFY_CLIENT_ID="$(read_env "$ghos_env" SHOPIFY_CLIENT_ID)"
SHOPIFY_CLIENT_SECRET="$(read_env "$ghos_env" SHOPIFY_CLIENT_SECRET)"
SHOPIFY_DRAFT_ORDER_CLIENT_ID="$(read_env "$ghos_env" SHOPIFY_DRAFT_ORDER_CLIENT_ID)"
SHOPIFY_DRAFT_ORDER_CLIENT_SECRET="$(read_env "$ghos_env" SHOPIFY_DRAFT_ORDER_CLIENT_SECRET)"
GOOGLE_MAPS_API_KEY="$(read_env "$ghos_env" GOOGLE_MAPS_API_KEY)"
GOOGLE_MAPS_BROWSER_API_KEY="$(read_env "$ghos_env" GOOGLE_MAPS_BROWSER_API_KEY)"
SHIPCALC_DB_PASSWORD="$(read_env "$app_env" SHIPCALC_DB_PASSWORD)"
SHIPCALC_ADMIN_PASSWORD="$(read_env "$app_env" SHIPCALC_ADMIN_PASSWORD)"

: "${POSTGRES_USER:?POSTGRES_USER is missing from GHOS environment}"
: "${POSTGRES_DB:?POSTGRES_DB is missing from GHOS environment}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is missing from GHOS environment}"

set_env() {
  local key="$1" value="$2" temporary
  temporary="$(mktemp)"
  awk -F= -v key="$key" '$1 != key { print }' "$app_env" > "$temporary"
  printf '%s=%s\n' "$key" "$value" >> "$temporary"
  install -m 0600 "$temporary" "$app_env"
  rm -f "$temporary"
}

db_password="${SHIPCALC_DB_PASSWORD:-$(openssl rand -hex 24)}"
admin_password="${SHIPCALC_ADMIN_PASSWORD:-$(openssl rand -hex 24)}"

docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" ghos-postgres \
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v role="shipcalc" -v pass="$db_password" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'role', :'pass')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'role', :'pass') \gexec
SQL

if ! docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" ghos-postgres \
  psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT 1 FROM pg_database WHERE datname='shipcalc'" | grep -qx 1; then
  docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" ghos-postgres \
    createdb -U "$POSTGRES_USER" -O shipcalc shipcalc
fi

set_env SHIPCALC_DATABASE_URL "postgresql://shipcalc:${db_password}@ghos-postgres:5432/shipcalc"
set_env SHIPCALC_DB_PASSWORD "$db_password"
set_env SHIPCALC_ADMIN_PASSWORD "$admin_password"
set_env SHOPIFY_STORE_DOMAIN "${SHOPIFY_STORE_DOMAIN:-darfaz-2e.myshopify.com}"
set_env SHOPIFY_CLIENT_ID "${SHOPIFY_CLIENT_ID:-${SHOPIFY_DRAFT_ORDER_CLIENT_ID:-}}"
set_env SHOPIFY_CLIENT_SECRET "${SHOPIFY_CLIENT_SECRET:-${SHOPIFY_DRAFT_ORDER_CLIENT_SECRET:-}}"
set_env GOOGLE_MAPS_API_KEY "${GOOGLE_MAPS_API_KEY:-}"

if [[ -n "${GOOGLE_MAPS_BROWSER_API_KEY:-}" ]]; then
  set_env VITE_GOOGLE_MAPS_API_KEY "$GOOGLE_MAPS_BROWSER_API_KEY"
fi

echo "ShipCalc database and environment are configured."
echo "The generated administrator password remains only in $app_env."
