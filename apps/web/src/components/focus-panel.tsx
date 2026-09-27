"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  createApplication,
  createJobAnalysis,
  getApplication,
  getJob,
  listApplications,
  listJobAnalyses,
  listResumes,
  saveJob,
  unsaveJob,
  updateApplicationStatus,
} from "@/lib/api";
import { safeExternalUrl } from "@/lib/external-url";
import {
  applicationStatusLabel,
  formatLocaleDate,
  formatResumeVersionLabel,
  useI18n,
  type MessageKey,
} from "@/lib/i18n";
import { jobSourceSummary } from "@/lib/job-source";
import type {
  Application,
  ApplicationStatus,
  Job,
  JobAnalysis,
  ResumeSummary,
} from "@/lib/types";

export type FocusTarget =
  { kind: "application"; id: string } | { kind: "job"; id: string };

type FocusPanelProps = {
  target: FocusTarget;
  onClose: () => void;
  onApplicationChanged?: (application: Application) => void;
  onJobChanged?: (job: Job) => void;
};

const STAGE_ORDER: ApplicationStatus[] = [
  "PREPARING",
  "APPLIED",
  "ASSESSMENT",
  "INTERVIEW",
  "FINAL",
  "OFFER",
];

const ORIGIN_KEYS: Record<Application["origin"], MessageKey> = {
  CAREEROS_JOB: "applications.source.careerosJob",
  EXTERNAL_PAGE: "applications.source.externalPage",
  MANUAL: "applications.source.manualRecord",
};

const CLASSIFICATION_KEYS = [
  "STRONG_EVIDENCE",
  "HIDDEN_EVIDENCE",
  "WEAK_EVIDENCE",
  "GENUINE_GAP",
] as const;

function monogram(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function PanelBar({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex h-[54px] shrink-0 items-center justify-between border-b border-border px-4">
      <button
        type="button"
        onClick={onClose}
        aria-label={t("common.close")}
        className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-ink-2 hover:bg-sunken hover:text-ink"
      >
        <span aria-hidden="true">×</span>
        <span className="font-mono text-xs text-ink-3">Esc</span>
      </button>
    </div>
  );
}

function LoadingBody() {
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy="true">
      <div className="flex gap-3">
        <span className="h-[34px] w-[34px] shrink-0 rounded-lg bg-skeleton" />
        <span className="flex grow flex-col gap-1.5">
          <span className="h-2.5 w-1/2 rounded bg-skeleton" />
          <span className="h-3.5 w-4/5 rounded bg-skeleton" />
        </span>
      </div>
      <span className="h-9 rounded-lg bg-sunken" />
      <span className="h-[74px] rounded-lg bg-sunken" />
    </div>
  );
}

function LoadFailedBody({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className="m-4 flex flex-col gap-2 rounded-lg border border-evidence-gap-border bg-evidence-gap-bg p-4"
    >
      <p className="text-sm text-[#6F3627]">{t("error.panelLoad")}</p>
      <Button variant="secondary" onClick={onRetry} className="self-start">
        {t("errors.retry")}
      </Button>
    </div>
  );
}

function StageControl({
  status,
  updating,
  onChange,
}: {
  status: ApplicationStatus;
  updating: boolean;
  onChange: (status: ApplicationStatus) => void;
}) {
  const { t } = useI18n();
  const closed = status === "REJECTED" || status === "WITHDRAWN";
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium text-ink">{t("panel.stage")}</p>
        <p className="text-xs text-ink-3">{t("panel.stageHint")}</p>
      </div>
      {!closed && (
        <div
          role="group"
          aria-label={t("panel.stage")}
          className="flex overflow-hidden rounded-control border border-border"
        >
          {STAGE_ORDER.map((stage) => (
            <button
              key={stage}
              type="button"
              disabled={updating}
              aria-pressed={stage === status}
              onClick={() => onChange(stage)}
              className={`flex-1 border-r border-border px-1 py-1.5 text-xs font-semibold last:border-r-0 ${
                stage === status
                  ? "bg-accent text-white"
                  : "bg-surface text-ink-2 hover:bg-sunken"
              }`}
            >
              {applicationStatusLabel(stage, t)}
            </button>
          ))}
        </div>
      )}
      {!closed && (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={updating}
            onClick={() => onChange("REJECTED")}
          >
            {t("panel.markRejected")}
          </Button>
          <Button
            variant="secondary"
            disabled={updating}
            onClick={() => onChange("WITHDRAWN")}
          >
            {t("panel.withdraw")}
          </Button>
        </div>
      )}
      {closed && (
        <span className="w-fit rounded-full border border-dashed border-border-strong px-2.5 py-1 text-xs font-semibold text-ink-3">
          {applicationStatusLabel(status, t)}
        </span>
      )}
    </div>
  );
}

function ApplicationPanelBody({
  id,
  onChanged,
}: {
  id: string;
  onChanged?: (application: Application) => void;
}) {
  const { getToken } = useAuth();
  const { locale, t } = useI18n();
  const [application, setApplication] = useState<Application | null>(null);
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const [prevFetchKey, setPrevFetchKey] = useState(0);
  const updateKey = useRef<string | null>(null);

  if (fetchKey !== prevFetchKey) {
    setPrevFetchKey(fetchKey);
    setLoading(true);
    setLoadFailed(false);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing authentication token");
        const [applicationResult, resumeResult] = await Promise.all([
          getApplication(token, id),
          listResumes(token),
        ]);
        if (cancelled) return;
        setApplication(applicationResult);
        setResumes(resumeResult);
        if (applicationResult.job_id) {
          const analyses = await listJobAnalyses(
            token,
            applicationResult.job_id,
          );
          if (!cancelled) setAnalysis(analyses[0] ?? null);
        } else {
          setAnalysis(null);
        }
      } catch {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, id, fetchKey]);

  const resumeLabel = useMemo(() => {
    if (!application?.resume_version_id) return null;
    for (const resume of resumes) {
      const version = resume.versions.find(
        (candidate) => candidate.id === application.resume_version_id,
      );
      if (version)
        return formatResumeVersionLabel(resume.name, version.version_number, t);
    }
    return t("applications.preservedResumeVersion");
  }, [application, resumes, t]);

  async function changeStage(next: ApplicationStatus) {
    if (!application || next === application.status) return;
    const previous = application.status;
    setApplication({ ...application, status: next });
    setUpdating(true);
    setStageError(null);
    updateKey.current = crypto.randomUUID();
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const updated = await updateApplicationStatus(
        token,
        application.id,
        next,
        updateKey.current,
      );
      setApplication(updated);
      onChanged?.(updated);
    } catch {
      setApplication({ ...application, status: previous });
      setStageError(
        t("error.stageUpdate", { stage: applicationStatusLabel(previous, t) }),
      );
    } finally {
      setUpdating(false);
    }
  }

  if (loading) return <LoadingBody />;
  if (loadFailed || !application)
    return <LoadFailedBody onRetry={() => setFetchKey((k) => k + 1)} />;

  const applicationUrl = safeExternalUrl(application.application_url);
  const classificationCounts = analysis
    ? CLASSIFICATION_KEYS.map((key) => ({
        key,
        count: analysis.matches.filter((match) => match.classification === key)
          .length,
      }))
    : null;

  return (
    <div className="flex flex-col gap-5 overflow-y-auto p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft font-semibold text-accent">
          {monogram(application.company)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-ink-2">
            {application.company}
          </p>
          <h2 className="truncate text-[19px] font-semibold text-ink">
            {application.role}
          </h2>
          <p className="mt-0.5 text-xs text-ink-3">
            {t(ORIGIN_KEYS[application.origin])}
          </p>
        </div>
      </div>

      <StageControl
        status={application.status}
        updating={updating}
        onChange={(next) => void changeStage(next)}
      />
      {stageError && (
        <div
          role="alert"
          className="rounded-lg border border-evidence-gap-border bg-evidence-gap-bg p-3 text-sm text-[#6F3627]"
        >
          {stageError}
        </div>
      )}
      <p className="text-xs text-ink-3">
        {formatLocaleDate(locale, application.status_updated_at)}
      </p>

      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-rail p-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-3">
            {t("panel.resumeSent")}
          </dt>
          <dd className="mt-1 text-sm text-ink">
            {resumeLabel ?? (
              <span className="text-ink-3">
                {t("applications.noResumeRecorded")}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-3">
            {t("applications.applied")}
          </dt>
          <dd className="mt-1 text-sm text-ink">
            {formatLocaleDate(locale, application.applied_at) ??
              t("common.notSubmittedYet")}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-3">
            {t("applications.sourceLabel")}
          </dt>
          <dd className="mt-1 text-sm text-ink">{application.source}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-3">
            {t("jobs.applicationUrl")}
          </dt>
          <dd className="mt-1 text-sm text-ink">
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
        <p className="col-span-2 border-t border-border pt-2 text-xs text-ink-3">
          {t("panel.frozen")}
        </p>
      </dl>

      {application.job_id && (
        <div className="rounded-lg border border-border p-3">
          <p className="text-sm font-medium text-ink">
            {t("jobs.detail.jobIntelligence")}
          </p>
          {classificationCounts ? (
            <>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                {classificationCounts.map(({ key, count }) => (
                  <div key={key} className="rounded-md bg-rail p-2">
                    <p className="text-base font-semibold text-ink">{count}</p>
                    <p className="text-[10px] text-ink-3">
                      {t(
                        `jobs.detail.${classificationLabelKey(key)}` as MessageKey,
                      )}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-3">
                {analysis?.resume_name} · v{analysis?.resume_version_number}
              </p>
              <Link
                href={`/discover?focus=${application.job_id}`}
                className="mt-2 inline-block text-sm font-semibold text-accent hover:underline"
              >
                {t("panel.openAnalysis")}
              </Link>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-3">{t("panel.noAnalysis")}</p>
          )}
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-ink">
          {t("panel.answers")} · {application.answers.length}
        </p>
        {application.answers.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">{t("panel.noAnswers")}</p>
        ) : (
          <dl className="mt-2 flex flex-col gap-3">
            {application.answers
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((answer) => (
                <div
                  key={answer.id}
                  className="rounded-lg border border-border p-3"
                >
                  <dt className="text-xs text-ink-3">{answer.question_text}</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm text-ink">
                    {answer.answer_text}
                  </dd>
                </div>
              ))}
          </dl>
        )}
      </div>
    </div>
  );
}

function classificationLabelKey(
  classification: (typeof CLASSIFICATION_KEYS)[number],
): string {
  switch (classification) {
    case "STRONG_EVIDENCE":
      return "strongEvidence";
    case "HIDDEN_EVIDENCE":
      return "hiddenEvidence";
    case "WEAK_EVIDENCE":
      return "weakEvidence";
    case "GENUINE_GAP":
      return "genuineGaps";
  }
}

function JobPanelBody({
  id,
  onChanged,
}: {
  id: string;
  onChanged?: (job: Job) => void;
}) {
  const { getToken } = useAuth();
  const { locale, t } = useI18n();
  const [job, setJob] = useState<Job | null>(null);
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [linkedApplication, setLinkedApplication] =
    useState<Application | null>(null);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const [prevFetchKey, setPrevFetchKey] = useState(0);
  const applicationKey = useRef<string | null>(null);

  if (fetchKey !== prevFetchKey) {
    setPrevFetchKey(fetchKey);
    setLoading(true);
    setLoadFailed(false);
  }

  const versions = useMemo(
    () =>
      resumes.flatMap((resume) =>
        resume.versions.map((version) => ({ resume, version })),
      ),
    [resumes],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing authentication token");
        const [jobResult, resumeResult, analysisResult, applications] =
          await Promise.all([
            getJob(token, id),
            listResumes(token),
            listJobAnalyses(token, id),
            listApplications(token),
          ]);
        if (cancelled) return;
        setJob(jobResult);
        setResumes(resumeResult);
        setAnalysis(analysisResult[0] ?? null);
        const linked = applications.find((app) => app.job_id === id) ?? null;
        setLinkedApplication(
          linked ? await getApplication(token, linked.id) : null,
        );
        setSelectedVersion(
          analysisResult[0]?.resume_version_id ??
            resumeResult[0]?.versions[0]?.id ??
            "",
        );
      } catch {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, id, fetchKey]);

  async function toggleSave() {
    if (!job) return;
    setSaving(true);
    setActionError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      let updated: Job;
      if (job.is_saved) {
        await unsaveJob(token, job.id);
        updated = { ...job, is_saved: false, saved_at: null };
      } else {
        updated = await saveJob(token, job.id);
      }
      setJob(updated);
      onChanged?.(updated);
    } catch {
      setActionError(t("jobs.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function startApplication() {
    if (!job) return;
    setStarting(true);
    setActionError(null);
    applicationKey.current ??= crypto.randomUUID();
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      await createApplication(token, {
        idempotency_key: applicationKey.current,
        origin: "CAREEROS_JOB",
        job_id: job.id,
        resume_version_id: selectedVersion || null,
        status: "PREPARING",
        answers: [],
      });
      const applicationUrl = safeExternalUrl(job.application_url);
      if (applicationUrl)
        window.open(applicationUrl, "_blank", "noopener,noreferrer");
    } catch {
      setActionError(t("error.recordFromSaved"));
    } finally {
      setStarting(false);
    }
  }

  async function runAnalysis() {
    if (!selectedVersion) return;
    setAnalyzing(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      setAnalysis(await createJobAnalysis(token, id, selectedVersion));
    } catch {
      setActionError(t("jobs.detail.analysisError"));
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) return <LoadingBody />;
  if (loadFailed || !job)
    return <LoadFailedBody onRetry={() => setFetchKey((k) => k + 1)} />;

  const applicationUrl = safeExternalUrl(job.application_url);
  const chips = [
    job.location,
    job.workplace_type !== "UNKNOWN" ? job.workplace_type : null,
    job.employment_type !== "UNKNOWN" ? job.employment_type : null,
    job.market !== "UNKNOWN" ? job.market : null,
  ].filter((value): value is string => Boolean(value));
  const recommendationKey =
    `jobs.detail.recommendation.${analysis?.overall_recommendation ?? "APPLY"}` as MessageKey;

  return (
    <div className="flex flex-col gap-5 overflow-y-auto p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft font-semibold text-accent">
          {monogram(job.company)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-ink-2">
            {job.company}
          </p>
          <h2 className="truncate text-[19px] font-semibold text-ink">
            {job.title}
          </h2>
          {chips.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-medium text-ink-2"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {linkedApplication ? (
        <div className="flex flex-col gap-2 rounded-lg border border-accent-soft-border bg-accent-tint p-3">
          <p className="text-sm font-semibold text-ink">
            {t("discover.inPipeline", {
              stage: applicationStatusLabel(linkedApplication.status, t),
            })}
          </p>
          <p className="text-xs text-ink-3">
            {t("applications.applied")}:{" "}
            {formatLocaleDate(locale, linkedApplication.applied_at) ??
              t("common.notSubmittedYet")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/pipeline?view=list&focus=${linkedApplication.id}`}
              className="text-sm font-semibold text-accent hover:underline"
            >
              {t("discover.openInPipeline")}
            </Link>
            {applicationUrl && (
              <a
                href={applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-accent hover:underline"
              >
                {t("panel.openPage")}
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {!job.is_saved && (
            <Button onClick={() => void toggleSave()} loading={saving}>
              {t("discover.saveToPipeline")}
            </Button>
          )}
          {applicationUrl ? (
            <Button
              variant={job.is_saved ? "primary" : "secondary"}
              onClick={() => void startApplication()}
              loading={starting}
            >
              {t("discover.applyNow")}
            </Button>
          ) : (
            <p className="text-sm text-ink-3">{t("discover.noLinkHint")}</p>
          )}
        </div>
      )}
      {actionError && (
        <div role="alert" className="text-sm text-[#6F3627]">
          {actionError}
        </div>
      )}

      <div className="rounded-lg border border-border p-3">
        <p className="text-sm font-medium text-ink">
          {t("jobs.detail.jobIntelligence")}
        </p>
        {versions.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            <select
              value={selectedVersion}
              onChange={(event) => setSelectedVersion(event.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink"
            >
              {versions.map(({ resume, version }) => (
                <option key={version.id} value={version.id}>
                  {formatResumeVersionLabel(
                    resume.name,
                    version.version_number,
                    t,
                  )}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              onClick={() => void runAnalysis()}
              loading={analyzing}
            >
              {analysis
                ? t("jobs.detail.runNewAnalysis")
                : t("jobs.detail.analyzeJob")}
            </Button>
          </div>
        )}
        {analysis ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm font-semibold text-ink">
              {t(recommendationKey)}
            </p>
            <p className="text-sm text-ink-2">{analysis.summary}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-3">{t("panel.noAnalysis")}</p>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-ink">
          {t("jobs.detail.groundedRequirements")}
        </p>
        <ul className="mt-2 flex flex-col gap-2">
          {job.latest_snapshot.requirements.map((requirement) => (
            <li
              key={requirement.id}
              className="rounded-lg border border-border p-3"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-ink-3">
                {requirement.importance.toLowerCase()} ·{" "}
                {requirement.category.replaceAll("_", " ")}
              </p>
              <p className="mt-1 text-sm text-ink">{requirement.description}</p>
              <p className="mt-1 text-xs text-ink-3">
                &ldquo;{requirement.source_text}&rdquo;
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-sm font-medium text-ink">
          {t("jobs.detail.originalDescription")}
        </p>
        <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-ink-2">
          {job.latest_snapshot.raw_description}
        </p>
        <p className="mt-2 text-xs text-ink-3">
          {jobSourceSummary(job, locale)}
        </p>
      </div>
    </div>
  );
}

function FocusPanel({
  target,
  onClose,
  onApplicationChanged,
  onJobChanged,
}: FocusPanelProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-surface shadow-panel-edge lg:w-[520px]">
      <PanelBar onClose={onClose} />
      {target.kind === "application" ? (
        <ApplicationPanelBody
          key={target.id}
          id={target.id}
          onChanged={onApplicationChanged}
        />
      ) : (
        <JobPanelBody key={target.id} id={target.id} onChanged={onJobChanged} />
      )}
    </aside>
  );
}

export { FocusPanel };
