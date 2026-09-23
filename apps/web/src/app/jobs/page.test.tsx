import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import JobsPage from "./page";

const mockListJobs = vi.fn();
const mockCreateJob = vi.fn();
const mockSaveJob = vi.fn();
const mockUnsaveJob = vi.fn();
const mockPush = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue("token");

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: mockGetToken }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/api", () => ({
  listJobs: (...args: unknown[]) => mockListJobs(...args),
  createJob: (...args: unknown[]) => mockCreateJob(...args),
  saveJob: (...args: unknown[]) => mockSaveJob(...args),
  unsaveJob: (...args: unknown[]) => mockUnsaveJob(...args),
}));

const job = {
  id: "job-1",
  company: "Acme",
  title: "Platform Engineer",
  location: "Remote",
  source_url: "https://example.com/job",
  application_url: "https://example.com/apply",
  source_type: "MANUAL_ENTRY",
  captured_at: "2026-09-23T00:00:00Z",
  created_at: "2026-09-23T00:00:00Z",
  updated_at: "2026-09-23T00:00:00Z",
  is_saved: false,
  latest_snapshot: {
    raw_description: "Build reliable platform services with Python.",
    requirements: [{ id: "r1" }, { id: "r2" }],
  },
};

describe("JobsPage", () => {
  beforeEach(() => {
    mockListJobs.mockReset().mockResolvedValue([]);
    mockCreateJob.mockReset();
    mockSaveJob.mockReset();
    mockUnsaveJob.mockReset().mockResolvedValue(undefined);
    mockPush.mockReset();
  });

  it("shows an honest empty state for manual data", async () => {
    render(<JobsPage />);
    expect(
      await screen.findByText("Your Jobs workspace is ready"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/production job sources are still being formed/i),
    ).toBeInTheDocument();
  });

  it("shows loading and recoverable list errors", async () => {
    let rejectList: (reason?: unknown) => void = () => undefined;
    mockListJobs.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectList = reject;
      }),
    );
    render(<JobsPage />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    rejectList(new Error("network unavailable"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not load your jobs",
    );
  });

  it("renders job cards with direct safe apply and detail actions", async () => {
    mockListJobs.mockResolvedValue([job]);
    render(<JobsPage />);
    expect(await screen.findByText("Platform Engineer")).toBeInTheDocument();
    expect(screen.getByText(/2 structured requirements/)).toBeInTheDocument();
    expect(screen.getByText(/not a live job feed/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Apply" })).toHaveAttribute(
      "href",
      "https://example.com/apply",
    );
    expect(screen.getByRole("link", { name: "View details" })).toHaveAttribute(
      "href",
      "/jobs/job-1",
    );
  });

  it("passes search, location, and saved filters to the server", async () => {
    const user = userEvent.setup();
    render(<JobsPage />);
    await screen.findByText("Your Jobs workspace is ready");

    await user.type(screen.getByLabelText("Search"), "platform");
    await user.type(screen.getByLabelText("Location"), "remote");
    await user.click(screen.getByRole("button", { name: "Search jobs" }));
    await vi.waitFor(() =>
      expect(mockListJobs).toHaveBeenLastCalledWith("token", {
        search: "platform",
        location: "remote",
        savedOnly: false,
      }),
    );

    await user.click(screen.getByRole("button", { name: "Saved jobs" }));
    await vi.waitFor(() =>
      expect(mockListJobs).toHaveBeenLastCalledWith("token", {
        search: "platform",
        location: "remote",
        savedOnly: true,
      }),
    );
  });

  it("saves a job and updates the card state", async () => {
    const user = userEvent.setup();
    mockListJobs.mockResolvedValue([job]);
    mockSaveJob.mockResolvedValue({ ...job, is_saved: true });
    render(<JobsPage />);
    await user.click(
      await screen.findByRole("button", { name: "Save Platform Engineer" }),
    );
    expect(mockSaveJob).toHaveBeenCalledWith("token", "job-1");
    expect(
      await screen.findByRole("button", { name: "Unsave Platform Engineer" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("removes an unsaved job from the Saved Jobs view", async () => {
    const user = userEvent.setup();
    const savedJob = { ...job, is_saved: true };
    mockListJobs.mockImplementation(
      (_token: string, filters: { savedOnly: boolean }) =>
        Promise.resolve(filters.savedOnly ? [savedJob] : [job]),
    );
    render(<JobsPage />);
    await screen.findByText("Platform Engineer");
    await user.click(screen.getByRole("button", { name: "Saved jobs" }));
    await user.click(
      await screen.findByRole("button", { name: "Unsave Platform Engineer" }),
    );
    expect(mockUnsaveJob).toHaveBeenCalledWith("token", "job-1");
    expect(await screen.findByText("No saved jobs yet")).toBeInTheDocument();
  });

  it("does not render an unsafe application URL", async () => {
    mockListJobs.mockResolvedValue([
      { ...job, application_url: "javascript:alert(1)" },
    ]);
    render(<JobsPage />);
    expect(
      await screen.findByText("Application link unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Apply" }),
    ).not.toBeInTheDocument();
  });

  it("creates a manual job with an application URL and opens it", async () => {
    const user = userEvent.setup();
    let resolveCreate: (value: { id: string }) => void = () => undefined;
    mockCreateJob.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    render(<JobsPage />);
    await screen.findByText("Your Jobs workspace is ready");
    await user.type(screen.getByLabelText("Company"), "Acme");
    await user.type(screen.getByLabelText("Job title"), "Backend Engineer");
    await user.type(
      screen.getByLabelText("Application URL (optional)"),
      "https://example.com/apply",
    );
    await user.type(
      screen.getByLabelText("Job description"),
      "Python experience is required for this backend role.",
    );
    await user.click(screen.getByRole("button", { name: "Add job" }));
    expect(screen.getByRole("button", { name: "Parsing job…" })).toBeDisabled();
    resolveCreate({ id: "job-new" });
    await vi.waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/jobs/job-new"),
    );
    expect(mockCreateJob).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ application_url: "https://example.com/apply" }),
    );
  });

  it("shows parsing failures without losing the form", async () => {
    const user = userEvent.setup();
    mockCreateJob.mockRejectedValue(new Error("bad parser output"));
    render(<JobsPage />);
    await screen.findByText("Your Jobs workspace is ready");
    await user.type(screen.getByLabelText("Company"), "Acme");
    await user.type(screen.getByLabelText("Job title"), "Engineer");
    await user.type(
      screen.getByLabelText("Job description"),
      "This is a sufficiently long job description for validation.",
    );
    await user.click(screen.getByRole("button", { name: "Add job" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not parse",
    );
    expect(screen.getByLabelText("Company")).toHaveValue("Acme");
  });
});
