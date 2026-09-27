import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "./app-shell";
import { LocaleProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";

vi.mock("@clerk/nextjs", () => ({ UserButton: () => <div>Account menu</div> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/pipeline" }));

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
      screen.getByRole("link", { name: "Assistant not installed" }),
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
});
