import type { FormAdapter } from "./types";
import { candidateForms } from "./types";

export const greenhouseFormAdapter: FormAdapter = {
  id: "greenhouse",
  matches: (_document, url) =>
    url.hostname === "boards.greenhouse.io" ||
    url.hostname === "job-boards.greenhouse.io" ||
    url.hostname.endsWith(".greenhouse.io"),
  findForms(document) {
    const specific = candidateForms(
      document,
      "form#application_form, form[action*='greenhouse'], form[action*='/applications']",
    );
    return specific.length > 0 ? specific : candidateForms(document, "form");
  },
};
