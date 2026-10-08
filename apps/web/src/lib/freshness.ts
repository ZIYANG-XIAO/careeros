import type { Job } from "./types";

const HOUR_MS = 60 * 60 * 1000;
/** Past this, a catalog job that was not seen again may have closed. */
export const STALE_AFTER_HOURS = 72;

export type Freshness =
  | { kind: "UNTRACKED" }
  | { kind: "CONFIRMED"; hours: number }
  | { kind: "STALE"; hours: number };

/**
 * How recently a sync saw a catalog posting still listed. Jobs the user
 * added themselves are never re-checked, so they are "untracked", not stale.
 */
export function jobFreshness(job: Job, now: Date = new Date()): Freshness {
  if (!job.is_catalog || !job.last_observed_at) return { kind: "UNTRACKED" };
  const hours = Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(job.last_observed_at)) / HOUR_MS),
  );
  return hours >= STALE_AFTER_HOURS
    ? { kind: "STALE", hours }
    : { kind: "CONFIRMED", hours };
}
