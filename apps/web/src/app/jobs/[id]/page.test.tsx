import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import JobDetailPage from "./page";

const mockGetJob = vi.fn();
const mockListResumes = vi.fn();
const mockListAnalyses = vi.fn();
const mockCreateAnalysis = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue("token");

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: mockGetToken,
  }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "job-1" }),
}));

vi.mock("@/lib/api", () => ({
  getJob: (...args: unknown[]) => mockGetJob(...args),
  listResumes: (...args: unknown[]) => mockListResumes(...args),
  listJobAnalyses: (...args: unknown[]) => mockListAnalyses(...args),
  createJobAnalysis: (...args: unknown[]) => mockCreateAnalysis(...args),
}));

const job = {
  id: "job-1",
  company: "Acme",
  title: "Platform Engineer",
  location: "Remote",
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
  });

  it("shows parsed requirements and the pre-analysis empty state", async () => {
    render(<JobDetailPage />);
    expect(await screen.findByText("Platform Engineer")).toBeInTheDocument();
    expect(screen.getByText("Grounded requirements")).toBeInTheDocument();
    expect(
      screen.getByText("No Job Intelligence analysis yet"),
    ).toBeInTheDocument();
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
    const resumeSelect = screen.getByLabelText("Resume for this analysis");
    await user.selectOptions(resumeSelect, "version-1");
    await vi.waitFor(() => expect(resumeSelect).toHaveValue("version-1"));
    await user.click(screen.getByRole("button", { name: "Analyze job" }));
    expect(screen.getByRole("button")).toHaveTextContent("Analyzing evidence");
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
    await screen.findByText("Platform Engineer");
    await user.click(screen.getByRole("button", { name: "Analyze job" }));
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
      screen.queryByRole("button", { name: "Analyze job" }),
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
