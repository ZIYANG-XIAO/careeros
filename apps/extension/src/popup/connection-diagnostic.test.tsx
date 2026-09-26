// @vitest-environment jsdom

import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { ConnectionDiagnostic } from "./connection-diagnostic";

describe("ConnectionDiagnostic", () => {
  it("offers a setup guide action without exposing error details", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onOpenSetupGuide = vi.fn();

    act(() => {
      root.render(<ConnectionDiagnostic onOpenSetupGuide={onOpenSetupGuide} />);
    });

    expect(container.textContent).toMatch(/Connection issue —/i);
    expect(container.textContent?.toLowerCase()).not.toContain("token");

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    button!.click();
    expect(onOpenSetupGuide).toHaveBeenCalledOnce();
  });
});
