import type {
  AnswerAction,
  AnswerDecision,
  AnswerPolicyCategory,
  AnswerResolution,
  AnswerResolutionRequestData,
  AnswerReviewState,
  AnswerSensitivity,
  AnswerSourceCategory,
  CanonicalFieldKey,
  FieldConfidence,
  QuestionCategory,
  ReusePolicy,
} from "../shared/messages";

interface TokenProvider {
  getToken(): Promise<string | null>;
}

export async function resolveAnswers(
  apiUrl: string,
  tokenProvider: TokenProvider,
  request: typeof fetch,
  input: AnswerResolutionRequestData,
): Promise<AnswerResolution | null> {
  const token = await tokenProvider.getToken();
  if (!token) return null;
  const response = await request(`${apiUrl}/answer-engine/resolve`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      selected_resume_version_id: input.selectedResumeVersionId,
      market: input.market,
      form_locale: input.formLocale,
      fields: input.fields.map((field) => ({
        field_id: field.fieldId,
        canonical_key: field.canonicalKey,
        question: field.question,
        control_type: field.controlType,
        required: field.required,
        mapping_confidence: field.mappingConfidence,
        options: field.options,
      })),
    }),
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`CareerOS API returned ${response.status}`);
  const parsed = parseAnswerResolution(await response.json());
  const expectedFieldIds = input.fields.map((field) => field.fieldId);
  const returnedFieldIds = parsed?.decisions.map(
    (decision) => decision.fieldId,
  );
  if (
    !parsed ||
    returnedFieldIds?.length !== expectedFieldIds.length ||
    new Set(returnedFieldIds).size !== returnedFieldIds.length ||
    !expectedFieldIds.every((fieldId) => returnedFieldIds.includes(fieldId))
  )
    throw new Error("CareerOS API returned an invalid answer decision");
  return parsed;
}

const answerActions = ["FILL", "SUGGEST", "ASK", "CONFIRM", "UNKNOWN"] as const;
const sourceCategories = [
  "IDENTITY",
  "CAREER_BRAIN",
  "USER_CONTACT_INFO",
  "RESUME_VERSION",
  "APPLICATION_PREFERENCE",
  "REUSABLE_CONFIRMED_ANSWER",
  "APPLICATION_CONTEXT",
  "UNKNOWN",
] as const;
const policyCategories = [
  "STANDARD",
  "SENSITIVE",
  "CONSEQUENTIAL",
  "UNSUPPORTED",
] as const;
const sensitivities = ["NONE", "SENSITIVE", "CONSEQUENTIAL"] as const;
const reviewStates = [
  "NOT_REQUIRED",
  "REVIEW_REQUIRED",
  "USER_INPUT_REQUIRED",
  "CONFIRMATION_REQUIRED",
  "UNRESOLVED",
] as const;
const reusePolicies = [
  "NOT_APPLICABLE",
  "ELIGIBLE_WITH_EXPLICIT_CONSENT",
  "PROHIBITED",
] as const;
const questionCategories = [
  "STANDARD",
  "UNKNOWN",
  "DEMOGRAPHIC",
  "DISABILITY",
  "VETERAN",
  "WORK_AUTHORIZATION",
  "SPONSORSHIP",
  "COMPENSATION",
  "LEGAL_ATTESTATION",
  "SIGNATURE",
  "GOVERNMENT_ID",
] as const;
const confidences = ["HIGH", "MEDIUM", "LOW"] as const;
const canonicalKeys = [
  "PERSON_FIRST_NAME",
  "PERSON_LAST_NAME",
  "PERSON_FULL_NAME",
  "PERSON_NATIVE_GIVEN_NAME",
  "PERSON_NATIVE_FAMILY_NAME",
  "PERSON_NATIVE_FULL_NAME",
  "PERSON_LATIN_FULL_NAME",
  "CONTACT_EMAIL",
  "CONTACT_PHONE",
  "CONTACT_WECHAT",
  "ADDRESS_LINE_1",
  "ADDRESS_LINE_2",
  "ADDRESS_CITY",
  "ADDRESS_DISTRICT",
  "ADDRESS_REGION",
  "ADDRESS_POSTAL_CODE",
  "ADDRESS_COUNTRY",
  "PROFESSIONAL_LINKEDIN_URL",
  "PROFESSIONAL_GITHUB_URL",
  "PROFESSIONAL_PORTFOLIO_URL",
  "EDUCATION_SCHOOL",
  "EDUCATION_DEGREE",
  "EDUCATION_FIELD_OF_STUDY",
  "EXPERIENCE_COMPANY",
  "EXPERIENCE_TITLE",
  "RESUME_FILE",
  "COVER_LETTER_FILE",
] as const;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : null;
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null || typeof value === "string") return value;
  return undefined;
}

function parseDecision(value: unknown): AnswerDecision | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "field_id",
      "canonical_key",
      "question_category",
      "proposed_answer",
      "source_category",
      "source_reference_id",
      "action",
      "policy_category",
      "confidence",
      "sensitivity",
      "review_state",
      "reuse_policy",
      "save_intent_required",
    ]) ||
    typeof value.field_id !== "string" ||
    value.field_id.length === 0 ||
    value.field_id.length > 200
  ) {
    return null;
  }
  const canonicalKey =
    value.canonical_key === null
      ? null
      : enumValue(value.canonical_key, canonicalKeys);
  const proposedAnswer = nullableString(value.proposed_answer);
  const sourceReferenceId = nullableString(value.source_reference_id);
  const questionCategory = enumValue(
    value.question_category,
    questionCategories,
  ) as QuestionCategory | null;
  const sourceCategory = enumValue(
    value.source_category,
    sourceCategories,
  ) as AnswerSourceCategory | null;
  const action = enumValue(value.action, answerActions) as AnswerAction | null;
  const policyCategory = enumValue(
    value.policy_category,
    policyCategories,
  ) as AnswerPolicyCategory | null;
  const confidence = enumValue(
    value.confidence,
    confidences,
  ) as FieldConfidence | null;
  const sensitivity = enumValue(
    value.sensitivity,
    sensitivities,
  ) as AnswerSensitivity | null;
  const reviewState = enumValue(
    value.review_state,
    reviewStates,
  ) as AnswerReviewState | null;
  const reusePolicy = enumValue(
    value.reuse_policy,
    reusePolicies,
  ) as ReusePolicy | null;
  if (
    (canonicalKey === null && value.canonical_key !== null) ||
    proposedAnswer === undefined ||
    (typeof proposedAnswer === "string" && proposedAnswer.length > 2_000) ||
    sourceReferenceId === undefined ||
    (typeof sourceReferenceId === "string" &&
      !uuidPattern.test(sourceReferenceId)) ||
    !questionCategory ||
    !sourceCategory ||
    !action ||
    !policyCategory ||
    !confidence ||
    !sensitivity ||
    !reviewState ||
    !reusePolicy ||
    typeof value.save_intent_required !== "boolean"
  ) {
    return null;
  }
  return {
    fieldId: value.field_id,
    canonicalKey: canonicalKey as CanonicalFieldKey | null,
    questionCategory,
    proposedAnswer,
    sourceCategory,
    sourceReferenceId,
    action,
    policyCategory,
    confidence,
    sensitivity,
    reviewState,
    reusePolicy,
    saveIntentRequired: value.save_intent_required,
  };
}

function parseAnswerResolution(value: unknown): AnswerResolution | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "decisions",
      "selected_resume_version_id",
      "semantic_classifier_used",
    ]) ||
    !Array.isArray(value.decisions) ||
    value.decisions.length > 200 ||
    typeof value.semantic_classifier_used !== "boolean"
  ) {
    return null;
  }
  const selectedResumeVersionId = nullableString(
    value.selected_resume_version_id,
  );
  if (
    selectedResumeVersionId === undefined ||
    (typeof selectedResumeVersionId === "string" &&
      !uuidPattern.test(selectedResumeVersionId))
  ) {
    return null;
  }
  const decisions = value.decisions.map(parseDecision);
  if (decisions.some((decision) => decision === null)) return null;
  return {
    decisions: decisions as AnswerDecision[],
    selectedResumeVersionId,
    semanticClassifierUsed: value.semantic_classifier_used,
  };
}
