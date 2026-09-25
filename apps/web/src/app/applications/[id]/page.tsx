"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  getApplication,
  listResumes,
  updateApplicationStatus,
} from "@/lib/api";
import { safeExternalUrl } from "@/lib/external-url";
import type {
  Application,
  ApplicationStatus,
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

function label(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function formatDate(value: string | null): string {
  if (!value) return "Not submitted yet";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [application, setApplication] = useState<Application | null>(null);
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [selectedStatus, setSelectedStatus] =
    useState<ApplicationStatus>("PREPARING");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const updateKey = useRef<string | null>(null);

  const resumeLabel = useMemo(() => {
    if (!application?.resume_version_id) return "No resume recorded";
    for (const resume of resumes) {
      const version = resume.versions.find(
        (candidate) => candidate.id === application.resume_version_id,
      );
      if (version) return `${resume.name} · Version ${version.version_number}`;
    }
    return "Preserved resume version";
  }, [application, resumes]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing authentication token");
        const [applicationResult, resumeResult] = await Promise.all([
          getApplication(token, id),
          listResumes(token),
        ]);
        if (!cancelled) {
          setApplication(applicationResult);
          setSelectedStatus(applicationResult.status);
          setResumes(resumeResult);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError(
            "This application could not be loaded or you do not have access to it.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, id, isLoaded, isSignedIn]);

  async function saveStatus() {
    if (!application || selectedStatus === application.status) return;
    setUpdating(true);
    setUpdateError(null);
    updateKey.current ??= crypto.randomUUID();
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const updated = await updateApplicationStatus(
        token,
        application.id,
        selectedStatus,
        updateKey.current,
      );
      setApplication(updated);
      updateKey.current = null;
    } catch {
      setUpdateError(
        "We could not update this status. Nothing else changed; retry when ready.",
      );
    } finally {
      setUpdating(false);
    }
  }

  if (!isLoaded || (loading && isSignedIn)) return <Spinner />;
  if (!isSignedIn) {
    return (
      <p className="text-sm text-slate-600">
        Sign in to view this application.
      </p>
    );
  }
  if (error || !application) {
    return (
      <div
        className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
        role="alert"
      >
        {error ?? "Application not found."}
      </div>
    );
  }

  const applicationUrl = safeExternalUrl(application.application_url);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Link
          href="/applications"
          className="text-sm font-medium text-blue-700 hover:text-blue-900"
        >
          ← All applications
        </Link>
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              {application.company}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {application.role}
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              {application.origin === "CAREEROS_JOB"
                ? "Started from a CareerOS Job"
                : application.origin === "EXTERNAL_PAGE"
                  ? "Captured from an external application page"
                  : "Recorded manually"}
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800">
            {label(application.status)}
          </span>
        </div>

        <dl className="mt-8 grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Applied
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {formatDate(application.applied_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Resume used
            </dt>
            <dd className="mt-1 text-sm text-slate-800">{resumeLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Source
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {application.source}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Last updated
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {formatDate(application.status_updated_at)}
            </dd>
          </div>
        </dl>

        {applicationUrl && (
          <a
            href={applicationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex text-sm font-semibold text-blue-700 hover:underline"
          >
            Open application page ↗
          </a>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Update status</h2>
        <p className="mt-1 text-sm text-slate-600">
          Keep the current stage visible without rewriting earlier application
          context.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="application-status"
              className="block text-sm font-medium text-slate-700"
            >
              Current status
            </label>
            <select
              id="application-status"
              value={selectedStatus}
              onChange={(event) => {
                setSelectedStatus(event.target.value as ApplicationStatus);
                updateKey.current = null;
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {label(status)}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={() => void saveStatus()}
            loading={updating}
            disabled={selectedStatus === application.status}
          >
            Save status
          </Button>
        </div>
        {updateError && (
          <div
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {updateError}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Confirmed application answers
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          These standard, non-sensitive answers are preserved for this
          application only.
        </p>
        {application.answers.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
            No answer history was retained for this application.
          </p>
        ) : (
          <dl className="mt-5 space-y-4">
            {application.answers.map((answer) => (
              <div
                key={answer.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <dt className="text-sm font-medium text-slate-700">
                  {answer.question_text}
                </dt>
                <dd className="mt-2 whitespace-pre-wrap text-sm text-slate-950">
                  {answer.answer_text}
                </dd>
                <dd className="mt-2 text-xs text-slate-400">
                  Confirmed from {label(answer.source_category)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </div>
  );
}
