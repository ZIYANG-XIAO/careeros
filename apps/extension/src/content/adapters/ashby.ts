import type { FormAdapter } from "./types";
import { candidateForms } from "./types";

export const ashbyFormAdapter: FormAdapter = {
  id: "ashby",
  matches: (_document, url) =>
    url.hostname === "jobs.ashbyhq.com" ||
    url.hostname.endsWith(".ashbyhq.com"),
  findForms(document) {
    const specific = candidateForms(
      document,
      "form[data-testid*='application'], form[action*='application']",
    );
    return specific.length > 0 ? specific : candidateForms(document, "form");
  },
};
