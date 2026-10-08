import type { AttachResumeResult, ResumeFilePayload } from "../shared/messages";
import { selectFormAdapter } from "./adapters/registry";
import { isInputElement } from "./dom-elements";
import { inspectFormTargets } from "./form-normalization";

const MAX_FORMS = 10;
const STATE_ATTRIBUTE = "data-careeros-field-state";

function decodeBase64(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** True when an `accept` attribute rules out this file's type or extension. */
function acceptRejects(accept: string, file: File): boolean {
  const rules = accept
    .split(",")
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean);
  if (rules.length === 0) return false;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return !rules.some((rule) => {
    if (rule.startsWith(".")) return name.endsWith(rule);
    if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

/**
 * Attaches the user's chosen resume file to one resume upload control, only on
 * explicit request. Never replaces a file the user already chose and never
 * submits the form.
 */
export function attachResumeFile(
  document: Document,
  pageUrl: string,
  fieldId: string,
  payload: ResumeFilePayload,
  expectedKey: "RESUME_FILE" | "COVER_LETTER_FILE" = "RESUME_FILE",
): AttachResumeResult {
  const failed: AttachResumeResult = { fieldId, state: "FAILED" };
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return failed;
  }
  const adapter = selectFormAdapter(document, url);
  const target = adapter
    .findForms(document, url)
    .slice(0, MAX_FORMS)
    .flatMap((form, formIndex) => inspectFormTargets(form, formIndex))
    .find((candidate) => candidate.field.id === fieldId);
  const control = target?.controls[0];
  if (
    !target ||
    target.field.canonicalKey !== expectedKey ||
    !control ||
    !isInputElement(control) ||
    control.type !== "file"
  ) {
    return failed;
  }
  if (control.disabled) return { fieldId, state: "REVIEW_REQUIRED" };
  if (control.files && control.files.length > 0) {
    return { fieldId, state: "SKIPPED_EXISTING" };
  }

  const file = new File([decodeBase64(payload.base64)], payload.fileName, {
    type: payload.contentType,
  });
  if (acceptRejects(control.accept, file)) return failed;

  const transfer = new DataTransfer();
  transfer.items.add(file);
  control.files = transfer.files;
  if (control.files?.length !== 1) return failed;
  control.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  control.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  control.setAttribute(STATE_ATTRIBUTE, "FILLED");
  return { fieldId, state: "FILLED" };
}
