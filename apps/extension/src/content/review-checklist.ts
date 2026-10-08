import type {
  ClippedJob,
  FillExecutionResult,
  FillFieldState,
  PageDetection,
} from "../shared/messages";

/** States that still need the user after a fill. */
const NEEDS_USER: ReadonlySet<FillFieldState> = new Set([
  "REVIEW_REQUIRED",
  "INPUT_REQUIRED",
  "UNRESOLVED",
  "FAILED",
]);

export interface ReviewItem {
  fieldId: string;
  question: string | null;
  required: boolean;
  state: FillFieldState;
  /** An open text question CareerOS may offer to draft from evidence. */
  draftable: boolean;
}

/**
 * The fields the user still has to handle after a fill, required first.
 * Draft help is offered only for free-text custom questions; canonical fields
 * (contact, sensitive, consequential) never get AI drafts.
 */
export function reviewItems(
  detection: PageDetection,
  result: FillExecutionResult,
): ReviewItem[] {
  const fields = new Map(
    detection.forms.flatMap((form) =>
      form.fields.map((field) => [field.id, field] as const),
    ),
  );
  return result.fields
    .filter((item) => NEEDS_USER.has(item.state))
    .map((item) => {
      const field = fields.get(item.fieldId);
      const question = field?.question?.trim() || null;
      return {
        fieldId: item.fieldId,
        question,
        required: field?.required ?? false,
        state: item.state,
        draftable: Boolean(
          field &&
          question &&
          field.canonicalKey === null &&
          (field.controlType === "TEXTAREA" || field.controlType === "TEXT"),
        ),
      };
    })
    .sort((a, b) => Number(b.required) - Number(a.required));
}

const HOUR_MS = 60 * 60 * 1000;

/** Hours since a sync last saw this catalog posting, or null if untracked. */
export function hoursSinceConfirmed(
  job: ClippedJob,
  now: Date = new Date(),
): number | null {
  if (!job.isCatalog || !job.lastObservedAt) return null;
  const seen = Date.parse(job.lastObservedAt);
  if (Number.isNaN(seen)) return null;
  return Math.max(0, Math.floor((now.getTime() - seen) / HOUR_MS));
}
