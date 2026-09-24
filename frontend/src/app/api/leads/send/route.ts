import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getMode } from "@/lib/mode";
import { allowSend, normalizeIndianPhone, verifyPasscode } from "@/lib/server-security";
import { readLeads, submitIntake, UpstreamError, type SendLeadInput } from "@/lib/n8n-server";

export const dynamic = "force-dynamic";

function safeText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/[<>]/g, "").slice(0, max) : "";
}

function safeBudget(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1_000_000_000 ? Math.round(number) : null;
}

export async function POST(request: NextRequest) {
  const mode = getMode();
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Please submit a valid lead form." }, { status: 400 });
  }

  if (!verifyPasscode(body.passcode)) {
    return NextResponse.json({ error: process.env.DEMO_PASSCODE ? "The demo passcode is incorrect." : "A server-side demo passcode must be configured before sending." }, { status: 401 });
  }
  const normalizedPhone = normalizeIndianPhone(body.phone);
  if (!normalizedPhone) return NextResponse.json({ error: "Enter a valid Indian mobile number in +91 format." }, { status: 400 });
  if (mode === "live" && body.confirmNumber !== normalizedPhone) {
    return NextResponse.json({ error: "Confirm the exact number that will receive the opted-in contact." }, { status: 400 });
  }
  if (typeof body.callConsent !== "boolean" || typeof body.whatsappOptIn !== "boolean") {
    return NextResponse.json({ error: "Both contact consent choices must be recorded, including an explicit no." }, { status: 400 });
  }

  let withinLimit = false;
  try {
    withinLimit = await allowSend(request, mode);
  } catch {
    return NextResponse.json({ error: "The send safety limit is unavailable. Please try again later." }, { status: 503 });
  }
  if (!withinLimit) {
    const message = mode === "live" && process.env.NODE_ENV === "production"
      ? "Live sending is paused because durable rate limiting is not configured."
      : "Too many attempts. Please wait a minute before trying again.";
    return NextResponse.json({ error: message }, { status: 429 });
  }

  const input: SendLeadInput = {
    name: safeText(body.name, 120) || "Demo enquiry",
    phone: normalizedPhone,
    propertyInterest: safeText(body.propertyInterest, 180) || "Property enquiry",
    budgetMin: safeBudget(body.budgetMin),
    budgetMax: safeBudget(body.budgetMax),
    city: safeText(body.city, 100),
    source: ["99acres", "magicbricks", "website"].includes(String(body.source).toLowerCase()) ? String(body.source).toLowerCase() : "website",
    callConsent: body.callConsent,
    whatsappOptIn: body.whatsappOptIn,
  };
  if (input.budgetMin !== null && input.budgetMax !== null && input.budgetMin > input.budgetMax) {
    return NextResponse.json({ error: "Minimum budget cannot be higher than maximum budget." }, { status: 400 });
  }

  if (mode === "demo") {
    return NextResponse.json({
      mode,
      simulated: true,
      message: "Demo simulation only. No n8n, call, or WhatsApp request was made.",
      lead: {
        lead_id: `local-${randomUUID()}`,
        name: input.name,
        phone_e164: normalizedPhone,
        property_interest: input.propertyInterest,
        budget_min: input.budgetMin,
        budget_max: input.budgetMax,
        city: input.city,
        source: input.source,
        received_at: new Date().toISOString(),
        status: "queued",
        call_status: input.callConsent ? "queued" : "suppressed",
        whatsapp_status: input.whatsappOptIn ? "queued" : "suppressed",
        time_to_call_initiation_ms: null,
        intent_level: null,
        summary: "This is a local demo run. No real call, message, or AI analysis took place.",
        next_followup_at: null,
        followup_count: 0,
        do_not_contact: false,
        call_consent: input.callConsent,
        whatsapp_opt_in: input.whatsappOptIn,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  }

  if (mode === "live" && process.env.N8N_LIVE_SENDS_ENABLED !== "true") {
    return NextResponse.json({ error: "Live sending is locked until n8n is explicitly switched out of TEST_MODE and N8N_LIVE_SENDS_ENABLED is set." }, { status: 503 });
  }

  try {
    const acknowledgement = await submitIntake(input, normalizedPhone);
    if (mode === "test") {
      let readApiAvailable: boolean | null = null;
      try {
        await readLeads();
        readApiAvailable = true;
      } catch {
        readApiAvailable = false;
      }
      return NextResponse.json({
        mode,
        accepted: acknowledgement.accepted,
        leadId: acknowledgement.leadId,
        readApiAvailable,
        message: "The webhook acknowledged this request. TEST_MODE routes it through the no-external-calls health path; the webhook response does not include the detailed health report. This lead was not staged and no real call or WhatsApp was placed.",
      }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({
      mode,
      accepted: acknowledgement.accepted,
      leadId: acknowledgement.leadId,
      message: "The intake webhook acknowledged the lead. Status will appear as the read-only ledger catches up.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const upstream = error instanceof UpstreamError ? error : new UpstreamError("The lead could not be submitted.");
    return NextResponse.json({ error: upstream.message }, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
  }
}
