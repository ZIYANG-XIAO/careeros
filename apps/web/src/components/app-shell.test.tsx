import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "./app-shell";
import { LocaleProvider } from "@/lib/i18n";

vi.mock("@clerk/nextjs", () => ({ UserButton: () => <div>Account menu</div> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/jobs/job-1" }));

describe("AppShell", () => {
  it("uses the approved user-facing information architecture", () => {
    render(<AppShell>Workspace content</AppShell>);
    const navigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });
    const links = Array.from(navigation.querySelectorAll("a"));
    expect(links.map((link) => link.textContent)).toEqual([
      "Jobs",
      "Applications",
      "Resumes",
      "Profile",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/jobs",
      "/applications",
      "/resumes",
      "/career",
    ]);
    expect(screen.getByRole("link", { name: "Jobs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
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
    expect(screen.getByRole("link", { name: "职位" })).toBeInTheDocument();
    expect(screen.getByText("求职工作台")).toBeInTheDocument();
    expect(window.localStorage.getItem("careeros.locale")).toBe("zh-CN");
    expect(document.documentElement.lang).toBe("zh-CN");
  });
});
