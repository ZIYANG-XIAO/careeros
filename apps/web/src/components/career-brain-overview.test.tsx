import { render, screen, within } from "@testing-library/react";
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

function renderOverview(props: Parameters<typeof CareerBrainOverview>[0]) {
  return render(
    <LocaleProvider>
      <CareerBrainOverview {...props} />
    </LocaleProvider>,
  );
}

describe("CareerBrainOverview", () => {
  it("summarizes confirmed professional context without inventing a score", () => {
    renderOverview({ brain });

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Your professional foundation",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText(/2 confirmed evidence items/)).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    // Not empty, so no first-run guide.
    expect(
      screen.queryByText("Set up your profile in three steps"),
    ).not.toBeInTheDocument();
  });

  it("keeps guiding toward a first resume when only education exists", () => {
    renderOverview({
      brain: {
        ...brain,
        experiences: [],
        skills: [],
        educations: [
          {
            id: "edu-1",
            institution: "MIT",
            degree: null,
            field_of_study: null,
            location: null,
            start_date: null,
            end_date: null,
          },
        ],
      },
      resumes: [],
    });
    expect(
      screen.getByRole("heading", {
        name: "Set up your profile in three steps",
      }),
    ).toBeInTheDocument();
  });

  it("guides an empty profile toward uploading a resume", () => {
    renderOverview({
      brain: { ...brain, experiences: [], skills: [] },
      resumes: [],
    });
    expect(
      screen.getByRole("heading", {
        name: "Set up your profile in three steps",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Upload resume" })).toHaveAttribute(
      "href",
      "/me/resumes?upload=1",
    );
  });

  it("lists pending resume review as the next action", () => {
    renderOverview({
      brain,
      pendingImports: [
        {
          id: "import-1",
          filename: "cv.pdf",
          pending_item_count: 6,
          created_at: "2026-09-01T00:00:00Z",
        },
      ],
    });
    const actions = screen.getByRole("region", {
      name: "Next useful profile actions",
    });
    expect(
      within(actions).getByRole("link", {
        name: /Review 6 items extracted from cv\.pdf/,
      }),
    ).toHaveAttribute("href", "/me/imports/import-1");
  });

  it("states that sensitive answers are never inferred", () => {
    renderOverview({ brain });
    expect(
      screen.getByText(/never inferred — you answer them yourself/),
    ).toBeInTheDocument();
    expect(screen.getByText("1 of 9 ready to fill")).toBeInTheDocument();
  });
});
