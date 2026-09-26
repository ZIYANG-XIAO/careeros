import { describe, expect, it } from "vitest";

import { fillCopy } from "./fill-copy";

const obsoletePhrases = ["not enabled", "coming soon", "not available yet"];

function assertNoObsoleteCopy(copy: { title: string; body: string }) {
  const combined = `${copy.title} ${copy.body}`.toLowerCase();
  for (const phrase of obsoletePhrases) {
    expect(combined).not.toContain(phrase);
  }
}

describe("fillCopy", () => {
  it("reports execution states and preserves the no-submit boundary", () => {
    const copy = fillCopy({
      fields: [
        { fieldId: "email", state: "FILLED" },
        { fieldId: "name", state: "INPUT_REQUIRED" },
        { fieldId: "resume", state: "REVIEW_REQUIRED" },
        { fieldId: "existing", state: "SKIPPED_EXISTING" },
        { fieldId: "unknown", state: "UNRESOLVED" },
      ],
    });

    expect(copy).toEqual({
      title: "Review the application page",
      body: "1 filled · 1 existing value untouched · 2 need your review · 1 unresolved. CareerOS never submits the form.",
    });
    assertNoObsoleteCopy(copy);
  });
});
