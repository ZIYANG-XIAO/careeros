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

export type PopupRequest =
  | { type: "CAREEROS_GET_AUTH_STATUS" }
  | { type: "CAREEROS_DETECT_ACTIVE_PAGE" };

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
  return null;
}

export function parseContentRequest(value: unknown): ContentRequest | null {
  return isExactMessage(value, "CAREEROS_INSPECT_PAGE")
    ? { type: "CAREEROS_INSPECT_PAGE" }
    : null;
}
