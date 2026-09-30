"use client";

import { CompanyMark } from "@/components/company-mark";
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

const WORKPLACE_KEYS = {
  REMOTE: "jobs.remote",
  HYBRID: "jobs.hybrid",
  ONSITE: "jobs.onsite",
} as const;

const EMPLOYMENT_KEYS = {
  FULL_TIME: "jobs.fullTime",
  PART_TIME: "jobs.partTime",
  CONTRACT: "jobs.contract",
  INTERNSHIP: "jobs.internship",
} as const;

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
    job.workplace_type !== "UNKNOWN"
      ? t(WORKPLACE_KEYS[job.workplace_type])
      : null,
    job.employment_type !== "UNKNOWN"
      ? t(EMPLOYMENT_KEYS[job.employment_type])
      : null,
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
      className={`w-full border-l-[3px] px-4 py-4 text-left transition-colors ${
        selected
          ? "border-accent bg-accent-tint"
          : "border-transparent hover:bg-rail"
      }`}
    >
      <div className="flex items-start gap-3.5">
        <CompanyMark company={job.company} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-2">
                {job.company}
              </p>
              <p className="mt-1 line-clamp-2 text-base font-semibold leading-6 text-ink">
                {job.title}
              </p>
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
          {chips.length > 0 && (
            <p className="mt-1.5 truncate text-sm text-ink-3">
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
          <FitChip fit={fit} />
          {linkedStatus && (
            <span className="mt-2 inline-block rounded-full bg-status-applied-bg px-2 py-0.5 text-[11px] font-semibold text-status-applied-ink">
              {t("discover.inPipeline", {
                stage: applicationStatusLabel(linkedStatus, t),
              })}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export { DiscoverRow };
