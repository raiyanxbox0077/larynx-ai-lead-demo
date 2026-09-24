import { NextResponse } from "next/server";
import { demoDetails } from "@/lib/fixtures";
import { getMode } from "@/lib/mode";
import { readLeadDetail, UpstreamError } from "@/lib/n8n-server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  const mode = getMode();
  if (mode === "demo") {
    const detail = demoDetails[leadId];
    if (!detail) return NextResponse.json({ error: "This demo lead was not found." }, { status: 404 });
    return NextResponse.json(detail, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    return NextResponse.json(await readLeadDetail(leadId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const upstream = error instanceof UpstreamError ? error : new UpstreamError("Lead details are temporarily unavailable.");
    return NextResponse.json({ error: upstream.message }, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
  }
}
