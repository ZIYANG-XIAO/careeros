import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ExperienceSection } from "./experience-section";
import type { ExperienceSummary } from "@/lib/types";

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue("token") }),
}));

const mockCreateExperience = vi.fn().mockResolvedValue({});
const mockDeleteExperience = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/api", () => ({
  createExperience: (...args: unknown[]) => mockCreateExperience(...args),
  updateExperience: vi.fn().mockResolvedValue({}),
  deleteExperience: (...args: unknown[]) => mockDeleteExperience(...args),
  createExperienceDetail: vi.fn().mockResolvedValue({}),
  updateExperienceDetail: vi.fn().mockResolvedValue({}),
  deleteExperienceDetail: vi.fn().mockResolvedValue(undefined),
}));

const mockExperience: ExperienceSummary = {
  id: "x1",
  company: "Google",
  title: "Software Engineer",
  location: "Mountain View, CA",
  start_date: "2022-01",
  end_date: null,
  is_current: true,
  details: [
    {
      id: "d1",
      content: "Built search infrastructure",
      evidence: null,
    },
  ],
};

describe("ExperienceSection", () => {
  it("renders empty state when no experiences", () => {
    render(<ExperienceSection experiences={[]} onMutate={vi.fn()} />);
    expect(screen.getByText("No experience yet")).toBeInTheDocument();
  });

  it("renders experience entries with details", () => {
    render(
      <ExperienceSection experiences={[mockExperience]} onMutate={vi.fn()} />,
    );
    expect(screen.getByText("Software Engineer")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("Built search infrastructure")).toBeInTheDocument();
  });

  it("shows current status in date range", () => {
    render(
      <ExperienceSection experiences={[mockExperience]} onMutate={vi.fn()} />,
    );
    expect(screen.getByText(/Present/)).toBeInTheDocument();
  });

  it("opens create dialog when Add is clicked", async () => {
    const user = userEvent.setup();
    render(<ExperienceSection experiences={[]} onMutate={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Add experience" }));
    expect(screen.getByText("Add Experience")).toBeInTheDocument();
  });

  it("shows add detail button per experience", () => {
    render(
      <ExperienceSection experiences={[mockExperience]} onMutate={vi.fn()} />,
    );
    expect(screen.getByText("+ Add experience detail")).toBeInTheDocument();
  });

  it("has accessible heading", () => {
    render(<ExperienceSection experiences={[]} onMutate={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "Experience" }),
    ).toBeInTheDocument();
  });

  it("detail edit/delete buttons have accessible labels", () => {
    render(
      <ExperienceSection experiences={[mockExperience]} onMutate={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /^Edit:/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Delete:/ }),
    ).toBeInTheDocument();
  });

  it("shows mutation error when create fails and dialog stays open", async () => {
    const user = userEvent.setup();
    mockCreateExperience.mockRejectedValueOnce(new Error("fail"));
    render(<ExperienceSection experiences={[]} onMutate={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Add experience" }));

    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Company"), "Acme");
    await user.type(within(dialog).getByLabelText("Title"), "Dev");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(
      await screen.findByText("Failed to add experience. Please try again."),
    ).toBeInTheDocument();
    // Dialog should remain open
    expect(screen.getByText("Add Experience")).toBeInTheDocument();
  });

  it("parent delete warns about cascading detail removal", async () => {
    const user = userEvent.setup();
    render(
      <ExperienceSection experiences={[mockExperience]} onMutate={vi.fn()} />,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Actions for Software Engineer at Google",
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(
      screen.getByText(/All associated details will also be removed/),
    ).toBeInTheDocument();
  });
});
