"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createDraft, saveReusableAnswer } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { DraftKind, DraftResult } from "@/lib/types";

import { Citations } from "./evidence-list";
import { materialsErrorMessage } from "./materials-error";

function DraftsTab({ jobId }: { jobId: string }) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [kind, setKind] = useState<DraftKind>("COVER_LETTER");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<DraftResult | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const draft = await createDraft(token, {
        kind,
        job_id: jobId,
        question: kind === "OPEN_QUESTION" ? question : null,
      });
      setResult(draft);
      setText(draft.text);
    } catch (caught) {
      setError(materialsErrorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(t("materials.draft.copied"));
    } catch {
      setNotice(t("materials.draft.copyFailed"));
    }
  }

  async function saveAsAnswer() {
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      await saveReusableAnswer(token, {
        question_text: question,
        answer_text: text,
      });
      setNotice(t("materials.draft.saved"));
    } catch (caught) {
      setError(materialsErrorMessage(caught, t));
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-ink-2">
        {t("materials.draft.intro")}
      </p>
      <div
        role="radiogroup"
        aria-label={t("materials.draft.kind")}
        className="inline-flex rounded-lg border border-border p-0.5"
      >
        {(["COVER_LETTER", "OPEN_QUESTION"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={kind === option}
            onClick={() => setKind(option)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
              kind === option
                ? "bg-accent text-white"
                : "text-ink-2 hover:bg-sunken"
            }`}
          >
            {option === "COVER_LETTER"
              ? t("materials.draft.coverLetter")
              : t("materials.draft.openQuestion")}
          </button>
        ))}
      </div>
      {kind === "OPEN_QUESTION" && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-2">
            {t("materials.draft.question")}
          </span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={2}
            placeholder={t("materials.draft.questionPlaceholder")}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          />
        </label>
      )}
      <Button
        onClick={() => void generate()}
        loading={busy}
        disabled={kind === "OPEN_QUESTION" && !question.trim()}
      >
        {result
          ? t("materials.draft.regenerate")
          : t("materials.draft.generate")}
      </Button>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-evidence-gap-border bg-evidence-gap-bg p-3 text-sm text-[#6F3627]"
        >
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">
              {t("materials.draft.result")}
            </span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={kind === "COVER_LETTER" ? 14 : 6}
              className="mt-1 w-full rounded-lg border border-border bg-rail px-3 py-2 text-sm leading-6 text-ink focus:border-accent focus:outline-none"
            />
          </label>
          {result.unsupported_points.length > 0 && (
            <div className="rounded-lg border border-evidence-weak-border bg-evidence-weak-bg p-3 text-xs">
              <p className="font-semibold text-ink">
                {t("materials.draft.unsupported")}
              </p>
              <ul className="mt-1 list-inside list-disc text-ink-2">
                {result.unsupported_points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          )}
          <Citations evidence={result.evidence} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => void copy()}>
              {t("materials.draft.copy")}
            </Button>
            {kind === "OPEN_QUESTION" && question.trim() && (
              <Button variant="secondary" onClick={() => void saveAsAnswer()}>
                {t("materials.draft.saveAnswer")}
              </Button>
            )}
            {notice && (
              <span role="status" className="text-xs text-ink-3">
                {notice}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { DraftsTab };
