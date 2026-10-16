import type { AccountQuotaState, AgyModel, AgyUsageGroup } from "../../shared/story-analysis.ts";

/** A bucket with less than this remaining share is treated as exhausted. */
export const QUOTA_EXHAUSTED_BELOW = 0.03;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function modelFamily(slug: string): AgyModel["family"] {
  return /^gemini/iu.test(slug.trim()) ? "gemini" : "third-party";
}

/** Reads the last JSON object printed by agy; earlier lines may be progress output. */
export function lastJsonLine(stdout: string): Record<string, unknown> | null {
  const unwrap = (value: unknown): Record<string, unknown> | null => {
    const record = asRecord(value);
    if (typeof record?.event === "string") {
      return record.event === "result" ? asRecord(record.result) : null;
    }
    return record;
  };
  const whole = stdout.trim();
  if (!whole) return null;
  try { const value = unwrap(JSON.parse(whole)); if (value) return value; } catch { /* Try line by line. */ }
  const lines = whole.split(/\r?\n/u);
  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index]!.trim();
    if (!line.startsWith("{")) continue;
    try { const value = unwrap(JSON.parse(line)); if (value) return value; } catch { /* Keep looking upward. */ }
  }
  return null;
}

/** Parses `agy -p /usage --output-format json` (`command.data.groups[].buckets[]`). */
export function parseUsage(stdout: string): AgyUsageGroup[] {
  const root = lastJsonLine(stdout);
  const command = asRecord(root?.command);
  const data = asRecord(command?.data) ?? asRecord(root?.data) ?? root;
  if (!data || !Array.isArray(data.groups)) return [];
  return data.groups.flatMap((value): AgyUsageGroup[] => {
    const group = asRecord(value);
    if (!group || !Array.isArray(group.buckets)) return [];
    const names = Object.entries(group).filter(([key, item]) => key !== "buckets" && typeof item === "string").map(([, item]) => item as string);
    const result: AgyUsageGroup = {
      family: names.some(name => /gemini/iu.test(name)) ? "gemini" : "third-party",
      fiveHourRemaining: null, fiveHourResetsAt: null, weeklyRemaining: null, weeklyResetsAt: null,
    };
    for (const item of group.buckets) {
      const bucket = asRecord(item);
      if (!bucket || typeof bucket.remaining_fraction !== "number" || !Number.isFinite(bucket.remaining_fraction)) continue;
      const remaining = Math.max(0, Math.min(1, bucket.remaining_fraction));
      const reset = typeof bucket.reset_time === "string" ? bucket.reset_time : null;
      const window = String(bucket.window ?? "").toLowerCase();
      // Check the weekly window first: "168 hours" or "weekly (7d)" must not be mistaken for the 5-hour bucket.
      if (window.includes("week") || window.includes("7d") || window.includes("168")) { result.weeklyRemaining = remaining; result.weeklyResetsAt = reset; }
      else if (window.includes("5h") || window.includes("hour")) { result.fiveHourRemaining = remaining; result.fiveHourResetsAt = reset; }
    }
    return [result];
  });
}

/**
 * Quota for the family of the configured model: EXHAUSTED when the 5h or weekly bucket is below 3 %,
 * with `nextEligibleAt` set to the latest reset among the exhausted buckets.
 */
export function evaluateQuota(groups: AgyUsageGroup[], model: string | null, now: number): { state: AccountQuotaState; nextEligibleAt: number | null } {
  const group = groups.find(item => item.family === (model ? modelFamily(model) : "gemini"));
  if (!group) return { state: "UNKNOWN", nextEligibleAt: null };
  const buckets = [
    { remaining: group.fiveHourRemaining, reset: group.fiveHourResetsAt },
    { remaining: group.weeklyRemaining, reset: group.weeklyResetsAt },
  ].filter((bucket): bucket is { remaining: number; reset: string | null } => bucket.remaining !== null);
  if (!buckets.length) return { state: "UNKNOWN", nextEligibleAt: null };
  const exhausted = buckets.filter(bucket => bucket.remaining < QUOTA_EXHAUSTED_BELOW);
  if (!exhausted.length) return { state: "AVAILABLE", nextEligibleAt: null };
  const resets = exhausted.map(bucket => bucket.reset ? Date.parse(bucket.reset) : Number.NaN).filter(value => Number.isFinite(value) && value > now);
  return { state: "EXHAUSTED", nextEligibleAt: resets.length ? Math.max(...resets) : null };
}

const SLUG = /^[a-z][a-z0-9._-]{2,127}$/iu;

/** Parses `agy models`: JSON when available, otherwise one slug per line (first token, markers stripped). */
export function parseModels(stdout: string): AgyModel[] {
  const slugs: string[] = [];
  const collect = (value: unknown): void => {
    if (typeof value === "string") { if (SLUG.test(value) && value.includes("-")) slugs.push(value); return; }
    if (Array.isArray(value)) { value.forEach(collect); return; }
    const record = asRecord(value);
    if (!record) return;
    for (const key of ["slug", "id", "name", "model"]) if (typeof record[key] === "string") { collect(record[key]); return; }
    for (const key of ["models", "data", "command"]) if (record[key] !== undefined) collect(record[key]);
  };
  try { collect(JSON.parse(stdout)); } catch { /* Plain text listing. */ }
  if (!slugs.length) {
    for (const raw of stdout.split(/\r?\n/u)) {
      const token = raw.replace(/^[\s*>•\-–]+/u, "").trim().split(/\s+/u)[0] ?? "";
      if (SLUG.test(token) && token.includes("-") && !token.endsWith(":")) slugs.push(token);
    }
  }
  return [...new Set(slugs)].map(slug => ({ slug, family: modelFamily(slug) }));
}
