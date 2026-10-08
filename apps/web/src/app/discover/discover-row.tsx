"use client";

import { CompanyMark } from "@/components/company-mark";
import { FreshnessNote } from "@/components/freshness-note";
import { SponsorshipChip } from "@/components/sponsorship-note";
import { DropdownItem, DropdownMenu } from "@/components/ui/dropdown-menu";
import { applicationStatusLabel, useI18n } from "@/lib/i18n";
import { jobFreshness } from "@/lib/freshness";
import { formatSalary } from "@/lib/salary";
import { daysSince, formatRelativeTime } from "@/lib/relative-time";
import type { MessageKey } from "@/lib/i18n";
import type { FitCriterion, PreferenceFit } from "@/lib/preference-fit";
import type { ApplicationStatus, Job } from "@/lib/types";

type DiscoverRowProps = {
  job: Job;
  selected: boolean;
  linkedStatus: ApplicationStatus | null;
  fit: PreferenceFit;
  isNew?: boolean;
  onSelect: () => void;
  /** Omitted where browse feedback does not apply (saved or private views). */
  onDismiss?: () => void;
  onHideCompany?: () => void;
  onToggleSave?: () => void;
  saving?: boolean;
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
      <span className="rounded-full bg-status-rejected-bg px-2 py-0.5 text-[11px] font-semibold text-status-rejected-ink">
        {t("fit.blocked")}
      </span>
    );
  }
  if (fit.matched.length === 0) return null;
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
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        fit.level === "MATCH"
          ? "bg-status-offer-bg text-status-offer-ink"
          : "bg-sunken text-ink-2"
      }`}
    >
      {t("fit.matches", {
        criteria: fit.matched
          .map((criterion) => t(CRITERION_KEYS[criterion]))
          .join(" · "),
      })}
      <span className="sr-only"> — {detail}</span>
    </span>
  );
}

function DiscoverRow({
  job,
  selected,
  linkedStatus,
  fit,
  isNew = false,
  onSelect,
  onDismiss,
  onHideCompany,
  onToggleSave,
  saving = false,
}: DiscoverRowProps) {
  const { locale, t } = useI18n();
  // "Remote" already says the workplace; do not repeat it as a chip.
  const remoteLocation = /\bremote\b|远程/i.test(job.location ?? "");
  const meta = [
    job.location,
    job.workplace_type !== "UNKNOWN" &&
    !(job.workplace_type === "REMOTE" && remoteLocation)
      ? t(WORKPLACE_KEYS[job.workplace_type])
      : null,
    job.employment_type !== "UNKNOWN"
      ? t(EMPLOYMENT_KEYS[job.employment_type])
      : null,
    job.similar_count > 0
      ? t("discover.otherLocations", { count: job.similar_count })
      : null,
  ].filter((value): value is string => Boolean(value));
  const published = job.posted_at ?? null;
  const moment = published ?? job.first_observed_at ?? job.created_at;
  const ageLabel =
    daysSince(moment) < 1
      ? t(published ? "discover.postedToday" : "discover.seenToday")
      : t(published ? "discover.postedAgo" : "discover.seenAgo", {
          time: formatRelativeTime(moment, locale),
        });
  const status = job.application_status ?? linkedStatus;
  const noSponsorship = job.sponsorship?.status === "NOT_OFFERED";
  const stale = jobFreshness(job).kind === "STALE";
  const badges =
    fit.level !== "UNKNOWN" ||
    job.sponsorship?.status === "OFFERED" ||
    Boolean(status) ||
    stale;

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected}
        className={`w-full border-l-[3px] px-4 py-3 text-left transition-colors ${
          selected
            ? "border-accent bg-accent-tint"
            : "border-transparent hover:bg-rail"
        }`}
      >
        <div className="flex items-start gap-3 pr-8">
          <CompanyMark company={job.company} size="md" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[15px] font-semibold leading-5 text-ink">
              {job.title}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-2">
              <span className="truncate font-medium">{job.company}</span>
              {job.salary && (
                <span
                  className="shrink-0 font-semibold text-ink"
                  title={job.salary.quote}
                >
                  · {formatSalary(job.salary, locale)}
                </span>
              )}
              {isNew && (
                <span className="shrink-0 rounded-full bg-accent px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white">
                  {t("discover.newChip")}
                </span>
              )}
            </p>
            <p
              className="mt-1 truncate text-xs text-ink-3"
              title={
                job.other_locations.length > 0
                  ? job.other_locations.join(", ")
                  : undefined
              }
            >
              {[...meta, ageLabel].join(" · ")}
            </p>
            {noSponsorship && (
              <p
                className="mt-0.5 truncate text-[11px] text-ink-3"
                title={job.sponsorship?.quote}
              >
                {t("sponsorship.notOfferedShort")}
              </p>
            )}
            {badges && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                <FreshnessNote job={job} compact />
                <FitChip fit={fit} />
                {job.sponsorship?.status === "OFFERED" && (
                  <SponsorshipChip statement={job.sponsorship} />
                )}
                {status && (
                  <span className="rounded-full bg-status-applied-bg px-2 py-0.5 text-[11px] font-semibold text-status-applied-ink">
                    {t("discover.inPipeline", {
                      stage: applicationStatusLabel(status, t),
                    })}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </button>
      {onToggleSave && (
        <button
          type="button"
          onClick={onToggleSave}
          disabled={saving}
          aria-pressed={job.is_saved}
          aria-label={
            job.is_saved
              ? t("discover.unsaveJob", { title: job.title })
              : t("discover.saveJob", { title: job.title })
          }
          title={job.is_saved ? t("jobs.unsave") : t("jobs.save")}
          className={`absolute right-2 top-3 grid h-9 w-9 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 ${
            job.is_saved
              ? "text-accent hover:bg-accent-soft"
              : "text-icon-muted hover:bg-sunken hover:text-accent"
          }`}
        >
          <svg
            key={job.is_saved ? "saved" : "unsaved"}
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={`h-5 w-5 ${job.is_saved ? "heart-pop" : ""}`}
            fill={job.is_saved ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          >
            <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 6.9 4.5c2 0 3.6 1.1 4.4 2.6h1.4c.8-1.5 2.4-2.6 4.4-2.6 3.5 0 5.5 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />
          </svg>
        </button>
      )}
      {(onDismiss || onHideCompany) && (
        <div className="absolute bottom-2 right-2 opacity-100 transition-opacity focus-within:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
          <DropdownMenu
            label={t("discover.feedback.menu", {
              title: job.title,
              company: job.company,
            })}
          >
            {onDismiss && (
              <DropdownItem onClick={onDismiss}>
                {t("discover.feedback.notInterested")}
              </DropdownItem>
            )}
            {onHideCompany && (
              <DropdownItem onClick={onHideCompany}>
                {t("discover.feedback.hideCompany")}
              </DropdownItem>
            )}
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

export { DiscoverRow };
