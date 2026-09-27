"use client";

import { applicationStatusLabel, useI18n, type MessageKey } from "@/lib/i18n";
import { PIPELINE_STAGES } from "@/lib/pipeline";
import { daysSince, formatRelativeTime } from "@/lib/relative-time";
import type { ApplicationStatus, ApplicationSummary, Job } from "@/lib/types";

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
}: PipelineCardProps) {
  const { locale, t } = useI18n();
  const isSaved = card.kind === "saved";
  const company = isSaved ? card.job.company : card.application.company;
  const title = isSaved ? card.job.title : card.application.role;
  const timestamp = isSaved
    ? card.job.saved_at
    : card.application.status_updated_at;
  const moveOptions: MoveTarget[] = isSaved
    ? PIPELINE_STAGES
    : [
        ...PIPELINE_STAGES.filter((stage) => stage !== card.application.status),
        "REJECTED",
        "WITHDRAWN",
      ];
  const stale =
    !isSaved &&
    card.application.status === "PREPARING" &&
    daysSince(card.application.status_updated_at) >= 3
      ? daysSince(card.application.status_updated_at)
      : null;

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
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <p className="truncate text-xs font-semibold text-ink-2">{company}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-ink">
          {title}
        </p>
      </button>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-3">
          {timestamp ? formatRelativeTime(timestamp, locale) : ""}
        </span>
        {stale !== null && (
          <span className="rounded-full bg-status-assessment-bg px-1.5 py-0.5 text-[10px] font-semibold text-status-assessment-ink">
            {t("pipeline.stale", { days: stale })}
          </span>
        )}
      </div>
      <label
        className="sr-only"
        htmlFor={`move-${isSaved ? card.job.id : card.application.id}`}
      >
        {t("pipeline.dropTo", { stage: "" })}
      </label>
      <select
        id={`move-${isSaved ? card.job.id : card.application.id}`}
        value=""
        onChange={(event) => {
          if (event.target.value) onMove(event.target.value as MoveTarget);
        }}
        className="mt-2 w-full rounded-md border border-border bg-rail px-2 py-1 text-xs text-ink-2"
      >
        <option value="">···</option>
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
