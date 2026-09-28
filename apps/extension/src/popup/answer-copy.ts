import type { AnswerResolution } from "../shared/messages";
import { t } from "../shared/i18n";

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
    approved > 0 ? t("{count} approved for fill", { count: approved }) : null,
    needsInput > 0 ? t("{count} need input", { count: needsInput }) : null,
    needsConfirm > 0
      ? t("{count} need confirmation", { count: needsConfirm })
      : null,
    needsReview > 0 ? t("{count} need review", { count: needsReview }) : null,
    unresolved > 0 ? t("{count} unresolved", { count: unresolved }) : null,
  ].filter(Boolean);
  return {
    title: t("Answer decisions ready"),
    body: t("{details}. Nothing was filled.", {
      details: details.join(" · ") || t("No answers resolved"),
    }),
  };
}
