import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n";

import ApplicationsPage from "./page";

function renderApplicationsPage(locale: "en" | "zh-CN" = "en") {
  return render(
    <LocaleProvider initialLocale={locale}>
      <ApplicationsPage />
    </LocaleProvider>,
  );
}

const mockListApplications = vi.fn();
const mockListResumes = vi.fn();
const mockCreateApplication = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue("token");

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: mockGetToken }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    listApplications: (...args: unknown[]) => mockListApplications(...args),
    listResumes: (...args: unknown[]) => mockListResumes(...args),
    createApplication: (...args: unknown[]) => mockCreateApplication(...args),
  };
});

const { ApiError } = await import("@/lib/api");

const application = {
  id: "application-1",
  job_id: "job-1",
  resume_version_id: "resume-version-1",
  origin: "CAREEROS_JOB" as const,
  company: "Acme",
  role: "Platform Engineer",
  application_url: "https://example.com/apply",
  source: "manual",
  status: "APPLIED" as const,
  applied_at: "2026-09-25T01:00:00Z",
  status_updated_at: "2026-09-25T01:00:00Z",
  created_at: "2026-09-25T01:00:00Z",
  updated_at: "2026-09-25T01:00:00Z",
  answers: [],
};

const resumes = [
  {
    id: "resume-1",
    name: "Backend Resume",
    versions: [{ id: "resume-version-1", version_number: 3 }],
  },
];

describe("ApplicationsPage", () => {
  beforeEach(() => {
    mockListApplications.mockReset().mockResolvedValue([]);
    mockListResumes.mockReset().mockResolvedValue(resumes);
    mockCreateApplication.mockReset().mockResolvedValue(application);
  });

  it("does not render the empty state when the initial load fails", async () => {
    mockListApplications.mockRejectedValue(
      new ApiError("Service unavailable", 503, "unavailable"),
    );
    renderApplicationsPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "temporarily unavailable",
    );
    expect(
      screen.queryByText("No applications recorded yet"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("shows real empty and manual recovery states", async () => {
    renderApplicationsPage();
    expect(
      await screen.findByText("No applications recorded yet"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Mark an application as applied" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore jobs/i })).toHaveAttribute(
      "href",
      "/jobs",
    );
  });

  it("shows source, status, applied date, and exact resume", async () => {
    mockListApplications.mockResolvedValue([application]);
    renderApplicationsPage();

    expect(await screen.findByText("Platform Engineer")).toBeInTheDocument();
    expect(screen.getAllByText("Applied").length).toBeGreaterThan(1);
    expect(screen.getByText(/Sep/i)).toBeInTheDocument();
    expect(
      screen.getAllByText("Backend Resume · Version 3").length,
    ).toBeGreaterThan(1);
    expect(screen.getByText(/CareerOS Job · manual/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Platform Engineer/i }),
    ).toHaveAttribute("href", "/applications/application-1");
  });

  it("filters applications by status", async () => {
    const user = userEvent.setup();
    renderApplicationsPage();
    await screen.findByText("No applications recorded yet");

    await user.selectOptions(screen.getByLabelText("Status"), "INTERVIEW");
    await vi.waitFor(() =>
      expect(mockListApplications).toHaveBeenLastCalledWith(
        "token",
        "INTERVIEW",
      ),
    );
  });

  it("records a manual applied fallback with the selected resume", async () => {
    const user = userEvent.setup();
    renderApplicationsPage();
    await screen.findByText("No applications recorded yet");

    await user.type(screen.getByLabelText("Company"), "Outside Corp");
    await user.type(screen.getByLabelText("Role"), "Backend Engineer");
    await user.type(
      screen.getByLabelText(/Application URL/i),
      "https://outside.example/apply",
    );
    await user.selectOptions(
      screen.getByLabelText("Resume used"),
      "resume-version-1",
    );
    await user.click(
      screen.getByRole("button", { name: "Record application" }),
    );

    await vi.waitFor(() =>
      expect(mockCreateApplication).toHaveBeenCalledOnce(),
    );
    expect(mockCreateApplication).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        origin: "MANUAL",
        company: "Outside Corp",
        role: "Backend Engineer",
        application_url: "https://outside.example/apply",
        resume_version_id: "resume-version-1",
        status: "APPLIED",
      }),
    );
    expect(
      await screen.findByRole("link", { name: /Application recorded/i }),
    ).toHaveAttribute("href", "/applications/application-1");
  });

  it("renders zh-CN chrome and locale-aware dates", async () => {
    mockListApplications.mockResolvedValue([application]);
    renderApplicationsPage("zh-CN");

    expect(await screen.findByText("申请记录")).toBeInTheDocument();
    expect(screen.getByText("Platform Engineer")).toBeInTheDocument();
    expect(screen.getAllByText("已申请").length).toBeGreaterThan(1);
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });
});
