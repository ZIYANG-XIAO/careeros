import type { AnswerResolution } from "../shared/messages";

export function answerCopy(resolution: AnswerResolution): {
  title: string;
  body: string;
} {
  const ready = resolution.decisions.filter((decision) =>
    ["FILL", "SUGGEST"].includes(decision.action),
  ).length;
  const needsInput = resolution.decisions.filter((decision) =>
    ["ASK", "CONFIRM"].includes(decision.action),
  ).length;
  const unresolved = resolution.decisions.length - ready - needsInput;
  const details = [
    ready > 0 ? `${ready} ready` : null,
    needsInput > 0 ? `${needsInput} need your input` : null,
    unresolved > 0 ? `${unresolved} unresolved` : null,
  ].filter(Boolean);
  return {
    title: "Answer decisions ready",
    body: `${details.join(" · ") || "No answers resolved"}. Nothing was filled.`,
  };
}
