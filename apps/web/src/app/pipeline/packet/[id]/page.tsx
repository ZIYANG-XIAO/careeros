"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback } from "react";

import { CompanyMark } from "@/components/company-mark";
import { LoadErrorBanner } from "@/components/load-error-banner";
import { Spinner } from "@/components/ui/spinner";
import { getApplicationPacket } from "@/lib/api";
import {
  applicationStatusLabel,
  formatLocaleDate,
  type MessageKey,
  useI18n,
} from "@/lib/i18n";
import { safeExternalUrl } from "@/lib/external-url";
import type { ApplicationPacket } from "@/lib/types";
import { useDataFetch } from "@/lib/use-data-fetch";

const BASIS_KEY: Record<
  NonNullable<ApplicationPacket["job_snapshot"]>["basis"],
  MessageKey
> = {
  AT_SUBMISSION: "packet.snapshot.atSubmission",
  AT_CREATION: "packet.snapshot.atCreation",
  EARLIEST_AVAILABLE: "packet.snapshot.earliest",
};

const ACTIVITY_KEY = {
  NOTE: "activity.type.note",
  FOLLOW_UP: "activity.type.followUp",
  INTERVIEW: "activity.type.interview",
} as const;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="break-inside-avoid-page rounded-2xl border border-border bg-surface p-5 sm:p-6 print:rounded-none print:border-0 print:border-t print:px-0">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function ApplicationPacketPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { locale, t } = useI18n();

  const fetchPacket = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Missing authentication token");
    return getApplicationPacket(token, id);
  }, [getToken, id]);

  const { data, isInitialLoading, loadError, retry } =
    useDataFetch<ApplicationPacket | null>({
      enabled: isLoaded && Boolean(isSignedIn),
      resetKey: `${userId ?? ""}:${id}`,
      initialData: null,
      fetch: fetchPacket,
      deps: [getToken, isLoaded, isSignedIn, id],
    });

  if (!isLoaded || isInitialLoading) return <Spinner />;
  if (loadError || !data) {
    return loadError ? (
      <LoadErrorBanner
        error={loadError}
        onRetry={retry}
        retryLabel={t("errors.retry")}
        t={t}
      />
    ) : (
      <Spinner />
    );
  }

  const { application } = data;
  const applicationUrl = safeExternalUrl(application.application_url);
  const timeline = [
    ...data.status_history.map((entry) => ({
      at: entry.changed_at,
      label:
        entry.from_status === null
          ? t("panel.statusHistoryCreated", {
              stage: applicationStatusLabel(entry.to_status, t),
            })
          : t("panel.statusHistoryTransition", {
              from: applicationStatusLabel(entry.from_status, t),
              to: applicationStatusLabel(entry.to_status, t),
            }),
      detail: null as string | null,
    })),
    ...data.activities.map((activity) => ({
      at: activity.scheduled_at ?? activity.created_at,
      label: `${t(ACTIVITY_KEY[activity.activity_type])} · ${activity.title}`,
      detail: activity.body,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="mx-auto max-w-4xl space-y-5 print:max-w-none">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          href={`/pipeline?view=list&focus=${application.id}`}
          className="text-sm font-semibold text-accent hover:underline"
        >
          ← {t("packet.back")}
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-ink-2 hover:bg-sunken"
        >
          {t("packet.print")}
        </button>
      </div>

      <header className="rounded-2xl border border-border bg-surface p-5 sm:p-7 print:border-0 print:p-0">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          {t("packet.eyebrow")}
        </p>
        <div className="mt-3 flex items-start gap-4">
          <CompanyMark company={application.company} size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-2">
              {application.company}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {application.role}
            </h1>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-ink-3">{t("packet.status")}</dt>
            <dd className="mt-0.5 font-semibold text-ink">
              {applicationStatusLabel(application.status, t)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">{t("applications.applied")}</dt>
            <dd className="mt-0.5 text-ink">
              {formatLocaleDate(locale, application.applied_at) ??
                t("common.notSubmittedYet")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">
              {t("applications.sourceLabel")}
            </dt>
            <dd className="mt-0.5 text-ink">{application.source}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">{t("jobs.applicationUrl")}</dt>
            <dd className="mt-0.5 truncate">
              {applicationUrl ? (
                <a
                  href={applicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-accent hover:underline"
                >
                  {t("panel.openPage")}
                </a>
              ) : (
                <span className="text-ink-3">{t("panel.noLink")}</span>
              )}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-ink-3">{t("panel.frozen")}</p>
      </header>

      <Section title={t("packet.resume")}>
        {data.resume_version ? (
          <p className="text-sm text-ink">
            <span className="font-semibold">
              {data.resume_version.resume_name} · v
              {data.resume_version.version_number}
            </span>
            <span className="text-ink-3">
              {" "}
              · {data.resume_version.original_filename} ·{" "}
              {formatLocaleDate(locale, data.resume_version.created_at)}
            </span>
          </p>
        ) : (
          <p className="text-sm text-ink-3">
            {t("applications.noResumeRecorded")}
          </p>
        )}
      </Section>

      <Section
        title={t("packet.answers", { count: application.answers.length })}
      >
        {application.answers.length === 0 ? (
          <p className="text-sm text-ink-3">{t("panel.noAnswers")}</p>
        ) : (
          <dl className="space-y-4">
            {application.answers
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((answer) => (
                <div key={answer.id} className="break-inside-avoid">
                  <dt className="text-xs font-medium text-ink-3">
                    {answer.question_text}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm text-ink">
                    {answer.answer_text}
                  </dd>
                </div>
              ))}
          </dl>
        )}
      </Section>

      <Section title={t("packet.timeline")}>
        {timeline.length === 0 ? (
          <p className="text-sm text-ink-3">{t("packet.timelineEmpty")}</p>
        ) : (
          <ol className="space-y-2 border-l-2 border-row-divider pl-4">
            {timeline.map((item, index) => (
              <li key={`${item.at}-${index}`} className="text-sm">
                <span className="font-mono text-xs text-ink-3">
                  {formatLocaleDate(locale, item.at)}
                </span>{" "}
                <span className="text-ink">{item.label}</span>
                {item.detail && (
                  <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink-2">
                    {item.detail}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Section>

      {data.contacts.length > 0 && (
        <Section title={t("packet.contacts")}>
          <ul className="space-y-2 text-sm">
            {data.contacts.map((contact) => (
              <li key={contact.id}>
                <span className="font-semibold text-ink">{contact.name}</span>
                {contact.email && (
                  <span className="text-ink-2"> · {contact.email}</span>
                )}
                {contact.notes && (
                  <p className="text-xs text-ink-3">{contact.notes}</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t("packet.jobDescription")}>
        {data.job_snapshot ? (
          <>
            <p className="text-xs text-ink-3">
              {t(BASIS_KEY[data.job_snapshot.basis], {
                version: data.job_snapshot.version_number,
                date:
                  formatLocaleDate(locale, data.job_snapshot.captured_at) ?? "",
              })}
            </p>
            <div className="mt-3 max-h-[480px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-rail p-4 text-sm leading-6 text-ink-2 print:max-h-none print:overflow-visible print:bg-transparent print:p-0">
              {data.job_snapshot.description}
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-3">{t("packet.noJob")}</p>
        )}
      </Section>
    </div>
  );
}
