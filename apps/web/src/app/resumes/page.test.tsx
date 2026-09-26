import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n";

import ResumesPage from "./page";

function renderResumesPage(locale: "en" | "zh-CN" = "en") {
  return render(
    <LocaleProvider initialLocale={locale}>
      <ResumesPage />
    </LocaleProvider>,
  );
}

const mockListResumes = vi.fn();
const mockUploadResume = vi.fn();
const mockPush = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue("token");

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: mockGetToken,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    listResumes: (...args: unknown[]) => mockListResumes(...args),
    uploadResume: (...args: unknown[]) => mockUploadResume(...args),
  };
});

const { ApiError } = await import("@/lib/api");

describe("ResumesPage", () => {
  beforeEach(() => {
    mockListResumes.mockReset();
    mockUploadResume.mockReset();
    mockPush.mockReset();
    mockGetToken.mockClear();
    mockListResumes.mockResolvedValue([]);
  });

  it("does not render the empty state when the initial load fails", async () => {
    mockListResumes.mockRejectedValue(
      new ApiError("Service unavailable", 503, "unavailable"),
    );
    renderResumesPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "temporarily unavailable",
    );
    expect(screen.queryByText("No resumes yet")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("shows the empty resume library after loading", async () => {
    renderResumesPage();
    expect(await screen.findByText("No resumes yet")).toBeInTheDocument();
    expect(mockListResumes).toHaveBeenCalledWith("token");
  });

  it("shows existing resumes and stable version information", async () => {
    mockListResumes.mockResolvedValue([
      {
        id: "resume-1",
        name: "Engineering Resume",
        is_primary: true,
        created_at: "2026-09-20T00:00:00Z",
        updated_at: "2026-09-20T00:00:00Z",
        versions: [
          {
            id: "version-1",
            version_number: 1,
            created_at: "2026-09-20T00:00:00Z",
          },
        ],
      },
    ]);
    renderResumesPage();
    expect(await screen.findByText("Engineering Resume")).toBeInTheDocument();
    expect(screen.getByText("Base resume")).toBeInTheDocument();
    expect(screen.getByText(/Version 1/)).toBeInTheDocument();
    expect(screen.getByText(/Sep/i)).toBeInTheDocument();
  });

  it("renders zh-CN resume library chrome and locale-aware dates", async () => {
    mockListResumes.mockResolvedValue([
      {
        id: "resume-1",
        name: "Engineering Resume",
        is_primary: true,
        created_at: "2026-09-20T00:00:00Z",
        updated_at: "2026-09-20T00:00:00Z",
        versions: [
          {
            id: "version-1",
            version_number: 1,
            created_at: "2026-09-20T00:00:00Z",
          },
        ],
      },
    ]);
    renderResumesPage("zh-CN");
    expect(await screen.findByText("你的简历")).toBeInTheDocument();
    expect(screen.getByText("Engineering Resume")).toBeInTheDocument();
    expect(screen.getByText("基础简历")).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it("shows extraction progress and navigates to review", async () => {
    const user = userEvent.setup();
    let resolveUpload: (value: { id: string }) => void = () => undefined;
    mockUploadResume.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpload = resolve;
      }),
    );
    renderResumesPage();
    await screen.findByText("No resumes yet");

    const file = new File(["resume"], "resume.pdf", {
      type: "application/pdf",
    });
    await user.upload(screen.getByLabelText("Upload resume"), file);
    expect(screen.getByRole("status")).toHaveTextContent(
      "uploading, extracting",
    );
    resolveUpload({ id: "import-1" });
    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/resumes/imports/import-1");
    });
  });

  it("shows a useful failure when extraction or parsing fails", async () => {
    const user = userEvent.setup();
    mockUploadResume.mockRejectedValue(new Error("bad document"));
    renderResumesPage();
    await screen.findByText("No resumes yet");

    const file = new File(["broken"], "resume.pdf", {
      type: "application/pdf",
    });
    await user.upload(screen.getByLabelText("Upload resume"), file);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check the file and try again",
    );
  });

  it("explains when the server parser is not configured", async () => {
    const user = userEvent.setup();
    mockUploadResume.mockRejectedValue(
      new ApiError(
        "Resume parsing is not configured",
        503,
        "unavailable",
        undefined,
        "PARSER_UNAVAILABLE",
      ),
    );
    renderResumesPage();
    await screen.findByText("No resumes yet");

    await user.upload(
      screen.getByLabelText("Upload resume"),
      new File(["resume"], "resume.pdf", { type: "application/pdf" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "not configured on this server",
    );
  });

  it("rejects files larger than 10 MB before uploading", async () => {
    const user = userEvent.setup();
    renderResumesPage();
    await screen.findByText("No resumes yet");

    await user.upload(
      screen.getByLabelText("Upload resume"),
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf", {
        type: "application/pdf",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "larger than 10 MB",
    );
    expect(mockUploadResume).not.toHaveBeenCalled();
  });
});
