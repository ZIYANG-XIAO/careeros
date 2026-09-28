"use client";

import { useAuth } from "@clerk/nextjs";
import { type FormEvent, useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ApiError,
  listReusableAnswers,
  revokeReusableAnswer,
  saveReusableAnswer,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { ReusableAnswer } from "@/lib/types";
import { useDataFetch } from "@/lib/use-data-fetch";

/**
 * Answers the user explicitly saved for custom application questions. The
 * extension fills them only when a form asks the same question again.
 */
function SavedAnswersSection() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { t } = useI18n();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnswers = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Missing authentication token");
    return listReusableAnswers(token);
  }, [getToken]);

  const { data, setData, loadError, retry } = useDataFetch<ReusableAnswer[]>({
    enabled: isLoaded && Boolean(isSignedIn),
    resetKey: userId ?? undefined,
    initialData: [],
    fetch: fetchAnswers,
    deps: [getToken, isLoaded, isSignedIn],
  });

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      await saveReusableAnswer(token, {
        question_text: question,
        answer_text: answer,
      });
      // The server replaces any earlier answer to the same normalized
      // question, so reload rather than guessing which row it replaced.
      setData(await listReusableAnswers(token));
      setQuestion("");
      setAnswer("");
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.code === "SENSITIVE_QUESTION"
          ? t("savedAnswers.sensitive")
          : t("savedAnswers.saveError"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(answerId: string) {
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      await revokeReusableAnswer(token, answerId);
      setData((current) => current.filter((item) => item.id !== answerId));
    } catch {
      setError(t("savedAnswers.saveError"));
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">
          {t("savedAnswers.title")}
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          {t("savedAnswers.description")}
        </p>
      </div>

      {loadError ? (
        <p className="text-sm text-ink-2">
          {t("savedAnswers.loadError")}{" "}
          <button
            type="button"
            className="font-semibold text-accent"
            onClick={retry}
          >
            {t("errors.retry")}
          </button>
        </p>
      ) : data.length === 0 ? (
        <p className="text-sm text-ink-3">{t("savedAnswers.empty")}</p>
      ) : (
        <ul className="divide-y divide-row-divider">
          {data.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  {item.question_text}
                </p>
                <p className="mt-0.5 text-sm whitespace-pre-wrap text-ink-2">
                  {item.answer_text}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => void handleRevoke(item.id)}
                aria-label={t("savedAnswers.removeLabel", {
                  question: item.question_text,
                })}
              >
                {t("savedAnswers.remove")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={handleSave}
        className="space-y-3 border-t border-border pt-4"
      >
        <Input
          id="saved-answer-question"
          label={t("savedAnswers.question")}
          value={question}
          maxLength={500}
          required
          onChange={(event) => setQuestion(event.target.value)}
        />
        <Textarea
          id="saved-answer-answer"
          label={t("savedAnswers.answer")}
          value={answer}
          maxLength={2000}
          rows={3}
          required
          onChange={(event) => setAnswer(event.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-[#8A4530]">
            {error}
          </p>
        )}
        <Button
          type="submit"
          loading={busy}
          disabled={!question.trim() || !answer.trim()}
        >
          {t("savedAnswers.add")}
        </Button>
      </form>
    </section>
  );
}

export { SavedAnswersSection };
