import type { Lead } from "@/lib/types";

export function formatINR(value?: number | null): string {
  if (value == null || !Number.isFinite(Number(value))) return "Not shared";
  const amount = Number(value);
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(amount % 10_000_000 === 0 ? 0 : 1)} Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(amount % 100_000 === 0 ? 0 : 1)} L`;
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)}`;
}

export function formatRange(lead: Lead): string {
  const min = lead.budget_min;
  const max = lead.budget_max;
  if (min == null && max == null) return "Budget not shared";
  if (min == null) return `Up to ${formatINR(max)}`;
  if (max == null) return `From ${formatINR(min)}`;
  return `${formatINR(min)} – ${formatINR(max)}`;
}

export function formatIST(value?: string | null): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date) + " IST";
}

export function maskINPhone(phone: string): string {
  if (phone.includes("•")) return phone;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return "••••••••••";
  return `+91 ${digits.slice(-10, -8)}•••••${digits.slice(-3)}`;
}

export function formatDuration(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "Waiting for first call";
  return value < 1000 ? `${Math.max(0, Math.round(value))} ms` : `${(value / 1000).toFixed(1)} sec`;
}
