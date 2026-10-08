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
const mockListStatusHistory = vi.fn();
const mockListUpcoming = vi.fn();
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
    listApplicationStatusHistory: (...args: unknown[]) =>
      mockListStatusHistory(...args),
    listUpcomingApplicationActivities: (...args: unknown[]) =>
      mockListUpcoming(...args),
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
  mockListStatusHistory.mockReset().mockResolvedValue([]);
  mockListUpcoming.mockReset().mockResolvedValue([]);
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
      screen.queryByRole("heading", { name: "Closed applications" }),
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
      await screen.findByRole("heading", { name: "Closed applications" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Closed/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: /Board/ })).not.toHaveAttribute(
      "aria-current",
    );
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

  it("shows each stage's own empty-column guidance", async () => {
    renderPipeline();
    await screen.findByText("Backend Engineer");
    expect(
      screen.getByText("Move a card here when an offer arrives."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Move a card here when an interview is scheduled."),
    ).toBeInTheDocument();
  });

  it("filters board cards by search text and reports the match count", async () => {
    const user = userEvent.setup();
    renderPipeline();
    await screen.findByText("Backend Engineer");

    await user.type(
      screen.getByPlaceholderText("Search company or role"),
      "figma",
    );

    expect(screen.getByText("Full Stack Engineer")).toBeInTheDocument();
    expect(screen.queryByText("Backend Engineer")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
  });

  it("filters to stalled applications only", async () => {
    const user = userEvent.setup();
    mockListApplications.mockResolvedValue([
      makeApplication({
        id: "stalled",
        role: "Stalled Role",
        status_updated_at: "2020-01-01T00:00:00Z",
      }),
      makeApplication({
        id: "fresh",
        role: "Fresh Role",
        status_updated_at: new Date().toISOString(),
      }),
    ]);
    renderPipeline();
    await screen.findByText("Fresh Role");

    await user.click(screen.getByRole("button", { name: "Stalled only" }));

    expect(screen.getByText("Stalled Role")).toBeInTheDocument();
    expect(screen.queryByText("Fresh Role")).not.toBeInTheDocument();
    expect(screen.queryByText("Full Stack Engineer")).not.toBeInTheDocument();
  });

  it("renders dated progress steps, resume, and upcoming interview in the list view", async () => {
    currentSearch = "view=list";
    mockListApplications.mockResolvedValue([
      makeApplication({
        status: "INTERVIEW",
        resume_version_id: "version-1",
        status_updated_at: "2026-09-25T12:00:00Z",
      }),
    ]);
    mockListStatusHistory.mockResolvedValue([
      {
        application_id: "app-1",
        from_status: null,
        to_status: "APPLIED",
        changed_at: "2026-09-19T12:00:00Z",
      },
      {
        application_id: "app-1",
        from_status: "APPLIED",
        to_status: "INTERVIEW",
        changed_at: "2026-09-25T12:00:00Z",
      },
    ]);
    mockListUpcoming.mockResolvedValue([
      {
        id: "activity-1",
        application_id: "app-1",
        activity_type: "INTERVIEW",
        title: "Onsite",
        body: null,
        scheduled_at: "2026-10-03T12:00:00Z",
        completed_at: null,
        created_at: "2026-09-25T12:00:00Z",
        updated_at: "2026-09-25T12:00:00Z",
      },
    ]);
    renderPipeline();

    const progress = await screen.findByRole("list", {
      name: "Progress for Together AI · Backend Engineer",
    });
    const steps = within(progress).getAllByRole("listitem");
    expect(steps).toHaveLength(6);
    expect(steps[1]).toHaveTextContent("Applied9/19");
    // Assessment was skipped: reached, but no invented date.
    expect(steps[2]).toHaveTextContent("Assessment—");
    expect(steps[3]).toHaveAttribute("aria-current", "step");
    expect(steps[3]).toHaveTextContent("Interview9/25");
    expect(steps[4]).toHaveTextContent(/^Final$/);
    expect(screen.getByText("Resume: Backend Resume v2")).toBeInTheDocument();
    expect(screen.getByText("Interview 10/3")).toBeInTheDocument();
  });

  it("starts an application from a saved row in the list view", async () => {
    currentSearch = "view=list";
    const user = userEvent.setup();
    renderPipeline();
    await user.click(
      await screen.findByRole("button", { name: "Start application" }),
    );
    expect(
      await screen.findByText("Record this application?"),
    ).toBeInTheDocument();
  });

  it("bulk-moves selected applications in the list view", async () => {
    currentSearch = "view=list";
    const user = userEvent.setup();
    mockListApplications.mockResolvedValue([
      makeApplication({ id: "a", role: "Role A" }),
      makeApplication({ id: "b", role: "Role B" }),
    ]);
    mockUpdateApplicationStatus.mockImplementation(
      (_token: string, id: string, status: string) =>
        Promise.resolve(makeApplication({ id, status: status as never })),
    );
    renderPipeline();

    await user.click(
      await screen.findByRole("checkbox", {
        name: "Select Together AI · Role A",
      }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Select Together AI · Role B" }),
    );
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Move selected to…" }),
      "Withdrawn",
    );

    expect(mockUpdateApplicationStatus).toHaveBeenCalledWith(
      "token",
      "a",
      "WITHDRAWN",
      expect.any(String),
    );
    expect(mockUpdateApplicationStatus).toHaveBeenCalledWith(
      "token",
      "b",
      "WITHDRAWN",
      expect.any(String),
    );
  });

  it("confirms a submission straight from the action queue", async () => {
    const user = userEvent.setup();
    mockListApplications.mockResolvedValue([
      makeApplication({
        status: "PREPARING",
        status_updated_at: "2020-01-01T00:00:00Z",
      }),
    ]);
    mockUpdateApplicationStatus.mockResolvedValue(
      makeApplication({ status: "APPLIED" }),
    );
    renderPipeline();

    await user.click(
      await screen.findByRole("button", { name: "I submitted it" }),
    );
    expect(mockUpdateApplicationStatus).toHaveBeenCalledWith(
      "token",
      "app-1",
      "APPLIED",
      expect.any(String),
    );
  });

  it("still renders the board when status history cannot be loaded", async () => {
    mockListStatusHistory.mockRejectedValue(new Error("offline"));
    renderPipeline();
    expect(await screen.findByText("Backend Engineer")).toBeInTheDocument();
  });

  it("restores filters from the URL and mirrors changes back into it", async () => {
    currentSearch = "q=figma";
    const user = userEvent.setup();
    renderPipeline();
    expect(await screen.findByText("Full Stack Engineer")).toBeInTheDocument();
    expect(screen.queryByText("Backend Engineer")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search company or role")).toHaveValue(
      "figma",
    );

    await user.click(screen.getByRole("button", { name: "Stalled only" }));
    expect(mockReplace).toHaveBeenLastCalledWith("/pipeline?q=figma&stalled=1");
  });
});
