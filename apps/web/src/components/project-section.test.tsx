import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProjectSection } from "./project-section";
import type { ProjectSummary } from "@/lib/types";

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue("token") }),
}));

const mockCreateProject = vi.fn().mockResolvedValue({});

vi.mock("@/lib/api", () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
  updateProject: vi.fn().mockResolvedValue({}),
  deleteProject: vi.fn().mockResolvedValue(undefined),
  createProjectDetail: vi.fn().mockResolvedValue({}),
  updateProjectDetail: vi.fn().mockResolvedValue({}),
  deleteProjectDetail: vi.fn().mockResolvedValue(undefined),
}));

const mockProject: ProjectSummary = {
  id: "p1",
  name: "CareerOS",
  description: "Career management platform",
  url: "https://github.com/user/careeros",
  start_date: "2025-01",
  end_date: null,
  details: [
    {
      id: "pd1",
      content: "Built the API layer",
      evidence: null,
    },
  ],
};

describe("ProjectSection", () => {
  it("renders empty state when no projects", () => {
    render(<ProjectSection projects={[]} onMutate={vi.fn()} />);
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
  });

  it("renders project entries with details", () => {
    render(<ProjectSection projects={[mockProject]} onMutate={vi.fn()} />);
    expect(screen.getByText("CareerOS")).toBeInTheDocument();
    expect(screen.getByText("Career management platform")).toBeInTheDocument();
    expect(screen.getByText("Built the API layer")).toBeInTheDocument();
  });

  it("opens create dialog when Add is clicked", async () => {
    const user = userEvent.setup();
    render(<ProjectSection projects={[]} onMutate={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Add project" }));
    expect(screen.getByText("Add Project")).toBeInTheDocument();
  });

  it("has accessible heading", () => {
    render(<ProjectSection projects={[]} onMutate={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "Projects" }),
    ).toBeInTheDocument();
  });

  it("detail edit/delete buttons have accessible labels", () => {
    render(<ProjectSection projects={[mockProject]} onMutate={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /Edit detail:/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Delete detail:/ }),
    ).toBeInTheDocument();
  });

  it("shows mutation error when create fails and dialog stays open", async () => {
    const user = userEvent.setup();
    mockCreateProject.mockRejectedValueOnce(new Error("fail"));
    render(<ProjectSection projects={[]} onMutate={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Add project" }));

    const dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByLabelText("Project Name"),
      "My Project",
    );
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(
      await screen.findByText("Failed to add project. Please try again."),
    ).toBeInTheDocument();
    // Dialog should remain open
    expect(screen.getByText("Add Project")).toBeInTheDocument();
  });
});
