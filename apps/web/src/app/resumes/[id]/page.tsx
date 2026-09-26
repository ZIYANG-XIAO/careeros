"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getResume } from "@/lib/api";
import { formatLocaleDate, useI18n } from "@/lib/i18n";
import type { ResumeSummary } from "@/lib/types";

function formatBytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function ResumeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { locale, t } = useI18n();
  const [resume, setResume] = useState<ResumeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const [prevFetchKey, setPrevFetchKey] = useState(0);

  if (fetchKey !== prevFetchKey) {
    setPrevFetchKey(fetchKey);
    setError(null);
    setResume(null);
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing authentication token");
        const result = await getResume(token, id);
        if (!cancelled) setResume(result);
      } catch {
        if (!cancelled) setError(t("resumes.detail.loadError"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, id, isLoaded, isSignedIn, t, fetchKey]);

  if (!isLoaded || (isSignedIn && !resume && !error)) return <Spinner />;
  if (!isSignedIn)
    return (
      <p className="text-sm text-slate-600">
        {t("resumes.detail.signInRequired")}
      </p>
    );
  if (error || !resume) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
          role="alert"
        >
          <p>{error ?? t("resumes.detail.loadError")}</p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => setFetchKey((k) => k + 1)}
          >
            {t("errors.retry")}
          </Button>
        </div>
        <Link
          href="/resumes"
          className="inline-flex text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          ← {t("resumes.detail.backToLibrary")}
        </Link>
      </div>
    );
  }

  const dateTimeOptions: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Link
          href="/resumes"
          className="text-sm font-medium text-blue-700 hover:text-blue-900"
        >
          {t("resumes.detail.backToLibrary")}
        </Link>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            {resume.name}
          </h1>
          {resume.is_primary && (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
              {t("resumes.baseResume")}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {t("resumes.detail.historicalHint")}
        </p>
      </header>

      <section aria-labelledby="versions-heading">
        <h2
          id="versions-heading"
          className="mb-3 text-lg font-semibold text-slate-950"
        >
          {t("resumes.detail.versionsHeading")}
        </h2>
        <div className="space-y-4">
          {resume.versions.map((version) => (
            <article
              key={version.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-950">
                    {t("common.version")} {version.version_number}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {version.original_filename}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>
                    {formatLocaleDate(
                      locale,
                      version.created_at,
                      dateTimeOptions,
                    )}
                  </p>
                  <p className="mt-1">{formatBytes(version.size_bytes)}</p>
                </div>
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-blue-700">
                  {t("resumes.detail.reviewExtractedText")}
                </summary>
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-700">
                  {version.extracted_text}
                </pre>
              </details>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
