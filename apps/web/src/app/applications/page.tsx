"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { type FormEvent, useCallback, useMemo, useRef, useState } from "react";

import { LoadErrorBanner } from "@/components/load-error-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { createApplication, listApplications, listResumes } from "@/lib/api";
import {
  applicationStatusLabel,
  formatLocaleDate,
  formatResumeVersionLabel,
  useI18n,
} from "@/lib/i18n";
import { useDataFetch } from "@/lib/use-data-fetch";
import type {
  ApplicationStatus,
  ApplicationSummary,
  ResumeSummary,
} from "@/lib/types";

const statuses: ApplicationStatus[] = [
  "PREPARING",
  "APPLIED",
  "ASSESSMENT",
  "INTERVIEW",
  "FINAL",
  "REJECTED",
  "OFFER",
  "WITHDRAWN",
];

function sourceLabel(
  application: ApplicationSummary,
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (application.origin === "CAREEROS_JOB")
    return t("applications.source.careerosJob");
  if (application.origin === "EXTERNAL_PAGE")
    return t("applications.source.externalPage");
  return t("applications.source.manualRecord");
}

export default function ApplicationsPage() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { locale, t } = useI18n();
  const [statusFilter, setStatusFilter] = useState<"ALL" | ApplicationStatus>(
    "ALL",
  );
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordedId, setRecordedId] = useState<string | null>(null);
  const manualRecordKey = useRef<string | null>(null);

  type ApplicationsPageData = {
    applications: ApplicationSummary[];
    resumes: ResumeSummary[];
  };

  const fetchApplicationsData = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Missing authentication token");
    const [applicationResult, resumeResult] = await Promise.all([
      listApplications(
        token,
        statusFilter === "ALL" ? undefined : statusFilter,
      ),
      listResumes(token),
    ]);
    return { applications: applicationResult, resumes: resumeResult };
  }, [getToken, statusFilter]);

  const {
    data,
    setData,
    isInitialLoading,
    isRefreshing,
    loadError,
    refreshError,
    retry,
  } = useDataFetch<ApplicationsPageData>({
    enabled: isLoaded && isSignedIn,
    resetKey: userId ?? undefined,
    initialData: { applications: [], resumes: [] },
    fetch: fetchApplicationsData,
    deps: [getToken, isLoaded, isSignedIn, statusFilter],
  });

  const { applications, resumes } = data;

  const resumeVersions = useMemo(
    () =>
      resumes.flatMap((resume) =>
        resume.versions.map((version) => ({
          id: version.id,
          label: formatResumeVersionLabel(
            resume.name,
            version.version_number,
            t,
          ),
        })),
      ),
    [resumes, t],
  );
  const resumeLabels = useMemo(
    () => new Map(resumeVersions.map((version) => [version.id, version.label])),
    [resumeVersions],
  );

  async function recordApplied(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecording(true);
    setRecordError(null);
    setRecordedId(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    manualRecordKey.current ??= crypto.randomUUID();
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const application = await createApplication(token, {
        idempotency_key: manualRecordKey.current,
        origin: "MANUAL",
        company: String(form.get("company") ?? ""),
        role: String(form.get("role") ?? ""),
        application_url: String(form.get("application_url") ?? "") || null,
        source: String(form.get("source") ?? "") || "manual",
        resume_version_id: String(form.get("resume_version_id") ?? "") || null,
        status: "APPLIED",
        answers: [],
      });
      setRecordedId(application.id);
      manualRecordKey.current = null;
      formElement.reset();
      if (statusFilter === "ALL" || statusFilter === "APPLIED") {
        setData((current) => ({
          ...current,
          applications: [application, ...current.applications],
        }));
      }
    } catch {
      setRecordError(t("applications.recordError"));
    } finally {
      setRecording(false);
    }
  }

  if (!isLoaded || (isInitialLoading && isSignedIn)) {
    return <Spinner />;
  }
  if (!isSignedIn) {
    return (
      <p className="text-sm text-slate-600">
        {t("applications.signInRequired")}
      </p>
    );
  }

  const emptyTitle =
    statusFilter === "ALL"
      ? t("applications.empty.all")
      : locale === "zh-CN"
        ? `${t("applications.empty.nonePrefix")}${applicationStatusLabel(statusFilter, t)}${t("applications.empty.noneSuffix")}`
        : `${t("applications.empty.nonePrefix")}${applicationStatusLabel(statusFilter, t).toLowerCase()}${t("applications.empty.noneSuffix")}`;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            {t("applications.eyebrow")}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            {t("applications.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {t("applications.intro")}
          </p>
        </div>
        <a
          href="#record-application"
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          {t("applications.markAsApplied")}
        </a>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <label
          htmlFor="application-status-filter"
          className="text-sm font-medium text-slate-700"
        >
          {t("applications.status")}
        </label>
        <select
          id="application-status-filter"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as "ALL" | ApplicationStatus)
          }
          className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 sm:max-w-xs"
        >
          <option value="ALL">{t("applications.allApplications")}</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {applicationStatusLabel(status, t)}
            </option>
          ))}
        </select>
      </section>

      <section
        aria-labelledby="application-list-heading"
        aria-busy={isRefreshing}
      >
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2
            id="application-list-heading"
            className="text-lg font-semibold text-slate-950"
          >
            {t("applications.history")}
          </h2>
          <p className="text-sm text-slate-500">
            {applications.length}{" "}
            {locale === "zh-CN"
              ? t("applications.applications")
              : applications.length === 1
                ? t("applications.application")
                : t("applications.applications")}
          </p>
        </div>
        {refreshError && (
          <LoadErrorBanner
            error={refreshError}
            onRetry={retry}
            retryLabel={t("errors.retry")}
            t={t}
          />
        )}
        {loadError ? (
          <LoadErrorBanner
            error={loadError}
            onRetry={retry}
            retryLabel={t("errors.retry")}
            t={t}
          />
        ) : applications.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <h3 className="font-semibold text-slate-950">{emptyTitle}</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              {t("applications.empty.hint")}
            </p>
            <Link
              href="/jobs"
              className="mt-5 inline-block text-sm font-semibold text-blue-700 hover:underline"
            >
              {t("applications.exploreJobs")}
            </Link>
          </div>
        ) : (
          <div
            className={`grid gap-4 md:grid-cols-2 ${isRefreshing ? "opacity-60" : ""}`}
          >
            {applications.map((application) => (
              <Link
                key={application.id}
                href={`/applications/${application.id}`}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                      {application.company}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-950">
                      {application.role}
                    </h3>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {applicationStatusLabel(application.status, t)}
                  </span>
                </div>
                <dl className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {t("applications.applied")}
                    </dt>
                    <dd className="mt-1">
                      {formatLocaleDate(locale, application.applied_at) ??
                        t("common.notSubmittedYet")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {t("applications.resume")}
                    </dt>
                    <dd className="mt-1">
                      {application.resume_version_id
                        ? (resumeLabels.get(application.resume_version_id) ??
                          t("applications.preservedResumeVersion"))
                        : t("applications.noResumeRecorded")}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  {sourceLabel(application, t)} · {application.source}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section
        id="record-application"
        className="rounded-2xl border border-blue-100 bg-blue-50/40 p-6 shadow-sm sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          {t("applications.manualRecovery.eyebrow")}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">
          {t("applications.manualRecovery.title")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          {t("applications.manualRecovery.description")}
        </p>
        <form
          className="mt-6 grid gap-4 md:grid-cols-2"
          onSubmit={recordApplied}
          onChange={() => {
            manualRecordKey.current = null;
          }}
        >
          <Input
            label={t("jobs.company")}
            name="company"
            required
            maxLength={500}
          />
          <Input
            label={t("applications.role")}
            name="role"
            required
            maxLength={500}
          />
          <Input
            label={t("jobs.applicationUrl")}
            name="application_url"
            type="url"
            maxLength={2000}
          />
          <Input
            label={t("applications.sourceLabel")}
            name="source"
            placeholder={t("applications.sourcePlaceholder")}
            maxLength={100}
          />
          <div className="md:col-span-2">
            <label
              htmlFor="manual-resume-version"
              className="block text-sm font-medium text-slate-700"
            >
              {t("applications.resumeUsed")}
            </label>
            <select
              id="manual-resume-version"
              name="resume_version_id"
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">{t("applications.noResumeRecorded")}</option>
              {resumeVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <Button type="submit" loading={recording}>
              {t("applications.recordApplication")}
            </Button>
            {recordedId && (
              <Link
                href={`/applications/${recordedId}`}
                className="text-sm font-semibold text-blue-700 hover:underline"
              >
                {t("applications.recordedViewDetails")}
              </Link>
            )}
          </div>
        </form>
        {recordError && (
          <div
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {recordError}
          </div>
        )}
      </section>
    </div>
  );
}
