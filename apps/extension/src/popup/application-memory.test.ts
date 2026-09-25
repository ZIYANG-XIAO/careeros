import { describe, expect, it } from "vitest";

import type {
  AnswerResolution,
  ApplicationPageContext,
  FillExecutionResult,
} from "../shared/messages";
import {
  confirmedApplicationAnswers,
  initialApplicationFields,
  selectedApplicationFields,
  shouldShowApplicationMemory,
} from "./application-memory";

describe("application memory popup policy", () => {
  it("keeps only standard answers that CareerOS actually filled", () => {
    const resolution = {
      decisions: [
        {
          fieldId: "email",
          canonicalKey: "CONTACT_EMAIL",
          proposedAnswer: "candidate@example.com",
          sourceCategory: "IDENTITY",
          action: "FILL",
          policyCategory: "STANDARD",
          sensitivity: "NONE",
        },
        {
          fieldId: "salary",
          canonicalKey: null,
          proposedAnswer: null,
          sourceCategory: "UNKNOWN",
          action: "ASK",
          policyCategory: "CONSEQUENTIAL",
          sensitivity: "CONSEQUENTIAL",
        },
      ],
    } as AnswerResolution;
    const result = {
      fields: [
        { fieldId: "email", state: "FILLED" },
        { fieldId: "salary", state: "INPUT_REQUIRED" },
      ],
    } as FillExecutionResult;

    expect(confirmedApplicationAnswers(resolution, result)).toEqual([
      {
        canonicalKey: "CONTACT_EMAIL",
        questionText: "contact email",
        answerText: "candidate@example.com",
        sourceCategory: "IDENTITY",
      },
    ]);
  });

  it("prefers reviewed tracked context and its exact resume", () => {
    const context = {
      pageUrl: "https://jobs.example.com/apply",
      siteHost: "jobs.example.com",
      pageTitle: "Apply now",
      matchKind: "EXACT_URL",
      application: {
        id: "00000000-0000-4000-8000-000000000002",
        company: "Acme",
        role: "Engineer",
        applicationUrl: "https://jobs.example.com/apply",
        resumeVersionId: "00000000-0000-4000-8000-000000000001",
        status: "PREPARING",
        origin: "CAREEROS_JOB",
        createdAt: "2026-09-25T01:00:00Z",
      },
      resumeVersions: [],
    } satisfies ApplicationPageContext;

    expect(initialApplicationFields(context)).toEqual({
      company: "Acme",
      role: "Engineer",
      resumeVersionId: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("does not guess which resume an unmatched external application used", () => {
    const context = {
      pageUrl: "https://outside.example/apply",
      pageTitle: "Software Engineer application",
      siteHost: "outside.example",
      matchKind: "NONE",
      application: null,
      resumeVersions: [
        {
          id: "00000000-0000-4000-8000-000000000003",
          label: "Base Resume · Version 1",
        },
      ],
    } satisfies ApplicationPageContext;

    expect(initialApplicationFields(context)).toEqual({
      company: "outside.example",
      role: "Software Engineer application",
      resumeVersionId: "",
    });
  });

  it("restores the exact resume only after a recent tracked application is selected", () => {
    const context = {
      pageUrl: "https://ats.example/redirected/apply",
      pageTitle: "Apply now",
      siteHost: "ats.example",
      matchKind: "RECENT_PREPARING",
      application: {
        id: "00000000-0000-4000-8000-000000000002",
        company: "Acme",
        role: "Engineer",
        applicationUrl: "https://jobs.example.com/apply",
        resumeVersionId: "00000000-0000-4000-8000-000000000001",
        status: "PREPARING",
        origin: "CAREEROS_JOB",
        createdAt: "2026-09-25T01:00:00Z",
      },
      resumeVersions: [],
    } satisfies ApplicationPageContext;

    expect(selectedApplicationFields(context, false).resumeVersionId).toBe("");
    expect(selectedApplicationFields(context, true)).toEqual({
      company: "Acme",
      role: "Engineer",
      resumeVersionId: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("shows recent recovery context on a post-submit confirmation page", () => {
    const context = {
      pageUrl: "https://ats.example/application/complete",
      pageTitle: "Application received",
      siteHost: "ats.example",
      matchKind: "RECENT_PREPARING",
      application: {
        id: "00000000-0000-4000-8000-000000000002",
        company: "Acme",
        role: "Engineer",
        applicationUrl: "https://ats.example/application",
        resumeVersionId: null,
        status: "PREPARING",
        origin: "EXTERNAL_PAGE",
        createdAt: "2026-09-25T01:00:00Z",
      },
      resumeVersions: [],
    } satisfies ApplicationPageContext;

    expect(shouldShowApplicationMemory("NOT_APPLICATION_PAGE", context)).toBe(
      true,
    );
    expect(
      shouldShowApplicationMemory("NOT_APPLICATION_PAGE", {
        ...context,
        matchKind: "NONE",
        application: null,
      }),
    ).toBe(false);
  });
});
