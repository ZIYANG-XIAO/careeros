import { describe, expect, it } from "vitest";

import {
  deriveOnboardingSteps,
  hasCareerBrainContent,
  hasMeaningfulProfile,
  hasResumeData,
} from "./onboarding";
import type { CareerBrain, ResumeSummary } from "./types";

const emptyBrain: CareerBrain = {
  id: "brain-1",
  created_at: "2026-01-01T00:00:00Z",
  educations: [],
  experiences: [],
  projects: [],
  skills: [],
};

const resumeWithoutVersions: ResumeSummary = {
  id: "resume-1",
  name: "Base resume",
  type: "BASE",
  is_primary: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  versions: [],
};

const resumeWithVersions: ResumeSummary = {
  ...resumeWithoutVersions,
  versions: [
    {
      id: "version-1",
      version_number: 1,
      source: "UPLOAD",
      created_by: "user-1",
      source_version_id: null,
      original_filename: "resume.pdf",
      content_type: "application/pdf",
      size_bytes: 1000,
      sha256: "abc",
      parser_version: "1",
      extracted_text: "Experience",
      structured_content: {},
      created_at: "2026-01-01T00:00:00Z",
    },
  ],
};

describe("onboarding helpers", () => {
  it("detects resume and career brain readiness", () => {
    expect(hasResumeData([])).toBe(false);
    expect(hasResumeData([resumeWithoutVersions])).toBe(false);
    expect(hasResumeData([resumeWithVersions])).toBe(true);
    expect(hasCareerBrainContent(emptyBrain)).toBe(false);
    expect(
      hasCareerBrainContent({
        ...emptyBrain,
        skills: [
          { id: "s1", name: "Python", preferred: false, evidence: null },
        ],
      }),
    ).toBe(true);
    expect(hasMeaningfulProfile([], emptyBrain)).toBe(false);
    expect(hasMeaningfulProfile([resumeWithVersions], emptyBrain)).toBe(true);
  });

  it("derives onboarding step states from canonical profile data", () => {
    expect(deriveOnboardingSteps([], emptyBrain)[0]?.status).toBe("current");
    expect(
      deriveOnboardingSteps([resumeWithVersions], emptyBrain)[0]?.status,
    ).toBe("completed");
    expect(
      deriveOnboardingSteps([resumeWithVersions], {
        ...emptyBrain,
        experiences: [
          {
            id: "exp-1",
            company: "Acme",
            title: "Engineer",
            location: null,
            start_date: null,
            end_date: null,
            is_current: true,
            details: [],
          },
        ],
      })[1]?.status,
    ).toBe("completed");
  });
});
