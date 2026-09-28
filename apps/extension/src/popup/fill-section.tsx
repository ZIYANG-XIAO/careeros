import type { LoadState } from "./use-popup-state";
import type {
  ApplicationPageContext,
  FillExecutionResult,
} from "../shared/messages";
import { fillButtonLabel, t } from "../shared/i18n";

export function FillSection({
  hasReviewPlan,
  approvedFields,
  shouldPrepareForRecovery,
  preparingApplication,
  fillResult,
  resolvedFillCopy,
  applicationContext,
  onApply,
}: {
  hasReviewPlan: boolean;
  approvedFields: number;
  shouldPrepareForRecovery: boolean;
  preparingApplication: boolean;
  fillResult: LoadState<FillExecutionResult> | null;
  resolvedFillCopy: { title: string; body: string } | null;
  applicationContext: LoadState<ApplicationPageContext> | null;
  onApply: () => void;
}) {
  return (
    <>
      {hasReviewPlan ? (
        <button
          type="button"
          disabled={
            fillResult?.state === "loading" ||
            preparingApplication ||
            applicationContext?.state === "loading"
          }
          onClick={onApply}
        >
          {preparingApplication
            ? t("Saving recovery context…")
            : fillResult?.state === "loading"
              ? t("Applying approved answers…")
              : approvedFields > 0
                ? fillButtonLabel(shouldPrepareForRecovery, approvedFields)
                : shouldPrepareForRecovery
                  ? t("Save context & show review states")
                  : t("Show review states on page")}
        </button>
      ) : null}

      {fillResult ? (
        <section className="page-card" aria-live="polite">
          <span className="eyebrow">{t("REVIEW")}</span>
          <h2>
            {fillResult.state === "loading"
              ? t("Updating supported fields…")
              : fillResult.state === "ready"
                ? resolvedFillCopy!.title
                : fillResult.message}
          </h2>
          <p>
            {fillResult.state === "ready"
              ? resolvedFillCopy!.body
              : t(
                  "Existing answers stay untouched, and CareerOS never submits the form.",
                )}
          </p>
        </section>
      ) : null}
    </>
  );
}
