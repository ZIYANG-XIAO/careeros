"use client";

import Link from "next/link";

import { CompanyMark } from "@/components/company-mark";
import { useI18n } from "@/lib/i18n";
import type {
  RequirementGapClassification,
  RequirementGapsResponse,
} from "@/lib/types";

const CLASSIFICATION_STYLE: Record<RequirementGapClassification, string> = {
  GENUINE_GAP: "bg-status-rejected-bg text-status-rejected-ink",
  WEAK_EVIDENCE: "bg-status-assessment-bg text-status-assessment-ink",
  HIDDEN_EVIDENCE: "bg-status-applied-bg text-status-applied-ink",
};

const CLASSIFICATION_KEY = {
  GENUINE_GAP: "career.gaps.genuine",
  WEAK_EVIDENCE: "career.gaps.weak",
  HIDDEN_EVIDENCE: "career.gaps.hidden",
} as const;

/**
 * Requirements that recur across the jobs the user is pursuing but lack
 * strong, visible evidence. Counts only — never a fit score or probability.
 */
function RequirementGapsCard({
  gaps,
}: {
  gaps: RequirementGapsResponse | null;
}) {
  const { t } = useI18n();
  if (gaps === null) return null;

  const emptyMessage =
    gaps.tracked_job_count === 0
      ? t("career.gaps.noTracked")
      : gaps.analyzed_job_count === 0
        ? t("career.gaps.noAnalyzed")
        : gaps.requirements.length === 0
          ? t("career.gaps.none")
          : null;

  return (
    <section
      aria-labelledby="career-gaps-heading"
      className="overflow-hidden rounded-2xl border border-border bg-surface"
    >
      <div className="border-b border-border px-5 py-4 sm:px-7">
        <h2 id="career-gaps-heading" className="text-lg font-semibold text-ink">
          {t("career.gaps.title")}
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          {t("career.gaps.intro", {
            analyzed: gaps.analyzed_job_count,
            tracked: gaps.tracked_job_count,
          })}
        </p>
      </div>

      {emptyMessage ? (
        <div className="px-5 py-6 sm:px-7">
          <p className="text-sm text-ink-3">{emptyMessage}</p>
          <Link
            href="/discover"
            className="mt-2 inline-flex text-sm font-semibold text-accent hover:underline"
          >
            {t("career.gaps.openDiscover")} →
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-row-divider">
          {gaps.requirements.map((gap) => {
            const onlyHidden =
              gap.genuine_gap_count === 0 && gap.weak_evidence_count === 0;
            return (
              <li key={gap.label} className="px-5 py-4 sm:px-7">
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {gap.label}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {(
                          [
                            ["GENUINE_GAP", gap.genuine_gap_count],
                            ["WEAK_EVIDENCE", gap.weak_evidence_count],
                            ["HIDDEN_EVIDENCE", gap.hidden_evidence_count],
                          ] as const
                        )
                          .filter(([, count]) => count > 0)
                          .map(([classification, count]) => (
                            <span
                              key={classification}
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CLASSIFICATION_STYLE[classification]}`}
                            >
                              {t(CLASSIFICATION_KEY[classification])} · {count}
                            </span>
                          ))}
                      </span>
                    </span>
                    <span className="font-mono text-sm font-semibold text-ink-2">
                      {t("career.gaps.jobCount", { count: gap.job_count })}
                    </span>
                    <span
                      aria-hidden
                      className="text-ink-3 transition-transform group-open:rotate-90"
                    >
                      ›
                    </span>
                  </summary>
                  <div className="mt-3 space-y-2 border-l-2 border-row-divider pl-3">
                    {gap.jobs.map((job) => (
                      <Link
                        key={job.job_id}
                        href={`/discover?focus=${job.job_id}`}
                        className="flex items-center gap-2.5 rounded-md px-1 py-1 text-sm hover:bg-rail"
                      >
                        <CompanyMark company={job.company} size="xs" />
                        <span className="min-w-0 flex-1 truncate text-ink-2">
                          {job.company} · {job.title}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${CLASSIFICATION_STYLE[job.classification]}`}
                        >
                          {t(CLASSIFICATION_KEY[job.classification])}
                        </span>
                      </Link>
                    ))}
                    <Link
                      href={onlyHidden ? "/me/resumes" : "/me/experience"}
                      className="inline-flex pt-1 text-sm font-semibold text-accent hover:underline"
                    >
                      {onlyHidden
                        ? t("career.gaps.showInResume")
                        : t("career.gaps.addEvidence")}{" "}
                      →
                    </Link>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      <p className="border-t border-row-divider px-5 py-3 text-xs leading-5 text-ink-3 sm:px-7">
        {t("career.gaps.footnote")}
      </p>
    </section>
  );
}

export { RequirementGapsCard };
