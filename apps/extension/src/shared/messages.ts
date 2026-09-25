export type DetectionStatus =
  "APPLICATION_PAGE" | "NOT_APPLICATION_PAGE" | "UNSUPPORTED_PAGE";

export type FormAdapterId = "generic" | "greenhouse" | "lever" | "ashby";

export type CanonicalFieldKey =
  | "PERSON_FIRST_NAME"
  | "PERSON_LAST_NAME"
  | "PERSON_FULL_NAME"
  | "CONTACT_EMAIL"
  | "CONTACT_PHONE"
  | "ADDRESS_LINE_1"
  | "ADDRESS_LINE_2"
  | "ADDRESS_CITY"
  | "ADDRESS_REGION"
  | "ADDRESS_POSTAL_CODE"
  | "ADDRESS_COUNTRY"
  | "PROFESSIONAL_LINKEDIN_URL"
  | "PROFESSIONAL_GITHUB_URL"
  | "PROFESSIONAL_PORTFOLIO_URL"
  | "EDUCATION_SCHOOL"
  | "EDUCATION_DEGREE"
  | "EDUCATION_FIELD_OF_STUDY"
  | "EXPERIENCE_COMPANY"
  | "EXPERIENCE_TITLE"
  | "RESUME_FILE"
  | "COVER_LETTER_FILE";

export type NormalizedControlType =
  | "TEXT"
  | "EMAIL"
  | "PHONE"
  | "URL"
  | "TEXTAREA"
  | "SELECT"
  | "RADIO_GROUP"
  | "CHECKBOX"
  | "FILE"
  | "DATE"
  | "NUMBER"
  | "UNSUPPORTED";

export type FieldSupport = "SUPPORTED" | "UNKNOWN" | "UNSUPPORTED";
export type FieldConfidence = "HIGH" | "MEDIUM" | "LOW";
export type FormSupport = "SUPPORTED" | "PARTIALLY_SUPPORTED" | "UNSUPPORTED";

export interface NormalizedFieldOption {
  id: string;
  label: string;
}

export interface NormalizedFormField {
  id: string;
  controlType: NormalizedControlType;
  question: string | null;
  required: boolean;
  canonicalKey: CanonicalFieldKey | null;
  support: FieldSupport;
  confidence: FieldConfidence;
  options: NormalizedFieldOption[];
}

export interface NormalizedApplicationForm {
  id: string;
  adapter: FormAdapterId;
  support: FormSupport;
  fields: NormalizedFormField[];
}

export interface PageDetection {
  status: DetectionStatus;
  adapter: FormAdapterId | null;
  reasons: string[];
  forms: NormalizedApplicationForm[];
}

export interface AuthStatus {
  authenticated: boolean;
}

export type AnswerAction = "FILL" | "SUGGEST" | "ASK" | "CONFIRM" | "UNKNOWN";
export type AnswerSourceCategory =
  | "IDENTITY"
  | "CAREER_BRAIN"
  | "RESUME_VERSION"
  | "APPLICATION_PREFERENCE"
  | "REUSABLE_CONFIRMED_ANSWER"
  | "APPLICATION_CONTEXT"
  | "UNKNOWN";
export type AnswerPolicyCategory =
  "STANDARD" | "SENSITIVE" | "CONSEQUENTIAL" | "UNSUPPORTED";
export type AnswerSensitivity = "NONE" | "SENSITIVE" | "CONSEQUENTIAL";
export type AnswerReviewState =
  | "NOT_REQUIRED"
  | "REVIEW_REQUIRED"
  | "USER_INPUT_REQUIRED"
  | "CONFIRMATION_REQUIRED"
  | "UNRESOLVED";
export type ReusePolicy =
  "NOT_APPLICABLE" | "ELIGIBLE_WITH_EXPLICIT_CONSENT" | "PROHIBITED";
export type QuestionCategory =
  | "STANDARD"
  | "UNKNOWN"
  | "DEMOGRAPHIC"
  | "DISABILITY"
  | "VETERAN"
  | "WORK_AUTHORIZATION"
  | "SPONSORSHIP"
  | "COMPENSATION"
  | "LEGAL_ATTESTATION"
  | "SIGNATURE"
  | "GOVERNMENT_ID";

export interface AnswerFieldInput {
  fieldId: string;
  canonicalKey: CanonicalFieldKey | null;
  question: string | null;
  controlType: NormalizedControlType;
  required: boolean;
  mappingConfidence: FieldConfidence;
  options: string[];
}

export interface AnswerResolutionRequestData {
  fields: AnswerFieldInput[];
  selectedResumeVersionId: string | null;
}

export interface AnswerDecision {
  fieldId: string;
  canonicalKey: CanonicalFieldKey | null;
  questionCategory: QuestionCategory;
  proposedAnswer: string | null;
  sourceCategory: AnswerSourceCategory;
  sourceReferenceId: string | null;
  action: AnswerAction;
  policyCategory: AnswerPolicyCategory;
  confidence: FieldConfidence;
  sensitivity: AnswerSensitivity;
  reviewState: AnswerReviewState;
  reusePolicy: ReusePolicy;
  saveIntentRequired: boolean;
}

export interface AnswerResolution {
  decisions: AnswerDecision[];
  selectedResumeVersionId: string | null;
  semanticClassifierUsed: boolean;
}

export type FillPlanField = {
  fieldId: string;
  canonicalKey: CanonicalFieldKey | null;
  controlType: NormalizedControlType;
  action: AnswerAction;
  proposedAnswer: string | null;
};

export type FillFieldState =
  | "FILLED"
  | "REVIEW_REQUIRED"
  | "INPUT_REQUIRED"
  | "UNRESOLVED"
  | "SKIPPED_EXISTING"
  | "FAILED";

export interface FillFieldResult {
  fieldId: string;
  state: FillFieldState;
}

export interface FillExecutionResult {
  fields: FillFieldResult[];
}

export type ApplicationStatus =
  | "PREPARING"
  | "APPLIED"
  | "ASSESSMENT"
  | "INTERVIEW"
  | "FINAL"
  | "REJECTED"
  | "OFFER"
  | "WITHDRAWN";

export interface TrackedApplication {
  id: string;
  company: string;
  role: string;
  applicationUrl: string | null;
  resumeVersionId: string | null;
  status: ApplicationStatus;
  origin: "CAREEROS_JOB" | "EXTERNAL_PAGE" | "MANUAL";
  createdAt: string;
}

export interface ResumeVersionOption {
  id: string;
  label: string;
}

export interface ApplicationPageContext {
  pageUrl: string;
  pageTitle: string;
  siteHost: string;
  matchKind: "EXACT_URL" | "RECENT_PREPARING" | "NONE";
  application: TrackedApplication | null;
  resumeVersions: ResumeVersionOption[];
}

export interface ConfirmedApplicationAnswer {
  canonicalKey: CanonicalFieldKey | null;
  questionText: string;
  answerText: string;
  sourceCategory:
    "IDENTITY" | "CAREER_BRAIN" | "RESUME_VERSION" | "USER_PROVIDED";
}

export interface RecordApplicationRequestData {
  applicationId: string | null;
  company: string;
  role: string;
  resumeVersionId: string | null;
  idempotencyKey: string;
  answers: ConfirmedApplicationAnswer[];
}

export type PopupRequest =
  | { type: "CAREEROS_GET_AUTH_STATUS" }
  | { type: "CAREEROS_DETECT_ACTIVE_PAGE" }
  | { type: "CAREEROS_GET_APPLICATION_CONTEXT" }
  | ({ type: "CAREEROS_RESOLVE_ANSWERS" } & AnswerResolutionRequestData)
  | { type: "CAREEROS_APPLY_FILL_PLAN"; fields: FillPlanField[] }
  | ({ type: "CAREEROS_RECORD_APPLICATION" } & RecordApplicationRequestData);

export type ContentRequest =
  | { type: "CAREEROS_INSPECT_PAGE" }
  | { type: "CAREEROS_APPLY_FILL_PLAN"; fields: FillPlanField[] };

export type ExtensionResponse<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: "UNAUTHENTICATED" | "UNSUPPORTED_PAGE" | "UNAVAILABLE";
    };

function isExactMessage(
  value: unknown,
  expectedType: PopupRequest["type"] | ContentRequest["type"],
): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 1 && record.type === expectedType;
}

export function parsePopupRequest(value: unknown): PopupRequest | null {
  if (isExactMessage(value, "CAREEROS_GET_AUTH_STATUS")) {
    return { type: "CAREEROS_GET_AUTH_STATUS" };
  }
  if (isExactMessage(value, "CAREEROS_DETECT_ACTIVE_PAGE")) {
    return { type: "CAREEROS_DETECT_ACTIVE_PAGE" };
  }
  if (isExactMessage(value, "CAREEROS_GET_APPLICATION_CONTEXT")) {
    return { type: "CAREEROS_GET_APPLICATION_CONTEXT" };
  }
  if (isAnswerResolutionRequest(value)) return value;
  if (isFillPlanRequest(value)) return value;
  if (isRecordApplicationRequest(value)) return value;
  return null;
}

export function parseContentRequest(value: unknown): ContentRequest | null {
  if (isExactMessage(value, "CAREEROS_INSPECT_PAGE")) {
    return { type: "CAREEROS_INSPECT_PAGE" };
  }
  if (isFillPlanRequest(value)) return value;
  return null;
}

const canonicalKeys = new Set<string>([
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
]);
const controlTypes = new Set<string>([
  "TEXT",
  "EMAIL",
  "PHONE",
  "URL",
  "TEXTAREA",
  "SELECT",
  "RADIO_GROUP",
  "CHECKBOX",
  "FILE",
  "DATE",
  "NUMBER",
  "UNSUPPORTED",
]);
const confidences = new Set<string>(["HIGH", "MEDIUM", "LOW"]);
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

function isNullableBoundedString(value: unknown, maxLength: number): boolean {
  return (
    value === null || (typeof value === "string" && value.length <= maxLength)
  );
}

function isAnswerFieldInput(value: unknown): value is AnswerFieldInput {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(value, [
      "fieldId",
      "canonicalKey",
      "question",
      "controlType",
      "required",
      "mappingConfidence",
      "options",
    ])
  ) {
    return false;
  }
  return (
    typeof value.fieldId === "string" &&
    value.fieldId.length > 0 &&
    value.fieldId.length <= 200 &&
    (value.canonicalKey === null ||
      (typeof value.canonicalKey === "string" &&
        canonicalKeys.has(value.canonicalKey))) &&
    isNullableBoundedString(value.question, 500) &&
    typeof value.controlType === "string" &&
    controlTypes.has(value.controlType) &&
    typeof value.required === "boolean" &&
    typeof value.mappingConfidence === "string" &&
    confidences.has(value.mappingConfidence) &&
    Array.isArray(value.options) &&
    value.options.length <= 100 &&
    value.options.every(
      (option) =>
        typeof option === "string" && option.length > 0 && option.length <= 500,
    )
  );
}

function isAnswerResolutionRequest(
  value: unknown,
): value is { type: "CAREEROS_RESOLVE_ANSWERS" } & AnswerResolutionRequestData {
  if (!isRecord(value)) return false;
  if (!hasExactKeys(value, ["type", "fields", "selectedResumeVersionId"])) {
    return false;
  }
  if (
    value.type !== "CAREEROS_RESOLVE_ANSWERS" ||
    !Array.isArray(value.fields) ||
    value.fields.length === 0 ||
    value.fields.length > 200 ||
    !value.fields.every(isAnswerFieldInput) ||
    !(
      value.selectedResumeVersionId === null ||
      (typeof value.selectedResumeVersionId === "string" &&
        uuidPattern.test(value.selectedResumeVersionId))
    )
  ) {
    return false;
  }
  const ids = value.fields.map((field) => field.fieldId);
  return ids.length === new Set(ids).size;
}

function isFillPlanField(value: unknown): value is FillPlanField {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(value, [
      "fieldId",
      "canonicalKey",
      "controlType",
      "action",
      "proposedAnswer",
    ])
  ) {
    return false;
  }
  if (
    typeof value.fieldId !== "string" ||
    value.fieldId.length === 0 ||
    value.fieldId.length > 200 ||
    !(
      value.canonicalKey === null ||
      (typeof value.canonicalKey === "string" &&
        canonicalKeys.has(value.canonicalKey))
    ) ||
    typeof value.controlType !== "string" ||
    !controlTypes.has(value.controlType) ||
    typeof value.action !== "string" ||
    !new Set<AnswerAction>([
      "FILL",
      "SUGGEST",
      "ASK",
      "CONFIRM",
      "UNKNOWN",
    ]).has(value.action as AnswerAction)
  ) {
    return false;
  }
  if (value.action === "FILL") {
    return (
      value.canonicalKey !== null &&
      !["CHECKBOX", "RADIO_GROUP", "FILE", "UNSUPPORTED"].includes(
        value.controlType as string,
      ) &&
      typeof value.proposedAnswer === "string" &&
      value.proposedAnswer.length > 0 &&
      value.proposedAnswer.length <= 2_000
    );
  }
  return value.proposedAnswer === null;
}

function isFillPlanRequest(
  value: unknown,
): value is { type: "CAREEROS_APPLY_FILL_PLAN"; fields: FillPlanField[] } {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["type", "fields"]) ||
    value.type !== "CAREEROS_APPLY_FILL_PLAN" ||
    !Array.isArray(value.fields) ||
    value.fields.length === 0 ||
    value.fields.length > 200 ||
    !value.fields.every(isFillPlanField)
  ) {
    return false;
  }
  const ids = value.fields.map((field) => field.fieldId);
  return ids.length === new Set(ids).size;
}

const applicationAnswerSources = new Set([
  "IDENTITY",
  "CAREER_BRAIN",
  "RESUME_VERSION",
  "USER_PROVIDED",
]);

function isConfirmedApplicationAnswer(
  value: unknown,
): value is ConfirmedApplicationAnswer {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "canonicalKey",
      "questionText",
      "answerText",
      "sourceCategory",
    ])
  ) {
    return false;
  }
  return (
    (value.canonicalKey === null ||
      (typeof value.canonicalKey === "string" &&
        canonicalKeys.has(value.canonicalKey))) &&
    typeof value.questionText === "string" &&
    value.questionText.trim().length > 0 &&
    value.questionText.length <= 500 &&
    typeof value.answerText === "string" &&
    value.answerText.trim().length > 0 &&
    value.answerText.length <= 4_000 &&
    typeof value.sourceCategory === "string" &&
    applicationAnswerSources.has(value.sourceCategory)
  );
}

function isRecordApplicationRequest(value: unknown): value is {
  type: "CAREEROS_RECORD_APPLICATION";
} & RecordApplicationRequestData {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "type",
      "applicationId",
      "company",
      "role",
      "resumeVersionId",
      "idempotencyKey",
      "answers",
    ]) ||
    value.type !== "CAREEROS_RECORD_APPLICATION" ||
    !(
      value.applicationId === null ||
      (typeof value.applicationId === "string" &&
        uuidPattern.test(value.applicationId))
    ) ||
    typeof value.company !== "string" ||
    value.company.trim().length === 0 ||
    value.company.length > 500 ||
    typeof value.role !== "string" ||
    value.role.trim().length === 0 ||
    value.role.length > 500 ||
    !(
      value.resumeVersionId === null ||
      (typeof value.resumeVersionId === "string" &&
        uuidPattern.test(value.resumeVersionId))
    ) ||
    typeof value.idempotencyKey !== "string" ||
    !uuidPattern.test(value.idempotencyKey) ||
    !Array.isArray(value.answers) ||
    value.answers.length > 200 ||
    !value.answers.every(isConfirmedApplicationAnswer)
  ) {
    return false;
  }
  return true;
}
