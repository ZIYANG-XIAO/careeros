import type { Job } from "./types";

const STORAGE_KEY = "careeros.discover.lastSeenAt";

/**
 * When the user last opened Discover, kept per browser only to highlight
 * what is new since then. Storage can be unavailable (private mode, blocked
 * site data); every caller must work without it.
 */
export function readLastSeen(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeLastSeen(iso: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, iso);
  } catch {
    // Storage unavailable: "new" markers simply will not persist.
  }
}

/** A job first seen by CareerOS after the given moment. */
export function isNewSince(job: Job, since: string | null): boolean {
  if (!since) return false;
  const firstSeen = job.first_observed_at ?? job.created_at;
  return Date.parse(firstSeen) > Date.parse(since);
}
