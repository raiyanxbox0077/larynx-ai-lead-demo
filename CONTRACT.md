# Larynx AI demo contract

This app is a one-page prospect demo for the Larynx AI real-estate lead flow. The browser talks only to the Next.js app. Server Route Handlers hold the n8n and passcode secrets, authenticate n8n requests, and return a masked, read-only view of the ledger.

## Operating modes

`MODE` is the authoritative server setting; `NEXT_PUBLIC_MODE` controls the initial public badge during page load. Set them to the same value (`demo`, `test`, or `live`). The API response corrects the page badge to the server mode.

- **demo** serves local fixtures and simulates a lead and activity timeline in the app. It makes no requests to n8n and does not place calls or send messages. Each newly simulated row exists in browser memory for that page session only.
- **test** posts to the real intake webhook and reads the real read API. The current workflow contract has `TEST_MODE=true`: the webhook responds immediately with `{"accepted":true}` and execution is routed to its no-external-calls health path. That acknowledgment does not include the health report and does not mean the lead was staged. The detailed health result is visible in n8n execution history. The UI explicitly reports that no real call or WhatsApp was placed.
- **live** is guarded twice. The server refuses to send until `N8N_LIVE_SENDS_ENABLED=true`, which should only be set after an operator confirms n8n is out of TEST_MODE and has completed a controlled integration test. The browser asks the presenter to confirm the exact normalized number. Production live sends fail closed unless Upstash Redis rate limiting is configured.

Every send action in every mode requires `DEMO_PASSCODE`. Calls and WhatsApp are separate permissions; an unchecked box remains false in the intake request and the existing workflow is expected to suppress that channel. Production rate limit: five attempts per minute per client IP using an atomic Redis sliding window. Demo, test and local development use a process-local five-per-minute limiter.

## n8n read API

Import [the workflow export](outputs/deliverables/larynx31-read-api.workflow.json) manually into n8n. Do not import it over workflow 31. It has two authenticated GET triggers and uses a separate credential named `Larynx31 Read API Header Auth`. Assign that credential to both Webhook nodes after import. The PostgreSQL nodes use a separate `Larynx31 Ledger Readonly` credential. Configure the database credential with the least-privilege role created by [the SQL setup script](outputs/deliverables/larynx31-read-api-setup.sql).

Both APIs require the dedicated Header Auth credential. Every SQL statement is a `SELECT`; the list has a fixed 250-row cap. SQL projects an allowlist of fields and masks the phone before data leaves PostgreSQL. A response never contains the raw phone, raw payload, or provider credential.

### `GET /webhook/larynx-31-api/leads`

Response `200`:

```json
{
  "leads": [
    {
      "lead_id": "lead_…",
      "name": "Aarav Mehta",
      "phone_e164": "+91 98•••••210",
      "property_interest": "3 BHK",
      "budget_min": 12000000,
      "budget_max": 16000000,
      "city": "Bengaluru",
      "source": "99acres",
      "received_at": "2026-09-24T10:00:00+05:30",
      "status": "engaged",
      "call_status": "initiated",
      "whatsapp_status": "accepted",
      "time_to_call_initiation_ms": 1840,
      "intent_level": "hot",
      "summary": "…",
      "next_followup_at": "2026-09-25T10:00:00+05:30",
      "followup_count": 1,
      "do_not_contact": false,
      "call_consent": true,
      "whatsapp_opt_in": true
    }
  ],
  "count": 1
}
```

The full allowlisted projection also includes `email`, `locality`, `call_run_id`, `whatsapp_accepted_at`, `updated_at`, `preferred_followup_time`, `preferred_channel`, `objections`, `interests`, `budget_signal`, `next_action`, and `next_action_reason` when present. `whatsapp_status: "accepted"` means the provider accepted the request; it does not mean delivered or read.

### `GET /webhook/larynx-31-api/leads/:lead_id`

Response `200` is an object with `lead`, `followups`, and `errors` arrays. `followups` maps actual `larynx31.followups` columns (`followup_id`, `lead_id`, `run_id`, `attempt_number`, `due_at`, `status`) and allowlisted analysis fields from its `data` JSON. `errors` maps `log_id`, `lead_id`, `api`, `http_status`, `error_message`, `attempt_count`, `final`, `ambiguous`, `timestamp`, and `execution_id` from `larynx31.errors.data`.

Not found returns HTTP `404` with `{ "error": "not_found", "message": "Lead not found" }`. Database failure retries the idempotent SELECT up to three times, then returns sanitized HTTP `503` with a request/execution ID. SQL and stack traces stay in n8n execution data.

## Next.js routes

| Route | Behavior |
| --- | --- |
| `GET /api/leads` | In demo, returns local fixtures. In test/live, calls the authenticated n8n list API from the server. |
| `GET /api/leads/:leadId` | Returns local fixture detail in demo or authenticated n8n detail in test/live. |
| `POST /api/leads/send` | Passcode-checks, validates Indian E.164, applies rate limit, then simulates locally or posts to the intake webhook. Never returns a secret to the browser. |

The intake webhook returns only `accepted:true`. In live mode the app calculates the workflow's expected internal lead ID from the same source/portal identity rule and polls the read endpoint every 2.5 seconds for up to 45 seconds. If the record is not visible, the UI keeps the last status and explains that the read API has not caught up. `accepted` WhatsApp status is never described as delivery.

## Environment variables

Copy [`.env.example`](frontend/.env.example) to `.env.local` for local work. Vercel secrets must be entered in Project Settings → Environment Variables; do not commit them.

| Variable | Purpose |
| --- | --- |
| `MODE`, `NEXT_PUBLIC_MODE` | Server mode and public badge: `demo`, `test`, or `live`. Keep equal. |
| `DEMO_PASSCODE` | Server-only passcode required by all send actions. |
| `NEXT_PUBLIC_DEMO_PHONE_NUMBER` | Optional phone prefill. It becomes visible in the browser bundle and page, so leave blank if it should stay private. |
| `N8N_BASE_URL` | n8n origin, e.g. `https://automation.example.com`. |
| `N8N_READ_API_BASE_URL` | Optional full base before `/leads`; otherwise derived as `${N8N_BASE_URL}/webhook/larynx-31-api`. |
| `N8N_READ_API_HEADER_NAME`, `N8N_READ_API_KEY` | Header name and secret value configured in the new read API Header Auth credential. Server only. |
| `N8N_INTAKE_WEBHOOK_URL` | Optional full intake URL; otherwise derived from `N8N_BASE_URL`. |
| `N8N_INTAKE_AUTH_HEADER_NAME`, `N8N_INTAKE_AUTH_HEADER_VALUE` | Header name/value matching the intake webhook credential. Server only. |
| `N8N_LIVE_SENDS_ENABLED` | Must remain `false` until live n8n configuration and controlled testing are complete. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Required durable limiter for production live sends. Server only. |

## Credential naming discrepancy

The local workflow export read for this build refers to its inbound credentials as `Larynx Intake Webhook Auth` and `Larynx Dograh Webhook Auth`; it does not use a credential called `unipile api`. A read-only MCP inspection of the current live workflow reports that both inbound webhooks expect an `X-API-KEY` header; the credential values are hidden. The export names and live header name do not prove which credential objects are assigned in the n8n UI. Verify the assignment, and use separate dedicated secrets for intake and Dograh callback if the same key is currently shared. The new read API requires its own `Larynx31 Read API Header Auth` credential and must not reuse intake, Dograh, MSG91, or any generic provider credential.

## Architecture decisions and assumptions

- The local 88-node export and `ledger-schema.sql` are the source for column names, fields and statuses. Read-only MCP inspection confirmed the live `My workflow 31` is currently inactive, so its production webhook URLs will not accept live traffic until an operator activates it. No change was made to workflow 31, and this task does not import or activate the read API. Confirm the live workflow matches the local export before relying on its TEST_MODE behavior.
- Read API phone masking is unconditional, including for authenticated callers. The UI only needs a masked identifier, so returning raw PII adds no demo value.
- Follow-up analysis fields are persisted in `followups.data` in the supplied schema; the detail query reads the newest follow-up as a fallback because the lead `data` JSON stores only a subset of analysis fields.
- The read list is capped at 250 records to prevent an unbounded response. Add authenticated pagination only if the UI grows beyond this demo scale.
- The generated portal ID is stable for the same source, normalized phone and property in this UI, so repeat submissions from this form hit the workflow's existing identity/dedupe behavior. Third-party portal IDs remain owned by those portals.
- The UI uses the workflow's `accepted` wording for MSG91 and does not infer a delivery receipt. Call and WhatsApp consent remain independent.
- In-memory simulated rows and the non-live rate limit are process-local; they are suitable for a demo and development only. Production live mode requires Redis for rate limiting.
- Upstash is called directly over its REST API, using an atomic sorted-set sliding-window script; no Redis token or n8n secret is included in client code.
- The passcode is not stored in a cookie or local storage. It is sent only to the same-origin Next.js Route Handler over HTTPS and compared server-side.
