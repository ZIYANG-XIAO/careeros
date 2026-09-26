// @vitest-environment jsdom

import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it } from "vitest";

import { PopupFooter } from "./footer";

describe("PopupFooter", () => {
  it("shows the build version in the footer", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<PopupFooter />);
    });

    expect(container.textContent).toContain(
      "CareerOS never submits an application for you.",
    );
    expect(container.textContent).toContain("Build test-build");
  });
});
