"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { createApplication, listApplications, listResumes } from "@/lib/api";
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

function statusLabel(status: ApplicationStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function formatDate(value: string | null): string {
  if (!value) return "Not submitted yet";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function sourceLabel(application: ApplicationSummary): string {
  if (application.origin === "CAREEROS_JOB") return "CareerOS Job";
  if (application.origin === "EXTERNAL_PAGE") return "External application";
  return "Manual record";
}

export default function ApplicationsPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | ApplicationStatus>(
    "ALL",
  );
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordedId, setRecordedId] = useState<string | null>(null);
  const manualRecordKey = useRef<string | null>(null);

  const resumeVersions = useMemo(
    () =>
      resumes.flatMap((resume) =>
        resume.versions.map((version) => ({
          id: version.id,
          label: `${resume.name} · Version ${version.version_number}`,
        })),
      ),
    [resumes],
  );
  const resumeLabels = useMemo(
    () => new Map(resumeVersions.map((version) => [version.id, version.label])),
    [resumeVersions],
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing authentication token");
        const [applicationResult, resumeResult] = await Promise.all([
          listApplications(
            token,
            statusFilter === "ALL" ? undefined : statusFilter,
          ),
          listResumes(token),
        ]);
        if (!cancelled) {
          setApplications(applicationResult);
          setResumes(resumeResult);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError("We could not load your applications. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, statusFilter]);

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
        setApplications((current) => [application, ...current]);
      }
    } catch {
      setRecordError(
        "We could not record this application. Your form is unchanged; review it and retry.",
      );
    } finally {
      setRecording(false);
    }
  }

  if (!isLoaded || (loading && isSignedIn && applications.length === 0)) {
    return <Spinner />;
  }
  if (!isSignedIn) {
    return (
      <p className="text-sm text-slate-600">Sign in to view applications.</p>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Remember
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Applications
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            See what you applied for, which resume you used, and where each
            application stands—whether the job started in CareerOS or elsewhere.
          </p>
        </div>
        <a
          href="#record-application"
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Mark as applied
        </a>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <label
          htmlFor="application-status-filter"
          className="text-sm font-medium text-slate-700"
        >
          Status
        </label>
        <select
          id="application-status-filter"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as "ALL" | ApplicationStatus)
          }
          className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 sm:max-w-xs"
        >
          <option value="ALL">All applications</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
      </section>

      {error && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          {error}
        </div>
      )}

      <section aria-labelledby="application-list-heading" aria-busy={loading}>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2
            id="application-list-heading"
            className="text-lg font-semibold text-slate-950"
          >
            Application history
          </h2>
          <p className="text-sm text-slate-500">
            {applications.length}{" "}
            {applications.length === 1 ? "application" : "applications"}
          </p>
        </div>
        {applications.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <h3 className="font-semibold text-slate-950">
              {statusFilter === "ALL"
                ? "No applications recorded yet"
                : `No ${statusLabel(statusFilter).toLowerCase()} applications`}
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Start from a CareerOS Job, use the browser assistant on an
              external application, or record a completed application below.
            </p>
            <Link
              href="/jobs"
              className="mt-5 inline-block text-sm font-semibold text-blue-700 hover:underline"
            >
              Explore jobs →
            </Link>
          </div>
        ) : (
          <div
            className={`grid gap-4 md:grid-cols-2 ${loading ? "opacity-60" : ""}`}
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
                    {statusLabel(application.status)}
                  </span>
                </div>
                <dl className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Applied
                    </dt>
                    <dd className="mt-1">
                      {formatDate(application.applied_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Resume
                    </dt>
                    <dd className="mt-1">
                      {application.resume_version_id
                        ? (resumeLabels.get(application.resume_version_id) ??
                          "Preserved resume version")
                        : "No resume recorded"}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  {sourceLabel(application)} · {application.source}
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
          Manual recovery
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">
          Mark an application as applied
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Use this when browser detection was unavailable or you applied outside
          CareerOS. Only information you enter here is recorded.
        </p>
        <form
          className="mt-6 grid gap-4 md:grid-cols-2"
          onSubmit={recordApplied}
          onChange={() => {
            manualRecordKey.current = null;
          }}
        >
          <Input label="Company" name="company" required maxLength={500} />
          <Input label="Role" name="role" required maxLength={500} />
          <Input
            label="Application URL"
            name="application_url"
            type="url"
            maxLength={2000}
          />
          <Input
            label="Source"
            name="source"
            placeholder="Company site, referral, job board…"
            maxLength={100}
          />
          <div className="md:col-span-2">
            <label
              htmlFor="manual-resume-version"
              className="block text-sm font-medium text-slate-700"
            >
              Resume used
            </label>
            <select
              id="manual-resume-version"
              name="resume_version_id"
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">No resume recorded</option>
              {resumeVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <Button type="submit" loading={recording}>
              Record application
            </Button>
            {recordedId && (
              <Link
                href={`/applications/${recordedId}`}
                className="text-sm font-semibold text-blue-700 hover:underline"
              >
                Application recorded · View details →
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
