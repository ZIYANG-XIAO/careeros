"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { LoadErrorBanner } from "@/components/load-error-banner";
import { Spinner } from "@/components/ui/spinner";
import { listResumes, uploadResume } from "@/lib/api";
import { formatLocaleDate, useI18n } from "@/lib/i18n";
import { useDataFetch } from "@/lib/use-data-fetch";
import type { ResumeSummary } from "@/lib/types";

export default function ResumesPage() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { locale, t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const uploadLabelRef = useRef<HTMLLabelElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchResumes = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Missing authentication token");
    return listResumes(token);
  }, [getToken]);

  const {
    data: resumes,
    isInitialLoading,
    isRefreshing,
    loadError,
    refreshError,
    retry,
  } = useDataFetch({
    enabled: isLoaded && isSignedIn,
    resetKey: userId ?? undefined,
    initialData: [] as ResumeSummary[],
    fetch: fetchResumes,
    deps: [getToken, isLoaded, isSignedIn],
  });

  useEffect(() => {
    if (searchParams.get("upload") !== "1" || isInitialLoading) return;
    uploadLabelRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    uploadLabelRef.current?.focus();
  }, [isInitialLoading, searchParams]);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const result = await uploadResume(token, file);
      router.push(`/resumes/imports/${result.id}`);
    } catch {
      setUploadError(t("resumes.uploadError"));
      event.target.value = "";
    } finally {
      setUploading(false);
    }
  }

  if (!isLoaded || (isInitialLoading && isSignedIn)) return <Spinner />;
  if (!isSignedIn) {
    return (
      <p className="text-sm text-slate-600">{t("resumes.signInRequired")}</p>
    );
  }

  const dateTimeOptions: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          {t("resumes.eyebrow")}
        </p>
        <div className="mt-2 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              {t("resumes.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {t("resumes.intro")}
            </p>
          </div>
          <label
            ref={uploadLabelRef}
            tabIndex={-1}
            className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
          >
            {uploading ? t("resumes.extracting") : t("resumes.upload")}
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              disabled={uploading}
              onChange={handleUpload}
              aria-label={t("resumes.upload")}
            />
          </label>
        </div>
        {uploading && (
          <p className="mt-4 text-sm text-blue-700" role="status">
            {t("resumes.uploadingStatus")}
          </p>
        )}
        {uploadError && (
          <div
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {uploadError}
          </div>
        )}
      </section>

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
      ) : resumes.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-slate-900">
            {t("resumes.empty.title")}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {t("resumes.empty.hint")}
          </p>
        </section>
      ) : (
        <section aria-labelledby="resume-list-heading">
          <h2 id="resume-list-heading" className="sr-only">
            {t("resumes.listSrOnly")}
          </h2>
          <div
            className={`grid gap-4 md:grid-cols-2 ${isRefreshing ? "opacity-60" : ""}`}
          >
            {resumes.map((resume) => {
              const current = resume.versions[0];
              return (
                <Link
                  key={resume.id}
                  href={`/resumes/${resume.id}`}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-950">
                        {resume.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {resume.versions.length}{" "}
                        {locale === "zh-CN"
                          ? t("resumes.versions")
                          : resume.versions.length === 1
                            ? t("resumes.version")
                            : t("resumes.versions")}
                      </p>
                    </div>
                    {resume.is_primary && (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                        {t("resumes.baseResume")}
                      </span>
                    )}
                  </div>
                  {current && (
                    <p className="mt-5 text-xs text-slate-500">
                      {t("common.version")} {current.version_number} ·{" "}
                      {t("resumes.uploaded")}{" "}
                      {formatLocaleDate(
                        locale,
                        current.created_at,
                        dateTimeOptions,
                      )}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
