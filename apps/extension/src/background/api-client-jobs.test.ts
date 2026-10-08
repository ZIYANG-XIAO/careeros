import { describe, expect, it, vi } from "vitest";

import { CareerOsApiClient } from "./api-client";

const draft = {
  title: " Engineer ",
  company: "Acme",
  location: "  ",
  description: "A description that is long enough.",
  market: "UNKNOWN" as const,
  countryCode: "UNKNOWN" as const,
  workplaceType: "UNKNOWN" as const,
  employmentType: "UNKNOWN" as const,
  expectedPageUrl: "https://attacker.example/other",
};

describe("clipJob", () => {
  it("uses the verified tab URL as the job identity", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          created: true,
          job: {
            id: "0b6f7a9e-3f5c-4e63-9d8e-1a2b3c4d5e6f",
            title: "Engineer",
            company: "Acme",
            is_catalog: false,
            last_observed_at: null,
            posted_at: null,
            sponsorship: { status: "NOT_OFFERED", quote: "No sponsorship." },
          },
        }),
        { status: 201 },
      ),
    );
    const client = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue("token") },
      request,
    );

    await expect(
      client.clipJob(draft, "https://jobs.example.com/1"),
    ).resolves.toEqual({
      jobId: "0b6f7a9e-3f5c-4e63-9d8e-1a2b3c4d5e6f",
      created: true,
      title: "Engineer",
      company: "Acme",
      isCatalog: false,
      lastObservedAt: null,
      postedAt: null,
      sponsorship: "NOT_OFFERED",
    });
    const [url, init] = request.mock.calls[0];
    expect(url).toBe("http://localhost:8000/jobs/clip");
    const body = JSON.parse(init.body as string);
    expect(body.source_url).toBe("https://jobs.example.com/1");
    expect(body.title).toBe("Engineer");
    expect(body.location).toBeNull();
    expect(JSON.stringify(body)).not.toContain("attacker");
  });

  it("returns null when signed out and rejects malformed responses", async () => {
    const signedOut = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue(null) },
      vi.fn(),
    );
    await expect(
      signedOut.clipJob(draft, "https://x.com/1"),
    ).resolves.toBeNull();

    const malformed = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue("token") },
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ job: {} }))),
    );
    await expect(malformed.clipJob(draft, "https://x.com/1")).rejects.toThrow();
  });
});

describe("downloadResumeVersion", () => {
  it("returns the file as base64 with its decoded name", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([37, 80, 68, 70]), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "X-Resume-Filename": "Ada%20R%C3%A9sum%C3%A9.pdf",
        },
      }),
    );
    const client = new CareerOsApiClient(
      "http://localhost:8000",
      { getToken: vi.fn().mockResolvedValue("token") },
      request,
    );
    await expect(
      client.downloadResumeVersion("0b6f7a9e-3f5c-4e63-9d8e-1a2b3c4d5e6f"),
    ).resolves.toEqual({
      fileName: "Ada Résumé.pdf",
      contentType: "application/pdf",
      base64: btoa("%PDF"),
    });
  });
});

describe("draftAnswer", () => {
  function client(response: Response) {
    const request = vi.fn().mockResolvedValue(response);
    return {
      request,
      api: new CareerOsApiClient(
        "http://localhost:8000",
        { getToken: vi.fn().mockResolvedValue("token") },
        request,
      ),
    };
  }

  it("asks for an open-question draft and returns it with its grounding", async () => {
    const { api, request } = client(
      new Response(
        JSON.stringify({
          kind: "OPEN_QUESTION",
          text: "I built Kafka pipelines.",
          evidence: [{ revision_id: "r", content: "Kafka" }],
          unsupported_points: ["GCP"],
          writer_version: "v1",
        }),
      ),
    );
    await expect(
      api.draftAnswer({ question: "Why us?", jobId: null }),
    ).resolves.toEqual({
      status: "DRAFTED",
      text: "I built Kafka pipelines.",
      evidenceCount: 1,
      unsupportedPoints: ["GCP"],
    });
    const [url, init] = request.mock.calls[0];
    expect(url).toBe("http://localhost:8000/drafts");
    expect(JSON.parse(init.body as string)).toEqual({
      kind: "OPEN_QUESTION",
      question: "Why us?",
      job_id: null,
    });
  });

  it("maps refusals to explicit reasons", async () => {
    const sensitive = client(
      new Response(
        JSON.stringify({
          detail: { code: "SENSITIVE_QUESTION", message: "x" },
        }),
        { status: 422 },
      ),
    );
    await expect(
      sensitive.api.draftAnswer({ question: "Visa?", jobId: null }),
    ).resolves.toEqual({ status: "REFUSED", reason: "SENSITIVE" });
    const unavailable = client(new Response("{}", { status: 503 }));
    await expect(
      unavailable.api.draftAnswer({ question: "Why?", jobId: null }),
    ).resolves.toEqual({ status: "REFUSED", reason: "AI_UNAVAILABLE" });
  });
});
