import type {
  AnswerAction,
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
  if (isExactMessage(value, "CAREEROS_OPEN_SIGN_IN")) {
    return { type: "CAREEROS_OPEN_SIGN_IN" };
  }
  if (isOpenApplicationRequest(value)) return value;
  return null;
}

export function parseContentRequest(value: unknown): ContentRequest | null {
  if (isExactMessage(value, "CAREEROS_INSPECT_PAGE")) {
    return { type: "CAREEROS_INSPECT_PAGE" };
  }
  if (isExactMessage(value, "CAREEROS_ACTIVATE_ASSISTANT")) {
    return { type: "CAREEROS_ACTIVATE_ASSISTANT" };
  }
  if (isExactMessage(value, "CAREEROS_DEACTIVATE_ASSISTANT")) {
    return { type: "CAREEROS_DEACTIVATE_ASSISTANT" };
  }
  if (isContentFillPlanRequest(value)) return value;
  return null;
}

const canonicalKeys = new Set<string>([
  "PERSON_FIRST_NAME",
  "PERSON_LAST_NAME",
  "PERSON_FULL_NAME",
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
