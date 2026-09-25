import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ApplicationsPage from "./page";

const mockListApplications = vi.fn();
const mockListResumes = vi.fn();
const mockCreateApplication = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue("token");

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: mockGetToken }),
}));

vi.mock("@/lib/api", () => ({
  listApplications: (...args: unknown[]) => mockListApplications(...args),
  listResumes: (...args: unknown[]) => mockListResumes(...args),
  createApplication: (...args: unknown[]) => mockCreateApplication(...args),
}));

const application = {
  id: "application-1",
  job_id: "job-1",
  resume_version_id: "resume-version-1",
  origin: "CAREEROS_JOB" as const,
  company: "Acme",
  role: "Platform Engineer",
  application_url: "https://example.com/apply",
  source: "manual",
  status: "APPLIED" as const,
  applied_at: "2026-09-25T01:00:00Z",
  status_updated_at: "2026-09-25T01:00:00Z",
  created_at: "2026-09-25T01:00:00Z",
  updated_at: "2026-09-25T01:00:00Z",
  answers: [],
};

const resumes = [
  {
    id: "resume-1",
    name: "Backend Resume",
    versions: [{ id: "resume-version-1", version_number: 3 }],
  },
];

describe("ApplicationsPage", () => {
  beforeEach(() => {
    mockListApplications.mockReset().mockResolvedValue([]);
    mockListResumes.mockReset().mockResolvedValue(resumes);
    mockCreateApplication.mockReset().mockResolvedValue(application);
  });

  it("shows real empty and manual recovery states", async () => {
    render(<ApplicationsPage />);
    expect(
      await screen.findByText("No applications recorded yet"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Mark an application as applied" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore jobs/i })).toHaveAttribute(
      "href",
      "/jobs",
    );
  });

  it("shows source, status, applied date, and exact resume", async () => {
    mockListApplications.mockResolvedValue([application]);
    render(<ApplicationsPage />);

    expect(await screen.findByText("Platform Engineer")).toBeInTheDocument();
    expect(screen.getAllByText("Applied").length).toBeGreaterThan(1);
    expect(
      screen.getAllByText("Backend Resume · Version 3").length,
    ).toBeGreaterThan(1);
    expect(screen.getByText(/CareerOS Job · manual/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Platform Engineer/i }),
    ).toHaveAttribute("href", "/applications/application-1");
  });

  it("filters applications by status", async () => {
    const user = userEvent.setup();
    render(<ApplicationsPage />);
    await screen.findByText("No applications recorded yet");

    await user.selectOptions(screen.getByLabelText("Status"), "INTERVIEW");
    await vi.waitFor(() =>
      expect(mockListApplications).toHaveBeenLastCalledWith(
        "token",
        "INTERVIEW",
      ),
    );
  });

  it("records a manual applied fallback with the selected resume", async () => {
    const user = userEvent.setup();
    render(<ApplicationsPage />);
    await screen.findByText("No applications recorded yet");

    await user.type(screen.getByLabelText("Company"), "Outside Corp");
    await user.type(screen.getByLabelText("Role"), "Backend Engineer");
    await user.type(
      screen.getByLabelText("Application URL"),
      "https://outside.example/apply",
    );
    await user.selectOptions(
      screen.getByLabelText("Resume used"),
      "resume-version-1",
    );
    await user.click(
      screen.getByRole("button", { name: "Record application" }),
    );

    await vi.waitFor(() =>
      expect(mockCreateApplication).toHaveBeenCalledOnce(),
    );
    expect(mockCreateApplication).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        origin: "MANUAL",
        company: "Outside Corp",
        role: "Backend Engineer",
        application_url: "https://outside.example/apply",
        resume_version_id: "resume-version-1",
        status: "APPLIED",
      }),
    );
    expect(
      await screen.findByRole("link", { name: /Application recorded/i }),
    ).toHaveAttribute("href", "/applications/application-1");
  });
});
