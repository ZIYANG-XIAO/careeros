import { describe, expect, it } from "vitest";

import { jobFreshness } from "./freshness";
import type { Job } from "./types";

const now = new Date("2026-10-02T12:00:00Z");

function job(overrides: Partial<Job>): Job {
  return {
    is_catalog: true,
    last_observed_at: "2026-10-02T06:00:00Z",
    ...overrides,
  } as Job;
}

describe("jobFreshness", () => {
  it("reports hours since the last sync confirmed the posting", () => {
    expect(jobFreshness(job({}), now)).toEqual({ kind: "CONFIRMED", hours: 6 });
  });

  it("flags catalog postings not seen for three days", () => {
    expect(
      jobFreshness(job({ last_observed_at: "2026-09-28T12:00:00Z" }), now),
    ).toEqual({ kind: "STALE", hours: 96 });
  });

  it("never judges jobs the user added", () => {
    expect(jobFreshness(job({ is_catalog: false }), now)).toEqual({
      kind: "UNTRACKED",
    });
  });
});
