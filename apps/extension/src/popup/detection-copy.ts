import type { PageDetection } from "../shared/messages";
import { t } from "../shared/i18n";

export function detectionCopy(detection: PageDetection): {
  title: string;
  body: string;
} {
  if (detection.status === "APPLICATION_PAGE") {
    const fields = detection.forms.flatMap((form) => form.fields);
    const recognized = fields.filter(
      (field) => field.support === "SUPPORTED",
    ).length;
    const needsReview = fields.length - recognized;
    if (recognized === 0) {
      return {
        title: t("Application form needs manual review"),
        body: t(
          "{count} fields were found, but none can be identified reliably yet. Nothing changes until you act.",
          { count: fields.length },
        ),
      };
    }
    return {
      title: t("Application form inspected"),
      body: t(
        needsReview > 0
          ? recognized === 1
            ? "Form inspection succeeded. {recognized} field recognized · {review} need manual review. Nothing changes until you act."
            : "Form inspection succeeded. {recognized} fields recognized · {review} need manual review. Nothing changes until you act."
          : recognized === 1
            ? "Form inspection succeeded. {recognized} field recognized. Nothing changes until you act."
            : "Form inspection succeeded. {recognized} fields recognized. Nothing changes until you act.",
        { recognized, review: needsReview },
      ),
    };
  }
  if (detection.status === "UNSUPPORTED_PAGE") {
    return {
      title: t("This page is not supported"),
      body: t("Open a normal web application page and try again."),
    };
  }
  return {
    title: t("No application detected"),
    body: t("CareerOS did not find a likely application form on this page."),
  };
}
