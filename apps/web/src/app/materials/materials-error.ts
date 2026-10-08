import { getApiErrorMessage, toApiError } from "@/lib/api-error-message";
import type { MessageKey } from "@/lib/i18n";

const CODE_KEYS: Record<string, MessageKey> = {
  REQUIREMENTS_PENDING: "materials.error.requirementsPending",
  SENSITIVE_QUESTION: "materials.error.sensitive",
  DRAFT_NOT_GROUNDED: "materials.error.notGrounded",
  NO_CONFIRMED_EVIDENCE: "materials.error.noEvidence",
  QUESTION_REQUIRED: "materials.error.questionRequired",
  JOB_REQUIRED: "materials.error.jobRequired",
  EDIT_ANCHOR_MISSING: "materials.error.anchorMissing",
  MATERIALS_FAILED: "materials.error.failed",
};

/** A specific, actionable message for materials errors. */
export function materialsErrorMessage(
  error: unknown,
  t: (key: MessageKey) => string,
): string {
  const apiError = toApiError(error);
  if (apiError.code && CODE_KEYS[apiError.code]) {
    return t(CODE_KEYS[apiError.code]);
  }
  if (apiError.status === 503) return t("materials.error.unavailable");
  return getApiErrorMessage(apiError, t);
}
