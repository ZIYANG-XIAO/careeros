export type DetectionStatus =
  "APPLICATION_PAGE" | "NOT_APPLICATION_PAGE" | "UNSUPPORTED_PAGE";

export type FormAdapterId =
  "generic" | "greenhouse" | "lever" | "ashby" | "workday";

export type CanonicalFieldKey =
  | "PERSON_FIRST_NAME"
  | "PERSON_LAST_NAME"
  | "PERSON_FULL_NAME"
  | "PERSON_NATIVE_GIVEN_NAME"
  | "PERSON_NATIVE_FAMILY_NAME"
  | "PERSON_NATIVE_FULL_NAME"
  | "PERSON_LATIN_FULL_NAME"
  | "CONTACT_EMAIL"
  | "CONTACT_PHONE"
  | "CONTACT_WECHAT"
  | "ADDRESS_LINE_1"
  | "ADDRESS_LINE_2"
  | "ADDRESS_CITY"
  | "ADDRESS_DISTRICT"
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
  formLocale?: string | null;
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
  | "USER_CONTACT_INFO"
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
  market: "UNKNOWN" | "NORTH_AMERICA" | "CHINA";
  formLocale: string | null;
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
  market?: "UNKNOWN" | "NORTH_AMERICA" | "CHINA";
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
    | "IDENTITY"
    | "CAREER_BRAIN"
    | "USER_CONTACT_INFO"
    | "RESUME_VERSION"
    | "USER_PROVIDED";
}

export interface RecordApplicationRequestData {
  applicationId: string | null;
  company: string;
  role: string;
  resumeVersionId: string | null;
  idempotencyKey: string;
  answers: ConfirmedApplicationAnswer[];
  expectedPageUrl?: string;
  expectedTabId?: number;
}

export interface PrepareApplicationRequestData {
  company: string;
  role: string;
  resumeVersionId: string | null;
  idempotencyKey: string;
  expectedPageUrl?: string;
  expectedTabId?: number;
}

export type JobDraftMarket = "UNKNOWN" | "NORTH_AMERICA" | "CHINA";
export type JobDraftCountry = "UNKNOWN" | "US" | "CA" | "CN";
export type JobDraftWorkplaceType = "UNKNOWN" | "REMOTE" | "HYBRID" | "ONSITE";
export type JobDraftEmploymentType =
  "UNKNOWN" | "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";

/** An editable, not-yet-saved job captured from the active page. */
export interface JobDraft {
  pageUrl: string;
  extraction: "STRUCTURED_DATA" | "PAGE_TEXT";
  title: string;
  company: string;
  location: string | null;
  description: string;
  market: JobDraftMarket;
  countryCode: JobDraftCountry;
  workplaceType: JobDraftWorkplaceType;
  employmentType: JobDraftEmploymentType;
}

export interface ClipJobRequestData {
  title: string;
  company: string;
  location: string | null;
  description: string;
  market: JobDraftMarket;
  countryCode: JobDraftCountry;
  workplaceType: JobDraftWorkplaceType;
  employmentType: JobDraftEmploymentType;
  expectedPageUrl: string;
  expectedTabId?: number;
}

export interface ClippedJob {
  jobId: string;
  created: boolean;
}

/** A value the user typed into a custom question on the active page. */
export interface TypedCustomAnswer {
  fieldId: string;
  question: string;
  answer: string;
}

export interface ReusableAnswerInput {
  question: string;
  answer: string;
}

export interface SavedReusableAnswers {
  saved: number;
  refused: number;
}

/** The exact owned resume file, carried from the background to one page. */
export interface ResumeFilePayload {
  fileName: string;
  contentType: string;
  base64: string;
}

export interface AttachResumeResult {
  fieldId: string;
  state: FillFieldState;
}

export type PopupRequest =
  | { type: "CAREEROS_GET_AUTH_STATUS" }
  | {
      type: "CAREEROS_DETECT_ACTIVE_PAGE";
      expectedTabId?: number;
      expectedPageUrl?: string;
    }
  | { type: "CAREEROS_GET_TAB_CONTEXT" }
  | {
      type: "CAREEROS_GET_APPLICATION_CONTEXT";
      expectedTabId?: number;
      expectedPageUrl?: string;
    }
  | ({ type: "CAREEROS_RESOLVE_ANSWERS" } & AnswerResolutionRequestData)
  | {
      type: "CAREEROS_APPLY_FILL_PLAN";
      fields: FillPlanField[];
      expectedPageUrl?: string;
      expectedTabId?: number;
    }
  | ({ type: "CAREEROS_PREPARE_APPLICATION" } & PrepareApplicationRequestData)
  | ({ type: "CAREEROS_RECORD_APPLICATION" } & RecordApplicationRequestData)
  | {
      type: "CAREEROS_ACTIVATE_ASSISTANT";
      expectedTabId?: number;
      expectedPageUrl?: string;
    }
  | {
      type: "CAREEROS_EXTRACT_JOB";
      expectedTabId?: number;
      expectedPageUrl?: string;
    }
  | ({ type: "CAREEROS_CLIP_JOB" } & ClipJobRequestData)
  | {
      type: "CAREEROS_READ_CUSTOM_ANSWERS";
      expectedTabId?: number;
      expectedPageUrl?: string;
    }
  | { type: "CAREEROS_SAVE_REUSABLE_ANSWERS"; answers: ReusableAnswerInput[] }
  | {
      type: "CAREEROS_ATTACH_RESUME";
      fieldId: string;
      resumeVersionId: string;
      expectedPageUrl: string;
      expectedTabId?: number;
    }
  | { type: "CAREEROS_OPEN_SIGN_IN" }
  | { type: "CAREEROS_OPEN_APPLICATION"; applicationId: string }
  | { type: "CAREEROS_OPEN_JOB"; jobId: string };

export interface TabContext {
  tabId: number;
  tabUrl: string;
}

export type ContentRequest =
  | { type: "CAREEROS_INSPECT_PAGE" }
  | {
      type: "CAREEROS_APPLY_FILL_PLAN";
      fields: FillPlanField[];
      expectedPageUrl: string;
    }
  | { type: "CAREEROS_EXTRACT_JOB" }
  | { type: "CAREEROS_READ_CUSTOM_ANSWERS" }
  | ({
      type: "CAREEROS_ATTACH_RESUME";
      fieldId: string;
      expectedPageUrl: string;
    } & ResumeFilePayload)
  | { type: "CAREEROS_ACTIVATE_ASSISTANT" }
  | { type: "CAREEROS_DEACTIVATE_ASSISTANT" };

export type ExtensionResponse<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error:
        "UNAUTHENTICATED" | "UNSUPPORTED_PAGE" | "UNAVAILABLE" | "STALE_PAGE";
    };
