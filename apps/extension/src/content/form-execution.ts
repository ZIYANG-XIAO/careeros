import type {
  FillExecutionResult,
  FillFieldState,
  FillPlanField,
} from "../shared/messages";
import { t } from "../shared/i18n";
import { selectFormAdapter } from "./adapters/registry";
import {
  isInputElement,
  isSelectElement,
  isTextAreaElement,
} from "./dom-elements";
import {
  inspectFormTargets,
  type NormalizedFieldTarget,
  type SupportedControl,
} from "./form-normalization";

const MAX_FORMS = 10;
const MARKER_ATTRIBUTE = "data-careeros-marker";
const STATE_ATTRIBUTE = "data-careeros-field-state";
const STYLE_ID = "careeros-fill-state-styles";

const STATE_LABELS: Readonly<Record<FillFieldState, string>> = {
  FILLED: "CareerOS filled — review",
  REVIEW_REQUIRED: "CareerOS needs your review",
  INPUT_REQUIRED: "CareerOS needs your input",
  UNRESOLVED: "CareerOS left this unresolved",
  SKIPPED_EXISTING: "CareerOS kept your existing answer",
  FAILED: "CareerOS could not fill this field",
};

function installStyles(document: Document): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    [${STATE_ATTRIBUTE}="FILLED"] { outline: 2px solid #16a34a !important; outline-offset: 2px; }
    [${STATE_ATTRIBUTE}="REVIEW_REQUIRED"],
    [${STATE_ATTRIBUTE}="SKIPPED_EXISTING"] { outline: 2px solid #d97706 !important; outline-offset: 2px; }
    [${STATE_ATTRIBUTE}="INPUT_REQUIRED"],
    [${STATE_ATTRIBUTE}="FAILED"] { outline: 2px solid #dc2626 !important; outline-offset: 2px; }
    [${STATE_ATTRIBUTE}="UNRESOLVED"] { outline: 2px solid #64748b !important; outline-offset: 2px; }
    [${MARKER_ATTRIBUTE}] {
      display: inline-block !important;
      margin: 6px 0 8px !important;
      border-radius: 999px !important;
      padding: 4px 8px !important;
      background: #eff6ff !important;
      color: #1e3a8a !important;
      font: 600 12px/1.2 system-ui, sans-serif !important;
    }
  `;
  (document.head ?? document.documentElement).append(style);
}

function clearPreviousState(document: Document): void {
  document
    .querySelectorAll(`[${MARKER_ATTRIBUTE}]`)
    .forEach((element) => element.remove());
  document
    .querySelectorAll(`[${STATE_ATTRIBUTE}]`)
    .forEach((element) => element.removeAttribute(STATE_ATTRIBUTE));
}

function markTarget(
  document: Document,
  target: NormalizedFieldTarget,
  state: FillFieldState,
  pickHint: string | null = null,
): void {
  const firstControl = target.controls[0];
  const visualTarget =
    target.field.controlType === "RADIO_GROUP"
      ? (firstControl.closest("fieldset") ?? firstControl)
      : firstControl;
  visualTarget.setAttribute(STATE_ATTRIBUTE, state);
  const previous = visualTarget.nextElementSibling;
  if (previous?.hasAttribute(MARKER_ATTRIBUTE)) previous.remove();
  const marker = document.createElement("span");
  marker.setAttribute(MARKER_ATTRIBUTE, "true");
  marker.setAttribute("role", "status");
  marker.textContent = pickHint
    ? `${t(STATE_LABELS[state])} · ${t("Choose: {value}", { value: pickHint })}`
    : t(STATE_LABELS[state]);
  visualTarget.insertAdjacentElement("afterend", marker);
}

function setNativeValue(
  control: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  // Use the control's OWN window's constructors: a same-origin iframe has a
  // distinct realm, so the top frame's HTMLInputElement is a different
  // object from the iframe's, and its prototype would not match.
  const view = control.ownerDocument.defaultView ?? window;
  const prototype = isTextAreaElement(control)
    ? view.HTMLTextAreaElement.prototype
    : view.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(control, value);
  else control.value = value;
}

function notifyFrameworks(control: SupportedControl): void {
  control.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  control.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
}

function hasExistingValue(control: SupportedControl): boolean {
  if (isSelectElement(control)) return control.value.trim().length > 0;
  if (isInputElement(control) && ["radio", "checkbox"].includes(control.type)) {
    return control.checked;
  }
  return control.value.trim().length > 0;
}

/**
 * Script-driven dropdowns (react-select, Workday listboxes) render a text
 * input with combobox semantics. Typing into one does not select an option,
 * so it must never be reported as filled. Choosing the option means
 * simulating clicks, which waits on real-site validation (docs/ROADMAP.md);
 * until then the user picks it, with the approved value shown beside it.
 */
export function isScriptedCombobox(control: SupportedControl): boolean {
  if (!isInputElement(control)) return false;
  const role = control.getAttribute("role");
  const autocomplete = control.getAttribute("aria-autocomplete");
  const popup = control.getAttribute("aria-haspopup");
  return (
    role === "combobox" ||
    autocomplete === "list" ||
    autocomplete === "both" ||
    popup === "listbox"
  );
}

function fillTextControl(
  control: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): FillFieldState {
  if (control.disabled || control.readOnly || control.type === "file") {
    return "REVIEW_REQUIRED";
  }
  if (hasExistingValue(control)) return "SKIPPED_EXISTING";
  if (control.maxLength >= 0 && value.length > control.maxLength)
    return "FAILED";
  setNativeValue(control, value);
  if (control.value !== value) return "FAILED";
  notifyFrameworks(control);
  return "FILLED";
}

function fillSelect(control: HTMLSelectElement, value: string): FillFieldState {
  if (control.disabled) return "REVIEW_REQUIRED";
  if (hasExistingValue(control)) return "SKIPPED_EXISTING";
  const normalized = value.trim().toLocaleLowerCase();
  const option = Array.from(control.options).find(
    (candidate) =>
      candidate.textContent?.trim().toLocaleLowerCase() === normalized ||
      candidate.value.trim().toLocaleLowerCase() === normalized,
  );
  if (!option || option.disabled) return "FAILED";
  control.value = option.value;
  notifyFrameworks(control);
  return control.value === option.value ? "FILLED" : "FAILED";
}

function fillRadioGroup(
  target: NormalizedFieldTarget,
  value: string,
): FillFieldState {
  if (target.controls.some(hasExistingValue)) return "SKIPPED_EXISTING";
  const normalized = value.trim().toLocaleLowerCase();
  const optionIndex = target.field.options.findIndex(
    (option) => option.label.trim().toLocaleLowerCase() === normalized,
  );
  const control = target.controls[optionIndex];
  if (!control || !isInputElement(control) || control.disabled) {
    return "FAILED";
  }
  const view = control.ownerDocument.defaultView ?? window;
  const setter = Object.getOwnPropertyDescriptor(
    view.HTMLInputElement.prototype,
    "checked",
  )?.set;
  if (setter) setter.call(control, true);
  else control.checked = true;
  notifyFrameworks(control);
  return control.checked ? "FILLED" : "FAILED";
}

function applyApprovedAnswer(
  target: NormalizedFieldTarget,
  value: string,
): FillFieldState {
  const control = target.controls[0];
  if (target.field.controlType === "RADIO_GROUP") {
    return fillRadioGroup(target, value);
  }
  if (isSelectElement(control)) return fillSelect(control, value);
  if (isInputElement(control) && ["checkbox", "file"].includes(control.type)) {
    return "REVIEW_REQUIRED";
  }
  return fillTextControl(
    control as HTMLInputElement | HTMLTextAreaElement,
    value,
  );
}

function stateWithoutFill(action: FillPlanField["action"]): FillFieldState {
  if (action === "SUGGEST" || action === "CONFIRM") return "REVIEW_REQUIRED";
  if (action === "ASK") return "INPUT_REQUIRED";
  return "UNRESOLVED";
}

export function applyFillPlan(
  document: Document,
  pageUrl: string,
  fields: FillPlanField[],
): FillExecutionResult {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return {
      fields: fields.map((field) => ({
        fieldId: field.fieldId,
        state: "FAILED",
      })),
    };
  }

  const adapter = selectFormAdapter(document, url);
  const forms = adapter.findForms(document, url).slice(0, MAX_FORMS);
  const targets = new Map(
    forms.flatMap((form, formIndex) =>
      inspectFormTargets(form, formIndex).map(
        (target) => [target.field.id, target] as const,
      ),
    ),
  );
  clearPreviousState(document);
  installStyles(document);

  return {
    fields: fields.map((field) => {
      const target = targets.get(field.fieldId);
      if (
        !target ||
        target.field.canonicalKey !== field.canonicalKey ||
        target.field.controlType !== field.controlType
      ) {
        return { fieldId: field.fieldId, state: "FAILED" };
      }
      const combobox = isScriptedCombobox(target.controls[0]);
      const pickHint =
        combobox && field.action === "FILL" ? field.proposedAnswer : null;
      const state =
        field.action === "FILL" && field.proposedAnswer !== null
          ? combobox
            ? hasExistingValue(target.controls[0])
              ? "SKIPPED_EXISTING"
              : "REVIEW_REQUIRED"
            : applyApprovedAnswer(target, field.proposedAnswer)
          : stateWithoutFill(field.action);
      markTarget(
        document,
        target,
        state,
        state === "REVIEW_REQUIRED" ? pickHint : null,
      );
      return { fieldId: field.fieldId, state };
    }),
  };
}

function findTarget(
  document: Document,
  pageUrl: string,
  fieldId: string,
): NormalizedFieldTarget | null {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return null;
  }
  const adapter = selectFormAdapter(document, url);
  const forms = adapter.findForms(document, url).slice(0, MAX_FORMS);
  for (const [formIndex, form] of forms.entries()) {
    const target = inspectFormTargets(form, formIndex).find(
      (candidate) => candidate.field.id === fieldId,
    );
    if (target) return target;
  }
  return null;
}

/** Whether the user has answered a field yet (used by the review checklist). */
export function fieldHasValue(
  document: Document,
  pageUrl: string,
  fieldId: string,
): boolean {
  const target = findTarget(document, pageUrl, fieldId);
  return Boolean(target?.controls.some(hasExistingValue));
}

/** Scroll a field into view and focus it so the user can answer it. */
export function focusField(
  document: Document,
  pageUrl: string,
  fieldId: string,
): boolean {
  const target = findTarget(document, pageUrl, fieldId);
  const control = target?.controls[0];
  if (!control) return false;
  control.scrollIntoView({ block: "center", behavior: "smooth" });
  control.focus({ preventScroll: true });
  return true;
}

/**
 * Put a draft the user explicitly approved into one empty text field. Never
 * overwrites an existing answer, never touches other controls, never submits.
 */
export function fillDraftedAnswer(
  document: Document,
  pageUrl: string,
  fieldId: string,
  text: string,
): FillFieldState {
  const target = findTarget(document, pageUrl, fieldId);
  const control = target?.controls[0];
  if (
    !target ||
    !control ||
    !(
      isTextAreaElement(control) ||
      (isInputElement(control) && ["text", ""].includes(control.type))
    ) ||
    isScriptedCombobox(control)
  ) {
    return "FAILED";
  }
  installStyles(document);
  const state = fillTextControl(control, text);
  markTarget(document, target, state);
  return state;
}
