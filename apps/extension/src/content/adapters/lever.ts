import type { FormAdapter } from "./types";
import { candidateForms } from "./types";

export const leverFormAdapter: FormAdapter = {
  id: "lever",
  matches: (_document, url) =>
    url.hostname === "jobs.lever.co" || url.hostname.endsWith(".lever.co"),
  findForms(document) {
    const specific = candidateForms(
      document,
      "form.application-form, form[action*='/apply'], form[data-qa='application-form']",
    );
    return specific.length > 0 ? specific : candidateForms(document, "form");
  },
};
