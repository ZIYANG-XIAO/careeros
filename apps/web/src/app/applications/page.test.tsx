import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ApplicationsPage from "./page";

describe("ApplicationsPage", () => {
  it("shows an honest planned state without fake applications", () => {
    render(<ApplicationsPage />);
    expect(
      screen.getByText("Nothing is being tracked yet"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/honest preview—not a simulated pipeline/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore jobs/i })).toHaveAttribute(
      "href",
      "/jobs",
    );
  });
});
