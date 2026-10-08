import { describe, expect, it } from "vitest";

import type { PageDetection } from "../shared/messages";
import { hoursSinceConfirmed, reviewItems } from "./review-checklist";

const detection = {
  status: "SUPPORTED",
  adapter: "generic",
  reasons: [],
  forms: [
    {
      id: "form-0",
      adapter: "generic",
      support: "SUPPORTED",
      fields: [
        {
          id: "f-email",
          controlType: "EMAIL",
          question: "Email",
          required: true,
          canonicalKey: "CONTACT_EMAIL",
          support: "SUPPORTED",
          confidence: "HIGH",
          options: [],
        },
        {
          id: "f-why",
          controlType: "TEXTAREA",
          question: "Why do you want to join us?",
          required: false,
          canonicalKey: null,
          support: "UNKNOWN",
          confidence: "LOW",
          options: [],
        },
        {
          id: "f-auth",
          controlType: "SELECT",
          question: "Are you authorized to work in the US?",
          required: true,
          canonicalKey: "WORK_AUTHORIZATION",
          support: "SUPPORTED",
          confidence: "HIGH",
          options: [],
        },
      ],
    },
  ],
} as unknown as PageDetection;

describe("reviewItems", () => {
  it("lists unfinished fields, required first, drafting only open questions", () => {
    const items = reviewItems(detection, {
      fields: [
        { fieldId: "f-email", state: "FILLED" },
        { fieldId: "f-why", state: "INPUT_REQUIRED" },
        { fieldId: "f-auth", state: "REVIEW_REQUIRED" },
      ],
    });
    expect(items.map((item) => [item.fieldId, item.draftable])).toEqual([
      ["f-auth", false],
      ["f-why", true],
    ]);
  });
});

describe("hoursSinceConfirmed", () => {
  it("only reports catalog postings", () => {
    const now = new Date("2026-10-02T12:00:00Z");
    expect(
      hoursSinceConfirmed(
        {
          jobId: "x",
          created: false,
          isCatalog: true,
          lastObservedAt: "2026-10-02T09:00:00Z",
        },
        now,
      ),
    ).toBe(3);
    expect(
      hoursSinceConfirmed({ jobId: "x", created: true, isCatalog: false }, now),
    ).toBeNull();
  });
});
