import "server-only";
import type { AppMode } from "@/lib/types";

const validModes: AppMode[] = ["demo", "test", "live"];

export function getMode(): AppMode {
  const candidate = (process.env.MODE || process.env.NEXT_PUBLIC_MODE || "demo").toLowerCase();
  return validModes.includes(candidate as AppMode) ? (candidate as AppMode) : "demo";
}
