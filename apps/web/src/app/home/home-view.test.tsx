import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n";

import HomeView from "./home-view";

const mockListApplications = vi.fn();
const mockListJobs = vi.fn();
const mockListResumes = vi.fn();
const mockGetCareerBrain = vi.fn();
const mockListUpcomingApplicationActivities = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue("token");

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: mockGetToken,
    userId: "user-1",
  }),
  useUser: () => ({ user: { firstName: "Alex", username: null } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({
  listApplications: (...args: unknown[]) => mockListApplications(...args),
  listJobs: (...args: unknown[]) => mockListJobs(...args),
  listResumes: (...args: unknown[]) => mockListResumes(...args),
  getCareerBrain: (...args: unknown[]) => mockGetCareerBrain(...args),
  listUpcomingApplicationActivities: (...args: unknown[]) =>
    mockListUpcomingApplicationActivities(...args),
}));

beforeEach(() => {
  mockListApplications.mockReset().mockResolvedValue([
    {
      id: "app-1",
      job_id: null,
      resume_version_id: null,
      origin: "MANUAL",
      company: "Acme",
      role: "Backend Engineer",
      application_url: null,
      source: "manual",
      status: "INTERVIEW",
      applied_at: "2026-09-20T00:00:00Z",
      status_updated_at: "2026-09-27T00:00:00Z",
      created_at: "2026-09-20T00:00:00Z",
      updated_at: "2026-09-27T00:00:00Z",
    },
  ]);
  mockListJobs.mockReset().mockResolvedValue([
    {
      id: "job-1",
      company: "Figma",
      title: "Software Engineer",
      location: "Remote",
      created_at: "2026-09-27T00:00:00Z",
      updated_at: "2026-09-27T00:00:00Z",
      is_saved: true,
      saved_at: "2026-09-27T00:00:00Z",
    },
  ]);
  mockListResumes.mockReset().mockResolvedValue([{ id: "resume-1" }]);
  mockGetCareerBrain.mockReset().mockResolvedValue({
    id: "brain-1",
    created_at: "2026-09-01T00:00:00Z",
    educations: [],
    experiences: [{ id: "exp-1", details: [] }],
    projects: [],
    skills: [
      {
        id: "skill-1",
        name: "TypeScript",
        preferred: true,
        evidence: null,
      },
    ],
  });
  mockListUpcomingApplicationActivities.mockReset().mockResolvedValue([
    {
      id: "activity-1",
      application_id: "app-1",
      activity_type: "INTERVIEW",
      title: "Technical interview",
      body: null,
      scheduled_at: "2026-10-01T02:30:00Z",
      completed_at: null,
      created_at: "2026-09-28T00:00:00Z",
      updated_at: "2026-09-28T00:00:00Z",
    },
  ]);
});

describe("HomeView", () => {
  it("aggregates next actions, saved opportunities, progress, and Career Brain", async () => {
    render(
      <LocaleProvider>
        <HomeView />
      </LocaleProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Welcome back, Alex." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Your next useful actions" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Figma")).toBeInTheDocument();
    expect(screen.getByText("Software Engineer")).toBeInTheDocument();
    expect(screen.getByText("Acme · Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Technical interview")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Open applications/i }),
    ).toHaveAttribute("href", "/pipeline");
  });
});
