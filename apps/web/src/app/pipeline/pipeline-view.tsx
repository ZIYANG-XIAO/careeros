"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import { FocusPanel, type FocusTarget } from "@/components/focus-panel";
import { LoadErrorBanner } from "@/components/load-error-banner";
import { PipelineActionCenter } from "@/components/pipeline-action-center";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  createApplication,
  listApplications,
  listApplicationStatusHistory,
  listJobs,
  listResumes,
  listUpcomingApplicationActivities,
  updateApplicationStatus,
} from "@/lib/api";
import { downloadCsv, parseCsv } from "@/lib/csv";
import { applicationStatusLabel, useI18n } from "@/lib/i18n";
import {
  applicationsToCsvRows,
  closedApplications,
  EMPTY_PIPELINE_FILTERS,
  filterApplications,
  FUNNEL_MIN_SAMPLE,
  filterSavedJobs,
  groupByStage,
  groupStatusHistory,
  hasActiveFilters,
  isClosedStatus,
  parseApplicationImportRows,
  PIPELINE_STAGES,
  type PipelineFilters,
  savedColumnJobs,
  stageFunnel,
} from "@/lib/pipeline";
import { useDataFetch } from "@/lib/use-data-fetch";
import type {
  ApplicationActivity,
  ApplicationStatus,
  ApplicationStatusHistoryBulkEntry,
  ApplicationSummary,
  Job,
  ResumeSummary,
} from "@/lib/types";

import type { DragPayload, MoveTarget } from "./pipeline-card";
import { PipelineCard } from "./pipeline-card";
import { PipelineToolbar } from "./pipeline-toolbar";
import { ProgressRow, SavedProgressRow } from "./progress-row";
import { RecordApplicationPopover } from "./record-application-popover";
import { StageFunnel } from "./stage-funnel";

type PipelineView = "board" | "list" | "closed";

const FILTER_STAGES = new Set<string>(["SAVED", ...PIPELINE_STAGES]);

function filtersFromParams(params: URLSearchParams): PipelineFilters {
  const stage = params.get("stage") ?? "";
  return {
    ...EMPTY_PIPELINE_FILTERS,
    query: params.get("q") ?? "",
    stage: FILTER_STAGES.has(stage)
      ? (stage as PipelineFilters["stage"])
      : "ALL",
    attentionOnly: params.get("stalled") === "1",
  };
}

const EMPTY_COLUMN_KEY = {
  PREPARING: "pipeline.emptyColumn.PREPARING",
  APPLIED: "pipeline.emptyColumn.APPLIED",
  ASSESSMENT: "pipeline.emptyColumn.ASSESSMENT",
  INTERVIEW: "pipeline.emptyColumn.INTERVIEW",
  FINAL: "pipeline.emptyColumn.FINAL",
  OFFER: "pipeline.emptyColumn.OFFER",
} as const;

function historyEntry(
  application: ApplicationSummary,
  fromStatus: ApplicationStatus | null,
): ApplicationStatusHistoryBulkEntry {
  return {
    application_id: application.id,
    from_status: fromStatus,
    to_status: application.status,
    changed_at: application.status_updated_at,
  };
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

  const viewParam = searchParams.get("view");
  const view: PipelineView =
    viewParam === "closed" || searchParams.get("closed") === "1"
      ? "closed"
      : viewParam === "list"
        ? "list"
        : "board";
  const focusId = searchParams.get("focus");

  // Filters live in local state for instant typing and are mirrored into the
  // URL (q / stage / stalled) so a refresh or shared link keeps them.
  const [filters, setFilters] = useState<PipelineFilters>(() =>
    filtersFromParams(searchParams),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [pendingRecord, setPendingRecord] = useState<PendingRecord | null>(
    null,
  );
  const [recordSubmitting, setRecordSubmitting] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
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
    history: ApplicationStatusHistoryBulkEntry[];
    upcoming: ApplicationActivity[];
  };

  const fetchPipeline = useCallback(async (): Promise<PipelineData> => {
    const token = await getToken();
    if (!token) throw new Error("Missing authentication token");
    // History and upcoming activities enrich the page but are not required
    // to manage it, so their failure degrades to undated progress steps.
    const [applications, savedJobs, resumes, history, upcoming] =
      await Promise.all([
        listApplications(token),
        listJobs(token, { savedOnly: true }),
        listResumes(token),
        listApplicationStatusHistory(token).catch(() => []),
        listUpcomingApplicationActivities(token, 50).catch(() => []),
      ]);
    return { applications, savedJobs, resumes, history, upcoming };
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
    initialData: {
      applications: [],
      savedJobs: [],
      resumes: [],
      history: [],
      upcoming: [],
    },
    fetch: fetchPipeline,
    deps: [getToken, isLoaded, isSignedIn],
  });

  const { applications, savedJobs, resumes, history, upcoming } = data;

  const allSavedCards = useMemo(
    () => savedColumnJobs(savedJobs, applications),
    [savedJobs, applications],
  );
  const filteredApplications = useMemo(
    () => filterApplications(applications, filters),
    [applications, filters],
  );
  const savedCards = useMemo(
    () => filterSavedJobs(allSavedCards, filters),
    [allSavedCards, filters],
  );
  const stageGroups = useMemo(
    () => groupByStage(filteredApplications),
    [filteredApplications],
  );
  const closed = useMemo(
    () => closedApplications(filteredApplications),
    [filteredApplications],
  );
  const allClosedCount = useMemo(
    () => closedApplications(applications).length,
    [applications],
  );
  const openRows = useMemo(
    () => PIPELINE_STAGES.flatMap((stage) => stageGroups[stage]),
    [stageGroups],
  );
  const historyByApplication = useMemo(
    () => groupStatusHistory(history),
    [history],
  );
  const funnel = useMemo(
    () => stageFunnel(applications, historyByApplication),
    [applications, historyByApplication],
  );
  const resumeLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const resume of resumes) {
      for (const version of resume.versions) {
        labels.set(version.id, `${resume.name} v${version.version_number}`);
      }
    }
    return labels;
  }, [resumes]);
  const jobLocations = useMemo(
    () => new Map(savedJobs.map((job) => [job.id, job.location])),
    [savedJobs],
  );
  const nextActivity = useMemo(() => {
    const byApplication = new Map<string, ApplicationActivity>();
    for (const activity of upcoming) {
      if (!activity.scheduled_at) continue;
      const current = byApplication.get(activity.application_id);
      if (
        !current?.scheduled_at ||
        activity.scheduled_at < current.scheduled_at
      ) {
        byApplication.set(activity.application_id, activity);
      }
    }
    return byApplication;
  }, [upcoming]);

  const openCount = applications.filter(
    (application) => !isClosedStatus(application.status),
  ).length;
  const filtering = hasActiveFilters(filters);
  const totalCount = allSavedCards.length + applications.length;
  const shownCount = savedCards.length + filteredApplications.length;

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
        history:
          updated.status === previousStatus
            ? current.history
            : [...current.history, historyEntry(updated, previousStatus)],
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
        history: [...current.history, historyEntry(created, null)],
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
          history: [
            ...current.history,
            ...created.map((application) => historyEntry(application, null)),
          ],
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

  async function handleBulkMove(target: MoveTarget) {
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    for (const id of ids) {
      await commitMove(
        id,
        target as ApplicationStatus | "REJECTED" | "WITHDRAWN",
      );
    }
  }

  function toggleSelected(id: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function switchView(next: PipelineView) {
    setSelectedIds(new Set());
    pushQuery({ view: next === "board" ? null : next, closed: null });
  }

  function renderProgressRow(
    application: ApplicationSummary,
    selectable: boolean,
  ) {
    return (
      <ProgressRow
        key={application.id}
        application={application}
        history={historyByApplication.get(application.id) ?? []}
        location={
          application.job_id
            ? (jobLocations.get(application.job_id) ?? null)
            : null
        }
        resumeLabel={
          application.resume_version_id
            ? (resumeLabels.get(application.resume_version_id) ?? null)
            : null
        }
        upcoming={nextActivity.get(application.id) ?? null}
        selected={selectable ? selectedIds.has(application.id) : undefined}
        onSelectedChange={
          selectable
            ? (selected) => toggleSelected(application.id, selected)
            : undefined
        }
        onOpen={() => openFocus({ kind: "application", id: application.id })}
        onMove={(target) =>
          handleCardMove(
            "application",
            application.id,
            application.role,
            target,
          )
        }
      />
    );
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
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            {t("nav.applications")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {t("pipeline.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">
            {t("pipeline.intro")}
          </p>
        </header>

        <PipelineActionCenter
          applications={applications}
          onOpenApplication={(applicationId) =>
            openFocus({ kind: "application", id: applicationId })
          }
          onConfirmSubmitted={(applicationId) =>
            void commitMove(applicationId, "APPLIED")
          }
        />

        {applications.length > 0 && (
          // Collapsed until there is enough history for it to say something.
          <StageFunnel
            stages={funnel}
            defaultOpen={applications.length >= FUNNEL_MIN_SAMPLE}
          />
        )}

        <section
          aria-labelledby="pipeline-workspace-heading"
          className="space-y-4"
        >
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="pipeline-workspace-heading"
                className="text-lg font-semibold text-ink"
              >
                {t("pipeline.workspace.title")}
              </h2>
              <p className="mt-1 text-sm text-ink-2">
                <span className="font-semibold text-ink">
                  {t("pipeline.total", { count: totalCount })}
                </span>
                {" · "}
                {t("pipeline.workspace.intro")}
              </p>
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

          <nav
            aria-label={t("pipeline.sections")}
            className="flex flex-wrap gap-1 border-b border-border"
          >
            {(
              [
                [
                  "board",
                  t("pipeline.view.board"),
                  openCount + allSavedCards.length,
                ],
                [
                  "list",
                  t("pipeline.view.list"),
                  openCount + allSavedCards.length,
                ],
                ["closed", t("nav.closed"), allClosedCount],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                aria-current={view === key ? "page" : undefined}
                onClick={() => switchView(key)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
                  view === key
                    ? "border-accent text-accent"
                    : "border-transparent text-ink-3 hover:text-ink-2"
                }`}
              >
                {label}
                <span className="ml-1.5 rounded-full bg-sunken px-1.5 py-0.5 text-[11px] font-medium text-ink-3">
                  {count}
                </span>
              </button>
            ))}
          </nav>

          <PipelineToolbar
            filters={filters}
            onChange={(next) => {
              setFilters(next);
              setSelectedIds(new Set());
              pushQuery({
                q: next.query.trim() || null,
                stage: next.stage === "ALL" ? null : next.stage,
                stalled: next.attentionOnly ? "1" : null,
              });
            }}
            shown={shownCount}
            total={totalCount}
          />

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

          {moveError && (
            <div
              role="alert"
              className="rounded-lg border border-evidence-gap-border bg-evidence-gap-bg p-3 text-sm text-[#6F3627]"
            >
              {moveError}
            </div>
          )}

          {view === "board" && (
            <div className="overflow-x-auto pb-2">
              <div
                className={`grid min-w-max gap-4 ${isRefreshing ? "opacity-60" : ""}`}
                style={{
                  gridTemplateColumns: `repeat(${1 + PIPELINE_STAGES.length}, minmax(220px, 1fr))`,
                }}
              >
                <section className="flex flex-col gap-2 rounded-lg border border-dashed border-border-strong bg-rail p-2">
                  <p className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-3">
                    {t("pipeline.column.saved")} · {savedCards.length}
                  </p>
                  <div className="flex flex-col gap-2">
                    {savedCards.map((job) => (
                      <PipelineCard
                        key={job.id}
                        card={{ kind: "saved", job }}
                        dragging={
                          dragging?.kind === "saved" &&
                          dragging.jobId === job.id
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
                    className={`flex flex-col gap-2 rounded-lg border bg-rail p-2 transition-colors ${
                      dragging
                        ? "border-accent-drop bg-accent-tint"
                        : "border-border"
                    }`}
                  >
                    <p className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-3">
                      {applicationStatusLabel(stage, t)} ·{" "}
                      {stageGroups[stage].length}
                    </p>
                    <div className="flex flex-col gap-2">
                      {stageGroups[stage].length === 0 && (
                        <p className="rounded-md border border-dashed border-border p-3 text-center text-xs leading-relaxed text-ink-3">
                          {filtering
                            ? t("pipeline.emptyFiltered")
                            : t(
                                EMPTY_COLUMN_KEY[
                                  stage as keyof typeof EMPTY_COLUMN_KEY
                                ],
                              )}
                        </p>
                      )}
                      {stageGroups[stage].map((application) => (
                        <PipelineCard
                          key={application.id}
                          card={{ kind: "application", application }}
                          resumeLabel={
                            application.resume_version_id
                              ? (resumeLabels.get(
                                  application.resume_version_id,
                                ) ?? null)
                              : null
                          }
                          dragging={
                            dragging?.kind === "application" &&
                            dragging.applicationId === application.id
                          }
                          onOpen={() =>
                            openFocus({
                              kind: "application",
                              id: application.id,
                            })
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
            </div>
          )}

          {view === "list" && (
            <div className={`space-y-3 ${isRefreshing ? "opacity-60" : ""}`}>
              {openRows.length > 0 && (
                <div
                  className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                    selectedIds.size > 0
                      ? "border-accent-soft-border bg-accent-tint"
                      : "border-transparent"
                  }`}
                >
                  <label className="flex items-center gap-2 text-ink-2">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size > 0 &&
                        openRows.every((row) => selectedIds.has(row.id))
                      }
                      onChange={(event) =>
                        setSelectedIds(
                          event.target.checked
                            ? new Set(openRows.map((row) => row.id))
                            : new Set(),
                        )
                      }
                      className="h-4 w-4 accent-[var(--color-accent)]"
                    />
                    {selectedIds.size > 0
                      ? t("pipeline.bulk.selected", { count: selectedIds.size })
                      : t("pipeline.list.selectAll")}
                  </label>
                  {selectedIds.size > 0 && (
                    <>
                      <select
                        aria-label={t("pipeline.bulk.moveTo")}
                        value=""
                        onChange={(event) => {
                          if (event.target.value)
                            void handleBulkMove(
                              event.target.value as MoveTarget,
                            );
                        }}
                        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink-2"
                      >
                        <option value="">{t("pipeline.bulk.moveTo")}</option>
                        {[...PIPELINE_STAGES, "REJECTED", "WITHDRAWN"].map(
                          (option) => (
                            <option key={option} value={option}>
                              {applicationStatusLabel(
                                option as ApplicationStatus,
                                t,
                              )}
                            </option>
                          ),
                        )}
                      </select>
                      <button
                        type="button"
                        onClick={() => setSelectedIds(new Set())}
                        className="text-xs font-semibold text-ink-3 hover:text-ink-2"
                      >
                        {t("pipeline.bulk.clear")}
                      </button>
                    </>
                  )}
                </div>
              )}
              {openRows.length === 0 && savedCards.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-ink-3">
                  {t("pipeline.emptyFiltered")}
                </p>
              )}
              <ul className="space-y-2">
                {openRows.map((application) =>
                  renderProgressRow(application, true),
                )}
                {savedCards.map((job) => (
                  <SavedProgressRow
                    key={job.id}
                    job={job}
                    onOpen={() => openFocus({ kind: "job", id: job.id })}
                    onStart={() =>
                      requestRecord(job.id, job.title, "PREPARING")
                    }
                  />
                ))}
              </ul>
            </div>
          )}

          {view === "closed" && (
            <section
              aria-labelledby="pipeline-closed-heading"
              className="space-y-3"
            >
              <h3
                id="pipeline-closed-heading"
                className="text-sm font-semibold text-ink-2"
              >
                {t("pipeline.closed.title")}
              </h3>
              {closed.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-ink-3">
                  {filtering
                    ? t("pipeline.emptyFiltered")
                    : t("pipeline.closed.empty")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {closed.map((application) =>
                    renderProgressRow(application, false),
                  )}
                </ul>
              )}
            </section>
          )}

          {view !== "closed" && allClosedCount > 0 && (
            <button
              type="button"
              onClick={() => pushQuery({ closed: "1" })}
              className="text-sm font-semibold text-ink-3 hover:text-ink-2"
            >
              {t("pipeline.showLane")} ({allClosedCount})
            </button>
          )}
        </section>
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
          onDeleted={(deleted) => {
            setData((current) => ({
              ...current,
              applications:
                deleted.kind === "application"
                  ? current.applications.filter((app) => app.id !== deleted.id)
                  : current.applications.map((app) =>
                      app.job_id === deleted.id
                        ? { ...app, job_id: null }
                        : app,
                    ),
              savedJobs: current.savedJobs.filter(
                (job) => job.id !== deleted.id,
              ),
            }));
            closeFocus();
          }}
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
