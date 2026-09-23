import { describe, expect, it } from "vitest";

import { jobSourceSummary } from "./job-source";

describe("jobSourceSummary", () => {
  it("keeps manual jobs honest", () => {
    expect(
      jobSourceSummary({
        source_type: "MANUAL_ENTRY",
        source_key: "manual",
        availability_status: "UNKNOWN",
        freshness_status: "UNKNOWN",
      }),
    ).toBe("Added manually · not a live job feed");
  });

  it("shows source attribution without inventing freshness", () => {
    expect(
      jobSourceSummary({
        source_type: "EXTERNAL_SOURCE",
        source_key: "demo",
        availability_status: "AVAILABLE",
        freshness_status: "UNKNOWN",
      }),
    ).toBe("Demo source · available · freshness unknown");
  });
});
