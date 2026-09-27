import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "@/lib/i18n";
import type { CareerBrain } from "@/lib/types";

import { CareerBrainOverview } from "./career-brain-overview";

const brain: CareerBrain = {
  id: "brain-1",
  created_at: "2026-09-01T00:00:00Z",
  educations: [],
  experiences: [
    {
      id: "experience-1",
      company: "Acme",
      title: "Engineer",
      location: null,
      start_date: null,
      end_date: null,
      is_current: true,
      details: [
        {
          id: "detail-1",
          content: "Built APIs",
          evidence: {
            evidence_id: "evidence-1",
            current_revision_id: "revision-1",
            current_revision_number: 1,
            confirmation_status: "CONFIRMED",
          },
        },
      ],
    },
  ],
  projects: [],
  skills: [
    {
      id: "skill-1",
      name: "TypeScript",
      preferred: true,
      evidence: {
        evidence_id: "evidence-2",
        current_revision_id: "revision-2",
        current_revision_number: 1,
        confirmation_status: "CONFIRMED",
      },
    },
  ],
};

describe("CareerBrainOverview", () => {
  it("summarizes confirmed professional context without inventing a score", () => {
    render(
      <LocaleProvider>
        <CareerBrainOverview brain={brain} />
      </LocaleProvider>,
    );

    expect(
      screen.getByText("Your professional foundation"),
    ).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText(/2 confirmed evidence items/)).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
