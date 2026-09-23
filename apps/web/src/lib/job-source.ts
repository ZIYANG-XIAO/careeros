import type { Job } from "./types";

type JobSourceFields = Pick<
  Job,
  "source_type" | "source_key" | "availability_status" | "freshness_status"
>;

export function jobSourceSummary(job: JobSourceFields): string {
  if (job.source_type === "MANUAL_ENTRY") {
    return "Added manually · not a live job feed";
  }

  const source = job.source_key === "demo" ? "Demo source" : job.source_key;
  const availability =
    job.availability_status === "AVAILABLE"
      ? "available"
      : job.availability_status === "UNAVAILABLE"
        ? "unavailable"
        : "availability unknown";
  const freshness =
    job.freshness_status === "CURRENT"
      ? "current"
      : job.freshness_status === "STALE"
        ? "stale"
        : "freshness unknown";
  return `${source} · ${availability} · ${freshness}`;
}
