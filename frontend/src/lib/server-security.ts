import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import type { AppMode } from "@/lib/types";

const localBuckets = new Map<string, { resetAt: number; count: number }>();
const WINDOW_MS = 60_000;
const MAX_SENDS_PER_WINDOW = 5;

export function verifyPasscode(candidate: unknown): boolean {
  const expected = process.env.DEMO_PASSCODE || "";
  if (typeof candidate !== "string" || !expected) return false;
  const actualBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function requestKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  const ip = request.headers.get("x-real-ip") || forwarded || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

async function durableLimit(key: string): Promise<boolean | null> {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!baseUrl || !token) return null;

  const script = [
    "local now = tonumber(ARGV[1])",
    "local window = tonumber(ARGV[2])",
    "local limit = tonumber(ARGV[3])",
    "redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - window)",
    "local count = redis.call('ZCARD', KEYS[1])",
    "if count >= limit then return 0 end",
    "redis.call('ZADD', KEYS[1], now, ARGV[4])",
    "redis.call('PEXPIRE', KEYS[1], window)",
    "return 1",
  ].join(" ");

  const response = await fetch(`${baseUrl}/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(["EVAL", script, "1", `larynx:send:${key}`, String(Date.now()), String(WINDOW_MS), String(MAX_SENDS_PER_WINDOW), `${Date.now()}-${crypto.randomUUID()}`]),
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error("Durable rate limiter unavailable");
  const payload = await response.json() as { result?: number };
  return Number(payload.result) === 1;
}

export async function allowSend(request: NextRequest, mode: AppMode): Promise<boolean> {
  const key = requestKey(request);
  if (mode === "live" && process.env.NODE_ENV === "production") {
    const allowed = await durableLimit(key);
    return allowed === true;
  }

  const now = Date.now();
  const current = localBuckets.get(key);
  if (!current || current.resetAt <= now) {
    localBuckets.set(key, { resetAt: now + WINDOW_MS, count: 1 });
    if (localBuckets.size > 5000) {
      for (const [bucketKey, bucket] of localBuckets) if (bucket.resetAt <= now) localBuckets.delete(bucketKey);
    }
    return true;
  }
  if (current.count >= MAX_SENDS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}

export function normalizeIndianPhone(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input.trim().replace(/[\s()-]/g, "");
  let digits = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `+91${digits}`;
}
