import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SkillSection } from "./skill-section";
import type { SkillSummary } from "@/lib/types";

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue("token") }),
}));

const mockCreateSkill = vi.fn().mockResolvedValue({});
const mockDeleteSkill = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/api", () => ({
  createSkill: (...args: unknown[]) => mockCreateSkill(...args),
  updateSkill: vi.fn().mockResolvedValue({}),
  deleteSkill: (...args: unknown[]) => mockDeleteSkill(...args),
}));

const mockSkill: SkillSummary = {
  id: "s1",
  name: "TypeScript",
  evidence: null,
};

const mockSkill2: SkillSummary = {
  id: "s2",
  name: "React",
  evidence: null,
};

describe("SkillSection", () => {
  it("renders empty state when no skills", () => {
    render(<SkillSection skills={[]} onMutate={vi.fn()} />);
    expect(screen.getByText("No skills yet")).toBeInTheDocument();
  });

  it("renders skill chips", () => {
    render(
      <SkillSection skills={[mockSkill, mockSkill2]} onMutate={vi.fn()} />,
    );
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
  });

  it("opens create dialog when Add is clicked", async () => {
    const user = userEvent.setup();
    render(<SkillSection skills={[]} onMutate={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Add skill" }));
    expect(screen.getByText("Add Skill")).toBeInTheDocument();
  });

  it("has edit and delete buttons per skill with accessible labels", () => {
    render(<SkillSection skills={[mockSkill]} onMutate={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Edit TypeScript" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete TypeScript" }),
    ).toBeInTheDocument();
  });

  it("has accessible heading", () => {
    render(<SkillSection skills={[]} onMutate={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
  });

  it("shows mutation error when create fails and dialog stays open", async () => {
    const user = userEvent.setup();
    mockCreateSkill.mockRejectedValueOnce(new Error("fail"));
    render(<SkillSection skills={[]} onMutate={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Add skill" }));

    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Skill Name"), "Python");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(
      await screen.findByText("Failed to add skill. Please try again."),
    ).toBeInTheDocument();
    // Dialog should remain open
    expect(screen.getByText("Add Skill")).toBeInTheDocument();
  });

  it("closes dialog on successful create", async () => {
    const user = userEvent.setup();
    mockCreateSkill.mockResolvedValueOnce({});
    const onMutate = vi.fn().mockResolvedValue(undefined);
    render(<SkillSection skills={[]} onMutate={onMutate} />);
    await user.click(screen.getByRole("button", { name: "Add skill" }));

    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Skill Name"), "Go");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    await vi.waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(onMutate).toHaveBeenCalled();
  });
});
