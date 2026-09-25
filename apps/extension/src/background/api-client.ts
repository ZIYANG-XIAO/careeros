import type {
  AnswerAction,
  AnswerDecision,
  AnswerPolicyCategory,
  AnswerResolution,
  AnswerResolutionRequestData,
  AnswerReviewState,
  AnswerSensitivity,
  AnswerSourceCategory,
  ApplicationPageContext,
  AuthStatus,
  CanonicalFieldKey,
  FieldConfidence,
  QuestionCategory,
  RecordApplicationRequestData,
  ReusePolicy,
  ResumeVersionOption,
  TrackedApplication,
} from "../shared/messages";

interface TokenProvider {
  getToken(): Promise<string | null>;
}

export class CareerOsApiClient {
  constructor(
    private readonly apiUrl: string,
    private readonly tokenProvider: TokenProvider,
    private readonly request: typeof fetch = (...args) => fetch(...args),
  ) {}

  async getAuthStatus(): Promise<AuthStatus> {
    const token = await this.tokenProvider.getToken();
    if (!token) return { authenticated: false };

    const response = await this.request(`${this.apiUrl}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 401) return { authenticated: false };
    if (!response.ok)
      throw new Error(`CareerOS API returned ${response.status}`);

    // The identity payload proves that the backend resolved the authenticated
    // owner. It is intentionally not forwarded to the content script.
    await response.json();
    return { authenticated: true };
  }

  async resolveAnswers(
    input: AnswerResolutionRequestData,
  ): Promise<AnswerResolution | null> {
    const token = await this.tokenProvider.getToken();
    if (!token) return null;
    const response = await this.request(
      `${this.apiUrl}/answer-engine/resolve`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selected_resume_version_id: input.selectedResumeVersionId,
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
      },
    );
    if (response.status === 401) return null;
    if (!response.ok)
      throw new Error(`CareerOS API returned ${response.status}`);
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

  async getApplicationContext(
    pageUrl: string,
    pageTitle: string,
  ): Promise<ApplicationPageContext | null> {
    const token = await this.tokenProvider.getToken();
    if (!token) return null;
    const headers = { Authorization: `Bearer ${token}` };
    const [applicationResponse, resumeResponse] = await Promise.all([
      this.request(`${this.apiUrl}/applications`, { headers }),
      this.request(`${this.apiUrl}/resumes`, { headers }),
    ]);
    if (applicationResponse.status === 401 || resumeResponse.status === 401) {
      return null;
    }
    if (!applicationResponse.ok || !resumeResponse.ok) {
      throw new Error("CareerOS application context is unavailable");
    }
    const applications = parseApplicationList(await applicationResponse.json());
    const resumeVersions = parseResumeOptions(await resumeResponse.json());
    if (!applications || !resumeVersions) {
      throw new Error("CareerOS returned invalid application context");
    }
    const match = matchApplication(applications, pageUrl);
    return {
      pageUrl,
      pageTitle: pageTitle.slice(0, 500),
      siteHost: new URL(pageUrl).hostname.slice(0, 100),
      matchKind: match.kind,
      application: match.application,
      resumeVersions,
    };
  }

  async recordApplication(
    input: RecordApplicationRequestData,
    pageUrl: string,
  ): Promise<TrackedApplication | null> {
    const token = await this.tokenProvider.getToken();
    if (!token) return null;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const answers = input.answers.map((answer) => ({
      canonical_key: answer.canonicalKey,
      question_text: answer.questionText,
      answer_text: answer.answerText,
      source_category: answer.sourceCategory,
      policy_category: "STANDARD",
      sensitivity: "NONE",
      user_confirmed: true,
    }));
    const response = input.applicationId
      ? await this.request(
          `${this.apiUrl}/applications/${input.applicationId}/submission`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              idempotency_key: input.idempotencyKey,
              resume_version_id: input.resumeVersionId,
              answers,
            }),
          },
        )
      : await this.request(`${this.apiUrl}/applications`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            idempotency_key: input.idempotencyKey,
            origin: "EXTERNAL_PAGE",
            company: input.company.trim(),
            role: input.role.trim(),
            application_url: pageUrl,
            source: new URL(pageUrl).hostname.slice(0, 100),
            resume_version_id: input.resumeVersionId,
            status: "APPLIED",
            answers,
          }),
        });
    if (response.status === 401) return null;
    if (!response.ok) {
      throw new Error(`CareerOS API returned ${response.status}`);
    }
    const application = parseApplication(await response.json());
    if (!application)
      throw new Error("CareerOS returned an invalid Application");
    return application;
  }
}

const answerActions = ["FILL", "SUGGEST", "ASK", "CONFIRM", "UNKNOWN"] as const;
const sourceCategories = [
  "IDENTITY",
  "CAREER_BRAIN",
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
  "CONTACT_EMAIL",
  "CONTACT_PHONE",
  "ADDRESS_LINE_1",
  "ADDRESS_LINE_2",
  "ADDRESS_CITY",
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

const applicationStatuses = [
  "PREPARING",
  "APPLIED",
  "ASSESSMENT",
  "INTERVIEW",
  "FINAL",
  "REJECTED",
  "OFFER",
  "WITHDRAWN",
] as const;
const applicationOrigins = ["CAREEROS_JOB", "EXTERNAL_PAGE", "MANUAL"] as const;

function parseApplication(value: unknown): TrackedApplication | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !uuidPattern.test(value.id) ||
    typeof value.company !== "string" ||
    value.company.length === 0 ||
    value.company.length > 500 ||
    typeof value.role !== "string" ||
    value.role.length === 0 ||
    value.role.length > 500 ||
    !(
      value.application_url === null ||
      typeof value.application_url === "string"
    ) ||
    !(
      value.resume_version_id === null ||
      (typeof value.resume_version_id === "string" &&
        uuidPattern.test(value.resume_version_id))
    ) ||
    !enumValue(value.status, applicationStatuses) ||
    !enumValue(value.origin, applicationOrigins) ||
    typeof value.created_at !== "string"
  ) {
    return null;
  }
  return {
    id: value.id,
    company: value.company,
    role: value.role,
    applicationUrl: value.application_url,
    resumeVersionId: value.resume_version_id,
    status: enumValue(value.status, applicationStatuses)!,
    origin: enumValue(value.origin, applicationOrigins)!,
    createdAt: value.created_at,
  };
}

function parseApplicationList(value: unknown): TrackedApplication[] | null {
  if (!Array.isArray(value) || value.length > 10_000) return null;
  const applications = value.map(parseApplication);
  return applications.some((application) => application === null)
    ? null
    : (applications as TrackedApplication[]);
}

function parseResumeOptions(value: unknown): ResumeVersionOption[] | null {
  if (!Array.isArray(value) || value.length > 1_000) return null;
  const options: ResumeVersionOption[] = [];
  for (const resume of value) {
    if (
      !isRecord(resume) ||
      typeof resume.name !== "string" ||
      resume.name.length === 0 ||
      resume.name.length > 500 ||
      !Array.isArray(resume.versions) ||
      resume.versions.length > 1_000
    ) {
      return null;
    }
    for (const version of resume.versions) {
      if (
        !isRecord(version) ||
        typeof version.id !== "string" ||
        !uuidPattern.test(version.id) ||
        typeof version.version_number !== "number" ||
        !Number.isInteger(version.version_number) ||
        version.version_number < 1
      ) {
        return null;
      }
      options.push({
        id: version.id,
        label: `${resume.name} · Version ${version.version_number}`,
      });
    }
  }
  return options;
}

function normalizedApplicationUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.origin.toLowerCase()}${path}`;
  } catch {
    return null;
  }
}

export function matchApplication(
  applications: TrackedApplication[],
  pageUrl: string,
  now = Date.now(),
): {
  kind: ApplicationPageContext["matchKind"];
  application: TrackedApplication | null;
} {
  const normalizedPageUrl = normalizedApplicationUrl(pageUrl);
  const exact = applications.find(
    (application) =>
      application.applicationUrl !== null &&
      normalizedApplicationUrl(application.applicationUrl) ===
        normalizedPageUrl,
  );
  if (exact) return { kind: "EXACT_URL", application: exact };

  const recentPreparing = applications.filter((application) => {
    if (application.status !== "PREPARING") return false;
    const createdAt = Date.parse(application.createdAt);
    return (
      Number.isFinite(createdAt) &&
      now - createdAt >= 0 &&
      now - createdAt <= 6 * 60 * 60 * 1_000
    );
  });
  if (recentPreparing.length === 1) {
    return { kind: "RECENT_PREPARING", application: recentPreparing[0] };
  }
  return { kind: "NONE", application: null };
}
