"use client";

import { jobFreshness } from "@/lib/freshness";
import { useI18n } from "@/lib/i18n";
import type { Job } from "@/lib/types";

/** "Confirmed open N hours ago" — or a warning once a posting goes unseen. */
function FreshnessNote({
  job,
  compact = false,
}: {
  job: Job;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const freshness = jobFreshness(job);
  if (freshness.kind === "UNTRACKED") return null;
  if (freshness.kind === "STALE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-status-assessment-bg px-2 py-0.5 text-[11px] font-semibold text-status-assessment-ink">
        {t("freshness.stale", { days: Math.floor(freshness.hours / 24) })}
      </span>
    );
  }
  if (compact) return null;
  const label =
    freshness.hours < 1
      ? t("freshness.confirmedJustNow")
      : freshness.hours < 24
        ? t("freshness.confirmedHours", { hours: freshness.hours })
        : t("freshness.confirmedDays", {
            days: Math.floor(freshness.hours / 24),
          });
  return (
    <span className="inline-flex items-center gap-1 text-xs text-status-offer-ink">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full bg-status-offer-ink"
      />
      {label}
    </span>
  );
}

export { FreshnessNote };
