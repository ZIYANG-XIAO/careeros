import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "@/lib/i18n";
import type { RequirementGapsResponse } from "@/lib/types";

import { RequirementGapsCard } from "./requirement-gaps-card";

function renderCard(gaps: RequirementGapsResponse | null) {
  return render(
    <LocaleProvider>
      <RequirementGapsCard gaps={gaps} />
    </LocaleProvider>,
  );
}

describe("RequirementGapsCard", () => {
  it("lists recurring requirements with per-classification counts", () => {
    renderCard({
      tracked_job_count: 3,
      analyzed_job_count: 2,
      requirements: [
        {
          label: "Kubernetes",
          category: "SKILL",
          job_count: 2,
          genuine_gap_count: 1,
          weak_evidence_count: 1,
          hidden_evidence_count: 0,
          jobs: [
            {
              job_id: "job-1",
              company: "Stripe",
              title: "Platform Engineer",
              classification: "GENUINE_GAP",
            },
            {
              job_id: "job-2",
              company: "Figma",
              title: "Infra Engineer",
              classification: "WEAK_EVIDENCE",
            },
          ],
        },
      ],
    });
    expect(
      screen.getByText(/Across 2 analyzed of the 3 jobs/),
    ).toBeInTheDocument();
    expect(screen.getByText("Kubernetes")).toBeInTheDocument();
    expect(screen.getByText("2 job(s)")).toBeInTheDocument();
    expect(screen.getByText("No evidence · 1")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Stripe · Platform Engineer/ }),
    ).toHaveAttribute("href", "/discover?focus=job-1");
    expect(screen.getByText(/not a fit score/)).toBeInTheDocument();
  });

  it("explains how to get data when no jobs are analyzed", () => {
    renderCard({
      tracked_job_count: 2,
      analyzed_job_count: 0,
      requirements: [],
    });
    expect(
      screen.getByText(/run its match analysis to see recurring requirements/),
    ).toBeInTheDocument();
  });

  it("renders nothing when the insight could not be loaded", () => {
    const { container } = renderCard(null);
    expect(container).toBeEmptyDOMElement();
  });
});
