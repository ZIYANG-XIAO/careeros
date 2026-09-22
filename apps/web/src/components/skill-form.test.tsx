import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SkillForm } from "./skill-form";

describe("SkillForm", () => {
  it("renders skill name input", () => {
    render(<SkillForm onSubmit={vi.fn()} onCancel={vi.fn()} loading={false} />);
    expect(screen.getByLabelText("Skill Name")).toBeInTheDocument();
  });

  it("calls onSubmit with trimmed name", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <SkillForm onSubmit={onSubmit} onCancel={vi.fn()} loading={false} />,
    );
    await user.type(screen.getByLabelText("Skill Name"), "  React  ");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(onSubmit).toHaveBeenCalledWith("React");
  });

  it("pre-fills when editing", () => {
    render(
      <SkillForm
        initial="TypeScript"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        loading={false}
      />,
    );
    expect(screen.getByLabelText("Skill Name")).toHaveValue("TypeScript");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("does not submit empty name", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <SkillForm onSubmit={onSubmit} onCancel={vi.fn()} loading={false} />,
    );
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit whitespace-only name", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <SkillForm onSubmit={onSubmit} onCancel={vi.fn()} loading={false} />,
    );
    await user.type(screen.getByLabelText("Skill Name"), "   ");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("displays error when provided", () => {
    render(
      <SkillForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        loading={false}
        error="Failed to add skill"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to add skill");
  });
});
