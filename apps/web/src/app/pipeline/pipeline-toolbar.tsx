"use client";

import { applicationStatusLabel, useI18n } from "@/lib/i18n";
import {
  EMPTY_PIPELINE_FILTERS,
  hasActiveFilters,
  PIPELINE_STAGES,
  type PipelineFilters,
} from "@/lib/pipeline";

type PipelineToolbarProps = {
  filters: PipelineFilters;
  onChange: (filters: PipelineFilters) => void;
  shown: number;
  total: number;
};

function PipelineToolbar({
  filters,
  onChange,
  shown,
  total,
}: PipelineToolbarProps) {
  const { t } = useI18n();
  const active = hasActiveFilters(filters);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-[200px] flex-1">
        <span className="sr-only">{t("pipeline.filter.search")}</span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-icon-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="9" cy="9" r="5.5" />
          <path d="m13.5 13.5 3.5 3.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={filters.query}
          onChange={(event) =>
            onChange({ ...filters, query: event.target.value })
          }
          placeholder={t("pipeline.filter.search")}
          className="block w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-focus-ring"
        />
      </label>
      <label>
        <span className="sr-only">{t("pipeline.filter.stage")}</span>
        <select
          value={filters.stage}
          onChange={(event) =>
            onChange({
              ...filters,
              stage: event.target.value as PipelineFilters["stage"],
            })
          }
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-focus-ring"
        >
          <option value="ALL">{t("pipeline.filter.allStages")}</option>
          <option value="SAVED">{t("pipeline.column.saved")}</option>
          {PIPELINE_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {applicationStatusLabel(stage, t)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        aria-pressed={filters.attentionOnly}
        onClick={() =>
          onChange({ ...filters, attentionOnly: !filters.attentionOnly })
        }
        className={`rounded-lg border px-3 py-2 text-sm font-medium ${
          filters.attentionOnly
            ? "border-status-assessment-ink bg-status-assessment-bg text-status-assessment-ink"
            : "border-border bg-surface text-ink-2 hover:bg-sunken"
        }`}
      >
        {t("pipeline.filter.attention")}
      </button>
      {active && (
        <>
          <span className="text-xs text-ink-3" role="status">
            {t("pipeline.filter.count", { shown, total })}
          </span>
          <button
            type="button"
            onClick={() => onChange(EMPTY_PIPELINE_FILTERS)}
            className="text-xs font-semibold text-accent hover:text-accent-hover"
          >
            {t("pipeline.filter.clear")}
          </button>
        </>
      )}
    </div>
  );
}

export { PipelineToolbar };
