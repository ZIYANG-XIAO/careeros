"use client";

import { applicationStatusLabel, useI18n } from "@/lib/i18n";
import { FUNNEL_MIN_SAMPLE, type FunnelStage } from "@/lib/pipeline";

/** Descriptive stage counts from recorded history; never a prediction. */
function StageFunnel({
  stages,
  defaultOpen,
}: {
  stages: FunnelStage[];
  defaultOpen: boolean;
}) {
  const { t } = useI18n();
  const max = Math.max(1, ...stages.map((stage) => stage.reached));

  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-border bg-surface"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <span>
          <span className="block text-sm font-semibold text-ink">
            {t("pipeline.funnel.title")}
          </span>
          <span className="block text-xs text-ink-3">
            {t("pipeline.funnel.intro")}
          </span>
        </span>
        <span
          aria-hidden
          className="text-ink-3 transition-transform group-open:rotate-90"
        >
          ›
        </span>
      </summary>
      <ol className="grid grid-cols-3 gap-px border-t border-border bg-border sm:grid-cols-6">
        {stages.map((stage) => (
          <li key={stage.stage} className="bg-surface px-3 py-3">
            <p className="truncate text-[11px] font-medium uppercase tracking-wide text-ink-3">
              {applicationStatusLabel(stage.stage, t)}
            </p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-semibold text-ink">
                {stage.reached}
              </span>
              {stage.rateFromPrevious !== null && (
                <span className="text-xs font-semibold text-accent">
                  {Math.round(stage.rateFromPrevious * 100)}%
                </span>
              )}
            </p>
            <div
              aria-hidden
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken"
            >
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${(stage.reached / max) * 100}%` }}
              />
            </div>
            <p className="mt-1.5 h-4 text-[11px] text-ink-3">
              {stage.medianDays !== null
                ? t("pipeline.funnel.median", { days: stage.medianDays })
                : ""}
            </p>
          </li>
        ))}
      </ol>
      <p className="border-t border-border px-4 py-2 text-[11px] leading-5 text-ink-3 sm:px-5">
        {t("pipeline.funnel.footnote", { min: FUNNEL_MIN_SAMPLE })}
      </p>
    </details>
  );
}

export { StageFunnel };
