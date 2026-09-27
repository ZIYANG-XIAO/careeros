import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n";
import type { Application, Job } from "@/lib/types";

import { FocusPanel } from "./focus-panel";

const mockGetApplication = vi.fn();
const mockListResumes = vi.fn();
const mockListJobAnalyses = vi.fn();
const mockUpdateApplicationStatus = vi.fn();
const mockGetJob = vi.fn();
const mockSaveJob = vi.fn();
const mockUnsaveJob = vi.fn();
const mockCreateApplication = vi.fn();
const mockCreateJobAnalysis = vi.fn();
const mockListApplications = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue("token");

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));

vi.mock("@/lib/api", () => ({
  getApplication: (...args: unknown[]) => mockGetApplication(...args),
  listResumes: (...args: unknown[]) => mockListResumes(...args),
  listJobAnalyses: (...args: unknown[]) => mockListJobAnalyses(...args),
  updateApplicationStatus: (...args: unknown[]) =>
    mockUpdateApplicationStatus(...args),
  getJob: (...args: unknown[]) => mockGetJob(...args),
  saveJob: (...args: unknown[]) => mockSaveJob(...args),
  unsaveJob: (...args: unknown[]) => mockUnsaveJob(...args),
  createApplication: (...args: unknown[]) => mockCreateApplication(...args),
  createJobAnalysis: (...args: unknown[]) => mockCreateJobAnalysis(...args),
  listApplications: (...args: unknown[]) => mockListApplications(...args),
}));

const application: Application = {
  id: "app-1",
  job_id: null,
  resume_version_id: null,
  origin: "MANUAL",
  company: "Acme",
  role: "Platform Engineer",
  application_url: "https://example.com/apply",
  source: "manual",
  status: "APPLIED",
  applied_at: "2026-09-20T00:00:00Z",
  status_updated_at: "2026-09-20T00:00:00Z",
  created_at: "2026-09-20T00:00:00Z",
  updated_at: "2026-09-20T00:00:00Z",
  answers: [],
};

const job: Job = {
  id: "job-1",
  company: "Globex",
  title: "Backend Engineer",
  location: "Remote",
  source_url: null,
  application_url: "https://example.com/job/apply",
  source_type: "MANUAL_ENTRY",
  source_key: "manual",
  external_job_id: null,
  canonical_url: null,
  first_observed_at: null,
  last_observed_at: null,
  availability_status: "UNKNOWN",
  freshness_status: "UNKNOWN",
  market: "UNKNOWN",
  country_code: "UNKNOWN",
  workplace_type: "UNKNOWN",
  employment_type: "UNKNOWN",
  captured_at: "2026-09-20T00:00:00Z",
  created_at: "2026-09-20T00:00:00Z",
  updated_at: "2026-09-20T00:00:00Z",
  is_saved: false,
  saved_at: null,
  latest_snapshot: {
    id: "snap-1",
    version_number: 1,
    raw_description: "Build things.",
    normalized_description: "Build things.",
    content_sha256: "abc",
    parser_version: "v1",
    parser_model: "test",
    created_at: "2026-09-20T00:00:00Z",
    requirements: [],
  },
};

function renderPanel(
  target: { kind: "application" | "job"; id: string },
  onClose = vi.fn(),
) {
  return render(
    <LocaleProvider>
      <FocusPanel target={target} onClose={onClose} />
    </LocaleProvider>,
  );
}

describe("FocusPanel — application flavour", () => {
  beforeEach(() => {
    mockGetApplication.mockReset().mockResolvedValue(application);
    mockListResumes.mockReset().mockResolvedValue([]);
    mockListJobAnalyses.mockReset().mockResolvedValue([]);
    mockUpdateApplicationStatus.mockReset();
  });

  it("renders identity, stage and facts once loaded", async () => {
    renderPanel({ kind: "application", id: "app-1" });
    expect(await screen.findByText("Platform Engineer")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Applied" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByText("No answers were recorded with this application."),
    ).toBeInTheDocument();
  });

  it("shows a retry action when loading fails", async () => {
    mockGetApplication.mockRejectedValue(new Error("boom"));
    renderPanel({ kind: "application", id: "app-1" });
    expect(
      await screen.findByText(
        "We could not load this application. Nothing was changed.",
      ),
    ).toBeInTheDocument();

    mockGetApplication.mockResolvedValue(application);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Platform Engineer")).toBeInTheDocument();
  });

  it("changes stage optimistically and reverts on failure", async () => {
    mockUpdateApplicationStatus.mockRejectedValue(new Error("nope"));
    const user = userEvent.setup();
    renderPanel({ kind: "application", id: "app-1" });
    await screen.findByText("Platform Engineer");

    await user.click(screen.getByRole("button", { name: "Interview" }));

    expect(
      await screen.findByText(
        "Could not save the new stage. It has been put back to Applied.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Applied" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("calls onClose on Escape", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderPanel({ kind: "application", id: "app-1" }, onClose);
    await screen.findByText("Platform Engineer");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("FocusPanel — job flavour", () => {
  beforeEach(() => {
    mockGetJob.mockReset().mockResolvedValue(job);
    mockListResumes.mockReset().mockResolvedValue([]);
    mockListJobAnalyses.mockReset().mockResolvedValue([]);
    mockListApplications.mockReset().mockResolvedValue([]);
    mockSaveJob.mockReset().mockResolvedValue({
      ...job,
      is_saved: true,
      saved_at: "2026-09-27T00:00:00Z",
    });
  });

  it("renders job identity and the save action when not in the pipeline", async () => {
    renderPanel({ kind: "job", id: "job-1" });
    expect(await screen.findByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Globex")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save to pipeline" }),
    ).toBeInTheDocument();
  });

  it("omits UNKNOWN chips instead of rendering the word Unknown", async () => {
    renderPanel({ kind: "job", id: "job-1" });
    await screen.findByText("Backend Engineer");
    expect(screen.queryByText(/unknown/i)).not.toBeInTheDocument();
    expect(screen.getByText("Remote")).toBeInTheDocument();
  });

  it("hides Save to pipeline once the job is saved", async () => {
    const user = userEvent.setup();
    renderPanel({ kind: "job", id: "job-1" });
    await user.click(
      await screen.findByRole("button", { name: "Save to pipeline" }),
    );
    expect(
      screen.queryByRole("button", { name: "Save to pipeline" }),
    ).not.toBeInTheDocument();
  });

  it("shows the in-pipeline strip when an application is already linked", async () => {
    mockListApplications.mockResolvedValue([
      { ...application, id: "app-9", job_id: "job-1", status: "INTERVIEW" },
    ]);
    mockGetApplication.mockResolvedValue({
      ...application,
      id: "app-9",
      job_id: "job-1",
      status: "INTERVIEW",
    });
    renderPanel({ kind: "job", id: "job-1" });
    expect(
      await screen.findByText("In pipeline · Interview"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open in pipeline" }),
    ).toHaveAttribute("href", "/pipeline?view=list&focus=app-9");
  });
});

describe("FocusPanel — close button", () => {
  it("has an accessible close control", async () => {
    mockGetApplication.mockResolvedValue(application);
    mockListResumes.mockResolvedValue([]);
    mockListJobAnalyses.mockResolvedValue([]);
    renderPanel({ kind: "application", id: "app-1" });
    const panel = await screen.findByText("Platform Engineer");
    expect(
      within(panel.closest("aside") as HTMLElement).getByRole("button", {
        name: "Close",
      }),
    ).toBeInTheDocument();
  });
});
