import { destroyAssistant, mountAssistant } from "./assistant";
import { detectApplicationPage } from "./detection";
import { applyFillPlan } from "./form-execution";
import { parseContentRequest } from "../shared/messages";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const request = parseContentRequest(message);
  if (sender.id !== chrome.runtime.id || !request) {
    return false;
  }

  if (request.type === "CAREEROS_ACTIVATE_ASSISTANT") {
    mountAssistant();
    sendResponse({ ok: true, data: { active: true } });
    return false;
  }

  if (request.type === "CAREEROS_DEACTIVATE_ASSISTANT") {
    destroyAssistant();
    sendResponse({ ok: true, data: { active: false } });
    return false;
  }

  if (request.type === "CAREEROS_INSPECT_PAGE") {
    sendResponse({
      ok: true,
      data: detectApplicationPage(document, window.location.href),
    });
    return false;
  }

  if (request.type === "CAREEROS_APPLY_FILL_PLAN") {
    if (window.location.href !== request.expectedPageUrl) {
      sendResponse({ ok: false, error: "STALE_PAGE" });
      return false;
    }
    sendResponse({
      ok: true,
      data: applyFillPlan(document, window.location.href, request.fields),
    });
  }
  return false;
});
