import type { FillExecutionResult } from "../shared/messages";

export function fillCopy(result: FillExecutionResult): {
  title: string;
  body: string;
} {
  const filled = result.fields.filter(
    (field) => field.state === "FILLED",
  ).length;
  const kept = result.fields.filter(
    (field) => field.state === "SKIPPED_EXISTING",
  ).length;
  const review = result.fields.filter((field) =>
    ["REVIEW_REQUIRED", "INPUT_REQUIRED"].includes(field.state),
  ).length;
  const unresolved = result.fields.length - filled - kept - review;
  const details = [
    filled > 0 ? `${filled} filled` : null,
    kept > 0 ? `${kept} existing kept` : null,
    review > 0 ? `${review} need your review` : null,
    unresolved > 0 ? `${unresolved} unresolved` : null,
  ].filter(Boolean);
  return {
    title: "Review the application page",
    body: `${details.join(" · ") || "No fields changed"}. CareerOS did not submit anything.`,
  };
}
