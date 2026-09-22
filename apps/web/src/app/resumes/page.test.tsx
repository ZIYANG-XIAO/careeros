import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ResumesPage from "./page";

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
}));

vi.mock("@/lib/api", () => ({
  listResumes: (...args: unknown[]) => mockListResumes(...args),
  uploadResume: (...args: unknown[]) => mockUploadResume(...args),
}));

describe("ResumesPage", () => {
  beforeEach(() => {
    mockListResumes.mockReset();
    mockUploadResume.mockReset();
    mockPush.mockReset();
    mockGetToken.mockClear();
    mockListResumes.mockResolvedValue([]);
  });

  it("shows the empty resume library after loading", async () => {
    render(<ResumesPage />);
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
    render(<ResumesPage />);
    expect(await screen.findByText("Engineering Resume")).toBeInTheDocument();
    expect(screen.getByText("Base resume")).toBeInTheDocument();
    expect(screen.getByText(/Version 1/)).toBeInTheDocument();
  });

  it("shows extraction progress and navigates to review", async () => {
    const user = userEvent.setup();
    let resolveUpload: (value: { id: string }) => void = () => undefined;
    mockUploadResume.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpload = resolve;
      }),
    );
    render(<ResumesPage />);
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
    render(<ResumesPage />);
    await screen.findByText("No resumes yet");

    const file = new File(["broken"], "resume.pdf", {
      type: "application/pdf",
    });
    await user.upload(screen.getByLabelText("Upload resume"), file);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "readable PDF or DOCX under 5 MB",
    );
  });
});
