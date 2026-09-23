import { detectApplicationPage } from "./detection";
import { parseContentRequest } from "../shared/messages";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !parseContentRequest(message)) {
    return false;
  }

  sendResponse({
    ok: true,
    data: detectApplicationPage(document, window.location.href),
  });
  return false;
});
