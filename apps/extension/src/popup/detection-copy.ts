import type { PageDetection } from "../shared/messages";

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
        title: "Application form needs manual review",
        body: `${fields.length} fields were found, but none can be identified reliably yet. Autofill is not enabled.`,
      };
    }
    return {
      title: "Application form inspected",
      body: `${recognized} ${recognized === 1 ? "field" : "fields"} recognized${
        needsReview > 0 ? ` · ${needsReview} need manual review` : ""
      }. Autofill is not enabled yet.`,
    };
  }
  if (detection.status === "UNSUPPORTED_PAGE") {
    return {
      title: "This page is not supported",
      body: "Open a normal web application page and try again.",
    };
  }
  return {
    title: "No application detected",
    body: "CareerOS did not find a likely application form on this page.",
  };
}
