import { describe, expect, it } from "vitest";

import type { PageDetection } from "../shared/messages";
import { detectionCopy } from "./detection-copy";

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

    expect(detectionCopy(detection)).toEqual({
      title: "Application form inspected",
      body: "1 field recognized · 1 need manual review. Autofill is not enabled yet.",
    });
  });
});
