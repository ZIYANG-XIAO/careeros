import type { FormAdapterId } from "../../shared/messages";

export interface FormAdapter {
  id: FormAdapterId;
  matches(document: Document, url: URL): boolean;
  findForms(document: Document, url: URL): HTMLFormElement[];
}

export function candidateForms(
  document: Document,
  selectors: string,
): HTMLFormElement[] {
  return Array.from(
    document.querySelectorAll<HTMLFormElement>(selectors),
  ).filter(
    (form) => form.querySelectorAll("input, select, textarea").length > 0,
  );
}
