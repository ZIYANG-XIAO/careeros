import type { FormAdapter } from "./types";
import { candidateForms } from "./types";

// Workday renders each application step as a single-page React view without a
// <form>; the step container carries a stable data-automation-id instead.
const WORKDAY_STEP_SELECTORS = [
  "[data-automation-id='applyFlowPage']",
  "[data-automation-id^='applyFlow']",
  "[data-automation-id='quickApplyPage']",
].join(", ");

export const workdayFormAdapter: FormAdapter = {
  id: "workday",
  matches: (_document, url) =>
    url.hostname.endsWith(".myworkdayjobs.com") ||
    url.hostname.endsWith(".myworkdaysite.com") ||
    url.hostname.endsWith(".myworkday.com"),
  findForms(document) {
    const steps = candidateForms(document, WORKDAY_STEP_SELECTORS);
    // Nested matches (a step inside the flow wrapper) would double-count fields.
    const outermost = steps.filter(
      (step) => !steps.some((other) => other !== step && other.contains(step)),
    );
    return outermost.length > 0 ? outermost : candidateForms(document, "form");
  },
};
