// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CareerOsApiClient } from "./background/api-client";
import { detectApplicationPage } from "./content/detection";
import { applyFillPlan } from "./content/form-execution";
import {
  confirmedApplicationAnswers,
  initialApplicationFields,
} from "./popup/application-memory";
import { buildFillPlan } from "./popup/fill-plan";
import type {
  AnswerResolution,
  ApplicationPageContext,
  CanonicalFieldKey,
} from "./shared/messages";

const resumeVersionId = "00000000-0000-4000-8000-000000000011";
const applicationId = "00000000-0000-4000-8000-000000000012";
const operationId = "00000000-0000-4000-8000-000000000013";

function fixture(name: string): Document {
  const html = readFileSync(path.join(process.cwd(), "fixtures", name), "utf8");
  return new DOMParser().parseFromString(html, "text/html");
}

function resolution(
  fieldId: string,
  canonicalKey: CanonicalFieldKey,
  proposedAnswer: string,
  selectedResumeVersionId: string | null,
): AnswerResolution {
  return {
    decisions: [
      {
        fieldId,
        canonicalKey,
        questionCategory: "STANDARD",
        proposedAnswer,
        sourceCategory: "IDENTITY",
        sourceReferenceId: null,
        action: "FILL",
        policyCategory: "STANDARD",
        confidence: "HIGH",
        sensitivity: "NONE",
        reviewState: "NOT_REQUIRED",
        reusePolicy: "NOT_APPLICABLE",
        saveIntentRequired: false,
      },
    ],
    selectedResumeVersionId,
    semanticClassifierUsed: false,
  };
}

function recordedApplication(origin: "CAREEROS_JOB" | "EXTERNAL_PAGE") {
  return {
    id: applicationId,
    company: "Acme",
    role: "Engineer",
    application_url: "https://boards.greenhouse.io/acme/jobs/123",
    resume_version_id: origin === "CAREEROS_JOB" ? resumeVersionId : null,
    status: "APPLIED",
    origin,
    created_at: "2026-09-25T01:00:00Z",
  };
}

describe("V1 cross-surface scenarios", () => {
  it("completes the CareerOS Job path without submitting or duplicating context", async () => {
    const pageUrl = "https://boards.greenhouse.io/acme/jobs/123";
    const page = fixture("greenhouse-application.html");
    const submit = vi.fn((event: Event) => event.preventDefault());
    page.querySelector("form")!.addEventListener("submit", submit);
    const detection = detectApplicationPage(page, pageUrl);
    const answers = resolution(
      "field-0-2",
      "CONTACT_EMAIL",
      "candidate@example.com",
      resumeVersionId,
    );
    const plan = buildFillPlan(answers, detection);

    expect(plan).not.toBeNull();
    const fillResult = applyFillPlan(page, pageUrl, plan!);
    const retainedAnswers = confirmedApplicationAnswers(answers, fillResult);
    expect(submit).not.toHaveBeenCalled();
    expect(retainedAnswers).toHaveLength(1);

    const context = {
      pageUrl,
      pageTitle: "Engineer application",
      siteHost: "boards.greenhouse.io",
      matchKind: "EXACT_URL",
      application: {
        id: applicationId,
        company: "Acme",
        role: "Engineer",
        applicationUrl: pageUrl,
        resumeVersionId,
        status: "PREPARING",
        origin: "CAREEROS_JOB",
        createdAt: "2026-09-25T01:00:00Z",
      },
      resumeVersions: [{ id: resumeVersionId, label: "Base · Version 1" }],
    } satisfies ApplicationPageContext;
    expect(initialApplicationFields(context).resumeVersionId).toBe(
      resumeVersionId,
    );

    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(recordedApplication("CAREEROS_JOB")), {
        status: 200,
      }),
    );
    const client = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue("session-token") },
      request,
    );
    await client.recordApplication(
      {
        applicationId,
        company: "Acme",
        role: "Engineer",
        resumeVersionId,
        idempotencyKey: operationId,
        answers: retainedAnswers,
      },
      pageUrl,
    );

    expect(request).toHaveBeenCalledWith(
      `http://localhost:8000/applications/${applicationId}/submission`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("completes an independently found job without a Job or guessed resume", async () => {
    const pageUrl = "https://jobs.ashbyhq.com/acme/123/application";
    const page = fixture("ashby-application.html");
    const submit = vi.fn((event: Event) => event.preventDefault());
    page.querySelector("form")!.addEventListener("submit", submit);
    const detection = detectApplicationPage(page, pageUrl);
    const answers = resolution(
      "field-0-0",
      "CONTACT_EMAIL",
      "candidate@example.com",
      null,
    );
    const plan = buildFillPlan(answers, detection);
    const fillResult = applyFillPlan(page, pageUrl, plan!);
    const retainedAnswers = confirmedApplicationAnswers(answers, fillResult);
    expect(submit).not.toHaveBeenCalled();

    const context = {
      pageUrl,
      pageTitle: "Engineer application",
      siteHost: "jobs.ashbyhq.com",
      matchKind: "NONE",
      application: null,
      resumeVersions: [{ id: resumeVersionId, label: "Base · Version 1" }],
    } satisfies ApplicationPageContext;
    expect(initialApplicationFields(context)).toEqual({
      company: "",
      role: "Engineer",
      resumeVersionId: "",
    });

    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...recordedApplication("EXTERNAL_PAGE"),
            status: "PREPARING",
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(recordedApplication("EXTERNAL_PAGE")), {
          status: 200,
        }),
      );
    const client = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue("session-token") },
      request,
    );
    const prepared = await client.prepareApplication(
      {
        company: "Acme",
        role: "Engineer",
        resumeVersionId: null,
        idempotencyKey: operationId,
      },
      pageUrl,
    );
    await client.recordApplication(
      {
        applicationId: prepared!.id,
        company: "Acme",
        role: "Engineer",
        resumeVersionId: null,
        idempotencyKey: "00000000-0000-4000-8000-000000000014",
        answers: retainedAnswers,
      },
      pageUrl,
    );

    expect(request).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8000/applications",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"resume_version_id":null'),
      }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      `http://localhost:8000/applications/${applicationId}/submission`,
      expect.objectContaining({ method: "POST" }),
    );
  });
});
