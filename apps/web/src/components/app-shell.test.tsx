import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "./app-shell";
import { LocaleProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";

const mockGetToken = vi.fn().mockResolvedValue("token");
const mockPush = vi.fn();
const mockListApplications = vi.fn().mockResolvedValue([]);
const mockListJobs = vi.fn().mockResolvedValue([]);
const mockCreateApplication = vi.fn();

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <div>Account menu</div>,
  useAuth: () => ({ getToken: mockGetToken }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/pipeline",
  useRouter: () => ({ push: mockPush }),
}));
vi.mock("@/lib/api", () => ({
  listApplications: (...args: unknown[]) => mockListApplications(...args),
  listJobs: (...args: unknown[]) => mockListJobs(...args),
  createApplication: (...args: unknown[]) => mockCreateApplication(...args),
}));

beforeEach(() => {
  mockGetToken.mockClear();
  mockPush.mockReset();
  mockListApplications.mockReset().mockResolvedValue([]);
  mockListJobs.mockReset().mockResolvedValue([]);
  mockCreateApplication.mockReset();
});

describe("AppShell", () => {
  it("uses the approved user-facing information architecture", () => {
    render(<AppShell>Workspace content</AppShell>);
    const navigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });
    const links = Array.from(navigation.querySelectorAll("a"));
    expect(links.map((link) => link.textContent)).toEqual([
      "Pipeline",
      "Discover",
      "Me",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/pipeline",
      "/discover",
      "/me",
    ]);
    expect(screen.getByRole("link", { name: "Pipeline" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Application Assistant setup" }),
    ).toHaveAttribute("href", "/setup");
    expect(screen.getByText("Workspace content")).toBeInTheDocument();
  });

  it("switches the product shell between English and Simplified Chinese", async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider>
        <AppShell>Workspace content</AppShell>
      </LocaleProvider>,
    );
    await user.click(screen.getByRole("button", { name: "中文" }));
    expect(screen.getByRole("link", { name: "申请流程" })).toBeInTheDocument();
    expect(screen.getByText("求职工作台")).toBeInTheDocument();
    expect(window.localStorage.getItem("careeros.locale")).toBe("zh-CN");
    expect(document.documentElement.lang).toBe("zh-CN");
  });

  it("switches between light, auto, and dark theme and persists the choice", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <AppShell>Workspace content</AppShell>
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: "Auto" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem("careeros.theme")).toBe("dark");

    await user.click(screen.getByRole("button", { name: "Auto" }));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(window.localStorage.getItem("careeros.theme")).toBe("system");
  });

  it("captures a manually-tracked application via the Capture dialog", async () => {
    mockCreateApplication.mockResolvedValue({ id: "app-1" });
    const user = userEvent.setup();
    render(<AppShell>Workspace content</AppShell>);

    await user.click(screen.getByRole("button", { name: "Capture" }));
    await user.type(screen.getByLabelText("Company"), "Acme");
    await user.type(screen.getByLabelText("Role"), "Engineer");
    await user.click(screen.getByRole("button", { name: "Add to pipeline" }));

    expect(mockCreateApplication).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        origin: "MANUAL",
        company: "Acme",
        role: "Engineer",
        status: "PREPARING",
      }),
    );
    expect(
      screen.queryByRole("dialog", { name: "Capture" }),
    ).not.toBeInTheDocument();
  });

  it("opens the command palette with ⌘K and navigates to a nav destination", async () => {
    const user = userEvent.setup();
    render(<AppShell>Workspace content</AppShell>);

    await user.keyboard("{Meta>}k{/Meta}");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await user.type(
      screen.getByRole("textbox", { name: "Jump to anything" }),
      "Discover",
    );
    await user.keyboard("{Enter}");

    expect(mockPush).toHaveBeenCalledWith("/discover");
  });

  it("lists a matching application in the command palette and opens its focus panel", async () => {
    mockListApplications.mockResolvedValue([
      { id: "app-9", company: "Globex", role: "Staff Engineer" },
    ]);
    const user = userEvent.setup();
    render(<AppShell>Workspace content</AppShell>);

    await user.click(screen.getByRole("button", { name: /Jump to anything/ }));
    await user.type(
      screen.getByRole("textbox", { name: "Jump to anything" }),
      "Globex",
    );

    const result = await screen.findByText("Globex · Staff Engineer");
    await user.click(result);

    expect(mockPush).toHaveBeenCalledWith("/pipeline?focus=app-9");
  });
});
