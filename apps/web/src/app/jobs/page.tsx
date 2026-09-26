"use client";

import { LoadErrorBanner } from "@/components/load-error-banner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useI18n } from "@/lib/i18n";

import { CreateJobForm } from "./create-job-form";
import { JobCard } from "./job-card";
import { JobFilters } from "./job-filters";
import { useJobs } from "./use-jobs";

export default function JobsPage() {
  const { locale, t } = useI18n();
  const {
    isLoaded,
    isSignedIn,
    filters,
    setFilters,
    search,
    setSearch,
    location,
    setLocation,
    creating,
    savingIds,
    actionError,
    jobs,
    isInitialLoading,
    isRefreshing,
    loadError,
    refreshError,
    retry,
    handleFilter,
    clearFilters,
    toggleSave,
    handleCreate,
    hasFilters,
  } = useJobs();

  if (!isLoaded || (isInitialLoading && isSignedIn)) return <Spinner />;
  if (!isSignedIn)
    return <p className="text-sm text-slate-600">{t("jobs.signIn")}</p>;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            {t("jobs.discover")}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            {t("jobs.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {t("jobs.intro")}
          </p>
        </div>
        <a
          href="#add-job"
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          {t("jobs.addManual")}
        </a>
      </header>

      <JobFilters
        filters={filters}
        setFilters={setFilters}
        search={search}
        setSearch={setSearch}
        location={location}
        setLocation={setLocation}
        isRefreshing={isRefreshing}
        hasFilters={hasFilters}
        onFilter={handleFilter}
        onClearFilters={clearFilters}
        t={t}
      />

      {actionError && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          {actionError}
        </div>
      )}

      <section aria-labelledby="job-results-heading" aria-busy={isRefreshing}>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2
            id="job-results-heading"
            className="text-lg font-semibold text-slate-950"
          >
            {filters.view === "saved"
              ? t("jobs.savedJobs")
              : t("jobs.yourJobs")}
          </h2>
          <p className="text-sm text-slate-500">
            {locale === "zh-CN"
              ? `${jobs.length} ${t("jobs.jobs")}`
              : `${jobs.length} ${jobs.length === 1 ? t("jobs.job") : t("jobs.jobs")}`}
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
        ) : jobs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.7}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 6h6m-7 4h8m-9 4h10M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z"
                />
              </svg>
            </div>
            <h3 className="mt-4 font-semibold text-slate-950">
              {filters.view === "saved"
                ? t("jobs.noSaved")
                : hasFilters
                  ? t("jobs.noMatch")
                  : t("jobs.ready")}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {filters.view === "saved"
                ? t("jobs.noSavedHint")
                : hasFilters
                  ? t("jobs.noMatchHint")
                  : t("jobs.readyHint")}
            </p>
            {hasFilters && (
              <Button
                variant="secondary"
                className="mt-5"
                onClick={clearFilters}
              >
                {t("jobs.clearFilters")}
              </Button>
            )}
          </div>
        ) : (
          <div
            className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 ${isRefreshing ? "opacity-60" : ""}`}
          >
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onToggleSave={(item) => void toggleSave(item)}
                saving={savingIds.has(job.id)}
              />
            ))}
          </div>
        )}
      </section>

      <CreateJobForm creating={creating} onCreate={handleCreate} t={t} />
    </div>
  );
}
