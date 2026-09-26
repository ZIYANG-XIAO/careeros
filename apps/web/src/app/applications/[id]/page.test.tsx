import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n";

import ApplicationDetailPage from "./page";

function renderApplicationDetail(locale: "en" | "zh-CN" = "en") {
  return render(
    <LocaleProvider initialLocale={locale}>
      <ApplicationDetailPage />
    </LocaleProvider>,
  );
}

const mockGetApplication = vi.fn();
const mockListResumes = vi.fn();
const mockUpdateStatus = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue("token");

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: mockGetToken }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "application-1" }),
}));

vi.mock("@/lib/api", () => ({
  getApplication: (...args: unknown[]) => mockGetApplication(...args),
  listResumes: (...args: unknown[]) => mockListResumes(...args),
  updateApplicationStatus: (...args: unknown[]) => mockUpdateStatus(...args),
}));

const application = {
  id: "application-1",
  job_id: null,
  resume_version_id: "version-1",
  origin: "EXTERNAL_PAGE" as const,
  company: "External Corp",
  role: "Platform Engineer",
  application_url: "https://external.example/apply",
  source: "external.example",
  status: "APPLIED" as const,
  applied_at: "2026-09-25T01:00:00Z",
  status_updated_at: "2026-09-25T01:00:00Z",
  created_at: "2026-09-25T01:00:00Z",
  updated_at: "2026-09-25T01:00:00Z",
  answers: [
    {
      id: "answer-1",
      canonical_key: "CONTACT_EMAIL",
      question_text: "Email",
      answer_text: "candidate@example.com",
      source_category: "IDENTITY",
      policy_category: "STANDARD" as const,
      sensitivity: "NONE" as const,
      position: 0,
      confirmed_at: "2026-09-25T01:00:00Z",
      created_at: "2026-09-25T01:00:00Z",
    },
  ],
};

describe("ApplicationDetailPage", () => {
  beforeEach(() => {
    mockGetApplication.mockReset().mockResolvedValue(application);
    mockListResumes.mockReset().mockResolvedValue([
      {
        id: "resume-1",
        name: "Base Resume",
        versions: [{ id: "version-1", version_number: 2 }],
      },
    ]);
    mockUpdateStatus
      .mockReset()
      .mockResolvedValue({ ...application, status: "INTERVIEW" });
  });

  it("shows durable context, exact resume, and confirmed answers", async () => {
    renderApplicationDetail();

    expect(await screen.findByText("Platform Engineer")).toBeInTheDocument();
    expect(screen.getByText("Base Resume · Version 2")).toBeInTheDocument();
    expect(
      screen.getByText("Captured from an external application page"),
    ).toBeInTheDocument();
    expect(screen.getByText("candidate@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Open application page/i }),
    ).toHaveAttribute("href", "https://external.example/apply");
  });

  it("updates status and keeps retry-safe API input", async () => {
    const user = userEvent.setup();
    renderApplicationDetail();
    await screen.findByText("Platform Engineer");

    await user.selectOptions(
      screen.getByLabelText("Current status"),
      "INTERVIEW",
    );
    await user.click(screen.getByRole("button", { name: "Save status" }));

    await vi.waitFor(() => expect(mockUpdateStatus).toHaveBeenCalledOnce());
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "token",
      "application-1",
      "INTERVIEW",
      expect.any(String),
    );
    await vi.waitFor(() =>
      expect(screen.getAllByText("Interview").length).toBeGreaterThan(1),
    );
  });

  it("shows ownership-safe loading errors", async () => {
    mockGetApplication.mockRejectedValue(new Error("404"));
    renderApplicationDetail();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "do not have access",
    );
  });

  it("renders zh-CN detail chrome", async () => {
    renderApplicationDetail("zh-CN");
    expect(await screen.findByText("Platform Engineer")).toBeInTheDocument();
    expect(screen.getByText("来自外部申请页")).toBeInTheDocument();
    expect(screen.getByText("更新状态")).toBeInTheDocument();
  });
});
