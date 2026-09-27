"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import { FocusPanel, type FocusTarget } from "@/components/focus-panel";
import { LoadErrorBanner } from "@/components/load-error-banner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  createApplication,
  listApplications,
  listJobs,
  listResumes,
  updateApplicationStatus,
} from "@/lib/api";
import { downloadCsv, parseCsv } from "@/lib/csv";
import { applicationStatusLabel, useI18n } from "@/lib/i18n";
import {
  applicationsToCsvRows,
  closedApplications,
  groupByStage,
  needsYouApplications,
  parseApplicationImportRows,
  PIPELINE_STAGES,
  savedColumnJobs,
} from "@/lib/pipeline";
import { useDataFetch } from "@/lib/use-data-fetch";
import type {
  ApplicationStatus,
  ApplicationSummary,
  Job,
  ResumeSummary,
} from "@/lib/types";

import type { DragPayload, MoveTarget } from "./pipeline-card";
import { PipelineCard } from "./pipeline-card";
import { RecordApplicationPopover } from "./record-application-popover";

const DISMISS_KEY = "careeros.pipeline.needsYouDismissedUntil";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function isDismissedToday(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === todayKey();
  } catch {
    return false;
  }
}

type PendingRecord = {
  jobId: string;
  title: string;
  targetStage: ApplicationStatus;
};

export default function PipelineView() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const view = searchParams.get("view") === "list" ? "list" : "board";
  const showClosed = searchParams.get("closed") === "1";
  const focusId = searchParams.get("focus");

  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [pendingRecord, setPendingRecord] = useState<PendingRecord | null>(
    null,
  );
  const [recordSubmitting, setRecordSubmitting] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    imported: number;
    skipped: string[];
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  type PipelineData = {
    applications: ApplicationSummary[];
    savedJobs: Job[];
    resumes: ResumeSummary[];
  };

  const fetchPipeline = useCallback(async (): Promise<PipelineData> => {
    const token = await getToken();
    if (!token) throw new Error("Missing authentication token");
    const [applications, savedJobs, resumes] = await Promise.all([
      listApplications(token),
      listJobs(token, { savedOnly: true }),
      listResumes(token),
    ]);
    return { applications, savedJobs, resumes };
  }, [getToken]);

  const {
    data,
    setData,
    isInitialLoading,
    isRefreshing,
    loadError,
    refreshError,
    retry,
  } = useDataFetch<PipelineData>({
    enabled: isLoaded && isSignedIn,
    resetKey: userId ?? undefined,
    initialData: { applications: [], savedJobs: [], resumes: [] },
    fetch: fetchPipeline,
    deps: [getToken, isLoaded, isSignedIn],
  });

  const { applications, savedJobs, resumes } = data;

  const savedCards = useMemo(
    () => savedColumnJobs(savedJobs, applications),
    [savedJobs, applications],
  );
  const stageGroups = useMemo(() => groupByStage(applications), [applications]);
  const closed = useMemo(
    () => closedApplications(applications),
    [applications],
  );
  const needsYou = useMemo(
    () => needsYouApplications(applications),
    [applications],
  );

  function pushQuery(next: Record<string, string | null>, addHistory = false) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    if (addHistory) router.push(url);
    else router.replace(url);
  }

  function openFocus(target: FocusTarget) {
    pushQuery({ focus: target.id }, true);
  }

  function closeFocus() {
    pushQuery({ focus: null });
  }

  const focusTarget: FocusTarget | null = focusId
    ? savedCards.some((job) => job.id === focusId)
      ? { kind: "job", id: focusId }
      : { kind: "application", id: focusId }
    : null;

  async function commitMove(
    applicationId: string,
    target: ApplicationStatus | "REJECTED" | "WITHDRAWN",
  ) {
    const application = applications.find((app) => app.id === applicationId);
    if (!application) return;
    const previousStatus = application.status;
    setData((current) => ({
      ...current,
      applications: current.applications.map((app) =>
        app.id === applicationId ? { ...app, status: target } : app,
      ),
    }));
    setMoveError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const updated = await updateApplicationStatus(
        token,
        applicationId,
        target,
        crypto.randomUUID(),
      );
      setData((current) => ({
        ...current,
        applications: current.applications.map((app) =>
          app.id === applicationId ? updated : app,
        ),
      }));
    } catch {
      setData((current) => ({
        ...current,
        applications: current.applications.map((app) =>
          app.id === applicationId ? { ...app, status: previousStatus } : app,
        ),
      }));
      setMoveError(
        t("error.stageUpdate", {
          stage: applicationStatusLabel(previousStatus, t),
        }),
      );
    }
  }

  function requestRecord(
    jobId: string,
    title: string,
    targetStage: ApplicationStatus,
  ) {
    setPendingRecord({ jobId, title, targetStage });
  }

  async function confirmRecord(resumeVersionId: string | null) {
    if (!pendingRecord) return;
    setRecordSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const created = await createApplication(token, {
        idempotency_key: crypto.randomUUID(),
        origin: "CAREEROS_JOB",
        job_id: pendingRecord.jobId,
        resume_version_id: resumeVersionId,
        status: pendingRecord.targetStage,
        answers: [],
      });
      setData((current) => ({
        ...current,
        applications: [...current.applications, created],
      }));
      setPendingRecord(null);
    } catch {
      setMoveError(t("error.recordFromSaved"));
    } finally {
      setRecordSubmitting(false);
    }
  }

  function handleExportCsv() {
    downloadCsv(
      "careeros-applications.csv",
      applicationsToCsvRows(applications),
    );
  }

  async function handleImportFile(file: File) {
    setImportError(null);
    setImportSummary(null);
    setImporting(true);
    try {
      const text = await file.text();
      const parsedRows = parseApplicationImportRows(parseCsv(text));
      const skipped: string[] = [];
      const created: ApplicationSummary[] = [];
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");

      for (const parsed of parsedRows) {
        if (!parsed.ok) {
          skipped.push(
            t("pipeline.importSkipReason.missingCompanyRole", {
              row: parsed.row,
            }),
          );
          continue;
        }
        try {
          const application = await createApplication(token, {
            idempotency_key: crypto.randomUUID(),
            origin: "MANUAL",
            answers: [],
            ...parsed.payload,
          });
          created.push(application);
        } catch {
          skipped.push(
            t("pipeline.importSkipReason.createFailed", { row: parsed.row }),
          );
        }
      }

      if (created.length > 0) {
        setData((current) => ({
          ...current,
          applications: [...current.applications, ...created],
        }));
      }
      setImportSummary({ imported: created.length, skipped });
    } catch {
      setImportError(t("pipeline.importError"));
    } finally {
      setImporting(false);
    }
  }

  function handleColumnDrop(stage: ApplicationStatus) {
    if (!dragging) return;
    if (dragging.kind === "saved") {
      const job = savedCards.find((item) => item.id === dragging.jobId);
      requestRecord(dragging.jobId, job?.title ?? dragging.title, stage);
    } else if (dragging.kind === "application" && dragging.from !== stage) {
      void commitMove(dragging.applicationId, stage);
    }
    setDragging(null);
  }

  function handleCardMove(
    cardKind: "saved" | "application",
    id: string,
    title: string,
    target: MoveTarget,
  ) {
    if (cardKind === "saved") {
      requestRecord(id, title, target as ApplicationStatus);
    } else {
      void commitMove(
        id,
        target as ApplicationStatus | "REJECTED" | "WITHDRAWN",
      );
    }
  }

  if (!isLoaded || (isInitialLoading && isSignedIn)) return <Spinner />;
  if (!isSignedIn) {
    return (
      <p className="text-sm text-ink-2">{t("applications.signInRequired")}</p>
    );
  }

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">
              {t("nav.pipeline")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-ink">
              {t("pipeline.title")}
            </h1>
            <p className="mt-1 text-sm text-ink-2">{t("pipeline.intro")}</p>
          </div>
          <div className="flex overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              onClick={() => pushQuery({ view: null })}
              className={`px-3 py-1.5 text-sm font-semibold ${
                view === "board"
                  ? "bg-accent text-white"
                  : "bg-surface text-ink-2 hover:bg-sunken"
              }`}
            >
              {t("pipeline.view.board")}
            </button>
            <button
              type="button"
              onClick={() => pushQuery({ view: "list" })}
              className={`px-3 py-1.5 text-sm font-semibold ${
                view === "list"
                  ? "bg-accent text-white"
                  : "bg-surface text-ink-2 hover:bg-sunken"
              }`}
            >
              {t("pipeline.view.list")}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void handleImportFile(file);
              }}
            />
            <Button
              variant="secondary"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? t("pipeline.importing") : t("pipeline.importCsv")}
            </Button>
            <Button variant="secondary" onClick={handleExportCsv}>
              {t("pipeline.exportCsv")}
            </Button>
          </div>
        </header>

        {importError && (
          <div
            role="alert"
            className="rounded-lg border border-evidence-gap-border bg-evidence-gap-bg p-3 text-sm text-[#6F3627]"
          >
            {importError}
          </div>
        )}
        {importSummary && (
          <div
            role="status"
            className="rounded-lg border border-border bg-rail p-3 text-sm text-ink-2"
          >
            <p>
              {importSummary.skipped.length > 0
                ? t("pipeline.importSummary", {
                    imported: importSummary.imported,
                    skipped: importSummary.skipped.length,
                  })
                : t("pipeline.importSummaryAllOk", {
                    imported: importSummary.imported,
                  })}
            </p>
            {importSummary.skipped.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-xs text-ink-3">
                {importSummary.skipped.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
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
        {loadError && (
          <LoadErrorBanner
            error={loadError}
            onRetry={retry}
            retryLabel={t("errors.retry")}
            t={t}
          />
        )}

        {needsYou.length > 0 && !dismissed && !isDismissedToday() && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-status-assessment-bg bg-status-assessment-bg/40 p-3">
            <p className="text-sm text-ink">
              {needsYou.length === 1
                ? t("pipeline.needsYou.one")
                : t("pipeline.needsYou.many", { count: needsYou.length })}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => pushQuery({ view: "list", stage: "PREPARING" })}
                className="text-sm font-semibold text-accent hover:underline"
              >
                {t("pipeline.reviewBoth")}
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    window.localStorage.setItem(DISMISS_KEY, todayKey());
                  } catch {
                    // ignore storage failures
                  }
                  setDismissed(true);
                }}
                className="text-sm text-ink-3 hover:text-ink-2"
              >
                {t("pipeline.dismissToday")}
              </button>
            </div>
          </div>
        )}

        {moveError && (
          <div
            role="alert"
            className="rounded-lg border border-evidence-gap-border bg-evidence-gap-bg p-3 text-sm text-[#6F3627]"
          >
            {moveError}
          </div>
        )}

        {view === "board" ? (
          <div
            className={`grid gap-4 ${isRefreshing ? "opacity-60" : ""}`}
            style={{
              gridTemplateColumns: `repeat(${1 + PIPELINE_STAGES.length}, minmax(220px, 1fr))`,
            }}
          >
            <section
              onDragOver={undefined}
              className="flex flex-col gap-2 rounded-lg border border-dashed border-border-strong bg-rail p-2"
            >
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-3">
                {t("pipeline.column.saved")} · {savedCards.length}
              </p>
              <div className="flex flex-col gap-2">
                {savedCards.map((job) => (
                  <PipelineCard
                    key={job.id}
                    card={{ kind: "saved", job }}
                    dragging={
                      dragging?.kind === "saved" && dragging.jobId === job.id
                    }
                    onOpen={() => openFocus({ kind: "job", id: job.id })}
                    onDragStart={setDragging}
                    onDragEnd={() => setDragging(null)}
                    onMove={(target) =>
                      handleCardMove("saved", job.id, job.title, target)
                    }
                  />
                ))}
              </div>
              <p className="px-1 text-[11px] leading-relaxed text-ink-3">
                {t("pipeline.savedFoot")}
              </p>
            </section>

            {PIPELINE_STAGES.map((stage) => (
              <section
                key={stage}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleColumnDrop(stage)}
                className="flex flex-col gap-2 rounded-lg border border-border bg-rail p-2"
              >
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-3">
                  {applicationStatusLabel(stage, t)} ·{" "}
                  {stageGroups[stage].length}
                </p>
                <div className="flex flex-col gap-2">
                  {stageGroups[stage].length === 0 && (
                    <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-ink-3">
                      {t("pipeline.emptyColumn")}
                    </p>
                  )}
                  {stageGroups[stage].map((application) => (
                    <PipelineCard
                      key={application.id}
                      card={{ kind: "application", application }}
                      dragging={
                        dragging?.kind === "application" &&
                        dragging.applicationId === application.id
                      }
                      onOpen={() =>
                        openFocus({ kind: "application", id: application.id })
                      }
                      onDragStart={setDragging}
                      onDragEnd={() => setDragging(null)}
                      onMove={(target) =>
                        handleCardMove(
                          "application",
                          application.id,
                          application.role,
                          target,
                        )
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className={`space-y-3 ${isRefreshing ? "opacity-60" : ""}`}>
            <p className="text-xs text-ink-3">{t("pipeline.lifecycleFoot")}</p>
            {savedCards.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => openFocus({ kind: "job", id: job.id })}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-surface p-3 text-left hover:border-accent-soft-border"
              >
                <span>
                  <span className="block text-xs font-semibold text-ink-2">
                    {job.company}
                  </span>
                  <span className="block text-sm font-semibold text-ink">
                    {job.title}
                  </span>
                </span>
                <span className="rounded-full bg-sunken px-2 py-1 text-xs font-semibold text-ink-2">
                  {t("pipeline.column.saved")}
                </span>
              </button>
            ))}
            {PIPELINE_STAGES.flatMap((stage) => stageGroups[stage]).map(
              (application) => (
                <button
                  key={application.id}
                  type="button"
                  onClick={() =>
                    openFocus({ kind: "application", id: application.id })
                  }
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-surface p-3 text-left hover:border-accent-soft-border"
                >
                  <span>
                    <span className="block text-xs font-semibold text-ink-2">
                      {application.company}
                    </span>
                    <span className="block text-sm font-semibold text-ink">
                      {application.role}
                    </span>
                  </span>
                  <span className="rounded-full bg-status-applied-bg px-2 py-1 text-xs font-semibold text-status-applied-ink">
                    {applicationStatusLabel(application.status, t)}
                  </span>
                </button>
              ),
            )}
          </div>
        )}

        {closed.length > 0 && (
          <section>
            {!showClosed ? (
              <button
                type="button"
                onClick={() => pushQuery({ closed: "1" })}
                className="text-sm font-semibold text-ink-3 hover:text-ink-2"
              >
                {t("pipeline.showLane")} ({closed.length})
              </button>
            ) : (
              <div className="rounded-lg border border-dashed border-border-strong bg-closed-row p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
                  {t("nav.closed")}
                </p>
                <div className="flex flex-col gap-2">
                  {closed.map((application) => (
                    <button
                      key={application.id}
                      type="button"
                      onClick={() =>
                        openFocus({ kind: "application", id: application.id })
                      }
                      className="flex items-center justify-between rounded-md border border-dashed border-border-strong bg-surface px-3 py-2 text-left text-sm"
                    >
                      <span className="text-ink-2">
                        {application.company} · {application.role}
                      </span>
                      <span className="text-xs text-ink-3">
                        {applicationStatusLabel(application.status, t)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {focusTarget && (
        <FocusPanel
          target={focusTarget}
          onClose={closeFocus}
          onApplicationChanged={(updated) =>
            setData((current) => ({
              ...current,
              applications: current.applications.map((app) =>
                app.id === updated.id ? updated : app,
              ),
            }))
          }
          onJobChanged={(updated) =>
            setData((current) => ({
              ...current,
              savedJobs: current.savedJobs.map((job) =>
                job.id === updated.id ? updated : job,
              ),
            }))
          }
        />
      )}

      {pendingRecord && (
        <RecordApplicationPopover
          open={Boolean(pendingRecord)}
          jobTitle={pendingRecord.title}
          targetStage={pendingRecord.targetStage}
          resumes={resumes}
          submitting={recordSubmitting}
          onCancel={() => setPendingRecord(null)}
          onConfirm={(resumeVersionId) => void confirmRecord(resumeVersionId)}
        />
      )}
    </div>
  );
}
