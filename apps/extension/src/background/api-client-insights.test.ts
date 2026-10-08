import { describe, expect, it, vi } from "vitest";

import {
  analyzeJob,
  coverLetterFile,
  lookupPageJob,
} from "./api-client-insights";

const tokens = { getToken: vi.fn().mockResolvedValue("token") };
const JOB_ID = "0b6f7a9e-3f5c-4e63-9d8e-1a2b3c4d5e6f";
const VERSION_ID = "1b6f7a9e-3f5c-4e63-9d8e-1a2b3c4d5e6f";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("lookupPageJob", () => {
  it("maps the job behind a page and keeps only stated facts", async () => {
    const request = vi.fn().mockResolvedValue(
      json({
        id: JOB_ID,
        title: "Platform Engineer",
        company: "Stripe",
        posted_at: "2026-10-01T00:00:00Z",
        salary: {
          minimum: 150000,
          maximum: 190000,
          currency: "USD",
          period: "YEAR",
          quote: "x",
        },
        sponsorship: { status: "NOT_OFFERED", quote: "x" },
        is_catalog: true,
        last_observed_at: "2026-10-02T00:00:00Z",
        is_saved: false,
      }),
    );
    const job = await lookupPageJob(
      "http://api",
      tokens,
      request,
      "https://boards.greenhouse.io/stripe/jobs/1",
    );
    expect(job).toEqual({
      jobId: JOB_ID,
      title: "Platform Engineer",
      company: "Stripe",
      postedAt: "2026-10-01T00:00:00Z",
      salary: {
        minimum: 150000,
        maximum: 190000,
        currency: "USD",
        period: "YEAR",
      },
      sponsorship: "NOT_OFFERED",
      isCatalog: true,
      lastObservedAt: "2026-10-02T00:00:00Z",
      isSaved: false,
    });
    expect(request.mock.calls[0][0]).toBe(
      "http://api/jobs/lookup?url=https%3A%2F%2Fboards.greenhouse.io%2Fstripe%2Fjobs%2F1",
    );
  });

  it("reports unknown pages as not found", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(json({ detail: "Job not found" }, 404));
    await expect(
      lookupPageJob("http://api", tokens, request, "https://example.com/x"),
    ).resolves.toBe("NOT_FOUND");
  });
});

describe("analyzeJob", () => {
  it("extracts requirements first when a catalog job has none, then analyzes", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        json({ detail: { code: "REQUIREMENTS_PENDING" } }, 409),
      )
      .mockResolvedValueOnce(json({}, 200))
      .mockResolvedValueOnce(
        json(
          {
            resume_name: "Backend Resume",
            resume_version_number: 2,
            created_at: "2026-10-02T00:00:00Z",
            matches: [
              { description: "Kafka", classification: "HIDDEN_EVIDENCE" },
              { description: "GCP", classification: "GENUINE_GAP" },
            ],
          },
          201,
        ),
      );
    const result = await analyzeJob(
      "http://api",
      tokens,
      request,
      JOB_ID,
      VERSION_ID,
    );
    expect(request.mock.calls.map((call) => call[0])).toEqual([
      `http://api/jobs/${JOB_ID}/analyses`,
      `http://api/jobs/${JOB_ID}/requirements`,
      `http://api/jobs/${JOB_ID}/analyses`,
    ]);
    expect(result).toEqual({
      status: "ANALYZED",
      summary: {
        resumeLabel: "Backend Resume · v2",
        analyzedAt: "2026-10-02T00:00:00Z",
        requirements: [
          { description: "Kafka", classification: "HIDDEN_EVIDENCE" },
          { description: "GCP", classification: "GENUINE_GAP" },
        ],
      },
    });
  });

  it("explains when analysis is not configured", async () => {
    const request = vi.fn().mockResolvedValue(json({}, 503));
    await expect(
      analyzeJob("http://api", tokens, request, JOB_ID, VERSION_ID),
    ).resolves.toEqual({ status: "REFUSED", reason: "AI_UNAVAILABLE" });
  });
});

describe("coverLetterFile", () => {
  it("returns the rendered letter as an attachable file", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([80, 75, 3, 4]), {
        headers: {
          "content-disposition":
            'attachment; filename="Cover letter - Stripe.docx"',
        },
      }),
    );
    const file = await coverLetterFile(
      "http://api",
      tokens,
      request,
      "Dear team",
      "Cover letter - Stripe",
    );
    expect(file).toEqual({
      fileName: "Cover letter - Stripe.docx",
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      base64: "UEsDBA==",
    });
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({
      text: "Dear team",
      filename_hint: "Cover letter - Stripe",
    });
  });
});
