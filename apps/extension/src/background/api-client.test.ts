import { describe, expect, it, vi } from "vitest";

import { CareerOsApiClient } from "./api-client";

describe("CareerOsApiClient", () => {
  it("uses a short-lived bearer token only in the API request", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ id: "user-1", email: "private@example.com" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const client = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue("secret-session-token") },
      request,
    );

    const status = await client.getAuthStatus();
    expect(status).toEqual({ authenticated: true });
    expect(request).toHaveBeenCalledWith("http://localhost:8000/me", {
      headers: { Authorization: "Bearer secret-session-token" },
    });
    expect(JSON.stringify(status)).not.toContain("secret-session-token");
  });

  it("does not call the API without a session", async () => {
    const request = vi.fn();
    const client = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue(null) },
      request,
    );

    await expect(client.getAuthStatus()).resolves.toEqual({
      authenticated: false,
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("treats an API rejection as signed out", async () => {
    const client = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue("expired") },
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );

    await expect(client.getAuthStatus()).resolves.toEqual({
      authenticated: false,
    });
  });

  it("calls the native fetch implementation without an illegal receiver", async () => {
    const nativeFetch = vi
      .fn(function (this: unknown) {
        if (this !== undefined) {
          throw new TypeError("Illegal invocation");
        }
        return Promise.resolve(new Response("{}", { status: 200 }));
      })
      .mockName("fetch");
    vi.stubGlobal("fetch", nativeFetch);

    try {
      const client = new CareerOsApiClient("http://localhost:8000", {
        getToken: vi.fn().mockResolvedValue("session-token"),
      });

      await expect(client.getAuthStatus()).resolves.toEqual({
        authenticated: true,
      });
      expect(nativeFetch).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("resolves answers through the authenticated backend boundary", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          decisions: [
            {
              field_id: "field-1",
              canonical_key: "CONTACT_EMAIL",
              question_category: "STANDARD",
              proposed_answer: "private@example.com",
              source_category: "IDENTITY",
              source_reference_id: "00000000-0000-4000-8000-000000000001",
              action: "FILL",
              policy_category: "STANDARD",
              confidence: "HIGH",
              sensitivity: "NONE",
              review_state: "NOT_REQUIRED",
              reuse_policy: "NOT_APPLICABLE",
              save_intent_required: false,
            },
          ],
          selected_resume_version_id: null,
          semantic_classifier_used: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue("session-token") },
      request,
    );
    const input = {
      selectedResumeVersionId: null,
      fields: [
        {
          fieldId: "field-1",
          canonicalKey: "CONTACT_EMAIL" as const,
          question: "Email",
          controlType: "EMAIL" as const,
          required: true,
          mappingConfidence: "HIGH" as const,
          options: [],
        },
      ],
    };

    await expect(client.resolveAnswers(input)).resolves.toEqual({
      decisions: [
        expect.objectContaining({
          fieldId: "field-1",
          proposedAnswer: "private@example.com",
          action: "FILL",
        }),
      ],
      selectedResumeVersionId: null,
      semanticClassifierUsed: false,
    });
    expect(request).toHaveBeenCalledWith(
      "http://localhost:8000/answer-engine/resolve",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selected_resume_version_id: null,
          fields: [
            {
              field_id: "field-1",
              canonical_key: "CONTACT_EMAIL",
              question: "Email",
              control_type: "EMAIL",
              required: true,
              mapping_confidence: "HIGH",
              options: [],
            },
          ],
        }),
      }),
    );
  });

  it("does not send answer fields without a session", async () => {
    const request = vi.fn();
    const client = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue(null) },
      request,
    );

    await expect(
      client.resolveAnswers({ fields: [], selectedResumeVersionId: null }),
    ).resolves.toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects malformed answer decisions from the API", async () => {
    const client = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue("session-token") },
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ decisions: "not-an-array" }), {
          status: 200,
        }),
      ),
    );

    await expect(
      client.resolveAnswers({ fields: [], selectedResumeVersionId: null }),
    ).rejects.toThrow("invalid answer decision");
  });

  it("rejects answer decisions that do not match the requested field IDs", async () => {
    const responseBody = {
      decisions: [
        {
          field_id: "different-field",
          canonical_key: null,
          question_category: "UNKNOWN",
          proposed_answer: null,
          source_category: "UNKNOWN",
          source_reference_id: null,
          action: "ASK",
          policy_category: "STANDARD",
          confidence: "LOW",
          sensitivity: "NONE",
          review_state: "USER_INPUT_REQUIRED",
          reuse_policy: "ELIGIBLE_WITH_EXPLICIT_CONSENT",
          save_intent_required: true,
        },
      ],
      selected_resume_version_id: null,
      semantic_classifier_used: false,
    };
    const client = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue("session-token") },
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(responseBody), { status: 200 }),
        ),
    );

    await expect(
      client.resolveAnswers({
        fields: [
          {
            fieldId: "requested-field",
            canonicalKey: null,
            question: "Custom question",
            controlType: "TEXT",
            required: true,
            mappingConfidence: "LOW",
            options: [],
          },
        ],
        selectedResumeVersionId: null,
      }),
    ).rejects.toThrow("invalid answer decision");
  });

  it("matches application context and returns only resume labels", async () => {
    const applicationId = "00000000-0000-4000-8000-000000000010";
    const resumeVersionId = "00000000-0000-4000-8000-000000000011";
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          match_kind: "EXACT_URL",
          application: {
            id: applicationId,
            company: "Acme",
            role: "Engineer",
            application_url: "https://jobs.example.com/apply/1?from=careeros",
            resume_version_id: resumeVersionId,
            status: "PREPARING",
            origin: "CAREEROS_JOB",
            created_at: "2026-09-25T01:00:00Z",
          },
          resume_versions: [
            { id: resumeVersionId, label: "Base Resume · Version 2" },
          ],
        }),
        { status: 200 },
      ),
    );
    const client = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue("session-token") },
      request,
    );

    await expect(
      client.getApplicationContext(
        "https://jobs.example.com/apply/1?redirected=true",
        "Apply for Engineer",
      ),
    ).resolves.toEqual({
      pageUrl: "https://jobs.example.com/apply/1?redirected=true",
      pageTitle: "Apply for Engineer",
      siteHost: "jobs.example.com",
      matchKind: "EXACT_URL",
      application: {
        id: applicationId,
        company: "Acme",
        role: "Engineer",
        applicationUrl: "https://jobs.example.com/apply/1?from=careeros",
        resumeVersionId,
        status: "PREPARING",
        origin: "CAREEROS_JOB",
        createdAt: "2026-09-25T01:00:00Z",
      },
      resumeVersions: [
        { id: resumeVersionId, label: "Base Resume · Version 2" },
      ],
    });
    expect(request).toHaveBeenCalledWith(
      "http://localhost:8000/applications/assistant-context",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          application_url: "https://jobs.example.com/apply/1?redirected=true",
        }),
      },
    );
  });

  it("rejects inconsistent minimal application context", async () => {
    const client = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue("session-token") },
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            match_kind: "EXACT_URL",
            application: null,
            resume_versions: [],
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(
      client.getApplicationContext("https://jobs.example.com/apply", "Apply"),
    ).rejects.toThrow("invalid application context");
  });

  it("records an external application through the authenticated boundary", async () => {
    const applicationId = "00000000-0000-4000-8000-000000000020";
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: applicationId,
          company: "Acme",
          role: "Engineer",
          application_url: "https://jobs.example.com/apply",
          resume_version_id: null,
          status: "APPLIED",
          origin: "EXTERNAL_PAGE",
          created_at: "2026-09-25T01:00:00Z",
        }),
        { status: 201 },
      ),
    );
    const client = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue("session-token") },
      request,
    );
    const input = {
      applicationId: null,
      company: "Acme",
      role: "Engineer",
      resumeVersionId: null,
      idempotencyKey: "00000000-0000-4000-8000-000000000021",
      answers: [],
    };

    await expect(
      client.recordApplication(input, "https://jobs.example.com/apply"),
    ).resolves.toEqual(expect.objectContaining({ id: applicationId }));
    expect(request).toHaveBeenCalledWith("http://localhost:8000/applications", {
      method: "POST",
      headers: {
        Authorization: "Bearer session-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idempotency_key: input.idempotencyKey,
        origin: "EXTERNAL_PAGE",
        company: "Acme",
        role: "Engineer",
        application_url: "https://jobs.example.com/apply",
        source: "jobs.example.com",
        resume_version_id: null,
        status: "APPLIED",
        answers: [],
      }),
    });
  });

  it("prepares external context before form execution for redirect recovery", async () => {
    const preparedId = "00000000-0000-4000-8000-000000000022";
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: preparedId,
          company: "Acme",
          role: "Engineer",
          application_url: "https://jobs.example.com/apply",
          resume_version_id: null,
          status: "PREPARING",
          origin: "EXTERNAL_PAGE",
          created_at: "2026-09-25T01:00:00Z",
        }),
        { status: 201 },
      ),
    );
    const client = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue("session-token") },
      request,
    );
    const input = {
      company: " Acme ",
      role: " Engineer ",
      resumeVersionId: null,
      idempotencyKey: "00000000-0000-4000-8000-000000000023",
    };

    await expect(
      client.prepareApplication(input, "https://jobs.example.com/apply"),
    ).resolves.toEqual(expect.objectContaining({ id: preparedId }));
    expect(request).toHaveBeenCalledWith("http://localhost:8000/applications", {
      method: "POST",
      headers: {
        Authorization: "Bearer session-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idempotency_key: input.idempotencyKey,
        origin: "EXTERNAL_PAGE",
        company: "Acme",
        role: "Engineer",
        application_url: "https://jobs.example.com/apply",
        source: "jobs.example.com",
        resume_version_id: null,
        status: "PREPARING",
        answers: [],
      }),
    });
  });

  it("completes an existing preparing application instead of duplicating it", async () => {
    const applicationId = "00000000-0000-4000-8000-000000000025";
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: applicationId,
          company: "Acme",
          role: "Engineer",
          application_url: "https://jobs.example.com/apply",
          resume_version_id: null,
          status: "APPLIED",
          origin: "CAREEROS_JOB",
          created_at: "2026-09-25T01:00:00Z",
        }),
        { status: 200 },
      ),
    );
    const client = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue("session-token") },
      request,
    );
    const input = {
      applicationId,
      company: "Acme",
      role: "Engineer",
      resumeVersionId: null,
      idempotencyKey: "00000000-0000-4000-8000-000000000026",
      answers: [],
    };

    await client.recordApplication(input, "https://jobs.example.com/apply");
    expect(request).toHaveBeenCalledWith(
      `http://localhost:8000/applications/${applicationId}/submission`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotency_key: input.idempotencyKey,
          resume_version_id: null,
          answers: [],
        }),
      },
    );
  });
});
