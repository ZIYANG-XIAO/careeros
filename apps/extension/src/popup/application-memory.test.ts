import { describe, expect, it } from "vitest";

import type {
  AnswerResolution,
  ApplicationPageContext,
  FillExecutionResult,
  PageDetection,
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
      role: "Software Engineer",
      resumeVersionId: "",
    });
  });

  it("leaves company empty for generic ATS hosts and localhost", () => {
    const hosts = [
      "localhost",
      "127.0.0.1",
      "boards.greenhouse.io",
      "jobs.lever.co",
      "jobs.ashbyhq.com",
    ];
    for (const siteHost of hosts) {
      const context = {
        pageUrl: `https://${siteHost}/apply`,
        pageTitle: "Engineer application",
        siteHost,
        matchKind: "NONE",
        application: null,
        resumeVersions: [],
      } satisfies ApplicationPageContext;

      expect(initialApplicationFields(context)).toEqual({
        company: "",
        role: "Engineer",
        resumeVersionId: "",
      });
    }
  });

  it("strips generic apply suffixes from page title role suggestions", () => {
    const context = {
      pageUrl: "https://careers.acme.com/apply",
      pageTitle: "Software Engineer - Application",
      siteHost: "careers.acme.com",
      matchKind: "NONE",
      application: null,
      resumeVersions: [],
    } satisfies ApplicationPageContext;

    expect(initialApplicationFields(context)).toEqual({
      company: "careers.acme.com",
      role: "Software Engineer",
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

  it("persists USER_CONTACT_INFO answers that were successfully filled", () => {
    const resolution = {
      decisions: [
        {
          fieldId: "phone",
          canonicalKey: "CONTACT_PHONE",
          proposedAnswer: "+1-555-7890",
          sourceCategory: "USER_CONTACT_INFO",
          action: "FILL",
          policyCategory: "STANDARD",
          sensitivity: "NONE",
        },
      ],
    } as AnswerResolution;
    const result = {
      fields: [{ fieldId: "phone", state: "FILLED" }],
    } as FillExecutionResult;

    expect(confirmedApplicationAnswers(resolution, result)).toEqual([
      {
        canonicalKey: "CONTACT_PHONE",
        questionText: "contact phone",
        answerText: "+1-555-7890",
        sourceCategory: "USER_CONTACT_INFO",
      },
    ]);
  });

  it("excludes USER_CONTACT_INFO answers that were not filled", () => {
    const resolution = {
      decisions: [
        {
          fieldId: "phone",
          canonicalKey: "CONTACT_PHONE",
          proposedAnswer: "+1-555-7890",
          sourceCategory: "USER_CONTACT_INFO",
          action: "FILL",
          policyCategory: "STANDARD",
          sensitivity: "NONE",
        },
      ],
    } as AnswerResolution;
    const result = {
      fields: [{ fieldId: "phone", state: "SKIPPED_EXISTING" }],
    } as FillExecutionResult;

    expect(confirmedApplicationAnswers(resolution, result)).toEqual([]);
  });

  it("excludes USER_CONTACT_INFO answers with FAILED fill state", () => {
    const resolution = {
      decisions: [
        {
          fieldId: "phone",
          canonicalKey: "CONTACT_PHONE",
          proposedAnswer: "+1-555-7890",
          sourceCategory: "USER_CONTACT_INFO",
          action: "FILL",
          policyCategory: "STANDARD",
          sensitivity: "NONE",
        },
      ],
    } as AnswerResolution;
    const result = {
      fields: [{ fieldId: "phone", state: "FAILED" }],
    } as FillExecutionResult;

    expect(confirmedApplicationAnswers(resolution, result)).toEqual([]);
  });

  it("excludes sensitive or ASK decisions regardless of source", () => {
    const resolution = {
      decisions: [
        {
          fieldId: "ssn",
          canonicalKey: null,
          proposedAnswer: "123-45-6789",
          sourceCategory: "USER_CONTACT_INFO",
          action: "FILL",
          policyCategory: "SENSITIVE",
          sensitivity: "SENSITIVE",
        },
        {
          fieldId: "ask-field",
          canonicalKey: null,
          proposedAnswer: null,
          sourceCategory: "USER_CONTACT_INFO",
          action: "ASK",
          policyCategory: "STANDARD",
          sensitivity: "NONE",
        },
      ],
    } as AnswerResolution;
    const result = {
      fields: [
        { fieldId: "ssn", state: "FILLED" },
        { fieldId: "ask-field", state: "INPUT_REQUIRED" },
      ],
    } as FillExecutionResult;

    expect(confirmedApplicationAnswers(resolution, result)).toEqual([]);
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

describe("confirmedApplicationAnswers with saved reusable answers", () => {
  it("records a filled reusable answer as user-provided under the page's question", () => {
    const resolution: AnswerResolution = {
      decisions: [
        {
          fieldId: "field-0-4",
          canonicalKey: null,
          questionCategory: "STANDARD",
          proposedAnswer: "A friend",
          sourceCategory: "REUSABLE_CONFIRMED_ANSWER",
          sourceReferenceId: "00000000-0000-4000-8000-000000000009",
          action: "FILL",
          policyCategory: "STANDARD",
          confidence: "HIGH",
          sensitivity: "NONE",
          reviewState: "NOT_REQUIRED",
          reusePolicy: "NOT_APPLICABLE",
          saveIntentRequired: false,
        },
      ],
      selectedResumeVersionId: null,
      semanticClassifierUsed: false,
    };
    const detection: PageDetection = {
      status: "APPLICATION_PAGE",
      adapter: "generic",
      reasons: [],
      forms: [
        {
          id: "form-0",
          adapter: "generic",
          support: "PARTIALLY_SUPPORTED",
          fields: [
            {
              id: "field-0-4",
              controlType: "TEXT",
              question: "How did you hear about us?",
              required: true,
              canonicalKey: null,
              support: "UNKNOWN",
              confidence: "LOW",
              options: [],
            },
          ],
        },
      ],
    };
    expect(
      confirmedApplicationAnswers(
        resolution,
        { fields: [{ fieldId: "field-0-4", state: "FILLED" }] },
        detection,
      ),
    ).toEqual([
      {
        canonicalKey: null,
        questionText: "How did you hear about us?",
        answerText: "A friend",
        sourceCategory: "USER_PROVIDED",
      },
    ]);
  });
});
