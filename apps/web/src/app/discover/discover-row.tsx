"use client";

import { applicationStatusLabel, useI18n } from "@/lib/i18n";
import type { ApplicationStatus, Job } from "@/lib/types";

type DiscoverRowProps = {
  job: Job;
  selected: boolean;
  linkedStatus: ApplicationStatus | null;
  onSelect: () => void;
};

function DiscoverRow({
  job,
  selected,
  linkedStatus,
  onSelect,
}: DiscoverRowProps) {
  const { t } = useI18n();
  const chips = [
    job.location,
    job.workplace_type !== "UNKNOWN" ? job.workplace_type : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={`w-full border-l-[3px] px-3 py-3 text-left transition-colors ${
        selected
          ? "border-accent bg-accent-tint"
          : "border-transparent hover:bg-rail"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-ink-2">
            {job.company}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-ink">
            {job.title}
          </p>
          {chips.length > 0 && (
            <p className="mt-1 truncate text-xs text-ink-3">
              {chips.join(" · ")}
            </p>
          )}
        </div>
        {job.is_saved && (
          <span
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-accent"
            title={t("discover.saveToPipeline")}
          >
            ♥
          </span>
        )}
      </div>
      {linkedStatus && (
        <span className="mt-2 inline-block rounded-full bg-status-applied-bg px-2 py-0.5 text-[11px] font-semibold text-status-applied-ink">
          {t("discover.inPipeline", {
            stage: applicationStatusLabel(linkedStatus, t),
          })}
        </span>
      )}
    </button>
  );
}

export { DiscoverRow };
