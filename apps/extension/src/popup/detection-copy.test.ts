import { describe, expect, it } from "vitest";

import type { PageDetection } from "../shared/messages";
import { detectionCopy } from "./detection-copy";

const obsoletePhrases = ["not enabled", "coming soon", "not available yet"];

function assertNoObsoleteCopy(copy: { title: string; body: string }) {
  const combined = `${copy.title} ${copy.body}`.toLowerCase();
  for (const phrase of obsoletePhrases) {
    expect(combined).not.toContain(phrase);
  }
}

describe("form inspection copy", () => {
  it("reports recognized and review-required fields without promising autofill", () => {
    const detection: PageDetection = {
      status: "APPLICATION_PAGE",
      adapter: "generic",
      reasons: ["An application form was inspected."],
      forms: [
        {
          id: "form-0",
          adapter: "generic",
          support: "PARTIALLY_SUPPORTED",
          fields: [
            {
              id: "field-0-0",
              controlType: "EMAIL",
              question: "Email",
              required: true,
              canonicalKey: "CONTACT_EMAIL",
              support: "SUPPORTED",
              confidence: "HIGH",
              options: [],
            },
            {
              id: "field-0-1",
              controlType: "TEXTAREA",
              question: "Why this role?",
              required: false,
              canonicalKey: null,
              support: "UNKNOWN",
              confidence: "LOW",
              options: [],
            },
          ],
        },
      ],
    };

    const copy = detectionCopy(detection);
    expect(copy).toEqual({
      title: "Application form inspected",
      body: "Form inspection succeeded. 1 field recognized · 1 need manual review. Nothing changes until you act.",
    });
    assertNoObsoleteCopy(copy);
  });

  it("reports zero recognized fields without obsolete autofill messaging", () => {
    const detection: PageDetection = {
      status: "APPLICATION_PAGE",
      adapter: "generic",
      reasons: ["An application form was inspected."],
      forms: [
        {
          id: "form-0",
          adapter: "generic",
          support: "PARTIALLY_SUPPORTED",
          fields: [
            {
              id: "field-0-0",
              controlType: "TEXTAREA",
              question: "Why this role?",
              required: false,
              canonicalKey: null,
              support: "UNKNOWN",
              confidence: "LOW",
              options: [],
            },
          ],
        },
      ],
    };

    const copy = detectionCopy(detection);
    expect(copy.title).toBe("Application form needs manual review");
    expect(copy.body).toContain("Nothing changes until you act.");
    assertNoObsoleteCopy(copy);
  });
});
