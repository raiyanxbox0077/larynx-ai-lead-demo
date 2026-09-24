import "server-only";
import { createHash } from "node:crypto";
import type { Lead, LeadDetail } from "@/lib/types";

export class UpstreamError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

function readBaseUrl(): string {
  const explicit = process.env.N8N_READ_API_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const base = process.env.N8N_BASE_URL?.trim();
  if (!base) throw new UpstreamError("The read API is not configured yet.", 503);
  return `${base.replace(/\/$/, "")}/webhook/larynx-31-api`;
}

function authHeaders(): Record<string, string> {
  const name = process.env.N8N_READ_API_HEADER_NAME?.trim() || "X-Larynx-Read-Token";
  const value = process.env.N8N_READ_API_KEY;
  if (!value) throw new UpstreamError("The read API credential is not configured yet.", 503);
  return { [name]: value, Accept: "application/json" };
}

async function getJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: authHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new UpstreamError("The n8n read API could not be reached.", 502);
  }
  if (response.status === 404) throw new UpstreamError("This lead is not in the read API yet.", 404);
  if (!response.ok) throw new UpstreamError("The n8n read API returned an error.", response.status >= 500 ? 502 : response.status);
  try {
    return await response.json();
  } catch {
    throw new UpstreamError("The n8n read API returned an unreadable response.", 502);
  }
}

function unwrap(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return unwrap(value[0]);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.json && typeof record.json === "object") return unwrap(record.json);
    return record;
  }
  return {};
}

export async function readLeads(): Promise<Lead[]> {
  const raw = await getJson(`${readBaseUrl()}/leads`);
  const record = unwrap(raw);
  const rows = Array.isArray(raw) ? raw : Array.isArray(record.leads) ? record.leads : Array.isArray(record.data) ? record.data : [];
  return rows.map((entry) => unwrap(entry) as unknown as Lead);
}

export async function readLeadDetail(leadId: string): Promise<LeadDetail> {
  const raw = await getJson(`${readBaseUrl()}/leads/${encodeURIComponent(leadId)}`);
  const record = unwrap(raw);
  const detail = (record.detail && typeof record.detail === "object" ? record.detail : record) as Record<string, unknown>;
  if (!detail.lead || typeof detail.lead !== "object") throw new UpstreamError("The read API response did not include this lead.", 404);
  return {
    lead: detail.lead as Lead,
    followups: Array.isArray(detail.followups) ? detail.followups as LeadDetail["followups"] : [],
    errors: Array.isArray(detail.errors) ? detail.errors as LeadDetail["errors"] : [],
  };
}

function intakeUrl(): string {
  const explicit = process.env.N8N_INTAKE_WEBHOOK_URL?.trim();
  if (explicit) return explicit;
  const base = process.env.N8N_BASE_URL?.trim();
  if (!base) throw new UpstreamError("The intake webhook is not configured yet.", 503);
  return `${base.replace(/\/$/, "")}/webhook/larynx-31-leads`;
}

export interface SendLeadInput {
  name: string;
  phone: string;
  propertyInterest: string;
  budgetMin: number | null;
  budgetMax: number | null;
  city: string;
  source: string;
  callConsent: boolean;
  whatsappOptIn: boolean;
}

export async function submitIntake(input: SendLeadInput, normalizedPhone: string): Promise<{ accepted: boolean; leadId: string; portalLeadId: string }> {
  const headerName = process.env.N8N_INTAKE_AUTH_HEADER_NAME?.trim() || "X-API-KEY";
  const headerValue = process.env.N8N_INTAKE_AUTH_HEADER_VALUE;
  if (!headerValue) throw new UpstreamError("The intake webhook credential is not configured yet.", 503);

  const source = input.source.toLowerCase();
  const portalLeadId = `ui_${createHash("sha256").update(`${source}|${normalizedPhone}|${input.propertyInterest.toLowerCase()}`).digest("hex").slice(0, 24)}`;
  const identity = `${source}|portal|${portalLeadId}`;
  const leadId = `lead_${createHash("md5").update(identity).digest("hex")}`;
  let response: Response;
  try {
    response = await fetch(intakeUrl(), {
      method: "POST",
      headers: { [headerName]: headerValue, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        name: input.name,
        phone: normalizedPhone,
        property_interest: input.propertyInterest,
        min_budget: input.budgetMin,
        max_budget: input.budgetMax,
        city: input.city,
        source,
        lead_id: portalLeadId,
        call_consent: input.callConsent,
        whatsapp_opt_in: input.whatsappOptIn,
        do_not_contact: false,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new UpstreamError("The lead could not reach the n8n intake webhook.", 502);
  }
  if (!response.ok) throw new UpstreamError("The n8n intake webhook rejected the request.", response.status >= 500 ? 502 : response.status);
  const ack = await response.json().catch(() => ({})) as { accepted?: boolean };
  return { accepted: ack.accepted === true, leadId, portalLeadId };
}
