"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getInterviewPrep } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { InterviewPrep } from "@/lib/types";

import { Citations } from "./evidence-list";
import { materialsErrorMessage } from "./materials-error";

function PrepTab({ jobId }: { jobId: string }) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [prep, setPrep] = useState<InterviewPrep | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      setPrep(await getInterviewPrep(token, jobId));
    } catch (caught) {
      setError(materialsErrorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-ink-2">
        {t("materials.prep.intro")}
      </p>
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button onClick={() => void generate()} loading={busy}>
          {prep ? t("materials.prep.regenerate") : t("materials.prep.generate")}
        </Button>
        {prep && (
          <Button variant="secondary" onClick={() => window.print()}>
            {t("packet.print")}
          </Button>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-evidence-gap-border bg-evidence-gap-bg p-3 text-sm text-[#6F3627]"
        >
          {error}
        </p>
      )}
      {prep && (
        <div className="space-y-5">
          {prep.dropped_count > 0 && (
            <p className="text-xs text-ink-3">
              {t("materials.tailor.dropped", { count: prep.dropped_count })}
            </p>
          )}
          <section>
            <h3 className="text-base font-semibold text-ink">
              {t("materials.prep.stories")}
            </h3>
            <p className="text-xs text-ink-3">
              {t("materials.prep.storiesHint")}
            </p>
            <ol className="mt-3 space-y-3">
              {prep.stories.map((story, index) => (
                <li
                  key={index}
                  className="break-inside-avoid rounded-xl border border-border bg-surface p-4"
                >
                  <p className="text-sm font-semibold text-ink">
                    {story.prompt}
                  </p>
                  <Citations
                    requirements={story.requirements}
                    evidence={story.evidence}
                  />
                </li>
              ))}
            </ol>
          </section>
          <section>
            <h3 className="text-base font-semibold text-ink">
              {t("materials.prep.questions")}
            </h3>
            <ul className="mt-3 space-y-2">
              {prep.questions.map((item, index) => (
                <li
                  key={index}
                  className="break-inside-avoid rounded-xl border border-border bg-surface p-3"
                >
                  <p className="text-sm text-ink">{item.question}</p>
                  <Citations
                    requirements={item.requirements}
                    evidence={item.evidence}
                  />
                </li>
              ))}
            </ul>
          </section>
          {prep.gaps.length > 0 && (
            <section>
              <h3 className="text-base font-semibold text-ink">
                {t("materials.prep.gaps")}
              </h3>
              <p className="text-xs text-ink-3">
                {t("materials.prep.gapsHint")}
              </p>
              <ul className="mt-3 space-y-2">
                {prep.gaps.map((gap) => (
                  <li
                    key={gap.requirement.id}
                    className="break-inside-avoid rounded-xl border border-evidence-weak-border bg-evidence-weak-bg p-3 text-sm"
                  >
                    <p className="font-semibold text-ink">
                      {gap.requirement.description}
                    </p>
                    <p className="mt-1 text-ink-2">{gap.honest_framing}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export { PrepTab };
