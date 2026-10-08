"use client";

import Link from "next/link";

import {
  applicationReadiness,
  evidenceTiers,
  isBrainEmpty,
  profileActions,
  type ProfileAction,
  type ProfileContext,
  type ReadinessKey,
} from "@/lib/career-profile";
import { type MessageKey, useI18n } from "@/lib/i18n";
import type { CareerBrain } from "@/lib/types";

type CareerBrainOverviewProps = Partial<Omit<ProfileContext, "brain">> & {
  brain: CareerBrain;
};

const READINESS_LABEL: Record<ReadinessKey, MessageKey> = {
  name: "career.readiness.name",
  email: "career.readiness.email",
  phone: "career.readiness.phone",
  location: "career.readiness.location",
  links: "career.readiness.links",
  experience: "career.readiness.experience",
  education: "career.readiness.education",
  resume: "career.readiness.resume",
  answers: "career.readiness.answers",
};

function ActionText({ action }: { action: ProfileAction }) {
  const { t } = useI18n();
  const [title, hint] = (() => {
    switch (action.kind) {
      case "REVIEW_IMPORT":
        return [
          t("career.action.reviewImport", {
            count: action.count,
            filename: action.filename,
          }),
          t("career.action.reviewImportHint"),
        ];
      case "UPLOAD_RESUME":
        return [
          t("career.action.uploadResume"),
          t("career.action.uploadResumeHint"),
        ];
      case "ADD_ACHIEVEMENTS":
        return [
          t("career.action.addAchievements", {
            count: action.count,
            example: action.example,
          }),
          t("career.action.addAchievementsHint"),
        ];
      case "QUANTIFY":
        return [
          t("career.action.quantify", { count: action.count }),
          t("career.action.quantifyHint"),
        ];
      case "ADD_SKILL_EVIDENCE":
        return [
          t("career.action.skillEvidence", { count: action.count }),
          t("career.action.skillEvidenceHint"),
        ];
      case "SET_GOAL":
        return [t("career.action.setGoal"), t("career.action.setGoalHint")];
      case "CONFIRM_CONTACT":
        return [
          t("career.action.confirmContact"),
          t("career.action.confirmContactHint"),
        ];
      case "MARK_FOCUS_SKILLS":
        return [
          t("career.action.focusSkills"),
          t("career.action.focusSkillsHint"),
        ];
    }
  })();
  return (
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-ink">{title}</span>
      <span className="mt-0.5 block text-xs leading-5 text-ink-3">{hint}</span>
    </span>
  );
}

function CareerBrainOverview({
  brain,
  resumes = null,
  contact = null,
  goals = null,
  answers = null,
  pendingImports = null,
}: CareerBrainOverviewProps) {
  const { t } = useI18n();
  const context: ProfileContext = {
    brain,
    resumes,
    contact,
    goals,
    answers,
    pendingImports,
  };
  // Steer toward the first resume until one exists; fall back to the profile
  // itself being empty when the resume list could not be loaded.
  const empty =
    resumes !== null
      ? resumes.length === 0 && brain.experiences.length === 0
      : isBrainEmpty(brain);
  const tiers = evidenceTiers(brain, pendingImports);
  const actions = profileActions(context);
  const readiness = applicationReadiness(context);
  const readyCount = readiness.filter((item) => item.ready === true).length;
  const preferredSkills = brain.skills.filter((skill) => skill.preferred);
  const counts = [
    ["career.overview.experience", brain.experiences.length, "/me/experience"],
    ["career.overview.projects", brain.projects.length, "/me/projects"],
    ["career.overview.education", brain.educations.length, "/me/education"],
    ["career.overview.skills", brain.skills.length, "/me/skills"],
  ] as const;
  const tierRows = [
    {
      key: "confirmed",
      value: tiers.confirmed,
      label: t("career.tier.confirmed"),
      hint: t("career.tier.confirmedHint"),
      dot: "bg-status-offer-ink",
    },
    {
      key: "pending",
      value: tiers.pending,
      label: t("career.tier.pending"),
      hint: t("career.tier.pendingHint"),
      dot: "bg-status-assessment-ink",
    },
    {
      key: "unsupported",
      value: tiers.unsupported,
      label: t("career.tier.unsupported"),
      hint: t("career.tier.unsupportedHint"),
      dot: "bg-border-strong",
    },
  ];

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="career-overview-heading"
        className="overflow-hidden rounded-2xl border border-border bg-surface shadow-raised"
      >
        <div className="flex flex-col gap-4 bg-accent-tint px-5 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              {t("career.eyebrow")}
            </p>
            <h1
              id="career-overview-heading"
              className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
            >
              {t("career.overview.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">
              {t("career.overview.heroIntro")}
            </p>
          </div>
          <Link
            href="/me/resumes?upload=1"
            className={`h-fit shrink-0 rounded-lg px-4 py-2 text-sm font-semibold ${
              empty
                ? "bg-accent text-white hover:bg-accent-hover"
                : "border border-accent-soft-border bg-surface text-accent hover:bg-accent-soft"
            }`}
          >
            {empty ? t("me.uploadResume") : t("career.overview.uploadAnother")}
          </Link>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-4">
          {counts.map(([label, value, href], index) => (
            <div
              key={label}
              className={`border-border ${index % 2 === 0 ? "border-r" : ""} ${index < 2 ? "border-b sm:border-b-0" : ""} sm:border-r sm:last:border-r-0`}
            >
              <Link href={href} className="block px-4 py-4 hover:bg-rail">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-3">
                  {t(label)}
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-ink">
                  {value}
                </dd>
              </Link>
            </div>
          ))}
        </dl>
      </section>

      {empty && (
        <section
          aria-labelledby="career-start-heading"
          className="rounded-2xl border border-accent-soft-border bg-surface p-5 sm:p-7"
        >
          <h2
            id="career-start-heading"
            className="text-lg font-semibold text-ink"
          >
            {t("career.start.title")}
          </h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {(
              [
                ["career.start.step1", "career.start.step1Hint"],
                ["career.start.step2", "career.start.step2Hint"],
                ["career.start.step3", "career.start.step3Hint"],
              ] as const
            ).map(([title, hint], index) => (
              <li
                key={title}
                className="rounded-xl border border-border bg-rail p-4"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <p className="mt-3 text-sm font-semibold text-ink">
                  {t(title)}
                </p>
                <p className="mt-1 text-xs leading-5 text-ink-3">{t(hint)}</p>
              </li>
            ))}
          </ol>
          <Link
            href="/me/experience"
            className="mt-4 inline-flex text-sm font-semibold text-accent hover:underline"
          >
            {t("career.start.manual")} →
          </Link>
        </section>
      )}

      <section
        aria-labelledby="career-actions-heading"
        className="overflow-hidden rounded-2xl border border-border bg-surface"
      >
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border px-5 py-4 sm:px-7">
          <div>
            <h2
              id="career-actions-heading"
              className="text-lg font-semibold text-ink"
            >
              {t("career.actions.title")}
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              {actions.length > 0
                ? t("career.actions.count", { count: actions.length })
                : t("career.actions.clear")}
            </p>
          </div>
        </div>
        {actions.length > 0 && (
          <ul className="divide-y divide-row-divider">
            {actions.slice(0, 5).map((action) => (
              <li key={`${action.kind}-${action.href}`}>
                <Link
                  href={action.href}
                  className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-rail sm:px-7"
                >
                  <ActionText action={action} />
                  <span className="shrink-0 text-sm font-semibold text-accent">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="career-tiers-heading"
          className="rounded-2xl border border-border bg-surface p-5 sm:p-6"
        >
          <h2
            id="career-tiers-heading"
            className="text-base font-semibold text-ink"
          >
            {t("career.tier.title")}
          </h2>
          <p className="mt-1 text-sm text-ink-2">{t("career.tier.intro")}</p>
          <ul className="mt-4 space-y-3">
            {tierRows.map((row) => (
              <li key={row.key} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${row.dot}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {row.label}
                    </span>
                    <span className="font-mono text-lg font-semibold text-ink">
                      {row.value}
                    </span>
                  </span>
                  <span className="block text-xs leading-5 text-ink-3">
                    {row.hint}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-row-divider pt-3 text-xs text-ink-3">
            {tiers.confirmed > 0
              ? t("career.overview.reuseReady", { count: tiers.confirmed })
              : t("career.overview.reuseEmpty")}
          </p>
        </section>

        <section
          aria-labelledby="career-readiness-heading"
          className="rounded-2xl border border-border bg-surface p-5 sm:p-6"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2
              id="career-readiness-heading"
              className="text-base font-semibold text-ink"
            >
              {t("career.readiness.title")}
            </h2>
            <span className="text-sm font-semibold text-ink-2">
              {t("career.readiness.summary", {
                ready: readyCount,
                total: readiness.length,
              })}
            </span>
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {readiness.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-rail"
                >
                  <span
                    aria-hidden
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                      item.ready === true
                        ? "bg-status-offer-bg text-status-offer-ink"
                        : item.ready === false
                          ? "border border-border-strong text-transparent"
                          : "bg-sunken text-ink-3"
                    }`}
                  >
                    {item.ready === true ? "✓" : item.ready === null ? "?" : ""}
                  </span>
                  <span
                    className={item.ready === true ? "text-ink" : "text-ink-3"}
                  >
                    {t(READINESS_LABEL[item.key])}
                  </span>
                  <span className="sr-only">
                    {item.ready === true
                      ? t("career.readiness.ready")
                      : item.ready === false
                        ? t("career.readiness.missing")
                        : t("career.readiness.unknown")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-row-divider pt-3 text-xs leading-5 text-ink-3">
            {t("career.readiness.sensitive")}
          </p>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">
            {t("career.overview.focusSkills")}
          </h2>
          <Link
            href="/me/skills"
            className="text-sm font-semibold text-accent hover:underline"
          >
            {t("career.overview.manageSkills")} →
          </Link>
        </div>
        {preferredSkills.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {preferredSkills.slice(0, 12).map((skill) => (
              <span
                key={skill.id}
                className="rounded-full border border-accent-soft-border bg-accent-tint px-2.5 py-1 text-xs font-semibold text-accent"
              >
                {skill.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-3">
            {t("career.overview.noFocusSkills")}
          </p>
        )}
      </section>
    </div>
  );
}

export { CareerBrainOverview };
