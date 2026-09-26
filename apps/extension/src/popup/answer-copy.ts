import type { AnswerResolution } from "../shared/messages";

export function answerCopy(resolution: AnswerResolution): {
  title: string;
  body: string;
} {
  const approved = resolution.decisions.filter(
    (decision) => decision.action === "FILL",
  ).length;
  const needsInput = resolution.decisions.filter(
    (decision) => decision.action === "ASK",
  ).length;
  const needsConfirm = resolution.decisions.filter(
    (decision) => decision.action === "CONFIRM",
  ).length;
  const needsReview = resolution.decisions.filter(
    (decision) => decision.action === "SUGGEST",
  ).length;
  const unresolved =
    resolution.decisions.length -
    approved -
    needsInput -
    needsConfirm -
    needsReview;
  const details = [
    approved > 0 ? `${approved} approved for fill` : null,
    needsInput > 0 ? `${needsInput} need input` : null,
    needsConfirm > 0 ? `${needsConfirm} need confirmation` : null,
    needsReview > 0 ? `${needsReview} need review` : null,
    unresolved > 0 ? `${unresolved} unresolved` : null,
  ].filter(Boolean);
  return {
    title: "Answer decisions ready",
    body: `${details.join(" · ") || "No answers resolved"}. Nothing was filled.`,
  };
}
