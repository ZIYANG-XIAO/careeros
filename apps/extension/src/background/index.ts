import { CareerOsApiClient } from "./api-client";
import { tokenProvider } from "./auth";
import {
  parsePopupRequest,
  type AnswerResolution,
  type ApplicationPageContext,
  type ExtensionResponse,
  type FillExecutionResult,
  type PageDetection,
  type TrackedApplication,
} from "../shared/messages";

const api = new CareerOsApiClient(__CAREEROS_API_URL__, tokenProvider);

async function inspectActivePage(): Promise<ExtensionResponse<PageDetection>> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    return { ok: false, error: "UNSUPPORTED_PAGE" };
  }

  const url = new URL(tab.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "UNSUPPORTED_PAGE" };
  }

  try {
    const request = { type: "CAREEROS_INSPECT_PAGE" };
    try {
      return (await chrome.tabs.sendMessage(
        tab.id,
        request,
      )) as ExtensionResponse<PageDetection>;
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      return (await chrome.tabs.sendMessage(
        tab.id,
        request,
      )) as ExtensionResponse<PageDetection>;
    }
  } catch {
    return { ok: false, error: "UNAVAILABLE" };
  }
}

async function applyActivePageFillPlan(
  fields: Extract<
    ReturnType<typeof parsePopupRequest>,
    { type: "CAREEROS_APPLY_FILL_PLAN" }
  >["fields"],
): Promise<ExtensionResponse<FillExecutionResult>> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) return { ok: false, error: "UNSUPPORTED_PAGE" };
  const url = new URL(tab.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "UNSUPPORTED_PAGE" };
  }
  try {
    return (await chrome.tabs.sendMessage(tab.id, {
      type: "CAREEROS_APPLY_FILL_PLAN",
      fields,
    })) as ExtensionResponse<FillExecutionResult>;
  } catch {
    return { ok: false, error: "UNAVAILABLE" };
  }
}

async function getApplicationContext(): Promise<
  ExtensionResponse<ApplicationPageContext>
> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return { ok: false, error: "UNSUPPORTED_PAGE" };
  const url = new URL(tab.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "UNSUPPORTED_PAGE" };
  }
  const context = await api.getApplicationContext(tab.url, tab.title ?? "");
  return context
    ? { ok: true, data: context }
    : { ok: false, error: "UNAUTHENTICATED" };
}

async function recordApplication(
  request: Extract<
    ReturnType<typeof parsePopupRequest>,
    { type: "CAREEROS_RECORD_APPLICATION" }
  >,
): Promise<ExtensionResponse<TrackedApplication>> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return { ok: false, error: "UNSUPPORTED_PAGE" };
  const url = new URL(tab.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "UNSUPPORTED_PAGE" };
  }
  const application = await api.recordApplication(request, tab.url);
  return application
    ? { ok: true, data: application }
    : { ok: false, error: "UNAUTHENTICATED" };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only extension-owned pages such as the popup may request privileged work.
  // Messages from content scripts carry sender.tab and are intentionally denied.
  if (sender.id !== chrome.runtime.id || sender.tab) return false;
  const request = parsePopupRequest(message);
  if (!request) return false;

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

  if (request.type === "CAREEROS_APPLY_FILL_PLAN") {
    applyActivePageFillPlan(request.fields)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, error: "UNAVAILABLE" }));
    return true;
  }

  if (request.type === "CAREEROS_GET_APPLICATION_CONTEXT") {
    getApplicationContext()
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, error: "UNAVAILABLE" }));
    return true;
  }

  if (request.type === "CAREEROS_RECORD_APPLICATION") {
    recordApplication(request)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, error: "UNAVAILABLE" }));
    return true;
  }

  inspectActivePage()
    .then(sendResponse)
    .catch(() => sendResponse({ ok: false, error: "UNAVAILABLE" }));
  return true;
});
