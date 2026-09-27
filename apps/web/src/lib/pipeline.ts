import type { ApplicationStatus, ApplicationSummary, Job } from "./types";

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
