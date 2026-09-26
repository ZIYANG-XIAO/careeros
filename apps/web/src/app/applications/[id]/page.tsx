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
import {
  applicationStatusLabel,
  formatLocaleDate,
  formatResumeVersionLabel,
  type MessageKey,
  useI18n,
} from "@/lib/i18n";
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

const SOURCE_CATEGORY_KEYS = {
  IDENTITY: "application.sourceIdentity",
  CAREER_BRAIN: "application.sourceCareerBrain",
  RESUME_VERSION: "application.sourceResumeVersion",
  USER_PROVIDED: "application.sourceUserProvided",
  USER_CONTACT_INFO: "application.sourceUserContactInfo",
} as const satisfies Record<string, MessageKey>;

function sourceCategoryLabel(
  value: string,
  t: (key: MessageKey) => string,
): string {
  const key = SOURCE_CATEGORY_KEYS[value as keyof typeof SOURCE_CATEGORY_KEYS];
  return key ? t(key) : value;
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { locale, t } = useI18n();
  const [application, setApplication] = useState<Application | null>(null);
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [selectedStatus, setSelectedStatus] =
    useState<ApplicationStatus>("PREPARING");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const [prevFetchKey, setPrevFetchKey] = useState(0);
  const updateKey = useRef<string | null>(null);

  if (fetchKey !== prevFetchKey) {
    setPrevFetchKey(fetchKey);
    setError(null);
    setLoading(true);
  }

  const resumeLabel = useMemo(() => {
    if (!application?.resume_version_id)
      return t("applications.noResumeRecorded");
    for (const resume of resumes) {
      const version = resume.versions.find(
        (candidate) => candidate.id === application.resume_version_id,
      );
      if (version)
        return formatResumeVersionLabel(resume.name, version.version_number, t);
    }
    return t("applications.preservedResumeVersion");
  }, [application, resumes, t]);

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
          setError(t("applications.detail.loadError"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, id, isLoaded, isSignedIn, t, fetchKey]);

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
      setUpdateError(t("applications.detail.updateError"));
    } finally {
      setUpdating(false);
    }
  }

  if (!isLoaded || (loading && isSignedIn)) return <Spinner />;
  if (!isSignedIn) {
    return (
      <p className="text-sm text-slate-600">
        {t("applications.detail.signInRequired")}
      </p>
    );
  }
  if (error || !application) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
          role="alert"
        >
          <p>{error ?? t("applications.detail.notFound")}</p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => setFetchKey((k) => k + 1)}
          >
            {t("errors.retry")}
          </Button>
        </div>
        <Link
          href="/applications"
          className="inline-flex text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          {t("applications.detail.backToAll")}
        </Link>
      </div>
    );
  }

  const applicationUrl = safeExternalUrl(application.application_url);
  const dateTimeOptions: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Link
          href="/applications"
          className="text-sm font-medium text-blue-700 hover:text-blue-900"
        >
          {t("applications.detail.backToAll")}
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
                ? t("applications.detail.startedFromCareerosJob")
                : application.origin === "EXTERNAL_PAGE"
                  ? t("applications.detail.capturedFromExternal")
                  : t("applications.detail.recordedManually")}
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800">
            {applicationStatusLabel(application.status, t)}
          </span>
        </div>

        <dl className="mt-8 grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t("applications.applied")}
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {formatLocaleDate(
                locale,
                application.applied_at,
                dateTimeOptions,
              ) ?? t("common.notSubmittedYet")}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t("applications.resumeUsed")}
            </dt>
            <dd className="mt-1 text-sm text-slate-800">{resumeLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t("applications.sourceLabel")}
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {application.source}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t("applications.detail.lastUpdated")}
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {formatLocaleDate(
                locale,
                application.status_updated_at,
                dateTimeOptions,
              ) ?? t("common.notSubmittedYet")}
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
            {t("applications.detail.openApplicationPage")}
          </a>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          {t("applications.detail.updateStatus")}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {t("applications.detail.updateStatusHint")}
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="application-status"
              className="block text-sm font-medium text-slate-700"
            >
              {t("applications.detail.currentStatus")}
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
                  {applicationStatusLabel(status, t)}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={() => void saveStatus()}
            loading={updating}
            disabled={selectedStatus === application.status}
          >
            {t("applications.detail.saveStatus")}
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
          {t("applications.detail.confirmedAnswers")}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {t("applications.detail.confirmedAnswersHint")}
        </p>
        {application.answers.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
            {t("applications.detail.noAnswers")}
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
                  {t("applications.detail.confirmedFrom")}{" "}
                  {sourceCategoryLabel(answer.source_category, t)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </div>
  );
}
