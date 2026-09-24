import { describe, expect, it } from "vitest";

import { fillCopy } from "./fill-copy";

describe("fillCopy", () => {
  it("reports execution states and preserves the no-submit boundary", () => {
    expect(
      fillCopy({
        fields: [
          { fieldId: "email", state: "FILLED" },
          { fieldId: "name", state: "INPUT_REQUIRED" },
          { fieldId: "resume", state: "REVIEW_REQUIRED" },
          { fieldId: "existing", state: "SKIPPED_EXISTING" },
          { fieldId: "unknown", state: "UNRESOLVED" },
        ],
      }),
    ).toEqual({
      title: "Review the application page",
      body: "1 filled · 1 existing kept · 2 need your review · 1 unresolved. CareerOS did not submit anything.",
    });
  });
});
