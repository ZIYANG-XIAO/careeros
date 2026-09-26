export function DetectionSection({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <section className="page-card" aria-live="polite">
      <span className="eyebrow">CURRENT PAGE</span>
      <h2>{title}</h2>
      <p>{body}</p>
    </section>
  );
}
