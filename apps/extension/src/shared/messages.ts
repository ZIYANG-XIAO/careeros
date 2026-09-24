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

export type PopupRequest =
  | { type: "CAREEROS_GET_AUTH_STATUS" }
  | { type: "CAREEROS_DETECT_ACTIVE_PAGE" }
  | ({ type: "CAREEROS_RESOLVE_ANSWERS" } & AnswerResolutionRequestData);

export type ContentRequest = { type: "CAREEROS_INSPECT_PAGE" };

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
  if (isAnswerResolutionRequest(value)) return value;
  return null;
}

export function parseContentRequest(value: unknown): ContentRequest | null {
  return isExactMessage(value, "CAREEROS_INSPECT_PAGE")
    ? { type: "CAREEROS_INSPECT_PAGE" }
    : null;
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
