import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n";
import type { Job } from "@/lib/types";

import DiscoverView from "./discover-view";

const mockListJobs = vi.fn();
const mockListApplications = vi.fn();
const mockCreateJob = vi.fn();
const mockSaveJob = vi.fn();
const mockUnsaveJob = vi.fn();
const mockDismissJob = vi.fn();
const mockUndismissJob = vi.fn();
const mockHideCompany = vi.fn();
const mockListHiddenCompanies = vi.fn();
const mockUnhideCompany = vi.fn();
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
  usePathname: () => "/discover",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    listJobs: (...args: unknown[]) => mockListJobs(...args),
    listApplications: (...args: unknown[]) => mockListApplications(...args),
    createJob: (...args: unknown[]) => mockCreateJob(...args),
    saveJob: (...args: unknown[]) => mockSaveJob(...args),
    unsaveJob: (...args: unknown[]) => mockUnsaveJob(...args),
    dismissJob: (...args: unknown[]) => mockDismissJob(...args),
    undismissJob: (...args: unknown[]) => mockUndismissJob(...args),
    hideCompany: (...args: unknown[]) => mockHideCompany(...args),
    listHiddenCompanies: (...args: unknown[]) =>
      mockListHiddenCompanies(...args),
    unhideCompany: (...args: unknown[]) => mockUnhideCompany(...args),
    listJobSearchGoals: () => Promise.resolve([]),
  };
});

vi.mock("@/components/focus-panel", () => ({
  FocusPanel: ({ target }: { target: { kind: string; id: string } }) => (
    <div data-testid="focus-panel">
      {target.kind}:{target.id}
    </div>
  ),
}));

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    company: "Acme",
    title: "Platform Engineer",
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
    is_saved: false,
    saved_at: null,
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
    ...overrides,
  };
}

function renderDiscover() {
  return render(
    <LocaleProvider>
      <DiscoverView />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  currentSearch = "";
  mockListJobs.mockReset().mockResolvedValue([makeJob()]);
  mockListApplications.mockReset().mockResolvedValue([]);
  mockCreateJob.mockReset();
  mockPush.mockReset();
  mockReplace.mockReset();
  mockDismissJob.mockReset().mockResolvedValue(undefined);
  mockUndismissJob.mockReset().mockResolvedValue(undefined);
  mockHideCompany.mockReset();
  mockListHiddenCompanies.mockReset().mockResolvedValue([]);
  mockUnhideCompany.mockReset().mockResolvedValue(undefined);
  window.localStorage.clear();
});

describe("DiscoverView", () => {
  it("keeps supported search and filters in the compact toolbar", async () => {
    const user = userEvent.setup();
    renderDiscover();

    const toolbar = await screen.findByRole("region", { name: "Search jobs" });
    expect(
      within(toolbar).getByPlaceholderText("Job title or company"),
    ).toBeInTheDocument();
    await user.selectOptions(
      within(toolbar).getByRole("combobox", { name: "Market" }),
      "NORTH_AMERICA",
    );

    await waitFor(() =>
      expect(mockListJobs).toHaveBeenLastCalledWith(
        "token",
        expect.objectContaining({ market: "NORTH_AMERICA" }),
      ),
    );
  });

  it("shows a private local company mark on every job row", async () => {
    mockListJobs.mockResolvedValue([
      makeJob({ id: "job-1", company: "Stripe" }),
      makeJob({ id: "job-2", company: "Beacon" }),
    ]);

    const { container } = renderDiscover();

    await waitFor(() => expect(mockListJobs).toHaveBeenCalled());
    expect(
      container.querySelector('[data-company-icon="stripe"] > span'),
    ).toHaveStyle({
      backgroundImage: "url(/company-logos/stripe.png)",
    });
    expect(
      container.querySelector('[data-company-mark="Beacon"]'),
    ).toHaveTextContent("B");
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("pages through the catalog with Load more", async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) =>
      makeJob({ id: `job-${index}`, title: `Role ${index}` }),
    );
    mockListJobs
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([makeJob({ id: "job-50", title: "Role 50" })]);
    renderDiscover();
    expect(await screen.findByText("Role 0")).toBeInTheDocument();
    expect(mockListJobs.mock.calls[0][1]).toMatchObject({
      limit: 50,
      offset: 0,
    });

    fireEvent.click(screen.getByRole("button", { name: "Load more jobs" }));
    expect(await screen.findByText("Role 50")).toBeInTheDocument();
    expect(mockListJobs.mock.calls[1][1]).toMatchObject({
      limit: 50,
      offset: 50,
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Load more jobs" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("renders job rows", async () => {
    renderDiscover();
    expect(await screen.findByText("Platform Engineer")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("shows how many other locations a collapsed row stands for", async () => {
    mockListJobs.mockResolvedValueOnce([
      makeJob({
        similar_count: 2,
        other_locations: ["Austin, TX", "Boston, MA"],
      }),
    ]);
    renderDiscover();
    expect(await screen.findByText("Platform Engineer")).toBeInTheDocument();
    expect(
      screen.getByText((text) => text.includes("+2 more locations")),
    ).toBeInTheDocument();
  });

  it("shows the in-pipeline badge for a job with a linked application", async () => {
    mockListApplications.mockResolvedValue([
      { job_id: "job-1", status: "INTERVIEW" },
    ]);
    renderDiscover();
    expect(
      await screen.findByText("In pipeline · Interview"),
    ).toBeInTheDocument();
  });

  it("pushes a focus query param when a row is selected", async () => {
    const user = userEvent.setup();
    renderDiscover();
    await user.click(await screen.findByText("Platform Engineer"));
    expect(mockPush).toHaveBeenCalledWith("/discover?focus=job-1");
  });

  it("renders the focus panel and a placeholder based on the focus param", async () => {
    currentSearch = "focus=job-1";
    renderDiscover();
    expect(await screen.findByTestId("focus-panel")).toHaveTextContent(
      "job:job-1",
    );
  });

  it("renders no focus panel without a focus param", async () => {
    renderDiscover();
    await screen.findByText("Platform Engineer");
    expect(screen.queryByTestId("focus-panel")).not.toBeInTheDocument();
  });

  it("opens the focus panel for a newly created job", async () => {
    const user = userEvent.setup();
    mockCreateJob.mockResolvedValue(
      makeJob({ id: "job-2", title: "New Role" }),
    );
    renderDiscover();
    await screen.findByText("Platform Engineer");

    await user.click(screen.getByText("Add a job manually"));
    await user.type(screen.getByLabelText("Company"), "Beta Corp");
    await user.type(screen.getByLabelText("Job title"), "New Role");
    await user.type(
      screen.getByLabelText("Job description"),
      "A description that is definitely long enough.",
    );
    await user.click(screen.getByRole("button", { name: "Add job" }));

    expect(mockPush).toHaveBeenCalledWith("/discover?focus=job-2");
  });

  it("hides a job as not interested and restores it on undo", async () => {
    const user = userEvent.setup();
    mockListJobs.mockResolvedValue([
      makeJob(),
      makeJob({ id: "job-2", title: "Data Engineer" }),
    ]);
    renderDiscover();
    await screen.findByText("Platform Engineer");

    await user.click(
      screen.getByRole("button", {
        name: "More actions for Platform Engineer at Acme",
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Not interested" }));

    expect(mockDismissJob).toHaveBeenCalledWith("token", "job-1");
    expect(screen.queryByText("Platform Engineer")).not.toBeInTheDocument();
    expect(
      screen.getByText("Job hidden from your browse list."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(mockUndismissJob).toHaveBeenCalledWith("token", "job-1");
    expect(await screen.findByText("Platform Engineer")).toBeInTheDocument();
  });

  it("hides every job from a company and lists it for unhiding", async () => {
    const user = userEvent.setup();
    mockListJobs.mockResolvedValue([
      makeJob(),
      makeJob({ id: "job-2", title: "Data Engineer" }),
      makeJob({ id: "job-3", company: "Globex", title: "Globex Role" }),
    ]);
    mockHideCompany.mockResolvedValue({
      id: "hidden-1",
      company_name: "Acme",
      created_at: "2026-10-01T00:00:00Z",
    });
    renderDiscover();
    await screen.findByText("Platform Engineer");

    await user.click(
      screen.getByRole("button", {
        name: "More actions for Data Engineer at Acme",
      }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Hide this company" }),
    );

    expect(mockHideCompany).toHaveBeenCalledWith("token", "Acme");
    expect(screen.queryByText("Platform Engineer")).not.toBeInTheDocument();
    expect(screen.queryByText("Data Engineer")).not.toBeInTheDocument();
    expect(screen.getByText("Globex Role")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Hidden companies: 1/ }),
    );
    await user.click(
      screen.getByRole("button", { name: "Show jobs from Acme again" }),
    );
    expect(mockUnhideCompany).toHaveBeenCalledWith("token", "hidden-1");
  });

  it("offers no browse feedback on saved jobs", async () => {
    mockListJobs.mockResolvedValue([makeJob({ is_saved: true })]);
    renderDiscover();
    await screen.findByText("Platform Engineer");
    expect(
      screen.queryByRole("button", { name: /More actions for/ }),
    ).not.toBeInTheDocument();
  });

  it("marks jobs first seen after the previous visit as new", async () => {
    window.localStorage.setItem(
      "careeros.discover.lastSeenAt",
      "2026-09-20T00:00:00Z",
    );
    mockListJobs.mockResolvedValue([
      makeJob({ first_observed_at: "2026-09-25T00:00:00Z" }),
      makeJob({
        id: "job-2",
        title: "Old Role",
        first_observed_at: "2026-09-10T00:00:00Z",
      }),
    ]);
    renderDiscover();
    expect(
      await screen.findByText("1 new since last visit"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("New")).toHaveLength(1);
  });

  it("shows the applied status reported by the listing", async () => {
    mockListJobs.mockResolvedValue([
      makeJob({ application_status: "INTERVIEW" }),
    ]);
    renderDiscover();
    expect(
      await screen.findByText("In pipeline · Interview"),
    ).toBeInTheDocument();
  });

  it("shows quoted sponsorship statements and can hide explicit refusals", async () => {
    const user = userEvent.setup();
    mockListJobs.mockResolvedValue([
      makeJob({
        sponsorship: {
          status: "NOT_OFFERED",
          quote: "We are unable to sponsor work visas.",
        },
      }),
      makeJob({
        id: "job-2",
        title: "Sponsored Role",
        sponsorship: {
          status: "OFFERED",
          quote: "Visa sponsorship is available.",
        },
      }),
    ]);
    renderDiscover();
    // Refusals are a quiet line, not a red badge on every row.
    expect(
      await screen.findByText("No visa sponsorship (per posting)"),
    ).toHaveAttribute("title", "We are unable to sponsor work visas.");
    expect(
      screen.getByText("Posting offers visa sponsorship"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", {
        name: "Hide jobs that say no sponsorship",
      }),
    );
    expect(screen.queryByText("Platform Engineer")).not.toBeInTheDocument();
    expect(screen.getByText("Sponsored Role")).toBeInTheDocument();
  });

  it("toggles a job's saved state from the heart on its row", async () => {
    const user = userEvent.setup();
    mockSaveJob.mockResolvedValue(
      makeJob({ is_saved: true, saved_at: "2026-10-01T00:00:00Z" }),
    );
    mockUnsaveJob.mockResolvedValue(undefined);
    renderDiscover();

    const save = await screen.findByRole("button", {
      name: "Save Platform Engineer",
    });
    expect(save).toHaveAttribute("aria-pressed", "false");
    await user.click(save);
    expect(mockSaveJob).toHaveBeenCalledWith("token", "job-1");
    // Saving does not open the job.
    expect(mockPush).not.toHaveBeenCalled();

    const unsave = await screen.findByRole("button", {
      name: "Unsave Platform Engineer",
    });
    expect(unsave).toHaveAttribute("aria-pressed", "true");
    await user.click(unsave);
    expect(mockUnsaveJob).toHaveBeenCalledWith("token", "job-1");
    expect(
      await screen.findByRole("button", { name: "Save Platform Engineer" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("ranks by best match by default and links to the rest of a company", async () => {
    const user = userEvent.setup();
    mockListJobs.mockResolvedValue([
      makeJob({ company_rank: 1, company_job_count: 5 }),
      makeJob({
        id: "job-2",
        title: "Data Engineer",
        company_rank: 2,
        company_job_count: 5,
      }),
    ]);
    renderDiscover();
    await screen.findByText("Platform Engineer");
    expect(mockListJobs).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ diversify: true, sort: "match" }),
    );

    await user.click(screen.getByRole("button", { name: /3 more at Acme/ }));
    expect(mockListJobs).toHaveBeenLastCalledWith(
      "token",
      expect.objectContaining({ company: "Acme", diversify: false }),
    );
    expect(
      await screen.findByText("Showing all jobs at Acme"),
    ).toBeInTheDocument();
  });

  it("shows when a job was posted and does not repeat Remote", async () => {
    mockListJobs.mockResolvedValue([
      makeJob({
        location: "Remote",
        workplace_type: "REMOTE",
        employment_type: "FULL_TIME",
        posted_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      }),
    ]);
    renderDiscover();
    expect(
      await screen.findByText("Remote · Full-time · Posted 3d ago"),
    ).toBeInTheDocument();
  });

  it("explains that best match needs a search goal", async () => {
    renderDiscover();
    await screen.findByText("Platform Engineer");
    expect(
      screen.getByText(/Set a search goal to rank jobs by how well they match/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Set goal/ })).toHaveAttribute(
      "href",
      "/me/goals",
    );
  });

  it("warns when a catalog job has not been seen by recent syncs", async () => {
    mockListJobs.mockResolvedValue([
      makeJob({
        is_catalog: true,
        last_observed_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      }),
      makeJob({
        id: "job-2",
        title: "Fresh Role",
        is_catalog: true,
        last_observed_at: new Date().toISOString(),
      }),
    ]);
    renderDiscover();
    expect(
      await screen.findByText("May have closed — not seen for 5d"),
    ).toBeInTheDocument();
    // Fresh postings stay quiet in the list.
    expect(screen.queryByText(/Confirmed open/)).not.toBeInTheDocument();
  });
});
