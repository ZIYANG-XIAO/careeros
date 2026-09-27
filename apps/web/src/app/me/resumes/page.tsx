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
import { ApiError, listResumes, uploadResume } from "@/lib/api";
import { formatLocaleDate, useI18n } from "@/lib/i18n";
import { useDataFetch } from "@/lib/use-data-fetch";
import type { ResumeSummary } from "@/lib/types";

import { MeTabs } from "../me-tabs";

const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_RESUME_EXTENSIONS = new Set(["pdf", "docx"]);

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
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !SUPPORTED_RESUME_EXTENSIONS.has(extension)) {
      setUploadError(t("resumes.uploadError.unsupportedType"));
      event.target.value = "";
      return;
    }
    if (file.size === 0) {
      setUploadError(t("resumes.uploadError.empty"));
      event.target.value = "";
      return;
    }
    if (file.size > MAX_RESUME_SIZE_BYTES) {
      setUploadError(t("resumes.uploadError.tooLarge"));
      event.target.value = "";
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const result = await uploadResume(token, file);
      router.push(`/me/imports/${result.id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        const errorKey = {
          FILE_TOO_LARGE: "resumes.uploadError.tooLarge",
          UNSUPPORTED_FILE_TYPE: "resumes.uploadError.unsupportedType",
          EMPTY_FILE: "resumes.uploadError.empty",
          EMPTY_DOCUMENT: "resumes.uploadError.noText",
          MALFORMED_FILE: "resumes.uploadError.malformed",
          EXTRACTION_FAILED: "resumes.uploadError.malformed",
          PARSER_UNAVAILABLE: "resumes.uploadError.parserUnavailable",
          PARSING_FAILED: "resumes.uploadError.parsingFailed",
        }[error.code ?? ""];
        setUploadError(
          errorKey
            ? t(errorKey as Parameters<typeof t>[0])
            : t("resumes.uploadError"),
        );
      } else {
        setUploadError(t("resumes.uploadError"));
      }
      event.target.value = "";
    } finally {
      setUploading(false);
    }
  }

  if (!isLoaded || (isInitialLoading && isSignedIn)) return <Spinner />;
  if (!isSignedIn) {
    return <p className="text-sm text-ink-2">{t("resumes.signInRequired")}</p>;
  }

  const dateTimeOptions: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <MeTabs />
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          {t("resumes.eyebrow")}
        </p>
        <div className="mt-2 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {t("resumes.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">
              {t("resumes.intro")}
            </p>
          </div>
          <label
            ref={uploadLabelRef}
            tabIndex={-1}
            className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2"
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
          <p className="mt-4 text-sm text-accent" role="status">
            {t("resumes.uploadingStatus")}
          </p>
        )}
        {uploadError && (
          <div
            className="mt-4 rounded-lg border border-evidence-gap-border bg-evidence-gap-bg p-3 text-sm text-[#6F3627]"
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
        <section className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-ink">
            {t("resumes.empty.title")}
          </h2>
          <p className="mt-2 text-sm text-ink-3">{t("resumes.empty.hint")}</p>
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
                  href={`/me/resumes/${resume.id}`}
                  className="rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:border-accent-soft-border hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-ink">{resume.name}</h3>
                      <p className="mt-1 text-sm text-ink-3">
                        {resume.versions.length}{" "}
                        {locale === "zh-CN"
                          ? t("resumes.versions")
                          : resume.versions.length === 1
                            ? t("resumes.version")
                            : t("resumes.versions")}
                      </p>
                    </div>
                    {resume.is_primary && (
                      <span className="rounded-full bg-accent-tint px-2.5 py-1 text-xs font-medium text-accent">
                        {t("resumes.baseResume")}
                      </span>
                    )}
                  </div>
                  {current && (
                    <p className="mt-5 text-xs text-ink-3">
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
