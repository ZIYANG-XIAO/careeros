"use client";

import { useI18n } from "@/lib/i18n";
import { evidenceText } from "@/lib/evidence-text";
import type { CitedEvidence, CitedRequirement } from "@/lib/types";

/** Where a generated line comes from: requirements served, evidence cited. */
function Citations({
  requirements = [],
  evidence,
}: {
  requirements?: CitedRequirement[];
  evidence: CitedEvidence[];
}) {
  const { t } = useI18n();
  return (
    <div className="mt-2 space-y-1.5 text-xs">
      {requirements.length > 0 && (
        <p className="text-ink-3">
          <span className="font-semibold text-ink-2">
            {t("materials.forRequirement")}
          </span>{" "}
          {requirements.map((item) => item.description).join(" · ")}
        </p>
      )}
      {evidence.length > 0 && (
        <div>
          <p className="font-semibold text-ink-2">
            {t("materials.citedEvidence")}
          </p>
          <ul className="mt-1 space-y-1">
            {evidence.map((item) => (
              <li
                key={item.revision_id}
                className="rounded-md border-l-2 border-evidence-strong-border bg-evidence-strong-bg px-2 py-1 text-ink-2"
              >
                {evidenceText(item.content)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export { Citations };
