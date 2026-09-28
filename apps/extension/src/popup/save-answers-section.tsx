import { useState } from "react";

import type {
  ExtensionResponse,
  PopupRequest,
  SavedReusableAnswers,
  TabContext,
  TypedCustomAnswer,
} from "../shared/messages";
import { t } from "../shared/i18n";
import { savedAnswersSummary } from "./tool-copy";

type SaveState =
  | { state: "idle" }
  | { state: "reading" }
  | { state: "choosing"; answers: TypedCustomAnswer[]; selected: Set<string> }
  | { state: "saving"; answers: TypedCustomAnswer[]; selected: Set<string> }
  | { state: "done"; result: SavedReusableAnswers }
  | { state: "error"; message: string };

async function send<T>(request: PopupRequest): Promise<ExtensionResponse<T>> {
  return chrome.runtime.sendMessage(request) as Promise<ExtensionResponse<T>>;
}

/**
 * Lets the user pick which answers they typed into custom questions should be
 * remembered. Nothing is pre-selected: saving requires explicit intent.
 */
export function SaveAnswersSection({ tab }: { tab: TabContext | null }) {
  const [save, setSave] = useState<SaveState>({ state: "idle" });

  const read = async () => {
    if (!tab) return;
    setSave({ state: "reading" });
    try {
      const response = await send<TypedCustomAnswer[]>({
        type: "CAREEROS_READ_CUSTOM_ANSWERS",
        expectedTabId: tab.tabId,
        expectedPageUrl: tab.tabUrl,
      });
      if (!response.ok) {
        setSave({ state: "error", message: t("This page could not be read.") });
      } else if (response.data.length === 0) {
        setSave({
          state: "error",
          message: t("No answered custom questions found on this page yet."),
        });
      } else {
        setSave({
          state: "choosing",
          answers: response.data,
          selected: new Set(),
        });
      }
    } catch {
      setSave({ state: "error", message: t("This page could not be read.") });
    }
  };

  const persist = async (
    answers: TypedCustomAnswer[],
    selected: Set<string>,
  ) => {
    setSave({ state: "saving", answers, selected });
    try {
      const response = await send<SavedReusableAnswers>({
        type: "CAREEROS_SAVE_REUSABLE_ANSWERS",
        answers: answers
          .filter((answer) => selected.has(answer.fieldId))
          .map(({ question, answer }) => ({ question, answer })),
      });
      setSave(
        response.ok
          ? { state: "done", result: response.data }
          : {
              state: "error",
              message: t("Sign in to CareerOS to save answers."),
            },
      );
    } catch {
      setSave({
        state: "error",
        message: t("CareerOS could not save answers."),
      });
    }
  };

  if (save.state === "idle" || save.state === "reading") {
    return (
      <button
        type="button"
        className="secondary"
        disabled={!tab || save.state === "reading"}
        onClick={() => void read()}
      >
        {save.state === "reading"
          ? t("Reading your answers…")
          : t("Remember my answers on this page")}
      </button>
    );
  }

  if (save.state === "done" || save.state === "error") {
    return (
      <section className="page-card" aria-live="polite">
        <span className="eyebrow">{t("SAVED ANSWERS")}</span>
        <p className={save.state === "error" ? "memory-error" : undefined}>
          {save.state === "done"
            ? savedAnswersSummary(save.result)
            : save.message}
        </p>
        {save.state === "error" ? (
          <button type="button" onClick={() => void read()}>
            {t("Try again")}
          </button>
        ) : null}
      </section>
    );
  }

  const { answers, selected } = save;
  const toggle = (fieldId: string) => {
    const next = new Set(selected);
    if (next.has(fieldId)) next.delete(fieldId);
    else next.add(fieldId);
    setSave({ state: "choosing", answers, selected: next });
  };

  return (
    <section className="page-card" aria-live="polite">
      <span className="eyebrow">{t("SAVED ANSWERS")}</span>
      <h2>{t("Choose answers to reuse")}</h2>
      <p className="memory-note">
        {t(
          "CareerOS will fill these on future forms that ask the same question. You can remove them anytime in CareerOS → Me → Contact & answers.",
        )}
      </p>
      <div className="memory-form">
        {answers.map((answer) => (
          <label key={answer.fieldId} className="memory-choice">
            <input
              type="checkbox"
              checked={selected.has(answer.fieldId)}
              onChange={() => toggle(answer.fieldId)}
            />
            <span>
              {answer.question}
              <br />
              <strong>{answer.answer}</strong>
            </span>
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={save.state === "saving" || selected.size === 0}
        onClick={() => void persist(answers, selected)}
      >
        {save.state === "saving"
          ? t("Saving…")
          : t(
              selected.size === 1
                ? "Save {count} answer"
                : "Save {count} answers",
              { count: selected.size },
            )}
      </button>
    </section>
  );
}
