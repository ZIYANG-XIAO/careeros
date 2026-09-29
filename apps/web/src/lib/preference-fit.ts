import type { Job, JobSearchGoal } from "./types";

export type FitCriterion =
  "market" | "country" | "role" | "city" | "workplace" | "employment";

export type PreferenceFit =
  | { level: "BLOCKED" }
  | { level: "UNKNOWN" }
  | {
      level: "MATCH" | "PARTIAL";
      matched: FitCriterion[];
      mismatched: FitCriterion[];
    };

function fold(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().trim();
}

function words(value: string): string[] {
  return fold(value)
    .split(/[^\p{L}\p{N}+#]+/u)
    .filter(Boolean);
}

/**
 * A role matches when every word of it appears in the title (so "Backend
 * Engineer" matches "Senior Software Engineer, Backend"), or, for scripts
 * without spaces such as Chinese, when it appears as a substring.
 */
export function roleMatchesTitle(role: string, title: string): boolean {
  const titleFolded = fold(title);
  if (titleFolded.includes(fold(role))) return true;
  const titleWords = new Set(words(title));
  const roleWords = words(role);
  return (
    roleWords.length > 0 && roleWords.every((word) => titleWords.has(word))
  );
}

/**
 * Deterministic comparison of a job's explicit fields against the user's
 * active search goal. A criterion is only judged when both the goal states a
 * preference and the job states a value; anything else stays unknown rather
 * than being guessed.
 */
export function preferenceFit(
  job: Job,
  goal: JobSearchGoal | null,
): PreferenceFit {
  if (!goal) return { level: "UNKNOWN" };

  const company = fold(job.company);
  if (goal.company_blocklist.some((blocked) => fold(blocked) === company)) {
    return { level: "BLOCKED" };
  }

  const matched: FitCriterion[] = [];
  const mismatched: FitCriterion[] = [];
  const judge = (criterion: FitCriterion, result: boolean | null) => {
    if (result === null) return;
    (result ? matched : mismatched).push(criterion);
  };

  judge(
    "market",
    goal.market !== "UNKNOWN" && job.market !== "UNKNOWN"
      ? goal.market === job.market
      : null,
  );
  judge(
    "country",
    goal.country_codes.length > 0 && job.country_code !== "UNKNOWN"
      ? goal.country_codes.includes(job.country_code)
      : null,
  );
  judge(
    "role",
    goal.target_roles.length > 0
      ? goal.target_roles.some((role) => roleMatchesTitle(role, job.title))
      : null,
  );
  judge(
    "city",
    goal.cities.length > 0 && job.location
      ? goal.cities.some((city) => fold(job.location!).includes(fold(city)))
      : null,
  );
  judge(
    "workplace",
    goal.workplace_types.length > 0 && job.workplace_type !== "UNKNOWN"
      ? goal.workplace_types.includes(job.workplace_type)
      : null,
  );
  judge(
    "employment",
    goal.employment_types.length > 0 && job.employment_type !== "UNKNOWN"
      ? goal.employment_types.includes(job.employment_type)
      : null,
  );

  if (matched.length + mismatched.length === 0) return { level: "UNKNOWN" };
  return {
    level: mismatched.length === 0 ? "MATCH" : "PARTIAL",
    matched,
    mismatched,
  };
}

function fitRank(fit: PreferenceFit): number {
  if (fit.level === "BLOCKED") return Number.NEGATIVE_INFINITY;
  if (fit.level === "UNKNOWN") return 0;
  return fit.matched.length * 2 - fit.mismatched.length;
}

/** Rank visible opportunities by explicit goal alignment, then freshness. */
export function rankByPreferenceFit(
  jobs: Job[],
  goal: JobSearchGoal | null,
): Job[] {
  return jobs
    .filter((job) => preferenceFit(job, goal).level !== "BLOCKED")
    .slice()
    .sort((a, b) => {
      const rankDelta =
        fitRank(preferenceFit(b, goal)) - fitRank(preferenceFit(a, goal));
      if (rankDelta !== 0) return rankDelta;
      const bTime = Date.parse(b.first_observed_at ?? b.created_at);
      const aTime = Date.parse(a.first_observed_at ?? a.created_at);
      return bTime - aTime;
    });
}
