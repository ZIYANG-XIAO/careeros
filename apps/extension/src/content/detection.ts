import type { PageDetection } from "../shared/messages";

const APPLICATION_PATH_PATTERN = /(?:apply|application|career|job|position)/i;
const APPLICATION_TEXT_PATTERN =
  /(?:apply|application|resume|curriculum vitae|cover letter)/i;

export function detectApplicationPage(
  document: Document,
  pageUrl: string,
): PageDetection {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return {
      status: "UNSUPPORTED_PAGE",
      adapter: null,
      reasons: ["The current page URL is invalid."],
    };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      status: "UNSUPPORTED_PAGE",
      adapter: null,
      reasons: ["CareerOS only inspects normal web pages."],
    };
  }

  const forms = Array.from(document.querySelectorAll("form"));
  if (forms.length === 0) {
    return {
      status: "NOT_APPLICATION_PAGE",
      adapter: null,
      reasons: ["No form was found on this page."],
    };
  }

  const hasApplicationPath = APPLICATION_PATH_PATTERN.test(
    `${url.hostname}${url.pathname}`,
  );
  const hasApplicationText = forms.some((form) =>
    APPLICATION_TEXT_PATTERN.test(
      [
        form.getAttribute("aria-label") ?? "",
        form.getAttribute("name") ?? "",
        form.textContent?.slice(0, 2_000) ?? "",
      ].join(" "),
    ),
  );
  const hasCandidateFields = forms.some(
    (form) =>
      form.querySelectorAll("input, select, textarea, button").length >= 2,
  );

  if (hasCandidateFields && (hasApplicationPath || hasApplicationText)) {
    return {
      status: "APPLICATION_PAGE",
      adapter: "generic",
      reasons: ["A likely application form is present."],
    };
  }

  return {
    status: "NOT_APPLICATION_PAGE",
    adapter: null,
    reasons: ["A form exists, but it does not look like an application yet."],
  };
}
