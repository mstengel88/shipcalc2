# ShipCalc on GHOS

ShipCalc is deployed to the GHOS Ubuntu VM as a parallel web and API service on
port `8085`. Application settings and origin addresses live in a dedicated
`shipcalc` database on the existing GHOS PostgreSQL container. The cloud Supabase
project and current public ShipCalc remain unchanged until final cutover.

## Configuration

Copy `.env.example` to `.env` on the VM and populate the browser-restricted Google
Maps key plus the server-only database, Shopify, Google Maps, and administrator
credentials. The `.env` file must remain untracked and readable only by the
deployment account.

Only `VITE_GOOGLE_MAPS_API_KEY` is embedded in the browser bundle. Restrict that
key by website origin. All other credentials are injected only into the API
container and must never be committed.

## Deploy and verify

```bash
./tools/setup-ghos-backend.sh
docker compose -f compose.ghos.yml config --quiet
docker compose -f compose.ghos.yml up -d --build
docker compose -f compose.ghos.yml ps
curl --fail http://127.0.0.1:8085/healthz
curl --fail http://127.0.0.1:8085/api/healthz
```

Register both the isolated `shipcalc` database and application files with the
existing encrypted GHOS backup system, then run an immediate backup:

```bash
sudo ./tools/register-ghos-backup.sh
sudo systemctl start ghos-backup.service
sudo systemctl status ghos-backup.service --no-pager -l
```

Import the current cloud data once. This operation only reads Supabase and is
safe to repeat before cutover:

```bash
docker compose -f compose.ghos.yml --profile migration run --rm shipcalc-import
```

Verify `/`, `/quote`, and `/admin` over the LAN or Tailscale address. Confirm that
product lookup, Google Maps, rate calculation, and administrator authentication
match the existing deployment before changing any external traffic.

## Cutover guardrails

- Do not change the Shopify carrier callback during this phase.
- Do not remove or stop the existing ShipCalc instance.
- Importing reads cloud Supabase data but does not modify the cloud project.
- Record a successful browser parity test before configuring a hostname or tunnel.
- Rollback is simply stopping `ghos-shipcalc`; the production system is unaffected.

The local API provides `/api/shopify`, `/api/public-config`, and
`/api/carrier-service`. Do not register the local carrier endpoint with Shopify
until it has a stable HTTPS hostname and parity tests have passed.

## Public tunnel cutover

Create a dedicated Cloudflare Tunnel for ShipCalc. Configure its public hostname
as `shipcalc.ghstickets.com` with service URL `http://ghos-shipcalc:80`. Store the
tunnel token only in `/opt/ghos/apps/shipcalc2/.env`:

```dotenv
SHIPCALC_TUNNEL_TOKEN=replace-with-the-dedicated-tunnel-token
```

Start the isolated tunnel without changing the existing carrier callback:

```bash
docker compose -f compose.cloudflare.yml up -d
docker compose -f compose.cloudflare.yml ps
```

Verify these URLs before updating Shopify:

```text
https://shipcalc.ghstickets.com/healthz
https://shipcalc.ghstickets.com/api/healthz
https://shipcalc.ghstickets.com/api/carrier-service
```

Only after those checks pass should the Shopify carrier service callback move
from its current URL to
`https://shipcalc.ghstickets.com/api/carrier-service`.
