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
});
