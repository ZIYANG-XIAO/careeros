import type { FormAdapter } from "./types";
import { candidateForms, sameOriginDocuments } from "./types";

const APPLICATION_PATH_PATTERN =
  /(?:apply|application|career|job|position|recruit|campus|zhaopin|zhiye|mokahr)/i;
const APPLICATION_TEXT_PATTERN =
  /(?:apply|application|resume|curriculum vitae|cover letter|candidate|投递|申请职位|网申|应聘|个人简历|上传简历)/i;
const FIELD_SELECTOR =
  "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset']):not([type='image']), select, textarea";
const MIN_FORMLESS_FIELDS = 3;
// A formless page must also ask for something personal — an upload, email,
// phone, or name — so job-search filters are not mistaken for applications.
const PERSONAL_FIELD_SELECTOR =
  "input[type='file'], input[type='email'], input[type='tel'], [autocomplete*='email'], [autocomplete*='tel'], [autocomplete*='name']";

function hasApplicationSignal(element: Element, applicationPath: boolean) {
  const text = [
    element.getAttribute("aria-label") ?? "",
    element.getAttribute("name") ?? "",
    element.textContent?.slice(0, 2_000) ?? "",
  ].join(" ");
  return applicationPath || APPLICATION_TEXT_PATTERN.test(text);
}

function lowestCommonAncestor(elements: Element[]): HTMLElement | null {
  let ancestor: Element | null = elements[0] ?? null;
  while (
    ancestor &&
    !elements.every((element) => ancestor!.contains(element))
  ) {
    ancestor = ancestor.parentElement;
  }
  return ancestor instanceof HTMLElement ? ancestor : null;
}

/**
 * Many single-page ATSs (including common China-market systems) render the
 * application without a <form>. Treat the smallest element holding all the
 * page's fields as one form, but only when the page looks like an application.
 * Checked separately per same-origin document, since a container can only
 * span elements that share one document.
 */
function formlessApplication(
  document: Document,
  applicationPath: boolean,
): HTMLElement[] {
  return sameOriginDocuments(document).flatMap((doc) => {
    const fields = Array.from(doc.body?.querySelectorAll(FIELD_SELECTOR) ?? []);
    if (fields.length < MIN_FORMLESS_FIELDS) return [];
    const container = lowestCommonAncestor(fields);
    if (
      !container ||
      !container.querySelector(PERSONAL_FIELD_SELECTOR) ||
      !hasApplicationSignal(container, applicationPath)
    ) {
      return [];
    }
    return [container];
  });
}

export const genericFormAdapter: FormAdapter = {
  id: "generic",
  matches: () => true,
  findForms(document, url) {
    const applicationPath = APPLICATION_PATH_PATTERN.test(
      `${url.hostname}${url.pathname}`,
    );
    const forms = candidateForms(document, "form").filter(
      (form) =>
        form.querySelectorAll("input, select, textarea, button").length >= 2 &&
        hasApplicationSignal(form, applicationPath),
    );
    if (forms.length > 0) return forms;
    if (
      sameOriginDocuments(document).some((doc) => doc.querySelector("form"))
    ) {
      return [];
    }
    return formlessApplication(document, applicationPath);
  },
};
