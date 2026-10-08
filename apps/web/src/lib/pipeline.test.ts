import { describe, expect, it } from "vitest";

import {
  applicationsToCsvRows,
  closedApplications,
  EMPTY_PIPELINE_FILTERS,
  filterApplications,
  filterSavedJobs,
  groupByStage,
  groupStatusHistory,
  isClosedStatus,
  needsYouApplications,
  parseApplicationImportRows,
  pipelineAttentionItems,
  pipelineSummary,
  progressSteps,
  savedColumnJobs,
  stageDwell,
  stageFunnel,
} from "./pipeline";
import type {
  ApplicationStatusHistoryBulkEntry,
  ApplicationSummary,
  Job,
} from "./types";

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

function entry(
  from_status: ApplicationStatusHistoryBulkEntry["from_status"],
  to_status: ApplicationStatusHistoryBulkEntry["to_status"],
  changed_at: string,
  application_id = "app-1",
): ApplicationStatusHistoryBulkEntry {
  return { application_id, from_status, to_status, changed_at };
}

describe("stageDwell", () => {
  const now = new Date("2026-10-01T00:00:00Z");

  it("flags each stage after its own threshold", () => {
    expect(
      stageDwell(
        makeApplication({
          status: "APPLIED",
          status_updated_at: "2026-09-24T00:00:00Z",
        }),
        now,
      ),
    ).toEqual({ days: 7, stalled: true });
    expect(
      stageDwell(
        makeApplication({
          status: "INTERVIEW",
          status_updated_at: "2026-09-24T00:00:00Z",
        }),
        now,
      ),
    ).toEqual({ days: 7, stalled: false });
  });

  it("never flags an offer", () => {
    expect(
      stageDwell(
        makeApplication({
          status: "OFFER",
          status_updated_at: "2026-01-01T00:00:00Z",
        }),
        now,
      ).stalled,
    ).toBe(false);
  });
});

describe("progressSteps", () => {
  it("dates reached stages and leaves skipped ones undated", () => {
    const steps = progressSteps(
      makeApplication({
        status: "INTERVIEW",
        status_updated_at: "2026-09-20T00:00:00Z",
      }),
      [
        entry(null, "PREPARING", "2026-09-10T00:00:00Z"),
        entry("PREPARING", "APPLIED", "2026-09-12T00:00:00Z"),
        entry("APPLIED", "INTERVIEW", "2026-09-20T00:00:00Z"),
      ],
    );
    expect(steps.map((step) => [step.stage, step.state, step.date])).toEqual([
      ["PREPARING", "done", "2026-09-10T00:00:00Z"],
      ["APPLIED", "done", "2026-09-12T00:00:00Z"],
      ["ASSESSMENT", "done", null],
      ["INTERVIEW", "current", "2026-09-20T00:00:00Z"],
      ["FINAL", "upcoming", null],
      ["OFFER", "upcoming", null],
    ]);
  });

  it("falls back to status_updated_at for the current stage without history", () => {
    const steps = progressSteps(
      makeApplication({
        status: "APPLIED",
        status_updated_at: "2026-09-12T00:00:00Z",
      }),
    );
    expect(steps[1]).toEqual({
      stage: "APPLIED",
      state: "current",
      date: "2026-09-12T00:00:00Z",
    });
  });

  it("marks the stage a closed application ended at", () => {
    const steps = progressSteps(makeApplication({ status: "REJECTED" }), [
      entry(null, "APPLIED", "2026-09-12T00:00:00Z"),
      entry("APPLIED", "REJECTED", "2026-09-15T00:00:00Z"),
    ]);
    expect(steps.map((step) => step.state)).toEqual([
      "done",
      "closed",
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
  });

  it("shows nothing reached when a closed application has no known origin stage", () => {
    const steps = progressSteps(makeApplication({ status: "WITHDRAWN" }));
    expect(steps.every((step) => step.state === "upcoming")).toBe(true);
  });
});

describe("groupStatusHistory", () => {
  it("groups by application and orders oldest first", () => {
    const grouped = groupStatusHistory([
      entry("APPLIED", "INTERVIEW", "2026-09-20T00:00:00Z"),
      entry(null, "APPLIED", "2026-09-10T00:00:00Z", "app-2"),
      entry(null, "APPLIED", "2026-09-12T00:00:00Z"),
    ]);
    expect(grouped.get("app-1")?.map((item) => item.to_status)).toEqual([
      "APPLIED",
      "INTERVIEW",
    ]);
    expect(grouped.get("app-2")).toHaveLength(1);
  });
});

describe("pipeline filters", () => {
  const applications = [
    makeApplication({ id: "a", company: "Figma", role: "Designer" }),
    makeApplication({ id: "b", company: "Stripe", status: "INTERVIEW" }),
  ];

  it("matches company or role case-insensitively", () => {
    expect(
      filterApplications(applications, {
        ...EMPTY_PIPELINE_FILTERS,
        query: "  FIG ",
      }).map((application) => application.id),
    ).toEqual(["a"]);
  });

  it("filters by stage and hides saved jobs for a non-saved stage", () => {
    const filters = { ...EMPTY_PIPELINE_FILTERS, stage: "INTERVIEW" as const };
    expect(
      filterApplications(applications, filters).map((item) => item.id),
    ).toEqual(["b"]);
    expect(filterSavedJobs([makeJob()], filters)).toEqual([]);
  });

  it("shows only saved jobs for the saved stage", () => {
    const filters = { ...EMPTY_PIPELINE_FILTERS, stage: "SAVED" as const };
    expect(filterApplications(applications, filters)).toEqual([]);
    expect(filterSavedJobs([makeJob()], filters)).toHaveLength(1);
  });
});

describe("stageFunnel", () => {
  it("counts furthest stage reached, including closed applications", () => {
    const applications = [
      makeApplication({ id: "a", status: "INTERVIEW" }),
      makeApplication({ id: "b", status: "REJECTED" }),
      makeApplication({ id: "c", status: "PREPARING" }),
    ];
    const history = groupStatusHistory([
      entry(null, "APPLIED", "2026-09-01T00:00:00Z", "a"),
      entry("APPLIED", "INTERVIEW", "2026-09-05T00:00:00Z", "a"),
      entry(null, "APPLIED", "2026-09-01T00:00:00Z", "b"),
      entry("APPLIED", "REJECTED", "2026-09-03T00:00:00Z", "b"),
    ]);
    const funnel = stageFunnel(applications, history);
    expect(funnel.map((stage) => [stage.stage, stage.reached])).toEqual([
      ["PREPARING", 3],
      ["APPLIED", 2],
      ["ASSESSMENT", 1],
      ["INTERVIEW", 1],
      ["FINAL", 0],
      ["OFFER", 0],
    ]);
    // Sample too small for rates or medians.
    expect(funnel.every((stage) => stage.rateFromPrevious === null)).toBe(true);
    expect(funnel.every((stage) => stage.medianDays === null)).toBe(true);
  });

  it("shows rates and medians only with enough data", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const applications = ids.map((id, index) =>
      makeApplication({ id, status: index < 2 ? "INTERVIEW" : "APPLIED" }),
    );
    const history = groupStatusHistory(
      ids.flatMap((id, index) => [
        entry(null, "APPLIED", "2026-09-01T00:00:00Z", id),
        ...(index < 2
          ? [
              entry(
                "APPLIED",
                "INTERVIEW",
                `2026-09-0${3 + index * 2}T00:00:00Z`,
                id,
              ),
            ]
          : []),
      ]),
    );
    const funnel = stageFunnel(applications, history);
    const interview = funnel.find((stage) => stage.stage === "INTERVIEW")!;
    expect(interview.reached).toBe(2);
    const assessment = funnel.find((stage) => stage.stage === "ASSESSMENT")!;
    expect(assessment.rateFromPrevious).toBeCloseTo(2 / 5);
    // Only two completed Applied stints (2d and 4d): below the median minimum.
    expect(funnel.find((stage) => stage.stage === "APPLIED")!.medianDays).toBe(
      null,
    );
  });
});
