import { CareerOsApiClient } from "./api-client";
import { tokenProvider } from "./auth";
import {
  ATS_ORIGIN_PATTERNS,
  AUTO_LAUNCHER_SCRIPT_ID,
  AUTO_LAUNCHER_STORAGE_KEY,
} from "../shared/ats-hosts";
import { companyIconKey } from "../shared/company-key";
import {
  parsePopupRequest,
  type AnswerResolution,
  type ApplicationPageContext,
  type AuthStatus,
  type AttachResumeResult,
  type ClippedJob,
  type JobDraft,
  type AutoLauncherState,
  type DraftedAnswer,
  type PageJob,
  type SavedReusableAnswers,
  type TypedCustomAnswer,
  type ExtensionResponse,
  type FillExecutionResult,
  type PageDetection,
  type TrackedApplication,
} from "../shared/messages";

const api = new CareerOsApiClient(__CAREEROS_API_URL__, tokenProvider);

type PinnedTab = {
  tabId: number;
  tabUrl: string;
  tabTitle?: string;
};

function isSupportedPageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function resolveActiveTab(): Promise<PinnedTab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !isSupportedPageUrl(tab.url)) {
    return null;
  }
  return { tabId: tab.id, tabUrl: tab.url, tabTitle: tab.title ?? "" };
}

async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "CAREEROS_INSPECT_PAGE" });
    return true;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
      return true;
    } catch {
      return false;
    }
  }
}

async function activateAssistantOnPinnedTab(
  tabId: number,
  tabUrl: string,
): Promise<ExtensionResponse<{ active: boolean }>> {
  if (!isSupportedPageUrl(tabUrl)) {
    return { ok: false, error: "UNSUPPORTED_PAGE" };
  }

  const ready = await ensureContentScript(tabId);
  if (!ready) return { ok: false, error: "UNAVAILABLE" };

  try {
    return (await chrome.tabs.sendMessage(tabId, {
      type: "CAREEROS_ACTIVATE_ASSISTANT",
    })) as ExtensionResponse<{ active: boolean }>;
  } catch {
    return { ok: false, error: "UNAVAILABLE" };
  }
}

async function activateAssistantOnActiveTab(): Promise<
  ExtensionResponse<{ active: boolean }>
> {
  const tab = await resolveActiveTab();
  if (!tab) {
    return { ok: false, error: "UNSUPPORTED_PAGE" };
  }
  return activateAssistantOnPinnedTab(tab.tabId, tab.tabUrl);
}

async function inspectActivePage(
  tabId: number,
  tabUrl: string,
): Promise<ExtensionResponse<PageDetection>> {
  if (!isSupportedPageUrl(tabUrl)) {
    return { ok: false, error: "UNSUPPORTED_PAGE" };
  }

  try {
    const ready = await ensureContentScript(tabId);
    if (!ready) return { ok: false, error: "UNAVAILABLE" };
    return (await chrome.tabs.sendMessage(tabId, {
      type: "CAREEROS_INSPECT_PAGE",
    })) as ExtensionResponse<PageDetection>;
  } catch {
    return { ok: false, error: "UNAVAILABLE" };
  }
}

async function isStalePage(
  tabId: number,
  expectedPageUrl: string,
): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab.url !== expectedPageUrl;
  } catch {
    return true;
  }
}

function extractTabBinding(
  request: NonNullable<ReturnType<typeof parsePopupRequest>>,
): { tabId: number; tabUrl: string } | null {
  const rec = request as Record<string, unknown>;
  const tabId = typeof rec.expectedTabId === "number" ? rec.expectedTabId : 0;
  const tabUrl =
    typeof rec.expectedPageUrl === "string" ? rec.expectedPageUrl : "";
  if (tabId <= 0 || !tabUrl || !isSupportedPageUrl(tabUrl)) return null;
  return { tabId, tabUrl };
}

async function applyActivePageFillPlan(
  tabId: number,
  tabUrl: string,
  fields: Extract<
    ReturnType<typeof parsePopupRequest>,
    { type: "CAREEROS_APPLY_FILL_PLAN" }
  >["fields"],
  expectedPageUrl: string,
): Promise<ExtensionResponse<FillExecutionResult>> {
  if (!isSupportedPageUrl(tabUrl)) {
    return { ok: false, error: "UNSUPPORTED_PAGE" };
  }
  if (expectedPageUrl !== tabUrl) {
    return { ok: false, error: "STALE_PAGE" };
  }
  if (await isStalePage(tabId, expectedPageUrl)) {
    return { ok: false, error: "STALE_PAGE" };
  }
  try {
    return (await chrome.tabs.sendMessage(tabId, {
      type: "CAREEROS_APPLY_FILL_PLAN",
      fields,
      expectedPageUrl,
    })) as ExtensionResponse<FillExecutionResult>;
  } catch {
    return { ok: false, error: "UNAVAILABLE" };
  }
}

async function getApplicationContext(
  _tabId: number,
  tabUrl: string,
  tabTitle = "",
): Promise<ExtensionResponse<ApplicationPageContext>> {
  if (!isSupportedPageUrl(tabUrl)) {
    return { ok: false, error: "UNSUPPORTED_PAGE" };
  }
  const context = await api.getApplicationContext(tabUrl, tabTitle);
  return context
    ? { ok: true, data: context }
    : { ok: false, error: "UNAUTHENTICATED" };
}

async function recordApplication(
  tabId: number,
  tabUrl: string,
  request: Extract<
    ReturnType<typeof parsePopupRequest>,
    { type: "CAREEROS_RECORD_APPLICATION" }
  >,
): Promise<ExtensionResponse<TrackedApplication>> {
  if (!isSupportedPageUrl(tabUrl)) {
    return { ok: false, error: "UNSUPPORTED_PAGE" };
  }
  if (!request.expectedPageUrl) {
    return { ok: false, error: "STALE_PAGE" };
  }
  if (request.expectedPageUrl !== tabUrl) {
    return { ok: false, error: "STALE_PAGE" };
  }
  if (await isStalePage(tabId, request.expectedPageUrl)) {
    return { ok: false, error: "STALE_PAGE" };
  }
  const application = await api.recordApplication(request, tabUrl);
  return application
    ? { ok: true, data: application }
    : { ok: false, error: "UNAUTHENTICATED" };
}

async function prepareApplication(
  tabId: number,
  tabUrl: string,
  request: Extract<
    ReturnType<typeof parsePopupRequest>,
    { type: "CAREEROS_PREPARE_APPLICATION" }
  >,
): Promise<ExtensionResponse<TrackedApplication>> {
  if (!isSupportedPageUrl(tabUrl)) {
    return { ok: false, error: "UNSUPPORTED_PAGE" };
  }
  if (!request.expectedPageUrl) {
    return { ok: false, error: "STALE_PAGE" };
  }
  if (request.expectedPageUrl !== tabUrl) {
    return { ok: false, error: "STALE_PAGE" };
  }
  if (await isStalePage(tabId, request.expectedPageUrl)) {
    return { ok: false, error: "STALE_PAGE" };
  }
  const application = await api.prepareApplication(request, tabUrl);
  return application
    ? { ok: true, data: application }
    : { ok: false, error: "UNAUTHENTICATED" };
}

async function extractJobFromPage(
  tabId: number,
  tabUrl: string,
): Promise<ExtensionResponse<JobDraft>> {
  if (!isSupportedPageUrl(tabUrl)) {
    return { ok: false, error: "UNSUPPORTED_PAGE" };
  }
  const ready = await ensureContentScript(tabId);
  if (!ready) return { ok: false, error: "UNAVAILABLE" };
  try {
    const response = (await chrome.tabs.sendMessage(tabId, {
      type: "CAREEROS_EXTRACT_JOB",
    })) as ExtensionResponse<JobDraft>;
    if (response.ok && response.data.pageUrl !== tabUrl) {
      return { ok: false, error: "STALE_PAGE" };
    }
    return response;
  } catch {
    return { ok: false, error: "UNAVAILABLE" };
  }
}

async function readCustomAnswers(
  tabId: number,
  tabUrl: string,
): Promise<ExtensionResponse<TypedCustomAnswer[]>> {
  if (!isSupportedPageUrl(tabUrl)) {
    return { ok: false, error: "UNSUPPORTED_PAGE" };
  }
  const ready = await ensureContentScript(tabId);
  if (!ready) return { ok: false, error: "UNAVAILABLE" };
  try {
    return (await chrome.tabs.sendMessage(tabId, {
      type: "CAREEROS_READ_CUSTOM_ANSWERS",
    })) as ExtensionResponse<TypedCustomAnswer[]>;
  } catch {
    return { ok: false, error: "UNAVAILABLE" };
  }
}

async function attachResume(
  tabId: number,
  tabUrl: string,
  request: Extract<
    ReturnType<typeof parsePopupRequest>,
    { type: "CAREEROS_ATTACH_RESUME" }
  >,
): Promise<ExtensionResponse<AttachResumeResult>> {
  if (!isSupportedPageUrl(tabUrl)) {
    return { ok: false, error: "UNSUPPORTED_PAGE" };
  }
  if (
    request.expectedPageUrl !== tabUrl ||
    (await isStalePage(tabId, request.expectedPageUrl))
  ) {
    return { ok: false, error: "STALE_PAGE" };
  }
  const file = await api.downloadResumeVersion(request.resumeVersionId);
  if (!file) return { ok: false, error: "UNAUTHENTICATED" };
  const ready = await ensureContentScript(tabId);
  if (!ready) return { ok: false, error: "UNAVAILABLE" };
  try {
    return (await chrome.tabs.sendMessage(tabId, {
      type: "CAREEROS_ATTACH_RESUME",
      fieldId: request.fieldId,
      expectedPageUrl: request.expectedPageUrl,
      ...file,
    })) as ExtensionResponse<AttachResumeResult>;
  } catch {
    return { ok: false, error: "UNAVAILABLE" };
  }
}

async function clipJob(
  tabId: number,
  tabUrl: string,
  request: Extract<
    ReturnType<typeof parsePopupRequest>,
    { type: "CAREEROS_CLIP_JOB" }
  >,
): Promise<ExtensionResponse<ClippedJob>> {
  if (!isSupportedPageUrl(tabUrl)) {
    return { ok: false, error: "UNSUPPORTED_PAGE" };
  }
  if (request.expectedPageUrl !== tabUrl) {
    return { ok: false, error: "STALE_PAGE" };
  }
  if (await isStalePage(tabId, request.expectedPageUrl)) {
    return { ok: false, error: "STALE_PAGE" };
  }
  const clipped = await api.clipJob(request, tabUrl);
  return clipped
    ? { ok: true, data: clipped }
    : { ok: false, error: "UNAUTHENTICATED" };
}

// ---------------------------------------------------------------------------
// Opt-in launcher on career sites
// ---------------------------------------------------------------------------

const ATS_PERMISSION = { origins: [...ATS_ORIGIN_PATTERNS] };

async function syncAutoLauncher(): Promise<AutoLauncherState> {
  const stored = await chrome.storage.local.get(AUTO_LAUNCHER_STORAGE_KEY);
  const wanted = stored[AUTO_LAUNCHER_STORAGE_KEY] === true;
  const granted = await chrome.permissions.contains(ATS_PERMISSION);
  const registered = await chrome.scripting.getRegisteredContentScripts({
    ids: [AUTO_LAUNCHER_SCRIPT_ID],
  });
  const enabled = wanted && granted;
  if (enabled && registered.length === 0) {
    await chrome.scripting.registerContentScripts([
      {
        id: AUTO_LAUNCHER_SCRIPT_ID,
        matches: [...ATS_ORIGIN_PATTERNS],
        js: ["content.js"],
        runAt: "document_idle",
      },
    ]);
  } else if (!enabled && registered.length > 0) {
    await chrome.scripting.unregisterContentScripts({
      ids: [AUTO_LAUNCHER_SCRIPT_ID],
    });
  }
  return { enabled };
}

async function setAutoLauncher(enabled: boolean): Promise<AutoLauncherState> {
  await chrome.storage.local.set({ [AUTO_LAUNCHER_STORAGE_KEY]: enabled });
  if (!enabled) {
    await syncAutoLauncher();
    // Give the career-site access back; nothing else uses it.
    await chrome.permissions.remove(ATS_PERMISSION).catch(() => false);
    return { enabled: false };
  }
  return syncAutoLauncher();
}

chrome.runtime.onStartup?.addListener(() => void syncAutoLauncher());
chrome.permissions?.onRemoved?.addListener(() => void syncAutoLauncher());
// The popup may close while Chrome shows the permission prompt; finish the
// opt-in here once access is granted.
chrome.permissions?.onAdded?.addListener(() => void syncAutoLauncher());

async function bundledLogo(company: string): Promise<string | null> {
  const key = companyIconKey(company);
  if (!key) return null;
  try {
    const response = await fetch(
      chrome.runtime.getURL(`company-logos/${key}.png`),
    );
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:image/png;base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

async function lookupPageJob(
  tabUrl: string,
): Promise<ExtensionResponse<PageJob | null>> {
  if (!isSupportedPageUrl(tabUrl)) return { ok: true, data: null };
  const job = await api.lookupPageJob(tabUrl);
  if (job === null) return { ok: false, error: "UNAUTHENTICATED" };
  if (job === "NOT_FOUND") return { ok: true, data: null };
  return {
    ok: true,
    data: { ...job, logoDataUrl: await bundledLogo(job.company) },
  };
}

async function attachCoverLetter(
  tab: PinnedTab,
  request: Extract<
    ReturnType<typeof parsePopupRequest>,
    { type: "CAREEROS_ATTACH_COVER_LETTER" }
  >,
): Promise<ExtensionResponse<AttachResumeResult>> {
  if (
    request.expectedPageUrl !== tab.tabUrl ||
    (await isStalePage(tab.tabId, request.expectedPageUrl))
  ) {
    return { ok: false, error: "STALE_PAGE" };
  }
  const file = await api.coverLetterFile(request.text, request.filenameHint);
  if (!file) return { ok: false, error: "UNAUTHENTICATED" };
  try {
    return (await chrome.tabs.sendMessage(tab.tabId, {
      type: "CAREEROS_ATTACH_COVER_LETTER_FILE",
      fieldId: request.fieldId,
      expectedPageUrl: request.expectedPageUrl,
      ...file,
    })) as ExtensionResponse<AttachResumeResult>;
  } catch {
    return { ok: false, error: "UNAVAILABLE" };
  }
}

function respondWith<T>(
  promise: Promise<T | null>,
  sendResponse: (response: unknown) => void,
): true {
  promise
    .then((data) =>
      sendResponse(
        data === null
          ? { ok: false, error: "UNAUTHENTICATED" }
          : { ok: true, data },
      ),
    )
    .catch(() => sendResponse({ ok: false, error: "UNAVAILABLE" }));
  return true;
}

function handlePopupRequest(
  request: NonNullable<ReturnType<typeof parsePopupRequest>>,
  sendResponse: (response: unknown) => void,
  pinnedTab?: PinnedTab,
): boolean {
  if (request.type === "CAREEROS_GET_AUTH_STATUS") {
    api
      .getAuthStatus()
      .then((data) => sendResponse({ ok: true, data }))
      .catch(() => sendResponse({ ok: false, error: "UNAVAILABLE" }));
    return true;
  }

  if (request.type === "CAREEROS_RESOLVE_ANSWERS") {
    api
      .resolveAnswers(request)
      .then((data) =>
        sendResponse(
          data
            ? ({ ok: true, data } satisfies ExtensionResponse<AnswerResolution>)
            : ({
                ok: false,
                error: "UNAUTHENTICATED",
              } satisfies ExtensionResponse<AnswerResolution>),
        ),
      )
      .catch(() => sendResponse({ ok: false, error: "UNAVAILABLE" }));
    return true;
  }

  if (request.type === "CAREEROS_OPEN_SIGN_IN") {
    chrome.tabs
      .create({ url: __CAREEROS_WEB_URL__ })
      .then(() => sendResponse({ ok: true, data: { opened: true } }))
      .catch(() => sendResponse({ ok: false, error: "UNAVAILABLE" }));
    return true;
  }

  if (request.type === "CAREEROS_OPEN_APPLICATION") {
    chrome.tabs
      .create({
        url: `${__CAREEROS_WEB_URL__}/applications/${request.applicationId}`,
      })
      .then(() => sendResponse({ ok: true, data: { opened: true } }))
      .catch(() => sendResponse({ ok: false, error: "UNAVAILABLE" }));
    return true;
  }

  if (request.type === "CAREEROS_SAVE_REUSABLE_ANSWERS") {
    api
      .saveReusableAnswers(request.answers)
      .then((data) =>
        sendResponse(
          data
            ? ({
                ok: true,
                data,
              } satisfies ExtensionResponse<SavedReusableAnswers>)
            : { ok: false, error: "UNAUTHENTICATED" },
        ),
      )
      .catch(() => sendResponse({ ok: false, error: "UNAVAILABLE" }));
    return true;
  }

  if (request.type === "CAREEROS_DRAFT_ANSWER") {
    api
      .draftAnswer({ question: request.question, jobId: request.jobId })
      .then((data) =>
        sendResponse(
          data
            ? ({ ok: true, data } satisfies ExtensionResponse<DraftedAnswer>)
            : { ok: false, error: "UNAUTHENTICATED" },
        ),
      )
      .catch(() => sendResponse({ ok: false, error: "UNAVAILABLE" }));
    return true;
  }

  // Settings changes come only from the popup, never from a page.
  if (
    request.type === "CAREEROS_GET_AUTO_LAUNCHER" ||
    request.type === "CAREEROS_SET_AUTO_LAUNCHER"
  ) {
    if (pinnedTab) {
      sendResponse({ ok: false, error: "UNSUPPORTED_PAGE" });
      return false;
    }
    (request.type === "CAREEROS_SET_AUTO_LAUNCHER"
      ? setAutoLauncher(request.enabled)
      : syncAutoLauncher()
    )
      .then((data) => sendResponse({ ok: true, data }))
      .catch(() => sendResponse({ ok: false, error: "UNAVAILABLE" }));
    return true;
  }

  if (request.type === "CAREEROS_LOOKUP_PAGE_JOB") {
    void (async () => {
      const tab = pinnedTab ?? (await resolveActiveTab());
      if (!tab) {
        sendResponse({ ok: true, data: null });
        return;
      }
      try {
        sendResponse(await lookupPageJob(tab.tabUrl));
      } catch {
        sendResponse({ ok: false, error: "UNAVAILABLE" });
      }
    })();
    return true;
  }

  if (request.type === "CAREEROS_GET_JOB_MATCH") {
    return respondWith(api.getJobMatch(request.jobId), sendResponse);
  }

  if (request.type === "CAREEROS_ANALYZE_JOB") {
    return respondWith(
      api.analyzeJob(request.jobId, request.resumeVersionId),
      sendResponse,
    );
  }

  if (request.type === "CAREEROS_DRAFT_COVER_LETTER") {
    return respondWith(api.draftCoverLetter(request.jobId), sendResponse);
  }

  if (request.type === "CAREEROS_ATTACH_COVER_LETTER") {
    if (!pinnedTab) {
      sendResponse({ ok: false, error: "STALE_PAGE" });
      return false;
    }
    attachCoverLetter(pinnedTab, request)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, error: "UNAVAILABLE" }));
    return true;
  }

  if (request.type === "CAREEROS_OPEN_MATERIALS") {
    chrome.tabs
      .create({
        url: `${__CAREEROS_WEB_URL__}/materials/${request.jobId}?tab=${request.tab}`,
      })
      .then(() => sendResponse({ ok: true, data: { opened: true } }))
      .catch(() => sendResponse({ ok: false, error: "UNAVAILABLE" }));
    return true;
  }

  if (request.type === "CAREEROS_OPEN_JOB") {
    chrome.tabs
      .create({
        url: `${__CAREEROS_WEB_URL__}/discover?focus=${request.jobId}`,
      })
      .then(() => sendResponse({ ok: true, data: { opened: true } }))
      .catch(() => sendResponse({ ok: false, error: "UNAVAILABLE" }));
    return true;
  }

  void (async () => {
    try {
      if (request.type === "CAREEROS_GET_TAB_CONTEXT") {
        const resolved = pinnedTab ?? (await resolveActiveTab());
        if (!resolved) {
          sendResponse({ ok: false, error: "UNSUPPORTED_PAGE" });
          return;
        }
        sendResponse({
          ok: true,
          data: { tabId: resolved.tabId, tabUrl: resolved.tabUrl },
        });
        return;
      }

      let tab: PinnedTab;
      if (pinnedTab) {
        tab = pinnedTab;
      } else {
        const bound = extractTabBinding(request);
        if (!bound) {
          sendResponse({ ok: false, error: "STALE_PAGE" });
          return;
        }
        try {
          const verified = await chrome.tabs.get(bound.tabId);
          if (verified.url !== bound.tabUrl) {
            sendResponse({ ok: false, error: "STALE_PAGE" });
            return;
          }
          tab = {
            tabId: bound.tabId,
            tabUrl: bound.tabUrl,
            tabTitle: verified.title ?? "",
          };
        } catch {
          sendResponse({ ok: false, error: "STALE_PAGE" });
          return;
        }
      }

      if (request.type === "CAREEROS_APPLY_FILL_PLAN") {
        if (!request.expectedPageUrl) {
          sendResponse({ ok: false, error: "STALE_PAGE" });
          return;
        }
        sendResponse(
          await applyActivePageFillPlan(
            tab.tabId,
            tab.tabUrl,
            request.fields,
            request.expectedPageUrl,
          ),
        );
        return;
      }

      if (request.type === "CAREEROS_GET_APPLICATION_CONTEXT") {
        sendResponse(
          await getApplicationContext(
            tab.tabId,
            tab.tabUrl,
            tab.tabTitle ?? "",
          ),
        );
        return;
      }

      if (request.type === "CAREEROS_RECORD_APPLICATION") {
        sendResponse(await recordApplication(tab.tabId, tab.tabUrl, request));
        return;
      }

      if (request.type === "CAREEROS_PREPARE_APPLICATION") {
        sendResponse(await prepareApplication(tab.tabId, tab.tabUrl, request));
        return;
      }

      if (request.type === "CAREEROS_ACTIVATE_ASSISTANT") {
        sendResponse(await activateAssistantOnPinnedTab(tab.tabId, tab.tabUrl));
        return;
      }

      if (request.type === "CAREEROS_EXTRACT_JOB") {
        sendResponse(await extractJobFromPage(tab.tabId, tab.tabUrl));
        return;
      }

      if (request.type === "CAREEROS_READ_CUSTOM_ANSWERS") {
        sendResponse(await readCustomAnswers(tab.tabId, tab.tabUrl));
        return;
      }

      if (request.type === "CAREEROS_ATTACH_RESUME") {
        sendResponse(await attachResume(tab.tabId, tab.tabUrl, request));
        return;
      }

      if (request.type === "CAREEROS_CLIP_JOB") {
        sendResponse(await clipJob(tab.tabId, tab.tabUrl, request));
        return;
      }

      sendResponse(await inspectActivePage(tab.tabId, tab.tabUrl));
    } catch {
      sendResponse({ ok: false, error: "UNAVAILABLE" });
    }
  })();

  return true;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  const request = parsePopupRequest(message);
  if (!request) return false;

  // Popup pages have no sender.tab. The in-page assistant runs in a content
  // script and delegates privileged work here without exposing credentials.
  if (sender.tab && request.type === "CAREEROS_ACTIVATE_ASSISTANT") {
    return false;
  }

  const pinnedTab =
    sender.tab?.id && sender.tab.url
      ? {
          tabId: sender.tab.id,
          tabUrl: sender.tab.url,
          tabTitle: sender.tab.title ?? "",
        }
      : undefined;

  return handlePopupRequest(request, sendResponse, pinnedTab);
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "activate-assistant") {
    void activateAssistantOnActiveTab();
  }
});
