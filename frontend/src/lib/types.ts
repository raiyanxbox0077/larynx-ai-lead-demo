export type AppMode = "demo" | "test" | "live";
export type StepState = "pending" | "done" | "skipped" | "failed";

export interface Lead {
  lead_id: string;
  name: string;
  phone_e164: string;
  email?: string;
  property_interest: string;
  budget_min?: number | null;
  budget_max?: number | null;
  city?: string;
  locality?: string;
  source: string;
  received_at: string;
  status: string;
  call_run_id?: string | null;
  call_status?: string;
  whatsapp_status?: string;
  whatsapp_accepted_at?: string | null;
  time_to_call_initiation_ms?: number | null;
  intent_level?: "hot" | "warm" | "cold" | null;
  summary?: string;
  next_followup_at?: string | null;
  followup_count: number;
  do_not_contact: boolean;
  call_consent: boolean;
  whatsapp_opt_in: boolean;
  updated_at?: string;
  preferred_followup_time?: string;
  preferred_channel?: string;
  objections?: string[];
  interests?: string[];
  budget_signal?: string;
  next_action?: string;
  next_action_reason?: string;
}

export interface Followup {
  followup_id: string;
  lead_id: string;
  run_id?: string;
  intent_level?: string;
  next_action?: string;
  next_followup_at?: string | null;
  channel?: string;
  attempt_number?: number;
  status: string;
  summary?: string;
  objections?: string[];
  interests?: string[];
  budget_signal?: string;
  next_action_reason?: string;
}

export interface ErrorEntry {
  log_id: string;
  lead_id?: string;
  api?: string;
  http_status?: number | string | null;
  error_message?: string;
  attempt_count?: number;
  final?: boolean;
  ambiguous?: boolean;
  timestamp?: string;
  execution_id?: string;
}

export interface LeadDetail {
  lead: Lead;
  followups: Followup[];
  errors: ErrorEntry[];
}

export interface ActivityStep {
  label: string;
  state: StepState;
  detail?: string;
  time?: string;
}
