"use client";

import { useI18n } from "@/lib/i18n";
import type { SponsorshipStatement } from "@/lib/types";

/** The posting's own visa sponsorship statement; never an inference. */
function SponsorshipChip({ statement }: { statement: SponsorshipStatement }) {
  const { t } = useI18n();
  return (
    <span
      title={statement.quote}
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        statement.status === "OFFERED"
          ? "bg-status-offer-bg text-status-offer-ink"
          : "bg-status-rejected-bg text-status-rejected-ink"
      }`}
    >
      {statement.status === "OFFERED"
        ? t("sponsorship.offered")
        : t("sponsorship.notOffered")}
    </span>
  );
}

function SponsorshipQuote({ statement }: { statement: SponsorshipStatement }) {
  const { t } = useI18n();
  return (
    <section
      className={`rounded-lg border p-3 ${
        statement.status === "OFFERED"
          ? "border-evidence-strong-border bg-evidence-strong-bg"
          : "border-evidence-gap-border bg-evidence-gap-bg"
      }`}
    >
      <p className="text-sm font-semibold text-ink">
        {statement.status === "OFFERED"
          ? t("sponsorship.offered")
          : t("sponsorship.notOffered")}
      </p>
      <blockquote className="mt-1 border-l-2 border-border-strong pl-2 text-sm italic text-ink-2">
        {statement.quote}
      </blockquote>
      <p className="mt-1 text-xs text-ink-3">{t("sponsorship.source")}</p>
    </section>
  );
}

export { SponsorshipChip, SponsorshipQuote };
