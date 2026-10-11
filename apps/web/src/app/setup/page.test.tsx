import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n";

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue("token"),
    isLoaded: true,
    isSignedIn: true,
    userId: "user-1",
  }),
}));

vi.mock("@/lib/api", () => ({
  getExtensionPresence: vi
    .fn()
    .mockResolvedValue({ last_seen_at: null, build_version: null }),
}));

describe("SetupPage", () => {
  it("renders key setup and diagnostic content", async () => {
    const SetupPage = (await import("./page")).default;

    render(
      <LocaleProvider>
        <SetupPage />
      </LocaleProvider>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Extension setup and diagnostics",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Build the extension")).toBeInTheDocument();
    expect(screen.getByText("npm run extension:build")).toBeInTheDocument();
    expect(screen.getByText("Load in Chrome")).toBeInTheDocument();
    expect(screen.getByText("apps/extension/build")).toBeInTheDocument();
    expect(screen.getByText("Clerk setup")).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Clerk Chrome Extension documentation",
      }),
    ).toHaveAttribute(
      "href",
      "https://clerk.com/docs/reference/chrome-extension/overview",
    );
    expect(screen.getByText("Verify connection")).toBeInTheDocument();
    expect(screen.getByText(/Connected to CareerOS/i)).toBeInTheDocument();
    expect(screen.getByText("Local fixture")).toBeInTheDocument();
    expect(
      screen.getByText(/http:\/\/localhost:4173\/application-page.html/),
    ).toBeInTheDocument();
    expect(screen.getByText("Common issues")).toBeInTheDocument();
    expect(
      screen.getByText("Extension shows old behavior"),
    ).toBeInTheDocument();
    expect(screen.getByText("Authentication fails")).toBeInTheDocument();
    expect(screen.getByText("Form fields not detected")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This is a development setup. Production distribution will use the Chrome Web Store.",
      ),
    ).toBeInTheDocument();
  });
});
