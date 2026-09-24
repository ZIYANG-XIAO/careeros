import { describe, expect, it } from "vitest";

import type { AnswerResolution, PageDetection } from "../shared/messages";
import { approvedFillCount, buildFillPlan } from "./fill-plan";

const detection: PageDetection = {
  status: "APPLICATION_PAGE",
  adapter: "generic",
  reasons: [],
  forms: [
    {
      id: "form-0",
      adapter: "generic",
      support: "PARTIALLY_SUPPORTED",
      fields: [
        {
          id: "email",
          controlType: "EMAIL",
          question: "Email",
          required: true,
          canonicalKey: "CONTACT_EMAIL",
          support: "SUPPORTED",
          confidence: "HIGH",
          options: [],
        },
        {
          id: "resume",
          controlType: "FILE",
          question: "Resume",
          required: true,
          canonicalKey: "RESUME_FILE",
          support: "SUPPORTED",
          confidence: "MEDIUM",
          options: [],
        },
      ],
    },
  ],
};

function decision(
  fieldId: string,
  action: "FILL" | "ASK",
  proposedAnswer: string | null,
) {
  return {
    fieldId,
    canonicalKey: fieldId === "email" ? ("CONTACT_EMAIL" as const) : null,
    questionCategory: "STANDARD" as const,
    proposedAnswer,
    sourceCategory: proposedAnswer
      ? ("IDENTITY" as const)
      : ("UNKNOWN" as const),
    sourceReferenceId: proposedAnswer
      ? "00000000-0000-4000-8000-000000000001"
      : null,
    action,
    policyCategory: "STANDARD" as const,
    confidence: proposedAnswer ? ("HIGH" as const) : ("LOW" as const),
    sensitivity: "NONE" as const,
    reviewState: proposedAnswer
      ? ("NOT_REQUIRED" as const)
      : ("USER_INPUT_REQUIRED" as const),
    reusePolicy: "NOT_APPLICABLE" as const,
    saveIntentRequired: false,
  };
}

describe("buildFillPlan", () => {
  it("keeps only supported controls executable", () => {
    const resolution: AnswerResolution = {
      decisions: [
        decision("email", "FILL", "candidate@example.com"),
        {
          ...decision("resume", "FILL", "resume.pdf"),
          canonicalKey: "RESUME_FILE",
          sourceCategory: "RESUME_VERSION",
        },
      ],
      selectedResumeVersionId: null,
      semanticClassifierUsed: false,
    };

    const plan = buildFillPlan(resolution, detection);

    expect(plan).toEqual([
      {
        fieldId: "email",
        canonicalKey: "CONTACT_EMAIL",
        controlType: "EMAIL",
        action: "FILL",
        proposedAnswer: "candidate@example.com",
      },
      {
        fieldId: "resume",
        canonicalKey: "RESUME_FILE",
        controlType: "FILE",
        action: "SUGGEST",
        proposedAnswer: null,
      },
    ]);
    expect(approvedFillCount(plan)).toBe(1);
  });

  it("fails closed when the inspected field set changed", () => {
    const resolution: AnswerResolution = {
      decisions: [decision("missing", "ASK", null)],
      selectedResumeVersionId: null,
      semanticClassifierUsed: false,
    };

    expect(buildFillPlan(resolution, detection)).toBeNull();
    expect(approvedFillCount(null)).toBe(0);
  });

  it("does not execute a decision whose canonical key changed", () => {
    const resolution: AnswerResolution = {
      decisions: [
        {
          ...decision("email", "FILL", "candidate@example.com"),
          canonicalKey: "EXPERIENCE_COMPANY",
        },
      ],
      selectedResumeVersionId: null,
      semanticClassifierUsed: false,
    };

    expect(buildFillPlan(resolution, detection)?.[0]).toMatchObject({
      action: "SUGGEST",
      proposedAnswer: null,
    });
  });
});
