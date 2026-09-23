import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import JobsPage from "./page";

const mockListJobs = vi.fn();
const mockCreateJob = vi.fn();
const mockPush = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue("token");

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: mockGetToken,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/api", () => ({
  listJobs: (...args: unknown[]) => mockListJobs(...args),
  createJob: (...args: unknown[]) => mockCreateJob(...args),
}));

describe("JobsPage", () => {
  beforeEach(() => {
    mockListJobs.mockReset().mockResolvedValue([]);
    mockCreateJob.mockReset();
    mockPush.mockReset();
  });

  it("shows a useful empty state", async () => {
    render(<JobsPage />);
    expect(await screen.findByText(/No jobs yet/)).toBeInTheDocument();
  });

  it("renders captured jobs and grounded requirement counts", async () => {
    mockListJobs.mockResolvedValue([
      {
        id: "job-1",
        company: "Acme",
        title: "Platform Engineer",
        location: "Remote",
        latest_snapshot: { requirements: [{ id: "r1" }, { id: "r2" }] },
      },
    ]);
    render(<JobsPage />);
    expect(await screen.findByText("Platform Engineer")).toBeInTheDocument();
    expect(screen.getByText(/2 grounded requirements/)).toBeInTheDocument();
  });

  it("creates a job from direct JD input and opens it", async () => {
    const user = userEvent.setup();
    let resolveCreate: (value: { id: string }) => void = () => undefined;
    mockCreateJob.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    render(<JobsPage />);
    await screen.findByText(/No jobs yet/);
    await user.type(screen.getByLabelText("Company"), "Acme");
    await user.type(screen.getByLabelText("Job title"), "Backend Engineer");
    await user.type(
      screen.getByLabelText("Job description"),
      "Python experience is required for this backend role.",
    );
    await user.click(screen.getByRole("button", { name: "Create job" }));
    expect(screen.getByRole("button")).toHaveTextContent(
      "Parsing requirements",
    );
    resolveCreate({ id: "job-new" });
    await vi.waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/jobs/job-new"),
    );
  });

  it("shows parsing failures without losing the form", async () => {
    const user = userEvent.setup();
    mockCreateJob.mockRejectedValue(new Error("bad parser output"));
    render(<JobsPage />);
    await screen.findByText(/No jobs yet/);
    await user.type(screen.getByLabelText("Company"), "Acme");
    await user.type(screen.getByLabelText("Job title"), "Engineer");
    await user.type(
      screen.getByLabelText("Job description"),
      "This is a sufficiently long job description for validation.",
    );
    await user.click(screen.getByRole("button", { name: "Create job" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not parse",
    );
    expect(screen.getByLabelText("Company")).toHaveValue("Acme");
  });
});
