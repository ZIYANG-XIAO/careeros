"use client";

import Link from "next/link";

import { useI18n } from "@/lib/i18n";
import type { CareerBrain, DetailEvidence } from "@/lib/types";

function isConfirmed(evidence: DetailEvidence | null): boolean {
  return evidence?.confirmation_status === "CONFIRMED";
}

function CareerBrainOverview({ brain }: { brain: CareerBrain }) {
  const { t } = useI18n();
  const experienceDetails = brain.experiences.flatMap(
    (experience) => experience.details,
  );
  const projectDetails = brain.projects.flatMap((project) => project.details);
  const evidence = [
    ...experienceDetails.map((detail) => detail.evidence),
    ...projectDetails.map((detail) => detail.evidence),
    ...brain.skills.map((skill) => skill.evidence),
  ];
  const confirmedEvidence = evidence.filter(isConfirmed).length;
  const preferredSkills = brain.skills.filter((skill) => skill.preferred);
  const metrics = [
    ["career.overview.experience", brain.experiences.length],
    ["career.overview.projects", brain.projects.length],
    ["career.overview.skills", brain.skills.length],
    ["career.overview.evidence", confirmedEvidence],
  ] as const;

  return (
    <section
      aria-labelledby="career-overview-heading"
      className="overflow-hidden rounded-2xl border border-border bg-surface shadow-raised"
    >
      <div className="grid gap-6 bg-accent-tint px-5 py-5 sm:grid-cols-[1fr_auto] sm:px-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            {t("career.overview.eyebrow")}
          </p>
          <h2
            id="career-overview-heading"
            className="mt-1 text-xl font-semibold text-ink"
          >
            {t("career.overview.title")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">
            {t("career.overview.description")}
          </p>
        </div>
        <Link
          href="/me/resumes?upload=1"
          className="h-fit rounded-lg border border-accent-soft-border bg-surface px-3 py-2 text-sm font-semibold text-accent hover:bg-accent-soft"
        >
          {t("me.uploadResume")}
        </Link>
      </div>

      <dl className="grid grid-cols-2 border-y border-border sm:grid-cols-4">
        {metrics.map(([label, value], index) => (
          <div
            key={label}
            className={`px-4 py-4 ${index % 2 === 0 ? "border-r border-border" : ""} sm:border-r sm:last:border-r-0`}
          >
            <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-3">
              {t(label)}
            </dt>
            <dd className="mt-1 text-2xl font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-7">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            {t("career.overview.focusSkills")}
          </h3>
          {preferredSkills.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {preferredSkills.slice(0, 8).map((skill) => (
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
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">
            {t("career.overview.reuseTitle")}
          </h3>
          <p className="mt-2 text-sm leading-6 text-ink-2">
            {confirmedEvidence > 0
              ? t("career.overview.reuseReady", { count: confirmedEvidence })
              : t("career.overview.reuseEmpty")}
          </p>
          <Link
            href="/me/contact"
            className="mt-2 inline-flex text-sm font-semibold text-accent hover:underline"
          >
            {t("career.overview.completeContact")} →
          </Link>
        </div>
      </div>
    </section>
  );
}

export { CareerBrainOverview };
