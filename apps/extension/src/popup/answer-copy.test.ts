import { describe, expect, it } from "vitest";

import type { AnswerDecision, AnswerResolution } from "../shared/messages";
import { answerCopy } from "./answer-copy";

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

    expect(answerCopy(resolution)).toEqual({
      title: "Answer decisions ready",
      body: "2 ready · 2 need your input · 1 unresolved. Nothing was filled.",
    });
  });
});
