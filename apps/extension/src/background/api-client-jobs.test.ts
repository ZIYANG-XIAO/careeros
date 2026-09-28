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
          job: { id: "0b6f7a9e-3f5c-4e63-9d8e-1a2b3c4d5e6f" },
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
