import {
  confirmedApplicationAnswers,
  initialApplicationFields,
  selectedApplicationFields,
  shouldShowApplicationMemory,
} from "../popup/application-memory";
import { answerCopy } from "../popup/answer-copy";
import { detectionCopy } from "../popup/detection-copy";
import { fillCopy } from "../popup/fill-copy";
import { approvedFillCount, buildFillPlan } from "../popup/fill-plan";
import {
  attachResultMessage,
  clipDraftProblem,
  resumeUploadFieldId,
  savedAnswersSummary,
} from "../popup/tool-copy";
import type {
  AnswerResolution,
  ApplicationPageContext,
  AttachResumeResult,
  AuthStatus,
  ClippedJob,
  ExtensionResponse,
  FillExecutionResult,
  PageDetection,
  JobDraft,
  PopupRequest,
  SavedReusableAnswers,
  TrackedApplication,
  TypedCustomAnswer,
} from "../shared/messages";
import { fillButtonLabel, t } from "../shared/i18n";
import { captureCustomAnswers } from "./answer-capture";
import { extractJobDraft } from "./job-extraction";

const HOST_ID = "careeros-assistant-host";
const Z_INDEX = 2147483640;
const STORAGE_EXPANDED_KEY = "careeros_assistant_panel_expanded";
const URL_POLL_INTERVAL_MS = 500;

const STYLES = `
:host, * { box-sizing: border-box; }
.root {
  all: initial;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color: #0f172a;
}
.launcher {
  position: fixed;
  right: 20px;
  bottom: 72px;
  z-index: ${Z_INDEX};
  width: 52px;
  height: 52px;
  border: none;
  border-radius: 999px;
  background: #0f172a;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
}
.launcher:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.launcher svg { width: 24px; height: 24px; }
.panel {
  position: fixed;
  right: 20px;
  bottom: 136px;
  z-index: ${Z_INDEX};
  width: min(350px, calc(100vw - 32px));
  max-height: min(500px, calc(100vh - 160px));
  overflow: auto;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
  display: none;
  flex-direction: column;
}
.panel.open { display: flex; }
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}
.header strong { font-size: 15px; }
.close-btn {
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  border-radius: 6px;
  padding: 4px 8px;
}
.close-btn:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.section {
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
}
.section:last-child { border-bottom: none; }
.eyebrow {
  display: block;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #64748b;
  margin-bottom: 4px;
}
.section h2 {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
}
.section p {
  margin: 0;
  color: #475569;
  font-size: 13px;
}
.status-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #cbd5e1;
  margin-top: 4px;
  flex-shrink: 0;
}
.status-dot.connected { background: #16a34a; }
.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
}
button.primary, button.secondary {
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
button.primary {
  border: none;
  background: #0f172a;
  color: #fff;
}
button.secondary {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #0f172a;
}
button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
button:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.memory-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}
.memory-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #334155;
}
.memory-form input,
.memory-form select {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 8px;
  font-size: 13px;
}
.memory-form .memory-choice {
  flex-direction: row;
  align-items: flex-start;
}
.memory-note, .memory-error {
  font-size: 12px;
  color: #64748b;
}
.memory-error { color: #b91c1c; }
.footer-note {
  padding: 10px 14px 12px;
  font-size: 12px;
  color: #64748b;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}
@media (max-width: 480px) {
  .launcher { right: 12px; bottom: 64px; }
  .panel { right: 12px; bottom: 124px; width: calc(100vw - 24px); }
}
`;

type LoadState<T> =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready"; value: T }
  | { state: "error"; message: string };

type ToolClipState =
  | { state: "idle" }
  | { state: "editing"; draft: JobDraft; error: string | null }
  | { state: "saving"; draft: JobDraft }
  | { state: "saved"; job: ClippedJob };
type ToolAnswersState =
  | { state: "idle" }
  | {
      state: "choosing" | "saving";
      items: TypedCustomAnswer[];
      selected: Set<string>;
    }
  | { state: "done"; message: string };
type ToolAttachState =
  | { state: "idle" }
  | { state: "attaching" }
  | { state: "done"; message: string };

export interface AssistantHandle {
  destroy: () => void;
  isPanelOpen: () => boolean;
}

let activeHandle: AssistantHandle | null = null;

async function sendBackground<T>(
  request: PopupRequest,
): Promise<ExtensionResponse<T>> {
  return chrome.runtime.sendMessage(request) as Promise<ExtensionResponse<T>>;
}

function createLogoSvg(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const circle = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle",
  );
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "12");
  circle.setAttribute("r", "9");
  circle.setAttribute("fill", "currentColor");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M8 12h8M12 8v8");
  path.setAttribute("stroke", "#0f172a");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  svg.append(circle, path);
  return svg;
}

/**
 * Multi-step single-page applications (notably Workday) swap the form without
 * changing the URL. The visible step heading identifies the step, so a change
 * is treated like navigation and earlier inspection results are discarded.
 */
export function applicationStepSignature(doc: Document): string {
  const heading = doc.querySelector(
    "[data-automation-id='pageHeaderText'], [data-automation-id='progressBarActiveStep']",
  );
  return heading?.textContent?.replace(/\s+/g, " ").trim().slice(0, 200) ?? "";
}

function setText(element: HTMLElement, text: string): void {
  element.textContent = text;
}

export function isAssistantMounted(): boolean {
  return activeHandle !== null;
}

export function mountAssistant(): AssistantHandle {
  if (activeHandle) return activeHandle;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-careeros-assistant", "true");
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = STYLES;
  const root = document.createElement("div");
  root.className = "root";

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "launcher";
  launcher.setAttribute("aria-label", t("Open CareerOS assistant"));
  launcher.setAttribute("aria-expanded", "false");
  launcher.setAttribute("aria-controls", "careeros-assistant-panel");
  launcher.append(createLogoSvg());

  const panel = document.createElement("section");
  panel.id = "careeros-assistant-panel";
  panel.className = "panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", t("CareerOS application assistant"));
  panel.setAttribute("aria-live", "polite");

  shadow.append(style, root);
  root.append(launcher, panel);
  document.documentElement.append(host);

  const state = {
    panelOpen: false,
    auth: { state: "loading" } as LoadState<AuthStatus>,
    detection: { state: "idle" } as LoadState<PageDetection>,
    answers: null as LoadState<AnswerResolution> | null,
    fillResult: null as LoadState<FillExecutionResult> | null,
    applicationContext: null as LoadState<ApplicationPageContext> | null,
    company: "",
    role: "",
    resumeVersionId: "",
    useTrackedApplication: false,
    preparingApplication: false,
    recording: false,
    recordError: null as string | null,
    recordedApplication: null as TrackedApplication | null,
    prepareKey: crypto.randomUUID(),
    recordKey: crypto.randomUUID(),
    lastUrl: window.location.href,
    lastStep: applicationStepSignature(document),
    navigationGeneration: 0,
    clip: { state: "idle" } as ToolClipState,
    savedAnswers: { state: "idle" } as ToolAnswersState,
    attach: { state: "idle" } as ToolAttachState,
  };

  let urlPollTimer: ReturnType<typeof setInterval> | null = null;
  let onPopState: (() => void) | null = null;
  let onHashChange: (() => void) | null = null;
  let onKeyDown: ((event: Event) => void) | null = null;

  function isCurrentGeneration(generation: number): boolean {
    return state.navigationGeneration === generation;
  }

  function clearStaleFormState(): void {
    state.clip = { state: "idle" };
    state.savedAnswers = { state: "idle" };
    state.attach = { state: "idle" };
    state.detection = { state: "idle" };
    state.answers = null;
    state.fillResult = null;
    state.applicationContext = null;
    state.recordedApplication = null;
    state.recordError = null;
    state.preparingApplication = false;
    state.recording = false;
    render();
  }

  function handleUrlChange(): void {
    const nextUrl = window.location.href;
    const nextStep = applicationStepSignature(document);
    if (nextUrl === state.lastUrl && nextStep === state.lastStep) return;
    state.lastUrl = nextUrl;
    state.lastStep = nextStep;
    state.navigationGeneration += 1;
    clearStaleFormState();
  }

  function startUrlWatch(): void {
    onPopState = () => handleUrlChange();
    onHashChange = () => handleUrlChange();
    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onHashChange);
    urlPollTimer = setInterval(handleUrlChange, URL_POLL_INTERVAL_MS);
  }

  function stopUrlWatch(): void {
    if (urlPollTimer) {
      clearInterval(urlPollTimer);
      urlPollTimer = null;
    }
    if (onPopState) window.removeEventListener("popstate", onPopState);
    if (onHashChange) window.removeEventListener("hashchange", onHashChange);
    onPopState = null;
    onHashChange = null;
  }

  function setPanelOpen(open: boolean, restoreFocus = false): void {
    state.panelOpen = open;
    panel.classList.toggle("open", open);
    launcher.setAttribute("aria-expanded", open ? "true" : "false");
    launcher.setAttribute(
      "aria-label",
      open ? t("Close CareerOS assistant") : t("Open CareerOS assistant"),
    );
    void chrome.storage.local.set({ [STORAGE_EXPANDED_KEY]: open });
    if (!open && restoreFocus) launcher.focus();
    render();
  }

  async function loadExpandedPreference(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(STORAGE_EXPANDED_KEY);
      const expanded = stored[STORAGE_EXPANDED_KEY] === true;
      if (expanded) setPanelOpen(true);
    } catch {
      // Ignore storage failures; default stays collapsed.
    }
  }

  async function inspectPage(): Promise<void> {
    const capturedGeneration = state.navigationGeneration;
    state.detection = { state: "loading" };
    state.answers = null;
    state.fillResult = null;
    render();

    try {
      const response = await sendBackground<PageDetection>({
        type: "CAREEROS_DETECT_ACTIVE_PAGE",
      });
      if (!isCurrentGeneration(capturedGeneration)) return;
      if (!response.ok) {
        state.detection = {
          state: "error",
          message:
            response.error === "UNSUPPORTED_PAGE"
              ? t("Open a normal web page to use CareerOS.")
              : t("This page could not be inspected."),
        };
        render();
        return;
      }

      state.detection = { state: "ready", value: response.data };
      if (response.data.status === "UNSUPPORTED_PAGE") {
        render();
        return;
      }

      const isApplicationPage = response.data.status === "APPLICATION_PAGE";
      let selectedResumeVersionId: string | null = null;
      let market: "UNKNOWN" | "NORTH_AMERICA" | "CHINA" = "UNKNOWN";

      if (isApplicationPage) {
        state.applicationContext = { state: "loading" };
        render();
        try {
          const contextResponse = await sendBackground<ApplicationPageContext>({
            type: "CAREEROS_GET_APPLICATION_CONTEXT",
          });
          if (!isCurrentGeneration(capturedGeneration)) return;
          if (contextResponse.ok) {
            const shouldShow = shouldShowApplicationMemory(
              response.data.status,
              contextResponse.data,
            );
            if (shouldShow) {
              const initial = initialApplicationFields(contextResponse.data);
              selectedResumeVersionId = initial.resumeVersionId || null;
              market = contextResponse.data.application?.market ?? "UNKNOWN";
              state.company = initial.company;
              state.role = initial.role;
              state.resumeVersionId = initial.resumeVersionId;
              state.useTrackedApplication =
                contextResponse.data.matchKind === "EXACT_URL";
              state.applicationContext = {
                state: "ready",
                value: contextResponse.data,
              };
              if (
                contextResponse.data.application &&
                contextResponse.data.application.status !== "PREPARING"
              ) {
                state.recordedApplication = contextResponse.data.application;
              }
            } else {
              state.applicationContext = { state: "idle" };
            }
          } else if (isApplicationPage) {
            state.applicationContext = {
              state: "error",
              message:
                contextResponse.error === "UNAUTHENTICATED"
                  ? t("Sign in to record this application.")
                  : t("Application context is unavailable."),
            };
          }
        } catch {
          if (!isCurrentGeneration(capturedGeneration)) return;
          if (isApplicationPage) {
            state.applicationContext = {
              state: "error",
              message: t("Application context is unavailable."),
            };
          }
        }
      }

      if (!isApplicationPage) {
        render();
        return;
      }

      const fields = response.data.forms
        .flatMap((form) => form.fields)
        .slice(0, 200)
        .map((field) => ({
          fieldId: field.id,
          canonicalKey: field.canonicalKey,
          question: field.question,
          controlType: field.controlType,
          required: field.required,
          mappingConfidence: field.confidence,
          options: field.options.map((option) => option.label),
        }));

      if (fields.length === 0) {
        render();
        return;
      }

      state.answers = { state: "loading" };
      render();
      try {
        const answerResponse = await sendBackground<AnswerResolution>({
          type: "CAREEROS_RESOLVE_ANSWERS",
          fields,
          selectedResumeVersionId,
          market,
          formLocale: response.data.formLocale ?? null,
        });
        if (!isCurrentGeneration(capturedGeneration)) return;
        state.answers = answerResponse.ok
          ? { state: "ready", value: answerResponse.data }
          : {
              state: "error",
              message:
                answerResponse.error === "UNAUTHENTICATED"
                  ? t("Sign in to preview safe answers.")
                  : t("Answer decisions are unavailable."),
            };
      } catch {
        if (!isCurrentGeneration(capturedGeneration)) return;
        state.answers = {
          state: "error",
          message: t("Answer decisions are unavailable."),
        };
      }
    } catch {
      if (!isCurrentGeneration(capturedGeneration)) return;
      state.detection = {
        state: "error",
        message: t("This page could not be inspected."),
      };
    }
    if (!isCurrentGeneration(capturedGeneration)) return;
    render();
  }

  async function resolveForResume(nextResumeVersionId: string): Promise<void> {
    if (
      state.detection.state !== "ready" ||
      state.detection.value.status !== "APPLICATION_PAGE"
    ) {
      return;
    }
    const fields = state.detection.value.forms
      .flatMap((form) => form.fields)
      .slice(0, 200)
      .map((field) => ({
        fieldId: field.id,
        canonicalKey: field.canonicalKey,
        question: field.question,
        controlType: field.controlType,
        required: field.required,
        mappingConfidence: field.confidence,
        options: field.options.map((option) => option.label),
      }));
    if (fields.length === 0) return;

    const capturedGeneration = state.navigationGeneration;
    state.answers = { state: "loading" };
    state.fillResult = null;
    render();
    try {
      const response = await sendBackground<AnswerResolution>({
        type: "CAREEROS_RESOLVE_ANSWERS",
        fields,
        selectedResumeVersionId: nextResumeVersionId || null,
        market:
          state.applicationContext?.state === "ready"
            ? (state.applicationContext.value.application?.market ?? "UNKNOWN")
            : "UNKNOWN",
        formLocale: state.detection.value.formLocale ?? null,
      });
      if (!isCurrentGeneration(capturedGeneration)) return;
      state.answers = response.ok
        ? { state: "ready", value: response.data }
        : { state: "error", message: t("Answer decisions are unavailable.") };
    } catch {
      if (!isCurrentGeneration(capturedGeneration)) return;
      state.answers = {
        state: "error",
        message: t("Answer decisions are unavailable."),
      };
    }
    if (!isCurrentGeneration(capturedGeneration)) return;
    render();
  }

  async function applyApprovedAnswers(): Promise<void> {
    const capturedGeneration = state.navigationGeneration;
    if (window.location.href !== state.lastUrl) {
      clearStaleFormState();
      return;
    }
    if (state.detection.state !== "ready" || state.answers?.state !== "ready") {
      return;
    }
    const fillPlan = buildFillPlan(state.answers.value, state.detection.value);
    if (!fillPlan || fillPlan.length === 0) return;

    const shouldPrepareForRecovery = Boolean(
      state.applicationContext?.state === "ready" &&
      !state.useTrackedApplication &&
      !state.recordedApplication &&
      state.company.trim() &&
      state.role.trim(),
    );

    if (
      shouldPrepareForRecovery &&
      state.applicationContext?.state === "ready"
    ) {
      state.preparingApplication = true;
      state.recordError = null;
      render();
      try {
        const prepared = await sendBackground<TrackedApplication>({
          type: "CAREEROS_PREPARE_APPLICATION",
          company: state.company.trim(),
          role: state.role.trim(),
          resumeVersionId: state.resumeVersionId || null,
          idempotencyKey: state.prepareKey,
          expectedPageUrl: state.lastUrl,
        });
        if (!isCurrentGeneration(capturedGeneration)) return;
        if (!prepared.ok) throw new Error(prepared.error);
        state.applicationContext = {
          state: "ready",
          value: {
            ...state.applicationContext.value,
            matchKind: "EXACT_URL",
            application: prepared.data,
          },
        };
        state.useTrackedApplication = true;
      } catch {
        if (!isCurrentGeneration(capturedGeneration)) return;
        state.recordError = t(
          "CareerOS could not save recovery context, but you can still fill and submit manually.",
        );
      } finally {
        if (isCurrentGeneration(capturedGeneration)) {
          state.preparingApplication = false;
        }
      }
    }

    state.fillResult = { state: "loading" };
    render();
    try {
      const response = await sendBackground<FillExecutionResult>({
        type: "CAREEROS_APPLY_FILL_PLAN",
        fields: fillPlan,
        expectedPageUrl: state.lastUrl,
      });
      if (!isCurrentGeneration(capturedGeneration)) return;
      state.fillResult = response.ok
        ? { state: "ready", value: response.data }
        : {
            state: "error",
            message:
              response.error === "STALE_PAGE"
                ? t("This page changed before fill could finish.")
                : t("The page could not be updated."),
          };
    } catch {
      if (!isCurrentGeneration(capturedGeneration)) return;
      state.fillResult = {
        state: "error",
        message: t("The page could not be updated."),
      };
    }
    if (!isCurrentGeneration(capturedGeneration)) return;
    render();
  }

  async function recordSubmittedApplication(): Promise<void> {
    if (
      state.applicationContext?.state !== "ready" ||
      !state.company.trim() ||
      !state.role.trim()
    ) {
      return;
    }
    const capturedGeneration = state.navigationGeneration;
    state.recording = true;
    state.recordError = null;
    render();
    const retainedAnswers = confirmedApplicationAnswers(
      state.answers?.state === "ready" ? state.answers.value : null,
      state.fillResult?.state === "ready" ? state.fillResult.value : null,
      state.detection.state === "ready" ? state.detection.value : null,
    );
    try {
      const response = await sendBackground<TrackedApplication>({
        type: "CAREEROS_RECORD_APPLICATION",
        applicationId: state.useTrackedApplication
          ? (state.applicationContext.value.application?.id ?? null)
          : null,
        company: state.company.trim(),
        role: state.role.trim(),
        resumeVersionId: state.resumeVersionId || null,
        idempotencyKey: state.recordKey,
        answers: retainedAnswers,
        expectedPageUrl: state.lastUrl,
      });
      if (!isCurrentGeneration(capturedGeneration)) return;
      if (!response.ok) throw new Error(response.error);
      state.recordedApplication = response.data;
    } catch {
      if (!isCurrentGeneration(capturedGeneration)) return;
      state.recordError = t(
        "CareerOS could not record this application. Your details remain here so you can retry.",
      );
    } finally {
      if (isCurrentGeneration(capturedGeneration)) {
        state.recording = false;
      }
    }
    if (!isCurrentGeneration(capturedGeneration)) return;
    render();
  }

  function renderAuthSection(container: HTMLElement): void {
    const section = document.createElement("div");
    section.className = "section";
    section.setAttribute("aria-live", "polite");
    const row = document.createElement("div");
    row.className = "status-row";
    const dot = document.createElement("span");
    dot.className = "status-dot";
    dot.setAttribute("aria-hidden", "true");
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    const body = document.createElement("p");
    if (state.auth.state === "loading") {
      setText(title, t("Checking account…"));
      setText(
        body,
        t("Your Career Brain stays in the secure CareerOS service."),
      );
    } else if (state.auth.state === "ready" && state.auth.value.authenticated) {
      dot.classList.add("connected");
      setText(title, t("Connected to CareerOS"));
      setText(
        body,
        t("Your Career Brain stays in the secure CareerOS service."),
      );
    } else if (state.auth.state === "error") {
      setText(title, state.auth.message);
      setText(
        body,
        t("Your Career Brain stays in the secure CareerOS service."),
      );
    } else {
      setText(title, t("Sign in to CareerOS"));
      setText(
        body,
        t("Your Career Brain stays in the secure CareerOS service."),
      );
    }
    copy.append(title, body);
    row.append(dot, copy);
    section.append(row);
    container.append(section);
  }

  function renderDetectionSection(container: HTMLElement): void {
    const section = document.createElement("div");
    section.className = "section";
    section.setAttribute("aria-live", "polite");
    const eyebrow = document.createElement("span");
    eyebrow.className = "eyebrow";
    setText(eyebrow, t("Current page"));
    const title = document.createElement("h2");
    const body = document.createElement("p");
    if (state.detection.state === "idle") {
      setText(title, t("Not inspected yet"));
      setText(
        body,
        t(
          "Use Reinspect page when you are ready. CareerOS does not scan continuously.",
        ),
      );
    } else if (state.detection.state === "loading") {
      setText(title, t("Checking this page…"));
      setText(body, t("CareerOS only inspects when you ask."));
    } else if (state.detection.state === "ready") {
      const copy = detectionCopy(state.detection.value);
      setText(title, copy.title);
      setText(body, copy.body);
    } else {
      setText(title, state.detection.message);
      setText(body, t("CareerOS only inspects when you ask."));
    }
    section.append(eyebrow, title, body);
    container.append(section);
  }

  function renderAnswersSection(container: HTMLElement): void {
    if (!state.answers) return;
    const section = document.createElement("div");
    section.className = "section";
    section.setAttribute("aria-live", "polite");
    const eyebrow = document.createElement("span");
    eyebrow.className = "eyebrow";
    setText(eyebrow, t("Answer policy"));
    const title = document.createElement("h2");
    const body = document.createElement("p");
    if (state.answers.state === "loading") {
      setText(title, t("Checking approved sources…"));
      setText(
        body,
        t("CareerOS keeps unknown and sensitive answers under your control."),
      );
    } else if (state.answers.state === "ready") {
      const copy = answerCopy(state.answers.value);
      setText(title, copy.title);
      setText(body, copy.body);
    } else if (state.answers.state === "error") {
      setText(title, state.answers.message);
      setText(
        body,
        t("CareerOS keeps unknown and sensitive answers under your control."),
      );
    }
    section.append(eyebrow, title, body);
    container.append(section);
  }

  function renderFillSection(container: HTMLElement): void {
    if (!state.fillResult) return;
    const section = document.createElement("div");
    section.className = "section";
    section.setAttribute("aria-live", "polite");
    const eyebrow = document.createElement("span");
    eyebrow.className = "eyebrow";
    setText(eyebrow, t("Review"));
    const title = document.createElement("h2");
    const body = document.createElement("p");
    if (state.fillResult.state === "loading") {
      setText(title, t("Updating supported fields…"));
      setText(
        body,
        t(
          "Existing answers stay untouched, and CareerOS never submits the form.",
        ),
      );
    } else if (state.fillResult.state === "ready") {
      const copy = fillCopy(state.fillResult.value);
      setText(title, copy.title);
      setText(body, copy.body);
    } else if (state.fillResult.state === "error") {
      setText(title, state.fillResult.message);
      setText(
        body,
        t(
          "Existing answers stay untouched, and CareerOS never submits the form.",
        ),
      );
    }
    section.append(eyebrow, title, body);
    container.append(section);
  }

  function renderApplicationMemory(container: HTMLElement): void {
    if (
      !state.applicationContext ||
      state.applicationContext.state === "idle"
    ) {
      return;
    }
    const section = document.createElement("div");
    section.className = "section";
    section.setAttribute("aria-live", "polite");
    const eyebrow = document.createElement("span");
    eyebrow.className = "eyebrow";
    setText(eyebrow, t("Application memory"));
    const title = document.createElement("h2");
    const body = document.createElement("p");

    if (state.applicationContext.state === "loading") {
      setText(title, t("Looking for tracked context…"));
      setText(body, t("Sign in and keep this application page open."));
    } else if (state.applicationContext.state === "error") {
      setText(title, state.applicationContext.message);
      setText(body, t("Sign in and keep this application page open."));
      section.append(eyebrow, title, body);
      container.append(section);
      return;
    } else if (state.recordedApplication) {
      setText(title, t("Application recorded"));
      setText(
        body,
        `${state.recordedApplication.company} · ${state.recordedApplication.role}`,
      );
      const viewButton = document.createElement("button");
      viewButton.type = "button";
      viewButton.className = "secondary";
      viewButton.textContent = t("Open in CareerOS");
      viewButton.addEventListener("click", () => {
        void chrome.runtime.sendMessage({
          type: "CAREEROS_OPEN_APPLICATION",
          applicationId: state.recordedApplication!.id,
        });
      });
      section.append(eyebrow, title, body, viewButton);
      container.append(section);
      return;
    } else {
      setText(title, t("Record after you submit"));
      const ctx = state.applicationContext.value;
      if (ctx.matchKind === "EXACT_URL") {
        setText(
          body,
          t(
            "CareerOS matched the application you started. Confirm after you submit the form.",
          ),
        );
      } else if (ctx.matchKind === "RECENT_PREPARING") {
        setText(
          body,
          t(
            "CareerOS found one recent application. Review the company and role before confirming.",
          ),
        );
      } else {
        setText(
          body,
          t(
            "No tracked job matched this page. Review the suggested context before confirming.",
          ),
        );
      }
    }

    const form = document.createElement("div");
    form.className = "memory-form";

    if (
      state.applicationContext.state === "ready" &&
      state.applicationContext.value.matchKind === "RECENT_PREPARING" &&
      state.applicationContext.value.application
    ) {
      const choice = document.createElement("label");
      choice.className = "memory-choice";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.useTrackedApplication;
      checkbox.addEventListener("change", () => {
        if (state.applicationContext?.state !== "ready") return;
        const selected = selectedApplicationFields(
          state.applicationContext.value,
          checkbox.checked,
        );
        state.useTrackedApplication = checkbox.checked;
        state.company = selected.company;
        state.role = selected.role;
        state.resumeVersionId = selected.resumeVersionId;
        state.prepareKey = crypto.randomUUID();
        state.recordKey = crypto.randomUUID();
        void resolveForResume(selected.resumeVersionId);
      });
      choice.append(
        checkbox,
        document.createTextNode(
          ` ${t("Use the recent {company} · {role} record", {
            company: state.applicationContext.value.application.company,
            role: state.applicationContext.value.application.role,
          })}`,
        ),
      );
      form.append(choice);
    }

    const companyLabel = document.createElement("label");
    setText(companyLabel, t("Company"));
    const companyInput = document.createElement("input");
    companyInput.value = state.company;
    companyInput.maxLength = 500;
    companyInput.disabled = Boolean(
      state.applicationContext.state === "ready" &&
      state.applicationContext.value.application &&
      state.useTrackedApplication,
    );
    companyInput.addEventListener("input", () => {
      state.company = companyInput.value;
      state.prepareKey = crypto.randomUUID();
      state.recordKey = crypto.randomUUID();
    });
    companyLabel.append(companyInput);

    const roleLabel = document.createElement("label");
    setText(roleLabel, t("Role"));
    const roleInput = document.createElement("input");
    roleInput.value = state.role;
    roleInput.maxLength = 500;
    roleInput.disabled = Boolean(
      state.applicationContext.state === "ready" &&
      state.applicationContext.value.application &&
      state.useTrackedApplication,
    );
    roleInput.addEventListener("input", () => {
      state.role = roleInput.value;
      state.prepareKey = crypto.randomUUID();
      state.recordKey = crypto.randomUUID();
    });
    roleLabel.append(roleInput);

    const resumeLabel = document.createElement("label");
    setText(resumeLabel, t("Resume used"));
    const resumeSelect = document.createElement("select");
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = t("No resume recorded");
    resumeSelect.append(emptyOption);
    if (state.applicationContext.state === "ready") {
      for (const resume of state.applicationContext.value.resumeVersions) {
        const option = document.createElement("option");
        option.value = resume.id;
        option.textContent = resume.label;
        resumeSelect.append(option);
      }
    }
    resumeSelect.value = state.resumeVersionId;
    resumeSelect.disabled = Boolean(
      state.useTrackedApplication &&
      state.applicationContext.state === "ready" &&
      state.applicationContext.value.application?.resumeVersionId,
    );
    resumeSelect.addEventListener("change", () => {
      state.resumeVersionId = resumeSelect.value;
      state.prepareKey = crypto.randomUUID();
      state.recordKey = crypto.randomUUID();
      void resolveForResume(resumeSelect.value);
    });
    resumeLabel.append(resumeSelect);

    const recordButton = document.createElement("button");
    recordButton.type = "button";
    recordButton.className = "secondary";
    recordButton.disabled =
      state.recording || !state.company.trim() || !state.role.trim();
    recordButton.textContent = state.recording
      ? t("Recording application…")
      : t("I submitted — Record application");
    recordButton.addEventListener("click", () => {
      void recordSubmittedApplication();
    });

    const note = document.createElement("p");
    note.className = "memory-note";
    setText(
      note,
      t(
        "Click only after you submit the form yourself. CareerOS never clicks Submit.",
      ),
    );

    form.append(companyLabel, roleLabel, resumeLabel, recordButton, note);
    if (state.recordError) {
      const error = document.createElement("p");
      error.className = "memory-error";
      setText(error, state.recordError);
      form.append(error);
    }
    section.append(eyebrow, title, body, form);
    container.append(section);
  }

  function renderActions(container: HTMLElement): void {
    const actions = document.createElement("div");
    actions.className = "actions";

    const fillPlan =
      state.detection.state === "ready" && state.answers?.state === "ready"
        ? buildFillPlan(state.answers.value, state.detection.value)
        : null;
    const approvedFields = approvedFillCount(fillPlan);
    const shouldPrepareForRecovery = Boolean(
      state.applicationContext?.state === "ready" &&
      !state.useTrackedApplication &&
      !state.recordedApplication &&
      state.company.trim() &&
      state.role.trim(),
    );

    if (fillPlan && fillPlan.length > 0) {
      const fillButton = document.createElement("button");
      fillButton.type = "button";
      fillButton.className = "primary";
      fillButton.disabled =
        state.fillResult?.state === "loading" ||
        state.preparingApplication ||
        state.applicationContext?.state === "loading";
      if (state.preparingApplication) {
        fillButton.textContent = t("Saving recovery context…");
      } else if (state.fillResult?.state === "loading") {
        fillButton.textContent = t("Applying approved answers…");
      } else if (approvedFields > 0) {
        fillButton.textContent = fillButtonLabel(
          shouldPrepareForRecovery,
          approvedFields,
        );
      } else {
        fillButton.textContent = shouldPrepareForRecovery
          ? t("Save context & show review states")
          : t("Show review states on page");
      }
      fillButton.addEventListener("click", () => {
        void applyApprovedAnswers();
      });
      actions.append(fillButton);
    }

    const reinspectButton = document.createElement("button");
    reinspectButton.type = "button";
    reinspectButton.className = "secondary";
    reinspectButton.textContent = t("Reinspect page");
    reinspectButton.addEventListener("click", () => {
      void inspectPage();
    });
    actions.append(reinspectButton);

    if (state.auth.state === "ready" && !state.auth.value.authenticated) {
      const signInButton = document.createElement("button");
      signInButton.type = "button";
      signInButton.className = "secondary";
      signInButton.textContent = t("Open CareerOS to sign in");
      signInButton.addEventListener("click", () => {
        void chrome.runtime.sendMessage({ type: "CAREEROS_OPEN_SIGN_IN" });
      });
      actions.append(signInButton);
    }

    container.append(actions);
  }

  function errorMessage(error: string): string {
    return error === "UNAUTHENTICATED"
      ? t("Sign in to CareerOS")
      : error === "STALE_PAGE"
        ? t("This page changed before fill could finish.")
        : t("This page could not be read.");
  }

  async function saveClippedJob(draft: JobDraft): Promise<void> {
    if (clipDraftProblem(draft)) return;
    const generation = state.navigationGeneration;
    state.clip = { state: "saving", draft };
    render();
    try {
      const response = await sendBackground<ClippedJob>({
        type: "CAREEROS_CLIP_JOB",
        title: draft.title,
        company: draft.company,
        location: draft.location,
        description: draft.description,
        market: draft.market,
        countryCode: draft.countryCode,
        workplaceType: draft.workplaceType,
        employmentType: draft.employmentType,
        expectedPageUrl: window.location.href,
      });
      if (!isCurrentGeneration(generation)) return;
      state.clip = response.ok
        ? { state: "saved", job: response.data }
        : { state: "editing", draft, error: errorMessage(response.error) };
    } catch {
      if (!isCurrentGeneration(generation)) return;
      state.clip = {
        state: "editing",
        draft,
        error: t(
          "CareerOS could not save this job. Check the description and try again.",
        ),
      };
    }
    render();
  }

  async function saveSelectedAnswers(
    items: TypedCustomAnswer[],
    selected: Set<string>,
  ): Promise<void> {
    state.savedAnswers = { state: "saving", items, selected };
    render();
    try {
      const response = await sendBackground<SavedReusableAnswers>({
        type: "CAREEROS_SAVE_REUSABLE_ANSWERS",
        answers: items
          .filter((item) => selected.has(item.fieldId))
          .map(({ question, answer }) => ({ question, answer })),
      });
      state.savedAnswers = {
        state: "done",
        message: response.ok
          ? savedAnswersSummary(response.data)
          : t("Sign in to CareerOS to save answers."),
      };
    } catch {
      state.savedAnswers = {
        state: "done",
        message: t("CareerOS could not save answers."),
      };
    }
    render();
  }

  async function attachResume(fieldId: string): Promise<void> {
    const generation = state.navigationGeneration;
    state.attach = { state: "attaching" };
    render();
    try {
      const response = await sendBackground<AttachResumeResult>({
        type: "CAREEROS_ATTACH_RESUME",
        fieldId,
        resumeVersionId: state.resumeVersionId,
        expectedPageUrl: window.location.href,
      });
      if (!isCurrentGeneration(generation)) return;
      state.attach = {
        state: "done",
        message: response.ok
          ? attachResultMessage(response.data.state)
          : t("The resume could not be attached."),
      };
    } catch {
      state.attach = {
        state: "done",
        message: t("The resume could not be attached."),
      };
    }
    render();
  }

  function toolButton(label: string, onClick: () => void, disabled = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.disabled = disabled;
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function note(text: string, error = false): HTMLParagraphElement {
    const paragraph = document.createElement("p");
    paragraph.className = error ? "memory-error" : "memory-note";
    setText(paragraph, text);
    return paragraph;
  }

  function labelledInput(
    label: string,
    value: string,
    onInput: (value: string) => void,
  ): HTMLLabelElement {
    const wrapper = document.createElement("label");
    setText(wrapper, label);
    const input = document.createElement("input");
    input.value = value;
    input.maxLength = 500;
    input.addEventListener("input", () => onInput(input.value));
    wrapper.append(input);
    return wrapper;
  }

  function renderToolsSection(container: HTMLElement): void {
    if (state.auth.state !== "ready" || !state.auth.value.authenticated) {
      return;
    }
    const section = document.createElement("div");
    section.className = "section";
    section.setAttribute("aria-live", "polite");

    // Save this job
    const clip = state.clip;
    if (clip.state === "idle") {
      section.append(
        toolButton(t("Save this job"), () => {
          state.clip = {
            state: "editing",
            draft: extractJobDraft(document, window.location.href),
            error: null,
          };
          render();
        }),
      );
    } else if (clip.state === "saved") {
      section.append(
        note(
          clip.job.created ? t("Saved to CareerOS") : t("Already in CareerOS"),
        ),
        toolButton(t("Open in CareerOS"), () => {
          void sendBackground({
            type: "CAREEROS_OPEN_JOB",
            jobId: clip.job.jobId,
          });
        }),
      );
    } else {
      const draft = clip.draft;
      const form = document.createElement("div");
      form.className = "memory-form";
      form.append(
        note(
          draft.extraction === "STRUCTURED_DATA"
            ? t("Read from this page's job listing data.")
            : t(
                "No structured job data found — fields were guessed from page text. Please check them.",
              ),
        ),
        labelledInput(t("Title"), draft.title, (value) => {
          draft.title = value;
        }),
        labelledInput(t("Company"), draft.company, (value) => {
          draft.company = value;
        }),
      );
      const problem = clipDraftProblem(draft);
      if (clip.state === "editing" && clip.error) {
        form.append(note(clip.error, true));
      }
      if (problem) form.append(note(problem));
      form.append(
        toolButton(
          clip.state === "saving" ? t("Saving…") : t("Save to CareerOS"),
          () => {
            // Inputs update the draft without re-rendering (to keep focus),
            // so re-render here to surface any missing field.
            if (clipDraftProblem(draft)) render();
            else void saveClippedJob(draft);
          },
          clip.state === "saving",
        ),
      );
      section.append(form);
    }

    // Remember answers typed into custom questions
    if (state.detection.state === "ready") {
      const saved = state.savedAnswers;
      if (saved.state === "idle") {
        section.append(
          toolButton(t("Remember my answers on this page"), () => {
            const items = captureCustomAnswers(document, window.location.href);
            state.savedAnswers =
              items.length > 0
                ? { state: "choosing", items, selected: new Set() }
                : {
                    state: "done",
                    message: t(
                      "No answered custom questions found on this page yet.",
                    ),
                  };
            render();
          }),
        );
      } else if (saved.state === "done") {
        section.append(note(saved.message));
      } else {
        const list = document.createElement("div");
        list.className = "memory-form";
        list.append(note(t("Choose answers to reuse")));
        for (const item of saved.items) {
          const choice = document.createElement("label");
          choice.className = "memory-choice";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = saved.selected.has(item.fieldId);
          checkbox.addEventListener("change", () => {
            if (checkbox.checked) saved.selected.add(item.fieldId);
            else saved.selected.delete(item.fieldId);
            render();
          });
          choice.append(
            checkbox,
            document.createTextNode(` ${item.question} — ${item.answer}`),
          );
          list.append(choice);
        }
        list.append(
          toolButton(
            saved.state === "saving"
              ? t("Saving…")
              : t(
                  saved.selected.size === 1
                    ? "Save {count} answer"
                    : "Save {count} answers",
                  { count: saved.selected.size },
                ),
            () => void saveSelectedAnswers(saved.items, saved.selected),
            saved.state === "saving" || saved.selected.size === 0,
          ),
        );
        section.append(list);
      }
    }

    // Attach the chosen resume to the upload field
    const uploadFieldId =
      state.detection.state === "ready"
        ? resumeUploadFieldId(state.detection.value)
        : null;
    const resumeOptions =
      state.applicationContext?.state === "ready"
        ? state.applicationContext.value.resumeVersions
        : [];
    if (uploadFieldId && resumeOptions.length > 0) {
      const selected = resumeOptions.find(
        (option) => option.id === state.resumeVersionId,
      );
      section.append(
        toolButton(
          state.attach.state === "attaching"
            ? t("Attaching resume…")
            : selected
              ? t("Attach resume: {label}", { label: selected.label })
              : t("Choose a resume below to attach it"),
          () => void attachResume(uploadFieldId),
          !selected || state.attach.state === "attaching",
        ),
      );
      if (state.attach.state === "done") {
        section.append(note(state.attach.message));
      }
    }

    if (section.childElementCount > 0) container.append(section);
  }

  function renderPanel(): void {
    while (panel.firstChild) panel.removeChild(panel.firstChild);

    const header = document.createElement("header");
    header.className = "header";
    const brand = document.createElement("strong");
    setText(brand, "CareerOS");
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "close-btn";
    closeButton.setAttribute("aria-label", t("Close CareerOS assistant"));
    setText(closeButton, t("Close"));
    closeButton.addEventListener("click", () => setPanelOpen(false, true));
    header.append(brand, closeButton);
    panel.append(header);

    renderAuthSection(panel);
    renderDetectionSection(panel);
    renderAnswersSection(panel);
    renderActions(panel);
    renderFillSection(panel);
    renderToolsSection(panel);
    renderApplicationMemory(panel);

    const footer = document.createElement("div");
    footer.className = "footer-note";
    setText(footer, t("CareerOS never submits the application for you."));
    panel.append(footer);
  }

  function render(): void {
    if (state.panelOpen) renderPanel();
  }

  launcher.addEventListener("click", () => {
    setPanelOpen(!state.panelOpen, false);
  });

  onKeyDown = (event: Event) => {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.key === "Escape" && state.panelOpen) {
      event.preventDefault();
      setPanelOpen(false, true);
    }
  };
  shadow.addEventListener("keydown", onKeyDown);

  void (async () => {
    startUrlWatch();
    await loadExpandedPreference();
    try {
      const response = await sendBackground<AuthStatus>({
        type: "CAREEROS_GET_AUTH_STATUS",
      });
      state.auth = response.ok
        ? { state: "ready", value: response.data }
        : { state: "error", message: t("CareerOS is unavailable.") };
    } catch {
      state.auth = { state: "error", message: t("CareerOS is unavailable.") };
    }
    render();
  })();

  const destroy = (): void => {
    stopUrlWatch();
    if (onKeyDown) shadow.removeEventListener("keydown", onKeyDown);
    host.remove();
    activeHandle = null;
  };

  activeHandle = {
    destroy,
    isPanelOpen: () => state.panelOpen,
  };

  return activeHandle;
}

export function destroyAssistant(): void {
  activeHandle?.destroy();
}
