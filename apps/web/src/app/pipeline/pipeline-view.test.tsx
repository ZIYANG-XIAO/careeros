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
  latest_snapshot: {
    id: "snap-1",
    version_number: 1,
    raw_description: "",
    normalized_description: "",
    content_sha256: "x",
    parser_version: "v1",
    parser_model: "test",
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
  window.localStorage.clear();
});

describe("PipelineView", () => {
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

  it("shows the needs-you strip and dismisses it for today", async () => {
    mockListApplications.mockResolvedValue([
      makeApplication({
        status: "PREPARING",
        status_updated_at: "2020-01-01T00:00:00Z",
      }),
    ]);
    const user = userEvent.setup();
    renderPipeline();

    expect(
      await screen.findByText(
        "1 application sat in Preparing over 3 days — did you send it?",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss for today" }));
    expect(
      screen.queryByText(
        "1 application sat in Preparing over 3 days — did you send it?",
      ),
    ).not.toBeInTheDocument();
  });

  it("keeps the closed lane hidden until Show lane is clicked", async () => {
    mockListApplications.mockResolvedValue([
      makeApplication({ id: "rejected", status: "REJECTED" }),
    ]);
    const user = userEvent.setup();
    renderPipeline();

    expect(await screen.findByText(/Show lane/)).toBeInTheDocument();
    expect(screen.queryByText("Closed")).not.toBeInTheDocument();

    await user.click(screen.getByText(/Show lane/));
    expect(mockReplace).toHaveBeenCalledWith("/pipeline?closed=1");
  });

  it("renders the closed lane when closed=1 is already in the URL", async () => {
    currentSearch = "closed=1";
    mockListApplications.mockResolvedValue([
      makeApplication({ id: "rejected", status: "REJECTED" }),
    ]);
    renderPipeline();
    expect(await screen.findByText("Closed")).toBeInTheDocument();
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
});
