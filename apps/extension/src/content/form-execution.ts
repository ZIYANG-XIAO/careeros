import type {
  FillExecutionResult,
  FillFieldState,
  FillPlanField,
} from "../shared/messages";
import { selectFormAdapter } from "./adapters/registry";
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
): void {
  const firstControl = target.controls[0];
  const visualTarget =
    target.field.controlType === "RADIO_GROUP"
      ? (firstControl.closest("fieldset") ?? firstControl)
      : firstControl;
  visualTarget.setAttribute(STATE_ATTRIBUTE, state);
  const marker = document.createElement("span");
  marker.setAttribute(MARKER_ATTRIBUTE, "true");
  marker.setAttribute("role", "status");
  marker.textContent = STATE_LABELS[state];
  visualTarget.insertAdjacentElement("afterend", marker);
}

function setNativeValue(
  control: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const prototype =
    control instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(control, value);
  else control.value = value;
}

function notifyFrameworks(control: SupportedControl): void {
  control.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  control.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
}

function hasExistingValue(control: SupportedControl): boolean {
  if (control instanceof HTMLSelectElement)
    return control.value.trim().length > 0;
  if (
    control instanceof HTMLInputElement &&
    ["radio", "checkbox"].includes(control.type)
  ) {
    return control.checked;
  }
  return control.value.trim().length > 0;
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
  if (!(control instanceof HTMLInputElement) || control.disabled)
    return "FAILED";
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
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
  if (control instanceof HTMLSelectElement) return fillSelect(control, value);
  if (
    control instanceof HTMLInputElement &&
    ["checkbox", "file"].includes(control.type)
  ) {
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
      const state =
        field.action === "FILL" && field.proposedAnswer !== null
          ? applyApprovedAnswer(target, field.proposedAnswer)
          : stateWithoutFill(field.action);
      markTarget(document, target, state);
      return { fieldId: field.fieldId, state };
    }),
  };
}
