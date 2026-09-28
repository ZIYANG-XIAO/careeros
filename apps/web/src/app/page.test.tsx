import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n";

const mockAuth = vi.fn();
const mockRedirect = vi.fn();
const mockResolveHomeRedirect = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/home-routing", () => ({
  resolveHomeRedirect: (...args: unknown[]) => mockResolveHomeRedirect(...args),
}));

vi.mock("@clerk/nextjs", () => ({
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
  SignUpButton: ({ children }: { children: React.ReactNode }) => children,
}));

describe("Home page", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockRedirect.mockReset();
    mockResolveHomeRedirect.mockReset().mockResolvedValue("/start");
  });

  it("renders landing value props and auth actions for signed-out users", async () => {
    mockAuth.mockResolvedValue({ userId: null, getToken: vi.fn() });

    const Home = (await import("./page")).default;
    const page = await Home();

    render(<LocaleProvider>{page}</LocaleProvider>);

    expect(
      screen.getByRole("heading", {
        name: /Know your story\. Find the right work\. Apply with confidence\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Know Me")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your Career Brain learns your professional identity once",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Discover")).toBeInTheDocument();
    expect(screen.getByText("Apply Anywhere")).toBeInTheDocument();
    expect(screen.getByText("Remember")).toBeInTheDocument();
    expect(
      screen.getByText("Career context becomes action"),
    ).toBeInTheDocument();
    expect(screen.getByText("Why CareerOS surfaced this")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Get started" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects new users without profile data to start", async () => {
    mockAuth.mockResolvedValue({
      userId: "user-1",
      getToken: vi.fn().mockResolvedValue("token"),
    });
    mockResolveHomeRedirect.mockResolvedValue("/start");

    const Home = (await import("./page")).default;

    await expect(Home()).rejects.toThrow("REDIRECT:/start");
    expect(mockResolveHomeRedirect).toHaveBeenCalledWith("token", "user-1");
    expect(mockRedirect).toHaveBeenCalledWith("/start");
  });

  it("redirects returning users with profile data to home", async () => {
    mockAuth.mockResolvedValue({
      userId: "user-1",
      getToken: vi.fn().mockResolvedValue("token"),
    });
    mockResolveHomeRedirect.mockResolvedValue("/home");

    const Home = (await import("./page")).default;

    await expect(Home()).rejects.toThrow("REDIRECT:/home");
    expect(mockResolveHomeRedirect).toHaveBeenCalledWith("token", "user-1");
    expect(mockRedirect).toHaveBeenCalledWith("/home");
  });
});
