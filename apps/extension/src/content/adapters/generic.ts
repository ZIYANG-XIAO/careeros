import type { FormAdapter } from "./types";
import { candidateForms } from "./types";

const APPLICATION_PATH_PATTERN = /(?:apply|application|career|job|position)/i;
const APPLICATION_TEXT_PATTERN =
  /(?:apply|application|resume|curriculum vitae|cover letter|candidate)/i;

export const genericFormAdapter: FormAdapter = {
  id: "generic",
  matches: () => true,
  findForms(document, url) {
    const applicationPath = APPLICATION_PATH_PATTERN.test(
      `${url.hostname}${url.pathname}`,
    );
    return candidateForms(document, "form").filter((form) => {
      if (form.querySelectorAll("input, select, textarea, button").length < 2) {
        return false;
      }
      const text = [
        form.getAttribute("aria-label") ?? "",
        form.getAttribute("name") ?? "",
        form.textContent?.slice(0, 2_000) ?? "",
      ].join(" ");
      return applicationPath || APPLICATION_TEXT_PATTERN.test(text);
    });
  },
};
