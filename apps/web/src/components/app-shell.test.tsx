import { render, screen, within } from "@testing-library/react";
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
  window.localStorage.clear();
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
      "Home",
      "Discover",
      "Applications",
      "Career Brain",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/home",
      "/discover",
      "/pipeline",
      "/me",
    ]);
    expect(screen.getByRole("link", { name: "Applications" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Application Assistant" }),
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
    await user.click(screen.getByRole("button", { name: /Settings/ }));
    await user.click(screen.getByRole("button", { name: "中文" }));
    expect(screen.getByRole("link", { name: "申请进度" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "职业档案" })).toBeInTheDocument();
    expect(screen.getByText("求职助手")).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: /Settings/ }));

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

  it("opens settings toward the content area with working preference links", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <AppShell>Workspace content</AppShell>
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: /Settings/ }));

    const menu = screen.getByTestId("settings-menu");
    expect(menu).toHaveClass("left-0");
    expect(menu).not.toHaveClass("right-0");
    expect(
      within(menu).getByRole("link", { name: /Search goals/ }),
    ).toHaveAttribute("href", "/me/goals");
    expect(
      within(menu).getByRole("link", { name: /Personal & contact info/ }),
    ).toHaveAttribute("href", "/me/contact");
    expect(within(menu).getByRole("link", { name: /Account/ })).toHaveAttribute(
      "href",
      "/me/account",
    );
  });

  it("closes settings when the user clicks elsewhere", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <AppShell>Workspace content</AppShell>
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: /Settings/ }));
    expect(screen.getByTestId("settings-menu")).toBeInTheDocument();
    await user.click(screen.getByText("Workspace content"));
    expect(screen.queryByTestId("settings-menu")).not.toBeInTheDocument();
  });

  it("offers sidebar control inside settings", async () => {
    const user = userEvent.setup();
    render(<AppShell>Workspace content</AppShell>);

    await user.click(screen.getByRole("button", { name: /Settings/ }));
    await user.click(
      within(screen.getByTestId("settings-menu")).getByRole("button", {
        name: /Sidebar.*Collapse/,
      }),
    );

    expect(window.localStorage.getItem("careeros.sidebarCollapsed")).toBe(
      "true",
    );
    expect(screen.queryByTestId("settings-menu")).not.toBeInTheDocument();
  });

  it("captures a manually-tracked application via the Capture dialog", async () => {
    mockCreateApplication.mockResolvedValue({ id: "app-1" });
    const user = userEvent.setup();
    render(<AppShell>Workspace content</AppShell>);

    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(
      screen.getByRole("button", { name: /Record application/ }),
    );
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

  it("collapses the desktop sidebar and persists the preference", async () => {
    const user = userEvent.setup();
    render(<AppShell>Workspace content</AppShell>);

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(window.localStorage.getItem("careeros.sidebarCollapsed")).toBe(
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Expand sidebar" }),
    ).toBeInTheDocument();
  });

  it("restores a saved collapsed preference after the server-safe first render", () => {
    window.localStorage.setItem("careeros.sidebarCollapsed", "true");

    render(<AppShell>Workspace content</AppShell>);

    expect(
      screen.getByRole("button", { name: "Expand sidebar" }),
    ).toBeInTheDocument();
  });

  it("opens the command palette with ⌘K and navigates to a nav destination", async () => {
    const user = userEvent.setup();
    render(<AppShell>Workspace content</AppShell>);

    await user.keyboard("{Meta>}k{/Meta}");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await user.type(
      screen.getByRole("textbox", { name: "Search or jump" }),
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

    await user.click(screen.getByRole("button", { name: /Search or jump/ }));
    await user.type(
      screen.getByRole("textbox", { name: "Search or jump" }),
      "Globex",
    );

    const result = await screen.findByText("Globex · Staff Engineer");
    await user.click(result);

    expect(mockPush).toHaveBeenCalledWith("/pipeline?focus=app-9");
  });
});
