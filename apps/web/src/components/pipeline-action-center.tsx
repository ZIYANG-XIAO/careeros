"use client";

import { useI18n } from "@/lib/i18n";
import { pipelineAttentionItems, pipelineSummary } from "@/lib/pipeline";
import type { ApplicationSummary } from "@/lib/types";
import { CompanyMark } from "@/components/company-mark";

type PipelineActionCenterProps = {
  applications: ApplicationSummary[];
  onOpenApplication: (applicationId: string) => void;
  /** Explicit user confirmation that a Preparing application was submitted. */
  onConfirmSubmitted?: (applicationId: string) => void;
};

function PipelineActionCenter({
  applications,
  onOpenApplication,
  onConfirmSubmitted,
}: PipelineActionCenterProps) {
  const { t } = useI18n();
  const attention = pipelineAttentionItems(applications);
  const summary = pipelineSummary(applications);
  const metrics = [
    ["pipeline.summary.active", summary.active],
    ["pipeline.summary.needsAction", summary.needsAction],
    ["pipeline.summary.interviews", summary.interviews],
    ["pipeline.summary.offers", summary.offers],
  ] as const;

  return (
    <section
      aria-labelledby="action-center-heading"
      className="overflow-hidden rounded-2xl border border-border bg-surface shadow-raised"
    >
      <div className="border-b border-border bg-accent-tint px-4 py-4 sm:px-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          {t("pipeline.today")}
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2
              id="action-center-heading"
              className="text-lg font-semibold text-ink"
            >
              {t("pipeline.actionCenter.title")}
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              {attention.length > 0
                ? t("pipeline.actionCenter.count", { count: attention.length })
                : t("pipeline.actionCenter.clear")}
            </p>
          </div>
          <span className="rounded-full border border-accent-soft-border bg-surface px-2.5 py-1 text-xs font-semibold text-accent">
            {attention.length > 0
              ? t("pipeline.actionCenter.priority")
              : t("pipeline.actionCenter.upToDate")}
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-2 border-b border-border sm:grid-cols-4">
        {metrics.map(([label, value], index) => (
          <div
            key={label}
            className={`border-border px-4 py-3 ${index % 2 === 0 ? "border-r" : ""} ${index < 2 ? "border-b sm:border-b-0" : ""} sm:border-r sm:last:border-r-0`}
          >
            <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-3">
              {t(label)}
            </dt>
            <dd className="mt-1 text-xl font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      {attention.length > 0 && (
        <ul className="divide-y divide-row-divider">
          {attention.slice(0, 4).map(({ application, reason, daysWaiting }) => (
            <li
              key={application.id}
              className="flex items-center gap-2 pr-4 hover:bg-rail sm:pr-5"
            >
              <button
                type="button"
                onClick={() => onOpenApplication(application.id)}
                className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left sm:pl-5"
              >
                <CompanyMark company={application.company} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {application.company} · {application.role}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-3">
                    {reason === "CONFIRM_SUBMISSION"
                      ? t("pipeline.action.confirmSubmission", {
                          days: daysWaiting,
                        })
                      : t("pipeline.action.considerFollowUp", {
                          days: daysWaiting,
                        })}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-accent">
                  {t("pipeline.action.review")} →
                </span>
              </button>
              {reason === "CONFIRM_SUBMISSION" && onConfirmSubmitted && (
                <button
                  type="button"
                  onClick={() => onConfirmSubmitted(application.id)}
                  className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
                >
                  {t("pipeline.action.markApplied")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export { PipelineActionCenter };
