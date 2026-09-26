import Link from "next/link";

import { safeExternalUrl } from "@/lib/external-url";
import { jobSourceSummary } from "@/lib/job-source";
import { useI18n } from "@/lib/i18n";
import type { Job } from "@/lib/types";

export function JobCard({
  job,
  onToggleSave,
  saving,
}: {
  job: Job;
  onToggleSave: (job: Job) => void;
  saving: boolean;
}) {
  const { locale, t } = useI18n();
  const applicationUrl = safeExternalUrl(job.application_url);
  const excerpt = job.latest_snapshot.raw_description
    .replaceAll(/\s+/g, " ")
    .trim();

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
            {job.company}
          </p>
          <Link
            href={`/jobs/${job.id}`}
            className="mt-1 block line-clamp-2 text-lg font-semibold leading-6 text-slate-950 outline-none group-hover:text-blue-800 focus-visible:underline"
            title={job.title}
          >
            {job.title}
          </Link>
        </div>
        <button
          type="button"
          onClick={() => onToggleSave(job)}
          disabled={saving}
          aria-pressed={job.is_saved}
          aria-label={`${job.is_saved ? t("jobs.unsave") : t("jobs.save")} ${job.title}`}
          className={`shrink-0 rounded-full p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50 ${
            job.is_saved
              ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
              : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          }`}
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill={job.is_saved ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 4.75A1.75 1.75 0 017.75 3h8.5A1.75 1.75 0 0118 4.75V21l-6-3.75L6 21V4.75z"
            />
          </svg>
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {job.location && <span>{job.location}</span>}
        {job.location && <span aria-hidden="true">·</span>}
        <span>
          {job.latest_snapshot.requirements.length} {t("jobs.requirements")}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {job.market !== "UNKNOWN" && (
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-800">
            {job.market === "NORTH_AMERICA"
              ? t("jobs.northAmerica")
              : t("jobs.china")}
          </span>
        )}
        {job.workplace_type !== "UNKNOWN" && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            {t(
              job.workplace_type === "REMOTE"
                ? "jobs.remote"
                : job.workplace_type === "HYBRID"
                  ? "jobs.hybrid"
                  : "jobs.onsite",
            )}
          </span>
        )}
        {job.employment_type !== "UNKNOWN" && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            {t(
              job.employment_type === "FULL_TIME"
                ? "jobs.fullTime"
                : job.employment_type === "PART_TIME"
                  ? "jobs.partTime"
                  : job.employment_type === "CONTRACT"
                    ? "jobs.contract"
                    : "jobs.internship",
            )}
          </span>
        )}
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">
        {excerpt}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        {applicationUrl ? (
          <a
            href={applicationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            {t("jobs.apply")}
            <svg
              className="ml-1.5 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14 5h5v5m0-5L10 14m8 0v4a1 1 0 01-1 1H6a1 1 0 01-1-1V7a1 1 0 011-1h4"
              />
            </svg>
          </a>
        ) : (
          <span className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-500">
            {t("jobs.noApply")}
          </span>
        )}
        <Link
          href={`/jobs/${job.id}`}
          className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          {t("jobs.viewDetails")}
        </Link>
      </div>
      <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
        {jobSourceSummary(job, locale)}
      </p>
    </article>
  );
}
