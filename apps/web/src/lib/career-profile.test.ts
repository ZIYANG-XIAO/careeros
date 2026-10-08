import { describe, expect, it } from "vitest";

import {
  applicationReadiness,
  evidenceTiers,
  isBrainEmpty,
  profileActions,
  type ProfileContext,
} from "./career-profile";
import type { CareerBrain, ContactInfo, DetailEvidence } from "./types";

const confirmed: DetailEvidence = {
  evidence_id: "e",
  current_revision_id: "r",
  current_revision_number: 1,
  confirmation_status: "CONFIRMED",
};

function makeBrain(overrides: Partial<CareerBrain> = {}): CareerBrain {
  return {
    id: "brain",
    created_at: "2026-09-01T00:00:00Z",
    educations: [],
    experiences: [],
    projects: [],
    skills: [],
    ...overrides,
  };
}

function makeContact(overrides: Partial<ContactInfo> = {}): ContactInfo {
  return {
    first_name: null,
    last_name: null,
    preferred_name: null,
    given_name_native: null,
    family_name_native: null,
    full_name_native: null,
    contact_email: null,
    phone: null,
    wechat_id: null,
    address_line_1: null,
    address_line_2: null,
    city: null,
    district: null,
    region: null,
    postal_code: null,
    country_code: null,
    linkedin_url: null,
    github_url: null,
    portfolio_url: null,
    confirmed_at: null,
    ...overrides,
  };
}

function context(overrides: Partial<ProfileContext> = {}): ProfileContext {
  return {
    brain: makeBrain(),
    resumes: [],
    contact: null,
    goals: [],
    answers: [],
    pendingImports: [],
    ...overrides,
  };
}

const experience = (details: string[]) => ({
  id: `exp-${details.length}`,
  company: "Acme",
  title: "Engineer",
  location: null,
  start_date: null,
  end_date: null,
  is_current: false,
  details: details.map((content, index) => ({
    id: `d-${index}`,
    content,
    evidence: confirmed,
  })),
});

describe("evidenceTiers", () => {
  it("counts confirmed evidence, pending import items, and unsupported records", () => {
    const brain = makeBrain({
      experiences: [experience(["Built APIs"]), experience([])],
      skills: [
        { id: "s1", name: "Go", preferred: false, evidence: confirmed },
        { id: "s2", name: "Rust", preferred: false, evidence: null },
      ],
    });
    expect(
      evidenceTiers(brain, [
        {
          id: "imp",
          filename: "cv.pdf",
          pending_item_count: 4,
          created_at: "2026-09-01T00:00:00Z",
        },
      ]),
    ).toEqual({ confirmed: 2, pending: 4, unsupported: 2 });
  });
});

describe("profileActions", () => {
  it("puts pending resume review first and links to the import", () => {
    const actions = profileActions(
      context({
        pendingImports: [
          {
            id: "imp-1",
            filename: "cv.pdf",
            pending_item_count: 3,
            created_at: "2026-09-01T00:00:00Z",
          },
        ],
      }),
    );
    expect(actions[0]).toEqual({
      kind: "REVIEW_IMPORT",
      count: 3,
      filename: "cv.pdf",
      href: "/me/imports/imp-1",
    });
    expect(actions.map((action) => action.kind)).toContain("UPLOAD_RESUME");
    expect(actions.map((action) => action.kind)).toContain("SET_GOAL");
  });

  it("flags bare roles and achievements without numbers", () => {
    const actions = profileActions(
      context({
        brain: makeBrain({
          experiences: [
            experience([]),
            experience(["Led migration", "Cut p99 latency by 40%"]),
          ],
        }),
      }),
    );
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "ADD_ACHIEVEMENTS", count: 1 }),
        expect.objectContaining({ kind: "QUANTIFY", count: 1 }),
      ]),
    );
  });

  it("never nags about data that failed to load", () => {
    expect(
      profileActions(
        context({
          resumes: null,
          goals: null,
          contact: null,
          pendingImports: null,
        }),
      ),
    ).toEqual([]);
  });
});

describe("applicationReadiness", () => {
  it("only counts contact fields once the user confirmed them", () => {
    const filled = makeContact({
      first_name: "Ada",
      last_name: "Lovelace",
      contact_email: "ada@example.com",
    });
    const unconfirmed = applicationReadiness(context({ contact: filled }));
    expect(unconfirmed.find((item) => item.key === "email")?.ready).toBe(false);

    const confirmedContact = applicationReadiness(
      context({
        contact: { ...filled, confirmed_at: "2026-09-01T00:00:00Z" },
      }),
    );
    expect(
      confirmedContact
        .filter((item) => item.ready === true)
        .map((item) => item.key),
    ).toEqual(["name", "email"]);
  });

  it("reports unknown rather than missing when a source failed", () => {
    const items = applicationReadiness(
      context({ contact: null, resumes: null, answers: null }),
    );
    expect(items.find((item) => item.key === "phone")?.ready).toBeNull();
    expect(items.find((item) => item.key === "resume")?.ready).toBeNull();
    expect(items.find((item) => item.key === "experience")?.ready).toBe(false);
  });
});

describe("isBrainEmpty", () => {
  it("is true only with no records at all", () => {
    expect(isBrainEmpty(makeBrain())).toBe(true);
    expect(isBrainEmpty(makeBrain({ experiences: [experience([])] }))).toBe(
      false,
    );
  });
});
