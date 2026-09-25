import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import JobDetailPage from "./page";

const mockGetJob = vi.fn();
const mockListResumes = vi.fn();
const mockListAnalyses = vi.fn();
const mockCreateAnalysis = vi.fn();
const mockCreateApplication = vi.fn();
const mockSaveJob = vi.fn();
const mockUnsaveJob = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue("token");

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: mockGetToken }),
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "job-1" }) }));

vi.mock("@/lib/api", () => ({
  createApplication: (...args: unknown[]) => mockCreateApplication(...args),
  getJob: (...args: unknown[]) => mockGetJob(...args),
  listResumes: (...args: unknown[]) => mockListResumes(...args),
  listJobAnalyses: (...args: unknown[]) => mockListAnalyses(...args),
  createJobAnalysis: (...args: unknown[]) => mockCreateAnalysis(...args),
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
  source_key: "manual",
  external_job_id: null,
  canonical_url: null,
  first_observed_at: "2026-09-23T00:00:00Z",
  last_observed_at: "2026-09-23T00:00:00Z",
  availability_status: "UNKNOWN" as const,
  freshness_status: "UNKNOWN" as const,
  captured_at: "2026-09-23T00:00:00Z",
  created_at: "2026-09-23T00:00:00Z",
  updated_at: "2026-09-23T00:00:00Z",
  is_saved: false,
  latest_snapshot: {
    raw_description:
      "Kafka required. Kubernetes preferred. GCP required. SQL required.",
    requirements: [
      {
        id: "req-1",
        category: "SKILL",
        description: "Kafka required",
        normalized_value: "Kafka",
        importance: "REQUIRED",
        source_text: "Kafka required",
      },
    ],
  },
};

const resumes = [
  {
    id: "resume-1",
    name: "Backend Resume",
    versions: [
      { id: "version-2", version_number: 2 },
      { id: "version-1", version_number: 1 },
    ],
  },
];

function match(
  id: string,
  classification: string,
  description: string,
  explanation: string,
) {
  return {
    id,
    requirement_id: `req-${id}`,
    category: "SKILL",
    description,
    normalized_value: description,
    importance: "REQUIRED",
    source_text: description,
    support_strength:
      classification === "GENUINE_GAP"
        ? "NONE_OR_INSUFFICIENT"
        : classification === "WEAK_EVIDENCE"
          ? "WEAK"
          : "STRONG",
    resume_representation:
      classification === "STRONG_EVIDENCE" ? "REPRESENTED" : "ABSENT",
    classification,
    explanation,
    resume_source_text:
      classification === "STRONG_EVIDENCE" ? "Built Kafka services" : null,
    evidence_references:
      classification === "GENUINE_GAP"
        ? []
        : [
            {
              career_evidence_revision_id: `rev-${id}`,
              source_type: "EXPERIENCE_DETAIL",
              evidence_content: `Evidence for ${description}`,
            },
          ],
  };
}

const analysis = {
  id: "analysis-1",
  resume_version_id: "version-2",
  resume_name: "Backend Resume",
  resume_version_number: 2,
  analysis_version: 1,
  overall_recommendation: "STRETCH",
  summary: "1 strong, 1 hidden, 1 weak, and 1 genuine gap requirements.",
  matches: [
    match("1", "STRONG_EVIDENCE", "Kafka", "Direct production support."),
    match(
      "2",
      "HIDDEN_EVIDENCE",
      "Kubernetes",
      "Strong evidence is missing from the resume.",
    ),
    match("3", "WEAK_EVIDENCE", "Distributed systems", "Support is indirect."),
    match("4", "GENUINE_GAP", "GCP", "No confirmed GCP evidence exists."),
  ],
};

describe("JobDetailPage", () => {
  beforeEach(() => {
    mockGetJob.mockReset().mockResolvedValue(job);
    mockListResumes.mockReset().mockResolvedValue(resumes);
    mockListAnalyses.mockReset().mockResolvedValue([]);
    mockCreateAnalysis.mockReset();
    mockCreateApplication.mockReset().mockResolvedValue({
      id: "application-1",
      status: "PREPARING",
    });
    mockSaveJob.mockReset().mockResolvedValue({ ...job, is_saved: true });
    mockUnsaveJob.mockReset().mockResolvedValue(undefined);
  });

  it("prioritizes direct application and makes intelligence optional", async () => {
    const user = userEvent.setup();
    render(<JobDetailPage />);
    expect(await screen.findByText("Platform Engineer")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start and track application" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Start and track application" }),
    );
    expect(mockCreateApplication).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        origin: "CAREEROS_JOB",
        job_id: "job-1",
        resume_version_id: "version-2",
        status: "PREPARING",
      }),
    );
    expect(
      await screen.findByRole("link", { name: /Continue on company site/i }),
    ).toHaveAttribute("href", "https://example.com/apply");
    expect(
      screen.getByRole("link", { name: "View tracked application" }),
    ).toHaveAttribute("href", "/applications/application-1");
    expect(screen.getByText("Grounded requirements")).toBeInTheDocument();
    expect(
      screen.getByText(/You can apply without running an analysis/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No Job Intelligence analysis yet"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /compare these requirements with confirmed Career Brain evidence/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows canonical source and unknown freshness honestly", async () => {
    mockGetJob.mockResolvedValue({
      ...job,
      source_type: "EXTERNAL_SOURCE",
      source_key: "demo",
      external_job_id: "demo-1",
      canonical_url: "https://example.com/job",
      availability_status: "AVAILABLE",
    });
    render(<JobDetailPage />);
    expect(
      await screen.findByText("Demo source · available · freshness unknown"),
    ).toBeInTheDocument();
  });

  it("saves the job without creating an application", async () => {
    const user = userEvent.setup();
    render(<JobDetailPage />);
    await user.click(await screen.findByRole("button", { name: "Save job" }));
    expect(mockSaveJob).toHaveBeenCalledWith("token", "job-1");
    expect(
      await screen.findByRole("button", { name: "Saved · Remove" }),
    ).toBeInTheDocument();
    expect(mockCreateApplication).not.toHaveBeenCalled();
  });

  it("shows an honest state when no application link exists", async () => {
    mockGetJob.mockResolvedValue({ ...job, application_url: null });
    render(<JobDetailPage />);
    expect(
      await screen.findByText(/No application link is available/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Start and track application/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps a direct manual recovery path when tracking fails", async () => {
    const user = userEvent.setup();
    mockCreateApplication.mockRejectedValue(new Error("offline"));
    render(<JobDetailPage />);
    await user.click(
      await screen.findByRole("button", {
        name: "Start and track application",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not start tracking",
    );
    expect(
      screen.getByRole("link", { name: /Open application without tracking/i }),
    ).toHaveAttribute("href", "https://example.com/apply");
  });

  it("renders all four explainable evidence categories", async () => {
    mockListAnalyses.mockResolvedValue([analysis]);
    render(<JobDetailPage />);
    expect(await screen.findByText("Strong Evidence")).toBeInTheDocument();
    expect(screen.getByText("Hidden Evidence")).toBeInTheDocument();
    expect(screen.getByText("Weak Evidence")).toBeInTheDocument();
    expect(screen.getByText("Genuine Gaps")).toBeInTheDocument();
    expect(screen.getByText("Direct production support.")).toBeInTheDocument();
    expect(screen.getByText("Evidence for Kafka")).toBeInTheDocument();
    expect(
      screen.getByText(/not an interview or offer probability/),
    ).toBeInTheDocument();
  });

  it("uses the selected ResumeVersion and shows analysis progress", async () => {
    const user = userEvent.setup();
    let resolveAnalysis: (value: typeof analysis) => void = () => undefined;
    mockCreateAnalysis.mockReturnValue(
      new Promise((resolve) => {
        resolveAnalysis = resolve;
      }),
    );
    render(<JobDetailPage />);
    await screen.findByText("Platform Engineer");
    const resumeSelect = screen.getByLabelText("Resume for analysis");
    await user.selectOptions(resumeSelect, "version-1");
    await user.click(screen.getByRole("button", { name: "Analyze this job" }));
    expect(
      screen.getByRole("button", { name: "Analyzing evidence…" }),
    ).toBeDisabled();
    expect(mockCreateAnalysis).toHaveBeenCalledWith(
      "token",
      "job-1",
      "version-1",
    );
    resolveAnalysis(analysis);
    expect(await screen.findByText("Strong Evidence")).toBeInTheDocument();
  });

  it("shows a recoverable analysis failure", async () => {
    const user = userEvent.setup();
    mockCreateAnalysis.mockRejectedValue(new Error("provider unavailable"));
    render(<JobDetailPage />);
    await user.click(
      await screen.findByRole("button", { name: "Analyze this job" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not complete",
    );
  });

  it("guides users to upload a resume when none exists", async () => {
    mockListResumes.mockResolvedValue([]);
    render(<JobDetailPage />);
    const link = await screen.findByRole("link", {
      name: "Upload and confirm a resume",
    });
    expect(link).toHaveAttribute("href", "/resumes");
    expect(
      screen.queryByRole("button", { name: "Analyze this job" }),
    ).not.toBeInTheDocument();
  });

  it("shows an ownership-safe error when the job cannot be loaded", async () => {
    mockGetJob.mockRejectedValue(new Error("404"));
    render(<JobDetailPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "do not have access",
    );
  });

  it("keeps intelligence content available in a narrow viewport", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
    mockListAnalyses.mockResolvedValue([analysis]);
    render(<JobDetailPage />);
    const categories = await screen.findByRole("region", {
      name: "Job Intelligence categories",
    });
    expect(within(categories).getByText("Hidden Evidence")).toBeVisible();
    expect(within(categories).getByText("Genuine Gaps")).toBeVisible();
  });
});
