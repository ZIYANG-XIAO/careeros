import type { FormAdapter } from "./types";
import { candidateForms } from "./types";

/**
 * Ashby renders older boards in a <form>, and current ones (2026) as React
 * containers with no <form>. The containers carry stable
 * `ashby-application-form-container` classes (the application and the EEO
 * survey); the "Autofill from resume" upload and reCAPTCHA sit outside them
 * and are never treated as application fields.
 */
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
    if (specific.length > 0) return specific;
    const forms = candidateForms(document, "form");
    if (forms.length > 0) return forms;
    return candidateForms(document, ".ashby-application-form-container");
  },
};
