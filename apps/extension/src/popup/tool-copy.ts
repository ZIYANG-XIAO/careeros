import { t } from "../shared/i18n";
import type {
  AttachResumeResult,
  JobDraft,
  PageDetection,
  SavedReusableAnswers,
} from "../shared/messages";

// Framework-free copy and checks shared by the popup (React) and the in-page
// assistant (plain DOM), so both surfaces behave and read the same.

export function clipDraftProblem(draft: JobDraft): string | null {
  if (!draft.title.trim()) return t("Add the job title.");
  if (!draft.company.trim()) return t("Add the company.");
  if (draft.description.trim().length < 20) {
    return t("Add the job description (at least 20 characters).");
  }
  return null;
}

export function savedAnswersSummary(result: SavedReusableAnswers): string {
  const saved = t(
    result.saved === 1
      ? "Saved {count} answer for next time."
      : "Saved {count} answers for next time.",
    { count: result.saved },
  );
  return result.refused > 0
    ? `${saved} ${t(
        result.refused === 1
          ? "{count} sensitive question was not saved — CareerOS always asks you those."
          : "{count} sensitive questions were not saved — CareerOS always asks you those.",
        { count: result.refused },
      )}`
    : saved;
}

export function resumeUploadFieldId(detection: PageDetection): string | null {
  for (const form of detection.forms) {
    const field = form.fields.find(
      (candidate) =>
        candidate.canonicalKey === "RESUME_FILE" &&
        candidate.controlType === "FILE",
    );
    if (field) return field.id;
  }
  return null;
}

const ATTACH_RESULT_COPY: Record<AttachResumeResult["state"], string> = {
  FILLED: "Resume attached. Check it on the page before you submit.",
  SKIPPED_EXISTING: "A file is already chosen — CareerOS left it unchanged.",
  REVIEW_REQUIRED: "This upload field is disabled. Attach the file yourself.",
  INPUT_REQUIRED: "Attach the file yourself.",
  UNRESOLVED: "Attach the file yourself.",
  FAILED:
    "This site did not accept the file automatically. Attach it yourself.",
};

export function attachResultMessage(
  state: AttachResumeResult["state"],
): string {
  return t(ATTACH_RESULT_COPY[state]);
}
