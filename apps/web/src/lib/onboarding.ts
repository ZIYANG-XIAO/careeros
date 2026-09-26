import type { CareerBrain, ResumeSummary } from "./types";

export const ONBOARDING_SKIP_COOKIE = "careeros_onboarding_skip";

export function hasResumeData(resumes: ResumeSummary[]): boolean {
  return resumes.some((resume) => resume.versions.length > 0);
}

export function hasCareerBrainContent(brain: CareerBrain): boolean {
  return (
    brain.educations.length > 0 ||
    brain.experiences.length > 0 ||
    brain.projects.length > 0 ||
    brain.skills.length > 0
  );
}

export function hasMeaningfulProfile(
  resumes: ResumeSummary[],
  brain: CareerBrain,
): boolean {
  return hasResumeData(resumes) || hasCareerBrainContent(brain);
}

export type OnboardingStepId =
  | "upload_resume"
  | "review_career_brain"
  | "contact_info"
  | "extension_setup"
  | "browse_jobs";

export type StepStatus = "completed" | "current" | "optional";

export type OnboardingStep = {
  id: OnboardingStepId;
  href: string;
  status: StepStatus;
};

/**
 * Set a short-lived, user-scoped cookie indicating onboarding was skipped.
 * The cookie includes the Clerk userId so a different user logging in on the
 * same browser does not inherit the skip preference.  Value = userId.
 * Max-Age = 1 year, SameSite=Lax, path=/.
 */
export function setOnboardingSkipCookie(userId: string): void {
  const maxAge = 365 * 24 * 60 * 60;
  document.cookie = `${ONBOARDING_SKIP_COOKIE}=${encodeURIComponent(userId)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function deriveOnboardingSteps(
  resumes: ResumeSummary[],
  brain: CareerBrain,
): OnboardingStep[] {
  const resumeDone = hasResumeData(resumes);
  const brainDone = hasCareerBrainContent(brain);

  const uploadStatus: StepStatus = resumeDone ? "completed" : "current";
  const brainStatus: StepStatus = brainDone
    ? "completed"
    : resumeDone
      ? "current"
      : "optional";

  return [
    {
      id: "upload_resume",
      href: "/resumes?upload=1",
      status: uploadStatus,
    },
    {
      id: "review_career_brain",
      href: "/career",
      status: brainStatus,
    },
    {
      id: "contact_info",
      href: "/career",
      status: "optional",
    },
    {
      id: "extension_setup",
      href: "/setup",
      status: "optional",
    },
    {
      id: "browse_jobs",
      href: "/jobs",
      status: "optional",
    },
  ];
}
