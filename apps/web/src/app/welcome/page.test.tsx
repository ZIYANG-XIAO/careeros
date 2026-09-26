import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n";
import { ONBOARDING_SKIP_COOKIE } from "@/lib/onboarding";

const mockListResumes = vi.fn();
const mockGetCareerBrain = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue("token");
const mockPush = vi.fn();

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: mockGetToken,
    userId: "user-test-1",
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/api", () => ({
  listResumes: (...args: unknown[]) => mockListResumes(...args),
  getCareerBrain: (...args: unknown[]) => mockGetCareerBrain(...args),
}));

const emptyBrain = {
  id: "brain-1",
  created_at: "2026-01-01T00:00:00Z",
  educations: [],
  experiences: [],
  projects: [],
  skills: [],
};

describe("WelcomePage", () => {
  beforeEach(() => {
    mockListResumes.mockReset().mockResolvedValue([]);
    mockGetCareerBrain.mockReset().mockResolvedValue(emptyBrain);
    mockGetToken.mockClear();
    mockPush.mockReset();
    document.cookie = `${ONBOARDING_SKIP_COOKIE}=; max-age=0`;
  });

  it("shows welcome onboarding content for users without resumes", async () => {
    const WelcomePage = (await import("./page")).default;

    render(
      <LocaleProvider>
        <WelcomePage />
      </LocaleProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Welcome to CareerOS" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Upload your resume" }),
    ).toHaveAttribute("href", "/resumes?upload=1");
    expect(screen.getByText("Upload resume")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("skips onboarding and sets a user-scoped skip cookie", async () => {
    const user = userEvent.setup();
    const WelcomePage = (await import("./page")).default;

    render(
      <LocaleProvider>
        <WelcomePage />
      </LocaleProvider>,
    );

    await screen.findByRole("heading", { name: "Welcome to CareerOS" });
    await user.click(screen.getByRole("button", { name: "Skip to Jobs" }));

    expect(document.cookie).toContain(`${ONBOARDING_SKIP_COOKIE}=user-test-1`);
    expect(mockPush).toHaveBeenCalledWith("/jobs");
  });

  it("does not share skip state across different users", async () => {
    document.cookie = `${ONBOARDING_SKIP_COOKIE}=user-other; path=/`;

    const WelcomePage = (await import("./page")).default;

    render(
      <LocaleProvider>
        <WelcomePage />
      </LocaleProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Welcome to CareerOS" }),
    ).toBeInTheDocument();
    expect(document.cookie).toContain("user-other");
    expect(document.cookie).not.toContain("user-test-1");
  });
});
