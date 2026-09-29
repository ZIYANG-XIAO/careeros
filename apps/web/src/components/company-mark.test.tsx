import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  CompanyMark,
  companyIconSlug,
  companyIconUrl,
} from "@/components/company-mark";

describe("CompanyMark", () => {
  it("builds a Simple Icons slug from a company name", () => {
    expect(companyIconSlug("1Password")).toBe("1password");
    expect(companyIconSlug("DoorDash, Inc.")).toBe("doordashinc");
  });

  it("uses verified employer domains for catalog logos", () => {
    expect(companyIconUrl("Kraken")).toBe(
      "https://www.google.com/s2/favicons?domain_url=https://kraken.com&sz=128",
    );
    expect(companyIconUrl("Gemini")).toBe(
      "https://www.google.com/s2/favicons?domain_url=https://gemini.com&sz=128",
    );
    expect(companyIconUrl("Toast")).toBe(
      "https://www.google.com/s2/favicons?domain_url=https://toasttab.com&sz=128",
    );
  });

  it("shows the real brand icon when one is available", () => {
    const { container } = render(<CompanyMark company="Kraken" />);

    expect(
      container.querySelector('[data-company-logo="Kraken"]'),
    ).toHaveAttribute(
      "src",
      "https://www.google.com/s2/favicons?domain_url=https://kraken.com&sz=128",
    );
  });

  it("falls back to the company initial when the icon cannot load", () => {
    const { container } = render(<CompanyMark company="Unknown Company" />);
    const logo = container.querySelector(
      '[data-company-logo="Unknown Company"]',
    );

    expect(logo).not.toBeNull();
    fireEvent.error(logo!);

    expect(
      container.querySelector('[data-company-logo="Unknown Company"]'),
    ).not.toBeInTheDocument();
    expect(screen.getByText("U")).toBeInTheDocument();
  });
});
