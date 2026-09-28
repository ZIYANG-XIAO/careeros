import { t } from "../shared/i18n";

export function DetectionSection({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <section className="page-card" aria-live="polite">
      <span className="eyebrow">{t("CURRENT PAGE")}</span>
      <h2>{title}</h2>
      <p>{body}</p>
    </section>
  );
}
