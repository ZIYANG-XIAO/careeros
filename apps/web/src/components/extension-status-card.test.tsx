import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n";

const mockGetExtensionPresence = vi.fn();
const mockAuth = {
  getToken: vi.fn().mockResolvedValue("token"),
  isLoaded: true,
  isSignedIn: true,
  userId: "user-1",
};

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getExtensionPresence: (...args: unknown[]) =>
    mockGetExtensionPresence(...args),
}));

async function renderCard() {
  const { ExtensionStatusCard } = await import("./extension-status-card");
  return render(
    <LocaleProvider>
      <ExtensionStatusCard />
    </LocaleProvider>,
  );
}

describe("ExtensionStatusCard", () => {
  beforeEach(() => {
    mockGetExtensionPresence.mockReset();
    mockAuth.isSignedIn = true;
  });

  it("explains how to connect when the extension never reported", async () => {
    mockGetExtensionPresence.mockResolvedValue({
      last_seen_at: null,
      build_version: null,
    });

    await renderCard();

    expect(
      await screen.findByText("Extension not detected yet"),
    ).toBeInTheDocument();
    expect(screen.getByText(/open its popup once/)).toBeInTheDocument();
    expect(mockGetExtensionPresence).toHaveBeenCalledWith("token");
  });

  it("shows the last report and build once connected, and rechecks", async () => {
    mockGetExtensionPresence.mockResolvedValue({
      last_seen_at: "2026-10-08T15:01:00Z",
      build_version: "abc1234",
    });

    await renderCard();

    expect(await screen.findByText("Extension connected")).toBeInTheDocument();
    expect(screen.getByText(/build abc1234/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(mockGetExtensionPresence).toHaveBeenCalledTimes(2);
  });

  it("offers a retry when the status cannot be loaded", async () => {
    mockGetExtensionPresence.mockRejectedValue(new Error("offline"));

    await renderCard();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("renders nothing when signed out", async () => {
    mockAuth.isSignedIn = false;

    const { container } = await renderCard();

    expect(container).toBeEmptyDOMElement();
    expect(mockGetExtensionPresence).not.toHaveBeenCalled();
  });
});
