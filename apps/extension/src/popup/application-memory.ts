import type {
  PageDetection,
  AnswerResolution,
  ApplicationPageContext,
  ConfirmedApplicationAnswer,
  DetectionStatus,
  FillExecutionResult,
} from "../shared/messages";

const persistedSources = new Set([
  "IDENTITY",
  "CAREER_BRAIN",
  "USER_CONTACT_INFO",
  "RESUME_VERSION",
  "USER_PROVIDED",
]);

const GENERIC_ATS_HOSTS = new Set([
  "boards.greenhouse.io",
  "job-boards.greenhouse.io",
  "jobs.lever.co",
  "jobs.ashbyhq.com",
]);

const GENERIC_TITLE_SUFFIX =
  /\s[-|–—·]\s*(Application|Apply(?:\s+Now)?|Careers?|Jobs?|Greenhouse|Lever|Ashby|Workday)\s*$|\s+(Application|Apply(?:\s+Now)?|Careers?|Jobs?)\s*$/i;

function isGenericEmployerHost(host: string): boolean {
  const normalized = host.toLowerCase();
  if (normalized === "localhost" || normalized === "127.0.0.1") {
    return true;
  }
  if (GENERIC_ATS_HOSTS.has(normalized)) {
    return true;
  }
  return (
    normalized.endsWith(".greenhouse.io") ||
    normalized.endsWith(".lever.co") ||
    normalized.endsWith(".ashbyhq.com") ||
    normalized.includes("workday")
  );
}

function stripGenericTitleSuffix(text: string): string {
  let result = text.trim();
  while (GENERIC_TITLE_SUFFIX.test(result)) {
    result = result.replace(GENERIC_TITLE_SUFFIX, "").trim();
  }
  return result.replace(/^Apply\s+(?:now|for|to)\s+/i, "").trim();
}

function suggestCompany(context: ApplicationPageContext): string {
  if (context.application?.company) {
    return context.application.company;
  }
  if (isGenericEmployerHost(context.siteHost)) {
    return "";
  }
  return context.siteHost;
}

function suggestRole(context: ApplicationPageContext): string {
  if (context.application?.role) {
    return context.application.role;
  }
  const role = stripGenericTitleSuffix(context.pageTitle);
  if (!role || /^(apply|application|careers?|jobs?)$/i.test(role)) {
    return "";
  }
  return role;
}

export function confirmedApplicationAnswers(
  resolution: AnswerResolution | null,
  fillResult: FillExecutionResult | null,
  detection: PageDetection | null = null,
): ConfirmedApplicationAnswer[] {
  const questions = new Map(
    (detection?.forms ?? [])
      .flatMap((form) => form.fields)
      .map((field) => [field.id, field.question] as const),
  );
  if (!resolution || !fillResult) return [];
  const filled = new Set(
    fillResult.fields
      .filter((field) => field.state === "FILLED")
      .map((field) => field.fieldId),
  );
  return resolution.decisions.flatMap((decision) => {
    if (
      !filled.has(decision.fieldId) ||
      decision.action !== "FILL" ||
      decision.proposedAnswer === null ||
      decision.policyCategory !== "STANDARD" ||
      decision.sensitivity !== "NONE" ||
      !(
        persistedSources.has(decision.sourceCategory) ||
        decision.sourceCategory === "REUSABLE_CONFIRMED_ANSWER"
      )
    ) {
      return [];
    }
    // A saved reusable answer is recorded as the user's own answer, under the
    // question the form actually asked.
    if (decision.sourceCategory === "REUSABLE_CONFIRMED_ANSWER") {
      return [
        {
          canonicalKey: null,
          questionText: (
            questions.get(decision.fieldId) ?? "Application field"
          ).slice(0, 500),
          answerText: decision.proposedAnswer,
          sourceCategory: "USER_PROVIDED",
        },
      ];
    }
    return [
      {
        canonicalKey: decision.canonicalKey,
        questionText:
          decision.canonicalKey?.replaceAll("_", " ").toLowerCase() ??
          "Application field",
        answerText: decision.proposedAnswer,
        sourceCategory:
          decision.sourceCategory as ConfirmedApplicationAnswer["sourceCategory"],
      },
    ];
  });
}

export function initialApplicationFields(context: ApplicationPageContext): {
  company: string;
  role: string;
  resumeVersionId: string;
} {
  return {
    company: suggestCompany(context),
    role: suggestRole(context),
    resumeVersionId:
      context.matchKind === "EXACT_URL"
        ? (context.application?.resumeVersionId ?? "")
        : "",
  };
}

export function selectedApplicationFields(
  context: ApplicationPageContext,
  useTrackedApplication: boolean,
): { company: string; role: string; resumeVersionId: string } {
  if (useTrackedApplication && context.application) {
    return {
      company: context.application.company,
      role: context.application.role,
      resumeVersionId: context.application.resumeVersionId ?? "",
    };
  }
  return initialApplicationFields(context);
}

export function shouldShowApplicationMemory(
  detectionStatus: DetectionStatus,
  context: ApplicationPageContext,
): boolean {
  return detectionStatus === "APPLICATION_PAGE" || context.matchKind !== "NONE";
}
