"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  createApplication,
  createJobAnalysis,
  getJob,
  listJobAnalyses,
  listResumes,
  saveJob,
  unsaveJob,
} from "@/lib/api";
import { safeExternalUrl } from "@/lib/external-url";
import { formatResumeVersionLabel, useI18n, type MessageKey } from "@/lib/i18n";
import { jobSourceSummary } from "@/lib/job-source";
import type {
  Application,
  Job,
  JobAnalysis,
  RequirementAnalysis,
  ResumeSummary,
} from "@/lib/types";

function evidenceGroups(t: (key: MessageKey) => string) {
  return [
    {
      key: "STRONG_EVIDENCE" as const,
      title: t("jobs.detail.strongEvidence"),
      description: t("jobs.detail.strongEvidenceDescription"),
      style: "border-emerald-200 bg-emerald-50/40",
      badge: "bg-emerald-100 text-emerald-800",
    },
    {
      key: "HIDDEN_EVIDENCE" as const,
      title: t("jobs.detail.hiddenEvidence"),
      description: t("jobs.detail.hiddenEvidenceDescription"),
      style: "border-blue-200 bg-blue-50/40",
      badge: "bg-blue-100 text-blue-800",
    },
    {
      key: "WEAK_EVIDENCE" as const,
      title: t("jobs.detail.weakEvidence"),
      description: t("jobs.detail.weakEvidenceDescription"),
      style: "border-amber-200 bg-amber-50/40",
      badge: "bg-amber-100 text-amber-900",
    },
    {
      key: "GENUINE_GAP" as const,
      title: t("jobs.detail.genuineGaps"),
      description: t("jobs.detail.genuineGapsDescription"),
      style: "border-rose-200 bg-rose-50/40",
      badge: "bg-rose-100 text-rose-800",
    },
  ];
}

function MatchCard({ match }: { match: RequirementAnalysis }) {
  const { t } = useI18n();

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {match.category.replaceAll("_", " ")} ·{" "}
            {match.importance.toLowerCase()}
          </p>
          <h3 className="mt-1 font-semibold text-slate-950">
            {match.description}
          </h3>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          {t("jobs.detail.resumeRepresentation")}{" "}
          {match.resume_representation.toLowerCase()}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        {match.explanation}
      </p>
      {match.evidence_references.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("jobs.detail.careerBrainEvidence")}
          </p>
          <ul className="mt-2 space-y-2">
            {match.evidence_references.map((reference) => (
              <li
                key={reference.career_evidence_revision_id}
                className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700"
              >
                <span className="mr-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {reference.source_type.replaceAll("_", " ")}
                </span>
                {reference.evidence_content}
              </li>
            ))}
          </ul>
        </div>
      )}
      {match.resume_source_text && (
        <div className="mt-3 rounded-lg border-l-2 border-slate-300 bg-slate-50 p-3 text-sm italic text-slate-600">
          {t("jobs.detail.resumeExcerpt")} “{match.resume_source_text}”
        </div>
      )}
    </article>
  );
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { locale, t } = useI18n();
  const groups = useMemo(() => evidenceGroups(t), [t]);
  const [job, setJob] = useState<Job | null>(null);
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startingApplication, setStartingApplication] = useState(false);
  const [trackedApplication, setTrackedApplication] =
    useState<Application | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const [prevFetchKey, setPrevFetchKey] = useState(0);
  const applicationKey = useRef<string | null>(null);

  if (fetchKey !== prevFetchKey) {
    setPrevFetchKey(fetchKey);
    setError(null);
    setLoading(true);
  }

  const versions = useMemo(
    () =>
      resumes.flatMap((resume) =>
        resume.versions.map((version) => ({ resume, version })),
      ),
    [resumes],
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing authentication token");
        const [jobResult, resumeResult, analysisResult] = await Promise.all([
          getJob(token, id),
          listResumes(token),
          listJobAnalyses(token, id),
        ]);
        if (cancelled) return;
        setJob(jobResult);
        setResumes(resumeResult);
        setAnalysis(analysisResult[0] ?? null);
        const defaultVersion =
          analysisResult[0]?.resume_version_id ??
          resumeResult[0]?.versions[0]?.id ??
          "";
        setSelectedVersion(defaultVersion);
      } catch {
        if (!cancelled) {
          setError(t("jobs.detail.loadError"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, id, isLoaded, isSignedIn, t, fetchKey]);

  async function analyze() {
    if (!selectedVersion) return;
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      setAnalysis(await createJobAnalysis(token, id, selectedVersion));
    } catch {
      setAnalysisError(t("jobs.detail.analysisError"));
    } finally {
      setAnalyzing(false);
    }
  }

  async function toggleSave() {
    if (!job) return;
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      if (job.is_saved) {
        await unsaveJob(token, job.id);
        setJob({ ...job, is_saved: false });
      } else {
        setJob(await saveJob(token, job.id));
      }
      setActionError(null);
    } catch {
      setActionError(t("jobs.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function startApplication() {
    if (!job || !safeExternalUrl(job.application_url)) return;
    setStartingApplication(true);
    setActionError(null);
    applicationKey.current ??= crypto.randomUUID();
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const created = await createApplication(token, {
        idempotency_key: applicationKey.current,
        origin: "CAREEROS_JOB",
        job_id: job.id,
        resume_version_id: selectedVersion || null,
        status: "PREPARING",
        answers: [],
      });
      setTrackedApplication(created);
    } catch {
      setActionError(t("jobs.detail.trackError"));
    } finally {
      setStartingApplication(false);
    }
  }

  if (!isLoaded || (loading && isSignedIn)) return <Spinner />;
  if (!isSignedIn)
    return (
      <p className="text-sm text-slate-600">
        {t("jobs.detail.signInRequired")}
      </p>
    );
  if (error || !job) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
          role="alert"
        >
          <p>{error ?? t("jobs.detail.notFound")}</p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => setFetchKey((k) => k + 1)}
          >
            {t("errors.retry")}
          </Button>
        </div>
        <Link
          href="/jobs"
          className="inline-flex text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          {t("jobs.detail.backToAll")}
        </Link>
      </div>
    );
  }

  const applicationUrl = safeExternalUrl(job.application_url);
  const sourceUrl = safeExternalUrl(job.source_url ?? job.canonical_url);
  const recommendationKey =
    `jobs.detail.recommendation.${analysis?.overall_recommendation ?? "APPLY"}` as MessageKey;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Link
          href="/jobs"
          className="text-sm font-medium text-blue-700 hover:text-blue-900"
        >
          {t("jobs.detail.backToAll")}
        </Link>
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              {job.company}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              {job.title}
            </h1>
            {job.location && (
              <p className="mt-2 text-sm text-slate-500">{job.location}</p>
            )}
            <p className="mt-4 text-xs text-slate-400">
              {jobSourceSummary(job, locale)}
            </p>
          </div>
          <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {t("jobs.detail.nextStep")}
            </p>
            {applicationUrl ? (
              <>
                {versions.length > 0 && !trackedApplication ? (
                  <div className="mt-3">
                    <label
                      htmlFor="application-resume-version"
                      className="text-sm font-medium text-slate-700"
                    >
                      {t("jobs.detail.resumeForApplication")}
                    </label>
                    <select
                      id="application-resume-version"
                      value={selectedVersion}
                      onChange={(event) => {
                        setSelectedVersion(event.target.value);
                        applicationKey.current = null;
                      }}
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
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
                  </div>
                ) : null}
                {!trackedApplication ? (
                  <Button
                    className="mt-3 w-full"
                    onClick={() => void startApplication()}
                    loading={startingApplication}
                  >
                    {t("jobs.detail.startAndTrack")}
                  </Button>
                ) : (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-sm font-medium text-emerald-900">
                      {t("jobs.detail.preparationSaved")}
                    </p>
                    <a
                      href={applicationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      {t("jobs.detail.continueOnSite")}
                    </a>
                    <Link
                      href={`/applications/${trackedApplication.id}`}
                      className="mt-3 block text-center text-sm font-medium text-emerald-900 underline"
                    >
                      {t("jobs.detail.viewTrackedApplication")}
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                {t("jobs.detail.noApplicationLink")}
              </div>
            )}
            <Button
              variant="secondary"
              className="mt-3 w-full"
              onClick={() => void toggleSave()}
              disabled={saving}
            >
              {saving
                ? t("jobs.detail.updating")
                : job.is_saved
                  ? t("jobs.detail.savedRemove")
                  : t("jobs.detail.saveJob")}
            </Button>
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block text-center text-sm font-medium text-slate-600 hover:text-slate-950 hover:underline"
              >
                {t("jobs.detail.viewOriginalSource")}
              </a>
            )}
          </div>
        </div>
        {actionError && (
          <div
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {actionError}
            {applicationUrl && (
              <a
                href={applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block font-semibold underline"
              >
                {t("jobs.detail.openWithoutTracking")}
              </a>
            )}
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            {t("jobs.detail.groundedRequirements")}
          </h2>
          <ul className="mt-4 space-y-3">
            {job.latest_snapshot.requirements.map((requirement) => (
              <li
                key={requirement.id}
                className="rounded-lg border border-slate-200 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {requirement.importance.toLowerCase()}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-slate-500">
                    {requirement.category.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {requirement.description}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {t("jobs.detail.requirementSource")} “
                  {requirement.source_text}”
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            {t("jobs.detail.originalDescription")}
          </h2>
          <p className="mt-4 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {job.latest_snapshot.raw_description}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              {t("jobs.detail.optionalEnhancement")}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              {t("jobs.detail.jobIntelligence")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {t("jobs.detail.intelligenceIntro")}
            </p>
          </div>
          <div className="w-full rounded-xl bg-white p-4 shadow-sm lg:max-w-md">
            <label
              className="text-sm font-medium text-slate-800"
              htmlFor="resume-version"
            >
              {t("jobs.detail.resumeForAnalysis")}
            </label>
            {versions.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">
                <Link
                  href="/resumes"
                  className="font-medium text-blue-700 underline"
                >
                  {t("jobs.detail.uploadResumeFirst")}
                </Link>{" "}
                {t("jobs.detail.beforeIntelligence")}
              </p>
            ) : (
              <>
                <select
                  id="resume-version"
                  value={selectedVersion}
                  onChange={(event) => setSelectedVersion(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                  className="mt-3 w-full"
                  onClick={() => void analyze()}
                  disabled={analyzing}
                >
                  {analyzing
                    ? t("jobs.detail.analyzing")
                    : analysis
                      ? t("jobs.detail.runNewAnalysis")
                      : t("jobs.detail.analyzeJob")}
                </Button>
              </>
            )}
          </div>
        </div>
        {analysisError && (
          <div
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {analysisError}
          </div>
        )}
      </section>

      {!analysis ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <h2 className="font-semibold text-slate-950">
            {t("jobs.detail.noAnalysisYet")}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {t("jobs.detail.noAnalysisHint")}
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              {t("jobs.detail.explainableRecommendation")}
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
              <h2 className="text-2xl font-semibold text-slate-950">
                {t(recommendationKey)}
              </h2>
              <p className="text-xs text-slate-500">
                {analysis.resume_name} · {t("common.version")}{" "}
                {analysis.resume_version_number} ·{" "}
                {t("jobs.detail.analysisVersion")} {analysis.analysis_version}
              </p>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {analysis.summary}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {t("jobs.detail.evidenceAlignmentNote")}
            </p>
          </section>

          <section
            className="grid gap-5 xl:grid-cols-2"
            aria-label={t("jobs.detail.intelligenceCategories")}
          >
            {groups.map((group) => {
              const matches = analysis.matches.filter(
                (match) => match.classification === group.key,
              );
              return (
                <div
                  key={group.key}
                  className={`rounded-2xl border p-5 ${group.style}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-950">
                      {group.title}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${group.badge}`}
                    >
                      {matches.length}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {group.description}
                  </p>
                  <div className="mt-4 space-y-3">
                    {matches.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-500">
                        {t("jobs.detail.noRequirementsInCategory")}
                      </p>
                    ) : (
                      matches.map((match) => (
                        <MatchCard key={match.id} match={match} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
