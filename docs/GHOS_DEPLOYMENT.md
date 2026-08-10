# ShipCalc on GHOS

ShipCalc is initially deployed to the GHOS Ubuntu VM as a parallel web service on
port `8085`. This first phase deliberately keeps the existing production Supabase
project, Edge Functions, Shopify carrier service, and current public ShipCalc
instance unchanged.

## Configuration

Copy `.env.example` to `.env` on the VM and populate the existing production
public client configuration. The `.env` file must remain untracked and readable
only by the deployment account.

The Vite variables are embedded into the browser bundle during the image build.
They are public client configuration, not server credentials. Shopify client
secrets, the Supabase service-role key, and the administrator password must not be
placed in this file; they remain protected in the existing Supabase Edge Function
configuration until the backend migration phase.

## Deploy and verify

```bash
docker compose -f compose.ghos.yml config --quiet
docker compose -f compose.ghos.yml up -d --build
docker compose -f compose.ghos.yml ps
curl --fail http://127.0.0.1:8085/healthz
```

Verify `/`, `/quote`, and `/admin` over the LAN or Tailscale address. Confirm that
product lookup, Google Maps, rate calculation, and administrator authentication
match the existing deployment before changing any external traffic.

## Cutover guardrails

- Do not change the Shopify carrier callback during this phase.
- Do not remove or stop the existing ShipCalc instance.
- Do not migrate or modify production Supabase data during this phase.
- Record a successful browser parity test before configuring a hostname or tunnel.
- Rollback is simply stopping `ghos-shipcalc`; the production system is unaffected.

The later backend phase will migrate the two application tables and the
`shopify-api` and `carrier-service` functions, validate them against a test
callback, and only then schedule the Shopify carrier-service cutover.
