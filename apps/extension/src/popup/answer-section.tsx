import type { LoadState } from "./use-popup-state";
import type { AnswerResolution } from "../shared/messages";

export function AnswerSection({
  answers,
  resolvedAnswerCopy,
}: {
  answers: LoadState<AnswerResolution>;
  resolvedAnswerCopy: { title: string; body: string } | null;
}) {
  return (
    <section className="page-card" aria-live="polite">
      <span className="eyebrow">ANSWER POLICY</span>
      <h2>
        {answers.state === "loading"
          ? "Checking approved sources…"
          : answers.state === "ready"
            ? resolvedAnswerCopy!.title
            : answers.message}
      </h2>
      <p>
        {answers.state === "ready"
          ? resolvedAnswerCopy!.body
          : "CareerOS keeps unknown and sensitive answers under your control."}
      </p>
    </section>
  );
}
