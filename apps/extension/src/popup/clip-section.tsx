import { useState } from "react";

import type {
  ClippedJob,
  ExtensionResponse,
  JobDraft,
  PopupRequest,
  TabContext,
} from "../shared/messages";
import { t } from "../shared/i18n";
import { clipDraftProblem } from "./tool-copy";

type ClipState =
  | { state: "idle" }
  | { state: "extracting" }
  | { state: "editing"; draft: JobDraft }
  | { state: "saving"; draft: JobDraft }
  | { state: "saved"; job: ClippedJob }
  | { state: "error"; message: string; draft: JobDraft | null };

const errorCopy: Record<string, string> = {
  UNAUTHENTICATED: "Sign in to CareerOS to save jobs.",
  UNSUPPORTED_PAGE: "Open a normal web page to save a job.",
  STALE_PAGE: "This tab changed. Close and reopen the popup.",
  UNAVAILABLE: "This page could not be read.",
};

async function send<T>(request: PopupRequest): Promise<ExtensionResponse<T>> {
  return chrome.runtime.sendMessage(request) as Promise<ExtensionResponse<T>>;
}

/**
 * Explicit-action job clipper: reads the active page only when asked, shows an
 * editable draft, and saves nothing until the user confirms.
 */
export function ClipSection({ tab }: { tab: TabContext | null }) {
  const [clip, setClip] = useState<ClipState>({ state: "idle" });

  const extract = async () => {
    if (!tab) return;
    setClip({ state: "extracting" });
    try {
      const response = await send<JobDraft>({
        type: "CAREEROS_EXTRACT_JOB",
        expectedTabId: tab.tabId,
        expectedPageUrl: tab.tabUrl,
      });
      setClip(
        response.ok
          ? { state: "editing", draft: response.data }
          : {
              state: "error",
              message: t(errorCopy[response.error]),
              draft: null,
            },
      );
    } catch {
      setClip({
        state: "error",
        message: t(errorCopy.UNAVAILABLE),
        draft: null,
      });
    }
  };

  const save = async (draft: JobDraft) => {
    if (!tab || clipDraftProblem(draft)) return;
    setClip({ state: "saving", draft });
    try {
      const response = await send<ClippedJob>({
        type: "CAREEROS_CLIP_JOB",
        title: draft.title,
        company: draft.company,
        location: draft.location,
        description: draft.description,
        market: draft.market,
        countryCode: draft.countryCode,
        workplaceType: draft.workplaceType,
        employmentType: draft.employmentType,
        expectedTabId: tab.tabId,
        expectedPageUrl: tab.tabUrl,
      });
      setClip(
        response.ok
          ? { state: "saved", job: response.data }
          : { state: "error", message: t(errorCopy[response.error]), draft },
      );
    } catch {
      setClip({
        state: "error",
        message: t(
          "CareerOS could not save this job. Check the description and try again.",
        ),
        draft,
      });
    }
  };

  if (clip.state === "idle" || clip.state === "extracting") {
    return (
      <button
        type="button"
        className="secondary"
        disabled={!tab || clip.state === "extracting"}
        onClick={() => void extract()}
      >
        {clip.state === "extracting"
          ? t("Reading this job…")
          : t("Save this job")}
      </button>
    );
  }

  if (clip.state === "saved") {
    return (
      <section className="page-card" aria-live="polite">
        <span className="eyebrow">{t("SAVED JOB")}</span>
        <h2>
          {clip.job.created ? t("Saved to CareerOS") : t("Already in CareerOS")}
        </h2>
        <p>{t("It is in your saved jobs in Discover.")}</p>
        <button
          type="button"
          onClick={() =>
            void send({ type: "CAREEROS_OPEN_JOB", jobId: clip.job.jobId })
          }
        >
          {t("Open in CareerOS")}
        </button>
      </section>
    );
  }

  const draft = clip.draft;
  if (!draft) {
    return (
      <section className="page-card" aria-live="polite">
        <span className="eyebrow">{t("SAVE JOB")}</span>
        <p className="memory-error">{clip.state === "error" && clip.message}</p>
        <button type="button" onClick={() => void extract()}>
          {t("Try again")}
        </button>
      </section>
    );
  }

  const update = (patch: Partial<JobDraft>) =>
    setClip({ state: "editing", draft: { ...draft, ...patch } });
  const problem = clipDraftProblem(draft);

  return (
    <section className="page-card" aria-live="polite">
      <span className="eyebrow">{t("SAVE JOB")}</span>
      <h2>{t("Check before saving")}</h2>
      <p className="memory-note">
        {draft.extraction === "STRUCTURED_DATA"
          ? t("Read from this page's job listing data.")
          : t(
              "No structured job data found — fields were guessed from page text. Please check them.",
            )}
      </p>
      <div className="memory-form">
        <label>
          {t("Title")}
          <input
            value={draft.title}
            maxLength={500}
            onChange={(event) => update({ title: event.target.value })}
          />
        </label>
        <label>
          {t("Company")}
          <input
            value={draft.company}
            maxLength={500}
            onChange={(event) => update({ company: event.target.value })}
          />
        </label>
        <label>
          {t("Location")}
          <input
            value={draft.location ?? ""}
            maxLength={500}
            onChange={(event) =>
              update({ location: event.target.value || null })
            }
          />
        </label>
        <label>
          {t("Description")}
          <textarea
            rows={5}
            value={draft.description}
            maxLength={100_000}
            onChange={(event) => update({ description: event.target.value })}
          />
        </label>
      </div>
      {clip.state === "error" ? (
        <p className="memory-error">{clip.message}</p>
      ) : problem ? (
        <p className="memory-note">{problem}</p>
      ) : null}
      <button
        type="button"
        disabled={clip.state === "saving" || problem !== null}
        onClick={() => void save(draft)}
      >
        {clip.state === "saving" ? t("Saving…") : t("Save to CareerOS")}
      </button>
    </section>
  );
}
