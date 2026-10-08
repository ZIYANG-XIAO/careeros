"use client";

import { applicationStatusLabel, useI18n, type MessageKey } from "@/lib/i18n";
import { PIPELINE_STAGES, stageDwell } from "@/lib/pipeline";
import { daysSince } from "@/lib/relative-time";
import type { ApplicationStatus, ApplicationSummary, Job } from "@/lib/types";
import { CompanyMark } from "@/components/company-mark";

export type DragPayload =
  | { kind: "saved"; jobId: string; title: string }
  | { kind: "application"; applicationId: string; from: ApplicationStatus };

type MoveTarget = ApplicationStatus | "REJECTED" | "WITHDRAWN";

type PipelineCardProps = {
  card:
    | { kind: "saved"; job: Job }
    | { kind: "application"; application: ApplicationSummary };
  onOpen: () => void;
  onMove: (target: MoveTarget) => void;
  onDragStart: (payload: DragPayload) => void;
  onDragEnd: () => void;
  dragging: boolean;
  resumeLabel?: string | null;
};

const STAGE_LABEL_KEY: Record<ApplicationStatus, MessageKey> = {
  PREPARING: "applications.status.PREPARING",
  APPLIED: "applications.status.APPLIED",
  ASSESSMENT: "applications.status.ASSESSMENT",
  INTERVIEW: "applications.status.INTERVIEW",
  FINAL: "applications.status.FINAL",
  OFFER: "applications.status.OFFER",
  REJECTED: "applications.status.REJECTED",
  WITHDRAWN: "applications.status.WITHDRAWN",
};

function PipelineCard({
  card,
  onOpen,
  onMove,
  onDragStart,
  onDragEnd,
  dragging,
  resumeLabel = null,
}: PipelineCardProps) {
  const { t } = useI18n();
  const isSaved = card.kind === "saved";
  const company = isSaved ? card.job.company : card.application.company;
  const title = isSaved ? card.job.title : card.application.role;
  const moveOptions: MoveTarget[] = isSaved
    ? PIPELINE_STAGES
    : [
        ...PIPELINE_STAGES.filter((stage) => stage !== card.application.status),
        "REJECTED",
        "WITHDRAWN",
      ];
  const dwell = isSaved ? null : stageDwell(card.application);
  const days = isSaved
    ? card.job.saved_at
      ? daysSince(card.job.saved_at)
      : null
    : (dwell?.days ?? null);
  const timeLabel =
    days === null
      ? ""
      : isSaved
        ? days < 1
          ? t("pipeline.card.savedToday")
          : t("pipeline.card.savedDays", { days })
        : days < 1
          ? t("pipeline.card.inStageToday")
          : t("pipeline.card.inStageDays", { days });

  return (
    <div
      draggable
      onDragStart={(event) => {
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        onDragStart(
          isSaved
            ? { kind: "saved", jobId: card.job.id, title: card.job.title }
            : {
                kind: "application",
                applicationId: card.application.id,
                from: card.application.status,
              },
        );
      }}
      onDragEnd={onDragEnd}
      className={`rounded-lg border border-border bg-surface p-3 shadow-raised transition-opacity ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-2.5 text-left"
      >
        <CompanyMark company={company} size="xs" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-ink-2">
            {company}
          </span>
          <span className="mt-0.5 block truncate text-sm font-semibold text-ink hover:text-accent">
            {title}
          </span>
        </span>
      </button>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-[11px] text-ink-3">{timeLabel}</span>
        {dwell?.stalled && (
          <span className="rounded-full bg-status-assessment-bg px-1.5 py-0.5 text-[10px] font-semibold text-status-assessment-ink">
            {t("pipeline.stale", { days: dwell.days })}
          </span>
        )}
      </div>
      {resumeLabel && (
        <p className="mt-1 truncate text-[11px] text-ink-3">
          {t("pipeline.resume", { name: resumeLabel })}
        </p>
      )}
      <label
        className="sr-only"
        htmlFor={`move-${isSaved ? card.job.id : card.application.id}`}
      >
        {t("pipeline.moveTo")}
      </label>
      <select
        id={`move-${isSaved ? card.job.id : card.application.id}`}
        value=""
        onChange={(event) => {
          if (event.target.value) onMove(event.target.value as MoveTarget);
        }}
        className="mt-2 w-full rounded-md border border-border bg-rail px-2 py-1 text-xs text-ink-2"
      >
        <option value="">{t("pipeline.moveTo")}</option>
        {moveOptions.map((option) => (
          <option key={option} value={option}>
            {applicationStatusLabel(option, t)}
          </option>
        ))}
      </select>
    </div>
  );
}

export { PipelineCard, STAGE_LABEL_KEY };
export type { MoveTarget };
