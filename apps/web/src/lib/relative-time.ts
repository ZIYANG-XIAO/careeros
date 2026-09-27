import type { Locale } from "./i18n";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "today" under 24h, else 1d/3d/2w/3mo — the format used across the Pipeline
 * board, the focus panel, and Discover for status_updated_at/saved_at.
 */
export function formatRelativeTime(
  isoDate: string,
  locale: Locale,
  now: Date = new Date(),
): string {
  const days = Math.floor((now.getTime() - Date.parse(isoDate)) / DAY_MS);
  const chinese = locale === "zh-CN";
  if (days < 1) return chinese ? "今天" : "today";
  if (days < 7) return chinese ? `${days}天` : `${days}d`;
  if (days < 60)
    return chinese ? `${Math.floor(days / 7)}周` : `${Math.floor(days / 7)}w`;
  return chinese
    ? `${Math.floor(days / 30)}个月`
    : `${Math.floor(days / 30)}mo`;
}

/** Whole days elapsed since isoDate; used for the "Stale {days}d" pill (72h+ only). */
export function daysSince(isoDate: string, now: Date = new Date()): number {
  return Math.floor((now.getTime() - Date.parse(isoDate)) / DAY_MS);
}
