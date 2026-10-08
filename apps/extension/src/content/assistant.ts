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
  AnalyzeJobResult,
  ClippedJob,
  DraftedAnswer,
  JobMatchSummary,
  PageJob,
  ExtensionResponse,
  FillExecutionResult,
  PageDetection,
  JobDraft,
  PopupRequest,
  SavedReusableAnswers,
  TrackedApplication,
  TypedCustomAnswer,
} from "../shared/messages";
import {
  extensionLocale,
  fillButtonLabel,
  loadStoredLocale,
  onStoredLocaleChange,
  saveLocale,
  t,
} from "../shared/i18n";
import buddyImage from "../icons/buddy-96.png";
import { companyIconKey } from "../shared/company-key";
import { captureCustomAnswers } from "./answer-capture";
import { fieldHasValue, fillDraftedAnswer, focusField } from "./form-execution";
import { hoursSinceConfirmed, reviewItems } from "./review-checklist";
import { extractJobDraft } from "./job-extraction";

const HOST_ID = "careeros-assistant-host";
const Z_INDEX = 2147483640;
const STORAGE_EXPANDED_KEY = "careeros_assistant_panel_expanded";
const STORAGE_DOCK_KEY = "careeros_assistant_dock";
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
.dock {
  position: fixed;
  right: 0;
  top: 60%;
  z-index: ${Z_INDEX};
  display: flex;
  align-items: center;
  gap: 0;
  touch-action: none;
}
.dock.left { left: 0; right: auto; flex-direction: row-reverse; }
.launcher {
  width: 56px;
  height: 56px;
  border: 2px solid #fff;
  border-radius: 16px 0 0 16px;
  background: #eceafd;
  cursor: grab;
  box-shadow: 0 8px 24px rgba(61, 49, 201, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  overflow: hidden;
  transition: transform 160ms ease, width 160ms ease;
}
.dock.left .launcher { border-radius: 0 16px 16px 0; }
.launcher:hover { transform: translateX(-3px); }
.dock.left .launcher:hover { transform: translateX(3px); }
.launcher.dragging { cursor: grabbing; transform: none; }
.launcher img { width: 46px; height: 46px; display: block; pointer-events: none; }
.dock.collapsed .launcher { width: 20px; }
.dock.collapsed .launcher img { display: none; }
.dock-controls {
  position: absolute;
  top: -10px;
  left: -10px;
  display: none;
  gap: 4px;
}
.dock.left .dock-controls { left: auto; right: -10px; }
.dock:hover .dock-controls, .dock:focus-within .dock-controls { display: flex; }
.dock-controls button {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border: none;
  background: #3d31c9;
  color: #fff;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.25);
}
.launcher:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.launcher svg { width: 24px; height: 24px; color: #3d31c9; }
.panel {
  position: fixed;
  right: 72px;
  bottom: 24px;
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
.panel.left { right: auto; left: 72px; }
.autofill {
  width: 100%;
  border: none;
  border-radius: 10px;
  padding: 12px;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #3d31c9, #6c5ce0);
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(61, 49, 201, 0.3);
}
.page-job {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.page-job .logo {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #3d31c9;
  background: #fff;
  overflow: hidden;
}
.page-job .logo img { width: 34px; height: 34px; }
.page-job strong { display: block; font-size: 15px; line-height: 1.3; }
.page-job .meta { font-size: 12px; color: #64748b; margin-top: 2px; }
.page-job .salary { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 4px; }
.chip-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.chip {
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
  padding: 2px 8px;
  background: #f1f5f9;
  color: #334155;
}
.chip.good { background: #dcfce7; color: #166534; }
.section-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  cursor: pointer;
  font: inherit;
  color: inherit;
  text-align: left;
}
.section-toggle .toggle-label { font-size: 15px; font-weight: 600; flex: 1; }
.section-toggle .toggle-chevron { color: #94a3b8; font-size: 14px; }
.section-toggle-body { margin-top: 10px; }
.chip.warn { background: #fef3c7; color: #92400e; }
.link-row { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.link-row button { padding: 6px 10px; font-size: 12px; }
.match-bar {
  display: flex;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: #f1f5f9;
  margin: 8px 0 4px;
}
.match-bar span { display: block; height: 100%; }
.match-legend { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: #475569; }
.match-legend i { display: inline-block; width: 8px; height: 8px; border-radius: 999px; margin-right: 4px; }
.req-list { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.req-list li { font-size: 12px; color: #334155; display: flex; gap: 6px; }
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
.header-actions { display: flex; align-items: center; gap: 4px; }
.lang-btn {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #3d31c9;
  cursor: pointer;
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 12px;
  font-weight: 700;
}
.lang-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
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
.checklist {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.check-item {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px;
}
.check-item.done { background: #f0fdf4; border-color: #bbf7d0; }
.check-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 0;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
}
.check-icon {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  background: #fef3c7;
  color: #92400e;
}
.check-item.done .check-icon { background: #dcfce7; color: #166534; }
.check-question { font-size: 13px; color: #0f172a; }
.check-tag {
  margin-left: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #b45309;
}
.draft-box {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.draft-box textarea {
  width: 100%;
  min-height: 96px;
  border: 1px solid #bbf7d0;
  background: #f0fdf4;
  border-radius: 6px;
  padding: 8px;
  font: inherit;
  font-size: 13px;
  color: #0f172a;
  resize: vertical;
}
.draft-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.draft-actions button { padding: 6px 10px; }
.link-button {
  border: none;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 0 0 26px;
  cursor: pointer;
}
.job-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px;
  margin-bottom: 8px;
}
.job-card strong { display: block; font-size: 14px; }
.job-card .job-company { font-size: 12px; color: #475569; }
.job-card .job-meta { margin-top: 6px; font-size: 12px; color: #166534; }
.job-card .job-meta.warn { color: #b45309; }
@media (max-width: 480px) {
  .launcher { right: 12px; bottom: 64px; }
  .panel { right: 12px; bottom: 124px; width: calc(100vw - 24px); }
}
`;

type DraftState =
  | { state: "loading" }
  | {
      state: "ready";
      text: string;
      evidenceCount: number;
      unsupportedPoints: string[];
      notice: string | null;
    }
  | { state: "error"; message: string };

const DRAFT_REFUSAL_COPY = {
  SENSITIVE:
    "This is a sensitive question. Answer it yourself; CareerOS never drafts it.",
  NO_EVIDENCE:
    "Confirm some experience in Career Brain first; drafts only use confirmed evidence.",
  NOT_GROUNDED:
    "CareerOS could not ground a draft in your confirmed evidence, so none was offered.",
  AI_UNAVAILABLE: "Drafting is not configured on this CareerOS server.",
  FAILED: "CareerOS could not draft an answer. Try again.",
} as const;

type CoverLetterState =
  | { state: "idle" }
  | { state: "drafting" }
  | {
      state: "ready";
      text: string;
      notice: string | null;
      attaching: boolean;
      attached: boolean;
    }
  | { state: "error"; message: string };

const MATCH_COLORS = {
  STRONG_EVIDENCE: "#16a34a",
  HIDDEN_EVIDENCE: "#3d31c9",
  WEAK_EVIDENCE: "#d97706",
  GENUINE_GAP: "#cbd5e1",
} as const;

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
  // The CareerOS mascot; pages whose CSP blocks data: images get the SVG mark.
  const mascot = document.createElement("img");
  mascot.src = buddyImage;
  mascot.alt = "";
  mascot.addEventListener("error", () => {
    mascot.remove();
    launcher.append(createLogoSvg());
  });
  launcher.append(mascot);

  const dock = document.createElement("div");
  dock.className = "dock";
  const dockControls = document.createElement("div");
  dockControls.className = "dock-controls";
  const tuckButton = document.createElement("button");
  tuckButton.type = "button";
  tuckButton.textContent = "–";
  tuckButton.setAttribute("aria-label", t("Tuck CareerOS against the edge"));
  const hideButton = document.createElement("button");
  hideButton.type = "button";
  hideButton.textContent = "×";
  hideButton.setAttribute("aria-label", t("Hide CareerOS on this page"));
  dockControls.append(tuckButton, hideButton);
  dock.append(launcher, dockControls);

  const panel = document.createElement("section");
  panel.id = "careeros-assistant-panel";
  panel.className = "panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", t("CareerOS application assistant"));
  panel.setAttribute("aria-live", "polite");

  shadow.append(style, root);
  root.append(dock, panel);
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
    drafts: {} as Record<string, DraftState>,
    pageJob: { state: "idle" } as LoadState<PageJob | null>,
    match: null as LoadState<JobMatchSummary | "NONE"> | null,
    analyzing: false,
    analyzeMessage: null as string | null,
    showRequirements: false,
    coverLetter: { state: "idle" } as CoverLetterState,
    coverLetterExpanded: false,
    autofilling: false,
    autofillNotice: null as string | null,
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
    state.drafts = {};
    state.pageJob = { state: "idle" };
    state.match = null;
    state.analyzeMessage = null;
    state.coverLetter = { state: "idle" };
    state.coverLetterExpanded = false;
    state.autofillNotice = null;
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

  // Re-render the review checklist as the user answers fields on the page,
  // ignoring typing inside the assistant itself.
  let renderQueued = false;
  function onPageInput(event: Event): void {
    if (event.composedPath().includes(host)) return;
    if (state.fillResult?.state !== "ready" || !state.panelOpen) return;
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }

  function startUrlWatch(): void {
    document.addEventListener("input", onPageInput, true);
    document.addEventListener("change", onPageInput, true);
    onPopState = () => handleUrlChange();
    onHashChange = () => handleUrlChange();
    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onHashChange);
    urlPollTimer = setInterval(handleUrlChange, URL_POLL_INTERVAL_MS);
  }

  function stopUrlWatch(): void {
    document.removeEventListener("input", onPageInput, true);
    document.removeEventListener("change", onPageInput, true);
    if (urlPollTimer) {
      clearInterval(urlPollTimer);
      urlPollTimer = null;
    }
    if (onPopState) window.removeEventListener("popstate", onPopState);
    if (onHashChange) window.removeEventListener("hashchange", onHashChange);
    onPopState = null;
    onHashChange = null;
  }

  // Dock position (side and height) and tucked state persist per browser.
  const dockState = {
    side: "right" as "left" | "right",
    top: 0.6,
    tucked: false,
  };
  function applyDock(): void {
    dock.classList.toggle("left", dockState.side === "left");
    dock.classList.toggle("collapsed", dockState.tucked);
    panel.classList.toggle("left", dockState.side === "left");
    dock.style.top = `${Math.round(dockState.top * 100)}%`;
  }
  function saveDock(): void {
    void chrome.storage.local.set({ [STORAGE_DOCK_KEY]: { ...dockState } });
  }
  async function loadDock(): Promise<void> {
    try {
      const stored = (await chrome.storage.local.get(STORAGE_DOCK_KEY))[
        STORAGE_DOCK_KEY
      ] as Partial<typeof dockState> | undefined;
      if (stored?.side === "left" || stored?.side === "right") {
        dockState.side = stored.side;
      }
      if (
        typeof stored?.top === "number" &&
        stored.top >= 0.05 &&
        stored.top <= 0.9
      ) {
        dockState.top = stored.top;
      }
      dockState.tucked = stored?.tucked === true;
    } catch {
      // Defaults stay in place when storage is unavailable.
    }
    applyDock();
  }

  // Drag the launcher along either edge; a drag never counts as a click.
  let drag: { startY: number; startTop: number; moved: boolean } | null = null;
  let suppressClick = false;
  launcher.addEventListener("pointerdown", (event) => {
    drag = { startY: event.clientY, startTop: dockState.top, moved: false };
    launcher.setPointerCapture?.(event.pointerId);
  });
  launcher.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.abs(dy) < 5 && Math.abs(event.movementX) < 5)
      return;
    drag.moved = true;
    launcher.classList.add("dragging");
    const height = window.innerHeight || 1;
    dockState.top = Math.min(0.9, Math.max(0.05, drag.startTop + dy / height));
    dockState.side =
      event.clientX < (window.innerWidth || 0) / 2 ? "left" : "right";
    applyDock();
  });
  const endDrag = () => {
    if (drag?.moved) {
      suppressClick = true;
      saveDock();
    }
    drag = null;
    launcher.classList.remove("dragging");
  };
  launcher.addEventListener("pointerup", endDrag);
  launcher.addEventListener("pointercancel", endDrag);
  tuckButton.addEventListener("click", () => {
    dockState.tucked = !dockState.tucked;
    if (dockState.tucked) setPanelOpen(false);
    applyDock();
    saveDock();
  });
  hideButton.addEventListener("click", () => destroyAssistant());

  // Labels set outside render() follow the language toggle too.
  function refreshLabels(): void {
    launcher.setAttribute(
      "aria-label",
      state.panelOpen
        ? t("Close CareerOS assistant")
        : t("Open CareerOS assistant"),
    );
    panel.setAttribute("aria-label", t("CareerOS application assistant"));
    tuckButton.setAttribute("aria-label", t("Tuck CareerOS against the edge"));
    hideButton.setAttribute("aria-label", t("Hide CareerOS on this page"));
  }
  const stopLocaleSync = onStoredLocaleChange(() => {
    refreshLabels();
    render();
  });

  function setPanelOpen(open: boolean, restoreFocus = false): void {
    state.panelOpen = open;
    panel.classList.toggle("open", open);
    launcher.setAttribute("aria-expanded", open ? "true" : "false");
    launcher.setAttribute(
      "aria-label",
      open ? t("Close CareerOS assistant") : t("Open CareerOS assistant"),
    );
    void chrome.storage.local.set({ [STORAGE_EXPANDED_KEY]: open });
    if (open) void loadPageJob();
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
      if (state.detection.state === "ready") {
        const checklist = renderChecklist(
          reviewItems(state.detection.value, state.fillResult.value),
        );
        if (checklist) {
          section.append(eyebrow, title, body, checklist);
          container.append(section);
          return;
        }
      }
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

  function renderChecklist(
    items: ReturnType<typeof reviewItems>,
  ): HTMLElement | null {
    if (items.length === 0) return null;
    const wrapper = document.createElement("div");
    const done = items.filter((item) =>
      fieldHasValue(document, state.lastUrl, item.fieldId),
    ).length;
    const requiredLeft = items.filter(
      (item) =>
        item.required && !fieldHasValue(document, state.lastUrl, item.fieldId),
    ).length;
    const heading = document.createElement("p");
    heading.className = "memory-note";
    setText(
      heading,
      requiredLeft > 0
        ? t("{count} required fields still need you · {done}/{total} handled", {
            count: requiredLeft,
            done,
            total: items.length,
          })
        : t("{done}/{total} handled — check the page before you submit", {
            done,
            total: items.length,
          }),
    );
    const list = document.createElement("ul");
    list.className = "checklist";
    for (const item of items) {
      const answered = fieldHasValue(document, state.lastUrl, item.fieldId);
      const li = document.createElement("li");
      li.className = answered ? "check-item done" : "check-item";
      const row = document.createElement("button");
      row.type = "button";
      row.className = "check-row";
      row.setAttribute(
        "aria-label",
        t("Go to: {question}", {
          question: item.question ?? t("Unlabelled field"),
        }),
      );
      row.addEventListener("click", () => {
        focusField(document, state.lastUrl, item.fieldId);
      });
      const icon = document.createElement("span");
      icon.className = "check-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = answered ? "✓" : "!";
      const label = document.createElement("span");
      label.className = "check-question";
      setText(label, item.question ?? t("Unlabelled field"));
      if (item.required) {
        const tag = document.createElement("span");
        tag.className = "check-tag";
        setText(tag, t("Required"));
        label.append(tag);
      }
      row.append(icon, label);
      li.append(row);
      const draft = state.drafts[item.fieldId];
      if (item.draftable && !answered) {
        li.append(renderDraft(item));
      } else if (draft?.state === "ready" && draft.notice) {
        // Keep the outcome visible after the draft filled the field.
        li.append(note(draft.notice));
      }
      list.append(li);
    }
    wrapper.append(heading, list);
    return wrapper;
  }

  function renderDraft(
    item: ReturnType<typeof reviewItems>[number],
  ): HTMLElement {
    const draft = state.drafts[item.fieldId];
    if (!draft || draft.state === "error") {
      const box = document.createElement("div");
      if (draft?.state === "error") box.append(note(draft.message, true));
      const button = document.createElement("button");
      button.type = "button";
      button.className = "link-button";
      setText(button, t("Draft from my experience"));
      button.addEventListener("click", () => void requestDraft(item));
      box.append(button);
      return box;
    }
    if (draft.state === "loading")
      return note(t("Drafting from your confirmed evidence…"));
    const box = document.createElement("div");
    box.className = "draft-box";
    const area = document.createElement("textarea");
    area.value = draft.text;
    area.setAttribute("aria-label", t("Draft answer (editable)"));
    area.addEventListener("input", () => {
      draft.text = area.value;
    });
    box.append(
      note(
        t("Based on {count} confirmed evidence item(s). Edit before using.", {
          count: draft.evidenceCount,
        }),
      ),
      area,
    );
    if (draft.unsupportedPoints.length > 0) {
      box.append(
        note(
          t("Not claimed — your evidence does not cover: {points}", {
            points: draft.unsupportedPoints.join("; "),
          }),
        ),
      );
    }
    const actions = document.createElement("div");
    actions.className = "draft-actions";
    const insert = document.createElement("button");
    insert.type = "button";
    insert.className = "primary";
    setText(insert, t("Put in this field"));
    insert.addEventListener("click", () => {
      const result = fillDraftedAnswer(
        document,
        state.lastUrl,
        item.fieldId,
        draft.text.trim(),
      );
      draft.notice =
        result === "FILLED"
          ? t("Added. Review it on the page before you submit.")
          : result === "SKIPPED_EXISTING"
            ? t("That field already has an answer; CareerOS left it alone.")
            : t("CareerOS could not fill this field; copy the draft instead.");
      render();
    });
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "secondary";
    setText(copy, t("Copy"));
    copy.addEventListener("click", () => {
      void navigator.clipboard.writeText(draft.text).then(
        () => {
          draft.notice = t("Copied.");
          render();
        },
        () => {
          draft.notice = t("Copy failed; select the text instead.");
          render();
        },
      );
    });
    actions.append(insert, copy);
    box.append(actions);
    if (draft.notice) box.append(note(draft.notice));
    return box;
  }

  async function requestDraft(
    item: ReturnType<typeof reviewItems>[number],
  ): Promise<void> {
    if (!item.question) return;
    const capturedGeneration = state.navigationGeneration;
    state.drafts[item.fieldId] = { state: "loading" };
    render();
    try {
      const response = await sendBackground<DraftedAnswer>({
        type: "CAREEROS_DRAFT_ANSWER",
        question: item.question,
        jobId: state.clip.state === "saved" ? state.clip.job.jobId : null,
      });
      if (!isCurrentGeneration(capturedGeneration)) return;
      if (!response.ok) throw new Error(response.error);
      state.drafts[item.fieldId] =
        response.data.status === "DRAFTED"
          ? {
              state: "ready",
              text: response.data.text,
              evidenceCount: response.data.evidenceCount,
              unsupportedPoints: response.data.unsupportedPoints,
              notice: null,
            }
          : {
              state: "error",
              message: t(DRAFT_REFUSAL_COPY[response.data.reason]),
            };
    } catch {
      if (!isCurrentGeneration(capturedGeneration)) return;
      state.drafts[item.fieldId] = {
        state: "error",
        message: t(DRAFT_REFUSAL_COPY.FAILED),
      };
    }
    render();
  }

  function renderJobCard(job: ClippedJob): HTMLElement {
    const card = document.createElement("div");
    card.className = "job-card";
    const title = document.createElement("strong");
    setText(title, job.title ?? t("Saved job"));
    card.append(title);
    if (job.company) {
      const company = document.createElement("span");
      company.className = "job-company";
      setText(company, job.company);
      card.append(company);
    }
    const hours = hoursSinceConfirmed(job);
    if (hours !== null) {
      const meta = document.createElement("p");
      meta.className = hours >= 72 ? "job-meta warn" : "job-meta";
      setText(
        meta,
        hours >= 72
          ? t("May have closed — not seen for {days}d", {
              days: Math.floor(hours / 24),
            })
          : hours < 24
            ? t("Confirmed open in the last 24 hours")
            : t("Confirmed open {days}d ago", { days: Math.floor(hours / 24) }),
      );
      card.append(meta);
    }
    if (job.sponsorship) {
      card.append(
        note(
          job.sponsorship === "OFFERED"
            ? t("Posting offers visa sponsorship")
            : t("Posting says no visa sponsorship"),
        ),
      );
    }
    card.append(
      note(job.created ? t("Saved to CareerOS") : t("Already in CareerOS")),
    );
    return card;
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
        renderJobCard(clip.job),
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

  // ------------------------------------------------------------------
  // The job behind this page: card, evidence match, materials, letter
  // ------------------------------------------------------------------

  function isSignedIn(): boolean {
    return state.auth.state === "ready" && state.auth.value.authenticated;
  }

  async function loadPageJob(): Promise<void> {
    console.log(
      "[CareerOS DEBUG] loadPageJob called, isSignedIn=",
      isSignedIn(),
      "pageJob.state=",
      state.pageJob.state,
    );
    if (!isSignedIn() || state.pageJob.state !== "idle") return;
    const generation = state.navigationGeneration;
    state.pageJob = { state: "loading" };
    try {
      console.log("[CareerOS DEBUG] sending CAREEROS_LOOKUP_PAGE_JOB");
      const response = await sendBackground<PageJob | null>({
        type: "CAREEROS_LOOKUP_PAGE_JOB",
      });
      console.log("[CareerOS DEBUG] lookup response", JSON.stringify(response));
      if (!isCurrentGeneration(generation)) {
        console.log("[CareerOS DEBUG] stale generation, dropping response");
        return;
      }
      state.pageJob = {
        state: "ready",
        value:
          response.ok &&
          response.data &&
          typeof response.data.jobId === "string" &&
          typeof response.data.title === "string"
            ? response.data
            : null,
      };
    } catch {
      if (!isCurrentGeneration(generation)) return;
      state.pageJob = { state: "ready", value: null };
    }
    render();
    if (state.pageJob.state === "ready" && state.pageJob.value) {
      void loadMatch(state.pageJob.value.jobId);
    }
  }

  async function loadMatch(jobId: string): Promise<void> {
    const generation = state.navigationGeneration;
    state.match = { state: "loading" };
    render();
    try {
      const response = await sendBackground<JobMatchSummary | "NONE">({
        type: "CAREEROS_GET_JOB_MATCH",
        jobId,
      });
      if (!isCurrentGeneration(generation)) return;
      state.match = response.ok
        ? { state: "ready", value: response.data }
        : { state: "error", message: t("The evidence match is unavailable.") };
    } catch {
      if (!isCurrentGeneration(generation)) return;
      state.match = {
        state: "error",
        message: t("The evidence match is unavailable."),
      };
    }
    render();
  }

  function selectedResumeVersion(): string | null {
    if (state.resumeVersionId) return state.resumeVersionId;
    const context =
      state.applicationContext?.state === "ready"
        ? state.applicationContext.value
        : null;
    return context?.resumeVersions[0]?.id ?? null;
  }

  async function analyzeMatch(jobId: string): Promise<void> {
    const resumeVersionId = selectedResumeVersion();
    if (!resumeVersionId) return;
    const generation = state.navigationGeneration;
    state.analyzing = true;
    state.analyzeMessage = null;
    render();
    try {
      const response = await sendBackground<AnalyzeJobResult>({
        type: "CAREEROS_ANALYZE_JOB",
        jobId,
        resumeVersionId,
      });
      if (!isCurrentGeneration(generation)) return;
      if (response.ok && response.data.status === "ANALYZED") {
        state.match = { state: "ready", value: response.data.summary };
      } else {
        state.analyzeMessage =
          response.ok &&
          response.data.status === "REFUSED" &&
          response.data.reason === "AI_UNAVAILABLE"
            ? t("Analysis is not configured on this CareerOS server.")
            : t("CareerOS could not analyze this job. Try again.");
      }
    } catch {
      if (!isCurrentGeneration(generation)) return;
      state.analyzeMessage = t(
        "CareerOS could not analyze this job. Try again.",
      );
    } finally {
      if (isCurrentGeneration(generation)) state.analyzing = false;
    }
    render();
  }

  /** Exact figures with thousands separators, never rounded (a quoted fact). */
  function formatMoney(amount: number): string {
    const decimals = Number.isInteger(amount) ? 0 : 2;
    return `$${amount.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }

  function renderPageJobSection(container: HTMLElement): void {
    if (state.pageJob.state !== "ready" || !state.pageJob.value) return;
    const job = state.pageJob.value;
    const section = document.createElement("div");
    section.className = "section";
    const row = document.createElement("div");
    row.className = "page-job";
    const logo = document.createElement("div");
    logo.className = "logo";
    const monogram = () => {
      logo.textContent = (companyIconKey(job.company)[0] ?? "?").toUpperCase();
    };
    if (job.logoDataUrl) {
      const image = document.createElement("img");
      image.src = job.logoDataUrl;
      image.alt = "";
      image.addEventListener("error", () => {
        image.remove();
        monogram();
      });
      logo.append(image);
    } else {
      monogram();
    }
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    setText(title, job.title);
    const meta = document.createElement("div");
    meta.className = "meta";
    setText(
      meta,
      job.postedAt
        ? t("{company} · Posted {date}", {
            company: job.company,
            date: new Date(job.postedAt).toLocaleDateString(),
          })
        : job.company,
    );
    copy.append(title, meta);
    if (job.salary) {
      const salary = document.createElement("div");
      salary.className = "salary";
      const span =
        job.salary.minimum === job.salary.maximum
          ? formatMoney(job.salary.minimum)
          : `${formatMoney(job.salary.minimum)} - ${formatMoney(job.salary.maximum)}`;
      setText(
        salary,
        t(
          job.salary.period === "HOUR"
            ? "{span} {currency} / hour"
            : "{span} {currency} / year",
          {
            span,
            currency: job.salary.currency,
          },
        ),
      );
      copy.append(salary);
    }
    const chips = document.createElement("div");
    chips.className = "chip-row";
    const chip = (label: string, tone = "") => {
      const element = document.createElement("span");
      element.className = tone ? `chip ${tone}` : "chip";
      setText(element, label);
      chips.append(element);
    };
    const hours = hoursSinceConfirmed({
      jobId: job.jobId,
      created: false,
      isCatalog: job.isCatalog,
      lastObservedAt: job.lastObservedAt,
    });
    if (hours !== null) {
      chip(
        hours >= 72
          ? t("May have closed — not seen for {days}d", {
              days: Math.floor(hours / 24),
            })
          : hours < 24
            ? t("Confirmed open in the last 24 hours")
            : t("Confirmed open {days}d ago", { days: Math.floor(hours / 24) }),
        hours >= 72 ? "warn" : "good",
      );
    }
    if (job.sponsorship) {
      chip(
        job.sponsorship === "OFFERED"
          ? t("Posting offers visa sponsorship")
          : t("Posting says no visa sponsorship"),
        job.sponsorship === "OFFERED" ? "good" : "",
      );
    }
    if (job.isSaved) chip(t("Already in CareerOS"));
    if (chips.childElementCount > 0) copy.append(chips);
    const links = document.createElement("div");
    links.className = "link-row";
    for (const [tab, label] of [
      ["tailor", t("Tailor resume")],
      ["drafts", t("Write cover letter")],
    ] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary";
      setText(button, label);
      button.addEventListener("click", () => {
        void sendBackground({
          type: "CAREEROS_OPEN_MATERIALS",
          jobId: job.jobId,
          tab,
        });
      });
      links.append(button);
    }
    copy.append(links);
    row.append(logo, copy);
    section.append(row);
    container.append(section);
  }

  function renderMatchSection(container: HTMLElement): void {
    if (
      state.pageJob.state !== "ready" ||
      !state.pageJob.value ||
      !state.match
    ) {
      return;
    }
    const jobId = state.pageJob.value.jobId;
    const section = document.createElement("div");
    section.className = "section";
    const eyebrow = document.createElement("span");
    eyebrow.className = "eyebrow";
    setText(eyebrow, t("Evidence match"));
    section.append(eyebrow);
    const resumeVersionId = selectedResumeVersion();
    const analyzeButton = (label: string) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary";
      button.disabled = state.analyzing || !resumeVersionId;
      setText(button, state.analyzing ? t("Analyzing…") : label);
      button.addEventListener("click", () => void analyzeMatch(jobId));
      return button;
    };
    if (state.match.state === "loading") {
      section.append(note(t("Checking your evidence for this job…")));
    } else if (state.match.state === "error") {
      section.append(note(state.match.message, true));
    } else if (state.match.state === "ready" && state.match.value === "NONE") {
      section.append(
        note(
          resumeVersionId
            ? t(
                "See which of this job's requirements your confirmed evidence covers.",
              )
            : t(
                "Open the application form to pick a resume, then compare it with this job.",
              ),
        ),
        analyzeButton(t("Compare with my evidence")),
      );
    } else if (state.match.state === "ready" && state.match.value !== "NONE") {
      const summary = state.match.value;
      const total = summary.requirements.length;
      const count = (kind: keyof typeof MATCH_COLORS) =>
        summary.requirements.filter((item) => item.classification === kind)
          .length;
      const supported = count("STRONG_EVIDENCE") + count("HIDDEN_EVIDENCE");
      const title = document.createElement("h2");
      setText(
        title,
        t("{supported} of {total} requirements have your evidence", {
          supported,
          total,
        }),
      );
      const bar = document.createElement("div");
      bar.className = "match-bar";
      bar.setAttribute("aria-hidden", "true");
      const legend = document.createElement("div");
      legend.className = "match-legend";
      for (const [kind, label] of [
        ["STRONG_EVIDENCE", t("Shown on resume")],
        ["HIDDEN_EVIDENCE", t("Not on resume yet")],
        ["WEAK_EVIDENCE", t("Weak evidence")],
        ["GENUINE_GAP", t("No evidence")],
      ] as const) {
        const value = count(kind);
        if (total > 0 && value > 0) {
          const part = document.createElement("span");
          part.style.width = `${(value / total) * 100}%`;
          part.style.background = MATCH_COLORS[kind];
          bar.append(part);
        }
        const item = document.createElement("span");
        const dot = document.createElement("i");
        dot.style.background = MATCH_COLORS[kind];
        item.append(dot, document.createTextNode(`${label} ${value}`));
        legend.append(item);
      }
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "link-button";
      toggle.style.paddingLeft = "0";
      setText(
        toggle,
        state.showRequirements
          ? t("Hide requirements")
          : t("Show requirements"),
      );
      toggle.addEventListener("click", () => {
        state.showRequirements = !state.showRequirements;
        render();
      });
      section.append(title, bar, legend, toggle);
      if (state.showRequirements) {
        const list = document.createElement("ul");
        list.className = "req-list";
        for (const requirement of summary.requirements) {
          const li = document.createElement("li");
          const dot = document.createElement("i");
          dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:999px;margin-top:4px;flex-shrink:0;background:${MATCH_COLORS[requirement.classification]}`;
          li.append(dot, document.createTextNode(requirement.description));
          list.append(li);
        }
        section.append(list);
      }
      section.append(
        note(
          t("Based on {resume}. A comparison, never a score.", {
            resume: summary.resumeLabel,
          }),
        ),
      );
      if (resumeVersionId) section.append(analyzeButton(t("Compare again")));
    }
    if (state.analyzeMessage) section.append(note(state.analyzeMessage, true));
    container.append(section);
  }

  function coverLetterField(): { id: string } | null {
    if (state.detection.state !== "ready") return null;
    for (const form of state.detection.value.forms) {
      const field = form.fields.find(
        (candidate) => candidate.canonicalKey === "COVER_LETTER_FILE",
      );
      if (field) return field;
    }
    return null;
  }

  function letterJobId(): string | null {
    if (state.pageJob.state === "ready" && state.pageJob.value) {
      return state.pageJob.value.jobId;
    }
    return state.clip.state === "saved" ? state.clip.job.jobId : null;
  }

  async function draftLetter(jobId: string): Promise<void> {
    const generation = state.navigationGeneration;
    state.coverLetter = { state: "drafting" };
    state.coverLetterExpanded = true;
    render();
    try {
      const response = await sendBackground<DraftedAnswer>({
        type: "CAREEROS_DRAFT_COVER_LETTER",
        jobId,
      });
      if (!isCurrentGeneration(generation)) return;
      if (!response.ok) throw new Error(response.error);
      state.coverLetter =
        response.data.status === "DRAFTED"
          ? {
              state: "ready",
              text: response.data.text,
              notice: null,
              attaching: false,
              attached: false,
            }
          : {
              state: "error",
              message: t(DRAFT_REFUSAL_COPY[response.data.reason]),
            };
    } catch {
      if (!isCurrentGeneration(generation)) return;
      state.coverLetter = {
        state: "error",
        message: t(DRAFT_REFUSAL_COPY.FAILED),
      };
    }
    render();
  }

  async function attachLetter(fieldId: string): Promise<void> {
    const letter = state.coverLetter;
    if (letter.state !== "ready" || !letter.text.trim()) return;
    letter.attaching = true;
    letter.notice = null;
    render();
    const company =
      state.pageJob.state === "ready" && state.pageJob.value
        ? state.pageJob.value.company
        : state.company;
    try {
      const response = await sendBackground<{ fieldId: string; state: string }>(
        {
          type: "CAREEROS_ATTACH_COVER_LETTER",
          fieldId,
          text: letter.text.trim(),
          filenameHint: company ? `Cover letter - ${company}` : "Cover letter",
          expectedPageUrl: state.lastUrl,
        },
      );
      const outcome = response.ok ? response.data.state : "FAILED";
      letter.attached = outcome === "FILLED" || outcome === "SKIPPED_EXISTING";
      letter.notice =
        outcome === "FILLED"
          ? t(
              "Attached as a Word file. Check it on the page before you submit.",
            )
          : outcome === "SKIPPED_EXISTING"
            ? t("A file is already chosen there; CareerOS left it alone.")
            : t(
                "This upload field did not accept the file. Copy the letter instead.",
              );
    } catch {
      letter.notice = t(
        "This upload field did not accept the file. Copy the letter instead.",
      );
    } finally {
      letter.attaching = false;
    }
    render();
  }

  /** A compact status like Simplify's "Filled (0/1)", for the collapsed row. */
  function coverLetterStatusLabel(letter: CoverLetterState): string {
    if (letter.state === "ready" && letter.attached) return t("Filled (1/1)");
    if (letter.state === "ready") return t("Draft ready");
    if (letter.state === "drafting") return t("Drafting…");
    if (letter.state === "error") return t("Needs attention");
    return t("Filled (0/1)");
  }

  function renderCoverLetterSection(container: HTMLElement): void {
    const field = coverLetterField();
    if (!field || !isSignedIn()) return;
    const section = document.createElement("div");
    section.className = "section";
    const letter = state.coverLetter;

    // Collapsed by default (Simplify-style "Cover Letter · Filled (0/1)");
    // expands automatically once the user starts drafting.
    const header = document.createElement("button");
    header.type = "button";
    header.className = "section-toggle";
    header.setAttribute("aria-expanded", String(state.coverLetterExpanded));
    const label = document.createElement("span");
    label.className = "toggle-label";
    setText(label, t("Cover letter"));
    const status = document.createElement("span");
    status.className =
      letter.state === "ready" && letter.attached ? "chip good" : "chip";
    setText(status, coverLetterStatusLabel(letter));
    const chevron = document.createElement("span");
    chevron.className = "toggle-chevron";
    chevron.setAttribute("aria-hidden", "true");
    setText(chevron, state.coverLetterExpanded ? "⌄" : "›");
    header.append(label, status, chevron);
    header.addEventListener("click", () => {
      state.coverLetterExpanded = !state.coverLetterExpanded;
      render();
    });
    section.append(header);

    if (state.coverLetterExpanded) {
      const body = document.createElement("div");
      body.className = "section-toggle-body";
      const jobId = letterJobId();
      if (!jobId) {
        body.append(
          note(
            t("Save this job first; letters are written for a specific job."),
          ),
        );
      } else if (letter.state === "idle" || letter.state === "error") {
        if (letter.state === "error") body.append(note(letter.message, true));
        body.append(
          note(t("This form asks for a cover letter file.")),
          toolButton(
            t("Draft from my experience"),
            () => void draftLetter(jobId),
          ),
        );
      } else if (letter.state === "drafting") {
        body.append(note(t("Drafting from your confirmed evidence…")));
      } else {
        const box = document.createElement("div");
        box.className = "draft-box";
        const area = document.createElement("textarea");
        area.value = letter.text;
        area.style.minHeight = "160px";
        area.setAttribute("aria-label", t("Draft answer (editable)"));
        area.addEventListener("input", () => {
          letter.text = area.value;
        });
        const actions = document.createElement("div");
        actions.className = "draft-actions";
        const attach = document.createElement("button");
        attach.type = "button";
        attach.className = "primary";
        attach.disabled = letter.attaching;
        setText(
          attach,
          letter.attaching ? t("Attaching…") : t("Attach as Word file"),
        );
        attach.addEventListener("click", () => void attachLetter(field.id));
        const copy = document.createElement("button");
        copy.type = "button";
        copy.className = "secondary";
        setText(copy, t("Copy"));
        copy.addEventListener("click", () => {
          void navigator.clipboard.writeText(letter.text).then(
            () => {
              letter.notice = t("Copied.");
              render();
            },
            () => {
              letter.notice = t("Copy failed; select the text instead.");
              render();
            },
          );
        });
        actions.append(attach, copy);
        box.append(area, actions);
        if (letter.notice) box.append(note(letter.notice));
        body.append(box);
      }
      section.append(body);
    }
    container.append(section);
  }

  async function autofillThisPage(): Promise<void> {
    state.autofilling = true;
    state.autofillNotice = null;
    render();
    try {
      await inspectPage();
      if (
        state.detection.state === "ready" &&
        state.answers?.state === "ready"
      ) {
        await applyApprovedAnswers();
      } else if (
        state.detection.state === "ready" &&
        state.detection.value.status !== "APPLICATION_PAGE"
      ) {
        // Say so instead of silently doing nothing.
        state.autofillNotice = t(
          "No application form found on this page. Open the job's application form, then try again.",
        );
      } else if (state.detection.state === "error") {
        state.autofillNotice = state.detection.message;
      } else if (state.answers?.state === "error") {
        state.autofillNotice = state.answers.message;
      }
    } finally {
      state.autofilling = false;
      render();
    }
  }

  function renderAutofill(container: HTMLElement): void {
    if (!isSignedIn()) return;
    const wrap = document.createElement("div");
    wrap.className = "actions";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "autofill";
    button.disabled = state.autofilling;
    setText(
      button,
      state.autofilling
        ? t("Filling what CareerOS can…")
        : t("Autofill this page"),
    );
    button.addEventListener("click", () => void autofillThisPage());
    const hint = note(
      t(
        "Fills only approved answers into empty fields. You review and submit.",
      ),
    );
    wrap.append(button, hint);
    if (state.autofillNotice) wrap.append(note(state.autofillNotice, true));
    container.append(wrap);
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
    const chinese = extensionLocale() === "zh-CN";
    const languageButton = document.createElement("button");
    languageButton.type = "button";
    languageButton.className = "lang-btn";
    languageButton.textContent = chinese ? "EN" : "中";
    languageButton.setAttribute(
      "aria-label",
      chinese ? "Switch to English" : "切换到中文",
    );
    languageButton.addEventListener("click", () => {
      void saveLocale(chinese ? "en" : "zh-CN").then(() => {
        refreshLabels();
        render();
      });
    });
    const headerActions = document.createElement("div");
    headerActions.className = "header-actions";
    headerActions.append(languageButton, closeButton);
    header.append(brand, headerActions);
    panel.append(header);

    renderAuthSection(panel);
    renderPageJobSection(panel);
    renderAutofill(panel);
    renderFillSection(panel);
    renderCoverLetterSection(panel);
    renderMatchSection(panel);
    renderDetectionSection(panel);
    renderAnswersSection(panel);
    renderActions(panel);
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
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (dockState.tucked) {
      dockState.tucked = false;
      applyDock();
      saveDock();
    }
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
    await loadStoredLocale();
    refreshLabels();
    await loadDock();
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
    if (state.panelOpen) void loadPageJob();
  })();

  const destroy = (): void => {
    stopUrlWatch();
    stopLocaleSync();
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
