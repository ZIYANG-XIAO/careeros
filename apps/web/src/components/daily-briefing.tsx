"use client";

import Link from "next/link";

import { CalendarDownloadButton } from "@/components/calendar-download-button";
import { applicationStatusLabel, useI18n } from "@/lib/i18n";
import { pipelineAttentionItems } from "@/lib/pipeline";
import { preferenceFit, rankByPreferenceFit } from "@/lib/preference-fit";
import type {
  ApplicationActivity,
  ApplicationSummary,
  Job,
  JobSearchGoal,
} from "@/lib/types";
import { CompanyMark } from "@/components/company-mark";

type DailyBriefingProps = {
  applications: ApplicationSummary[];
  jobs: Job[];
  activities: ApplicationActivity[];
  activeGoal: JobSearchGoal | null;
};

function DailyBriefing({
  applications,
  jobs,
  activities,
  activeGoal,
}: DailyBriefingProps) {
  const { locale, t } = useI18n();
  const applicationById = new Map(applications.map((item) => [item.id, item]));
  const attention = pipelineAttentionItems(applications).slice(0, 2);
  const upcoming = activities.slice(0, Math.max(0, 3 - attention.length));
  const opportunities = rankByPreferenceFit(
    jobs.filter(
      (job) => !job.is_saved && job.availability_status !== "UNAVAILABLE",
    ),
    activeGoal,
  ).slice(0, 3);
  const actionCount = attention.length + upcoming.length;

  return (
    <div className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-raised">
        <div className="flex items-start justify-between gap-4 border-b border-border bg-accent-tint px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">
              {t("home.briefing.eyebrow")}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-ink">
              {actionCount > 0
                ? actionCount === 1
                  ? t("home.briefing.titleOne")
                  : t("home.briefing.title", { count: actionCount })
                : t("home.briefing.clear")}
            </h2>
            <p className="mt-1 text-sm text-ink-2">{t("home.briefing.hint")}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="rounded-full border border-accent-soft-border bg-surface px-2.5 py-1 text-xs font-semibold text-accent">
              {activeGoal?.market === "CHINA"
                ? t("home.briefing.china")
                : activeGoal?.market === "NORTH_AMERICA"
                  ? t("home.briefing.northAmerica")
                  : t("home.briefing.allMarkets")}
            </span>
            {upcoming.length > 0 && <CalendarDownloadButton />}
          </div>
        </div>

        {actionCount > 0 ? (
          <div className="divide-y divide-row-divider">
            {attention.map(({ application, reason, daysWaiting }) => (
              <Link
                key={application.id}
                href={`/pipeline?focus=${application.id}`}
                className="group flex items-center gap-4 px-5 py-4 hover:bg-rail"
              >
                <CompanyMark company={application.company} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-ink-3">
                    {reason === "CONFIRM_SUBMISSION"
                      ? t("home.briefing.confirm")
                      : t("home.briefing.followUp")}
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-semibold text-ink">
                    {application.company} · {application.role}
                  </span>
                  <span className="mt-1 block text-xs text-ink-3">
                    {t("home.briefing.waiting", { days: daysWaiting })}
                  </span>
                </span>
                <span className="text-sm font-semibold text-accent group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            ))}
            {upcoming.map((activity) => {
              const application = applicationById.get(activity.application_id);
              return (
                <Link
                  key={activity.id}
                  href={`/pipeline?focus=${activity.application_id}`}
                  className="group flex items-center gap-4 px-5 py-4 hover:bg-rail"
                >
                  {application ? (
                    <CompanyMark company={application.company} size="sm" />
                  ) : (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-evidence-strong-bg text-sm font-semibold text-status-offer-ink">
                      {activity.activity_type === "INTERVIEW" ? "◎" : "↗"}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-ink-3">
                      {activity.activity_type === "INTERVIEW"
                        ? t("activity.type.interview")
                        : t("activity.type.followUp")}
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-semibold text-ink">
                      {activity.title}
                    </span>
                    <span className="mt-1 block text-xs text-ink-3">
                      {application
                        ? `${application.company} · ${application.role}`
                        : applicationStatusLabel("PREPARING", t)}
                      {activity.scheduled_at
                        ? ` · ${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(activity.scheduled_at))}`
                        : ""}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-accent group-hover:translate-x-0.5">
                    →
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-8">
            <p className="text-sm text-ink-2">{t("home.briefing.empty")}</p>
            <Link
              href="/discover"
              className="mt-3 inline-flex text-sm font-semibold text-accent hover:underline"
            >
              {t("home.briefing.explore")} →
            </Link>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-raised">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">
              {t("home.radar.eyebrow")}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-ink">
              {t("home.radar.title")}
            </h2>
          </div>
          <Link
            href="/discover"
            className="text-sm font-semibold text-accent hover:underline"
          >
            {t("home.radar.all")} →
          </Link>
        </div>
        {opportunities.length > 0 ? (
          <div className="divide-y divide-row-divider">
            {opportunities.map((job) => {
              const fit = preferenceFit(job, activeGoal);
              const matched =
                fit.level === "MATCH" || fit.level === "PARTIAL"
                  ? fit.matched.length
                  : 0;
              const total =
                fit.level === "MATCH" || fit.level === "PARTIAL"
                  ? fit.matched.length + fit.mismatched.length
                  : 0;
              return (
                <Link
                  key={job.id}
                  href={`/discover?focus=${job.id}`}
                  className="block px-5 py-4 hover:bg-rail"
                >
                  <div className="flex items-start justify-between gap-3">
                    <CompanyMark company={job.company} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-ink-3">
                        {job.company}
                      </span>
                      <span className="mt-0.5 block truncate text-sm font-semibold text-ink">
                        {job.title}
                      </span>
                      <span className="mt-1 block truncate text-xs text-ink-3">
                        {job.location || t("jobs.unknown")}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent">
                      {total > 0
                        ? t("fit.score", { matched, total })
                        : t("home.radar.explore")}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-8 text-sm text-ink-3">
            {t("home.radar.empty")}
          </div>
        )}
      </section>
    </div>
  );
}

export { DailyBriefing };
