import type {
  AnswerAction,
  ClipJobRequestData,
  ReusableAnswerInput,
  AnswerFieldInput,
  AnswerResolutionRequestData,
  ConfirmedApplicationAnswer,
  ContentRequest,
  FillPlanField,
  PopupRequest,
  PrepareApplicationRequestData,
  RecordApplicationRequestData,
} from "./types";

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

function parseTabBoundRequest<T extends string>(
  value: unknown,
  expectedType: T,
): { type: T; expectedTabId?: number; expectedPageUrl?: string } | null {
  if (!isRecord(value) || value.type !== expectedType) return null;
  const keys = Object.keys(value);
  if (keys.length === 1) return { type: expectedType };
  if (
    keys.length === 3 &&
    hasExactKeys(value, ["type", "expectedTabId", "expectedPageUrl"]) &&
    typeof value.expectedTabId === "number" &&
    Number.isInteger(value.expectedTabId) &&
    value.expectedTabId > 0 &&
    isExpectedPageUrl(value.expectedPageUrl)
  ) {
    return {
      type: expectedType,
      expectedTabId: value.expectedTabId as number,
      expectedPageUrl: value.expectedPageUrl as string,
    };
  }
  return null;
}

export function parsePopupRequest(value: unknown): PopupRequest | null {
  if (isExactMessage(value, "CAREEROS_GET_AUTH_STATUS")) {
    return { type: "CAREEROS_GET_AUTH_STATUS" };
  }
  const detect = parseTabBoundRequest(value, "CAREEROS_DETECT_ACTIVE_PAGE");
  if (detect) return detect;
  if (isExactMessage(value, "CAREEROS_GET_TAB_CONTEXT")) {
    return { type: "CAREEROS_GET_TAB_CONTEXT" };
  }
  const context = parseTabBoundRequest(
    value,
    "CAREEROS_GET_APPLICATION_CONTEXT",
  );
  if (context) return context;
  if (isAnswerResolutionRequest(value)) return value;
  if (isPopupFillPlanRequest(value)) return value;
  if (isPrepareApplicationRequest(value)) return value;
  if (isRecordApplicationRequest(value)) return value;
  const assistant = parseTabBoundRequest(value, "CAREEROS_ACTIVATE_ASSISTANT");
  if (assistant) return assistant;
  const extract = parseTabBoundRequest(value, "CAREEROS_EXTRACT_JOB");
  if (extract) return extract;
  if (isClipJobRequest(value)) return value;
  const readAnswers = parseTabBoundRequest(
    value,
    "CAREEROS_READ_CUSTOM_ANSWERS",
  );
  if (readAnswers) return readAnswers;
  if (isSaveReusableAnswersRequest(value)) return value;
  if (isPopupAttachResumeRequest(value)) return value;
  if (isExactMessage(value, "CAREEROS_OPEN_SIGN_IN")) {
    return { type: "CAREEROS_OPEN_SIGN_IN" };
  }
  if (isOpenApplicationRequest(value)) return value;
  if (isOpenJobRequest(value)) return value;
  return null;
}

export function parseContentRequest(value: unknown): ContentRequest | null {
  if (isExactMessage(value, "CAREEROS_INSPECT_PAGE")) {
    return { type: "CAREEROS_INSPECT_PAGE" };
  }
  if (isExactMessage(value, "CAREEROS_EXTRACT_JOB")) {
    return { type: "CAREEROS_EXTRACT_JOB" };
  }
  if (isExactMessage(value, "CAREEROS_READ_CUSTOM_ANSWERS")) {
    return { type: "CAREEROS_READ_CUSTOM_ANSWERS" };
  }
  if (isExactMessage(value, "CAREEROS_ACTIVATE_ASSISTANT")) {
    return { type: "CAREEROS_ACTIVATE_ASSISTANT" };
  }
  if (isExactMessage(value, "CAREEROS_DEACTIVATE_ASSISTANT")) {
    return { type: "CAREEROS_DEACTIVATE_ASSISTANT" };
  }
  if (isContentFillPlanRequest(value)) return value;
  if (isContentAttachResumeRequest(value)) return value;
  return null;
}

const canonicalKeys = new Set<string>([
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

function isExpectedPageUrl(value: unknown): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= 2_048;
}

function hasRequiredExpectedPageUrl(value: Record<string, unknown>): boolean {
  return isExpectedPageUrl(value.expectedPageUrl);
}

function hasOptionalExpectedTabId(value: Record<string, unknown>): boolean {
  return (
    !Object.hasOwn(value, "expectedTabId") ||
    (typeof value.expectedTabId === "number" &&
      Number.isInteger(value.expectedTabId) &&
      value.expectedTabId > 0)
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
  if (
    !hasExactKeys(value, [
      "type",
      "fields",
      "selectedResumeVersionId",
      "market",
      "formLocale",
    ])
  ) {
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
    ) ||
    !["UNKNOWN", "NORTH_AMERICA", "CHINA"].includes(String(value.market)) ||
    !(
      value.formLocale === null ||
      (typeof value.formLocale === "string" && value.formLocale.length <= 35)
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
    // A custom question (null canonical key) may only be filled from a saved
    // reusable answer; radio groups are allowed only for that case.
    const blocked =
      value.canonicalKey === null
        ? ["CHECKBOX", "FILE", "UNSUPPORTED"]
        : ["CHECKBOX", "RADIO_GROUP", "FILE", "UNSUPPORTED"];
    return (
      !blocked.includes(value.controlType as string) &&
      typeof value.proposedAnswer === "string" &&
      value.proposedAnswer.length > 0 &&
      value.proposedAnswer.length <= 2_000
    );
  }
  return value.proposedAnswer === null;
}

function isPopupFillPlanRequest(value: unknown): value is {
  type: "CAREEROS_APPLY_FILL_PLAN";
  fields: FillPlanField[];
  expectedPageUrl: string;
  expectedTabId?: number;
} {
  if (!isRecord(value) || value.type !== "CAREEROS_APPLY_FILL_PLAN") {
    return false;
  }
  const allowedKeysets = [
    ["type", "fields", "expectedPageUrl"],
    ["type", "fields", "expectedPageUrl", "expectedTabId"],
  ];
  const keys = Object.keys(value);
  if (
    !allowedKeysets.some(
      (keySet) => keys.length === keySet.length && hasExactKeys(value, keySet),
    ) ||
    !Array.isArray(value.fields) ||
    value.fields.length === 0 ||
    value.fields.length > 200 ||
    !value.fields.every(isFillPlanField) ||
    !hasRequiredExpectedPageUrl(value) ||
    !hasOptionalExpectedTabId(value)
  ) {
    return false;
  }
  const ids = value.fields.map((field) => field.fieldId);
  return ids.length === new Set(ids).size;
}

function isContentFillPlanRequest(value: unknown): value is {
  type: "CAREEROS_APPLY_FILL_PLAN";
  fields: FillPlanField[];
  expectedPageUrl: string;
} {
  if (!isRecord(value) || value.type !== "CAREEROS_APPLY_FILL_PLAN") {
    return false;
  }
  if (
    !hasExactKeys(value, ["type", "fields", "expectedPageUrl"]) ||
    !Array.isArray(value.fields) ||
    value.fields.length === 0 ||
    value.fields.length > 200 ||
    !value.fields.every(isFillPlanField) ||
    !hasRequiredExpectedPageUrl(value)
  ) {
    return false;
  }
  const ids = value.fields.map((field) => field.fieldId);
  return ids.length === new Set(ids).size;
}

const applicationAnswerSources = new Set([
  "IDENTITY",
  "CAREER_BRAIN",
  "USER_CONTACT_INFO",
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
  if (!isRecord(value) || value.type !== "CAREEROS_RECORD_APPLICATION") {
    return false;
  }
  const allowedKeysets = [
    [
      "type",
      "applicationId",
      "company",
      "role",
      "resumeVersionId",
      "idempotencyKey",
      "answers",
      "expectedPageUrl",
    ],
    [
      "type",
      "applicationId",
      "company",
      "role",
      "resumeVersionId",
      "idempotencyKey",
      "answers",
      "expectedPageUrl",
      "expectedTabId",
    ],
  ];
  const keys = Object.keys(value);
  if (
    !allowedKeysets.some(
      (keySet) => keys.length === keySet.length && hasExactKeys(value, keySet),
    ) ||
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
    !value.answers.every(isConfirmedApplicationAnswer) ||
    !hasRequiredExpectedPageUrl(value) ||
    !hasOptionalExpectedTabId(value)
  ) {
    return false;
  }
  return true;
}

function isOpenApplicationRequest(value: unknown): value is {
  type: "CAREEROS_OPEN_APPLICATION";
  applicationId: string;
} {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["type", "applicationId"]) ||
    value.type !== "CAREEROS_OPEN_APPLICATION" ||
    typeof value.applicationId !== "string" ||
    !uuidPattern.test(value.applicationId)
  ) {
    return false;
  }
  return true;
}

function isPrepareApplicationRequest(value: unknown): value is {
  type: "CAREEROS_PREPARE_APPLICATION";
} & PrepareApplicationRequestData {
  if (!isRecord(value) || value.type !== "CAREEROS_PREPARE_APPLICATION") {
    return false;
  }
  const allowedKeysets = [
    [
      "type",
      "company",
      "role",
      "resumeVersionId",
      "idempotencyKey",
      "expectedPageUrl",
    ],
    [
      "type",
      "company",
      "role",
      "resumeVersionId",
      "idempotencyKey",
      "expectedPageUrl",
      "expectedTabId",
    ],
  ];
  const keys = Object.keys(value);
  if (
    !allowedKeysets.some(
      (keySet) => keys.length === keySet.length && hasExactKeys(value, keySet),
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
    !hasRequiredExpectedPageUrl(value) ||
    !hasOptionalExpectedTabId(value)
  ) {
    return false;
  }
  return true;
}

const jobMarkets = new Set(["UNKNOWN", "NORTH_AMERICA", "CHINA"]);
const jobCountries = new Set(["UNKNOWN", "US", "CA", "CN"]);
const workplaceTypes = new Set(["UNKNOWN", "REMOTE", "HYBRID", "ONSITE"]);
const employmentTypes = new Set([
  "UNKNOWN",
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "INTERNSHIP",
]);

function isBoundedText(value: unknown, min: number, max: number): boolean {
  return (
    typeof value === "string" &&
    value.trim().length >= min &&
    value.length <= max
  );
}

function isClipJobRequest(value: unknown): value is {
  type: "CAREEROS_CLIP_JOB";
} & ClipJobRequestData {
  if (!isRecord(value) || value.type !== "CAREEROS_CLIP_JOB") return false;
  const base = [
    "type",
    "title",
    "company",
    "location",
    "description",
    "market",
    "countryCode",
    "workplaceType",
    "employmentType",
    "expectedPageUrl",
  ];
  const keys = Object.keys(value);
  const keySetOk = [base, [...base, "expectedTabId"]].some(
    (keySet) => keys.length === keySet.length && hasExactKeys(value, keySet),
  );
  return (
    keySetOk &&
    isBoundedText(value.title, 1, 500) &&
    isBoundedText(value.company, 1, 500) &&
    (value.location === null || isBoundedText(value.location, 0, 500)) &&
    isBoundedText(value.description, 20, 100_000) &&
    typeof value.market === "string" &&
    jobMarkets.has(value.market) &&
    typeof value.countryCode === "string" &&
    jobCountries.has(value.countryCode) &&
    typeof value.workplaceType === "string" &&
    workplaceTypes.has(value.workplaceType) &&
    typeof value.employmentType === "string" &&
    employmentTypes.has(value.employmentType) &&
    hasRequiredExpectedPageUrl(value) &&
    hasOptionalExpectedTabId(value)
  );
}

function isOpenJobRequest(value: unknown): value is {
  type: "CAREEROS_OPEN_JOB";
  jobId: string;
} {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["type", "jobId"]) &&
    value.type === "CAREEROS_OPEN_JOB" &&
    typeof value.jobId === "string" &&
    uuidPattern.test(value.jobId)
  );
}

function isSaveReusableAnswersRequest(value: unknown): value is {
  type: "CAREEROS_SAVE_REUSABLE_ANSWERS";
  answers: ReusableAnswerInput[];
} {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["type", "answers"]) &&
    value.type === "CAREEROS_SAVE_REUSABLE_ANSWERS" &&
    Array.isArray(value.answers) &&
    value.answers.length > 0 &&
    value.answers.length <= 50 &&
    value.answers.every(
      (answer) =>
        isRecord(answer) &&
        hasExactKeys(answer, ["question", "answer"]) &&
        isBoundedText(answer.question, 1, 500) &&
        isBoundedText(answer.answer, 1, 2000),
    )
  );
}

function isPopupAttachResumeRequest(value: unknown): value is {
  type: "CAREEROS_ATTACH_RESUME";
  fieldId: string;
  resumeVersionId: string;
  expectedPageUrl: string;
  expectedTabId?: number;
} {
  if (!isRecord(value) || value.type !== "CAREEROS_ATTACH_RESUME") return false;
  const base = ["type", "fieldId", "resumeVersionId", "expectedPageUrl"];
  const keys = Object.keys(value);
  return (
    [base, [...base, "expectedTabId"]].some(
      (keySet) => keys.length === keySet.length && hasExactKeys(value, keySet),
    ) &&
    isBoundedText(value.fieldId, 1, 200) &&
    typeof value.resumeVersionId === "string" &&
    uuidPattern.test(value.resumeVersionId) &&
    hasRequiredExpectedPageUrl(value) &&
    hasOptionalExpectedTabId(value)
  );
}

// 10 MB resume limit on the API, base64-encoded.
const MAX_RESUME_BASE64 = Math.ceil((10 * 1024 * 1024 * 4) / 3) + 4;

function isContentAttachResumeRequest(value: unknown): value is {
  type: "CAREEROS_ATTACH_RESUME";
  fieldId: string;
  expectedPageUrl: string;
  fileName: string;
  contentType: string;
  base64: string;
} {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "type",
      "fieldId",
      "expectedPageUrl",
      "fileName",
      "contentType",
      "base64",
    ]) &&
    value.type === "CAREEROS_ATTACH_RESUME" &&
    isBoundedText(value.fieldId, 1, 200) &&
    isExpectedPageUrl(value.expectedPageUrl) &&
    isBoundedText(value.fileName, 1, 500) &&
    isBoundedText(value.contentType, 1, 100) &&
    typeof value.base64 === "string" &&
    value.base64.length > 0 &&
    value.base64.length <= MAX_RESUME_BASE64 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(value.base64)
  );
}
