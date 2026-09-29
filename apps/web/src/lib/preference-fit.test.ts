import { describe, expect, it } from "vitest";

import {
  preferenceFit,
  rankByPreferenceFit,
  roleMatchesTitle,
} from "./preference-fit";
import type { Job, JobSearchGoal } from "./types";

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    company: "Acme",
    title: "Engineer",
    location: null,
    source_url: null,
    application_url: null,
    source_type: "MANUAL_ENTRY",
    source_key: "manual",
    external_job_id: null,
    canonical_url: null,
    first_observed_at: null,
    last_observed_at: null,
    availability_status: "UNKNOWN",
    freshness_status: "UNKNOWN",
    market: "UNKNOWN",
    country_code: "UNKNOWN",
    workplace_type: "UNKNOWN",
    employment_type: "UNKNOWN",
    captured_at: "2026-09-01T00:00:00Z",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    is_saved: true,
    saved_at: "2026-09-01T00:00:00Z",
    is_catalog: false,
    similar_count: 0,
    other_locations: [],
    latest_snapshot: {
      id: "snap-1",
      version_number: 1,
      raw_description: "",
      normalized_description: "",
      content_sha256: "x",
      parser_version: "v1",
      parser_model: "test",
      requirements_status: "PARSED",
      created_at: "2026-09-01T00:00:00Z",
      requirements: [],
    },
    ...overrides,
  };
}

function makeGoal(overrides: Partial<JobSearchGoal> = {}): JobSearchGoal {
  return {
    id: "goal-1",
    name: "NA backend",
    market: "UNKNOWN",
    country_codes: [],
    target_roles: [],
    cities: [],
    workplace_types: [],
    employment_types: [],
    company_sizes: [],
    industries_include: [],
    industries_exclude: [],
    company_blocklist: [],
    minimum_salary: null,
    salary_currency: null,
    default_resume_id: null,
    security_clearance_interest: false,
    is_active: true,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

describe("roleMatchesTitle", () => {
  it("matches reordered words and Chinese substrings", () => {
    expect(
      roleMatchesTitle("Backend Engineer", "Senior Software Engineer, Backend"),
    ).toBe(true);
    expect(roleMatchesTitle("后端工程师", "高级后端工程师（Java）")).toBe(true);
    expect(roleMatchesTitle("Data Scientist", "Data Engineer")).toBe(false);
  });
});

describe("preferenceFit", () => {
  it("is unknown without a goal or without comparable fields", () => {
    expect(preferenceFit(makeJob(), null)).toEqual({ level: "UNKNOWN" });
    expect(
      preferenceFit(makeJob(), makeGoal({ workplace_types: ["REMOTE"] })),
    ).toEqual({ level: "UNKNOWN" });
  });

  it("judges only criteria both sides state", () => {
    const goal = makeGoal({
      market: "NORTH_AMERICA",
      country_codes: ["CA"],
      target_roles: ["Backend Engineer"],
      cities: ["Toronto"],
      workplace_types: ["REMOTE", "HYBRID"],
      employment_types: ["FULL_TIME"],
    });
    const job = makeJob({
      title: "Backend Engineer II",
      location: "Toronto, ON",
      market: "NORTH_AMERICA",
      country_code: "CA",
      workplace_type: "ONSITE",
    });
    expect(preferenceFit(job, goal)).toEqual({
      level: "PARTIAL",
      matched: ["market", "country", "role", "city"],
      mismatched: ["workplace"],
    });
    expect(
      preferenceFit({ ...job, workplace_type: "REMOTE" }, goal),
    ).toMatchObject({ level: "MATCH", mismatched: [] });
  });

  it("flags companies on the blocklist regardless of case", () => {
    expect(
      preferenceFit(
        makeJob({ company: "Acme " }),
        makeGoal({ company_blocklist: ["ACME"], target_roles: ["Engineer"] }),
      ),
    ).toEqual({ level: "BLOCKED" });
  });
});

describe("rankByPreferenceFit", () => {
  it("places aligned current jobs first and removes blocked companies", () => {
    const goal = makeGoal({
      market: "CHINA",
      target_roles: ["Product Manager"],
      company_blocklist: ["Blocked Co"],
    });
    const aligned = makeJob({
      id: "aligned",
      company: "Good Co",
      title: "Senior Product Manager",
      market: "CHINA",
      first_observed_at: "2026-09-28T00:00:00Z",
    });
    const partial = makeJob({
      id: "partial",
      company: "Other Co",
      title: "Product Manager",
      market: "NORTH_AMERICA",
    });
    const blocked = makeJob({ id: "blocked", company: "Blocked Co" });

    expect(rankByPreferenceFit([partial, blocked, aligned], goal)).toEqual([
      aligned,
      partial,
    ]);
  });
});
