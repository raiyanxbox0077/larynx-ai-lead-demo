import { NextResponse } from "next/server";
import { demoLeads } from "@/lib/fixtures";
import { getMode } from "@/lib/mode";
import { readLeads, UpstreamError } from "@/lib/n8n-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const mode = getMode();
  if (mode === "demo") return NextResponse.json({ mode, leads: demoLeads }, { headers: { "Cache-Control": "no-store" } });
  try {
    return NextResponse.json({ mode, leads: await readLeads() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const upstream = error instanceof UpstreamError ? error : new UpstreamError("The lead list is temporarily unavailable.");
    return NextResponse.json({ mode, error: upstream.message }, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
  }
}
