import type {
  CareerBrain,
  ContactInfo,
  DetailEvidence,
  JobSearchGoal,
  PendingResumeImport,
  ResumeSummary,
  ReusableAnswer,
} from "./types";

/**
 * Pure, count-only derivations for the Career Profile overview. Nothing here
 * scores the user or infers a professional claim: every number is a count of
 * records the user already owns, and every suggestion points at a record.
 */

function isConfirmed(evidence: DetailEvidence | null): boolean {
  return evidence?.confirmation_status === "CONFIRMED";
}

export type EvidenceTiers = {
  /** Evidence the user confirmed; reusable in matching and answers. */
  confirmed: number;
  /** Items extracted from resumes that still await the user's review. */
  pending: number;
  /** Skills without evidence, plus experiences/projects with no details. */
  unsupported: number;
};

export function evidenceTiers(
  brain: CareerBrain,
  pendingImports: PendingResumeImport[] | null = null,
): EvidenceTiers {
  const evidence = [
    ...brain.experiences.flatMap((item) => item.details.map((d) => d.evidence)),
    ...brain.projects.flatMap((item) => item.details.map((d) => d.evidence)),
    ...brain.skills.map((skill) => skill.evidence),
  ];
  return {
    confirmed: evidence.filter(isConfirmed).length,
    pending: (pendingImports ?? []).reduce(
      (total, item) => total + item.pending_item_count,
      0,
    ),
    unsupported:
      brain.skills.filter((skill) => skill.evidence === null).length +
      brain.experiences.filter((item) => item.details.length === 0).length +
      brain.projects.filter((item) => item.details.length === 0).length,
  };
}

export function isBrainEmpty(brain: CareerBrain): boolean {
  return (
    brain.experiences.length === 0 &&
    brain.projects.length === 0 &&
    brain.skills.length === 0 &&
    brain.educations.length === 0
  );
}

export type ProfileContext = {
  brain: CareerBrain;
  resumes: ResumeSummary[] | null;
  contact: ContactInfo | null;
  goals: JobSearchGoal[] | null;
  answers: ReusableAnswer[] | null;
  pendingImports: PendingResumeImport[] | null;
};

export type ProfileAction =
  | { kind: "UPLOAD_RESUME"; href: string }
  | { kind: "REVIEW_IMPORT"; count: number; filename: string; href: string }
  | {
      kind: "ADD_ACHIEVEMENTS";
      count: number;
      example: string;
      href: string;
    }
  | { kind: "QUANTIFY"; count: number; href: string }
  | { kind: "ADD_SKILL_EVIDENCE"; count: number; href: string }
  | { kind: "SET_GOAL"; href: string }
  | { kind: "CONFIRM_CONTACT"; href: string }
  | { kind: "MARK_FOCUS_SKILLS"; href: string };

const HAS_NUMBER = /\d/;

/**
 * The next useful profile actions, most foundational first. Data that failed
 * to load (null) never produces an action, so a network error cannot nag.
 */
export function profileActions(context: ProfileContext): ProfileAction[] {
  const { brain, resumes, contact, goals, pendingImports } = context;
  const actions: ProfileAction[] = [];

  for (const pending of pendingImports ?? []) {
    actions.push({
      kind: "REVIEW_IMPORT",
      count: pending.pending_item_count,
      filename: pending.filename,
      href: `/me/imports/${pending.id}`,
    });
  }

  if (resumes !== null && resumes.length === 0) {
    actions.push({ kind: "UPLOAD_RESUME", href: "/me/resumes?upload=1" });
  }

  const bare = brain.experiences.filter((item) => item.details.length === 0);
  if (bare.length > 0) {
    actions.push({
      kind: "ADD_ACHIEVEMENTS",
      count: bare.length,
      example: `${bare[0].title} · ${bare[0].company}`,
      href: "/me/experience",
    });
  }

  const unquantified = brain.experiences
    .flatMap((item) => item.details)
    .filter((detail) => !HAS_NUMBER.test(detail.content)).length;
  if (unquantified > 0) {
    actions.push({
      kind: "QUANTIFY",
      count: unquantified,
      href: "/me/experience",
    });
  }

  const unsupportedSkills = brain.skills.filter(
    (skill) => skill.evidence === null,
  ).length;
  if (unsupportedSkills > 0) {
    actions.push({
      kind: "ADD_SKILL_EVIDENCE",
      count: unsupportedSkills,
      href: "/me/skills",
    });
  }

  if (goals !== null && !goals.some((goal) => goal.is_active)) {
    actions.push({ kind: "SET_GOAL", href: "/me/goals" });
  }

  if (contact !== null && contact.confirmed_at === null) {
    actions.push({ kind: "CONFIRM_CONTACT", href: "/me/contact" });
  }

  if (
    brain.skills.length > 0 &&
    !brain.skills.some((skill) => skill.preferred)
  ) {
    actions.push({ kind: "MARK_FOCUS_SKILLS", href: "/me/skills" });
  }

  return actions;
}

export type ReadinessKey =
  | "name"
  | "email"
  | "phone"
  | "location"
  | "links"
  | "experience"
  | "education"
  | "resume"
  | "answers";

export type ReadinessItem = {
  key: ReadinessKey;
  /** null when the source could not be loaded: shown as unknown, not missing. */
  ready: boolean | null;
  href: string;
};

/**
 * Which common application-form sections CareerOS could fill today. Contact
 * fields only count once the user has confirmed them, matching the Answer
 * Engine, which never uses unconfirmed contact data.
 */
export function applicationReadiness(context: ProfileContext): ReadinessItem[] {
  const { brain, resumes, contact, answers } = context;
  const confirmedContact =
    contact === null ? null : contact.confirmed_at !== null ? contact : false;
  const contactHas = (...values: (string | null)[]): boolean | null =>
    confirmedContact === null
      ? null
      : confirmedContact !== false && values.some((value) => Boolean(value));

  return [
    {
      key: "name",
      ready:
        confirmedContact === null
          ? null
          : confirmedContact !== false &&
            ((Boolean(confirmedContact.first_name) &&
              Boolean(confirmedContact.last_name)) ||
              Boolean(confirmedContact.full_name_native)),
      href: "/me/contact",
    },
    {
      key: "email",
      ready: contactHas(contact?.contact_email ?? null),
      href: "/me/contact",
    },
    {
      key: "phone",
      ready: contactHas(contact?.phone ?? null),
      href: "/me/contact",
    },
    {
      key: "location",
      ready: contactHas(contact?.city ?? null, contact?.address_line_1 ?? null),
      href: "/me/contact",
    },
    {
      key: "links",
      ready: contactHas(
        contact?.linkedin_url ?? null,
        contact?.github_url ?? null,
        contact?.portfolio_url ?? null,
      ),
      href: "/me/contact",
    },
    {
      key: "experience",
      ready: brain.experiences.length > 0,
      href: "/me/experience",
    },
    {
      key: "education",
      ready: brain.educations.length > 0,
      href: "/me/education",
    },
    {
      key: "resume",
      ready: resumes === null ? null : resumes.length > 0,
      href: "/me/resumes",
    },
    {
      key: "answers",
      ready: answers === null ? null : answers.length > 0,
      href: "/me/contact",
    },
  ];
}
