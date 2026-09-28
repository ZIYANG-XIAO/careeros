import type { FillExecutionResult } from "../shared/messages";
import { t } from "../shared/i18n";

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
    filled > 0 ? t("{count} filled", { count: filled }) : null,
    kept > 0
      ? t(
          kept === 1
            ? "{count} existing value untouched"
            : "{count} existing values untouched",
          { count: kept },
        )
      : null,
    review > 0 ? t("{count} need your review", { count: review }) : null,
    unresolved > 0 ? t("{count} unresolved", { count: unresolved }) : null,
  ].filter(Boolean);
  return {
    title: t("Review the application page"),
    body: t("{details}. CareerOS never submits the form.", {
      details: details.join(" · ") || t("No fields changed"),
    }),
  };
}
