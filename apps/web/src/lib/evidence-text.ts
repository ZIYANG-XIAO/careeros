const PREFERRED_FIELDS = [
  "content",
  "description",
  "name",
  "title",
  "company",
  "institution",
  "degree",
  "field_of_study",
];

/**
 * Evidence confirmed from a resume import is stored as canonical JSON of the
 * draft item; manual entries are plain text. Show either as readable text.
 */
export function evidenceText(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return content;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const parts = PREFERRED_FIELDS.map((field) => parsed[field]).filter(
      (value): value is string =>
        typeof value === "string" && value.trim() !== "",
    );
    return parts.length > 0 ? parts.join(" · ") : content;
  } catch {
    return content;
  }
}
