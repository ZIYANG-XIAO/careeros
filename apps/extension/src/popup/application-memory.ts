import type {
  AnswerResolution,
  ApplicationPageContext,
  ConfirmedApplicationAnswer,
  FillExecutionResult,
} from "../shared/messages";

const persistedSources = new Set([
  "IDENTITY",
  "CAREER_BRAIN",
  "RESUME_VERSION",
  "USER_PROVIDED",
]);

export function confirmedApplicationAnswers(
  resolution: AnswerResolution | null,
  fillResult: FillExecutionResult | null,
): ConfirmedApplicationAnswer[] {
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
      !persistedSources.has(decision.sourceCategory)
    ) {
      return [];
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
    company: context.application?.company ?? context.siteHost,
    role: context.application?.role ?? context.pageTitle,
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
