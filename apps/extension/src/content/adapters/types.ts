import type { FormAdapterId } from "../../shared/messages";

export interface FormAdapter {
  id: FormAdapterId;
  matches(document: Document, url: URL): boolean;
  /** Form-like containers; single-page ATSs such as Workday use no <form>. */
  findForms(document: Document, url: URL): HTMLElement[];
}

export function candidateForms(
  document: Document,
  selectors: string,
): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(selectors)).filter(
    (form) => form.querySelectorAll("input, select, textarea").length > 0,
  );
}
