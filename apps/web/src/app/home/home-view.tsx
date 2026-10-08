"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useCallback, useMemo } from "react";

import { DailyBriefing } from "@/components/daily-briefing";
import { LoadErrorBanner } from "@/components/load-error-banner";
import { Spinner } from "@/components/ui/spinner";
import {
  getCareerBrain,
  listApplications,
  listJobSearchGoals,
  listUpcomingApplicationActivities,
  listJobs,
  listResumes,
} from "@/lib/api";
import { applicationStatusLabel, useI18n } from "@/lib/i18n";
import { pipelineSummary, savedColumnJobs } from "@/lib/pipeline";
import type {
  ApplicationSummary,
  ApplicationActivity,
  CareerBrain,
  Job,
  JobSearchGoal,
  ResumeSummary,
} from "@/lib/types";
import { useDataFetch } from "@/lib/use-data-fetch";
import { CompanyMark } from "@/components/company-mark";

type HomeData = {
  applications: ApplicationSummary[];
  jobs: Job[];
  savedJobs: Job[];
  resumes: ResumeSummary[];
  brain: CareerBrain;
  upcomingActivities: ApplicationActivity[];
  goals: JobSearchGoal[];
};

function HomeView() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { user } = useUser();
  const { t } = useI18n();

  const fetchHome = useCallback(async (): Promise<HomeData> => {
    const token = await getToken();
    if (!token) throw new Error("Missing authentication token");
    const [
      applications,
      jobs,
      savedJobs,
      resumes,
      brain,
      upcomingActivities,
      goals,
    ] = await Promise.all([
      listApplications(token),
      listJobs(token, { compact: true, collapse: true, limit: 50 }),
      listJobs(token, { savedOnly: true }),
      listResumes(token),
      getCareerBrain(token),
      listUpcomingApplicationActivities(token, 8).catch(() => []),
      listJobSearchGoals(token).catch(() => []),
    ]);
    return {
      applications,
      jobs,
      savedJobs,
      resumes,
      brain,
      upcomingActivities,
      goals,
    };
  }, [getToken]);

  const { data, isInitialLoading, loadError, refreshError, retry } =
    useDataFetch<HomeData>({
      enabled: isLoaded && isSignedIn,
      resetKey: userId ?? undefined,
      initialData: {
        applications: [],
        jobs: [],
        savedJobs: [],
        resumes: [],
        brain: {
          id: "",
          created_at: "",
          educations: [],
          experiences: [],
          projects: [],
          skills: [],
        },
        upcomingActivities: [],
        goals: [],
      },
      fetch: fetchHome,
      deps: [getToken, isLoaded, isSignedIn],
    });

  const availableSavedJobs = useMemo(
    () => savedColumnJobs(data.savedJobs, data.applications),
    [data.savedJobs, data.applications],
  );
  const summary = pipelineSummary(data.applications);
  const recentApplications = useMemo(
    () =>
      data.applications
        .slice()
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, 4),
    [data.applications],
  );
  const preferredSkills = data.brain.skills.filter((skill) => skill.preferred);
  const displayName = user?.firstName || user?.username || "";
  const activeGoal = data.goals.find((goal) => goal.is_active) ?? null;

  if (!isLoaded || (isInitialLoading && isSignedIn)) return <Spinner />;
  if (!isSignedIn) {
    return <p className="text-sm text-ink-2">{t("home.signInRequired")}</p>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            {t("home.eyebrow")}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
            {displayName
              ? t("home.titleNamed", { name: displayName })
              : t("home.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">
            {t("home.intro")}
          </p>
        </div>
        <Link
          href="/pipeline"
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          {t("home.openApplications")} →
        </Link>
      </header>

      {(loadError || refreshError) && (
        <LoadErrorBanner
          error={loadError || refreshError!}
          onRetry={retry}
          retryLabel={t("errors.retry")}
          t={t}
        />
      )}

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-5 py-4 shadow-sm">
        {activeGoal ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              {t("home.goal.eyebrow")}
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">
              {activeGoal.name}
              {activeGoal.target_roles.length > 0
                ? ` · ${activeGoal.target_roles.join(", ")}`
                : ""}
            </p>
            <p className="mt-1 text-xs text-ink-3">
              {t(`goals.market.${activeGoal.market}` as never)}
              {activeGoal.cities.length > 0
                ? ` · ${activeGoal.cities.join(", ")}`
                : ""}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-ink">
              {t("home.goal.empty")}
            </p>
            <p className="mt-1 text-xs text-ink-3">
              {t("home.goal.emptyHint")}
            </p>
          </div>
        )}
        <Link
          href="/me/goals"
          className="text-sm font-semibold text-accent hover:underline"
        >
          {activeGoal ? t("home.goal.manage") : t("home.goal.create")} →
        </Link>
      </section>

      <DailyBriefing
        applications={data.applications}
        jobs={data.jobs}
        activities={data.upcomingActivities}
        activeGoal={activeGoal}
      />

      <section
        aria-label={t("home.quickActions")}
        className="grid overflow-hidden rounded-2xl border border-border bg-surface shadow-sm sm:grid-cols-3"
      >
        <Link
          href="/discover"
          className="group border-b border-border px-5 py-4 hover:bg-rail sm:border-b-0 sm:border-r"
        >
          <span className="block text-sm font-semibold text-ink">
            {t("home.findJobs")} <span className="text-accent">→</span>
          </span>
          <span className="mt-1 block text-xs leading-5 text-ink-3">
            {t("home.findJobsHint")}
          </span>
        </Link>
        <Link
          href="/me/resumes?upload=1"
          className="group border-b border-border px-5 py-4 hover:bg-rail sm:border-b-0 sm:border-r"
        >
          <span className="block text-sm font-semibold text-ink">
            {t("home.addResume")} <span className="text-accent">→</span>
          </span>
          <span className="mt-1 block text-xs leading-5 text-ink-3">
            {t("home.addResumeHint")}
          </span>
        </Link>
        <Link href="/setup" className="group px-5 py-4 hover:bg-rail">
          <span className="block text-sm font-semibold text-ink">
            {t("home.setupAssistant")} <span className="text-accent">→</span>
          </span>
          <span className="mt-1 block text-xs leading-5 text-ink-3">
            {t("home.setupAssistantHint")}
          </span>
        </Link>
      </section>

      <div>
        <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                {t("home.opportunities.eyebrow")}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-ink">
                {t("home.opportunities.title")}
              </h2>
            </div>
            <Link
              href="/discover"
              className="text-sm font-semibold text-accent hover:underline"
            >
              {t("home.viewDiscover")} →
            </Link>
          </div>
          {availableSavedJobs.length > 0 ? (
            <div className="divide-y divide-row-divider">
              {availableSavedJobs.slice(0, 3).map((job) => (
                <Link
                  key={job.id}
                  href={`/discover?focus=${job.id}`}
                  className="flex items-center gap-3 px-5 py-4 hover:bg-rail"
                >
                  <CompanyMark company={job.company} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-ink-3">
                      {job.company}
                    </span>
                    <span className="mt-1 block truncate text-sm font-semibold text-ink">
                      {job.title}
                    </span>
                    <span className="mt-1 block truncate text-xs text-ink-3">
                      {job.location || t("jobs.unknown")}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-semibold text-ink">
                {t("home.opportunities.empty")}
              </p>
              <p className="mt-2 text-sm text-ink-3">
                {t("home.opportunities.emptyHint")}
              </p>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                {t("home.progress.eyebrow")}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-ink">
                {t("home.progress.title")}
              </h2>
            </div>
            <Link
              href="/pipeline"
              className="text-sm font-semibold text-accent hover:underline"
            >
              {t("home.manageApplications")} →
            </Link>
          </div>
          <dl className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-border sm:grid-cols-4">
            {[
              ["pipeline.summary.active", summary.active],
              ["pipeline.summary.needsAction", summary.needsAction],
              ["pipeline.summary.interviews", summary.interviews],
              ["pipeline.summary.offers", summary.offers],
            ].map(([label, value], index) => (
              <div
                key={String(label)}
                className={`p-4 ${index < 3 ? "sm:border-r sm:border-border" : ""}`}
              >
                <dt className="text-xs text-ink-3">{t(label as never)}</dt>
                <dd className="mt-1 text-2xl font-semibold text-ink">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {recentApplications.length > 0 && (
            <div className="mt-4 divide-y divide-row-divider">
              {recentApplications.map((application) => (
                <Link
                  key={application.id}
                  href={`/pipeline?focus=${application.id}`}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <CompanyMark company={application.company} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {application.company} · {application.role}
                    </span>
                    <span className="mt-1 block text-xs text-ink-3">
                      {t("home.recentlyUpdated")}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold text-ink-2">
                    {applicationStatusLabel(application.status, t)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-accent-tint p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            {t("home.brain.eyebrow")}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">
            {t("home.brain.title")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-2">
            {t("home.brain.summary", {
              experiences: data.brain.experiences.length,
              skills: data.brain.skills.length,
              resumes: data.resumes.length,
            })}
          </p>
          {preferredSkills.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {preferredSkills.slice(0, 5).map((skill) => (
                <span
                  key={skill.id}
                  className="rounded-full border border-accent-soft-border bg-surface px-2.5 py-1 text-xs font-semibold text-accent"
                >
                  {skill.name}
                </span>
              ))}
            </div>
          )}
          <Link
            href="/me"
            className="mt-5 inline-flex text-sm font-semibold text-accent hover:underline"
          >
            {t("home.openBrain")} →
          </Link>
        </section>
      </div>
    </div>
  );
}

export default HomeView;
