import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n";

import { ConfirmDelete } from "./confirm-delete";

function renderConfirm(onConfirm: () => Promise<void>) {
  render(
    <LocaleProvider>
      <ConfirmDelete
        label="Delete job"
        warning="Gone forever."
        onConfirm={onConfirm}
      />
    </LocaleProvider>,
  );
}

describe("ConfirmDelete", () => {
  it("needs a second, explicit click and can be cancelled", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderConfirm(onConfirm);
    fireEvent.click(screen.getByRole("button", { name: "Delete job" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText("Gone forever.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Gone forever.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete job" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("shows the failure message and stays open", async () => {
    renderConfirm(vi.fn().mockRejectedValue(new Error("Resume is in use.")));
    fireEvent.click(screen.getByRole("button", { name: "Delete job" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Resume is in use.",
    );
  });
});
