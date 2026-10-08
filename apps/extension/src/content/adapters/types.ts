import type { FormAdapterId } from "../../shared/messages";

export interface FormAdapter {
  id: FormAdapterId;
  matches(document: Document, url: URL): boolean;
  /** Form-like containers; single-page ATSs such as Workday use no <form>. */
  findForms(document: Document, url: URL): HTMLElement[];
}

const MAX_IFRAME_DEPTH = 4;

/**
 * Some ATSs (notably legacy iCIMS, Taleo, and SuccessFactors skins) embed the
 * application form in a same-origin <iframe> rather than the top document.
 * Cross-origin iframes cannot be reached without extra host permissions and
 * real-site validation (tracked separately); `contentDocument` is simply null
 * for those, so this stays within the extension's existing access.
 */
export function sameOriginDocuments(document: Document, depth = 0): Document[] {
  if (depth >= MAX_IFRAME_DEPTH) return [document];
  const docs = [document];
  for (const iframe of Array.from(document.querySelectorAll("iframe"))) {
    let inner: Document | null = null;
    try {
      inner = iframe.contentDocument;
    } catch {
      inner = null;
    }
    if (inner && inner !== document) {
      docs.push(...sameOriginDocuments(inner, depth + 1));
    }
  }
  return docs;
}

export function candidateForms(
  document: Document,
  selectors: string,
): HTMLElement[] {
  return sameOriginDocuments(document).flatMap((doc) =>
    Array.from(doc.querySelectorAll<HTMLElement>(selectors)).filter(
      (form) => form.querySelectorAll("input, select, textarea").length > 0,
    ),
  );
}
