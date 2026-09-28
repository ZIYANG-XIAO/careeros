import type {
  AnswerResolution,
  FillPlanField,
  NormalizedControlType,
  PageDetection,
} from "../shared/messages";

const EXECUTABLE_CONTROL_TYPES = new Set<NormalizedControlType>([
  "TEXT",
  "EMAIL",
  "PHONE",
  "URL",
  "TEXTAREA",
  "SELECT",
  "DATE",
  "NUMBER",
]);

const REUSABLE_CONTROL_TYPES = new Set<NormalizedControlType>([
  "TEXT",
  "TEXTAREA",
  "SELECT",
  "RADIO_GROUP",
  "NUMBER",
]);

export function buildFillPlan(
  resolution: AnswerResolution,
  detection: PageDetection,
): FillPlanField[] | null {
  const inspectedFields = new Map(
    detection.forms
      .flatMap((form) => form.fields)
      .map((field) => [field.id, field] as const),
  );
  const fields: FillPlanField[] = [];
  for (const decision of resolution.decisions) {
    const inspected = inspectedFields.get(decision.fieldId);
    if (!inspected) return null;
    // Canonical fields fill from the Career Brain/contact profile. Custom
    // questions fill only from an answer the user explicitly saved for reuse.
    const fromSavedAnswer =
      inspected.canonicalKey === null &&
      decision.canonicalKey === null &&
      decision.sourceCategory === "REUSABLE_CONFIRMED_ANSWER" &&
      REUSABLE_CONTROL_TYPES.has(inspected.controlType);
    const fromCanonicalSource =
      inspected.canonicalKey !== null &&
      decision.canonicalKey === inspected.canonicalKey &&
      EXECUTABLE_CONTROL_TYPES.has(inspected.controlType);
    const safelyFillable =
      decision.action === "FILL" &&
      decision.proposedAnswer !== null &&
      (fromCanonicalSource || fromSavedAnswer);
    fields.push({
      fieldId: decision.fieldId,
      canonicalKey: inspected.canonicalKey,
      controlType: inspected.controlType,
      action:
        decision.action === "FILL" && !safelyFillable
          ? "SUGGEST"
          : decision.action,
      proposedAnswer: safelyFillable ? decision.proposedAnswer : null,
    });
  }
  return fields;
}

export function approvedFillCount(fields: FillPlanField[] | null): number {
  return fields?.filter((field) => field.action === "FILL").length ?? 0;
}
