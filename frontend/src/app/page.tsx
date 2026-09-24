"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActivityStep, AppMode, ErrorEntry, Followup, Lead, LeadDetail, StepState } from "@/lib/types";
import { demoLeads } from "@/lib/fixtures";
import { formatDuration, formatIST, formatRange, maskINPhone } from "@/lib/format";

const emptyForm = {
  name: "",
  phone: "",
  propertyInterest: "",
  budgetMin: "",
  budgetMax: "",
  city: "",
  source: "99acres",
  callConsent: false,
  whatsappOptIn: false,
  passcode: "",
};

const storySteps = ["Lead received", "Validated & de-duplicated", "Consent checked", "AI call started", "WhatsApp accepted", "Logged to ledger"];
const publicMode = (process.env.NEXT_PUBLIC_MODE || "demo").toLowerCase() as AppMode;
const publicDemoPhone = process.env.NEXT_PUBLIC_DEMO_PHONE_NUMBER || "";

function nationalDigits(value: string): string {
  return value.replace(/\D/g, "").replace(/^91/, "").replace(/^0/, "");
}

function formatStatus(value?: string | null): string {
  if (!value) return "Waiting";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stateForStatus(value?: string, consent = true): StepState {
  if (!consent || value === "suppressed" || value === "cancelled") return "skipped";
  if (["initiated", "completed", "accepted", "done", "engaged"].includes(value || "")) return "done";
  if (["failed", "needs_review", "partial_failure"].includes(value || "")) return "failed";
  return "pending";
}

function makeTimeline(mode: AppMode, lead?: Lead): ActivityStep[] {
  if (!lead) return storySteps.map((label) => ({ label, state: "pending" }));
  const received = formatIST(lead.received_at);
  return [
    { label: storySteps[0], state: "done", detail: `${lead.source} · ${received}`, time: received },
    { label: storySteps[1], state: "done", detail: "Phone format checked · duplicate key reserved", time: received },
    { label: storySteps[2], state: "done", detail: `Call ${lead.call_consent ? "opt-in recorded" : "skipped: no call consent"} · WhatsApp ${lead.whatsapp_opt_in ? "opt-in recorded" : "skipped: no WhatsApp opt-in"}`, time: received },
    {
      label: storySteps[3],
      state: stateForStatus(lead.call_status, lead.call_consent),
      detail: !lead.call_consent ? "Skipped because the lead did not consent to a call." : formatStatus(lead.call_status),
      time: lead.call_status && lead.call_status !== "queued" ? received : undefined,
    },
    {
      label: storySteps[4],
      state: stateForStatus(lead.whatsapp_status, lead.whatsapp_opt_in),
      detail: !lead.whatsapp_opt_in ? "Skipped because WhatsApp opt-in was not recorded." : lead.whatsapp_status === "accepted" ? "Accepted by MSG91; delivery receipt is not implied." : formatStatus(lead.whatsapp_status),
      time: lead.whatsapp_accepted_at ? formatIST(lead.whatsapp_accepted_at) : undefined,
    },
    {
      label: storySteps[5],
      state: mode === "demo" ? "done" : lead.status ? "done" : "pending",
      detail: mode === "demo" ? "Local fixture · not sent to n8n" : `Ledger status: ${formatStatus(lead.status)}`,
      time: received,
    },
  ];
}

function moneyInputToNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/[\s,₹]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (name === "arrow") return <svg {...common}><path d="M5 12h14M13 5l7 7-7 7" /></svg>;
  if (name === "spark") return <svg {...common}><path d="m12 3 1.6 6.1L20 11l-6.4 1.9L12 19l-1.6-6.1L4 11l6.4-1.9L12 3Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></svg>;
  if (name === "phone") return <svg {...common}><path d="M21 16.5v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 1.1 3.8 2 2 0 0 1 3.1 1.6h3a2 2 0 0 1 2 1.7l.5 2.8a2 2 0 0 1-.6 1.8L6.6 9.3a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 1.8-.6l2.8.5a2 2 0 0 1 1.7 2.7Z" /></svg>;
  if (name === "message") return <svg {...common}><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" /></svg>;
  if (name === "clock") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (name === "chevron") return <svg {...common}><path d="m6 9 6 6 6-6" /></svg>;
  if (name === "close") return <svg {...common}><path d="m18 6-12 12M6 6l12 12" /></svg>;
  if (name === "refresh") return <svg {...common}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.4-3" /></svg>;
  if (name === "home") return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1V10Z" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2 2" /></svg>;
}

function StateDot({ state }: { state: StepState }) {
  return <span className={`state-dot state-${state}`} aria-label={state}>{state === "done" ? "✓" : state === "skipped" ? "–" : state === "failed" ? "!" : ""}</span>;
}

function IntentBadge({ intent }: { intent?: string | null }) {
  return <span className={`intent intent-${intent || "unknown"}`}><span />{intent ? intent.toUpperCase() : "NEW"}</span>;
}

function StatusPill({ value }: { value?: string }) {
  return <span className={`mini-status status-${(value || "waiting").replaceAll("_", "-")}`}>{formatStatus(value)}</span>;
}

export default function HomePage() {
  const initialMode = ["demo", "test", "live"].includes(publicMode) ? publicMode : "demo";
  const [mode, setMode] = useState<AppMode>(initialMode);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [form, setForm] = useState({ ...emptyForm, phone: nationalDigits(publicDemoPhone) });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [sendError, setSendError] = useState("");
  const [timeline, setTimeline] = useState<ActivityStep[]>(makeTimeline(initialMode));
  const [focusLead, setFocusLead] = useState<Lead | null>(null);
  const [localDetails, setLocalDetails] = useState<Record<string, LeadDetail>>({});
  const [firstCallMs, setFirstCallMs] = useState<number | null>(null);
  const [illustrative, setIllustrative] = useState(false);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [howOpen, setHowOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLeads = useCallback(async () => {
    setListError("");
    try {
      const response = await fetch("/api/leads", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Leads could not be loaded.");
      setMode(payload.mode);
      setLeads(Array.isArray(payload.leads) ? payload.leads : []);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Leads could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLeads();
    return () => {
      timerRef.current.forEach(clearTimeout);
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [fetchLeads]);

  const sortedLeads = useMemo(() => [...leads].sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()), [leads]);
  const hotCount = leads.filter((lead) => lead.intent_level === "hot").length;
  const averageFirstCall = leads.filter((lead) => lead.time_to_call_initiation_ms != null).map((lead) => lead.time_to_call_initiation_ms as number);
  const averageMs = averageFirstCall.length ? Math.round(averageFirstCall.reduce((sum, time) => sum + time, 0) / averageFirstCall.length) : null;

  function setField<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function fillSample() {
    const envPhone = document.querySelector<HTMLInputElement>("[data-demo-phone]")?.dataset.demoPhone || "";
    setForm({
      ...emptyForm,
      name: "Rhea Kapoor",
      phone: envPhone ? nationalDigits(envPhone) : mode === "demo" ? "90000 00000" : "",
      propertyInterest: "3 BHK · The Canopy, Whitefield",
      budgetMin: "12000000",
      budgetMax: "16000000",
      city: "Bengaluru",
      source: "99acres",
      callConsent: mode === "demo",
      whatsappOptIn: mode === "demo",
      passcode: form.passcode,
    });
    setNotice(mode === "demo" ? "Sample filled. This number stays in the local demo; no call can be placed in Demo mode." : "Sample details filled. Enter or verify your demo number, then record each consent explicitly.");
    setSendError("");
    setFocusLead(null);
    setFirstCallMs(null);
    setTimeline(makeTimeline(mode));
  }

  function animateDemo(lead: Lead) {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
    const start = Date.now();
    const next = storySteps.map((label) => ({ label, state: "pending" as StepState }));
    setTimeline(next);
    setFocusLead(lead);
    setFirstCallMs(null);
    setIllustrative(true);
    const updates: Array<{ index: number; state: StepState; detail: string; after: number }> = [
      { index: 0, state: "done", detail: "Captured from the selected property portal", after: 350 },
      { index: 1, state: "done", detail: "Indian mobile format checked · lead key created", after: 950 },
      { index: 2, state: "done", detail: "Call and WhatsApp consent recorded", after: 1450 },
      { index: 3, state: lead.call_consent ? "done" : "skipped", detail: lead.call_consent ? "Illustrative voice hand-off · no provider called" : "Skipped because call consent was not checked", after: 2050 },
      { index: 4, state: lead.whatsapp_opt_in ? "done" : "skipped", detail: lead.whatsapp_opt_in ? "Illustrative provider acceptance · no message sent" : "Skipped because WhatsApp opt-in was not checked", after: 2650 },
      { index: 5, state: "done", detail: "Saved in this browser session only", after: 3300 },
    ];
    updates.forEach(({ index, state, detail, after }) => {
      timerRef.current.push(setTimeout(() => {
        setTimeline((current) => current.map((step, itemIndex) => itemIndex === index ? { ...step, state, detail, time: new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date()) + " IST" } : step));
        if (index === 3 && state === "done") setFirstCallMs(Date.now() - start);
      }, after));
    });
    const demoLead: Lead = {
      ...lead,
      status: lead.call_consent || lead.whatsapp_opt_in ? "engaged" : "queued",
      call_status: lead.call_consent ? "initiated" : "suppressed",
      whatsapp_status: lead.whatsapp_opt_in ? "accepted" : "suppressed",
      time_to_call_initiation_ms: lead.call_consent ? 1_840 : null,
      intent_level: "warm",
      summary: "Local demo only: the buyer is comparing homes in the selected area and asked for a short list within budget. The illustrated next step is to share the project details, then follow up at a preferred time.",
      next_followup_at: lead.call_consent || lead.whatsapp_opt_in ? new Date(Date.now() + 86_400_000).toISOString() : null,
      followup_count: lead.call_consent || lead.whatsapp_opt_in ? 1 : 0,
      preferred_followup_time: "Tomorrow afternoon",
      preferred_channel: lead.call_consent && lead.whatsapp_opt_in ? "both" : lead.call_consent ? "call" : lead.whatsapp_opt_in ? "whatsapp" : "none",
      interests: ["Project floor plan", "Nearby schools"],
      objections: ["Comparing one other property"],
      budget_signal: "Within the stated range",
      next_action: lead.whatsapp_opt_in ? "send_brochure" : lead.call_consent ? "call_back" : "nurture",
      next_action_reason: lead.whatsapp_opt_in ? "Share the requested property details through the opted-in WhatsApp channel." : lead.call_consent ? "Call again at the preferred time to answer remaining questions." : "Wait for explicit channel consent before contacting this lead.",
    };
    const localFollowup: Followup = {
      followup_id: `local-followup-${demoLead.lead_id}`,
      lead_id: demoLead.lead_id,
      intent_level: demoLead.intent_level,
      next_action: demoLead.next_action,
      next_followup_at: demoLead.next_followup_at,
      channel: demoLead.preferred_channel,
      attempt_number: demoLead.followup_count,
      status: demoLead.followup_count ? "pending" : "cancelled",
      summary: demoLead.summary,
      objections: demoLead.objections,
      interests: demoLead.interests,
      budget_signal: demoLead.budget_signal,
      next_action_reason: demoLead.next_action_reason,
    };
    setLocalDetails((current) => ({ ...current, [demoLead.lead_id]: { lead: demoLead, followups: demoLead.followup_count ? [localFollowup] : [], errors: [] } }));
    setLeads((current) => [demoLead, ...current.filter((item) => item.lead_id !== demoLead.lead_id)]);
  }

  async function submitLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSendError("");
    setNotice("");
    if (!form.name.trim() || !form.phone.trim() || !form.propertyInterest.trim() || !form.city.trim()) {
      setSendError("Add a name, phone, property and city to continue.");
      return;
    }
    let confirmNumber: string | undefined;
    if (mode === "live") {
      const digits = nationalDigits(form.phone);
      if (!/^[6-9]\d{9}$/.test(digits)) {
        setSendError("Enter a valid Indian mobile number before confirming a live send.");
        return;
      }
      const normalized = `+91${digits}`;
      const channels = [form.callConsent ? "voice call" : "no call", form.whatsappOptIn ? "WhatsApp" : "no WhatsApp"].filter((channel) => !channel.startsWith("no ")).join(" and ") || "no outbound contact";
      const confirmed = window.confirm(`LIVE MODE\n\n${channels === "no outbound contact" ? "No contact will be sent because both consent boxes are off." : `${channels} may be sent to ${normalized}.`}\n\nThe current workflow is documented as TEST_MODE=true. The backend also blocks live sending until separately enabled.\n\nContinue?`);
      if (!confirmed) return;
      confirmNumber = normalized;
    }
    setSending(true);
    try {
      const response = await fetch("/api/leads/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          propertyInterest: form.propertyInterest,
          budgetMin: moneyInputToNumber(form.budgetMin),
          budgetMax: moneyInputToNumber(form.budgetMax),
          city: form.city,
          source: form.source,
          callConsent: form.callConsent,
          whatsappOptIn: form.whatsappOptIn,
          passcode: form.passcode,
          confirmNumber,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The lead could not be sent.");

      if (payload.mode === "demo") {
        const lead = payload.lead as Lead;
        animateDemo(lead);
        setNotice(payload.message);
      } else if (payload.mode === "test") {
        setFocusLead(null);
        setFirstCallMs(null);
        setIllustrative(false);
        setTimeline([
          { label: storySteps[0], state: payload.accepted ? "done" : "failed", detail: payload.accepted ? "Webhook returned accepted:true" : "Webhook did not confirm receipt" },
          { label: storySteps[1], state: "skipped", detail: "TEST_MODE runs its health path; it does not stage this lead" },
          { label: storySteps[2], state: "done", detail: "Consent choices sent in the test request" },
          { label: storySteps[3], state: "skipped", detail: "No real call placed in test mode" },
          { label: storySteps[4], state: "skipped", detail: "No WhatsApp message sent in test mode" },
          { label: storySteps[5], state: payload.readApiAvailable ? "done" : "pending", detail: payload.readApiAvailable ? "Read API responded; this request was not persisted" : "Read API not configured or unavailable" },
        ]);
        setNotice(payload.message);
      } else {
        setNotice(payload.message);
        setFocusLead({ lead_id: payload.leadId, name: form.name, phone_e164: "", property_interest: form.propertyInterest, city: form.city, source: form.source, received_at: new Date().toISOString(), status: "queued", call_status: form.callConsent ? "queued" : "suppressed", whatsapp_status: form.whatsappOptIn ? "queued" : "suppressed", time_to_call_initiation_ms: null, followup_count: 0, do_not_contact: false, call_consent: form.callConsent, whatsapp_opt_in: form.whatsappOptIn });
        setTimeline(makeTimeline("live", { lead_id: payload.leadId, name: form.name, phone_e164: "", property_interest: form.propertyInterest, city: form.city, source: form.source, received_at: new Date().toISOString(), status: "queued", call_status: form.callConsent ? "queued" : "suppressed", whatsapp_status: form.whatsappOptIn ? "queued" : "suppressed", time_to_call_initiation_ms: null, followup_count: 0, do_not_contact: false, call_consent: form.callConsent, whatsapp_opt_in: form.whatsappOptIn }));
        void fetchLeads();
        pollLiveLead(payload.leadId);
      }
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "The lead could not be sent.");
    } finally {
      setSending(false);
    }
  }

  function pollLiveLead(leadId: string, attempts = 0) {
    if (attempts > 18) return;
    pollRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/leads/${encodeURIComponent(leadId)}`, { cache: "no-store" });
        if (response.ok) {
          const nextDetail = await response.json() as LeadDetail;
          const lead = nextDetail.lead;
          setFocusLead(lead);
          setTimeline(makeTimeline("live", lead));
          if (lead.time_to_call_initiation_ms != null) setFirstCallMs(lead.time_to_call_initiation_ms);
          setLeads((current) => [lead, ...current.filter((item) => item.lead_id !== lead.lead_id)]);
          if (["engaged", "partial_failure", "do_not_contact", "needs_review"].includes(lead.status)) return;
        }
      } catch {
        // Keep the last visible state. The table's refresh control can retry the read path.
      }
      pollLiveLead(leadId, attempts + 1);
    }, 2500);
  }

  async function openDetail(lead: Lead) {
    setFocusLead(lead);
    setDetail(null);
    setDetailError("");
    if (mode === "demo" && localDetails[lead.lead_id]) {
      setDetail(localDetails[lead.lead_id]);
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(lead.lead_id)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Lead details could not be loaded.");
      setDetail(payload as LeadDetail);
    } catch (error) {
      if (mode === "demo") setDetailError("This locally generated lead has no persisted detail record.");
      else setDetailError(error instanceof Error ? error.message : "Lead details could not be loaded.");
    } finally {
      setDetailLoading(false);
    }
  }

  const detailLead = detail?.lead || focusLead;
  const errorEntries: ErrorEntry[] = detail?.errors || [];
  const followups: Followup[] = detail?.followups || [];
  const demoPhone = publicDemoPhone;
  const enteredDigits = nationalDigits(form.phone);
  const demoDigits = nationalDigits(demoPhone);
  const usingDifferentNumber = mode !== "demo" && Boolean(enteredDigits) && (!demoDigits || enteredDigits !== demoDigits);

  return (
    <main className="app-shell">
      <div className="topline" aria-hidden="true"><span>PROPERTY LEAD RESPONSE</span><span>INDIA · IST</span></div>
      <header className="site-header">
        <a href="#top" className="brand" aria-label="Larynx AI home">
          <span className="brand-mark"><span /><span /><span /></span>
          <span className="brand-name">larynx<span>ai</span></span>
        </a>
        <p className="header-tagline">A better first conversation starts before the second ring.</p>
        <div className="mode-wrap"><span className={`mode-pill mode-${mode}`}><i />{mode.toUpperCase()} MODE</span><span className="mode-caption">{mode === "demo" ? "Local story run" : mode === "test" ? "Health path only" : "Guarded live path"}</span></div>
      </header>

      <section className="intro" id="top">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" />REAL ESTATE, RESPONDED TO</div>
          <h1>Every enquiry.<br /><em>A better first conversation.</em></h1>
          <p className="intro-copy">Larynx AI catches the moment a buyer raises their hand—then makes the next step feel personal, fast and easy to follow.</p>
        </div>
        <div className="intro-side">
          <span className="intro-index">THE LEAD RESPONSE STUDIO <b>01 — 06</b></span>
          <div className="orbit-art" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit-core"><Icon name="home" size={22} /></span><span className="orbit-node">AI</span><span className="orbit-spark">✳</span></div>
          <span className="intro-side-caption">From enquiry to next step,<br />with a human feel.</span>
        </div>
      </section>

      <section className="metric-rail" aria-label="Workflow facts">
        <div className="metric"><span className="metric-number">&lt; 2<span>s</span></span><span className="metric-label">TARGET FIRST RESPONSE</span></div>
        <div className="metric"><span className="metric-number">09–20</span><span className="metric-label">CONTACT WINDOW · IST</span></div>
        <div className="metric"><span className="metric-number">05<span>×</span></span><span className="metric-label">MAXIMUM FOLLOW-UPS</span></div>
        <div className="metric-note"><span className="note-dot" /> SWEEP EVERY 5 MIN · RETRIES 1 / 2 / 4 SEC</div>
      </section>

      <section className="workbench-grid" aria-label="Lead simulation and activity">
        <div className="panel form-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">01 / SIMULATE</span><h2>Bring a lead to life</h2></div>
            <span className="heading-icon"><Icon name="spark" size={20} /></span>
          </div>
          <p className="panel-intro">See how a new property enquiry moves through a consent-aware response.</p>
          <form onSubmit={submitLead} className="lead-form">
            <div className="field-row">
              <label className="field"><span>LEAD NAME</span><input value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder="e.g. Rhea Kapoor" autoComplete="name" maxLength={120} /></label>
              <label className="field"><span>PHONE NUMBER <small>INDIA</small></span><div className="phone-control"><b>+91</b><input data-demo-phone={demoPhone} value={form.phone} onChange={(event) => setField("phone", event.target.value)} placeholder="98765 43210" inputMode="tel" autoComplete="tel-national" maxLength={18} aria-label="Phone number with +91 country code" /></div></label>
            </div>
            <label className="field"><span>PROPERTY INTEREST</span><input value={form.propertyInterest} onChange={(event) => setField("propertyInterest", event.target.value)} placeholder="Project or property type" maxLength={180} /></label>
            <div className="field-row">
              <label className="field"><span>BUDGET RANGE <small>₹</small></span><div className="money-control"><span>₹</span><input value={form.budgetMin} onChange={(event) => setField("budgetMin", event.target.value)} placeholder="Min" inputMode="numeric" /></div></label>
              <label className="field"><span className="sr-only">Maximum budget</span><div className="money-control money-max"><span>₹</span><input value={form.budgetMax} onChange={(event) => setField("budgetMax", event.target.value)} placeholder="Max" inputMode="numeric" /></div></label>
            </div>
            <div className="field-row">
              <label className="field"><span>CITY</span><input value={form.city} onChange={(event) => setField("city", event.target.value)} placeholder="Bengaluru" maxLength={100} /></label>
              <label className="field"><span>LEAD SOURCE</span><select value={form.source} onChange={(event) => setField("source", event.target.value)}><option value="99acres">99acres</option><option value="magicbricks">Magicbricks</option><option value="website">Website</option></select></label>
            </div>
            <div className="consent-box">
              <div className="consent-head"><span>CONTACT PERMISSIONS</span><span className="consent-required">CHANNELS STAY SEPARATE</span></div>
              <label className="check-row"><input type="checkbox" checked={form.callConsent} onChange={(event) => setField("callConsent", event.target.checked)} /><span className="checkmark" /><span>Lead consented to be called</span><span className="check-channel"><Icon name="phone" size={14} /> CALL</span></label>
              <label className="check-row"><input type="checkbox" checked={form.whatsappOptIn} onChange={(event) => setField("whatsappOptIn", event.target.checked)} /><span className="checkmark" /><span>Lead opted in to WhatsApp</span><span className="check-channel"><Icon name="message" size={14} /> WHATSAPP</span></label>
              <p className="consent-note">An unchecked channel is suppressed. No consent is inferred from the enquiry.</p>
            </div>
            <label className="field passcode-field"><span>DEMO PASSCODE <small>SERVER CHECKED</small></span><input value={form.passcode} onChange={(event) => setField("passcode", event.target.value)} placeholder="Enter your private demo passcode" type="password" autoComplete="current-password" /></label>
            {usingDifferentNumber && <div className="number-warning"><span>!</span><p>This is not the configured demo number{demoDigits ? ` (${maskINPhone(demoPhone)})` : "; no demo number is configured"}. Review the exact number before continuing.</p></div>}
            {mode === "live" && <div className="number-warning"><span>!</span><p>Live sending is locked until the workflow is explicitly enabled. The confirmation will name the exact number and opted-in channels.</p></div>}
            {mode === "test" && <div className="number-warning"><span>!</span><p>Test mode only acknowledges the health path. It does not stage a lead or contact a buyer.</p></div>}
            {mode === "demo" && <p className="demo-phone-note">Demo phone prefill: {demoPhone ? maskINPhone(demoPhone) : "set NEXT_PUBLIC_DEMO_PHONE_NUMBER to prefill"}. The local demo never submits it to a provider.</p>}
            {sendError && <div className="inline-error" role="alert">{sendError}</div>}
            {notice && <div className="inline-notice" role="status">{notice}</div>}
            <div className="form-actions"><button className="button button-dark" type="submit" disabled={sending}>{sending ? <><span className="spinner" /> Working…</> : <>Send test lead <Icon name="arrow" size={16} /></>}</button><button className="button button-quiet" type="button" onClick={fillSample}>Fill sample lead</button></div>
            <p className="form-footnote"><span className="lock-mark">⌑</span> Provider secrets stay on the server. Every send is passcode-gated and rate-limited.</p>
          </form>
        </div>

        <div className="panel activity-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">02 / LIVE ACTIVITY</span><h2>One lead, step by step</h2></div>
            <span className={`activity-live ${mode === "demo" ? "activity-local" : ""}`}><i />{mode === "demo" ? "LOCAL RUN" : mode === "test" ? "TEST PATH" : "WATCHING"}</span>
          </div>
          <div className="first-call-card">
            <div className="first-call-top"><span><Icon name="clock" size={15} /> TIME TO FIRST CALL</span><span className="target-chip">TARGET &lt; 2 SEC</span></div>
            <div className="first-call-value">{formatDuration(firstCallMs ?? focusLead?.time_to_call_initiation_ms)}</div>
            <div className="first-call-bottom"><span>{focusLead ? focusLead.name : "Waiting for the next lead"}</span><span>{illustrative ? "ILLUSTRATIVE TIMING" : focusLead?.time_to_call_initiation_ms != null ? "LEDGER VALUE" : "MEASURED IN IST"}</span></div>
          </div>
          <div className="timeline" aria-live="polite">
            {timeline.map((step, index) => <div className={`timeline-step ${step.state === "pending" ? "is-pending" : ""}`} key={step.label}>
              <div className="step-rail"><StateDot state={step.state} />{index < timeline.length - 1 && <span className={`step-line ${step.state === "done" ? "line-done" : ""}`} />}</div>
              <div className="step-content"><div className="step-title-line"><span>{step.label}</span><span className={`step-state-label state-label-${step.state}`}>{step.state}</span></div><p>{step.detail || (step.state === "pending" ? "Waiting for a lead to enter the flow" : "")}</p></div>
              {step.time && <time>{step.time}</time>}
            </div>)}
          </div>
          {mode === "test" && <div className="test-truth"><b>TEST_MODE</b><span>Webhook acknowledgment ≠ lead persisted. No real call placed in test mode.</span></div>}
          <div className="activity-foot"><span className="execution-tag">{focusLead ? `LEAD ${focusLead.lead_id.slice(-10).toUpperCase()}` : "READY FOR A DEMO LEAD"}</span><span>{mode === "demo" ? "LOCAL ONLY · NO NETWORK CALLS TO N8N" : "AUTO-REFRESH EVERY 2.5 SEC"}</span></div>
        </div>
      </section>

      <section className="leads-section" aria-labelledby="leads-heading">
        <div className="section-heading">
          <div><span className="panel-kicker">03 / OPERATOR VIEW</span><h2 id="leads-heading">The lead ledger</h2><p>Every enquiry, with the next best action already in view.</p></div>
          <div className="ledger-stats"><span><b>{leads.length.toString().padStart(2, "0")}</b> LEADS</span><span><b>{hotCount.toString().padStart(2, "0")}</b> HOT</span><span><b>{averageMs == null ? "—" : formatDuration(averageMs)}</b> AVG FIRST CALL</span><button className="refresh-button" onClick={() => { setLoading(true); void fetchLeads(); }} aria-label="Refresh leads"><Icon name="refresh" size={15} /></button></div>
        </div>
        <div className="table-wrap">
          <table className="leads-table">
            <thead><tr><th>LEAD</th><th>SOURCE</th><th>INTENT</th><th>VOICE</th><th>WHATSAPP</th><th>NEXT FOLLOW-UP</th><th><span className="sr-only">Open details</span></th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7}><div className="table-state"><span className="spinner spinner-dark" />Loading the lead ledger…</div></td></tr>}
              {!loading && listError && <tr><td colSpan={7}><div className="table-state table-error"><span>{listError}</span><button onClick={() => { setLoading(true); void fetchLeads(); }}>Try again</button></div></td></tr>}
              {!loading && !listError && sortedLeads.length === 0 && <tr><td colSpan={7}><div className="table-state">No leads yet. Send a sample to watch the flow begin.</div></td></tr>}
              {!loading && !listError && sortedLeads.map((lead) => <tr className="lead-row" key={lead.lead_id} onClick={() => void openDetail(lead)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") void openDetail(lead); }}>
                <td><div className="lead-cell"><span className="avatar">{lead.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span><b>{lead.name}</b><small>{lead.city || "India"} · {formatRange(lead)}</small></span></div></td>
                <td><span className="source-label"><i />{lead.source}</span></td>
                <td><IntentBadge intent={lead.intent_level} /></td>
                <td><StatusPill value={lead.call_status} /></td>
                <td><StatusPill value={lead.whatsapp_status} /></td>
                <td><span className="followup-cell">{formatIST(lead.next_followup_at)}</span></td>
                <td><span className="row-arrow"><Icon name="arrow" size={15} /></span></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className="ledger-footer"><span><i className="privacy-dot" />PHONE NUMBERS MASKED IN THE READ API</span><span>{mode === "demo" ? "FIXTURE RECORDS · ILLUSTRATIVE" : "READ-ONLY LEDGER · REFRESHES ON DEMAND"}</span></div>
      </section>

      <section className={`how-section ${howOpen ? "how-open" : ""}`}>
        <button className="how-toggle" type="button" aria-expanded={howOpen} onClick={() => setHowOpen((value) => !value)}>
          <span className="how-icon"><Icon name="spark" size={19} /></span><span className="how-title"><small>THE STORY TO TELL</small><b>How it works</b></span><span className="how-subtitle">Six small steps from enquiry to next action</span><span className="how-chevron"><Icon name="chevron" size={18} /></span>
        </button>
        {howOpen && <div className="how-grid">
          {[
            ["01", "Lead arrives", "A new enquiry is captured with its property, source and contact preferences."],
            ["02", "Details checked", "The phone is normalized and the lead is de-duplicated before it enters the queue."],
            ["03", "Consent respected", "Call and WhatsApp are separate opt-ins. A missing permission suppresses that channel."],
            ["04", "First response", "Voice and WhatsApp actions are queued inside the 9 AM–8 PM IST contact window."],
            ["05", "Conversation understood", "The call transcript is summarized into intent, interests, objections and budget signals."],
            ["06", "A thoughtful next step", "A follow-up is scheduled with a reason, up to five times, and retries are recorded."],
          ].map(([number, title, description]) => <article className="how-card" key={number}><span>{number}</span><b>{title}</b><p>{description}</p></article>)}
        </div>}
      </section>

      <footer className="page-footer"><span>© LARYNX AI · LEAD RESPONSE STUDIO</span><span>BUILT FOR THE MOMENT AFTER “I’M INTERESTED.”</span><span>09:00 — 20:00 IST</span></footer>

      {focusLead && <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setFocusLead(null); setDetail(null); } }}>
        <aside className="detail-drawer" aria-label={`Lead details for ${detailLead?.name || focusLead.name}`}>
          <div className="drawer-head"><div><span className="panel-kicker">LEAD PROFILE · {focusLead.source}</span><h2>{detailLead?.name || focusLead.name}</h2><p>{detailLead?.phone_e164 ? maskINPhone(detailLead.phone_e164) : "Phone masked"} <span>·</span> {detailLead?.city || focusLead.city || "India"}</p></div><button className="close-button" onClick={() => { setFocusLead(null); setDetail(null); }} aria-label="Close lead details"><Icon name="close" size={18} /></button></div>
          <div className="drawer-body">
            {detailLoading && <div className="drawer-state"><span className="spinner spinner-dark" />Loading the conversation record…</div>}
            {detailError && !detailLoading && <div className="drawer-empty"><span>i</span><p>{detailError}</p></div>}
            {!detailLoading && <>
              <div className="drawer-intent"><div><small>BUYER INTENT</small><IntentBadge intent={detailLead?.intent_level} /></div><div><small>FOLLOW-UPS</small><b>{detailLead?.followup_count || 0}<span> / 5</span></b></div></div>
              <section className="drawer-block"><span className="drawer-label">AI CALL SUMMARY</span><p className="summary-copy">{detailLead?.summary || "The conversation summary will appear here after the AI call analysis completes."}</p></section>
              <div className="insight-grid"><section className="drawer-block"><span className="drawer-label">INTERESTS</span><div className="tag-list">{(detailLead?.interests || []).length ? detailLead?.interests?.map((interest) => <span className="insight-tag" key={interest}>{interest}</span>) : <p className="muted-small">No interests logged yet.</p>}</div></section><section className="drawer-block"><span className="drawer-label">OBJECTIONS</span><div className="tag-list">{(detailLead?.objections || []).length ? detailLead?.objections?.map((objection) => <span className="insight-tag objection-tag" key={objection}>{objection}</span>) : <p className="muted-small">No objections logged yet.</p>}</div></section></div>
              <section className="next-action-card"><span className="drawer-label">RECOMMENDED NEXT ACTION</span><div><Icon name="arrow" size={17} /><b>{formatStatus(detailLead?.next_action || "nurture")}</b></div><p>{detailLead?.next_action_reason || "A next-action reason will appear after the call is analyzed."}</p></section>
              <section className="drawer-block budget-block"><span className="drawer-label">BUDGET SIGNAL</span><p>{detailLead?.budget_signal || formatRange(detailLead as Lead)}</p></section>
              <section className="drawer-block retry-block"><div className="retry-heading"><span className="drawer-label">RETRY & ERROR LOG</span><span>{errorEntries.length} RECORDS</span></div>
                {errorEntries.length ? errorEntries.map((entry) => <article className="error-entry" key={entry.log_id}><span className="error-mark">!</span><div><b>{entry.api || "Workflow step"} · {entry.http_status || "Provider response"}</b><p>{entry.error_message || "An attempt needs attention."}</p><small>{entry.attempt_count ? `${entry.attempt_count} attempts · ` : ""}{entry.ambiguous ? "Outcome uncertain · reconcile before retry" : entry.final ? "Final failure" : "Retry recorded"}{entry.execution_id ? ` · ${entry.execution_id}` : ""}</small></div></article>) : <p className="muted-small">No retries or errors recorded for this lead.</p>}
              </section>
              <section className="drawer-block followup-block"><div className="retry-heading"><span className="drawer-label">FOLLOW-UP QUEUE</span><span>{followups.length} ITEMS</span></div>{followups.length ? followups.map((item) => <div className="followup-item" key={item.followup_id}><span className="followup-num">{String(item.attempt_number || 1).padStart(2, "0")}</span><div><b>{formatStatus(item.next_action || item.channel || "Follow-up")}</b><p>{formatIST(item.next_followup_at)} · {formatStatus(item.status)}</p></div></div>) : <p className="muted-small">No follow-up detail is available yet.</p>}</section>
            </>}
          </div>
          <div className="drawer-foot"><span>READ-ONLY DETAIL</span><span>PHONE MASKED</span></div>
        </aside>
      </div>}
    </main>
  );
}
