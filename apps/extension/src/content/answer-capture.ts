import type { TypedCustomAnswer } from "../shared/messages";
import { selectFormAdapter } from "./adapters/registry";
import {
  inspectFormTargets,
  type NormalizedFieldTarget,
} from "./form-normalization";

const MAX_FORMS = 10;
const MAX_ANSWERS = 50;
const CAPTURABLE = new Set([
  "TEXT",
  "TEXTAREA",
  "SELECT",
  "RADIO_GROUP",
  "NUMBER",
]);

function currentAnswer(target: NormalizedFieldTarget): string {
  if (target.field.controlType === "RADIO_GROUP") {
    const index = target.controls.findIndex(
      (control) => control instanceof HTMLInputElement && control.checked,
    );
    return index >= 0 ? (target.field.options[index]?.label ?? "") : "";
  }
  const control = target.controls[0];
  if (control instanceof HTMLSelectElement) {
    const option = control.selectedOptions[0];
    return control.value ? (option?.textContent ?? "").trim() : "";
  }
  return control.value.trim();
}

/**
 * Reads what the user typed into custom (non-canonical) questions so they can
 * choose which answers to save for reuse. Called only on explicit user action;
 * nothing is saved without a second confirmation in the popup.
 */
export function captureCustomAnswers(
  document: Document,
  pageUrl: string,
): TypedCustomAnswer[] {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return [];
  }
  const adapter = selectFormAdapter(document, url);
  const forms = adapter.findForms(document, url).slice(0, MAX_FORMS);
  const answers: TypedCustomAnswer[] = [];
  forms.forEach((form, formIndex) => {
    for (const target of inspectFormTargets(form, formIndex)) {
      const { field } = target;
      if (
        field.canonicalKey !== null ||
        !field.question ||
        !CAPTURABLE.has(field.controlType)
      ) {
        continue;
      }
      const answer = currentAnswer(target);
      if (!answer) continue;
      answers.push({
        fieldId: field.id,
        question: field.question.slice(0, 500),
        answer: answer.slice(0, 2000),
      });
    }
  });
  return answers.slice(0, MAX_ANSWERS);
}
