import type { PageDetection } from "../shared/messages";
import { selectFormAdapter } from "./adapters/registry";
import { normalizeForms } from "./form-normalization";

export function detectApplicationPage(
  document: Document,
  pageUrl: string,
): PageDetection {
  const formLocale = document.documentElement.lang.trim().slice(0, 35) || null;
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return {
      status: "UNSUPPORTED_PAGE",
      adapter: null,
      formLocale,
      reasons: ["The current page URL is invalid."],
      forms: [],
    };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      status: "UNSUPPORTED_PAGE",
      adapter: null,
      formLocale,
      reasons: ["CareerOS only inspects normal web pages."],
      forms: [],
    };
  }

  const adapter = selectFormAdapter(document, url);
  const forms = adapter.findForms(document, url);
  if (forms.length === 0) {
    return {
      status: "NOT_APPLICATION_PAGE",
      adapter: null,
      formLocale,
      reasons: ["No application form was found on this page."],
      forms: [],
    };
  }

  return {
    status: "APPLICATION_PAGE",
    adapter: adapter.id,
    formLocale,
    reasons: ["An application form was inspected."],
    forms: normalizeForms(forms, adapter.id),
  };
}
