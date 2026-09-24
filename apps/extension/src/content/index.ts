import { detectApplicationPage } from "./detection";
import { applyFillPlan } from "./form-execution";
import { parseContentRequest } from "../shared/messages";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const request = parseContentRequest(message);
  if (sender.id !== chrome.runtime.id || !request) {
    return false;
  }

  sendResponse({
    ok: true,
    data:
      request.type === "CAREEROS_INSPECT_PAGE"
        ? detectApplicationPage(document, window.location.href)
        : applyFillPlan(document, window.location.href, request.fields),
  });
  return false;
});
