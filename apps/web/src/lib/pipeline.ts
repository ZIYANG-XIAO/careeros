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

export function isClosedStatus(status: ApplicationStatus): boolean {
  return CLOSED_STATUSES.has(status);
}
