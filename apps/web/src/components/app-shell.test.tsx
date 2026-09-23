import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "./app-shell";

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
});
