import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  CompanyMark,
  companyIconKey,
  companyMonogram,
} from "@/components/company-mark";

describe("CompanyMark", () => {
  it("builds a local monogram without requesting a third-party image", () => {
    expect(companyMonogram("1Password")).toBe("1");
    expect(companyMonogram("DoorDash, Inc.")).toBe("D");
  });

  it("normalizes common company suffixes for local icon lookup", () => {
    expect(companyIconKey("DoorDash, Inc.")).toBe("doordash");
    expect(companyIconKey("Databricks LLC")).toBe("databricks");
  });

  it("renders the company initial for an unsupported brand", () => {
    const { container } = render(<CompanyMark company="Acme Systems" />);

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("renders a bundled company logo for a catalog employer", () => {
    const { container } = render(<CompanyMark company="Stripe, Inc." />);

    expect(
      container.querySelector('[data-company-icon="stripe"] > span'),
    ).toHaveStyle({
      backgroundImage: "url(/company-logos/stripe.png)",
    });
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("covers employers beyond the original hand-curated icon set", () => {
    const { container, rerender } = render(<CompanyMark company="GitLab" />);

    expect(
      container.querySelector('[data-company-icon="gitlab"] > span'),
    ).toHaveStyle({ backgroundImage: "url(/company-logos/gitlab.png)" });

    rerender(<CompanyMark company="Scale AI" />);
    expect(
      container.querySelector('[data-company-icon="scaleai"] > span'),
    ).toHaveStyle({ backgroundImage: "url(/company-logos/scaleai.png)" });
  });

  it("uses a safe placeholder for an empty company name", () => {
    render(<CompanyMark company="" />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("bundles a logo for every employer in the current source catalogs", () => {
    const catalog = JSON.parse(
      readFileSync(
        path.resolve(process.cwd(), "public/company-logos/catalog.json"),
        "utf8",
      ),
    ) as Record<string, string>;
    const sourceFiles = [
      "greenhouse_north_america.json",
      "lever_north_america.json",
      "ashby_north_america.json",
    ];

    for (const sourceFile of sourceFiles) {
      const source = JSON.parse(
        readFileSync(
          path.resolve(process.cwd(), "../../apps/api/job_sources", sourceFile),
          "utf8",
        ),
      ) as { boards: { company: string }[] };

      for (const board of source.boards) {
        const key = companyIconKey(board.company);
        expect(
          catalog,
          `${board.company} is missing from the logo catalog`,
        ).toHaveProperty(key);
        expect(
          existsSync(
            path.resolve(process.cwd(), `public/company-logos/${key}.png`),
          ),
          `${board.company} is missing its bundled logo asset`,
        ).toBe(true);
      }
    }
  });
});
