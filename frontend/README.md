# Larynx AI Lead Response Studio

A responsive Next.js demo for the real-estate lead engagement workflow. The app presents lead intake, channel-specific consent, first-call timing, the lead ledger, AI conversation insights and follow-up state in one prospect-friendly page.

## Run locally

Use Node.js 20 or newer. Copy `.env.example` to `.env.local`, set a private `DEMO_PASSCODE`, and keep `MODE=demo` and `NEXT_PUBLIC_MODE=demo`. Optionally set `NEXT_PUBLIC_DEMO_PHONE_NUMBER` to a demo number; this value is public in the browser bundle and visible in the page.

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Demo mode uses local fixtures only. New simulated rows are temporary to the current page session and never call n8n.

## Modes

- `demo`: safe fixture experience. No n8n network calls.
- `test`: server-side reads and intake requests to n8n. With the described `TEST_MODE=true` workflow, intake acknowledges and runs its no-external-calls health path. The webhook does not return detailed health output, stage this lead or place a call/message.
- `live`: exact-number confirmation, passcode and rate limit. Live sends also require `N8N_LIVE_SENDS_ENABLED=true`. In production, configure Upstash Redis first or the route fails closed. Only enable this after n8n is explicitly out of TEST_MODE and the provider integration has been tested with an opted-in number.

Set both `MODE` and `NEXT_PUBLIC_MODE` to the same value. The server setting is authoritative.

## Connect the read-only n8n API

The export is at `../outputs/deliverables/larynx31-read-api.workflow.json`; its least-privilege PostgreSQL role setup is at `../outputs/deliverables/larynx31-read-api-setup.sql`. Import the JSON as a **new** workflow; this app does not import, activate, or edit workflow 31.

1. On the PostgreSQL server containing the `larynx31` ledger, run the SQL script as an administrator. Set the created role's password interactively with `psql` command `\\password larynx31_api_readonly`.
2. In n8n, create a Header Auth credential named `Larynx31 Read API Header Auth`. Choose a private header name and strong random value. Assign it to both Webhook nodes after import.
3. Create a Postgres credential named `Larynx31 Ledger Readonly` using the read-only role above. Select it on both Postgres nodes.
4. Verify the production webhook URLs are `/webhook/larynx-31-api/leads` and `/webhook/larynx-31-api/leads/:lead_id`. Activate the new read API only after selecting credentials and confirming SELECT-only queries. Do not import it over My workflow 31.
5. Set server environment variables using the read API Header Auth name/value and the intake credential's configured header name/value. The current live workflow inspection reports `X-API-KEY` on its inbound hooks; the credential value remains private. Keep all secrets out of `NEXT_PUBLIC_*` variables.

The export masks numbers in the SQL projection before returning data. API calls are read-only, limited to 250 leads, and return sanitized errors. Successful reads are not cached.

## Environment configuration

| Variable | Needed for |
| --- | --- |
| `MODE`, `NEXT_PUBLIC_MODE` | App mode. Keep equal. |
| `DEMO_PASSCODE` | All send actions, including demo simulation. Server only. |
| `NEXT_PUBLIC_DEMO_PHONE_NUMBER` | Optional public form prefill; it will be visible to visitors. |
| `N8N_BASE_URL` | n8n origin for read/intake webhook defaults. |
| `N8N_READ_API_HEADER_NAME`, `N8N_READ_API_KEY` | Dedicated read API credential. Server only. |
| `N8N_INTAKE_AUTH_HEADER_NAME`, `N8N_INTAKE_AUTH_HEADER_VALUE` | Intake webhook credential. Server only. |
| `N8N_READ_API_BASE_URL`, `N8N_INTAKE_WEBHOOK_URL` | Optional explicit URL overrides. |
| `N8N_LIVE_SENDS_ENABLED` | Keep `false` until controlled production readiness is complete. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Required for production live-mode rate limiting. Server only. |

See `../CONTRACT.md` for response shapes, data mapping, security boundaries and assumptions. The live MCP inspection currently shows My workflow 31 is inactive. Its production intake endpoint cannot serve test/live requests until an operator activates it. This app does not activate it. Confirm the live n8n workflow/TEST_MODE settings and credentials before configuring test/live mode.

## Deploy to Vercel

1. Push this folder to a Git repository and import the repository in Vercel. Set the project root to `frontend` if the repository root is the parent folder.
2. Keep the build command as `npm run build` and install command as `npm install`.
3. Add `MODE`, `NEXT_PUBLIC_MODE`, and `DEMO_PASSCODE` for every deployment. For a stage demo, set both mode values to `demo`; do not add any n8n/provider secrets.
4. For test mode, add `N8N_BASE_URL`, the dedicated read API header name/key, and intake webhook header name/value. Import and configure the separate read-only API first.
5. For live mode, add the Upstash REST URL/token, and only set `N8N_LIVE_SENDS_ENABLED=true` after confirming the live workflow is out of TEST_MODE and all provider, consent, template, and credential checks are complete. Production live mode fails closed without durable Upstash rate limiting.
6. Redeploy after changing environment variables. The public demo phone is optional; only use a number you control and have opted in to receive test calls/messages.

## Checks

```sh
npm run typecheck
npm run build
```
