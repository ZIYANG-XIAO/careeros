"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { FocusPanel } from "@/components/focus-panel";
import { LoadErrorBanner } from "@/components/load-error-banner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { listApplications } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useDataFetch } from "@/lib/use-data-fetch";
import type { ApplicationStatus } from "@/lib/types";

import { CreateJobForm } from "./create-job-form";
import { DiscoverRow } from "./discover-row";
import { JobFilters } from "./job-filters";
import { useJobs } from "./use-jobs";

export default function DiscoverView() {
  const { getToken, userId } = useAuth();
  const { locale, t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");

  function openFocus(jobId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("focus", jobId);
    router.push(`${pathname}?${params.toString()}`);
  }

  function closeFocus() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("focus");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

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
    actionError,
    jobs,
    isInitialLoading,
    isRefreshing,
    loadError,
    refreshError,
    retry,
    handleFilter,
    clearFilters,
    handleCreate,
    hasFilters,
  } = useJobs((job) => openFocus(job.id));

  const fetchApplications = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Missing authentication token");
    return listApplications(token);
  }, [getToken]);

  const { data: applications } = useDataFetch({
    enabled: isLoaded && isSignedIn,
    resetKey: userId ?? undefined,
    initialData: [] as { job_id: string | null; status: ApplicationStatus }[],
    fetch: fetchApplications,
    deps: [getToken, isLoaded, isSignedIn],
  });

  const linkedStatusByJobId = useMemo(() => {
    const map = new Map<string, ApplicationStatus>();
    for (const application of applications) {
      if (application.job_id) map.set(application.job_id, application.status);
    }
    return map;
  }, [applications]);

  if (!isLoaded || (isInitialLoading && isSignedIn)) return <Spinner />;
  if (!isSignedIn)
    return <p className="text-sm text-ink-2">{t("jobs.signIn")}</p>;

  return (
    <div className="flex h-full gap-5">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">
            {t("nav.discover")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">
            {t("jobs.title")}
          </h1>
          <p className="mt-1 text-sm text-ink-2">{t("discover.notLive")}</p>
        </header>

        <nav
          aria-label={t("discover.sections")}
          className="flex flex-wrap gap-1 border-b border-border"
        >
          {(["all", "saved"] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setFilters((current) => ({ ...current, view }))}
              aria-pressed={filters.view === view}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
                filters.view === view
                  ? "border-accent text-accent"
                  : "border-transparent text-ink-3 hover:text-ink-2"
              }`}
            >
              {view === "all"
                ? t("discover.sections.browse")
                : t("discover.sections.saved")}
            </button>
          ))}
          <a
            href="#add-job"
            className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-ink-3 hover:text-ink-2"
          >
            {t("discover.sections.add")}
          </a>
        </nav>

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
            role="alert"
            className="rounded-xl border border-evidence-gap-border bg-evidence-gap-bg p-4 text-sm text-[#6F3627]"
          >
            {actionError}
          </div>
        )}
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
          <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-14 text-center">
            <h3 className="font-semibold text-ink">
              {filters.view === "saved"
                ? t("jobs.noSaved")
                : hasFilters
                  ? t("jobs.noMatch")
                  : t("jobs.ready")}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-3">
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
            className={`flex-1 divide-y divide-row-divider overflow-y-auto rounded-2xl border border-border bg-surface ${isRefreshing ? "opacity-60" : ""}`}
          >
            {jobs.map((job) => (
              <DiscoverRow
                key={job.id}
                job={job}
                selected={focusId === job.id}
                linkedStatus={linkedStatusByJobId.get(job.id) ?? null}
                onSelect={() => openFocus(job.id)}
              />
            ))}
          </div>
        )}

        <p className="text-xs text-ink-3">
          {locale === "zh-CN"
            ? `${jobs.length} ${t("jobs.jobs")}`
            : `${jobs.length} ${jobs.length === 1 ? t("jobs.job") : t("jobs.jobs")}`}
        </p>

        <CreateJobForm creating={creating} onCreate={handleCreate} t={t} />
      </div>

      <div className="hidden w-[520px] shrink-0 lg:block">
        {focusId ? (
          <FocusPanel
            target={{ kind: "job", id: focusId }}
            onClose={closeFocus}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-border bg-rail p-8 text-center">
            <p className="text-sm font-semibold text-ink">
              {t("panel.nothingSelected")}
            </p>
            <p className="text-sm text-ink-3">{t("panel.nothingHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
