import type { LoadState } from "./use-popup-state";
import type {
  ApplicationPageContext,
  FillExecutionResult,
} from "../shared/messages";

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
            ? "Saving recovery context…"
            : fillResult?.state === "loading"
              ? "Applying approved answers…"
              : approvedFields > 0
                ? `${shouldPrepareForRecovery ? "Save context & fill" : "Fill"} ${approvedFields} approved ${approvedFields === 1 ? "field" : "fields"}`
                : shouldPrepareForRecovery
                  ? "Save context & show review states"
                  : "Show review states on page"}
        </button>
      ) : null}

      {fillResult ? (
        <section className="page-card" aria-live="polite">
          <span className="eyebrow">REVIEW</span>
          <h2>
            {fillResult.state === "loading"
              ? "Updating supported fields…"
              : fillResult.state === "ready"
                ? resolvedFillCopy!.title
                : fillResult.message}
          </h2>
          <p>
            {fillResult.state === "ready"
              ? resolvedFillCopy!.body
              : "Existing answers stay untouched, and CareerOS never submits the form."}
          </p>
        </section>
      ) : null}
    </>
  );
}
