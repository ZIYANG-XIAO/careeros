import type {
  ApplicationStatus,
  ApplicationStatusHistoryBulkEntry,
  ApplicationSummary,
  Job,
} from "./types";

export const PIPELINE_STAGES: ApplicationStatus[] = [
  "PREPARING",
  "APPLIED",
  "ASSESSMENT",
  "INTERVIEW",
  "FINAL",
  "OFFER",
];

const CLOSED_STATUSES = new Set<ApplicationStatus>(["REJECTED", "WITHDRAWN"]);
const NEEDS_YOU_THRESHOLD_MS = 72 * 60 * 60 * 1000;
const FOLLOW_UP_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export type PipelineAttentionItem = {
  application: ApplicationSummary;
  reason: "CONFIRM_SUBMISSION" | "CONSIDER_FOLLOW_UP";
  daysWaiting: number;
};

export type PipelineSummary = {
  active: number;
  needsAction: number;
  interviews: number;
  offers: number;
};

/** Saved jobs that have not yet become an application — Pipeline's column 0. */
export function savedColumnJobs(
  savedJobs: Job[],
  applications: ApplicationSummary[],
): Job[] {
  const linkedJobIds = new Set(
    applications
      .map((application) => application.job_id)
      .filter((jobId): jobId is string => jobId !== null),
  );
  return savedJobs
    .filter((job) => !linkedJobIds.has(job.id))
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Open (non-closed) applications grouped by stage, each ordered by most-recently-updated. */
export function groupByStage(
  applications: ApplicationSummary[],
): Record<ApplicationStatus, ApplicationSummary[]> {
  const groups = Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [stage, [] as ApplicationSummary[]]),
  ) as Record<ApplicationStatus, ApplicationSummary[]>;
  for (const application of applications) {
    if (CLOSED_STATUSES.has(application.status)) continue;
    groups[application.status]?.push(application);
  }
  for (const stage of PIPELINE_STAGES) {
    groups[stage].sort((a, b) =>
      b.status_updated_at.localeCompare(a.status_updated_at),
    );
  }
  return groups;
}

/** Applications in the read-only closed lane (Rejected/Withdrawn), most-recent first. */
export function closedApplications(
  applications: ApplicationSummary[],
): ApplicationSummary[] {
  return applications
    .filter((application) => CLOSED_STATUSES.has(application.status))
    .slice()
    .sort((a, b) => b.status_updated_at.localeCompare(a.status_updated_at));
}

/** Applications sat in Preparing for over 72h — the "Needs you" strip. */
export function needsYouApplications(
  applications: ApplicationSummary[],
  now: Date = new Date(),
): ApplicationSummary[] {
  return applications.filter(
    (application) =>
      application.status === "PREPARING" &&
      now.getTime() - Date.parse(application.status_updated_at) >
        NEEDS_YOU_THRESHOLD_MS,
  );
}

/**
 * A deliberately small action queue based only on facts CareerOS already owns.
 * It never claims an external follow-up is due or that an application was sent:
 * Preparing items are confirmation prompts, and older Applied items are merely
 * suggestions to consider a follow-up.
 */
export function pipelineAttentionItems(
  applications: ApplicationSummary[],
  now: Date = new Date(),
): PipelineAttentionItem[] {
  return applications
    .flatMap((application): PipelineAttentionItem[] => {
      const elapsed = now.getTime() - Date.parse(application.status_updated_at);
      const daysWaiting = Math.max(
        0,
        Math.floor(elapsed / (24 * 60 * 60 * 1000)),
      );
      if (
        application.status === "PREPARING" &&
        elapsed > NEEDS_YOU_THRESHOLD_MS
      ) {
        return [{ application, reason: "CONFIRM_SUBMISSION", daysWaiting }];
      }
      if (
        application.status === "APPLIED" &&
        elapsed > FOLLOW_UP_THRESHOLD_MS
      ) {
        return [{ application, reason: "CONSIDER_FOLLOW_UP", daysWaiting }];
      }
      return [];
    })
    .sort((a, b) => b.daysWaiting - a.daysWaiting);
}

export function pipelineSummary(
  applications: ApplicationSummary[],
  now: Date = new Date(),
): PipelineSummary {
  return {
    active: applications.filter(
      (application) => !CLOSED_STATUSES.has(application.status),
    ).length,
    needsAction: pipelineAttentionItems(applications, now).length,
    interviews: applications.filter((application) =>
      ["ASSESSMENT", "INTERVIEW", "FINAL"].includes(application.status),
    ).length,
    offers: applications.filter((application) => application.status === "OFFER")
      .length,
  };
}

export function isClosedStatus(status: ApplicationStatus): boolean {
  return CLOSED_STATUSES.has(status);
}

// ---------------------------------------------------------------------------
// Stage progress, dwell time, and filtering
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Days in a stage after which a card is flagged as worth a look. A neutral
 * nudge only: it never claims an employer has gone silent or that a job is a
 * ghost posting. Offer has no threshold since the decision is the user's.
 */
export const STAGE_STALL_DAYS: Partial<Record<ApplicationStatus, number>> = {
  PREPARING: 3,
  APPLIED: 7,
  ASSESSMENT: 7,
  INTERVIEW: 10,
  FINAL: 10,
};

export type StageDwell = { days: number; stalled: boolean };

export function stageDwell(
  application: ApplicationSummary,
  now: Date = new Date(),
): StageDwell {
  const days = Math.max(
    0,
    Math.floor(
      (now.getTime() - Date.parse(application.status_updated_at)) / DAY_MS,
    ),
  );
  const threshold = STAGE_STALL_DAYS[application.status];
  return { days, stalled: threshold !== undefined && days >= threshold };
}

/** Bulk status history grouped by application, each list oldest first. */
export function groupStatusHistory(
  entries: ApplicationStatusHistoryBulkEntry[],
): Map<string, ApplicationStatusHistoryBulkEntry[]> {
  const grouped = new Map<string, ApplicationStatusHistoryBulkEntry[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.application_id) ?? [];
    list.push(entry);
    grouped.set(entry.application_id, list);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.changed_at.localeCompare(b.changed_at));
  }
  return grouped;
}

export type ProgressStepState = "done" | "current" | "closed" | "upcoming";

export type ProgressStep = {
  stage: ApplicationStatus;
  state: ProgressStepState;
  /** When the application most recently entered this stage; null if skipped or unknown. */
  date: string | null;
};

/**
 * One step per open stage, with the date the application entered it. Stages
 * the user skipped (e.g. straight to Interview) read as done without a date
 * rather than inventing one. A closed application stops at the stage it was
 * closed from, which is marked "closed".
 */
export function progressSteps(
  application: ApplicationSummary,
  history: ApplicationStatusHistoryBulkEntry[] = [],
): ProgressStep[] {
  const entered = new Map<ApplicationStatus, string>();
  for (const entry of history) entered.set(entry.to_status, entry.changed_at);

  let reached: ApplicationStatus | null = application.status;
  const closed = CLOSED_STATUSES.has(application.status);
  if (closed) {
    const closing = [...history]
      .reverse()
      .find((entry) => entry.to_status === application.status);
    reached = closing?.from_status ?? null;
    if (reached && CLOSED_STATUSES.has(reached)) reached = null;
  } else if (!entered.has(application.status)) {
    entered.set(application.status, application.status_updated_at);
  }
  const reachedIndex = reached ? PIPELINE_STAGES.indexOf(reached) : -1;

  return PIPELINE_STAGES.map((stage, index) => ({
    stage,
    state:
      index < reachedIndex
        ? "done"
        : index === reachedIndex
          ? closed
            ? "closed"
            : "current"
          : "upcoming",
    date: index <= reachedIndex ? (entered.get(stage) ?? null) : null,
  }));
}

export type PipelineFilters = {
  query: string;
  stage: ApplicationStatus | "SAVED" | "ALL";
  attentionOnly: boolean;
};

export const EMPTY_PIPELINE_FILTERS: PipelineFilters = {
  query: "",
  stage: "ALL",
  attentionOnly: false,
};

export function hasActiveFilters(filters: PipelineFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.stage !== "ALL" ||
    filters.attentionOnly
  );
}

function matchesQuery(query: string, ...fields: (string | null)[]): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => field?.toLowerCase().includes(needle));
}

export function filterApplications(
  applications: ApplicationSummary[],
  filters: PipelineFilters,
  now: Date = new Date(),
): ApplicationSummary[] {
  if (filters.stage === "SAVED") return [];
  return applications.filter(
    (application) =>
      (filters.stage === "ALL" || application.status === filters.stage) &&
      (!filters.attentionOnly || stageDwell(application, now).stalled) &&
      matchesQuery(filters.query, application.company, application.role),
  );
}

export function filterSavedJobs(jobs: Job[], filters: PipelineFilters): Job[] {
  if (filters.attentionOnly) return [];
  if (filters.stage !== "ALL" && filters.stage !== "SAVED") return [];
  return jobs.filter((job) =>
    matchesQuery(filters.query, job.company, job.title, job.location),
  );
}

// ---------------------------------------------------------------------------
// Stage funnel (count-only)
// ---------------------------------------------------------------------------

/** Below this many applications a stage-to-stage rate is not shown. */
export const FUNNEL_MIN_SAMPLE = 5;
/** Below this many completed stints a median stage duration is not shown. */
export const FUNNEL_MIN_DURATIONS = 3;

export type FunnelStage = {
  stage: ApplicationStatus;
  /** Applications that reached this stage or any later one. */
  reached: number;
  /** reached / previous stage's reached, only with a big enough sample. */
  rateFromPrevious: number | null;
  /** Median whole days spent in the stage across completed stints. */
  medianDays: number | null;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/**
 * How far applications got and how long completed stages took, derived only
 * from recorded status history. Descriptive counts, never a prediction.
 */
export function stageFunnel(
  applications: ApplicationSummary[],
  historyByApplication: Map<string, ApplicationStatusHistoryBulkEntry[]>,
): FunnelStage[] {
  const furthest: number[] = [];
  const durations = new Map<ApplicationStatus, number[]>();

  for (const application of applications) {
    const history = historyByApplication.get(application.id) ?? [];
    let reachedIndex = CLOSED_STATUSES.has(application.status)
      ? -1
      : PIPELINE_STAGES.indexOf(application.status);
    for (const entry of history) {
      for (const status of [entry.from_status, entry.to_status]) {
        if (status) {
          reachedIndex = Math.max(
            reachedIndex,
            PIPELINE_STAGES.indexOf(status),
          );
        }
      }
    }
    furthest.push(reachedIndex);

    for (let index = 0; index < history.length - 1; index += 1) {
      const stage = history[index].to_status;
      if (CLOSED_STATUSES.has(stage)) continue;
      const days =
        (Date.parse(history[index + 1].changed_at) -
          Date.parse(history[index].changed_at)) /
        DAY_MS;
      const list = durations.get(stage) ?? [];
      list.push(Math.max(0, Math.round(days)));
      durations.set(stage, list);
    }
  }

  return PIPELINE_STAGES.map((stage, index) => {
    const reached = furthest.filter((value) => value >= index).length;
    const previous =
      index === 0
        ? null
        : furthest.filter((value) => value >= index - 1).length;
    const stints = durations.get(stage) ?? [];
    return {
      stage,
      reached,
      rateFromPrevious:
        previous !== null && previous >= FUNNEL_MIN_SAMPLE
          ? reached / previous
          : null,
      medianDays: stints.length >= FUNNEL_MIN_DURATIONS ? median(stints) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// CSV export / import
// ---------------------------------------------------------------------------

const APPLICATION_STATUSES = new Set<string>([
  "PREPARING",
  "APPLIED",
  "ASSESSMENT",
  "INTERVIEW",
  "FINAL",
  "REJECTED",
  "OFFER",
  "WITHDRAWN",
]);

/** Machine-readable header, shared by export and import — raw enum values and ISO dates, not locale-formatted display text, so a file this app exports can always be re-imported. */
export const APPLICATION_CSV_HEADER = [
  "company",
  "role",
  "status",
  "applied_at",
  "source",
  "application_url",
  "created_at",
];

export function applicationsToCsvRows(
  applications: ApplicationSummary[],
): string[][] {
  return [
    APPLICATION_CSV_HEADER,
    ...applications.map((application) => [
      application.company,
      application.role,
      application.status,
      application.applied_at ?? "",
      application.source,
      application.application_url ?? "",
      application.created_at,
    ]),
  ];
}

export type ParsedImportRow =
  | {
      ok: true;
      row: number;
      payload: {
        company: string;
        role: string;
        status: ApplicationStatus;
        applied_at?: string;
        source: string;
        application_url?: string;
      };
    }
  | { ok: false; row: number; reason: "missingCompanyRole" };

/**
 * Parse CSV rows (as returned by `parseCsv`) into per-row import payloads.
 * Lenient by design: an unrecognized status falls back to PREPARING, a
 * malformed URL is dropped rather than failing the row, and a leading
 * header row (first cell "company", case-insensitive) is skipped if
 * present. Only a missing company or role fails a row outright, since
 * there is no way to create an Application without both.
 */
export function parseApplicationImportRows(
  rows: string[][],
): ParsedImportRow[] {
  const hasHeader = rows[0]?.[0]?.trim().toLowerCase() === "company";
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const headerOffset = hasHeader ? 2 : 1;

  return dataRows.map((cells, index) => {
    const row = index + headerOffset;
    const company = (cells[0] ?? "").trim();
    const role = (cells[1] ?? "").trim();
    if (!company || !role) {
      return { ok: false, row, reason: "missingCompanyRole" };
    }

    const statusRaw = (cells[2] ?? "").trim().toUpperCase();
    const status = (
      APPLICATION_STATUSES.has(statusRaw) ? statusRaw : "PREPARING"
    ) as ApplicationStatus;

    const appliedAtRaw = (cells[3] ?? "").trim();
    const appliedAtDate = appliedAtRaw ? new Date(appliedAtRaw) : null;
    const applied_at =
      status !== "PREPARING" &&
      appliedAtDate &&
      !Number.isNaN(appliedAtDate.getTime())
        ? appliedAtDate.toISOString()
        : undefined;

    const source = (cells[4] ?? "").trim() || "csv_import";

    const urlRaw = (cells[5] ?? "").trim();
    let application_url: string | undefined;
    if (urlRaw) {
      try {
        const parsed = new URL(urlRaw);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          application_url = urlRaw;
        }
      } catch {
        // Malformed URL: drop it, keep the rest of the row.
      }
    }

    return {
      ok: true,
      row,
      payload: { company, role, status, applied_at, source, application_url },
    };
  });
}
