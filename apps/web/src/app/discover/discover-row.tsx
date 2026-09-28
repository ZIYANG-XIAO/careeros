"use client";

import { applicationStatusLabel, useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n";
import type { FitCriterion, PreferenceFit } from "@/lib/preference-fit";
import type { ApplicationStatus, Job } from "@/lib/types";

type DiscoverRowProps = {
  job: Job;
  selected: boolean;
  linkedStatus: ApplicationStatus | null;
  fit: PreferenceFit;
  onSelect: () => void;
};

const CRITERION_KEYS: Record<FitCriterion, MessageKey> = {
  market: "fit.criterion.market",
  country: "fit.criterion.country",
  role: "fit.criterion.role",
  city: "fit.criterion.city",
  workplace: "fit.criterion.workplace",
  employment: "fit.criterion.employment",
};

function FitChip({ fit }: { fit: PreferenceFit }) {
  const { t } = useI18n();
  if (fit.level === "UNKNOWN") return null;
  if (fit.level === "BLOCKED") {
    return (
      <span className="mt-2 mr-1 inline-block rounded-full bg-status-rejected-bg px-2 py-0.5 text-[11px] font-semibold text-status-rejected-ink">
        {t("fit.blocked")}
      </span>
    );
  }
  const total = fit.matched.length + fit.mismatched.length;
  const detail =
    fit.mismatched.length > 0
      ? t("fit.differs", {
          criteria: fit.mismatched
            .map((criterion) => t(CRITERION_KEYS[criterion]))
            .join(", "),
        })
      : t("fit.allMatch");
  return (
    <span
      title={detail}
      className={`mt-2 mr-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        fit.level === "MATCH"
          ? "bg-status-offer-bg text-status-offer-ink"
          : "bg-rail text-ink-2"
      }`}
    >
      {t("fit.score", { matched: fit.matched.length, total })}
      <span className="sr-only"> — {detail}</span>
    </span>
  );
}

function DiscoverRow({
  job,
  selected,
  linkedStatus,
  fit,
  onSelect,
}: DiscoverRowProps) {
  const { t } = useI18n();
  const chips = [
    job.location,
    job.workplace_type !== "UNKNOWN" ? job.workplace_type : null,
  ].filter((value): value is string => Boolean(value));
  const otherLocationsHint =
    job.similar_count > 0
      ? t("discover.otherLocations", { count: job.similar_count })
      : null;

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
              {otherLocationsHint && (
                <span
                  title={job.other_locations.join(", ")}
                  className="ml-1 text-ink-3/80"
                >
                  · {otherLocationsHint}
                </span>
              )}
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
      <FitChip fit={fit} />
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
