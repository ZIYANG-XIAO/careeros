import { describe, expect, it } from "vitest";

import type { AnswerDecision, AnswerResolution } from "../shared/messages";
import { answerCopy } from "./answer-copy";

const obsoletePhrases = ["not enabled", "coming soon", "not available yet"];

function decision(action: AnswerDecision["action"]): AnswerDecision {
  return {
    fieldId: action,
    canonicalKey: null,
    questionCategory: "UNKNOWN",
    proposedAnswer: null,
    sourceCategory: "UNKNOWN",
    sourceReferenceId: null,
    action,
    policyCategory: "STANDARD",
    confidence: "LOW",
    sensitivity: "NONE",
    reviewState: "UNRESOLVED",
    reusePolicy: "NOT_APPLICABLE",
    saveIntentRequired: false,
  };
}

function assertNoObsoleteCopy(copy: { title: string; body: string }) {
  const combined = `${copy.title} ${copy.body}`.toLowerCase();
  for (const phrase of obsoletePhrases) {
    expect(combined).not.toContain(phrase);
  }
}

describe("answerCopy", () => {
  it("summarizes decisions without exposing answer values or claiming a fill", () => {
    const resolution: AnswerResolution = {
      decisions: [
        decision("FILL"),
        decision("SUGGEST"),
        decision("ASK"),
        decision("CONFIRM"),
        decision("UNKNOWN"),
      ],
      selectedResumeVersionId: null,
      semanticClassifierUsed: false,
    };

    const copy = answerCopy(resolution);
    expect(copy).toEqual({
      title: "Answer decisions ready",
      body: "1 approved for fill · 1 need input · 1 need confirmation · 1 need review · 1 unresolved. Nothing was filled.",
    });
    assertNoObsoleteCopy(copy);
  });
});
