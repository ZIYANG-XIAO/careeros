import { describe, expect, it } from "vitest";

import {
  applicationsToCsvRows,
  closedApplications,
  groupByStage,
  isClosedStatus,
  needsYouApplications,
  parseApplicationImportRows,
  pipelineAttentionItems,
  pipelineSummary,
  savedColumnJobs,
} from "./pipeline";
import type { ApplicationSummary, Job } from "./types";

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

function makeApplication(
  overrides: Partial<ApplicationSummary> = {},
): ApplicationSummary {
  return {
    id: "app-1",
    job_id: null,
    resume_version_id: null,
    origin: "MANUAL",
    company: "Acme",
    role: "Engineer",
    application_url: null,
    source: "manual",
    status: "PREPARING",
    applied_at: null,
    status_updated_at: "2026-09-20T00:00:00Z",
    created_at: "2026-09-20T00:00:00Z",
    updated_at: "2026-09-20T00:00:00Z",
    ...overrides,
  };
}

describe("savedColumnJobs", () => {
  it("excludes jobs that already have an application", () => {
    const jobs = [makeJob({ id: "job-1" }), makeJob({ id: "job-2" })];
    const applications = [makeApplication({ job_id: "job-1" })];
    const result = savedColumnJobs(jobs, applications);
    expect(result.map((job) => job.id)).toEqual(["job-2"]);
  });

  it("orders by created_at descending", () => {
    const jobs = [
      makeJob({ id: "old", created_at: "2026-01-01T00:00:00Z" }),
      makeJob({ id: "new", created_at: "2026-06-01T00:00:00Z" }),
    ];
    expect(savedColumnJobs(jobs, []).map((job) => job.id)).toEqual([
      "new",
      "old",
    ]);
  });
});

describe("groupByStage", () => {
  it("buckets applications by status and excludes closed statuses", () => {
    const applications = [
      makeApplication({ id: "a1", status: "PREPARING" }),
      makeApplication({ id: "a2", status: "INTERVIEW" }),
      makeApplication({ id: "a3", status: "REJECTED" }),
      makeApplication({ id: "a4", status: "WITHDRAWN" }),
    ];
    const groups = groupByStage(applications);
    expect(groups.PREPARING.map((a) => a.id)).toEqual(["a1"]);
    expect(groups.INTERVIEW.map((a) => a.id)).toEqual(["a2"]);
    expect(groups.APPLIED).toEqual([]);
    expect(Object.values(groups).flat()).not.toContainEqual(
      expect.objectContaining({ id: "a3" }),
    );
  });

  it("orders each stage by status_updated_at descending", () => {
    const applications = [
      makeApplication({
        id: "older",
        status: "APPLIED",
        status_updated_at: "2026-09-01T00:00:00Z",
      }),
      makeApplication({
        id: "newer",
        status: "APPLIED",
        status_updated_at: "2026-09-20T00:00:00Z",
      }),
    ];
    expect(groupByStage(applications).APPLIED.map((a) => a.id)).toEqual([
      "newer",
      "older",
    ]);
  });
});

describe("closedApplications", () => {
  it("returns only rejected/withdrawn, most recent first", () => {
    const applications = [
      makeApplication({ id: "open", status: "APPLIED" }),
      makeApplication({
        id: "rejected",
        status: "REJECTED",
        status_updated_at: "2026-09-01T00:00:00Z",
      }),
      makeApplication({
        id: "withdrawn",
        status: "WITHDRAWN",
        status_updated_at: "2026-09-10T00:00:00Z",
      }),
    ];
    expect(closedApplications(applications).map((a) => a.id)).toEqual([
      "withdrawn",
      "rejected",
    ]);
  });
});

describe("needsYouApplications", () => {
  const now = new Date("2026-09-27T00:00:00Z");

  it("flags Preparing applications stale over 72h", () => {
    const applications = [
      makeApplication({
        id: "stale",
        status: "PREPARING",
        status_updated_at: "2026-09-20T00:00:00Z",
      }),
      makeApplication({
        id: "fresh",
        status: "PREPARING",
        status_updated_at: "2026-09-26T12:00:00Z",
      }),
      makeApplication({
        id: "wrong-stage",
        status: "APPLIED",
        status_updated_at: "2026-09-01T00:00:00Z",
      }),
    ];
    expect(needsYouApplications(applications, now).map((a) => a.id)).toEqual([
      "stale",
    ]);
  });
});

describe("pipeline action center", () => {
  const now = new Date("2026-09-27T00:00:00Z");

  it("separates submission confirmation from optional follow-up prompts", () => {
    const applications = [
      makeApplication({
        id: "preparing",
        status: "PREPARING",
        status_updated_at: "2026-09-20T00:00:00Z",
      }),
      makeApplication({
        id: "applied",
        status: "APPLIED",
        status_updated_at: "2026-09-10T00:00:00Z",
      }),
      makeApplication({
        id: "fresh",
        status: "APPLIED",
        status_updated_at: "2026-09-26T00:00:00Z",
      }),
    ];

    expect(
      pipelineAttentionItems(applications, now).map((item) => [
        item.application.id,
        item.reason,
      ]),
    ).toEqual([
      ["applied", "CONSIDER_FOLLOW_UP"],
      ["preparing", "CONFIRM_SUBMISSION"],
    ]);
  });

  it("summarizes open, attention, interview and offer states", () => {
    const applications = [
      makeApplication({
        status: "PREPARING",
        status_updated_at: "2026-09-20T00:00:00Z",
      }),
      makeApplication({ id: "interview", status: "INTERVIEW" }),
      makeApplication({ id: "offer", status: "OFFER" }),
      makeApplication({ id: "closed", status: "REJECTED" }),
    ];

    expect(pipelineSummary(applications, now)).toEqual({
      active: 3,
      needsAction: 1,
      interviews: 1,
      offers: 1,
    });
  });
});

describe("isClosedStatus", () => {
  it("identifies rejected and withdrawn as closed", () => {
    expect(isClosedStatus("REJECTED")).toBe(true);
    expect(isClosedStatus("WITHDRAWN")).toBe(true);
    expect(isClosedStatus("OFFER")).toBe(false);
  });
});

describe("applicationsToCsvRows", () => {
  it("emits raw enum/ISO values, not locale-formatted display text", () => {
    const rows = applicationsToCsvRows([
      makeApplication({
        status: "APPLIED",
        applied_at: "2026-09-21T00:00:00Z",
        application_url: "https://example.com/apply",
      }),
    ]);
    expect(rows[0]).toEqual([
      "company",
      "role",
      "status",
      "applied_at",
      "source",
      "application_url",
      "created_at",
    ]);
    expect(rows[1]).toEqual([
      "Acme",
      "Engineer",
      "APPLIED",
      "2026-09-21T00:00:00Z",
      "manual",
      "https://example.com/apply",
      "2026-09-20T00:00:00Z",
    ]);
  });
});

describe("parseApplicationImportRows", () => {
  it("skips a leading header row when present", () => {
    const result = parseApplicationImportRows([
      ["company", "role", "status"],
      ["Acme", "Engineer", "APPLIED"],
    ]);
    expect(result).toEqual([
      {
        ok: true,
        row: 2,
        payload: {
          company: "Acme",
          role: "Engineer",
          status: "APPLIED",
          applied_at: undefined,
          source: "csv_import",
          application_url: undefined,
        },
      },
    ]);
  });

  it("fails a row missing company or role", () => {
    const result = parseApplicationImportRows([["", "Engineer"]]);
    expect(result).toEqual([
      { ok: false, row: 1, reason: "missingCompanyRole" },
    ]);
  });

  it("falls back to PREPARING for an unrecognized status", () => {
    const result = parseApplicationImportRows([["Acme", "Engineer", "BOGUS"]]);
    expect(result).toEqual([
      {
        ok: true,
        row: 1,
        payload: {
          company: "Acme",
          role: "Engineer",
          status: "PREPARING",
          applied_at: undefined,
          source: "csv_import",
          application_url: undefined,
        },
      },
    ]);
  });

  it("drops applied_at when status is PREPARING even if a date is present", () => {
    const result = parseApplicationImportRows([
      ["Acme", "Engineer", "PREPARING", "2026-09-20T00:00:00Z"],
    ]);
    expect(result[0]).toMatchObject({
      ok: true,
      payload: { applied_at: undefined },
    });
  });

  it("parses a valid applied_at for a non-PREPARING status", () => {
    const result = parseApplicationImportRows([
      ["Acme", "Engineer", "APPLIED", "2026-09-20T00:00:00Z"],
    ]);
    expect(result[0]).toMatchObject({
      ok: true,
      payload: { applied_at: "2026-09-20T00:00:00.000Z" },
    });
  });

  it("drops a malformed application_url without failing the row", () => {
    const result = parseApplicationImportRows([
      ["Acme", "Engineer", "APPLIED", "", "", "not-a-url"],
    ]);
    expect(result[0]).toMatchObject({
      ok: true,
      payload: { application_url: undefined },
    });
  });

  it("keeps a valid http(s) application_url", () => {
    const result = parseApplicationImportRows([
      ["Acme", "Engineer", "APPLIED", "", "", "https://example.com/apply"],
    ]);
    expect(result[0]).toMatchObject({
      ok: true,
      payload: { application_url: "https://example.com/apply" },
    });
  });

  it("defaults source to csv_import when blank", () => {
    const result = parseApplicationImportRows([["Acme", "Engineer"]]);
    expect(result[0]).toMatchObject({
      ok: true,
      payload: { source: "csv_import" },
    });
  });
});
