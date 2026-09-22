import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EducationForm } from "./education-form";
import type { EducationSummary } from "@/lib/types";

const mockInitial: EducationSummary = {
  id: "e1",
  institution: "MIT",
  degree: "BS",
  field_of_study: "CS",
  location: "Cambridge",
  start_date: "2020",
  end_date: "2024",
};

describe("EducationForm", () => {
  it("renders form fields", () => {
    render(
      <EducationForm onSubmit={vi.fn()} onCancel={vi.fn()} loading={false} />,
    );
    expect(screen.getByLabelText("Institution")).toBeInTheDocument();
    expect(screen.getByLabelText("Degree")).toBeInTheDocument();
    expect(screen.getByLabelText("Field of Study")).toBeInTheDocument();
    expect(screen.getByLabelText("Location")).toBeInTheDocument();
    expect(screen.getByLabelText("Start Date")).toBeInTheDocument();
    expect(screen.getByLabelText("End Date")).toBeInTheDocument();
  });

  it("pre-fills fields when editing", () => {
    render(
      <EducationForm
        initial={mockInitial}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        loading={false}
      />,
    );
    expect(screen.getByLabelText("Institution")).toHaveValue("MIT");
    expect(screen.getByLabelText("Degree")).toHaveValue("BS");
  });

  it("calls onSubmit with form data", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <EducationForm onSubmit={onSubmit} onCancel={vi.fn()} loading={false} />,
    );
    await user.type(screen.getByLabelText("Institution"), "Stanford");
    await user.type(screen.getByLabelText("Degree"), "MS");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(onSubmit).toHaveBeenCalledWith({
      institution: "Stanford",
      degree: "MS",
      field_of_study: null,
      location: null,
      start_date: null,
      end_date: null,
    });
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <EducationForm onSubmit={vi.fn()} onCancel={onCancel} loading={false} />,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows Save button when editing", () => {
    render(
      <EducationForm
        initial={mockInitial}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        loading={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("does not submit whitespace-only institution", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <EducationForm onSubmit={onSubmit} onCancel={vi.fn()} loading={false} />,
    );
    await user.type(screen.getByLabelText("Institution"), "   ");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("displays error when provided", () => {
    render(
      <EducationForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        loading={false}
        error="Something went wrong"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });
});
