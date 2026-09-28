import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n";
import type { ApplicationSummary, Job, ResumeSummary } from "@/lib/types";

import PipelineView from "./pipeline-view";

const mockListApplications = vi.fn();
const mockListJobs = vi.fn();
const mockListResumes = vi.fn();
const mockUpdateApplicationStatus = vi.fn();
const mockCreateApplication = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue("token");
const mockPush = vi.fn();
const mockReplace = vi.fn();

let currentSearch = "";

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: mockGetToken,
    userId: "user-1",
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => "/pipeline",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    listApplications: (...args: unknown[]) => mockListApplications(...args),
    listJobs: (...args: unknown[]) => mockListJobs(...args),
    listResumes: (...args: unknown[]) => mockListResumes(...args),
    updateApplicationStatus: (...args: unknown[]) =>
      mockUpdateApplicationStatus(...args),
    createApplication: (...args: unknown[]) => mockCreateApplication(...args),
  };
});

vi.mock("@/components/focus-panel", () => ({
  FocusPanel: ({ target }: { target: { kind: string; id: string } }) => (
    <div data-testid="focus-panel">
      {target.kind}:{target.id}
    </div>
  ),
}));

const mockDownloadCsv = vi.fn();

vi.mock("@/lib/csv", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/csv")>();
  return {
    ...actual,
    downloadCsv: (...args: unknown[]) => mockDownloadCsv(...args),
  };
});

const savedJob: Job = {
  id: "job-1",
  company: "Figma",
  title: "Full Stack Engineer",
  location: "Remote",
  source_url: null,
  application_url: "https://example.com/apply",
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
  captured_at: "2026-09-19T00:00:00Z",
  created_at: "2026-09-19T00:00:00Z",
  updated_at: "2026-09-19T00:00:00Z",
  is_saved: true,
  saved_at: "2026-09-19T00:00:00Z",
  is_catalog: false,
  similar_count: 0,
  other_locations: [],
  latest_snapshot: {
    id: "snap-1",
    version_number: 1,
    raw_description: "",
    normalized_description: "",
    content_sha256: "x",
    parser_version: "v1",
    parser_model: "test",
    requirements_status: "PARSED",
    created_at: "2026-09-19T00:00:00Z",
    requirements: [],
  },
};

function makeApplication(
  overrides: Partial<ApplicationSummary> = {},
): ApplicationSummary {
  return {
    id: "app-1",
    job_id: null,
    resume_version_id: null,
    origin: "MANUAL",
    company: "Together AI",
    role: "Backend Engineer",
    application_url: null,
    source: "manual",
    status: "APPLIED",
    applied_at: "2026-09-19T00:00:00Z",
    status_updated_at: "2026-09-19T00:00:00Z",
    created_at: "2026-09-19T00:00:00Z",
    updated_at: "2026-09-19T00:00:00Z",
    ...overrides,
  };
}

const resumes: ResumeSummary[] = [
  {
    id: "resume-1",
    name: "Backend Resume",
    type: "PDF",
    is_primary: true,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    versions: [
      {
        id: "version-1",
        version_number: 2,
        source: "UPLOAD",
        created_by: "user",
        source_version_id: null,
        original_filename: "resume.pdf",
        content_type: "application/pdf",
        size_bytes: 100,
        sha256: "abc",
        parser_version: "v1",
        extracted_text: "",
        structured_content: {},
        created_at: "2026-09-01T00:00:00Z",
      },
    ],
  },
];

function renderPipeline() {
  return render(
    <LocaleProvider>
      <PipelineView />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  currentSearch = "";
  mockListApplications.mockReset().mockResolvedValue([makeApplication()]);
  mockListJobs.mockReset().mockResolvedValue([savedJob]);
  mockListResumes.mockReset().mockResolvedValue(resumes);
  mockUpdateApplicationStatus.mockReset();
  mockCreateApplication.mockReset();
  mockPush.mockReset();
  mockReplace.mockReset();
  mockDownloadCsv.mockReset();
  window.localStorage.clear();
});

describe("PipelineView", () => {
  it("presents the application center before the full pipeline", async () => {
    renderPipeline();

    expect(
      await screen.findByRole("heading", {
        name: "Application center",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Your next useful actions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "All opportunities" }),
    ).toBeInTheDocument();
  });

  it("renders the saved column and stage columns with counts", async () => {
    renderPipeline();
    expect(await screen.findByText("Full Stack Engineer")).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText(/Saved · 1/)).toBeInTheDocument();
  });

  it("opens the record popover when a saved job is dropped on a stage column", async () => {
    renderPipeline();
    await screen.findByText("Full Stack Engineer");

    const savedCard = screen.getByText("Full Stack Engineer").closest("div");
    const appliedColumn = screen.getByText(/^Applied ·/).closest("section")!;

    fireEvent.dragStart(savedCard!);
    fireEvent.dragOver(appliedColumn);
    fireEvent.drop(appliedColumn);

    expect(
      await screen.findByText("Record this application?"),
    ).toBeInTheDocument();

    const user = userEvent.setup();
    mockCreateApplication.mockResolvedValue(
      makeApplication({ id: "new-app", job_id: "job-1", status: "APPLIED" }),
    );
    await user.click(screen.getByRole("button", { name: "Record" }));

    expect(mockCreateApplication).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        origin: "CAREEROS_JOB",
        job_id: "job-1",
        status: "APPLIED",
      }),
    );
  });

  it("moves an application via the card's select control", async () => {
    const user = userEvent.setup();
    mockUpdateApplicationStatus.mockResolvedValue(
      makeApplication({ status: "INTERVIEW" }),
    );
    renderPipeline();
    await screen.findByText("Backend Engineer");

    const card = screen.getByText("Backend Engineer").closest("div")!;
    const select = within(card.parentElement as HTMLElement).getByRole(
      "combobox",
    );
    await user.selectOptions(select, "Interview");

    expect(mockUpdateApplicationStatus).toHaveBeenCalledWith(
      "token",
      "app-1",
      "INTERVIEW",
      expect.any(String),
    );
  });

  it("reverts the card's stage on a failed move", async () => {
    const user = userEvent.setup();
    mockUpdateApplicationStatus.mockRejectedValue(new Error("nope"));
    renderPipeline();
    await screen.findByText("Backend Engineer");

    const card = screen.getByText("Backend Engineer").closest("div")!;
    const select = within(card.parentElement as HTMLElement).getByRole(
      "combobox",
    );
    await user.selectOptions(select, "Interview");

    expect(
      await screen.findByText(
        "Could not save the new stage. It has been put back to Applied.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a next-action queue and opens the application for review", async () => {
    mockListApplications.mockResolvedValue([
      makeApplication({
        status: "PREPARING",
        status_updated_at: "2020-01-01T00:00:00Z",
      }),
    ]);
    const user = userEvent.setup();
    renderPipeline();

    expect(
      await screen.findByText("Your next useful actions"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/confirm whether you submitted it/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Review/i }));
    expect(mockPush).toHaveBeenCalledWith("/pipeline?focus=app-1");
  });

  it("keeps the closed lane hidden until Show lane is clicked", async () => {
    mockListApplications.mockResolvedValue([
      makeApplication({ id: "rejected", status: "REJECTED" }),
    ]);
    const user = userEvent.setup();
    renderPipeline();

    expect(await screen.findByText(/Show lane/)).toBeInTheDocument();
    expect(
      screen.queryByText("Together AI · Backend Engineer"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByText(/Show lane/));
    expect(mockReplace).toHaveBeenCalledWith("/pipeline?closed=1");
  });

  it("renders the closed lane when closed=1 is already in the URL", async () => {
    currentSearch = "closed=1";
    mockListApplications.mockResolvedValue([
      makeApplication({ id: "rejected", status: "REJECTED" }),
    ]);
    renderPipeline();
    expect(
      await screen.findByText("Together AI · Backend Engineer"),
    ).toBeInTheDocument();
  });

  it("pushes a focus query param when a card is opened", async () => {
    const user = userEvent.setup();
    renderPipeline();
    await user.click(await screen.findByText("Backend Engineer"));
    expect(mockPush).toHaveBeenCalledWith("/pipeline?focus=app-1");
  });

  it("renders the focus panel when a focus query param is present", async () => {
    currentSearch = "focus=app-1";
    renderPipeline();
    expect(await screen.findByTestId("focus-panel")).toHaveTextContent(
      "application:app-1",
    );
  });

  it("exports the loaded applications as raw-value CSV rows", async () => {
    const user = userEvent.setup();
    renderPipeline();
    await screen.findByText("Backend Engineer");

    await user.click(screen.getByRole("button", { name: "Export CSV" }));

    expect(mockDownloadCsv).toHaveBeenCalledWith("careeros-applications.csv", [
      [
        "company",
        "role",
        "status",
        "applied_at",
        "source",
        "application_url",
        "created_at",
      ],
      [
        "Together AI",
        "Backend Engineer",
        "APPLIED",
        "2026-09-19T00:00:00Z",
        "manual",
        "",
        "2026-09-19T00:00:00Z",
      ],
    ]);
  });

  it("imports valid rows and reports skipped rows on CSV upload", async () => {
    mockCreateApplication.mockResolvedValueOnce(
      makeApplication({ id: "imported-1", company: "New Co", role: "PM" }),
    );
    const user = userEvent.setup();
    renderPipeline();
    await screen.findByText("Backend Engineer");

    const csvText =
      "company,role,status\nNew Co,PM,PREPARING\n,Missing Company,APPLIED\n";
    const file = new File([csvText], "applications.csv", { type: "text/csv" });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(input, file);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Imported 1 application(s). 1 row(s) skipped.",
    );
    expect(
      screen.getByText("row 3: missing company or role"),
    ).toBeInTheDocument();
    expect(mockCreateApplication).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        origin: "MANUAL",
        company: "New Co",
        role: "PM",
        status: "PREPARING",
      }),
    );
  });
});
