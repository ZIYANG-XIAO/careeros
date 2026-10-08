"use client";

import { applicationStatusLabel, useI18n, type Locale } from "@/lib/i18n";
import {
  isClosedStatus,
  PIPELINE_STAGES,
  progressSteps,
  stageDwell,
} from "@/lib/pipeline";
import type {
  ApplicationActivity,
  ApplicationStatusHistoryBulkEntry,
  ApplicationSummary,
  Job,
} from "@/lib/types";

import type { MoveTarget } from "./pipeline-card";
import { CompanyMark } from "@/components/company-mark";

function shortDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    month: "numeric",
    day: "numeric",
  }).format(new Date(iso));
}

const DOT_CLASS = {
  done: "border-accent bg-accent",
  current: "border-accent bg-accent ring-4 ring-accent-focus-ring",
  stalled:
    "border-status-assessment-ink bg-status-assessment-ink ring-4 ring-status-assessment-bg",
  closed: "border-status-rejected-ink bg-status-rejected-bg",
  upcoming: "border-border-strong bg-surface",
} as const;

type ProgressRowProps = {
  application: ApplicationSummary;
  history: ApplicationStatusHistoryBulkEntry[];
  location: string | null;
  resumeLabel: string | null;
  upcoming: ApplicationActivity | null;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  onOpen: () => void;
  onMove: (target: MoveTarget) => void;
};

function ProgressRow({
  application,
  history,
  location,
  resumeLabel,
  upcoming,
  selected,
  onSelectedChange,
  onOpen,
  onMove,
}: ProgressRowProps) {
  const { locale, t } = useI18n();
  const steps = progressSteps(application, history);
  const closed = isClosedStatus(application.status);
  const dwell = stageDwell(application);
  const name = `${application.company} · ${application.role}`;
  const moveOptions: MoveTarget[] = [
    ...PIPELINE_STAGES.filter((stage) => stage !== application.status),
    ...(["REJECTED", "WITHDRAWN"] as const).filter(
      (status) => status !== application.status,
    ),
  ];

  return (
    <li
      className={`rounded-xl border bg-surface p-3 transition-colors sm:p-4 ${
        selected
          ? "border-accent-soft-border bg-accent-tint"
          : "border-border hover:border-accent-soft-border"
      } ${closed ? "bg-closed-row" : ""}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-start gap-3 lg:w-[36%]">
          {onSelectedChange && (
            <input
              type="checkbox"
              checked={Boolean(selected)}
              onChange={(event) => onSelectedChange(event.target.checked)}
              aria-label={t("pipeline.list.select", { name })}
              className="mt-3 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
            />
          )}
          <CompanyMark company={application.company} />
          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 flex-1 text-left"
          >
            <span className="block truncate text-sm font-semibold text-ink hover:text-accent">
              {application.role}
            </span>
            <span className="mt-0.5 block truncate text-xs text-ink-2">
              {application.company}
              {location ? ` · ${location}` : ""}
            </span>
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              {dwell.stalled && (
                <span className="rounded-full bg-status-assessment-bg px-2 py-0.5 text-[11px] font-semibold text-status-assessment-ink">
                  {t("pipeline.stale", { days: dwell.days })}
                </span>
              )}
              {upcoming?.scheduled_at && (
                <span className="rounded-full bg-status-interview-bg px-2 py-0.5 text-[11px] font-semibold text-status-interview-ink">
                  {upcoming.activity_type === "INTERVIEW"
                    ? t("pipeline.upcoming.INTERVIEW", {
                        date: shortDate(upcoming.scheduled_at, locale),
                      })
                    : t("pipeline.upcoming.FOLLOW_UP", {
                        date: shortDate(upcoming.scheduled_at, locale),
                      })}
                </span>
              )}
              {resumeLabel && (
                <span className="max-w-full truncate rounded-full bg-sunken px-2 py-0.5 text-[11px] text-ink-2">
                  {t("pipeline.resume", { name: resumeLabel })}
                </span>
              )}
            </span>
          </button>
        </div>

        <ol
          aria-label={t("pipeline.list.progress", { name })}
          className="grid min-w-0 flex-1 grid-cols-6"
        >
          {steps.map((step, index) => {
            const tone =
              step.state === "current" && dwell.stalled
                ? "stalled"
                : step.state;
            const reached = step.state !== "upcoming";
            return (
              <li
                key={step.stage}
                aria-current={step.state === "current" ? "step" : undefined}
                className="relative flex flex-col items-center text-center"
              >
                {index > 0 && (
                  <span
                    aria-hidden
                    className={`absolute right-1/2 top-[6px] h-0.5 w-full ${
                      reached ? "bg-accent" : "bg-border"
                    }`}
                  />
                )}
                <span
                  aria-hidden
                  className={`relative z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 text-[9px] leading-none text-status-rejected-ink ${DOT_CLASS[tone]}`}
                >
                  {step.state === "closed" ? "×" : ""}
                </span>
                <span
                  className={`mt-1.5 text-[11px] leading-tight ${
                    step.state === "current" || step.state === "closed"
                      ? "font-semibold text-ink"
                      : reached
                        ? "text-ink-2"
                        : "text-ink-3"
                  }`}
                >
                  {applicationStatusLabel(step.stage, t)}
                </span>
                <span className="mt-0.5 h-4 font-mono text-[10px] text-ink-3">
                  {step.date
                    ? shortDate(step.date, locale)
                    : reached
                      ? "—"
                      : ""}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="flex items-center justify-between gap-2 lg:w-36 lg:flex-col lg:items-stretch">
          {closed && (
            <span className="text-xs font-semibold text-status-rejected-ink">
              {applicationStatusLabel(application.status, t)}
            </span>
          )}
          <select
            aria-label={`${t("pipeline.moveTo")} ${name}`}
            value=""
            onChange={(event) => {
              if (event.target.value) onMove(event.target.value as MoveTarget);
            }}
            className="w-full rounded-md border border-border bg-rail px-2 py-1.5 text-xs text-ink-2"
          >
            <option value="">{t("pipeline.moveTo")}</option>
            {moveOptions.map((option) => (
              <option key={option} value={option}>
                {applicationStatusLabel(option, t)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </li>
  );
}

function SavedProgressRow({
  job,
  onOpen,
  onStart,
}: {
  job: Job;
  onOpen: () => void;
  onStart: () => void;
}) {
  const { t } = useI18n();
  return (
    <li className="rounded-xl border border-dashed border-border-strong bg-rail p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <CompanyMark company={job.company} />
          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 flex-1 text-left"
          >
            <span className="block truncate text-sm font-semibold text-ink hover:text-accent">
              {job.title}
            </span>
            <span className="mt-0.5 block truncate text-xs text-ink-2">
              {job.company}
              {job.location ? ` · ${job.location}` : ""}
            </span>
          </button>
        </div>
        <span className="text-xs text-ink-3">{t("pipeline.column.saved")}</span>
        <button
          type="button"
          onClick={onStart}
          className="rounded-md border border-accent-soft-border bg-surface px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent-tint"
        >
          {t("pipeline.list.startApplication")}
        </button>
      </div>
    </li>
  );
}

export { ProgressRow, SavedProgressRow };
