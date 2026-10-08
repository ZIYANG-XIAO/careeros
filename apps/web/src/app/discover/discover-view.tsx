"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { FocusPanel } from "@/components/focus-panel";
import { LoadErrorBanner } from "@/components/load-error-banner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  dismissJob,
  hideCompany,
  listApplications,
  listHiddenCompanies,
  listJobSearchGoals,
  undismissJob,
  unhideCompany,
} from "@/lib/api";
import { isNewSince, readLastSeen, writeLastSeen } from "@/lib/new-jobs";
import { useI18n } from "@/lib/i18n";
import { preferenceFit } from "@/lib/preference-fit";
import { useDataFetch } from "@/lib/use-data-fetch";
import type {
  ApplicationStatus,
  HiddenCompany,
  Job,
  JobSearchGoal,
} from "@/lib/types";

import { CreateJobForm } from "./create-job-form";
import { DiscoverRow } from "./discover-row";
import { JobFilters, type Filters } from "./job-filters";
import { useJobs } from "./use-jobs";

const SORT_LABEL = {
  match: "jobs.sortMatch",
  mixed: "jobs.sortMixed",
  recent: "jobs.recent",
  title: "jobs.titleSort",
} as const;

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
    replaceJob,
    replaceJobs,
    toggleSave,
    savingIds,
    removeJob,
    hasMore,
    loadingMore,
    loadMore,
  } = useJobs((job) => openFocus(job.id));

  const fetchContext = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Missing authentication token");
    const [applications, goals, hiddenCompanies] = await Promise.all([
      listApplications(token),
      listJobSearchGoals(token).catch(() => []),
      listHiddenCompanies(token).catch(() => []),
    ]);
    return { applications, goals, hiddenCompanies };
  }, [getToken]);

  const { data: context, setData: setContext } = useDataFetch({
    enabled: isLoaded && isSignedIn,
    resetKey: userId ?? undefined,
    initialData: {
      applications: [] as {
        job_id: string | null;
        status: ApplicationStatus;
      }[],
      goals: [] as JobSearchGoal[],
      hiddenCompanies: [] as HiddenCompany[],
    },
    fetch: fetchContext,
    deps: [getToken, isLoaded, isSignedIn],
  });
  const activeGoal = context.goals.find((goal) => goal.is_active) ?? null;

  // "New since your last visit": read the previous visit once, then record
  // this one, so the markers survive the whole session.
  const [lastSeen] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readLastSeen(),
  );
  useEffect(() => {
    writeLastSeen(new Date().toISOString());
  }, []);
  const browsing = filters.view === "all";
  const newCount = browsing
    ? jobs.filter((job) => isNewSince(job, lastSeen)).length
    : 0;

  type Undo = {
    message: string;
    before: Job[];
    revert: (token: string) => Promise<void>;
  };
  const [undo, setUndo] = useState<Undo | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  // Filters only the loaded page, on the posting's own explicit statement.
  const [hideNoSponsorship, setHideNoSponsorship] = useState(false);
  const visibleJobs = hideNoSponsorship
    ? jobs.filter((job) => job.sponsorship?.status !== "NOT_OFFERED")
    : jobs;

  async function withToken(action: (token: string) => Promise<void>) {
    const token = await getToken();
    if (!token) throw new Error("Missing authentication token");
    await action(token);
  }

  async function handleDismiss(job: Job) {
    const before = jobs;
    replaceJobs(jobs.filter((item) => item.id !== job.id));
    setFeedbackError(null);
    try {
      await withToken((token) => dismissJob(token, job.id));
      setUndo({
        message: t("discover.feedback.dismissed"),
        before,
        revert: (token) => undismissJob(token, job.id),
      });
    } catch {
      replaceJobs(before);
      setFeedbackError(t("discover.feedback.error"));
    }
  }

  async function handleHideCompany(job: Job) {
    const key = job.company.trim().toLowerCase();
    const before = jobs;
    replaceJobs(
      jobs.filter((item) => item.company.trim().toLowerCase() !== key),
    );
    setFeedbackError(null);
    try {
      let hidden: HiddenCompany | null = null;
      await withToken(async (token) => {
        hidden = await hideCompany(token, job.company);
      });
      const created = hidden as HiddenCompany | null;
      if (!created) return;
      setContext((current) => ({
        ...current,
        hiddenCompanies: [
          ...current.hiddenCompanies.filter((item) => item.id !== created.id),
          created,
        ],
      }));
      setUndo({
        message: t("discover.feedback.companyHidden", {
          company: job.company,
        }),
        before,
        revert: async (token) => {
          await unhideCompany(token, created.id);
          setContext((current) => ({
            ...current,
            hiddenCompanies: current.hiddenCompanies.filter(
              (item) => item.id !== created.id,
            ),
          }));
        },
      });
    } catch {
      replaceJobs(before);
      setFeedbackError(t("discover.feedback.error"));
    }
  }

  async function handleUndo() {
    if (!undo) return;
    const current = undo;
    setUndo(null);
    try {
      await withToken(current.revert);
      replaceJobs(current.before);
    } catch {
      setFeedbackError(t("discover.feedback.error"));
    }
  }

  async function handleUnhide(hidden: HiddenCompany) {
    try {
      await withToken((token) => unhideCompany(token, hidden.id));
      setContext((current) => ({
        ...current,
        hiddenCompanies: current.hiddenCompanies.filter(
          (item) => item.id !== hidden.id,
        ),
      }));
      retry();
    } catch {
      setFeedbackError(t("discover.feedback.error"));
    }
  }

  const linkedStatusByJobId = useMemo(() => {
    const map = new Map<string, ApplicationStatus>();
    for (const application of context.applications) {
      if (application.job_id) map.set(application.job_id, application.status);
    }
    return map;
  }, [context.applications]);

  function applyActiveGoal(goal: JobSearchGoal) {
    const nextSearch = goal.target_roles[0] ?? "";
    const nextLocation = goal.cities[0] ?? "";
    setSearch(nextSearch);
    setLocation(nextLocation);
    setFilters((current) => ({
      ...current,
      search: nextSearch,
      location: nextLocation,
      market: goal.market === "UNKNOWN" ? "" : goal.market,
      countryCode: (goal.country_codes[0] ?? "") as Filters["countryCode"],
      workplaceType: (goal.workplace_types[0] ??
        "") as Filters["workplaceType"],
      employmentType: (goal.employment_types[0] ??
        "") as Filters["employmentType"],
    }));
  }

  if (!isLoaded || (isInitialLoading && isSignedIn)) return <Spinner />;
  if (!isSignedIn)
    return <p className="text-sm text-ink-2">{t("jobs.signIn")}</p>;

  return (
    <div className="flex h-full min-w-0 flex-col gap-4">
      <header>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            {t("discover.eyebrow")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">
            {t("discover.heading")}
          </h1>
          <p className="mt-1 text-sm text-ink-2">{t("discover.headingHint")}</p>
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-accent-soft-border bg-accent-tint px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
        <span className="text-xs font-medium text-ink-3">
          {t("discover.activeGoal")}
        </span>
        <strong className="text-sm font-semibold text-ink">
          {activeGoal?.name ?? t("home.goal.empty")}
        </strong>
        {activeGoal && (
          <button
            type="button"
            onClick={() => applyActiveGoal(activeGoal)}
            className="text-xs font-semibold text-accent hover:underline sm:ml-auto"
          >
            {t("discover.useGoal")}
          </button>
        )}
        <a
          href="/me/goals"
          className={`${activeGoal ? "" : "sm:ml-auto"} text-xs font-semibold text-accent hover:underline`}
        >
          {t("discover.changeGoal")}
        </a>
      </section>

      <nav
        aria-label={t("discover.sections")}
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {(["all", "saved", "mine"] as const).map((view) => (
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
              : view === "saved"
                ? t("discover.sections.saved")
                : t("discover.sections.mine")}
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

      <div className="flex min-h-[600px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm lg:max-h-[70vh] lg:flex-row">
        <div className="flex min-w-0 flex-col border-b border-border lg:w-[38%] lg:border-r lg:border-b-0 xl:w-[34%]">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-ink-2" aria-live="polite">
              {locale === "zh-CN"
                ? `${jobs.length}${hasMore ? "+" : ""} ${t("jobs.jobs")}`
                : `${jobs.length}${hasMore ? "+" : ""} ${jobs.length === 1 ? t("jobs.job") : t("jobs.jobs")}`}
            </p>
            <span className="flex items-center gap-2 text-xs font-medium text-ink-3">
              {newCount > 0 && (
                <span className="rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-accent">
                  {t("discover.newCount", { count: newCount })}
                </span>
              )}
              {t(SORT_LABEL[filters.sort])}
            </span>
          </div>
          {(undo || feedbackError) && (
            <div
              role="status"
              className="flex items-center justify-between gap-3 border-b border-border bg-rail px-4 py-2 text-sm"
            >
              <span className={feedbackError ? "text-[#8A4530]" : "text-ink-2"}>
                {feedbackError ?? undo?.message}
              </span>
              {undo && !feedbackError && (
                <button
                  type="button"
                  onClick={() => void handleUndo()}
                  className="shrink-0 text-sm font-semibold text-accent hover:underline"
                >
                  {t("discover.feedback.undo")}
                </button>
              )}
            </div>
          )}
          {jobs.some((job) => job.sponsorship?.status === "NOT_OFFERED") && (
            <label className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-ink-2">
              <input
                type="checkbox"
                checked={hideNoSponsorship}
                onChange={(event) => setHideNoSponsorship(event.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--color-accent)]"
              />
              {t("discover.hideNoSponsorship")}
            </label>
          )}
          {browsing && context.hiddenCompanies.length > 0 && (
            <div className="border-b border-border px-4 py-2 text-xs">
              <button
                type="button"
                aria-expanded={showHidden}
                onClick={() => setShowHidden((value) => !value)}
                className="font-semibold text-ink-3 hover:text-ink-2"
              >
                {t("discover.feedback.hiddenCompanies", {
                  count: context.hiddenCompanies.length,
                })}{" "}
                {showHidden ? "▴" : "▾"}
              </button>
              {showHidden && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {context.hiddenCompanies.map((hidden) => (
                    <li key={hidden.id}>
                      <button
                        type="button"
                        onClick={() => void handleUnhide(hidden)}
                        className="rounded-full border border-border bg-surface px-2.5 py-1 text-ink-2 hover:border-accent-soft-border hover:text-accent"
                        aria-label={t("discover.feedback.unhide", {
                          company: hidden.company_name,
                        })}
                      >
                        {hidden.company_name} ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {filters.company && (
            <div className="flex items-center justify-between gap-2 border-b border-border bg-accent-tint px-4 py-2 text-sm">
              <span className="truncate text-ink-2">
                {t("discover.companyFilter", { company: filters.company })}
              </span>
              <button
                type="button"
                onClick={() =>
                  setFilters((current) => ({ ...current, company: "" }))
                }
                className="shrink-0 text-xs font-semibold text-accent hover:underline"
              >
                {t("discover.showAllCompanies")}
              </button>
            </div>
          )}
          {filters.sort === "match" && browsing && !activeGoal && (
            <div className="flex items-center justify-between gap-2 border-b border-border bg-rail px-4 py-2 text-xs">
              <span className="text-ink-2">{t("discover.matchNeedsGoal")}</span>
              <a
                href="/me/goals"
                className="shrink-0 font-semibold text-accent hover:underline"
              >
                {t("discover.setGoal")} →
              </a>
            </div>
          )}
          {loadError ? (
            <div className="p-4">
              <LoadErrorBanner
                error={loadError}
                onRetry={retry}
                retryLabel={t("errors.retry")}
                t={t}
              />
            </div>
          ) : jobs.length === 0 ? (
            <div className="px-6 py-14 text-center">
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
              className={`min-h-0 flex-1 divide-y divide-row-divider overflow-y-auto ${isRefreshing ? "opacity-60" : ""}`}
            >
              {visibleJobs.map((job) => (
                <div key={job.id}>
                  <DiscoverRow
                    job={job}
                    selected={focusId === job.id}
                    linkedStatus={linkedStatusByJobId.get(job.id) ?? null}
                    fit={preferenceFit(job, activeGoal)}
                    isNew={browsing && isNewSince(job, lastSeen)}
                    saving={savingIds.has(job.id)}
                    onToggleSave={() => void toggleSave(job)}
                    onSelect={() => openFocus(job.id)}
                    onDismiss={
                      browsing && !job.is_saved
                        ? () => void handleDismiss(job)
                        : undefined
                    }
                    onHideCompany={
                      browsing && !job.is_saved
                        ? () => void handleHideCompany(job)
                        : undefined
                    }
                  />
                  {job.company_rank === 2 &&
                    (job.company_job_count ?? 0) > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setFilters((current) => ({
                            ...current,
                            company: job.company,
                            sort: "recent",
                          }))
                        }
                        className="flex w-full items-center gap-2 border-t border-dashed border-row-divider px-4 py-2 pl-[68px] text-left text-xs font-semibold text-accent hover:bg-accent-tint"
                      >
                        {t("discover.moreFromCompany", {
                          count: (job.company_job_count ?? 0) - 2,
                          company: job.company,
                        })}{" "}
                        →
                      </button>
                    )}
                </div>
              ))}
              {hasMore && (
                <div className="p-3 text-center">
                  <Button
                    variant="secondary"
                    loading={loadingMore}
                    onClick={() => void loadMore()}
                  >
                    {t("jobs.loadMore")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {focusId ? (
          <FocusPanel
            target={{ kind: "job", id: focusId }}
            onClose={closeFocus}
            layout="workspace"
            onJobChanged={replaceJob}
            onDeleted={(deleted) => {
              removeJob(deleted.id);
              closeFocus();
            }}
          />
        ) : (
          <div className="hidden min-w-0 flex-1 items-center justify-center bg-sunken/40 px-8 text-center lg:flex">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-tint text-xl text-accent">
                ↗
              </div>
              <h2 className="mt-4 font-semibold text-ink">
                {t("discover.selectPrompt")}
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink-3">
                {t("discover.selectPromptHint")}
              </p>
            </div>
          </div>
        )}
      </div>

      <CreateJobForm creating={creating} onCreate={handleCreate} t={t} />
    </div>
  );
}
