import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n";
import type { ApplicationPacket } from "@/lib/types";

import ApplicationPacketPage from "./page";

const mockGetPacket = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue("token");

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: mockGetToken,
    userId: "user-1",
  }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "app-1" }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getApplicationPacket: (...args: unknown[]) => mockGetPacket(...args),
  };
});

const packet: ApplicationPacket = {
  application: {
    id: "app-1",
    job_id: "job-1",
    resume_version_id: "version-1",
    origin: "CAREEROS_JOB",
    company: "Stripe",
    role: "Platform Engineer",
    application_url: "https://jobs.example.com/apply",
    source: "greenhouse",
    status: "INTERVIEW",
    applied_at: "2026-09-20T12:00:00Z",
    status_updated_at: "2026-09-25T12:00:00Z",
    created_at: "2026-09-19T12:00:00Z",
    updated_at: "2026-09-25T12:00:00Z",
    answers: [
      {
        id: "answer-1",
        canonical_key: null,
        question_text: "Why Stripe?",
        answer_text: "I build payment infrastructure.",
        source_category: "USER",
        policy_category: "STANDARD",
        sensitivity: "NONE",
        position: 0,
        confirmed_at: "2026-09-20T12:00:00Z",
        created_at: "2026-09-20T12:00:00Z",
      },
    ],
  },
  resume_version: {
    id: "version-1",
    resume_name: "Backend Resume",
    version_number: 3,
    original_filename: "resume.pdf",
    created_at: "2026-09-01T12:00:00Z",
  },
  job_snapshot: {
    id: "snap-1",
    version_number: 1,
    description: "Kafka experience required.",
    captured_at: "2026-09-18T12:00:00Z",
    basis: "AT_SUBMISSION",
  },
  status_history: [
    {
      from_status: null,
      to_status: "APPLIED",
      changed_at: "2026-09-20T12:00:00Z",
    },
    {
      from_status: "APPLIED",
      to_status: "INTERVIEW",
      changed_at: "2026-09-25T12:00:00Z",
    },
  ],
  activities: [],
  contacts: [],
};

beforeEach(() => {
  mockGetPacket.mockReset().mockResolvedValue(packet);
});

describe("ApplicationPacketPage", () => {
  it("lays out the resume, answers, timeline, and the job description on file", async () => {
    render(
      <LocaleProvider>
        <ApplicationPacketPage />
      </LocaleProvider>,
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Platform Engineer",
      }),
    ).toBeInTheDocument();
    expect(mockGetPacket).toHaveBeenCalledWith("token", "app-1");
    expect(screen.getByText(/Backend Resume · v3/)).toBeInTheDocument();
    expect(screen.getByText("Why Stripe?")).toBeInTheDocument();
    expect(screen.getByText("Applied → Interview")).toBeInTheDocument();
    expect(screen.getByText("Kafka experience required.")).toBeInTheDocument();
    expect(
      screen.getByText(/the latest version on record when you applied/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Print or save as PDF" }),
    ).toBeInTheDocument();
  });
});
