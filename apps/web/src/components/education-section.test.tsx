import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EducationSection } from "./education-section";
import type { EducationSummary } from "@/lib/types";

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue("token") }),
}));

const mockCreateEducation = vi.fn().mockResolvedValue({});
const mockUpdateEducation = vi.fn().mockResolvedValue({});
const mockDeleteEducation = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/api", () => ({
  createEducation: (...args: unknown[]) => mockCreateEducation(...args),
  updateEducation: (...args: unknown[]) => mockUpdateEducation(...args),
  deleteEducation: (...args: unknown[]) => mockDeleteEducation(...args),
}));

const mockEducation: EducationSummary = {
  id: "e1",
  institution: "MIT",
  degree: "BS",
  field_of_study: "Computer Science",
  location: "Cambridge, MA",
  start_date: "2020-09",
  end_date: "2024-05",
};

describe("EducationSection", () => {
  it("renders empty state when no educations", () => {
    render(<EducationSection educations={[]} onMutate={vi.fn()} />);
    expect(screen.getByText("No education yet")).toBeInTheDocument();
  });

  it("renders education entries", () => {
    render(
      <EducationSection educations={[mockEducation]} onMutate={vi.fn()} />,
    );
    expect(screen.getByText("MIT")).toBeInTheDocument();
    expect(screen.getByText("BS — Computer Science")).toBeInTheDocument();
  });

  it("shows an explicit add education button", () => {
    render(<EducationSection educations={[]} onMutate={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Add education" }),
    ).toBeInTheDocument();
  });

  it("opens create dialog when Add is clicked", async () => {
    const user = userEvent.setup();
    render(<EducationSection educations={[]} onMutate={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Add education" }));
    expect(screen.getByText("Add Education")).toBeInTheDocument();
  });

  it("has accessible heading", () => {
    render(<EducationSection educations={[]} onMutate={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "Education" }),
    ).toBeInTheDocument();
  });

  it("shows mutation error when create fails and dialog stays open", async () => {
    const user = userEvent.setup();
    mockCreateEducation.mockRejectedValueOnce(new Error("fail"));
    render(<EducationSection educations={[]} onMutate={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Add education" }));

    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Institution"), "Stanford");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(
      await screen.findByText("Failed to add education. Please try again."),
    ).toBeInTheDocument();
    // Dialog should remain open
    expect(screen.getByText("Add Education")).toBeInTheDocument();
  });

  it("closes dialog on successful create", async () => {
    const user = userEvent.setup();
    mockCreateEducation.mockResolvedValueOnce({});
    const onMutate = vi.fn().mockResolvedValue(undefined);
    render(<EducationSection educations={[]} onMutate={onMutate} />);
    await user.click(screen.getByRole("button", { name: "Add education" }));

    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Institution"), "Stanford");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    await vi.waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(onMutate).toHaveBeenCalled();
  });
});
