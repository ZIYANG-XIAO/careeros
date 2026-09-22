import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DeleteConfirmation } from "./delete-confirmation";

describe("DeleteConfirmation", () => {
  it("renders default confirmation message", () => {
    render(
      <DeleteConfirmation
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        loading={false}
        entityName="Education"
      />,
    );
    expect(
      screen.getByText(/Are you sure you want to delete this education/i),
    ).toBeInTheDocument();
  });

  it("renders custom description when provided", () => {
    render(
      <DeleteConfirmation
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        loading={false}
        entityName="Experience"
        description="All associated details will also be removed. This action cannot be undone."
      />,
    );
    expect(
      screen.getByText(/All associated details will also be removed/),
    ).toBeInTheDocument();
  });

  it("calls onConfirm when Delete is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <DeleteConfirmation
        open={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        loading={false}
        entityName="Education"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <DeleteConfirmation
        open={true}
        onClose={onClose}
        onConfirm={vi.fn()}
        loading={false}
        entityName="Skill"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables buttons when loading", () => {
    render(
      <DeleteConfirmation
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        loading={true}
        entityName="Experience"
      />,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });

  it("does not render when closed", () => {
    render(
      <DeleteConfirmation
        open={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        loading={false}
        entityName="Education"
      />,
    );
    expect(screen.queryByText(/Are you sure/)).not.toBeInTheDocument();
  });

  it("displays error when provided", () => {
    render(
      <DeleteConfirmation
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        loading={false}
        entityName="Skill"
        error="Failed to delete skill"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Failed to delete skill",
    );
  });
});
