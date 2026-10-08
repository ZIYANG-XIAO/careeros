"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createTailoredVersion, suggestTailoring } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type {
  ResumeSummary,
  TailoredVersion,
  TailoringResult,
} from "@/lib/types";

import { Citations } from "./evidence-list";
import { materialsErrorMessage } from "./materials-error";

type Draft = { accepted: boolean; text: string };

function TailorTab({
  jobId,
  resumes,
}: {
  jobId: string;
  resumes: ResumeSummary[];
}) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const versions = resumes.flatMap((resume) =>
    resume.versions
      .slice()
      .sort((a, b) => b.version_number - a.version_number)
      .map((version) => ({
        id: version.id,
        label: `${resume.name} · v${version.version_number}`,
        primary: resume.is_primary,
      })),
  );
  const [versionId, setVersionId] = useState(
    versions.find((item) => item.primary)?.id ?? versions[0]?.id ?? "",
  );
  const [result, setResult] = useState<TailoringResult | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<TailoredVersion | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const next = await suggestTailoring(token, jobId, versionId);
      setResult(next);
      setDrafts(
        next.suggestions.map((item) => ({
          accepted: false,
          text: item.suggested_text,
        })),
      );
    } catch (caught) {
      setError(materialsErrorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  }

  async function createVersion() {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const edits = result.suggestions.flatMap((suggestion, index) =>
        drafts[index]?.accepted && drafts[index].text.trim()
          ? [
              {
                kind: suggestion.kind,
                original_text: suggestion.original_text,
                insert_after: suggestion.insert_after,
                text: drafts[index].text.trim(),
              },
            ]
          : [],
      );
      setCreated(
        await createTailoredVersion(token, {
          base_resume_version_id: result.base_resume_version_id,
          job_id: jobId,
          edits,
        }),
      );
    } catch (caught) {
      setError(materialsErrorMessage(caught, t));
    } finally {
      setSaving(false);
    }
  }

  const acceptedCount = drafts.filter(
    (draft) => draft.accepted && draft.text.trim(),
  ).length;

  if (versions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-sm text-ink-3">
        {t("materials.tailor.noResume")}{" "}
        <Link href="/me/resumes?upload=1" className="font-semibold text-accent">
          {t("me.uploadResume")} →
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-ink-2">
        {t("materials.tailor.intro")}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[240px] flex-1 text-sm">
          <span className="mb-1 block font-medium text-ink-2">
            {t("materials.tailor.base")}
          </span>
          <select
            value={versionId}
            onChange={(event) => setVersionId(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink"
          >
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.label}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={() => void generate()} loading={busy}>
          {result
            ? t("materials.tailor.regenerate")
            : t("materials.tailor.generate")}
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-evidence-gap-border bg-evidence-gap-bg p-3 text-sm text-[#6F3627]"
        >
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-3">
          <p className="text-xs text-ink-3">
            {result.dropped_count > 0
              ? t("materials.tailor.dropped", { count: result.dropped_count })
              : t("materials.tailor.allChecked")}
          </p>
          {result.suggestions.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-ink-3">
              {t("materials.tailor.none")}
            </p>
          )}
          <ol className="space-y-3">
            {result.suggestions.map((suggestion, index) => {
              const draft = drafts[index];
              return (
                <li
                  key={`${suggestion.kind}-${index}`}
                  className={`rounded-xl border bg-surface p-4 ${
                    draft?.accepted
                      ? "border-accent-soft-border ring-2 ring-accent-focus-ring"
                      : "border-border"
                  }`}
                >
                  <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <input
                      type="checkbox"
                      checked={Boolean(draft?.accepted)}
                      onChange={(event) =>
                        setDrafts((current) =>
                          current.map((item, i) =>
                            i === index
                              ? { ...item, accepted: event.target.checked }
                              : item,
                          ),
                        )
                      }
                      className="h-4 w-4 accent-[var(--color-accent)]"
                    />
                    {suggestion.kind === "REWRITE"
                      ? t("materials.tailor.rewrite")
                      : t("materials.tailor.insert")}
                  </label>
                  {suggestion.kind === "REWRITE" ? (
                    <p className="mt-2 rounded-md bg-status-rejected-bg/60 px-2 py-1 text-sm text-ink-3 line-through">
                      {suggestion.original_text}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-ink-3">
                      {t("materials.tailor.after")}{" "}
                      <span className="text-ink-2">
                        “{suggestion.insert_after}”
                      </span>
                    </p>
                  )}
                  <label className="mt-2 block">
                    <span className="sr-only">
                      {t("materials.tailor.editLabel")}
                    </span>
                    <textarea
                      value={draft?.text ?? ""}
                      onChange={(event) =>
                        setDrafts((current) =>
                          current.map((item, i) =>
                            i === index
                              ? { ...item, text: event.target.value }
                              : item,
                          ),
                        )
                      }
                      rows={2}
                      className="w-full rounded-md border border-evidence-strong-border bg-evidence-strong-bg px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                    />
                  </label>
                  <p className="mt-1 text-xs text-ink-2">
                    {suggestion.rationale}
                  </p>
                  <Citations
                    requirements={suggestion.requirements}
                    evidence={suggestion.evidence}
                  />
                </li>
              );
            })}
          </ol>

          {result.suggestions.length > 0 && (
            <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/95 p-3 shadow-raised backdrop-blur">
              <p className="text-sm text-ink-2">
                {t("materials.tailor.selected", { count: acceptedCount })}
              </p>
              <Button
                onClick={() => void createVersion()}
                loading={saving}
                disabled={acceptedCount === 0}
              >
                {t("materials.tailor.create")}
              </Button>
            </div>
          )}
        </div>
      )}

      {created && (
        <div
          role="status"
          className="rounded-xl border border-evidence-strong-border bg-evidence-strong-bg p-4 text-sm"
        >
          <p className="font-semibold text-ink">
            {t("materials.tailor.created", {
              version: created.version_number,
              filename: created.original_filename,
            })}
          </p>
          <p className="mt-1 text-xs text-ink-2">
            {t("materials.tailor.createdHint")}
          </p>
          <Link
            href={`/me/resumes/${created.resume_id}`}
            className="mt-2 inline-flex font-semibold text-accent hover:underline"
          >
            {t("materials.tailor.openResume")} →
          </Link>
        </div>
      )}
    </div>
  );
}

export { TailorTab };
